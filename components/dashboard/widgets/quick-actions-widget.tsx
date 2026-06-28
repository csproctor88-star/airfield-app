'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldAlert, AlertTriangle, HardHat, ListChecks, Zap, Radio,
  ClipboardList, Bird, Plus, Trash2, ExternalLink, LayoutGrid,
  Home, LayoutDashboard, Activity, ClipboardCheck, ClipboardPen,
  MapPin, Shield, Lightbulb, PlaneLanding, Plane, BookOpen,
  FileText, BarChart3, Settings, BookMarked, Users, Wrench,
  SlidersHorizontal, GraduationCap, MessageSquare, History, Award,
  Siren, TrendingUp, MessageSquareWarning, GitBranch, CloudSnow,
  type LucideIcon,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled, MODULES } from '@/lib/modules-config'
import { NAV_ITEM_MAP } from '@/lib/sidebar-config'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

// ── Icon resolver (same set as sidebar-nav ICON_MAP) ──────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Home, LayoutDashboard, Activity, Zap, ListChecks, ClipboardCheck, ClipboardList,
  ClipboardPen, Bird, HardHat, AlertTriangle, MapPin, Shield, Lightbulb,
  PlaneLanding, Plane, BookOpen, FileText, BarChart3, Settings, BookMarked,
  Users, Wrench, SlidersHorizontal, GraduationCap, Radio, MessageSquare, History,
  Award, ShieldAlert, Siren, TrendingUp, MessageSquareWarning, GitBranch, CloudSnow,
  LayoutGrid,
}

function resolveIcon(name: string | undefined): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name]
  return LayoutGrid
}

// ── Config types ───────────────────────────────────────────────────────────────
type CustomButton = { label: string; href: string; icon?: string }
type QuickActionsConfig = {
  title?: string
  tiles?: string[]        // selected module hrefs; undefined = show all defaults
  custom?: CustomButton[]
}

// ── Default tiles (existing behaviour) ────────────────────────────────────────
type TileDef = {
  label: string
  Icon: LucideIcon
  iconColor: string
  href: string
  accent?: boolean
}

const DEFAULT_TILES: TileDef[] = [
  { label: 'Airfield Checks', Icon: ShieldAlert,    iconColor: 'var(--color-accent)',           href: '/checks',            accent: true },
  { label: 'New Discrepancy', Icon: AlertTriangle,  iconColor: 'var(--color-danger)',            href: '/discrepancies/new', accent: true },
  { label: 'Personnel',       Icon: HardHat,        iconColor: 'var(--color-warning)',           href: '/contractors' },
  { label: 'Shift Checklist', Icon: ListChecks,     iconColor: 'var(--color-accent-secondary)', href: '/shift-checklist' },
  { label: 'QRCs',            Icon: Zap,            iconColor: 'var(--color-warning)',           href: '/qrc' },
  { label: 'SCN',             Icon: Radio,          iconColor: 'var(--color-accent)',            href: '/scn' },
  { label: 'PPR Log',         Icon: ClipboardList,  iconColor: 'var(--color-accent)',            href: '/ppr' },
  { label: 'BASH',            Icon: Bird,           iconColor: 'var(--color-orange)',            href: '/wildlife' },
]

