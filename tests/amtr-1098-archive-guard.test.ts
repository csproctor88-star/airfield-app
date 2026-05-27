import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ─── 1098 archive lock — protects historical records ───
// Guards the migration that ships per-year catalog isolation + archive.
// If a future migration drops or rewrites the write policies on
// amtr_1098_progress / amtr_1098_catalog and forgets the
// `is_1098_year_archived(...)` guard, archived years would silently
// become editable again — defeating the whole feature. This test reads
// the migration source and asserts the guard predicate is present in
// every write policy created here.

const MIGRATION = 'supabase/migrations/2026061400_amtr_1098_per_year_archive.sql'

describe('1098 archive lock — migration shape', () => {
  const sql = readFileSync(MIGRATION, 'utf-8')

  it('defines the is_1098_year_archived helper', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION is_1098_year_archived/)
  })

  it('amtr_1098_progress INSERT policy includes archive guard', () => {
    const block = sql.match(/CREATE POLICY[^;]*amtr_1098_progress_insert[\s\S]*?;/)
    expect(block, 'INSERT policy block not found').toBeTruthy()
    expect(block![0]).toMatch(/NOT is_1098_year_archived\(base_id,\s*year_label\)/)
  })

  it('amtr_1098_progress UPDATE policy includes archive guard', () => {
    const block = sql.match(/CREATE POLICY[^;]*amtr_1098_progress_update[\s\S]*?;/)
    expect(block, 'UPDATE policy block not found').toBeTruthy()
    expect(block![0]).toMatch(/NOT is_1098_year_archived\(base_id,\s*year_label\)/)
  })

  it('amtr_1098_progress DELETE policy includes archive guard', () => {
    const block = sql.match(/CREATE POLICY[^;]*amtr_1098_progress_delete[\s\S]*?;/)
    expect(block, 'DELETE policy block not found').toBeTruthy()
    expect(block![0]).toMatch(/NOT is_1098_year_archived\(base_id,\s*year_label\)/)
  })

  it('amtr_1098_catalog write policy includes archive guard', () => {
    const block = sql.match(/CREATE POLICY[^;]*amtr_1098_catalog_write[\s\S]*?;/)
    expect(block, 'catalog write policy block not found').toBeTruthy()
    expect(block![0]).toMatch(/NOT is_1098_year_archived\(base_id,\s*year_label\)/)
  })

  it('amtr_1098_years write policy does NOT include archive guard (needed for unarchive)', () => {
    // Intentional carve-out — managers must be able to flip archived=false
    // on the years table itself or there's no way to unarchive.
    const block = sql.match(/CREATE POLICY[^;]*amtr_1098_years_write[\s\S]*?;/)
    expect(block, 'years write policy block not found').toBeTruthy()
    expect(block![0]).not.toMatch(/is_1098_year_archived/)
  })

  it('catalog year_label is NOT NULL', () => {
    expect(sql).toMatch(/ALTER COLUMN year_label SET NOT NULL/)
  })

  it('catalog per-year uniqueness index is created', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*?amtr_1098_catalog[\s\S]*?base_id,\s*year_label,\s*task/)
  })

  it('next_due_manual column is added with default false', () => {
    expect(sql).toMatch(/ADD COLUMN[^,]*next_due_manual BOOLEAN NOT NULL DEFAULT FALSE/i)
  })
})
