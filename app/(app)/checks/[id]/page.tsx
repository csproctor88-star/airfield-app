'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { DEMO_CHECKS, DEMO_CHECK_COMMENTS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchCheck, fetchCheckComments, addCheckComment, fetchCheckPhotos, uploadCheckPhoto, type CheckRow, type CheckCommentRow, type CheckPhotoRow } from '@/lib/supabase/checks'
import { PhotoViewerModal } from '@/components/discrepancies/modals'

const CURRENT_USER = 'MSgt Proctor'

export default function CheckDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [liveData, setLiveData] = useState<CheckRow | null>(null)
  const [comments, setComments] = useState<CheckCommentRow[]>([])
  const [dbPhotos, setDbPhotos] = useState<CheckPhotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [remarkText, setRemarkText] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }

    const data = await fetchCheck(params.id as string)
    setLiveData(data)

    if (data) {
      const c = await fetchCheckComments(data.id)
      setComments(c)
      const p = await fetchCheckPhotos(data.id)
      setDbPhotos(p)
    }

    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddRemark = async () => {
    if (!remarkText.trim()) return
    setSavingRemark(true)

    if (usingDemo) {
      // Demo mode — add locally
      const newComment: CheckCommentRow = {
        id: `demo-${Date.now()}`,
        check_id: params.id as string,
        comment: remarkText.trim(),
        user_name: CURRENT_USER,
        created_at: new Date().toISOString(),
      }
      setComments((prev) => [...prev, newComment])
      setRemarkText('')
      setSavingRemark(false)
      toast.success('Remark added')
      return
    }

    if (!liveData) return

    const { error } = await addCheckComment(liveData.id, remarkText.trim(), CURRENT_USER)
    if (error) {
      toast.error('Failed to save remark')
      setSavingRemark(false)
      return
    }

    // Refresh comments
    const freshComments = await fetchCheckComments(liveData.id)
    setComments(freshComments)
    setRemarkText('')
    setSavingRemark(false)
    toast.success('Remark added')
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !liveData) return

    setUploading(true)
    let uploaded = 0
    for (const file of Array.from(files)) {
      const { error } = await uploadCheckPhoto(liveData.id, file)
      if (!error) uploaded++
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} photo(s) uploaded`)
      const freshPhotos = await fetchCheckPhotos(liveData.id)
      setDbPhotos(freshPhotos)
      const freshCheck = await fetchCheck(liveData.id)
      if (freshCheck) setLiveData(freshCheck)
    }
    if (uploaded < files.length) {
      toast.error(`${files.length - uploaded} photo(s) failed to upload`)
    }

    setUploading(false)
    e.target.value = ''
  }

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading...</div>
      </div>
    )
  }

  // Resolve data — use explicit interface for rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check: any = usingDemo
    ? DEMO_CHECKS.find((x) => x.id === params.id) || null
    : liveData
  const displayComments = usingDemo
    ? [...DEMO_CHECK_COMMENTS.filter((c) => c.check_id === params.id), ...comments.filter(c => c.id.startsWith('demo-'))]
    : comments

  if (!check) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Check not found</div>
      </div>
    )
  }

  // Build photo gallery from DB-stored photos
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const allPhotos: { url: string; name: string }[] = dbPhotos.map((p) => ({
    url: p.storage_path.startsWith('data:')
      ? p.storage_path
      : supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/${p.storage_path}`
        : p.storage_path,
    name: p.file_name,
  }))

  const typeConfig = CHECK_TYPE_CONFIG[check.check_type as keyof typeof CHECK_TYPE_CONFIG]
  const data = (check.data || {}) as Record<string, unknown>
  const completedBy = String(check.completed_by || 'Unknown')
  const completedAt = check.completed_at ? String(check.completed_at) : null
  const displayId = String(check.display_id)
  const checkAreas: string[] = Array.isArray(check.areas) ? check.areas.map(String) : []
  const checkTypeStr = String(check.check_type)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <Link
          href="/checks/history"
          style={{ color: '#22D3EE', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
        >
          All History
        </Link>
      </div>

      {/* Check Summary Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>
            {displayId}
          </span>
          <Badge label="COMPLETED" color="#22C55E" />
        </div>

        {/* Check Type */}
        {typeConfig && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>{typeConfig.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: typeConfig.color }}>{typeConfig.label}</span>
          </div>
        )}

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Completed By</div>
            <div style={{ fontWeight: 600, marginTop: 2, color: '#38BDF8' }}>{completedBy}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Completed At</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>
              {completedAt
                ? `${new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Areas */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Areas Checked</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {checkAreas.map((area) => (
              <Badge key={area} label={area} color="#22D3EE" />
            ))}
          </div>
        </div>

        {/* Type-Specific Details */}
        {checkTypeStr === 'rsc' && !!data.condition && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Runway Surface Condition</div>
            <Badge
              label={data.condition as string}
              color={(data.condition as string) === 'Dry' ? '#22C55E' : '#3B82F6'}
            />
          </div>
        )}

        {checkTypeStr === 'rcr' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>RCR Value</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: '#22D3EE', marginTop: 2 }}>{(data.rcr_value as string) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Condition</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{(data.condition_type as string) || '—'}</div>
            </div>
          </div>
        )}

        {checkTypeStr === 'bash' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Condition Code</div>
              {!!data.condition_code && (
                <Badge
                  label={data.condition_code as string}
                  color={
                    data.condition_code === 'LOW' ? '#22C55E'
                    : data.condition_code === 'MODERATE' ? '#EAB308'
                    : '#EF4444'
                  }
                />
              )}
            </div>
            {!!data.species_observed && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Species Observed</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>{data.species_observed as string}</div>
              </div>
            )}
          </>
        )}

        {(checkTypeStr === 'ife' || checkTypeStr === 'ground_emergency') && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              {!!data.aircraft_type && (
                <div>
                  <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Aircraft Type</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{data.aircraft_type as string}</div>
                </div>
              )}
              {!!data.callsign && (
                <div>
                  <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Callsign</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{data.callsign as string}</div>
                </div>
              )}
            </div>
            {!!data.nature && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Nature of Emergency</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>{data.nature as string}</div>
              </div>
            )}
            {Array.isArray(data.actions) && (data.actions as string[]).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Actions Completed</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(data.actions as string[]).map((action, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✓</span> {action}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(data.agencies_notified) && (data.agencies_notified as string[]).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Agencies Notified</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(data.agencies_notified as string[]).map((agency, i) => (
                    <Badge key={i} label={agency} color="#38BDF8" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {checkTypeStr === 'heavy_aircraft' && !!data.aircraft_type && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Aircraft Type / MDS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6' }}>{data.aircraft_type as string}</div>
          </div>
        )}
      </div>

      {/* Photo Thumbnails */}
      {allPhotos.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos ({allPhotos.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allPhotos.map((p, i) => (
              <div
                key={i}
                style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833', cursor: 'pointer' }}
                onClick={() => setViewerIndex(i)}
              >
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Photo Button */}
      {!usingDemo && (
        <>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%', padding: 10, marginBottom: 8, borderRadius: 8,
              background: '#38BDF814', border: '1px solid #38BDF833', cursor: uploading ? 'default' : 'pointer',
              color: '#38BDF8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? '⏳ Uploading...' : `📸 Add Photo${allPhotos.length > 0 ? ` (${allPhotos.length})` : ''}`}
          </button>
        </>
      )}

      {/* Remarks Section */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Remarks
        </div>

        {/* Add Remark */}
        <div style={{ display: 'flex', gap: 6, marginBottom: displayComments.length > 0 ? 12 : 0 }}>
          <textarea
            className="input-dark"
            rows={2}
            placeholder="Add a follow-up remark..."
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAddRemark()
              }
            }}
            style={{ resize: 'vertical', flex: 1 }}
          />
          <button
            type="button"
            onClick={handleAddRemark}
            disabled={!remarkText.trim() || savingRemark}
            style={{
              padding: '0 14px', borderRadius: 8, border: 'none',
              background: remarkText.trim() ? '#22D3EE' : '#1E293B',
              color: remarkText.trim() ? '#0F172A' : '#334155',
              fontSize: 11, fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', alignSelf: 'flex-end', height: 36,
            }}
          >
            {savingRemark ? '...' : 'Save'}
          </button>
        </div>

        {/* Comments Timeline */}
        {displayComments.length > 0 && (
          <div style={{ borderTop: '1px solid #1E293B', paddingTop: 10 }}>
            {displayComments.map((c) => (
              <div key={c.id} style={{ borderLeft: '2px solid #334155', paddingLeft: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: '#38BDF8' }}>{c.user_name}</span>
                  {' — '}
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}
                  {new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>{c.comment}</div>
              </div>
            ))}
          </div>
        )}

        {displayComments.length === 0 && (
          <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No remarks yet.</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          href="/checks"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#22C55E14', border: '1px solid #22C55E33',
            color: '#22C55E', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          + New Check
        </Link>
        <Link
          href="/checks/history"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#22D3EE14', border: '1px solid #22D3EE33',
            color: '#22D3EE', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          View History
        </Link>
      </div>

      {/* Photo Viewer Modal */}
      {viewerIndex !== null && allPhotos.length > 0 && (
        <PhotoViewerModal photos={allPhotos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  )
}
