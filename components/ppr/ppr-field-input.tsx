'use client'

import type { PprColumnType } from '@/lib/supabase/ppr'
import { formatLocalTime, localTimeToZulu } from '@/lib/utils'

type Props = {
  columnId: string
  columnName: string
  columnType: PprColumnType
  isRequired: boolean
  value: string
  onChange: (next: string) => void
  /** Body for `info_only` columns — displayed verbatim under the
   *  column name. Ignored for input types. */
  infoText?: string | null
  /** Only meaningful for `time` columns — appends "(Z)" or "(Local)"
   *  to the label so requesters know which clock they're entering. */
  timeDisplay?: 'zulu' | 'local' | null
  /** Base IANA timezone. When set (and not UTC), a `time` field shows a
   *  live "= HHMM local/Z" hint under the input so the requester can see
   *  the offset as they type. */
  timezone?: string | null
  // Optional override for the dark-on-light public form. The staff
  // modal leaves these out so var(--color-*) tokens take over.
  inputBackground?: string
  inputColor?: string
  inputBorder?: string
}

// `time` deliberately renders as a text input rather than the native
// `<input type="time">`. Chrome and Edge on en-US locales force the
// native picker into 12-hour AM/PM regardless of the stored 24-hour
// value, and there's no cross-browser way to override it. A plain
// text input with a 24-hour pattern keeps the display consistent
// (and the keyboard on mobile still defaults to numeric thanks to
// `inputMode="numeric"`).
// `info_only` and the special-cased branches (`yes_no_na`, `time`)
// never reach this map — they're handled in early returns.
const INPUT_TYPE: Record<Exclude<PprColumnType, 'yes_no_na' | 'time' | 'info_only'>, string> = {
  text: 'text',
  date: 'date',
  phone: 'tel',
  number: 'number',
  email: 'email',
}

/**
 * Single-column form input dispatched by `column_type`. Used by:
 *   • Staff create/edit modal in `app/(app)/ppr/page.tsx`
 *   • Public request form at `app/ppr-request/[baseId]/page.tsx`
 *
 * Renders the label + required marker, then the right input element.
 * The yes/no/na case is the only branch that isn't an HTML input.
 */
export function PprFieldInput({
  columnId,
  columnName,
  columnType,
  isRequired,
  value,
  onChange,
  infoText,
  timeDisplay,
  timezone,
  inputBackground,
  inputColor,
  inputBorder,
}: Props) {
  const labelText = columnType === 'time'
    ? `${columnName} (${timeDisplay === 'local' ? 'Local' : 'Z'})`
    : columnName
  // Live counterpart-clock hint for time fields: a Zulu-entry field
  // shows the base-local equivalent, a local-entry field shows Zulu.
  // Only once 4 digits are in and the base actually differs from UTC.
  const timeDigits = columnType === 'time' ? (value || '').replace(/\D/g, '').slice(0, 4) : ''
  const timeHint = (columnType === 'time' && timezone && timezone !== 'UTC' && timeDigits.length === 4)
    ? (timeDisplay === 'local'
        ? `= ${localTimeToZulu(timeDigits, timezone)}Z`
        : `= ${formatLocalTime(timeDigits, timezone)} local`)
    : null
  // info_only renders as a labeled read-only block — no input element,
  // no required marker, no value/onChange wiring. Used for things like
  // airfield hours, restrictions, and fuel availability that the base
  // wants every requester to see.
  if (columnType === 'info_only') {
    return (
      <div
        style={{
          display: 'block',
          marginBottom: 10,
          padding: 10,
          borderRadius: 4,
          border: inputBorder ?? '1px solid var(--color-border)',
          background: inputBackground ?? 'var(--color-bg-inset, var(--color-bg))',
        }}
      >
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            color: inputColor ?? 'var(--color-text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {columnName}
        </div>
        <div
          style={{
            fontSize: 'var(--fs-sm)',
            color: inputColor ?? 'var(--color-text-1)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {infoText || ''}
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    marginTop: 4,
    border: inputBorder ?? '1px solid var(--color-border)',
    background: inputBackground ?? 'var(--color-bg)',
    color: inputColor ?? 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
  }

  return (
    <label
      style={{
        display: 'block',
        fontSize: 'var(--fs-sm)',
        color: 'var(--color-text-3)',
        marginBottom: 10,
      }}
    >
      {labelText}
      {isRequired ? ' *' : ''}
      {columnType === 'yes_no_na' ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {['Yes', 'No', 'N/A'].map((opt) => {
            const selected = value === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(selected ? '' : opt)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 4,
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: selected
                    ? '2px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  background: selected ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : (inputBackground ?? 'var(--color-bg)'),
                  color: selected ? 'var(--color-accent)' : (inputColor ?? 'var(--color-text-3)'),
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ) : columnType === 'time' ? (
        <>
          <input
            type="text"
            inputMode="numeric"
            // 4-digit HHMM (24-hour Zulu). Mirrors the spine ETA (Z)
            // field on /ppr — no colon in display or storage. Existing
            // entries that predate this change may carry "HH:MM" in
            // column_values; the display formatters strip the colon
            // before rendering, so both shapes coexist cleanly.
            pattern="^([01]\d|2[0-3])[0-5]\d$"
            placeholder="HHMM"
            maxLength={4}
            // Strip a stale colon from legacy values so the input
            // always shows 4 digits regardless of how it was stored.
            value={(value || '').replace(':', '').slice(0, 4)}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required={isRequired}
            id={`ppr-field-${columnId}`}
            style={inputStyle}
          />
          {timeHint && (
            <span style={{
              display: 'block', marginTop: 3, fontSize: 'var(--fs-xs)',
              color: inputColor ?? 'var(--color-text-3)', opacity: 0.85,
              fontFamily: 'monospace',
            }}>
              {timeHint}
            </span>
          )}
        </>
      ) : (
        <input
          type={INPUT_TYPE[columnType as Exclude<PprColumnType, 'yes_no_na' | 'time' | 'info_only'>] ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={isRequired}
          // Keep the input id stable so screen readers can target the label.
          id={`ppr-field-${columnId}`}
          style={inputStyle}
        />
      )}
    </label>
  )
}
