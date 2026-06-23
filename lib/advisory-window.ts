// Resolve a WWA effective-end given its start. Inputs are Zulu wall-clock
// strings 'YYYY-MM-DDTHH:MM' (no 'Z' suffix), parsed as UTC, or null.
//
// The dialog defaults a missing end DATE to today's UTC date with no rollover,
// so an overnight WWA (end-of-day at or before the start) lands in the past and
// is swept the instant it's saved. This rolls the end date forward one day for
// that case; if the result is still in the past the caller must block the save.
export function resolveAdvisoryWindow(
  start: string | null,
  end: string | null,
  now: Date,
): { effEnd: string | null; error: string | null } {
  if (!end) return { effEnd: null, error: null }

  const startMs = start ? Date.parse(start + 'Z') : now.getTime()
  if (start && Number.isNaN(startMs)) return { effEnd: null, error: 'Start time is invalid.' }
  let endMs = Date.parse(end + 'Z')
  if (Number.isNaN(endMs)) return { effEnd: null, error: 'End time is invalid.' }

  let effEnd = end
  if (endMs <= startMs) {
    // Overnight: roll the end date forward one calendar day.
    effEnd = new Date(endMs + 86_400_000).toISOString().slice(0, 16)
    endMs = Date.parse(effEnd + 'Z')
  }

  if (endMs <= now.getTime()) {
    return { effEnd: null, error: 'End time is in the past — check the date.' }
  }
  return { effEnd, error: null }
}
