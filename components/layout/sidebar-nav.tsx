'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSidebar } from '@/lib/sidebar-context'
import { useTheme } from '@/lib/theme-context'
import { useExpiringNotamCount } from '@/lib/use-expiring-notams'
import { useSidebarBadgeCounts } from '@/hooks/use-sidebar-badge-counts'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled } from '@/lib/modules-config'
import { usePermissions } from '@/lib/permissions'
import ContactSupport from '@/components/ui/contact-support'
import {
  DEFAULT_SIDEBAR_CONFIG,
  NAV_ITEM_MAP,
  loadSidebarConfig,
  saveSidebarConfig,
  resetSidebarConfig,
  type SidebarConfig,
  type SidebarSection,
} from '@/lib/sidebar-config'
import {
  Home,
  LayoutDashboard,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  MapPin,
  FileText,
  Shield,
  BarChart3,
  Plane,
  BookOpen,
  BookMarked,
  Settings,
  Users,
  Activity,
  HardHat,
  ListChecks,
  Zap,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  Lightbulb,
  Bird,
  PlaneLanding,
  Wrench,
  SlidersHorizontal,
  FolderOpen,
  GraduationCap,
  Radio,
  MessageSquare,
  History,
  GripVertical,
  Pencil,
  RotateCcw,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

// Icon lookup by name string
const ICON_MAP: Record<string, LucideIcon> = {
  Home, LayoutDashboard, Activity, Zap, ListChecks, ClipboardCheck, ClipboardList, ClipboardPen,
  Bird, HardHat, AlertTriangle, MapPin, Database, Shield, Lightbulb,
  PlaneLanding, Plane, BookOpen, FileText, BarChart3, Settings, BookMarked, Users,
  Wrench, SlidersHorizontal, FolderOpen, GraduationCap, Radio, MessageSquare, History,
}

// Group icons
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Operations': Wrench,
  'Airfield Management': FolderOpen,
  'Reference': BookOpen,
  'Admin': Shield,
  'Settings': Settings,
}

