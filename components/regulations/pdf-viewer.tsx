'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search, Loader2, AlertTriangle } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { getCachedPdf, cachePdf } from '@/lib/pdf-cache'

// Configure PDF.js worker — loaded from CDN to avoid bundling the large worker file
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string          // signed URL or external URL to fetch/display
  regId: string        // used as cache key
  title: string
  onClose: () => void
}

export function PdfViewer({ url, title, regId, onClose }: PdfViewerProps) {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Measure container width for responsive page sizing
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Fetch PDF: check cache first, then fetch from URL and cache
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      setLoading(true)
      setError(null)
      setPdfData(null)

      // 1. Try IndexedDB cache
      const cached = await getCachedPdf(regId)
      if (cached && !cancelled) {
        console.log('[PdfViewer] Cache hit for', regId)
        setPdfData(cached)
        setLoading(false)
        return
      }

      // 2. Fetch from URL
      try {
        console.log('[PdfViewer] Fetching', regId, 'from URL')
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        if (cancelled) return

        setPdfData(buffer)
        setLoading(false)

        // 3. Cache for offline use (fire-and-forget)
        cachePdf(regId, buffer).catch(() => {})
      } catch (err) {
        if (cancelled) return
        console.error('[PdfViewer] Fetch failed:', err)
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setLoading(false)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [url, regId])

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    setCurrentPage(1)
  }, [])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, numPages)))
  }, [numPages])

  const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.25, 3.0)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.25, 0.5)), [])
  const fitWidth = useCallback(() => setScale(1.0), [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); setSearchText('') }
        else onClose()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (!showSearch) goToPage(currentPage + 1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (!showSearch) goToPage(currentPage - 1)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, showSearch, currentPage, goToPage])

  // Page width: fill container minus padding, then apply scale
  const pageWidth = containerWidth > 0 ? (containerWidth - 32) : 600

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0E1A',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#0F172A',
          borderBottom: '1px solid #1E293B',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#38BDF8', fontWeight: 700, marginBottom: 1 }}>
            {regId}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#F1F5F9',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 6,
              background: showSearch ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.15)',
              color: '#38BDF8', cursor: 'pointer',
            }}
            title="Search (Ctrl+F)"
          >
            <Search size={14} />
          </button>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.15)',
              color: '#38BDF8', textDecoration: 'none',
            }}
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#EF4444', cursor: 'pointer',
            }}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search bar (conditionally shown) */}
      {showSearch && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: '#1E293B',
            borderBottom: '1px solid #334155',
            flexShrink: 0,
          }}
        >
          <Search size={12} color="#64748B" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search in document... (use browser Ctrl+F for text layer search)"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#E2E8F0', fontSize: 12, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => { setShowSearch(false); setSearchText('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            <X size={12} color="#64748B" />
          </button>
        </div>
      )}

      {/* Toolbar: zoom + page nav */}
      {numPages > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '6px 12px',
            background: '#0F172A',
            borderBottom: '1px solid #1E293B',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 4,
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                color: currentPage <= 1 ? '#334155' : '#38BDF8', cursor: currentPage <= 1 ? 'default' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, minWidth: 70, textAlign: 'center' }}>
              Page {currentPage} / {numPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 4,
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                color: currentPage >= numPages ? '#334155' : '#38BDF8', cursor: currentPage >= numPages ? 'default' : 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: '#1E293B' }} />

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 4,
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                color: scale <= 0.5 ? '#334155' : '#38BDF8', cursor: scale <= 0.5 ? 'default' : 'pointer',
              }}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={fitWidth}
              style={{
                fontSize: 10, fontWeight: 700, color: '#94A3B8',
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                minWidth: 50, textAlign: 'center',
              }}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 4,
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                color: scale >= 3.0 ? '#334155' : '#38BDF8', cursor: scale >= 3.0 ? 'default' : 'pointer',
              }}
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      )}

      {/* PDF content area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Loading state */}
        {loading && (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: 48, flex: 1,
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid rgba(56,189,248,0.15)',
                borderTopColor: '#38BDF8',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
              Loading document...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: 32, flex: 1,
            }}
          >
            <AlertTriangle size={32} color="#FBBF24" />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', textAlign: 'center' }}>
              Unable to load this document
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
              {error}
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                padding: '8px 20px', borderRadius: 8, textDecoration: 'none',
                marginTop: 4,
              }}
            >
              <ExternalLink size={14} />
              Open in Browser
            </a>
          </div>
        )}

        {/* PDF document */}
        {pdfData && !error && (
          <Document
            file={{ data: pdfData }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => {
              console.error('[PdfViewer] PDF load error:', err)
              setError('Failed to parse PDF document.')
            }}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth * scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                  <Loader2 size={20} color="#38BDF8" style={{ animation: 'spin 0.8s linear infinite' }} />
                </div>
              }
            />
          </Document>
        )}
      </div>

      {/* Bottom status bar */}
      <div
        style={{
          padding: '6px 12px',
          background: '#0F172A',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 9, color: '#475569' }}>
          {pdfData ? 'Rendered locally' : 'Loading...'} — Text is selectable &amp; searchable (Ctrl+F)
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Esc to close · Arrow keys to navigate
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
