'use client'

import { useState } from 'react'
import { X, RotateCcw, UserX, UserCheck, Trash2, Send } from 'lucide-react'
import { RANK_OPTIONS, USER_ROLES } from '@/lib/constants'
import { RoleBadge } from './role-badge'
import { UserStatusBadge } from './status-badge'
import { formatRelativeTime } from '@/lib/utils'
import type { UserCardData } from './user-card'
import type { Installation, UserRole } from '@/lib/supabase/types'

interface UserDetailModalProps {
  user: UserCardData
  isSysAdmin: boolean
  isBaseAdmin: boolean
  installations: Installation[]
  onSave: (userId: string, updates: Record<string, unknown>) => Promise<void>
  onResetPassword: (email: string, userId: string) => Promise<void>
  onDeactivate: (userId: string) => Promise<void>
  onReactivate: (userId: string) => Promise<void>
  onDelete: (userId: string) => void
  onClose: () => void
}

export function UserDetailModal({
  user,
  isSysAdmin,
  isBaseAdmin,
  installations,
  onSave,
  onResetPassword,
  onDeactivate,
  onReactivate,
  onDelete,
  onClose,
}: UserDetailModalProps) {
  const [rank, setRank] = useState(user.rank || '')
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [role, setRole] = useState(user.role)
  const [baseId, setBaseId] = useState(user.primary_base_id || '')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isDeactivated = user.status === 'deactivated'

  const roleOptions = Object.entries(USER_ROLES).map(([key, cfg]) => ({
    value: key as UserRole,
    label: cfg.label,
  }))

  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 4000)
    } else {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    try {
      const updates: Record<string, unknown> = {
        rank,
        first_name: firstName,
        last_name: lastName,
      }
      if (isSysAdmin) {
        updates.role = role
        updates.primary_base_id = baseId
      }
      await onSave(user.id, updates)
      showMessage('Profile updated')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to save', true)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    setResetting(true)
    try {
      await onResetPassword(user.email, user.id)
      showMessage(`Password reset email sent to ${user.email}`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to send reset email', true)
    } finally {
      setResetting(false)
    }
  }

  const handleToggleStatus = async () => {
    setToggling(true)
    try {
      if (isDeactivated) {
        await onReactivate(user.id)
        showMessage('User reactivated')
      } else {
        await onDeactivate(user.id)
        showMessage('User deactivated')
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to update status', true)
    } finally {
      setToggling(false)
    }
  }

  const anyLoading = saving || resetting || toggling

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>
              Edit Profile
            </div>
            <RoleBadge role={user.role} />
            <UserStatusBadge status={user.status || 'active'} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="var(--color-text-3)" />
          </button>
        </div>

        {/* Profile Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Rank */}
          <div>
            <span className="section-label">Rank</span>
            <select
              className="input-dark"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              style={{ width: '100%' }}
              disabled={anyLoading}
            >
              <option value="">Select rank...</option>
              {RANK_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* First & Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="section-label">First Name</span>
              <input
                type="text"
                className="input-dark"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span className="section-label">Last Name</span>
              <input
                type="text"
                className="input-dark"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={anyLoading}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <span className="section-label">Email</span>
            <div
              style={{
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--color-text-2)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
              }}
            >
              {user.email}
            </div>
          </div>

          {/* Role (sys admin only) */}
          {isSysAdmin ? (
            <div>
              <span className="section-label">Role</span>
              <select
                className="input-dark"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%' }}
                disabled={anyLoading}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="section-label">Role</span>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--color-text-2)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              >
                {USER_ROLES[user.role as keyof typeof USER_ROLES]?.label || user.role}
              </div>
            </div>
          )}

          {/* Installation (sys admin only) */}
          {isSysAdmin ? (
            <div>
              <span className="section-label">Assigned Installation</span>
              <select
                className="input-dark"
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                style={{ width: '100%' }}
                disabled={anyLoading}
              >
                <option value="">Select installation...</option>
                {installations.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} · {inst.icao}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="section-label">Assigned Installation</span>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--color-text-2)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              >
                {user.bases ? `${user.bases.name} · ${user.bases.icao}` : 'None'}
              </div>
            </div>
          )}

          {/* Read-only info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="section-label">Date Joined</span>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              <span className="section-label">Last Active</span>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                {user.last_seen_at ? formatRelativeTime(user.last_seen_at) : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMsg && (
          <div
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginTop: 12,
              fontSize: 12,
              color: '#22C55E',
            }}
          >
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginTop: 12,
              fontSize: 12,
              color: 'var(--color-danger)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={anyLoading}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            background: anyLoading ? 'rgba(6,182,212,0.5)' : '#06B6D4',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: anyLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            marginTop: 16,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {/* Reset Password */}
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={anyLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 12,
              fontWeight: 600,
              cursor: anyLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: anyLoading ? 0.5 : 1,
            }}
          >
            <Send size={14} />
            {resetting ? 'Sending...' : 'Send Password Reset Email'}
          </button>

          {/* Deactivate / Reactivate */}
          {isDeactivated ? (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid #22C55E',
                background: 'transparent',
                color: '#4ADE80',
                fontSize: 12,
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <UserCheck size={14} />
              {toggling ? 'Reactivating...' : 'Reactivate User'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Deactivate ${user.rank ? user.rank + ' ' : ''}${user.first_name} ${user.last_name}? They will be unable to log in until reactivated.`)) {
                  handleToggleStatus()
                }
              }}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid #EF4444',
                background: 'transparent',
                color: '#F87171',
                fontSize: 12,
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <UserX size={14} />
              {toggling ? 'Deactivating...' : 'Deactivate User'}
            </button>
          )}

          {/* Delete — sys admin only */}
          {isSysAdmin && (
            <button
              type="button"
              onClick={() => onDelete(user.id)}
              disabled={anyLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: 'none',
                background: anyLoading ? 'rgba(220,38,38,0.3)' : '#DC2626',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: anyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <Trash2 size={14} />
              Delete User Permanently
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
