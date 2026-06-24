// components/flip/coordinate-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createFlipChange } from '@/lib/supabase/flip'

export function CoordinateModal({ baseId, open, onClose, onCreated }: {
  baseId: string; open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [flipTitle, setFlipTitle] = useState('')
  const [notam, setNotam] = useState('')
  const [details, setDetails] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const submit = async () => {
    if (!flipTitle.trim() || !name.trim()) { toast.error('FLIP Title and Name/Rank are required.'); return }
    setBusy(true)
    const { error } = await createFlipChange({ baseId, flipTitle: flipTitle.trim(), notam: notam.trim(), details: details.trim(), name: name.trim() })
    setBusy(false)
    if (error) { toast.error(error); return }
    setFlipTitle(''); setNotam(''); setDetails(''); setName('')
    onCreated(); onClose(); toast.success('Change coordinated — awaiting AFM approval')
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', color: 'var(--color-text-2)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface)', borderRadius: 12, width: '100%', maxWidth: 560, overflow: 'hidden' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Coordinate FLIP Change</header>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={label}>FLIP Title *</label><input style={field} value={flipTitle} onChange={(e) => setFlipTitle(e.target.value)} placeholder="e.g., IFR Supplement" /></div>
          <div><label style={label}>NOTAM</label><input style={field} value={notam} onChange={(e) => setNotam(e.target.value)} placeholder="NOTAM number or reference" /></div>
          <div><label style={label}>Details</label><textarea style={{ ...field, minHeight: 90, resize: 'vertical' }} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the proposed change…" /></div>
          <div><label style={label}>Name / Rank *</label><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., MSgt Smith" /></div>
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>{busy ? 'Saving…' : 'Coordinate'}</button>
        </footer>
      </div>
    </div>
  )
}
