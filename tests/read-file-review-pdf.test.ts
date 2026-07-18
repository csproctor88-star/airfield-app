import { describe, it, expect } from 'vitest'
import jsPDF from 'jspdf'
import { generateReadFileReviewPdf } from '@/lib/read-file-review-pdf'
import type { ReadFileRow, ReadFileAckRow, ReadFileReviewer } from '@/lib/supabase/read-files'

// Coverage for the Read File review report generator: the { doc, filename }
// contract, and the regression the archived section guards — the archive
// confirm dialog promises archived files stay in the report history, but the
// generator used to render active files only, so archiving a file silently
// dropped its review record from the report.

function makeFile(overrides: Partial<ReadFileRow> & { id: string; title: string }): ReadFileRow {
  return {
    base_id: 'b1',
    description: null,
    storage_path: 'b1/x.pdf',
    file_name: 'x.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1024,
    version: 1,
    is_archived: false,
    created_by: null,
    created_at: '2026-07-01T12:00:00Z',
    updated_at: '2026-07-01T12:00:00Z',
    ...overrides,
  }
}

const REVIEWER: ReadFileReviewer = {
  user_id: 'u1',
  name: 'Alex Morgan',
  rank: 'SMSgt',
  operating_initials: 'AM',
  role: 'airfield_manager',
}

function makeAck(overrides: Partial<ReadFileAckRow> & { read_file_id: string }): ReadFileAckRow {
  return {
    id: `a-${overrides.read_file_id}`,
    base_id: 'b1',
    user_id: 'u1',
    acknowledged_version: 1,
    initials_snapshot: 'AM',
    acknowledged_at: '2026-07-02T12:00:00Z',
    ...overrides,
  }
}

/** Raw page content streams — text drawn with doc.text/autoTable lands here. */
function pdfRawText(doc: jsPDF): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.stringify((doc as any).internal.pages)
}

describe('generateReadFileReviewPdf', () => {
  it('returns the { doc, filename } contract with the expected filename', async () => {
    const { doc, filename } = await generateReadFileReviewPdf({
      baseName: 'Test AFB',
      baseIcao: 'KTST',
      files: [makeFile({ id: 'f1', title: 'Airfield ops memo' })],
      reviewers: [REVIEWER],
      acks: [makeAck({ read_file_id: 'f1' })],
      generatedAtIso: '2026-07-18T12:00:00Z',
    })
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('read-file-review-ktst.pdf')
  })

  it('renders archived files in an Archived history section', async () => {
    const { doc } = await generateReadFileReviewPdf({
      baseName: 'Test AFB',
      baseIcao: 'KTST',
      files: [makeFile({ id: 'f1', title: 'Airfield ops memo' })],
      archivedFiles: [makeFile({ id: 'f2', title: 'Retired policy memo', is_archived: true })],
      reviewers: [REVIEWER],
      acks: [makeAck({ read_file_id: 'f1' })],
      generatedAtIso: '2026-07-18T12:00:00Z',
    })
    const raw = pdfRawText(doc)
    expect(raw).toContain('Archived')
    expect(raw).toContain('Retired policy memo')
    // The count line makes explicit the history section sits outside the stats.
    expect(raw).toContain('Archived files included for history: 1')
  })

  it('renders the archived section even when no active files remain', async () => {
    const { doc } = await generateReadFileReviewPdf({
      files: [],
      archivedFiles: [makeFile({ id: 'f2', title: 'Retired policy memo', is_archived: true })],
      reviewers: [REVIEWER],
      acks: [],
      generatedAtIso: '2026-07-18T12:00:00Z',
    })
    const raw = pdfRawText(doc)
    expect(raw).toContain('No active read files at this base.')
    expect(raw).toContain('Retired policy memo')
  })

  it('omits the archived section when there are no archived files', async () => {
    const { doc } = await generateReadFileReviewPdf({
      files: [makeFile({ id: 'f1', title: 'Airfield ops memo' })],
      reviewers: [REVIEWER],
      acks: [],
      generatedAtIso: '2026-07-18T12:00:00Z',
    })
    const raw = pdfRawText(doc)
    expect(raw).not.toContain('Archived')
  })
})
