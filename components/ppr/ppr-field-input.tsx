'use client'

import type { PprColumnType } from '@/lib/supabase/ppr'

type Props = {
  columnId: string
  columnName: string
  columnType: PprColumnType
  isRequired: boolean
  value: string
  onChange: (next: string) => void
  // Optional override for the dark-on-light public form. The staff
  // modal leaves these out so var(--color-*) tokens take over.
  inputBackground?: string
  inputColor?: string
  inputBorder?: string
}

const INPUT_TYPE: Record<Exclude<PprColumnType, 'yes_no_na'>, string> = {
  text: 'text',
  date: 'date',
  time: 'time',
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
  inputBackground,
  inputColor,
  inputBorder,
}: Props) {
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
      {columnName}
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
                  background: selected ? 'rgba(56,189,248,0.08)' : (inputBackground ?? 'var(--color-bg)'),
                  color: selected ? 'var(--color-accent)' : (inputColor ?? 'var(--color-text-3)'),
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <input
          type={INPUT_TYPE[columnType] ?? 'text'}
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
