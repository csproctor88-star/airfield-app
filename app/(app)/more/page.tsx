'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut, ChevronRight,
  RadioTower, BarChart3, ScrollText, Zap, Radio, CheckSquare,
  ClipboardCheck, ClipboardList, Bird, FileSignature, HardHat,
  AlertTriangle, MapPin, Lightbulb, PlaneLanding, Plane, Library,
  Clock, CalendarCheck, FileText, TrendingUp, GraduationCap,
  BookOpen, Users, Settings as SettingsIcon,
  Wrench, FolderOpen, Shield, SlidersHorizontal, MessageSquare,
  ShieldAlert, MessageSquareWarning, GitBranch, Siren,
  type LucideIcon,
} from 'lucide-react'
import ContactSupport from '@/components/ui/contact-support'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled } from '@/lib/modules-config'
import { usePermissions, PERM } from '@/lib/permissions'
import { useSidebarBadgeCounts } from '@/hooks/use-sidebar-badge-counts'
import { useExpiringNotamCount } from '@/lib/use-expiring-notams'

type ModuleItem = { name: string; icon: LucideIcon; color: string; href: string; adminOnly?: boolean; sysAdminOnly?: boolean }

// Pinned — same items visible on bottom nav
const pinnedItems: ModuleItem[] = [
  { name: 'Airfield Status', icon: RadioTower, color: 'var(--color-accent)', href: '/' },
  { name: 'Dashboard', icon: BarChart3, color: 'var(--color-accent)', href: '/dashboard' },
]

// Operations
const opsItems: ModuleItem[] = [
  { name: 'Events Log', icon: ScrollText, color: 'var(--color-success)', href: '/activity' },
  { name: 'QRC', icon: Zap, color: 'var(--color-warning)', href: '/qrc' },
  { name: 'Secondary Crash Net', icon: Radio, color: 'var(--color-warning)', href: '/scn' },
  { name: 'Shift Checklist', icon: CheckSquare, color: 'var(--color-accent)', href: '/shift-checklist' },
  { name: 'Airfield Checks', icon: ClipboardCheck, color: 'var(--color-cyan)', href: '/checks' },
  { name: 'All Inspections', icon: ClipboardList, color: 'var(--color-cyan)', href: '/inspections/all' },
  { name: 'Wildlife / BASH', icon: Bird, color: 'var(--color-success)', href: '/wildlife' },
  { name: 'PPR Log', icon: FileSignature, color: 'var(--color-accent)', href: '/ppr' },
  { name: 'Personnel on Airfield', icon: HardHat, color: 'var(--color-amber)', href: '/contractors' },
]

// Airfield Management
const mgmtItems: ModuleItem[] = [
  { name: 'Discrepancies', icon: AlertTriangle, color: 'var(--color-warning)', href: '/discrepancies' },
  { name: 'Obstruction Eval Tool', icon: MapPin, color: 'var(--color-orange)', href: '/obstructions' },
  { name: 'Visual NAVAIDs', icon: Lightbulb, color: 'var(--color-warning)', href: '/infrastructure' },
  { name: 'Aircraft Parking', icon: PlaneLanding, color: 'var(--color-accent)', href: '/parking' },
]

// Safety Management System (civilian Part 139 only — filtered out by
// isModuleEnabled via the SMS module's appliesTo on USAF bases).
const smsItems: ModuleItem[] = [
  { name: 'SMS Dashboard',          icon: ShieldAlert,            color: 'var(--color-success)', href: '/sms' },
  { name: 'Safety Policy',          icon: FileSignature,          color: 'var(--color-success)', href: '/sms/policy' },
  { name: 'Hazard Register',        icon: AlertTriangle,          color: 'var(--color-warning)', href: '/sms/hazards' },
  { name: 'Safety Indicators',      icon: TrendingUp,             color: 'var(--color-cyan)',    href: '/sms/spis' },
  { name: 'Safety Reports',         icon: MessageSquareWarning,   color: 'var(--color-warning)', href: '/sms/reports' },
  { name: 'SMS Audits',             icon: ClipboardCheck,         color: 'var(--color-success)', href: '/sms/audits' },
  { name: 'Management of Change',   icon: GitBranch,              color: 'var(--color-cyan)',    href: '/sms/moc' },
]

