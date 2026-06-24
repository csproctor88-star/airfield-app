// components/flip/change-board.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchFlipChanges, fetchFlipRoleAssignments, fetchFlipTextSections, fetchFlipList, fetchFlipChangeEvents, saveFlipTextSection, type FlipChange, type FlipListItem, type FlipChangeEvent } from '@/lib/supabase/flip'
import { ChangeCard } from '@/components/flip/change-card'
import { CoordinateModal } from '@/components/flip/coordinate-modal'
import { EditableSection } from '@/components/flip/editable-section'

export function ChangeBoard({ baseId, canWrite }: { baseId: string; canWrite: boolean }) {
  const [sub, setSub] = useState<'board' | 'directions'>('board')
  const [changes, setChanges] = useState<FlipChange[]>([])
  const [isAfm, setIsAfm] = useState(false)
  const [isCustodian, setIsCustodian] = useState(false)
  const [isNamo, setIsNamo] = useState(false)
  const [directions, setDirections] = useState('')
  const [flipList, setFlipList] = useState<FlipListItem[]>([])
  const [events, setEvents] = useState<FlipChangeEvent[]>([])
  const [modal, setModal] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
    const [ch, roles, secs, list, evts] = await Promise.all([
      fetchFlipChanges(baseId), fetchFlipRoleAssignments(baseId), fetchFlipTextSections(baseId), fetchFlipList(baseId), fetchFlipChangeEvents(baseId),
    ])
    setChanges(ch)
    const mine = roles.filter((r) => r.user_id === user?.id).map((r) => r.role)
    setIsAfm(mine.includes('afm'))
    setIsCustodian(mine.includes('custodian') || mine.includes('alternate'))
    setIsNamo(mine.includes('namo'))
    setDirections(secs.find((s) => s.section_key === 'change_directions')?.content ?? '')
    setFlipList(list)
    setEvents(evts)
  }, [baseId])

  useEffect(() => { load() }, [load])

  const byStage = (stage: FlipChange['stage']) =>
    stage === 'completed' ? changes.filter((c) => c.stage === 'completed' || c.rejected) : changes.filter((c) => c.stage === stage && !c.rejected)

  const STAGES: { stage: FlipChange['stage']; label: string }[] = [
    { stage: 'coordination', label: 'Coordination' },
    { stage: 'submitted', label: 'Submitted / Awaiting Publication' },
    { stage: 'completed', label: 'Completed' },
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => setSub('board')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: sub === 'board' ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: sub === 'board' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Change Board</button>
        <button onClick={() => setSub('directions')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: sub === 'directions' ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: sub === 'directions' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Directions</button>
        {sub === 'board' && canWrite && isCustodian && (
          <button onClick={() => setModal(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 999, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><Plus size={14} /> Coordinate New Change</button>
        )}
      </div>

      {sub === 'directions' ? (
        <EditableSection title="Directions" value={directions} placeholder="No directions entered. Click Edit to add guidance for coordinating non-procedural FLIP changes (§2.5.2.18.2.2.2)." canEdit={canWrite}
          onSave={async (next) => { const r = await saveFlipTextSection(baseId, 'change_directions', next); if (!r.error) setDirections(next); return r }} minHeight={180} />
      ) : (
        STAGES.map(({ stage, label }) => {
          const items = byStage(stage)
          return (
            <div key={stage} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-3)', marginBottom: 8 }}>{label} · {items.length}</div>
              {items.length === 0 ? <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)' }}>No changes.</p>
                : items.map((c) => <ChangeCard key={c.id} change={c} isAfm={isAfm} isCustodian={isCustodian} isNamo={isNamo} canWrite={canWrite} baseId={baseId} events={events} onChange={load} />)}
            </div>
          )
        })
      )}

      <CoordinateModal baseId={baseId} flipList={flipList} open={modal} onClose={() => setModal(false)} onCreated={load} />
    </>
  )
}
