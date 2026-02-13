import { PageHeader } from '@/components/layout/page-header'

export default function EmergencyPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="Emergency Response" backHref="/checks" />
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
        Emergency response form — coming in Step 6
      </div>
    </div>
  )
}