// §139.303 Training & Compliance (civilian Part 139 only — same gating
// as SMS via the training_part139 module's appliesTo).
const training139Items: ModuleItem[] = [
  { name: 'Training Overview',   icon: GraduationCap, color: 'var(--color-cyan)',    href: '/training' },
  { name: 'Training Topics',     icon: BookOpen,      color: 'var(--color-accent)',  href: '/training/topics' },
  { name: 'Training Roster',     icon: Users,         color: 'var(--color-success)', href: '/training/roster' },
  { name: 'Training Compliance', icon: ClipboardCheck, color: 'var(--color-warning)', href: '/training/compliance' },
]

// Airport Emergency Plan (civilian Part 139 only — same gating via the
// aep module's appliesTo). On civilian bases this replaces the SCN
// entry under Operations.
const aepItems: ModuleItem[] = [
  { name: 'Emergency Plan',    icon: ShieldAlert, color: 'var(--color-warning)', href: '/aep' },
  { name: 'AEP Document',      icon: FileText,    color: 'var(--color-accent)',  href: '/aep/plan' },
  { name: 'Response Agencies', icon: Users,       color: 'var(--color-success)', href: '/aep/agencies' },
  { name: 'AEP Comms Checks',  icon: Radio,       color: 'var(--color-cyan)',    href: '/aep/comms-checks' },
  { name: 'AEP Drills',        icon: Siren,       color: 'var(--color-orange)',  href: '/aep/drills' },
]

// Reference
const refItems: ModuleItem[] = [
  { name: 'Aircraft Database', icon: Plane, color: 'var(--color-accent)', href: '/aircraft' },
  { name: 'Reference Library', icon: Library, color: 'var(--color-cyan)', href: '/regulations' },
  { name: 'NOTAMs', icon: RadioTower, color: 'var(--color-cyan)', href: '/notams' },
  { name: 'Help & Training', icon: GraduationCap, color: 'var(--color-accent)', href: '/help' },
]

// Admin
const adminItems: ModuleItem[] = [
  { name: 'Base Configuration', icon: SlidersHorizontal, color: 'var(--color-cyan)', href: '/base-config' },
  { name: 'Activity Log', icon: Clock, color: 'var(--color-success)', href: '/recent-activity' },
  { name: 'Daily Reviews', icon: CalendarCheck, color: 'var(--color-purple)', href: '/daily-reviews' },
  { name: 'Waivers', icon: FileText, color: 'var(--color-purple)', href: '/waivers' },
  { name: 'Reports & Analytics', icon: TrendingUp, color: 'var(--color-cyan)', href: '/reports' },
  { name: 'PDF Library', icon: BookOpen, color: 'var(--color-purple)', href: '/library', adminOnly: true },
  { name: 'User Management', icon: Users, color: 'var(--color-text-3)', href: '/users', adminOnly: true },
  { name: 'Customer Feedback', icon: MessageSquare, color: 'var(--color-accent)', href: '/feedback' },
]

// Settings
const settingsItems: ModuleItem[] = [
  { name: 'Settings', icon: SettingsIcon, color: 'var(--color-text-3)', href: '/settings' },
]

