'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/utils'
import { createDefaultTemplate, fetchInspectionTemplate } from '@/lib/supabase/inspection-templates'
import { fetchInstallationNavaids } from '@/lib/supabase/installations'
import {
  fetchChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  type ShiftChecklistItem,
  type ShiftType,
  type FrequencyType,
} from '@/lib/supabase/shift-checklist'
import { fetchNavaidStatuses, type NavaidStatus } from '@/lib/supabase/navaids'
import {
  fetchCustomStatusBoards,
  createCustomStatusBoard,
  updateCustomStatusBoard,
  deleteCustomStatusBoard,
  fetchCustomStatusItems,
  createCustomStatusItem,
  updateCustomStatusItem,
  deleteCustomStatusItem,
  type CustomStatusBoard,
  type CustomStatusItem,
} from '@/lib/supabase/custom-status'
import {
  fetchPprColumns,
  createPprColumn,
  updatePprColumn,
  deletePprColumn,
  PPR_COLUMN_TYPES,
  type PprColumn,
  type PprColumnType,
} from '@/lib/supabase/ppr'
import TaxiwayEditor from '@/components/taxiway-editor-google'
import {
  fetchLightingSystems,
  fetchLightingSystemWithComponents,
  createLightingSystem,
  updateLightingSystem,
  deleteLightingSystem,
  createSystemComponent,
  deleteSystemComponent,
  fetchOutageRuleTemplates,
  cloneComponentsFromTemplates,
} from '@/lib/supabase/lighting-systems'
import { SYSTEM_TYPE_LABELS, SYSTEM_TYPES } from '@/lib/outage-rules'
import type { LightingSystem, LightingSystemComponent, OutageRuleTemplate, InfrastructureFeature } from '@/lib/supabase/types'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'
import { fetchBaseSpecies, addBaseSpecies, addBaseSpeciesBulk, removeBaseSpeciesByName, toggleFavoriteSpecies, type BaseWildlifeSpeciesRow } from '@/lib/supabase/base-wildlife-species'

type SetupTab = 'runways' | 'taxiways' | 'navaids' | 'areas' | 'arff' | 'shops' | 'facilities' | 'templates' | 'shiftchecklist' | 'qrc' | 'lighting' | 'wildlife' | 'statusboards' | 'pprcolumns'

type WizardStep = {
  key: SetupTab
  number: number
  label: string
  description: string
  required: boolean
}

const WIZARD_STEPS: WizardStep[] = [
  { key: 'runways', number: 1, label: 'Runways', description: 'Define your runways with coordinates, dimensions, and approach lighting. Use Import from ICAO for automatic data population.', required: true },
  { key: 'areas', number: 2, label: 'Airfield Areas', description: 'Add the areas that inspectors reference when logging discrepancies and conducting inspections (e.g., RWY 01/19, TWY A, East Ramp).', required: true },
  { key: 'taxiways', number: 3, label: 'Taxiways', description: 'Define taxiway designators for clearance envelopes, parking analysis, and discrepancy location tracking.', required: true },
  { key: 'navaids', number: 4, label: 'NAVAIDs', description: 'Add the NAVAIDs displayed on the Airfield Status page (e.g., ILS, TACAN, PAPI, MALSR). These appear as green/yellow/red toggles.', required: true },
  { key: 'shops', number: 5, label: 'CE Shops & Type Mapping', description: 'Define your CE shops and map each discrepancy type to a shop. This controls automatic shop assignment when discrepancies are created.', required: true },
  { key: 'arff', number: 6, label: 'ARFF Vehicles', description: 'Add your crash/rescue vehicles. These appear on the Airfield Status page ARFF readiness panel.', required: true },
  { key: 'facilities', number: 7, label: 'Facilities', description: 'Add facility numbers and descriptions referenced by discrepancies and inspections (e.g., Tower, Fire Station, Bldg 200).', required: true },
  { key: 'templates', number: 8, label: 'Inspection Templates', description: 'Configure the checklist sections and items for daily airfield and lighting inspections. These define what inspectors evaluate during each inspection.', required: true },
  { key: 'shiftchecklist', number: 9, label: 'Shift Checklist', description: 'Define the tasks tracked per shift (Day/Swing/Mid) with daily, weekly, or monthly frequency. These appear on the Shift Checklist page and Dashboard.', required: true },
  { key: 'qrc', number: 10, label: 'QRC Templates', description: 'Configure Quick Reaction Checklists for emergency response. Seed from the default library or customize for your installation.', required: true },
  { key: 'wildlife', number: 11, label: 'Wildlife Species', description: 'Select the wildlife species commonly observed at your installation. These populate the species picker in sighting and strike forms.', required: true },
  { key: 'lighting', number: 12, label: 'Lighting Systems', description: 'Define lighting systems and components with DAFMAN 13-204v2 outage thresholds. This is a detailed configuration — skip for now and complete later if needed.', required: false },
  { key: 'statusboards', number: 13, label: 'Status Boards', description: 'Create custom status panels for the Airfield Status page (e.g., Arresting Systems, Comm Status). Each board has items with green/yellow/red toggles.', required: false },
  { key: 'pprcolumns', number: 14, label: 'PPR Columns', description: 'Define the columns for your Prior Permission Required (PPR) table. Each base can have its own fields (e.g., Aircraft Type, Tail #, Unit, POC, Purpose).', required: false },
]

