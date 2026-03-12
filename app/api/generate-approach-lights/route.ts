import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { offsetPoint, normalizeBearing } from '@/lib/calculations/geometry'

// POST /api/generate-approach-lights?baseId=<uuid>
// Generates SALS (RWY 01) and ALSF-1 (RWY 19) approach lighting systems
// based on Selfridge ANGB RWY 01/19 geometry.

// Selfridge RWY 01/19 data
const RWY01_THRESHOLD = { lat: 42.601550, lon: -82.837339 }
const RWY19_THRESHOLD = { lat: 42.626239, lon: -82.836481 }
const RWY_HEADING_01_TO_19 = 2 // true heading from 01 end toward 19 end

// Inbound approach bearings (opposite of runway direction toward that end)
const INBOUND_01 = normalizeBearing(RWY_HEADING_01_TO_19 + 180) // ~182° (approaching from south toward 01)
const INBOUND_19 = RWY_HEADING_01_TO_19 // ~2° (approaching from north toward 19)

type LightPoint = {
  longitude: number
  latitude: number
  label: string
  rotation: number
}

// ── SALS — Simple/Short Approach Lighting System (RWY 01) ──
// Per FAA AC 150/5340-30J:
// - 1,400 ft total length from threshold
// - Centerline bars every 200 ft (7 bars)
// - Each centerline bar: 3 lights spaced 4 ft apart (narrow row)
// - Threshold bar: 10 lights spanning ~60 ft
// - Sequenced flashers at 200 ft intervals (1,400 to 200 ft out)
function generateSALS(): LightPoint[] {
  const lights: LightPoint[] = []
  const approachBearing = INBOUND_01 // direction lights extend FROM threshold
  const perpL = normalizeBearing(approachBearing - 90)
  const perpR = normalizeBearing(approachBearing + 90)
  // Rotation for all lights: perpendicular to approach (crossbar orientation)
  const crossbarRotation = Math.round(normalizeBearing(approachBearing + 90))

  // Threshold bar — row of lights at the threshold, spanning 60 ft
  const thresholdSpacing = 8 // ft between lights
  const thresholdCount = 8
  const thresholdHalfWidth = (thresholdCount - 1) * thresholdSpacing / 2
  for (let i = 0; i < thresholdCount; i++) {
    const offset = -thresholdHalfWidth + i * thresholdSpacing
    const dir = offset < 0 ? perpL : perpR
    const pt = offsetPoint(RWY01_THRESHOLD, dir, Math.abs(offset))
    lights.push({
      longitude: pt.lon, latitude: pt.lat,
      label: 'SALS THR',
      rotation: crossbarRotation,
    })
  }

  // Centerline bars every 200 ft from 200 to 1,400 ft
  for (let dist = 200; dist <= 1400; dist += 200) {
    const center = offsetPoint(RWY01_THRESHOLD, approachBearing, dist)
    // Each bar: 3 lights, 4 ft spacing
    for (const lateralOffset of [-4, 0, 4]) {
      const dir = lateralOffset < 0 ? perpL : perpR
      const pt = lateralOffset === 0 ? center : offsetPoint(center, dir, Math.abs(lateralOffset))
      lights.push({
        longitude: pt.lon, latitude: pt.lat,
        label: `SALS ${dist}`,
        rotation: crossbarRotation,
      })
    }
  }

  // Sequenced flashers — 5 flashers at 200, 400, 600, 800, 1000 ft
  for (let dist = 200; dist <= 1000; dist += 200) {
    const pt = offsetPoint(RWY01_THRESHOLD, approachBearing, dist)
    // Offset slightly to distinguish from centerline bars
    const flasher = offsetPoint(pt, perpR, 12)
    lights.push({
      longitude: flasher.lon, latitude: flasher.lat,
      label: `SALS SFL ${dist}`,
      rotation: Math.round(normalizeBearing(approachBearing)),
    })
  }

  return lights
}

