'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ExternalLink, ArrowLeft, ZoomIn, ZoomOut, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { idbGet, idbSet, STORE_BLOBS, STORE_USER_BLOBS } from '@/lib/idb'

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const REG_BUCKET = 'regulation-pdfs'
const USER_BUCKET = 'user-uploads'

function getDefaultViewMode(): "native" | "react-pdf" {
  if (typeof navigator === "undefined") return "react-pdf"
  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /ipad|iphone|ipod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const isAndroid = /android/.test(ua)
  return (isIOS || isAndroid) ? "react-pdf" : "native"
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent.toLowerCase()
  return /ipad|iphone|ipod|android/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function sanitizeFileName(regId: string): string {
  return regId
    .toLowerCase()
    .replace(/,\s*/g, '-')
    .replace(/\.\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')       // collapse double hyphens
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Inject spinner keyframe
if (typeof document !== 'undefined') {
  const id = 'aoms-reg-keyframes'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
    document.head.appendChild(style)
  }
}

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 16, height: 16,
    border: '2px solid #334155', borderTopColor: '#38BDF8',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
)

// ─── LazyPage — only renders when near viewport ──────────────
interface LazyPageProps {
  pageNumber: number
  scale: number
  searchTerm: string
  scrollRoot: React.RefObject<HTMLDivElement | null>
}

function LazyPage({ pageNumber, scale, searchTerm, scrollRoot }: LazyPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setHasRendered(true)
        } else {
          setIsVisible(false)
        }
      },
      {
        root: scrollRoot?.current || null,
        rootMargin: '1500px',
      }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [scrollRoot])

  // Highlight search matches after page renders
  const onRender = useCallback(() => {
    if (!searchTerm || searchTerm.length < 2 || !ref.current) return
    setTimeout(() => {
      const layer = ref.current?.querySelector('.react-pdf__Page__textContent')
      if (!layer) return
      const spans = layer.querySelectorAll('span')
      const term = searchTerm.toLowerCase()
      // Clear previous highlights
      spans.forEach((span) => {
        if ((span as HTMLElement).dataset.orig) {
          span.innerHTML = (span as HTMLElement).dataset.orig!
          delete (span as HTMLElement).dataset.orig
        }
      })
      // Apply highlights
      spans.forEach((span) => {
        const text = span.textContent
        if (!text) return
        const lower = text.toLowerCase()
        if (!lower.includes(term)) return
        ;(span as HTMLElement).dataset.orig = span.innerHTML
        let result = '', idx = 0, pos: number
        while ((pos = lower.indexOf(term, idx)) !== -1) {
          result += escapeHtml(text.slice(idx, pos))
          result += '<mark style="background:rgba(250,204,21,0.5);color:inherit;border-radius:2px;padding:0 1px">' +
            escapeHtml(text.slice(pos, pos + term.length)) + '</mark>'
          idx = pos + term.length
        }
        result += escapeHtml(text.slice(idx))
        span.innerHTML = result
      })
    }, 150)
  }, [searchTerm])

  return (
    <div ref={ref} style={{ marginBottom: 12, position: 'relative' }} id={`pdf-page-${pageNumber}`}>
      <div style={{
        position: 'absolute', top: 6, right: 10, zIndex: 10,
        fontSize: 11, fontWeight: 700, color: '#64748B',
        background: 'rgba(15,23,42,0.85)', padding: '2px 8px',
        borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
      }}>
        {pageNumber}
      </div>
      {(isVisible || hasRendered) ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onRenderSuccess={onRender}
        />
      ) : (
        <div style={{
          height: Math.round(1056 * scale),
          background: '#1E293B',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontSize: 13,
        }}>
          Page {pageNumber}
        </div>
      )}
    </div>
  )
}

function isImageFile(fileName: string): boolean {
  return /\.(jpg|jpeg|png)$/i.test(fileName)
}

