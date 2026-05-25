'use client'

import { useMemo } from 'react'
import {
  BAND_COLORS,
  LIKELIHOOD_LABELS,
  SEVERITY_LABELS,
  classifyRiskBand,
} from '@/lib/supabase/sms'

/**
 * 5×5 risk matrix UI per AC 150/5200-37A Figure 6-3.
 *
 *   Y-axis (top → bottom): Likelihood 5 → 1 (Frequent → Extremely Improbable)
 *   X-axis (left → right): Severity   1 → 5 (Negligible → Catastrophic)
 *
 * Each cell shows its risk band (low / medium / high) via the same
 * BAND_COLORS palette used by hazard chips. When `current` or
 * `residual` are set, those cells get a labeled marker so the user
 * sees the before / after position at a glance.
 *
 * Interactive mode: pass `onPick` to make every cell clickable so
 * the user can pick (likelihood, severity) directly off the chart
 * — faster + less error-prone than two dropdowns.
 */
export type RiskMatrixProps = {
  /** Current (inherent) assessment cell — drawn with a solid marker. */
  current?: { likelihood: number; severity: number } | null
  /** Residual (post-mitigation) cell — drawn with a hollow ring. */
  residual?: { likelihood: number; severity: number } | null
  /** When set, every cell becomes clickable and reports back (L, S). */
  onPick?: (likelihood: number, severity: number) => void
  /** Which marker `onPick` is currently picking — drives cell highlight. */
  pickingFor?: 'current' | 'residual' | null
  /** Compact mode squeezes the cells for sidebar / inline display. */
  compact?: boolean
}

const LIKELIHOOD_ROWS = [5, 4, 3, 2, 1] // top → bottom
const SEVERITY_COLS   = [1, 2, 3, 4, 5] // left → right

export function RiskMatrix({ current, residual, onPick, pickingFor, compact }: RiskMatrixProps) {
  const cellSize = compact ? 36 : 56
  const labelClass = compact ? 'text-[10px]' : 'text-xs'

  const grid = useMemo(() => {
    return LIKELIHOOD_ROWS.map((l) => SEVERITY_COLS.map((s) => ({
      l, s, band: classifyRiskBand(l, s),
      idx: l * s,
    })))
  }, [])

  return (
    <div className="inline-block">
      <div className="flex">
        {/* Y-axis label (rotated) */}
        <div className={`flex items-center justify-center pr-2 ${labelClass} text-zinc-400`}
             style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          Likelihood →
        </div>

        <div>
          {/* Header row: severity labels */}
          <div className="flex">
            <div style={{ width: cellSize }} />
            {SEVERITY_COLS.map((s) => (
              <div
                key={s}
                style={{ width: cellSize }}
                className={`text-center ${labelClass} text-zinc-400 pb-1`}
                title={SEVERITY_LABELS[s]}
              >
                {s}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {grid.map((row) => {
            const lForRow = row[0].l
            return (
              <div key={lForRow} className="flex">
                <div
                  style={{ width: cellSize, height: cellSize }}
                  className={`flex items-center justify-end pr-2 ${labelClass} text-zinc-400`}
                  title={LIKELIHOOD_LABELS[lForRow]}
                >
                  {lForRow}
                </div>
                {row.map(({ l, s, band, idx }) => {
                  const palette = BAND_COLORS[band]
                  const isCurrent  = current  && current.likelihood  === l && current.severity  === s
                  const isResidual = residual && residual.likelihood === l && residual.severity === s
                  const interactive = Boolean(onPick)
                  return (
                    <button
                      key={`${l}-${s}`}
                      type="button"
                      disabled={!interactive}
                      onClick={() => onPick?.(l, s)}
                      title={`L${l} × S${s} = ${idx} (${palette.label})`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                        color: palette.text,
                        cursor: interactive ? 'pointer' : 'default',
                      }}
                      className={[
                        'border relative flex items-center justify-center font-mono font-semibold',
                        compact ? 'text-xs' : 'text-sm',
                        interactive && pickingFor === 'current'  ? 'hover:ring-2 hover:ring-sky-400/60' : '',
                        interactive && pickingFor === 'residual' ? 'hover:ring-2 hover:ring-emerald-400/60' : '',
                        interactive && !pickingFor               ? 'hover:ring-2 hover:ring-zinc-400/40' : '',
                      ].join(' ')}
                    >
                      {idx}
                      {isCurrent && (
                        <span
                          className="absolute inset-1 rounded ring-2 ring-sky-400 pointer-events-none"
                          aria-label="Current risk"
                        />
                      )}
                      {isResidual && (
                        <span
                          className="absolute inset-1 rounded border-2 border-dashed border-emerald-400 pointer-events-none"
                          aria-label="Residual risk"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Severity axis caption */}
          <div className={`text-center ${labelClass} text-zinc-400 pt-1`}>Severity →</div>
        </div>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
          {(['low', 'medium', 'high'] as const).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ background: BAND_COLORS[b].bg, borderColor: BAND_COLORS[b].border }}
              />
              {BAND_COLORS[b].label}
            </span>
          ))}
          {(current || residual) && <span className="text-zinc-600 mx-1">|</span>}
          {current && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm ring-2 ring-sky-400" />
              Current
            </span>
          )}
          {residual && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm border-2 border-dashed border-emerald-400" />
              Residual
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Band chip — small inline badge for hazard list rows, AE dashboard,
 * etc. Falls back to "Unassessed" when band is null.
 */
export function BandChip({ band, label }: { band: 'low' | 'medium' | 'high' | null; label?: string }) {
  if (!band) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider bg-zinc-700/40 text-zinc-400">
        {label ?? 'Unassessed'}
      </span>
    )
  }
  const p = BAND_COLORS[band]
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider border"
      style={{ backgroundColor: p.bg, color: p.text, borderColor: p.border }}
    >
      {label ?? p.label}
    </span>
  )
}
