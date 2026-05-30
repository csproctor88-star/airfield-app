// Records Export — per-module record fetch. Thin wrappers over existing CRUD
// so the PDF/Excel layers receive typed rows. Relies on Supabase RLS + the
// explicit base_id filter, like the rest of the app.
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
}

/** Fetch all records for the modules 2a supports, for a base. */
export async function fetchExportRecords(baseId: string | null): Promise<ModuleRecords> {
  const discrepancies = await fetchDiscrepancies(baseId)
  return { discrepancies }
}
