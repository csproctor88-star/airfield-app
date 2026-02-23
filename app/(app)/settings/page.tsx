'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, MapPin, BookOpen, HardDrive, Info, LogOut, Save, Trash2, Download, X, ExternalLink, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { useTheme, type ThemePreference } from '@/lib/theme-context'
import { USER_ROLES } from '@/lib/constants'
import { createInstallation } from '@/lib/supabase/installations'
import { BASE_DIRECTORY } from '@/lib/base-directory'
import { ALL_REGULATIONS } from '@/lib/regulations-data'
import { idbGetAllKeys, idbGetAll, idbSet, idbDelete, idbClear, STORE_BLOBS, STORE_USER_BLOBS } from '@/lib/idb'
import { sanitizeRegId as sanitizeFileName } from '@/lib/utils'
import type { UserRole } from '@/lib/supabase/types'

// ═══════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Settings</div>
      <ProfileSection />
      <ThemeSection />
      <InstallationSection />
      <RegulationsSection />
      <StorageSection />
      <AboutSection />
      <SignOutSection />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════

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

function ProfileSection() {
  const [profile, setProfile] = useState<{
    name: string
    rank: string | null
    email: string
    role: UserRole
    installationName: string | null
  } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setProfile({ name: 'Demo User', rank: 'MSgt', email: 'demo@glidepath.app', role: 'sys_admin', installationName: 'Selfridge ANGB' })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('name, rank, role, primary_base_id')
        .eq('id', user.id)
        .single()

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
      })
    }
    load()
  }, [])

  if (!profile) {
    return (
      <>
        <SectionHeader label="PROFILE" icon={User} />
        <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 13 }}>Loading...</div>
      </>
    )
  }

  const roleConfig = USER_ROLES[profile.role]
  const displayName = [profile.rank, profile.name].filter(Boolean).join(' ')

  return (
    <>
      <SectionHeader label="PROFILE" icon={User} />
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Name */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>NAME</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>{displayName || 'Not set'}</div>
        </div>

        {/* Email */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>EMAIL</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{profile.email}</div>
        </div>

        {/* Installation */}
        {profile.installationName && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>INSTALLATION</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{profile.installationName}</div>
          </div>
        )}

        {/* Role */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>ROLE</div>
          <span style={{
            background: 'rgba(56,189,248,0.1)',
            color: 'var(--color-accent)',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            {roleConfig?.label || profile.role}
          </span>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section: Appearance / Theme
// ═══════════════════════════════════════════════════════════════

function ThemeSection() {
  const { theme, setTheme } = useTheme()

  const options: { value: ThemePreference; label: string; icon: React.ComponentType<{ size: number }> }[] = [
    { value: 'light', label: 'Day', icon: Sun },
    { value: 'dark', label: 'Night', icon: Moon },
    { value: 'auto', label: 'Auto', icon: Monitor },
  ]

  return (
    <>
      <SectionHeader label="APPEARANCE" icon={Sun} />
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>THEME</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 8px',
                borderRadius: 10,
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
                fontSize: 12,
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 8 }}>
          {theme === 'auto' ? 'Follows your device settings' : theme === 'light' ? 'Light theme active' : 'Dark theme active'}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 2: Installation Config
// ═══════════════════════════════════════════════════════════════

function InstallationSection() {
  const { currentInstallation, switchInstallation } = useInstallation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [search, setSearch] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcao, setNewIcao] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | undefined>()
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    ? BASE_DIRECTORY.filter(name => name.toLowerCase().includes(search.toLowerCase()))
    : [...BASE_DIRECTORY]

  const handleSelect = async (name: string) => {
    setShowDropdown(false)
    setSearch('')
    setSaving(true)
    const inst = await createInstallation(name, undefined, userId)
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
    const inst = await createInstallation(newName.trim(), newIcao.trim() || undefined, userId)
    if (inst) {
      await switchInstallation(inst.id)
      setAddingNew(false)
      setNewName('')
      setNewIcao('')
      toast.success('Installation created')
    } else {
      toast.error('Failed to create installation')
    }
    setSaving(false)
  }

  const shortName = (name: string) =>
    name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').trim()

  return (
    <>
      <SectionHeader label="INSTALLATION" icon={MapPin} />
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Current installation display */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>CURRENT INSTALLATION</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-1)' }}>
            {currentInstallation
              ? `${shortName(currentInstallation.name)}${currentInstallation.icao ? ` (${currentInstallation.icao})` : ''}`
              : 'Not set'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Switch installation dropdown */}
        {!addingNew ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>CHANGE INSTALLATION</div>
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
              <span style={{ color: 'var(--color-text-2)', fontSize: 13 }}>
                {saving ? 'Switching...' : 'Select a different installation...'}
              </span>
              <ChevronDown size={14} color="var(--color-text-3)" />
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                zIndex: 100, marginTop: 4,
                background: 'var(--color-bg-elevated)',
                border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: 8,
                maxHeight: 200, overflowY: 'auto',
              }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                  <input
                    type="text"
                    placeholder="Search installations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-dark"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
                    autoFocus
                  />
                </div>
                {filtered.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-text-3)' }}>
                    No installations found
                  </div>
                ) : (
                  filtered.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelect(name)}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        background: name === currentInstallation?.name ? 'rgba(56,189,248,0.08)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(56,189,248,0.04)',
                        cursor: 'pointer', textAlign: 'left',
                        color: name === currentInstallation?.name ? 'var(--color-accent)' : 'var(--color-text-1)',
                        fontSize: 13, fontFamily: 'inherit',
                        fontWeight: name === currentInstallation?.name ? 700 : 500,
                      }}
                    >
                      {name}
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
                    fontSize: 13, fontFamily: 'inherit',
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
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>ADD NEW INSTALLATION</div>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAddNew}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                  border: 'none', borderRadius: 8, padding: '10px 16px',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving || !newName.trim() ? 0.5 : 1,
                }}
              >
                <Save size={14} />
                {saving ? 'Creating...' : 'Create & Switch'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingNew(false); setNewName(''); setNewIcao('') }}
                style={{
                  padding: '10px 16px',
                  background: 'var(--color-border)', border: '1px solid var(--color-border-mid)',
                  borderRadius: 8, color: 'var(--color-text-2)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Section 3: Regulations Library
// ═══════════════════════════════════════════════════════════════

const FAVORITES_DEFAULT_KEY = 'aoms_reg_favorites_default'

function RegulationsSection() {
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
      <SectionHeader label="REGULATIONS LIBRARY" icon={BookOpen} />
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Favorites toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>Show favorites by default</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Open References tab filtered to favorites</div>
          </div>
          <button
            onClick={toggleFavDefault}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>Cached for offline use</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            {cachedCount !== null
              ? <><span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{cachedCount}</span> of {totalCount || regulations.length} cached for offline use</>
              : 'Checking cache...'}
          </div>
        </div>

        {/* Cache All / Abort */}
        {cacheProgress ? (
          <div>
            {/* Progress bar */}
            <div style={{ height: 4, borderRadius: 2, background: 'var(--color-progress-track)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: cacheProgress.errors > 0
                  ? 'linear-gradient(90deg, var(--color-accent-secondary), #F97316)'
                  : 'var(--color-accent-secondary)',
                width: `${Math.round((cacheProgress.done / cacheProgress.total) * 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                {cacheProgress.done} of {cacheProgress.total} downloaded
                {cacheProgress.errors > 0 && <span style={{ color: '#F97316', marginLeft: 8 }}>{cacheProgress.errors} unavailable</span>}
              </div>
              <button
                onClick={() => { cacheAbortRef.current = true }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  color: '#F87171', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
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
                borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
                color: (cachedCount === totalCount && totalCount > 0) ? '#34D399' : '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
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
                  borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
                  color: '#F87171', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
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

function StorageSection() {
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: string; quotaMB: string } | null>(null)
  const [storageSupported, setStorageSupported] = useState(true)
  const [regCount, setRegCount] = useState(0)
  const [userDocCount, setUserDocCount] = useState(0)
  const [regSizeMB, setRegSizeMB] = useState<string | null>(null)
  const [userDocSizeMB, setUserDocSizeMB] = useState<string | null>(null)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

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
    }
    load()
  }, [clearingAll])

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
      <SectionHeader label="DATA & STORAGE" icon={HardDrive} />
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Overall storage */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2 }}>Estimated Storage Used</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
            {storageSupported && storageEstimate
              ? <>Using <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{storageEstimate.usageMB} MB</span> of {storageEstimate.quotaMB} MB available</>
              : 'Storage estimate unavailable'}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Regulation PDFs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Regulation PDFs</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-1)', fontWeight: 600 }}>
            {regCount} cached{regSizeMB ? ` (~${regSizeMB} MB)` : ''}
          </div>
        </div>

        {/* Personal Documents */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Personal Documents</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-1)', fontWeight: 600 }}>
            {userDocCount} cached{userDocSizeMB ? ` (~${userDocSizeMB} MB)` : ''}
          </div>
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
            borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
            color: '#F87171', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
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

function AboutSection() {
  const env = process.env.NODE_ENV === 'production' ? 'Production' : 'Development'

  return (
    <>
      <SectionHeader label="ABOUT" icon={Info} />
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, var(--color-logo-start), var(--color-logo-end))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Glidepath
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Guiding You to Mission Success</div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Version</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-1)', fontWeight: 600 }}>2.1.0-beta</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Environment</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-1)', fontWeight: 600 }}>{env}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Website</span>
          <a
            href="https://glidepathops.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, color: 'var(--color-accent)', fontWeight: 600,
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            glidepathops.com
            <ExternalLink size={10} />
          </a>
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
        borderRadius: 8,
        cursor: signingOut ? 'not-allowed' : 'pointer',
        color: '#EF4444',
        fontSize: 15,
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
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--color-overlay)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onCancel}
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
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{message}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 16px',
              background: 'var(--color-border)', border: '1px solid var(--color-border-mid)',
              borderRadius: 8, color: 'var(--color-text-2)', fontSize: 13, fontWeight: 700,
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
              borderRadius: 8, color: '#F87171', fontSize: 13, fontWeight: 700,
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
