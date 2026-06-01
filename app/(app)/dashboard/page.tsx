'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { isModuleEnabled, isModuleSetupComplete, MODULES, type ModuleKey } from '@/lib/modules-config'
import { fetchInspections } from '@/lib/supabase/inspections'
import { logManualEntry } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import { formatZuluTime, formatZuluDate, formatZuluDateTime, formatZuluDateShort } from '@/lib/utils'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { subscribeWithErrorHandling } from '@/lib/realtime-subscribe'
import { useDashboard } from '@/lib/dashboard-context'
import { useDesign } from '@/lib/design-context'
import { PageHeader } from '@/components/ui/page-header'
import {
  ShieldAlert, AlertTriangle, HardHat, ListChecks, Zap, Radio,
  ClipboardList, Bird, DoorOpen, AlertOctagon, Moon,
  CheckCircle2, Sunrise, ChevronRight,
} from 'lucide-react'
import { QrcStepToggle, QrcStepStatusPill } from '@/components/ui/qrc-step-toggle'
import { getStepStatus, getAgencyStatus, type QrcStepStatus } from '@/lib/qrc-step-status'

export default function AMDashboardPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail, defaultOooMessage, updateDefaultOooMessage, defaultClosedMessage, updateDefaultClosedMessage, enabledModules, setupProgress } = useInstallation()
  const { design } = useDesign()
  const airportType = currentInstallation?.airport_type ?? null
  const { afmOutOfOffice, afmOooMessage, setAfmOutOfOffice, afmClosed, afmClosedMessage, setAfmClosed } = useDashboard()
  const { has } = usePermissions()
  // Out-of-office + closed-for-day toggles share the airfield_status:write
  // permission (they change the airfield_status row).
  const canToggleOoo = has(PERM.AIRFIELD_STATUS_WRITE)
  const OOO_DEFAULT_MESSAGE = 'Airfield Management is Out of the Office. Contact via cell phone  at (586) 396-4046 or via Tower Net Callsign: Airfield3'
  const CLOSED_DEFAULT_MESSAGE = 'Airfield Management is CLOSED for the day. Runway, RSC, and BWC status will be refreshed during the next opening check.'
  const [showOooDialog, setShowOooDialog] = useState(false)
  const [showOooDeactivateDialog, setShowOooDeactivateDialog] = useState(false)
  const [oooMessage, setOooMessage] = useState(OOO_DEFAULT_MESSAGE)
  const [savingOooDefault, setSavingOooDefault] = useState(false)
  const [showClosedDialog, setShowClosedDialog] = useState(false)
  const [showClosedDeactivateDialog, setShowClosedDeactivateDialog] = useState(false)
  const [closedMessage, setClosedMessage] = useState(CLOSED_DEFAULT_MESSAGE)
  const [savingClosedDefault, setSavingClosedDefault] = useState(false)
  const baseTimezone = currentInstallation?.timezone || 'America/New_York'
  const baseResetTime = (currentInstallation as Record<string, any>)?.checklist_reset_time || '06:00'
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [showShiftChecklist, setShowShiftChecklist] = useState(false)
  const [showQrc, setShowQrc] = useState(false)
  const [lastCheckType, setLastCheckType] = useState<string | null>(null)
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null)

  // Daily review bars (shift review, pending reviews) moved to /activity.

  // ── Today's inspection status ──
  const [todayAirfieldStatus, setTodayAirfieldStatus] = useState<{ status: 'none' | 'in_progress' | 'completed'; inspector?: string }>({ status: 'none' })
  const [todayLightingStatus, setTodayLightingStatus] = useState<{ status: 'none' | 'in_progress' | 'completed'; inspector?: string }>({ status: 'none' })

  // (Lighting health summary used to render here but the surface was
  // dead — the only operational view of system health lives at
  // /infrastructure. Removed 2026-04-29.)

  // --- Load Last Check Completed ---
  const loadLastCheck = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return
    let query = supabase
      .from('airfield_checks')
      .select('check_type, completed_at')
      .order('completed_at', { ascending: false })
      .limit(1)
    if (installationId) query = query.eq('base_id', installationId)
    const { data } = await query
    const rawType = data?.[0]?.check_type || null
    setLastCheckType(rawType ? (CHECK_TYPE_CONFIG[rawType as keyof typeof CHECK_TYPE_CONFIG]?.label?.toUpperCase() || rawType.replace(/_/g, ' ').toUpperCase()) : null)
    setLastCheckTime(data?.[0]?.completed_at
      ? formatZuluTime(new Date(data[0].completed_at)) + 'Z'
      : null)
  }, [installationId])

  useEffect(() => { loadLastCheck() }, [loadLastCheck])

  // --- Load Today's Inspection Status (0600L reset) ---
  useEffect(() => {
    if (!installationId) return
    const tz = currentInstallation?.timezone || 'America/New_York'
    const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    if (localNow.getHours() < 6) localNow.setDate(localNow.getDate() - 1)
    const todayStr = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`

    fetchInspections(installationId).then((inspections) => {
      const todayAF = inspections.find(i => i.inspection_type === 'airfield' && i.inspection_date === todayStr)
      const todayLT = inspections.find(i => i.inspection_type === 'lighting' && i.inspection_date === todayStr)
      setTodayAirfieldStatus(todayAF
        ? { status: todayAF.status as 'in_progress' | 'completed', inspector: todayAF.inspector_name || undefined }
        : { status: 'none' })
      setTodayLightingStatus(todayLT
        ? { status: todayLT.status as 'in_progress' | 'completed', inspector: todayLT.inspector_name || undefined }
        : { status: 'none' })
    })
  }, [installationId, currentInstallation?.timezone])

  // Realtime: refresh "last check" tile when a new check lands
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return

    const channel = supabase
      .channel(`am_dashboard_last_check:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'airfield_checks', filter: `base_id=eq.${installationId}` },
        () => { loadLastCheck() }
      )
    subscribeWithErrorHandling(channel)

    return () => { supabase.removeChannel(channel) }
  }, [installationId, loadLastCheck])

  return (
    <div className="page-container" data-tour="dashboard-header">
      {/* ===== Dashboard Header ===== */}
      {design === 'v2' ? (
        <PageHeader
          eyebrow="Operations"
          title="Dashboard"
          actions={
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>Last Check</div>
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                fontFamily: 'var(--font-family-mono)', letterSpacing: '0.02em',
                color: lastCheckType && lastCheckTime ? 'var(--color-accent)' : 'var(--color-text-3)',
              }}>
                {lastCheckType && lastCheckTime ? `${lastCheckType} @ ${lastCheckTime}` : '—'}
              </div>
            </div>
          }
        />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
          marginBottom: 10, paddingBottom: 6,
          borderBottom: '1px solid var(--color-border-active)',
        }}>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Dashboard</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Last Check</span>
            <span style={{
              fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'var(--font-family-mono)',
              letterSpacing: '0.04em',
              color: lastCheckType && lastCheckTime ? 'var(--color-accent)' : 'var(--color-text-3)',
            }}>{lastCheckType && lastCheckTime ? `${lastCheckType} @ ${lastCheckTime}` : '—'}</span>
          </div>
        </div>
      )}

      {/* ===== Inspection Status Strip ===== */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/inspections" style={{
          flex: '1 1 200px', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 'var(--radius-md)', textDecoration: 'none',
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderLeft: todayAirfieldStatus.status === 'completed' ? '3px solid var(--color-status-pass)'
            : todayAirfieldStatus.status === 'in_progress' ? '3px solid var(--color-status-inwork)'
            : '3px solid var(--color-text-4)',
        }}>
          {(() => {
            const s = todayAirfieldStatus.status
            const color = s === 'completed' ? 'var(--color-status-pass)'
              : s === 'in_progress' ? 'var(--color-status-inwork)'
              : 'var(--color-text-3)'
            const Icon = s === 'completed' ? CheckCircle2 : s === 'in_progress' ? ClipboardList : Sunrise
            return <Icon size={20} color={color} strokeWidth={2.25} />
          })()}
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Airfield Inspection</div>
            <div style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 800, letterSpacing: '0.04em',
              color: todayAirfieldStatus.status === 'completed' ? 'var(--color-status-pass)'
                : todayAirfieldStatus.status === 'in_progress' ? 'var(--color-status-inwork)'
                : 'var(--color-text-3)',
            }}>
              {todayAirfieldStatus.status === 'completed' ? 'Complete' : todayAirfieldStatus.status === 'in_progress' ? `In Progress${todayAirfieldStatus.inspector ? ` — ${todayAirfieldStatus.inspector}` : ''}` : 'Not Started'}
            </div>
          </div>
        </Link>
        <Link href="/inspections" style={{
          flex: '1 1 200px', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 'var(--radius-md)', textDecoration: 'none',
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderLeft: todayLightingStatus.status === 'completed' ? '3px solid var(--color-status-pass)'
            : todayLightingStatus.status === 'in_progress' ? '3px solid var(--color-status-inwork)'
            : '3px solid var(--color-text-4)',
        }}>
          {(() => {
            const s = todayLightingStatus.status
            const color = s === 'completed' ? 'var(--color-status-pass)'
              : s === 'in_progress' ? 'var(--color-status-inwork)'
              : 'var(--color-text-3)'
            const Icon = s === 'completed' ? CheckCircle2 : s === 'in_progress' ? ClipboardList : Moon
            return <Icon size={20} color={color} strokeWidth={2.25} />
          })()}
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Lighting Inspection</div>
            <div style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 800, letterSpacing: '0.04em',
              color: todayLightingStatus.status === 'completed' ? 'var(--color-status-pass)'
                : todayLightingStatus.status === 'in_progress' ? 'var(--color-status-inwork)'
                : 'var(--color-text-3)',
            }}>
              {todayLightingStatus.status === 'completed' ? 'Complete' : todayLightingStatus.status === 'in_progress' ? `In Progress${todayLightingStatus.inspector ? ` — ${todayLightingStatus.inspector}` : ''}` : 'Not Started'}
            </div>
          </div>
        </Link>
      </div>

      {/* ===== Setup finish banner ===== */}
      {(() => {
        if (!has(PERM.BASE_SETUP_WRITE)) return null
        const incomplete = MODULES.filter(m =>
          (enabledModules as ModuleKey[]).includes(m.key) &&
          m.setupSteps.length > 0 &&
          !isModuleSetupComplete(m.key, setupProgress)
        )
        if (incomplete.length === 0) return null
        const labels = incomplete.slice(0, 3).map(m => m.label).join(', ')
        const extra = incomplete.length > 3 ? ` and ${incomplete.length - 3} more` : ''
        return (
          <Link href="/settings/base-setup" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 12, padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
            color: 'var(--color-text-1)', textDecoration: 'none',
            fontSize: 'var(--fs-sm)',
          }}>
            <span style={{ fontWeight: 800, color: 'var(--color-warning)' }}>Finish base setup</span>
            <ChevronRight size={14} color="var(--color-warning)" strokeWidth={2.5} />
            <span style={{ color: 'var(--color-text-2)' }}>
              Still need to configure: {labels}{extra}.
            </span>
          </Link>
        )
      })()}

      {/* ===== Quick Actions — compact tile grid ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 20,
      }}>
        {/* Primary tier \u2014 daily ops actions. Accent border + elevated
            bg + colored Lucide icon so the eye lands here first. */}
        {([
          { label: 'Airfield Checks', Icon: ShieldAlert,   iconColor: 'var(--color-accent)', href: '/checks' },
          { label: 'New Discrepancy', Icon: AlertTriangle, iconColor: 'var(--color-danger)', href: '/discrepancies/new' },
        ] as const)
          .filter(q => isModuleEnabled(q.href, enabledModules, airportType))
          .map(q => (
          <Link key={q.label} href={q.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-elevated)', border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
            textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <q.Icon size={22} color={q.iconColor} strokeWidth={2.25} />
            <span>{q.label}</span>
          </Link>
        ))}
        {isModuleEnabled('/contractors', enabledModules, airportType) && (
          <button onClick={() => setShowContractorForm(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <HardHat size={22} color="var(--color-warning)" strokeWidth={2.25} />
            <span>Personnel on Airfield</span>
          </button>
        )}
        {isModuleEnabled('/shift-checklist', enabledModules, airportType) && (
          <button onClick={() => setShowShiftChecklist(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <ListChecks size={22} color="var(--color-accent-secondary)" strokeWidth={2.25} />
            <span>Shift Checklist</span>
          </button>
        )}
        {isModuleEnabled('/qrc', enabledModules, airportType) && (
          <button onClick={() => setShowQrc(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <Zap size={22} color="var(--color-warning)" strokeWidth={2.25} />
            <span>QRCs</span>
          </button>
        )}
        {isModuleEnabled('/scn', enabledModules, airportType) && (
          <Link href="/scn" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <Radio size={22} color="var(--color-accent)" strokeWidth={2.25} />
            <span>SCN</span>
          </Link>
        )}
        {isModuleEnabled('/ppr', enabledModules, airportType) && (
          <Link href="/ppr" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <ClipboardList size={22} color="var(--color-accent)" strokeWidth={2.25} />
            <span>PPR Log</span>
          </Link>
        )}
        {isModuleEnabled('/wildlife', enabledModules, airportType) && (
          <Link href="/wildlife" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <Bird size={22} color="var(--color-orange)" strokeWidth={2.25} />
            <span>BASH</span>
          </Link>
        )}
        {canToggleOoo && (
          <button onClick={() => {
            if (afmOutOfOffice) {
              setShowOooDeactivateDialog(true)
            } else {
              setOooMessage(afmOooMessage || defaultOooMessage || OOO_DEFAULT_MESSAGE)
              setShowOooDialog(true)
            }
          }} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: afmOutOfOffice
              ? 'color-mix(in srgb, var(--color-cyan) 10%, transparent)'
              : 'var(--color-bg-surface)',
            border: afmOutOfOffice
              ? '1px solid color-mix(in srgb, var(--color-cyan) 40%, transparent)'
              : '1px solid var(--color-border)',
            borderLeft: afmOutOfOffice ? '2px solid var(--color-cyan)' : '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600,
            color: afmOutOfOffice ? 'var(--color-cyan)' : 'var(--color-text-1)',
            cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            <DoorOpen size={22} color={afmOutOfOffice ? 'var(--color-cyan)' : 'var(--color-text-2)'} strokeWidth={2.25} />
            <span>{afmOutOfOffice ? 'End Out of Office' : 'Out of Office'}</span>
          </button>
        )}
        {canToggleOoo && (
          <button onClick={() => {
            if (afmClosed) {
              setShowClosedDeactivateDialog(true)
            } else {
              setClosedMessage(afmClosedMessage || defaultClosedMessage || CLOSED_DEFAULT_MESSAGE)
              setShowClosedDialog(true)
            }
          }} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
            background: afmClosed
              ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
              : 'var(--color-bg-surface)',
            border: afmClosed
              ? '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)'
              : '1px solid var(--color-border)',
            borderLeft: afmClosed ? '4px solid var(--color-danger)' : '1px solid var(--color-border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600,
            color: afmClosed ? 'var(--color-danger)' : 'var(--color-text-1)',
            cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            {afmClosed
              ? <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
              : <Moon size={22} color="var(--color-text-2)" strokeWidth={2.25} />}
            <span>{afmClosed ? 'Reopen Airfield' : 'Close Airfield'}</span>
          </button>
        )}
      </div>

      {/* Out of Office dialog */}
      {showOooDialog && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOooDialog(false) }} style={{ padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <DoorOpen size={22} color="var(--color-accent)" strokeWidth={2.25} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                Out of Office
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
              This message will display as a full-screen overlay on the Airfield Status page for all users.
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>Display Message</div>
            <textarea
              value={oooMessage}
              onChange={e => setOooMessage(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', minHeight: 60, marginBottom: 8,
              }}
            />
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={async () => {
                  const msg = oooMessage.trim()
                  if (!msg) return
                  setSavingOooDefault(true)
                  try {
                    await updateDefaultOooMessage(msg)
                    toast.success('Default message saved for this base')
                  } catch {
                    toast.error('Could not save default message')
                  } finally {
                    setSavingOooDefault(false)
                  }
                }}
                disabled={savingOooDefault || !oooMessage.trim() || oooMessage.trim() === (defaultOooMessage || '').trim()}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: savingOooDefault ? 'default' : 'pointer',
                  border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  opacity: (!oooMessage.trim() || oooMessage.trim() === (defaultOooMessage || '').trim()) ? 0.5 : 1,
                }}
              >{savingOooDefault ? 'Saving…' : 'Set as Default'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmOutOfOffice(true, oooMessage)
                  await logManualEntry('AMOPS out of office, Command Post notified', installationId)
                  setShowOooDialog(false)
                  toast.success('Out of Office activated')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)',
                }}
              >Activate</button>
              <button
                onClick={() => setShowOooDialog(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Out of Office deactivation dialog */}
      {showOooDeactivateDialog && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOooDeactivateDialog(false) }} style={{ padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <DoorOpen size={22} color="var(--color-accent)" strokeWidth={2.25} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                End Out of Office
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              This will clear the Out of Office overlay and log a Command Post notification in the events log.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmOutOfOffice(false)
                  await logManualEntry('AMOPS back in office, Command Post notified', installationId)
                  setShowOooDeactivateDialog(false)
                  toast.success('Out of Office deactivated')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)',
                }}
              >Deactivate</button>
              <button
                onClick={() => setShowOooDeactivateDialog(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Close for Day dialog ===== */}
      {showClosedDialog && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowClosedDialog(false) }} style={{ padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 460, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                Close Airfield Management
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12, lineHeight: 1.55 }}>
              Displays a CLOSED banner on the Airfield Status page and{' '}
              <strong style={{ color: 'var(--color-text-2)' }}>resets runway status, RSC, RCR, and BWC</strong> so tomorrow&rsquo;s opening check can enter fresh values.
              Historical entries in the Events Log are not affected.
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>Display Message</div>
            <textarea
              value={closedMessage}
              onChange={e => setClosedMessage(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', minHeight: 60, marginBottom: 8,
              }}
            />
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={async () => {
                  const msg = closedMessage.trim()
                  if (!msg) return
                  setSavingClosedDefault(true)
                  try {
                    await updateDefaultClosedMessage(msg)
                    toast.success('Default message saved for this base')
                  } catch {
                    toast.error('Could not save default message')
                  } finally {
                    setSavingClosedDefault(false)
                  }
                }}
                disabled={savingClosedDefault || !closedMessage.trim() || closedMessage.trim() === (defaultClosedMessage || '').trim()}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: savingClosedDefault ? 'default' : 'pointer',
                  border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  opacity: (!closedMessage.trim() || closedMessage.trim() === (defaultClosedMessage || '').trim()) ? 0.5 : 1,
                }}
              >{savingClosedDefault ? 'Saving…' : 'Set as Default'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmClosed(true, closedMessage)
                  await logManualEntry('AMOPS Closed. Command Post notified.', installationId)
                  setShowClosedDialog(false)
                  toast.success('Airfield management closed')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-danger)',
                  background: 'var(--color-danger)', color: '#fff',
                  fontFamily: 'inherit',
                }}
              >Close Airfield</button>
              <button
                onClick={() => setShowClosedDialog(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== End Closed dialog ===== */}
      {showClosedDeactivateDialog && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowClosedDeactivateDialog(false) }} style={{ padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
                End Closed Status
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.55 }}>
              This will clear the CLOSED banner. Runway, RSC, and BWC values remain blank — enter fresh values
              during the opening check.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmClosed(false)
                  await logManualEntry('AMOPS Open. Command Post notified.', installationId)
                  setShowClosedDeactivateDialog(false)
                  toast.success('Closed status ended')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)',
                }}
              >Deactivate</button>
              <button
                onClick={() => setShowClosedDeactivateDialog(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Contractor Form Dialog ===== */}
      {showContractorForm && (
        <PersonnelFormDialog
          installationId={installationId}
          onClose={() => setShowContractorForm(false)}
        />
      )}

      {/* ===== Shift Checklist Dialog ===== */}
      {showShiftChecklist && (
        <ShiftChecklistDialog
          installationId={installationId}
          timezone={baseTimezone}
          resetTime={baseResetTime}
          onClose={() => setShowShiftChecklist(false)}
        />
      )}

      {/* ===== QRC Dialog ===== */}
      {showQrc && (
        <QrcDialog
          installationId={installationId}
          onClose={() => setShowQrc(false)}
        />
      )}

    </div>
  )
}