// ─── Main Component ──────────────────────────────────────────
interface RegulationPDFViewerProps {
  regId: string
  title: string
  url: string | null
  onClose: () => void
  /** For user documents: 'user' uses user-uploads bucket + user_blobs IDB store */
  source?: 'regulation' | 'user'
  /** For user documents: the userId folder prefix in storage */
  userId?: string
  /** For user documents: pre-sanitized fileName to use instead of deriving from regId */
  storedFileName?: string
}

export default function RegulationPDFViewer({ regId, title, url, onClose, source = 'regulation', userId, storedFileName }: RegulationPDFViewerProps) {
  const supabase = createClient()
  const viewerRef = useRef<HTMLDivElement>(null)

  const [viewMode, setViewMode] = useState<"native" | "react-pdf">(getDefaultViewMode)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [masterBuffer, setMasterBuffer] = useState<ArrayBuffer | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(isMobileDevice() ? 0.8 : 1.0)
  const transformRef = useRef<any>(null)
  const [touchScale, setTouchScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imageUrlRef = useRef<string | null>(null)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pageTexts, setPageTexts] = useState<{ page: number; text: string }[]>([])
  const [matches, setMatches] = useState<{ page: number; position: number; snippet: string }[]>([])
  const [matchIdx, setMatchIdx] = useState(0)
  const [textExtracting, setTextExtracting] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fresh copy for react-pdf — prevents ArrayBuffer detach
  const fileData = useMemo(() => {
    if (!masterBuffer) return null
    return { data: masterBuffer.slice(0) }
  }, [masterBuffer])

  // Toggle view mode with fresh blob URL
  const toggleViewMode = useCallback(() => {
    if (viewMode === 'native') {
      setViewMode('react-pdf')
    } else {
      if (masterBuffer) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const url = URL.createObjectURL(new Blob([masterBuffer.slice(0)], { type: 'application/pdf' }))
        blobUrlRef.current = url
        setBlobUrl(url)
      }
      setViewMode('native')
    }
  }, [viewMode, masterBuffer])

  // Determine mime type from file extension
  const isImage = isImageFile(storedFileName || regId)

  // Load file from Supabase storage
  useEffect(() => {
    let cancelled = false
    const fileName = storedFileName || `${sanitizeFileName(regId)}.pdf`
    const idbStore = source === 'user' ? STORE_USER_BLOBS : STORE_BLOBS
    const bucketName = source === 'user' ? USER_BUCKET : REG_BUCKET
    const storagePath = source === 'user' && userId ? `${userId}/${fileName}` : fileName

    async function loadFile() {
      setLoading(true)
      setError(null)
      setMasterBuffer(null)
      setNumPages(null)
      setSearchTerm('')
      setMatches([])
      setPageTexts([])
      setImageUrl(null)

      // Helper: present an image from its ArrayBuffer
      function presentImage(arrayBuffer: ArrayBuffer) {
        if (cancelled) return
        if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
        const ext = fileName.toLowerCase().split('.').pop()
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
        const imgUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }))
        imageUrlRef.current = imgUrl
        setImageUrl(imgUrl)
      }

      // Helper: once we have an ArrayBuffer, set up PDF viewer + text extraction
      function presentPdf(arrayBuffer: ArrayBuffer) {
        if (cancelled) return
        setMasterBuffer(arrayBuffer)

        if (getDefaultViewMode() === 'native') {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
          const nativeUrl = URL.createObjectURL(new Blob([arrayBuffer.slice(0)], { type: 'application/pdf' }))
          blobUrlRef.current = nativeUrl
          setBlobUrl(nativeUrl)
          setViewMode('native')
        } else {
          setViewMode('react-pdf')
        }

        // Extract text in background for search
        setTextExtracting(true)
        pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise
          .then(async (pdf) => {
            const texts: { page: number; text: string }[] = []
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i)
              const content = await page.getTextContent()
              texts.push({ page: i, text: content.items.map((item: any) => item.str).join(' ') })
            }
            if (!cancelled) setPageTexts(texts)
          })
          .catch((e) => console.warn('Text extraction failed:', e))
          .finally(() => { if (!cancelled) setTextExtracting(false) })
      }

      const present = isImage ? presentImage : presentPdf

      try {
        // 1. Try IndexedDB cache first (works offline)
        let cached = await idbGet<ArrayBuffer | Blob>(idbStore, fileName)
        if (cached) {
          const arrayBuffer = cached instanceof Blob ? await cached.arrayBuffer() : cached
          present(arrayBuffer)
          setLoading(false)
          return
        }

        // 2. Fall back to Supabase download (requires network)
        if (supabase) {
          const { data, error: dlErr } = await supabase.storage
            .from(bucketName)
            .download(storagePath)
          if (!dlErr && data && !cancelled) {
            const arrayBuffer = await data.arrayBuffer()
            // Cache to IndexedDB for offline use
            idbSet(idbStore, fileName, arrayBuffer).catch((e) =>
              console.warn('Failed to cache to IndexedDB:', e)
            )
            present(arrayBuffer)
            setLoading(false)
            return
          }
        }

        // 3. Nothing worked
        if (!cancelled) {
          if (!navigator.onLine) {
            setError('You are offline and this file has not been cached yet. Connect to WiFi and view it once to cache it.')
          } else if (url) {
            setError('File not found in storage. Use "Open External" to view this document.')
          } else {
            setError('File not available in storage.')
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Failed to load file: ${msg}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFile()
    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current)
        imageUrlRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regId, url, source, userId, storedFileName])

  // Compute search matches
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2 || pageTexts.length === 0) {
      setMatches([]); setMatchIdx(0); return
    }
    const term = searchTerm.toLowerCase()
    const found: { page: number; position: number; snippet: string }[] = []
    for (const pt of pageTexts) {
      const text = pt.text.toLowerCase()
      let startIdx = 0, pos: number
      while ((pos = text.indexOf(term, startIdx)) !== -1) {
        const s = Math.max(0, pos - 40)
        const e = Math.min(pt.text.length, pos + term.length + 40)
        found.push({
          page: pt.page, position: pos,
          snippet: (s > 0 ? '\u2026' : '') + pt.text.slice(s, e) + (e < pt.text.length ? '\u2026' : ''),
        })
        startIdx = pos + 1
      }
    }
    setMatches(found)
    setMatchIdx(found.length > 0 ? 0 : -1)
    // Scroll to first match
    if (found.length > 0 && viewMode === 'react-pdf') {
      const el = document.getElementById(`pdf-page-${found[0].page}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchTerm, pageTexts, viewMode])

  const goToMatch = useCallback((dir: 'next' | 'prev') => {
    if (matches.length === 0) return
    const next = dir === 'next'
      ? (matchIdx + 1) % matches.length
      : (matchIdx - 1 + matches.length) % matches.length
    setMatchIdx(next)
    if (viewMode === 'react-pdf') {
      const el = document.getElementById(`pdf-page-${matches[next].page}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [matches, matchIdx, viewMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && viewMode === 'react-pdf') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return
      }
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); setSearchTerm(''); setMatches([]) }
        else onClose()
        return
      }
      if (e.key === 'Enter' && searchOpen) {
        e.preventDefault()
        goToMatch(e.shiftKey ? 'prev' : 'next')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [numPages, onClose, searchOpen, goToMatch, viewMode])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0A101C' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(56,189,248,0.1)',
        flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={btnStyle}>
          <ArrowLeft size={12} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#38BDF8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {regId}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </div>
        {(blobUrl || imageUrl) && (
          <button onClick={() => window.open((imageUrl || blobUrl)!, '_blank')} style={linkBtnStyle}>
            <ExternalLink size={10} /> New Tab
          </button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...linkBtnStyle, textDecoration: 'none' }}>
            <ExternalLink size={10} /> External
          </a>
        )}
      </div>

      {/* ── Controls bar (PDF only) ── */}
      {masterBuffer && !error && !isImage && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '6px 12px', background: 'rgba(15,23,42,0.8)',
          borderBottom: '1px solid rgba(56,189,248,0.06)',
        }}>
          {/* Mode toggle — desktop only */}
          {!isMobileDevice() && (
            <button onClick={toggleViewMode} style={ctrlBtnStyle}
              title={viewMode === 'native' ? 'Switch to scroll view' : 'Switch to full document'}>
              {viewMode === 'native' ? '\u229E' : '\u2630'}
            </button>
          )}

          {/* Search button — react-pdf mode */}
          {viewMode === 'react-pdf' && (
            <>
              <div style={dividerStyle} />
              <button
                onClick={() => { setSearchOpen(o => !o); setTimeout(() => searchInputRef.current?.focus(), 50) }}
                style={{
                  ...ctrlBtnStyle,
                  ...(searchOpen ? { background: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.3)', color: '#38BDF8' } : {}),
                }}
                title="Search (Ctrl+F)"
              >
                <Search size={12} />
              </button>
            </>
          )}

          {/* Zoom — react-pdf mode */}
          {viewMode === 'react-pdf' && (
            <>
              <div style={dividerStyle} />
              <button onClick={() => {
                if (transformRef.current) transformRef.current.zoomOut(0.3)
                else setScale(s => Math.max(0.4, s - 0.2))
              }} style={ctrlBtnStyle}>
                <ZoomOut size={12} />
              </button>
              <span style={{ fontSize: 11, color: '#64748B', minWidth: 36, textAlign: 'center', fontFamily: 'monospace' }}>
                {Math.round(scale * touchScale * 100)}%
              </span>
              <button onClick={() => {
                if (transformRef.current) transformRef.current.zoomIn(0.3)
                else setScale(s => Math.min(3, s + 0.2))
              }} style={ctrlBtnStyle}>
                <ZoomIn size={12} />
              </button>
              {touchScale > 1.05 && (
                <button
                  onClick={() => transformRef.current && transformRef.current.resetTransform()}
                  style={{ ...ctrlBtnStyle, fontSize: 11, width: 'auto', padding: '0 8px', fontFamily: 'monospace' }}
                  title="Reset zoom"
                >1:1</button>
              )}
            </>
          )}

          {/* Page count indicator */}
          {numPages && viewMode === 'react-pdf' && (
            <>
              <div style={dividerStyle} />
              <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                {numPages} pages
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Search panel (PDF only) ── */}
      {searchOpen && viewMode === 'react-pdf' && !isImage && (
        <div style={{ borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(15,23,42,0.95)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
            <Search size={12} style={{ color: '#64748B', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={textExtracting ? 'Indexing document text\u2026' : 'Search in document...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={textExtracting}
              style={{
                flex: 1, padding: '6px 8px', background: '#1E293B', border: '1px solid #334155',
                borderRadius: 6, color: '#E2E8F0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                minWidth: 100,
              }}
            />
            {matches.length > 0 && (
              <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {matchIdx + 1} of {matches.length}
              </span>
            )}
            {searchTerm.length >= 2 && matches.length === 0 && !textExtracting && (
              <span style={{ fontSize: 12, color: '#F87171', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>No matches</span>
            )}
            {textExtracting && <Spinner />}
            <button onClick={() => goToMatch('prev')} disabled={matches.length === 0}
              style={{ ...smallBtnStyle, ...(matches.length === 0 ? { opacity: 0.3 } : {}) }}>&uarr;</button>
            <button onClick={() => goToMatch('next')} disabled={matches.length === 0}
              style={{ ...smallBtnStyle, ...(matches.length === 0 ? { opacity: 0.3 } : {}) }}>&darr;</button>
            <button onClick={() => { setSearchOpen(false); setSearchTerm(''); setMatches([]) }}
              style={smallBtnStyle}>&times;</button>
          </div>

          {/* Match results list */}
          {matches.length > 0 && searchTerm.length >= 2 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', borderTop: '1px solid #1E293B' }}>
              {matches.slice(0, 60).map((m, i) => (
                <button
                  key={`${m.page}-${m.position}`}
                  onClick={() => {
                    setMatchIdx(i)
                    const el = document.getElementById(`pdf-page-${m.page}`)
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 12px',
                    background: i === matchIdx ? 'rgba(56,189,248,0.08)' : 'none',
                    border: 'none', borderBottom: '1px solid #1E293B', color: '#CBD5E1',
                    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                    width: '100%', boxSizing: 'border-box' as const,
                  }}
                >
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '2px 6px',
                    borderRadius: 4, marginTop: 1,
                  }}>
                    p.{m.page}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1.4, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.snippet}
                  </span>
                </button>
              ))}
              {matches.length > 60 && (
                <div style={{ padding: '6px 12px', fontSize: 11, color: '#64748B', textAlign: 'center' }}>
                  Showing 60 of {matches.length}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Content area ── */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 }}>
          <Spinner />
          <span style={{ color: '#64748B', fontSize: 13 }}>Loading{isImage ? ' image' : ' PDF'}...</span>
        </div>
      )}

      {error && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, textAlign: 'center' }}>
          <div style={{
            maxWidth: 360, padding: 16,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, color: '#CBD5E1', fontSize: 13, lineHeight: 1.6,
          }}>
            <strong style={{ color: '#EF4444' }}>File Unavailable</strong>
            <p style={{ margin: '8px 0 0' }}>{error}</p>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
              color: '#fff', fontSize: 12, fontWeight: 700,
              padding: '8px 16px', borderRadius: 6, textDecoration: 'none',
            }}>
              <ExternalLink size={12} /> Open External Link
            </a>
          )}
        </div>
      )}

      {/* Image viewer */}
      {!loading && !error && isImage && imageUrl && (
        <div style={{
          flex: 1, overflow: 'auto', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'center',
          padding: 16, background: '#0A101C', minHeight: 0,
        }}>
          <TransformWrapper
            initialScale={1}
            minScale={0.3}
            maxScale={5}
            centerOnInit={false}
            limitToBounds={false}
            doubleClick={{ mode: 'zoomIn', step: 0.7 }}
            pinch={{ step: 5 }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 4 }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}

      {/* Native iframe viewer (desktop) */}
      {!loading && viewMode === 'native' && blobUrl && !error && !isImage && (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <iframe
            src={blobUrl}
            title={title || 'PDF Viewer'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#FFF' }}
          />
        </div>
      )}

      {/* react-pdf scroll viewer (mobile/tablet/toggled) */}
      {!loading && viewMode === 'react-pdf' && fileData && !error && !isImage && (
        <div
          ref={viewerRef}
          style={{
            flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: 12, background: '#0A101C', minHeight: 0,
          }}
        >
          <TransformWrapper
            ref={transformRef}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit={false}
            limitToBounds={false}
            wheel={{ disabled: true }}
            doubleClick={{ mode: 'zoomIn', step: 0.7 }}
            pinch={{ step: 5 }}
            panning={{ disabled: touchScale <= 1, velocityDisabled: true }}
            onTransformed={(_, state) => { setTouchScale(state.scale) }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', maxHeight: '100%', overflow: 'visible' }}
              contentStyle={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <Document
                file={fileData}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={(err) => setError(`PDF render failed: ${err.message}`)}
                loading={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <Spinner />
                  </div>
                }
              >
                {numPages && Array.from({ length: numPages }, (_, i) => (
                  <LazyPage
                    key={`page-${i + 1}`}
                    pageNumber={i + 1}
                    scale={scale}
                    searchTerm={searchTerm}
                    scrollRoot={viewerRef}
                  />
                ))}
              </Document>
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </div>
  )
}

// ─── Shared button styles ────────────────────────────────────
const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 6,
  background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
  color: '#94A3B8', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer', whiteSpace: 'nowrap',
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 6,
  background: 'transparent', border: '1px solid rgba(56,189,248,0.2)',
  color: '#94A3B8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer', whiteSpace: 'nowrap',
}

const ctrlBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
  color: '#94A3B8', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: 15,
}

const smallBtnStyle: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 5,
  background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
  color: '#94A3B8', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const dividerStyle: React.CSSProperties = {
  width: 1, height: 18, background: '#334155', margin: '0 4px',
}
