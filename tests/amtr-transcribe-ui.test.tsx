import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JqsTab } from '@/components/amtr/jqs-tab'
import { amtrSign } from '@/lib/supabase/amtr'
import type { AmtrMember, AmtrRole } from '@/lib/supabase/amtr'

// ─── JQS bulk-transcribe UI flow ───
// Drives the real JqsTab component through the transcribe path so the wiring
// (toggle → select-all-completed → column → initials → Apply) is verified end
// to end, not just the pure helper. amtrSign is the only Supabase call on this
// path (completed items already have a progress row, so ensureProgress is a
// no-op); we spy it to confirm the right rows/slot/initials are signed.

vi.mock('@/lib/supabase/amtr', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/supabase/amtr')>()
  return { ...actual, amtrSign: vi.fn(async () => ({ error: null })) }
})

const catalog: Record<string, unknown>[] = [
  { id: 'sec1', kind: 'section', title: 'Administration', number: '1' },
  { id: 'i1', kind: 'item', core_cert: '5', title: 'Completed, no cert', depth: 1, number: '1.1' },
  { id: 'i2', kind: 'item', core_cert: '7^', title: 'Completed, cert required', depth: 1, number: '1.2' },
  { id: 'i3', kind: 'item', core_cert: '', title: 'No completed date', depth: 1, number: '1.3' },
]
const progress: Record<string, unknown>[] = [
  { id: 'p1', catalog_id: 'i1', complete_date: '2024-01-01' },
  { id: 'p2', catalog_id: 'i2', complete_date: '2024-02-01' },
  // i3 has no progress row / no complete date.
]

function renderTab(overrides: Partial<Parameters<typeof JqsTab>[0]> = {}) {
  return render(
    <JqsTab
      catalog={catalog}
      progress={progress}
      installationId="base-1"
      memberId="member-1"
      member={{ id: 'member-1', full_name: 'Test Member' } as unknown as AmtrMember}
      myRoles={['namt'] as AmtrRole[]}
      canWrite
      canEnterData
      canManage
      isOwn={false}
      highlightItem={null}
      sign={vi.fn() as never}
      reopen={vi.fn() as never}
      onChange={vi.fn()}
      notifySignoff={vi.fn() as never}
      {...overrides}
    />,
  )
}

describe('JQS bulk transcribe UI', () => {
  beforeEach(() => {
    vi.mocked(amtrSign).mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('toggles the transcribe bar and bulk-signs the chosen column', async () => {
    renderTab()

    // Bar hidden until toggled.
    expect(screen.queryByRole('button', { name: /select all completed/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^transcribe$/i }))
    const selectAll = screen.getByRole('button', { name: /select all completed/i })
    // Two items carry a completed date (i1, i2); i3 does not.
    expect(selectAll.textContent).toContain('(2)')

    fireEvent.click(selectAll)
    expect(screen.getByText(/2 selected/i)).toBeTruthy()

    // Default column is Trainee → both completed items are actionable.
    expect(screen.getByRole('button', { name: /^Apply \(2\)$/ })).toBeTruthy()

    // Switch to Certifier → only the caret item (i2) is actionable.
    fireEvent.click(screen.getByRole('button', { name: 'Certifier' }))
    expect(screen.getByRole('button', { name: /^Apply \(1\)$/ })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/initials/i), { target: { value: 'JD' } })
    fireEvent.click(screen.getByRole('button', { name: /^Apply \(1\)$/ }))

    await waitFor(() => expect(amtrSign).toHaveBeenCalledTimes(1))
    expect(amtrSign).toHaveBeenCalledWith('amtr_jqs_progress', 'p2', 'certifier', 'JD')
  })

  it('on your own record only the Trainee column is offered', () => {
    renderTab({ isOwn: true, myRoles: ['namt', 'afm'] as AmtrRole[] })
    fireEvent.click(screen.getByRole('button', { name: /^transcribe$/i }))
    expect(screen.getByRole('button', { name: 'Trainee' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trainer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Certifier' })).toBeNull()
  })

  it('hides the Transcribe toggle when the user cannot write', () => {
    renderTab({ canWrite: false })
    expect(screen.queryByRole('button', { name: /^transcribe$/i })).toBeNull()
  })
})
