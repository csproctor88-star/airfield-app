import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PERM } from '@/lib/permissions'

// Parses every role_permissions INSERT / DELETE across the
// migration tree, replays them in migration-filename order, and
// asserts each role's effective permission set matches its
// documented contract. If the SQL drifts, these fail — loudly.

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations')
const ALL_PERM_KEYS = new Set<string>(Object.values(PERM))

// ── Catalogue parser (reused from drift test) ──────────────
function extractCatalogue(sql: string): string[] {
  const keys: string[] = []
  const blockRe =
    /INSERT\s+INTO\s+permissions\s*\([^)]*\)\s*VALUES\s*([\s\S]*?)ON\s+CONFLICT/gi
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(sql)) !== null) {
    Array.from(block[1].matchAll(/\(\s*'([^']+)'/g)).forEach((row) => keys.push(row[1]))
  }
  return keys
}

// ── Tiny SQL interpreter, scoped to role_permissions ───────
function matchesWhere(key: string, where: string): boolean {
  // Migration patterns:
  //   key NOT IN ('k1', 'k2', ...)
  //   key IN ('k1', 'k2', ...)
  //   key LIKE '%:view'
  //   Joined by OR (no AND in our migrations, no parens)
  for (const raw of where.split(/\bOR\b/i)) {
    const clause = raw.trim()
    let m: RegExpMatchArray | null
    if ((m = clause.match(/^key\s+NOT\s+IN\s*\(([^)]+)\)$/i))) {
      const ex = Array.from(m[1].matchAll(/'([^']*)'/g)).map((x) => x[1])
      if (!ex.includes(key)) return true
    } else if ((m = clause.match(/^key\s+IN\s*\(([^)]+)\)$/i))) {
      const inc = Array.from(m[1].matchAll(/'([^']*)'/g)).map((x) => x[1])
      if (inc.includes(key)) return true
    } else if ((m = clause.match(/^key\s+LIKE\s+'([^']+)'$/i))) {
      const re = new RegExp('^' + m[1].replace(/%/g, '.*') + '$')
      if (re.test(key)) return true
    }
  }
  return false
}

