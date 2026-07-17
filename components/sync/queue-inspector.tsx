'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  WRITE_COMMITTED_EVENT,
  getWriteQueue,
} from '@/lib/sync/write-queue'
import type { QueuedWrite, QueueStatus, WriteType } from '@/lib/sync/types'
import {
  PENDING_PHOTOS_CHANGED_EVENT,
  deletePendingPhoto,
  listPendingPhotosForCurrentUser,
  type PendingPhoto,
} from '@/lib/sync/pending-photos'
import { uploadInspectionPhoto } from '@/lib/supabase/inspections'
import { uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'

interface QueueInspectorProps {
  open: boolean
  onClose: () => void
}

const TYPE_LABELS: Record<WriteType, string> = {
  inspection_file: 'Inspection file',
  check_file: 'Check submit',
  acsi_submit: 'ACSI submit',
  discrepancy_create: 'Discrepancy create',
  discrepancy_update: 'Discrepancy update',
  notam_create: 'NOTAM create',
  waiver_create: 'Waiver create',
  waiver_update: 'Waiver update',
  daily_review_sign: 'Daily review sign',
  flip_review_sign: 'FLIP review sign',
  photo_upload: 'Photo upload',
  airfield_status_update: 'Airfield status update',
  navaid_status_update: 'NAVAID board status',
  infrastructure_feature_status_update: 'NAVAID status update',
  outage_event_create: 'Outage event',
  activity_log_insert: 'Events log entry',
  inspection_save_draft: 'Inspection draft',
  dashboard_board_update: 'Dashboard layout save',
  wildlife_sighting_create: 'Wildlife sighting',
  fpr_save: 'FPR check save',
  driving_check_save: 'Driving spot check save',
  driving_check_update: 'Driving spot check update',
}

const STATUS_COLORS: Record<QueueStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: 'rgba(217,119,6,0.15)', fg: 'var(--color-warning, #D97706)', label: 'Pending' },
  failed: { bg: 'rgba(220,38,38,0.15)', fg: 'var(--color-danger, #DC2626)', label: 'Failed' },
  conflict: { bg: 'rgba(168,85,247,0.15)', fg: '#A855F7', label: 'Conflict' },
}

