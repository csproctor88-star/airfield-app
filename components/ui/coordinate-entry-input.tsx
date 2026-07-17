'use client'

import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { MapPin } from 'lucide-react'
import { parseCoordinateInput, formatDD, type CoordinateFormat } from '@/lib/calculations/coordinates'
import type { LatLon } from '@/lib/calculations/geometry'

type Props = {
  /**
   * Fired on commit (Enter or the "Place Pin" button) with a freshly
   * constructed `{ lat, lon }` — never a cached reference — plus the
   * detected notation, so callers relying on reference-identity effects
   * (e.g. a map pan) fire reliably even when re-placing the same point.
   */
  onPoint: (point: LatLon, meta: { format: CoordinateFormat }) => void
  disabled?: boolean
  style?: CSSProperties
}

const FORMAT_LABELS: Record<CoordinateFormat, string> = {
  dd: 'DD',
  ddm: 'DDM',
  dms: 'DMS',
  mgrs: 'MGRS',
}

// Parser results that mean "not enough has been typed yet to judge" — the
// user is still mid-keystroke, not making a mistake (e.g. only one of the two
// coordinate groups has appeared so far). Everything else names a specific
// validation failure on a field the parser read in full (an out-of-range
// value, an over-60 minutes/seconds field, a malformed MGRS grid, a
// sign/hemisphere conflict, …), so it's worth surfacing immediately.
const GENERIC_ERRORS = new Set<string>([
  'Enter a coordinate',
  'Enter both a latitude and a longitude',
  'Missing a coordinate value',
  'Could not read that as a coordinate',
])

const EXAMPLES_HINT =
  "Try: 42.60522, -82.82047 · 42°36'19\"N 082°49'13\"W · 42 36.31N 082 49.23W · 17TLG1234567890"

type Status = { text: string; color: string; muted?: boolean }

/**
 * Generic "type coordinates instead of tapping the map" text field for the
 * Obstruction module's manual coordinate entry (and, later, other location
 * pickers — kept props-only/generic on purpose). Auto-detects DD / DDM / DMS
 * / MGRS on every keystroke via the pure parser in
 * `lib/calculations/coordinates.ts` and drives a one-line status under the
 * field: a green detected-format + normalized DD preview once the input
 * parses, a muted per-format example hint while the input is still
 * incomplete, or the parser's own error text once it names a specific
 * validation failure. Placed in `components/ui/` alongside
 * `use-my-location-button.tsx`, whose inline-style idiom this mirrors.
 */
export default function CoordinateEntryInput({ onPoint, disabled = false, style }: Props) {
  const [text, setText] = useState('')
  const [committedText, setCommittedText] = useState<string | null>(null)

  const trimmed = text.trim()
  const result = parseCoordinateInput(text)
  const canCommit = result.ok && text !== committedText && !disabled

  const commit = () => {
    if (!result.ok || text === committedText || disabled) return
    // Always a fresh object — never the parser's cached `result.point`
    // reference — so a consumer's reference-equality effect (map pan) fires
    // even when re-placing numerically identical coordinates.
    const point: LatLon = { lat: result.point.lat, lon: result.point.lon }
    onPoint(point, { format: result.format })
    setCommittedText(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  // When the field is empty, spell the accepted notations out (these acronyms are
  // otherwise opaque); once the user types, the parse status/examples take over.
  let status: Status | null = {
    text: 'DD = decimal degrees · DMS = degrees/minutes/seconds · DDM = degrees/decimal minutes · MGRS = military grid reference system',
    color: 'var(--color-text-3)',
    muted: true,
  }
  if (trimmed !== '') {
    if (result.ok) {
      status = { text: `${FORMAT_LABELS[result.format]} → ${formatDD(result.point)}`, color: 'var(--color-green)' }
    } else if (GENERIC_ERRORS.has(result.error)) {
      status = { text: EXAMPLES_HINT, color: 'var(--color-text-3)', muted: true }
    } else {
      status = { text: result.error, color: 'var(--color-red)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', ...style }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
          <MapPin
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-3)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            autoCapitalize="characters"
            enterKeyHint="go"
            placeholder="Enter coordinates (DD, DMS, DDM, or MGRS)"
            aria-label="Coordinate entry"
            title="Accepted formats — DD: Decimal Degrees · DMS: Degrees/Minutes/Seconds · DDM: Degrees/Decimal Minutes · MGRS: Military Grid Reference System"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px 8px 30px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-inset)',
              color: 'var(--color-text-1)',
              fontFamily: 'monospace',
              fontSize: 'var(--fs-sm)',
              opacity: disabled ? 0.6 : 1,
            }}
          />
        </div>
        <button
          type="button"
          onClick={commit}
          disabled={!canCommit}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            flexShrink: 0,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
            background: canCommit
              ? 'color-mix(in srgb, var(--color-cyan) 12%, transparent)'
              : 'var(--color-bg-inset)',
            color: canCommit ? 'var(--color-cyan)' : 'var(--color-text-3)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: canCommit ? 'pointer' : 'not-allowed',
            opacity: canCommit ? 1 : 0.6,
            whiteSpace: 'nowrap',
          }}
        >
          <MapPin size={14} />
          Place Pin
        </button>
      </div>
      {status && (
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            color: status.color,
            fontFamily: 'monospace',
            fontWeight: status.muted ? 400 : 600,
          }}
        >
          {status.text}
        </div>
      )}
    </div>
  )
}
