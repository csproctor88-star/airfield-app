'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { createClient } from '@/lib/supabase/client'
import {
  idbSet,
  idbGet,
  idbGetAllKeys,
  idbDelete,
  STORE_BLOBS,
  STORE_META,
} from '@/lib/idb'
import { textCache } from '@/lib/pdfTextCache'

// PDF.js worker — match version to react-pdf's bundled pdfjs
// Temporary — runs PDF.js on main thread (slower but no worker comms)
pdfjs.GlobalWorkerOptions.workerSrc = ""

const BUCKET_NAME = 'regulation-pdfs'

// ── Types ────────────────────────────────────────────────────

interface StorageFile {
  name: string
  id: string
  metadata?: { size?: number }
  created_at?: string
}

// ── Utilities ────────────────────────────────────────────────

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

// ── Component ────────────────────────────────────────────────

export default function PDFLibrary() {
  const supabase = createClient()

  // File list state
  const [files, setFiles] = useState<StorageFile[]>([])
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Viewer state
  const [viewingFile, setViewingFile] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Extract All state
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState('')

  // Online/offline tracking
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Load cached keys
  const refreshCache = useCallback(async () => {
    try {
      const keys = await idbGetAllKeys(STORE_BLOBS)
      setCachedKeys(new Set(keys as string[]))
    } catch (e) {
      console.error('Cache read failed:', e)
    }
  }, [])

  // Fetch file list from Supabase Storage
  const fetchFileList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (navigator.onLine && supabase) {
        const { data, error: listErr } = await supabase.storage
          .from(BUCKET_NAME)
          .list('', { limit: 500 })
        if (listErr) throw listErr
        const pdfs = (data || []).filter(
          (f: StorageFile) => f.name?.toLowerCase().endsWith('.pdf') && f.id,
        ) as StorageFile[]
        setFiles(pdfs)
        await idbSet(STORE_META, 'file_list', JSON.stringify(pdfs))
      } else {
        const cached = await idbGet<string>(STORE_META, 'file_list')
        if (cached) {
          setFiles(JSON.parse(cached))
        } else {
          const keys = await idbGetAllKeys(STORE_BLOBS)
          setFiles(keys.map((k) => ({ name: k as string, id: k as string, metadata: {} })))
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      const cached = await idbGet<string>(STORE_META, 'file_list')
      if (cached) setFiles(JSON.parse(cached))
    } finally {
      setLoading(false)
    }
    await refreshCache()
  }, [supabase, refreshCache])

  useEffect(() => {
    fetchFileList()
  }, [fetchFileList])

  // Download & cache a single PDF
  const downloadAndCache = useCallback(
    async (fileName: string) => {
      if (!supabase) return
      setDownloading((prev) => new Set([...Array.from(prev), fileName]))
      try {
        const { data, error: dlErr } = await supabase.storage
          .from(BUCKET_NAME)
          .download(fileName)
        if (dlErr) throw dlErr
        const arrayBuffer = await data.arrayBuffer()
        await idbSet(STORE_BLOBS, fileName, arrayBuffer)
        await refreshCache()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`Download failed: ${msg}`)
      } finally {
        setDownloading((prev) => {
          const next = new Set(prev)
          next.delete(fileName)
          return next
        })
      }
    },
    [supabase, refreshCache],
  )

  // Cache all uncached files
  const cacheAll = useCallback(async () => {
    const uncached = files.filter((f) => !cachedKeys.has(f.name))
    for (const f of uncached) {
      await downloadAndCache(f.name)
    }
  }, [files, cachedKeys, downloadAndCache])

  // Open PDF in viewer
  const viewPdf = useCallback(
    async (fileName: string) => {
      setPdfLoading(true)
      setPdfError(null)
      setPdfData(null)
      setNumPages(null)
      setCurrentPage(1)
      setViewingFile(fileName)

      try {
        let cached = await idbGet<ArrayBuffer | Blob>(STORE_BLOBS, fileName)

        if (!cached && navigator.onLine && supabase) {
          const { data, error: dlErr } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileName)
          if (dlErr) throw dlErr
          const arrayBuffer = await data.arrayBuffer()
          await idbSet(STORE_BLOBS, fileName, arrayBuffer)
          await refreshCache()
          cached = arrayBuffer
        }

        if (!cached) {
          setPdfError('PDF not available offline. Connect to download first.')
          setPdfLoading(false)
          return
        }

        // Handle both Blob (legacy cache) and ArrayBuffer (new)
        if (cached instanceof Blob) {
          cached = await cached.arrayBuffer()
        }
        setPdfData(cached)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setPdfError(`Failed to load: ${msg}`)
      } finally {
        setPdfLoading(false)
      }
    },
    [supabase, refreshCache],
  )

  const closeViewer = useCallback(() => {
    setViewingFile(null)
    setPdfData(null)
    setNumPages(null)
    setCurrentPage(1)
    setPdfError(null)
  }, [])

  const removeFromCache = useCallback(
    async (fileName: string) => {
      await idbDelete(STORE_BLOBS, fileName)
      await refreshCache()
    },
    [refreshCache],
  )

  // ── Extract All — admin feature ────────────────────────────
  // Downloads every PDF, extracts text client-side, and uploads
  // the text to Supabase pdf_text_pages for full-text search.
  const extractAll = useCallback(async () => {
    if (!supabase || extracting) return
    setExtracting(true)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setExtractProgress(`Extracting ${i + 1}/${files.length}: ${file.name}`)

        // Get or download the PDF
        let cached = await idbGet<ArrayBuffer | Blob>(STORE_BLOBS, file.name)
        if (!cached) {
          const { data, error: dlErr } = await supabase.storage
            .from(BUCKET_NAME)
            .download(file.name)
          if (dlErr) {
            console.warn(`Skipping ${file.name}: ${dlErr.message}`)
            continue
          }
          const arrayBuffer = await data.arrayBuffer()
          await idbSet(STORE_BLOBS, file.name, arrayBuffer)
          cached = arrayBuffer
        }

        // Handle legacy Blob from cache
        if (cached instanceof Blob) {
          cached = await cached.arrayBuffer()
        }

        // Extract text and upload to Supabase
        const uint8 = new Uint8Array(cached)
        await textCache.getTextForFile(supabase, file.name, uint8)
      }

      setExtractProgress(`Done — ${files.length} files extracted`)
      await refreshCache()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Extraction failed: ${msg}`)
    } finally {
      setExtracting(false)
    }
  }, [supabase, files, extracting, refreshCache])

  // Memoize the file prop to prevent re-clone issues
  const fileData = useMemo(() => {
    if (!pdfData) return null
    return { data: pdfData.slice(0) }
  }, [pdfData])

  // react-pdf callbacks
  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
  }
  function onDocumentLoadError(err: Error) {
    console.error('react-pdf load error:', err)
    setPdfError(`PDF render failed: ${err.message}. Check the worker config.`)
  }

  // Keyboard nav
  useEffect(() => {
    if (!viewingFile) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCurrentPage((p) => Math.min(p + 1, numPages || p))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCurrentPage((p) => Math.max(p - 1, 1))
      } else if (e.key === 'Escape') {
        closeViewer()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewingFile, numPages, closeViewer])

  // Filtered files
  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const cachedCount = files.filter((f) => cachedKeys.has(f.name)).length

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerRow}>
          <div style={S.headerLeft}>
            <div style={S.logo}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <h1 style={S.title}>Regulation Library</h1>
              <p style={S.subtitle}>
                {files.length} regulation{files.length !== 1 ? 's' : ''} &middot;{' '}
                {cachedCount} available offline
              </p>
            </div>
          </div>
          <div style={{ ...S.badge, ...(isOnline ? S.badgeOnline : S.badgeOffline) }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#34D399' : '#FBBF24' }} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search regulations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={S.searchInput}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={fetchFileList}
            disabled={!isOnline || loading}
            style={{ ...S.btn, ...S.btnGhost, ...(!isOnline || loading ? S.btnOff : {}) }}
          >
            Refresh
          </button>
          <button
            onClick={cacheAll}
            disabled={!isOnline || cachedCount === files.length}
            style={{ ...S.btn, ...S.btnAccent, ...(!isOnline || cachedCount === files.length ? S.btnOff : {}) }}
          >
            Cache All
          </button>
          <button
            onClick={extractAll}
            disabled={!isOnline || extracting || files.length === 0}
            style={{
              ...S.btn,
              ...S.btnExtract,
              ...(!isOnline || extracting || files.length === 0 ? S.btnOff : {}),
            }}
          >
            {extracting ? 'Extracting...' : 'Extract All'}
          </button>
        </div>
      </div>

      {/* Extract progress */}
      {extractProgress && (
        <div style={S.progressBar}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{extractProgress}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={S.error}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={S.errorX}>X</button>
        </div>
      )}

      {/* Main */}
      <div style={S.main}>
        {viewingFile ? (
          /* PDF Viewer */
          <div style={S.viewer}>
            <div style={S.viewerBar}>
              <button onClick={closeViewer} style={S.backBtn}>Back</button>
              <span style={S.viewerName}>{viewingFile}</span>
              <div style={S.viewerControls}>
                <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} style={S.ctrlBtn} title="Zoom out">-</button>
                <span style={S.zoomLabel}>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} style={S.ctrlBtn} title="Zoom in">+</button>
                <div style={S.divider} />
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ ...S.ctrlBtn, ...(currentPage <= 1 ? S.btnOff : {}) }}>
                  &lsaquo;
                </button>
                <span style={S.pageLabel}>{currentPage} / {numPages || '\u2013'}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(numPages || p, p + 1))} disabled={currentPage >= (numPages || 1)} style={{ ...S.ctrlBtn, ...(currentPage >= (numPages || 1) ? S.btnOff : {}) }}>
                  &rsaquo;
                </button>
              </div>
            </div>

            <div ref={containerRef} style={S.viewerBody}>
              {pdfLoading && (
                <div style={S.center}>
                  <span style={S.spinner} />
                  <span style={{ color: '#64748B', marginLeft: 8 }}>Loading PDF...</span>
                </div>
              )}
              {pdfError && (
                <div style={S.center}>
                  <div style={S.pdfErrBox}>
                    <strong style={{ color: '#EF4444' }}>Failed to render PDF</strong>
                    <p style={{ margin: '8px 0 0', fontSize: 13 }}>{pdfError}</p>
                  </div>
                </div>
              )}
              {fileData && !pdfError && (
                <Document
                  file={fileData}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={<div style={S.center}><span style={S.spinner} /></div>}
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={<div style={{ ...S.center, minHeight: 600 }}><span style={S.spinner} /></div>}
                  />
                </Document>
              )}
            </div>
          </div>
        ) : loading ? (
          <div style={S.center}>
            <span style={S.spinner} />
            <span style={{ color: '#64748B', marginLeft: 8 }}>Loading file list...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...S.center, flexDirection: 'column' as const, padding: 80 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p style={{ color: '#94A3B8', marginTop: 12, fontWeight: 600 }}>
              {searchQuery ? 'No matching regulations' : 'No PDFs found'}
            </p>
            <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
              {searchQuery ? 'Try a different search term' : `Verify bucket "${BUCKET_NAME}" contains PDF files`}
            </p>
          </div>
        ) : (
          /* File List */
          <div style={S.list}>
            {filtered.map((file) => {
              const cached = cachedKeys.has(file.name)
              const isDownloading = downloading.has(file.name)

              return (
                <div
                  key={file.name}
                  style={S.row}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.borderColor = '#334155' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1E293B' }}
                >
                  <button onClick={() => viewPdf(file.name)} disabled={!cached && !isOnline} style={S.fileBtn}>
                    <div style={{ ...S.icon, borderColor: cached ? 'rgba(52,211,153,0.25)' : 'rgba(100,116,139,0.25)', color: cached ? '#34D399' : '#64748B' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div style={S.fileInfo}>
                      <span style={S.fileName}>{file.name}</span>
                      <span style={S.fileMeta}>
                        {formatBytes(file.metadata?.size)}
                        {file.created_at ? ` \u00b7 ${formatDate(file.created_at)}` : ''}
                        {cached ? ' \u00b7 Cached' : ''}
                      </span>
                    </div>
                  </button>

                  <div style={S.actions}>
                    {cached && (
                      <span style={{ color: '#34D399', display: 'flex' }} title="Available offline">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </span>
                    )}
                    {!cached && isOnline && !isDownloading && (
                      <button onClick={() => downloadAndCache(file.name)} style={S.actBtn} title="Cache for offline">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    )}
                    {isDownloading && <span style={S.spinner} />}
                    {cached && (
                      <button onClick={() => removeFromCache(file.name)} style={{ ...S.actBtn, color: '#475569' }} title="Remove from cache">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={S.footer}>
        <span>Supabase Storage &middot; <code style={S.code}>{BUCKET_NAME}</code></span>
        <span>react-pdf v{pdfjs.version} &middot; IndexedDB offline cache</span>
      </footer>
    </div>
  )
}

// ── Inject keyframe animation ────────────────────────────────
if (typeof document !== 'undefined') {
  const id = 'aoms-pdf-keyframes'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
    document.head.appendChild(style)
  }
}

// ── Styles ───────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#0F172A',
    color: '#E2E8F0',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
    borderBottom: '1px solid #1E293B',
    padding: '18px 24px',
  },
  headerRow: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: '#F1F5F9' },
  subtitle: { margin: 0, fontSize: 13, color: '#64748B', fontWeight: 400 },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, border: '1px solid' },
  badgeOnline: { color: '#34D399', borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.08)' },
  badgeOffline: { color: '#FBBF24', borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.08)' },
  toolbar: { maxWidth: 960, margin: '0 auto', width: '100%', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxSizing: 'border-box' },
  searchWrap: { position: 'relative', flex: '1 1 220px', minWidth: 180 },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap' },
  btnAccent: { background: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.25)', color: '#38BDF8' },
  btnGhost: { background: 'rgba(241,245,249,0.04)', borderColor: '#334155', color: '#94A3B8' },
  btnExtract: { background: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.25)', color: '#A855F7' },
  btnOff: { opacity: 0.3, cursor: 'not-allowed' },
  progressBar: { maxWidth: 960, margin: '0 auto', width: '100%', padding: '6px 24px', boxSizing: 'border-box' },
  error: { maxWidth: 960, margin: '0 auto', width: '100%', padding: '10px 24px', boxSizing: 'border-box', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#F87171', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  errorX: { background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, padding: 4 },
  main: { flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '0 24px 24px', boxSizing: 'border-box' },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 10, border: '1px solid #1E293B', transition: 'all 0.15s', gap: 8 },
  fileBtn: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, padding: '8px 4px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 },
  icon: { width: 38, height: 38, borderRadius: 8, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(15,23,42,0.6)' },
  fileInfo: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: 500, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileMeta: { fontSize: 12, color: '#64748B', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
  actions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  actBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' },
  viewer: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 500, background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
  viewerBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #334155', background: '#0F172A', flexWrap: 'wrap' },
  backBtn: { padding: '6px 12px', borderRadius: 6, background: 'rgba(241,245,249,0.05)', border: '1px solid #334155', color: '#94A3B8', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  viewerName: { flex: 1, fontSize: 14, fontWeight: 500, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  viewerControls: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctrlBtn: { width: 30, height: 30, borderRadius: 6, background: 'rgba(241,245,249,0.05)', border: '1px solid #334155', color: '#94A3B8', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  zoomLabel: { fontSize: 12, color: '#64748B', fontFamily: "'JetBrains Mono', monospace", minWidth: 40, textAlign: 'center' },
  pageLabel: { fontSize: 12, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", minWidth: 50, textAlign: 'center' },
  divider: { width: 1, height: 20, background: '#334155', margin: '0 4px' },
  viewerBody: { flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16, background: '#0F172A' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  spinner: { display: 'inline-block', width: 16, height: 16, border: '2px solid #334155', borderTopColor: '#38BDF8', borderRadius: '50%', animation: 'spin 0.6s linear infinite' },
  pdfErrBox: { maxWidth: 500, padding: 20, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#CBD5E1', fontSize: 14 },
  code: { background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 4, color: '#38BDF8', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  footer: { maxWidth: 960, margin: '0 auto', width: '100%', padding: '14px 24px', boxSizing: 'border-box', borderTop: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" },
}
