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
  BookOpen, BookMarked, Users, Award, Settings as SettingsIcon,
  Wrench, FolderOpen, Shield, SlidersHorizontal, MessageSquare,
  ShieldAlert, MessageSquareWarning, GitBranch, Siren, CloudSnow,
  Search, X, BookOpenCheck, Car,
  type LucideIcon,
} from 'lucide-react'
import { NAV_ITEM_MAP } from '@/lib/sidebar-config'
import { scoreNavMatch } from '@/lib/nav-search'
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
  { name: 'Events Log', icon: ScrollText, color: 'var(--color-success)', href: '/activity' },
]

// Daily Operations
const opsItems: ModuleItem[] = [
  { name: 'QRC', icon: Zap, color: 'var(--color-warning)', href: '/qrc' },
  // Secondary Crash Net — USAF-only; isModuleEnabled hides it on civilian
  // bases, which surface the Airport Emergency Plan group instead.
  { name: 'Secondary Crash Net', icon: Radio, color: 'var(--color-accent)', href: '/scn' },
  // Flight Planning Room Check — USAF-only, opt-in (defaultEnabled: false);
  // isModuleEnabled hides it until a base enables the fpr module.
  { name: 'Flight Planning Room', icon: BookOpenCheck, color: 'var(--color-cyan)', href: '/fpr' },
  { name: 'Shift Checklist', icon: CheckSquare, color: 'var(--color-accent)', href: '/shift-checklist' },
  { name: 'Airfield Checks', icon: ClipboardCheck, color: 'var(--color-cyan)', href: '/checks' },
  { name: 'All Inspections', icon: ClipboardList, color: 'var(--color-cyan)', href: '/inspections/all' },
  { name: 'Wildlife / BASH', icon: Bird, color: 'var(--color-success)', href: '/wildlife' },
  // Civilian-only — module-config appliesTo: ['faa_part139'] hides on USAF bases.
  { name: 'Wildlife / WHMP', icon: ClipboardCheck, color: 'var(--color-success)', href: '/wildlife/whmp' },
  { name: 'PPR Log', icon: FileSignature, color: 'var(--color-accent)', href: '/ppr' },
  { name: 'Personnel on Airfield', icon: HardHat, color: 'var(--color-amber)', href: '/contractors' },
  // Driving Spot Checks — USAF-only, opt-in (defaultEnabled: false);
  // isModuleEnabled hides it until a base enables the driving_checks module.
  { name: 'Driving Spot Checks', icon: Car, color: 'var(--color-cyan)', href: '/driving-checks' },
  // Civilian-only.
  { name: 'Field Conditions / TALPA', icon: CloudSnow, color: 'var(--color-cyan)', href: '/field-conditions' },
  { name: 'NOTAMs', icon: RadioTower, color: 'var(--color-cyan)', href: '/notams' },
]

// Airfield Management
const mgmtItems: ModuleItem[] = [
  { name: 'Discrepancies', icon: AlertTriangle, color: 'var(--color-warning)', href: '/discrepancies' },
  { name: 'Visual NAVAIDs', icon: Lightbulb, color: 'var(--color-warning)', href: '/infrastructure' },
  { name: 'Waivers', icon: Shield, color: 'var(--color-purple)', href: '/waivers' },
  { name: 'Daily Reviews', icon: CalendarCheck, color: 'var(--color-purple)', href: '/daily-reviews' },
  { name: 'Aircraft Parking', icon: PlaneLanding, color: 'var(--color-accent)', href: '/parking' },
  { name: 'Obstruction Eval Tool', icon: MapPin, color: 'var(--color-orange)', href: '/obstructions' },
  // USAF-only (isModuleEnabled hides on civilian bases); HREF_PERMISSION below
  // gates it to amtr:view holders so read-only members don't see it.
  { name: 'Training Records', icon: Award, color: 'var(--color-purple)', href: '/amtr' },
  // Gated to read_file:view (operational roles) via HREF_PERMISSION below.
  { name: 'Read File', icon: ClipboardCheck, color: 'var(--color-purple)', href: '/read-file' },
  // Gated to ces:view (CES role + sys_admin) via HREF_PERMISSION below.
  { name: 'CES Work Orders', icon: Wrench, color: 'var(--color-cyan)', href: '/ces' },
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
  { name: 'Reports & Analytics', icon: TrendingUp, color: 'var(--color-cyan)', href: '/reports' },
  { name: 'Glidepath Training', icon: GraduationCap, color: 'var(--color-accent)', href: '/help' },
]