function stripSqlComments(sql: string): string {
  // Strip `--` line comments (which may contain semicolons) and `/* … */`
  // block comments. Single-quoted strings in our migrations never contain
  // `--`, so a simple line-level strip is safe here.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function replayMigrations(
  sqlBlobs: string[],
  catalogue: string[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const ensure = (r: string) => {
    let s = map.get(r)
    if (!s) {
      s = new Set()
      map.set(r, s)
    }
    return s
  }

  for (const sql of sqlBlobs) {
    // Strip comments first, then split on `;` — role_permissions statements
    // don't embed semicolons in quoted strings after stripping.
    const clean = stripSqlComments(sql)
    for (const raw of clean.split(';')) {
      const stmt = raw.trim()
      if (!stmt) continue
      let m: RegExpMatchArray | null

      // Unconditional wipe (Phase A line 130)
      if (/^DELETE\s+FROM\s+role_permissions\s*$/i.test(stmt)) {
        map.clear()
        continue
      }

      // DELETE FROM role_permissions WHERE role IN (...) [AND permission_key ...]
      //
      // Three shapes:
      //   (a) plain role IN (...)               → wipe all perms for those roles
      //   (b) ... AND permission_key LIKE 'X%'  → drop matching perms only
      //   (c) ... AND permission_key IN (...)   → drop those exact perms only
      //   (d) ... AND permission_key = 'X'      → drop that one perm only
      if ((m = stmt.match(/^DELETE\s+FROM\s+role_permissions\s+WHERE\s+role\s+IN\s*\(([^)]+)\)\s*(AND[\s\S]+)?$/i))) {
        const roles = Array.from(m[1].matchAll(/'([^']+)'/g)).map((x) => x[1])
        const andClause = (m[2] ?? '').replace(/^AND\s+/i, '').trim()
        if (!andClause) {
          roles.forEach((r) => map.delete(r))
          continue
        }
        // Build a key-match predicate from the AND clause
        let keyMatches: ((k: string) => boolean) | null = null
        const likeMatch = andClause.match(/^permission_key\s+LIKE\s+'([^']+)'/i)
        const inMatch = andClause.match(/^permission_key\s+IN\s*\(([^)]+)\)/i)
        const eqMatch = andClause.match(/^permission_key\s*=\s*'([^']+)'/i)
        if (likeMatch) {
          const re = new RegExp('^' + likeMatch[1].replace(/%/g, '.*') + '$')
          keyMatches = (k) => re.test(k)
        } else if (inMatch) {
          const keys = new Set(Array.from(inMatch[1].matchAll(/'([^']+)'/g)).map((x) => x[1]))
          keyMatches = (k) => keys.has(k)
        } else if (eqMatch) {
          const target = eqMatch[1]
          keyMatches = (k) => k === target
        }
        if (keyMatches) {
          roles.forEach((r) => {
            const set = map.get(r)
            if (!set) return
            for (const k of Array.from(set)) {
              if (keyMatches!(k)) set.delete(k)
            }
          })
        }
        continue
      }

      // INSERT INTO role_permissions (...) VALUES (...), (...), ...
      if ((m = stmt.match(/^INSERT\s+INTO\s+role_permissions\s*\([^)]*\)\s+VALUES\s+([\s\S]+)$/i))) {
        const body = m[1].replace(/\s+ON\s+CONFLICT[\s\S]*$/i, '')
        Array.from(body.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)).forEach((t) => {
          ensure(t[1]).add(t[2])
        })
        continue
      }

      // INSERT INTO role_permissions (...) SELECT 'role', key FROM permissions [WHERE ...]
      if ((m = stmt.match(
        /^INSERT\s+INTO\s+role_permissions\s*\([^)]*\)\s+SELECT\s+'([^']+)'\s*,\s*key\s+FROM\s+permissions(?:\s+WHERE\s+([\s\S]+))?$/i,
      ))) {
        const role = m[1]
        const where = m[2]?.trim()
        const set = ensure(role)
        for (const k of catalogue) {
          if (!where || matchesWhere(k, where)) set.add(k)
        }
        continue
      }
    }
  }

  return map
}

// ── Fixture: effective role → keys map ─────────────────────
const sqlBlobs = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort() // lexicographic sort is equivalent to chronological for YYYYMMDDXX names
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))

const combinedSql = sqlBlobs.join('\n')
const catalogue = extractCatalogue(combinedSql)
const rolePerms = replayMigrations(sqlBlobs, catalogue)

// Helpers
const has = (role: string, key: string) => rolePerms.get(role)?.has(key) === true
const keysOf = (role: string) => rolePerms.get(role) ?? new Set<string>()
const restrictedKeys = (role: string) =>
  Array.from(keysOf(role)).filter(
    (k) =>
      k.endsWith(':write') ||
      k.endsWith(':delete') ||
      k.endsWith(':manage') ||
      k.endsWith(':execute') ||
      k.endsWith(':cancel') ||
      k.endsWith(':close') ||
      k.endsWith(':file') ||
      k.endsWith(':review') ||
      k.endsWith(':configure') ||
      k.includes(':sign:') ||
      k.includes(':transition:') ||
      k.includes(':update:') ||
      k.includes(':add_note') ||
      k.includes(':write:') ||
      k.includes(':write_manual') ||
      k.includes(':manage_agencies'),
  )

