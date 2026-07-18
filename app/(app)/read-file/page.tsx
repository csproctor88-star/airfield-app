'use client'

// Read File — read-and-initial continuity file. Managers (read_file:manage)
// upload documents; operational users (read_file:view) must acknowledge each
// one. Acks are version-stamped, so a manager "Replace" re-triggers everyone.

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  FileText, FileSpreadsheet, FileImage, File as FileIcon, Upload, Archive,
  ArchiveRestore, ExternalLink, ShieldAlert, Paperclip, X, CheckCircle2,
  RefreshCw, FileDown,
} from 'lucide-react'
import {
  fetchReadFiles, fetchMyAcks, getReadFileUrl, addReadFile, replaceReadFile,
  setReadFileArchived, acknowledgeReadFile, humanFileSize,
  fetchAllAcks, fetchReadFileReviewers,
  type ReadFileRow, type ReadFileAckRow,
} from '@/lib/supabase/read-files'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { Btn, Field } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'docx', 'doc'])
const MAX_BYTES = 25 * 1024 * 1024

function iconFor(name: string, mime: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) return <FileImage size={16} style={{ color: 'var(--color-accent)' }} />
  if (mime === 'application/pdf' || ext === 'pdf') return <FileText size={16} style={{ color: 'var(--color-danger)' }} />
  if (['xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={16} style={{ color: 'var(--color-success)' }} />
  if (['docx', 'doc'].includes(ext)) return <FileText size={16} style={{ color: 'var(--color-accent)' }} />
  return <FileIcon size={16} style={{ color: 'var(--color-text-3)' }} />
}

export default function ReadFilePage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.READ_FILE_MANAGE)

  const [files, setFiles] = useState<ReadFileRow[]>([])
  const [acks, setAcks] = useState<ReadFileAckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [replaceFor, setReplaceFor] = useState<ReadFileRow | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [f, a] = await Promise.all([fetchReadFiles(installationId), fetchMyAcks(installationId)])
    setFiles(f); setAcks(a); setLoading(false)
  }, [installationId])
  useEffect(() => { load() }, [load])

  const ackedVersion = (fileId: string): number | null => {
    const rows = acks.filter(a => a.read_file_id === fileId)
    if (rows.length === 0) return null
    return Math.max(...rows.map(a => a.acknowledged_version))
  }

  const open = async (r: ReadFileRow) => {
    const url = await getReadFileUrl(r.storage_path)
    if (!url) { toast.error('Could not generate a download link'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const acknowledge = async (r: ReadFileRow) => {
    if (!installationId) return
    const { error } = await acknowledgeReadFile(installationId, r.id, r.version)
    if (error) { toast.error(error); return }
    toast.success('Marked as reviewed')
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  const archive = async (r: ReadFileRow) => {
    const next = !r.is_archived
    if (next && !window.confirm(`Archive "${r.title}"? It drops off the review list and badge but stays in the report history.`)) return
    const { error } = await setReadFileArchived(r.id, next)
    if (error) { toast.error(error); return }
    toast.success(next ? 'Archived' : 'Restored')
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  const active = files.filter(f => !f.is_archived)
  const archived = files.filter(f => f.is_archived)

  const runReport = async () => {
    if (!installationId) return
    const [reviewers, allAcks] = await Promise.all([
      fetchReadFileReviewers(installationId),
      fetchAllAcks(installationId),
    ])
    const { generateReadFileReviewPdf } = await import('@/lib/read-file-review-pdf')
    const { doc, filename } = await generateReadFileReviewPdf({
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      files: active,
      // The archive confirm dialog promises archived files stay in the
      // report history — rendered in the "Archived (history)" section,
      // excluded from the active stats.
      archivedFiles: archived,
      reviewers,
      acks: allAcks,
      generatedAtIso: new Date().toISOString(),
    })
    doc.save(filename)
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Read File</h1>
        {canManage && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={runReport}>
              <FileDown size={15} /> Review report
            </Btn>
            <Btn variant="primary" onClick={() => setShowAdd(true)}>
              <Upload size={15} /> Add file
            </Btn>
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Documents that airfield management personnel must read and acknowledge. Your acknowledgment records your name, operating initials, and the date. When a file is replaced, it must be re-reviewed.
      </div>

      {/* PII / CUI disclaimer — commercial-cloud system, not an authorized enclave. */}
      <div role="alert" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 14,
        borderRadius: 8, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.45,
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: 'var(--color-danger)' }}>Do not upload PII or CUI.</strong>{' '}
          This system is not an authorized repository for Personally Identifiable Information or Controlled Unclassified Information. Redact sensitive data before uploading.
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
      ) : active.length === 0 ? (
        <EmptyState message="No read files yet." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={th}>Document</th><th style={th}>Version</th><th style={th}>Your status</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const acked = ackedVersion(r.id)
                const isCurrent = acked === r.version
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={td}>
                      <button onClick={() => open(r)}
                        style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left' }}>
                        <span style={{ marginTop: 1, flexShrink: 0 }}>{iconFor(r.file_name, r.mime_type)}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {r.title}
                            <ExternalLink size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                          </span>
                          {r.description && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{r.description}</span>}
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{r.file_name}{r.file_size_bytes != null ? ` · ${humanFileSize(r.file_size_bytes)}` : ''}</span>
                        </span>
                      </button>
                    </td>
                    <td style={{ ...td, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>v{r.version}</td>
                    <td style={td}>
                      {isCurrent ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontWeight: 600 }}>
                          <CheckCircle2 size={15} /> Reviewed v{r.version}
                        </span>
                      ) : (
                        <Btn variant="primary" onClick={() => acknowledge(r)}>
                          <CheckCircle2 size={14} /> I have reviewed this file
                        </Btn>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canManage && (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => setReplaceFor(r)} title="Replace file (re-triggers review)"
                            style={iconBtn}><RefreshCw size={14} /></button>
                          <button onClick={() => archive(r)} title="Archive"
                            style={iconBtn}><Archive size={14} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowArchived(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0 }}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                <tbody>
                  {archived.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={td}>
                        <button onClick={() => open(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-2)', fontFamily: 'inherit', fontSize: 'inherit' }}>
                          {iconFor(r.file_name, r.mime_type)} {r.title}
                        </button>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => archive(r)} title="Restore" style={iconBtn}><ArchiveRestore size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && installationId && (
        <UploadDialog
          title="Add read file"
          requireTitle
          onClose={() => setShowAdd(false)}
          onSubmit={async (file, meta) => addReadFile(installationId, file, meta)}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
      {replaceFor && (
        <UploadDialog
          title={`Replace "${replaceFor.title}"`}
          requireTitle={false}
          onClose={() => setReplaceFor(null)}
          onSubmit={async (file) => {
            const { error } = await replaceReadFile(replaceFor, file)
            return { data: error ? null : ({} as ReadFileRow), error }
          }}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
    </div>
  )
}

// ── Upload dialog — used for both Add (title required) and Replace ──
function UploadDialog({ title, requireTitle, onClose, onSubmit, onDone }: {
  title: string
  requireTitle: boolean
  onClose: () => void
  onSubmit: (file: File, meta: { title: string; description?: string }) => Promise<{ data: ReadFileRow | null; error: string | null }>
  onDone: () => void
}) {
  const [docTitle, setDocTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext)) { toast.error(`${f.name}: unsupported type (PDF, JPG, PNG, Excel, Word only)`); return }
    if (f.size > MAX_BYTES) { toast.error(`${f.name}: exceeds 25 MB`); return }
    setFile(f)
    setDocTitle(t => t.trim() ? t : f.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!file || busy) return
    if (requireTitle && !docTitle.trim()) return
    setBusy(true)
    const { error } = await onSubmit(file, { title: docTitle.trim(), description: desc })
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Saved')
    onDone(); onClose()
  }

  const canSubmit = !!file && !busy && (!requireTitle || !!docTitle.trim())
  const close = () => { if (!busy) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <Upload size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          {requireTitle && (
            <>
              <Field label="Document title *">
                <input className="input-dark" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Local OI 13-204 — Read & Initial" autoFocus />
              </Field>
              <Field label="Description (optional)">
                <input className="input-dark" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short context for reviewers" />
              </Field>
            </>
          )}
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
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
