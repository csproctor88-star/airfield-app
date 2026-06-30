'use client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/modules-config'
import { listAvailableWidgets } from '@/lib/dashboard/widget-registry'
import { ALL_WIDGET_METAS } from '@/lib/dashboard/registry'

export function WidgetPalette({ onAdd, onClose, onAddLightingArea }: { onAdd: (type: string) => void; onClose: () => void; onAddLightingArea?: () => void }) {
  const { has } = usePermissions()
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const available = listAvailableWidgets(
    ALL_WIDGET_METAS, has,
    (href) => isModuleEnabled(href, enabledModules, airportType),
  )

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 20, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>Add a widget</div>
        {onAddLightingArea && (
          <button
            onClick={() => onAddLightingArea()}
            style={{
              display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
              width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer',
              padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16,
              background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
              border: '1px solid var(--color-accent)',
              color: 'var(--color-text-1)', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-accent)' }}>✚ Add a lighting widget for every area</span>
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>One per runway, taxiway &amp; apron</span>
          </button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {available.map(m => (
            <button key={m.type} onClick={() => { onAdd(m.type); onClose() }} style={{
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start',
              padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text-1)', fontFamily: 'inherit',
            }}>
              {m.icon && <m.icon size={18} color="var(--color-accent)" strokeWidth={2.25} />}
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{m.title}</span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{m.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
