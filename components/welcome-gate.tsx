'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GraduationCap, Wrench, ArrowRight } from 'lucide-react'
import { RELEASE_NOTES } from '@/lib/release-notes'

/**
 * First-login welcome dialog. Two variants based on whether the user
 * holds `base_setup:write`:
 *
 *   • Base admin → directs them to the Base Setup wizard.
 *   • Everyone else → points them at /training as the learning surface
 *     and warns that some modules will look empty until the base admin
 *     finishes setup.
 *
 * Gated on `profiles.tours_completed.welcome`. Stamps
 * `last_seen_release_version` to the latest on dismiss so the
 * separate WhatsNewGate doesn't immediately stack on top of this one
 * for brand-new users.
 *
 * Kiosk roles (airfield_status, atc) skip this entirely.
 */
export function WelcomeGate() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [isBaseAdmin, setIsBaseAdmin] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    if (!supabase) return

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled || !user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('tours_completed, role')
          .eq('id', user.id)
          .single()
        if (cancelled) return

        const tours = (profile as { tours_completed?: Record<string, boolean> } | null)?.tours_completed ?? {}
        if (tours.welcome) return

        const role = (profile as { role?: string } | null)?.role
        if (role === 'airfield_status' || role === 'atc') return

        // SECURITY DEFINER RPC mirrors usePermissions() but works in
        // any client component without re-implementing role/override
        // resolution.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hasWrite } = await (supabase as any).rpc('user_has_permission', {
          p_user_id: user.id,
          p_key: 'base_setup:write',
        })
        if (cancelled) return

        setIsBaseAdmin(Boolean(hasWrite))
        setShow(true)
      } catch {
        // Missing column / network hiccup — skip silently.
      }
    })()

    return () => { cancelled = true }
  }, [])

  async function dismiss(opts: { goToSetup?: boolean; goToTraining?: boolean } = {}) {
    if (busy) return
    setBusy(true)

    const supabase = createClient()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tours_completed')
            .eq('id', user.id)
            .single()
          const current =
            (profile as { tours_completed?: Record<string, boolean> } | null)?.tours_completed ?? {}
          const latestVersion = RELEASE_NOTES[0]?.version ?? null

          await supabase
            .from('profiles')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({
              tours_completed: { ...current, welcome: true },
              ...(latestVersion ? { last_seen_release_version: latestVersion } : {}),
            } as any)
            .eq('id', user.id)
        }
      } catch {
        // Best-effort — don't block dismissal on a write failure.
      }
    }

    setShow(false)
    if (opts.goToSetup) {
      router.push('/base-config/setup')
    } else if (opts.goToTraining) {
      router.push('/training')
    }
  }

  if (!show) return null

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void dismiss()
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface-solid, #1a1a2e)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 480,
          border: '1px solid var(--color-border-mid, #333)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-cyan) 28%, transparent)',
            margin: '0 auto',
          }}
        >
          {isBaseAdmin ? (
            <Wrench size={26} color="var(--color-cyan)" strokeWidth={2} />
          ) : (
            <GraduationCap size={26} color="var(--color-cyan)" strokeWidth={2} />
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 'var(--fs-2xl)',
              fontWeight: 800,
              color: 'var(--color-text-1)',
              marginBottom: 6,
            }}
          >
            Welcome to Glidepath
          </div>
          <div
            style={{
              fontSize: 'var(--fs-md)',
              color: 'var(--color-text-2)',
              lineHeight: 1.55,
            }}
          >
            {isBaseAdmin ? (
              <>
                Let&apos;s get your base configured. The Base Setup wizard
                walks through 16 short steps — runways, NAVAIDs, ARFF, QRC
                templates, the works — and seeds defaults from your ICAO
                where it can. You can pause and resume any time.
              </>
            ) : (
              <>
                Visit{' '}
                <strong style={{ color: 'var(--color-text-1)' }}>Glidepath Training</strong>{' '}
                in the sidebar to learn how each module works — overviews,
                screenshots, and step-by-step workflows for every feature.
                Until your base administrator finishes setup, some modules
                will look empty — that&apos;s expected.
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          {isBaseAdmin ? (
            <>
              <button
                type="button"
                onClick={() => void dismiss()}
                disabled={busy}
                style={secondaryBtnStyle}
              >
                I&apos;ll do this later
              </button>
              <button
                type="button"
                onClick={() => void dismiss({ goToSetup: true })}
                disabled={busy}
                style={primaryBtnStyle}
              >
                Go to Base Setup
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void dismiss()}
                disabled={busy}
                style={secondaryBtnStyle}
              >
                I&apos;ll explore later
              </button>
              <button
                type="button"
                onClick={() => void dismiss({ goToTraining: true })}
                disabled={busy}
                style={primaryBtnStyle}
              >
                Open Training
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-cyan)',
  color: 'var(--color-cyan-btn-text, #000)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-2)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
