import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── AMTR upsert UNIQUE-constraint guard ───
// Locks in the silent-save fix shipped with this batch. Every progress
// table in AMTR has a UNIQUE constraint on (member_id, catalog_id) — or
// (member_id, catalog_id, year_label) for 1098. Without an explicit
// `onConflict`, supabase-js falls back to primary-key detection; when the
// payload omits `id`, it INSERTs and silently fails on the UNIQUE
// constraint without surfacing an error. The HAF Formal Training
// "Complete Date doesn't save" bug was exactly this. Pattern per
// feedback_audit_invariant_guard_test.md.

const PROGRESS_TABLES = [
  'amtr_formal_progress',
  'amtr_qual_progress',
  'amtr_jqs_progress',
  'amtr_1098_progress',
  'amtr_rat_progress',
  'amtr_milestone_progress',
]

function readAllFiles(dir: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) out.push(...readAllFiles(full))
    else if (name.isFile() && /\.(ts|tsx)$/.test(name.name)) {
      out.push({ path: full, source: readFileSync(full, 'utf-8') })
    }
  }
  return out
}

describe('AMTR upsert UNIQUE-constraint guard', () => {
  const ROOTS = ['components/amtr', 'lib/amtr-record-import.ts']
  const files: { path: string; source: string }[] = []
  for (const r of ROOTS) {
    try {
      const stat = readFileSync(r, 'utf-8')
      files.push({ path: r, source: stat })
    } catch {
      try { files.push(...readAllFiles(r)) } catch { /* dir missing */ }
    }
  }

  for (const table of PROGRESS_TABLES) {
    it(`every upsertAmtrRow('${table}', …) sets onConflict`, () => {
      const offenders: string[] = []
      for (const f of files) {
        // Find every upsertAmtrRow call targeting this table. Match the
        // call expression up to its closing paren (lazy, allowing nested
        // braces in the row literal). Then check whether `onConflict`
        // appears anywhere in the matched expression.
        const callPattern = new RegExp(
          `upsertAmtrRow\\(\\s*['"\`]${table}['"\`][\\s\\S]*?\\)\\s*$`,
          'gm',
        )
        const broadPattern = new RegExp(
          `upsertAmtrRow\\(\\s*['"\`]${table}['"\`][\\s\\S]{0,800}?(?=\\n\\s*(?:if|const|await|return|onChange|\\}|//))`,
          'g',
        )
        const matches = f.source.match(broadPattern) ?? f.source.match(callPattern) ?? []
        for (const m of matches) {
          if (!/onConflict/.test(m)) {
            offenders.push(`${f.path}: ${m.split('\n')[0].slice(0, 100)}…`)
          }
        }
      }
      expect(offenders, `Missing onConflict on ${table} upsert (would silently fail UNIQUE)`).toEqual([])
    })
  }

  it('still finds the known callsites (sanity check the regex)', () => {
    // If the regex stops matching real code (e.g., after a refactor),
    // the "every callsite has onConflict" tests above silently pass even
    // when broken. This sanity check ensures the regex is actually
    // exercising at least one match per table that should have one.
    const tablesWithKnownCallsites = ['amtr_formal_progress', 'amtr_1098_progress', 'amtr_jqs_progress', 'amtr_rat_progress']
    for (const table of tablesWithKnownCallsites) {
      const found = files.some((f) =>
        new RegExp(`upsertAmtrRow\\(\\s*['"\`]${table}['"\`]`).test(f.source),
      )
      expect(found, `Sanity: no upsertAmtrRow('${table}', …) call found at all — regex stale?`).toBe(true)
    }
  })
})
