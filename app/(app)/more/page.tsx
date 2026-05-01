'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, ChevronRight } from 'lucide-react'
import ContactSupport from '@/components/ui/contact-support'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled } from '@/lib/modules-config'
import { usePermissions, PERM } from '@/lib/permissions'

type ModuleItem = { name: string; icon: string; color: string; href: string; adminOnly?: boolean; sysAdminOnly?: boolean }

// Pinned — same items visible on bottom nav
const pinnedItems: ModuleItem[] = [
  { name: 'Airfield Status', icon: '📡', color: 'var(--color-accent)', href: '/' },
  { name: 'Dashboard', icon: '📊', color: 'var(--color-accent)', href: '/dashboard' },
]

// Operations
const opsItems: ModuleItem[] = [
  { name: 'Events Log', icon: '📝', color: 'var(--color-success)', href: '/activity' },
  { name: 'QRC', icon: '⚡', color: 'var(--color-warning)', href: '/qrc' },
  { name: 'Secondary Crash Net', icon: '📻', color: 'var(--color-warning)', href: '/scn' },
  { name: 'Shift Checklist', icon: '☑️', color: 'var(--color-accent)', href: '/shift-checklist' },
  { name: 'Airfield Checks', icon: '✅', color: 'var(--color-cyan)', href: '/checks' },
  { name: 'All Inspections', icon: '📋', color: 'var(--color-cyan)', href: '/inspections/all' },
  { name: 'Wildlife / BASH', icon: '🦅', color: 'var(--color-success)', href: '/wildlife' },
  { name: 'PPR Log', icon: '📝', color: 'var(--color-accent)', href: '/ppr' },
  { name: 'Personnel on Airfield', icon: '🚧', color: 'var(--color-amber)', href: '/contractors' },
]

// Airfield Management
const mgmtItems: ModuleItem[] = [
  { name: 'Discrepancies', icon: '⚠️', color: 'var(--color-warning)', href: '/discrepancies' },
  { name: 'Obstruction Eval Tool', icon: '📍', color: 'var(--color-orange)', href: '/obstructions' },
  { name: 'Visual NAVAIDs', icon: '💡', color: 'var(--color-warning)', href: '/infrastructure' },
  { name: 'Aircraft Parking', icon: '🛬', color: 'var(--color-accent)', href: '/parking' },
]

// Reference
const refItems: ModuleItem[] = [
  { name: 'Aircraft Database', icon: '✈️', color: 'var(--color-accent)', href: '/aircraft' },
  { name: 'Reference Library', icon: '📚', color: 'var(--color-cyan)', href: '/regulations' },
  { name: 'NOTAMs', icon: '📡', color: 'var(--color-cyan)', href: '/notams' },
]

// Admin
const adminItems: ModuleItem[] = [
  { name: 'Activity Log', icon: '🕘', color: 'var(--color-success)', href: '/recent-activity' },
  { name: 'Daily Reviews', icon: '🗓️', color: 'var(--color-purple)', href: '/daily-reviews' },
  { name: 'Waivers', icon: '📄', color: 'var(--color-purple)', href: '/waivers' },
  { name: 'Reports & Analytics', icon: '📈', color: 'var(--color-cyan)', href: '/reports' },
  { name: 'Glidepath Training', icon: '🎓', color: 'var(--color-accent)', href: '/training' },
  { name: 'PDF Library', icon: '📖', color: 'var(--color-purple)', href: '/library', adminOnly: true },
  { name: 'User Management', icon: '👥', color: 'var(--color-text-3)', href: '/users', adminOnly: true },
]

// Settings
const settingsItems: ModuleItem[] = [
  { name: 'Settings', icon: '⚙️', color: 'var(--color-text-3)', href: '/settings' },
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
          background: `color-mix(in srgb, ${item.color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${item.color} 18%, transparent)`,
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
      <ChevronRight size={16} style={{ color: 'var(--color-text-4)', flexShrink: 0 }} />
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

// Map each admin href to its gating permission so the filter below
// stays in sync with the sidebar's HREF_TO_VIEW_PERM.
const HREF_PERMISSION: Partial<Record<string, string>> = {
  '/library':        PERM.LIBRARY_VIEW,
  '/users':          PERM.USERS_VIEW,
  '/feedback':       PERM.FEEDBACK_VIEW,
}

export default function MorePage() {
  const { enabledModules } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()

  function filterItems(items: ModuleItem[]) {
    if (!permsLoaded) return items.filter(m => !m.adminOnly && !m.sysAdminOnly)
    return items.filter(m => {
      const perm = HREF_PERMISSION[m.href]
      if (perm && !has(perm)) return false
      // Remaining items: module-toggle gate only (permission gate is
      // subsumed by the sidebar matrix now).
      if (!isModuleEnabled(m.href, enabledModules)) return false
      return true
    })
  }

  // CES users get a simplified flat More page (no collapsible groups).
  // Identify them by the ces:view permission, which only the CES role
  // preset grants.
  if (permsLoaded && has(PERM.CES_VIEW) && !has(PERM.INSPECTIONS_VIEW)) {
    const cesItems = [...mgmtItems, ...settingsItems]
      .filter(m => {
        const perm = HREF_PERMISSION[m.href]
        if (perm && !has(perm)) return false
        return true
      })
      .filter(m => isModuleEnabled(m.href, enabledModules))
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

        {/* Admin */}
        <CollapsibleGroup label="Admin" icon="🛡️" items={filterItems(adminItems)} />

        {/* Settings — flat at the bottom, no collapsible wrapper */}
        {filterItems(settingsItems).map(item => (
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
