'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { RANK_OPTIONS, USER_ROLES } from '@/lib/constants'
import { BASE_DIRECTORY } from '@/lib/base-directory'
import { toTitleCaseName } from '@/lib/utils'
import type { Installation, UserRole } from '@/lib/supabase/types'

interface InviteUserModalProps {
  isSysAdmin: boolean
  callerBaseId: string | null
  installations: Installation[]
  defaultInstallationId: string | null
  onInvite: (data: {
    email: string
    rank: string
    firstName: string
    lastName: string
    unit: string
    officeSymbol: string
    civilianAirport: boolean
    role: string
    installationId: string
  }) => Promise<void>
  onClose: () => void
}

export function InviteUserModal({
  isSysAdmin,
  callerBaseId,
  installations,
  defaultInstallationId,
  onInvite,
  onClose,
}: InviteUserModalProps) {
  const [email, setEmail] = useState('')
  const [rank, setRank] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [unit, setUnit] = useState('')
  const [officeSymbol, setOfficeSymbol] = useState('')
  const [civilianAirport, setCivilianAirport] = useState(false)
  const [role, setRole] = useState<string>('')
  const [installationId, setInstallationId] = useState(
    isSysAdmin ? (defaultInstallationId || '') : (callerBaseId || ''),
  )
  const [error, setError] = useState<string | null>(null)

  // Merge DB installations with full base directory (dedup by ICAO)
  const allInstallations = useMemo(() => {
    const dbIcaos = new Set(installations.map(i => i.icao))
    const directoryExtras = BASE_DIRECTORY
      .filter(d => !dbIcaos.has(d.icao))
      .map(d => ({ id: `dir:${d.icao}`, name: d.name, icao: d.icao } as Installation))
    return [...installations, ...directoryExtras].sort((a, b) => a.name.localeCompare(b.name))
  }, [installations])
  const [loading, setLoading] = useState(false)

  // Sys admins see all roles; base admins see non-admin roles only
  const ADMIN_ONLY_ROLES: UserRole[] = ['sys_admin', 'base_admin']
  const roleOptions = Object.entries(USER_ROLES)
    .filter(([key]) => isSysAdmin || !ADMIN_ONLY_ROLES.includes(key as UserRole))
    .map(([key, cfg]) => ({
      value: key as UserRole,
      label: cfg.label,
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !rank || !firstName || !lastName || !role || !installationId) {
      setError('All fields are required')
      return
    }

    // Unit + Office Symbol required at military airfields (everyone,
    // civilians included). "Civilian airport" is the not-applicable escape.
    if (!civilianAirport && (!unit.trim() || !officeSymbol.trim())) {
      setError('Unit and Office Symbol are required (or check "Civilian airport" if not applicable)')
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      let resolvedInstId = installationId
      // If selecting a directory-only base, create it first
      if (installationId.startsWith('dir:')) {
        const icao = installationId.slice(4)
        const dirEntry = BASE_DIRECTORY.find(d => d.icao === icao)
        if (!dirEntry) { setError('Installation not found'); setLoading(false); return }
        const { createInstallation } = await import('@/lib/supabase/installations')
        const created = await createInstallation(dirEntry.name, dirEntry.icao)
        resolvedInstId = created.id
      }
      await onInvite({
        email,
        rank,
        firstName: toTitleCaseName(firstName),
        lastName: toTitleCaseName(lastName),
        unit: civilianAirport ? '' : unit.trim(),
        officeSymbol: civilianAirport ? '' : officeSymbol.trim(),
        civilianAirport,
        role,
        installationId: resolvedInstId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.6)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 360, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Invite User
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="var(--color-text-3)" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <span className="section-label">Email</span>
            <input
              type="email"
              className="input-dark"
              placeholder="name@mail.mil"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Rank */}
          <div style={{ marginBottom: 12 }}>
            <span className="section-label">Rank *</span>
            <select
              className="input-dark"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select rank...</option>
              {RANK_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* First & Last Name */}
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
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Unit & Office Symbol — required at military airfields for
              everyone (civilians included) to verify the agency. The
              "Civilian airport" checkbox marks them not applicable. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <span className="section-label">Unit{civilianAirport ? '' : ' *'}</span>
              <input
                type="text"
                className="input-dark"
                placeholder={civilianAirport ? 'N/A' : 'e.g. 115th OSS'}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={civilianAirport}
                style={{ width: '100%', boxSizing: 'border-box', opacity: civilianAirport ? 0.5 : 1 }}
              />
            </div>
            <div>
              <span className="section-label">Office Symbol{civilianAirport ? '' : ' *'}</span>
              <input
                type="text"
                className="input-dark"
                placeholder={civilianAirport ? 'N/A' : 'e.g. OSAA'}
                value={officeSymbol}
                onChange={(e) => setOfficeSymbol(e.target.value)}
                disabled={civilianAirport}
                style={{ width: '100%', boxSizing: 'border-box', opacity: civilianAirport ? 0.5 : 1 }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            <input
              type="checkbox"
              checked={civilianAirport}
              onChange={(e) => setCivilianAirport(e.target.checked)}
              style={{ accentColor: 'var(--color-cyan)' }}
            />
            Civilian airport — no military unit / office symbol
          </label>

          {/* Role */}
          <div style={{ marginBottom: 12 }}>
            <span className="section-label">Role *</span>
            <select
              className="input-dark"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select role...</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Installation */}
          <div style={{ marginBottom: 12 }}>
            <span className="section-label">Installation</span>
            <select
              className="input-dark"
              value={installationId}
              onChange={(e) => setInstallationId(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select installation...</option>
              {allInstallations.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} · {inst.icao}
                </option>
              ))}
            </select>
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
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: loading ? 'rgba(6,182,212,0.5)' : '#06B6D4',
              color: '#fff',
              fontSize: 'var(--fs-md)',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Sending invite...' : 'Send Invite'}
          </button>
        </form>
      </div>
    </div>
  )
}
