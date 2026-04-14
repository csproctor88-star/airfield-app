'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'
import { LogOut } from 'lucide-react'
import ContactSupport from '@/components/ui/contact-support'

type ModuleItem = { name: string; icon: string; color: string; href: string; adminOnly?: boolean; sysAdminOnly?: boolean }

// Pinned — same items visible on bottom nav
const pinnedItems: ModuleItem[] = [
  { name: 'Airfield Status', icon: '📡', color: '#38BDF8', href: '/' },
  { name: 'Dashboard', icon: '📊', color: '#38BDF8', href: '/dashboard' },
  { name: 'Events Log', icon: '📝', color: '#34D399', href: '/activity' },
]

// Operations
const opsItems: ModuleItem[] = [
  { name: 'QRC', icon: '⚡', color: '#EAB308', href: '/qrc' },
  { name: 'Shift Checklist', icon: '☑️', color: '#38BDF8', href: '/shift-checklist' },
  { name: 'Airfield Checks', icon: '✅', color: '#22D3EE', href: '/checks' },
  { name: 'All Inspections', icon: '📋', color: '#22D3EE', href: '/inspections/all' },
  { name: 'Wildlife / BASH', icon: '🦅', color: '#10B981', href: '/wildlife' },
  { name: 'PPR Log', icon: '📝', color: '#38BDF8', href: '/ppr' },
  { name: 'Personnel on Airfield', icon: '🚧', color: '#F59E0B', href: '/contractors' },
  { name: 'Aircraft Parking', icon: '🛬', color: '#38BDF8', href: '/parking' },
]

// Airfield Management
const mgmtItems: ModuleItem[] = [
  { name: 'Discrepancies', icon: '⚠️', color: '#FBBF24', href: '/discrepancies' },
  { name: 'Obstruction Eval Tool', icon: '📍', color: '#F97316', href: '/obstructions' },
  { name: 'Waivers', icon: '📄', color: '#A78BFA', href: '/waivers' },
  { name: 'Visual NAVAIDs', icon: '💡', color: '#FBBF24', href: '/infrastructure' },
]

// Reference
const refItems: ModuleItem[] = [
  { name: 'Aircraft Database', icon: '✈️', color: '#38BDF8', href: '/aircraft' },
  { name: 'Reference Library', icon: '📚', color: '#22D3EE', href: '/regulations' },
  { name: 'NOTAMs', icon: '📡', color: '#22D3EE', href: '/notams' },
  { name: 'Reports & Analytics', icon: '📈', color: '#22D3EE', href: '/reports' },
  { name: 'Training', icon: '🎓', color: '#38BDF8', href: '/training' },
]

// Settings / Admin
const settingsItems: ModuleItem[] = [
  { name: 'Settings', icon: '⚙️', color: '#64748B', href: '/settings' },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', href: '/library', adminOnly: true },
  { name: 'User Management', icon: '👥', color: '#64748B', href: '/users', adminOnly: true },
]

function NavItem({ item }: { item: ModuleItem }) {
  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: `${item.color}10`,
          border: `1px solid ${item.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--fs-2xl)',
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{item.name}</div>
      </div>
      <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)' }}>›</span>
    </Link>
  )
}

function CollapsibleGroup({ label, icon, items, defaultOpen }: { label: string; icon: string; items: ModuleItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  if (items.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          width: '100%',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--fs-2xl)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{label}</div>
        </div>
        <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && items.map(item => (
        <div key={item.href} style={{ paddingLeft: 16 }}>
          <NavItem item={item} />
        </div>
      ))}
    </>
  )
}

function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <button
      onClick={async () => {
        setSigningOut(true)
        const supabase = createClient()
        if (supabase) await supabase.auth.signOut()
        router.push('/login')
      }}
      disabled={signingOut}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '14px 16px', marginTop: 12,
        background: 'transparent', border: 'none', borderRadius: 'var(--radius-base)',
        cursor: signingOut ? 'not-allowed' : 'pointer',
        color: 'var(--color-danger)', fontSize: 'var(--fs-xl)', fontWeight: 700,
        fontFamily: 'inherit', opacity: signingOut ? 0.5 : 1,
      }}
    >
      <LogOut size={18} />
      {signingOut ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}

export default function MorePage() {
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [isCes, setIsCes] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      if (!supabase) {
        setCanManageUsers(true)
        setIsSysAdmin(true)
        setLoaded(true)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoaded(true)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'read_only') as UserRole
      const config = USER_ROLES[role]
      setCanManageUsers(config?.canManageUsers ?? false)
      setIsSysAdmin(role === 'sys_admin')
      setIsCes(role === 'ces')
      setLoaded(true)
    }

    checkRole()
  }, [])

  const CES_ALLOWED = new Set(['/ces', '/discrepancies', '/infrastructure', '/settings'])

  function filterItems(items: ModuleItem[]) {
    if (!loaded) return items.filter(m => !m.adminOnly && !m.sysAdminOnly)
    return items.filter(m => {
      if (m.adminOnly && !canManageUsers) return false
      if (m.sysAdminOnly && !isSysAdmin) return false
      if (isCes && !CES_ALLOWED.has(m.href)) return false
      return true
    })
  }

  // CES users get a simplified More page
  if (isCes) {
    const cesItems = [...mgmtItems, ...settingsItems].filter(m => CES_ALLOWED.has(m.href))
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>
        <div style={{
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', marginBottom: 12, overflow: 'hidden',
        }}>
          {cesItems.map(item => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
        <ContactSupport
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '14px 16px', marginTop: 12,
          background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)',
          color: 'var(--color-cyan)', fontSize: 'var(--fs-lg)', fontWeight: 600,
        }}
      >
        Contact Support
      </ContactSupport>
      <SignOutButton />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>

      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        {/* Pinned items */}
        {pinnedItems.map(item => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* Operations */}
        <CollapsibleGroup label="Operations" icon="🔧" items={filterItems(opsItems)} defaultOpen />

        {/* Airfield Management */}
        <CollapsibleGroup label="Airfield Management" icon="📂" items={filterItems(mgmtItems)} />

        {/* Reference */}
        <CollapsibleGroup label="Reference" icon="📚" items={filterItems(refItems)} />

        {/* Settings / Admin */}
        <CollapsibleGroup label="Settings" icon="⚙️" items={filterItems(settingsItems)} />
      </div>

      <ContactSupport
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '14px 16px', marginTop: 12,
          background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)',
          color: 'var(--color-cyan)', fontSize: 'var(--fs-lg)', fontWeight: 600,
        }}
      >
        Contact Support
      </ContactSupport>
      <SignOutButton />
    </div>
  )
}
