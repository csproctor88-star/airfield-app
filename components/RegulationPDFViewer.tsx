'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ExternalLink, ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const BUCKET_NAME = 'regulation-pdfs'

function sanitizeFileName(regId: string): string {
  return regId
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/,\s*/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .toLowerCase()
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

interface RegulationPDFViewerProps {
  regId: string
  title: string
  url: string | null
  onClose: () => void
}

export default function RegulationPDFViewer({ regId, title, url, onClose }: RegulationPDFViewerProps) {
  const supabase = createClient()
  const viewerRef = useRef<HTMLDivElement>(null)

  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load PDF from Supabase storage
  useEffect(() => {
    let cancelled = false
    const fileName = `${sanitizeFileName(regId)}.pdf`

    async function loadPdf() {
      setLoading(true)
      setError(null)
      setPdfData(null)
      setNumPages(null)
      setCurrentPage(1)

      try {
        if (supabase) {
          const { data, error: dlErr } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileName)
          if (!dlErr && data && !cancelled) {
            const uint8 = new Uint8Array(await data.arrayBuffer())
            setPdfData(uint8)
            setLoading(false)
            return
          }
        }

        if (!cancelled) {
          if (url) {
            setError('PDF not found in storage. Use "Open External" to view this document, or ask an admin to run the download script.')
          } else {
            setError('PDF not available. This regulation has no external URL and is not yet in storage. Ask an admin to upload it.')
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Failed to load PDF: ${msg}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [regId, url, supabase])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCurrentPage(p => Math.min(p + 1, numPages || p))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCurrentPage(p => Math.max(p - 1, 1))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [numPages, onClose])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0A101C' }}>
      {/* Viewer header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(56,189,248,0.1)',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 6,
            background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
            color: '#94A3B8', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <ArrowLeft size={12} />
          Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {regId}
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 6,
              background: 'transparent', border: '1px solid rgba(56,189,248,0.2)',
              color: '#94A3B8', fontSize: 10, fontWeight: 600, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <ExternalLink size={10} />
            External
          </a>
        )}
      </div>

      {/* Page controls */}
      {pdfData && !error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '6px 12px', background: 'rgba(15,23,42,0.8)',
          borderBottom: '1px solid rgba(56,189,248,0.06)',
        }}>
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
              color: '#94A3B8', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ZoomOut size={12} />
          </button>
          <span style={{ fontSize: 10, color: '#64748B', minWidth: 36, textAlign: 'center', fontFamily: 'monospace' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(3, s + 0.2))}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
              color: '#94A3B8', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ZoomIn size={12} />
          </button>
          <div style={{ width: 1, height: 18, background: '#334155', margin: '0 4px' }} />
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
              color: currentPage <= 1 ? '#334155' : '#94A3B8', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 10, color: '#94A3B8', minWidth: 50, textAlign: 'center', fontFamily: 'monospace' }}>
            {currentPage} / {numPages || '\u2013'}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))}
            disabled={currentPage >= (numPages || 1)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(241,245,249,0.05)', border: '1px solid #334155',
              color: currentPage >= (numPages || 1) ? '#334155' : '#94A3B8',
              cursor: currentPage >= (numPages || 1) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* PDF content area */}
      <div ref={viewerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 12, background: '#0A101C' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 }}>
            <Spinner />
            <span style={{ color: '#64748B', fontSize: 12 }}>Loading PDF...</span>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, textAlign: 'center' }}>
            <div style={{
              maxWidth: 360, padding: 16,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, color: '#CBD5E1', fontSize: 12, lineHeight: 1.6,
            }}>
              <strong style={{ color: '#EF4444' }}>PDF Unavailable</strong>
              <p style={{ margin: '8px 0 0' }}>{error}</p>
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  padding: '8px 16px', borderRadius: 6, textDecoration: 'none',
                }}
              >
                <ExternalLink size={12} />
                Open External Link
              </a>
            )}
          </div>
        )}
        {pdfData && !error && (
          <Document
            file={{ data: pdfData }}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(err) => setError(`PDF render failed: ${err.message}`)}
            loading={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <Spinner />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 40 }}>
                  <Spinner />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  )
}