export default function BaseSetupPage() {
  const { installationId, currentInstallation, runways, areas, ceShops, typeShopMap, arffAircraft, userRole } = useInstallation()
  const [currentStep, setCurrentStep] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const canEdit = userRole === 'airfield_manager' || userRole === 'sys_admin' || userRole === 'base_admin' || userRole === 'namo'

  if (!canEdit) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
          &larr; Settings
        </Link>
        <h1 style={{ marginTop: 16, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Base Configuration</h1>
        <p style={{ color: 'var(--color-text-3)', marginTop: 8 }}>
          Only Airfield Managers and System Admins can configure base settings.
        </p>
      </div>
    )
  }

  const step = WIZARD_STEPS[currentStep]
  const isLastStep = currentStep === WIZARD_STEPS.length - 1
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100

  const goNext = () => {
    if (!isLastStep) {
      setCurrentStep(s => s + 1)
      window.scrollTo(0, 0)
    }
  }
  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1)
      window.scrollTo(0, 0)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
        &larr; Settings
      </Link>

      {/* Header */}
      <div style={{ marginTop: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 2 }}>
          Base Setup
        </h1>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          {currentInstallation?.name ?? 'Current Base'} ({currentInstallation?.icao ?? '—'})
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)' }}>
            Step {step.number} of {WIZARD_STEPS.length}
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            {Math.round(progress)}% complete
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, background: 'var(--color-bg-inset)',
          border: '1px solid var(--color-border)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, var(--color-cyan), var(--color-accent))',
            width: `${progress}%`, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Step navigation pills */}
      <div style={{
        display: 'flex', gap: 3, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => { setCurrentStep(i); window.scrollTo(0, 0) }}
            title={s.label}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fs-2xs)', fontWeight: 700,
              border: i === currentStep ? '2px solid var(--color-cyan)' : '1px solid var(--color-border)',
              background: i === currentStep ? 'rgba(34,211,238,0.15)' : i < currentStep ? 'rgba(34,197,94,0.12)' : 'var(--color-bg-inset)',
              color: i === currentStep ? 'var(--color-cyan)' : i < currentStep ? 'var(--color-success)' : 'var(--color-text-3)',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {i < currentStep ? '✓' : s.number}
          </button>
        ))}
      </div>

      {/* Step header */}
      <div style={{
        padding: '14px 18px', borderRadius: 10, marginBottom: 12,
        background: 'linear-gradient(135deg, rgba(34,211,238,0.06), rgba(56,189,248,0.03))',
        border: '1px solid rgba(34,211,238,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--color-cyan)', color: '#0F172A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-md)', fontWeight: 800,
          }}>
            {step.number}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {step.label}
              {!step.required && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 400, marginLeft: 8 }}>
                  (Optional)
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5, marginTop: 2 }}>
              {step.description}
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        marginBottom: 12,
      }}>
        {step.key === 'runways' && <RunwayTab runways={runways} installationId={installationId} />}
        {step.key === 'taxiways' && <TaxiwayEditor />}
        {step.key === 'navaids' && <NavaidTab installationId={installationId} />}
        {step.key === 'areas' && <SimpleListTab title="Airfield Areas" items={areas} tableName="base_areas" fieldName="area_name" installationId={installationId} />}
        {step.key === 'arff' && <SimpleListTab title="ARFF Aircraft" items={arffAircraft} tableName="base_arff_aircraft" fieldName="aircraft_name" installationId={installationId} />}
        {step.key === 'shops' && <ShopsTab shops={ceShops} typeShopMap={typeShopMap} installationId={installationId} />}
        {step.key === 'facilities' && <FacilitiesTab installationId={installationId} />}
        {step.key === 'templates' && <TemplatesTab installationId={installationId} />}
        {step.key === 'shiftchecklist' && <ShiftChecklistTab installationId={installationId} currentInstallation={currentInstallation} />}
        {step.key === 'qrc' && <QrcTemplatesTab installationId={installationId} />}
        {step.key === 'lighting' && <LightingSystemsTab installationId={installationId} />}
        {step.key === 'wildlife' && <WildlifeSpeciesTab installationId={installationId} />}
        {step.key === 'statusboards' && <StatusBoardsTab installationId={installationId} />}
        {step.key === 'pprcolumns' && <PprColumnsTab installationId={installationId} />}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {currentStep > 0 && (
          <button
            onClick={goBack}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-base)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
              color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Back
          </button>
        )}
        {!step.required && (
          <button
            onClick={goNext}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-base)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Skip for Now
          </button>
        )}
        {isLastStep ? (
          <Link
            href="/settings"
            style={{
              flex: 2, padding: '12px 16px', borderRadius: 'var(--radius-base)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--color-success), #16A34A)',
              color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            Complete Setup ✓
          </Link>
        ) : (
          <button
            onClick={goNext}
            style={{
              flex: 2, padding: '12px 16px', borderRadius: 'var(--radius-base)',
              border: 'none',
              background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
              color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Next: {WIZARD_STEPS[currentStep + 1]?.label} →
          </button>
        )}
      </div>

      {/* Preview Dashboard Button */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          border: showPreview ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
          cursor: 'pointer',
          fontSize: 'var(--fs-lg)',
          fontWeight: 700,
          fontFamily: 'inherit',
          background: showPreview ? 'rgba(56,189,248,0.08)' : 'var(--color-surface-1)',
          color: showPreview ? 'var(--color-accent)' : 'var(--color-text-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {showPreview ? 'Hide Preview' : 'Preview Dashboard'}
      </button>

      {/* Dashboard Preview */}
      {showPreview && <DashboardPreview installationId={installationId} currentInstallation={currentInstallation} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Runway Tab — editable
// ═══════════════════════════════════════════════════════════════

function RunwayTab({
  runways: initialRunways,
  installationId,
}: {
  runways: ReturnType<typeof useInstallation>['runways']
  installationId: string | null
}) {
  const [runways, setRunways] = useState(initialRunways)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // ICAO lookup state
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookupIcao, setLookupIcao] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<any>(null)
  const [lookupError, setLookupError] = useState('')

  const handleIcaoLookup = async () => {
    if (!lookupIcao.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const res = await fetch(`/api/airport-lookup?icao=${encodeURIComponent(lookupIcao.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error || 'Lookup failed')
      } else {
        setLookupResult(data)
      }
    } catch {
      setLookupError('Network error — could not reach lookup service')
    }
    setLookupLoading(false)
  }

  const handleImportRunway = async (rwy: any) => {
    if (!installationId) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) { setSaving(false); return }

    const insert = {
      base_id: installationId,
      runway_id: rwy.runway_id,
      length_ft: rwy.length_ft || 0,
      width_ft: rwy.width_ft || 0,
      surface: rwy.surface || 'Unknown',
      true_heading: rwy.end1_heading || null,
      runway_class: 'B',
      end1_designator: rwy.end1_designator || rwy.runway_id.split('/')[0] || '',
      end1_latitude: rwy.end1_latitude || null,
      end1_longitude: rwy.end1_longitude || null,
      end1_heading: rwy.end1_heading || null,
      end1_approach_lighting: rwy.end1_approach_lighting || null,
      end1_elevation_msl: rwy.end1_elevation_msl || null,
      end2_designator: rwy.end2_designator || rwy.runway_id.split('/')[1] || '',
      end2_latitude: rwy.end2_latitude || null,
      end2_longitude: rwy.end2_longitude || null,
      end2_heading: rwy.end2_heading || null,
      end2_approach_lighting: rwy.end2_approach_lighting || null,
      end2_elevation_msl: rwy.end2_elevation_msl || null,
    }

    const { data, error } = await supabase
      .from('base_runways')
      .insert(insert)
      .select('*')
      .single()

    if (error) {
      toast.error(`Failed to import runway: ${friendlyError(error.message)}`)
    } else {
      toast.success(`Runway ${rwy.runway_id} imported`)
      setRunways(prev => [...prev, data as typeof prev[number]])
    }
    setSaving(false)
  }

  const handleImportAll = async () => {
    if (!installationId || !lookupResult) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) { setSaving(false); return }
    let imported = 0

    // Import runways
    for (const rwy of lookupResult.runways) {
      if (runways.some((r: any) => r.runway_id === rwy.runway_id)) continue
      const { data, error } = await supabase
        .from('base_runways')
        .insert({
          base_id: installationId, runway_id: rwy.runway_id,
          length_ft: rwy.length_ft || 0, width_ft: rwy.width_ft || 0,
          surface: rwy.surface || 'Unknown', true_heading: rwy.end1_heading || null,
          runway_class: 'B',
          end1_designator: rwy.end1_designator || '', end1_latitude: rwy.end1_latitude,
          end1_longitude: rwy.end1_longitude, end1_heading: rwy.end1_heading,
          end1_approach_lighting: rwy.end1_approach_lighting, end1_elevation_msl: rwy.end1_elevation_msl,
          end2_designator: rwy.end2_designator || '', end2_latitude: rwy.end2_latitude,
          end2_longitude: rwy.end2_longitude, end2_heading: rwy.end2_heading,
          end2_approach_lighting: rwy.end2_approach_lighting, end2_elevation_msl: rwy.end2_elevation_msl,
        } as any)
        .select('*')
        .single()
      if (!error && data) {
        setRunways((prev: any) => [...prev, data])
        imported++
      }
    }

    // Import suggested areas
    if (lookupResult.suggested_areas?.length > 0) {
      for (const area of lookupResult.suggested_areas) {
        const { error: aErr } = await supabase.from('base_areas').insert({ base_id: installationId, area_name: area } as any)
        if (!aErr) imported++
      }
    }

    // Import NAVAIDs
    if (lookupResult.navaids?.length > 0) {
      for (let i = 0; i < lookupResult.navaids.length; i++) {
        const nav = lookupResult.navaids[i]
        const name = nav.type === 'ILS' ? `${nav.type} ${nav.id}` :
                     nav.type === 'TACAN' ? `TACAN ${nav.id}` :
                     `${nav.type} ${nav.name || nav.id}`
        const { error: nErr } = await supabase.from('base_navaids').insert({ base_id: installationId, navaid_name: name, sort_order: i + 1 } as any)
        if (!nErr) imported++
      }
      // Also add approach lighting NAVAIDs from runways
      let navOrder = lookupResult.navaids.length + 1
      for (const rwy of lookupResult.runways) {
        if (rwy.end1_approach_lighting) {
          await supabase.from('base_navaids').insert({ base_id: installationId, navaid_name: `${rwy.end1_approach_lighting} RWY ${rwy.end1_designator}`, sort_order: navOrder++ } as any)
        }
        if (rwy.end2_approach_lighting) {
          await supabase.from('base_navaids').insert({ base_id: installationId, navaid_name: `${rwy.end2_approach_lighting} RWY ${rwy.end2_designator}`, sort_order: navOrder++ } as any)
        }
      }
      // Add NAVAID statuses (default green)
      const { data: allNavaids } = await supabase.from('base_navaids').select('navaid_name').eq('base_id', installationId)
      if (allNavaids) {
        for (const n of allNavaids) {
          await supabase.from('navaid_statuses').insert({ base_id: installationId, navaid_name: (n as any).navaid_name, status: 'green' } as any)
        }
      }
    }

    // Ensure airfield_status row exists
    await supabase.from('airfield_status').insert({ base_id: installationId, runway_status: 'open' } as any)

    toast.success(`Imported ${imported} items from ${lookupResult.icao}`)
    setSaving(false)
    setLookupOpen(false)
  }

  // Map adjustment state
  const [adjustingRunway, setAdjustingRunway] = useState<any>(null)
  const adjustMapContainer = useRef<HTMLDivElement>(null)
  const adjustMap = useRef<any>(null)
  const adjustMarkers = useRef<{ end1: any; end2: any }>({ end1: null, end2: null })
  const [adjustCoords, setAdjustCoords] = useState<{ end1_lat: number; end1_lon: number; end2_lat: number; end2_lon: number } | null>(null)

  const openAdjustMap = (rwy: any) => {
    setAdjustingRunway(rwy)
    setAdjustCoords({
      end1_lat: rwy.end1_latitude ?? 0,
      end1_lon: rwy.end1_longitude ?? 0,
      end2_lat: rwy.end2_latitude ?? 0,
      end2_lon: rwy.end2_longitude ?? 0,
    })
  }

  const handleSaveAdjustedCoords = async () => {
    if (!adjustingRunway || !adjustCoords) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) { setSaving(false); return }

    const { error } = await supabase
      .from('base_runways')
      .update({
        end1_latitude: adjustCoords.end1_lat,
        end1_longitude: adjustCoords.end1_lon,
        end2_latitude: adjustCoords.end2_lat,
        end2_longitude: adjustCoords.end2_lon,
      } as any)
      .eq('id', adjustingRunway.id)

    if (error) {
      toast.error(`Failed to update: ${friendlyError(error.message)}`)
    } else {
      toast.success(`Runway ${adjustingRunway.runway_id} coordinates updated`)
      setRunways((prev: any) => prev.map((r: any) =>
        r.id === adjustingRunway.id
          ? { ...r, end1_latitude: adjustCoords.end1_lat, end1_longitude: adjustCoords.end1_lon, end2_latitude: adjustCoords.end2_lat, end2_longitude: adjustCoords.end2_lon }
          : r
      ))
      setAdjustingRunway(null)
    }
    setSaving(false)
  }

  // Initialize adjustment map (Google Maps) when modal opens
  useEffect(() => {
    if (!adjustingRunway || !adjustCoords || !adjustMapContainer.current) return
    if (!isGoogleMapsConfigured()) return

    // Cleanup previous
    if (adjustMarkers.current.end1) { (adjustMarkers.current.end1 as google.maps.Marker).setMap(null); adjustMarkers.current.end1 = null }
    if (adjustMarkers.current.end2) { (adjustMarkers.current.end2 as google.maps.Marker).setMap(null); adjustMarkers.current.end2 = null }

    let gmap: google.maps.Map | null = null
    let line: google.maps.Polyline | null = null

    initGoogleMaps().then(() => {
      if (!adjustMapContainer.current) return

      const midLat = (adjustCoords.end1_lat + adjustCoords.end2_lat) / 2
      const midLon = (adjustCoords.end1_lon + adjustCoords.end2_lon) / 2

      gmap = new google.maps.Map(adjustMapContainer.current, {
        ...GOOGLE_MAP_OPTIONS,
        center: { lat: midLat, lng: midLon },
        zoom: 15,
        zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
      })

      // Runway centerline
      line = new google.maps.Polyline({
        path: [
          { lat: adjustCoords.end1_lat, lng: adjustCoords.end1_lon },
          { lat: adjustCoords.end2_lat, lng: adjustCoords.end2_lon },
        ],
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        strokeOpacity: 0.8,
        map: gmap,
      })

      // End 1 marker (cyan) — draggable
      const m1 = new google.maps.Marker({
        position: { lat: adjustCoords.end1_lat, lng: adjustCoords.end1_lon },
        map: gmap,
        draggable: true,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#22D3EE', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
      })
      m1.addListener('dragend', () => {
        const pos = m1.getPosition()
        if (pos) setAdjustCoords(prev => prev ? { ...prev, end1_lat: pos.lat(), end1_lon: pos.lng() } : prev)
      })
      adjustMarkers.current.end1 = m1

      // End 2 marker (orange) — draggable
      const m2 = new google.maps.Marker({
        position: { lat: adjustCoords.end2_lat, lng: adjustCoords.end2_lon },
        map: gmap,
        draggable: true,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#F97316', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
      })
      m2.addListener('dragend', () => {
        const pos = m2.getPosition()
        if (pos) setAdjustCoords(prev => prev ? { ...prev, end2_lat: pos.lat(), end2_lon: pos.lng() } : prev)
      })
      adjustMarkers.current.end2 = m2

      adjustMap.current = { gmap, line }
    })

    return () => {
      if (adjustMarkers.current.end1) { (adjustMarkers.current.end1 as google.maps.Marker).setMap(null); adjustMarkers.current.end1 = null }
      if (adjustMarkers.current.end2) { (adjustMarkers.current.end2 as google.maps.Marker).setMap(null); adjustMarkers.current.end2 = null }
      line?.setMap(null)
      adjustMap.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustingRunway])

  // Update centerline when coords change from dragging
  useEffect(() => {
    if (!adjustMap.current || !adjustCoords) return
    const { line } = adjustMap.current as any
    if (line && line.setPath) {
      line.setPath([
        { lat: adjustCoords.end1_lat, lng: adjustCoords.end1_lon },
        { lat: adjustCoords.end2_lat, lng: adjustCoords.end2_lon },
      ])
    }
    // Also update marker positions if they were moved programmatically
    const m1 = adjustMarkers.current.end1 as google.maps.Marker | null
    const m2 = adjustMarkers.current.end2 as google.maps.Marker | null
    if (m1) m1.setPosition({ lat: adjustCoords.end1_lat, lng: adjustCoords.end1_lon })
    if (m2) m2.setPosition({ lat: adjustCoords.end2_lat, lng: adjustCoords.end2_lon })
  }, [adjustCoords])

  // New runway form state
  const [newRunway, setNewRunway] = useState({
    runway_id: '',
    length_ft: '',
    width_ft: '',
    surface: 'Asphalt',
    true_heading: '',
    runway_class: 'B',
    end1_designator: '',
    end1_latitude: '',
    end1_longitude: '',
    end1_elevation_msl: '',
    end2_designator: '',
    end2_latitude: '',
    end2_longitude: '',
    end2_elevation_msl: '',
  })

  const handleAddRunway = async () => {
    if (!installationId || !newRunway.runway_id.trim()) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) { setSaving(false); return }

    const insert = {
      base_id: installationId,
      runway_id: newRunway.runway_id.trim(),
      length_ft: parseInt(newRunway.length_ft) || 0,
      width_ft: parseInt(newRunway.width_ft) || 0,
      surface: newRunway.surface,
      true_heading: parseFloat(newRunway.true_heading) || null,
      runway_class: newRunway.runway_class,
      end1_designator: newRunway.end1_designator.trim() || newRunway.runway_id.split('/')[0] || '',
      end1_latitude: parseFloat(newRunway.end1_latitude) || null,
      end1_longitude: parseFloat(newRunway.end1_longitude) || null,
      end1_heading: null,
      end1_approach_lighting: null,
      end1_elevation_msl: parseFloat(newRunway.end1_elevation_msl) || null,
      end2_designator: newRunway.end2_designator.trim() || newRunway.runway_id.split('/')[1] || '',
      end2_latitude: parseFloat(newRunway.end2_latitude) || null,
      end2_longitude: parseFloat(newRunway.end2_longitude) || null,
      end2_heading: null,
      end2_approach_lighting: null,
      end2_elevation_msl: parseFloat(newRunway.end2_elevation_msl) || null,
    }

    const { data, error } = await supabase
      .from('base_runways')
      .insert(insert)
      .select('*')
      .single()

    if (error) {
      toast.error(`Failed to add runway: ${error.message}`)
    } else {
      toast.success(`Runway ${newRunway.runway_id} added`)
      setRunways(prev => [...prev, data as typeof prev[number]])
      setAdding(false)
      setNewRunway({ runway_id: '', length_ft: '', width_ft: '', surface: 'Asphalt', true_heading: '', runway_class: 'B', end1_designator: '', end1_latitude: '', end1_longitude: '', end1_elevation_msl: '', end2_designator: '', end2_latitude: '', end2_longitude: '', end2_elevation_msl: '' })
    }
    setSaving(false)
  }

  const handleDeleteRunway = async (rwy: typeof runways[0]) => {
    if (!confirm(`Delete runway ${rwy.runway_id}? This cannot be undone.`)) return
    const supabase = createClient()
    if (!supabase) return

    const { error } = await supabase.from('base_runways').delete().eq('id', rwy.id)
    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success(`Runway ${rwy.runway_id} deleted`)
      setRunways(prev => prev.filter(r => r.id !== rwy.id))
    }
  }

  const fieldStyle = {
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-md)',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>Runways</h3>

      {runways.length === 0 && !adding && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>No runways configured yet.</p>
      )}

      {runways.map(rwy => (
        <div key={rwy.id} style={{
          padding: 12,
          background: 'var(--color-bg-inset)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              {rwy.runway_id} — {rwy.runway_class === 'Army_B' ? 'Army Class B' : `Class ${rwy.runway_class}`}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginTop: 4 }}>
              {rwy.length_ft} ft x {rwy.width_ft} ft | {rwy.surface} | Heading {rwy.true_heading}°
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4, fontFamily: 'monospace' }}>
              {rwy.end1_designator}: {rwy.end1_latitude?.toFixed(6)}°{(rwy.end1_latitude ?? 0) >= 0 ? 'N' : 'S'}, {rwy.end1_longitude ? Math.abs(rwy.end1_longitude).toFixed(6) : '—'}°{(rwy.end1_longitude ?? 0) >= 0 ? 'E' : 'W'}{rwy.end1_elevation_msl != null ? ` | ${rwy.end1_elevation_msl} ft MSL` : ''}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2, fontFamily: 'monospace' }}>
              {rwy.end2_designator}: {rwy.end2_latitude?.toFixed(6)}°{(rwy.end2_latitude ?? 0) >= 0 ? 'N' : 'S'}, {rwy.end2_longitude ? Math.abs(rwy.end2_longitude).toFixed(6) : '—'}°{(rwy.end2_longitude ?? 0) >= 0 ? 'E' : 'W'}{rwy.end2_elevation_msl != null ? ` | ${rwy.end2_elevation_msl} ft MSL` : ''}
            </div>
            <button
              onClick={() => openAdjustMap(rwy)}
              style={{
                marginTop: 6, padding: '4px 10px', borderRadius: 4,
                background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Adjust on Map
            </button>
          </div>
          <button
            onClick={() => handleDeleteRunway(rwy)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-danger)', cursor: 'pointer',
              fontSize: 'var(--fs-3xl)', padding: '0 4px', flexShrink: 0,
            }}
            title="Delete runway"
          >
            &times;
          </button>
        </div>
      ))}

      {adding ? (
        <div style={{
          padding: 14,
          background: 'var(--color-bg-inset)',
          borderRadius: 'var(--radius-base)',
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>Add Runway</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Runway ID (e.g. 01/19)</label>
              <input value={newRunway.runway_id} onChange={e => setNewRunway(p => ({ ...p, runway_id: e.target.value }))} placeholder="01/19" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Runway Class</label>
              <select value={newRunway.runway_class} onChange={e => setNewRunway(p => ({ ...p, runway_class: e.target.value }))} style={fieldStyle}>
                <option value="B">Class B</option>
                <option value="Army_B">Army Class B</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Length (ft)</label>
              <input type="number" value={newRunway.length_ft} onChange={e => setNewRunway(p => ({ ...p, length_ft: e.target.value }))} placeholder="9000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Width (ft)</label>
              <input type="number" value={newRunway.width_ft} onChange={e => setNewRunway(p => ({ ...p, width_ft: e.target.value }))} placeholder="150" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>True Heading (°)</label>
              <input type="number" value={newRunway.true_heading} onChange={e => setNewRunway(p => ({ ...p, true_heading: e.target.value }))} placeholder="10" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Surface</label>
            <select value={newRunway.surface} onChange={e => setNewRunway(p => ({ ...p, surface: e.target.value }))} style={fieldStyle}>
              <option>Asphalt</option>
              <option>Concrete</option>
              <option>Asphalt/Concrete</option>
            </select>
          </div>

          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)', marginTop: 4 }}>End 1</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Designator</label>
              <input value={newRunway.end1_designator} onChange={e => setNewRunway(p => ({ ...p, end1_designator: e.target.value }))} placeholder="01" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input type="number" step="0.00001" value={newRunway.end1_latitude} onChange={e => setNewRunway(p => ({ ...p, end1_latitude: e.target.value }))} placeholder="42.61000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input type="number" step="0.00001" value={newRunway.end1_longitude} onChange={e => setNewRunway(p => ({ ...p, end1_longitude: e.target.value }))} placeholder="-82.83000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Elev (ft MSL)</label>
              <input type="number" step="0.1" value={newRunway.end1_elevation_msl} onChange={e => setNewRunway(p => ({ ...p, end1_elevation_msl: e.target.value }))} placeholder="580" style={fieldStyle} />
            </div>
          </div>

          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)', marginTop: 4 }}>End 2</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Designator</label>
              <input value={newRunway.end2_designator} onChange={e => setNewRunway(p => ({ ...p, end2_designator: e.target.value }))} placeholder="19" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input type="number" step="0.00001" value={newRunway.end2_latitude} onChange={e => setNewRunway(p => ({ ...p, end2_latitude: e.target.value }))} placeholder="42.62000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input type="number" step="0.00001" value={newRunway.end2_longitude} onChange={e => setNewRunway(p => ({ ...p, end2_longitude: e.target.value }))} placeholder="-82.84000" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Elev (ft MSL)</label>
              <input type="number" step="0.1" value={newRunway.end2_elevation_msl} onChange={e => setNewRunway(p => ({ ...p, end2_elevation_msl: e.target.value }))} placeholder="580" style={fieldStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleAddRunway}
              disabled={saving || !newRunway.runway_id.trim()}
              style={{
                flex: 1,
                padding: '10px 16px', borderRadius: 'var(--radius-base)', border: 'none',
                background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: saving || !newRunway.runway_id.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Runway'}
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{
                padding: '10px 16px', borderRadius: 'var(--radius-base)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-inset)',
                color: 'var(--color-text-2)',
                fontSize: 'var(--fs-md)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setAdding(true)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-base)',
              border: '1px dashed var(--color-border)',
              background: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              fontSize: 'var(--fs-md)',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            + Add Runway
          </button>
          <button
            onClick={() => { setLookupOpen(true); setLookupResult(null); setLookupError(''); setLookupIcao('') }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-base)',
              border: '1px solid var(--color-cyan)',
              background: 'rgba(56,189,248,0.08)',
              color: 'var(--color-cyan)',
              cursor: 'pointer',
              fontSize: 'var(--fs-md)',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Import from ICAO
          </button>
        </div>
      )}

      {/* ICAO Lookup Dialog */}
      {lookupOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setLookupOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 14, padding: 24, width: '100%', maxWidth: 560,
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
              Import Runway Data
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              Enter an ICAO code to look up runway data from the OurAirports open database. US airports include FAA approach lighting details.
            </div>

            {/* Search bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={lookupIcao}
                onChange={e => setLookupIcao(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') handleIcaoLookup() }}
                placeholder="ICAO code (e.g. KVOK, ETAR)"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontFamily: 'monospace',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}
                autoFocus
              />
              <button
                onClick={handleIcaoLookup}
                disabled={lookupLoading || !lookupIcao.trim()}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'var(--color-cyan)', color: '#0F172A',
                  fontSize: 'var(--fs-md)', fontWeight: 700, cursor: lookupLoading ? 'wait' : 'pointer',
                  fontFamily: 'inherit', opacity: lookupLoading || !lookupIcao.trim() ? 0.5 : 1,
                }}
              >
                {lookupLoading ? 'Searching...' : 'Look Up'}
              </button>
            </div>

            {/* Error */}
            {lookupError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>
                {lookupError}
              </div>
            )}

            {/* Results */}
            {lookupResult && (
              <div>
                {/* Airport info */}
                <div style={{
                  padding: '12px 14px', borderRadius: 8, marginBottom: 12,
                  background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
                }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                    {lookupResult.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {lookupResult.icao} — {lookupResult.municipality}, {lookupResult.region} | Elev {lookupResult.elevation_ft} ft MSL
                  {lookupResult.arff_category && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', marginTop: 2 }}>
                      ARFF Category {lookupResult.arff_category}
                    </div>
                  )}
                  </div>
                </div>

                {/* Import All button */}
                <button
                  onClick={handleImportAll}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, var(--color-cyan), var(--color-accent))',
                    color: '#0F172A', fontSize: 'var(--fs-md)', fontWeight: 700,
                    cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                    marginBottom: 12, opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Importing...' : `Import All — Runways, Areas, NAVAIDs`}
                </button>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8, textAlign: 'center' }}>
                  Imports {lookupResult.runways.length} runway{lookupResult.runways.length !== 1 ? 's' : ''}, {lookupResult.suggested_areas?.length || 0} areas, {(lookupResult.navaids?.length || 0) + lookupResult.runways.filter((r: any) => r.end1_approach_lighting || r.end2_approach_lighting).length * 2} NAVAIDs{lookupResult.arff_category ? ` • ARFF Cat ${lookupResult.arff_category}` : ''}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', marginBottom: 12, textAlign: 'center', padding: '6px 10px', borderRadius: 6, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  Runway coordinates are approximate. Verify and adjust endpoint coordinates using your airfield diagram or survey data for accurate map overlays.
                </div>

                {/* Runways */}
                {lookupResult.runways.length === 0 ? (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No runway data found.</div>
                ) : (
                  lookupResult.runways.map((rwy: any, i: number) => {
                    const alreadyExists = runways.some(r => r.runway_id === rwy.runway_id)
                    return (
                      <div key={i} style={{
                        padding: 14, borderRadius: 10, marginBottom: 8,
                        background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                              Runway {rwy.runway_id}
                            </div>
                            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginTop: 2 }}>
                              {rwy.length_ft} x {rwy.width_ft} ft | {rwy.surface}{rwy.lighted ? ' | Lighted' : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => handleImportRunway(rwy)}
                            disabled={saving || alreadyExists}
                            style={{
                              padding: '8px 16px', borderRadius: 8, border: 'none',
                              background: alreadyExists ? 'var(--color-bg-surface)' : 'var(--color-cyan)',
                              color: alreadyExists ? 'var(--color-text-3)' : '#0F172A',
                              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: alreadyExists ? 'default' : 'pointer',
                              fontFamily: 'inherit', opacity: alreadyExists ? 0.5 : 1, flexShrink: 0,
                            }}
                          >
                            {alreadyExists ? 'Already Added' : saving ? 'Importing...' : 'Import'}
                          </button>
                        </div>

                        {/* End details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-surface)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>
                              {rwy.end1_designator}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                              {rwy.end1_latitude?.toFixed(5)}, {rwy.end1_longitude?.toFixed(5)}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                              Elev {rwy.end1_elevation_msl ?? '—'} ft | Hdg {rwy.end1_heading ?? '—'}°
                            </div>
                            {rwy.end1_approach_lighting && (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', marginTop: 2 }}>
                                {rwy.end1_approach_lighting}
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-surface)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>
                              {rwy.end2_designator}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                              {rwy.end2_latitude?.toFixed(5)}, {rwy.end2_longitude?.toFixed(5)}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                              Elev {rwy.end2_elevation_msl ?? '—'} ft | Hdg {rwy.end2_heading ?? '—'}°
                            </div>
                            {rwy.end2_approach_lighting && (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', marginTop: 2 }}>
                                {rwy.end2_approach_lighting}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Frequencies */}
                {lookupResult.frequencies.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6 }}>
                      Frequencies (reference only)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {lookupResult.frequencies.map((f: any, i: number) => (
                        <span key={i} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)',
                          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                          color: 'var(--color-text-2)', fontFamily: 'monospace',
                        }}>
                          {f.description} {f.frequency_mhz}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setLookupOpen(false)}
              style={{
                marginTop: 16, padding: '10px 0', width: '100%',
                borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)',
                background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 12 }}>
        Runway coordinates are used for obstruction evaluations and map overlays.
        Use "Adjust on Map" to drag threshold pins onto the satellite imagery for precise alignment.
      </p>

      {/* Map Adjustment Modal */}
      {adjustingRunway && adjustCoords && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setAdjustingRunway(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 14, width: '100%', maxWidth: 700, overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                Adjust Runway {adjustingRunway.runway_id} Coordinates
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>
                Drag the pins to align with the visible runway thresholds on the satellite imagery.
                <span style={{ color: 'var(--color-cyan)', fontWeight: 600 }}> Cyan</span> = {adjustingRunway.end1_designator},
                <span style={{ color: '#F97316', fontWeight: 600 }}> Orange</span> = {adjustingRunway.end2_designator}
              </div>
            </div>

            {/* Map */}
            <div ref={adjustMapContainer} style={{ width: '100%', height: 400 }} />

            {/* Coordinate readout */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 2 }}>
                  {adjustingRunway.end1_designator}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', fontFamily: 'monospace' }}>
                  {adjustCoords.end1_lat.toFixed(6)}, {adjustCoords.end1_lon.toFixed(6)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#F97316', marginBottom: 2 }}>
                  {adjustingRunway.end2_designator}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', fontFamily: 'monospace' }}>
                  {adjustCoords.end2_lat.toFixed(6)}, {adjustCoords.end2_lon.toFixed(6)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
              <button
                onClick={() => setAdjustingRunway(null)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-base)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustedCoords}
                disabled={saving}
                style={{
                  flex: 2, padding: '10px 16px', borderRadius: 'var(--radius-base)',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                  color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Adjusted Coordinates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  color: 'var(--color-text-3)',
  letterSpacing: '0.06em',
  marginBottom: 3,
}

// ═══════════════════════════════════════════════════════════════
// NAVAID Tab — loads from DB, creates navaid_statuses entries
// ═══════════════════════════════════════════════════════════════

function NavaidTab({ installationId }: { installationId: string | null }) {
  const [navaids, setNavaids] = useState<{ id: string; navaid_name: string; sort_order: number }[]>([])
  const [statuses, setStatuses] = useState<NavaidStatus[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)

  const loadNavaids = useCallback(async () => {
    if (!installationId) return
    const scrollY = window.scrollY
    setLoading(true)
    const navaidData = await fetchInstallationNavaids(installationId)
    setNavaids(navaidData)
    const statusData = await fetchNavaidStatuses(installationId)
    setStatuses(statusData)
    setLoading(false)
    requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }, [installationId])

  useEffect(() => { loadNavaids() }, [loadNavaids])

  const handleAdd = async () => {
    if (!newItem.trim() || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    const maxSort = navaids.length

    // Add to base_navaids config table
    const { data: navaidRow, error: navaidErr } = await supabase
      .from('base_navaids')
      .insert({ base_id: installationId, navaid_name: newItem.trim(), sort_order: maxSort })
      .select('*')
      .single()

    if (navaidErr) {
      toast.error(`Failed to add: ${navaidErr.message}`)
      return
    }

    // Also create a navaid_statuses entry so it appears on the dashboard
    await supabase
      .from('navaid_statuses')
      .insert({
        navaid_name: newItem.trim(),
        base_id: installationId,
        status: 'green',
        notes: null,
        updated_by: null,
      })

    toast.success(`Added "${newItem.trim()}"`)
    setNavaids(prev => [...prev, navaidRow as typeof prev[number]])
    setNewItem('')
    // Reload to get updated statuses
    await loadNavaids()
  }

  const handleDelete = async (navaid: { id: string; navaid_name: string }) => {
    if (!confirm(`Delete "${navaid.navaid_name}"?`) || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    // Delete from base_navaids
    await supabase.from('base_navaids').delete().eq('id', navaid.id)

    // Also delete from navaid_statuses
    await supabase
      .from('navaid_statuses')
      .delete()
      .eq('base_id', installationId)
      .eq('navaid_name', navaid.navaid_name)

    toast.success(`Deleted "${navaid.navaid_name}"`)
    setNavaids(prev => prev.filter(n => n.id !== navaid.id))
    setStatuses(prev => prev.filter(s => s.navaid_name !== navaid.navaid_name))
  }

  if (loading) {
    return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading NAVAIDs...</p>
  }

  // Build a lookup of status by name
  const statusMap: Record<string, NavaidStatus> = {}
  statuses.forEach(s => { statusMap[s.navaid_name] = s })

  const STATUS_COLORS: Record<string, string> = {
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>NAVAIDs</h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        NAVAIDs added here will appear on the dashboard for status tracking.
      </p>

      {navaids.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No NAVAIDs configured.</p>
      )}

      {navaids.map(navaid => {
        const status = statusMap[navaid.navaid_name]
        return (
          <div key={navaid.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--fs-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {status && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLORS[status.status] ?? 'var(--color-text-3)',
                  flexShrink: 0,
                }} />
              )}
              <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{navaid.navaid_name}</span>
              {status && (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  ({status.status})
                </span>
              )}
            </div>
            <button
              onClick={() => handleDelete(navaid)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
            >
              &times;
            </button>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add NAVAID (e.g. ILS 01, TACAN, ASR-9)..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newItem.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Simple list tab for Areas
// ═══════════════════════════════════════════════════════════════

function SimpleListTab({
  title, items, tableName, fieldName, installationId,
}: {
  title: string
  items: string[]
  tableName: string
  fieldName: string
  installationId: string | null
}) {
  const [list, setList] = useState<string[]>(items)
  const [newItem, setNewItem] = useState('')

  const handleAdd = async () => {
    if (!newItem.trim() || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    const maxSort = list.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(tableName)
      .insert({ base_id: installationId, [fieldName]: newItem.trim(), sort_order: maxSort })

    if (error) {
      toast.error(`Failed to add: ${error.message}`)
    } else {
      toast.success(`Added "${newItem.trim()}"`)
      setList(prev => [...prev, newItem.trim()])
      setNewItem('')
    }
  }

  const handleDelete = async (item: string) => {
    if (!confirm(`Delete "${item}"?`) || !installationId) return
    const supabase = createClient()
    if (!supabase) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(tableName)
      .delete()
      .eq('base_id', installationId)
      .eq(fieldName, item)

    if (error) {
      toast.error(`Failed to delete: ${error.message}`)
    } else {
      toast.success(`Deleted "${item}"`)
      setList(prev => prev.filter(i => i !== item))
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>{title}</h3>
      {list.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No items configured.</p>
      )}
      {list.map(item => (
        <div key={item} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 'var(--fs-md)',
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{item}</span>
          <button
            onClick={() => handleDelete(item)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}...`}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newItem.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CE Shops tab
// ═══════════════════════════════════════════════════════════════

function ShopsTab({ shops, typeShopMap: initialTypeShopMap, installationId }: { shops: string[]; typeShopMap: Record<string, string>; installationId: string | null }) {
  const [list, setList] = useState<string[]>(shops)
  const [newShop, setNewShop] = useState('')
  const [typeMap, setTypeMap] = useState<Record<string, string>>(initialTypeShopMap)

  const saveShopsToDb = async (updatedList: string[]) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from('bases')
      .update({ ce_shops: updatedList } as any)
      .eq('id', installationId)
    if (error) toast.error(`Failed to save: ${error.message}`)
  }

  const saveTypeMapToDb = async (updatedMap: Record<string, string>) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from('bases')
      .update({ discrepancy_type_shop_map: updatedMap } as any)
      .eq('id', installationId)
    if (error) toast.error(`Failed to save mapping: ${error.message}`)
  }

  const handleAdd = async () => {
    if (!newShop.trim()) return
    const updated = [...list, newShop.trim()]
    setList(updated)
    setNewShop('')
    await saveShopsToDb(updated)
    toast.success(`Added "${newShop.trim()}"`)
  }

  const handleDelete = async (shop: string) => {
    if (!confirm(`Delete "${shop}"?`)) return
    const updated = list.filter(s => s !== shop)
    setList(updated)
    await saveShopsToDb(updated)
    // Also remove from type map
    const updatedMap = { ...typeMap }
    for (const [k, v] of Object.entries(updatedMap)) {
      if (v === shop) delete updatedMap[k]
    }
    setTypeMap(updatedMap)
    await saveTypeMapToDb(updatedMap)
    toast.success(`Deleted "${shop}"`)
  }

  const handleTypeMapChange = async (typeValue: string, shopName: string) => {
    const updatedMap = { ...typeMap }
    if (shopName) {
      updatedMap[typeValue] = shopName
    } else {
      delete updatedMap[typeValue]
    }
    setTypeMap(updatedMap)
    await saveTypeMapToDb(updatedMap)
    toast.success('Type assignment updated')
  }

  // Import DISCREPANCY_TYPES for the mapping UI
  const discTypes = [
    { value: 'fod_hazard', label: 'FOD Hazard' },
    { value: 'pavement', label: 'Pavement Deficiency' },
    { value: 'lighting', label: 'Lighting Outage/Deficiency' },
    { value: 'marking', label: 'Marking Deficiency' },
    { value: 'signage', label: 'Signage Deficiency' },
    { value: 'drainage', label: 'Drainage Issue' },
    { value: 'vegetation', label: 'Vegetation Encroachment' },
    { value: 'wildlife', label: 'Wildlife Hazard' },
    { value: 'obstruction', label: 'Airfield Obstruction' },
    { value: 'navaid', label: 'NAVAID Deficiency' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>CE Shops</h3>
      {list.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No CE shops configured.</p>
      )}
      {list.map(shop => (
        <div key={shop} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-md)',
        }}>
          <span style={{ color: 'var(--color-text-1)' }}>{shop}</span>
          <button
            onClick={() => handleDelete(shop)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newShop}
          onChange={e => setNewShop(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add CE shop..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newShop.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newShop.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>

      {/* Discrepancy Type → Shop Mapping */}
      {list.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
            Discrepancy Type Assignments
          </h3>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 10 }}>
            When a discrepancy is created, it will auto-assign to the shop mapped here.
          </p>
          {discTypes.map(dt => (
            <div key={dt.value} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '6px 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', flex: '0 0 45%' }}>{dt.label}</span>
              <select
                value={typeMap[dt.value] || ''}
                onChange={e => handleTypeMapChange(dt.value, e.target.value)}
                style={{
                  flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: typeMap[dt.value] ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                }}
              >
                <option value="">— Not Assigned —</option>
                {list.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Facilities tab
// ═══════════════════════════════════════════════════════════════

function FacilitiesTab({ installationId }: { installationId: string | null }) {
  const [facilities, setFacilities] = useState<{ id: string; facility_number: string; description: string }[]>([])
  const [newNumber, setNewNumber] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    const { fetchFacilities } = await import('@/lib/supabase/facilities')
    const data = await fetchFacilities(installationId)
    setFacilities(data.map(f => ({ id: f.id, facility_number: f.facility_number, description: f.description })))
  }, [installationId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newNumber.trim() || !newDesc.trim() || !installationId) return
    const { createFacility } = await import('@/lib/supabase/facilities')
    const { error } = await createFacility({
      base_id: installationId,
      facility_number: newNumber.trim(),
      description: newDesc.trim(),
      sort_order: facilities.length,
    })
    if (error) {
      toast.error(`Failed to add: ${error}`)
    } else {
      toast.success(`Added facility ${newNumber.trim()}`)
      setNewNumber('')
      setNewDesc('')
      load()
    }
  }

  const handleDelete = async (fac: { id: string; facility_number: string }) => {
    if (!confirm(`Delete facility ${fac.facility_number}?`)) return
    const { deleteFacility } = await import('@/lib/supabase/facilities')
    const { error } = await deleteFacility(fac.id)
    if (error) {
      toast.error(`Failed to delete: ${error}`)
    } else {
      toast.success(`Deleted facility ${fac.facility_number}`)
      load()
    }
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !installationId) return
    setImporting(true)

    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const buf = await file.arrayBuffer()
      await wb.xlsx.load(buf)
      const ws = wb.worksheets[0]
      if (!ws) {
        toast.error('No worksheet found in file')
        setImporting(false)
        return
      }

      const rows: { facility_number: string; description: string }[] = []
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return // skip header
        const num = String(row.getCell(1).value ?? '').trim()
        const desc = String(row.getCell(2).value ?? '').trim()
        if (num && desc) {
          rows.push({ facility_number: num, description: desc })
        }
      })

      if (rows.length === 0) {
        toast.error('No valid rows found. Expected columns: Facility Number, Description')
        setImporting(false)
        return
      }

      const { bulkCreateFacilities } = await import('@/lib/supabase/facilities')
      const { count, error } = await bulkCreateFacilities(installationId, rows)
      if (error) {
        toast.error(`Import failed: ${error}`)
      } else {
        toast.success(`Imported ${count} facilities`)
        load()
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to read Excel file')
    }

    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>Facility Numbers</h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Real property facility numbers assigned to Airfield Management. Used for discrepancy tracking.
      </p>

      {facilities.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No facilities configured.</p>
      )}
      {facilities.map(fac => (
        <div key={fac.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-md)',
        }}>
          <div>
            <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontFamily: 'monospace', marginRight: 10 }}>{fac.facility_number}</span>
            <span style={{ color: 'var(--color-text-1)' }}>{fac.description}</span>
          </div>
          <button
            onClick={() => handleDelete(fac)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px', flexShrink: 0 }}
          >
            &times;
          </button>
        </div>
      ))}

      {/* Add single facility */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={newNumber}
          onChange={e => setNewNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Facility #"
          style={{
            width: 100, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
            fontFamily: 'monospace',
          }}
        />
        <input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Description..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newNumber.trim() || !newDesc.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: '#fff',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
            opacity: !newNumber.trim() || !newDesc.trim() ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>

      {/* Excel import */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: 'none' }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        style={{
          marginTop: 12, width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-base)',
          border: '2px dashed var(--color-border)',
          background: 'transparent', color: 'var(--color-text-2)',
          fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          opacity: importing ? 0.6 : 1,
        }}
      >
        {importing ? 'Importing...' : 'Import from Excel (.xlsx)'}
      </button>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
        Expected columns: Column A = Facility Number, Column B = Description. First row is treated as a header.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Templates tab
// ═══════════════════════════════════════════════════════════════

function TemplatesTab({ installationId }: { installationId: string | null }) {
  const [cloning, setCloning] = useState(false)
  const [hasAirfield, setHasAirfield] = useState<boolean | null>(null)
  const [hasLighting, setHasLighting] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      if (!installationId) return
      const af = await fetchInspectionTemplate(installationId, 'airfield')
      const lt = await fetchInspectionTemplate(installationId, 'lighting')
      setHasAirfield(af.length > 0)
      setHasLighting(lt.length > 0)
    }
    check()
  }, [installationId])

  const handleCloneDefaults = async () => {
    if (!installationId) return
    setCloning(true)
    const af = await createDefaultTemplate(installationId, 'airfield')
    const lt = await createDefaultTemplate(installationId, 'lighting')
    if (af && lt) {
      toast.success('Default inspection templates created')
      setHasAirfield(true)
      setHasLighting(true)
    } else {
      toast.error('Some templates failed to create — does a source template exist?')
    }
    setCloning(false)
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Inspection Templates
      </h3>
      <p style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 12 }}>
        Manage checklist items for airfield and lighting inspections.
      </p>

      {/* Status indicators */}
      {hasAirfield !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-md)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasAirfield ? 'var(--color-success)' : 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-text-1)' }}>Airfield template</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              {hasAirfield ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-md)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasLighting ? 'var(--color-success)' : 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-text-1)' }}>Lighting template</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              {hasLighting ? 'Configured' : 'Not configured'}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href="/settings/templates"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px 16px', borderRadius: 'var(--radius-base)',
            background: 'var(--color-purple)',
            color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          Edit Templates
        </a>
        {(!hasAirfield || !hasLighting) && (
          <button
            onClick={handleCloneDefaults}
            disabled={cloning}
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius-base)',
              border: 'none',
              background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
              color: '#fff',
              fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              cursor: cloning ? 'wait' : 'pointer',
              opacity: cloning ? 0.5 : 1,
            }}
          >
            {cloning ? 'Creating...' : 'Initialize from Default Template'}
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Preview — shows live data without navigating away
// ═══════════════════════════════════════════════════════════════

