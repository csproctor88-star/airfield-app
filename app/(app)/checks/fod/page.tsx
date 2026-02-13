import { PageHeader } from '@/components/layout/page-header'

export default function FodCheckPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New FOD Check" backHref="/checks" />
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
        FOD check form — coming in Step 6
      </div>
    </div>
  )
}
