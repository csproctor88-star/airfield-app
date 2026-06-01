'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, MapPin, BookOpen, HardDrive, Info, LogOut, Save, Trash2, Download, X, ExternalLink, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { useTheme, type ThemePreference } from '@/lib/theme-context'
import { useDesign } from '@/lib/design-context'
import { USER_ROLES } from '@/lib/constants'
import { createInstallation } from '@/lib/supabase/installations'
import { BASE_DIRECTORY } from '@/lib/base-directory'
import { ALL_REGULATIONS } from '@/lib/regulations-data'
import { idbGetAllKeys, idbGetAll, idbSet, idbDelete, idbClear, STORE_BLOBS, STORE_USER_BLOBS } from '@/lib/idb'
import { sanitizeRegId as sanitizeFileName } from '@/lib/utils'
import { precacheTiles, getCachedTileCount, clearTileCache, type PrecacheProgress } from '@/lib/tile-precache'
import type { UserRole } from '@/lib/supabase/types'
import ContactSupport from '@/components/ui/contact-support'

// ═══════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { userRole } = useInstallation()
  const { has } = usePermissions()
  const isCes = userRole === 'ces'

  return (
    <div className="page-container" data-tour="settings-header">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>Settings</div>
      <CollapsibleSection label="PROFILE" icon={User}>
        <ProfileSectionContent />
      </CollapsibleSection>
      <CollapsibleSection label="INSTALLATION" icon={MapPin}>
        <InstallationSectionContent />
      </CollapsibleSection>
      {has(PERM.EXPORTS_READ) && (
        <CollapsibleSection label="RECORDS EXPORT" icon={Download}>
          <RecordsExportSectionContent />
        </CollapsibleSection>
      )}
      {has(PERM.LIBRARY_VIEW) && (
        <CollapsibleSection label="PDF LIBRARY" icon={BookOpen}>
          <PdfLibrarySectionContent />
        </CollapsibleSection>
      )}
      {!isCes && (
        <>
          <CollapsibleSection label="DATA & STORAGE" icon={HardDrive}>
            <StorageSectionContent />
          </CollapsibleSection>
          <CollapsibleSection label="REGULATIONS LIBRARY" icon={BookOpen}>
            <RegulationsSectionContent />
          </CollapsibleSection>
        </>
      )}
      <CollapsibleSection label="APPEARANCE" icon={Sun}>
        <ThemeSectionContent />
      </CollapsibleSection>
      <CollapsibleSection label="ABOUT" icon={Info} defaultOpen>
        <AboutSectionContent />
      </CollapsibleSection>
      <SignOutSection />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section: Records Export (link to /settings/exports)
// ═══════════════════════════════════════════════════════════════

function RecordsExportSectionContent() {
  const router = useRouter()
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
        Produce filable, reviewable records (PDF, Excel) you can use and store outside Glidepath —
        for Air Force records disposition and the &quot;leaving Glidepath&quot; case. Generation runs
        in your browser; record data never leaves this device.
      </div>
      <button
        type="button"
        onClick={() => router.push('/settings/exports')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          alignSelf: 'flex-start',
          background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
          border: 'none', borderRadius: 'var(--radius-base)', padding: '10px 16px',
          color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Download size={14} />
        Open Records Export
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section: PDF Library (link to /library — sys-admin only via library:view)
// ═══════════════════════════════════════════════════════════════

function PdfLibrarySectionContent() {
  const router = useRouter()
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
        Browse and manage the generated PDF library. This is a system-administration tool and
        isn&apos;t shown in the main navigation.
      </div>
      <button
        type="button"
        onClick={() => router.push('/library')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          alignSelf: 'flex-start',
          background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
          border: 'none', borderRadius: 'var(--radius-base)', padding: '10px 16px',
          color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <BookOpen size={14} />
        Open PDF Library
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════

function CollapsibleSection({
  label,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  label: string
  icon: React.ComponentType<{ size: number; color: string }>
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: open ? 8 : 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Icon size={12} color="var(--color-text-3)" />
        <div className="section-label" style={{ marginBottom: 0, flex: 1, textAlign: 'left' }}>{label}</div>
        <ChevronDown
          size={14}
          color="var(--color-text-3)"
          style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {open && children}
    </div>
  )
}

function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ComponentType<{ size: number; color: string }> }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: 8, marginTop: 24,
    }}>
      <Icon size={12} color="var(--color-text-3)" />
      <div className="section-label" style={{ marginBottom: 0 }}>{label}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 1: Profile (read-only)
// ═══════════════════════════════════════════════════════════════

function ProfileSectionContent() {
  const { currentInstallation, defaultPdfEmail, updateDefaultPdfEmail } = useInstallation()
  const [profile, setProfile] = useState<{
    name: string
    rank: string | null
    email: string
    role: UserRole
    installationName: string | null
    operatingInitials: string | null
    unit: string | null
    officeSymbol: string | null
  } | null>(null)
  const [pdfEmail, setPdfEmail] = useState(defaultPdfEmail || '')
  const [savingEmail, setSavingEmail] = useState(false)
  const [oi, setOi] = useState('')
  const [savingOi, setSavingOi] = useState(false)
  const [unit, setUnit] = useState('')
  const [savingUnit, setSavingUnit] = useState(false)
  const [officeSymbol, setOfficeSymbol] = useState('')
  const [savingOfficeSymbol, setSavingOfficeSymbol] = useState(false)
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [savingAccountEmail, setSavingAccountEmail] = useState(false)
  const [showAccountEmailConfirm, setShowAccountEmailConfirm] = useState(false)

  useEffect(() => {
    setPdfEmail(defaultPdfEmail || '')
  }, [defaultPdfEmail])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setProfile({ name: 'Demo User', rank: 'MSgt', email: 'demo@glidepath.app', role: 'sys_admin', installationName: currentInstallation?.name ?? 'Demo Base', operatingInitials: 'DU', unit: '127th OSS', officeSymbol: 'OSAA' })
        setOi('DU')
        setUnit('127th OSS')
        setOfficeSymbol('OSAA')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('name, rank, role, primary_base_id, operating_initials, unit, office_symbol')
        .eq('id', user.id)
        .single<{
          name: string | null
          rank: string | null
          role: string | null
          primary_base_id: string | null
          operating_initials: string | null
          unit: string | null
          office_symbol: string | null
        }>()

      let installationName: string | null = null
      if (p?.primary_base_id) {
        const { data: inst } = await supabase
          .from('bases')
          .select('name, location')
          .eq('id', p.primary_base_id)
          .single()
        if (inst) {
          const shortName = inst.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').trim()
          installationName = inst.location
            ? `${shortName}, ${inst.location.split(',').pop()?.trim() || ''}`
            : shortName
        }
      }

      setProfile({
        name: p?.name || '',
        rank: p?.rank || null,
        email: user.email || '',
        role: (p?.role || 'read_only') as UserRole,
        installationName,
        operatingInitials: p?.operating_initials || null,
        unit: p?.unit || null,
        officeSymbol: p?.office_symbol || null,
      })
      setOi(p?.operating_initials || '')
      setUnit(p?.unit || '')
      setOfficeSymbol(p?.office_symbol || '')
      setNewAccountEmail(user.email || '')
    }
    load()
  }, [])

  const handleSaveEmail = async () => {
    setSavingEmail(true)
    await updateDefaultPdfEmail(pdfEmail.trim() || null)
    toast.success('Default email saved')
    setSavingEmail(false)
  }

  const handleSaveAccountEmail = async () => {
    const trimmed = newAccountEmail.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Enter a valid email address')
      return
    }
    setSavingAccountEmail(true)
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || `Failed to update email (${res.status})`)
        return
      }
      setProfile((prev) => prev ? { ...prev, email: trimmed } : prev)
      setNewAccountEmail(trimmed)
      setShowAccountEmailConfirm(false)
      toast.success('Sign-in email updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update email')
    } finally {
      setSavingAccountEmail(false)
    }
  }

  const handleSaveUnit = async () => {
    setSavingUnit(true)
    const supabase = createClient()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const val = unit.trim() || null
        const { error } = await supabase.from('profiles').update({ unit: val } as any).eq('id', user.id)
        if (error) {
          toast.error(`Failed to save: ${error.message}`)
          setSavingUnit(false)
          return
        }
        setProfile((prev) => prev ? { ...prev, unit: val } : prev)
      }
    }
    toast.success('Unit saved')
    setSavingUnit(false)
  }

  const handleSaveOfficeSymbol = async () => {
    setSavingOfficeSymbol(true)
    const supabase = createClient()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const val = officeSymbol.trim() || null
        const { error } = await supabase.from('profiles').update({ office_symbol: val } as any).eq('id', user.id)
        if (error) {
          toast.error(`Failed to save: ${error.message}`)
          setSavingOfficeSymbol(false)
          return
        }
        setProfile((prev) => prev ? { ...prev, officeSymbol: val } : prev)
      }
    }
    toast.success('Office symbol saved')
    setSavingOfficeSymbol(false)
  }

  const handleSaveOi = async () => {
    setSavingOi(true)
    const supabase = createClient()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const val = oi.trim().toUpperCase() || null
        const { error } = await supabase.from('profiles').update({ operating_initials: val } as any).eq('id', user.id)
        if (error) {
          toast.error(`Failed to save: ${error.message}`)
          setSavingOi(false)
          return
        }
        setProfile((prev) => prev ? { ...prev, operatingInitials: val } : prev)
      }
    }
    toast.success('Operating initials saved')
    setSavingOi(false)
  }

  if (!profile) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading...</div>
    )
  }

  const roleConfig = USER_ROLES[profile.role]
  const displayName = [profile.rank, profile.name].filter(Boolean).join(' ')
  const emailChanged = (pdfEmail.trim() || '') !== (defaultPdfEmail || '')
  const accountEmailChanged = newAccountEmail.trim().toLowerCase() !== (profile.email || '').toLowerCase()
  const unitChanged = (unit.trim() || '') !== (profile.unit || '')
  const officeSymbolChanged = (officeSymbol.trim() || '') !== (profile.officeSymbol || '')

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Name */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>NAME</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>{displayName || 'Not set'}</div>
        </div>

        {/* Installation */}
        {profile.installationName && (
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>INSTALLATION</div>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)' }}>{profile.installationName}</div>
          </div>
        )}

        {/* Role */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>ROLE</div>
          <span style={{
            background: 'rgba(56,189,248,0.1)',
            color: 'var(--color-accent)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            {roleConfig?.label || profile.role}
          </span>
        </div>

        {/* Operating Initials */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>OPERATING INITIALS</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={oi}
              onChange={(e) => setOi(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="e.g. JDS"
              maxLength={4}
              style={{
                width: 80, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'monospace', letterSpacing: '0.1em', outline: 'none',
                textAlign: 'center',
              }}
            />
            {(oi.trim().toUpperCase() || '') !== (profile.operatingInitials || '') && (
              <button
                onClick={handleSaveOi}
                disabled={savingOi}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-status-pass)', border: 'none',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: savingOi ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: savingOi ? 0.7 : 1,
                }}
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Unit */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>UNIT</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. 115th OSS"
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {unitChanged && (
              <button
                onClick={handleSaveUnit}
                disabled={savingUnit}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-status-pass)', border: 'none',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: savingUnit ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: savingUnit ? 0.7 : 1,
                }}
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Office Symbol */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>OFFICE SYMBOL</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={officeSymbol}
              onChange={(e) => setOfficeSymbol(e.target.value)}
              placeholder="e.g. OSAA"
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {officeSymbolChanged && (
              <button
                onClick={handleSaveOfficeSymbol}
                disabled={savingOfficeSymbol}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-status-pass)', border: 'none',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: savingOfficeSymbol ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: savingOfficeSymbol ? 0.7 : 1,
                }}
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Account Email (sign-in) */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>SIGN-IN EMAIL</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="email"
              value={newAccountEmail}
              onChange={(e) => setNewAccountEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {accountEmailChanged && (
              <button
                onClick={() => setShowAccountEmailConfirm(true)}
                disabled={savingAccountEmail}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-status-pass)', border: 'none',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: savingAccountEmail ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: savingAccountEmail ? 0.7 : 1,
                }}
              >
                Save
              </button>
            )}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
            You'll use this address to sign in. Changes take effect immediately.
          </div>
        </div>

        {/* Default PDF Email */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>DEFAULT PDF EMAIL</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="email"
              value={pdfEmail}
              onChange={(e) => setPdfEmail(e.target.value)}
              placeholder="unit.orgbox@mail.mil"
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {emailChanged && (
              <button
                onClick={handleSaveEmail}
                disabled={savingEmail}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-status-pass)', border: 'none',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: savingEmail ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: savingEmail ? 0.7 : 1,
                }}
              >
                {savingEmail ? '...' : 'Save'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
            Pre-fills the email field when using Email PDF
          </div>
        </div>

        {/* Account Email confirmation modal */}
        {showAccountEmailConfirm && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: 16,
            }}
            onClick={() => !savingAccountEmail && setShowAccountEmailConfirm(false)}
          >
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 480, width: '100%', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 14,
              }}
            >
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                Change sign-in email?
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                You&apos;ll use the new address to sign in starting now. Make sure it&apos;s correct &mdash; a typo will lock you out and require an admin to fix.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em' }}>FROM</div>
                <div style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>{profile.email}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginTop: 6 }}>TO</div>
                <div style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 700 }}>{newAccountEmail.trim()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setShowAccountEmailConfirm(false)}
                  disabled={savingAccountEmail}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'transparent', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                    cursor: savingAccountEmail ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccountEmail}
                  disabled={savingAccountEmail}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-status-pass)', border: 'none',
                    color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                    cursor: savingAccountEmail ? 'default' : 'pointer', fontFamily: 'inherit',
                    opacity: savingAccountEmail ? 0.7 : 1,
                  }}
                >
                  {savingAccountEmail ? 'Saving…' : 'Change email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section: Appearance / Theme
// ═══════════════════════════════════════════════════════════════

function ThemeSectionContent() {
  const { theme, setTheme } = useTheme()
  const { design, setDesign } = useDesign()

  const options: { value: ThemePreference; label: string; icon: React.ComponentType<{ size: number }> }[] = [
    { value: 'light', label: 'Day', icon: Sun },
    { value: 'dark', label: 'Night', icon: Moon },
    { value: 'auto', label: 'Auto', icon: Monitor },
  ]

  const designOptions: { value: 'v1' | 'v2'; label: string; sub: string }[] = [
    { value: 'v1', label: 'Classic', sub: 'Current look' },
    { value: 'v2', label: 'Refreshed', sub: 'New type & contrast (preview)' },
  ]

  return (
    <>
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>THEME</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 8px',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: theme === value
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                background: theme === value
                  ? 'rgba(56,189,248,0.08)'
                  : 'transparent',
                color: theme === value ? 'var(--color-accent)' : 'var(--color-text-2)',
                fontWeight: theme === value ? 700 : 500,
                fontSize: 'var(--fs-base)',
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 8 }}>
          {theme === 'auto' ? 'Follows your device settings' : theme === 'light' ? 'Light theme active' : 'Dark theme active'}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>APP DESIGN</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {designOptions.map(({ value, label, sub }) => (
            <button
              key={value}
              onClick={() => setDesign(value)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 8px',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: design === value
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                background: design === value
                  ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
                  : 'transparent',
                color: design === value ? 'var(--color-accent)' : 'var(--color-text-2)',
                fontWeight: design === value ? 700 : 500,
                fontSize: 'var(--fs-base)',
              }}
            >
              {label}
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 500 }}>{sub}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 8 }}>
          Preview of the readability &amp; hierarchy refresh. Best seen on Airfield Status and the Dashboard. Toggle anytime.
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 2: Installation Config
// ═══════════════════════════════════════════════════════════════

