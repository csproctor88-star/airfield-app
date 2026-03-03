'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createInstallation } from '@/lib/supabase/installations'
import { USER_ROLES } from '@/lib/constants'
import { BASE_DIRECTORY, type BaseDirectoryEntry } from '@/lib/base-directory'
import type { UserRole } from '@/lib/supabase/types'
import { ChevronDown } from 'lucide-react'

// Military ranks: A1C through Lt Col
const RANK_OPTIONS = [
  'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt',
  '2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col',
] as const

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rank, setRank] = useState('')
  const [role, setRole] = useState<UserRole>('read_only')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [selectedBase, setSelectedBase] = useState<BaseDirectoryEntry>(BASE_DIRECTORY[0])
  const [installationSearch, setInstallationSearch] = useState('')
  const [showInstallationDropdown, setShowInstallationDropdown] = useState(false)
  const [addingNewInstallation, setAddingNewInstallation] = useState(false)
  const [newInstallationName, setNewInstallationName] = useState('')
  const [newInstallationIcao, setNewInstallationIcao] = useState('')
  const installationRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load remembered email on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('glidepath_remember_email')
      if (saved) {
        setEmail(saved)
        setRememberMe(true)
      }
    } catch { /* noop */ }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (installationRef.current && !installationRef.current.contains(e.target as Node)) {
        setShowInstallationDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredBases = useMemo(() => {
    if (!installationSearch.trim()) return [...BASE_DIRECTORY]
    const q = installationSearch.toLowerCase()
    return BASE_DIRECTORY.filter(entry => entry.name.toLowerCase().includes(q) || entry.icao.toLowerCase().includes(q))
  }, [installationSearch])

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address, then click Forgot Password')
      return
    }
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const supabase = createClient()
      if (!supabase) return
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess('Password reset email sent! Check your inbox.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

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
        if (!firstName.trim() || !lastName.trim()) {
          setError('First name and last name are required')
          setLoading(false)
          return
        }

        // Determine installation name and ICAO, then find-or-create in DB
        const installationName = addingNewInstallation
          ? newInstallationName.trim()
          : selectedBase.name
        const installationIcao = addingNewInstallation
          ? (newInstallationIcao.trim() || undefined)
          : (selectedBase.icao || undefined)

        if (!installationName) {
          setError('Please select or enter an installation')
          setLoading(false)
          return
        }

        const inst = await createInstallation(
          installationName,
          installationIcao,
        )

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              name: `${firstName.trim()} ${lastName.trim()}`,
              rank: rank || undefined,
              role: role,
              primary_base_id: inst.id,
            },
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

      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Check if user account is deactivated
      if (signInData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status, last_seen_at')
          .eq('id', signInData.user.id)
          .single()

        if (profile?.status === 'deactivated') {
          await supabase.auth.signOut()
          setError('Your account has been deactivated. Contact your administrator.')
          return
        }

        // Stash previous login timestamp so the dashboard can show
        // activity that happened while the user was away
        if (profile?.last_seen_at) {
          try { sessionStorage.setItem('glidepath_previous_login_at', profile.last_seen_at) } catch { /* noop */ }
        }

        // Update last_seen_at on successful login
        await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', signInData.user.id)
      }

      // Save or clear remembered email
      try {
        if (rememberMe) {
          localStorage.setItem('glidepath_remember_email', email)
        } else {
          localStorage.removeItem('glidepath_remember_email')
        }
      } catch { /* noop */ }

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

  // Role options from USER_ROLES
  const roleOptions = Object.entries(USER_ROLES).map(([key, cfg]) => ({
    value: key as UserRole,
    label: cfg.label,
  }))

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
          <img src="/glidepath2.png" alt="Glidepath" style={{ display: 'block', width: '100%', maxWidth: 340, height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginTop: 8 }}>
            GUIDING YOU TO MISSION SUCCESS
          </div>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              marginBottom: 16,
              color: 'var(--color-text-1)',
            }}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                {/* Rank */}
                <div style={{ marginBottom: 12 }}>
                  <span className="section-label">Rank</span>
                  <select
                    className="input-dark"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select rank...</option>
                    {RANK_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* First Name & Last Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <span className="section-label">First Name</span>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <span className="section-label">Last Name</span>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Installation (searchable dropdown or add new) */}
                <div style={{ marginBottom: 12 }} ref={installationRef}>
                  <span className="section-label">Installation</span>
                  {!addingNewInstallation ? (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setShowInstallationDropdown(!showInstallationDropdown)}
                        className="input-dark"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ color: selectedBase ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
                          {selectedBase ? `${selectedBase.name}${selectedBase.icao ? ` (${selectedBase.icao})` : ''}` : 'Select installation...'}
                        </span>
                        <ChevronDown size={14} color="var(--color-text-3)" />
                      </button>

                      {showInstallationDropdown && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          zIndex: 100, marginTop: 4,
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-mid)',
                          borderRadius: 8,
                          maxHeight: 200, overflowY: 'auto',
                        }}>
                          {/* Search input */}
                          <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                            <input
                              type="text"
                              placeholder="Search installations..."
                              value={installationSearch}
                              onChange={(e) => setInstallationSearch(e.target.value)}
                              className="input-dark"
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-base)' }}
                              autoFocus
                            />
                          </div>
                          {filteredBases.length === 0 ? (
                            <div style={{ padding: '12px 14px', fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                              No installations found
                            </div>
                          ) : (
                            filteredBases.map(entry => (
                              <button
                                key={entry.name}
                                type="button"
                                onClick={() => {
                                  setSelectedBase(entry)
                                  setShowInstallationDropdown(false)
                                  setInstallationSearch('')
                                }}
                                style={{
                                  display: 'block', width: '100%', padding: '10px 14px',
                                  background: entry.name === selectedBase.name ? 'rgba(56,189,248,0.08)' : 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid var(--color-border)',
                                  cursor: 'pointer', textAlign: 'left',
                                  color: entry.name === selectedBase.name ? 'var(--color-accent)' : 'var(--color-text-1)',
                                  fontSize: 'var(--fs-md)', fontFamily: 'inherit',
                                  fontWeight: entry.name === selectedBase.name ? 700 : 500,
                                }}
                              >
                                {entry.name}
                                {entry.icao && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 8, opacity: 0.5 }}>{entry.icao}</span>}
                              </button>
                            ))
                          )}
                          {/* Add new option */}
                          <button
                            type="button"
                            onClick={() => {
                              setAddingNewInstallation(true)
                              setShowInstallationDropdown(false)
                              setInstallationSearch('')
                            }}
                            style={{
                              display: 'block', width: '100%', padding: '10px 14px',
                              background: 'transparent',
                              border: 'none',
                              borderTop: '1px solid var(--color-border-mid)',
                              cursor: 'pointer', textAlign: 'left',
                              color: 'var(--color-accent)',
                              fontSize: 'var(--fs-md)', fontFamily: 'inherit',
                              fontWeight: 600,
                            }}
                          >
                            + Add New Installation
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Installation name"
                        value={newInstallationName}
                        onChange={(e) => setNewInstallationName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                        autoFocus
                      />
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="ICAO code (optional)"
                        value={newInstallationIcao}
                        onChange={(e) => setNewInstallationIcao(e.target.value.toUpperCase())}
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAddingNewInstallation(false)
                          setNewInstallationName('')
                          setNewInstallationIcao('')
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: 0,
                        }}
                      >
                        Cancel — select from list
                      </button>
                    </div>
                  )}
                </div>

                {/* Role */}
                <div style={{ marginBottom: 12 }}>
                  <span className="section-label">Role</span>
                  <select
                    className="input-dark"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    style={{ width: '100%' }}
                  >
                    {roleOptions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Email</span>
              <input
                type="email"
                className="input-dark"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {mode === 'signup' && (
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                  Please use a personal email on a non-government network.
                </div>
              )}
            </div>
            <div style={{ marginBottom: mode === 'signin' ? 8 : 16 }}>
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

            {mode === 'signin' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--color-cyan)' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    fontSize: 'var(--fs-sm)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

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

            {success && (
              <div
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 12,
                  fontSize: 'var(--fs-base)',
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
                color: 'var(--color-accent)',
                fontSize: 'var(--fs-base)',
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
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-4)' }}>
            Glidepath v2.11
          </div>
        </div>
      </div>
    </div>
  )
}
