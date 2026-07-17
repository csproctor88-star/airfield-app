import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The hub only reads `installationId` off useInstallation() — a minimal stub
// is sufficient (avoids a real supabase round trip).
vi.mock('@/lib/installation-context', () => ({
  useInstallation: () => ({ installationId: 'base-1' }),
}))

// Never resolves — keeps the analytics grid (which needs a full AnalyticsData
// stub) from mounting, while the report-card list above it still renders.
vi.mock('@/lib/reports/analytics-data', () => ({
  fetchAnalyticsData: vi.fn(() => new Promise(() => {})),
}))

let hasKeys: string[] = []
vi.mock('@/lib/permissions', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/permissions')>()
  return {
    ...actual,
    usePermissions: () => ({
      has: (key: string) => hasKeys.includes(key),
      hasAny: (keys: string[]) => keys.some((k) => hasKeys.includes(k)),
      hasAll: (keys: string[]) => keys.every((k) => hasKeys.includes(k)),
      all: new Set(hasKeys),
      loaded: true,
    }),
  }
})

import ReportsPage from '@/app/(app)/reports/page'
import { PERM } from '@/lib/permissions'

afterEach(cleanup)

const ALWAYS_ON_TITLES = [
  'Daily Operations Summary',
  'Discrepancy Report',
  'Discrepancy Trends',
  'Aging Discrepancies',
  'Airfield Lighting Report',
]

describe('ReportsPage — NAMO/NAMT Report Tool card gating', () => {
  it('hides the card when the viewer lacks reports:user_activity', () => {
    hasKeys = []
    render(<ReportsPage />)
    expect(screen.queryByText('NAMO/NAMT Report Tool')).toBeNull()
    // Existing cards are unaffected by the gating change.
    for (const title of ALWAYS_ON_TITLES) expect(screen.getByText(title)).toBeTruthy()
  })

  it('shows the card once the viewer holds reports:user_activity', () => {
    hasKeys = [PERM.REPORTS_USER_ACTIVITY]
    render(<ReportsPage />)
    expect(screen.getByText('NAMO/NAMT Report Tool')).toBeTruthy()
    expect(screen.getByText('Activity counts by individual user across selected modules.')).toBeTruthy()
    for (const title of ALWAYS_ON_TITLES) expect(screen.getByText(title)).toBeTruthy()
  })
})
