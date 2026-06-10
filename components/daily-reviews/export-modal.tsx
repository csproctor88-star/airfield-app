'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { fetchReviewsInRange, fetchSignersForRows, getEffectiveReviewDate } from '@/lib/supabase/daily-reviews'
import { generateDailyReviewLogPdf } from '@/lib/reports/daily-review-log-pdf'

interface Props {
  open: boolean
  onClose: () => void
  baseId: string
  baseName: string
  baseIcao: string | null
  shiftCount: number
  timezone: string | null
  resetTime: string | null
  userName: string
  base: { airport_type?: 'usaf' | 'faa_part139' | null } | null
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + delta)
  return t.toISOString().slice(0, 10)
}

export default function DailyReviewExportModal({
  open, onClose, baseId, baseName, baseIcao, shiftCount, timezone, resetTime, userName, base,
}: Props) {
  const todayIso = getEffectiveReviewDate(timezone, resetTime)
  const [start, setStart] = useState(addDaysIso(todayIso, -29))
  const [end, setEnd] = useState(todayIso)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const applyPreset = (days: number) => { setStart(addDaysIso(todayIso, -(days - 1))); setEnd(todayIso) }
  const applyMtd = () => { setStart(todayIso.slice(0, 8) + '01'); setEnd(todayIso) }

  const onDownload = async () => {
    if (start > end) { toast.error('Start date must be on or before end date'); return }
    setBusy(true)
    try {
      const rows = await fetchReviewsInRange(baseId, start, end)
      const signers = await fetchSignersForRows(rows)
      const { doc, filename } = generateDailyReviewLogPdf({
        baseName, baseIcao, shiftCount, startDate: start, endDate: end,
        generatedBy: userName, rows, signers, base,
      })
      doc.save(filename)
      onClose()
    } catch (e) {
      console.error('export daily review log:', e)
      toast.error('Failed to generate report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 460, border: '1px solid var(--color-border-mid)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-mid)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            Export Certification Log
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => applyPreset(7)} className="input-dark" style={{ cursor: 'pointer' }}>Last 7</button>
            <button onClick={() => applyPreset(30)} className="input-dark" style={{ cursor: 'pointer' }}>Last 30</button>
            <button onClick={applyMtd} className="input-dark" style={{ cursor: 'pointer' }}>Month-to-date</button>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Start
            <input type="date" max={todayIso} value={start} onChange={(e) => setStart(e.target.value)} className="input-dark" style={{ width: '100%' }} />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>End
            <input type="date" max={todayIso} value={end} onChange={(e) => setEnd(e.target.value)} className="input-dark" style={{ width: '100%' }} />
          </label>
          <button onClick={onDownload} disabled={busy}
            style={{ marginTop: 6, width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-cyan)', color: 'var(--color-cyan-btn-text)', fontWeight: 800,
              border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
