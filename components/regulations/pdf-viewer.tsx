'use client'

import { useState, useEffect } from 'react'
import { X, ExternalLink, ZoomIn, ZoomOut, Loader2, AlertTriangle } from 'lucide-react'

interface PdfViewerProps {
  url: string
  title: string
  regId: string
  onClose: () => void
}

export function PdfViewer({ url, title, regId, onClose }: PdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Detect if the URL is a direct PDF link vs a web page
  // Supabase signed URLs have .pdf in the path but end with ?token=...
  const isPdfUrl = /\.pdf(\?|$)/i.test(url)

  // For Google Docs viewer fallback (handles CORS/X-Frame-Options)
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`

  // Use direct embed for PDFs, Google viewer as fallback
  const [useGoogleViewer, setUseGoogleViewer] = useState(false)
  const embedUrl = isPdfUrl
    ? (useGoogleViewer ? googleViewerUrl : url)
    : url

  useEffect(() => {
    setLoading(true)
    setError(false)
    setUseGoogleViewer(false)
  }, [url])

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    if (isPdfUrl && !useGoogleViewer) {
      // Try Google Docs viewer as fallback
      setUseGoogleViewer(true)
      setLoading(true)
    } else {
      setLoading(false)
      setError(true)
    }
  }

  // Fallback after timeout — some blocked iframes don't fire onerror
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && isPdfUrl && !useGoogleViewer) {
        setUseGoogleViewer(true)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [loading, isPdfUrl, useGoogleViewer])

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
          padding: '10px 16px',
          background: '#0F172A',
          borderBottom: '1px solid #1E293B',
          flexShrink: 0,
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.15)',
              color: '#38BDF8',
              textDecoration: 'none',
            }}
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#EF4444',
              cursor: 'pointer',
            }}
            title="Close viewer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* PDF Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Loading spinner */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 10,
              background: '#0A0E1A',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid rgba(56,189,248,0.15)',
                borderTopColor: '#38BDF8',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
              Loading document...
            </div>
            {useGoogleViewer && (
              <div style={{ fontSize: 10, color: '#475569' }}>
                Using document proxy for compatibility
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 32,
              zIndex: 10,
              background: '#0A0E1A',
            }}
          >
            <AlertTriangle size={32} color="#FBBF24" />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', textAlign: 'center' }}>
              Unable to embed this document
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
              This document&apos;s server blocks in-app viewing. You can open it directly in your browser instead.
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 8,
                textDecoration: 'none',
                marginTop: 4,
              }}
            >
              <ExternalLink size={14} />
              Open in Browser
            </a>
          </div>
        )}

        {/* Iframe */}
        {!error && (
          <iframe
            key={embedUrl}
            src={embedUrl}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#fff',
            }}
            title={`${regId} — ${title}`}
            {...(!isPdfUrl ? { sandbox: 'allow-same-origin allow-scripts allow-popups allow-forms' } : {})}
          />
        )}
      </div>

      {/* Bottom bar with status */}
      <div
        style={{
          padding: '6px 16px',
          background: '#0F172A',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 9, color: '#475569' }}>
          {isPdfUrl ? 'PDF Document' : 'Web Page'} {useGoogleViewer ? '(proxied)' : '(direct)'}
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Tap &quot;Open in Browser&quot; if content doesn&apos;t display
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
