import { describe, it, expect } from 'vitest'
import { generateDiscrepancyPdf } from '@/lib/discrepancy-pdf'

describe('generateDiscrepancyPdf', () => {
  it('returns { doc, filename } without throwing on minimal input', async () => {
    const result = await generateDiscrepancyPdf({
      discrepancy: {
        id: 'test-uuid-1234',
        work_order_number: 'WO-2026-0001',
        description: 'Test discrepancy',
        type: 'lighting',
        status: 'open',
        current_status: 'submitted_to_afm',
        location: 'runway',
        created_at: new Date().toISOString(),
        reported_by_name: 'Test User',
      },
      photoDataUrls: [],
      mapDataUrl: null,
      baseName: 'Test AFB',
      baseIcao: 'KTST',
    })

    expect(result.doc).toBeDefined()
    expect(result.filename).toMatch(/^Discrepancy_WO-2026-0001_\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