// ── ALSF-1 — Approach Light System with Sequenced Flashing Lights, Cat I (RWY 19) ──
// Per FAA AC 150/5340-30J:
// - 2,400 ft total length from threshold
// - Centerline bars every 200 ft (12 bars at 200-2,400 ft)
// - Each centerline bar: 5 lights spanning ~12 ft
// - 1,000 ft crossbar: 15 lights spanning ~72 ft on each side of centerline
// - Threshold bar: row of lights
// - Sequenced flashers from 200 to 2,400 ft
function generateALSF1(): LightPoint[] {
  const lights: LightPoint[] = []
  const approachBearing = INBOUND_19
  const perpL = normalizeBearing(approachBearing - 90)
  const perpR = normalizeBearing(approachBearing + 90)
  const crossbarRotation = Math.round(normalizeBearing(approachBearing + 90))

  // Threshold bar — 14 lights spanning ~84 ft
  const thresholdSpacing = 6
  const thresholdCount = 14
  const thresholdHalfWidth = (thresholdCount - 1) * thresholdSpacing / 2
  for (let i = 0; i < thresholdCount; i++) {
    const offset = -thresholdHalfWidth + i * thresholdSpacing
    const dir = offset < 0 ? perpL : perpR
    const pt = offset === 0
      ? RWY19_THRESHOLD
      : offsetPoint(RWY19_THRESHOLD, dir, Math.abs(offset))
    lights.push({
      longitude: pt.lon, latitude: pt.lat,
      label: 'ALSF-1 THR',
      rotation: crossbarRotation,
    })
  }

  // Centerline bars every 200 ft from 200 to 2,400 ft
  for (let dist = 200; dist <= 2400; dist += 200) {
    const center = offsetPoint(RWY19_THRESHOLD, approachBearing, dist)

    // Standard bar: 5 lights, 3 ft spacing
    for (const lateralOffset of [-6, -3, 0, 3, 6]) {
      const dir = lateralOffset < 0 ? perpL : perpR
      const pt = lateralOffset === 0 ? center : offsetPoint(center, dir, Math.abs(lateralOffset))
      lights.push({
        longitude: pt.lon, latitude: pt.lat,
        label: `ALSF-1 ${dist}`,
        rotation: crossbarRotation,
      })
    }

    // 1,000 ft crossbar — wider bar with 15 additional lights on each side
    if (dist === 1000) {
      const crossbarSpacing = 5 // ft between crossbar lights
      // Left side: 15 lights from 10 ft to 80 ft
      for (let j = 1; j <= 15; j++) {
        const pt = offsetPoint(center, perpL, 10 + j * crossbarSpacing)
        lights.push({
          longitude: pt.lon, latitude: pt.lat,
          label: 'ALSF-1 XBAR',
          rotation: crossbarRotation,
        })
      }
      // Right side: 15 lights from 10 ft to 80 ft
      for (let j = 1; j <= 15; j++) {
        const pt = offsetPoint(center, perpR, 10 + j * crossbarSpacing)
        lights.push({
          longitude: pt.lon, latitude: pt.lat,
          label: 'ALSF-1 XBAR',
          rotation: crossbarRotation,
        })
      }
    }
  }

  // Sequenced flashers — at each 200 ft station from 200 to 2,400 ft
  for (let dist = 200; dist <= 2400; dist += 200) {
    const pt = offsetPoint(RWY19_THRESHOLD, approachBearing, dist)
    const flasher = offsetPoint(pt, perpR, 15)
    lights.push({
      longitude: flasher.lon, latitude: flasher.lat,
      label: `ALSF-1 SFL ${dist}`,
      rotation: Math.round(normalizeBearing(approachBearing)),
    })
  }

  return lights
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const baseId = searchParams.get('baseId')

  if (!baseId) {
    return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
  }

  const supabase = createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Generate both systems
  const salsLights = generateSALS()
  const alsf1Lights = generateALSF1()
  const allLights = [...salsLights, ...alsf1Lights]

  const rows = allLights.map(l => ({
    base_id: baseId,
    feature_type: 'approach_light',
    longitude: l.longitude,
    latitude: l.latitude,
    layer: l.label.startsWith('SALS') ? 'SALS-RWY01' : 'ALSF1-RWY19',
    block: null,
    label: l.label,
    notes: null,
    rotation: l.rotation,
    source: 'import' as const,
    created_by: user.id,
  }))

  // Insert in batches of 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('infrastructure_features')
      .insert(batch as any)
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 })
    }
    inserted += batch.length
  }

  return NextResponse.json({
    inserted,
    sals: salsLights.length,
    alsf1: alsf1Lights.length,
    summary: {
      sals: `SALS RWY 01: ${salsLights.length} lights (threshold bar, 7 centerline bars, 5 sequenced flashers)`,
      alsf1: `ALSF-1 RWY 19: ${alsf1Lights.length} lights (threshold bar, 12 centerline bars, 1000ft crossbar, 12 sequenced flashers)`,
    },
  })
}
