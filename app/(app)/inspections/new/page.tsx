import { PageHeader } from '@/components/layout/page-header'

export default function NewInspectionPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="Daily Inspection" backHref="/" />
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
        Daily inspection checklist — coming in Step 7
      </div>
    </div>
  )
}
