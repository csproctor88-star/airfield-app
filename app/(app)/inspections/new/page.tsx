'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect to the unified inspections workspace
export default function NewInspectionRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/inspections')
  }, [router])

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
        Redirecting to inspections...
      </div>
    </div>
  )
}
