// Records Export — per-module record fetch. Thin wrappers over existing CRUD
// so the PDF/Excel layers receive typed rows. Relies on Supabase RLS + the
// explicit base_id filter, like the rest of the app.
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { fetchInspections, type InspectionRow } from '@/lib/supabase/inspections'
import { fetchChecks, type CheckRow } from '@/lib/supabase/checks'
import { fetchObstructionEvaluations, type ObstructionRow } from '@/lib/supabase/obstructions'
import { fetchContractors, type ContractorRow } from '@/lib/supabase/contractors'
import {
  fetchSightings,
  fetchStrikes,
  type WildlifeSightingRow,
  type WildlifeStrikeRow,
} from '@/lib/supabase/wildlife'
import {
  fetchDailyReviewsForBase,
  fetchSignersForRows,
  formatSigner,
  type DailyReviewRow,
  type SignerInfo,
} from '@/lib/supabase/daily-reviews'
import {
  fetchActivityLogForExport,
  fetchEntityDetails,
  type ActivityEntry,
} from '@/lib/supabase/activity-queries'
import { formatAction, buildDetailsString } from '@/lib/activity-format'
import type { EventsLogPdfRow } from '@/lib/events-log-pdf'
import {
  fetchPprColumns,
  fetchPprEntries,
  fetchPprCoordinationForEntries,
  type PprColumn,
  type PprEntry,
  type PprCoordination,
} from '@/lib/supabase/ppr'
import { fetchChecksInRange, type ScnCheckWithResults } from '@/lib/supabase/scn'
import { fetchScnAgencies } from '@/lib/supabase/scn-agencies'
import type { WildlifeExportRow, DailyReviewExportRow } from './export-table-specs'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
  inspections: InspectionRow[]
  checks: CheckRow[]
  obstructions: ObstructionRow[]
  personnel: ContractorRow[]
  wildlife: WildlifeExportRow[]
  dailyReviews: DailyReviewExportRow[]
  /** Events Log — pre-formatted into the generator's row shape. */
  eventsLog: EventsLogPdfRow[]
  /** PPR — raw entries + the config + batch-fetched coordination rows. */
  ppr: {
    columns: PprColumn[]
    entries: PprEntry[]
    coordsByEntry: Record<string, PprCoordination[]>
  }
  /** SCN — checks-with-results + the agency display order. */
  scn: {
    checks: ScnCheckWithResults[]
    agencies: string[]
  }
}

// The Events Log on /activity excludes these high-volume internal-workflow
// entity types from the AF Form 3616-style log; mirror that here so the export
// matches the on-screen log (PPR + wildlife have their own export modules).
const EVENTS_LOG_EXCLUDED_ENTITY_TYPES = ['ppr_entry', 'wildlife_sighting']

// SCN's fetcher is range-bounded; for a fetch-all we pass a wide window.
const SCN_FETCH_FROM = '1970-01-01'
const SCN_FETCH_TO = '2999-12-31'

// ── Normalizers ──────────────────────────────────────────────
// Wildlife: flatten two row shapes into one combined table row.
function sightingToExportRow(s: WildlifeSightingRow): WildlifeExportRow {
  return {
    date: s.observed_at,
    species: s.species_common,
    category: s.species_group,
    count: s.count_observed,
    kind: 'Sighting',
    location: s.location_text ?? s.airfield_zone,
    observer: s.observed_by,
    aircraft: null,
    damage: null,
  }
}

function strikeToExportRow(s: WildlifeStrikeRow): WildlifeExportRow {
  return {
    date: s.strike_date,
    species: s.species_common,
    category: s.species_group,
    count: s.number_struck,
    kind: 'Strike',
    location: s.location_text,
    observer: s.reported_by,
    aircraft: s.aircraft_type,
    damage: s.damage_level ? s.damage_level.charAt(0).toUpperCase() + s.damage_level.slice(1) : null,
  }
}

// Events Log: format each activity row the same way the on-screen log does,
// via the shared formatters in lib/activity-format.ts.
function activityToEventsLogRow(
  a: ActivityEntry,
  detailsMap: Parameters<typeof buildDetailsString>[1],
): EventsLogPdfRow {
  return {
    createdAt: a.created_at,
    action: formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata),
    details: buildDetailsString(a, detailsMap),
    oi: a.user_operating_initials || '',
    user: a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name,
  }
}

