// Pure status-color/label logic for the Status Board widget. Mirrors the Airfield
// Status page's color mappings (STATUS_COLORS, runway, ARFF readiness) so the
// widget matches the page. No React/IO — unit-tested.

export type StatusBoardKind = 'custom' | 'navaid' | 'runway' | 'arff'

const MUTED = 'var(--color-text-3)'

/** CSS color token for a raw status value, per board kind. */
export function statusBoardColor(kind: StatusBoardKind, value: string): string {
  const v = String(value ?? '').toLowerCase()
  if (kind === 'custom' || kind === 'navaid') {
    return v === 'green' ? 'var(--color-success)'
      : v === 'yellow' ? 'var(--color-warning)'
      : v === 'red' ? 'var(--color-danger)'
      : MUTED
  }
  if (kind === 'runway') {
    return v === 'open' ? 'var(--color-success)'
      : v === 'suspended' ? 'var(--color-warning)'
      : v === 'closed' ? 'var(--color-danger)'
      : MUTED
  }
  // arff readiness
  return v === 'optimum' ? 'var(--color-success)'
    : v === 'reduced' ? 'var(--color-warning)'
    : v === 'critical' ? 'var(--color-orange)'
    : v === 'inadequate' ? 'var(--color-danger)'
    : MUTED
}

/** Display label for a raw status value (capitalized). */
export function statusBoardLabel(_kind: StatusBoardKind, value: string): string {
  const s = String(value ?? '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}
