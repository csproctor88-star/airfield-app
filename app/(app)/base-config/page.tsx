'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  SlidersHorizontal,
  PlaneLanding,
  ClipboardList,
  Map as MapIcon,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  modulesForAirport,
  moduleAppliesToAirport,
  isWizardStepEnabled,
  isStepDone,
  type ModuleKey,
  type WizardStepKey,
} from '@/lib/modules-config'
import { fetchInspectionTemplate } from '@/lib/supabase/inspection-templates'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'

// Wizard steps mirror lib/modules-config.ts order — kept short here so the
// hub doesn't need to import the wizard's full step config (it lives at
// app/(app)/base-config/setup/page.tsx).
const WIZARD_STEP_KEYS: WizardStepKey[] = [
  'runways', 'areas', 'taxiways', 'navaids', 'shops', 'arff', 'facilities',
  'templates', 'shiftchecklist', 'qrc', 'scnagencies', 'wildlife',
  'lighting', 'statusboards', 'pprcolumns', 'feedback',
]

type Status = 'configured' | 'needs-setup' | 'empty'

type CardSpec = {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  status: Status
  detail: string
}

function StatusPill({ status }: { status: Status }) {
  if (status === 'configured') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 'var(--fs-2xs)', fontWeight: 700,
        padding: '2px 8px', borderRadius: 999,
        color: 'var(--color-success)',
        background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-success) 28%, transparent)',
      }}>
        <Check size={11} strokeWidth={3} /> Configured
      </span>
    )
  }
  if (status === 'needs-setup') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 'var(--fs-2xs)', fontWeight: 700,
        padding: '2px 8px', borderRadius: 999,
        color: 'var(--color-amber)',
        background: 'color-mix(in srgb, var(--color-amber) 14%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-amber) 32%, transparent)',
      }}>
        <AlertTriangle size={11} strokeWidth={2.5} /> Needs Setup
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 'var(--fs-2xs)', fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      color: 'var(--color-text-3)',
      background: 'var(--color-bg-inset)',
      border: '1px solid var(--color-border)',
    }}>
      Not Configured
    </span>
  )
}

function ConfigCard({ spec }: { spec: CardSpec }) {
  const Icon = spec.icon
  const railColor =
    spec.status === 'configured' ? 'var(--color-success)'
    : spec.status === 'needs-setup' ? 'var(--color-amber)'
    : 'var(--color-cyan)'

  return (
    <Link
      href={spec.href}
      style={{
        display: 'block',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${railColor}`,
        borderRadius: 12,
        padding: 16,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-surface)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          flexShrink: 0,
          width: 40, height: 40, borderRadius: 10,
          background: 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 28%, transparent)',
          color: 'var(--color-cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {spec.title}
            </span>
            <StatusPill status={spec.status} />
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', lineHeight: 1.4 }}>
            {spec.description}
          </p>
          <div style={{
            marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {spec.detail}
          </div>
        </div>
        <ChevronRight size={18} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--color-text-4)', marginTop: 10 }} />
      </div>
    </Link>
  )
}

export default function BaseConfigHubPage() {
  const { installationId, currentInstallation, enabledModules, setupProgress } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const canManage = has(PERM.BASE_SETUP_WRITE)

  const [airfieldItemCount, setAirfieldItemCount] = useState<number | null>(null)
  const [lightingItemCount, setLightingItemCount] = useState<number | null>(null)
  const [diagramPresent, setDiagramPresent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    Promise.all([
      fetchInspectionTemplate(installationId, 'airfield'),
      fetchInspectionTemplate(installationId, 'lighting'),
      getAirfieldDiagram(installationId),
    ]).then(([airfield, lighting, diagram]) => {
      if (cancelled) return
      setAirfieldItemCount(airfield.reduce((n, s) => n + s.items.length, 0))
      setLightingItemCount(lighting.reduce((n, s) => n + s.items.length, 0))
      setDiagramPresent(!!diagram)
    })
    return () => { cancelled = true }
  }, [installationId])

  // Scope module / wizard-step counts to the base's airport type so USAF
  // bases don't count Part 139-only modules (and vice-versa) in the totals.
  const airportType = currentInstallation?.airport_type ?? null

  const wizardSummary = useMemo(() => {
    const visible = WIZARD_STEP_KEYS.filter(k => isWizardStepEnabled(k, enabledModules, airportType))
    const done = visible.filter(k => isStepDone(k, setupProgress)).length
    const total = visible.length
    return {
      total, done,
      complete: total > 0 && done === total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  }, [enabledModules, setupProgress, airportType])

  const totalToggleable = modulesForAirport(airportType).length
  const enabledModuleCount = (enabledModules ?? []).filter(
    k => moduleAppliesToAirport(k as ModuleKey, airportType),
  ).length

  const cards: CardSpec[] = [
    {
      href: '/base-config/modules',
      title: 'Modules',
      description: 'Pick which Glidepath features this base uses. Hidden modules keep their data.',
      icon: SlidersHorizontal,
      status: enabledModuleCount > 0 ? 'configured' : 'needs-setup',
      detail: `${enabledModuleCount} of ${totalToggleable} enabled`,
    },
    {
      href: '/base-config/setup',
      title: 'Base Setup Wizard',
      description: 'Configure runways, areas, taxiways, NAVAIDs, CE shops, ARFF, facilities, and more.',
      icon: PlaneLanding,
      status: wizardSummary.complete ? 'configured' : (wizardSummary.done > 0 ? 'needs-setup' : 'empty'),
      detail: wizardSummary.total === 0
        ? 'No steps required'
        : `${wizardSummary.done} of ${wizardSummary.total} steps · ${wizardSummary.percent}% complete`,
    },
    {
      href: '/base-config/templates',
      title: 'Inspection Templates',
      description: 'Customize checklist sections and items for airfield and lighting inspections.',
      icon: ClipboardList,
      status: airfieldItemCount === null
        ? 'empty'
        : (airfieldItemCount > 0 || (lightingItemCount ?? 0) > 0)
          ? 'configured'
          : 'needs-setup',
      detail: airfieldItemCount === null
        ? 'Loading…'
        : `Airfield: ${airfieldItemCount} item${airfieldItemCount === 1 ? '' : 's'} · Lighting: ${lightingItemCount ?? 0}`,
    },
    {
      href: '/base-config/diagram',
      title: 'Airfield Diagram',
      description: 'Upload an airfield diagram image for quick reference across the app.',
      icon: MapIcon,
      status: diagramPresent === null ? 'empty' : (diagramPresent ? 'configured' : 'needs-setup'),
      detail: diagramPresent === null
        ? 'Loading…'
        : (diagramPresent ? 'Uploaded' : 'No diagram uploaded'),
    },
  ]

  if (permsLoaded && !canManage) {
    return (
      <div className="page-container">
        <div style={{ padding: 24, color: 'var(--color-text-3)' }}>
          You don&rsquo;t have permission to manage base configuration.
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" data-tour="base-config-header">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', margin: 0, letterSpacing: '-0.02em' }}>
          Base Configuration
        </h1>
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginTop: 4 }}>
          {currentInstallation?.name}
          {currentInstallation?.icao ? ` · ${currentInstallation.icao}` : ''}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {cards.map(spec => (
          <ConfigCard key={spec.href} spec={spec} />
        ))}
      </div>
    </div>
  )
}
