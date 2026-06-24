'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { addFlipReference, removeFlipReference, type FlipReference } from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'

const TYPE_FROM_EXT: Record<string, FlipReference['file_type']> = { pdf: 'pdf', docx: 'docx', doc: 'docx', pptx: 'pptx', ppt: 'pptx', xlsx: 'xlsx', xls: 'xlsx' }

export function ReferencesPanel({ baseId, refs, canEdit, onChange }: {
  baseId: string; refs: FlipReference[]; canEdit: boolean; onChange: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = () => fileRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setPending(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }
  const submit = async () => {
    if (!pending || !title.trim()) { toast.error('Pick a file and enter a title.'); return }
    setBusy(true)
    const { path, error: upErr } = await uploadFlipFile(baseId, 'references', pending)
    if (upErr || !path) { setBusy(false); toast.error(upErr ?? 'Upload failed'); return }
    const ext = pending.name.split('.').pop()?.toLowerCase() ?? ''
    const { error } = await addFlipReference({ baseId, title: title.trim(), fileType: TYPE_FROM_EXT[ext] ?? 'other', storagePath: path })
    setBusy(false)
    if (error) { toast.error(error); return }
    setPending(null); setTitle(''); onChange(); toast.success('Reference added')
  }
  const remove = async (id: string) => {
    const { error } = await removeFlipReference(id)
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, background: 'var(--color-bg-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Reference Documents</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {refs.map((r) => (
          <a key={r.id} href={flipFileUrl(r.storage_path)} target="_blank" rel="noreferrer"
            style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--color-text-1)', background: 'var(--color-bg-inset)' }}>
            <FileText size={28} style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontSize: 'var(--fs-xs)', textAlign: 'center' }}>{r.title}</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-3)' }}>.{r.file_type}</span>
            {canEdit && <button onClick={(e) => { e.preventDefault(); remove(r.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={13} /></button>}
          </a>
        ))}
      </div>
      {refs.length === 0 && <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)', margin: '8px 0' }}>No references uploaded yet.</p>}
      {canEdit && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={pick} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
            {pending ? pending.name : 'Choose file…'}
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)' }} />
          <button onClick={submit} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            <Plus size={14} /> {busy ? 'Uploading…' : 'Add Reference'}
          </button>
        </div>
      )}
    </section>
  )
}
