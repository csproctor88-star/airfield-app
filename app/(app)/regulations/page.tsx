'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Search, ExternalLink, ChevronDown, ChevronUp, X, FileText, Upload, Trash2, Download, HardDrive, Star, Settings, Database, Plus, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ALL_REGULATIONS, type RegulationEntry } from '@/lib/regulations-data'
import { REGULATION_CATEGORIES, REGULATION_PUB_TYPES, REGULATION_SOURCE_SECTIONS, USER_ROLES } from '@/lib/constants'
import type { UserRole, RegulationPubType } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { userDocService, type UserDocument } from '@/lib/userDocuments'
import { idbGet, idbSet, idbGetAllKeys, idbDelete, STORE_BLOBS } from '@/lib/idb'

const RegulationPDFViewer = dynamic(
  () => import('@/components/RegulationPDFViewer'),
  { ssr: false },
)

// --- Helpers ---
function getCategoryConfig(categoryValue: string) {
  return REGULATION_CATEGORIES.find(c => c.value === categoryValue)
}

const REG_BUCKET = 'regulation-pdfs'

function sanitizeFileName(regId: string): string {
  return regId
    .toLowerCase()
    .replace(/,\s*/g, '-')
    .replace(/\.\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// --- Favorites persistence (localStorage) ---
const FAVORITES_KEY = 'aoms_reg_favorites'
const FAVORITES_DEFAULT_KEY = 'aoms_reg_favorites_default'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore */ }
  return new Set()
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favs)))
}

