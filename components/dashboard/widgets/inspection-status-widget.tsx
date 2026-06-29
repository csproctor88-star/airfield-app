'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchInspections } from '@/lib/supabase/inspections'
import { pickTodaysInspection } from '@/lib/inspection-status'
import { CheckCircle2, ClipboardList, Sunrise, Moon } from 'lucide-react'

type S = { status: 'none' | 'in_progress' | 'completed'; inspector?: string }

export function InspectionStatusWidget() {
  const { installationId, currentInstallation } = useInstallation()
  const [af, setAf] = useState<S>({ status: 'none' })
  const [lt, setLt] = useState<S>({ status: 'none' })

  useEffect(() => {
    if (!installationId) return
    const tz = currentInstallation?.timezone || 'America/New_York'
    const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    if (localNow.getHours() < 6) localNow.setDate(localNow.getDate() - 1)
    const today = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
    fetchInspections(installationId).then((rows) => {
      const a = pickTodaysInspection(rows, 'airfield', today)
      const l = pickTodaysInspection(rows, 'lighting', today)
      setAf(a ? { status: a.status as S['status'], inspector: a.inspector_name || undefined } : { status: 'none' })
      setLt(l ? { status: l.status as S['status'], inspector: l.inspector_name || undefined } : { status: 'none' })
    })
  }, [installationId, currentInstallation?.timezone])

  const row = (label: string, s: S, NoneIcon: typeof Sunrise) => {
    const color = s.status === 'completed' ? 'var(--color-status-pass)'
      : s.status === 'in_progress' ? 'var(--color-status-inwork)' : 'var(--color-text-3)'
    const Icon = s.status === 'completed' ? CheckCircle2 : s.status === 'in_progress' ? ClipboardList : NoneIcon
    const text = s.status === 'completed' ? 'Complete'
      : s.status === 'in_progress' ? `In Progress${s.inspector ? ` — ${s.inspector}` : ''}` : 'Not Started'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <Icon size={18} color={color} strokeWidth={2.25} />
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>{label}</div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 800, color }}>{text}</div>
        </div>
      </div>
    )
  }

  return (
    <Link href="/inspections" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      {row('Airfield Inspection', af, Sunrise)}
      {row('Lighting Inspection', lt, Moon)}
    </Link>
  )
}
