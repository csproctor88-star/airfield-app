'use client'
export function TableChartView({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
        <thead>
          <tr>{columns.map((c, i) => (
            <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '4px 6px', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, ci) => (
              <td key={ci} style={{ textAlign: ci === 0 ? 'left' : 'right', padding: '4px 6px', color: 'var(--color-text-1)', borderBottom: '1px solid var(--color-border)', fontFamily: ci === 0 ? 'inherit' : 'var(--font-family-mono)' }}>{cell}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
