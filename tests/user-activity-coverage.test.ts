import { describe, it, expect } from 'vitest'
import {
  USER_ACTIVITY_DOMAINS,
  buildActivityMatrix,
  type RawDomainRow,
  type UserActivityDomain,
} from '@/lib/reports/user-activity-data'
import type { SignerInfo } from '@/lib/supabase/daily-reviews'

const ALL: UserActivityDomain[] = USER_ACTIVITY_DOMAINS.map((d) => d.key)
const UID = '11111111-1111-1111-1111-111111111111'
const jane: SignerInfo = { id: UID, name: 'Jane Doe', rank: 'SSgt', operating_initials: 'JD' }

function checkRow(overrides: Partial<RawDomainRow> = {}): RawDomainRow {
  return {
    domain: 'checks',
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    actorId: null,
    actorName: 'SSgt Jane Doe',
    ts: '2026-02-15T12:00:00.000Z',
    label: 'AC-OLD',
    href: null,
    ...overrides,
  }
}

// Regression guard: these constants were confirmed against the actual
// migration history (see lib/reports/user-activity-data.ts comment block).
// Changing one is a data-honesty change — do it deliberately, with a
// migration-history citation, not as a drive-by.
describe('attribution coverage constants (confirmed from migrations)', () => {
  it('airfield checks uuid coverage begins 2026-03-03 (saved_by_id epoch, 2026030300)', () => {
    const checks = USER_ACTIVITY_DOMAINS.find((d) => d.key === 'checks')!
    expect(checks.coverageStart).toBe('2026-03-03')
  })

  it('all other domains have full-history attribution (actor columns original to their tables)', () => {
    for (const d of USER_ACTIVITY_DOMAINS) {
      if (d.key === 'checks') continue
      expect(d.coverageStart, `${d.key} coverageStart`).toBeNull()
    }
  })
})

describe('coverage footnote emission', () => {
  it('emits a note iff range start < coverageStart AND affected > 0', () => {
    const data = buildActivityMatrix(
      [checkRow(), checkRow()],
      new Map(),
      ALL,
      '2026-02-01T05:00:00.000Z',
    )
    expect(data.coverageNotes).toEqual([
      { domain: 'checks', coverageStart: '2026-03-03', affected: 2 },
    ])
  })

  it('no note when the range starts on/after coverageStart, even with unlinked rows', () => {
    const onStart = buildActivityMatrix(
      [checkRow({ ts: '2026-03-03T12:00:00.000Z' })],
      new Map(),
      ALL,
      '2026-03-03T05:00:00.000Z',
    )
    expect(onStart.coverageNotes).toEqual([])

    const after = buildActivityMatrix(
      [checkRow({ ts: '2026-06-01T12:00:00.000Z' })],
      new Map(),
      ALL,
      '2026-06-01T04:00:00.000Z',
    )
    expect(after.coverageNotes).toEqual([])
  })

  it('no note when the range predates coverage but every record is uuid-attributed', () => {
    const data = buildActivityMatrix(
      [checkRow({ actorId: UID, actorName: null })],
      new Map([[UID, jane]]),
      ALL,
      '2026-02-01T05:00:00.000Z',
    )
    expect(data.coverageNotes).toEqual([])
  })

  it('affected counts only records lacking uuid attribution', () => {
    const data = buildActivityMatrix(
      [
        checkRow({ actorId: UID, actorName: null }),      // attributed — not affected
        checkRow({ actorName: 'SSgt Jane Doe' }),          // unlinked — affected
        checkRow({ actorName: null }),                     // unattributed — affected
      ],
      new Map([[UID, jane]]),
      ALL,
      '2026-02-01T05:00:00.000Z',
    )
    expect(data.coverageNotes).toEqual([
      { domain: 'checks', coverageStart: '2026-03-03', affected: 2 },
    ])
  })

  it('full-history domains never emit notes, even with unattributed rows', () => {
    const data = buildActivityMatrix(
      [
        checkRow({ domain: 'ppr', actorName: null }),
        checkRow({ domain: 'wildlife_sightings', actorName: 'Someone' }),
      ],
      new Map(),
      ALL,
      '2026-01-01T05:00:00.000Z',
    )
    expect(data.coverageNotes).toEqual([])
  })

  it('emits no notes when no range start is provided (pure aggregation mode)', () => {
    const data = buildActivityMatrix([checkRow()], new Map(), ALL)
    expect(data.coverageNotes).toEqual([])
  })

  it('only selected domains are considered', () => {
    const data = buildActivityMatrix(
      [checkRow()],
      new Map(),
      ['ppr'],                       // checks not selected
      '2026-02-01T05:00:00.000Z',
    )
    expect(data.coverageNotes).toEqual([])
  })
})
