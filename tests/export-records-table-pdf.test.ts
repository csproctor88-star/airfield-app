import { describe, it, expect } from 'vitest'
import { generateRecordsTablePdf } from '@/lib/export/export-records-table-pdf'

describe('generateRecordsTablePdf', () => {
  it('produces a jsPDF doc with at least one page for populated rows', () => {
    const doc = generateRecordsTablePdf({
      title: 'Discrepancies',
      subtitle: '2026-01',
      baseName: 'Test AAF',
      baseIcao: 'KTST',
      columns: ['ID', 'Status', 'Title'],
      rows: [
        ['DSC-1', 'open', 'Crack'],
        ['DSC-2', 'closed', 'Light out'],
      ],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })

  it('handles an empty rows array without throwing', () => {
    const doc = generateRecordsTablePdf({
      title: 'Discrepancies',
      columns: ['ID', 'Status', 'Title'],
      rows: [],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
