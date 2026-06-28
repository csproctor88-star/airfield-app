import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchContractors, type ContractorRow } from '@/lib/supabase/contractors'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

function useRows(_config: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchContractors(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const personnelDescriptor: TableWidgetDescriptor<ContractorRow> = {
  columns: [
    { key: 'company_name', label: 'Company', accessor: r => r.company_name, defaultVisible: true },
    { key: 'contact_name', label: 'Contact', accessor: r => r.contact_name ?? '—' },
    { key: 'location', label: 'Location', accessor: r => r.location, defaultVisible: true },
    { key: 'work_description', label: 'Work', accessor: r => r.work_description },
    { key: 'status', label: 'Status', accessor: r => r.status },
    { key: 'start_date', label: 'Start', accessor: r => r.start_date },
    { key: 'end_date', label: 'End', accessor: r => r.end_date ?? '—' },
    { key: 'radio_number', label: 'Radio', accessor: r => r.radio_number ?? '—', mono: true },
    { key: 'flag_number', label: 'Flag', accessor: r => r.flag_number ?? '—', mono: true },
    { key: 'callsign', label: 'Callsign', accessor: r => r.callsign ?? '—', mono: true },
    { key: 'contact_phone', label: 'Phone', accessor: r => r.contact_phone ?? '—', mono: true },
  ],
  filters: [
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['active'],
      options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
  ],
  // Row click opens Personnel on Airfield, where status changes and full detail live.
  row: { mode: 'deeplink', href: () => '/contractors' },
  footerHref: '/contractors',
  useRows,
}
