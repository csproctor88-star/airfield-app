'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { ArrowLeft, AlertTriangle, History, AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import UseMyLocationButton from '@/components/ui/use-my-location-button'
import CoordinateEntryInput from '@/components/ui/coordinate-entry-input'
import { formatDD, formatDMS, formatDDM, formatMGRS } from '@/lib/calculations/coordinates'
import { useInstallation } from '@/lib/installation-context'
import type { LatLon, RunwayGeometry } from '@/lib/calculations/geometry'
import { getRunwayGeometry, pointToRunwayRelation, distanceFt, bearing } from '@/lib/calculations/geometry'
import {
  evaluateObstruction,
  evaluateObstructionAllRunways,
  evaluateObstructionPart77,
  evaluateObstructionTaxiways,
  identifySurface,
  FAA_APPROACH_TYPE_LABELS,
  type ObstructionAnalysis,
  type MultiRunwayAnalysis,
  type TaxiwayGeometry,
  type TaxiwaySurfaceEvaluation,
  type FaaApproachType,
  type SurfaceSet,
} from '@/lib/calculations/obstructions'
import { getSurfaceSet, isCivilian } from '@/lib/airport-mode'
import { fetchTaxiways } from '@/lib/supabase/taxiways'
import { fetchElevation } from '@/lib/calculations/geometry'
import {
  createObstructionEvaluation,
  updateObstructionEvaluation,
  fetchObstructionEvaluation,
  parsePhotoPaths,
} from '@/lib/supabase/obstructions'
import { PhotoPickerInput } from '@/components/ui/photo-picker-input'

// Dynamic import for map (client-only, no SSR)
// Google Maps version for gov network performance; Mapbox version preserved as airfield-map.tsx
const AirfieldMap = dynamic(
  () => import('@/components/obstructions/airfield-map-google'),
  { ssr: false },
)

type PointInfo = {
  point: LatLon
  groundElevMSL: number | null
  distFromCenterline: number
  distFromThreshold: number
  nearerEnd: 'end1' | 'end2'
  closestRunwayLabel: string
  closestRunwayIndex: number
  surfaceName: string
  loadingElev: boolean
  withinApproachDeparture: boolean
}

export default function ObstructionsPage() {
  return (
    <Suspense>
      <ObstructionsContent />
    </Suspense>
  )
}

// Build the obstacle NOTAM coordinate string: DDMMSS{N|S}DDDMMSS{E|W}.
// Degrees-minutes-seconds, seconds truncated (not rounded), matching the FAA
// obstacle-NOTAM convention.
//   42.60522, -82.82047  ->  "423618N0824913W"
function toNotamCoordString(lat: number, lon: number): string {
  const fmt = (dec: number, degPad: number, pos: string, neg: string) => {
    const dir = dec >= 0 ? pos : neg
    const abs = Math.abs(dec)
    const d = Math.floor(abs)
    const minFloat = (abs - d) * 60
    const m = Math.floor(minFloat)
    const s = Math.floor((minFloat - m) * 60)
    return `${String(d).padStart(degPad, '0')}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}${dir}`
  }
  return `${fmt(lat, 2, 'N', 'S')}${fmt(lon, 3, 'E', 'W')}`
}

function ObstructionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { installationId, currentInstallation, runways } = useInstallation()

  // Airfield elevation from base config
  const airfieldElevMSL = currentInstallation?.elevation_msl ?? 580

  // Runway class from base runway config
  const runwayClass: 'B' | 'Army_B' = runways.length > 0
    ? ((runways[0].runway_class === 'Army_B' ? 'Army_B' : 'B') as 'B' | 'Army_B')
    : 'B'

  // Edit mode
  const editId = searchParams.get('edit')

  // Build runway geometries from ALL base runways. Each entry carries the
  // per-runway faa_approach_type so multi-runway Part 77 evaluations can
  // mix visual / non-precision / precision dimensions per runway.
  const getAllRunways = useCallback((): {
    label: string
    geometry: RunwayGeometry
    approachType?: FaaApproachType | null
  }[] => {
    if (runways.length > 0) {
      return runways.map((rwy) => ({
        label: rwy.runway_id ?? 'Unknown',
        geometry: getRunwayGeometry({
          end1: { latitude: rwy.end1_latitude ?? 0, longitude: rwy.end1_longitude ?? 0 },
          end2: { latitude: rwy.end2_latitude ?? 0, longitude: rwy.end2_longitude ?? 0 },
          length_ft: rwy.length_ft ?? 9000,
          width_ft: rwy.width_ft ?? 150,
          true_heading: rwy.true_heading ?? undefined,
          end1_elevation_msl: rwy.end1_elevation_msl,
          end2_elevation_msl: rwy.end2_elevation_msl,
          end1_designator: rwy.end1_designator,
          end2_designator: rwy.end2_designator,
        }),
        approachType: (rwy as { faa_approach_type?: FaaApproachType | null }).faa_approach_type ?? null,
      }))
    }
    return [{
      label: 'Default',
      geometry: getRunwayGeometry({
        end1: { latitude: 0, longitude: 0 },
        end2: { latitude: 0, longitude: 0 },
        length_ft: 9000,
        width_ft: 150,
      }),
      approachType: null,
    }]
  }, [runways])

  // Convenience: first runway geometry (for backward-compatible single-runway operations)
  const getRunway = useCallback((): RunwayGeometry => getAllRunways()[0].geometry, [getAllRunways])

  // Map / point state
  const [pointInfo, setPointInfo] = useState<PointInfo | null>(null)

  // Form state
  const [height, setHeight] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<{ file?: File; url: string }[]>([])

  // GPS location state
  const [flyToPoint, setFlyToPoint] = useState<LatLon | null>(null)

  // Surface set selection — defaults per base mode (UFC for USAF,
  // Part 77 for civilian). User can override per-evaluation.
  // In edit mode the loaded row's pinned surface_set is authoritative
  // (restored by the loadExisting effect below), so never reseed from
  // the installation: on a cold deep-link load, currentInstallation
  // resolves asynchronously — often AFTER loadExisting has pinned the
  // row's set — and an unguarded re-fire would silently revert the
  // state to the base default (desyncing header/map/picker from the
  // computed analysis, and letting a later save overwrite the row's
  // pinned surface_set). Reseeds as before once edit mode is left.
  const [surfaceSet, setSurfaceSet] = useState<SurfaceSet>(() => getSurfaceSet(currentInstallation))
  useEffect(() => {
    if (editId) return
    setSurfaceSet(getSurfaceSet(currentInstallation))
  }, [currentInstallation, editId])

  // Evaluation result — supports multi-runway
  const [multiAnalysis, setMultiAnalysis] = useState<MultiRunwayAnalysis | null>(null)
  // Convenience: first runway's full analysis (for save payload backward compat)
  const analysis: ObstructionAnalysis | null = multiAnalysis?.perRunway[0]?.analysis ?? null
  const [saving, setSaving] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  // Taxiway evaluation
  const [taxiwayGeometries, setTaxiwayGeometries] = useState<TaxiwayGeometry[]>([])
  const [taxiwayResults, setTaxiwayResults] = useState<TaxiwaySurfaceEvaluation[]>([])

  // Load taxiway centerlines on mount
  useEffect(() => {
    if (!installationId) return
    fetchTaxiways(installationId).then(tws => {
      setTaxiwayGeometries(tws.map(tw => ({
        id: tw.id,
        designator: tw.designator,
        taxiwayType: tw.taxiway_type as 'taxiway' | 'taxilane',
        tdg: tw.tdg,
        centerline: ((tw.centerline_coords as [number, number][]) || []).map(c => ({ lat: c[1], lon: c[0] })),
        standard: (tw.standard || 'faa') as 'faa' | 'ufc',
        runwayClass: tw.runway_class as 'A' | 'B' | null,
        serviceBranch: tw.service_branch as 'army' | 'air_force' | 'navy_mc' | null,
      })))
    })
  }, [installationId])

  // Helper: find the closest runway to a point
  const findClosestRunway = useCallback((point: LatLon) => {
    const allRwys = getAllRunways()
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < allRwys.length; i++) {
      const rel = pointToRunwayRelation(point, allRwys[i].geometry)
      if (rel.distanceFromCenterline < closestDist) {
        closestDist = rel.distanceFromCenterline
        closestIdx = i
      }
    }
    return { index: closestIdx, ...allRwys[closestIdx] }
  }, [getAllRunways])

  // Load existing evaluation in edit mode and auto-run analysis
  useEffect(() => {
    if (!editId) return
    async function loadExisting() {
      const existing = await fetchObstructionEvaluation(editId!)
      if (!existing) {
        toast.error('Evaluation not found')
        return
      }
      const h = Number(existing.object_height_agl)
      setHeight(String(h))
      setDescription(existing.notes || existing.description || '')
      const existingPhotos = parsePhotoPaths(existing.photo_storage_path)
      if (existingPhotos.length) {
        setPhotos(existingPhotos.map((url) => ({ url })))
      }
      // Restore the surface set this row was evaluated under (pinned at
      // save time) so the header, map overlay, and the re-run below all
      // match the saved results — not the page's current default. Legacy
      // rows (NULL surface_set) fall back to the base's current default,
      // same as the detail page's SurfaceSetLegend. Use this derived
      // value directly below rather than the `surfaceSet` state variable,
      // which won't reflect the setSurfaceSet call until the next render.
      const rowSurfaceSet: SurfaceSet =
        (existing.surface_set as SurfaceSet | null | undefined) ?? getSurfaceSet(currentInstallation)
      setSurfaceSet(rowSurfaceSet)
      if (existing.latitude && existing.longitude) {
        const point: LatLon = { lat: existing.latitude, lon: existing.longitude }
        const allRwys = getAllRunways()
        const surfaceName = identifySurface(point, allRwys, airfieldElevMSL, runwayClass, rowSurfaceSet)
        const groundElev = existing.object_elevation_msl ?? airfieldElevMSL
        const closest = findClosestRunway(point)
        const relation = pointToRunwayRelation(point, closest.geometry)
        const nearerThreshold = relation.nearerEnd === 'end1' ? closest.geometry.end1 : closest.geometry.end2
        const distToThreshold = distanceFt(point, nearerThreshold)
        const approachDepartureKey = rowSurfaceSet === 'faa_part77' ? 'approach' : 'approach_departure'
        const withinAD = allRwys.some(({ geometry, approachType }) => {
          const a = rowSurfaceSet === 'faa_part77'
            ? evaluateObstructionPart77(point, 0, null, geometry, airfieldElevMSL, approachType ?? undefined)
            : evaluateObstruction(point, 0, null, geometry, airfieldElevMSL, runwayClass)
          return a.surfaces.some((s) => s.surfaceKey === approachDepartureKey && s.isWithinBounds)
        })
        setPointInfo({
          point,
          groundElevMSL: groundElev,
          distFromCenterline: existing.distance_from_centerline_ft ?? 0,
          distFromThreshold: distToThreshold,
          nearerEnd: relation.nearerEnd,
          closestRunwayLabel: closest.label,
          closestRunwayIndex: closest.index,
          surfaceName,
          loadingElev: false,
          withinApproachDeparture: withinAD,
        })
        // Auto-run evaluation against all runways
        if (h > 0) {
          const result = evaluateObstructionAllRunways(point, h, groundElev, allRwys, airfieldElevMSL, runwayClass, rowSurfaceSet)
          setMultiAnalysis(result)
          if (taxiwayGeometries.length > 0) {
            setTaxiwayResults(evaluateObstructionTaxiways(point, taxiwayGeometries))
          }
        }
      }
    }
    loadExisting()
  }, [editId])

  // Handle map click
  const handlePointSelected = useCallback(async (point: LatLon) => {
    const allRwys = getAllRunways()
    const surfaceName = identifySurface(point, allRwys, airfieldElevMSL, runwayClass, surfaceSet)
    // Find closest runway for distance display
    const closest = findClosestRunway(point)
    const relation = pointToRunwayRelation(point, closest.geometry)
    const nearerThreshold = relation.nearerEnd === 'end1' ? closest.geometry.end1 : closest.geometry.end2
    const distToThreshold = distanceFt(point, nearerThreshold)
    const approachDepartureKey = surfaceSet === 'faa_part77' ? 'approach' : 'approach_departure'
    const withinAD = allRwys.some(({ geometry, approachType }) => {
      const a = surfaceSet === 'faa_part77'
        ? evaluateObstructionPart77(point, 0, null, geometry, airfieldElevMSL, approachType ?? undefined)
        : evaluateObstruction(point, 0, null, geometry, airfieldElevMSL, runwayClass)
      return a.surfaces.some((s) => s.surfaceKey === approachDepartureKey && s.isWithinBounds)
    })
    setPointInfo({
      point,
      groundElevMSL: null,
      distFromCenterline: relation.distanceFromCenterline,
      distFromThreshold: distToThreshold,
      nearerEnd: relation.nearerEnd,
      closestRunwayLabel: closest.label,
      closestRunwayIndex: closest.index,
      surfaceName,
      loadingElev: true,
      withinApproachDeparture: withinAD,
    })
    setMultiAnalysis(null)

    // Fetch real elevation
    const elev = await fetchElevation(point)
    setPointInfo((prev) =>
      prev
        ? {
            ...prev,
            groundElevMSL: elev ?? airfieldElevMSL,
            loadingElev: false,
          }
        : prev,
    )

    if (elev) {
      toast.success(`Elevation: ${elev.toFixed(0)} ft MSL`)
    } else {
      toast(`Using airfield elevation (${airfieldElevMSL} ft MSL)`, { description: 'Elevation API unavailable' })
    }
  }, [getAllRunways, findClosestRunway, airfieldElevMSL, runwayClass, surfaceSet])

  // Commit a typed coordinate. Reuses the full map-tap pipeline unchanged;
  // setFlyToPoint always receives a freshly spread object so the map's flyTo
  // effect fires even when re-placing numerically identical coordinates. Adds a
  // typed-entry-only >30 NM sanity warning (advisory, never blocks — map taps
  // and GPS deliberately don't get it).
  const handleTypedPoint = useCallback((point: LatLon) => {
    setFlyToPoint({ ...point })
    handlePointSelected(point)
    if (runways.length > 0) {
      const rwy = runways[0]
      const midpoint: LatLon = {
        lat: ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2,
        lon: ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2,
      }
      const nm = distanceFt(point, midpoint) / 6076.12
      if (nm > 30) {
        toast.warning(`Point is ~${Math.round(nm)} NM from the airfield — check hemisphere and format`)
      }
    }
  }, [handlePointSelected, runways])

  // Run the evaluation against all runways
  const runEvaluation = () => {
    if (!pointInfo) {
      toast.error('Select a point on the map first')
      return
    }
    const h = parseFloat(height)
    if (isNaN(h) || h <= 0) {
      toast.error('Enter a valid obstruction height')
      return
    }

    const result = evaluateObstructionAllRunways(
      pointInfo.point,
      h,
      pointInfo.groundElevMSL,
      getAllRunways(),
      airfieldElevMSL,
      runwayClass,
      surfaceSet,
    )
    setMultiAnalysis(result)

    // Taxiway evaluation
    const twResults = taxiwayGeometries.length > 0
      ? evaluateObstructionTaxiways(pointInfo.point, taxiwayGeometries)
      : []
    setTaxiwayResults(twResults)

    const twViolations = twResults.filter(r => r.violated)
    const totalViolations = result.violatedSurfaces.length + twViolations.length

    if (result.hasViolation || twViolations.length > 0) {
      toast.error(`VIOLATION — ${totalViolations} surface(s) penetrated`)
    } else {
      toast.success('No violations detected')
    }
  }

  // Read file as data URL via FileReader (reliable for preview)
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  // Compress a data URL to keep it small enough for DB storage
  const compressDataUrl = (dataUrl: string, maxDim = 800, quality = 0.7): Promise<string> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.warn('compressDataUrl: timed out after 10s, using original')
        resolve(dataUrl)
      }, 10000)
      const img = document.createElement('img')
      img.onload = () => {
        clearTimeout(timer)
        try {
          let w = img.naturalWidth
          let h = img.naturalHeight
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.warn('compressDataUrl: canvas context unavailable, using original')
            resolve(dataUrl)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          console.warn('compressDataUrl: compression failed, using original', err)
          resolve(dataUrl)
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        console.warn('compressDataUrl: image load failed, using original')
        resolve(dataUrl)
      }
      img.src = dataUrl
    })

  // Handle photo — use FileReader for immediate preview
  const handlePhoto = async (fileList: FileList) => {
    if (!fileList?.length) return
    const fileArray = Array.from(fileList)
    for (const file of fileArray) {
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setPhotos((prev) => [...prev, { file, url: dataUrl }])
      } catch {
        toast.error('Failed to read photo')
      }
    }
    toast.success(fileArray.length > 1 ? `${fileArray.length} photos attached` : 'Photo attached')
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Save to database
  const handleSave = async () => {
    if (!multiAnalysis || !analysis || !pointInfo) return
    setSaving(true)

    // Compress new photos (with File) for DB storage; keep existing URLs as-is
    let photoUrls: string[] = []
    try {
      for (const p of photos) {
        if (p.file) {
          photoUrls.push(await compressDataUrl(p.url))
        } else {
          photoUrls.push(p.url)
        }
      }
    } catch (err) {
      console.error('Photo compression failed:', err)
      // Fall back to raw data URLs for any remaining photos
      photoUrls = photos.map((p) => p.url)
    }

    // Collect surface results across all runways (tagged with runway label)
    const allSurfaceResults = multiAnalysis.perRunway.flatMap(({ runwayLabel, analysis: rwyAnalysis }) =>
      rwyAnalysis.surfaces.map((s) => ({
        surfaceKey: s.surfaceKey,
        surfaceName: s.surfaceName,
        runwayLabel,
        isWithinBounds: s.isWithinBounds,
        maxAllowableHeightAGL: s.maxAllowableHeightAGL,
        maxAllowableHeightMSL: s.maxAllowableHeightMSL,
        obstructionTopMSL: s.obstructionTopMSL,
        violated: s.violated,
        penetrationFt: s.penetrationFt,
        ufcReference: s.ufcReference,
        ufcCriteria: s.ufcCriteria,
        baselineElevation: s.baselineElevation,
        baselineLabel: s.baselineLabel,
        calculationBreakdown: s.calculationBreakdown,
      })),
    )

    const evaluationPayload = {
      object_height_agl: multiAnalysis.obstructionHeightAGL,
      object_distance_ft: pointInfo.distFromCenterline,
      distance_from_centerline_ft: pointInfo.distFromCenterline,
      object_elevation_msl: multiAnalysis.groundElevationMSL,
      obstruction_top_msl: multiAnalysis.obstructionTopMSL,
      latitude: multiAnalysis.point.lat,
      longitude: multiAnalysis.point.lon,
      description: description || null,
      photo_storage_paths: photoUrls,
      results: allSurfaceResults,
      controlling_surface: multiAnalysis.controllingSurface
        ? `${multiAnalysis.controllingSurface.surfaceName}${multiAnalysis.controllingSurface.runwayLabel ? ` (RWY ${multiAnalysis.controllingSurface.runwayLabel})` : ''}`
        : null,
      violated_surfaces: multiAnalysis.violatedSurfaces.map((s) =>
        `${s.surfaceName}${s.runwayLabel ? ` (RWY ${s.runwayLabel})` : ''}`,
      ),
      has_violation: multiAnalysis.hasViolation,
      notes: description || null,
      // Pin the surface set that produced these results so the
      // detail-page legend stays in sync even if admin later flips
      // bases.obstruction_surface_set.
      surface_set: surfaceSet,
    }

    let data, error
    if (editId) {
      ({ data, error } = await updateObstructionEvaluation(editId, evaluationPayload))
    } else {
      ({ data, error } = await createObstructionEvaluation({
        runway_class: runwayClass,
        ...evaluationPayload,
        base_id: installationId,
      }))
    }

    if (error || !data) {
      toast.error(error || 'Failed to save evaluation')
      setSaving(false)
      return
    }

    toast.success(editId ? 'Evaluation updated!' : 'Evaluation saved!')
    setSaving(false)
    router.push(`/obstructions/${data.id}`)
  }

  const surfaceAtPoint = multiAnalysis
    ? multiAnalysis.hasViolation
      ? 'violation'
      : 'No violation'
    : pointInfo?.surfaceName ?? null

  return (
    <div className="page-container" style={{ paddingBottom: 120 }}>
      {/* Back link */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none',
          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
          cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Page header — tertiary tier-label + danger accent rule (UFC
          3-260-01 imaginary-surface clearance/violation semantic) */}
      <div data-tour="obstructions-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 10, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="var(--color-danger)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>{editId ? 'Edit Evaluation' : 'Obstruction Evaluation'}</div>
        </div>
        <button
          onClick={() => router.push('/obstructions/history')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
            background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
            color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          <History size={14} /> History
        </button>
      </div>

      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {surfaceSet === 'faa_part77'
          ? 'FAA Part 77 (14 CFR §77.19) — Imaginary Surface Analysis'
          : 'UFC 3-260-01, Chapter 3 — Imaginary Surface Analysis'}
      </div>
      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginBottom: 10, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)', lineHeight: 1.4 }}>
        Surface overlays use FAA survey coordinates. Satellite imagery may not perfectly align with survey data due to basemap georegistration variance. All distance and surface calculations are based on published coordinates.
      </div>

      {/* Map */}
      <div data-tour="obstructions-map">
        <AirfieldMap
          onPointSelected={handlePointSelected}
          selectedPoint={pointInfo?.point ?? null}
          surfaceAtPoint={surfaceAtPoint}
          surfaceSet={surfaceSet}
          flyToPoint={flyToPoint}
          taxiways={taxiwayGeometries.map(tw => ({
            id: tw.id,
            designator: tw.designator,
            centerline: tw.centerline,
            standard: tw.standard,
            tdg: tw.tdg,
            taxiwayType: tw.taxiwayType,
            runwayClass: tw.runwayClass,
            serviceBranch: tw.serviceBranch,
          }))}
        />
      </div>

      {/* Use My Location */}
      <UseMyLocationButton
        variant="inline"
        onLocation={(c) => {
          const point: LatLon = { lat: c.lat, lon: c.lng }
          setFlyToPoint(point)
          handlePointSelected(point)
        }}
        style={{ marginTop: 8 }}
      />

      {/* Manual coordinate entry — type a point in DD / DMS / DDM / MGRS / packed
          NOTAM form; commits through the same pipeline as a map tap. */}
      <CoordinateEntryInput
        onPoint={handleTypedPoint}
        style={{ marginTop: 8 }}
      />

      {/* Point Info Card */}
      {pointInfo && (
        <div className="card" style={{ marginTop: 10 }}>
          <span className="section-label">Selected Location</span>
          <div className="detail-grid-2" style={{ fontSize: 'var(--fs-base)' }}>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Coordinates</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                {(() => {
                  const p = pointInfo.point
                  // Hemispheres derive from sign in every format — the whole
                  // point of the fix. MGRS is '' near the poles → show '—' and
                  // no copy button for that line.
                  const rows: { label: string; value: string }[] = [
                    { label: 'DD', value: formatDD(p) },
                    { label: 'DMS', value: formatDMS(p) },
                    { label: 'DDM', value: formatDDM(p) },
                    { label: 'MGRS', value: formatMGRS(p) || '—' },
                  ]
                  return rows.map(({ label, value }) => {
                    const copyable = value !== '—'
                    return (
                      <div
                        key={label}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontFamily: 'monospace', fontSize: 'var(--fs-sm)',
                        }}
                      >
                        <span style={{ color: 'var(--color-text-3)', minWidth: 42, flexShrink: 0 }}>{label}</span>
                        <span style={{ color: 'var(--color-text-1)', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
                        {copyable && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(value)
                                .then(() => toast.success('Coordinates copied'))
                                .catch(() => toast.error('Copy failed'))
                            }}
                            title={`Copy ${label} coordinates`}
                            aria-label={`Copy ${label} coordinates`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: 4, borderRadius: 'var(--radius-md)', flexShrink: 0,
                              border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
                              background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
                              color: 'var(--color-cyan)', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Centerline</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.distFromCenterline.toFixed(0)} ft
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Nearest Threshold</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.distFromThreshold.toFixed(0)} ft (RWY {pointInfo.nearerEnd === 'end1'
                  ? (runways[pointInfo.closestRunwayIndex]?.end1_designator ?? '01')
                  : (runways[pointInfo.closestRunwayIndex]?.end2_designator ?? '19')})
              </div>
            </div>
            {/* NOTAM-ready: full obstacle NOTAM, copy-ready */}
            {(() => {
              const notamString = toNotamCoordString(pointInfo.point.lat, pointInfo.point.lon)

              // Distance/bearing measured from the nearest runway threshold (as
              // the tool computed before). The NOTAM still references the base
              // ICAO per published-NOTAM convention.
              const rwy = runways[pointInfo.closestRunwayIndex]
              const thresholdCoord = pointInfo.nearerEnd === 'end1'
                ? { lat: rwy?.end1_latitude ?? pointInfo.point.lat, lon: rwy?.end1_longitude ?? pointInfo.point.lon }
                : { lat: rwy?.end2_latitude ?? pointInfo.point.lat, lon: rwy?.end2_longitude ?? pointInfo.point.lon }
              const nmDist = pointInfo.distFromThreshold / 6076.12
              const brg = bearing(thresholdCoord, pointInfo.point)
              const cardinal8 = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'][Math.round(brg / 45) % 8]
              const icao = (currentInstallation?.icao || '').toUpperCase()

              const heightNum = parseFloat(height)
              const aglFt = Number.isFinite(heightNum) ? heightNum : 0
              const groundMsl = pointInfo.groundElevMSL ?? airfieldElevMSL
              const mslFt = Math.round(groundMsl + aglFt)

              const typeText = description.trim().toUpperCase()
              const obstacleLine = `OBSTACLE${typeText ? ' ' + typeText : ''} ${notamString}`
              const distLine = ` (${nmDist.toFixed(2)}NM ${cardinal8}${icao ? ' ' + icao : ''}) ${mslFt}FT MSL`
              const aglLine = ` (${Math.round(aglFt)}FT AGL)`
              const notamFullText = `${obstacleLine}\n${distLine}\n${aglLine}`

              return (
                <div style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>NOTAM Reference</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(notamFullText)
                          .then(() => toast.success('NOTAM reference copied'))
                          .catch(() => toast.error('Copy failed'))
                      }}
                      title="Copy NOTAM reference"
                      aria-label="Copy NOTAM reference"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: 6, borderRadius: 'var(--radius-md)',
                        border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
                        background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
                        color: 'var(--color-cyan)', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <pre style={{
                    color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)',
                    marginTop: 6, marginBottom: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>{notamFullText}</pre>
                </div>
              )
            })()}
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Ground Elevation</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.loadingElev
                  ? 'Fetching...'
                  : `${(pointInfo.groundElevMSL ?? airfieldElevMSL).toFixed(0)} ft MSL`}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Surface Zone</span>
              <div
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--fs-sm)',
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {pointInfo.surfaceName}
              </div>
            </div>
            {pointInfo.withinApproachDeparture && (() => {
              const rwy = runways[pointInfo.closestRunwayIndex]
              const thresholdElev = pointInfo.nearerEnd === 'end1'
                ? rwy?.end1_elevation_msl
                : rwy?.end2_elevation_msl
              const designator = pointInfo.nearerEnd === 'end1'
                ? (rwy?.end1_designator ?? 'End 1')
                : (rwy?.end2_designator ?? 'End 2')
              return (
                <div>
                  <span style={{ color: 'var(--color-text-3)' }}>Nearest Threshold Elev</span>
                  <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                    {thresholdElev != null
                      ? `${thresholdElev.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft MSL (RWY ${designator})`
                      : `Not set (using ${airfieldElevMSL} ft airfield elev)`}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Evaluation Form */}
      <div className="card" style={{ marginTop: 10 }}>
        <span className="section-label">Obstruction Details</span>

        {/* Surface Set picker — defaults per base mode but operator can
            override for a what-if evaluation. Disabled in edit mode so
            the saved evaluation's set is preserved. */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Surface Set
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              { key: 'ufc_3_260_01' as SurfaceSet, label: 'UFC 3-260-01', sub: 'USAF airfields' },
              { key: 'faa_part77' as SurfaceSet,   label: 'FAA Part 77',  sub: '14 CFR §77.19 — civilian' },
            ]).map(opt => {
              const active = surfaceSet === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSurfaceSet(opt.key)}
                  disabled={!!editId}
                  title={editId ? 'Cannot change surface set when editing a saved evaluation' : undefined}
                  style={{
                    flex: '1 1 200px',
                    minWidth: 0,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${active
                      ? 'color-mix(in srgb, var(--color-cyan) 55%, transparent)'
                      : 'var(--color-border)'}`,
                    background: active
                      ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                      : 'var(--color-bg-inset)',
                    color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: active ? 700 : 500,
                    cursor: editId ? 'not-allowed' : 'pointer',
                    opacity: editId && !active ? 0.5 : 1,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span>{active ? '◉' : '○'}  {opt.label}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 400 }}>
                    {opt.sub}
                  </span>
                </button>
              )
            })}
          </div>
          {surfaceSet === 'faa_part77' && runways.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {(isCivilian(currentInstallation) || getSurfaceSet(currentInstallation) === 'faa_part77') ? (
                <>
                  Per-runway approach types drive Part 77 dimensions. Bases with mixed runway
                  categories should configure each runway&apos;s FAA Approach Type in{' '}
                  <a href="/base-config/setup" style={{ color: 'var(--color-accent)' }}>Base Setup → Runways</a>.
                  {runways.some(r => !(r as { faa_approach_type?: string | null }).faa_approach_type) && (
                    <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>
                      {runways.filter(r => !(r as { faa_approach_type?: string | null }).faa_approach_type).length} runway(s) not configured — defaulting to non-utility non-precision (&lt;¾ mi vis).
                    </span>
                  )}
                </>
              ) : (
                <>
                  This what-if evaluation uses non-utility non-precision (&lt;¾ mi) defaults for
                  every runway. Setting this base&apos;s obstruction surface set to Part 77 in{' '}
                  <a href="/base-config/setup" style={{ color: 'var(--color-accent)' }}>Base Setup</a>{' '}
                  unlocks per-runway FAA Approach Types.
                </>
              )}
            </div>
          )}
          {!isCivilian(currentInstallation) && surfaceSet === 'faa_part77' && (
            <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-warning)' }}>
              Evaluating under Part 77 on a non-civilian base — what-if scenario only.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Obstruction Height (ft AGL) *
          </label>
          <input
            type="number"
            className="input-dark"
            placeholder="e.g. 75"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Obstruction Description
          </label>
          <textarea
            className="input-dark"
            rows={2}
            style={{ resize: 'vertical' }}
            placeholder="e.g. Cell tower, construction crane, tree..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Photos */}
        <div style={{ marginBottom: 10 }}>
          <PhotoPickerInput onFiles={handlePhoto} />
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginTop: 8 }}>
              {photos.map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-active)',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--color-overlay)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={runEvaluation}
          disabled={!pointInfo || !height}
          style={{ opacity: !pointInfo || !height ? 0.5 : 1 }}
        >
          Evaluate Obstruction
        </button>
      </div>

      {/* Results */}
      {multiAnalysis && (
        <>
          {/* Summary Banner */}
          <div
            className="card"
            style={{
              marginTop: 10,
              borderColor: multiAnalysis.hasViolation
                ? 'color-mix(in srgb, var(--color-danger) 35%, transparent)'
                : 'color-mix(in srgb, var(--color-success) 35%, transparent)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: multiAnalysis.hasViolation
                    ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                    : 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                  border: multiAnalysis.hasViolation
                    ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                    : '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                  color: multiAnalysis.hasViolation ? 'var(--color-danger)' : 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {multiAnalysis.hasViolation ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 800,
                    color: multiAnalysis.hasViolation ? 'var(--color-danger)' : 'var(--color-status-pass)',
                  }}
                >
                  {multiAnalysis.hasViolation ? 'VIOLATION DETECTED' : 'NO VIOLATION'}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                  {multiAnalysis.controllingSurface
                    ? `Controlling surface: ${multiAnalysis.controllingSurface.surfaceName}${multiAnalysis.controllingSurface.runwayLabel ? ` (RWY ${multiAnalysis.controllingSurface.runwayLabel})` : ''}`
                    : 'Outside all imaginary surfaces'}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6,
                fontSize: 'var(--fs-sm)',
                marginTop: 4,
              }}
            >
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>Total Obstruction Height MSL</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {multiAnalysis.obstructionTopMSL.toFixed(0)} ft MSL
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>Max Allowable</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {multiAnalysis.controllingSurface
                    ? `${multiAnalysis.controllingSurface.maxAllowableHeightMSL.toFixed(0)} ft MSL`
                    : 'N/A'}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>CL Distance</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {pointInfo?.distFromCenterline.toFixed(0) ?? '—'} ft
                </div>
              </div>
            </div>
          </div>

          {/* Per-runway surface analysis */}
          {multiAnalysis.perRunway.map(({ runwayLabel, analysis: rwyAnalysis }) => (
            <div className="card" style={{ marginTop: 10 }} key={runwayLabel}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span className="section-label" style={{ margin: 0, flex: 1 }}>
                  {multiAnalysis.perRunway.length > 1
                    ? `Surface Analysis — RWY ${runwayLabel}`
                    : 'Surface Analysis'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVerify((v) => !v)}
                  style={{
                    background: showVerify
                      ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                      : 'var(--color-bg-inset)',
                    border: showVerify
                      ? '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)'
                      : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '3px 9px',
                    color: showVerify ? 'var(--color-cyan)' : 'var(--color-text-2)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showVerify ? 'Hide math' : 'Verify the numbers'}
                </button>
              </div>
              {rwyAnalysis.surfaces
                .filter((s) => s.isWithinBounds)
                .map((s) => {
                  const isLandUseZone = s.maxAllowableHeightMSL === -1
                  return (
                    <div
                      key={s.surfaceKey}
                      style={{
                        background: 'var(--color-bg-inset)',
                        border: s.violated
                          ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                          : isLandUseZone
                            ? `1px solid color-mix(in srgb, ${s.color} 25%, transparent)`
                            : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 'var(--radius-xs)',
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
                          {s.surfaceName}
                        </span>
                        {isLandUseZone ? (
                          <span
                            style={{
                              fontSize: 'var(--fs-2xs)',
                              fontWeight: 700,
                              padding: '2px 9px',
                              borderRadius: 'var(--radius-full)',
                              background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
                              color: s.color,
                              letterSpacing: '0.04em',
                            }}
                          >
                            WITHIN ZONE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 'var(--fs-2xs)',
                              fontWeight: 700,
                              padding: '2px 9px',
                              borderRadius: 'var(--radius-full)',
                              background: s.violated
                                ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                                : 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                              border: s.violated
                                ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                                : '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                              color: s.violated ? 'var(--color-danger)' : 'var(--color-success)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {s.violated ? `VIOLATION (${s.penetrationFt.toFixed(1)} ft)` : 'CLEAR'}
                          </span>
                        )}
                      </div>
                      {isLandUseZone ? (
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                          {s.ufcCriteria}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.4 }}>
                            Max allowable: <strong style={{ color: 'var(--color-text-1)' }}>{s.maxAllowableHeightMSL.toFixed(0)} ft MSL</strong>
                            {' '}({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
                          </div>
                          {s.baselineLabel && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2 }}>
                              Baseline: {s.baselineLabel}{s.baselineElevation != null ? ` (${s.baselineElevation.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft MSL)` : ''}
                            </div>
                          )}
                          {showVerify && s.calculationBreakdown && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: '6px 8px',
                                background: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 3 }}>
                                Verify the numbers
                              </div>
                              <div style={{ fontSize: 'var(--fs-sm)', fontFamily: 'monospace', color: 'var(--color-text-1)', lineHeight: 1.5 }}>
                                {s.calculationBreakdown}
                              </div>
                              <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace', color: 'var(--color-text-2)', marginTop: 2 }}>
                                Obstruction top: {s.obstructionTopMSL.toFixed(1)} ft MSL
                                {s.violated
                                  ? ` — exceeds by ${s.penetrationFt.toFixed(1)} ft`
                                  : ` — ${(s.maxAllowableHeightMSL - s.obstructionTopMSL).toFixed(1)} ft clear`}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                        {s.ufcReference}
                      </div>
                    </div>
                  )
                })}

              {/* Surfaces the point is NOT within */}
              {rwyAnalysis.surfaces.filter((s) => !s.isWithinBounds).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                    NOT APPLICABLE AT THIS LOCATION:
                  </div>
                  {rwyAnalysis.surfaces
                    .filter((s) => !s.isWithinBounds)
                    .map((s) => (
                      <div
                        key={s.surfaceKey}
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--color-text-3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          paddingLeft: 4,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-xs)', background: s.color, opacity: 0.3, flexShrink: 0 }} />
                        {s.surfaceName}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}

          {/* Taxiway Surface Analysis */}
          {taxiwayResults.length > 0 && (
            <div className="card" style={{ marginTop: 10 }}>
              <span className="section-label" style={{ margin: 0, marginBottom: 6 }}>
                Taxiway Surface Analysis
              </span>
              {taxiwayResults
                .filter(r => r.isWithinBounds)
                .map((r, i) => (
                  <div
                    key={`${r.taxiwayId}-${r.surfaceKey}-${i}`}
                    style={{
                      background: 'var(--color-bg-inset)',
                      border: r.violated
                        ? '1px solid color-mix(in srgb, var(--color-amber) 35%, transparent)'
                        : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 10,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-xs)', background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
                        {r.surfaceName}
                      </span>
                      <span style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '2px 9px', borderRadius: 'var(--radius-full)',
                        background: r.violated
                          ? 'color-mix(in srgb, var(--color-amber) 14%, transparent)'
                          : 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                        border: r.violated
                          ? '1px solid color-mix(in srgb, var(--color-amber) 35%, transparent)'
                          : '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                        color: r.violated ? 'var(--color-amber)' : 'var(--color-success)',
                        letterSpacing: '0.04em',
                      }}>
                        {r.violated ? 'WITHIN OFA' : 'CLEAR'}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                      Distance from centerline: <strong style={{ color: 'var(--color-text-1)' }}>{r.distanceFromCenterlineFt} ft</strong>
                      {' '}| OFA boundary: {r.halfWidthFt} ft
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                      {r.ufcReference}
                    </div>
                  </div>
                ))}
              {taxiwayResults.filter(r => !r.isWithinBounds).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                    OUTSIDE TAXIWAY SURFACES:
                  </div>
                  {taxiwayResults
                    .filter(r => !r.isWithinBounds)
                    .map((r, i) => (
                      <div
                        key={`${r.taxiwayId}-${r.surfaceKey}-outside-${i}`}
                        style={{
                          fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
                          display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4, marginBottom: 2,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-xs)', background: r.color, opacity: 0.3, flexShrink: 0 }} />
                        {r.surfaceName} ({r.distanceFromCenterlineFt} ft from CL)
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* UFC References (only if violations) */}
          {multiAnalysis.hasViolation && (
            <div
              className="card"
              style={{
                marginTop: 10,
                borderColor: 'color-mix(in srgb, var(--color-danger) 25%, transparent)',
                background: 'color-mix(in srgb, var(--color-danger) 4%, var(--color-bg-surface))',
              }}
            >
              <span className="section-label" style={{ color: 'var(--color-danger)' }}>
                Applicable UFC References
              </span>
              {multiAnalysis.violatedSurfaces.map((vs, i) => (
                <div
                  key={`${vs.surfaceKey}-${vs.runwayLabel ?? i}`}
                  style={{
                    background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
                    {vs.ufcReference}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {vs.surfaceName}{vs.runwayLabel ? ` (RWY ${vs.runwayLabel})` : ''} — {vs.penetrationFt.toFixed(1)} ft penetration
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                    {vs.ufcCriteria}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save Evaluation */}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : editId ? 'Update Evaluation' : 'Save Evaluation'}
            </button>
          </div>
        </>
      )}

    </div>
  )
}