// Admin
// (PDF Library is intentionally not here — it lives on the Settings page,
// sys-admin only.)
const adminItems: ModuleItem[] = [
  { name: 'Activity Log', icon: Clock, color: 'var(--color-success)', href: '/recent-activity' },
  { name: 'Customer Feedback', icon: MessageSquare, color: 'var(--color-accent)', href: '/feedback' },
  // Gated to flip:view (airfield-management leadership + admins) via HREF_PERMISSION,
  // and to bases with the FLIP module enabled via isModuleEnabled.
  { name: 'FLIP Management', icon: BookMarked, color: 'var(--color-purple)', href: '/flip' },
  { name: 'User Management', icon: Users, color: 'var(--color-text-3)', href: '/users', adminOnly: true },
  { name: 'Base Configuration', icon: SlidersHorizontal, color: 'var(--color-cyan)', href: '/base-config' },
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

function SearchBox({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--color-text-4)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onChange('')
            else if (e.key === 'Enter') onEnter()
          }}
          placeholder="Search…"
          aria-label="Search navigation"
          style={{
            width: '100%',
            padding: value ? '10px 36px 10px 36px' : '10px 12px 10px 36px',
            background: 'var(--color-bg-inset)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-md)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            title="Clear search"
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-3)', padding: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
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
  '/users':          PERM.USERS_VIEW,
  '/feedback':       PERM.FEEDBACK_VIEW,
  '/amtr':           PERM.AMTR_VIEW,
  '/flip':           PERM.FLIP_VIEW,
  '/read-file':      PERM.READ_FILE_VIEW,
  '/ces':            PERM.CES_VIEW,
  '/fpr':            PERM.FPR_VIEW,
  '/driving-checks': PERM.DRIVING_CHECKS_VIEW,
}

export default function MorePage() {
  const router = useRouter()
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const { has, loaded: permsLoaded } = usePermissions()
  const badgeCounts = useSidebarBadgeCounts()
  const expiringNotamCount = useExpiringNotamCount()
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim()

  const badgeFor = (href: string): number => {
    if (href === '/qrc') return badgeCounts.qrc
    if (href === '/ppr') return badgeCounts.ppr
    if (href === '/discrepancies') return badgeCounts.discrepancies
    if (href === '/notams') return expiringNotamCount
    return 0
  }

  function filterItems(items: ModuleItem[]) {
    return items.filter(m => {
      // Module/airport gate is known at render time (installation context gates
      // the app on `loaded`), so apply it ALWAYS — even before permissions
      // resolve. This stops civilian-only modules (WHMP, Field Conditions) from
      // flashing on USAF bases during the perms-loading window.
      if (!isModuleEnabled(m.href, enabledModules, airportType)) return false
      const perm = HREF_PERMISSION[m.href]
      // While permissions are still loading, hide gated/admin items rather than
      // showing them and removing them once the matrix resolves (which gives a
      // false picture of the user's access). They appear once confirmed.
      if (perm || m.adminOnly || m.sysAdminOnly) {
        if (!permsLoaded) return false
        if (perm && !has(perm)) return false
      }
      return true
    })
  }

  // Flat ranked search over every destination, then run through the same
  // filterItems gate so permission/module/airport-type rules apply exactly as
  // the grouped view does — search never surfaces an inaccessible page.
  function searchAcross(items: ModuleItem[]): ModuleItem[] {
    if (!trimmedQuery) return []
    const ranked = items
      .map(item => ({ item, score: scoreNavMatch(trimmedQuery, item.name, NAV_ITEM_MAP.get(item.href)?.keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
    return filterItems(ranked)
  }

  const ALL_MORE_ITEMS: ModuleItem[] = [
    ...pinnedItems, ...opsItems, ...mgmtItems, ...smsItems,
    ...training139Items, ...aepItems, ...refItems, ...adminItems, ...settingsItems,
  ]
  const searchResults = searchAcross(ALL_MORE_ITEMS)

  function renderSearchResults(results: ModuleItem[]) {
    if (results.length === 0) {
      return (
        <div style={{ padding: '16px', fontSize: 'var(--fs-md)', color: 'var(--color-text-4)', fontStyle: 'italic' }}>
          No matches for “{trimmedQuery}”
        </div>
      )
    }
    return results.map(item => (
      <NavItem key={item.href} item={item} badgeCount={badgeFor(item.href)} />
    ))
  }

  // CES users get a simplified flat More page (no collapsible groups).
  // Identify them by the ces:view permission, which only the CES role
  // preset grants.
  if (permsLoaded && has(PERM.CES_VIEW) && !has(PERM.INSPECTIONS_VIEW)) {
    // CES role's simplified page: only their working set (CES Work Orders,
    // Discrepancies, Visual NAVAIDs) plus Settings — not the full Airfield
    // Management list that now lives in mgmtItems.
    const cesHrefs = new Set(['/ces', '/discrepancies', '/infrastructure'])
    const cesItems = [...mgmtItems.filter(m => cesHrefs.has(m.href)), ...settingsItems]
      .filter(m => isModuleEnabled(m.href, enabledModules, airportType))
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>
        <div style={{
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', marginBottom: 12, overflow: 'hidden',
        }}>
          <SearchBox
            value={query}
            onChange={setQuery}
            onEnter={() => { const r = searchAcross(cesItems); if (r[0]) router.push(r[0].href) }}
          />
          {trimmedQuery
            ? renderSearchResults(searchAcross(cesItems))
            : cesItems.map(item => (
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
        {/* Search filter — typing replaces the grouped menu with a flat ranked list. */}
        <SearchBox
          value={query}
          onChange={setQuery}
          onEnter={() => { if (searchResults[0]) router.push(searchResults[0].href) }}
        />

        {trimmedQuery ? (
          renderSearchResults(searchResults)
        ) : (
          <>
            {/* Pinned items */}
            <div data-tour="more-pinned">
              {pinnedItems.map(item => (
                <NavItem key={item.href} item={item} badgeCount={badgeFor(item.href)} />
              ))}
            </div>

            {/* Daily Operations */}
            <CollapsibleGroup label="Daily Operations" icon={Wrench} items={filterItems(opsItems)} defaultOpen badgeFor={badgeFor} />

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
          </>
        )}
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
