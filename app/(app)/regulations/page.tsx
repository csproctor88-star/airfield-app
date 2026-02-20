'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Search, ExternalLink, ChevronDown, ChevronUp, X, FileText, Upload, Trash2, Download, HardDrive } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ALL_REGULATIONS, type RegulationEntry } from '@/lib/regulations-data'
import { REGULATION_CATEGORIES, REGULATION_PUB_TYPES, REGULATION_SOURCE_SECTIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { userDocService, type UserDocument } from '@/lib/userDocuments'

const RegulationPDFViewer = dynamic(
  () => import('@/components/RegulationPDFViewer'),
  { ssr: false },
)

// --- Badge color by entry type ---
function entryTypeBadge(entry: RegulationEntry): { label: string; bg: string; color: string } {
  if (entry.is_core) return { label: 'CORE', bg: 'rgba(52,211,153,0.15)', color: '#34D399' }
  if (entry.is_scrubbed) return { label: 'SCRUBBED', bg: 'rgba(165,180,252,0.15)', color: '#A5B4FC' }
  if (entry.is_cross_ref) return { label: 'CROSS-REF', bg: 'rgba(253,230,138,0.15)', color: '#FDE68A' }
  return { label: 'DIRECT', bg: 'rgba(241,245,249,0.10)', color: '#CBD5E1' }
}

function getCategoryConfig(categoryValue: string) {
  return REGULATION_CATEGORIES.find(c => c.value === categoryValue)
}

function getPubTypeLabel(pubType: string) {
  return REGULATION_PUB_TYPES.find(p => p.value === pubType)?.label ?? pubType
}

function getSectionLabel(section: string) {
  return REGULATION_SOURCE_SECTIONS.find(s => s.value === section)?.label ?? section
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
        <div style={{ fontSize: 16, fontWeight: 800 }}>Regulations</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(56,189,248,0.10)' }}>
        {([
          { key: 'regulations' as Tab, label: 'Regulations' },
          { key: 'my-docs' as Tab, label: 'My Documents' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #0EA5E9' : '2px solid transparent',
              color: tab === t.key ? '#F1F5F9' : '#64748B',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
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
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const coreCount = ALL_REGULATIONS.filter(r => r.is_core).length
  const directCount = ALL_REGULATIONS.filter(r => !r.is_core && !r.is_cross_ref && !r.is_scrubbed).length
  const crossRefCount = ALL_REGULATIONS.filter(r => r.is_cross_ref).length
  const scrubbedCount = ALL_REGULATIONS.filter(r => r.is_scrubbed).length

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ALL_REGULATIONS.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (pubTypeFilter !== 'all' && r.pub_type !== pubTypeFilter) return false
      if (sourceFilter !== 'all' && r.source_section !== sourceFilter) return false
      if (!q) return true
      return (
        r.reg_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [search, categoryFilter, pubTypeFilter, sourceFilter])

  const hasActiveFilters = categoryFilter !== 'all' || pubTypeFilter !== 'all' || sourceFilter !== 'all'

  return (
    <>
      {/* KPI badges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'CORE', value: coreCount, color: '#34D399' },
          { label: 'DIRECT', value: directCount, color: '#CBD5E1' },
          { label: 'CROSS-REF', value: crossRefCount, color: '#FDE68A' },
          { label: 'SCRUBBED', value: scrubbedCount, color: '#A5B4FC' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '8px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 8, color: '#64748B', letterSpacing: '0.08em', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search
          size={14}
          color="#64748B"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          placeholder="Search regulations, titles, tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid #1E293B',
            borderRadius: 8,
            color: '#E2E8F0',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            }}
          >
            <X size={14} color="#64748B" />
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: hasActiveFilters ? 'rgba(34,211,238,0.08)' : 'transparent',
          border: `1px solid ${hasActiveFilters ? 'rgba(34,211,238,0.25)' : 'rgba(56,189,248,0.06)'}`,
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          color: hasActiveFilters ? '#22D3EE' : '#64748B',
          fontSize: 10, fontWeight: 700, fontFamily: 'inherit', marginBottom: 8,
        }}
      >
        {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Filters {hasActiveFilters && `(active)`}
        {hasActiveFilters && (
          <span
            onClick={e => { e.stopPropagation(); setCategoryFilter('all'); setPubTypeFilter('all'); setSourceFilter('all') }}
            style={{ marginLeft: 4, color: '#EF4444', cursor: 'pointer' }}
          >
            Clear
          </span>
        )}
      </button>

      {/* Filter dropdowns */}
      {showFilters && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 12,
          padding: 10, background: 'rgba(10,16,28,0.8)', borderRadius: 8,
          border: '1px solid rgba(56,189,248,0.06)',
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
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>SOURCE SECTION</div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">All Sections</option>
              {REGULATION_SOURCE_SECTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 8, fontWeight: 600 }}>
        {filtered.length === ALL_REGULATIONS.length
          ? `Showing all ${filtered.length} regulations`
          : `${filtered.length} of ${ALL_REGULATIONS.length} regulations`
        }
      </div>

      {/* Regulation cards */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 12 }}>
          No regulations match your search.
        </div>
      ) : (
        filtered.map(reg => {
          const badge = entryTypeBadge(reg)
          const catConfig = getCategoryConfig(reg.category)
          const isExpanded = expandedId === reg.reg_id

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
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                    background: badge.bg, color: badge.color,
                    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </div>
                </div>
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
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>SOURCE SECTION</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{getSectionLabel(reg.source_section)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>PUB TYPE</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{getPubTypeLabel(reg.pub_type)}</div>
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
                    {reg.url && (
                      <a
                        href={reg.url}
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
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </>
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
                {/* Status badge */}
                <div style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  background: doc.status === 'ready'
                    ? 'rgba(52,211,153,0.15)' : doc.status === 'failed'
                    ? 'rgba(239,68,68,0.15)' : 'rgba(253,230,138,0.15)',
                  color: doc.status === 'ready'
                    ? '#34D399' : doc.status === 'failed'
                    ? '#F87171' : '#FDE68A',
                  padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {doc.status === 'ready' ? 'READY' : doc.status === 'failed' ? 'FAILED' : 'PROCESSING'}
                </div>
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
