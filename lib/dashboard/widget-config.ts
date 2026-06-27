import type { WidgetInstance } from '@/lib/dashboard/layout'

/** Return a new layout with the matching widget's config replaced. Pure. */
export function updateWidgetConfig(
  widgets: WidgetInstance[],
  id: string,
  config: Record<string, unknown>,
): WidgetInstance[] {
  return widgets.map(w => (w.i === id ? { ...w, config } : w))
}
