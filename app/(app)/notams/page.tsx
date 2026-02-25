'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DEMO_NOTAMS } from '@/lib/demo-data'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'

type FilterType = 'all' | 'faa' | 'local' | 'active' | 'expired'

interface Notam {
  id: string
  notam_number: string
  source: 'faa' | 'local'
  status: 'active' | 'expired'
  notam_type: string
  title: string
  full_text: string
  effective_start: string
  effective_end: string
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'faa', label: 'FAA' },
  { key: 'local', label: 'LOCAL' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
]

const SOURCE_COLORS: Record<string, string> = {
  faa: '#22D3EE',
  local: '#A78BFA',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  expired: '#64748B',
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotamsPage() {
  const router = useRouter()
  const { currentInstallation } = useInstallation()
  const [filter, setFilter] = useState<FilterType>('all')

  const isDemoMode = !createClient()
  const defaultIcao = currentInstallation?.icao || ''

  const [icaoInput, setIcaoInput] = useState('')
  const [activeIcao, setActiveIcao] = useState('')
  const [notams, setNotams] = useState<Notam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const initialFetchDone = useRef(false)

  // Set default ICAO once installation loads
  useEffect(() => {
    if (defaultIcao && !activeIcao && !initialFetchDone.current) {
      setIcaoInput(defaultIcao)
      setActiveIcao(defaultIcao)
    }
  }, [defaultIcao, activeIcao])

  const fetchNotams = useCallback(async (icao: string) => {
    if (!icao || isDemoMode) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`)
        setNotams([])
        return
      }

      setNotams(data.notams || [])
      setFetchedAt(data.fetchedAt || new Date().toISOString())
    } catch {
      setError('Network error — could not reach the server.')
      setNotams([])
    } finally {
      setLoading(false)
      initialFetchDone.current = true
    }
  }, [isDemoMode])

  // Auto-fetch when activeIcao changes
  useEffect(() => {
    if (activeIcao) {
      fetchNotams(activeIcao)
    }
  }, [activeIcao, fetchNotams])

  const handleSearch = () => {
    const cleaned = icaoInput.trim().toUpperCase()
    if (cleaned && cleaned !== activeIcao) {
      setActiveIcao(cleaned)
    } else if (cleaned === activeIcao) {
      fetchNotams(cleaned)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // In demo mode, use demo data; in live mode, use fetched data
  const displayNotams: Notam[] = isDemoMode ? DEMO_NOTAMS : notams

  const filtered = displayNotams.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'faa') return n.source === 'faa'
    if (filter === 'local') return n.source === 'local'
    if (filter === 'active') return n.status === 'active'
    if (filter === 'expired') return n.status === 'expired'
    return true
  })

  const feedConnected = !isDemoMode && !error && notams.length > 0

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>NOTAMs</div>
        <button
          onClick={() => router.push('/notams/new')}
          style={{
            background: 'linear-gradient(135deg, var(--color-accent-secondary), var(--color-cyan))',
            border: 'none',
            color: '#FFF',
            fontSize: 13,
            fontWeight: 700,
            padding: '7px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Draft
        </button>
      </div>

      {/* ICAO search bar */}
      {!isDemoMode && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <input
            type="text"
            value={icaoInput}
            onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="ICAO code (e.g. KSEM)"
            maxLength={4}
            style={{
              flex: 1,
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: 'var(--color-text-1)',
              letterSpacing: '0.05em',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-text-4)',
              color: 'var(--color-text-1)',
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Search
          </button>
        </div>
      )}

      {/* FAA Feed status card */}
      <div
        style={{
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-bg-elevated)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: feedConnected ? '#22C55E' : error ? '#EF4444' : '#64748B',
              boxShadow: feedConnected
                ? '0 0 6px rgba(34,197,94,0.5)'
                : error
                  ? '0 0 6px rgba(239,68,68,0.5)'
                  : 'none',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
            {isDemoMode
              ? 'Demo Mode'
              : feedConnected
                ? `FAA Feed — ${activeIcao}`
                : error
                  ? 'FAA Feed Error'
                  : loading
                    ? 'Connecting...'
                    : 'FAA Feed'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fetchedAt && !isDemoMode && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
              Last: {formatTime(fetchedAt)}
            </span>
          )}
          {!isDemoMode && (
            <button
              onClick={() => activeIcao && fetchNotams(activeIcao)}
              disabled={loading || !activeIcao}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-3)',
                fontSize: 16,
                cursor: loading || !activeIcao ? 'not-allowed' : 'pointer',
                padding: '0 4px',
                opacity: loading ? 0.4 : 1,
                transition: 'transform 0.3s',
                transform: loading ? 'rotate(360deg)' : 'none',
              }}
              title="Refresh"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && !isDemoMode && (
        <div
          style={{
            background: '#EF444415',
            border: '1px solid #EF444440',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 13,
            color: '#F87171',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              background: filter === f.key ? 'var(--color-bg-elevated)' : 'transparent',
              border: `1px solid ${filter === f.key ? 'var(--color-text-4)' : 'var(--color-bg-elevated)'}`,
              color: filter === f.key ? 'var(--color-text-1)' : 'var(--color-text-3)',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: 'var(--color-text-3)',
            fontSize: 13,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--color-bg-elevated)',
              borderTop: '2px solid var(--color-text-2)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 8px',
            }}
          />
          Fetching NOTAMs for {activeIcao}...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* NOTAM cards */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((notam) => {
            const isExpired = notam.status === 'expired'
            const borderLeftColor = SOURCE_COLORS[notam.source] || 'var(--color-text-4)'

            return (
              <div
                key={notam.id}
                onClick={() => router.push(`/notams/${notam.id}`)}
                style={{
                  background: 'var(--color-bg-surface-solid)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderLeft: `3px solid ${borderLeftColor}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  opacity: isExpired ? 0.5 : 1,
                }}
              >
                {/* Top row: source + type badges, status badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge
                      label={notam.source.toUpperCase()}
                      color={SOURCE_COLORS[notam.source] || '#94A3B8'}
                    />
                    <Badge label={notam.notam_type} color="#94A3B8" />
                  </div>
                  <Badge
                    label={notam.status.toUpperCase()}
                    color={STATUS_COLORS[notam.status] || '#94A3B8'}
                  />
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-text-1)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {notam.title}
                </div>

                {/* NOTAM number + Effective dates */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {notam.notam_number && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                      {notam.notam_number}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    {formatDate(notam.effective_start)} — {formatDate(notam.effective_end)}
                  </span>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && !error && (
            <div
              style={{
                textAlign: 'center',
                padding: 24,
                color: 'var(--color-text-3)',
                fontSize: 13,
              }}
            >
              {!activeIcao && !isDemoMode
                ? 'Enter an ICAO code above to fetch NOTAMs.'
                : 'No NOTAMs match the selected filter.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
