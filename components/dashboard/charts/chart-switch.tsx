'use client'
import { useEffect, useState } from 'react'
import type { ChartType, AggregateResult } from '@/lib/dashboard/analytics/types'
import { MetricChart } from './metric-chart'
import { BarChartView } from './bar-chart'
import { LineChartView } from './line-chart'
import { DonutChartView } from './donut-chart'
import { TableChartView } from './table-chart'

/** Resolve a CSS custom property to its computed value (for SVG fills). */
export function useThemeColor(varName: string, fallback: string): string {
  const [color, setColor] = useState(fallback)
  useEffect(() => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      if (v) setColor(v)
    } catch { /* SSR / no document */ }
  }, [varName])
  return color
}

export function ChartSwitch({ chart, result, label }: { chart: ChartType; result: AggregateResult; label?: string }) {
  const data = result.labels.map((name, i) => ({ name, value: result.values[i] ?? 0 }))
  if (chart === 'number') return <MetricChart value={result.values[0] ?? 0} label={label ?? result.labels[0]} />
  if (chart === 'bar') return <BarChartView data={data} />
  if (chart === 'line') return <LineChartView data={data} />
  if (chart === 'donut') return <DonutChartView data={data} />
  return <TableChartView columns={['Label', label ?? 'Value']} rows={data.map(d => [d.name, d.value])} />
}
