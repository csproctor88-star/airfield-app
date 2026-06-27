'use client'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useThemeColor } from './chart-switch'
export function DonutChartView({ data }: { data: { name: string; value: number }[] }) {
  const c1 = useThemeColor('--color-accent', '#3b82f6')
  const c2 = useThemeColor('--color-cyan', '#06b6d4')
  const c3 = useThemeColor('--color-warning', '#f59e0b')
  const c4 = useThemeColor('--color-success', '#22c55e')
  const c5 = useThemeColor('--color-danger', '#ef4444')
  const palette = [c1, c2, c3, c4, c5]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%">
          {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
