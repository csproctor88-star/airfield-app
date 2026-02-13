import { PageHeader } from '@/components/layout/page-header'

// Stub — full implementation in Phase 1 Step 5
export default function NewDiscrepancyPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New Discrepancy" backHref="/discrepancies" />
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
        Discrepancy form — coming in Step 5
      </div>
    </div>
  )
}
