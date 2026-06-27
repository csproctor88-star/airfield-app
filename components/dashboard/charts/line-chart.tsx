'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { useThemeColor } from './chart-switch'
export function LineChartView({ data }: { data: { name: string; value: number }[] }) {
  const accent = useThemeColor('--color-accent', '#3b82f6')
  const grid = useThemeColor('--color-text-3', '#94a3b8')
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: grid }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: grid }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
