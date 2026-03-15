'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import { useSidebar } from '@/lib/sidebar-context'
import { useTheme } from '@/lib/theme-context'
import type { UserRole } from '@/lib/supabase/types'
import { useExpiringNotamCount } from '@/lib/use-expiring-notams'
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
  FolderOpen,
  GripVertical,
  Pencil,
  RotateCcw,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from 'lucide-react'

// Icon lookup by name string
const ICON_MAP: Record<string, LucideIcon> = {
  Home, LayoutDashboard, Activity, Zap, ListChecks, ClipboardCheck, ClipboardList,
  Bird, HardHat, AlertTriangle, MapPin, Database, Shield, Lightbulb,
  PlaneLanding, Plane, BookOpen, FileText, BarChart3, Settings, BookMarked, Users,
  Wrench, FolderOpen,
}

// Group icons
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Operations': Wrench,
  'Airfield Management': FolderOpen,
  'Reference': BookOpen,
  'Settings': Settings,
}

// Admin-only items
const ADMIN_ITEMS = new Set(['/library', '/users'])

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Home
}

export function SidebarNav() {
  const pathname = usePathname()
  const { isOpen, toggle } = useSidebar()
  const { resolvedTheme } = useTheme()
  const expiringNotamCount = useExpiringNotamCount()
  const [canManageUsers, setCanManageUsers] = useState(false)
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
        setCanManageUsers(true)
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

        const role = (profile?.role ?? 'read_only') as UserRole
        const config = USER_ROLES[role]
        setCanManageUsers(config?.canManageUsers ?? false)
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
    return pathname.startsWith(href)
  }

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isItemVisible(href: string) {
    if (ADMIN_ITEMS.has(href)) return loaded && canManageUsers
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
          fontSize: indented && isOpen ? 'var(--fs-base)' : 'var(--fs-lg)',
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
              borderRadius: '50%', background: '#EF4444', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {expiringNotamCount > 9 ? '9+' : expiringNotamCount}
            </span>
          )}
        </span>
        {isOpen && <span style={{ flex: 1 }}>{def.name}</span>}
        {isOpen && href === '/notams' && expiringNotamCount > 0 && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#EF4444', marginLeft: 'auto' }}>
            {expiringNotamCount} expiring
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
          borderRadius: 6,
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
        <GroupIcon size={16} style={{ flexShrink: 0 }} />
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
    const visibleItems = section.items.filter(href => isItemVisible(href))

    return (
      <div
        key={section.label}
        onDragOver={(e) => handleDragOver(e, dropId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropOnSection(e, sectionIdx)}
        style={{
          marginBottom: 8,
          borderRadius: 8,
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

  // ── Edit mode UI ──
  if (editMode && isOpen) {
    const pinnedVisible = editConfig.pinned.filter(href => isItemVisible(href))
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
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
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
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
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
                background: 'var(--color-accent)', border: 'none', borderRadius: 6,
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
              borderRadius: 8,
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

  const activeConfig = config

  return (
    <nav className={`sidebar-drawer${isOpen ? '' : ' sidebar-collapsed'}`}>
      {/* Header with logo + tagline + collapse toggle */}
      <div style={{
        padding: isOpen ? '20px 16px 12px' : '20px 0 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}>
        {isOpen && (
          <img
            src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
            alt="Glidepath"
            style={{ height: 40, objectFit: 'contain', marginBottom: 2 }}
          />
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          width: '100%',
          gap: 8,
        }}>
          {isOpen && (
            <div style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'var(--color-text-2)',
              letterSpacing: '0.04em',
              lineHeight: 1.4,
              flex: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              paddingLeft: 4,
            }}>
              Guiding You to Mission Success
            </div>
          )}
          <button
            onClick={toggle}
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-3)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {/* Pinned items */}
        {activeConfig.pinned.filter(href => isItemVisible(href)).map(href => renderNavItem(href))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 16px' }} />

        {/* Grouped sections */}
        {activeConfig.sections.map((section) => {
          const visibleItems = section.items.filter(href => isItemVisible(href))
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label}>
              {renderGroupHeader(section)}
              {(openGroups[section.label] ?? false) && visibleItems.map(href => renderNavItem(href, true))}
            </div>
          )
        })}
      </div>

      {/* Edit button at bottom */}
      {isOpen && (
        <div style={{
          padding: '8px 16px 12px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <button
            onClick={enterEditMode}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '8px 0', borderRadius: 8,
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Pencil size={13} />
            Customize Navigation
          </button>
        </div>
      )}
    </nav>
  )
}
