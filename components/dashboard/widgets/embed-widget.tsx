'use client'
import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type EmbedConfig = { title?: string; url?: string }
function normUrl(u: string): string {
  const t = (u || '').trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function EmbedWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as EmbedConfig
  const url = normUrl(c.url ?? '')
  const [loaded, setLoaded] = useState(false)
  const [refused, setRefused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLoaded(false); setRefused(false)
    if (!url) return
    timer.current = setTimeout(() => { setRefused(true) }, 4000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [url])

  if (!url) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No URL set. Edit this widget to add a website.</div>
  }
  if (refused && !loaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This site can&rsquo;t be embedded.</div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontWeight: 600,
          fontSize: 'var(--fs-sm)', textDecoration: 'none',
        }}><ExternalLink size={14} /> Open in new tab</a>
      </div>
    )
  }
  return (
    <iframe
      src={url}
      title={c.title || 'Embedded site'}
      onLoad={() => { setLoaded(true); if (timer.current) clearTimeout(timer.current) }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-sm)' }}
    />
  )
}

export function EmbedConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as EmbedConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [url, setUrl] = useState(c.url ?? '')
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      <input style={input} placeholder="https://… (some sites block embedding)" value={url} onChange={e => setUrl(e.target.value)} />
      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
        Tip: many .mil / external sites refuse to be embedded. If this site shows a blank box, use a Links widget instead.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ title: title.trim() || undefined, url: url.trim() })} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit',
        }}>Save</button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}
