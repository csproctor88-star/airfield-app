'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  WRITE_COMMITTED_EVENT,
  getWriteQueue,
} from '@/lib/sync/write-queue'
import type { QueuedWrite, QueueStatus, WriteType } from '@/lib/sync/types'

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
  photo_upload: 'Photo upload',
  airfield_status_update: 'Airfield status update',
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

export function QueueInspector({ open, onClose }: QueueInspectorProps) {
  const [items, setItems] = useState<QueuedWrite[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const all = await getWriteQueue().list()
      // Sort newest-first so the just-queued item is at the top.
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setItems(all)
    } catch {
      // IDB may be unavailable — leave list empty.
      setItems([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()

    const onCommit = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const interval = window.setInterval(refresh, 2000)
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [open, refresh])

  const handleRetry = useCallback(
    async (item: QueuedWrite) => {
      setBusyId(item.id)
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
        setBusyId(null)
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
      setBusyId(item.id)
      try {
        await getWriteQueue().discard(item.id)
        await refresh()
      } finally {
        setBusyId(null)
      }
    },
    [refresh],
  )

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
            Pending writes
            {items.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 'var(--fs-sm, 13px)',
                  color: 'var(--color-text-3, #888)',
                  fontWeight: 500,
                }}
              >
                ({items.length})
              </span>
            )}
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

        {items.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--color-text-3, #888)',
              fontSize: 'var(--fs-sm, 13px)',
            }}
          >
            No pending writes. All submissions are synced.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {items.map((item) => {
              const status = STATUS_COLORS[item.status]
              const busy = busyId === item.id
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
        )}
      </div>
    </div>
  )
}
