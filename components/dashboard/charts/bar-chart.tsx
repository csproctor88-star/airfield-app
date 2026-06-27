'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useThemeColor } from './chart-switch'
export function BarChartView({ data }: { data: { name: string; value: number }[] }) {
  const accent = useThemeColor('--color-accent', '#3b82f6')
  const grid = useThemeColor('--color-text-3', '#94a3b8')
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: grid }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: grid }} />
        <Tooltip />
        <Bar dataKey="value" fill={accent} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
