import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export type WidgetKind = 'native' | 'links' | 'embed' | 'analytics' | 'table'

/** Pure metadata — no React, so registry filtering is unit-testable. */
export interface WidgetMeta {
  type: string
  kind: WidgetKind
  title: string
  description: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  permission?: string     // PERM key gate
  moduleHref?: string     // module gate via isModuleEnabled
  icon?: LucideIcon
}

export interface WidgetProps {
  config: Record<string, unknown>
  editing: boolean
  onConfigChange?: (config: Record<string, unknown>) => void
}

export interface WidgetConfigProps {
  config: Record<string, unknown>
  onSave: (config: Record<string, unknown>) => void
  onCancel: () => void
}

/** Full definition = metadata + the React component that renders it. */
export interface WidgetDef extends WidgetMeta {
  Component: ComponentType<WidgetProps>
  ConfigForm?: ComponentType<WidgetConfigProps>
}

/**
 * Filter widget metadata to those the user may add: permission gate via `has`,
 * module gate via `moduleEnabled`. Mirrors the gating already used in the
 * sidebar / More so a widget can never expose an unreachable surface.
 */
export function listAvailableWidgets(
  metas: WidgetMeta[],
  has: (perm: string) => boolean,
  moduleEnabled: (href: string) => boolean,
): WidgetMeta[] {
  return metas.filter(m =>
    (!m.permission || has(m.permission)) &&
    (!m.moduleHref || moduleEnabled(m.moduleHref)),
  )
}

// The concrete registry (type → WidgetDef) is assembled in lib/dashboard/registry.tsx.
