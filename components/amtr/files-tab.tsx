'use client'

// Supporting-files tab for a member's training record. The NAMT
// uploads previous training-record exports and any supporting
// documents (PDF / image / Excel / Word). Files live in the private
// `amtr-files` storage bucket (path-scoped RLS); metadata in
// amtr_files. View opens a short-lived signed URL.
//
// "Add file" opens a dialog that captures a Document Title and the
// Document's own Date (distinct from the upload date) before the
// file is attached and uploaded — one document per add.

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Upload, Trash2, ExternalLink, ShieldAlert, Paperclip, X } from 'lucide-react'
import {
  fetchAmtrByMember, uploadAmtrFile, deleteAmtrFile, getAmtrFileUrl, humanFileSize, type AmtrFileRow,
} from '@/lib/supabase/amtr'
import { Btn, Field } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

// Browser file picker filter + a client-side guard. Mirrors the
// formats the operator listed: PDF, images, Excel, Word.
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'docx', 'doc'])
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB cap — generous for scanned records

function iconFor(name: string, mime: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) return <FileImage size={16} style={{ color: 'var(--color-accent)' }} />
  if (mime === 'application/pdf' || ext === 'pdf') return <FileText size={16} style={{ color: 'var(--color-danger)' }} />
  if (['xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={16} style={{ color: 'var(--color-success)' }} />
  if (['docx', 'doc'].includes(ext)) return <FileText size={16} style={{ color: 'var(--color-accent)' }} />
  return <FileIcon size={16} style={{ color: 'var(--color-text-3)' }} />
}

export function FilesTab(props: { memberId: string; installationId: string; canWrite: boolean }) {
  const { memberId, installationId, canWrite } = props
  const [rows, setRows] = useState<AmtrFileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setRows(await fetchAmtrByMember<AmtrFileRow>('amtr_files', memberId, 'created_at'))
    setLoading(false)
  }, [memberId])
  useEffect(() => { load() }, [load])

  const open = async (r: AmtrFileRow) => {
    if (!r.storage_path) { toast.error('No file attached to this entry'); return }
    const url = await getAmtrFileUrl(r.storage_path)
    if (!url) { toast.error('Could not generate a download link'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const remove = async (r: AmtrFileRow) => {
    if (!window.confirm(`Delete "${r.document_title || r.name}"? This removes the file and its record.`)) return
    const { error } = await deleteAmtrFile(r.id, r.storage_path)
    if (error) { toast.error(error); return }
    toast.success('File deleted'); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Supporting Files</h2>
        {canWrite && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn variant="primary" onClick={() => setShowDialog(true)}>
              <Upload size={15} /> Add file
            </Btn>
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Previous training-record exports and supporting documents (PDF, JPG, PNG, Excel, Word — up to 25 MB each). Only users with training-record access at this base can view.
      </div>

      {/* PII / CUI disclaimer — this is a commercial-cloud system, not
          an authorized enclave for controlled data. Operators must not
          upload documents containing PII or CUI. */}
      <div role="alert" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 14,
        borderRadius: 8, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.45,
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: 'var(--color-danger)' }}>Do not upload PII or CUI.</strong>{' '}
          This system is not an authorized repository for Personally Identifiable Information or Controlled Unclassified Information. Redact SSNs, DoD ID numbers, and other sensitive data before uploading. Use only document content cleared for storage on a commercial-cloud system.
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState message="No supporting files uploaded yet." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={th}>Document</th><th style={th}>Doc Date</th><th style={th}>Uploaded</th><th style={th}>Size</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={td}>
                    <button onClick={() => open(r)} disabled={!r.storage_path}
                      style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, background: 'none', border: 'none', padding: 0, cursor: r.storage_path ? 'pointer' : 'default', color: r.storage_path ? 'var(--color-text-1)' : 'var(--color-text-3)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left' }}>
                      <span style={{ marginTop: 1, flexShrink: 0 }}>{iconFor(r.name, r.mime_type)}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {r.document_title || r.name}
                          {r.storage_path && <ExternalLink size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
                        </span>
                        {r.document_title && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{r.name}</span>}
                      </span>
                    </button>
                  </td>
                  <td style={{ ...td, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{r.document_date ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{r.uploaded_at?.slice(0, 10) ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{r.size ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {canWrite && (
                      <button onClick={() => remove(r)} title="Delete file"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <AddFileDialog
          installationId={installationId}
          memberId={memberId}
          onClose={() => setShowDialog(false)}
          onUploaded={load}
        />
      )}
    </div>
  )
}

// ── Add-file dialog: Document Title + Date + single attach ──────────
// Title and Date are both required; Upload stays disabled until a valid
// file is attached and both fields are filled. Controlled inputs (no
// defaultValue) so submit always reflects what's on screen.
function AddFileDialog({ installationId, memberId, onClose, onUploaded }: {
  installationId: string; memberId: string; onClose: () => void; onUploaded: () => void
}) {
  const [title, setTitle] = useState('')
  const [docDate, setDocDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext)) { toast.error(`${f.name}: unsupported type (PDF, JPG, PNG, Excel, Word only)`); return }
    if (f.size > MAX_BYTES) { toast.error(`${f.name}: exceeds 25 MB`); return }
    setFile(f)
    // Convenience: seed the title from the filename (minus extension)
    // only when the operator hasn't typed one yet.
    setTitle((t) => t.trim() ? t : f.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!file || !title.trim() || !docDate || busy) return
    setBusy(true)
    const { error } = await uploadAmtrFile(installationId, memberId, file, { documentTitle: title.trim(), documentDate: docDate })
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('File uploaded')
    onUploaded()
    onClose()
  }

  const canSubmit = !!file && !!title.trim() && !!docDate && !busy
  const close = () => { if (!busy) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <Upload size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>Add supporting file</strong>
          <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <Field label="Document title *">
            <input className="input-dark" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bird/Wildlife Control 1098 (2025)" autoFocus />
          </Field>
          <Field label="Document date *">
            <input type="date" className="input-dark" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </Field>
          <Field label="File *">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} /> {file ? 'Change file' : 'Attach file'}
              </Btn>
              {file ? (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {iconFor(file.name, file.type || null)} {file.name} · {humanFileSize(file.size)}
                </span>
              ) : (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No file selected</span>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={pick} />
            </div>
          </Field>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>PDF, JPG, PNG, Excel, Word — up to 25 MB.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <Btn variant="ghost" onClick={close} disabled={busy}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!canSubmit}>
            <Upload size={14} /> {busy ? 'Uploading…' : 'Upload'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px 12px' }
