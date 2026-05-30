// Records Export — per-module record fetch. Thin wrappers over existing CRUD
// so the PDF/Excel layers receive typed rows. Relies on Supabase RLS + the
// explicit base_id filter, like the rest of the app.
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { fetchInspections, type InspectionRow } from '@/lib/supabase/inspections'
import { fetchChecks, type CheckRow } from '@/lib/supabase/checks'
import { fetchObstructionEvaluations, type ObstructionRow } from '@/lib/supabase/obstructions'
import { fetchContractors, type ContractorRow } from '@/lib/supabase/contractors'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
  inspections: InspectionRow[]
  checks: CheckRow[]
  obstructions: ObstructionRow[]
  personnel: ContractorRow[]
}

/** Fetch all records for the modules 2b supports, for a base. */
export async function fetchExportRecords(baseId: string | null): Promise<ModuleRecords> {
  const [discrepancies, inspections, checksResult, obstructions, personnel] = await Promise.all([
    fetchDiscrepancies(baseId),
    fetchInspections(baseId),
    fetchChecks(baseId),
    fetchObstructionEvaluations(baseId),
    fetchContractors(baseId),
  ])
  return {
    discrepancies,
    inspections,
    checks: checksResult.data,
    obstructions,
    personnel,
  }
}
