'use client'

// Supporting-files tab for a member's training record. The NAMT
// uploads previous training-record exports and any supporting
// documents (PDF / image / Excel / Word). Files live in the private
// `amtr-files` storage bucket (path-scoped RLS); metadata in
// amtr_files. View opens a short-lived signed URL.

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Upload, Trash2, ExternalLink, ShieldAlert } from 'lucide-react'
import {
  fetchAmtrByMember, uploadAmtrFile, deleteAmtrFile, getAmtrFileUrl, type AmtrFileRow,
} from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'
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
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setRows(await fetchAmtrByMember<AmtrFileRow>('amtr_files', memberId, 'created_at'))
    setLoading(false)
  }, [memberId])
  useEffect(() => { load() }, [load])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    let ok = 0
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.has(ext)) { toast.error(`${file.name}: unsupported type (PDF, JPG, PNG, Excel, Word only)`); continue }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: exceeds 25 MB`); continue }
      const { error } = await uploadAmtrFile(installationId, memberId, file)
      if (error) { toast.error(`${file.name}: ${error}`); continue }
      ok++
    }
    setUploading(false)
    if (ok > 0) { toast.success(`Uploaded ${ok} file${ok === 1 ? '' : 's'}`); load() }
  }

  const open = async (r: AmtrFileRow) => {
    if (!r.storage_path) { toast.error('No file attached to this entry'); return }
    const url = await getAmtrFileUrl(r.storage_path)
    if (!url) { toast.error('Could not generate a download link'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const remove = async (r: AmtrFileRow) => {
    if (!window.confirm(`Delete "${r.name}"? This removes the file and its record.`)) return
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
            <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload file'}
            </Btn>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={onPick} />
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
                <th style={th}>File</th><th style={th}>Uploaded</th><th style={th}>Size</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={td}>
                    <button onClick={() => open(r)} disabled={!r.storage_path}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: r.storage_path ? 'pointer' : 'default', color: r.storage_path ? 'var(--color-text-1)' : 'var(--color-text-3)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left' }}>
                      {iconFor(r.name, r.mime_type)}
                      <span>{r.name}</span>
                      {r.storage_path && <ExternalLink size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
                    </button>
                  </td>
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
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px 12px' }
