'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { logManualEntry } from '@/lib/supabase/activity'
import { loadCustomActivityTemplates } from '@/lib/supabase/activity-templates'
import type { TemplateCategory } from '@/lib/activity-templates'
import { TemplatePicker } from '@/components/ui/template-picker'
import { formatZuluTime } from '@/lib/utils'
import { formatAction, buildDetailsString } from '@/lib/activity-format'
import { moduleLabel } from '@/lib/activity-labels'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const EXCLUDE = ['ppr_coordination', 'ppr_agency']
const empty = new Map<string, { title?: string; description?: string; notes?: string; extra?: string }>()
const labelFor = (e: ActivityEntry) =>
  buildDetailsString(e, empty) || formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata)

function useRows(_c: TableWidgetConfig, reloadNonce?: number) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchActivityLogPage({ baseId: installationId, limit: 30, excludeEntityTypes: EXCLUDE })
      .then(({ data }) => { setRows(data); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, reloadNonce])
  return { rows, loading }
}

// ── Quick-add Toolbar ──────────────────────────────────────────────────────────

function EventsLogToolbar({ reload }: { reload: () => void }) {
  const { installationId, currentInstallation } = useInstallation()
  const [open, setOpen] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<TemplateCategory[] | null>(null)

  async function handleOpen() {
    if (installationId) {
      const t = await loadCustomActivityTemplates(installationId)
      setCustomTemplates(t)
    }
    setOpen(true)
  }

  async function handleSubmit(text: string, category?: string, templateLabel?: string) {
    const { error } = await logManualEntry(text, installationId, category, templateLabel)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry logged')
      setOpen(false)
      reload()
    }
  }

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <button
          onClick={handleOpen}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
            background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent)',
            fontSize: 'var(--fs-xs)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ＋ Add entry
        </button>
      </div>

      {open && (
        <TemplatePicker
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
          isAdmin={false}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao ?? null}
        />
      )}
    </>
  )
}

export const eventsLogDescriptor: TableWidgetDescriptor<ActivityEntry> = {
  columns: [
    { key: 'label', label: 'Event', accessor: labelFor, defaultVisible: true },
    { key: 'oi', label: 'OI', accessor: e => e.user_operating_initials ?? '—', mono: true },
    { key: 'time', label: 'Zulu', accessor: e => `${formatZuluTime(e.created_at)}Z`, mono: true, defaultVisible: true },
    { key: 'entity_type', label: 'Type', accessor: e => e.entity_type, format: v => moduleLabel(v as string) },
    { key: 'entity_display_id', label: 'Entity', accessor: e => e.entity_display_id ?? '—' },
  ],
  filters: [
    { key: 'entity_type', label: 'Entity type', kind: 'text',
      predicate: (e, sel) => e.entity_type.toLowerCase().includes((sel as string).toLowerCase()) },
  ],
  // Row click opens the full Events Log.
  row: { mode: 'deeplink', href: () => '/activity' },
  footerHref: '/activity',
  Toolbar: EventsLogToolbar,
  useRows,
}
