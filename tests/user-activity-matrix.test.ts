import { describe, it, expect } from 'vitest'
import {
  USER_ACTIVITY_DOMAINS,
  ZERO_ACTIVITY_EXCLUDED_ROLES,
  actorKeyFor,
  buildActivityMatrix,
  expandDailyReviewRows,
  injectZeroActivityRows,
  type DailyReviewSignoffSource,
  type RawDomainRow,
  type UserActivityDomain,
  type ZeroActivityMember,
} from '@/lib/reports/user-activity-data'
import type { SignerInfo } from '@/lib/supabase/daily-reviews'

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const GONE = '99999999-9999-9999-9999-999999999999'

function raw(overrides: Partial<RawDomainRow> = {}): RawDomainRow {
  return {
    domain: 'checks',
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    actorId: null,
    actorName: null,
    ts: '2026-07-01T12:00:00.000Z',
    label: 'AC-TEST',
    href: null,
    ...overrides,
  }
}

function profileMap(...profiles: SignerInfo[]): Map<string, SignerInfo> {
  return new Map(profiles.map((p) => [p.id, p]))
}

const jane: SignerInfo = { id: U1, name: 'Jane Doe', rank: 'SSgt', operating_initials: 'JD' }
const bob: SignerInfo = { id: U2, name: 'Bob Adams', rank: 'SrA', operating_initials: 'BA' }

const ALL: UserActivityDomain[] = USER_ACTIVITY_DOMAINS.map((d) => d.key)

describe('USER_ACTIVITY_DOMAINS registry', () => {
  it('has exactly nine domains with unique keys', () => {
    expect(USER_ACTIVITY_DOMAINS).toHaveLength(9)
    expect(new Set(ALL).size).toBe(9)
  })

  it('maps each domain to its module view permission', () => {
    const perms = Object.fromEntries(USER_ACTIVITY_DOMAINS.map((d) => [d.key, d.viewPerm]))
    expect(perms).toEqual({
      wildlife_sightings: 'wildlife:view',
      wildlife_strikes: 'wildlife:view',
      checks: 'checks:view',
      inspections: 'inspections:view',
      discrepancies: 'discrepancies:view',
      qrc_opened: 'qrc:view',
      qrc_closed: 'qrc:view',
      daily_review_signoffs: 'daily_reviews:view',
      ppr: 'ppr:view',
    })
  })

  it('every domain has a non-empty label', () => {
    for (const d of USER_ACTIVITY_DOMAINS) expect(d.label.length).toBeGreaterThan(0)
  })
})

describe('actorKeyFor grouping precedence', () => {
  it('uuid wins even when a free-text name is also present', () => {
    expect(actorKeyFor(U1, 'SSgt Jane Doe')).toEqual({ kind: 'profile', key: U1 })
  })

  it('null uuid + non-empty text falls back to the normalized unlinked key', () => {
    expect(actorKeyFor(null, ' SSgt Jane Doe ')).toEqual({ kind: 'unlinked', key: 'ssgt jane doe' })
  })

  it('whitespace-only or missing name is unattributed', () => {
    expect(actorKeyFor(null, '   ')).toEqual({ kind: 'unattributed', key: 'unattributed' })
    expect(actorKeyFor(null, null)).toEqual({ kind: 'unattributed', key: 'unattributed' })
  })
})

