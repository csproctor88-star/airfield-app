import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  INTERVAL_DAYS,
  getRegReviewStatus,
  computeDueRegIds,
  partitionCompliance,
} from '@/lib/local-regs/review-status'

// ─────────────────────────────────────────────────────────────
// Pure-function unit tests per the design spec's §Testing unit list:
// docs/superpowers/specs/2026-07-16-local-regulations-review-design.md
// ─────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-17T12:00:00Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86400000).toISOString()
}

describe('getRegReviewStatus', () => {
  it('never — no review row from this user', () => {
    const status = getRegReviewStatus({ version: 1, review_interval: 'monthly' }, null, NOW)
    expect(status).toEqual({ state: 'never', reviewedAt: null, daysSinceReview: null })
  })

  it('never — undefined review is treated the same as null', () => {
    const status = getRegReviewStatus({ version: 1, review_interval: 'monthly' }, undefined, NOW)
    expect(status.state).toBe('never')
  })

  it('boundary — exactly 30 days since review is current (monthly)', () => {
    const status = getRegReviewStatus(
      { version: 1, review_interval: 'monthly' },
      { reviewed_at: daysAgo(30), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('current')
    expect(status.daysSinceReview).toBe(30)
  })

  it('boundary — 31 days since review is overdue (monthly, strict >)', () => {
    const status = getRegReviewStatus(
      { version: 1, review_interval: 'monthly' },
      { reviewed_at: daysAgo(31), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('overdue')
    expect(status.daysSinceReview).toBe(31)
  })

  it('boundary — exactly 90 days since review is current (quarterly)', () => {
    const status = getRegReviewStatus(
      { version: 1, review_interval: 'quarterly' },
      { reviewed_at: daysAgo(90), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('current')
  })

  it('boundary — 91 days since review is overdue (quarterly, strict >)', () => {
    const status = getRegReviewStatus(
      { version: 1, review_interval: 'quarterly' },
      { reviewed_at: daysAgo(91), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('overdue')
  })

  it('mixed intervals — a doc reviewed 40 days ago is overdue monthly but current quarterly', () => {
    const review = { reviewed_at: daysAgo(40), version_at_review: 1 }
    expect(getRegReviewStatus({ version: 1, review_interval: 'monthly' }, review, NOW).state).toBe('overdue')
    expect(getRegReviewStatus({ version: 1, review_interval: 'quarterly' }, review, NOW).state).toBe('current')
  })

  it('updated — version > version_at_review even inside the window (reviewed yesterday, doc replaced today)', () => {
    const status = getRegReviewStatus(
      { version: 2, review_interval: 'monthly' },
      { reviewed_at: daysAgo(1), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('updated')
  })

  it('updated wins over overdue — stale review AND a version bump', () => {
    const status = getRegReviewStatus(
      { version: 2, review_interval: 'monthly' },
      { reviewed_at: daysAgo(200), version_at_review: 1 },
      NOW,
    )
    expect(status.state).toBe('updated')
  })

  it('INTERVAL_DAYS matches the spec (30 / 90)', () => {
    expect(INTERVAL_DAYS).toEqual({ monthly: 30, quarterly: 90 })
  })
})

describe('computeDueRegIds', () => {
  const regs = [
    { id: 'a', version: 1, review_interval: 'monthly' as const, is_archived: false },
    { id: 'b', version: 1, review_interval: 'monthly' as const, is_archived: false },
    { id: 'c', version: 1, review_interval: 'monthly' as const, is_archived: true },
    { id: 'd', version: 2, review_interval: 'quarterly' as const, is_archived: false },
  ]

  it('archived docs are excluded even with no review', () => {
    expect(computeDueRegIds(regs, [], NOW)).not.toContain('c')
  })

  it('a doc with no review is due (never)', () => {
    expect(computeDueRegIds(regs, [], NOW)).toContain('a')
  })

  it('per-doc interval mix — a current review is not due', () => {
    const reviews = [
      { regulation_id: 'a', reviewed_at: daysAgo(5), version_at_review: 1 },
      { regulation_id: 'b', reviewed_at: daysAgo(5), version_at_review: 1 },
      { regulation_id: 'd', reviewed_at: daysAgo(5), version_at_review: 2 },
    ]
    const due = computeDueRegIds(regs, reviews, NOW)
    expect(due).not.toContain('a')
    expect(due).not.toContain('b')
    expect(due).not.toContain('d')
  })

  it('a version mismatch counts as due (updated)', () => {
    const reviews = [{ regulation_id: 'd', reviewed_at: daysAgo(1), version_at_review: 1 }] // d is v2 now
    expect(computeDueRegIds(regs, reviews, NOW)).toContain('d')
  })

  it('only the latest review per reg is considered (out-of-order rows)', () => {
    // Older row says version_at_review 1 (stale — would read as updated),
    // but the LATEST row is at the live version and recent — not due.
    const reviews = [
      { regulation_id: 'a', reviewed_at: daysAgo(2), version_at_review: 1 }, // latest, current
      { regulation_id: 'a', reviewed_at: daysAgo(100), version_at_review: 1 }, // older, would be overdue alone
    ]
    expect(computeDueRegIds(regs, reviews, NOW)).not.toContain('a')
  })
})

describe('partitionCompliance', () => {
  const reg = { version: 1, review_interval: 'monthly' as const }
  const roster = [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]

  it('splits roster into reviewed (current) vs outstanding', () => {
    const reviews = [
      { user_id: 'u1', reviewed_at: daysAgo(2), version_at_review: 1, initials_snapshot: 'AB' },
    ]
    const { reviewed, outstanding } = partitionCompliance(reg, roster, reviews, NOW)
    expect(Array.from(reviewed.keys())).toEqual(['u1'])
    expect(reviewed.get('u1')).toEqual({ reviewed_at: reviews[0].reviewed_at, initials: 'AB' })
    expect(outstanding.sort()).toEqual(['u2', 'u3'])
  })

  it('a review at an old version counts as outstanding (doc was replaced since)', () => {
    const reviews = [
      { user_id: 'u1', reviewed_at: daysAgo(1), version_at_review: 1, initials_snapshot: 'AB' },
    ]
    // Doc is now at version 2 — u1's review is stale even though recent.
    const { reviewed, outstanding } = partitionCompliance({ version: 2, review_interval: 'monthly' }, roster, reviews, NOW)
    expect(reviewed.size).toBe(0)
    expect(outstanding.sort()).toEqual(['u1', 'u2', 'u3'])
  })

  it('an out-of-roster reviewer folds into the reviewed map without inflating the roster', () => {
    const reviews = [
      { user_id: 'u1', reviewed_at: daysAgo(2), version_at_review: 1, initials_snapshot: 'AB' },
      { user_id: 'outsider', reviewed_at: daysAgo(2), version_at_review: 1, initials_snapshot: 'XY' },
    ]
    const { reviewed, outstanding } = partitionCompliance(reg, roster, reviews, NOW)
    expect(reviewed.has('outsider')).toBe(true)
    expect(reviewed.get('outsider')).toEqual({ reviewed_at: reviews[1].reviewed_at, initials: 'XY' })
    // The Y denominator stays the roster's size — 'outsider' never appears
    // in outstanding, and outstanding is still exactly roster minus u1.
    expect(outstanding.sort()).toEqual(['u2', 'u3'])
    expect(roster).toHaveLength(3) // roster itself is untouched
  })

  it('only the latest review per user is considered for one reg', () => {
    const reviews = [
      { user_id: 'u1', reviewed_at: daysAgo(1), version_at_review: 1, initials_snapshot: 'NEW' },
      { user_id: 'u1', reviewed_at: daysAgo(200), version_at_review: 1, initials_snapshot: 'OLD' },
    ]
    const { reviewed } = partitionCompliance(reg, roster, reviews, NOW)
    expect(reviewed.get('u1')?.initials).toBe('NEW')
  })
})

describe('generateLocalRegsReviewPdf', () => {
  it('returns a {doc, filename} and does not throw for an empty base (no regs, no reviewers)', async () => {
    const { generateLocalRegsReviewPdf } = await import('@/lib/local-regs-review-pdf')
    const { doc, filename } = await generateLocalRegsReviewPdf({
      baseName: 'Example AFB',
      baseIcao: 'KXYZ',
      regs: [],
      reviewers: [],
      reviews: [],
      generatedAtIso: '2026-07-17T15:00:00Z',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('local-regs-review-kxyz-2026-07-17.pdf')
  })

  it('falls back to "base" in the filename when no ICAO is supplied', async () => {
    const { generateLocalRegsReviewPdf } = await import('@/lib/local-regs-review-pdf')
    const { filename } = await generateLocalRegsReviewPdf({
      regs: [], reviewers: [], reviews: [],
      generatedAtIso: '2026-07-17T15:00:00Z',
    })
    expect(filename).toBe('local-regs-review-base-2026-07-17.pdf')
  })

  it('renders reviewed + outstanding rows without throwing (contract check, not pixel content)', async () => {
    const { generateLocalRegsReviewPdf } = await import('@/lib/local-regs-review-pdf')
    const reg = {
      id: 'reg-1', base_id: 'base-1', title: 'Local OI 13-204 — Airfield Operations',
      description: null, storage_path: 'x', file_name: 'oi.pdf', mime_type: 'application/pdf',
      file_size_bytes: 1024, version: 2, review_interval: 'monthly' as const, is_archived: false,
      created_by: null, created_at: daysAgo(60), updated_at: daysAgo(1),
    }
    const reviewers = [
      { user_id: 'u1', name: 'Snuffy', rank: 'SSgt', operating_initials: 'JS', role: 'airfield_manager' },
      { user_id: 'u2', name: 'Doe', rank: 'A1C', operating_initials: null, role: 'amops' },
    ]
    const reviews = [
      { id: 'r1', base_id: 'base-1', regulation_id: 'reg-1', user_id: 'u1', reviewed_at: daysAgo(1), version_at_review: 2, initials_snapshot: 'JS', created_at: daysAgo(1) },
    ]
    const { doc, filename } = await generateLocalRegsReviewPdf({
      baseName: 'Example AFB', baseIcao: 'KXYZ',
      regs: [reg], reviewers, reviews,
      generatedAtIso: '2026-07-17T15:00:00Z',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toMatch(/\.pdf$/)
  })
})

// ─────────────────────────────────────────────────────────────
// Static RLS guard for the staged local_regs migrations.
//
// tests/rls-cross-base-isolation.test.ts and tests/rls-smoke.test.ts are
// LIVE integration tests: they sign in as real seeded accounts
// (supabase/seed-test-accounts.mjs) and issue real queries against the
// linked Supabase project, gated only by TEST_RLS_* env presence — which
// this repo's .env.local has, so they are NOT skipped; they run for real
// on every `vitest run` (confirmed empirically before writing this file).
// They do not parse or replay migration SQL; that idiom belongs to
// tests/permission-matrix-roles.test.ts / permission-keys-drift.test.ts.
//
// The task's hard rule is migrations-staged-only: nothing may run against
// the linked/remote DB. local_regulations / local_regulation_reviews do
// not exist there yet (2026071730-33 are unapplied), so adding live cases
// for them to the two files above would fail against a missing relation
// (breaking this very gate) or require applying the migrations first —
// out of scope for this task. Once the owner applies them, a follow-up
// should add the live cross-base / insert-denial cases there, mirroring
// the existing `discrepancies` cases exactly.
//
// Until then, this guard verifies the same invariants statically against
// the migration SQL text itself, so a regression in the staged policy
// text fails a test today instead of silently drifting until apply time.
describe('local_regs RLS guard (static — migration SQL, not the live DB)', () => {
  const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations')
  const tablesSql = readFileSync(path.join(MIGRATIONS_DIR, '2026071731_local_regs_tables.sql'), 'utf8')
  const storageSql = readFileSync(path.join(MIGRATIONS_DIR, '2026071732_local_regs_storage.sql'), 'utf8')

  it('every local_regulations policy is scoped by base access (cross-base isolation)', () => {
    const policies = tablesSql.match(/CREATE POLICY "local_regulations_\w+"[\s\S]*?;/g) ?? []
    expect(policies).toHaveLength(4)
    for (const p of policies) expect(p).toContain('user_has_base_access(auth.uid(), base_id)')
  })

  it('local_regulations select/insert/update/delete require the matching permission key', () => {
    const get = (name: string) => tablesSql.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`))?.[0] ?? ''
    expect(get('local_regulations_select')).toContain("'local_regs:view'")
    expect(get('local_regulations_insert')).toContain("'local_regs:manage'")
    expect(get('local_regulations_update')).toContain("'local_regs:manage'")
    expect(get('local_regulations_delete')).toContain("'local_regs:manage'")
  })

  it('local_regulation_reviews has exactly select + insert policies — no update/delete path', () => {
    const policies = Array.from(
      tablesSql.matchAll(/CREATE POLICY "(local_regulation_reviews_\w+)" ON local_regulation_reviews\s+FOR (\w+)/g),
    ).map((m) => ({ name: m[1], cmd: m[2] }))
    expect(policies.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'local_regulation_reviews_insert', cmd: 'INSERT' },
      { name: 'local_regulation_reviews_select', cmd: 'SELECT' },
    ])
  })

  it('the reviews insert policy denies another user_id and enforces version equality against the live doc version', () => {
    const insertPolicy = tablesSql.match(/CREATE POLICY "local_regulation_reviews_insert"[\s\S]*?;/)?.[0] ?? ''
    expect(insertPolicy).toContain('user_id = auth.uid()')
    expect(insertPolicy).toContain("user_has_permission(auth.uid(), 'local_regs:view')")
    expect(insertPolicy).toMatch(
      /version_at_review\s*=\s*\(\s*SELECT\s+version\s+FROM\s+local_regulations\s+WHERE\s+id\s*=\s*regulation_id\s*\)/,
    )
  })

  it('storage policies gate read on local_regs:view, insert/delete on local_regs:manage, scoped by base access', () => {
    const get = (name: string) => storageSql.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`))?.[0] ?? ''
    const readPolicy = get('local_regs_storage_read')
    const insertPolicy = get('local_regs_storage_insert')
    const deletePolicy = get('local_regs_storage_delete')
    expect(readPolicy).toContain("'local_regs:view'")
    expect(insertPolicy).toContain("'local_regs:manage'")
    expect(deletePolicy).toContain("'local_regs:manage'")
    for (const p of [readPolicy, insertPolicy, deletePolicy]) {
      expect(p).toContain('user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1]')
    }
  })
})
