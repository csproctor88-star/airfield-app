import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// User-deletion invariant guard.
//
// Deleting a profile must never fail with a foreign-key violation. Every
// profiles(id) FK column that records *who* did something on an operational
// row must be ON DELETE SET NULL so the row survives and just loses the actor
// link. Migrations 2026022802 + 2026061504 converted every such column that
// existed at the time; the live DB has zero NO ACTION profiles FKs.
//
// The regression risk is a *future* migration that reintroduces the gap, e.g.
//   created_by UUID REFERENCES profiles(id)        -- defaults to NO ACTION
// which would silently start blocking user deletion again. This test fails any
// migration newer than the 2026061504 fix that references profiles without an
// ON DELETE clause on the same statement line. Older migrations are
// grandfathered — they were swept by the two fixer migrations and verified
// against the live schema (pg_constraint.confdeltype). If you add a profiles
// FK, declare ON DELETE SET NULL (or CASCADE for owned/junction rows).
const FIX_MIGRATION_PREFIX = '2026061504'
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

describe('profiles FK on-delete guard', () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    // Only police migrations created after the fix. The prefix is the
    // YYYYMMDDXX sequence number, so lexicographic > is chronological >.
    .filter((f) => f.slice(0, FIX_MIGRATION_PREFIX.length) > FIX_MIGRATION_PREFIX)

  it('every new migration referencing profiles declares an ON DELETE action', () => {
    const offenders: string[] = []
    for (const file of files) {
      const lines = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (/references\s+profiles\b/i.test(line) && !/on\s+delete/i.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`)
        }
      })
    }
    expect(
      offenders,
      `profiles(id) FK without ON DELETE (would block user deletion):\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