// ── Widget ─────────────────────────────────────────────────────────────────────
export function QuickActionsWidget({ config }: Pick<WidgetProps, 'config'>) {
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const router = useRouter()
  const c = config as QuickActionsConfig

  // Module tiles: if config.tiles specified, use that allowlist; otherwise defaults
  const allowList = Array.isArray(c.tiles) ? new Set(c.tiles) : null

  const tiles = DEFAULT_TILES.filter((t) => {
    if (allowList && !allowList.has(t.href)) return false
    const checkHref = t.href === '/discrepancies/new' ? '/discrepancies' : t.href
    return isModuleEnabled(checkHref, enabledModules, airportType)
  })

  const customButtons: CustomButton[] = Array.isArray(c.custom) ? c.custom : []

  const tileStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px 6px', borderRadius: 'var(--radius-md)', minHeight: 60,
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border)',
    textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)',
    textAlign: 'center', lineHeight: 1.2, cursor: 'pointer',
  }
  const accentStyle: React.CSSProperties = {
    ...tileStyle,
    background: 'var(--color-bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
      gap: 6,
      height: '100%',
      alignContent: 'start',
    }}>
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          style={t.accent ? accentStyle : tileStyle}
        >
          <t.Icon size={20} color={t.iconColor} strokeWidth={2.25} />
          <span style={{ fontSize: 'var(--fs-2xs)' }}>{t.label}</span>
        </Link>
      ))}
      {customButtons.map((btn, i) => {
        const Icon = resolveIcon(btn.icon)
        const isExternal = /^https?:\/\//i.test(btn.href)
        if (isExternal) {
          return (
            <a
              key={`custom-${i}`}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              style={tileStyle}
            >
              <Icon size={20} color="var(--color-accent-secondary)" strokeWidth={2.25} />
              <span style={{ fontSize: 'var(--fs-2xs)' }}>{btn.label}</span>
            </a>
          )
        }
        return (
          <button
            key={`custom-${i}`}
            onClick={() => router.push(btn.href)}
            style={{ ...tileStyle, fontFamily: 'inherit' }}
          >
            <Icon size={20} color="var(--color-accent-secondary)" strokeWidth={2.25} />
            <span style={{ fontSize: 'var(--fs-2xs)' }}>{btn.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Config form ────────────────────────────────────────────────────────────────

/** Available icon names for custom buttons (a documented subset). */
const CUSTOM_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: '',              label: 'Default (grid)' },
  { value: 'Home',         label: 'Home' },
  { value: 'Activity',     label: 'Activity / Events' },
  { value: 'AlertTriangle',label: 'Alert / Discrepancy' },
  { value: 'BarChart3',    label: 'Analytics / Reports' },
  { value: 'Bird',         label: 'Bird / BASH' },
  { value: 'BookOpen',     label: 'Book / Reference' },
  { value: 'ClipboardCheck', label: 'Clipboard Check' },
  { value: 'ClipboardList', label: 'Clipboard List' },
  { value: 'CloudSnow',    label: 'Field Conditions' },
  { value: 'ExternalLink', label: 'External Link' },
  { value: 'FileText',     label: 'Document' },
  { value: 'GraduationCap', label: 'Training' },
  { value: 'HardHat',      label: 'Personnel' },
  { value: 'Lightbulb',    label: 'Infrastructure' },
  { value: 'ListChecks',   label: 'Checklist' },
  { value: 'MapPin',       label: 'Map / Location' },
  { value: 'MessageSquare', label: 'Feedback / Messages' },
  { value: 'PlaneLanding', label: 'Aircraft / Parking' },
  { value: 'Radio',        label: 'SCN / Radio' },
  { value: 'Settings',     label: 'Settings' },
  { value: 'Shield',       label: 'Waivers / Safety' },
  { value: 'ShieldAlert',  label: 'Safety / Checks' },
  { value: 'Users',        label: 'Users / Teams' },
  { value: 'Wrench',       label: 'CES / Maintenance' },
  { value: 'Zap',          label: 'QRC / Emergency' },
]

// Map from module primary href → icon color (matches DEFAULT_TILES where applicable)
const HREF_ICON_COLOR: Record<string, string> = {
  '/checks':         'var(--color-accent)',
  '/discrepancies':  'var(--color-danger)',
  '/discrepancies/new': 'var(--color-danger)',
  '/contractors':    'var(--color-warning)',
  '/shift-checklist': 'var(--color-accent-secondary)',
  '/qrc':            'var(--color-warning)',
  '/scn':            'var(--color-accent)',
  '/ppr':            'var(--color-accent)',
  '/wildlife':       'var(--color-orange)',
}

export function QuickActionsConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const c = config as QuickActionsConfig

  // Build list of available module hrefs from MODULES + isModuleEnabled
  type ModuleOption = { href: string; label: string; iconName: string; iconColor: string }
  const moduleOptions: ModuleOption[] = []
  for (const mod of MODULES) {
    // Use primary href only for the picker
    const primaryHref = mod.hrefs[0]
    if (!primaryHref) continue
    if (!isModuleEnabled(primaryHref, enabledModules, airportType)) continue
    const navItem = NAV_ITEM_MAP.get(primaryHref)
    moduleOptions.push({
      href: primaryHref,
      label: navItem?.name ?? mod.label,
      iconName: navItem?.iconName ?? '',
      iconColor: HREF_ICON_COLOR[primaryHref] ?? 'var(--color-text-2)',
    })
  }
  // Also include /discrepancies/new separately (it's in the defaults but not a module primary href)
  const hasDiscrepancies = moduleOptions.some(m => m.href === '/discrepancies')
  if (hasDiscrepancies) {
    const idx = moduleOptions.findIndex(m => m.href === '/discrepancies')
    moduleOptions.splice(idx + 1, 0, {
      href: '/discrepancies/new',
      label: 'New Discrepancy',
      iconName: 'AlertTriangle',
      iconColor: 'var(--color-danger)',
    })
  }

  // Determine initial selected tiles. If config.tiles is undefined, derive from DEFAULT_TILES
  const defaultSelectedHrefs = new Set(DEFAULT_TILES.map(t => t.href))
  const initialSelected: Set<string> = Array.isArray(c.tiles)
    ? new Set(c.tiles)
    : new Set(moduleOptions.filter(m => defaultSelectedHrefs.has(m.href)).map(m => m.href))

  const [title, setTitle] = useState(c.title ?? '')
  const [selected, setSelected] = useState<Set<string>>(initialSelected)
  const [custom, setCustom] = useState<CustomButton[]>(
    Array.isArray(c.custom) ? c.custom : []
  )

  function toggleModule(href: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function setCustomRow(i: number, patch: Partial<CustomButton>) {
    setCustom(rows => rows.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  function addCustom() {
    setCustom(rows => [...rows, { label: '', href: '', icon: '' }])
  }

  function removeCustom(i: number) {
    setCustom(rows => rows.filter((_, j) => j !== i))
  }

  function handleSave() {
    onSave({
      ...(title.trim() ? { title: title.trim() } : {}),
      tiles: Array.from(selected),
      custom: custom
        .filter(b => b.label.trim() && b.href.trim())
        .map(b => ({
          label: b.label.trim(),
          href: b.href.trim(),
          ...(b.icon ? { icon: b.icon } : {}),
        })),
    })
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Title */}
      <div>
        <div style={sectionLabel}>Widget Title</div>
        <input style={input} placeholder="Quick Actions" value={title} onChange={e => setTitle(e.target.value)} />
      </div>

      {/* Module picker */}
      <div>
        <div style={sectionLabel}>Module Tiles</div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          maxHeight: 200, overflowY: 'auto',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: '4px 2px',
        }}>
          {moduleOptions.map(opt => {
            const Icon = resolveIcon(opt.iconName)
            const checked = selected.has(opt.href)
            return (
              <label
                key={opt.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                  cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                  background: checked ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(opt.href)}
                  style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }}
                />
                <Icon size={14} color={opt.iconColor} strokeWidth={2.25} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>{opt.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{opt.href}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Custom buttons */}
      <div>
        <div style={sectionLabel}>Custom Buttons</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {custom.map((btn, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '8px 10px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  style={{ ...input, flex: '0 0 38%' }}
                  placeholder="Label"
                  value={btn.label}
                  onChange={e => setCustomRow(i, { label: e.target.value })}
                />
                <input
                  style={{ ...input, flex: 1 }}
                  placeholder="/route or https://…"
                  value={btn.href}
                  onChange={e => setCustomRow(i, { href: e.target.value })}
                />
                <button
                  onClick={() => removeCustom(i)}
                  aria-label="Remove custom button"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', flexShrink: 0 }}>Icon:</span>
                <select
                  value={btn.icon ?? ''}
                  onChange={e => setCustomRow(i, { icon: e.target.value || undefined })}
                  style={{ ...input, flex: 1, height: 34, padding: '4px 8px' }}
                >
                  {CUSTOM_ICON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {btn.icon && (() => {
                  const Icon = resolveIcon(btn.icon)
                  return <Icon size={16} color="var(--color-accent-secondary)" style={{ flexShrink: 0 }} />
                })()}
              </div>
            </div>
          ))}
          <button
            onClick={addCustom}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              padding: '6px 10px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
            }}
          >
            <Plus size={14} /> Add custom button
          </button>
        </div>
      </div>

      {/* Save / Cancel */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit',
          }}
        >Save</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}
