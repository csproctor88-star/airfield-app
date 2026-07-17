'use client'

// NAMO/NAMT Report Tool — per-user activity counts across selected modules.
// Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
// Modeled on app/(app)/reports/daily/page.tsx (picker → fetch → preview).
// Exports (PDF/Excel/email) consume the SNAPSHOTTED result (resultDomains /
// resultRange), never the live picker state, so an export always matches
// whatever the preview last rendered.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Download, FileSpreadsheet, Mail, Loader2, Users } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchUserActivityData,
  USER_ACTIVITY_DOMAINS,
  type DomainDef,
  type UserActivityData,
  type UserActivityDomain,
} from '@/lib/reports/user-activity-data'
import { UserActivityMatrix } from '@/components/reports/user-activity-matrix'
import { EmptyState } from '@/components/ui/empty-state'
import { getInspectorName } from '@/lib/supabase/inspections'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'

// ── Local-day date helpers (mirrors reports/daily/page.tsx:63-69: pick in
// local calendar days, convert to UTC boundaries only for the query). ──

function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function monthStartLocal(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/** Federal FY: Oct 1 – Sep 30. Returns this FY's start (partial-year "to date"). */
function fyStartLocal(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number) // m is 1-based
  const fyStartYear = m >= 10 ? y : y - 1
  return `${fyStartYear}-10-01`
}

type RangeMode = 'last7' | 'last30' | 'last90' | 'mtd' | 'fytd' | 'custom'

const RANGE_PRESETS: { mode: RangeMode; label: string }[] = [
  { mode: 'last7', label: 'Last 7 Days' },
  { mode: 'last30', label: 'Last 30 Days' },
  { mode: 'last90', label: 'Last 90 Days' },
  { mode: 'mtd', label: 'Month-to-Date' },
  { mode: 'fytd', label: 'FY-to-Date' },
]

/** "requires <module> view access" label per domain's gating permission. */
const MODULE_NAME_BY_VIEW_PERM: Record<string, string> = {
  [PERM.WILDLIFE_VIEW]: 'Wildlife',
  [PERM.CHECKS_VIEW]: 'Airfield Checks',
  [PERM.INSPECTIONS_VIEW]: 'Inspections',
  [PERM.DISCREPANCIES_VIEW]: 'Discrepancies',
  [PERM.QRC_VIEW]: 'QRC',
  [PERM.DAILY_REVIEWS_VIEW]: 'Daily Reviews',
  [PERM.PPR_VIEW]: 'PPR',
}

const ALL_DOMAIN_KEYS: UserActivityDomain[] = USER_ACTIVITY_DOMAINS.map((d) => d.key)

/** Human-readable export-gate title, mirroring the house "Requires the <Label> permission." convention. */
const EXPORT_PERM_TITLE = 'Requires the Export Reports permission.'

