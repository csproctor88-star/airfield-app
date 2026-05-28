import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Form797Tab } from '@/components/amtr/form797-tab'
import { amtrTranscribe } from '@/lib/supabase/amtr'
import type { AmtrMember, AmtrRole } from '@/lib/supabase/amtr'

// ─── 797 bulk-transcribe UI flow ───
// Exercises the shared transcribe hook/bar through the 797 tab — a free-form
// (direct-row) tab with a per-row requires_certifier flag, complementing the
// catalog-backed JQS test. Confirms the right rows/slot/initials/date are stamped.

vi.mock('@/lib/supabase/amtr', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/supabase/amtr')>()
  return { ...actual, amtrTranscribe: vi.fn(async () => ({ error: null })) }
})

const items: Record<string, unknown>[] = [
  { id: 'r1', task: 'Task A (completed, cert req)', complete_date: '2024-01-01', requires_certifier: true, sort_order: 0 },
  { id: 'r2', task: 'Task B (completed, no cert)', complete_date: '2024-02-01', requires_certifier: false, sort_order: 1 },
  { id: 'r3', task: 'Task C (no completed date)', requires_certifier: true, sort_order: 2 },
]

function renderTab(overrides: Partial<Parameters<typeof Form797Tab>[0]> = {}) {
  return render(
    <Form797Tab
      items={items}
      canWrite
      canEnterData
      installationId="base-1"
      memberId="member-1"
      member={{ id: 'member-1', full_name: 'Test Member', user_id: null } as unknown as AmtrMember}
      myRoles={['namt'] as AmtrRole[]}
      myUserId="user-1"
      isOwn={false}
      highlightItem={null}
      sign={vi.fn() as never}
      reopen={vi.fn() as never}
      onChange={vi.fn()}
      {...overrides}
    />,
  )
}

describe('797 bulk transcribe UI', () => {
  beforeEach(() => {
    vi.mocked(amtrTranscribe).mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('stamps the completed rows for the chosen column (Trainer)', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /^transcribe$/i }))

    const selectAll = screen.getByRole('button', { name: /select all completed/i })
    expect(selectAll.textContent).toContain('(2)') // r1, r2 have complete dates
    fireEvent.click(selectAll)
    expect(screen.getByText(/2 selected/i)).toBeTruthy()

    // requires_certifier no longer affects the actionable set — certifier
    // isn't a transcribe column. Both completed rows are actionable.
    fireEvent.click(screen.getByRole('button', { name: 'Trainer' }))
    expect(screen.getByRole('button', { name: /^Apply \(2\)$/ })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/initials/i), { target: { value: 'MS' } })
    fireEvent.click(screen.getByRole('button', { name: /^Apply \(2\)$/ }))

    await waitFor(() => expect(amtrTranscribe).toHaveBeenCalledTimes(2))
    const date = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    expect(amtrTranscribe).toHaveBeenCalledWith('amtr_797', 'r1', 'trainer', 'MS', date)
    expect(amtrTranscribe).toHaveBeenCalledWith('amtr_797', 'r2', 'trainer', 'MS', date)
  })

  it('offers Trainee + Trainer but not Certifier (certifier is cleared, not transcribed)', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /^transcribe$/i }))
    expect(screen.getByRole('button', { name: 'Trainee' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trainer' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Certifier' })).toBeNull()
  })
})