describe('buildActivityMatrix', () => {
  it('groups uuid records onto one profile row across domains', () => {
    const data = buildActivityMatrix(
      [
        raw({ domain: 'checks', actorId: U1 }),
        raw({ domain: 'inspections', actorId: U1 }),
        raw({ domain: 'checks', actorId: U2 }),
      ],
      profileMap(jane, bob),
      ALL,
    )
    expect(data.rows).toHaveLength(2)
    const janeRow = data.rows.find((r) => r.key === U1)!
    expect(janeRow.kind).toBe('profile')
    expect(janeRow.display).toBe('SSgt Jane Doe (JD)')
    expect(janeRow.counts.checks).toBe(1)
    expect(janeRow.counts.inspections).toBe(1)
    expect(janeRow.total).toBe(2)
  })

  it('buckets free-text names case/whitespace-normalized, display verbatim first-seen', () => {
    const data = buildActivityMatrix(
      [
        raw({ actorName: 'SSgt Jane Doe' }),
        raw({ actorName: '  ssgt jane doe  ' }),
        raw({ actorName: 'SSGT JANE DOE' }),
      ],
      profileMap(),
      ALL,
    )
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].kind).toBe('unlinked')
    expect(data.rows[0].key).toBe('ssgt jane doe')
    expect(data.rows[0].display).toBe('SSgt Jane Doe')
    expect(data.rows[0].total).toBe(3)
  })

  it('records with neither uuid nor name land on a single Unattributed row', () => {
    const data = buildActivityMatrix(
      [raw({}), raw({ domain: 'ppr' })],
      profileMap(),
      ALL,
    )
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]).toMatchObject({ kind: 'unattributed', key: 'unattributed', display: 'Unattributed', total: 2 })
  })

  it('labels the unattributed row "Former user" when an orphaned uuid contributed', () => {
    const data = buildActivityMatrix(
      [raw({ actorId: GONE })],
      profileMap(jane),
      ALL,
    )
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].kind).toBe('unattributed')
    expect(data.rows[0].display).toBe('Former user')
  })

  it('an orphaned uuid does NOT fall back to its free-text name', () => {
    const data = buildActivityMatrix(
      [raw({ actorId: GONE, actorName: 'SSgt Jane Doe' })],
      profileMap(),
      ALL,
    )
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].kind).toBe('unattributed')
    expect(data.rows[0].display).toBe('Former user')
  })

  it('totals column and per-domain totals row are exact', () => {
    const data = buildActivityMatrix(
      [
        raw({ domain: 'checks', actorId: U1 }),
        raw({ domain: 'checks', actorId: U2 }),
        raw({ domain: 'checks', actorName: 'A Rae' }),
        raw({ domain: 'ppr', actorId: U1 }),
        raw({ domain: 'ppr' }),
      ],
      profileMap(jane, bob),
      ALL,
    )
    expect(data.totals.checks).toBe(3)
    expect(data.totals.ppr).toBe(2)
    expect(data.totals.inspections).toBe(0)
    const rowSum = data.rows.reduce((acc, r) => acc + r.total, 0)
    expect(rowSum).toBe(5)
    // Per-domain totals equal the column sums across all rows.
    for (const d of ALL) {
      const colSum = data.rows.reduce((acc, r) => acc + r.counts[d], 0)
      expect(data.totals[d]).toBe(colSum)
    }
  })

  it('sorts total desc, then display name asc', () => {
    const data = buildActivityMatrix(
      [
        raw({ actorId: U2 }),                       // Bob: 1
        raw({ actorId: U1 }),
        raw({ actorId: U1, domain: 'ppr' }),        // Jane: 2
        raw({ actorName: 'Aaron Zed' }),            // unlinked: 1
      ],
      profileMap(jane, bob),
      ALL,
    )
    expect(data.rows.map((r) => r.display)).toEqual([
      'SSgt Jane Doe (JD)',   // total 2
      'Aaron Zed',            // total 1, "A" < "S"
      'SrA Bob Adams (BA)',   // total 1
    ])
  })

  it('captures drill-down records with id/label/ts/href during counting', () => {
    const data = buildActivityMatrix(
      [
        raw({ domain: 'checks', actorId: U1, id: 'c1', label: 'AC-0001', ts: '2026-07-02T08:00:00.000Z', href: '/checks/c1' }),
        raw({ domain: 'wildlife_sightings', actorId: U1, id: 'w1', label: 'Canada Goose', ts: '2026-07-02T09:00:00.000Z', href: null }),
      ],
      profileMap(jane),
      ALL,
    )
    const row = data.rows[0]
    expect(row.records.checks).toEqual([
      { id: 'c1', label: 'AC-0001', ts: '2026-07-02T08:00:00.000Z', href: '/checks/c1' },
    ])
    expect(row.records.wildlife_sightings).toEqual([
      { id: 'w1', label: 'Canada Goose', ts: '2026-07-02T09:00:00.000Z', href: null },
    ])
    expect(row.records.ppr).toBeUndefined()
  })

  it('empty input yields an empty matrix with zero totals', () => {
    const data = buildActivityMatrix([], profileMap(), ALL)
    expect(data.rows).toEqual([])
    for (const d of ALL) expect(data.totals[d]).toBe(0)
    expect(data.coverageNotes).toEqual([])
  })
})

