// components/flip/coordinate-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { createFlipChange, type FlipListItem } from '@/lib/supabase/flip'

type NotamOption = { number: string; label: string }
// Minimal shape of the /api/notams/sync payload items we use here.
type NotamFeedItem = { status?: string; notam_number?: string; title?: string }

const OTHER = '__other__'

type CatKey = 'additions' | 'deletions' | 'revisions_from' | 'revisions_to'
const CATEGORIES: { key: CatKey; label: string }[] = [
  { key: 'additions', label: 'Additions' },
  { key: 'deletions', label: 'Deletions' },
  { key: 'revisions_from', label: 'Revisions From' },
  { key: 'revisions_to', label: 'Revisions To' },
]
const EMPTY_CATS: Record<CatKey, { on: boolean; text: string }> = {
  additions: { on: false, text: '' }, deletions: { on: false, text: '' },
  revisions_from: { on: false, text: '' }, revisions_to: { on: false, text: '' },
}

export function CoordinateModal({ baseId, flipList, open, onClose, onCreated }: {
  baseId: string; flipList: FlipListItem[]; open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { currentInstallation } = useInstallation()
  const icao = currentInstallation?.icao ?? ''

  const [flipTitle, setFlipTitle] = useState('')
  const [notam, setNotam] = useState('')          // selected notam_number, '' (none), or OTHER
  const [notamManual, setNotamManual] = useState('')
  const [details, setDetails] = useState('')
  const [refDocPage, setRefDocPage] = useState('')
  const [cat, setCat] = useState<Record<CatKey, { on: boolean; text: string }>>(EMPTY_CATS)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')            // resolved name/rank of the signing user
  const [notams, setNotams] = useState<NotamOption[]>([])
  const [notamsLoading, setNotamsLoading] = useState(false)

  // On open: resolve the signing user's name/rank from their profile and pull
  // the base's current NOTAMs from the live FAA feed for the dropdown.
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    if (!supabase) return
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('name, rank').eq('id', user.id).single()
        const p = prof as { name?: string; rank?: string } | null
        const nm = p?.name?.trim() || ''
        const rk = p?.rank?.trim() || ''
        const resolved = rk && nm ? `${rk} ${nm}` : (nm || user.email || '')
        if (!cancelled) setName(resolved)
      }
      if (icao) {
        setNotamsLoading(true)
        try {
          const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
          const data = await res.json()
          if (!cancelled && res.ok && Array.isArray(data.notams)) {
            const opts: NotamOption[] = (data.notams as NotamFeedItem[])
              .filter((n) => n.status === 'active' && n.notam_number)
              .map((n) => ({
                number: n.notam_number as string,
                label: `${n.notam_number}${n.title ? ` — ${n.title.slice(0, 60)}` : ''}`,
              }))
            setNotams(opts)
          }
        } catch {
          /* feed unavailable — the "Other" manual-entry path stays available */
        } finally {
          if (!cancelled) setNotamsLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [open, icao])

  if (!open) return null

  const reset = () => { setFlipTitle(''); setNotam(''); setNotamManual(''); setDetails(''); setRefDocPage(''); setCat(EMPTY_CATS); setRemarks('') }

  const toggleCat = (key: CatKey) => setCat((prev) => ({ ...prev, [key]: { on: !prev[key].on, text: prev[key].on ? '' : prev[key].text } }))
  const setCatText = (key: CatKey, text: string) => setCat((prev) => ({ ...prev, [key]: { ...prev[key], text } }))
  const catValue = (key: CatKey) => (cat[key].on ? (cat[key].text.trim() || null) : null)

  const submit = async () => {
    if (!flipTitle.trim()) { toast.error('FLIP Title is required.'); return }
    if (!name.trim()) { toast.error('Could not resolve your name/rank from your profile — set your name in your profile first.'); return }
    const notamValue = notam === OTHER ? notamManual.trim() : (notam || '')
    setBusy(true)
    const { error } = await createFlipChange({
      baseId, flipTitle: flipTitle.trim(), notam: notamValue, details: details.trim(), name: name.trim(), remarks: remarks.trim(),
      referenceDocPage: refDocPage.trim() || null,
      additions: catValue('additions'), deletions: catValue('deletions'),
      revisionsFrom: catValue('revisions_from'), revisionsTo: catValue('revisions_to'),
    })
    setBusy(false)
    if (error) { toast.error(error); return }
    reset()
    onCreated(); onClose(); toast.success('Change coordinated — awaiting AFM approval')
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', color: 'var(--color-text-1)' }
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', color: 'var(--color-text-2)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Coordinate FLIP Change</header>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* FLIP Title — selected from the Local FLIP List */}
          <div>
            <label style={label}>FLIP Title *</label>
            {flipList.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, background: 'var(--color-warning-bg, rgba(180,83,9,0.12))', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontSize: 'var(--fs-sm)' }}>
                <TriangleAlert size={16} /> Add FLIP titles to the Local FLIP List (Home) before coordinating a change.
              </div>
            ) : (
              <select style={field} value={flipTitle} onChange={(e) => setFlipTitle(e.target.value)}>
                <option value="">Select a FLIP…</option>
                {flipList.map((f) => <option key={f.id} value={f.title}>{f.title}</option>)}
              </select>
            )}
          </div>

          {/* NOTAM — current active NOTAMs from the FAA feed, with a manual fallback */}
          <div>
            <label style={label}>NOTAM</label>
            <select style={field} value={notam} onChange={(e) => setNotam(e.target.value)}>
              <option value="">{notamsLoading ? 'Loading current NOTAMs…' : '— None / not applicable —'}</option>
              {notams.map((n) => <option key={n.number} value={n.number}>{n.label}</option>)}
              <option value={OTHER}>Other (enter manually)…</option>
            </select>
            {notam === OTHER && (
              <input style={{ ...field, marginTop: 8 }} value={notamManual} onChange={(e) => setNotamManual(e.target.value)} placeholder="NOTAM number or reference" />
            )}
            {!notamsLoading && notams.length === 0 && notam !== OTHER && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>No active NOTAMs found for {icao || 'this base'}. Choose “Other” to enter one manually.</div>
            )}
          </div>

          {/* Reference Document & Page — source data being submitted to the FAA */}
          <div>
            <label style={label}>Reference Document &amp; Page</label>
            <input style={field} value={refDocPage} onChange={(e) => setRefDocPage(e.target.value)} placeholder="e.g., AP/1 p. 412; AFD entry" />
          </div>

          {/* Change content — FAA submission categories; each checkbox toggles its field */}
          <div>
            <label style={label}>Change Content</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CATEGORIES.map(({ key, label: l }) => (
                <div key={key}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', cursor: 'pointer', color: 'var(--color-text-1)' }}>
                    <input type="checkbox" checked={cat[key].on} onChange={() => toggleCat(key)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                    {l}
                  </label>
                  {cat[key].on && (
                    <textarea style={{ ...field, marginTop: 6, minHeight: 60, resize: 'both' }} value={cat[key].text} onChange={(e) => setCatText(key, e.target.value)} placeholder={`${l}…`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <label style={label}>Details</label>
            <textarea style={{ ...field, minHeight: 90, resize: 'both' }} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the proposed change…" />
          </div>

          {/* Remarks — recorded on the "Coordinated" step of the history */}
          <div>
            <label style={label}>Remarks (optional)</label>
            <textarea style={{ ...field, minHeight: 56, resize: 'both' }} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Coordination remarks for the history…" />
          </div>

          {/* Name / Rank — auto-imported from the signing user's profile */}
          <div>
            <label style={label}>Name / Rank</label>
            <div style={{ ...field, background: 'var(--color-bg-surface)', color: name ? 'var(--color-text-1)' : 'var(--color-text-3)', display: 'flex', alignItems: 'center', minHeight: 38 }}>
              {name || 'Resolving from your profile…'}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>Recorded automatically from your account.</div>
          </div>
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
          <button onClick={submit} disabled={busy || flipList.length === 0} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)', opacity: (busy || flipList.length === 0) ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Coordinate'}</button>
        </footer>
      </div>
    </div>
  )
}
