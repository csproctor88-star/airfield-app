'use client'

import { ChevronDown } from 'lucide-react'
import type { Installation } from '@/lib/supabase/types'

interface InstallationSelectorProps {
  installations: Installation[]
  selectedId: string | null // null means "All Installations"
  isSysAdmin: boolean
  userInstallation: Installation | null
  onChange: (id: string | null) => void
}

export function InstallationSelector({
  installations,
  selectedId,
  isSysAdmin,
  userInstallation,
  onChange,
}: InstallationSelectorProps) {
  // Base admins see static text
  if (!isSysAdmin) {
    return (
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-2)',
          padding: '8px 12px',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
        }}
      >
        {userInstallation
          ? `${userInstallation.name} · ${userInstallation.icao}`
          : 'Your Installation'}
      </div>
    )
  }

  // Sys admin dropdown
  return (
    <div style={{ position: 'relative' }}>
      <select
        className="input-dark"
        value={selectedId || '__all__'}
        onChange={(e) => onChange(e.target.value === '__all__' ? null : e.target.value)}
        style={{
          width: '100%',
          fontSize: 13,
          fontWeight: 600,
          appearance: 'none',
          paddingRight: 28,
          cursor: 'pointer',
        }}
      >
        <option value="__all__">All Installations</option>
        {installations.map((inst) => (
          <option key={inst.id} value={inst.id}>
            {inst.name} · {inst.icao}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        color="var(--color-text-3)"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      />
    </div>
  )
}