// Map each sidebar href to the `:view` permission that controls it.
// Items not listed here stay visible to everyone (e.g. future hrefs
// added in saved sidebar configs before the matrix is updated).
const HREF_TO_VIEW_PERM: Record<string, string> = {
  '/':                  'airfield_status:view',
  '/dashboard':         'dashboard:view',
  '/activity':          'activity_log:view',
  '/recent-activity':   'recent_activity:view',
  '/qrc':               'qrc:view',
  '/scn':               'scn:view',
  '/shift-checklist':   'shift_checklist:view',
  '/daily-reviews':     'daily_reviews:view',
  '/checks':            'checks:view',
  '/inspections/all':   'inspections:view',
  '/inspections':       'inspections:view',
  '/wildlife':          'wildlife:view',
  '/ppr':               'ppr:view',
  '/feedback':          'feedback:view',
  '/contractors':       'contractors:view',
  '/ces':               'ces:view',
  '/discrepancies':     'discrepancies:view',
  '/obstructions':      'obstructions:view',
  '/waivers':           'waivers:view',
  '/infrastructure':    'infrastructure:view',
  '/parking':           'parking:view',
  '/aircraft':          'aircraft:view',
  '/regulations':       'regulations:view',
  '/notams':            'notams:view',
  '/reports':           'reports:view',
  '/settings':          'settings:view',
  '/library':           'library:view',
  '/users':             'users:view',
  '/training':          'training:view',
  '/base-config':       'base_setup:write',
}

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Home
}

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, toggle } = useSidebar()
  const { resolvedTheme } = useTheme()
  const expiringNotamCount = useExpiringNotamCount()
  const badgeCounts = useSidebarBadgeCounts()
  const { enabledModules } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const [isKioskRole, setIsKioskRole] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState<SidebarConfig>(DEFAULT_SIDEBAR_CONFIG)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [editMode, setEditMode] = useState(false)
  const [editConfig, setEditConfig] = useState<SidebarConfig>(DEFAULT_SIDEBAR_CONFIG)
  const [saving, setSaving] = useState(false)

  // Drag state
  const dragItem = useRef<{ href: string; fromSection: number; fromIndex: number; fromPinned: boolean } | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)

  // Load user role + sidebar config
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      if (!supabase) {
        setLoaded(true)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = profile?.role ?? 'read_only'
        // Kiosk roles get a flattened nav with the installation switcher
        // and all collapsible groups hidden — handled elsewhere via this flag.
        setIsKioskRole(role === 'airfield_status' || role === 'atc')
      } catch {
        // No auth
      }

      // Load custom sidebar config
      const custom = await loadSidebarConfig()
      if (custom) setConfig(custom)

      setLoaded(true)
    }

    init()
  }, [])

  // Auto-expand group if a child route is active
  useEffect(() => {
    for (const section of config.sections) {
      if (section.items.some(href => isActive(href))) {
        setOpenGroups(prev => ({ ...prev, [section.label]: true }))
      }
    }
  }, [pathname, config]) // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (pathname === href) return true
    if (!pathname.startsWith(href + '/')) return false
    // If a more specific nav item also matches, this one is not active
    const allHrefs = [...config.pinned, ...config.sections.flatMap(s => s.items)]
    const moreSpecific = allHrefs.some(h => h !== href && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')))
    return !moreSpecific
  }

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isItemVisible(href: string) {
    // Permission matrix is the primary gate. Every nav item in the
    // app has a corresponding `*:view` key in HREF_TO_VIEW_PERM;
    // hide the item if the user doesn't hold that key.
    const requiredPerm = HREF_TO_VIEW_PERM[href]
    if (requiredPerm && permsLoaded && !has(requiredPerm)) return false

    // Base-level module-on-off toggle (independent of role).
    if (!isModuleEnabled(href, enabledModules)) return false
    return true
  }

  // ── Edit mode handlers ──

  function enterEditMode() {
    setEditConfig(JSON.parse(JSON.stringify(config)))
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditConfig(config)
  }

  async function saveEdit() {
    setSaving(true)
    const ok = await saveSidebarConfig(editConfig)
    if (ok) {
      setConfig(editConfig)
      setEditMode(false)
    }
    setSaving(false)
  }

  async function handleReset() {
    setSaving(true)
    const ok = await resetSidebarConfig()
    if (ok) {
      setConfig(DEFAULT_SIDEBAR_CONFIG)
      setEditConfig(DEFAULT_SIDEBAR_CONFIG)
      setEditMode(false)
    }
    setSaving(false)
  }

  // Move item within pinned or within a section
  const moveItem = useCallback((fromPinned: boolean, sectionIdx: number, itemIdx: number, direction: -1 | 1) => {
    setEditConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as SidebarConfig
      if (fromPinned) {
        const arr = next.pinned
        const newIdx = itemIdx + direction
        if (newIdx < 0 || newIdx >= arr.length) return prev
        ;[arr[itemIdx], arr[newIdx]] = [arr[newIdx], arr[itemIdx]]
      } else {
        const arr = next.sections[sectionIdx].items
        const newIdx = itemIdx + direction
        if (newIdx < 0 || newIdx >= arr.length) return prev
        ;[arr[itemIdx], arr[newIdx]] = [arr[newIdx], arr[itemIdx]]
      }
      return next
    })
  }, [])

  // Move item to pinned or to a section
  const moveItemToSection = useCallback((href: string, targetSectionIdx: number | 'pinned') => {
    setEditConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as SidebarConfig

      // Remove from current location
      next.pinned = next.pinned.filter(h => h !== href)
      for (const s of next.sections) {
        s.items = s.items.filter(h => h !== href)
      }

      // Add to target
      if (targetSectionIdx === 'pinned') {
        next.pinned.push(href)
      } else {
        next.sections[targetSectionIdx].items.push(href)
      }

      return next
    })
  }, [])

  // ── Drag handlers ──

  function handleDragStart(e: React.DragEvent, href: string, fromPinned: boolean, sectionIdx: number, itemIdx: number) {
    dragItem.current = { href, fromPinned, fromSection: sectionIdx, fromIndex: itemIdx }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', href)
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetId)
  }

  function handleDragLeave() {
    setDragOverTarget(null)
  }

  function handleDropOnSection(e: React.DragEvent, targetSectionIdx: number | 'pinned') {
    e.preventDefault()
    setDragOverTarget(null)
    if (!dragItem.current) return
    moveItemToSection(dragItem.current.href, targetSectionIdx)
    dragItem.current = null
  }

  function handleDragEnd() {
    setDragOverTarget(null)
    dragItem.current = null
  }

  // ── Rendering ──

  function renderNavItem(href: string, indented?: boolean) {
    const def = NAV_ITEM_MAP.get(href)
    if (!def) return null
    if (!isItemVisible(href)) return null

    const Icon = getIcon(def.iconName)
    const active = isActive(href)

    return (
      <Link
        key={href}
        href={href}
        title={!isOpen ? def.name : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? undefined : 'center',
          gap: isOpen ? 12 : 0,
          padding: isOpen ? `10px 20px${indented ? ' 10px 34px' : ''}` : '10px 0',
          textDecoration: 'none',
          color: active ? 'var(--color-accent)' : 'var(--color-text-2)',
          background: active ? 'var(--color-accent-glow)' : 'transparent',
          borderRight: active ? '3px solid var(--color-accent)' : '3px solid transparent',
          fontSize: indented && isOpen ? 'var(--fs-sm)' : 'var(--fs-md)',
          fontWeight: active ? 700 : 500,
          transition: 'background 0.15s, color 0.15s',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <Icon size={indented ? 16 : 18} />
          {href === '/notams' && expiringNotamCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-danger)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {expiringNotamCount > 9 ? '9+' : expiringNotamCount}
            </span>
          )}
          {/* PPR pending dot — suppress while viewing /ppr since the
              user is already aware. Operations section header keeps
              its own dot regardless. */}
          {href === '/ppr' && badgeCounts.ppr > 0 && !active && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-danger)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {badgeCounts.ppr > 9 ? '9+' : badgeCounts.ppr}
            </span>
          )}
          {/* QRC active dot — same pattern as PPR. */}
          {href === '/qrc' && badgeCounts.qrc > 0 && !active && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-danger)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {badgeCounts.qrc > 9 ? '9+' : badgeCounts.qrc}
            </span>
          )}
          {/* Discrepancies pending-verification dot — work_completed_awaiting_verification rows
              waiting for AMOPS final close. Same suppression rules as PPR/QRC. */}
          {href === '/discrepancies' && badgeCounts.discrepancies > 0 && !active && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-success)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(52,211,153,0.5)',
            }}>
              {badgeCounts.discrepancies > 9 ? '9+' : badgeCounts.discrepancies}
            </span>
          )}
        </span>
        {isOpen && <span style={{ flex: 1 }}>{def.name}</span>}
        {isOpen && href === '/notams' && expiringNotamCount > 0 && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-danger)', marginLeft: 'auto' }}>
            {expiringNotamCount} expiring
          </span>
        )}
        {isOpen && href === '/ppr' && badgeCounts.ppr > 0 && !active && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-danger)', marginLeft: 'auto' }}>
            {badgeCounts.ppr} pending
          </span>
        )}
        {isOpen && href === '/qrc' && badgeCounts.qrc > 0 && !active && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-danger)', marginLeft: 'auto' }}>
            {badgeCounts.qrc} active
          </span>
        )}
        {isOpen && href === '/discrepancies' && badgeCounts.discrepancies > 0 && !active && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-success)', marginLeft: 'auto' }}>
            {badgeCounts.discrepancies} to verify
          </span>
        )}
      </Link>
    )
  }

  function renderEditItem(href: string, fromPinned: boolean, sectionIdx: number, itemIdx: number, totalItems: number) {
    const def = NAV_ITEM_MAP.get(href)
    if (!def) return null
    if (!isItemVisible(href)) return null

    const Icon = getIcon(def.iconName)

    return (
      <div
        key={href}
        draggable
        onDragStart={(e) => handleDragStart(e, href, fromPinned, sectionIdx, itemIdx)}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 16px',
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-2)',
          cursor: 'grab',
          background: 'transparent',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <GripVertical size={14} style={{ color: 'var(--color-text-4)', flexShrink: 0 }} />
        <Icon size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.name}</span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => moveItem(fromPinned, sectionIdx, itemIdx, -1)}
            disabled={itemIdx === 0}
            style={{
              background: 'none', border: 'none', cursor: itemIdx === 0 ? 'default' : 'pointer',
              color: itemIdx === 0 ? 'var(--color-text-4)' : 'var(--color-text-3)', padding: 2,
              display: 'flex', alignItems: 'center',
            }}
            title="Move up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={() => moveItem(fromPinned, sectionIdx, itemIdx, 1)}
            disabled={itemIdx === totalItems - 1}
            style={{
              background: 'none', border: 'none',
              cursor: itemIdx === totalItems - 1 ? 'default' : 'pointer',
              color: itemIdx === totalItems - 1 ? 'var(--color-text-4)' : 'var(--color-text-3)', padding: 2,
              display: 'flex', alignItems: 'center',
            }}
            title="Move down"
          >
            <ArrowDown size={12} />
          </button>
        </div>
      </div>
    )
  }

  function renderGroupHeader(section: SidebarSection) {
    const GroupIcon = GROUP_ICONS[section.label] || FolderOpen
    const isGroupOpen = openGroups[section.label] ?? false
    const hasActiveChild = section.items.some(href => isActive(href))

    // Aggregate per-section pending count. Add new modules here as
    // they start contributing to the sidebar badge hook.
    const sectionPendingCount =
      (section.items.includes('/ppr') ? badgeCounts.ppr : 0)
      + (section.items.includes('/qrc') ? badgeCounts.qrc : 0)
      + (section.items.includes('/discrepancies') ? badgeCounts.discrepancies : 0)

    // Airfield Management's only badge contributor is Discrepancies-pending-
    // verification, which uses green per the dot-color convention. Other
    // sections (Operations PPR/QRC) keep the standard red pending dot.
    const sectionDotIsGreen = section.label === 'Airfield Management'

    return (
      <button
        onClick={() => toggleGroup(section.label)}
        title={!isOpen ? section.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? undefined : 'center',
          gap: isOpen ? 12 : 0,
          padding: isOpen ? '10px 20px' : '10px 0',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: hasActiveChild ? 'var(--color-accent)' : 'var(--color-text-3)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          textAlign: 'left',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <GroupIcon size={16} />
          {sectionPendingCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 14 : 12, height: isOpen ? 14 : 12,
              borderRadius: '50%',
              background: sectionDotIsGreen ? 'var(--color-success)' : 'var(--color-danger)',
              color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              boxShadow: sectionDotIsGreen ? '0 0 6px rgba(52,211,153,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {sectionPendingCount > 9 ? '9+' : sectionPendingCount}
            </span>
          )}
        </span>
        {isOpen && (
          <>
            <span style={{ flex: 1 }}>{section.label}</span>
            {isGroupOpen
              ? <ChevronDown size={12} style={{ color: 'var(--color-text-4)' }} />
              : <ChevronRight size={12} style={{ color: 'var(--color-text-4)' }} />
            }
          </>
        )}
      </button>
    )
  }

  function renderEditSection(section: SidebarSection, sectionIdx: number) {
    const dropId = `section-${sectionIdx}`
    const isOver = dragOverTarget === dropId
    // /settings is locked at the bottom of the nav — hide from edit/drag UI.
    const visibleItems = section.items
      .filter(href => href !== '/settings')
      .filter(href => isItemVisible(href))

    return (
      <div
        key={section.label}
        onDragOver={(e) => handleDragOver(e, dropId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropOnSection(e, sectionIdx)}
        style={{
          marginBottom: 8,
          borderRadius: 'var(--radius-md)',
          border: isOver ? '1px dashed var(--color-accent)' : '1px solid transparent',
          background: isOver ? 'var(--color-accent-glow)' : 'transparent',
          transition: 'border 0.15s, background 0.15s',
        }}
      >
        <div style={{
          fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '6px 16px 2px',
        }}>
          {section.label}
        </div>
        {visibleItems.map((href, idx) =>
          renderEditItem(href, false, sectionIdx, idx, visibleItems.length)
        )}
        {visibleItems.length === 0 && (
          <div style={{ padding: '8px 16px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', fontStyle: 'italic' }}>
            Drop items here
          </div>
        )}
      </div>
    )
  }

  // Kiosk roles (airfield_status, atc) — hide the sidebar entirely.
  if (loaded && isKioskRole) return null

  // ── Edit mode UI ──
  if (editMode && isOpen) {
    const pinnedVisible = editConfig.pinned
      .filter(href => href !== '/settings')
      .filter(href => isItemVisible(href))
    const pinnedDropId = 'section-pinned'
    const isPinnedOver = dragOverTarget === pinnedDropId

    return (
      <nav className="sidebar-drawer" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Edit header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Customize Nav
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleReset}
              disabled={saving}
              title="Reset to default"
              style={{
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                padding: '4px 8px', cursor: 'pointer', color: 'var(--color-text-3)',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel"
              style={{
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                padding: '4px 8px', cursor: 'pointer', color: 'var(--color-text-3)',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              title="Save"
              style={{
                background: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '4px 10px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Check size={12} /> {saving ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Edit body */}
        <div style={{ flex: 1, padding: '8px 4px', overflowY: 'auto' }}>
          <div style={{
            fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', padding: '0 12px 8px',
            lineHeight: 1.4,
          }}>
            Drag items between sections or use arrows to reorder. Changes sync across all your devices.
          </div>

          {/* Pinned section */}
          <div
            onDragOver={(e) => handleDragOver(e, pinnedDropId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropOnSection(e, 'pinned')}
            style={{
              marginBottom: 8,
              borderRadius: 'var(--radius-md)',
              border: isPinnedOver ? '1px dashed var(--color-accent)' : '1px solid transparent',
              background: isPinnedOver ? 'var(--color-accent-glow)' : 'transparent',
              transition: 'border 0.15s, background 0.15s',
            }}
          >
            <div style={{
              fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-accent)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '6px 16px 2px',
            }}>
              Pinned
            </div>
            {pinnedVisible.map((href, idx) =>
              renderEditItem(href, true, -1, idx, pinnedVisible.length)
            )}
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 12px 8px' }} />

          {/* Grouped sections */}
          {editConfig.sections.map((section, idx) => renderEditSection(section, idx))}
        </div>
      </nav>
    )
  }

  // ── Normal sidebar ──
  // CES / safety / ppr / majcom_rfm users see the default structure
  // with the matrix naturally filtering to just their :view hrefs.
  const activeConfig = config

  return (
    <nav className={`sidebar-drawer${isOpen ? '' : ' sidebar-collapsed'}`}>
      {/* Header with logo + tagline + collapse toggle.
          When expanded, the logo and tagline stay centered as a
          stacked unit and the collapse toggle floats in the top-right
          corner so it doesn't pull the wordmark off-center. When
          collapsed, only the toggle is shown, centered. */}
      <div style={{
        padding: isOpen ? '20px 16px 12px' : '20px 0 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}>
        {isOpen ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
              alt="Glidepath"
              style={{ height: 40, objectFit: 'contain', marginBottom: 2 }}
            />
            <div style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'var(--color-text-2)',
              letterSpacing: '0.04em',
              lineHeight: 1.4,
              textAlign: 'center',
            }}>
              Guiding You to Mission Success
            </div>
            <button
              onClick={toggle}
              title="Collapse sidebar"
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-3)', padding: 6, borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={toggle}
            title="Expand sidebar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-3)', padding: 6, borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {/* Pinned items — /settings is always rendered flat at the bottom
            of the nav list instead, so exclude it here even if a saved
            config still has it pinned at the top. */}
        {activeConfig.pinned.filter(href => href !== '/settings').filter(href => isItemVisible(href)).map(href => renderNavItem(href))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 16px' }} />

        {/* Grouped sections. /settings always renders flat at the bottom,
            so we filter it out of any sections carried over from older
            saved configs to avoid rendering it twice. */}
        {activeConfig.sections.map((section) => {
          const visibleItems = section.items
            .filter(href => href !== '/settings')
            .filter(href => isItemVisible(href))
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label}>
              {renderGroupHeader(section)}
              {(openGroups[section.label] ?? false) && visibleItems.map(href => renderNavItem(href, true))}
            </div>
          )
        })}

        {/* Settings — always pinned at the bottom of the nav list, flat (no group). */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 16px' }} />
        {renderNavItem('/settings')}
      </div>

      {/* Edit button + Sign Out at bottom */}
      {isOpen && (
        <div style={{
          padding: '8px 16px 12px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <button
            onClick={enterEditMode}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '8px 0', borderRadius: 'var(--radius-md)',
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Pencil size={13} />
            Customize Navigation
          </button>
          <ContactSupport
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '8px 0', borderRadius: 'var(--radius-md)',
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Contact Support
          </ContactSupport>
          <button
            onClick={async () => {
              setSigningOut(true)
              const supabase = createClient()
              if (supabase) await supabase.auth.signOut()
              router.push('/login')
            }}
            disabled={signingOut}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '8px 0', borderRadius: 'var(--radius-md)',
              background: 'none', border: 'none',
              color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              cursor: signingOut ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: signingOut ? 0.5 : 1,
            }}
          >
            <LogOut size={13} />
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      )}
    </nav>
  )
}
