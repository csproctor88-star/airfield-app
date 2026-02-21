'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plane } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const supabase = createClient()

      // Demo mode: no Supabase configured, go straight to app
      if (!supabase) {
        router.push('/')
        router.refresh()
        return
      }

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || undefined },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
        setPassword('')
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setSuccess(null)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: '#04070C',
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
              boxShadow: '0 0 32px rgba(56,189,248,0.2)',
            }}
          >
            <Plane size={28} color="#fff" />
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #F1F5F9, #38BDF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 4,
            }}
          >
            AIRFIELD OPS
          </div>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.12em' }}>
            SELFRIDGE ANGB &bull; KMTC &bull; 127TH WING
          </div>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
              color: '#F1F5F9',
            }}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 12 }}>
                <span className="section-label">Name</span>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Email</span>
              <input
                type="email"
                className="input-dark"
                placeholder="name@mail.mil"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Password</span>
              <input
                type="password"
                className="input-dark"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
                  fontSize: 11,
                  color: '#EF4444',
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 12,
                  fontSize: 11,
                  color: '#22C55E',
                }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading
                ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              type="button"
              onClick={switchMode}
              style={{
                background: 'none',
                border: 'none',
                color: '#38BDF8',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 10, color: '#334155' }}>
            Glidepath v2.1
          </div>
        </div>
      </div>
    </div>
  )
}
