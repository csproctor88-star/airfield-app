import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { offsetPoint, normalizeBearing } from '@/lib/calculations/geometry'

// POST /api/generate-approach-lights?baseId=<uuid>
// Generates SALS (RWY 01) and ALSF-1 (RWY 19) approach lighting systems
// per FAA AC 150/5340-30J diagrams (Figures 3-7 and 3-1).
// Threshold lights are a separate system (Chapter 4) and NOT included here.

// Selfridge RWY 01/19 data
const RWY01_THRESHOLD = { lat: 42.601550, lon: -82.837339 }
const RWY19_THRESHOLD = { lat: 42.626239, lon: -82.836481 }
const RWY_HEADING_01_TO_19 = 2 // true heading from 01 end toward 19 end

// Approach bearings — direction lights extend AWAY from the runway
// (opposite of the landing direction)
const APPROACH_01 = normalizeBearing(RWY_HEADING_01_TO_19 + 180) // ~182° (south of RWY 01)
const APPROACH_19 = RWY_HEADING_01_TO_19 // ~2° (north of RWY 19)

type LightPoint = {
  longitude: number
  latitude: number
  label: string
  rotation: number
}

/** Helper: generate a lateral bar of lights centered on a point */
function generateBar(
  center: { lat: number; lon: number },
  perpL: number,
  perpR: number,
  halfWidth: number,
  spacing: number,
  label: string,
  rotation: number,
): LightPoint[] {
  const lights: LightPoint[] = []
  const count = Math.floor(halfWidth * 2 / spacing) + 1
  const actualHalf = (count - 1) * spacing / 2

  for (let i = 0; i < count; i++) {
    const offset = -actualHalf + i * spacing
    if (Math.abs(offset) < 0.1) {
      // Center light
      lights.push({ longitude: center.lon, latitude: center.lat, label, rotation })
    } else {
      const dir = offset < 0 ? perpL : perpR
      const pt = offsetPoint(center, dir, Math.abs(offset))
      lights.push({ longitude: pt.lon, latitude: pt.lat, label, rotation })
    }
  }
  return lights
}

// ══════════════════════════════════════════════════════════════════
// SALS — Short Approach Light System (RWY 01, south end)
// Per FAA AC 150/5340-30J, Figure 3-7
//
// Total length: 1,500 ft from threshold
// Layout (from threshold outward):
//   100 ft:  Terminating bar — 20 ft wide (5 lights @ 5 ft)
//   200-800 ft: Centerline bars every 200 ft — 3 lights @ 5 ft each
//   1,000 ft: 1000-ft light bar — 50 ft wide (11 lights @ 5 ft)
//   1,000-1,500 ft: 5 elevated sequenced flashers @ 100 ft intervals
// ══════════════════════════════════════════════════════════════════
function generateSALS(): LightPoint[] {
  const lights: LightPoint[] = []
  const bearing = APPROACH_01
  const perpL = normalizeBearing(bearing - 90)
  const perpR = normalizeBearing(bearing + 90)
  const barRotation = Math.round(normalizeBearing(bearing + 90))
  const flasherRotation = Math.round(normalizeBearing(bearing))

  // 1. Terminating bar at 100 ft — 20 ft wide, 5 lights @ 5 ft spacing
  const termCenter = offsetPoint(RWY01_THRESHOLD, bearing, 100)
  lights.push(...generateBar(termCenter, perpL, perpR, 10, 5, 'SALS TERM', barRotation))

  // 2. Centerline bars at 200, 400, 600, 800 ft — 3 lights @ 5 ft spacing (10 ft wide)
  for (let dist = 200; dist <= 800; dist += 200) {
    const center = offsetPoint(RWY01_THRESHOLD, bearing, dist)
    lights.push(...generateBar(center, perpL, perpR, 5, 5, `SALS CL ${dist}`, barRotation))
  }

  // 3. 1000-ft light bar — 50 ft wide, 11 lights @ 5 ft spacing
  const bar1000 = offsetPoint(RWY01_THRESHOLD, bearing, 1000)
  lights.push(...generateBar(bar1000, perpL, perpR, 25, 5, 'SALS 1000 BAR', barRotation))

  // 4. Sequenced flashers — 5 units at 1100, 1200, 1300, 1400, 1500 ft
  for (let dist = 1100; dist <= 1500; dist += 100) {
    const pt = offsetPoint(RWY01_THRESHOLD, bearing, dist)
    lights.push({
      longitude: pt.lon, latitude: pt.lat,
      label: `SALS SFL ${dist}`,
      rotation: flasherRotation,
    })
  }

  return lights
}

