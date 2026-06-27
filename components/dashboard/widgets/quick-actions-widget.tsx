'use client'

import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled } from '@/lib/modules-config'
import type { WidgetProps } from '@/lib/dashboard/widget-registry'
import {
  ShieldAlert, AlertTriangle, HardHat, ListChecks, Zap, Radio,
  ClipboardList, Bird,
} from 'lucide-react'

type TileDef = {
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
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

export function QuickActionsWidget({ config }: Pick<WidgetProps, 'config'>) {
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null

  // Allow config to restrict which tiles are shown
  const allowList = Array.isArray((config as { tiles?: string[] })?.tiles)
    ? new Set((config as { tiles: string[] }).tiles)
    : null

  const tiles = DEFAULT_TILES.filter((t) => {
    if (allowList && !allowList.has(t.href)) return false
    // For discrepancies/new, check the parent /discrepancies route
    const checkHref = t.href === '/discrepancies/new' ? '/discrepancies' : t.href
    return isModuleEnabled(checkHref, enabledModules, airportType)
  })

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
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 6px', borderRadius: 'var(--radius-md)', minHeight: 60,
            background: t.accent ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
            border: t.accent
              ? '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)'
              : '1px solid var(--color-border)',
            textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)',
            textAlign: 'center', lineHeight: 1.2,
          }}
        >
          <t.Icon size={20} color={t.iconColor} strokeWidth={2.25} />
          <span style={{ fontSize: 'var(--fs-2xs)' }}>{t.label}</span>
        </Link>
      ))}
    </div>
  )
}
