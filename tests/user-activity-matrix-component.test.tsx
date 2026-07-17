import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UserActivityMatrix } from '@/components/reports/user-activity-matrix'
import { USER_ACTIVITY_DOMAINS, type UserActivityData, type DomainDef } from '@/lib/reports/user-activity-data'

afterEach(cleanup)

const CHECKS = USER_ACTIVITY_DOMAINS.find((d) => d.key === 'checks')!
const PPR = USER_ACTIVITY_DOMAINS.find((d) => d.key === 'ppr')!
const domains: DomainDef[] = [CHECKS, PPR]

function baseData(overrides: Partial<UserActivityData> = {}): UserActivityData {
  return {
    rows: [
      {
        kind: 'profile', key: 'u1', display: 'SSgt Jane Doe (JD)',
        counts: { checks: 3, ppr: 0 } as never, total: 3,
        records: {
          checks: [
            { id: 'c1', label: 'AC-0001', ts: '2026-07-02T08:00:00.000Z', href: '/checks/c1' },
          ],
        },
      },
      {
        kind: 'unlinked', key: 'a rae', display: 'A Rae',
        counts: { checks: 1, ppr: 0 } as never, total: 1,
        records: { checks: [{ id: 'c2', label: 'AC-0002', ts: '2026-07-03T00:00:00.000Z', href: null }] },
      },
      {
        kind: 'unattributed', key: 'unattributed', display: 'Former user',
        counts: { checks: 0, ppr: 2 } as never, total: 2,
        records: {},
      },
    ],
    totals: { checks: 4, ppr: 2 } as never,
    coverageNotes: [],
    ...overrides,
  }
}

describe('UserActivityMatrix', () => {
  it('renders the three section groups with the unlinked chip and Former-user label', () => {
    render(<UserActivityMatrix data={baseData()} domains={domains} />)
    expect(screen.getByText('Personnel')).toBeTruthy()
    expect(screen.getByText('Unlinked names')).toBeTruthy()
    expect(screen.getByText('Unattributed')).toBeTruthy()
    expect(screen.getByText('SSgt Jane Doe (JD)')).toBeTruthy()
    expect(screen.getByText('A Rae')).toBeTruthy()
    expect(screen.getByText('unlinked')).toBeTruthy()
    expect(screen.getByText('Former user')).toBeTruthy()
  })

  it('renders the Total column and Totals footer row matching the data', () => {
    render(<UserActivityMatrix data={baseData()} domains={domains} />)
    // Jane's row: checks=3, total=3 (both cells legitimately show "3").
    expect(screen.getAllByText('3')).toHaveLength(2)
    // Totals footer row values (checks=4, ppr=2, grand total=6) — unique elsewhere in the table.
    const totalsRow = screen.getByText('Totals').closest('tr')!
    expect(totalsRow.textContent).toContain('Totals')
    const cells = Array.from(totalsRow.querySelectorAll('td')).map((td) => td.textContent)
    expect(cells).toEqual(['Totals', '4', '2', '6'])
  })

  it('expands a row on click to reveal its drill-down records with label, date, and link', () => {
    render(<UserActivityMatrix data={baseData()} domains={domains} />)
    expect(screen.queryByText('AC-0001')).toBeNull()
    fireEvent.click(screen.getByText('SSgt Jane Doe (JD)'))
    const link = screen.getByText('AC-0001') as HTMLAnchorElement
    expect(link.closest('a')?.getAttribute('href')).toBe('/checks/c1')
  })

  it('renders a record without an href as plain text, not a link', () => {
    render(<UserActivityMatrix data={baseData()} domains={domains} />)
    fireEvent.click(screen.getByText('A Rae'))
    const label = screen.getByText('AC-0002')
    expect(label.closest('a')).toBeNull()
  })

  it('shows the empty-result message and zero totals when there are no rows', () => {
    render(<UserActivityMatrix data={{ rows: [], totals: { checks: 0, ppr: 0 } as never, coverageNotes: [] }} domains={domains} />)
    expect(screen.getByText('No attributed activity in this range')).toBeTruthy()
    expect(screen.getByText('Totals')).toBeTruthy()
  })

  it('shows a subtle notice when zero-activity personnel could not be loaded', () => {
    render(<UserActivityMatrix data={baseData({ zeroActivityUnavailable: true })} domains={domains} />)
    expect(screen.getByText(/could not be loaded for this base/)).toBeTruthy()
  })

  it('renders the corrected coverage footnote wording (not "counted under Unlinked/Unattributed")', () => {
    render(
      <UserActivityMatrix
        data={baseData({ coverageNotes: [{ domain: 'checks', coverageStart: '2026-03-03', affected: 2 }] })}
        domains={domains}
      />,
    )
    expect(screen.getByText(/2 records in this range lack per-user attribution/)).toBeTruthy()
    expect(screen.queryByText(/counted under Unlinked\/Unattributed/)).toBeNull()
  })
})
