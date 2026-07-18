'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { fetchObstructionEvaluation, deleteObstructionEvaluation, parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'
import { PhotoViewerModal } from '@/components/discrepancies/modals'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { fetchMapImageDataUrl, compressImageForPdf } from '@/lib/utils'
import { baseDistanceUnit, fmtDistance } from '@/lib/distance-units'

// Compact relative-aware date for the saved-evaluation subtitle.
// Today / Yesterday / 'Mar 9 HHMMZ' (drop year same-year) /
// 'Mar 9, 2027 HHMMZ' (keep year cross-year). Same recipe used by
// /notams; most evaluations are recently created so the relative
// anchor lands often.
function compactObstructionDate(d: Date): string {
  const hhmm = d.toISOString().slice(11, 16).replace(':', '')
  const now = new Date()
  const dDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const todayDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diffDays = Math.round((dDay - todayDay) / 86400000)
  if (diffDays === 0) return `Today ${hhmm}Z`
  if (diffDays === 1) return `Tomorrow ${hhmm}Z`
  if (diffDays === -1) return `Yesterday ${hhmm}Z`
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear()
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return sameYear
    ? `${monthDay} ${hhmm}Z`
    : `${monthDay}, ${d.getUTCFullYear()} ${hhmm}Z`
}
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DetailGrid } from '@/components/ui/detail-grid'
import { toast } from 'sonner'
import { ArrowLeft, AlertTriangle, FileDown, Mail, Pencil, Trash2, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { getSurfaceSet } from '@/lib/airport-mode'
import { getUfcSurfaceInfo, getPart77Surfaces, getAnnex14SurfaceInfo, type SurfaceSet } from '@/lib/calculations/obstructions'
import { resolveStandardLabel } from '@/lib/calculations/surface-standards'

type SurfaceResult = {
  surfaceKey: string
  surfaceName: string
  isWithinBounds: boolean
  maxAllowableHeightAGL: number
  maxAllowableHeightMSL: number
  obstructionTopMSL: number
  violated: boolean
  penetrationFt: number
  ufcReference: string
  ufcCriteria: string
  baselineElevation?: number
  baselineLabel?: string
  calculationBreakdown?: string
}

const SURFACE_COLORS: Record<string, string> = {
  primary: '#EF4444',
  approach_departure: '#F97316',
  transitional: '#EAB308',
  inner_horizontal: '#22C55E',
  conical: '#3B82F6',
  outer_horizontal: '#8B5CF6',
  clear_zone: '#EC4899',
  graded_area: '#F43F5E',
  apz_i: '#D946EF',
  apz_ii: '#A78BFA',
}

export default function ObstructionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInstallation, defaultPdfEmail } = useInstallation()
  const id = params.id as string
  const [evaluation, setEvaluation] = useState<ObstructionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [showVerify, setShowVerify] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  useEffect(() => {
    async function load() {
      const data = await fetchObstructionEvaluation(id)
      setEvaluation(data)
      setLoading(false)
    }
    load()
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    setShowDeleteConfirm(false)
    const { error } = await deleteObstructionEvaluation(id)
    if (error) {
      alert(error)
      setDeleting(false)
      return
    }
    router.push('/obstructions/history')
  }

  const preparePdf = async () => {
    const eval_ = evaluation!
    const urls = parsePhotoPaths(eval_.photo_storage_path)
    const photoDataUrls: string[] = []
    for (const url of urls) {
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        photoDataUrls.push(await compressImageForPdf(dataUrl))
      } catch { /* skip */ }
    }
    let mapDataUrl: string | null = null
    if (eval_.latitude != null && eval_.longitude != null) {
      mapDataUrl = await fetchMapImageDataUrl(eval_.latitude, eval_.longitude)
    }
    const { generateObstructionPdf } = await import('@/lib/obstruction-pdf')
    return generateObstructionPdf({
      evaluation: eval_,
      photoDataUrls,
      mapDataUrl,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      distanceUnit: baseDistanceUnit(currentInstallation),
    })
  }

  const handleExportPdf = async () => {
    if (!evaluation) return
    setExporting(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
    } catch (err) {
      console.error('PDF export failed:', err)
      toast.error('Failed to generate PDF')
    }
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    if (!evaluation) return
    setExporting(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Failed to generate PDF')
    }
    setExporting(false)
  }

  const handleSendEmail = async (email: string) => {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `Obstruction Evaluation: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`)
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  if (loading) {
    return <LoadingState message="Loading evaluation..." />
  }

  if (!evaluation) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => router.back()} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
          padding: 0, marginBottom: 12, fontFamily: 'inherit',
        }}>
          <ArrowLeft size={14} /> Back
        </button>
        <EmptyState message="Evaluation not found" icon="🔍" />
      </div>
    )
  }

  const results = (evaluation.results || []) as SurfaceResult[]
  const applicableResults = results.filter((r) => r.isWithinBounds)
  const violatedResults = results.filter((r) => r.violated)
  const createdAt = new Date(evaluation.created_at)
  // Base display unit for result values (feet is identity for US bases).
  const resultUnit = baseDistanceUnit(currentInstallation)
  const photoPaths = parsePhotoPaths(evaluation.photo_storage_path)

  // Surface set this evaluation was pinned under at save time (or the
  // base's current default for legacy pre-surface_set rows) — the single
  // resolution both the standard label below and the legend use, so they
  // never disagree.
  const pinnedSurfaceSet: SurfaceSet =
    (evaluation.surface_set as SurfaceSet | null | undefined) ?? getSurfaceSet(currentInstallation)

  // Static map image URL for pinned location
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const hasCoords = evaluation.latitude != null && evaluation.longitude != null
  const staticMapUrl = hasCoords && mapboxToken && mapboxToken !== 'your-mapbox-token-here'
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${evaluation.longitude},${evaluation.latitude})/${evaluation.longitude},${evaluation.latitude},15,0/600x300@2x?access_token=${mapboxToken}&logo=false&attribution=false`
    : null

  return (
    <div style={{ padding: 16, paddingBottom: 120 }}>
      {/* Back link */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
          padding: 0, marginBottom: 12, fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Page header — tertiary tier-label + danger accent rule */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 6, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="var(--color-danger)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Obstruction Evaluation</div>
          <span style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '2px 9px',
            borderRadius: 'var(--radius-full)', letterSpacing: '0.04em',
            background: evaluation.has_violation
              ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
              : 'color-mix(in srgb, var(--color-success) 14%, transparent)',
            border: evaluation.has_violation
              ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
              : '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
            color: evaluation.has_violation ? 'var(--color-danger)' : 'var(--color-success)',
          }}>
            {evaluation.has_violation ? 'VIOLATION' : 'CLEAR'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            aria-label="Export PDF"
            title="Export PDF"
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-purple) 35%, transparent)',
              color: 'var(--color-purple)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: exporting ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <FileDown size={14} /> Export
          </button>
          <button
            onClick={handleEmailPdf}
            disabled={exporting}
            aria-label="Email PDF"
            title="Email PDF"
            style={{
              padding: '6px 10px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-purple) 35%, transparent)',
              color: 'var(--color-purple)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: exporting ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            <Mail size={14} />
          </button>
          <button
            onClick={() => router.push(`/obstructions?edit=${evaluation.id}`)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
              color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          color: 'var(--color-cyan)',
          fontSize: 'var(--fs-sm)',
          letterSpacing: '0.02em',
        }}>{evaluation.display_id}</span>
        <span>·</span>
        <span>{compactObstructionDate(createdAt)}</span>
      </div>

      {/* Photos — hero + thumbnail gallery */}
      {photoPaths.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {/* Hero image (first photo) */}
          <div
            style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-mid)', cursor: 'pointer' }}
            onClick={() => setViewerIndex(0)}
          >
            <img
              src={photoPaths[0]}
              alt="Obstruction"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
            />
          </div>
          {/* Thumbnail row for remaining photos */}
          {photoPaths.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {photoPaths.slice(1).map((url, i) => (
                <div
                  key={i}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-mid)',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => setViewerIndex(i + 1)}
                >
                  <img
                    src={url}
                    alt={`Obstruction ${i + 2}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pinned Location Map */}
      {staticMapUrl && (
        <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Pinned Location
          </div>
          <img
            src={staticMapUrl}
            alt="Obstruction location on map"
            style={{ width: '100%', display: 'block', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
          />
          <div style={{ padding: '4px 12px 8px', fontSize: 'var(--fs-sm)', color: 'var(--color-green)', fontFamily: 'monospace', fontWeight: 600 }}>
            {evaluation.latitude!.toFixed(5)}, {evaluation.longitude!.toFixed(5)}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="card" style={{ marginBottom: 10 }}>
        <span className="section-label">Obstruction Details</span>
        <DetailGrid gap={8} items={[
          { label: 'Height AGL', value: <span style={{ fontFamily: 'monospace' }}>{fmtDistance(evaluation.object_height_agl, resultUnit)}</span> },
          { label: 'Top Elevation MSL', value: <span style={{ fontFamily: 'monospace' }}>{fmtDistance(evaluation.obstruction_top_msl, resultUnit)}</span> },
          { label: 'Ground Elevation MSL', value: <span style={{ fontFamily: 'monospace' }}>{fmtDistance(evaluation.object_elevation_msl ?? (currentInstallation?.elevation_msl ?? 580), resultUnit)}</span> },
          { label: 'From Centerline', value: <span style={{ fontFamily: 'monospace' }}>{fmtDistance(evaluation.distance_from_centerline_ft, resultUnit)}</span> },
          { label: 'Coordinates', value: <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}>{evaluation.latitude?.toFixed(5)}°N, {evaluation.longitude ? Math.abs(evaluation.longitude).toFixed(5) : '—'}°W</span> },
          { label: 'Standard', value: resolveStandardLabel(pinnedSurfaceSet, evaluation.runway_class) },
        ]} />

        {evaluation.notes && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Description</span>
            <div style={{ color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', marginTop: 2 }}>
              {evaluation.notes}
            </div>
          </div>
        )}
      </div>

      {/* Controlling Surface */}
      {evaluation.controlling_surface && (
        <div className="card" style={{ marginBottom: 10 }}>
          <span className="section-label">Controlling Surface</span>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {evaluation.controlling_surface}
          </div>
        </div>
      )}

      {/* Surface set reference legend (collapsible). Prefer the row's
          pinned surface_set so old evaluations show the legend that
          matches their saved results, even if admin later flipped the
          base default. Legacy rows (NULL surface_set) fall back to
          the base's current default. */}
      <SurfaceSetLegend
        base={currentInstallation}
        pinnedSet={pinnedSurfaceSet}
        runwayClass={evaluation.runway_class}
      />

      {/* Surface-by-surface results */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span className="section-label" style={{ margin: 0, flex: 1 }}>Surface Analysis</span>
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
        {applicableResults.map((s) => {
          const surfaceColor = SURFACE_COLORS[s.surfaceKey] || 'var(--color-text-2)'
          const isLandUseZone = s.maxAllowableHeightMSL === -1
          return (
            <div
              key={s.surfaceKey}
              style={{
                background: 'var(--color-bg-inset)',
                border: s.violated
                  ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                  : isLandUseZone
                    ? `1px solid color-mix(in srgb, ${surfaceColor} 25%, transparent)`
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
                    background: surfaceColor,
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
                      background: `color-mix(in srgb, ${surfaceColor} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${surfaceColor} 35%, transparent)`,
                      color: surfaceColor,
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
                    {s.violated ? `VIOLATION (${fmtDistance(s.penetrationFt, resultUnit, { digits: 1 })})` : 'CLEAR'}
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
                    Max allowable: <strong style={{ color: 'var(--color-text-1)' }}>
                      {fmtDistance(s.maxAllowableHeightMSL, resultUnit)} MSL
                    </strong>{' '}
                    ({fmtDistance(s.maxAllowableHeightAGL, resultUnit)} AGL)
                  </div>
                  {s.baselineLabel && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2 }}>
                      Baseline: {s.baselineLabel}{s.baselineElevation != null ? ` (${fmtDistance(s.baselineElevation, resultUnit, { digits: 1 })} MSL)` : ''}
                    </div>
                  )}
                  {s.violated && (
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-red)', marginTop: 2 }}>
                      Penetration: {fmtDistance(s.penetrationFt, resultUnit, { digits: 1 })} above allowable height
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
                        Verify the numbers{resultUnit === 'm' ? ' (feet)' : ''}
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
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                {s.ufcReference}
              </div>
              {!isLandUseZone && !showVerify && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.3, fontStyle: 'italic' }}>
                  {s.ufcCriteria}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Violated surfaces summary with guidance */}
      {violatedResults.length > 0 && (
        <div
          className="card"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-danger) 25%, transparent)',
            background: 'color-mix(in srgb, var(--color-danger) 4%, var(--color-bg-surface))',
          }}
        >
          <span className="section-label" style={{ color: 'var(--color-red)' }}>
            Required Actions
          </span>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-red)', fontWeight: 700, marginBottom: 8 }}>
            OBSTRUCTION VIOLATION DETECTED — The following actions are required:
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            2. Per DAFMAN 13-204 Vol. 1 — Document all known airfield obstructions and coordinate waivers.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            3. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding obstruction impact on flying operations.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            4. Coordinate with BCE or Installation Community Planner to process a temporary or permanent waiver as required.
          </div>
          {violatedResults.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
                5. Address each violated surface:
              </div>
              <ul style={{ margin: '4px 0 0 32px', padding: 0, color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', lineHeight: 1.6 }}>
                {violatedResults.map((v, i) => (
                  <li key={i}>
                    {v.surfaceName} violation ({fmtDistance(v.penetrationFt, resultUnit, { digits: 1 })}) — {v.ufcReference}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Delete */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
            background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
            color: 'var(--color-danger)',
            fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: deleting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: deleting ? 0.5 : 1,
          }}
        >
          <Trash2 size={14} />
          {deleting ? 'Deleting...' : 'Delete Evaluation'}
        </button>
      </div>

      {/* Photo viewer modal */}
      {viewerIndex !== null && photoPaths.length > 0 && (
        <PhotoViewerModal
          photos={photoPaths.map((url, i) => ({ url, name: `Photo ${i + 1}` }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
            padding: 32,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-border-mid)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 320,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              Delete this Evaluation?
            </div>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 20 }}>
              This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-mid)',
                  background: 'transparent',
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Surface set legend — collapsible reference for the active set
// ─────────────────────────────────────────────────────────────

function SurfaceSetLegend({
  base,
  pinnedSet,
  runwayClass,
}: {
  base: { obstruction_surface_set?: 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14' | null } | null
  pinnedSet?: 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14' | null
  runwayClass?: string | null
}) {
  const [open, setOpen] = useState(false)
  // Pinned row value wins; fall back to the base default for legacy
  // rows that pre-date the surface_set column.
  const set = pinnedSet ?? getSurfaceSet(base)
  const isPart77 = set === 'faa_part77'
  const isIcao = set === 'icao_annex14'
  // For Part 77 we show the default approach type's surfaces; for ICAO the five
  // phase-1 Annex 14 surfaces; per-runway variants are documented in
  // /base-config/setup. UFC resolves the pinned runway class so a Class A /
  // Army-B row's legend matches its own result rows (legacy rows with no pinned
  // class fall back to Class B).
  const surfaces = isPart77
    ? Object.values(getPart77Surfaces())
    : isIcao
      ? getAnnex14SurfaceInfo()
      : Object.values(getUfcSurfaceInfo(runwayClass ?? 'B'))
  const setLabel = isPart77 ? 'FAA Part 77' : isIcao ? 'ICAO Annex 14' : 'UFC 3-260-01'
  const setSubtitle = isPart77
    ? '14 CFR §77.19 (default approach type — per-runway types in Base Setup)'
    : isIcao
      ? 'ICAO Annex 14 Vol I, 7th Ed. — five phase-1 surfaces (per-runway classification / code number in Base Setup)'
      : 'UFC 3-260-01 Ch. 3 + DoD Instruction 4165.57 (USAF airfields)'

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} color="var(--color-text-3)" /> : <ChevronRight size={14} color="var(--color-text-3)" />}
        <BookOpen size={14} color="var(--color-cyan)" />
        <span className="section-label" style={{ margin: 0, flex: 1 }}>
          Surface Set Reference — {setLabel}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          {surfaces.length} surfaces
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>
            {setSubtitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {surfaces.map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '14px 1fr auto',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-inset)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: s.color,
                    marginTop: 4,
                  }}
                  aria-hidden
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>
                    {s.description}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 'var(--fs-2xs)',
                    color: 'var(--color-text-4)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.ufcRef.split('—')[0].trim()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
