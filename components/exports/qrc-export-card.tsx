'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'

export function QrcExportCard() {
  const { installationId } = useInstallation()
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    if (!installationId) {
      toast.error('No installation selected')
      return
    }
    setGenerating(true)
    try {
      const { exportQrc } = await import('@/lib/export/qrc-export')
      const { count } = await exportQrc(installationId)
      if (count === 0) {
        toast.message('No active QRCs to export')
        return
      }
      toast.success(`Exported ${count} ${count === 1 ? 'QRC' : 'QRCs'} to Excel`)
    } catch (e) {
      console.error('QRC export failed:', e)
      toast.error('QRC export failed — see console for details')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
      <div className="section-label">EXPORT QRC</div>
      <p style={{ color: 'var(--color-text-3)', margin: '6px 0 16px' }}>
        Downloads one Excel workbook with a sheet per QRC (sheet named for the QRC), each listing the
        step descriptions in a single column. Generation runs entirely in your browser.
      </p>
      <button
        type="button"
        className="btn-primary"
        disabled={generating}
        onClick={handleGenerate}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: generating ? 0.6 : 1 }}
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {generating ? 'Generating…' : 'Export QRC'}
      </button>
    </div>
  )
}
