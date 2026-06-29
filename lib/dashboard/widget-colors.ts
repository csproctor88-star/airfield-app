export interface WidgetColor { key: string; label: string; hue: string }

// hue uses a theme token with a hex fallback so color-mix always resolves.
export const WIDGET_COLORS: WidgetColor[] = [
  { key: 'default', label: 'Default', hue: '' },
  { key: 'blue',    label: 'Blue',    hue: 'var(--color-accent, #3b82f6)' },
  { key: 'cyan',    label: 'Cyan',    hue: 'var(--color-cyan, #06b6d4)' },
  { key: 'green',   label: 'Green',   hue: 'var(--color-success, #22c55e)' },
  { key: 'amber',   label: 'Amber',   hue: 'var(--color-warning, #f59e0b)' },
  { key: 'red',     label: 'Red',     hue: 'var(--color-danger, #ef4444)' },
  { key: 'purple',  label: 'Purple',  hue: 'var(--color-purple, #a855f7)' },
]

export interface WidgetTint { background: string; borderColor: string; headerBorder: string; swatch: string }

/** Theme-aware tint for a color key, or null for default/unknown. */
export function widgetTint(key?: string): WidgetTint | null {
  if (!key || key === 'default') return null
  const c = WIDGET_COLORS.find(w => w.key === key)
  if (!c || !c.hue) return null
  return {
    background: `color-mix(in srgb, ${c.hue} 9%, var(--color-bg-surface))`,
    borderColor: `color-mix(in srgb, ${c.hue} 38%, var(--color-border))`,
    headerBorder: `color-mix(in srgb, ${c.hue} 55%, var(--color-border))`,
    swatch: `color-mix(in srgb, ${c.hue} 75%, var(--color-bg-surface))`,
  }
}
