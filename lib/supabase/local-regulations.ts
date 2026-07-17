import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeDueRegIds } from '@/lib/local-regs/review-status'

// ─────────────────────────────────────────────────────────────
// Local Regulations (Base Regs) CRUD — clone of lib/supabase/read-files.ts
// (versioned uploads) crossed with lib/supabase/qrc-reviews.ts (insert-only
// recurring reviews). Schema in staged migrations 2026071730-33.
//
// The local_regulations* tables are created by staged migrations and are
// not yet in the generated Database type, so route queries through an
// untyped client (same idiom as amtr.ts / flip.ts / fpr.ts /
// driving-checks.ts) until the owner applies the migrations and
// regenerates types.
//
// House rule: this module never calls logActivity — local regulations
// have no Events Log (AF Form 3616) tie-in; CRUD modules never touch
// activity_log directly regardless.
// ─────────────────────────────────────────────────────────────

const LOCAL_REGS_BUCKET = 'local-regulations'
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

// Required-reviewer roles — identical members to READ_FILE_READER_ROLES
// (lib/supabase/read-files.ts:8-10) so the two modules' rosters stay in
// sync today. Kept as its own constant (not imported from read-files.ts)
// per the design spec: Read File and Base Regs are permanently separate
// modules (different lifecycles — one-time ack vs recurring review) that
// may diverge in roster later; the modules must not be coupled.
export const LOCAL_REGS_REVIEWER_ROLES = [
  'airfield_manager', 'namo', 'amops', 'base_admin', 'sys_admin',
] as const