function NavItem({ item, badgeCount = 0 }: { item: ModuleItem; badgeCount?: number }) {
  const Icon = item.icon
  // Discrepancies pending-verification dot is green per the dot-color
  // convention; PPR / QRC / NOTAM dots stay red.
  const dotIsGreen = item.href === '/discrepancies'
  return (
    <Link
      href={item.href}
      data-tour={`more-item-${item.href === '/' ? 'home' : item.href.slice(1).replace(/\//g, '-')}`}
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
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: `color-mix(in srgb, ${item.color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${item.color} 18%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={item.color} strokeWidth={2} />
        {badgeCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8,
            background: dotIsGreen ? 'var(--color-success)' : 'var(--color-danger)',
            color: '#fff',
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            boxShadow: dotIsGreen ? '0 0 6px rgba(52,211,153,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
          }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{item.name}</div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--color-text-4)', flexShrink: 0 }} />
    </Link>
  )
}

function CollapsibleGroup({ label, icon, items, defaultOpen, badgeFor }: { label: string; icon: LucideIcon; items: ModuleItem[]; defaultOpen?: boolean; badgeFor?: (href: string) => number }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const Icon = icon

  // Tour engine asks /more to open a specific group before anchoring
  // on a child item. Each CollapsibleGroup listens for the event and
  // opens itself when its label matches.
  useEffect(() => {
    function onExpand(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail === label) setOpen(true)
    }
    window.addEventListener('glidepath:more-expand-group', onExpand)
    return () => window.removeEventListener('glidepath:more-expand-group', onExpand)
  }, [label])

  if (items.length === 0) return null

  const groupBadgeCount = badgeFor
    ? items.reduce((sum, m) => sum + (badgeFor(m.href) || 0), 0)
    : 0
  // Airfield Management aggregates the Discrepancies-pending-verification
  // dot, which is green; other group headers (Operations, Reference) stay
  // red to match their child pending dots.
  const groupDotIsGreen = label === 'Airfield Management'

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        data-tour={`more-section-${label.toLowerCase().replace(/\s+/g, '-')}`}
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
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--color-text-3) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-text-3) 16%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color="var(--color-text-2)" strokeWidth={2} />
          {!open && groupBadgeCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8,
              background: groupDotIsGreen ? 'var(--color-success)' : 'var(--color-danger)',
              color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              boxShadow: groupDotIsGreen ? '0 0 6px rgba(52,211,153,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {groupBadgeCount > 9 ? '9+' : groupBadgeCount}
            </span>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{label}</div>
        </div>
        <ChevronRight
          size={16}
          style={{
            color: 'var(--color-text-4)',
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
        />
      </button>
      {open && items.map(item => (
        <div key={item.href} style={{ paddingLeft: 16 }}>
          <NavItem item={item} badgeCount={badgeFor?.(item.href) ?? 0} />
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
  '/base-config':    PERM.BASE_SETUP_WRITE,
  '/library':        PERM.LIBRARY_VIEW,
  '/users':          PERM.USERS_VIEW,
  '/feedback':       PERM.FEEDBACK_VIEW,
}

export default function MorePage() {
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const { has, loaded: permsLoaded } = usePermissions()
  const badgeCounts = useSidebarBadgeCounts()
  const expiringNotamCount = useExpiringNotamCount()

  const badgeFor = (href: string): number => {
    if (href === '/qrc') return badgeCounts.qrc
    if (href === '/ppr') return badgeCounts.ppr
    if (href === '/discrepancies') return badgeCounts.discrepancies
    if (href === '/notams') return expiringNotamCount
    return 0
  }

  function filterItems(items: ModuleItem[]) {
    if (!permsLoaded) return items.filter(m => !m.adminOnly && !m.sysAdminOnly)
    return items.filter(m => {
      const perm = HREF_PERMISSION[m.href]
      if (perm && !has(perm)) return false
      // Remaining items: module-toggle gate only (permission gate is
      // subsumed by the sidebar matrix now). airport_type filter hides
      // USAF-only modules (AMTR, SCN, ACSI) on civilian bases.
      if (!isModuleEnabled(m.href, enabledModules, airportType)) return false
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
      .filter(m => isModuleEnabled(m.href, enabledModules, airportType))
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>
        <div style={{
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', marginBottom: 12, overflow: 'hidden',
        }}>
          {cesItems.map(item => (
            <NavItem key={item.href} item={item} badgeCount={badgeFor(item.href)} />
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
        <div data-tour="more-pinned">
          {pinnedItems.map(item => (
            <NavItem key={item.href} item={item} badgeCount={badgeFor(item.href)} />
          ))}
        </div>

        {/* Operations */}
        <CollapsibleGroup label="Operations" icon={Wrench} items={filterItems(opsItems)} defaultOpen badgeFor={badgeFor} />

        {/* Airfield Management */}
        <CollapsibleGroup label="Airfield Management" icon={FolderOpen} items={filterItems(mgmtItems)} badgeFor={badgeFor} />

        {/* Safety Management System (civilian only — filterItems hides on USAF) */}
        <CollapsibleGroup label="Safety Management System" icon={ShieldAlert} items={filterItems(smsItems)} badgeFor={badgeFor} />

        {/* §139.303 Training & Compliance (civilian only — same gating as SMS) */}
        <CollapsibleGroup label="Training & Compliance" icon={GraduationCap} items={filterItems(training139Items)} badgeFor={badgeFor} />

        {/* Airport Emergency Plan (civilian only — same gating as SMS) */}
        <CollapsibleGroup label="Airport Emergency Plan" icon={ShieldAlert} items={filterItems(aepItems)} badgeFor={badgeFor} />

        {/* Reference */}
        <CollapsibleGroup label="Reference" icon={Library} items={filterItems(refItems)} badgeFor={badgeFor} />

        {/* Admin */}
        <CollapsibleGroup label="Admin" icon={Shield} items={filterItems(adminItems)} badgeFor={badgeFor} />

        {/* Settings — flat at the bottom, no collapsible wrapper */}
        {filterItems(settingsItems).map(item => (
          <NavItem key={item.href} item={item} badgeCount={badgeFor(item.href)} />
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
