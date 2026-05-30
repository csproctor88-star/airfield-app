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
import {
  fetchHazards,
  fetchAllMitigations,
  fetchAudits,
  fetchMocs,
  fetchSafetyReports,
  type SmsHazard,
  type SmsMitigation,
  type SmsAudit,
  type SmsMoc,
  type SmsSafetyReport,
} from '@/lib/supabase/sms'
import {
  fetchPlanHistory,
  fetchResponseAgencies,
  fetchDrills,
  fetchChecksInRange as fetchAepChecksInRange,
  type AepPlan,
  type AepResponseAgency,
  type AepDrill,
  type AepCommsCheckWithResults,
} from '@/lib/supabase/aep'
import {
  fetchWaivers,
  fetchAllWaiverCriteria,
  fetchAllWaiverReviews,
  fetchAllWaiverCoordination,
  fetchAllWaiverAttachments,
  type WaiverRow,
} from '@/lib/supabase/waivers'
import { fetchAcsiInspections } from '@/lib/supabase/acsi-inspections'
import type { AcsiInspection } from '@/lib/supabase/types'
import {
  fetchTrainingTopics,
  fetchTrainingRecords,
  fetchTrainingCertificates,
} from '@/lib/supabase/training-part139'
import { fetchInstallationMembers } from '@/lib/supabase/installations'
import type { TrainingTranscriptInput } from '@/lib/training-part139-pdf'
import type { WildlifeExportRow, DailyReviewExportRow } from './export-table-specs'
import type { WaiverRecordBundle } from './export-record-modules'

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
  /** SMS — civilian only; empty arrays on military bases. */
  sms: {
    hazards: SmsHazard[]
    mitigations: SmsMitigation[]
    audits: SmsAudit[]
    mocs: SmsMoc[]
    safetyReports: SmsSafetyReport[]
  }
  /** AEP — civilian only; empty arrays on military bases. */
  aep: {
    plans: AepPlan[]
    agencies: AepResponseAgency[]
    drills: AepDrill[]
    commsChecks: AepCommsCheckWithResults[]
  }
  /** Waivers — per-record bundle (record + its criteria/reviews/coord/attachments). */
  waivers: WaiverRecordBundle
  /** ACSI inspections — one per-record PDF each. */
  acsi: AcsiInspection[]
  /** Training — one per-trainee transcript each (civilian only; empty on military). */
  training: TrainingTranscriptInput[]
}

const EMPTY_WAIVERS: WaiverRecordBundle = {
  waivers: [],
  criteriaByWaiver: {},
  reviewsByWaiver: {},
  coordinationByWaiver: {},
  attachmentsByWaiver: {},
}

/** Group a flat list of waiver sub-rows by their waiver_id. */
function groupByWaiver<T extends { waiver_id: string }>(rows: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) (out[r.waiver_id] ??= []).push(r)
  return out
}

/** Fetch every waiver + its sub-data for a base, batched (no N+1). */
async function fetchWaiverBundle(baseId: string): Promise<WaiverRecordBundle> {
  const [waivers, criteria, reviews, coordination, attachments] = await Promise.all([
    fetchWaivers(baseId),
    fetchAllWaiverCriteria(baseId),
    fetchAllWaiverReviews(baseId),
    fetchAllWaiverCoordination(baseId),
    fetchAllWaiverAttachments(baseId),
  ])
  return {
    waivers: waivers as WaiverRow[],
    criteriaByWaiver: groupByWaiver(criteria),
    reviewsByWaiver: groupByWaiver(reviews),
    coordinationByWaiver: groupByWaiver(coordination),
    attachmentsByWaiver: groupByWaiver(attachments),
  }
}

/**
 * Assemble one §139.303 transcript per trainee: the base's active topics, plus
 * each member's own records + certificates. Civilian-only. One records fetch +
 * one certs fetch for the whole base (grouped in JS), so no per-user N+1.
 */
async function fetchTrainingTranscripts(
  baseId: string,
  base: { name: string | null; icao: string | null },
): Promise<TrainingTranscriptInput[]> {
  const [members, topics, allRecords, allCerts] = await Promise.all([
    fetchInstallationMembers(baseId),
    fetchTrainingTopics(baseId),
    fetchTrainingRecords({ base_id: baseId }),
    fetchTrainingCertificates({ base_id: baseId }),
  ])

  const recordsByUser = groupBy(allRecords, (r) => r.user_id)
  const certsByUser = groupBy(allCerts, (c) => c.user_id)

  return members.map((m) => ({
    base,
    user: {
      name: m.name,
      rank: m.rank,
      email: m.email || null,
      role: (m as { role?: string }).role ?? 'viewer',
    },
    topics,
    records: recordsByUser[m.user_id] ?? [],
    certificates: certsByUser[m.user_id] ?? [],
  }))
}

function groupBy<T>(rows: T[], key: (row: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) (out[key(r)] ??= []).push(r)
  return out
}

const EMPTY_SMS: ModuleRecords['sms'] = {
  hazards: [], mitigations: [], audits: [], mocs: [], safetyReports: [],
}
const EMPTY_AEP: ModuleRecords['aep'] = {
  plans: [], agencies: [], drills: [], commsChecks: [],
}

/** Fetch the civilian (SMS + AEP + Training) record kinds for a base. */
async function fetchCivilianRecords(
  baseId: string,
  base: { name: string | null; icao: string | null },
): Promise<{
  sms: ModuleRecords['sms']
  aep: ModuleRecords['aep']
  training: TrainingTranscriptInput[]
}> {
  const [
    hazards, mitigations, audits, mocs, safetyReports,
    plans, agencies, drills, commsChecks,
    training,
  ] = await Promise.all([
    fetchHazards(baseId),
    fetchAllMitigations(baseId),
    fetchAudits(baseId),
    fetchMocs(baseId),
    fetchSafetyReports(baseId),
    fetchPlanHistory(baseId),
    fetchResponseAgencies(baseId),
    fetchDrills({ base_id: baseId }),
    fetchAepChecksInRange(baseId, SCN_FETCH_FROM, SCN_FETCH_TO),
    fetchTrainingTranscripts(baseId, base),
  ])
  return {
    sms: { hazards, mitigations, audits, mocs, safetyReports },
    aep: { plans, agencies, drills, commsChecks },
    training,
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

/**
 * Fetch all records for the export modules, for a base. SMS/AEP (civilian Part
 * 139 only) are fetched only when `airportType === 'faa_part139'` — on military
 * bases they stay empty without paying for nine wasted queries.
 */
export async function fetchExportRecords(
  baseId: string | null,
  airportType?: string | null,
  base?: { name: string | null; icao: string | null },
): Promise<ModuleRecords> {
  const baseInfo = base ?? { name: null, icao: null }
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
    waivers,
    acsi,
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
    baseId ? fetchWaiverBundle(baseId) : Promise.resolve(EMPTY_WAIVERS),
    fetchAcsiInspections(baseId),
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

  // Civilian-only modules: fetch only for FAA Part 139 bases.
  const civilian = baseId && airportType === 'faa_part139'
    ? await fetchCivilianRecords(baseId, baseInfo)
    : { sms: EMPTY_SMS, aep: EMPTY_AEP, training: [] as TrainingTranscriptInput[] }

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
    sms: civilian.sms,
    aep: civilian.aep,
    waivers,
    acsi,
    training: civilian.training,
  }
}
