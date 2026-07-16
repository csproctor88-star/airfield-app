import { createClient } from '@/lib/supabase/client'
import type { WizardStepKey } from '@/lib/modules-config'

// ── Types ──────────────────────────────────────────────────────────

export type QuickSetupStepKey = 'runways' | 'areas' | 'navaids' | 'lighting' | 'templates'

export const QUICK_SETUP_STEPS: readonly QuickSetupStepKey[] = [
  'runways',
  'areas',
  'navaids',
  'lighting',
  'templates',
]

/** Steps that admins must fill manually — Quick Setup never pre-fills these. */
export const QUICK_SETUP_MANUAL_STEPS: readonly WizardStepKey[] = [
  'taxiways',
  'shops',
  'arff',
  'facilities',
  'shiftchecklist',
  'qrc',
  'scnagencies',
  'wildlife',
  'statusboards',
  'pprcolumns',
  'feedback',
]

export type RunwayDraft = {
  runway_id: string
  length_ft: number
  width_ft: number
  surface: string
  end1_designator: string
  end1_latitude: number | null
  end1_longitude: number | null
  end1_elevation_msl: number | null
  end1_heading: number | null
  end1_approach_lighting: string | null
  end2_designator: string
  end2_latitude: number | null
  end2_longitude: number | null
  end2_elevation_msl: number | null
  end2_heading: number | null
  end2_approach_lighting: string | null
}

export type NavaidDraft = {
  navaid_name: string
}

export type LightingSystemDraft = {
  name: string
  runway_taxiway: string | null
  type: string
}

export type QuickSetupDraft = {
  runways?: RunwayDraft[]
  areas?: string[]
  navaids?: NavaidDraft[]
  lighting?: LightingSystemDraft[]
  templates?: { create_default: true }
  /** Per-step status: 'pending' until admin confirms, then cleared. */
  meta?: {
    icao: string
    derived_at: string
  }
}

// ── DAFMAN A3.1 lighting templates ─────────────────────────────────

/**
 * Returns the DAFMAN 13-204v2 Table A3.1 lighting systems that should
 * exist for a runway end. Drawn from the standard Class B precision
 * approach configuration — admins prune unused systems during review.
 */
export function getDafmanLightingTemplates(runwayId: string): LightingSystemDraft[] {
  return [
    { name: `${runwayId} Edge Lights`, runway_taxiway: runwayId, type: 'edge' },
    { name: `${runwayId} End Lights`, runway_taxiway: runwayId, type: 'end' },
    { name: `${runwayId} Threshold Lights`, runway_taxiway: runwayId, type: 'threshold' },
    { name: `${runwayId} PAPI`, runway_taxiway: runwayId, type: 'papi' },
  ]
}

// ── Derivation ─────────────────────────────────────────────────────

type AirportLookupRunway = {
  runway_id: string
  length_ft: number
  width_ft: number
  surface: string
  end1_designator: string
  end1_latitude: number | null
  end1_longitude: number | null
  end1_elevation_msl: number | null
  end1_heading: number | null
  end1_approach_lighting: string | null
  end2_designator: string
  end2_latitude: number | null
  end2_longitude: number | null
  end2_elevation_msl: number | null
  end2_heading: number | null
  end2_approach_lighting: string | null
}

type AirportLookupResult = {
  icao: string
  name: string
  runways: AirportLookupRunway[]
  navaids: { name: string }[]
  suggested_areas: string[]
}

/**
 * Hits /api/airport-lookup for the ICAO and shapes the response into a
 * QuickSetupDraft. Returns null if the lookup fails (network, missing
 * ICAO, no data returned).
 */
export async function derivePreFillFromIcao(icao: string): Promise<QuickSetupDraft | null> {
  if (!icao) return null
  let lookup: AirportLookupResult | null = null
  try {
    const res = await fetch(`/api/airport-lookup?icao=${encodeURIComponent(icao.toUpperCase())}`)
    if (!res.ok) return null
    lookup = (await res.json()) as AirportLookupResult
  } catch {
    return null
  }
  if (!lookup) return null

  const runways: RunwayDraft[] = (lookup.runways || []).map((r) => ({
    runway_id: r.runway_id,
    length_ft: r.length_ft,
    width_ft: r.width_ft,
    surface: r.surface,
    end1_designator: r.end1_designator,
    end1_latitude: r.end1_latitude,
    end1_longitude: r.end1_longitude,
    end1_elevation_msl: r.end1_elevation_msl,
    end1_heading: r.end1_heading,
    end1_approach_lighting: r.end1_approach_lighting,
    end2_designator: r.end2_designator,
    end2_latitude: r.end2_latitude,
    end2_longitude: r.end2_longitude,
    end2_elevation_msl: r.end2_elevation_msl,
    end2_heading: r.end2_heading,
    end2_approach_lighting: r.end2_approach_lighting,
  }))

  const areas: string[] = ['Entire Airfield', ...(lookup.suggested_areas || [])]
  const uniqueAreas = Array.from(new Set(areas)).filter(Boolean)

  const navaids: NavaidDraft[] = (lookup.navaids || [])
    .map((n) => ({ navaid_name: n.name }))
    .filter((n) => Boolean(n.navaid_name))

  // DAFMAN lighting templates per runway end
  const lighting: LightingSystemDraft[] = []
  for (const r of lookup.runways || []) {
    if (r.end1_designator) lighting.push(...getDafmanLightingTemplates(r.end1_designator))
    if (r.end2_designator) lighting.push(...getDafmanLightingTemplates(r.end2_designator))
  }

  return {
    runways,
    areas: uniqueAreas,
    navaids,
    lighting,
    templates: { create_default: true },
    meta: {
      icao: lookup.icao,
      derived_at: new Date().toISOString(),
    },
  }
}