export type LocalRegulationRow = {
  id: string
  base_id: string
  title: string
  description: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  version: number
  review_interval: 'monthly' | 'quarterly'
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LocalRegReviewRow = {
  id: string
  base_id: string
  regulation_id: string
  user_id: string
  reviewed_at: string
  version_at_review: number
  initials_snapshot: string | null
  created_at: string
}

export type LocalRegReviewer = {
  user_id: string
  name: string
  rank: string | null
  operating_initials: string | null
  role: string
}

function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

// ── Reads ───────────────────────────────────────────────────

/** All regulations at a base, newest first (active + archived; caller filters). */
export async function fetchLocalRegs(baseId: string): Promise<LocalRegulationRow[]> {
  const supabase = db()
  if (!supabase || !baseId) return []
  const { data, error } = await supabase
    .from('local_regulations')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as LocalRegulationRow[]
}

/** Current user's reviews at a base (all regs, all versions; callers/pure fns reduce to latest). */
export async function fetchMyRegReviews(baseId: string): Promise<LocalRegReviewRow[]> {
  const supabase = db()
  if (!supabase || !baseId) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('local_regulation_reviews')
    .select('*')
    .eq('base_id', baseId)
    .eq('user_id', user.id)
  if (error || !data) return []
  return data as LocalRegReviewRow[]
}

/** Every review at a base (for the compliance report / per-doc chip). */
export async function fetchAllRegReviews(baseId: string): Promise<LocalRegReviewRow[]> {
  const supabase = db()
  if (!supabase || !baseId) return []
  const { data, error } = await supabase
    .from('local_regulation_reviews')
    .select('*')
    .eq('base_id', baseId)
  if (error || !data) return []
  return data as LocalRegReviewRow[]
}

/**
 * Required-reviewer roster — base members whose authoritative role
 * (profiles.role) is in LOCAL_REGS_REVIEWER_ROLES.
 *
 * base_members tells us WHO belongs to the base; the role comes from
 * profiles.role — the same source user_has_permission reads and that User
 * Management edits. base_members.role is a legacy per-base column that has
 * drifted (often stale 'read_only'), so filtering on it silently drops
 * real reviewers (same bug fixed in read-files.ts fetchReadFileReviewers /
 * qrc-reviews.ts fetchEligibleReviewers).
 */
export async function fetchLocalRegReviewers(baseId: string): Promise<LocalRegReviewer[]> {
  const supabase = db()
  if (!supabase || !baseId) return []
  const { data: members, error } = await supabase
    .from('base_members')
    .select('user_id')
    .eq('base_id', baseId)
  if (error || !members) return []
  const userIds = (members as { user_id: string }[]).map(m => m.user_id)
  if (userIds.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials, role')
    .in('id', userIds)
  type ProfileRow = { id: string; name: string | null; rank: string | null; operating_initials: string | null; role: string | null }
  const reviewerRoles = LOCAL_REGS_REVIEWER_ROLES as readonly string[]

  return ((profiles ?? []) as unknown as ProfileRow[])
    .filter(p => p.role != null && reviewerRoles.includes(p.role))
    .map(p => ({
      user_id: p.id,
      name: p.name ?? '(unknown)',
      rank: p.rank ?? null,
      operating_initials: p.operating_initials ?? null,
      role: p.role as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Count of active regulations due (never | updated | overdue) for the
 * current user at a base. The Base Regs tab count + sidebar badge fetcher.
 */
export async function fetchDueLocalRegCount(baseId: string): Promise<number> {
  const [regs, reviews] = await Promise.all([fetchLocalRegs(baseId), fetchMyRegReviews(baseId)])
  return computeDueRegIds(regs, reviews).length
}

/** Signed URL for viewing a stored PDF (bucket is private). */
export async function getLocalRegUrl(storagePath: string): Promise<string | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.storage.from(LOCAL_REGS_BUCKET).createSignedUrl(storagePath, 60 * 5)
  return data?.signedUrl ?? null
}

// ── Writes ──────────────────────────────────────────────────

function storageKey(baseId: string, file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${baseId}/${Date.now()}-${safeName}`
}

/** PDF-only + 25 MB cap (spec: PDF-only uploads, unlike Read File's broader ACCEPT list). */
function validatePdfUpload(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) return 'Only PDF files are accepted.'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'File exceeds the 25 MB limit.'
  return null
}

/** Upload a new local regulation PDF + metadata row. */
export async function addLocalReg(
  baseId: string, file: File,
  meta: { title: string; description?: string; reviewInterval: 'monthly' | 'quarterly' },
): Promise<{ data: LocalRegulationRow | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const validationError = validatePdfUpload(file)
  if (validationError) return { data: null, error: validationError }

  const { data: { user } } = await supabase.auth.getUser()
  const path = storageKey(baseId, file)
  const { error: upErr } = await supabase.storage.from(LOCAL_REGS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf', upsert: false,
  })
  if (upErr) return { data: null, error: friendlyError(upErr.message) }

  const row = {
    base_id: baseId,
    title: meta.title,
    description: meta.description?.trim() || null,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/pdf',
    file_size_bytes: file.size,
    version: 1,
    review_interval: meta.reviewInterval,
    is_archived: false,
    created_by: user?.id ?? null,
  }
  const { data, error } = await supabase.from('local_regulations').insert(row).select().single()
  if (error) {
    // Row insert failed after the object landed in storage — clean up the
    // orphan so a retry doesn't leave a dangling file with no metadata row.
    await supabase.storage.from(LOCAL_REGS_BUCKET).remove([path])
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as LocalRegulationRow, error: null }
}

/** Replace the PDF on an existing row — bumps version, flips every user's status to `updated`. */
export async function replaceLocalReg(
  row: LocalRegulationRow, file: File,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const validationError = validatePdfUpload(file)
  if (validationError) return { error: validationError }

  const path = storageKey(row.base_id, file)
  const { error: upErr } = await supabase.storage.from(LOCAL_REGS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf', upsert: false,
  })
  if (upErr) return { error: friendlyError(upErr.message) }

  // Optimistic-lock on the version we read: if another manager replaced the
  // same doc first, 0 rows update and we bail without clobbering their write.
  const { data, error } = await supabase.from('local_regulations').update({
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/pdf',
    file_size_bytes: file.size,
    version: row.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id).eq('version', row.version).select('id')
  if (error) {
    await supabase.storage.from(LOCAL_REGS_BUCKET).remove([path])
    return { error: friendlyError(error.message) }
  }
  if (!data || data.length === 0) {
    // Stale version — someone else replaced it first. Remove our upload.
    await supabase.storage.from(LOCAL_REGS_BUCKET).remove([path])
    return { error: 'This regulation was just updated by someone else. Reload and try again.' }
  }
  // Best-effort cleanup of the superseded object.
  if (row.storage_path) await supabase.storage.from(LOCAL_REGS_BUCKET).remove([row.storage_path])
  return { error: null }
}

/** Archive / unarchive a regulation (drops it off the badge + due counts; stays in report history). */
export async function setLocalRegArchived(
  id: string, archived: boolean,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('local_regulations')
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/** Change a regulation's review interval — never touches review rows; status recomputes live. */
export async function setLocalRegInterval(
  id: string, interval: 'monthly' | 'quarterly',
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('local_regulations')
    .update({ review_interval: interval, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/**
 * Record the current user's review of a regulation at the LIVE version the
 * caller read it at. `version` MUST be the regulation's current `version`
 * at the moment the caller opened/attested it — the
 * local_regulation_reviews_insert RLS policy's version-equality WITH CHECK
 * (2026071731_local_regs_tables.sql) rejects any other value, so a queued
 * offline review that drains after someone else replaced the doc fails
 * instead of silently recording a review against the wrong edition (see
 * the local_reg_review write-queue handler in lib/sync/handlers.ts).
 */
export async function reviewLocalReg(
  baseId: string, regulationId: string, version: number,
): Promise<{ data: LocalRegReviewRow | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles').select('operating_initials').eq('id', user.id).single()
  const { data, error } = await supabase.from('local_regulation_reviews').insert({
    base_id: baseId,
    regulation_id: regulationId,
    user_id: user.id,
    version_at_review: version,
    initials_snapshot: (profile as { operating_initials?: string } | null)?.operating_initials ?? null,
  }).select().single()
  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: data as LocalRegReviewRow, error: null }
}