function DashboardPreview({
  installationId,
  currentInstallation,
}: {
  installationId: string | null
  currentInstallation: ReturnType<typeof useInstallation>['currentInstallation']
}) {
  const [navaidStatuses, setNavaidStatuses] = useState<NavaidStatus[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [navaids, setNavaids] = useState<{ navaid_name: string }[]>([])
  const [runwayCount, setRunwayCount] = useState(0)
  const [templateStatus, setTemplateStatus] = useState<{ airfield: number; lighting: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!installationId) { setLoading(false); return }
      setLoading(true)

      const supabase = createClient()

      // Fetch all live data in parallel
      const [navaidData, navaidConfigData, areaData, runwayData, afTemplate, ltTemplate] = await Promise.all([
        fetchNavaidStatuses(installationId),
        fetchInstallationNavaids(installationId),
        supabase
          ? supabase.from('base_areas').select('area_name').eq('base_id', installationId).order('sort_order')
          : Promise.resolve({ data: [] }),
        supabase
          ? supabase.from('base_runways').select('id').eq('base_id', installationId)
          : Promise.resolve({ data: [] }),
        fetchInspectionTemplate(installationId, 'airfield'),
        fetchInspectionTemplate(installationId, 'lighting'),
      ])

      setNavaidStatuses(navaidData)
      setNavaids(navaidConfigData)
      setAreas(areaData?.data?.map((a: { area_name: string }) => a.area_name) ?? [])
      setRunwayCount(runwayData?.data?.length ?? 0)
      setTemplateStatus({
        airfield: afTemplate.reduce((sum: number, s: { items: unknown[] }) => sum + s.items.length, 0),
        lighting: ltTemplate.reduce((sum: number, s: { items: unknown[] }) => sum + s.items.length, 0),
      })

      setLoading(false)
    }
    load()
  }, [installationId])

  const STATUS_COLORS: Record<string, string> = {
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
  }

  if (loading) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
        Loading preview...
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 16,
      border: '2px solid var(--color-accent)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
    }}>
      {/* Preview header */}
      <div style={{
        background: 'rgba(56,189,248,0.08)',
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-accent)' }}>
          Dashboard Preview
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Live data from database</span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Base name */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {currentInstallation?.name ?? 'Unnamed Base'}
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {currentInstallation?.icao ?? 'No ICAO'} | {runwayCount} runway{runwayCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* NAVAIDs section — mirrors dashboard */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            NAVAID STATUS ({navaidStatuses.length})
          </div>
          {navaidStatuses.length === 0 ? (
            <div style={{
              padding: 12, borderRadius: 'var(--radius-base)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-base)', textAlign: 'center',
            }}>
              No NAVAIDs configured — add them in the NAVAIDs tab
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {navaidStatuses.map(n => (
                <div key={n.id} style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-base)',
                  background: `${STATUS_COLORS[n.status]}15`,
                  border: `1px solid ${STATUS_COLORS[n.status]}40`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                    {n.navaid_name}
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 600, marginTop: 2,
                    color: STATUS_COLORS[n.status],
                    textTransform: 'uppercase',
                  }}>
                    {n.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Areas section */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            AIRFIELD AREAS ({areas.length})
          </div>
          {areas.length === 0 ? (
            <div style={{
              padding: 12, borderRadius: 'var(--radius-base)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-base)', textAlign: 'center',
            }}>
              No areas configured — add them in the Areas tab
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {areas.map(a => (
                <span key={a} style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-inset)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--fs-base)',
                  color: 'var(--color-text-1)',
                }}>
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Templates section */}
        <div>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', marginBottom: 8,
          }}>
            INSPECTION TEMPLATES
          </div>
          {templateStatus && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1, padding: 10, borderRadius: 'var(--radius-base)',
                background: templateStatus.airfield > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${templateStatus.airfield > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                  {templateStatus.airfield}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>Airfield items</div>
              </div>
              <div style={{
                flex: 1, padding: 10, borderRadius: 'var(--radius-base)',
                background: templateStatus.lighting > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${templateStatus.lighting > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                  {templateStatus.lighting}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>Lighting items</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Shift Checklist Configuration Tab =====

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'day', label: 'Day Shift' },
  { value: 'swing', label: 'Swing Shift' },
  { value: 'mid', label: 'Mid Shift' },
]

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const FREQ_TAG_COLORS: Record<string, string> = { daily: 'var(--color-cyan)', weekly: 'var(--color-purple)', monthly: 'var(--color-warning)' }

function ShiftChecklistTab({ installationId, currentInstallation }: { installationId: string | null; currentInstallation: any }) {
  const [items, setItems] = useState<ShiftChecklistItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetTime, setResetTime] = useState('06:00')
  const [savingReset, setSavingReset] = useState(false)

  const [formLabel, setFormLabel] = useState('')
  const [formShift, setFormShift] = useState<ShiftType>('day')
  const [formFreq, setFormFreq] = useState<FrequencyType>('daily')

  const [editLabel, setEditLabel] = useState('')
  const [editShift, setEditShift] = useState<ShiftType>('day')
  const [editFreq, setEditFreq] = useState<FrequencyType>('daily')

  useEffect(() => {
    if (currentInstallation?.checklist_reset_time) {
      setResetTime(currentInstallation.checklist_reset_time)
    }
  }, [currentInstallation])

  const load = useCallback(async () => {
    const data = await fetchChecklistItems(installationId)
    setItems(data)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  async function handleSaveResetTime(newTime: string) {
    if (!installationId) return
    setSavingReset(true)
    const supabase = createClient()
    if (supabase) {
      const { error } = await supabase
        .from('bases')
        .update({ checklist_reset_time: newTime, updated_at: new Date().toISOString() } as any)
        .eq('id', installationId)
      if (error) toast.error(error.message)
      else toast.success('Reset time updated')
    }
    setSavingReset(false)
  }

  async function handleCreate() {
    if (!formLabel.trim() || !installationId) return
    setSaving(true)
    const { error } = await createChecklistItem({
      base_id: installationId,
      label: formLabel.trim(),
      shift: formShift,
      frequency: formFreq,
      sort_order: items.length,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      setFormLabel('')
      setFormShift('day')
      setFormFreq('daily')
      setShowForm(false)
      await load()
      toast.success('Item added')
    }
  }

  async function handleUpdate() {
    if (!editingId || !editLabel.trim()) return
    setSaving(true)
    const { error } = await updateChecklistItem(editingId, {
      label: editLabel.trim(),
      shift: editShift,
      frequency: editFreq,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      setEditingId(null)
      await load()
      toast.success('Item updated')
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await deleteChecklistItem(id)
    if (error) toast.error(error)
    else { await load(); toast.success('Item deleted') }
  }

  async function handleToggleActive(item: ShiftChecklistItem) {
    const { error } = await updateChecklistItem(item.id, { is_active: !item.is_active })
    if (error) toast.error(error)
    else await load()
  }

  function startEdit(item: ShiftChecklistItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditShift(item.shift)
    setEditFreq(item.frequency)
  }

  const dayItems = items.filter(i => i.shift === 'day')
  const midItems = items.filter(i => i.shift === 'mid')
  const swingItems = items.filter(i => i.shift === 'swing')

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
    fontFamily: 'inherit',
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  function renderItemList(label: string, list: ShiftChecklistItem[]) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 6 }}>
          {label} ({list.length})
        </div>
        {list.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '8px 0' }}>No items configured.</div>
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', overflow: 'hidden' }}>
            {list.map((item, i) => (
              <div key={item.id}>
                {editingId === item.id ? (
                  <div style={{ padding: '10px 12px', background: 'var(--color-bg-elevated)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={inputStyle} placeholder="Item label" />
                      <select value={editShift} onChange={e => setEditShift(e.target.value as ShiftType)} style={selectStyle}>
                        {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <select value={editFreq} onChange={e => setEditFreq(e.target.value as FrequencyType)} style={selectStyle}>
                        {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }}>Cancel</button>
                      <button onClick={handleUpdate} disabled={saving || !editLabel.trim()} style={{ background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                    opacity: item.is_active ? 1 : 0.5,
                  }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)' }}>{item.label}</div>
                    <span style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_TAG_COLORS[item.frequency],
                      background: `${FREQ_TAG_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 'var(--radius-lg)', flexShrink: 0,
                    }}>{item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}</span>
                    <button onClick={() => handleToggleActive(item)} title={item.is_active ? 'Disable' : 'Enable'} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 'var(--fs-xs)', fontWeight: 600, color: item.is_active ? 'var(--color-status-pass)' : 'var(--color-text-4)',
                    }}>{item.is_active ? 'Active' : 'Inactive'}</button>
                    <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDelete(item.id, item.label)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const RESET_TIME_OPTIONS = [
    '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00',
  ]

  return (
    <div>
      {/* Reset Time Configuration */}
      <div style={{
        background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-base)', padding: 14, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Daily Reset Time</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            New checklists start at this time each day ({currentInstallation?.timezone || 'local time'}).
          </div>
        </div>
        <select
          value={resetTime}
          onChange={e => {
            setResetTime(e.target.value)
            handleSaveResetTime(e.target.value)
          }}
          disabled={savingReset}
          style={{ ...selectStyle, minWidth: 100 }}
        >
          {RESET_TIME_OPTIONS.map(t => {
            const hr = parseInt(t)
            const label = hr < 12 ? `${hr}:00 AM` : hr === 12 ? '12:00 PM' : `${hr - 12}:00 PM`
            return <option key={t} value={t}>{label}</option>
          })}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Checklist Items</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Configure items for day and swing shift checklists.</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 'var(--radius-base)',
          padding: '8px 16px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
        }}>{showForm ? 'Cancel' : '+ Add Item'}</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 8 }}>
            <input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="Checklist item label" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={formShift} onChange={e => setFormShift(e.target.value as ShiftType)} style={selectStyle}>
                {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={formFreq} onChange={e => setFormFreq(e.target.value as FrequencyType)} style={selectStyle}>
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !formLabel.trim()} style={{
            width: '100%', padding: '8px 0', borderRadius: 'var(--radius-sm)', border: 'none',
            background: formLabel.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
            color: formLabel.trim() ? '#000' : 'var(--color-text-3)',
            fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: formLabel.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>{saving ? 'Adding...' : 'Add Item'}</button>
        </div>
      )}

      {!loaded ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : (
        <>
          {renderItemList('Day Shift', dayItems)}
          {renderItemList('Swing Shift', swingItems)}
          {midItems.length > 0 && renderItemList('Mid Shift', midItems)}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// QRC Templates Tab
// ═══════════════════════════════════════════════════════════════

type QrcTemplateRow = { id: string; qrc_number: number; title: string; notes: string | null; is_active: boolean; steps: unknown[]; references: string | null; has_scn_form: boolean }

function QrcTemplatesTab({ installationId }: { installationId: string | null }) {
  const [templates, setTemplates] = useState<QrcTemplateRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showSeedPicker, setShowSeedPicker] = useState(false)
  const [seedSelected, setSeedSelected] = useState<Set<number>>(new Set())
  const [seeding, setSeeding] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QrcTemplateRow | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    const { fetchQrcTemplates } = await import('@/lib/supabase/qrc')
    const data = await fetchQrcTemplates(installationId)
    setTemplates(data as QrcTemplateRow[])
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  // Seed picker helpers
  async function openSeedPicker() {
    const { QRC_SEED_DATA } = await import('@/lib/qrc-seed-data')
    const existingNumbers = new Set(templates.map(t => t.qrc_number))
    const available = QRC_SEED_DATA.filter(q => !existingNumbers.has(q.qrc_number))
    if (available.length === 0) {
      toast.info('All 25 default QRCs are already added')
      return
    }
    setSeedSelected(new Set(available.map(q => q.qrc_number)))
    setShowSeedPicker(true)
  }

  async function handleSeedSelected() {
    if (!installationId || seedSelected.size === 0) return
    setSeeding(true)
    const { seedQrcTemplates } = await import('@/lib/supabase/qrc')
    const { count, error } = await seedQrcTemplates(installationId, Array.from(seedSelected))
    if (error) toast.error(error)
    else {
      toast.success(`Added ${count} QRC template${count !== 1 ? 's' : ''}`)
      setShowSeedPicker(false)
      await load()
    }
    setSeeding(false)
  }

  async function handleToggle(id: string, isActive: boolean) {
    const { updateQrcTemplate } = await import('@/lib/supabase/qrc')
    const { error } = await updateQrcTemplate(id, { is_active: !isActive })
    if (error) toast.error(error)
    else await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this QRC template and all its execution history? This cannot be undone.\n\nTo keep the template but hide it, use "Disable" instead.')) return
    const { deleteQrcTemplate } = await import('@/lib/supabase/qrc')
    const { error } = await deleteQrcTemplate(id)
    if (error) toast.error(error)
    else { toast.success('Template deleted'); await load() }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>QRC Templates</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Configure Quick Reaction Checklists for this base.</div>
        </div>
        <button onClick={openSeedPicker} style={{
          background: 'var(--color-cyan)', color: '#fff', border: 'none', borderRadius: 'var(--radius-base)',
          padding: '8px 16px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Add from Defaults</button>
      </div>

      {/* Seed Picker Dialog */}
      {showSeedPicker && (
        <SeedPickerDialog
          seedSelected={seedSelected}
          setSeedSelected={setSeedSelected}
          existingNumbers={new Set(templates.map(t => t.qrc_number))}
          seeding={seeding}
          onSeed={handleSeedSelected}
          onClose={() => setShowSeedPicker(false)}
        />
      )}

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <EditQrcDialog
          template={editingTemplate}
          inputStyle={inputStyle}
          onClose={() => setEditingTemplate(null)}
          onSaved={async () => { setEditingTemplate(null); await load() }}
        />
      )}

      {!loaded ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No QRC templates. Click &quot;+ Add from Defaults&quot; to select which QRCs to add.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-base)',
              border: '1px solid var(--color-border)',
              opacity: t.is_active ? 1 : 0.5,
            }}>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 800,
                color: '#fff', background: t.is_active ? '#D97706' : 'var(--color-text-4)',
                padding: '2px 6px', borderRadius: 'var(--radius-xs)', minWidth: 32, textAlign: 'center',
              }}>{t.qrc_number}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>{t.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{(t.steps as unknown[]).length} steps</div>
              </div>
              {/* Action menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === t.id ? null : t.id) }}
                  style={{
                    background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                    padding: '3px 10px', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
                    color: 'var(--color-text-2)', fontFamily: 'inherit',
                  }}
                >&#x22EE;</button>
                {menuOpen === t.id && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 'var(--z-dropdown)',
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-base)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 140,
                    overflow: 'hidden',
                  }}>
                    <button onClick={() => { setMenuOpen(null); setEditingTemplate(t) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: 'var(--color-text-1)',
                    }}>Edit</button>
                    <button onClick={() => { setMenuOpen(null); handleToggle(t.id, t.is_active) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: t.is_active ? 'var(--color-warning)' : 'var(--color-success)',
                    }}>{t.is_active ? 'Disable' : 'Enable'}</button>
                    <div style={{ height: 1, background: 'var(--color-border)' }} />
                    <button onClick={() => { setMenuOpen(null); handleDelete(t.id) }} style={{
                      display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                      fontWeight: 600, color: 'var(--color-danger)',
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Seed Picker Dialog ---

function SeedPickerDialog({
  seedSelected, setSeedSelected, existingNumbers, seeding, onSeed, onClose,
}: {
  seedSelected: Set<number>
  setSeedSelected: (s: Set<number>) => void
  existingNumbers: Set<number>
  seeding: boolean
  onSeed: () => void
  onClose: () => void
}) {
  const [allQrcs, setAllQrcs] = useState<{ qrc_number: number; title: string }[]>([])

  useEffect(() => {
    import('@/lib/qrc-seed-data').then(({ QRC_SEED_DATA }) => {
      setAllQrcs(QRC_SEED_DATA.filter(q => !existingNumbers.has(q.qrc_number)))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAll() {
    if (seedSelected.size === allQrcs.length) setSeedSelected(new Set())
    else setSeedSelected(new Set(allQrcs.map(q => q.qrc_number)))
  }

  function toggle(n: number) {
    const next = new Set(seedSelected)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    setSeedSelected(next)
  }

  return (
    <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Add QRC Templates</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>Select which QRCs to add to this base.</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {allQrcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              All default QRCs are already added.
            </div>
          ) : (
            <>
              <button onClick={toggleAll} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)', padding: '4px 0', marginBottom: 4,
              }}>{seedSelected.size === allQrcs.length ? 'Deselect All' : 'Select All'}</button>
              {allQrcs.map(q => (
                <button key={q.qrc_number} onClick={() => toggle(q.qrc_number)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 0',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', borderBottom: '1px solid var(--color-border)',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 'var(--radius-xs)', flexShrink: 0,
                    border: seedSelected.has(q.qrc_number) ? 'none' : '2px solid var(--color-border-mid)',
                    background: seedSelected.has(q.qrc_number) ? 'var(--color-cyan)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{seedSelected.has(q.qrc_number) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>&#10003;</span>}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#fff', background: '#D97706', padding: '1px 5px', borderRadius: 'var(--radius-xs)' }}>{q.qrc_number}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', flex: 1 }}>{q.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={onSeed} disabled={seeding || seedSelected.size === 0} style={{
            flex: 1, padding: '10px 0', borderRadius: 'var(--radius-base)', border: 'none',
            background: seedSelected.size > 0 ? 'var(--color-cyan)' : 'var(--color-border)',
            color: seedSelected.size > 0 ? '#000' : 'var(--color-text-3)',
            fontWeight: 700, fontSize: 'var(--fs-base)', cursor: seedSelected.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>{seeding ? 'Adding...' : `Add ${seedSelected.size} QRC${seedSelected.size !== 1 ? 's' : ''}`}</button>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// --- Edit QRC Template Dialog ---

const STEP_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'checkbox_with_note', label: 'Checkbox + Note' },
  { value: 'fill_field', label: 'Fill-in Field' },
  { value: 'time_field', label: 'Time Field' },
  { value: 'notify_agencies', label: 'Agency Notification' },
  { value: 'conditional', label: 'Conditional Ref' },
  { value: 'text', label: 'Text (read-only)' },
  { value: 'textarea', label: 'Text Area' },
]

const STEP_TYPE_LABELS: Record<string, string> = Object.fromEntries(STEP_TYPE_OPTIONS.map(o => [o.value, o.label]))

function EditQrcDialog({
  template, inputStyle, onClose, onSaved,
}: {
  template: QrcTemplateRow
  inputStyle: React.CSSProperties
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(template.title)
  const [notes, setNotes] = useState(template.notes || '')
  const [refs, setRefs] = useState(template.references || '')
  const [steps, setSteps] = useState<{ id: string; label: string; type: string }[]>(
    (template.steps as { id: string; label: string; type: string }[]).map(s => ({ id: s.id, label: s.label, type: s.type }))
  )
  const [saving, setSaving] = useState(false)
  const [addingStep, setAddingStep] = useState(false)
  const [newStepLabel, setNewStepLabel] = useState('')
  const [newStepType, setNewStepType] = useState('checkbox')

  async function handleSave() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const { updateQrcTemplate } = await import('@/lib/supabase/qrc')

    // Rebuild full steps — preserve original step data, update labels, add new steps
    const origSteps = template.steps as Record<string, unknown>[]
    const origMap = new Map(origSteps.map(s => [(s as { id: string }).id, s]))
    const fullSteps = steps.map(s => {
      const orig = origMap.get(s.id)
      if (orig) return { ...orig, label: s.label, type: s.type }
      return { id: s.id, type: s.type, label: s.label }
    })

    const { error } = await updateQrcTemplate(template.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      references: refs.trim() || null,
      steps: fullSteps as any,
    })
    if (error) toast.error(error)
    else { toast.success('Template updated'); await onSaved() }
    setSaving(false)
  }

  function handleAddStep() {
    if (!newStepLabel.trim()) return
    const nextNum = steps.length + 1
    setSteps([...steps, { id: String(nextNum), label: newStepLabel.trim(), type: newStepType }])
    setNewStepLabel('')
    setNewStepType('checkbox')
    setAddingStep(false)
  }

  function handleRemoveStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx))
  }

  function handleMoveStep(idx: number, dir: -1 | 1) {
    const arr = [...steps]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setSteps(arr)
  }

  return (
    <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Edit QRC-{template.qrc_number}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {/* Title */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>
          {/* Notes / Warning */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Warning / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {/* References */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>References</label>
            <input value={refs} onChange={e => setRefs(e.target.value)} placeholder="e.g. AFI 13-204V3" style={inputStyle} />
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Steps ({steps.length})</label>
            <button onClick={() => setAddingStep(true)} style={{
              background: 'none', border: '1px solid var(--color-cyan)', borderRadius: 'var(--radius-sm)',
              padding: '2px 10px', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Add Step</button>
          </div>
          {steps.map((s, i) => (
            <div key={`${s.id}-${i}`} style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--color-border)',
            }}>
              {/* Row 1: number + label text + action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', minWidth: 20 }}>{i + 1}.</span>
                <input
                  value={s.label}
                  onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], label: e.target.value }; setSteps(arr) }}
                  style={{ ...inputStyle, padding: '4px 8px', flex: 1 }}
                />
                <button onClick={() => handleMoveStep(i, -1)} disabled={i === 0} style={{
                  background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer',
                  color: i === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 2px', fontFamily: 'inherit',
                }}>&uarr;</button>
                <button onClick={() => handleMoveStep(i, 1)} disabled={i === steps.length - 1} style={{
                  background: 'none', border: 'none', cursor: i === steps.length - 1 ? 'default' : 'pointer',
                  color: i === steps.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 2px', fontFamily: 'inherit',
                }}>&darr;</button>
                <button onClick={() => handleRemoveStep(i)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', padding: '0 2px', fontFamily: 'inherit',
                }}>&times;</button>
              </div>
              {/* Row 2: type selector */}
              <div style={{ marginLeft: 26, marginTop: 4 }}>
                <select
                  value={s.type}
                  onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], type: e.target.value }; setSteps(arr) }}
                  style={{ ...inputStyle, padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 'auto' }}
                >
                  {STEP_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {addingStep && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                value={newStepLabel}
                onChange={e => setNewStepLabel(e.target.value)}
                placeholder="New step text"
                onKeyDown={e => { if (e.key === 'Enter') handleAddStep() }}
                style={{ ...inputStyle, flex: 1, padding: '4px 8px', minWidth: 150 }}
                autoFocus
              />
              <select
                value={newStepType}
                onChange={e => setNewStepType(e.target.value)}
                style={{ ...inputStyle, padding: '3px 4px', fontSize: 'var(--fs-xs)', minWidth: 90 }}
              >
                {STEP_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button onClick={handleAddStep} disabled={!newStepLabel.trim()} style={{
                background: newStepLabel.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
                color: newStepLabel.trim() ? '#000' : 'var(--color-text-3)',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px',
                fontWeight: 700, fontSize: 'var(--fs-xs)', cursor: newStepLabel.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>Add</button>
              <button onClick={() => { setAddingStep(false); setNewStepLabel(''); setNewStepType('checkbox') }} style={{
                background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                padding: '4px 10px', color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '10px 0', borderRadius: 'var(--radius-base)', border: 'none',
            background: 'var(--color-cyan)', color: '#fff', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Lighting Systems Tab — define systems + clone from DAFMAN templates
// ═══════════════════════════════════════════════════════════════

function LightingSystemsTab({ installationId }: { installationId: string | null }) {
  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [compsMap, setCompsMap] = useState<Record<string, LightingSystemComponent[]>>({})
  const [loadingComps, setLoadingComps] = useState<Record<string, boolean>>({})

  // New system form
  const [newSystemType, setNewSystemType] = useState('')
  const [newName, setNewName] = useState('')
  const [newRunwayOrTaxiway, setNewRunwayOrTaxiway] = useState('')
  const [newIsPrecision, setNewIsPrecision] = useState(false)

  // Clone from templates
  const [cloning, setCloning] = useState<string | null>(null)
  const [templatesList, setTemplatesList] = useState<OutageRuleTemplate[]>([])

  // Live feature counts per component (from infrastructure_features)
  const [compFeatureCounts, setCompFeatureCounts] = useState<Record<string, number>>({})

  // Edit system name
  const [editingSystemName, setEditingSystemName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const handleSaveSystemName = async (sysId: string) => {
    const trimmed = editNameValue.trim()
    if (!trimmed) return
    const ok = await updateLightingSystem(sysId, { name: trimmed })
    if (ok) {
      setSystems(prev => prev.map(s => s.id === sysId ? { ...s, name: trimmed } : s))
      toast.success('System name updated')
    } else {
      toast.error('Failed to update name')
    }
    setEditingSystemName(null)
  }

  // Edit runway/taxiway
  const [editingRunway, setEditingRunway] = useState<string | null>(null)
  const [editRunwayValue, setEditRunwayValue] = useState('')
  const handleSaveRunway = async (sysId: string) => {
    const trimmed = editRunwayValue.trim().toUpperCase()
    const ok = await updateLightingSystem(sysId, { runway_or_taxiway: trimmed || null })
    if (ok) {
      setSystems(prev => prev.map(s => s.id === sysId ? { ...s, runway_or_taxiway: trimmed || null } : s))
      toast.success(trimmed ? 'Runway/Taxiway updated' : 'Runway/Taxiway cleared')
    } else {
      toast.error('Failed to update')
    }
    setEditingRunway(null)
  }

  const [assigning, setAssigning] = useState(false)

  const loadSystems = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchLightingSystems(installationId)
    setSystems(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadSystems() }, [loadSystems])

  const handleUnlinkAll = async (compId: string, compLabel: string, systemId: string) => {
    if (!installationId) return
    if (!confirm(`Unlink all features from "${compLabel}"? Features will not be deleted.`)) return
    setAssigning(true)
    const supabase = createClient()
    if (supabase) {
      const { data: linked } = await supabase
        .from('infrastructure_features')
        .select('id')
        .eq('system_component_id', compId)
      if (linked && linked.length > 0) {
        const ids = linked.map((f: any) => f.id)
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200)
          await supabase
            .from('infrastructure_features')
            .update({ system_component_id: null, updated_at: new Date().toISOString() } as any)
            .in('id', batch)
        }
        toast.success(`Unlinked ${linked.length} feature(s) from "${compLabel}"`)
        await loadComps(systemId)
      } else {
        toast('No features linked to this component')
      }
    }
    setAssigning(false)
  }

  const loadComps = async (systemId: string) => {
    setLoadingComps((prev) => ({ ...prev, [systemId]: true }))
    const result = await fetchLightingSystemWithComponents(systemId)
    if (result) {
      setCompsMap((prev) => ({ ...prev, [systemId]: result.components }))
      // Fetch live feature counts for each component
      const supabase = createClient()
      if (supabase) {
        const compIds = result.components.map(c => c.id)
        if (compIds.length > 0) {
          const { data: features } = await supabase
            .from('infrastructure_features')
            .select('system_component_id')
            .in('system_component_id', compIds)
          if (features) {
            const counts: Record<string, number> = {}
            for (const f of features) {
              if (f.system_component_id) {
                counts[f.system_component_id] = (counts[f.system_component_id] || 0) + 1
              }
            }
            setCompFeatureCounts(prev => ({ ...prev, ...Object.fromEntries(compIds.map(id => [id, counts[id] || 0])) }))
          }
        }
      }
    }
    setLoadingComps((prev) => ({ ...prev, [systemId]: false }))
  }

  const handleExpand = (systemId: string) => {
    if (expanded === systemId) { setExpanded(null); return }
    setExpanded(systemId)
    if (!compsMap[systemId]) loadComps(systemId)
  }

  const handleAddSystem = async () => {
    if (!installationId || !newSystemType || !newName.trim()) return
    setSaving(true)
    const result = await createLightingSystem({
      base_id: installationId, system_type: newSystemType, name: newName.trim(),
      runway_or_taxiway: newRunwayOrTaxiway.trim() || undefined, is_precision: newIsPrecision,
    })
    if (result) {
      toast.success(`Created "${result.name}"`)
      setSystems((prev) => [...prev, result])
      setNewSystemType(''); setNewName(''); setNewRunwayOrTaxiway(''); setNewIsPrecision(false); setAdding(false)
    } else { toast.error('Failed to create system') }
    setSaving(false)
  }

  const handleDeleteSystem = async (sys: LightingSystem) => {
    if (!confirm(`Delete "${sys.name}" and all its components?`)) return
    if (await deleteLightingSystem(sys.id)) {
      toast.success(`Deleted "${sys.name}"`)
      setSystems((prev) => prev.filter((s) => s.id !== sys.id))
      if (expanded === sys.id) setExpanded(null)
    } else { toast.error('Failed to delete system') }
  }

  const handleStartClone = async (systemId: string, systemType: string) => {
    setCloning(systemId)
    const t = await fetchOutageRuleTemplates(systemType)
    setTemplatesList(t)
  }

  const handleClone = async () => {
    if (!cloning) return
    setSaving(true)
    const sys = systems.find((s) => s.id === cloning)
    const created = await cloneComponentsFromTemplates(cloning, sys?.system_type || '', {})
    if (created.length > 0) {
      toast.success(`Cloned ${created.length} component(s)`)
      setCompsMap((prev) => ({ ...prev, [cloning]: [...(prev[cloning] || []), ...created] }))
    } else { toast.error('No components cloned') }
    setCloning(null); setTemplatesList([]); setSaving(false)
  }

  const handleDeleteComp = async (compId: string, systemId: string) => {
    if (!confirm('Delete this component?')) return
    if (await deleteSystemComponent(compId)) {
      toast.success('Component deleted')
      setCompsMap((prev) => ({ ...prev, [systemId]: (prev[systemId] || []).filter((c) => c.id !== compId) }))
    }
  }


  useEffect(() => {
    if (newSystemType && !newName) {
      const label = SYSTEM_TYPE_LABELS[newSystemType] || newSystemType
      setNewName(newRunwayOrTaxiway ? `${label} ${newRunwayOrTaxiway}` : label)
    }
  }, [newSystemType, newRunwayOrTaxiway])

  if (loading) return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading lighting systems...</p>

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
        Lighting Systems
      </h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Define lighting systems per DAFMAN 13-204v2. Each runway/taxiway is its own system instance.
        Components are cloned from DAFMAN Table A3.1 templates with your installation&apos;s actual light counts.
      </p>

      {systems.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>No lighting systems configured.</p>
      )}

      {systems.map((sys) => {
        const isExp = expanded === sys.id
        const comps = compsMap[sys.id] || []
        const isLoadingC = loadingComps[sys.id]
        return (
          <div key={sys.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', marginBottom: 8, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: isExp ? 'rgba(56,189,248,0.06)' : 'transparent', cursor: 'pointer' }}
              onClick={() => handleExpand(sys.id)}
            >
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>{'\u25BC'}</span>
              {editingSystemName === sys.id ? (
                <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <input
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveSystemName(sys.id); if (e.key === 'Escape') setEditingSystemName(null) }}
                    autoFocus
                    style={{ flex: 1, padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontWeight: 600, fontFamily: 'inherit' }}
                  />
                  <button onClick={() => handleSaveSystemName(sys.id)} style={{ background: 'var(--color-cyan)', border: 'none', color: '#fff', padding: '3px 8px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Save</button>
                  <button onClick={() => setEditingSystemName(null)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', padding: '3px 6px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              ) : (
                <span
                  style={{ flex: 1, fontWeight: 600, color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', cursor: 'text' }}
                  onClick={e => { e.stopPropagation(); setEditingSystemName(sys.id); setEditNameValue(sys.name) }}
                  title="Click to rename"
                >{sys.name}</span>
              )}
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', background: 'var(--color-bg-inset)', padding: '2px 8px', borderRadius: 'var(--radius-xs)' }}>
                {SYSTEM_TYPE_LABELS[sys.system_type] || sys.system_type}
              </span>
              {sys.is_precision && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 'var(--radius-xs)' }}>PRECISION</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleDeleteSystem(sys) }} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xl)', padding: '0 4px' }}>&times;</button>
            </div>

            {isExp && (
              <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
                {/* Runway/Taxiway field */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
                  <span style={{ color: 'var(--color-text-3)', minWidth: 100 }}>Runway/Taxiway:</span>
                  {editingRunway === sys.id ? (
                    <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        value={editRunwayValue}
                        onChange={e => setEditRunwayValue(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveRunway(sys.id); if (e.key === 'Escape') setEditingRunway(null) }}
                        placeholder="e.g. RWY 01/19, TWY A"
                        autoFocus
                        style={{ flex: 1, padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}
                      />
                      <button onClick={() => handleSaveRunway(sys.id)} style={{ background: 'var(--color-cyan)', border: 'none', color: '#fff', padding: '3px 8px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Save</button>
                      <button onClick={() => setEditingRunway(null)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', padding: '3px 6px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>Cancel</button>
                    </div>
                  ) : (
                    <span
                      style={{ flex: 1, color: sys.runway_or_taxiway ? 'var(--color-text-1)' : 'var(--color-text-3)', cursor: 'pointer' }}
                      onClick={() => { setEditingRunway(sys.id); setEditRunwayValue(sys.runway_or_taxiway || '') }}
                      title="Click to edit"
                    >
                      {sys.runway_or_taxiway || 'Not set — click to assign'}
                    </span>
                  )}
                </div>
                {isLoadingC ? (
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>Loading components...</p>
                ) : (
                  <>
                    {comps.length === 0 && <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>No components. Clone from DAFMAN templates to get started.</p>}
                    {comps.map((comp) => (
                      <div key={comp.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
                          <span style={{ flex: 1, color: 'var(--color-text-1)' }}>{comp.label}</span>
                          <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontVariantNumeric: 'tabular-nums' }}>
                            {compFeatureCounts[comp.id] || 0} lights
                          </span>
                          {(compFeatureCounts[comp.id] || 0) > 0 && (
                            <button onClick={() => handleUnlinkAll(comp.id, comp.label, sys.id)}
                              disabled={assigning}
                              style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', opacity: assigning ? 0.5 : 1 }}
                              title="Unlink all features from this component">
                              Unlink
                            </button>
                          )}
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 60 }}>
                            {comp.is_zero_tolerance ? 'None' : comp.allowable_outage_pct != null ? `${comp.allowable_outage_pct}%` : comp.allowable_outage_count != null ? `${comp.allowable_outage_count} max` : '—'}
                          </span>
                          <button onClick={() => handleDeleteComp(comp.id, sys.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-lg)', padding: '0 2px' }}>&times;</button>
                        </div>
                      </div>
                    ))}

                    {cloning === sys.id ? (
                      <div style={{ marginTop: 8, padding: 10, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-base)' }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', marginBottom: 8 }}>
                          Clone from DAFMAN Table A3.1 &mdash; {SYSTEM_TYPE_LABELS[sys.system_type] || sys.system_type}
                        </div>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>Components will be created with DAFMAN outage thresholds. Light counts auto-populate from assigned features.</p>
                        {templatesList.map((t) => (
                          <div key={t.component_type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 'var(--fs-sm)' }}>
                            <span style={{ flex: 1, color: 'var(--color-text-2)' }}>{t.label}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 50 }}>
                              {t.is_zero_tolerance ? 'None' : t.allowable_outage_pct != null ? `${t.allowable_outage_pct}%` : `${t.allowable_outage_count} max`}
                            </span>
                          </div>
                        ))}
                        {templatesList.length === 0 && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>No templates found for this system type.</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={handleClone} disabled={saving || templatesList.length === 0}
                            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
                            {saving ? 'Cloning...' : 'Clone Components'}
                          </button>
                          <button onClick={() => { setCloning(null); setTemplatesList([]) }}
                            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleStartClone(sys.id, sys.system_type)}
                        style={{ marginTop: 8, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Clone from DAFMAN Templates
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={{ marginTop: 8, padding: 12, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-base)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', marginBottom: 8 }}>New Lighting System</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>System Type</label>
              <select value={newSystemType} onChange={(e) => { setNewSystemType(e.target.value); setNewName('') }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontFamily: 'inherit' }}>
                <option value="">Select type...</option>
                {SYSTEM_TYPES.map((t) => <option key={t} value={t}>{SYSTEM_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Runway/Taxiway</label>
              <input value={newRunwayOrTaxiway} onChange={(e) => { setNewRunwayOrTaxiway(e.target.value.toUpperCase()); setNewName('') }} placeholder="e.g. RWY 01/19, TWY A"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>System Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. ALSF-1 RWY 19"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-1)', color: 'var(--color-text-1)', fontSize: 'var(--fs-md)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="is-precision-new" checked={newIsPrecision} onChange={(e) => setNewIsPrecision(e.target.checked)} />
              <label htmlFor="is-precision-new" style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Precision approach (affects threshold light allowable: 10% vs 25%)</label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={handleAddSystem} disabled={saving || !newSystemType || !newName.trim()}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !newSystemType || !newName.trim() ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create System'}
              </button>
              <button onClick={() => { setAdding(false); setNewSystemType(''); setNewName(''); setNewRunwayOrTaxiway(''); setNewIsPrecision(false) }}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ marginTop: 8, width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-base)', border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Lighting System
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Wildlife Species Tab — searchable species picker for base config
// ═══════════════════════════════════════════════════════════════

function WildlifeSpeciesTab({ installationId }: { installationId: string | null }) {
  const [baseSpecies, setBaseSpecies] = useState<BaseWildlifeSpeciesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [adding, setAdding] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const GROUPS = [
    { key: 'all', label: 'All' },
    { key: 'bird', label: 'Birds' },
    { key: 'mammal', label: 'Mammals' },
    { key: 'reptile', label: 'Reptiles' },
    { key: 'bat', label: 'Bats' },
  ] as const

  const SIZE_ORDER: Record<string, number> = { large: 0, medium: 1, small: 2 }
  const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  const loadSpecies = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchBaseSpecies(installationId)
    setBaseSpecies(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadSpecies() }, [loadSpecies])

  const baseSpeciesNames = useMemo(() => new Set(baseSpecies.map(s => s.species_common)), [baseSpecies])
  const favoriteNames = useMemo(() => new Set(baseSpecies.filter(s => s.is_favorite).map(s => s.species_common)), [baseSpecies])

  const filtered = useMemo(() => {
    let list = WILDLIFE_SPECIES as WildlifeSpecies[]
    if (activeGroup !== 'all') {
      list = list.filter(s => s.group === activeGroup)
    }
    if (search.length > 0) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.common_name.toLowerCase().includes(q) ||
        s.scientific_name.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      // Base species first
      const aInBase = baseSpeciesNames.has(a.common_name) ? 0 : 1
      const bInBase = baseSpeciesNames.has(b.common_name) ? 0 : 1
      if (aInBase !== bInBase) return aInBase - bInBase
      // Favorites before non-favorites (within base species)
      if (aInBase === 0 && bInBase === 0) {
        const aFav = favoriteNames.has(a.common_name) ? 0 : 1
        const bFav = favoriteNames.has(b.common_name) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav
      }
      const riskDiff = RISK_ORDER[a.strike_risk] - RISK_ORDER[b.strike_risk]
      if (riskDiff !== 0) return riskDiff
      const sizeDiff = SIZE_ORDER[a.size_category] - SIZE_ORDER[b.size_category]
      if (sizeDiff !== 0) return sizeDiff
      return a.common_name.localeCompare(b.common_name)
    })
  }, [search, activeGroup, baseSpeciesNames, favoriteNames])

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: WILDLIFE_SPECIES.length }
    for (const sp of WILDLIFE_SPECIES) {
      counts[sp.group] = (counts[sp.group] || 0) + 1
    }
    return counts
  }, [])

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'var(--color-danger)'
      case 'high': return 'var(--color-orange)'
      case 'medium': return 'var(--color-warning)'
      default: return 'var(--color-success)'
    }
  }

  async function toggleSpecies(sp: WildlifeSpecies) {
    if (!installationId) return
    setAdding(sp.common_name)
    if (baseSpeciesNames.has(sp.common_name)) {
      const { error } = await removeBaseSpeciesByName(installationId, sp.common_name)
      if (error) toast.error(error)
      else toast.success(`Removed ${sp.common_name}`)
    } else {
      const { error } = await addBaseSpecies(installationId, sp.common_name)
      if (error) toast.error(error)
      else toast.success(`Added ${sp.common_name}`)
    }
    await loadSpecies()
    setAdding(null)
  }

  async function toggleFav(e: React.MouseEvent, sp: WildlifeSpecies) {
    e.stopPropagation()
    if (!installationId) return
    const newVal = !favoriteNames.has(sp.common_name)
    setAdding(sp.common_name)
    const { error } = await toggleFavoriteSpecies(installationId, sp.common_name, newVal)
    if (error) toast.error(error)
    else toast.success(newVal ? `Favorited ${sp.common_name}` : `Unfavorited ${sp.common_name}`)
    await loadSpecies()
    setAdding(null)
  }

  async function addAllFiltered() {
    if (!installationId) return
    const names = filtered.filter(sp => !baseSpeciesNames.has(sp.common_name)).map(sp => sp.common_name)
    if (names.length === 0) { toast.info('All filtered species already added'); return }
    setAdding('bulk')
    const { error } = await addBaseSpeciesBulk(installationId, names)
    if (error) toast.error(error)
    else toast.success(`Added ${names.length} species`)
    await loadSpecies()
    setAdding(null)
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--color-text-3)' }}>Loading species...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800 }}>Wildlife Species</h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            {baseSpecies.length} species configured — tap to add/remove from your base&apos;s wildlife forms
          </p>
        </div>
        <button
          onClick={addAllFiltered}
          disabled={adding === 'bulk'}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)', color: 'var(--color-text-2)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {adding === 'bulk' ? 'Adding...' : 'Add All Visible'}
        </button>
      </div>

      {/* Search + Group tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by name or scientific name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px', minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius-base)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)', color: 'var(--color-text)',
            fontSize: 'var(--fs-base)',
          }}
        />
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
          {GROUPS.map(g => (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap',
                background: activeGroup === g.key ? 'var(--color-cyan)' : 'var(--color-bg-surface)',
                color: activeGroup === g.key ? '#000' : 'var(--color-text-2)',
              }}
            >
              {g.label} ({groupCounts[g.key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Results count + legend */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
      }}>
        <span>{filtered.length} species {search && `matching "${search}"`}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} /> Critical
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-orange)', display: 'inline-block' }} /> High
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)', display: 'inline-block' }} /> Med
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} /> Low
          </span>
        </div>
      </div>

      {/* Species grid */}
      <style>{`
        .base-species-grid {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, 1fr);
          align-content: start;
        }
        @media (min-width: 600px) {
          .base-species-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .base-species-card:hover {
          border-color: var(--color-cyan) !important;
        }
      `}</style>
      <div className="base-species-grid" style={{ maxHeight: 500, overflowY: 'auto' }}>
        {filtered.map(sp => {
          const inBase = baseSpeciesNames.has(sp.common_name)
          const isAdding = adding === sp.common_name
          return (
            <button
              key={sp.common_name}
              className="base-species-card"
              onClick={() => toggleSpecies(sp)}
              disabled={isAdding}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 6, borderRadius: 'var(--radius-lg)',
                border: inBase ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
                background: inBase ? 'rgba(16,185,129,0.08)' : 'var(--color-bg-surface)',
                cursor: isAdding ? 'wait' : 'pointer',
                textAlign: 'center', color: 'var(--color-text)',
                transition: 'border-color 0.15s',
                opacity: isAdding ? 0.5 : 1,
                position: 'relative',
              }}
            >
              {inBase && (
                <div style={{
                  position: 'absolute', top: 4, left: 4, width: 20, height: 20,
                  borderRadius: '50%', background: 'var(--color-success)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff', fontWeight: 700, zIndex: 1,
                }}>&#10003;</div>
              )}
              {inBase && (
                <div
                  onClick={(e) => toggleFav(e, sp)}
                  style={{
                    position: 'absolute', top: 3, right: 3, zIndex: 2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, lineHeight: 1, cursor: 'pointer',
                    color: favoriteNames.has(sp.common_name) ? 'var(--color-warning)' : 'rgba(255,255,255,0.5)',
                  }}
                  title={favoriteNames.has(sp.common_name) ? 'Remove from favorites' : 'Add to favorites'}
                >&#9733;</div>
              )}
              <div style={{
                width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-base)', overflow: 'hidden',
                background: 'var(--color-bg)', marginBottom: 4, position: 'relative',
              }}>
                <img
                  src={resolveWildlifeImage(sp)!}
                  alt={sp.common_name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => {
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    const parent = img.parentElement
                    if (parent && !parent.querySelector('.fallback-icon')) {
                      const div = document.createElement('div')
                      div.className = 'fallback-icon'
                      div.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;color:var(--color-text-4);'
                      div.textContent = sp.group === 'bird' ? '\uD83E\uDD85' : sp.group === 'mammal' ? '\uD83E\uDD8C' : sp.group === 'bat' ? '\uD83E\uDD87' : '\uD83E\uDD8E'
                      parent.appendChild(div)
                    }
                  }}
                />
                <div style={{
                  position: 'absolute', top: 3, right: 3, width: 10, height: 10,
                  borderRadius: '50%', background: riskColor(sp.strike_risk),
                  border: '1.5px solid var(--color-bg-surface)',
                }} />
              </div>
              <div style={{
                fontWeight: 700, fontSize: 'var(--fs-xs)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                minHeight: '2.4em', width: '100%',
              }}>
                {sp.common_name}
              </div>
              <div style={{
                fontSize: '9px', color: 'var(--color-text-4)', fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%',
              }}>
                {sp.scientific_name}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
            No species found matching &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status Boards Tab ──
function StatusBoardsTab({ installationId }: { installationId: string | null }) {
  const [boards, setBoards] = useState<CustomStatusBoard[]>([])
  const [itemsByBoard, setItemsByBoard] = useState<Record<string, CustomStatusItem[]>>({})
  const [newBoardName, setNewBoardName] = useState('')
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({})
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingBoardName, setEditingBoardName] = useState('')
  const [newBoardSection, setNewBoardSection] = useState<'runway' | 'navaid' | 'arff' | 'standalone'>('standalone')
  const [loading, setLoading] = useState(true)

  const loadBoards = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchCustomStatusBoards(installationId)
    setBoards(data)
    const itemMap: Record<string, CustomStatusItem[]> = {}
    for (const board of data) {
      itemMap[board.id] = await fetchCustomStatusItems(board.id)
    }
    setItemsByBoard(itemMap)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadBoards() }, [loadBoards])

  const handleAddBoard = async () => {
    if (!installationId || !newBoardName.trim()) return
    const board = await createCustomStatusBoard({
      base_id: installationId,
      board_name: newBoardName.trim(),
      sort_order: boards.length,
      section: newBoardSection,
    })
    if (board) {
      setBoards(prev => [...prev, board])
      setItemsByBoard(prev => ({ ...prev, [board.id]: [] }))
      setNewBoardName('')
      setNewBoardSection('standalone')
      toast.success(`Board "${board.board_name}" created`)
    }
  }

  const handleSectionChange = async (board: CustomStatusBoard, section: 'runway' | 'navaid' | 'arff' | 'standalone') => {
    const updated = await updateCustomStatusBoard(board.id, { section })
    if (updated) {
      setBoards(prev => prev.map(b => b.id === updated.id ? updated : b))
    }
  }

  const handleDeleteBoard = async (board: CustomStatusBoard) => {
    if (!confirm(`Delete "${board.board_name}" and all its items?`)) return
    const ok = await deleteCustomStatusBoard(board.id, board.board_name, installationId || undefined)
    if (ok) {
      setBoards(prev => prev.filter(b => b.id !== board.id))
      setItemsByBoard(prev => { const n = { ...prev }; delete n[board.id]; return n })
      toast.success(`Deleted "${board.board_name}"`)
    }
  }

  const handleRenameBoard = async (board: CustomStatusBoard) => {
    if (!editingBoardName.trim() || editingBoardName.trim() === board.board_name) {
      setEditingBoardId(null)
      return
    }
    const updated = await updateCustomStatusBoard(board.id, { board_name: editingBoardName.trim() })
    if (updated) {
      setBoards(prev => prev.map(b => b.id === updated.id ? updated : b))
      toast.success('Board renamed')
    }
    setEditingBoardId(null)
  }

  const handleAddItem = async (boardId: string) => {
    const name = (newItemNames[boardId] || '').trim()
    if (!installationId || !name) return
    const items = itemsByBoard[boardId] || []
    const item = await createCustomStatusItem({
      board_id: boardId,
      base_id: installationId,
      item_name: name,
      sort_order: items.length,
    })
    if (item) {
      setItemsByBoard(prev => ({ ...prev, [boardId]: [...(prev[boardId] || []), item] }))
      setNewItemNames(prev => ({ ...prev, [boardId]: '' }))
      toast.success(`Added "${item.item_name}"`)
    }
  }

  const handleDeleteItem = async (boardId: string, item: CustomStatusItem) => {
    if (!confirm(`Delete "${item.item_name}"?`)) return
    const ok = await deleteCustomStatusItem(item.id)
    if (ok) {
      setItemsByBoard(prev => ({ ...prev, [boardId]: (prev[boardId] || []).filter(i => i.id !== item.id) }))
      toast.success(`Deleted "${item.item_name}"`)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading status boards...</p>
  }

  const STATUS_DOT: Record<string, string> = {
    green: 'var(--color-success)',
    yellow: 'var(--color-warning)',
    red: 'var(--color-danger)',
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>Custom Status Boards</h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
        Create custom status panels that appear on the Airfield Status page with green/yellow/red toggles.
        Examples: Arresting Systems, Comm Status, ARFF Equipment.
      </p>

      {boards.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>No status boards configured yet.</p>
      )}

      {boards.map(board => {
        const items = itemsByBoard[board.id] || []
        const isEditing = editingBoardId === board.id
        return (
          <div key={board.id} style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
            overflow: 'hidden',
          }}>
            {/* Board header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px',
              background: 'var(--color-bg-inset)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              {isEditing ? (
                <input
                  autoFocus
                  value={editingBoardName}
                  onChange={e => setEditingBoardName(e.target.value)}
                  onBlur={() => handleRenameBoard(board)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard(board); if (e.key === 'Escape') setEditingBoardId(null) }}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-accent)', background: 'var(--color-bg)',
                    color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  }}
                />
              ) : (
                <span
                  onClick={() => { setEditingBoardId(board.id); setEditingBoardName(board.board_name) }}
                  style={{ flex: 1, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', cursor: 'pointer' }}
                  title="Click to rename"
                >
                  {board.board_name}
                </span>
              )}
              <select
                value={board.section || 'standalone'}
                onChange={e => handleSectionChange(board, e.target.value as 'runway' | 'navaid' | 'arff' | 'standalone')}
                style={{
                  padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                }}
                title="Dashboard section"
              >
                <option value="standalone">Standalone</option>
                <option value="runway">Runway</option>
                <option value="navaid">NAVAID</option>
                <option value="arff">ARFF</option>
              </select>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => handleDeleteBoard(board)}
                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-3xl)', padding: '0 4px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Items list */}
            <div style={{ padding: '8px 12px' }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_DOT[item.status] ?? 'var(--color-text-3)',
                    flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', fontWeight: 600 }}>
                    {item.item_name}
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                    ({item.status})
                  </span>
                  <button
                    onClick={() => handleDeleteItem(board.id, item)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-2xl)', padding: '0 4px', lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
              ))}

              {/* Add item input */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={newItemNames[board.id] || ''}
                  onChange={e => setNewItemNames(prev => ({ ...prev, [board.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem(board.id)}
                  placeholder="Add item (e.g., Cable 1, HF Radio)..."
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                  }}
                />
                <button
                  onClick={() => handleAddItem(board.id)}
                  disabled={!(newItemNames[board.id] || '').trim()}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: (newItemNames[board.id] || '').trim() ? 'var(--color-accent)' : 'var(--color-border)',
                    color: (newItemNames[board.id] || '').trim() ? '#fff' : 'var(--color-text-3)',
                    cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add new board */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input
          value={newBoardName}
          onChange={e => setNewBoardName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddBoard()}
          placeholder="New board name (e.g., Arresting Systems, Comm Status)..."
          style={{
            flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <select
          value={newBoardSection}
          onChange={e => setNewBoardSection(e.target.value as any)}
          style={{
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontFamily: 'inherit',
          }}
        >
          <option value="standalone">Standalone Row</option>
          <option value="runway">Runway Section</option>
          <option value="navaid">NAVAID Section</option>
          <option value="arff">ARFF Section</option>
        </select>
        <button
          onClick={handleAddBoard}
          disabled={!newBoardName.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: newBoardName.trim() ? 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))' : 'var(--color-border)',
            color: newBoardName.trim() ? '#fff' : 'var(--color-text-3)',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          Create Board
        </button>
      </div>
    </div>
  )
}

// ── PPR Columns Tab ──
function PprColumnsTab({ installationId }: { installationId: string | null }) {
  const [columns, setColumns] = useState<PprColumn[]>([])
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState<PprColumnType>('text')
  const [newColRequired, setNewColRequired] = useState(false)
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColName, setEditingColName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadColumns = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchPprColumns(installationId)
    setColumns(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadColumns() }, [loadColumns])

  const handleAdd = async () => {
    if (!installationId || !newColName.trim()) return
    const col = await createPprColumn({
      base_id: installationId,
      column_name: newColName.trim(),
      column_type: newColType,
      sort_order: columns.length,
      is_required: newColRequired,
    })
    if (col) {
      setColumns(prev => [...prev, col])
      setNewColName('')
      setNewColType('text')
      setNewColRequired(false)
      toast.success(`Added "${col.column_name}"`)
    }
  }

  const handleDelete = async (col: PprColumn) => {
    if (!confirm(`Delete column "${col.column_name}"? Existing PPR data for this column will no longer display.`)) return
    const ok = await deletePprColumn(col.id)
    if (ok) {
      setColumns(prev => prev.filter(c => c.id !== col.id))
      toast.success(`Deleted "${col.column_name}"`)
    }
  }

  const handleToggleRequired = async (col: PprColumn) => {
    const updated = await updatePprColumn(col.id, { is_required: !col.is_required })
    if (updated) {
      setColumns(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
  }

  const handleChangeType = async (col: PprColumn, newType: PprColumnType) => {
    const updated = await updatePprColumn(col.id, { column_type: newType })
    if (updated) {
      setColumns(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
  }

  const handleRename = async (col: PprColumn) => {
    if (!editingColName.trim() || editingColName.trim() === col.column_name) {
      setEditingColId(null)
      return
    }
    const updated = await updatePprColumn(col.id, { column_name: editingColName.trim() })
    if (updated) {
      setColumns(prev => prev.map(c => c.id === updated.id ? updated : c))
      toast.success('Column renamed')
    }
    setEditingColId(null)
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= columns.length) return
    const a = columns[index]
    const b = columns[swapIdx]
    await Promise.all([
      updatePprColumn(a.id, { sort_order: b.sort_order }),
      updatePprColumn(b.id, { sort_order: a.sort_order }),
    ])
    const updated = [...columns]
    updated[index] = { ...b, sort_order: a.sort_order }
    updated[swapIdx] = { ...a, sort_order: b.sort_order }
    updated.sort((x, y) => x.sort_order - y.sort_order)
    setColumns(updated)
  }

  if (loading) {
    return <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading PPR columns...</p>
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>PPR Columns</h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
        Define the data fields for your PPR table. Common examples: Aircraft Type, Tail #, Unit, POC, Purpose, ETA, ETD, Parking.
        PPR # and Arrival Date are always included automatically.
      </p>

      {columns.length === 0 && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>No columns configured yet.</p>
      )}

      {columns.map((col, i) => (
        <div key={col.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 20, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => handleMove(i, 'up')}
              disabled={i === 0}
              style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--color-border)' : 'var(--color-text-3)', fontSize: 12, padding: 0, lineHeight: 1 }}
              title="Move up"
            >&uarr;</button>
            <button
              onClick={() => handleMove(i, 'down')}
              disabled={i === columns.length - 1}
              style={{ background: 'none', border: 'none', cursor: i === columns.length - 1 ? 'default' : 'pointer', color: i === columns.length - 1 ? 'var(--color-border)' : 'var(--color-text-3)', fontSize: 12, padding: 0, lineHeight: 1 }}
              title="Move down"
            >&darr;</button>
          </div>
          {editingColId === col.id ? (
            <input
              autoFocus
              value={editingColName}
              onChange={e => setEditingColName(e.target.value)}
              onBlur={() => handleRename(col)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(col); if (e.key === 'Escape') setEditingColId(null) }}
              style={{
                flex: 1, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-accent)', background: 'var(--color-bg)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontWeight: 600,
              }}
            />
          ) : (
            <span
              onClick={() => { setEditingColId(col.id); setEditingColName(col.column_name) }}
              title="Click to rename"
              style={{ flex: 1, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', fontWeight: 600, cursor: 'pointer' }}
            >{col.column_name}</span>
          )}
          <select
            value={col.column_type || 'text'}
            onChange={e => handleChangeType(col, e.target.value as PprColumnType)}
            style={{
              padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text-2)', cursor: 'pointer',
            }}
          >
            {PPR_COLUMN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={() => handleToggleRequired(col)}
            style={{
              padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              border: `1px solid ${col.is_required ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: col.is_required ? 'rgba(56,189,248,0.08)' : 'transparent',
              color: col.is_required ? 'var(--color-accent)' : 'var(--color-text-3)',
              cursor: 'pointer',
            }}
          >
            {col.is_required ? 'Required' : 'Optional'}
          </button>
          <button
            onClick={() => handleDelete(col)}
            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-2xl)', padding: '0 4px', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      ))}

      {/* Add column */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={newColName}
          onChange={e => setNewColName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Column name (e.g., Aircraft Type, Tail #)..."
          style={{
            flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
          }}
        />
        <select
          value={newColType}
          onChange={e => setNewColType(e.target.value as PprColumnType)}
          style={{
            padding: '8px 8px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', cursor: 'pointer',
          }}
        >
          {PPR_COLUMN_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={newColRequired} onChange={e => setNewColRequired(e.target.checked)} />
          Required
        </label>
        <button
          onClick={handleAdd}
          disabled={!newColName.trim()}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: newColName.trim() ? 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))' : 'var(--color-border)',
            color: newColName.trim() ? '#fff' : 'var(--color-text-3)',
            cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
