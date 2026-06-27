import { describe, it, expect } from 'vitest'
import { listAvailableWidgets, type WidgetMeta } from '@/lib/dashboard/widget-registry'

const METAS: WidgetMeta[] = [
  { type: 'last-check', kind: 'native', title: 'Last Check', description: '', defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 } },
  { type: 'open-discrepancies', kind: 'native', title: 'Open Discrepancies', description: '', defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, permission: 'discrepancies:read' },
  { type: 'ppr-today', kind: 'native', title: 'PPR Today', description: '', defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/ppr' },
]

describe('listAvailableWidgets', () => {
  const has = (p: string) => p === 'discrepancies:read'
  const moduleEnabled = (href: string) => href !== '/ppr'   // /ppr disabled

  it('includes ungated widgets', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).toContain('last-check')
  })

  it('includes permission-gated widget when the user has the permission', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).toContain('open-discrepancies')
  })

  it('excludes permission-gated widget when the user lacks it', () => {
    const out = listAvailableWidgets(METAS, () => false, moduleEnabled)
    expect(out.map(w => w.type)).not.toContain('open-discrepancies')
  })

  it('excludes a widget whose module is disabled', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).not.toContain('ppr-today')
  })
})
