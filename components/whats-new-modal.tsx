'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RELEASE_NOTES, type ReleaseNote } from '@/lib/release-notes'

interface WhatsNewModalProps {
  /** Notes to render — usually unseenReleaseNotes(profile.last_seen_release_version). */
  notes: ReleaseNote[]
  /** Fires after the user dismisses the modal AND the profile row is updated. */
  onDismiss: () => void
}

/** Pops a grouped "What's New" modal covering every release since the user
 *  last signed in. On dismiss we write the newest version back to
 *  profiles.last_seen_release_version so the modal won't fire again until the
 *  next release cuts a higher version. */
export function WhatsNewModal({ notes, onDismiss }: WhatsNewModalProps) {
  const [saving, setSaving] = useState(false)

  if (notes.length === 0) return null

  const handleDismiss = async () => {
    setSaving(true)
    const latest = RELEASE_NOTES[0]?.version
    if (latest) {
      const supabase = createClient()
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase
              .from('profiles')
              .update({ last_seen_release_version: latest } as Record<string, unknown>)
              .eq('id', user.id)
          }
        } catch {
          // Non-critical — next load will re-prompt, no harm done
        }
      }
    }
    setSaving(false)
    onDismiss()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleDismiss() }}
      style={{ padding: 24, zIndex: 10000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface-solid, #1E293B)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          width: '100%', maxWidth: 560, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--color-border-mid)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(34,211,238,0.02))',
          borderBottom: '1px solid var(--color-border-mid)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(34,211,238,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-cyan)',
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              What&rsquo;s New
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {notes.length === 1
                ? `Since you last signed in`
                : `${notes.length} updates since you last signed in`}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            disabled={saving}
            title="Close"
            style={{
              width: 34, height: 34, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid var(--color-border)',
              color: 'var(--color-text-3)', cursor: saving ? 'default' : 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 22px 8px',
        }}>
          {notes.map((n, idx) => (
            <div
              key={n.version}
              style={{
                paddingBottom: idx < notes.length - 1 ? 20 : 8,
                marginBottom: idx < notes.length - 1 ? 20 : 0,
                borderBottom: idx < notes.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-cyan)',
                  fontFamily: 'monospace', letterSpacing: '0.02em',
                }}>v{n.version}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{n.date}</span>
              </div>
              <div style={{
                fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)',
                lineHeight: 1.4, marginBottom: 10,
              }}>
                {n.headline}
              </div>
              {n.sections ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {n.sections.map((sec, si) => (
                    <div key={si}>
                      <div style={{
                        fontSize: 'var(--fs-2xs)', fontWeight: 800, color: 'var(--color-cyan)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                      }}>
                        {sec.title}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sec.items.map((it, ii) => (
                          <li
                            key={ii}
                            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.55 }}
                          >
                            {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(n.highlights ?? []).map((h, i) => (
                    <li
                      key={i}
                      style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.55 }}
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--color-border-mid)',
          display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-bg-inset)',
        }}>
          <a
            href="https://github.com/csproctor88-star/airfield-app/blob/main/CHANGELOG.md"
            target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
              textDecoration: 'none',
            }}
          >
            View full changelog →
          </a>
          <button
            onClick={handleDismiss}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--color-cyan), var(--color-accent))',
              color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
