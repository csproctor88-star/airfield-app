'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers } from '@/lib/supabase/amtr'
import { fetchAmtrInspections } from '@/lib/supabase/amtr-inspections'
import { latestInspectionPerMember, type InspectionRow } from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor } from '@/lib/dashboard/table/types'

function resultBadge(v: unknown): React.ReactNode {
  const row = v as InspectionRow
  if (row.result === 'none') {
    return <span style={{ color: 'var(--color-text-3)' }}>Never inspected</span>
  }
  if (row.result === 'findings') {
    return <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{row.findings} findings</span>
  }
  return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Clean</span>
}

function useRows() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrInspections(installationId),
    ]).then(([members, inspections]) => {
      setRows(latestInspectionPerMember(members, inspections))
      setLoading(false)
    })
  }, [installationId])

  return { rows, loading }
}

export const amtrInspectionsDescriptor: TableWidgetDescriptor<InspectionRow> = {
  columns: [
    { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
    { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
    { key: 'lastDate', label: 'Last Inspection', accessor: r => r.lastDate ?? '—', defaultVisible: true, mono: true },
    { key: 'result', label: 'Result', accessor: r => r, format: resultBadge, defaultVisible: true },
    { key: 'inspector', label: 'Inspector', accessor: r => r.inspector ?? '—', defaultVisible: true },
  ],
  filters: [
    {
      key: 'result',
      label: 'Result',
      kind: 'enum-multi',
      options: [
        { value: 'clean', label: 'Clean' },
        { value: 'findings', label: 'Has findings' },
        { value: 'none', label: 'Never inspected' },
      ],
      predicate: (r, sel) => (sel as string[]).includes(r.result),
    },
  ],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => {
    const inspected = rows.filter(r => r.result !== 'none').length
    const withFindings = rows.filter(r => r.result === 'findings').length
    return [
      { count: inspected, label: `of ${rows.length} inspected` },
      ...(withFindings > 0 ? [{ count: withFindings, label: 'with findings', tone: 'warning' as const }] : []),
    ]
  },
  footerHref: '/amtr',
  useRows,
}
