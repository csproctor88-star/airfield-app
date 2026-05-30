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
import type { WildlifeExportRow, DailyReviewExportRow } from './export-table-specs'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
  inspections: InspectionRow[]
  checks: CheckRow[]
  obstructions: ObstructionRow[]
  personnel: ContractorRow[]
  wildlife: WildlifeExportRow[]
  dailyReviews: DailyReviewExportRow[]
}

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
  ] = await Promise.all([
    fetchDiscrepancies(baseId),
    fetchInspections(baseId),
    fetchChecks(baseId),
    fetchObstructionEvaluations(baseId),
    fetchContractors(baseId),
    fetchSightings(baseId),
    fetchStrikes(baseId),
    fetchDailyReviewsForBase(baseId),
  ])
  // fetchChecks / fetchSightings / fetchStrikes surface an error (the others
  // catch internally and return []). Don't swallow them — log so a failed fetch
  // isn't indistinguishable from "no records".
  if (checksResult.error) {
    console.error('Records Export: checks fetch failed:', checksResult.error)
  }
  if (sightingsResult.error) {
    console.error('Records Export: wildlife sightings fetch failed:', sightingsResult.error)
  }
  if (strikesResult.error) {
    console.error('Records Export: wildlife strikes fetch failed:', strikesResult.error)
  }

  // Daily reviews store signer profile IDs; resolve them to names in one round trip.
  const signers = await fetchSignersForRows(dailyReviewRows)

  const wildlife: WildlifeExportRow[] = [
    ...sightingsResult.data.map(sightingToExportRow),
    ...strikesResult.data.map(strikeToExportRow),
  ]

  return {
    discrepancies,
    inspections,
    checks: checksResult.data,
    obstructions,
    personnel,
    wildlife,
    dailyReviews: dailyReviewRows.map((r) => reviewToExportRow(r, signers)),
  }
}