export default function UserActivityReportPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()

  const today = useMemo(() => localToday(), [])

  const [rangeMode, setRangeMode] = useState<RangeMode>('last30')
  const [customStart, setCustomStart] = useState(() => addDaysLocal(today, -29))
  const [customEnd, setCustomEnd] = useState(today)

  const [selectedDomains, setSelectedDomains] = useState<Set<UserActivityDomain>>(new Set(ALL_DOMAIN_KEYS))
  const [includeZeroActivity, setIncludeZeroActivity] = useState(false)

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UserActivityData | null>(null)
  const [resultDomains, setResultDomains] = useState<DomainDef[]>([])
  const [resultRange, setResultRange] = useState<{ start: string; end: string } | null>(null)

  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getInspectorName().then((inspector) => { if (!cancelled) setGeneratorName(inspector.name || 'Unknown') })
    return () => { cancelled = true }
  }, [])

  const canAccess = has(PERM.REPORTS_USER_ACTIVITY)
  const canExport = has(PERM.REPORTS_EXPORT)

  // Page gate — same pattern as app/(app)/amtr/page.tsx: wait for perms to
  // load before deciding, so we never flash the notice while still loading.
  if (permsLoaded && !canAccess) {
    return (
      <div className="page-container">
        <EmptyState message="You don't have access to the NAMO/NAMT Report Tool." />
      </div>
    )
  }

  const domainAllowed = (d: DomainDef) => has(d.viewPerm)
  const domainsForFetch = USER_ACTIVITY_DOMAINS.filter((d) => domainAllowed(d) && selectedDomains.has(d.key))
  const generateDisabled = domainsForFetch.length === 0 || loading

  // Consolidated "requires <module> view access" notes — grouped by the
  // missing permission so wildlife_sightings/wildlife_strikes (both gated on
  // wildlife:view) read as one line instead of two identical warnings.
  const blockedDomainGroups = Array.from(
    USER_ACTIVITY_DOMAINS.filter((d) => !domainAllowed(d))
      .reduce((map, d) => {
        const moduleName = MODULE_NAME_BY_VIEW_PERM[d.viewPerm] ?? d.label
        const labels = map.get(moduleName) ?? []
        labels.push(d.label)
        map.set(moduleName, labels)
        return map
      }, new Map<string, string[]>())
      .entries(),
  ).map(([moduleName, domainLabels]) => ({ moduleName, domainLabels }))

  const toggleDomain = (key: UserActivityDomain) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const resolveRange = (): { start: string; end: string } => {
    switch (rangeMode) {
      case 'last7': return { start: addDaysLocal(today, -6), end: today }
      case 'last30': return { start: addDaysLocal(today, -29), end: today }
      case 'last90': return { start: addDaysLocal(today, -89), end: today }
      case 'mtd': return { start: monthStartLocal(today), end: today }
      case 'fytd': return { start: fyStartLocal(today), end: today }
      case 'custom': return { start: customStart, end: customEnd }
    }
  }

  const handleGenerate = async () => {
    if (domainsForFetch.length === 0 || !installationId) return
    const { start, end } = resolveRange()
    if (end < start) {
      toast.error('End date must be on or after the start date')
      return
    }
    setLoading(true)
    const startUTC = new Date(`${start}T00:00:00`).toISOString()
    const endUTC = new Date(`${end}T23:59:59.999`).toISOString()
    try {
      const result = await fetchUserActivityData(
        installationId, startUTC, endUTC, domainsForFetch.map((d) => d.key),
        { includeZeroActivity, base: currentInstallation },
      )
      setData(result)
      setResultDomains(domainsForFetch)
      setResultRange({ start, end })
    } catch (err) {
      // Binding handoff: fetchUserActivityData throws all-or-nothing on any
      // domain fetch failure — catch and toast, never render a partial matrix.
      toast.error(err instanceof Error ? err.message : 'Failed to generate the report')
    } finally {
      setLoading(false)
    }
  }

  // ── Exports — always read the snapshotted result (data/resultDomains/
  // resultRange), never the live picker state, so an export always matches
  // what the preview last rendered. ──

  const makePdfOpts = () => ({
    baseName: currentInstallation?.name,
    baseIcao: currentInstallation?.icao,
    startDate: resultRange?.start ?? '',
    endDate: resultRange?.end ?? '',
    generatedBy: generatorName,
    domains: resultDomains,
  })

  const exportFilenameBase = () => {
    const slug = (currentInstallation?.icao || currentInstallation?.name || 'base').replace(/[^A-Za-z0-9]+/g, '-')
    return `namo-namt-report_${slug}_${resultRange?.start ?? ''}_${resultRange?.end ?? ''}`
  }

  const handleExportPdf = async () => {
    if (!data || !resultRange) return
    setExportingPdf(true)
    try {
      const { generateUserActivityPdf } = await import('@/lib/reports/user-activity-pdf')
      const { doc, filename } = generateUserActivityPdf(data, makePdfOpts())
      doc.save(filename)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate the PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    if (!data || !resultRange) return
    setExportingExcel(true)
    try {
      const [{ buildUserActivityWorkbook }, { saveWorkbook }] = await Promise.all([
        import('@/lib/reports/user-activity-excel'),
        import('@/lib/excel-export'),
      ])
      const wb = await buildUserActivityWorkbook(data, { domains: resultDomains })
      await saveWorkbook(wb, `${exportFilenameBase()}.xlsx`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate the Excel workbook')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleEmailPdf = async () => {
    if (!data || !resultRange) return
    setExportingPdf(true)
    try {
      const { generateUserActivityPdf } = await import('@/lib/reports/user-activity-pdf')
      const result = generateUserActivityPdf(data, makePdfOpts())
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate the PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleSendEmail = async (email: string) => {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(
      emailPdfData.doc, emailPdfData.filename, email,
      `Report: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`,
    )
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color="var(--color-accent)" />
            NAMO/NAMT Report Tool
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Activity counts by individual user across selected modules</div>
        </div>
      </div>

      {/* Range picker */}
      <div className="card" style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Calendar size={16} color="var(--color-accent)" />
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)' }}>Date Range</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: rangeMode === 'custom' ? 12 : 0 }}>
          {RANGE_PRESETS.map((p) => (
            <ChipButton key={p.mode} active={rangeMode === p.mode} onClick={() => setRangeMode(p.mode)}>
              {p.label}
            </ChipButton>
          ))}
          <ChipButton active={rangeMode === 'custom'} onClick={() => setRangeMode('custom')}>
            Custom
          </ChipButton>
        </div>

        {rangeMode === 'custom' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              From
              <input
                type="date"
                value={customStart}
                max={today}
                onChange={(e) => setCustomStart(e.target.value)}
                style={dateInputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              To
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={dateInputStyle}
              />
            </label>
          </div>
        )}
      </div>

      {/* Domain selection — chip cluster pattern: one bordered container,
          dim off-state text; disabled chips name the missing view access. */}
      <div className="card" style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 10 }}>Data Domains</div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4,
          borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
          background: 'var(--color-bg-inset)',
        }}>
          {USER_ACTIVITY_DOMAINS.map((d) => {
            const allowed = domainAllowed(d)
            const checked = selectedDomains.has(d.key) && allowed
            const moduleName = MODULE_NAME_BY_VIEW_PERM[d.viewPerm] ?? d.label
            return (
              <button
                key={d.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={!allowed}
                title={allowed ? undefined : `requires ${moduleName} view access`}
                onClick={() => toggleDomain(d.key)}
                style={{
                  padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: checked ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'transparent',
                  color: checked ? 'var(--color-accent)' : 'var(--color-text-4)',
                  fontSize: 'var(--fs-xs)', fontWeight: checked ? 700 : 500, fontFamily: 'inherit',
                  cursor: allowed ? 'pointer' : 'not-allowed',
                  opacity: allowed ? 1 : 0.55,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        {blockedDomainGroups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {blockedDomainGroups.map((group) => (
              <div key={group.moduleName} style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)' }}>
                {group.domainLabels.join(', ')} — requires {group.moduleName} view access
              </div>
            ))}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={includeZeroActivity}
            onChange={(e) => setIncludeZeroActivity(e.target.checked)}
          />
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Include personnel with zero activity</span>
        </label>
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={generateDisabled}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', marginBottom: 16,
          background: generateDisabled ? 'var(--color-border)' : 'var(--color-accent)',
          color: generateDisabled ? 'var(--color-text-4)' : 'var(--color-cyan-btn-text)',
          fontSize: 'var(--fs-xl)', fontWeight: 700,
          cursor: generateDisabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        {loading ? 'Generating…' : 'Generate Report'}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Preview */}
      {data && resultRange && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              {resultRange.start} — {resultRange.end}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ExportButton
                onClick={handleExportPdf}
                disabled={!canExport || exportingPdf}
                title={canExport ? undefined : EXPORT_PERM_TITLE}
                icon={<Download size={16} />}
                label={exportingPdf ? 'Generating…' : 'PDF'}
              />
              <ExportButton
                onClick={handleExportExcel}
                disabled={!canExport || exportingExcel}
                title={canExport ? undefined : EXPORT_PERM_TITLE}
                icon={<FileSpreadsheet size={16} />}
                label={exportingExcel ? 'Generating…' : 'Excel'}
              />
              <ExportButton
                onClick={handleEmailPdf}
                disabled={!canExport || exportingPdf}
                title={canExport ? undefined : EXPORT_PERM_TITLE}
                icon={<Mail size={16} />}
                label="Email"
              />
            </div>
          </div>

          <UserActivityMatrix data={data} domains={resultDomains} />
        </div>
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999, border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-3)',
        fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function ExportButton({
  onClick, disabled, title, icon, label,
}: { onClick: () => void; disabled: boolean; title?: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '8px 12px', borderRadius: 8,
        border: `1px solid ${disabled ? 'var(--color-border)' : 'var(--color-accent)'}`,
        background: disabled ? 'transparent' : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
        color: disabled ? 'var(--color-text-4)' : 'var(--color-accent)',
        fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

const dateInputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface-solid)', color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}
