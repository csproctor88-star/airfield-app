import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { formatZuluTime } from '@/lib/utils'
import { formatAction, buildDetailsString } from '@/lib/activity-format'
import { moduleLabel } from '@/lib/activity-labels'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const EXCLUDE = ['ppr_coordination', 'ppr_agency']
const empty = new Map<string, { title?: string; description?: string; notes?: string; extra?: string }>()
const labelFor = (e: ActivityEntry) =>
  buildDetailsString(e, empty) || formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata)

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchActivityLogPage({ baseId: installationId, limit: 30, excludeEntityTypes: EXCLUDE })
      .then(({ data }) => { setRows(data); setLoading(false) })
  }, [installationId])
  return { rows, loading }
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
  useRows,
}
