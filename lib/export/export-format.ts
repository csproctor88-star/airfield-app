// Records Export — shared display formatters.
//
// Leaf module with NO imports, so any file (specs, excel, inspection-pdf) can
// pull `humanize` without forming an import cycle. (Defining it in
// export-table-specs created an eval-order cycle the bundler rejected even
// though tsc was happy.)

// Domain acronyms that should render fully uppercase in humanized labels.
const ACRONYMS = new Set([
  'fod', 'rsc', 'rcr', 'bash', 'navaid', 'ppr', 'notam', 'notams', 'arff', 'scn',
  'aep', 'sms', 'moc', 'bwc', 'ife', 'qrc', 'pcas', 'acsi', 'afm', 'amops', 'namo',
  'ces', 'usda', 'na', 'id', 'wo', 'af', 'rwy', 'twy', 'pa', 'npa', 'vfr', 'ifr',
])

/**
 * Humanize an enum / snake_case value for display: split on spaces + underscores,
 * uppercase known acronyms, Title Case the rest. 'fod' -> 'FOD',
 * 'work_completed_awaiting_verification' -> 'Work Completed Awaiting Verification'.
 */
export function humanize(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}
