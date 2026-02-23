'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchInstallations } from '@/lib/supabase/installations'
import { USER_ROLES } from '@/lib/constants'
import type { Installation } from '@/lib/supabase/types'
import type { UserRole } from '@/lib/supabase/types'
import { Plane, ChevronDown } from 'lucide-react'

// Military ranks: A1C through Lt Col
const RANK_OPTIONS = [
  'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt',
  '2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col',
] as const

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rank, setRank] = useState('')
  const [role, setRole] = useState<UserRole>('read_only')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [installations, setInstallations] = useState<Installation[]>([])
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>('')
  const [installationSearch, setInstallationSearch] = useState('')
  const [showInstallationDropdown, setShowInstallationDropdown] = useState(false)
  const installationRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load available installations for signup selection
  useEffect(() => {
    fetchInstallations().then((b) => {
      setInstallations(b)
      if (b.length > 0) setSelectedInstallationId(b[0].id)
    })
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

  const filteredInstallations = useMemo(() => {
    if (!installationSearch.trim()) return installations
    const q = installationSearch.toLowerCase()
    return installations.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.icao.toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q)
    )
  }, [installations, installationSearch])

  const selectedInstallation = installations.find(i => i.id === selectedInstallationId)

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
              primary_base_id: selectedInstallationId || undefined,
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

  // Dynamic header from first installation or fallback
  const displayInstallation = installations.length > 0 ? installations[0] : null
  const headerText = displayInstallation
    ? `${displayInstallation.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').toUpperCase()} \u2022 ${displayInstallation.icao} \u2022 ${(displayInstallation.unit || '').toUpperCase()}`
    : 'AIRFIELD OPS'

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
            GLIDEPATH
          </div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.12em' }}>
            {headerText}
          </div>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 16,
              color: '#F1F5F9',
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

                {/* Installation (searchable dropdown) */}
                <div style={{ marginBottom: 12 }} ref={installationRef}>
                  <span className="section-label">Installation</span>
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
                      <span style={{ color: selectedInstallation ? '#F1F5F9' : '#64748B' }}>
                        {selectedInstallation
                          ? `${selectedInstallation.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '')} (${selectedInstallation.icao})`
                          : 'Select installation...'}
                      </span>
                      <ChevronDown size={14} color="#64748B" />
                    </button>

                    {showInstallationDropdown && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 100, marginTop: 4,
                        background: '#0F1729',
                        border: '1px solid rgba(56,189,248,0.15)',
                        borderRadius: 8,
                        maxHeight: 200, overflowY: 'auto',
                      }}>
                        {/* Search input */}
                        <div style={{ padding: 8, borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
                          <input
                            type="text"
                            placeholder="Search installations..."
                            value={installationSearch}
                            onChange={(e) => setInstallationSearch(e.target.value)}
                            className="input-dark"
                            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
                            autoFocus
                          />
                        </div>
                        {filteredInstallations.length === 0 ? (
                          <div style={{ padding: '12px 14px', fontSize: 12, color: '#64748B' }}>
                            No installations found
                          </div>
                        ) : (
                          filteredInstallations.map(inst => {
                            const shortName = inst.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').trim()
                            const stateAbbr = inst.location?.split(',').pop()?.trim() || ''
                            return (
                              <button
                                key={inst.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInstallationId(inst.id)
                                  setShowInstallationDropdown(false)
                                  setInstallationSearch('')
                                }}
                                style={{
                                  display: 'block', width: '100%', padding: '10px 14px',
                                  background: inst.id === selectedInstallationId ? 'rgba(56,189,248,0.08)' : 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid rgba(56,189,248,0.04)',
                                  cursor: 'pointer', textAlign: 'left',
                                  color: inst.id === selectedInstallationId ? '#38BDF8' : '#E2E8F0',
                                  fontSize: 13, fontFamily: 'inherit',
                                  fontWeight: inst.id === selectedInstallationId ? 700 : 500,
                                }}
                              >
                                {shortName}{stateAbbr ? `, ${stateAbbr}` : ''}
                                <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.5 }}>{inst.icao}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
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
                  fontSize: 12,
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
                  fontSize: 12,
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
                fontSize: 12,
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
          <div style={{ fontSize: 11, color: '#334155' }}>
            Glidepath v2.1
          </div>
        </div>
      </div>
    </div>
  )
}
