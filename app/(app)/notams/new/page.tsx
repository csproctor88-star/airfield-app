import { PageHeader } from '@/components/layout/page-header'

export default function NewNotamPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="Draft NOTAM" backHref="/notams" />
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
        NOTAM draft form — coming in Step 8
      </div>
    </div>
  )
}