// Daily Reviews: resolve each signed slot's profile ID to a display name.
function reviewToExportRow(row: DailyReviewRow, signers: Map<string, SignerInfo>): DailyReviewExportRow {
  const name = (id: string | null): string | null => {
    const s = id ? signers.get(id) : undefined
    return s ? formatSigner(s) : null
  }
  return {
    review_date: row.review_date,
    day_amsl: name(row.day_amsl_signed_by),
    swing_amsl: name(row.swing_amsl_signed_by),
    mid_amsl: name(row.mid_amsl_signed_by),
    namo: name(row.namo_signed_by),
    afm: name(row.afm_signed_by),
    certified_at: row.fully_certified_at,
  }
}

/** Fetch all records for the modules 2b supports, for a base. */
export async function fetchExportRecords(baseId: string | null): Promise<ModuleRecords> {
  const [
    discrepancies,
    inspections,
    checksResult,
    obstructions,
    personnel,
    sightingsResult,
    strikesResult,
    dailyReviewRows,
    activityResult,
    pprColumns,
    pprEntries,
    scnChecks,
  ] = await Promise.all([
    fetchDiscrepancies(baseId),
    fetchInspections(baseId),
    fetchChecks(baseId),
    fetchObstructionEvaluations(baseId),
    fetchContractors(baseId),
    fetchSightings(baseId),
    fetchStrikes(baseId),
    fetchDailyReviewsForBase(baseId),
    fetchActivityLogForExport({ baseId, excludeEntityTypes: EVENTS_LOG_EXCLUDED_ENTITY_TYPES }),
    baseId ? fetchPprColumns(baseId) : Promise.resolve([] as PprColumn[]),
    baseId ? fetchPprEntries(baseId) : Promise.resolve([] as PprEntry[]),
    baseId ? fetchChecksInRange(baseId, SCN_FETCH_FROM, SCN_FETCH_TO) : Promise.resolve([] as ScnCheckWithResults[]),
  ])
  // fetchChecks / fetchSightings / fetchStrikes / activity surface an error (the
  // others catch internally and return []). Don't swallow them — log so a failed
  // fetch isn't indistinguishable from "no records".
  if (checksResult.error) {
    console.error('Records Export: checks fetch failed:', checksResult.error)
  }
  if (sightingsResult.error) {
    console.error('Records Export: wildlife sightings fetch failed:', sightingsResult.error)
  }
  if (strikesResult.error) {
    console.error('Records Export: wildlife strikes fetch failed:', strikesResult.error)
  }
  if (activityResult.error) {
    console.error('Records Export: events log fetch failed:', activityResult.error)
  }

  // Second-pass fetches that depend on the first round's results.
  const [signers, eventsDetails, pprCoords, scnAgencies] = await Promise.all([
    // Daily reviews store signer profile IDs; resolve them to names.
    fetchSignersForRows(dailyReviewRows),
    // Events Log rows enrich with entity titles/descriptions, like /activity.
    fetchEntityDetails(activityResult.data),
    // PPR coordination rows for the visible entries — one batched query.
    fetchPprCoordinationForEntries(pprEntries.map((e) => e.id)),
    // SCN agency display order.
    baseId ? fetchScnAgencies(baseId) : Promise.resolve([]),
  ])

  const wildlife: WildlifeExportRow[] = [
    ...sightingsResult.data.map(sightingToExportRow),
    ...strikesResult.data.map(strikeToExportRow),
  ]

  const coordsByEntry: Record<string, PprCoordination[]> = {}
  for (const c of pprCoords) {
    ;(coordsByEntry[c.entry_id] ??= []).push(c)
  }

  return {
    discrepancies,
    inspections,
    checks: checksResult.data,
    obstructions,
    personnel,
    wildlife,
    dailyReviews: dailyReviewRows.map((r) => reviewToExportRow(r, signers)),
    eventsLog: activityResult.data.map((a) => activityToEventsLogRow(a, eventsDetails)),
    ppr: {
      columns: pprColumns,
      entries: pprEntries,
      coordsByEntry,
    },
    scn: {
      checks: scnChecks,
      agencies: scnAgencies.map((a) => a.agency_name),
    },
  }
}
