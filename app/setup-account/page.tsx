'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plane } from 'lucide-react'

export default function SetupAccountPage() {
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      if (!supabase) {
        setError('Client not available')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Update profile status from pending to active
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ status: 'active', last_seen_at: new Date().toISOString() })
          .eq('id', user.id)
      }

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
              background: 'linear-gradient(135deg, #0C4A6E, #38BDF8)',
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
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 6,
                  padding: '12px 16px',
                  fontSize: 'var(--fs-md)',
                  color: '#22C55E',
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
                Create Your Password
              </div>
              <div
                style={{
                  fontSize: 'var(--fs-base)',
                  color: 'var(--color-text-3)',
                  marginBottom: 16,
                }}
              >
                You&apos;ve been invited to Glidepath. Set a password to get started.
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <span className="section-label">Password</span>
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
                  <span className="section-label">Confirm Password</span>
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
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
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
