import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FilesTab } from '@/components/amtr/files-tab'
import { fetchAmtrByMember, uploadAmtrFile } from '@/lib/supabase/amtr'

// ─── Files tab: Add-file metadata dialog ───
// Drives the real FilesTab through the upload path: open the dialog,
// confirm Upload is gated on Title + Date + a file, then confirm the
// metadata is passed to uploadAmtrFile. humanFileSize stays real (the
// dialog renders it); only the two Supabase calls are stubbed.

vi.mock('@/lib/supabase/amtr', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/supabase/amtr')>()
  return {
    ...actual,
    fetchAmtrByMember: vi.fn(async () => []),
    uploadAmtrFile: vi.fn(async () => ({ data: null, error: null })),
  }
})

async function renderTab(canWrite = true) {
  const result = render(<FilesTab memberId="member-1" installationId="base-1" canWrite={canWrite} />)
  // Flush the on-mount fetch so its setState resolves inside act() — otherwise
  // the async update lands after the test body and emits a React act() warning.
  await waitFor(() => expect(fetchAmtrByMember).toHaveBeenCalled())
  return result
}

describe('AMTR Files tab — add-file dialog', () => {
  beforeEach(() => {
    vi.mocked(uploadAmtrFile).mockClear()
    vi.mocked(fetchAmtrByMember).mockClear()
  })

  it('opens a dialog with Title, Date, and Attach controls', async () => {
    await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /add file/i }))
    expect(screen.getByText('Add supporting file')).toBeTruthy()
    expect(screen.getByPlaceholderText(/1098/)).toBeTruthy() // Document title
    expect(screen.getByRole('button', { name: /attach file/i })).toBeTruthy()
  })

  it('keeps Upload disabled until title, date, and a file are all present', async () => {
    const { container } = await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /add file/i }))

    const uploadBtn = screen.getByRole('button', { name: /^Upload$/ }) as HTMLButtonElement
    expect(uploadBtn.disabled).toBe(true)

    // Title only — still blocked.
    fireEvent.change(screen.getByPlaceholderText(/1098/), { target: { value: 'Bird/Wildlife 1098' } })
    expect(uploadBtn.disabled).toBe(true)

    // + date — still blocked (no file yet).
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2025-08-14' } })
    expect(uploadBtn.disabled).toBe(true)

    // + file — now enabled.
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(uploadBtn.disabled).toBe(false)
  })

  it('passes the file plus document title and date to uploadAmtrFile', async () => {
    const { container } = await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /add file/i }))

    fireEvent.change(screen.getByPlaceholderText(/1098/), { target: { value: 'Bird/Wildlife 1098' } })
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2025-08-14' } })
    const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /^Upload$/ }))

    await waitFor(() => expect(uploadAmtrFile).toHaveBeenCalledTimes(1))
    expect(uploadAmtrFile).toHaveBeenCalledWith('base-1', 'member-1', file, {
      documentTitle: 'Bird/Wildlife 1098',
      documentDate: '2025-08-14',
    })
  })

  it('auto-fills the title from the filename when left blank', async () => {
    const { container } = await renderTab()
    fireEvent.click(screen.getByRole('button', { name: /add file/i }))

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'AFFSA Training Record.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const titleInput = screen.getByPlaceholderText(/1098/) as HTMLInputElement
    expect(titleInput.value).toBe('AFFSA Training Record')
  })

  it('hides Add file when the user cannot write', async () => {
    await renderTab(false)
    expect(screen.queryByRole('button', { name: /add file/i })).toBeNull()
  })
})
