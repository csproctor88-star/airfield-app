'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { DEMO_CHECKS, DEMO_CHECK_COMMENTS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchCheck, fetchCheckComments, addCheckComment, fetchCheckPhotos, uploadCheckPhoto, deleteCheck, type CheckRow, type CheckCommentRow, type CheckPhotoRow } from '@/lib/supabase/checks'
import { PhotoViewerModal } from '@/components/discrepancies/modals'
import { useInstallation } from '@/lib/installation-context'
import { ActionButton } from '@/components/ui/button'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'

export default function CheckDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [liveData, setLiveData] = useState<CheckRow | null>(null)
  const [comments, setComments] = useState<CheckCommentRow[]>([])
  const [dbPhotos, setDbPhotos] = useState<CheckPhotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [remarkText, setRemarkText] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState('Inspector')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)
  const { currentInstallation, userRole, defaultPdfEmail } = useInstallation()
  const isAdmin = userRole === 'base_admin' || userRole === 'sys_admin'

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) { setCurrentUser('Demo User'); return }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('name, rank, first_name, last_name').eq('id', user.id).single()
      if (profile?.first_name && profile?.last_name) {
        const displayName = `${profile.first_name} ${profile.last_name}`
        setCurrentUser(profile.rank ? `${profile.rank} ${displayName}` : displayName)
      } else if (profile?.name) {
        setCurrentUser(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
      } else if (user.user_metadata?.name) {
        setCurrentUser(user.user_metadata.name)
      } else if (user.email) {
        setCurrentUser(user.email.split('@')[0])
      }
    })
  }, [])

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
        user_name: currentUser,
        created_at: new Date().toISOString(),
      }
      setComments((prev) => [...prev, newComment])
      setRemarkText('')
      setSavingRemark(false)
      toast.success('Remark added')
      return
    }

    if (!liveData) return

    const { error } = await addCheckComment(liveData.id, remarkText.trim(), currentUser)
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
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
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
      <div className="page-container">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Check not found</div>
      </div>
    )
  }

  // Build photo gallery from DB-stored photos
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const getPhotoUrl = (p: CheckPhotoRow) =>
    p.storage_path.startsWith('data:')
      ? p.storage_path
      : supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/photos/${p.storage_path}`
        : p.storage_path
  const allPhotos: { url: string; name: string }[] = dbPhotos.map((p) => ({
    url: getPhotoUrl(p),
    name: p.file_name,
  }))
  // Group photos by issue index for per-issue display
  const photosByIssue: Record<number, { url: string; name: string; globalIdx: number }[]> = {}
  const unlinkedPhotos: { url: string; name: string; globalIdx: number }[] = []
  dbPhotos.forEach((p, i) => {
    const entry = { url: getPhotoUrl(p), name: p.file_name, globalIdx: i }
    if (p.issue_index != null) {
      if (!photosByIssue[p.issue_index]) photosByIssue[p.issue_index] = []
      photosByIssue[p.issue_index].push(entry)
    } else {
      unlinkedPhotos.push(entry)
    }
  })

  // Generate static map image URL from stored coordinates
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const checkLat = check.latitude != null ? Number(check.latitude) : null
  const checkLng = check.longitude != null ? Number(check.longitude) : null
  const staticMapUrl = checkLat != null && checkLng != null && mapboxToken && mapboxToken !== 'your-mapbox-token-here'
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+22d3ee(${checkLng},${checkLat})/${checkLng},${checkLat},15,0/600x300@2x?access_token=${mapboxToken}`
    : null

  const typeConfig = CHECK_TYPE_CONFIG[check.check_type as keyof typeof CHECK_TYPE_CONFIG]
  const data = (check.data || {}) as Record<string, unknown>
  const completedBy = String(check.completed_by || 'Unknown')
  const completedAt = check.completed_at ? String(check.completed_at) : null
  const displayId = String(check.display_id)
  const checkAreas: string[] = Array.isArray(check.areas) ? check.areas.map(String) : []
  const checkTypeStr = String(check.check_type)

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <Link
          href="/checks/history"
          style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}
        >
          All History
        </Link>
      </div>

      {/* Check Summary Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
            {displayId}
          </span>
          <Badge label="COMPLETED" color="#22C55E" />
        </div>

        {/* Check Type */}
        {typeConfig && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 'var(--fs-4xl)' }}>{typeConfig.icon}</span>
            <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: typeConfig.color }}>{typeConfig.label}</span>
          </div>
        )}

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 'var(--fs-base)', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Completed By</div>
            <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--color-accent)' }}>{completedBy}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Completed At</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>
              {completedAt
                ? `${new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Areas */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Areas Checked</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {checkAreas.map((area) => (
              <Badge key={area} label={area} color="#22D3EE" />
            ))}
          </div>
        </div>

        {/* Type-Specific Details */}
        {checkTypeStr === 'rsc' && !!data.condition && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Runway Surface Condition</div>
            <Badge
              label={data.condition as string}
              color={(data.condition as string) === 'Dry' ? '#22C55E' : '#3B82F6'}
            />
          </div>
        )}

        {checkTypeStr === 'rcr' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>RCR Value</div>
              <div style={{ fontSize: 'var(--fs-5xl)', fontWeight: 800, fontFamily: 'monospace', color: 'var(--color-cyan)', marginTop: 2 }}>{(data.rcr_value as string) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Condition</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{(data.condition_type as string) || '—'}</div>
            </div>
          </div>
        )}

        {checkTypeStr === 'bash' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Condition Code</div>
              {!!data.condition_code && (
                <Badge
                  label={data.condition_code as string}
                  color={
                    data.condition_code === 'LOW' ? '#22C55E'
                    : data.condition_code === 'MODERATE' ? '#EAB308'
                    : data.condition_code === 'PROHIBITED' ? '#DC2626'
                    : '#EF4444'
                  }
                />
              )}
            </div>
            {!!data.species_observed && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Species Observed</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{data.species_observed as string}</div>
              </div>
            )}
          </>
        )}

        {(checkTypeStr === 'ife' || checkTypeStr === 'ground_emergency') && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              {!!data.aircraft_type && (
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Aircraft Type</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{data.aircraft_type as string}</div>
                </div>
              )}
              {!!data.callsign && (
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Callsign</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{data.callsign as string}</div>
                </div>
              )}
            </div>
            {!!data.nature && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Nature of Emergency</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{data.nature as string}</div>
              </div>
            )}
            {Array.isArray(data.actions) && (data.actions as string[]).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Actions Completed</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(data.actions as string[]).map((action, i) => (
                    <div key={i} style={{ fontSize: 'var(--fs-sm)', color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✓</span> {action}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(data.agencies_notified) && (data.agencies_notified as string[]).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Agencies Notified</div>
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
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Aircraft Type / MDS</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: '#8B5CF6' }}>{data.aircraft_type as string}</div>
          </div>
        )}
      </div>

      {/* Remarks Section */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
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
              background: remarkText.trim() ? 'var(--color-cyan)' : 'var(--color-bg-elevated)',
              color: remarkText.trim() ? 'var(--color-bg-surface-solid)' : 'var(--color-text-4)',
              fontSize: 'var(--fs-base)', fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', alignSelf: 'flex-end', height: 36,
            }}
          >
            {savingRemark ? '...' : 'Save'}
          </button>
        </div>

        {/* Comments Timeline */}
        {displayComments.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-bg-elevated)', paddingTop: 10 }}>
            {displayComments.map((c) => (
              <div key={c.id} style={{ borderLeft: '2px solid var(--color-text-4)', paddingLeft: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{c.user_name}</span>
                  {' — '}
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}
                  {new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{c.comment}</div>
              </div>
            ))}
          </div>
        )}

        {displayComments.length === 0 && (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>No remarks yet.</div>
        )}
      </div>

      {/* Multi-issue display (new format) or legacy pinned location */}
      {Array.isArray((data as Record<string, unknown>).issues) && ((data as Record<string, unknown>).issues as { comment: string; location: { lat: number; lon: number } | null }[]).length > 0 ? (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Issues Found ({((data as Record<string, unknown>).issues as { comment: string; location: { lat: number; lon: number } | null }[]).length})
          </div>
          {((data as Record<string, unknown>).issues as { comment: string; location: { lat: number; lon: number } | null }[]).map((issue, idx) => {
            const issueMapUrl = issue.location && mapboxToken && mapboxToken !== 'your-mapbox-token-here'
              ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${issue.location.lon},${issue.location.lat})/${issue.location.lon},${issue.location.lat},15,0/600x300@2x?access_token=${mapboxToken}`
              : null
            return (
              <div key={idx} style={{
                padding: '10px 12px', marginBottom: 8,
                background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)',
                borderRadius: 8,
              }}>
                {((data as Record<string, unknown>).issues as unknown[]).length > 1 && (
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>
                    Issue {idx + 1} of {((data as Record<string, unknown>).issues as unknown[]).length}
                  </div>
                )}
                {issue.comment && (
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4, marginBottom: 4 }}>
                    {issue.comment}
                  </div>
                )}
                {issueMapUrl && (
                  <img src={issueMapUrl} alt={`Issue ${idx + 1} location`}
                    style={{ width: '100%', display: 'block', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }} />
                )}
                {issue.location && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: '#34D399', fontFamily: 'monospace', fontWeight: 600, marginBottom: (photosByIssue[idx]?.length > 0) ? 8 : 0 }}>
                    {issue.location.lat.toFixed(5)}, {issue.location.lon.toFixed(5)}
                  </div>
                )}
                {photosByIssue[idx]?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {photosByIssue[idx].map((p) => (
                      <div
                        key={p.globalIdx}
                        style={{ position: 'relative', width: 100, height: 100, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                        onClick={() => setViewerIndex(p.globalIdx)}
                      >
                        <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : staticMapUrl && (
        <div className="card" style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Pinned Location
          </div>
          <img
            src={staticMapUrl}
            alt="Check location on map"
            style={{ width: '100%', display: 'block', borderRadius: '0 0 10px 10px' }}
          />
          <div style={{ padding: '4px 12px 8px', fontSize: 'var(--fs-sm)', color: '#34D399', fontFamily: 'monospace', fontWeight: 600 }}>
            {checkLat!.toFixed(5)}, {checkLng!.toFixed(5)}
          </div>
        </div>
      )}

      {/* Photo Thumbnails — only show photos not linked to a specific issue */}
      {unlinkedPhotos.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos ({unlinkedPhotos.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {unlinkedPhotos.map((p) => (
              <div
                key={p.globalIdx}
                style={{ position: 'relative', width: 140, height: 140, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-active)', cursor: 'pointer' }}
                onClick={() => setViewerIndex(p.globalIdx)}
              >
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Photo Button */}
      {!usingDemo && (
        <div style={{ marginBottom: 8 }}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            onCapture={() => cameraInputRef.current?.click()}
            disabled={uploading}
            label={uploading ? 'Uploading...' : undefined}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={async () => {
            setGeneratingPdf(true)
            try {
              const photoDataUrls: string[] = []
              const photoDataUrlsByIssue: Record<number, string[]> = {}
              for (let i = 0; i < dbPhotos.length; i++) {
                const p = dbPhotos[i]
                const url = getPhotoUrl(p)
                let dataUrl: string | null = null
                if (url.startsWith('data:')) {
                  dataUrl = url
                } else {
                  try {
                    const resp = await fetch(url)
                    if (resp.ok) {
                      const blob = await resp.blob()
                      const reader = new FileReader()
                      dataUrl = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                      })
                    }
                  } catch { /* skip failed photos */ }
                }
                if (dataUrl) {
                  photoDataUrls.push(dataUrl)
                  if (p.issue_index != null) {
                    if (!photoDataUrlsByIssue[p.issue_index]) photoDataUrlsByIssue[p.issue_index] = []
                    photoDataUrlsByIssue[p.issue_index].push(dataUrl)
                  }
                }
              }
              const { generateCheckPdf } = await import('@/lib/check-pdf')
              const { doc, filename } = await generateCheckPdf({
                check,
                comments: displayComments,
                photoDataUrls,
                photoDataUrlsByIssue,
                baseName: currentInstallation?.name,
                baseIcao: currentInstallation?.icao,
              })
              doc.save(filename)
              toast.success('PDF generated')
            } catch (e) {
              console.error('PDF export failed:', e)
              toast.error('Failed to generate PDF')
            }
            setGeneratingPdf(false)
          }}
          disabled={generatingPdf}
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#A78BFA14', border: '1px solid #A78BFA33',
            color: '#A78BFA', fontSize: 'var(--fs-md)', fontWeight: 700,
            fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
            opacity: generatingPdf ? 0.7 : 1,
          }}
        >
          {generatingPdf ? 'Generating...' : 'Export PDF'}
        </button>
        <button
          type="button"
          onClick={async () => {
            setGeneratingPdf(true)
            try {
              const photoDataUrls: string[] = []
              const photoDataUrlsByIssue: Record<number, string[]> = {}
              for (let i = 0; i < dbPhotos.length; i++) {
                const p = dbPhotos[i]
                const url = getPhotoUrl(p)
                let dataUrl: string | null = null
                if (url.startsWith('data:')) {
                  dataUrl = url
                } else {
                  try {
                    const resp = await fetch(url)
                    if (resp.ok) {
                      const blob = await resp.blob()
                      const reader = new FileReader()
                      dataUrl = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                      })
                    }
                  } catch { /* skip failed photos */ }
                }
                if (dataUrl) {
                  photoDataUrls.push(dataUrl)
                  if (p.issue_index != null) {
                    if (!photoDataUrlsByIssue[p.issue_index]) photoDataUrlsByIssue[p.issue_index] = []
                    photoDataUrlsByIssue[p.issue_index].push(dataUrl)
                  }
                }
              }
              const { generateCheckPdf } = await import('@/lib/check-pdf')
              const result = await generateCheckPdf({
                check,
                comments: displayComments,
                photoDataUrls,
                photoDataUrlsByIssue,
                baseName: currentInstallation?.name,
                baseIcao: currentInstallation?.icao,
              })
              setEmailPdfData(result)
              setEmailModalOpen(true)
            } catch (e) {
              console.error('PDF generation failed:', e)
              toast.error('Failed to generate PDF')
            }
            setGeneratingPdf(false)
          }}
          disabled={generatingPdf}
          style={{
            padding: '12px 16px', borderRadius: 10, textAlign: 'center',
            background: '#A78BFA14', border: '1px solid #A78BFA33',
            color: '#A78BFA', fontSize: 'var(--fs-md)', fontWeight: 700,
            fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
            opacity: generatingPdf ? 0.7 : 1,
          }}
          title="Email PDF"
        >
          ✉
        </button>
        <Link
          href="/checks"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, textAlign: 'center',
            background: '#22C55E14', border: '1px solid #22C55E33',
            color: '#22C55E', fontSize: 'var(--fs-md)', fontWeight: 700,
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
            color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          View History
        </Link>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 8, display: 'flex', gap: 8 }}>
          <ActionButton
            color="#EF4444"
            onClick={async () => {
              if (usingDemo) {
                toast.success('Check deleted (demo mode)')
                router.push('/checks')
                return
              }
              if (!confirm('Delete this check? This cannot be undone.')) return
              setActionLoading(true)
              const { error } = await deleteCheck(check.id)
              if (error) {
                toast.error(error)
                setActionLoading(false)
              } else {
                toast.success('Check deleted')
                router.push('/checks')
              }
            }}
            disabled={actionLoading}
          >
            Delete Record
          </ActionButton>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewerIndex !== null && allPhotos.length > 0 && (
        <PhotoViewerModal photos={allPhotos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={async (email: string) => {
          if (!emailPdfData) return
          setSendingEmail(true)
          const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `Check Report: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`)
          if (result.success) {
            toast.success('Email sent successfully')
            setEmailModalOpen(false)
            setEmailPdfData(null)
          } else {
            toast.error(result.error || 'Failed to send email')
          }
          setSendingEmail(false)
        }}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
