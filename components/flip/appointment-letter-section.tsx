// components/flip/appointment-letter-section.tsx
'use client'

import { useState } from 'react'
import { Pencil, Save, Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { saveFlipAppointment, type FlipAppointment, type FlipCustodian } from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'

export function AppointmentLetterSection({ baseId, appointment, canEdit, onChange }: {
  baseId: string; appointment: FlipAppointment | null; canEdit: boolean; onChange: () => void
}) {
  const custodians = appointment?.custodians ?? []
  const primary = custodians.find((c) => c.role === 'primary')?.name ?? ''
  const alternates = custodians.filter((c) => c.role === 'alternate').map((c) => c.name)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [draftPrimary, setDraftPrimary] = useState('')
  const [draftAlts, setDraftAlts] = useState<string[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const start = () => {
    setDraftPrimary(primary)
    setDraftAlts(alternates.length ? alternates : [''])
    setDraftNotes(appointment?.notes ?? '')
    setFilePath(appointment?.file_path ?? null)
    setFileName(appointment?.file_name ?? null)
    setEditing(true)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    const { path, error } = await uploadFlipFile(baseId, 'appointment', f)
    setUploading(false)
    if (error || !path) { toast.error(error ?? 'Upload failed'); return }
    setFilePath(path); setFileName(f.name)
    toast.success('Letter uploaded')
  }

  const save = async () => {
    const cust: FlipCustodian[] = []
    if (draftPrimary.trim()) cust.push({ name: draftPrimary.trim(), role: 'primary' })
    draftAlts.forEach((a) => { if (a.trim()) cust.push({ name: a.trim(), role: 'alternate' }) })
    setSaving(true)
    const { error } = await saveFlipAppointment(baseId, { filePath, fileName, custodians: cust, notes: draftNotes.trim() || null })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Saved')
    setEditing(false); onChange()
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', color: 'var(--color-text-1)' }
  const lbl: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', marginBottom: 4 }
  const smBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }

  const hasContent = !!(appointment && (appointment.file_path || custodians.length || appointment.notes))

  const fileRow = (path: string, nameLabel: string | null) => (
    <a href={flipFileUrl(path)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-inset)', textDecoration: 'none', color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>
      <FileText size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameLabel ?? 'Appointment letter'}</span>
    </a>
  )

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: 'var(--color-bg-surface)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--color-bg-inset)', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Current Appointment Letter</span>
        {canEdit && !editing && (
          <button onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-xs)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--color-text-1)' }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </header>

      <div style={{ padding: 16 }}>
        {!editing ? (
          hasContent ? (
            <>
              {appointment?.file_path
                ? fileRow(appointment.file_path, appointment.file_name)
                : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>No appointment letter file uploaded.</div>}
              <div style={{ marginTop: 14 }}>
                <div style={lbl}>Primary FLIP Custodian</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: primary ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>{primary || '—'}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={lbl}>Alternate Custodian{alternates.length === 1 ? '' : 's'}</div>
                {alternates.length ? alternates.map((a, i) => <div key={i} style={{ fontSize: 'var(--fs-sm)' }}>{a}</div>)
                  : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>—</div>}
              </div>
              {appointment?.notes && <p style={{ marginTop: 12, fontSize: 'var(--fs-sm)', whiteSpace: 'pre-wrap', color: 'var(--color-text-2)' }}>{appointment.notes}</p>}
            </>
          ) : (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>No appointment letter details entered. Click Edit to add.</div>
          )
        ) : (
          <>
            {/* File upload */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Appointment Letter File</div>
              {filePath ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {fileRow(filePath, fileName)}
                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                    Replace<input type="file" accept=".pdf,.docx,.doc" onChange={onFile} style={{ display: 'none' }} />
                  </label>
                  <button onClick={() => { setFilePath(null); setFileName(null) }} style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', background: 'none' }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: 'block', border: '2px dashed var(--color-border)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  {uploading ? 'Uploading…' : 'Upload appointment letter (PDF / DOCX)'}
                  <input type="file" accept=".pdf,.docx,.doc" onChange={onFile} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Primary */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Primary FLIP Custodian</div>
              <input style={field} value={draftPrimary} onChange={(e) => setDraftPrimary(e.target.value)} placeholder="e.g., MSgt Smith" />
            </div>

            {/* Alternates */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Alternate Custodian(s)</div>
              {draftAlts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={field} value={a} onChange={(e) => setDraftAlts((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))} placeholder="e.g., SSgt Jones" />
                  <button onClick={() => setDraftAlts((prev) => prev.filter((_, idx) => idx !== i))} title="Remove" style={smBtn}><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={() => setDraftAlts((prev) => [...prev, ''])} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-1)' }}>
                <Plus size={14} /> Add Alternate
              </button>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Notes (optional)</div>
              <textarea style={{ ...field, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} placeholder="Appointment details, effective date, signatories…" />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || uploading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)', opacity: (saving || uploading) ? 0.6 : 1 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