function loadFavoritesDefault(): boolean {
  try {
    return localStorage.getItem(FAVORITES_DEFAULT_KEY) === 'true'
  } catch { /* ignore */ }
  return false
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Tab = 'regulations' | 'my-docs'

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function RegulationsPage() {
  const [tab, setTab] = useState<Tab>('regulations')

  // ── PDF viewer state (shared by both tabs) ─────────────────
  const [viewingReg, setViewingReg] = useState<RegulationEntry | null>(null)
  const [viewingUserDoc, setViewingUserDoc] = useState<{ doc: UserDocument; userId: string } | null>(null)
  const closeViewer = useCallback(() => { setViewingReg(null); setViewingUserDoc(null) }, [])

  // PDF viewer overlay
  if (viewingReg) {
    return (
      <RegulationPDFViewer
        regId={viewingReg.reg_id}
        title={viewingReg.title}
        url={viewingReg.url}
        onClose={closeViewer}
      />
    )
  }
  if (viewingUserDoc) {
    return (
      <RegulationPDFViewer
        regId={viewingUserDoc.doc.file_name}
        title={viewingUserDoc.doc.display_name}
        url={null}
        onClose={closeViewer}
        source="user"
        userId={viewingUserDoc.userId}
        storedFileName={viewingUserDoc.doc.file_name}
      />
    )
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>References</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'regulations' as Tab, label: 'References' },
          { key: 'my-docs' as Tab, label: 'My Documents' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: tab === t.key
                ? 'linear-gradient(135deg, #0369A1, #0EA5E9)'
                : 'rgba(14,165,233,0.08)',
              border: tab === t.key
                ? '1px solid #0EA5E9'
                : '1px solid rgba(14,165,233,0.2)',
              borderRadius: 8,
              color: tab === t.key ? '#fff' : '#64748B',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'regulations' && (
        <RegulationsTab
          onViewReg={setViewingReg}
        />
      )}

      {tab === 'my-docs' && (
        <MyDocumentsTab
          onViewDoc={(doc, userId) => setViewingUserDoc({ doc, userId })}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Regulations Tab (existing functionality, extracted)
// ═══════════════════════════════════════════════════════════════

function RegulationsTab({ onViewReg }: { onViewReg: (reg: RegulationEntry) => void }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [pubTypeFilter, setPubTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => loadFavoritesDefault())
  const [showFavSettings, setShowFavSettings] = useState(false)

  // ── Admin state ───────────────────────────────────────────
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [dbRegs, setDbRegs] = useState<RegulationEntry[] | null>(null) // null = not loaded yet
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      if (!supabase) { setIsSysAdmin(true); return } // demo mode

      // Check admin role
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        const role = (profile?.role ?? 'observer') as UserRole
        setIsSysAdmin(role === 'sys_admin')
      } catch { /* ignore */ }

      // Fetch regulations from Supabase to pick up any DB-managed entries
      try {
        const { data } = await supabase
          .from('regulations')
          .select('reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags')
          .order('reg_id', { ascending: true })
        if (data && data.length > 0) {
          setDbRegs(data as RegulationEntry[])
        }
      } catch { /* fallback to static */ }
    }
    init()
  }, [])

  // Use Supabase data when available, otherwise fall back to static
  const regulations = useMemo(() => {
    if (dbRegs !== null) return dbRegs
    return ALL_REGULATIONS
  }, [dbRegs])

  const toggleFavorite = useCallback((regId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(regId)) next.delete(regId)
      else next.add(regId)
      saveFavorites(next)
      return next
    })
  }, [])

  const toggleFavDefault = useCallback(() => {
    setShowFavSettings(false)
    const next = !loadFavoritesDefault()
    localStorage.setItem(FAVORITES_DEFAULT_KEY, next ? 'true' : 'false')
  }, [])

  // --- Cache All state ---
  const [cacheProgress, setCacheProgress] = useState<{ done: number; total: number; errors: number } | null>(null)
  const [cachedCount, setCachedCount] = useState<number | null>(null)
  const cacheAbortRef = useRef(false)

  // Check how many are already cached on mount
  useEffect(() => {
    idbGetAllKeys(STORE_BLOBS).then(keys => {
      const keySet = new Set(keys.map(String))
      let count = 0
      for (const reg of regulations) {
        if (keySet.has(`${sanitizeFileName(reg.reg_id)}.pdf`)) count++
      }
      setCachedCount(count)
    }).catch(() => {})
  }, [cacheProgress, regulations])

  const handleCacheAll = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return
    cacheAbortRef.current = false

    // figure out which files still need caching
    const existingKeys = new Set((await idbGetAllKeys(STORE_BLOBS)).map(String))
    const uncached = regulations.filter(r => !existingKeys.has(`${sanitizeFileName(r.reg_id)}.pdf`))

    if (uncached.length === 0) {
      setCachedCount(regulations.length)
      return
    }

    const total = uncached.length
    let done = 0
    let errors = 0
    setCacheProgress({ done: 0, total, errors: 0 })

    for (const reg of uncached) {
      if (cacheAbortRef.current) break
      const fileName = `${sanitizeFileName(reg.reg_id)}.pdf`
      try {
        const { data, error } = await supabase.storage.from(REG_BUCKET).download(fileName)
        if (error || !data) {
          errors++
        } else {
          const buf = await data.arrayBuffer()
          await idbSet(STORE_BLOBS, fileName, buf)
        }
      } catch {
        errors++
      }
      done++
      setCacheProgress({ done, total, errors })
    }
    setCacheProgress(null)
  }, [])

  const [clearing, setClearing] = useState(false)

  const handleClearCache = useCallback(async () => {
    setClearing(true)
    try {
      const keys = await idbGetAllKeys(STORE_BLOBS)
      const regFileNames = new Set(
        regulations.map(r => `${sanitizeFileName(r.reg_id)}.pdf`)
      )
      for (const key of keys) {
        if (regFileNames.has(String(key))) {
          await idbDelete(STORE_BLOBS, String(key))
        }
      }
      setCachedCount(0)
    } catch { /* ignore */ }
    setClearing(false)
  }, [regulations])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return regulations.filter(r => {
      if (showFavoritesOnly && !favorites.has(r.reg_id)) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (pubTypeFilter !== 'all' && r.pub_type !== pubTypeFilter) return false
      if (!q) return true
      return (
        r.reg_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [search, categoryFilter, pubTypeFilter, showFavoritesOnly, favorites, regulations])

  // ── Delete reference (admin) ──────────────────────────────
  const handleDeleteRef = useCallback(async (regId: string) => {
    setDeletingRegId(regId)
    try {
      const supabase = createClient()
      if (supabase) {
        // Delete from Supabase regulations table
        await supabase.from('regulations').delete().eq('reg_id', regId)
        // Delete PDF from storage (best effort)
        const fileName = `${sanitizeFileName(regId)}.pdf`
        await supabase.storage.from(REG_BUCKET).remove([fileName])
        // Delete from IDB cache
        try { await idbDelete(STORE_BLOBS, fileName) } catch { /* ignore */ }
      }
      // Remove from whichever list is active
      setDbRegs(prev => prev ? prev.filter(r => r.reg_id !== regId) : prev)
      setConfirmDeleteId(null)
      setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete regulation:', err)
    } finally {
      setDeletingRegId(null)
    }
  }, [])

  // ── Add reference callback (from modal) ───────────────────
  const handleAddRef = useCallback((entry: RegulationEntry) => {
    setDbRegs(prev => prev ? [...prev, entry] : [entry])
    setShowAddModal(false)
  }, [])

  const hasActiveFilters = categoryFilter !== 'all' || pubTypeFilter !== 'all'

  return (
    <>
      {/* Search — prominent, takes former KPI space */}
      <div style={{
        background: 'rgba(10,16,28,0.92)',
        border: '1px solid rgba(56,189,248,0.06)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
      }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search
            size={16}
            color="#64748B"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search references, titles, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid #1E293B',
              borderRadius: 8,
              color: '#E2E8F0',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              }}
            >
              <X size={16} color="#64748B" />
            </button>
          )}
        </div>

        {/* Filter row: toggle + favorites + settings */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: hasActiveFilters ? 'rgba(34,211,238,0.08)' : 'transparent',
              border: `1px solid ${hasActiveFilters ? 'rgba(34,211,238,0.25)' : 'rgba(56,189,248,0.12)'}`,
              borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
              color: hasActiveFilters ? '#22D3EE' : '#94A3B8',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Filters {hasActiveFilters && '(active)'}
            {hasActiveFilters && (
              <span
                onClick={e => { e.stopPropagation(); setCategoryFilter('all'); setPubTypeFilter('all') }}
                style={{ marginLeft: 4, color: '#EF4444', cursor: 'pointer' }}
              >
                Clear
              </span>
            )}
          </button>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: showFavoritesOnly ? 'rgba(250,204,21,0.10)' : 'transparent',
              border: `1px solid ${showFavoritesOnly ? 'rgba(250,204,21,0.30)' : 'rgba(56,189,248,0.12)'}`,
              borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
              color: showFavoritesOnly ? '#FACC15' : '#94A3B8',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            <Star size={12} fill={showFavoritesOnly ? '#FACC15' : 'none'} />
            Favorites{favorites.size > 0 ? ` (${favorites.size})` : ''}
          </button>

          <button
            onClick={() => setShowFavSettings(!showFavSettings)}
            style={{
              display: 'flex', alignItems: 'center',
              background: 'transparent',
              border: '1px solid rgba(56,189,248,0.12)',
              borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
              color: '#64748B', fontFamily: 'inherit',
            }}
            title="Favorites settings"
          >
            <Settings size={12} />
          </button>
        </div>

        {/* Settings panel */}
        {showFavSettings && (
          <div style={{
            marginTop: 8, padding: '10px 10px',
            background: 'rgba(15,23,42,0.6)', borderRadius: 6,
            border: '1px solid rgba(56,189,248,0.06)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Favorites default toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                Show favorites by default
              </span>
              <button
                onClick={toggleFavDefault}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: loadFavoritesDefault() ? '#FACC15' : '#334155',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, width: 16, height: 16,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  left: loadFavoritesDefault() ? 18 : 2,
                }} />
              </button>
            </div>

            {/* Cache All */}
            <div style={{ borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                    Cache all references
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                    {cachedCount !== null
                      ? `${cachedCount} of ${regulations.length} cached for offline use`
                      : 'Download all PDFs for offline use'}
                  </div>
                </div>
                {cacheProgress ? (
                  <button
                    onClick={() => { cacheAbortRef.current = true }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'transparent',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                      color: '#F87171', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <X size={10} />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleCacheAll}
                    disabled={cachedCount === regulations.length}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: cachedCount === regulations.length
                        ? 'transparent' : 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                      border: cachedCount === regulations.length
                        ? '1px solid rgba(52,211,153,0.3)' : 'none',
                      borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                      color: cachedCount === regulations.length ? '#34D399' : '#fff',
                      fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      opacity: cachedCount === regulations.length ? 0.8 : 1,
                    }}
                  >
                    <Database size={10} />
                    {cachedCount === regulations.length ? 'All Cached' : 'Cache All'}
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {cacheProgress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{
                    height: 4, borderRadius: 2, background: '#1E293B', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: cacheProgress.errors > 0
                        ? 'linear-gradient(90deg, #0EA5E9, #F97316)'
                        : '#0EA5E9',
                      width: `${Math.round((cacheProgress.done / cacheProgress.total) * 100)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cacheProgress.done} of {cacheProgress.total} downloaded</span>
                    {cacheProgress.errors > 0 && (
                      <span style={{ color: '#F97316' }}>{cacheProgress.errors} unavailable</span>
                    )}
                  </div>
                </div>
              )}

              {/* Clear Cache */}
              {(cachedCount ?? 0) > 0 && !cacheProgress && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(56,189,248,0.04)' }}>
                  <span style={{ fontSize: 10, color: '#64748B' }}>
                    Free up storage space
                  </span>
                  <button
                    onClick={handleClearCache}
                    disabled={clearing}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'transparent',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 6, padding: '4px 10px', cursor: clearing ? 'not-allowed' : 'pointer',
                      color: '#F87171', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      opacity: clearing ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={10} />
                    {clearing ? 'Clearing...' : 'Clear Cache'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter dropdowns */}
        {showFilters && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10,
          }}>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>CATEGORY</div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                  border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                  fontSize: 11, fontFamily: 'inherit', outline: 'none',
                }}
              >
                <option value="all">All Categories</option>
                {REGULATION_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>PUB TYPE</div>
              <select
                value={pubTypeFilter}
                onChange={e => setPubTypeFilter(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                  border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                  fontSize: 11, fontFamily: 'inherit', outline: 'none',
                }}
              >
                <option value="all">All Types</option>
                {REGULATION_PUB_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results count + Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
          {showFavoritesOnly
            ? `${filtered.length} favorite${filtered.length !== 1 ? 's' : ''}`
            : filtered.length === regulations.length
              ? `Showing all ${filtered.length} references`
              : `${filtered.length} of ${regulations.length} references`
          }
        </div>
        {isSysAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'linear-gradient(135deg, #059669, #10B981)',
              border: 'none', borderRadius: 6, padding: '5px 12px',
              color: '#fff', fontSize: 10, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Plus size={12} />
            Add Reference
          </button>
        )}
      </div>

      {/* Regulation cards */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 12 }}>
          {showFavoritesOnly
            ? 'No favorites yet. Tap the star on any reference to add it.'
            : 'No references match your search.'}
        </div>
      ) : (
        filtered.map(reg => {
          const catConfig = getCategoryConfig(reg.category)
          const isExpanded = expandedId === reg.reg_id
          const isFav = favorites.has(reg.reg_id)

          return (
            <div
              key={reg.reg_id}
              className="card"
              onClick={() => setExpandedId(isExpanded ? null : reg.reg_id)}
              style={{
                marginBottom: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                border: isExpanded
                  ? '1px solid rgba(56,189,248,0.2)'
                  : '1px solid rgba(56,189,248,0.06)',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', marginBottom: 2 }}>
                    {reg.reg_id}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3 }}>
                    {reg.title}
                  </div>
                </div>
                <button
                  onClick={e => toggleFavorite(reg.reg_id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 4, flexShrink: 0,
                  }}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    size={18}
                    color={isFav ? '#FACC15' : '#475569'}
                    fill={isFav ? '#FACC15' : 'none'}
                  />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {catConfig && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: catConfig.color,
                    background: catConfig.color + '18', padding: '1px 6px', borderRadius: 3,
                  }}>
                    {catConfig.label}
                  </span>
                )}
                <span style={{
                  fontSize: 8, fontWeight: 600, color: '#94A3B8',
                  background: 'rgba(148,163,184,0.10)', padding: '1px 6px', borderRadius: 3,
                }}>
                  {reg.pub_type}
                </span>
                {reg.publication_date && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: '#64748B',
                    padding: '1px 4px',
                  }}>
                    {reg.publication_date}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: 10, borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, marginBottom: 10 }}>
                    {reg.description}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>PUB TYPE</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{reg.pub_type}</div>
                    </div>
                    {reg.source_volume && (
                      <div>
                        <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>SOURCE VOLUME</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{reg.source_volume}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>DATE</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{reg.publication_date ?? 'N/A'}</div>
                    </div>
                  </div>

                  {reg.tags.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>TAGS</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {reg.tags.map(tag => (
                          <span
                            key={tag}
                            onClick={e => { e.stopPropagation(); setSearch(tag) }}
                            style={{
                              fontSize: 9, color: '#94A3B8', background: 'rgba(148,163,184,0.08)',
                              padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                              border: '1px solid rgba(148,163,184,0.10)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onViewReg(reg) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <FileText size={12} />
                      View in App
                    </button>
                    {(() => {
                      const externalUrl = reg.url
                        || (() => {
                          const sb = createClient()
                          if (!sb) return null
                          const { data } = sb.storage.from(REG_BUCKET).getPublicUrl(`${sanitizeFileName(reg.reg_id)}.pdf`)
                          return data?.publicUrl || null
                        })()
                      return externalUrl ? (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'transparent',
                            border: '1px solid rgba(56,189,248,0.2)',
                            color: '#94A3B8', fontSize: 11, fontWeight: 700,
                            padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={12} />
                          Open External
                        </a>
                      ) : null
                    })()}
                    {isSysAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(reg.reg_id) }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'transparent',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#F87171', fontSize: 11, fontWeight: 700,
                          padding: '6px 14px', borderRadius: 6,
                          cursor: 'pointer', fontFamily: 'inherit',
                          marginLeft: 'auto',
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {confirmDeleteId === reg.reg_id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        marginTop: 10, padding: '10px 12px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                        <AlertTriangle size={14} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#F87171', marginBottom: 2 }}>
                            Delete this reference?
                          </div>
                          <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.5 }}>
                            This will remove <strong>{reg.reg_id}</strong> from the database, delete its cached PDF, and remove it from storage. This cannot be undone.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                          style={{
                            padding: '5px 14px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: 'transparent', border: '1px solid #334155',
                            color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteRef(reg.reg_id) }}
                          disabled={deletingRegId === reg.reg_id}
                          style={{
                            padding: '5px 14px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: deletingRegId === reg.reg_id ? '#7F1D1D' : '#DC2626',
                            border: 'none', color: '#fff', cursor: deletingRegId === reg.reg_id ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit', opacity: deletingRegId === reg.reg_id ? 0.6 : 1,
                          }}
                        >
                          {deletingRegId === reg.reg_id ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Add Reference Modal */}
      {showAddModal && (
        <AddReferenceModal
          existingRegIds={regulations.map(r => r.reg_id)}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddRef}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Add Reference Modal
// ═══════════════════════════════════════════════════════════════

const EMPTY_FORM: RegulationEntry = {
  reg_id: '',
  title: '',
  description: '',
  publication_date: null,
  url: null,
  source_section: 'I',
  source_volume: 'Vol. 1',
  category: 'airfield_ops',
  pub_type: 'DAF',
  is_core: false,
  is_cross_ref: false,
  is_scrubbed: false,
  tags: [],
}

// Derive source_volume and boolean flags from source_section
function deriveFromSection(section: string): { source_volume: string | null; is_core: boolean; is_cross_ref: boolean; is_scrubbed: boolean } {
  const map: Record<string, string | null> = {
    core: null,
    I: 'Vol. 1', II: 'Vol. 2', III: 'Vol. 3',
    IV: 'UFC 3-260-01', V: 'UFC 3-260-01',
    'VI-A': 'Vol. 1', 'VI-B': 'Vol. 2', 'VI-C': 'Vol. 3',
    'VII-A': 'Vol. 1', 'VII-B': 'Vol. 2', 'VII-C': 'Vol. 3',
  }
  return {
    source_volume: map[section] ?? null,
    is_core: section === 'core',
    is_cross_ref: section.startsWith('VI'),
    is_scrubbed: section.startsWith('VII'),
  }
}

function AddReferenceModal({ existingRegIds, onClose, onAdd }: { existingRegIds: string[]; onClose: () => void; onAdd: (entry: RegulationEntry) => void }) {
  const [form, setForm] = useState<RegulationEntry>({ ...EMPTY_FORM })
  const [tagsInput, setTagsInput] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = useCallback(<K extends keyof RegulationEntry>(key: K, value: RegulationEntry[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-derive fields when section changes
      if (key === 'source_section') {
        const derived = deriveFromSection(value as string)
        Object.assign(next, derived)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    if (!form.reg_id.trim()) { setError('Reg ID is required'); return }
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.description.trim()) { setError('Description is required'); return }

    // Check for duplicate
    if (existingRegIds.includes(form.reg_id.trim())) {
      setError(`A reference with ID "${form.reg_id.trim()}" already exists`)
      return
    }

    setSaving(true)
    setError(null)

    const entry: RegulationEntry = {
      ...form,
      reg_id: form.reg_id.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    }

    try {
      const supabase = createClient()

      // Upload PDF to storage if provided
      if (pdfFile && supabase) {
        setUploadProgress('Uploading PDF...')
        const fileName = `${sanitizeFileName(entry.reg_id)}.pdf`
        const { error: uploadErr } = await supabase.storage
          .from(REG_BUCKET)
          .upload(fileName, pdfFile, { upsert: true, contentType: 'application/pdf' })
        if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`)
      }

      // Insert into Supabase regulations table
      if (supabase) {
        setUploadProgress('Saving to database...')
        const { error: insertErr } = await supabase.from('regulations').insert({
          reg_id: entry.reg_id,
          title: entry.title,
          description: entry.description,
          publication_date: entry.publication_date,
          url: entry.url,
          source_section: entry.source_section,
          source_volume: entry.source_volume,
          category: entry.category,
          pub_type: entry.pub_type as RegulationPubType,
          is_core: entry.is_core,
          is_cross_ref: entry.is_cross_ref,
          is_scrubbed: entry.is_scrubbed,
          tags: entry.tags,
          storage_path: pdfFile ? `${sanitizeFileName(entry.reg_id)}.pdf` : null,
          file_size_bytes: pdfFile ? pdfFile.size : null,
          last_verified_at: null,
          verified_date: null,
        })
        if (insertErr) throw new Error(`Database insert failed: ${insertErr.message}`)
      }

      onAdd(entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reference')
    } finally {
      setSaving(false)
      setUploadProgress('')
    }
  }, [form, tagsInput, pdfFile, onAdd])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'rgba(15,23,42,0.8)',
    border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
    fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em',
    marginBottom: 4, display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: '#0B1120', borderRadius: 12,
          border: '1px solid rgba(56,189,248,0.15)',
          padding: 20, position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9' }}>Add Reference</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} color="#64748B" />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: 11, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reg ID */}
          <div>
            <label style={labelStyle}>REG ID *</label>
            <input
              style={inputStyle}
              placeholder="e.g., DAFI 91-204"
              value={form.reg_id}
              onChange={e => updateField('reg_id', e.target.value)}
            />
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>TITLE *</label>
            <input
              style={inputStyle}
              placeholder="e.g., Safety Investigations and Reports"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>DESCRIPTION *</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder="Brief description of what this regulation covers..."
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>

          {/* Row: Section + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>SOURCE SECTION</label>
              <select
                style={inputStyle}
                value={form.source_section}
                onChange={e => updateField('source_section', e.target.value)}
              >
                {REGULATION_SOURCE_SECTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>CATEGORY</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={e => updateField('category', e.target.value)}
              >
                {REGULATION_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Pub Type + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>PUB TYPE</label>
              <select
                style={inputStyle}
                value={form.pub_type}
                onChange={e => updateField('pub_type', e.target.value)}
              >
                {REGULATION_PUB_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>PUBLICATION DATE</label>
              <input
                style={inputStyle}
                placeholder="e.g., 10 Mar 2023"
                value={form.publication_date ?? ''}
                onChange={e => updateField('publication_date', e.target.value || null)}
              />
            </div>
          </div>

          {/* External URL */}
          <div>
            <label style={labelStyle}>EXTERNAL URL</label>
            <input
              style={inputStyle}
              placeholder="https://..."
              value={form.url ?? ''}
              onChange={e => updateField('url', e.target.value || null)}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>TAGS (comma-separated)</label>
            <input
              style={inputStyle}
              placeholder="e.g., safety, mishap, aviation"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label style={labelStyle}>PDF FILE (optional)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: 6, padding: '6px 12px',
                  color: '#94A3B8', fontSize: 11, fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <Upload size={12} />
                {pdfFile ? 'Change File' : 'Choose PDF'}
              </button>
              {pdfFile && (
                <span style={{ fontSize: 10, color: '#38BDF8', fontWeight: 600 }}>
                  {pdfFile.name} ({formatFileSize(pdfFile.size)})
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {/* Auto-derived info */}
          <div style={{
            padding: '8px 10px', borderRadius: 6,
            background: 'rgba(56,189,248,0.04)',
            border: '1px solid rgba(56,189,248,0.08)',
            fontSize: 9, color: '#64748B', lineHeight: 1.6,
          }}>
            <strong style={{ color: '#94A3B8' }}>Auto-derived:</strong>{' '}
            Source Volume: <span style={{ color: '#94A3B8' }}>{form.source_volume ?? 'None'}</span>{' | '}
            Core: <span style={{ color: '#94A3B8' }}>{form.is_core ? 'Yes' : 'No'}</span>{' | '}
            Cross-Ref: <span style={{ color: '#94A3B8' }}>{form.is_cross_ref ? 'Yes' : 'No'}</span>{' | '}
            Scrubbed: <span style={{ color: '#94A3B8' }}>{form.is_scrubbed ? 'Yes' : 'No'}</span>
            {form.reg_id && (
              <>
                <br />
                Storage name: <span style={{ color: '#94A3B8' }}>{sanitizeFileName(form.reg_id || 'example')}.pdf</span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: 'transparent', border: '1px solid #334155',
              color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: saving ? '#064E3B' : 'linear-gradient(135deg, #059669, #10B981)',
              border: 'none', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (uploadProgress || 'Saving...') : 'Add Reference'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// My Documents Tab
// ═══════════════════════════════════════════════════════════════

function MyDocumentsTab({ onViewDoc }: { onViewDoc: (doc: UserDocument, userId: string) => void }) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [docs, setDocs] = useState<UserDocument[]>([])
  const [cachedFiles, setCachedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cachingFile, setCachingFile] = useState<string | null>(null)

  // Load user + documents on mount
  useEffect(() => {
    async function init() {
      if (!supabase) { setLoading(false); return }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        setUserId(user.id)

        const [documents, cached] = await Promise.all([
          userDocService.listDocuments(supabase),
          userDocService.getCachedFileNames(),
        ])
        setDocs(documents)
        setCachedFiles(cached)
      } catch (e) {
        console.warn('Failed to load user documents:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh cached file list
  const refreshCache = useCallback(async () => {
    const cached = await userDocService.getCachedFileNames()
    setCachedFiles(cached)
  }, [])

  // ── Upload ───────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase || !userId) return
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''

    const ext = file.name.toLowerCase().split('.').pop()
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
      setError('Only PDF, JPG, and PNG files are supported.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50 MB.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const doc = await userDocService.upload(supabase, userId, file, setUploadStage)
      setDocs(prev => [doc, ...prev])
      await refreshCache()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadStage('')
    }
  }, [supabase, userId, refreshCache])

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = useCallback(async (doc: UserDocument) => {
    if (!supabase || !userId) return
    setDeletingId(doc.id)
    try {
      await userDocService.deleteDocument(supabase, userId, doc)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      await refreshCache()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }, [supabase, userId, refreshCache])

  // ── Cache / Uncache ──────────────────────────────────────
  const handleToggleCache = useCallback(async (doc: UserDocument) => {
    if (!supabase || !userId) return
    setCachingFile(doc.file_name)
    try {
      if (cachedFiles.has(doc.file_name)) {
        await userDocService.uncacheBlob(doc.file_name)
      } else {
        await userDocService.cacheBlob(supabase, userId, doc.file_name)
      }
      await refreshCache()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cache operation failed')
    } finally {
      setCachingFile(null)
    }
  }, [supabase, userId, cachedFiles, refreshCache])

  // ── No auth ──────────────────────────────────────────────
  if (!supabase) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 12 }}>
        Supabase is not configured. User documents require authentication.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{
          display: 'inline-block', width: 20, height: 20,
          border: '2px solid #334155', borderTopColor: '#38BDF8',
          borderRadius: '50%', animation: 'spin 0.6s linear infinite',
        }} />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 12 }}>
        Please log in to upload and manage personal documents.
      </div>
    )
  }

  return (
    <>
      {/* Upload button + count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </div>
        <label
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: uploading ? '#1E293B' : 'linear-gradient(135deg, #0369A1, #0EA5E9)',
            color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '6px 14px', borderRadius: 6,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <Upload size={12} />
          {uploading ? uploadStage || 'Uploading...' : 'Upload File'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div style={{
          padding: '8px 12px', marginBottom: 12, borderRadius: 6,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#F87171', fontSize: 11, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            <X size={12} color="#F87171" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {docs.length === 0 && !uploading && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <FileText size={32} color="#334155" style={{ marginBottom: 12 }} />
          <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            No documents yet
          </div>
          <div style={{ color: '#64748B', fontSize: 11, lineHeight: 1.5 }}>
            Upload your personal references and publications.
            They&apos;ll sync across your devices and work offline.
          </div>
        </div>
      )}

      {/* Document cards */}
      {docs.map(doc => {
        const isCached = cachedFiles.has(doc.file_name)
        const isDeleting = deletingId === doc.id
        const isCaching = cachingFile === doc.file_name

        return (
          <div
            key={doc.id}
            className="card"
            style={{
              marginBottom: 8,
              padding: '10px 12px',
              border: '1px solid rgba(56,189,248,0.06)',
              opacity: isDeleting ? 0.4 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Title row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3 }}>
                  {doc.display_name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                {/* Status badge (only show for non-ready states) */}
                {doc.status !== 'ready' && (
                  <div style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                    background: doc.status === 'failed'
                      ? 'rgba(239,68,68,0.15)' : 'rgba(253,230,138,0.15)',
                    color: doc.status === 'failed'
                      ? '#F87171' : '#FDE68A',
                    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                  }}>
                    {doc.status === 'failed' ? 'FAILED' : 'PROCESSING'}
                  </div>
                )}
                {/* Cache indicator */}
                {isCached && (
                  <div style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                    background: 'rgba(14,165,233,0.15)', color: '#38BDF8',
                    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                  }}>
                    CACHED
                  </div>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>
                {formatFileSize(doc.file_size)}
              </span>
              {doc.total_pages && (
                <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>
                  {doc.total_pages} pages
                </span>
              )}
              <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>
                {new Date(doc.uploaded_at).toLocaleDateString()}
              </span>
            </div>

            {/* Failure explanation */}
            {doc.status === 'failed' && (
              <div style={{
                marginTop: 6, padding: '6px 8px', borderRadius: 6,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                fontSize: 10, color: '#F87171', lineHeight: 1.4,
              }}>
                Text extraction failed — the file may be scanned or image-based.
                You can still view the document, but search won&apos;t be available.
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => onViewDoc(doc, userId)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '5px 10px', borderRadius: 5,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <FileText size={10} />
                View
              </button>

              <button
                onClick={() => handleToggleCache(doc)}
                disabled={isCaching}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent',
                  border: '1px solid rgba(56,189,248,0.2)',
                  color: isCached ? '#F87171' : '#94A3B8',
                  fontSize: 10, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 5,
                  cursor: isCaching ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isCaching ? 0.5 : 1,
                }}
              >
                {isCached ? <HardDrive size={10} /> : <Download size={10} />}
                {isCaching ? '...' : isCached ? 'Uncache' : 'Cache'}
              </button>

              <button
                onClick={() => handleDelete(doc)}
                disabled={isDeleting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#F87171',
                  fontSize: 10, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 5,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <Trash2 size={10} />
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}