// ── Persistence: save draft to bases.quick_setup_pending ──────────

export async function saveQuickSetupDraft(installationId: string, draft: QuickSetupDraft): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  await supabase
    .from('bases')
    .update({ quick_setup_pending: draft as any } as any)
    .eq('id', installationId)
}

export async function loadQuickSetupDraft(installationId: string): Promise<QuickSetupDraft | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('bases')
    .select('quick_setup_pending')
    .eq('id', installationId)
    .single()
  const pending = (data as unknown as { quick_setup_pending?: QuickSetupDraft } | null)?.quick_setup_pending
  if (!pending) return null
  // Empty object means no pending draft.
  if (Object.keys(pending).length === 0) return null
  return pending
}

export async function clearQuickSetupStep(
  installationId: string,
  draft: QuickSetupDraft,
  stepKey: QuickSetupStepKey,
): Promise<QuickSetupDraft> {
  const next: QuickSetupDraft = { ...draft }
  delete next[stepKey]
  // If only meta is left, clear the whole thing.
  const remaining = Object.keys(next).filter((k) => k !== 'meta')
  if (remaining.length === 0) {
    await saveQuickSetupDraft(installationId, {})
    return {}
  }
  await saveQuickSetupDraft(installationId, next)
  return next
}

// ── Commit a step's draft to live tables ───────────────────────────

export async function commitQuickSetupStep(
  installationId: string,
  draft: QuickSetupDraft,
  stepKey: QuickSetupStepKey,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = createClient()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  try {
    if (stepKey === 'runways' && draft.runways) {
      // Civilian airports leave runway_class null (FAA approach type is the
      // civilian-correct driver); USAF defaults to UFC Class B.
      const { data: base } = await supabase
        .from('bases')
        .select('airport_type')
        .eq('id', installationId)
        .maybeSingle()
      const isCivilian = (base as { airport_type?: string | null } | null)?.airport_type === 'civilian'
      let count = 0
      for (const r of draft.runways) {
        const { error } = await supabase
          .from('base_runways')
          .insert({ ...r, base_id: installationId, runway_class: isCivilian ? null : 'B' } as any)
        if (!error) count++
      }
      return { ok: true, count }
    }

    if (stepKey === 'areas' && draft.areas) {
      let count = 0
      for (const area of draft.areas) {
        const { error } = await supabase
          .from('base_areas')
          .insert({ base_id: installationId, area_name: area } as any)
        if (!error) count++
      }
      return { ok: true, count }
    }

    if (stepKey === 'navaids' && draft.navaids) {
      let count = 0
      for (const n of draft.navaids) {
        const { error } = await supabase
          .from('navaid_statuses')
          .insert({
            base_id: installationId,
            navaid_name: n.navaid_name,
            status: 'green',
            notes: null,
            updated_by: null,
          } as any)
        if (!error) count++
      }
      return { ok: true, count }
    }

    if (stepKey === 'lighting' && draft.lighting) {
      const { createLightingSystem } = await import('@/lib/supabase/lighting-systems')
      let count = 0
      for (const l of draft.lighting) {
        const result = await createLightingSystem({
          base_id: installationId,
          system_type: l.type,
          name: l.name,
          runway_or_taxiway: l.runway_taxiway || undefined,
          is_precision: l.type === 'papi',
        })
        if (result) count++
      }
      return { ok: true, count }
    }

    if (stepKey === 'templates' && draft.templates) {
      const { createDefaultTemplate } = await import('@/lib/supabase/inspection-templates')
      const af = await createDefaultTemplate(installationId, 'airfield')
      const lt = await createDefaultTemplate(installationId, 'lighting')
      if (!af || !lt) {
        return { ok: false, error: 'Creating the default inspection templates failed — retry from the Templates step' }
      }
      return { ok: true, count: 2 }
    }

    return { ok: false, error: 'No draft for this step' }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Commit failed' }
  }
}

// ── Counts for the modal "this will pre-fill X" line ──────────────

export function countDraftItems(draft: QuickSetupDraft, stepKey: QuickSetupStepKey): number {
  switch (stepKey) {
    case 'runways': return draft.runways?.length ?? 0
    case 'areas': return draft.areas?.length ?? 0
    case 'navaids': return draft.navaids?.length ?? 0
    case 'lighting': return draft.lighting?.length ?? 0
    case 'templates': return draft.templates ? 2 : 0
  }
}
