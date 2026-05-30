// Records Export — module registry.
// Single source of truth for which modules export and how. See
// docs/superpowers/specs/2026-05-29-records-export-design.md §4.
//
// pdfStrategy:
//   'per_record' → one PDF per record (Waivers, ACSI, Civilian Training)
//   'table'      → rendered as a records table; output mode (aggregate vs monthly
//                  split) is chosen per export (see export-pdf.ts OutputMode)
//   'excluded'   → no generated PDF/Excel here (AMTR uses its own export)
//
// appliesTo:
//   'both'     → military and civilian airports
//   'civilian' → FAA Part 139 airports only (airport_type = 'faa_part139')
//   'military' → USAF airfields only
//
// dateColumn is the record's "natural date" used for date-range filtering
// and monthly bucketing. Confirmed against the live schema 2026-05-29
// (every listed table has the named column). Excluded modules omit it.

export type PdfStrategy = 'per_record' | 'table' | 'excluded'
export type AppliesTo = 'both' | 'civilian' | 'military'

export interface ExportModule {
  /** Stable registry key (also the documents/ + spreadsheets/ folder name source) */
  key: string
  /** Human label for the UI + cover sheet */
  label: string
  /** Folder name under documents/ and spreadsheets/ */
  folder: string
  pdfStrategy: PdfStrategy
  appliesTo: AppliesTo
  /** Natural-date column for filtering/bucketing ('' for excluded modules) */
  dateColumn: string
}

export const EXPORT_MODULES: ExportModule[] = [
  // ── Per-record PDFs ──────────────────────────────────────
  { key: 'waivers',          label: 'Waivers (AF 505)',        folder: 'Waivers',     pdfStrategy: 'per_record', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'acsi',             label: 'ACSI Inspections',        folder: 'ACSI',        pdfStrategy: 'per_record', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'training_part139', label: 'Training (§139.303)',     folder: 'Training',    pdfStrategy: 'per_record', appliesTo: 'civilian', dateColumn: 'created_at' },

  // ── Table PDFs (aggregate or monthly, per-export) ───────────
  { key: 'discrepancies',    label: 'Discrepancies',           folder: 'Discrepancies', pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'inspections',      label: 'Inspections',             folder: 'Inspections',   pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'checks',           label: 'Airfield Checks',         folder: 'Checks',        pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'obstructions',     label: 'Obstructions',            folder: 'Obstructions',  pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'events_log',       label: 'Events Log',              folder: 'Events-Log',    pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'daily_reviews',    label: 'Daily Reviews',           folder: 'Daily-Reviews', pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'review_date' },
  { key: 'wildlife',         label: 'Wildlife Log',            folder: 'Wildlife',      pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'ppr',              label: 'PPR',                     folder: 'PPR',           pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'personnel',        label: 'Personnel / Contractors', folder: 'Personnel',     pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'scn',              label: 'SCN Tests',               folder: 'SCN',           pdfStrategy: 'table', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'sms',              label: 'SMS',                     folder: 'SMS',           pdfStrategy: 'table', appliesTo: 'civilian', dateColumn: 'created_at' },
  { key: 'aep',              label: 'AEP',                     folder: 'AEP',           pdfStrategy: 'table', appliesTo: 'civilian', dateColumn: 'created_at' },

  // ── Excluded (own export) ────────────────────────────────
  { key: 'amtr',             label: 'AMTR Training Record',    folder: 'AMTR',          pdfStrategy: 'excluded',  appliesTo: 'military', dateColumn: '' },
]
