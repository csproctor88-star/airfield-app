import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { pdfToExportFile } from '@/lib/export/export-file'

describe('pdfToExportFile', () => {
  it('returns the given path and real PDF bytes', () => {
    const doc = new jsPDF()
    doc.text('hello', 10, 10)
    const file = pdfToExportFile(doc, 'documents/Test.pdf')
    expect(file.path).toBe('documents/Test.pdf')
    expect(file.bytes).toBeInstanceOf(Uint8Array)
    expect(file.bytes.length).toBeGreaterThan(0)
    // PDF magic bytes "%PDF"
    expect(Array.from(file.bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })
})
