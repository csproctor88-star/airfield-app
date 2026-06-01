'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Save } from 'lucide-react'
import { usePermissions, PERM } from '@/lib/permissions'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/utils'
import { fetchPprColumns, type PprColumn } from '@/lib/supabase/ppr'

const DEFAULT_UNIT = '127 OSS/OSAB'

/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
function todayInTz(tz: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function C2imeraExportCard() {
  const { has } = usePermissions()
  const { installationId, currentInstallation } = useInstallation()
  const inst = currentInstallation as
    | { timezone?: string | null; c2imera_unit?: string | null; c2imera_ppr_eta_column_id?: string | null }
    | null
  const tz = inst?.timezone ?? 'UTC'
  const canEdit = has(PERM.BASE_SETUP_WRITE)

  const today = todayInTz(tz)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [unit, setUnit] = useState(inst?.c2imera_unit || DEFAULT_UNIT)
  const [etaColumnId, setEtaColumnId] = useState<string>(inst?.c2imera_ppr_eta_column_id || '')
  const [timeColumns, setTimeColumns] = useState<PprColumn[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-seed editable fields when the installation switches.
  useEffect(() => {
    setUnit(inst?.c2imera_unit || DEFAULT_UNIT)
    setEtaColumnId(inst?.c2imera_ppr_eta_column_id || '')
    const t = todayInTz(inst?.timezone ?? 'UTC')
    setFrom(t)
    setTo(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  // Load the base's PPR time columns for the ETA-source dropdown.
  useEffect(() => {
    if (!installationId) return
    let live = true
    fetchPprColumns(installationId).then((cols) => {
      if (live) setTimeColumns(cols.filter((c) => c.column_type === 'time'))
    })
    return () => {
      live = false
    }
  }, [installationId])

  async function handleSaveSettings() {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('bases')
        .update({ c2imera_unit: unit.trim() || DEFAULT_UNIT, c2imera_ppr_eta_column_id: etaColumnId || null })
        .eq('id', installationId)
      if (error) {
        toast.error(friendlyError(error.message))
        return
      }
      toast.success('C2IMERA settings saved')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    if (!installationId) {
      toast.error('No installation selected')
      return
    }
    if (!from || !to) {
      toast.error('Pick a from and to date')
      return
    }
    if (from > to) {
      toast.error('From date must be on or before the To date')
      return
    }
    setGenerating(true)
    try {
      const { exportC2imera } = await import('@/lib/export/c2imera-export')
      const counts = await exportC2imera({
        baseId: installationId,
        from,
        to,
        unit: unit.trim() || DEFAULT_UNIT,
        etaColumnId: etaColumnId || null,
        tz,
      })
      toast.success(
        `Exported 3 files — Events ${counts.events}, PPR ${counts.ppr}, Discrepancies ${counts.discrepancies}`,
      )
    } catch (e) {
      console.error('C2IMERA export failed:', e)
      toast.error('C2IMERA export failed — see console for details')
    } finally {
      setGenerating(false)
    }
  }

  const labelStyle = { fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 4 } as const
  const inputStyle = {
    padding: '6px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
  } as const

  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 20,
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div className="section-label">EXPORT FOR C2IMERA</div>
      <p style={{ color: 'var(--color-text-3)', margin: '6px 0 16px' }}>
        Downloads three separate Excel files — Events Log, PPR Log, and Airfield Discrepancies —
        formatted for direct import into C2IMERA. Generation runs entirely in your browser.
      </p>

      {/* Date range */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" style={inputStyle} />
        </div>
        <span style={{ paddingBottom: 8 }}>→</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" style={inputStyle} />
        </div>
        <button
          type="button"
          className="chip"
          onClick={() => {
            const t = todayInTz(tz)
            setFrom(t)
            setTo(t)
          }}
        >
          Today
        </button>
      </div>

      {/* Settings */}
      {canEdit ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 18,
            padding: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'var(--color-bg-subtle, var(--color-bg-surface))',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={labelStyle}>Reporting unit</span>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Reporting unit"
              style={{ ...inputStyle, minWidth: 180 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={labelStyle}>PPR ETA column</span>
            <select
              value={etaColumnId}
              onChange={(e) => setEtaColumnId(e.target.value)}
              aria-label="PPR ETA column"
              style={{ ...inputStyle, minWidth: 180 }}
            >
              <option value="">— None (blank ETA) —</option>
              {timeColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.column_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="chip"
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save settings
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 16 }}>
          Reporting unit: <strong>{unit}</strong>
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={generating}
        onClick={handleGenerate}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: generating ? 0.6 : 1 }}
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {generating ? 'Generating…' : 'Export for C2IMERA'}
      </button>
    </div>
  )
}
