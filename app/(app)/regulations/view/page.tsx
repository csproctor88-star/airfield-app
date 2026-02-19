'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { fetchRegulation, getRegulationPdfSignedUrl } from '@/lib/supabase/regulations'
import type { RegulationRow } from '@/lib/supabase/regulations'

function RegulationViewer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const regId = searchParams.get('id')

  const [regulation, setRegulation] = useState<RegulationRow | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!regId) {
      setError('No regulation ID provided.')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const reg = await fetchRegulation(regId!)
      if (cancelled) return

      if (!reg) {
        setError('Regulation not found.')
        setLoading(false)
        return
      }

      setRegulation(reg)

      if (reg.storage_path) {
        const signedUrl = await getRegulationPdfSignedUrl(reg.storage_path)
        if (cancelled) return

        if (signedUrl) {
          setPdfUrl(signedUrl)
        } else {
          setError('Unable to load PDF from storage.')
        }
      } else if (reg.url) {
        setPdfUrl(reg.url)
      } else {
        setError('No PDF available for this regulation.')
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [regId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        borderBottom: '1px solid rgba(56,189,248,0.08)',
        background: 'rgba(10,16,28,0.95)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94A3B8', padding: 4, display: 'flex',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {regulation ? (
            <>
              <div style={{ fontSize: 10, color: '#38BDF8', fontWeight: 700 }}>{regulation.reg_id}</div>
              <div style={{
                fontSize: 11, color: '#E2E8F0', fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {regulation.title}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#64748B' }}>Loading...</div>
          )}
        </div>
        {regulation?.url && (
          <a
            href={regulation.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#94A3B8', fontSize: 10, fontWeight: 600,
              textDecoration: 'none', padding: '4px 8px',
              border: '1px solid rgba(56,189,248,0.15)', borderRadius: 5,
              flexShrink: 0,
            }}
          >
            <ExternalLink size={11} />
            Source
          </a>
        )}
      </div>

      {/* PDF area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 12, color: '#64748B',
          }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>Loading PDF...</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 12, color: '#F87171', padding: 32, textAlign: 'center',
          }}>
            <AlertTriangle size={28} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>{error}</div>
            <button
              onClick={() => router.back()}
              style={{
                marginTop: 8, padding: '8px 20px', borderRadius: 6,
                background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                color: '#38BDF8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Go Back
            </button>
          </div>
        )}

        {!loading && !error && pdfUrl && (
          <iframe
            src={pdfUrl}
            title={regulation?.title ?? 'Regulation PDF'}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#1E293B',
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function RegulationViewerPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 120px)', gap: 12, color: '#64748B',
      }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>Loading...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <RegulationViewer />
    </Suspense>
  )
}