describe('permission matrix — role preset contracts', () => {
  it('every role preset only contains keys present in the catalogue', () => {
    const catSet = new Set(catalogue)
    rolePerms.forEach((keys, role) => {
      const unknown = Array.from(keys).filter((k) => !catSet.has(k))
      expect({ role, unknown }).toEqual({ role, unknown: [] })
    })
  })

  it('every role preset only contains keys that have a PERM constant', () => {
    rolePerms.forEach((keys, role) => {
      const drifted = Array.from(keys).filter((k) => !ALL_PERM_KEYS.has(k))
      expect({ role, drifted }).toEqual({ role, drifted: [] })
    })
  })

  it('sys_admin has every PERM key', () => {
    const missing = Array.from(ALL_PERM_KEYS).filter((k) => !has('sys_admin', k))
    expect(missing).toEqual([])
  })

  // Today's AFM / NAMO / base_admin are parallel to sys_admin per Phase A
  it.each(['airfield_manager', 'namo', 'base_admin'])(
    '%s has every PERM key (parallel to sys_admin)',
    (role) => {
      const missing = Array.from(ALL_PERM_KEYS).filter((k) => !has(role, k))
      expect(missing).toEqual([])
    },
  )

  it('amops — full module writer, no admin', () => {
    expect(has('amops', PERM.DISCREPANCIES_WRITE)).toBe(true)
    expect(has('amops', PERM.DISCREPANCIES_CLOSE)).toBe(true)
    expect(has('amops', PERM.INSPECTIONS_WRITE)).toBe(true)
    expect(has('amops', PERM.INSPECTIONS_FILE)).toBe(true)
    expect(has('amops', PERM.PARKING_WRITE)).toBe(true)
    expect(has('amops', PERM.INFRASTRUCTURE_WRITE)).toBe(true)
    expect(has('amops', PERM.WILDLIFE_WRITE)).toBe(true)
    expect(has('amops', PERM.PHOTOS_WRITE)).toBe(true)
    expect(has('amops', PERM.BASE_SETUP_WRITE)).toBe(true)
    // No delete, no users:manage, no admin-view
    expect(has('amops', PERM.USERS_MANAGE)).toBe(false)
    expect(has('amops', PERM.USERS_VIEW)).toBe(false)
    expect(has('amops', PERM.DISCREPANCIES_DELETE)).toBe(false)
    expect(has('amops', PERM.FEEDBACK_CONFIGURE)).toBe(false)
  })

  it('ces — scoped to CES-allowed discrepancy transitions + photos:write only', () => {
    // CES-specific writes
    expect(has('ces', PERM.DISCREPANCIES_TRANSITION_CES)).toBe(true)
    expect(has('ces', PERM.DISCREPANCIES_UPDATE_RESOLUTION)).toBe(true)
    expect(has('ces', PERM.DISCREPANCIES_ADD_NOTE)).toBe(true)
    // Views
    expect(has('ces', PERM.CES_VIEW)).toBe(true)
    expect(has('ces', PERM.DISCREPANCIES_VIEW)).toBe(true)
    expect(has('ces', PERM.AIRFIELD_STATUS_VIEW)).toBe(true)
    expect(has('ces', PERM.INFRASTRUCTURE_VIEW)).toBe(true)
    expect(has('ces', PERM.PHOTOS_WRITE)).toBe(true)
    // Hard NOs
    expect(has('ces', PERM.DISCREPANCIES_WRITE)).toBe(false)
    expect(has('ces', PERM.DISCREPANCIES_DELETE)).toBe(false)
    expect(has('ces', PERM.DISCREPANCIES_CLOSE)).toBe(false)
    expect(has('ces', PERM.INSPECTIONS_WRITE)).toBe(false)
    expect(has('ces', PERM.USERS_MANAGE)).toBe(false)
    expect(has('ces', PERM.PHOTOS_DELETE)).toBe(false)
  })

  it('safety — wildlife writer + narrow RSC/BWC', () => {
    expect(has('safety', PERM.WILDLIFE_VIEW)).toBe(true)
    expect(has('safety', PERM.WILDLIFE_WRITE)).toBe(true)
    expect(has('safety', PERM.WILDLIFE_DELETE)).toBe(true)
    expect(has('safety', PERM.AIRFIELD_STATUS_WRITE_RSC_BWC_ONLY)).toBe(true)
    expect(has('safety', PERM.AIRFIELD_STATUS_VIEW)).toBe(true)
    expect(has('safety', PERM.PHOTOS_WRITE)).toBe(true)
    // Hard NOs — full airfield_status write, any other module writes
    expect(has('safety', PERM.AIRFIELD_STATUS_WRITE)).toBe(false)
    expect(has('safety', PERM.DISCREPANCIES_WRITE)).toBe(false)
    expect(has('safety', PERM.INSPECTIONS_WRITE)).toBe(false)
    expect(has('safety', PERM.USERS_MANAGE)).toBe(false)
  })

  it('atc — kiosk-equivalent (view only)', () => {
    // fpr:view was granted by 2026071720 per the FPR design spec, then
    // revoked by 2026071800 (owner ruling 2026-07-18: ATC does not need
    // the Flight Planning Room). Strictly view-only — no write/manage keys.
    // NOTE: the live DB also holds atc flip:view (2026062304 grants it via
    // a SELECT-from-VALUES form this file's parser doesn't recognize), so
    // this exact-set assertion sees one key fewer than production.
    expect(keysOf('atc')).toEqual(
      new Set([PERM.AIRFIELD_STATUS_VIEW, PERM.TRAINING_VIEW, PERM.SETTINGS_VIEW]),
    )
  })

  it('airfield_status — kiosk; ONLY airfield_status:view', () => {
    expect(keysOf('airfield_status')).toEqual(new Set([PERM.AIRFIELD_STATUS_VIEW]))
  })

  it('ppr — PPR writer + airfield status view', () => {
    expect(has('ppr', PERM.PPR_VIEW)).toBe(true)
    expect(has('ppr', PERM.PPR_WRITE)).toBe(true)
    expect(has('ppr', PERM.AIRFIELD_STATUS_VIEW)).toBe(true)
    expect(has('ppr', PERM.PHOTOS_WRITE)).toBe(true)
    // No other module writes, no delete
    expect(has('ppr', PERM.PPR_DELETE)).toBe(false)
    expect(has('ppr', PERM.DISCREPANCIES_WRITE)).toBe(false)
    expect(has('ppr', PERM.INSPECTIONS_WRITE)).toBe(false)
    expect(has('ppr', PERM.USERS_MANAGE)).toBe(false)
  })

  it('majcom_rfm — multi-base read-only + reports:export + installations:switch', () => {
    // The live DB drifted from this every-view contract between 2026-04-23
    // and 2026-07-18: the 2026042202 seed was a one-time LIKE-'%:view'
    // sweep, and this replay masks that by resolving SELECT grants against
    // the full final catalogue. 2026071800 trued the live DB up to the
    // contract (owner ruling 2026-07-18) with explicit VALUES grants.
    expect(has('majcom_rfm', PERM.INSTALLATIONS_SWITCH)).toBe(true)
    expect(has('majcom_rfm', PERM.REPORTS_EXPORT)).toBe(true)
    // Every :view key should be present
    const viewKeys = Array.from(ALL_PERM_KEYS).filter((k) => k.endsWith(':view'))
    const missingViews = viewKeys.filter((k) => !has('majcom_rfm', k))
    expect(missingViews).toEqual([])
    // No write keys whatsoever
    expect(restrictedKeys('majcom_rfm')).toEqual([])
  })

  it('read_only — every :view key + installations:switch; no writes', () => {
    expect(has('read_only', PERM.INSTALLATIONS_SWITCH)).toBe(true)
    // AMTR personnel-training data is intentionally carved out of the
    // "global read" scope — read_only / safety / atc had `amtr:view`
    // revoked by migration 2026052400. The contract here is "every
    // :view key EXCEPT amtr:*" (training records are AMOPS-internal
    // and not part of the general read-all surface).
    const EXCLUDED_VIEWS = new Set<string>([PERM.AMTR_VIEW])
    const viewKeys = Array.from(ALL_PERM_KEYS)
      .filter((k) => k.endsWith(':view'))
      .filter((k) => !EXCLUDED_VIEWS.has(k))
    const missingViews = viewKeys.filter((k) => !has('read_only', k))
    expect(missingViews).toEqual([])
    expect(restrictedKeys('read_only')).toEqual([])
    // read_only has NO reports:export (only majcom_rfm does)
    expect(has('read_only', PERM.REPORTS_EXPORT)).toBe(false)
  })

  it('only full-admin roles hold users:manage', () => {
    const admins = ['sys_admin', 'airfield_manager', 'namo', 'base_admin']
    rolePerms.forEach((keys, role) => {
      if (keys.has(PERM.USERS_MANAGE)) expect(admins).toContain(role)
    })
  })
})
