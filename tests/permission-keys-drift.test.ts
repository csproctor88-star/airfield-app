import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PERM } from '@/lib/permissions'

// Parses the canonical permission-key catalogue out of every
// `INSERT INTO permissions (...) VALUES ... ON CONFLICT` block
// across the migration tree, and diffs it against the `PERM`
// constants exported from lib/permissions.ts. Catches the drift
// case where a new key is added in SQL but not mirrored in TS
// (or vice versa).

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations')

function extractCatalogueKeys(sql: string): string[] {
  const keys: string[] = []
  const blockRe =
    /INSERT\s+INTO\s+permissions\s*\([^)]*\)\s*VALUES\s*([\s\S]*?)ON\s+CONFLICT/gi
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(sql)) !== null) {
    const rowRe = /\(\s*'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(block[1])) !== null) {
      keys.push(m[1])
    }
  }
  return keys
}

describe('PERM ↔ permissions catalogue drift', () => {
  const allSql = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
  const catalogueKeys = extractCatalogueKeys(allSql)
  const permValues = Object.values(PERM)

  it('parses a non-empty catalogue from the migration', () => {
    expect(catalogueKeys.length).toBeGreaterThan(50)
  })

  it('catalogue has no duplicate keys', () => {
    const dupes = catalogueKeys.filter((k, i) => catalogueKeys.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })

  it('PERM has no duplicate values', () => {
    const dupes = permValues.filter((k, i) => permValues.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })

  it('every PERM value exists in the migration catalogue', () => {
    const cat = new Set(catalogueKeys)
    const missingInSql = permValues.filter((v) => !cat.has(v))
    expect(missingInSql).toEqual([])
  })

  it('every migration catalogue key has a PERM constant', () => {
    const perm = new Set<string>(permValues)
    const missingInTs = catalogueKeys.filter((k) => !perm.has(k))
    expect(missingInTs).toEqual([])
  })

  it('PERM and catalogue have the same cardinality', () => {
    expect(permValues.length).toBe(catalogueKeys.length)
  })
})
