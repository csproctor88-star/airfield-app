'use client'

// Date-range filter for time-bound report data (DAF 797 log, recent activity).
// Point-in-time sub-tabs ignore it.

export type DateRangeMode = 'all' | 'year' | 'quarter' | 'custom'
export type DateRange = {
  mode: DateRangeMode
  year: number
  quarter: 1 | 2 | 3 | 4
  from: string
  to: string
}

export const QUARTERS: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [0, 2], 2: [3, 5], 3: [6, 8], 4: [9, 11],
}

export function defaultRange(): DateRange {
  const y = new Date().getUTCFullYear()
  return { mode: 'all', year: y, quarter: (Math.floor(new Date().getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4, from: '', to: '' }
}

/** Whether a date falls inside the selected range. */
export function inRange(dateISO: string | null | undefined, r: DateRange): boolean {
  if (r.mode === 'all') return true
  if (!dateISO) return false
  const d = new Date(dateISO.length <= 10 ? `${dateISO}T00:00:00Z` : dateISO)
  if (Number.isNaN(d.getTime())) return false
  if (r.mode === 'year') return d.getUTCFullYear() === r.year
  if (r.mode === 'quarter') {
    const [lo, hi] = QUARTERS[r.quarter]
    return d.getUTCFullYear() === r.year && d.getUTCMonth() >= lo && d.getUTCMonth() <= hi
  }
  // custom
  if (r.from && d < new Date(`${r.from}T00:00:00Z`)) return false
  if (r.to && d > new Date(`${r.to}T23:59:59Z`)) return false
  return true
}

export function rangeLabel(r: DateRange): string {
  switch (r.mode) {
    case 'all': return 'All time'
    case 'year': return String(r.year)
    case 'quarter': return `Q${r.quarter} ${r.year}`
    case 'custom': return `${r.from || '…'} → ${r.to || '…'}`
  }
}

export function DateRangeBar({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const set = (patch: Partial<DateRange>) => onChange({ ...value, ...patch })
  const years = [0, 1, 2].map((d) => new Date().getUTCFullYear() - d)
  const modeBtn = (m: DateRangeMode, label: string) => {
    const on = value.mode === m
    return (
      <button key={m} onClick={() => set({ mode: m })}
        style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600, background: on ? 'var(--color-accent)' : 'transparent', color: on ? '#fff' : 'var(--color-text-3)' }}>
        {label}
      </button>
    )
  }
  const inp: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)', width: 'auto' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 5, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px' }}>Trained within</span>
      {modeBtn('all', 'All time')}{modeBtn('year', 'Year')}{modeBtn('quarter', 'Quarter')}{modeBtn('custom', 'Custom')}
      {value.mode === 'year' && (
        <select className="input-dark" style={inp} value={value.year} onChange={(e) => set({ year: Number(e.target.value) })}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
      {value.mode === 'quarter' && (
        <>
          <select className="input-dark" style={inp} value={value.year} onChange={(e) => set({ year: Number(e.target.value) })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input-dark" style={inp} value={value.quarter} onChange={(e) => set({ quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
            <option value={1}>Q1 Jan–Mar</option><option value={2}>Q2 Apr–Jun</option><option value={3}>Q3 Jul–Sep</option><option value={4}>Q4 Oct–Dec</option>
          </select>
        </>
      )}
      {value.mode === 'custom' && (
        <>
          <input type="date" className="input-dark" style={inp} value={value.from} onChange={(e) => set({ from: e.target.value })} />
          <span style={{ color: 'var(--color-text-3)' }}>→</span>
          <input type="date" className="input-dark" style={inp} value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </>
      )}
    </div>
  )
}