// --- Contractor Form Dialog ---
function PersonnelFormDialog({ installationId, onClose, onSaved }: { installationId: string | null; onClose: () => void; onSaved?: () => void }) {
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [radioNumber, setRadioNumber] = useState('')
  const [flagNumber, setFlagNumber] = useState('')
  const [callsign, setCallsign] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-base)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
    marginBottom: 4,
  }

  async function handleSubmit() {
    if (!company.trim() || !location.trim() || !description.trim()) {
      toast.error('Company name, location, and work description are required')
      return
    }
    setSaving(true)
    const { createContractor } = await import('@/lib/supabase/contractors')
    const { error } = await createContractor({
      company_name: company.trim(),
      contact_name: contact.trim() || undefined,
      location: location.trim(),
      work_description: description.trim(),
      start_date: startDate,
      notes: notes.trim() || undefined,
      radio_number: radioNumber.trim() || undefined,
      flag_number: flagNumber.trim() || undefined,
      callsign: callsign.trim() || undefined,
      base_id: installationId,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel added')
    onSaved?.()
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 520, padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Add Personnel on Airfield
          </div>
          <Link
            href="/contractors"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}
          >
            View All Personnel →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Company Name *</div>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Kiewit Infrastructure" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Contact Name</div>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Location *</div>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. TWY A/B Intersection" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Start Date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Radio Number</div>
            <input value={radioNumber} onChange={e => setRadioNumber(e.target.value)} placeholder="e.g. R-14" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Flag Number</div>
            <input value={flagNumber} onChange={e => setFlagNumber(e.target.value)} placeholder="e.g. F-3 (if escorting)" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Callsign</div>
            <input value={callsign} onChange={e => setCallsign(e.target.value)} placeholder="e.g. KIEWIT 1" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Work Description *</div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Joint sealing and pavement repair" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
              background: saving ? 'rgba(6,182,212,0.5)' : '#06B6D4',
              color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving...' : 'Add Personnel'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== Shift Checklist Dialog =====

function ShiftChecklistDialog({ installationId, timezone, resetTime, onClose }: { installationId: string | null; timezone: string; resetTime: string; onClose: () => void }) {
  const [items, setItems] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklistItem[]>([])
  const [checklist, setChecklist] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklist | null>(null)
  const [responses, setResponses] = useState<import('@/lib/supabase/shift-checklist').ShiftChecklistResponse[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const {
      fetchChecklistItems,
      fetchOrCreateTodayChecklist,
      fetchResponses,
      itemAppliesToday,
    } = await import('@/lib/supabase/shift-checklist')

    if (!installationId) return
    const [allItems, { checklist: cl }] = await Promise.all([
      fetchChecklistItems(installationId),
      fetchOrCreateTodayChecklist(installationId, timezone, resetTime),
    ])
    const todayItems = allItems.filter(i => itemAppliesToday(i, timezone, resetTime))
    setItems(todayItems)
    setChecklist(cl)

    if (cl) {
      const resp = await fetchResponses(cl.id)
      setResponses(resp)
      const userIds = new Set<string>()
      resp.forEach(r => { if (r.completed_by) userIds.add(r.completed_by) })
      if (cl.completed_by) userIds.add(cl.completed_by)
      if (userIds.size > 0) {
        const supabase = createClient()
        if (supabase) {
          const { data } = await supabase.from('profiles').select('id, name, rank').in('id', Array.from(userIds))
          if (data) {
            const map: Record<string, string> = {}
            data.forEach((p: { id: string; name: string; rank: string | null }) => {
              map[p.id] = p.rank ? `${p.rank} ${p.name}` : p.name
            })
            setProfiles(map)
          }
        }
      }
    }
    setLoaded(true)
  }, [installationId, timezone, resetTime])

  useEffect(() => { load() }, [load])

  const responseMap = new Map(responses.map(r => [r.item_id, r]))
  const dayItems = items.filter(i => i.shift === 'day')
  const midItems = items.filter(i => i.shift === 'mid')
  const swingItems = items.filter(i => i.shift === 'swing')
  const totalCount = items.length
  const doneCount = items.filter(i => {
    const r = responseMap.get(i.id)
    return r?.completed || r?.is_na
  }).length
  const allComplete = totalCount > 0 && doneCount === totalCount
  const isCompleted = checklist?.status === 'completed'

  async function handleToggle(itemId: string) {
    if (!checklist || isCompleted) return
    const resp = responseMap.get(itemId)
    const currentCompleted = resp?.completed ?? false
    const currentNa = resp?.is_na ?? false

    let nextCompleted = false
    let nextNa = false
    if (!currentCompleted && !currentNa) {
      nextCompleted = true
    } else if (currentCompleted && !currentNa) {
      nextNa = true
    }

    setSaving(itemId)
    const { upsertResponse } = await import('@/lib/supabase/shift-checklist')
    const { error } = await upsertResponse({
      checklist_id: checklist.id,
      item_id: itemId,
      completed: nextCompleted,
      is_na: nextNa,
    })
    if (error) toast.error(error)
    else await load()
    setSaving(null)
  }

  async function handleComplete() {
    if (!checklist || !allComplete) return
    if (!confirm('File this checklist as complete for today?')) return
    setCompleting(true)
    const { completeChecklist } = await import('@/lib/supabase/shift-checklist')
    const { error } = await completeChecklist(checklist.id)
    if (error) toast.error(error)
    else { toast.success('Shift checklist filed'); await load() }
    setCompleting(false)
  }

  async function handleReopen() {
    if (!checklist) return
    if (!confirm('Reopen this checklist?')) return
    const { reopenChecklist } = await import('@/lib/supabase/shift-checklist')
    const { error } = await reopenChecklist(checklist.id)
    if (error) toast.error(error)
    else await load()
  }

  const FREQ_COLORS: Record<string, string> = { daily: '#22D3EE', weekly: '#A78BFA', monthly: '#F59E0B' }

  function renderItem(item: import('@/lib/supabase/shift-checklist').ShiftChecklistItem) {
    const resp = responseMap.get(item.id)
    const checked = resp?.completed ?? false
    const isNa = resp?.is_na ?? false
    const isDone = checked || isNa
    const isSaving = saving === item.id

    return (
      <div key={item.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <button
          disabled={isCompleted || isSaving}
          onClick={() => handleToggle(item.id)}
          style={{
            width: 22, height: 22, borderRadius: 'var(--radius-xs)', flexShrink: 0,
            border: isDone ? 'none' : '2px solid var(--color-border-mid)',
            background: checked ? 'var(--color-status-pass)' : isNa ? 'var(--color-text-3)' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>&#10003;</span>}
          {isNa && <span style={{ color: '#fff', fontSize: 8, fontWeight: 800 }}>N/A</span>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-base)', fontWeight: 600,
            color: isDone ? 'var(--color-text-3)' : 'var(--color-text-1)',
            textDecoration: isDone ? 'line-through' : 'none',
            fontStyle: isNa ? 'italic' : 'normal',
          }}>{item.label}</div>
          {isDone && resp?.completed_by && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginTop: 1 }}>
              {profiles[resp.completed_by] || 'Unknown'}{isNa ? ' \u00b7 N/A' : ''}
              {resp.completed_at && ` \u00b7 ${formatZuluTime(new Date(resp.completed_at))}Z`}
            </div>
          )}
        </div>
        {item.frequency !== 'daily' && (
          <span style={{
            fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_COLORS[item.frequency],
            background: `${FREQ_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 'var(--radius-md)',
          }}>{item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}</span>
        )}
      </div>
    )
  }

  function renderSection(label: string, sectionItems: import('@/lib/supabase/shift-checklist').ShiftChecklistItem[]) {
    if (sectionItems.length === 0) return null
    const done = sectionItems.filter(i => { const r = responseMap.get(i.id); return r?.completed || r?.is_na }).length
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: done === sectionItems.length ? 'var(--color-status-pass)' : 'var(--color-text-3)' }}>{done}/{sectionItems.length}</div>
        </div>
        {sectionItems.map(renderItem)}
      </div>
    )
  }

  const today = formatZuluDateShort(new Date())

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>Shift Checklist</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>{today} &middot; {doneCount}/{totalCount} complete</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-md)',
                background: isCompleted ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                color: isCompleted ? 'var(--color-status-pass)' : 'var(--color-bwc-mod)',
              }}>{isCompleted ? 'FILED' : 'IN PROGRESS'}</span>
              <Link href="/shift-checklist" onClick={onClose} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                Full Page →
              </Link>
            </div>
          </div>
          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginTop: 10, height: 4, borderRadius: 'var(--radius-xs)', background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(doneCount / totalCount) * 100}%`, background: allComplete ? 'var(--color-status-pass)' : 'var(--color-cyan)', borderRadius: 'var(--radius-xs)', transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {!loaded ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
          ) : totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              No checklist items configured. Set them up in Settings → Base Configuration.
            </div>
          ) : (
            <>
              {renderSection('Day Shift', dayItems)}
              {renderSection('Swing Shift', swingItems)}
              {midItems.length > 0 && renderSection('Mid Shift', midItems)}
            </>
          )}
        </div>

        {/* Footer */}
        {totalCount > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {isCompleted ? (
              <button onClick={handleReopen} style={{
                width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-mid)', background: 'transparent',
                color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Reopen Checklist</button>
            ) : (
              <button disabled={!allComplete || completing} onClick={handleComplete} style={{
                width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                background: allComplete ? 'var(--color-status-pass)' : 'var(--color-border)',
                color: allComplete ? '#fff' : 'var(--color-text-3)',
                fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: allComplete ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>{completing ? 'Filing...' : allComplete ? 'File Checklist' : `${totalCount - doneCount} items remaining`}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== QRC Dialog =====

function QrcDialog({ installationId, onClose, onActivity }: { installationId: string | null; onClose: () => void; onActivity?: () => void | Promise<void> }) {
  type QrcStep = import('@/lib/supabase/types').QrcStep
  type QrcStepResponse = import('@/lib/supabase/types').QrcStepResponse
  type QrcTemplate = import('@/lib/supabase/types').QrcTemplate
  type QrcExecution = import('@/lib/supabase/types').QrcExecution

  const [templates, setTemplates] = useState<QrcTemplate[]>([])
  const [openExecs, setOpenExecs] = useState<QrcExecution[]>([])
  const [loaded, setLoaded] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [activeExecId, setActiveExecId] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, QrcStepResponse>>({})
  const [scnData, setScnDataLocal] = useState<Record<string, unknown>>({})
  const [closing, setClosing] = useState(false)
  const [closeInitials, setCloseInitials] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const load = useCallback(async () => {
    const { fetchQrcTemplates, fetchOpenExecutions } = await import('@/lib/supabase/qrc')
    const [t, o] = await Promise.all([
      fetchQrcTemplates(installationId),
      fetchOpenExecutions(installationId),
    ])
    setTemplates(t)
    setOpenExecs(o)
    // Don't auto-select — let user pick from the list
    setLoaded(true)
  }, [installationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Sync responses/scn when execution changes
  useEffect(() => {
    const exec = openExecs.find(e => e.id === activeExecId)
    if (exec) {
      setResponses((exec.step_responses || {}) as Record<string, QrcStepResponse>)
      setScnDataLocal((exec.scn_data || {}) as Record<string, unknown>)
    }
  }, [activeExecId, openExecs])

  async function handleStart(tmpl: QrcTemplate) {
    if (!installationId) return
    setStarting(tmpl.id)
    const { startQrcExecution } = await import('@/lib/supabase/qrc')
    const { data, error } = await startQrcExecution({
      base_id: installationId, template_id: tmpl.id,
      qrc_number: tmpl.qrc_number, title: tmpl.title,
    })
    if (error) { toast.error(error); setStarting(null); return }
    if (data) {
      toast.success(`QRC-${tmpl.qrc_number} opened`)
      setActiveExecId(data.id)
      await load()
      await onActivity?.()
    }
    setStarting(null)
  }

  async function handleStepStatus(stepId: string, next: QrcStepStatus) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || ({ completed: false } as QrcStepResponse)
    const newResp: QrcStepResponse = {
      ...current,
      status: next,
      completed: next === 'completed',
      completed_at: next === 'completed' ? new Date().toISOString() : current.completed_at,
    }
    if (next === undefined) delete (newResp as Partial<QrcStepResponse>).status
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleFieldChange(stepId: string, value: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || ({ completed: false } as QrcStepResponse)
    const newResp: QrcStepResponse = {
      ...current, value, completed: !!value,
      status: value ? 'completed' : undefined,
    }
    if (!value) delete (newResp as Partial<QrcStepResponse>).status
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleAgencyStatus(stepId: string, agency: string, next: QrcStepStatus) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || ({ completed: false } as QrcStepResponse)
    const checked = (current.agencies_checked || []).filter(a => a !== agency)
    const na = (current.agencies_na || []).filter(a => a !== agency)
    if (next === 'completed') checked.push(agency)
    else if (next === 'not_applicable') na.push(agency)
    const anyMarked = checked.length + na.length > 0
    const newResp: QrcStepResponse = {
      ...current,
      agencies_checked: checked, agencies_na: na,
      completed: checked.length > 0,
      status: anyMarked && checked.length === 0 && na.length > 0
        ? 'not_applicable'
        : (checked.length > 0 ? 'completed' : undefined),
    }
    if (!anyMarked) delete (newResp as Partial<QrcStepResponse>).status
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleNotes(stepId: string, notes: string) {
    if (!activeExecId) return
    const { updateStepResponse } = await import('@/lib/supabase/qrc')
    const current = responses[stepId] || {}
    const newResp: QrcStepResponse = { ...current, notes }
    setResponses(prev => ({ ...prev, [stepId]: newResp }))
    await updateStepResponse(activeExecId, stepId, newResp)
  }

  async function handleScnField(key: string, value: string) {
    if (!activeExecId) return
    const { updateScnData } = await import('@/lib/supabase/qrc')
    const updated = { ...scnData, [key]: value }
    setScnDataLocal(updated)
    await updateScnData(activeExecId, updated)
  }

  async function handleClose() {
    if (!activeExecId) return
    setClosing(true)
    const { closeQrcExecution } = await import('@/lib/supabase/qrc')
    const exec = openExecs.find(e => e.id === activeExecId)
    const { error } = await closeQrcExecution(activeExecId, closeInitials, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${exec?.qrc_number} closed`)
      setActiveExecId(null)
      setShowCloseConfirm(false)
      setCloseInitials('')
      await load()
      await onActivity?.()
    }
    setClosing(false)
  }

  async function handleCancel() {
    if (!activeExecId) return
    if (!confirm('Cancel this QRC? This will permanently remove all data for this execution.')) return
    const { cancelQrcExecution } = await import('@/lib/supabase/qrc')
    const exec = openExecs.find(e => e.id === activeExecId)
    const { error } = await cancelQrcExecution(activeExecId, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${exec?.qrc_number} cancelled`)
      await onActivity?.()
      onClose()
    }
  }

  function zuluNow(): string {
    return new Date().toISOString().slice(11, 16).replace(':', '')
  }

  const activeExec = openExecs.find(e => e.id === activeExecId)
  const activeTemplate = activeExec ? templates.find(t => t.id === activeExec.template_id) : null
  const steps = (activeTemplate?.steps as unknown as QrcStep[] | null) || []

  function renderStep(step: QrcStep) {
    const resp = responses[step.id]
    const status = getStepStatus(resp)

    if (step.type === 'conditional') {
      return (
        <div key={step.id} style={{
          padding: '8px 10px', marginBottom: 4, fontSize: 'var(--fs-base)',
          fontWeight: 600, color: 'var(--color-warning)', fontStyle: 'italic',
        }}>{step.id}. {step.label}</div>
      )
    }

    const isToggleType = step.type === 'checkbox' || step.type === 'checkbox_with_note'
    const rowBg = status === 'completed'
      ? 'color-mix(in srgb, var(--color-success) 6%, transparent)'
      : status === 'not_applicable'
        ? 'color-mix(in srgb, var(--color-text-3) 5%, transparent)'
        : 'transparent'

    return (
      <div key={step.id} style={{
        padding: '8px 10px', marginBottom: 6, borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: rowBg,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-text-3)', minWidth: 28, paddingTop: 2 }}>{step.id}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isToggleType && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 600, flex: 1, minWidth: 0, paddingTop: 2,
                    color: status === 'completed' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                    textDecoration: status === 'completed' ? 'line-through' : 'none',
                  }}>{step.label}</span>
                  <QrcStepToggle
                    value={status}
                    onChange={next => handleStepStatus(step.id, next)}
                    size="sm"
                  />
                </div>
                {step.note && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                    {step.note}
                  </div>
                )}
              </div>
            )}

            {step.type === 'notify_agencies' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 6 }}>{step.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(step.agencies || []).map(agency => {
                    const agencyStatus = getAgencyStatus(resp, agency)
                    return (
                      <div key={agency} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: 'var(--fs-sm)',
                          color: agencyStatus === 'completed' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                          textDecoration: agencyStatus === 'completed' ? 'line-through' : 'none',
                        }}>{agency}</span>
                        <QrcStepToggle
                          value={agencyStatus}
                          onChange={next => handleAgencyStatus(step.id, agency, next)}
                          size="sm"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {step.type === 'fill_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>{step.label}</div>
                <input className="input-dark" placeholder={step.field_label || 'Enter value'}
                  value={resp?.value || ''} onChange={e => handleFieldChange(step.id, e.target.value)}
                  style={{ width: '100%', fontSize: 'var(--fs-sm)' }} />
              </div>
            )}

            {step.type === 'time_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>{step.label}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="input-dark" placeholder={step.field_label || 'HHmm'}
                    value={resp?.value || ''} onChange={e => handleFieldChange(step.id, e.target.value)}
                    style={{ width: 100, fontSize: 'var(--fs-sm)', textAlign: 'center' }} />
                  <button onClick={() => handleFieldChange(step.id, zuluNow())} style={{
                    background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyan)',
                    borderRadius: 'var(--radius-sm)', padding: '4px 10px', color: 'var(--color-cyan)',
                    fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Now (Z)</button>
                </div>
              </div>
            )}

          </div>
          {status === 'completed' && resp?.completed_at && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {new Date(resp.completed_at).toISOString().slice(11, 16)}Z
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeExecId && (
                <button onClick={() => { setActiveExecId(null); setShowCloseConfirm(false) }} style={{
                  background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0,
                }}>&larr;</button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeExec && (
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-amber)',
                    background: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
                    padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                  }}>QRC-{activeExec.qrc_number}</span>
                )}
                <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {activeExec ? activeExec.title : 'Quick Reaction Checklists'}
                </span>
              </div>
            </div>
            <Link href={activeExec ? `/qrc?exec=${activeExec.id}` : '/qrc'} onClick={onClose} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 8 }}>
              Full Page &rarr;
            </Link>
          </div>
          {activeExec && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
              Opened {new Date(activeExec.opened_at).toISOString().slice(11, 16)}Z
              {activeExec.open_initials && ` by ${activeExec.open_initials}`}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {!loaded ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
          ) : activeExec && activeTemplate ? (
            <div>
              {/* Warning note */}
              {activeTemplate.notes && (
                <div style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 10,
                  background: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-surface))',
                  borderLeft: '3px solid var(--color-danger)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <AlertOctagon size={14} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-danger)' }}>
                    {activeTemplate.notes}
                  </div>
                </div>
              )}

              {/* References */}
              {activeTemplate.references && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginBottom: 10 }}>
                  Ref: {activeTemplate.references}
                </div>
              )}

              {/* SCN Form — data entry at top for quick capture */}
              {activeTemplate.has_scn_form && activeTemplate.scn_fields && (
                <div style={{
                  padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 12,
                  background: 'var(--color-bg-surface)',
                  border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
                  borderLeft: '3px solid var(--color-cyan)',
                }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Secondary Crash Net (SCN) Form
                  </div>
                  {((activeTemplate.scn_fields as { fields?: { key: string; label: string; type: string }[] }).fields || []).map(
                    (field: { key: string; label: string; type: string }) => (
                      <div key={field.key} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea className="input-dark" value={(scnData[field.key] as string) || ''}
                            onChange={e => handleScnField(field.key, e.target.value)} rows={2}
                            style={{ width: '100%', fontSize: 'var(--fs-sm)', resize: 'vertical' }} />
                        ) : (
                          <input className="input-dark" value={(scnData[field.key] as string) || ''}
                            onChange={e => handleScnField(field.key, e.target.value)}
                            style={{ width: '100%', fontSize: 'var(--fs-sm)' }} />
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Steps */}
              {steps.map(step => renderStep(step))}
            </div>
          ) : (
            /* Template picker grid */
            <>
              {openExecs.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-bwc-mod)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Active</div>
                  {openExecs.map(ex => (
                    <button key={ex.id} onClick={() => setActiveExecId(ex.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'color-mix(in srgb, var(--color-amber) 8%, var(--color-bg-surface))',
                      border: '1px solid color-mix(in srgb, var(--color-amber) 25%, transparent)',
                      borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-amber)',
                        background: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
                        border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
                        padding: '2px 8px', borderRadius: 'var(--radius-xs)',
                      }}>QRC-{ex.qrc_number}</span>
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', flex: 1 }}>{ex.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Start New</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {templates.filter(t => t.is_active).map(tmpl => (
                  <button key={tmpl.id} onClick={() => handleStart(tmpl)} disabled={starting === tmpl.id}
                    style={{
                      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', padding: '8px 10px', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                    }}>
                    <span style={{
                      fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-amber)',
                      background: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
                      border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
                      padding: '2px 8px', borderRadius: 'var(--radius-xs)',
                    }}>
                      {tmpl.qrc_number}
                    </span>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4, lineHeight: 1.3 }}>
                      {tmpl.title}
                    </div>
                  </button>
                ))}
              </div>
              {templates.filter(t => t.is_active).length === 0 && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
                  No QRC templates configured. Set them up in Settings.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeExec && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {showCloseConfirm ? (
              <div>
                <input className="input-dark" placeholder="Closing initials (optional)"
                  value={closeInitials} onChange={e => setCloseInitials(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontSize: 'var(--fs-sm)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleClose} disabled={closing} style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--color-status-pass)', color: '#fff', fontWeight: 700,
                    fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{closing ? 'Closing...' : 'Confirm Close'}</button>
                  <button onClick={() => setShowCloseConfirm(false)} style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
                    fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCloseConfirm(true)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--color-status-pass)', color: '#fff', fontWeight: 700,
                  fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                }}>Close QRC</button>
                <button onClick={handleCancel} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
                  color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--fs-base)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
