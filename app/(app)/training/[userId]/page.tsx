'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, GraduationCap, BookOpen, Award, History, Download,
  Plus, X, Info, Pencil, Trash2, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, AlertCircle, Circle,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions } from '@/lib/permissions'
import { getRoleLabel } from '@/lib/airport-mode'
import { fetchInstallationMembers } from '@/lib/supabase/installations'
import { createClient } from '@/lib/supabase/client'
import {
  fetchTrainingTopics,
  fetchTrainingRecords,
  fetchTrainingCertificates,
  createTrainingRecord,
  uploadTrainingEvidence,
  deleteTrainingRecord,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  classifyTrainingStatus,
  type TrainingTopic,
  type TrainingRecord,
  type TrainingCertificate,
  type TrainingStatus,
  type TrainingType,
  type TrainingCredential,
} from '@/lib/supabase/training-part139'
import { formatZuluDate } from '@/lib/utils'

type Tab = 'records' | 'certificates' | 'history'
type Member = Awaited<ReturnType<typeof fetchInstallationMembers>>[number]
type ActivityRow = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_display_id: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

export default function TrainingUserDetailPage() {
  const params = useParams<{ userId: string }>()
  const userId = params.userId
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has('training_part139:write')

  const [members, setMembers] = useState<Member[]>([])
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [certs, setCerts] = useState<TrainingCertificate[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('records')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [logTrainingTopic, setLogTrainingTopic] = useState<TrainingTopic | null>(null)
  const [editingCert, setEditingCert] = useState<TrainingCertificate | null>(null)
  const [addingCert, setAddingCert] = useState(false)

  const loadActivity = useCallback(async () => {
    const supabase = createClient()
    if (!supabase || !installationId) return
    // Pull recent activity_log rows for this user across training entities.
    // user_id on activity_log is the actor (whoever logged the training),
    // so we filter by entity rows we own: fetch records + certs for this
    // user, collect their ids, query activity by entity_id IN (...).
    const ids: string[] = [...records.map(r => r.id), ...certs.map(c => c.id)]
    if (ids.length === 0) { setActivity([]); return }
    const { data } = await supabase
      .from('activity_log')
      .select('id, action, entity_type, entity_id, entity_display_id, created_at, metadata')
      .in('entity_type', ['training_record', 'training_certificate'])
      .in('entity_id', ids)
      .order('created_at', { ascending: false })
      .limit(100)
    setActivity((data || []) as unknown as ActivityRow[])
  }, [installationId, records, certs])

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [m, t, r, c] = await Promise.all([
      fetchInstallationMembers(installationId),
      fetchTrainingTopics(installationId),
      fetchTrainingRecords({ base_id: installationId, user_id: userId }),
      fetchTrainingCertificates({ base_id: installationId, user_id: userId }),
    ])
    setMembers(m)
    setTopics(t)
    setRecords(r)
    setCerts(c)
    setLoading(false)
  }, [installationId, userId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadActivity() }, [loadActivity])

  const member = useMemo(() => members.find(m => m.user_id === userId) ?? null, [members, userId])

  // De-dup topics by code (base override wins)
  const activeTopics = useMemo(() => {
    const byCode = new Map<string, TrainingTopic>()
    for (const t of topics) {
      const prior = byCode.get(t.code)
      if (!prior || (t.base_id && !prior.base_id)) byCode.set(t.code, t)
    }
    return Array.from(byCode.values()).sort((a, b) => a.sort_order - b.sort_order)
  }, [topics])

  // Records grouped by topic_id (newest first within each group)
  const recordsByTopicCode = useMemo(() => {
    const topicCodeById = new Map(topics.map(t => [t.id, t.code] as const))
    const out = new Map<string, TrainingRecord[]>()
    for (const r of [...records].sort((a, b) => (b.completed_at > a.completed_at ? 1 : -1))) {
      const code = topicCodeById.get(r.topic_id)
      if (!code) continue
      const arr = out.get(code) ?? []
      arr.push(r)
      out.set(code, arr)
    }
    return out
  }, [records, topics])

  function toggleExpand(topicCode: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(topicCode)) next.delete(topicCode)
      else next.add(topicCode)
      return next
    })
  }

  function memberName(m: Member) {
    return `${m.rank ? m.rank + ' ' : ''}${m.name}`
  }
  function memberById(id: string | null) {
    if (!id) return null
    return members.find(m => m.user_id === id) ?? null
  }

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <Link href="/training/roster" style={backLinkStyle}>
        <ArrowLeft size={14} /> Roster
      </Link>

      <div style={headerRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={avatarStyle}>
            <GraduationCap size={20} color="var(--color-cyan)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={titleStyle}>
              {member ? memberName(member) : 'User'}
            </div>
            <div style={subtitleStyle}>
              {member ? (
                <>
                  {getRoleLabel(member.role, currentInstallation) || member.role}
                  {member.email ? ` · ${member.email}` : ''}
                </>
              ) : (loading ? 'Loading…' : 'Unknown user')}
            </div>
          </div>
        </div>
        {member && !loading && (
          <button
            type="button"
            onClick={async () => {
              const { generateTrainingTranscriptPdf } = await import('@/lib/training-part139-pdf')
              const { doc, filename } = generateTrainingTranscriptPdf({
                base: { name: currentInstallation?.name ?? null, icao: currentInstallation?.icao ?? null },
                user: {
                  name: member.name,
                  rank: member.rank,
                  email: member.email,
                  role: getRoleLabel(member.role, currentInstallation) || member.role,
                },
                topics: activeTopics,
                records,
                certificates: certs,
              })
              doc.save(filename)
              toast.success('Transcript downloaded')
            }}
            style={secondaryHeaderBtnStyle}
            title="Download PDF transcript"
          >
            <Download size={14} /> Transcript
          </button>
        )}
      </div>

      <div style={tabBarStyle}>
        <TabButton active={tab === 'records'} onClick={() => setTab('records')}>
          <BookOpen size={14} /> Records
          <span style={countPillStyle(tab === 'records')}>{activeTopics.length}</span>
        </TabButton>
        <TabButton active={tab === 'certificates'} onClick={() => setTab('certificates')}>
          <Award size={14} /> Certificates
          <span style={countPillStyle(tab === 'certificates')}>{certs.length}</span>
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          <History size={14} /> History
        </TabButton>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-3)', padding: 24, textAlign: 'center' }}>Loading…</div>
      ) : tab === 'records' ? (
        <RecordsTab
          topics={activeTopics}
          recordsByTopicCode={recordsByTopicCode}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          memberById={memberById}
          canWrite={canWrite}
          onLogTraining={t => setLogTrainingTopic(t)}
          onDeleteRecord={async (id) => {
            if (!confirm('Delete this training record? This cannot be undone.')) return
            const r = await deleteTrainingRecord(id, installationId!)
            if (r.ok) { toast.success('Record deleted'); void load() }
            else toast.error(r.error ?? 'Delete failed')
          }}
        />
      ) : tab === 'certificates' ? (
        <CertificatesTab
          certs={certs}
          canWrite={canWrite}
          onAdd={() => setAddingCert(true)}
          onEdit={c => setEditingCert(c)}
          onDelete={async (id) => {
            if (!confirm('Delete this certificate? This cannot be undone.')) return
            const r = await deleteCertificate(id, installationId!)
            if (r.ok) { toast.success('Certificate deleted'); void load() }
            else toast.error(r.error ?? 'Delete failed')
          }}
        />
      ) : (
        <HistoryTab activity={activity} />
      )}

      {logTrainingTopic && installationId && (
        <LogTrainingModal
          topic={logTrainingTopic}
          userId={userId}
          baseId={installationId}
          priorRecord={(recordsByTopicCode.get(logTrainingTopic.code) ?? [])[0] ?? null}
          members={members}
          onClose={() => setLogTrainingTopic(null)}
          onSaved={() => { setLogTrainingTopic(null); void load() }}
        />
      )}
      {(addingCert || editingCert) && installationId && (
        <CertificateModal
          cert={editingCert}
          userId={userId}
          baseId={installationId}
          onClose={() => { setAddingCert(false); setEditingCert(null) }}
          onSaved={() => { setAddingCert(false); setEditingCert(null); void load() }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Records tab
// ────────────────────────────────────────────────────────────────
function RecordsTab({
  topics, recordsByTopicCode, expanded, onToggleExpand, memberById,
  canWrite, onLogTraining, onDeleteRecord,
}: {
  topics: TrainingTopic[]
  recordsByTopicCode: Map<string, TrainingRecord[]>
  expanded: Set<string>
  onToggleExpand: (code: string) => void
  memberById: (id: string | null) => Member | null
  canWrite: boolean
  onLogTraining: (t: TrainingTopic) => void
  onDeleteRecord: (id: string) => void
}) {
  return (
    <div style={tableWrapStyle}>
      <div style={tableHeaderStyle}>
        <div style={{ flex: '0 0 28px' }}></div>
        <div style={{ flex: '0 0 110px' }}>Code</div>
        <div style={{ flex: 2 }}>Topic</div>
        <div style={{ flex: '0 0 100px' }}>Status</div>
        <div style={{ flex: 1 }}>Completed / Expires</div>
        <div style={{ flex: '0 0 110px', textAlign: 'right' }}></div>
      </div>
      {topics.map(t => {
        const chain = recordsByTopicCode.get(t.code) ?? []
        const latest = chain[0] ?? null
        const status = classifyTrainingStatus(latest)
        const isExpanded = expanded.has(t.code)
        return (
          <div key={t.id}>
            <div style={tableRowStyle}>
              <button
                type="button"
                onClick={() => onToggleExpand(t.code)}
                style={{ ...iconBtnStyle, opacity: chain.length > 0 ? 1 : 0.3, cursor: chain.length > 0 ? 'pointer' : 'default' }}
                disabled={chain.length === 0}
                title={chain.length > 0 ? `${chain.length} record${chain.length === 1 ? '' : 's'}` : 'No records'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <div style={{ flex: '0 0 110px', display: 'flex', alignItems: 'center' }}>
                <code style={codeStyle}>{t.code}</code>
              </div>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{t.title}</div>
                {t.material_url && (
                  <a href={t.material_url} target="_blank" rel="noopener noreferrer" style={materialLinkStyle}>
                    <ExternalLink size={11} /> Reference material
                  </a>
                )}
              </div>
              <div style={{ flex: '0 0 100px' }}><StatusChip status={status} /></div>
              <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                {latest ? (
                  <>
                    <div>{formatZuluDate(latest.completed_at)}</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                      {latest.expires_at ? `Expires ${formatZuluDate(latest.expires_at)}` : 'No expiry'}
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'var(--color-text-4)', fontStyle: 'italic' }}>Never</span>
                )}
              </div>
              <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onLogTraining(t)}
                    style={smallPrimaryBtnStyle}
                  >
                    <Plus size={11} /> Log
                  </button>
                )}
              </div>
            </div>
            {isExpanded && chain.length > 0 && (
              <div style={chainWrapStyle}>
                {chain.map((r, idx) => {
                  const instructor = r.instructor_user_id
                    ? memberById(r.instructor_user_id)?.name ?? '—'
                    : r.instructor_name_external ?? '—'
                  return (
                    <div key={r.id} style={chainRowStyle}>
                      <div style={chainBadgeStyle}>{r.training_type}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
                          Completed {formatZuluDate(r.completed_at)}
                          {r.expires_at && (
                            <span style={{ color: 'var(--color-text-3)' }}> · expires {formatZuluDate(r.expires_at)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                          Instructor: {instructor}
                          {r.evidence_url && (
                            <>
                              {' · '}
                              <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-cyan)' }}>
                                <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> evidence
                              </a>
                            </>
                          )}
                        </div>
                        {r.notes && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic' }}>
                            {r.notes}
                          </div>
                        )}
                      </div>
                      {canWrite && idx === 0 && (
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(r.id)}
                          style={iconBtnStyle}
                          title="Delete this record"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Certificates tab
// ────────────────────────────────────────────────────────────────
function CertificatesTab({
  certs, canWrite, onAdd, onEdit, onDelete,
}: {
  certs: TrainingCertificate[]
  canWrite: boolean
  onAdd: () => void
  onEdit: (c: TrainingCertificate) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {canWrite && (
          <button type="button" onClick={onAdd} style={primaryBtnStyle}>
            <Plus size={14} /> Add Certificate
          </button>
        )}
      </div>
      {certs.length === 0 ? (
        <div style={emptyStateStyle}>
          <Info size={16} /> No AAAE / ACE certificates on file for this user.
        </div>
      ) : (
        <div style={tableWrapStyle}>
          <div style={tableHeaderStyle}>
            <div style={{ flex: '0 0 130px' }}>Credential</div>
            <div style={{ flex: 1 }}>Issued</div>
            <div style={{ flex: 1 }}>Expires</div>
            <div style={{ flex: '0 0 110px' }}>Status</div>
            <div style={{ flex: 2 }}>Notes</div>
            <div style={{ flex: '0 0 90px', textAlign: 'right' }}></div>
          </div>
          {certs.map(c => {
            const status = classifyTrainingStatus({ expires_at: c.expires_at })
            return (
              <div key={c.id} style={tableRowStyle}>
                <div style={{ flex: '0 0 130px' }}>
                  <code style={codeStyle}>{c.credential}</code>
                </div>
                <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                  {formatZuluDate(c.issued_at)}
                </div>
                <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                  {c.expires_at ? formatZuluDate(c.expires_at) : <span style={{ color: 'var(--color-text-4)' }}>Lifetime</span>}
                </div>
                <div style={{ flex: '0 0 110px' }}>
                  <StatusChip status={c.expires_at ? status : 'current'} />
                </div>
                <div style={{ flex: 2, minWidth: 0, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
                  {c.notes ? c.notes : <span style={{ color: 'var(--color-text-4)', fontStyle: 'italic' }}>—</span>}
                  {c.certificate_url && (
                    <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" style={{ ...materialLinkStyle, marginTop: 2 }}>
                      <ExternalLink size={11} /> Certificate PDF
                    </a>
                  )}
                </div>
                <div style={{ flex: '0 0 90px', textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {canWrite && (
                    <>
                      <button type="button" onClick={() => onEdit(c)} style={iconBtnStyle} title="Edit"><Pencil size={13} /></button>
                      <button type="button" onClick={() => onDelete(c.id)} style={iconBtnStyle} title="Delete"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────
// History tab
// ────────────────────────────────────────────────────────────────
function HistoryTab({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <Info size={16} /> No activity recorded yet for this user's training.
      </div>
    )
  }
  return (
    <div style={tableWrapStyle}>
      {activity.map(a => (
        <div key={a.id} style={{ ...tableRowStyle, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 130px', color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>
            {formatZuluDate(a.created_at)}
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <code style={codeStyle}>{a.action}</code>
          </div>
          <div style={{ flex: 1, color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }}>
            {a.entity_display_id ?? `${a.entity_type} ${a.entity_id?.slice(0, 8)}…`}
          </div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Log Training modal
// ────────────────────────────────────────────────────────────────
function LogTrainingModal({
  topic, userId, baseId, priorRecord, members, onClose, onSaved,
}: {
  topic: TrainingTopic
  userId: string
  baseId: string
  priorRecord: TrainingRecord | null
  members: Member[]
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const defaultType: TrainingType =
    priorRecord && classifyTrainingStatus(priorRecord) !== 'expired' ? 'recurrent' : 'initial'

  const [completedAt, setCompletedAt] = useState(today)
  const [trainingType, setTrainingType] = useState<TrainingType>(defaultType)
  const [instructorUserId, setInstructorUserId] = useState<string>('')
  const [instructorExternal, setInstructorExternal] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // Pre-generate record id so the upload path is stable
    const recordId = crypto.randomUUID()

    let evidenceUrl: string | null = null
    if (evidenceFile) {
      const up = await uploadTrainingEvidence({
        file: evidenceFile,
        base_id: baseId,
        user_id: userId,
        record_id: recordId,
      })
      if (!up.ok) {
        setSaving(false)
        toast.error(up.error ?? 'Evidence upload failed')
        return
      }
      evidenceUrl = up.url ?? null
    }

    const result = await createTrainingRecord({
      id: recordId,
      base_id: baseId,
      user_id: userId,
      topic_id: topic.id,
      completed_at: completedAt,
      training_type: trainingType,
      instructor_user_id: instructorUserId || null,
      instructor_name_external: instructorExternal.trim() || null,
      evidence_url: evidenceUrl,
      notes: notes.trim() || null,
      renewPriorRecordId: trainingType === 'recurrent' && priorRecord ? priorRecord.id : null,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? 'Save failed')
      return
    }
    toast.success(`${trainingType === 'initial' ? 'Initial' : trainingType === 'recurrent' ? 'Recurrent' : 'Remedial'} training logged`)
    onSaved()
  }

  return (
    <ModalShell title={`Log Training — ${topic.code}`} onClose={onClose}>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
        {topic.title}
      </div>
      {priorRecord && (
        <div style={hintBoxStyle}>
          <Info size={14} />
          <div>
            Most recent record: {formatZuluDate(priorRecord.completed_at)}
            {priorRecord.expires_at && ` · expires ${formatZuluDate(priorRecord.expires_at)}`}.
            Defaulting to <strong>{defaultType}</strong>.
          </div>
        </div>
      )}
      <div style={fieldRowStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Completed (date)</label>
          <input type="date" value={completedAt} onChange={e => setCompletedAt(e.target.value)} style={inputStyle} max={today} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Training type</label>
          <select value={trainingType} onChange={e => setTrainingType(e.target.value as TrainingType)} style={inputStyle}>
            <option value="initial">Initial</option>
            <option value="recurrent">Recurrent</option>
            <option value="remedial">Remedial</option>
          </select>
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Instructor (base member)</label>
        <select value={instructorUserId} onChange={e => setInstructorUserId(e.target.value)} style={inputStyle}>
          <option value="">— External / not on Glidepath —</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.rank ? `${m.rank} ` : ''}{m.name}
            </option>
          ))}
        </select>
      </div>
      {!instructorUserId && (
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>External instructor name</label>
          <input type="text" value={instructorExternal} onChange={e => setInstructorExternal(e.target.value)} placeholder="e.g. AAAE Annual Conference 2026" style={inputStyle} />
        </div>
      )}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Evidence (PDF / image, optional)</label>
        <input type="file" accept="application/pdf,image/*" onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} style={fileInputStyle} />
        <div style={fieldHintStyle}>
          Attendance sheet, certificate of completion, LMS screenshot, etc. Uploaded to secure storage.
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <ModalActions saving={saving} onCancel={onClose} onSave={handleSave} />
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────
// Add / Edit Certificate modal
// ────────────────────────────────────────────────────────────────
const CREDENTIALS: TrainingCredential[] = ['AAAE-CM', 'ACE-Ops', 'ACE-Comm', 'ACE-Sec', 'ACE-WHC']

function CertificateModal({
  cert, userId, baseId, onClose, onSaved,
}: {
  cert: TrainingCertificate | null
  userId: string
  baseId: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = cert !== null
  const today = new Date().toISOString().slice(0, 10)
  const [credential, setCredential] = useState<TrainingCredential>(cert?.credential ?? 'AAAE-CM')
  const [issuedAt, setIssuedAt] = useState(cert?.issued_at ?? today)
  const [expiresAt, setExpiresAt] = useState(cert?.expires_at ?? '')
  const [certificateUrl, setCertificateUrl] = useState(cert?.certificate_url ?? '')
  const [notes, setNotes] = useState(cert?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = isEdit && cert
      ? await updateCertificate(cert.id, baseId, {
          issued_at: issuedAt,
          expires_at: expiresAt || null,
          certificate_url: certificateUrl.trim() || null,
          notes: notes.trim() || null,
        })
      : await createCertificate({
          base_id: baseId,
          user_id: userId,
          credential,
          issued_at: issuedAt,
          expires_at: expiresAt || null,
          certificate_url: certificateUrl.trim() || null,
          notes: notes.trim() || null,
        })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? 'Save failed')
      return
    }
    toast.success(isEdit ? 'Certificate updated' : 'Certificate added')
    onSaved()
  }

  return (
    <ModalShell title={isEdit ? `Edit ${cert?.credential}` : 'Add Certificate'} onClose={onClose}>
      <div style={fieldRowStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Credential</label>
          {isEdit ? (
            <div style={readOnlyValueStyle}>{credential}</div>
          ) : (
            <select value={credential} onChange={e => setCredential(e.target.value as TrainingCredential)} style={inputStyle}>
              {CREDENTIALS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Issued</label>
          <input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} style={inputStyle} max={today} />
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Expires (blank = lifetime)</label>
        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle} />
        <div style={fieldHintStyle}>AAAE-CM is typically a 3-year cycle. Some legacy ACE certs are lifetime — leave blank.</div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Certificate URL (PDF or verification link)</label>
        <input type="url" value={certificateUrl} onChange={e => setCertificateUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <ModalActions saving={saving} onCancel={onClose} onSave={handleSave} />
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────
// Shared components + styles (kept inline; small enough not to
// warrant a separate file yet)
// ────────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: TrainingStatus }) {
  const { label, palette, Icon } = STATUS_DISPLAY[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.3,
      background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text,
    }}>
      <Icon size={10} /> {label}
    </span>
  )
}

const STATUS_DISPLAY: Record<TrainingStatus, { label: string; palette: { bg: string; border: string; text: string }; Icon: typeof CheckCircle2 }> = {
  current:     { label: 'Current',     palette: { bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', border: 'color-mix(in srgb, var(--color-success) 35%, transparent)', text: 'rgb(21,128,61)' },  Icon: CheckCircle2 },
  expiring:    { label: 'Expiring',    palette: { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 35%, transparent)', text: 'rgb(180,83,9)'  },  Icon: AlertTriangle },
  expired:     { label: 'Expired',     palette: { bg: 'color-mix(in srgb, var(--color-error) 14%, transparent)',   border: 'color-mix(in srgb, var(--color-error) 35%, transparent)',   text: 'rgb(185,28,28)' },  Icon: AlertCircle },
  not_started: { label: 'Not started', palette: { bg: 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',   border: 'color-mix(in srgb, var(--color-text-1) 20%, transparent)',  text: 'rgb(71,85,105)' },  Icon: Circle },
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        background: active ? 'color-mix(in srgb, var(--color-cyan) 12%, transparent)' : 'transparent',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--color-cyan) 35%, transparent)' : 'var(--color-border)'}`,
        color: active ? 'rgb(3,105,161)' : 'var(--color-text-2)',
        fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function countPillStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255,255,255,0.6)' : 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',
    color: active ? 'rgb(3,105,161)' : 'var(--color-text-3)',
    padding: '1px 7px', borderRadius: 999,
    fontSize: 'var(--fs-2xs)', fontWeight: 700,
  }
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)',
          padding: 20, width: '90vw', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
          border: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>{title}</div>
          <button type="button" onClick={onClose} style={iconBtnStyle} title="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
      <button type="button" onClick={onCancel} style={secondaryBtnStyle} disabled={saving}>Cancel</button>
      <button type="button" onClick={onSave} style={primaryBtnStyle} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

const backLinkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', textDecoration: 'none', marginBottom: 12 }
const headerRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)' }
const titleStyle: React.CSSProperties = { fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }
const avatarStyle: React.CSSProperties = { width: 44, height: 44, minWidth: 44, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const tabBarStyle: React.CSSProperties = { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }
const tableWrapStyle: React.CSSProperties = { background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }
const tableHeaderStyle: React.CSSProperties = { display: 'flex', gap: 12, padding: '10px 14px', background: 'color-mix(in srgb, var(--color-cyan) 4%, transparent)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--color-text-3)', alignItems: 'center' }
const tableRowStyle: React.CSSProperties = { display: 'flex', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }
const codeStyle: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', background: 'color-mix(in srgb, var(--color-text-1) 6%, transparent)', padding: '2px 6px', borderRadius: 4 }
const materialLinkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 'var(--fs-2xs)', color: 'var(--color-cyan)', textDecoration: 'none' }
const iconBtnStyle: React.CSSProperties = { background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const primaryBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'var(--color-cyan)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }
const smallPrimaryBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, background: 'var(--color-cyan)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer' }
const secondaryBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'transparent', color: 'var(--color-text-2)', border: '1px solid var(--color-border)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }
const secondaryHeaderBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)', color: 'rgb(3,105,161)', border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }
const fieldGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }
const fieldRowStyle: React.CSSProperties = { display: 'flex', gap: 12 }
const labelStyle: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-2)' }
const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }
const fileInputStyle: React.CSSProperties = { ...inputStyle, padding: '6px 8px', fontSize: 'var(--fs-xs)' }
const readOnlyValueStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--color-text-1) 4%, transparent)', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)' }
const fieldHintStyle: React.CSSProperties = { fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginTop: 2 }
const hintBoxStyle: React.CSSProperties = { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 6, background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)', color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', alignItems: 'flex-start' }
const emptyStateStyle: React.CSSProperties = { display: 'flex', gap: 10, padding: 14, borderRadius: 6, background: 'color-mix(in srgb, var(--color-amber) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-amber) 25%, transparent)', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', alignItems: 'center' }
const chainWrapStyle: React.CSSProperties = { padding: '8px 14px 14px 60px', background: 'color-mix(in srgb, var(--color-text-1) 3%, transparent)', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }
const chainRowStyle: React.CSSProperties = { display: 'flex', gap: 10, padding: 10, borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', alignItems: 'flex-start' }
const chainBadgeStyle: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.5, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)', color: 'rgb(3,105,161)', textTransform: 'uppercase', flexShrink: 0, marginTop: 1 }
