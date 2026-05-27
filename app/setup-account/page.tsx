'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plane } from 'lucide-react'

export default function SetupAccountPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setError(null)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentPassword) {
      setError('Current password is required')
      return
    }

    if (password.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (currentPassword === password) {
      setError('New password must be different from current password')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      if (!supabase) {
        setError('Client not available')
        return
      }

      // Reauthenticate with the current password before updating.
      // Supabase's secure-password-change guard requires either a
      // recent reauthentication or a nonce — re-signing in is the
      // simplest way to satisfy it AND it verifies the user actually
      // knows the current password (defense against session hijack
      // where someone with a stolen cookie tries to lock the real
      // owner out by changing the password).
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Could not identify your account. Sign in again and retry.')
        return
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (reauthError) {
        const msg = reauthError.message?.toLowerCase() || ''
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setError('Current password is incorrect')
        } else {
          setError(reauthError.message || 'Could not verify current password')
        }
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Clear must_change_password so subsequent sign-ins skip the
      // setup redirect, stamp last_seen_at, and (legacy invite-link
      // flow) flip status active → active for any user that arrived
      // via the old /auth/confirm path with status='pending'.
      await supabase
        .from('profiles')
        .update({
          status: 'active',
          must_change_password: false,
          last_seen_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id)

      setSuccess(true)
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 0 32px var(--color-accent-glow)',
            }}
          >
            <Plane size={28} color="#fff" />
          </div>
          <div
            style={{
              fontSize: 'var(--fs-4xl)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, var(--color-logo-start), var(--color-logo-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 4,
            }}
          >
            GLIDEPATH
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em' }}>
            WELCOME — SET UP YOUR ACCOUNT
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                  borderRadius: 6,
                  padding: '12px 16px',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--color-success)',
                  marginBottom: 12,
                }}
              >
                Account ready! Redirecting to Glidepath...
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 'var(--fs-xl)',
                  fontWeight: 700,
                  marginBottom: 6,
                  color: 'var(--color-text-1)',
                }}
              >
                Set a New Password
              </div>
              <div
                style={{
                  fontSize: 'var(--fs-base)',
                  color: 'var(--color-text-3)',
                  marginBottom: 16,
                }}
              >
                Enter your current (temporary) password, then choose a new one.
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <span className="section-label">Current Password</span>
                  <input
                    type="password"
                    className="input-dark"
                    placeholder="Temporary password from invite"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={!sessionReady}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span className="section-label">New Password</span>
                  <input
                    type="password"
                    className="input-dark"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={!sessionReady}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <span className="section-label">Confirm New Password</span>
                  <input
                    type="password"
                    className="input-dark"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={!sessionReady}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      marginBottom: 12,
                      fontSize: 'var(--fs-base)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="btn-primary"
                  style={{ opacity: loading || !sessionReady ? 0.7 : 1 }}
                >
                  {loading ? 'Setting up...' : 'Get Started'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