describe('daily-review slot fan-out', () => {
  function reviewRow(overrides: Partial<DailyReviewSignoffSource> = {}): DailyReviewSignoffSource {
    return {
      id: 'dr-1',
      review_date: '2026-07-01',
      day_amsl_signed_by: null, day_amsl_signed_at: null,
      swing_amsl_signed_by: null, swing_amsl_signed_at: null,
      mid_amsl_signed_by: null, mid_amsl_signed_at: null,
      namo_signed_by: null, namo_signed_at: null,
      afm_signed_by: null, afm_signed_at: null,
      ...overrides,
    }
  }

  it('emits one raw row per non-null signed slot', () => {
    const rows = expandDailyReviewRows([
      reviewRow({
        day_amsl_signed_by: U1, day_amsl_signed_at: '2026-07-01T14:00:00.000Z',
        namo_signed_by: U1, namo_signed_at: '2026-07-01T20:00:00.000Z',
        afm_signed_by: U2, afm_signed_at: '2026-07-02T01:00:00.000Z',
      }),
    ])
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.domain === 'daily_review_signoffs')).toBe(true)
    expect(new Set(rows.map((r) => r.id)).size).toBe(3)
    expect(rows.every((r) => r.label.includes('2026-07-01'))).toBe(true)
  })

  it('a user signing AMSL + NAMO slots earns 2 sign-offs for that day', () => {
    const rows = expandDailyReviewRows([
      reviewRow({
        day_amsl_signed_by: U1, day_amsl_signed_at: '2026-07-01T14:00:00.000Z',
        namo_signed_by: U1, namo_signed_at: '2026-07-01T20:00:00.000Z',
      }),
    ])
    const data = buildActivityMatrix(rows, profileMap(jane), ALL)
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].counts.daily_review_signoffs).toBe(2)
    expect(data.rows[0].total).toBe(2)
  })

  it('falls back to review_date as ts when signed_at is null', () => {
    const rows = expandDailyReviewRows([reviewRow({ afm_signed_by: U2 })])
    expect(rows).toHaveLength(1)
    expect(rows[0].ts).toBe('2026-07-01')
  })

  it('defaults to the USAF slot label when no base is threaded through', () => {
    const rows = expandDailyReviewRows([
      reviewRow({ namo_signed_by: U1, namo_signed_at: '2026-07-01T20:00:00.000Z' }),
    ])
    expect(rows[0].label).toBe('Daily review 2026-07-01 — NAMO')
  })

  it('threads the base config through to getSlotLabel for civilian slot labels', () => {
    const rows = expandDailyReviewRows(
      [
        reviewRow({
          day_amsl_signed_by: U1, day_amsl_signed_at: '2026-07-01T14:00:00.000Z',
          namo_signed_by: U1, namo_signed_at: '2026-07-01T20:00:00.000Z',
        }),
      ],
      { airport_type: 'faa_part139' },
    )
    const dayLabel = rows.find((r) => r.id === 'dr-1:day_amsl')!.label
    const namoLabel = rows.find((r) => r.id === 'dr-1:namo')!.label
    expect(dayLabel).toBe('Daily review 2026-07-01 — Day Shift Lead')
    expect(namoLabel).toBe('Daily review 2026-07-01 — Ops Supervisor')
  })

  it('honors a base custom shift name over the civilian default', () => {
    const rows = expandDailyReviewRows(
      [reviewRow({ day_amsl_signed_by: U1, day_amsl_signed_at: '2026-07-01T14:00:00.000Z' })],
      { airport_type: 'faa_part139', shift_name_day: 'Alpha' },
    )
    expect(rows[0].label).toBe('Daily review 2026-07-01 — Alpha Lead')
  })
})

describe('injectZeroActivityRows', () => {
  const baseData = () =>
    buildActivityMatrix([raw({ actorId: U1 })], profileMap(jane), ALL)

  const member = (p: SignerInfo, role: string): ZeroActivityMember => ({ ...p, role })

  it('appends all-zero rows for members with no counted records', () => {
    const data = injectZeroActivityRows(baseData(), [member(jane, 'namo'), member(bob, 'amops')])
    expect(data.rows).toHaveLength(2)
    const bobRow = data.rows.find((r) => r.key === U2)!
    expect(bobRow.total).toBe(0)
    expect(bobRow.display).toBe('SrA Bob Adams (BA)')
    for (const d of ALL) expect(bobRow.counts[d]).toBe(0)
    expect(bobRow.records).toEqual({})
    // Zero rows sort below active rows.
    expect(data.rows[0].key).toBe(U1)
  })

  it('excludes kiosk/service roles', () => {
    expect(ZERO_ACTIVITY_EXCLUDED_ROLES).toEqual(['airfield_status', 'atc', 'ppr', 'read_only'])
    const members = ZERO_ACTIVITY_EXCLUDED_ROLES.map((role, i) =>
      member({ id: `kiosk-${i}`, name: `Kiosk ${role}`, rank: null, operating_initials: null }, role))
    const data = injectZeroActivityRows(baseData(), members)
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].key).toBe(U1)
  })

  it('never duplicates a member already present in the matrix', () => {
    const data = injectZeroActivityRows(baseData(), [member(jane, 'airfield_manager')])
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].total).toBe(1)
  })

  it('leaves totals untouched', () => {
    const before = baseData()
    const after = injectZeroActivityRows(before, [member(bob, 'amops')])
    expect(after.totals).toEqual(before.totals)
  })
})