// ══════════════════════════════════════════════════════════════════
// ALSF-1 — Approach Light System with Sequenced Flashing Lights, Cat I
// (RWY 19, north end)
// Per FAA AC 150/5340-30J, Figure 3-1
//
// Total length: 3,000 ft from threshold
// Layout (from threshold outward):
//   100 ft:  Terminating bar — 25 ft wide (6 lights @ 5 ft)
//   200-900 ft: Centerline bars every 100 ft — 5 lights @ 5 ft each
//   1,000 ft: 1000-ft light bar — 50 ft wide (11 lights @ 5 ft)
//   1,000-3,000 ft: 21 sequenced flashers @ 100 ft intervals
// ══════════════════════════════════════════════════════════════════
function generateALSF1(): LightPoint[] {
  const lights: LightPoint[] = []
  const bearing = APPROACH_19
  const perpL = normalizeBearing(bearing - 90)
  const perpR = normalizeBearing(bearing + 90)
  const barRotation = Math.round(normalizeBearing(bearing + 90))
  const flasherRotation = Math.round(normalizeBearing(bearing))

  // 1. Terminating bar at 100 ft — 25 ft wide, 6 lights @ 5 ft spacing
  const termCenter = offsetPoint(RWY19_THRESHOLD, bearing, 100)
  lights.push(...generateBar(termCenter, perpL, perpR, 12.5, 5, 'ALSF-1 TERM', barRotation))

  // 2. Centerline bars every 100 ft from 200 to 900 ft — 5 lights @ 5 ft each (20 ft wide)
  for (let dist = 200; dist <= 900; dist += 100) {
    const center = offsetPoint(RWY19_THRESHOLD, bearing, dist)
    lights.push(...generateBar(center, perpL, perpR, 10, 5, `ALSF-1 CL ${dist}`, barRotation))
  }

  // 3. 1000-ft light bar — 50 ft wide, 11 lights @ 5 ft spacing
  const bar1000 = offsetPoint(RWY19_THRESHOLD, bearing, 1000)
  lights.push(...generateBar(bar1000, perpL, perpR, 25, 5, 'ALSF-1 1000 BAR', barRotation))

  // 4. 21 sequenced flashers from 1000 to 3000 ft at 100 ft intervals
  for (let dist = 1000; dist <= 3000; dist += 100) {
    const pt = offsetPoint(RWY19_THRESHOLD, bearing, dist)
    lights.push({
      longitude: pt.lon, latitude: pt.lat,
      label: `ALSF-1 SFL ${dist}`,
      rotation: flasherRotation,
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

  // Check if approach lights already exist — prevent duplicates
  const { count } = await supabase
    .from('infrastructure_features')
    .select('*', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('feature_type', 'approach_light')

  if (count && count > 0) {
    return NextResponse.json({
      error: `${count} approach lights already exist. Delete them first (filter by SALS-RWY01 / ALSF1-RWY19 layers) to regenerate.`,
    }, { status: 409 })
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
      sals: `SALS RWY 01: ${salsLights.length} lights — terminating bar, 4 centerline bars, 1000ft bar, 5 flashers`,
      alsf1: `ALSF-1 RWY 19: ${alsf1Lights.length} lights — terminating bar, 8 centerline bars, 1000ft bar, 21 flashers`,
    },
  })
}
