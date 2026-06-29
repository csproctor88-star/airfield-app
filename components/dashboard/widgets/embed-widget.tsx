'use client'
import { useState } from 'react'
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

  if (!url) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No URL set. Edit this widget to add a website.</div>
  }

  // Cross-origin frame-blocking (X-Frame-Options / frame-ancestors) cannot be
  // detected reliably from JS — a blocked iframe still fires onLoad with a blank
  // page. So we always surface a persistent "Open" escape hatch in the header;
  // if the iframe renders blank, the site refuses embedding and the link works.
  let host = url
  try { host = new URL(url).hostname } catch { /* keep raw url */ }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        paddingBottom: 6, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{c.title || host}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open in new tab" style={{
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          color: 'var(--color-accent)', fontSize: 'var(--fs-2xs)', fontWeight: 600, textDecoration: 'none',
        }}><ExternalLink size={13} /> Open</a>
      </div>
      <iframe
        src={url}
        title={c.title || 'Embedded site'}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        style={{
          width: '100%', flex: 1, minHeight: 0, height: '100%', border: 'none',
          borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-inset)',
        }}
      />
    </div>
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