function formatAge(iso: string, now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/** Dispatch a single PendingPhoto to the right CRUD module by entityType. */
async function uploadPendingPhoto(photo: PendingPhoto): Promise<{ ok: boolean; error?: string }> {
  // The Blob came back from IndexedDB; rewrap as a File so existing
  // CRUD modules that introspect file.name see the original filename.
  const file = new File([photo.blob], photo.filename, { type: photo.mime })
  if (photo.entityType === 'inspection') {
    const { data, error } = await uploadInspectionPhoto(
      photo.entityId,
      file,
      photo.itemId ?? null,
      photo.latitude ?? null,
      photo.longitude ?? null,
      photo.baseId ?? null,
      photo.issueIndex ?? null,
    )
    if (error || !data) return { ok: false, error: error ?? 'Upload failed' }
    return { ok: true }
  }
  if (photo.entityType === 'discrepancy') {
    const { data, error } = await uploadDiscrepancyPhoto(
      photo.entityId,
      file,
      photo.baseId ?? null,
    )
    if (error || !data) return { ok: false, error: error ?? 'Upload failed' }
    return { ok: true }
  }
  // Other entityTypes will land later (check / acsi / wildlife / parking).
  return { ok: false, error: `Upload not yet wired for ${photo.entityType}` }
}

interface PhotoRowProps {
  photo: PendingPhoto
  busy: boolean
  onUpload: (photo: PendingPhoto) => void
  onDiscard: (photo: PendingPhoto) => void
}

/**
 * Per-photo row. Manages its own object URL so the parent doesn't have
 * to track URLs across renders / removals.
 */
function PhotoRow({ photo, busy, onUpload, onDiscard }: PhotoRowProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(photo.blob)
    setThumbUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo.blob])

  const sizeKb = Math.round(photo.blob.size / 1024)

  return (
    <div
      style={{
        border: '1px solid var(--color-border-mid, #333)',
        borderRadius: 'var(--radius-md)',
        padding: 8,
        background: 'var(--color-bg-surface, rgba(255,255,255,0.02))',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={photo.filename}
          style={{
            width: 56,
            height: 56,
            objectFit: 'cover',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-mid, #333)',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--fs-xs, 12px)',
            color: 'var(--color-text-1, #fff)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {photo.filename}
        </div>
        <div
          style={{
            fontSize: 'var(--fs-2xs, 11px)',
            color: 'var(--color-text-3, #888)',
            marginTop: 2,
          }}
        >
          {formatAge(photo.createdAt)} · {sizeKb} KB
          {photo.itemId && ` · ${photo.itemId}`}
          {typeof photo.issueIndex === 'number' && ` · disc #${photo.issueIndex + 1}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onUpload(photo)}
          disabled={busy}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-accent, #38BDF8)',
            background: 'transparent',
            color: 'var(--color-accent, #38BDF8)',
            fontWeight: 600,
            fontSize: 'var(--fs-2xs, 11px)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => onDiscard(photo)}
          disabled={busy}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-danger, #DC2626)',
            background: 'transparent',
            color: 'var(--color-danger, #DC2626)',
            fontWeight: 600,
            fontSize: 'var(--fs-2xs, 11px)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Discard
        </button>
      </div>
    </div>
  )
}

export function QueueInspector({ open, onClose }: QueueInspectorProps) {
  const [items, setItems] = useState<QueuedWrite[]>([])
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [busyWriteId, setBusyWriteId] = useState<string | null>(null)
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null)
  const [uploadingAll, setUploadingAll] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [allWrites, allPhotos] = await Promise.all([
        getWriteQueue().list(),
        listPendingPhotosForCurrentUser(),
      ])
      allWrites.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      allPhotos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setItems(allWrites)
      setPhotos(allPhotos)
    } catch {
      setItems([])
      setPhotos([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()

    const onChange = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const interval = window.setInterval(refresh, 2000)
    window.addEventListener(WRITE_COMMITTED_EVENT, onChange)
    window.addEventListener(PENDING_PHOTOS_CHANGED_EVENT, onChange)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener(WRITE_COMMITTED_EVENT, onChange)
      window.removeEventListener(PENDING_PHOTOS_CHANGED_EVENT, onChange)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [open, refresh])

  const handleRetry = useCallback(
    async (item: QueuedWrite) => {
      setBusyWriteId(item.id)
      try {
        const queue = getWriteQueue()
        await queue.resetForRetry(item.id)
        const summary = await queue.drain()
        await refresh()
        if (summary.committed > 0) {
          toast.success(`${TYPE_LABELS[item.type] || item.type} synced.`)
        } else if (summary.retried > 0) {
          toast.message('Retry queued — will try again on next reconnect.')
        } else if (summary.failed > 0 || summary.conflict > 0) {
          toast.error('Retry failed. Check the error message.')
        }
      } catch (err) {
        toast.error(`Retry failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setBusyWriteId(null)
      }
    },
    [refresh],
  )

  const handleDiscard = useCallback(
    async (item: QueuedWrite) => {
      const ok = window.confirm(
        `Discard this ${TYPE_LABELS[item.type] || item.type}? The submission will not be recovered.`,
      )
      if (!ok) return
      setBusyWriteId(item.id)
      try {
        await getWriteQueue().discard(item.id)
        await refresh()
      } finally {
        setBusyWriteId(null)
      }
    },
    [refresh],
  )

  const handlePhotoUpload = useCallback(
    async (photo: PendingPhoto) => {
      setBusyPhotoId(photo.id)
      try {
        const result = await uploadPendingPhoto(photo)
        if (result.ok) {
          await deletePendingPhoto(photo.id)
          toast.success('Photo uploaded.')
        } else {
          toast.error(result.error || 'Upload failed')
        }
        await refresh()
      } catch (err) {
        toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setBusyPhotoId(null)
      }
    },
    [refresh],
  )

  const handlePhotoDiscard = useCallback(
    async (photo: PendingPhoto) => {
      const ok = window.confirm(
        `Discard ${photo.filename}? The photo will be deleted from this device.`,
      )
      if (!ok) return
      setBusyPhotoId(photo.id)
      try {
        await deletePendingPhoto(photo.id)
        await refresh()
      } finally {
        setBusyPhotoId(null)
      }
    },
    [refresh],
  )

  const handleUploadAll = useCallback(async () => {
    if (photos.length === 0) return
    setUploadingAll(true)
    let ok = 0
    let failed = 0
    for (const photo of photos) {
      const result = await uploadPendingPhoto(photo)
      if (result.ok) {
        await deletePendingPhoto(photo.id)
        ok++
      } else {
        failed++
      }
    }
    await refresh()
    setUploadingAll(false)
    if (failed === 0) {
      toast.success(`Uploaded ${ok} photo${ok === 1 ? '' : 's'}.`)
    } else {
      toast.error(`Uploaded ${ok} of ${ok + failed}; ${failed} failed.`)
    }
  }, [photos, refresh])

  const totalCount = items.length + photos.length
  const titleSuffix = useMemo(() => {
    const parts: string[] = []
    if (items.length > 0) parts.push(`${items.length} write${items.length === 1 ? '' : 's'}`)
    if (photos.length > 0) parts.push(`${photos.length} photo${photos.length === 1 ? '' : 's'}`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }, [items.length, photos.length])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface-solid, #1a1a2e)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          padding: 20,
          border: '1px solid var(--color-border-mid, #333)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 'var(--fs-xl, 18px)',
              fontWeight: 800,
              color: 'var(--color-text-1, #fff)',
            }}
          >
            Pending sync
            <span
              style={{
                marginLeft: 8,
                fontSize: 'var(--fs-sm, 13px)',
                color: 'var(--color-text-3, #888)',
                fontWeight: 500,
              }}
            >
              {titleSuffix}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-3, #888)',
              fontSize: 'var(--fs-3xl, 28px)',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {totalCount === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--color-text-3, #888)',
                fontSize: 'var(--fs-sm, 13px)',
              }}
            >
              All caught up. No pending writes or photos.
            </div>
          ) : (
            <>
              {items.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 'var(--fs-2xs, 11px)',
                      fontWeight: 700,
                      color: 'var(--color-text-3, #888)',
                      letterSpacing: '0.08em',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Writes ({items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((item) => {
                      const status = STATUS_COLORS[item.status]
                      const busy = busyWriteId === item.id
                      return (
                        <div
                          key={item.id}
                          style={{
                            border: '1px solid var(--color-border-mid, #333)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            background: 'var(--color-bg-surface, rgba(255,255,255,0.02))',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                color: 'var(--color-text-1, #fff)',
                                fontSize: 'var(--fs-sm, 13px)',
                              }}
                            >
                              {TYPE_LABELS[item.type] || item.type}
                            </span>
                            <span
                              style={{
                                fontSize: 'var(--fs-2xs, 11px)',
                                fontWeight: 700,
                                color: status.fg,
                                background: status.bg,
                                padding: '2px 8px',
                                borderRadius: 4,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 12,
                              fontSize: 'var(--fs-2xs, 11px)',
                              color: 'var(--color-text-3, #888)',
                              marginBottom: item.lastError ? 6 : 0,
                            }}
                          >
                            <span>{formatAge(item.createdAt)}</span>
                            {item.attempts > 0 && (
                              <span>
                                {item.attempts} attempt{item.attempts === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          {item.lastError && (
                            <div
                              style={{
                                fontSize: 'var(--fs-xs, 12px)',
                                color: 'var(--color-text-2, #ccc)',
                                marginBottom: 8,
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.lastError}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => handleRetry(item)}
                              disabled={busy}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-accent, #38BDF8)',
                                background: 'transparent',
                                color: 'var(--color-accent, #38BDF8)',
                                fontWeight: 600,
                                fontSize: 'var(--fs-xs, 12px)',
                                cursor: busy ? 'default' : 'pointer',
                                opacity: busy ? 0.5 : 1,
                              }}
                            >
                              {busy ? 'Working…' : 'Retry now'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscard(item)}
                              disabled={busy}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-danger, #DC2626)',
                                background: 'transparent',
                                color: 'var(--color-danger, #DC2626)',
                                fontWeight: 600,
                                fontSize: 'var(--fs-xs, 12px)',
                                cursor: busy ? 'default' : 'pointer',
                                opacity: busy ? 0.5 : 1,
                              }}
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {photos.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--fs-2xs, 11px)',
                        fontWeight: 700,
                        color: 'var(--color-text-3, #888)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Photos waiting ({photos.length})
                    </div>
                    <button
                      type="button"
                      onClick={handleUploadAll}
                      disabled={uploadingAll || photos.length === 0}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-accent, #38BDF8)',
                        background: 'transparent',
                        color: 'var(--color-accent, #38BDF8)',
                        fontWeight: 600,
                        fontSize: 'var(--fs-2xs, 11px)',
                        cursor: uploadingAll ? 'default' : 'pointer',
                        opacity: uploadingAll ? 0.5 : 1,
                      }}
                    >
                      {uploadingAll ? 'Uploading…' : 'Upload all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {photos.map((photo) => (
                      <PhotoRow
                        key={photo.id}
                        photo={photo}
                        busy={busyPhotoId === photo.id || uploadingAll}
                        onUpload={handlePhotoUpload}
                        onDiscard={handlePhotoDiscard}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
