'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function AutoSavePill({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: SaveStatus
  lastSavedAt: number | null
  onRetry?: () => void
}) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!lastSavedAt) return
    const id = window.setInterval(() => setTick(t => t + 1), 5000)
    return () => window.clearInterval(id)
  }, [lastSavedAt])

  // Reference tick so React keeps re-rendering as time passes — value is unused
  // directly because we re-derive ago text from Date.now() every render.
  void tick

  if (status === 'saving') {
    return (
      <span style={pillStyle('var(--color-cyan)')} data-tour="autosave-pill">
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        Saving…
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span style={pillStyle('var(--color-danger)')} data-tour="autosave-pill">
        <AlertTriangle size={12} />
        Save failed
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginLeft: 6,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Retry</button>
        )}
      </span>
    )
  }

  if (!lastSavedAt) {
    return (
      <span style={pillStyle('var(--color-text-3)')} data-tour="autosave-pill">
        No changes yet
      </span>
    )
  }

  const elapsed = Math.max(0, Date.now() - lastSavedAt)
  const isFresh = elapsed < 30_000
  const ago = formatAgo(elapsed)
  return (
    <span
      style={pillStyle(isFresh ? 'var(--color-success)' : 'var(--color-text-3)')}
      data-tour="autosave-pill"
    >
      <Check size={12} />
      {isFresh ? `Auto-saved ${ago}` : `All changes saved (${ago})`}
    </span>
  )
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    color,
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    fontFamily: 'inherit',
  }
}

function formatAgo(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}
