'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchFlipTextSections, saveFlipTextSection, fetchFlipList, fetchFlipReferences,
  type FlipTextSection, type FlipSectionKey, type FlipListItem, type FlipReference,
} from '@/lib/supabase/flip'
import { EditableSection } from '@/components/flip/editable-section'
import { FlipListPanel } from '@/components/flip/flip-list-panel'
import { ReferencesPanel } from '@/components/flip/references-panel'
import { ChangeBoard } from '@/components/flip/change-board'
import { ReviewsPanel } from '@/components/flip/reviews-panel'

type Tab = 'home' | 'changes' | 'reviews'
type HomeSub = 'overview' | 'references'

const SECTION_META: { key: FlipSectionKey; title: string; placeholder: string }[] = [
  { key: 'acct_info', title: 'Account Information', placeholder: 'No account information entered. Click Edit to add details.' },
  { key: 'appt_letter', title: 'Current Appointment Letter', placeholder: 'No appointment letter details entered. Click Edit to add.' },
  { key: 'ordering', title: 'Ordering Process (IAW AFI 11-201)', placeholder: 'No ordering process information entered. Click Edit to add.' },
  { key: 'responsibilities', title: 'FLIP Manager Responsibilities', placeholder: 'No responsibilities listed. Click Edit to add.' },
]

export default function FlipPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.FLIP_WRITE)
  const canManage = has(PERM.FLIP_MANAGE)

  const [tab, setTab] = useState<Tab>('home')
  const [homeSub, setHomeSub] = useState<HomeSub>('overview')
  const [sections, setSections] = useState<Record<string, string>>({})
  const [list, setList] = useState<FlipListItem[]>([])
  const [refs, setRefs] = useState<FlipReference[]>([])

  const loadHome = useCallback(async () => {
    if (!installationId) return
    const [s, l, r] = await Promise.all([
      fetchFlipTextSections(installationId), fetchFlipList(installationId), fetchFlipReferences(installationId),
    ])
    const map: Record<string, string> = {}
    s.forEach((row: FlipTextSection) => { map[row.section_key] = row.content })
    setSections(map); setList(l); setRefs(r)
  }, [installationId])

  useEffect(() => { loadHome() }, [loadHome])

  const saveSection = (key: FlipSectionKey) => async (next: string) => {
    if (!installationId) return { error: 'No base selected' }
    const res = await saveFlipTextSection(installationId, key, next)
    if (!res.error) setSections((m) => ({ ...m, [key]: next }))
    return res
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 16px', cursor: 'pointer', background: 'none', border: 'none',
    borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
    color: tab === t ? 'var(--color-text-1)' : 'var(--color-text-3)', fontWeight: 600, fontSize: 'var(--fs-sm)',
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>FLIP Management</h1>
        {canManage && <Link href="/flip/roles" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', textDecoration: 'none' }}><Settings size={15} /> Roles</Link>}
      </div>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', marginBottom: 16 }}>Electronic FLIPs Continuity Binder — DAFMAN 13-204V2 §2.5.2.18.</p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <button style={tabStyle('home')} onClick={() => setTab('home')}>Home</button>
        <button style={tabStyle('changes')} onClick={() => setTab('changes')}>FLIP Changes</button>
        <button style={tabStyle('reviews')} onClick={() => setTab('reviews')}>FLIP Reviews</button>
      </div>

      {tab === 'home' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setHomeSub('overview')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: homeSub === 'overview' ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: homeSub === 'overview' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Account Overview</button>
            <button onClick={() => setHomeSub('references')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: homeSub === 'references' ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: homeSub === 'references' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>References</button>
          </div>
          {homeSub === 'overview' ? (
            <>
              <EditableSection title={SECTION_META[0].title} value={sections[SECTION_META[0].key] ?? ''} placeholder={SECTION_META[0].placeholder} canEdit={canWrite} onSave={saveSection(SECTION_META[0].key)} />
              {installationId && <FlipListPanel baseId={installationId} items={list} canEdit={canWrite} onChange={loadHome} />}
              {SECTION_META.slice(1).map((m) => (
                <EditableSection key={m.key} title={m.title} value={sections[m.key] ?? ''} placeholder={m.placeholder} canEdit={canWrite} onSave={saveSection(m.key)} />
              ))}
            </>
          ) : (
            installationId && <ReferencesPanel baseId={installationId} refs={refs} canEdit={canWrite} onChange={loadHome} />
          )}
        </>
      )}

      {tab === 'changes' && installationId && <ChangeBoard baseId={installationId} canWrite={canWrite} />}
      {tab === 'reviews' && installationId && <ReviewsPanel baseId={installationId} canWrite={canWrite} />}
    </div>
  )
}