function InstallationSectionContent() {
  const { currentInstallation, allInstallations, switchInstallation, removeInstallation } = useInstallation()
  const { has } = usePermissions()
  const [showDropdown, setShowDropdown] = useState(false)
  const [search, setSearch] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcao, setNewIcao] = useState('')
  const [newAirportType, setNewAirportType] = useState<'usaf' | 'faa_part139'>('usaf')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const canManageInstallations = has(PERM.INSTALLATIONS_SWITCH) && allInstallations.length > 1

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch user ID once for membership creation
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const filtered = search.trim()
    ? BASE_DIRECTORY.filter(entry => entry.name.toLowerCase().includes(search.toLowerCase()) || entry.icao.toLowerCase().includes(search.toLowerCase()))
    : [...BASE_DIRECTORY]

  const handleSelect = async (entry: { name: string; icao: string }) => {
    setShowDropdown(false)
    setSearch('')
    setSaving(true)
    const inst = await createInstallation(entry.name, entry.icao || undefined, userId)
    if (inst) {
      await switchInstallation(inst.id)
      toast.success('Installation updated')
    } else {
      toast.error('Failed to switch installation')
    }
    setSaving(false)
  }

  const handleAddNew = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const inst = await createInstallation(newName.trim(), newIcao.trim() || undefined, userId, newAirportType)
    if (inst) {
      await switchInstallation(inst.id)
      setAddingNew(false)
      setNewName('')
      setNewIcao('')
      setNewAirportType('usaf')
      toast.success('Installation created')
    } else {
      toast.error('Failed to create installation')
    }
    setSaving(false)
  }

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Current installation display */}
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>CURRENT INSTALLATION</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {currentInstallation
              ? `${currentInstallation.name}${currentInstallation.icao ? ` (${currentInstallation.icao})` : ''}`
              : 'Not set'}
          </div>
        </div>

        {/* Switch/manage installations — sys_admin only (users:manage
            restricted path; full user management privilege required). */}
        {has(PERM.USERS_MANAGE) && (<>
        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Switch installation dropdown */}
        {!addingNew ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>CHANGE INSTALLATION</div>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="input-dark"
              disabled={saving}
              style={{
                width: '100%', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', textAlign: 'left',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-md)' }}>
                {saving ? 'Switching...' : 'Select a different installation...'}
              </span>
              <ChevronDown size={14} color="var(--color-text-3)" />
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                zIndex: 'var(--z-dropdown)', marginTop: 4,
                background: 'var(--color-bg-elevated)',
                border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: 'var(--radius-base)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                  <input
                    type="text"
                    placeholder="Search installations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-dark"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-base)' }}
                    autoFocus
                  />
                </div>
                {filtered.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                    No installations found
                  </div>
                ) : (
                  filtered.map(entry => (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        background: entry.name === currentInstallation?.name ? 'rgba(56,189,248,0.08)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(56,189,248,0.04)',
                        cursor: 'pointer', textAlign: 'left',
                        color: entry.name === currentInstallation?.name ? 'var(--color-accent)' : 'var(--color-text-1)',
                        fontSize: 'var(--fs-md)', fontFamily: 'inherit',
                        fontWeight: entry.name === currentInstallation?.name ? 700 : 500,
                      }}
                    >
                      {entry.name}
                      {entry.icao && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 8, opacity: 0.5 }}>{entry.icao}</span>}
                    </button>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddingNew(true)
                    setShowDropdown(false)
                    setSearch('')
                  }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid rgba(56,189,248,0.1)',
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
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>ADD NEW INSTALLATION</div>
            <input
              type="text"
              className="input-dark"
              placeholder="Installation name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
              autoFocus
            />
            <input
              type="text"
              className="input-dark"
              placeholder="ICAO code (optional)"
              value={newIcao}
              onChange={(e) => setNewIcao(e.target.value.toUpperCase())}
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
              maxLength={4}
            />
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>
                AIRPORT TYPE
              </div>
              <select
                className="input-dark"
                value={newAirportType}
                onChange={(e) => setNewAirportType(e.target.value as 'usaf' | 'faa_part139')}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="usaf">USAF Airfield (DAFMAN 13-204)</option>
                <option value="faa_part139">FAA Part 139 (Civilian)</option>
              </select>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 4, lineHeight: 1.3 }}>
                Drives terminology, regulatory bindings, module visibility, and obstruction surfaces.
                Locked after the first activity-log entry; choose carefully.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAddNew}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                  border: 'none', borderRadius: 'var(--radius-base)', padding: '10px 16px',
                  color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving || !newName.trim() ? 0.5 : 1,
                }}
              >
                <Save size={14} />
                {saving ? 'Creating...' : 'Create & Switch'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingNew(false); setNewName(''); setNewIcao(''); setNewAirportType('usaf') }}
                style={{
                  padding: '10px 16px',
                  background: 'var(--color-border)', border: '1px solid var(--color-border-mid)',
                  borderRadius: 'var(--radius-base)', color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Manage installations — only for privileged roles with multiple bases */}
        {canManageInstallations && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)' }} />
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>YOUR INSTALLATIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allInstallations.map(inst => {
                  const isCurrent = inst.id === currentInstallation?.id
                  const isRemoving = removing === inst.id
                  return (
                    <div
                      key={inst.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: isCurrent ? 'rgba(56,189,248,0.06)' : 'transparent',
                        border: isCurrent ? '1px solid rgba(56,189,248,0.15)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--fs-md)',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-1)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {inst.name}
                          {inst.icao && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 6, opacity: 0.5 }}>{inst.icao}</span>}
                        </div>
                        {isCurrent && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>Current</div>
                        )}
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove({ id: inst.id, name: inst.name })}
                          disabled={isRemoving}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 4, display: 'flex', alignItems: 'center',
                            opacity: isRemoving ? 0.4 : 0.6,
                          }}
                        >
                          <X size={14} color="#F87171" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
        </>)}
      </div>

      {/* Remove installation confirmation */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove Installation?"
          message={`Remove "${confirmRemove.name}" from your installation list? You can re-add it later from the directory.`}
          confirmLabel="Remove"
          onConfirm={async () => {
            const baseId = confirmRemove.id
            setConfirmRemove(null)
            setRemoving(baseId)
            const ok = await removeInstallation(baseId)
            setRemoving(null)
            if (ok) {
              toast.success('Installation removed')
            } else {
              toast.error('Failed to remove installation')
            }
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 3: Regulations Library
// ═══════════════════════════════════════════════════════════════

const FAVORITES_DEFAULT_KEY = 'aoms_reg_favorites_default'

function RegulationsSectionContent() {
  const [favDefault, setFavDefault] = useState(false)
  const [cachedCount, setCachedCount] = useState<number | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [cacheProgress, setCacheProgress] = useState<{ done: number; total: number; errors: number } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const cacheAbortRef = useRef(false)

  // Load regulations from Supabase or fall back to static
  const [regulations, setRegulations] = useState(ALL_REGULATIONS)

  useEffect(() => {
    async function load() {
      // Try Supabase first
      const supabase = createClient()
      if (supabase) {
        try {
          const { data } = await supabase
            .from('regulations')
            .select('reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags')
            .order('reg_id', { ascending: true })
          if (data && data.length > 0) {
            setRegulations(data as typeof ALL_REGULATIONS)
            setTotalCount(data.length)
          } else {
            setTotalCount(ALL_REGULATIONS.length)
          }
        } catch {
          setTotalCount(ALL_REGULATIONS.length)
        }
      } else {
        setTotalCount(ALL_REGULATIONS.length)
      }

      // Favorites default
      try {
        setFavDefault(localStorage.getItem(FAVORITES_DEFAULT_KEY) === 'true')
      } catch { /* ignore */ }
    }
    load()
  }, [])

  // Count cached regulations
  useEffect(() => {
    async function countCached() {
      try {
        const keys = await idbGetAllKeys(STORE_BLOBS)
        const keySet = new Set(keys.map(String))
        let count = 0
        for (const reg of regulations) {
          if (keySet.has(`${sanitizeFileName(reg.reg_id)}.pdf`)) count++
        }
        setCachedCount(count)
      } catch { /* ignore */ }
    }
    countCached()
  }, [cacheProgress, regulations])

  const toggleFavDefault = useCallback(() => {
    const next = !favDefault
    setFavDefault(next)
    localStorage.setItem(FAVORITES_DEFAULT_KEY, next ? 'true' : 'false')
  }, [favDefault])

  const handleCacheAll = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return
    cacheAbortRef.current = false

    const existingKeys = new Set((await idbGetAllKeys(STORE_BLOBS)).map(String))
    const uncached = regulations.filter(r => !existingKeys.has(`${sanitizeFileName(r.reg_id)}.pdf`))

    if (uncached.length === 0) {
      setCachedCount(regulations.length)
      toast.success('All regulations already cached')
      return
    }

    const total = uncached.length
    let done = 0
    let errors = 0
    setCacheProgress({ done: 0, total, errors: 0 })

    for (const reg of uncached) {
      if (cacheAbortRef.current) break
      const fileName = `${sanitizeFileName(reg.reg_id)}.pdf`
      try {
        const { data, error } = await supabase.storage.from('regulation-pdfs').download(fileName)
        if (error || !data) {
          errors++
        } else {
          const buf = await data.arrayBuffer()
          await idbSet(STORE_BLOBS, fileName, buf)
        }
      } catch {
        errors++
      }
      done++
      setCacheProgress({ done, total, errors })
    }
    setCacheProgress(null)
  }, [regulations])

  const handleClearCache = useCallback(async () => {
    setShowClearConfirm(false)
    setClearing(true)
    try {
      const keys = await idbGetAllKeys(STORE_BLOBS)
      const regFileNames = new Set(
        regulations.map(r => `${sanitizeFileName(r.reg_id)}.pdf`)
      )
      for (const key of keys) {
        if (regFileNames.has(String(key))) {
          await idbDelete(STORE_BLOBS, String(key))
        }
      }
      setCachedCount(0)
      toast.success('Regulation cache cleared')
    } catch { /* ignore */ }
    setClearing(false)
  }, [regulations])

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Favorites toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>Show favorites by default</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Open References tab filtered to favorites</div>
          </div>
          <button
            onClick={toggleFavDefault}
            style={{
              width: 40, height: 22, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
              background: favDefault ? 'var(--color-cyan)' : 'var(--color-progress-track)',
              position: 'relative', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, width: 16, height: 16,
              borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              left: favDefault ? 21 : 3,
            }} />
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Cache status */}
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>Cached for offline use</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)' }}>
            {cachedCount !== null
              ? <><span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{cachedCount}</span> of {totalCount || regulations.length} cached for offline use</>
              : 'Checking cache...'}
          </div>
        </div>

        {/* Cache All / Abort */}
        {cacheProgress ? (
          <div>
            {/* Progress bar */}
            <div style={{ height: 4, borderRadius: 'var(--radius-xs)', background: 'var(--color-progress-track)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', borderRadius: 'var(--radius-xs)',
                background: cacheProgress.errors > 0
                  ? 'linear-gradient(90deg, var(--color-accent-secondary), #F97316)'
                  : 'var(--color-accent-secondary)',
                width: `${Math.round((cacheProgress.done / cacheProgress.total) * 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                {cacheProgress.done} of {cacheProgress.total} downloaded
                {cacheProgress.errors > 0 && <span style={{ color: 'var(--color-orange)', marginLeft: 8 }}>{cacheProgress.errors} unavailable</span>}
              </div>
              <button
                onClick={() => { cacheAbortRef.current = true }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer',
                  color: '#F87171', fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <X size={10} />
                Abort
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCacheAll}
              disabled={cachedCount === totalCount && totalCount > 0}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: (cachedCount === totalCount && totalCount > 0)
                  ? 'transparent' : 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                border: (cachedCount === totalCount && totalCount > 0)
                  ? '1px solid rgba(52,211,153,0.3)' : 'none',
                borderRadius: 'var(--radius-base)', padding: '10px 16px', cursor: 'pointer',
                color: (cachedCount === totalCount && totalCount > 0) ? 'var(--color-success)' : '#fff',
                fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
                opacity: (cachedCount === totalCount && totalCount > 0) ? 0.8 : 1,
              }}
            >
              <Download size={14} />
              {(cachedCount === totalCount && totalCount > 0) ? 'All Cached' : 'Cache All'}
            </button>
            {(cachedCount ?? 0) > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={clearing}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-base)', padding: '10px 16px', cursor: 'pointer',
                  color: '#F87171', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <Trash2 size={14} />
                {clearing ? 'Clearing...' : 'Clear Cache'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Clear cache confirmation modal */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Regulation Cache?"
          message="This will remove all cached regulations. You'll need Wi-Fi to re-download them."
          confirmLabel="Clear Cache"
          onConfirm={handleClearCache}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 4: Data & Storage
// ═══════════════════════════════════════════════════════════════

function StorageSectionContent() {
  const { installationId, runways } = useInstallation()
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: string; quotaMB: string } | null>(null)
  const [storageSupported, setStorageSupported] = useState(true)
  const [regCount, setRegCount] = useState(0)
  const [userDocCount, setUserDocCount] = useState(0)
  const [regSizeMB, setRegSizeMB] = useState<string | null>(null)
  const [userDocSizeMB, setUserDocSizeMB] = useState<string | null>(null)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [tileCacheCount, setTileCacheCount] = useState(0)
  const [precaching, setPrecaching] = useState(false)
  const [precacheProgress, setPrecacheProgress] = useState<PrecacheProgress | null>(null)

  useEffect(() => {
    async function load() {
      // Storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate()
          setStorageEstimate({
            usageMB: ((estimate.usage || 0) / (1024 * 1024)).toFixed(1),
            quotaMB: ((estimate.quota || 0) / (1024 * 1024)).toFixed(0),
          })
        } catch {
          setStorageSupported(false)
        }
      } else {
        setStorageSupported(false)
      }

      // Regulation blobs
      try {
        const regKeys = await idbGetAllKeys(STORE_BLOBS)
        setRegCount(regKeys.length)
        // Estimate size by reading all blobs
        const regBlobs = await idbGetAll<ArrayBuffer>(STORE_BLOBS)
        const totalBytes = regBlobs.reduce((sum, b) => sum + (b?.byteLength || 0), 0)
        setRegSizeMB((totalBytes / (1024 * 1024)).toFixed(1))
      } catch { /* ignore */ }

      // User doc blobs
      try {
        const userKeys = await idbGetAllKeys(STORE_USER_BLOBS)
        setUserDocCount(userKeys.length)
        const userBlobs = await idbGetAll<ArrayBuffer>(STORE_USER_BLOBS)
        const totalBytes = userBlobs.reduce((sum, b) => sum + (b?.byteLength || 0), 0)
        setUserDocSizeMB((totalBytes / (1024 * 1024)).toFixed(1))
      } catch { /* ignore */ }

      // Tile cache
      try {
        const count = await getCachedTileCount()
        setTileCacheCount(count)
      } catch { /* ignore */ }
    }
    load()
  }, [clearingAll, precaching])

  const handlePrecacheTiles = async () => {
    if (!runways || runways.length === 0) {
      toast.error('No runways configured — cannot determine base location')
      return
    }
    const rwy = runways[0]
    const lat = ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2
    const lng = ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2
    if (lat === 0 && lng === 0) {
      toast.error('Runway coordinates not set')
      return
    }
    setPrecaching(true)
    setPrecacheProgress(null)
    try {
      const result = await precacheTiles(lat, lng, 2, [12, 13, 14, 15, 16, 17], (p) => {
        setPrecacheProgress({ ...p })
      })
      toast.success(`Cached ${result.cached} map tiles${result.errors > 0 ? ` (${result.errors} errors)` : ''}`)
    } catch (err) {
      toast.error('Failed to cache tiles')
    }
    setPrecaching(false)
  }

  const handleClearTileCache = async () => {
    await clearTileCache()
    setTileCacheCount(0)
    toast.success('Map tile cache cleared')
  }

  const handleClearAll = async () => {
    setShowClearAllConfirm(false)
    setClearingAll(true)
    try {
      await idbClear([STORE_BLOBS, STORE_USER_BLOBS])
      setRegCount(0)
      setUserDocCount(0)
      setRegSizeMB('0.0')
      setUserDocSizeMB('0.0')
      toast.success('All cached data cleared')
    } catch { /* ignore */ }
    setClearingAll(false)
  }

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Overall storage */}
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2 }}>Estimated Storage Used</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)' }}>
            {storageSupported && storageEstimate
              ? <>Using <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{storageEstimate.usageMB} MB</span> of {storageEstimate.quotaMB} MB available</>
              : 'Storage estimate unavailable'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Regulation PDFs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)' }}>Regulation PDFs</div>
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', fontWeight: 600 }}>
            {regCount} cached{regSizeMB ? ` (~${regSizeMB} MB)` : ''}
          </div>
        </div>

        {/* Personal Documents */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)' }}>Personal Documents</div>
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', fontWeight: 600 }}>
            {userDocCount} cached{userDocSizeMB ? ` (~${userDocSizeMB} MB)` : ''}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Map Tile Cache */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2 }}>Map Tile Cache</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                Pre-download satellite tiles for your base area so maps load instantly.
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 12 }}>
              {tileCacheCount} tiles
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrecacheTiles}
              disabled={precaching}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: precaching ? 'var(--color-bg-inset)' : 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                border: precaching ? '1px solid var(--color-border)' : 'none',
                borderRadius: 'var(--radius-base)', padding: '10px 16px', cursor: precaching ? 'wait' : 'pointer',
                color: precaching ? 'var(--color-text-3)' : '#fff',
                fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              <Download size={14} />
              {precaching
                ? precacheProgress
                  ? `Caching... ${precacheProgress.loaded}/${precacheProgress.total}`
                  : 'Starting...'
                : 'Cache Map Tiles'}
            </button>
            {tileCacheCount > 0 && !precaching && (
              <button
                onClick={handleClearTileCache}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-base)',
                  background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#F87171', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
            )}
          </div>
          {precaching && precacheProgress && (
            <div style={{ marginTop: 6 }}>
              <div style={{
                height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: 'var(--color-accent)',
                  width: `${Math.round((precacheProgress.loaded / precacheProgress.total) * 100)}%`,
                  transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                {precacheProgress.cached} cached, {precacheProgress.errors > 0 ? `${precacheProgress.errors} errors, ` : ''}{precacheProgress.total - precacheProgress.loaded} remaining
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Clear All */}
        <button
          onClick={() => setShowClearAllConfirm(true)}
          disabled={clearingAll || (regCount === 0 && userDocCount === 0)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-base)', padding: '10px 16px', cursor: 'pointer',
            color: '#F87171', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: (regCount === 0 && userDocCount === 0) ? 0.4 : 1,
          }}
        >
          <Trash2 size={14} />
          {clearingAll ? 'Clearing...' : 'Clear All Cached Data'}
        </button>
      </div>

      {showClearAllConfirm && (
        <ConfirmDialog
          title="Clear All Cached Data?"
          message="This will remove all cached regulations and personal documents. You'll need Wi-Fi to re-download them."
          confirmLabel="Clear All"
          onConfirm={handleClearAll}
          onCancel={() => setShowClearAllConfirm(false)}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 5: About
// ═══════════════════════════════════════════════════════════════

function AboutSectionContent() {
  const env = process.env.NODE_ENV === 'production' ? 'Production' : 'Development'

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Version</span>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', fontWeight: 600 }}>2.33.0</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Environment</span>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', fontWeight: 600 }}>{env}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Website</span>
          <a
            href="https://glidepathops.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 'var(--fs-base)', color: 'var(--color-accent)', fontWeight: 600,
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            glidepathops.com
            <ExternalLink size={10} />
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Support</span>
          <ContactSupport
            style={{
              fontSize: 'var(--fs-base)', color: 'var(--color-cyan)', fontWeight: 600,
              background: 'none', border: 'none', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Contact Support
          </ContactSupport>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 6: Sign Out
// ═══════════════════════════════════════════════════════════════

function SignOutSection() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      style={{
        width: '100%',
        marginTop: 32,
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-base)',
        cursor: signingOut ? 'not-allowed' : 'pointer',
        color: 'var(--color-danger)',
        fontSize: 'var(--fs-xl)',
        fontWeight: 700,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: signingOut ? 0.5 : 1,
      }}
    >
      <LogOut size={18} />
      {signingOut ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// Shared: Confirmation Dialog
// ═══════════════════════════════════════════════════════════════

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="modal-overlay"
      style={{ backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="card"
        style={{
          maxWidth: 340, width: '100%',
          padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>{message}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 16px',
              background: 'var(--color-border)', border: '1px solid var(--color-border-mid)',
              borderRadius: 'var(--radius-base)', color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '10px 16px',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-base)', color: '#F87171', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
