import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

// The amtr_* tables are created by migrations 2026052000–05 but are not in
// the generated Database type, so route AMTR queries through an untyped
// client. Table names are constrained by the RPC/policy whitelists server-side.
function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

// ─────────────────────────────────────────────────────────────
// AMTR — Airfield Management Training Record CRUD.
// Demo mode (no Supabase configured) returns empty collections so
// the UI renders empty states rather than crashing. Row types live
// here (matches the contractors.ts convention).
// ─────────────────────────────────────────────────────────────

export type AmtrMemberStatus =
  | 'Active' | 'Reserve' | 'Guard' | 'Civilian' | 'Contractor' | 'Separated'

export type AmtrMember = {
  id: string
  base_id: string
  user_id: string | null
  full_name: string
  grade: string | null
  dafsc: string | null
  unit: string | null
  installation: string | null
  date_assigned: string | null
  status: AmtrMemberStatus
  tsc: string | null
  duty_position: string | null
  supervisor: string | null
  utm: string | null
  commander: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AmtrRole = 'trainee' | 'trainer' | 'certifier' | 'namt' | 'afm'

export type AmtrRoleAssignment = {
  id: string
  base_id: string
  user_id: string
  role: AmtrRole
  created_at: string
}

export type AmtrNotificationKind =
  | 'training_due' | 'signoff' | 'entry_623a' | 'item_797_added' | 'signature_797'

export type AmtrNotification = {
  id: string
  base_id: string
  recipient_user_id: string
  member_id: string
  kind: AmtrNotificationKind
  body: string
  target_tab: string | null
  target_item_id: string | null
  dedupe_key: string | null
  created_at: string
  dismissed_at: string | null
}

// Signable tables — passed straight to the amtr_sign RPC.
export type AmtrSignableTable =
  | 'amtr_623a' | 'amtr_797' | 'amtr_jqs_progress'
  | 'amtr_1098_progress' | 'amtr_milestone_progress' | 'amtr_803'

// ── Members ────────────────────────────────────────────────

export async function fetchAmtrMembers(baseId?: string | null): Promise<AmtrMember[]> {
  const supabase = db()
  if (!supabase) return []
  let query = supabase.from('amtr_members').select('*').order('full_name', { ascending: true })
  if (baseId) query = query.eq('base_id', baseId)
  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch AMTR members:', error.message)
    return []
  }
  return (data ?? []) as AmtrMember[]
}

export async function fetchAmtrMember(id: string): Promise<AmtrMember | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.from('amtr_members').select('*').eq('id', id).single()
  if (error) {
    console.error('Failed to fetch AMTR member:', error.message)
    return null
  }
  return data as AmtrMember
}

export async function createAmtrMember(input: {
  base_id: string
  full_name: string
  user_id?: string | null
  grade?: string | null
  dafsc?: string | null
  unit?: string | null
  installation?: string | null
  date_assigned?: string | null
  status?: AmtrMemberStatus
  tsc?: string | null
  duty_position?: string | null
  supervisor?: string | null
  utm?: string | null
  commander?: string | null
}): Promise<{ data: AmtrMember | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let created_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) created_by = user.id
  } catch { /* anonymous */ }

  const row: Record<string, unknown> = { status: 'Active', ...input }
  if (created_by) row.created_by = created_by

  const { data, error } = await supabase
    .from('amtr_members').insert(row as never).select().single()
  if (error) {
    console.error('Failed to create AMTR member:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as AmtrMember, error: null }
}

export async function updateAmtrMember(
  id: string,
  fields: Partial<Omit<AmtrMember, 'id' | 'base_id' | 'created_at' | 'updated_at' | 'created_by'>>,
): Promise<{ data: AmtrMember | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase
    .from('amtr_members')
    .update({ ...fields, updated_at: new Date().toISOString() } as never)
    .eq('id', id).select().single()
  if (error) {
    console.error('Failed to update AMTR member:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as AmtrMember, error: null }
}

export async function deleteAmtrMember(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('amtr_members').delete().eq('id', id)
  if (error) {
    console.error('Failed to delete AMTR member:', error.message)
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

// ── Roster auto-population from the base's assigned users ───
type ProfileRow = { id: string; rank?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null }

/** User IDs excluded from the training roster (don't require a record). */
export async function fetchAmtrMemberExclusions(baseId: string): Promise<string[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase.from('amtr_member_exclusions').select('user_id').eq('base_id', baseId)
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id)
}

/** Mark a base user as not requiring a training record (so sync won't re-add them). */
export async function excludeAmtrMember(baseId: string, userId: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('amtr_member_exclusions').upsert({ base_id: baseId, user_id: userId } as never, { onConflict: 'base_id,user_id' })
  return { error: error ? friendlyError(error.message) : null }
}

/** Remove a base user from the training roster: exclude them (so auto-sync
 * won't re-add) and delete their member record. */
export async function removeAmtrMemberFromRoster(baseId: string, userId: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error: exclErr } = await excludeAmtrMember(baseId, userId)
  if (exclErr) return { error: exclErr }
  const { error } = await supabase.from('amtr_members').delete().eq('base_id', baseId).eq('user_id', userId)
  return { error: error ? friendlyError(error.message) : null }
}

/** Create training-record members for every base user not already on the roster
 * and not excluded. Returns how many were created. Requires amtr:write. */
export async function syncAmtrRosterFromBase(baseId: string): Promise<{ created: number; error: string | null }> {
  const supabase = db()
  if (!supabase) return { created: 0, error: null }
  const { data: bm } = await supabase.from('base_members').select('user_id').eq('base_id', baseId)
  const baseUserIds = ((bm ?? []) as { user_id: string }[]).map((r) => r.user_id).filter(Boolean)
  if (baseUserIds.length === 0) return { created: 0, error: null }

  const [{ data: mem }, exclusions] = await Promise.all([
    supabase.from('amtr_members').select('user_id').eq('base_id', baseId),
    fetchAmtrMemberExclusions(baseId),
  ])
  const have = new Set(((mem ?? []) as { user_id: string | null }[]).map((r) => r.user_id).filter(Boolean) as string[])
  const excluded = new Set(exclusions)
  const missing = baseUserIds.filter((id) => !have.has(id) && !excluded.has(id))
  if (missing.length === 0) return { created: 0, error: null }

  const { data: profs } = await supabase.from('profiles').select('*').in('id', missing)
  const profById = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p]))
  const rows = missing.map((id) => {
    const p = profById.get(id)
    const last = (p?.last_name || '').trim(); const first = (p?.first_name || '').trim(); const rank = (p?.rank || '').trim()
    const full_name = (last || first) ? `${last}${last && first ? ', ' : ''}${first}` : (p?.name || p?.email || 'Member')
    return { base_id: baseId, user_id: id, full_name, grade: rank || null, status: 'Active' }
  })
  const { error } = await supabase.from('amtr_members').insert(rows as never)
  if (error) { console.error('syncAmtrRosterFromBase:', error.message); return { created: 0, error: friendlyError(error.message) } }
  return { created: rows.length, error: null }
}

// ── Role assignments (the AMTR role layer) ─────────────────

export async function fetchAmtrRoleAssignments(baseId: string): Promise<AmtrRoleAssignment[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('amtr_role_assignments').select('*').eq('base_id', baseId)
  if (error) {
    console.error('Failed to fetch AMTR role assignments:', error.message)
    return []
  }
  return (data ?? []) as AmtrRoleAssignment[]
}

export async function addAmtrRole(
  baseId: string, userId: string, role: AmtrRole,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('amtr_role_assignments')
    .insert({ base_id: baseId, user_id: userId, role } as never)
  if (error && !error.message.includes('duplicate')) {
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

export async function removeAmtrRole(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('amtr_role_assignments').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ── Generic catalog + per-member fetch ─────────────────────
// AMTR has many simple child tables; a typed generic fetch keeps the
// module small. Each returns rows scoped to base or member.

/** Find an existing auto-623a entry by source link, used by the multi-
 * stage Auto623aDialog to evolve a single entry across signers. */
export async function fetchAmtr623aBySource(
  baseId: string, sourceTable: string, sourceRowId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase
    .from('amtr_623a').select('*')
    .eq('base_id', baseId).eq('source_table', sourceTable).eq('source_row_id', sourceRowId)
    .maybeSingle()
  return (data ?? null) as Record<string, unknown> | null
}

export async function fetchAmtrByBase<T = Record<string, unknown>>(
  table: string, baseId: string, orderBy = 'sort_order',
): Promise<T[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from(table).select('*').eq('base_id', baseId).order(orderBy, { ascending: true })
  if (error) {
    console.error(`Failed to fetch ${table}:`, error.message)
    return []
  }
  return (data ?? []) as T[]
}

export async function fetchAmtrByMember<T = Record<string, unknown>>(
  table: string, memberId: string, orderBy?: string,
): Promise<T[]> {
  const supabase = db()
  if (!supabase) return []
  let query = supabase.from(table).select('*').eq('member_id', memberId)
  if (orderBy) query = query.order(orderBy, { ascending: true })
  const { data, error } = await query
  if (error) {
    console.error(`Failed to fetch ${table}:`, error.message)
    return []
  }
  return (data ?? []) as T[]
}

export async function upsertAmtrRow(
  table: string, row: Record<string, unknown>,
  opts?: { onConflict?: string },
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  // Without explicit onConflict, supabase-js defaults to primary-key
  // detection. Callers whose row may already exist by a UNIQUE
  // constraint but whose `id` isn't in the spread should pass the
  // unique-constraint columns (e.g. 'member_id,catalog_id') so the
  // upsert idempotently UPDATES instead of failing as a duplicate
  // INSERT.
  const { data, error } = await supabase
    .from(table)
    .upsert(row as never, opts?.onConflict ? { onConflict: opts.onConflict } : undefined)
    .select()
    .single()
  if (error) {
    console.error(`Failed to upsert ${table}:`, error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as Record<string, unknown>, error: null }
}

/** Batch-insert rows in chunks (for catalog seeding — avoids 490 single calls). */
export async function insertAmtrRows(
  table: string, rows: Record<string, unknown>[], chunkSize = 200,
): Promise<{ inserted: number; error: string | null }> {
  const supabase = db()
  if (!supabase) return { inserted: 0, error: 'Supabase not configured' }
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).insert(chunk as never)
    if (error) {
      console.error(`Failed to batch-insert ${table}:`, error.message)
      return { inserted, error: friendlyError(error.message) }
    }
    inserted += chunk.length
  }
  return { inserted, error: null }
}

/** Count rows for a table at a base (used to guard against double-seeding). */
export async function countAmtrRows(table: string, baseId: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0
  const { count } = await supabase
    .from(table).select('*', { count: 'exact', head: true }).eq('base_id', baseId)
  return count ?? 0
}

/** Partial UPDATE of an existing row (no NOT NULL issues, unlike a partial upsert). */
export async function updateAmtrRow(
  table: string, id: string, patch: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from(table).update(patch as never).eq('id', id)
  if (error) {
    console.error(`Failed to update ${table}:`, error.message)
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

/** Persist a new row order. Pass FULL rows (all columns) with updated sort_order
 * so the upsert's insert path satisfies NOT NULL constraints; done in one call. */
export async function reorderAmtrRows(
  table: string, rows: Record<string, unknown>[],
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from(table).upsert(rows as never, { onConflict: 'id' })
  if (error) {
    console.error(`Failed to reorder ${table}:`, error.message)
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

/** The standard-catalog version a base is currently on (null if never synced). */
export async function fetchAmtrCatalogVersion(baseId: string): Promise<string | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.from('amtr_catalog_version').select('version').eq('base_id', baseId).maybeSingle()
  return (data as { version?: string } | null)?.version ?? null
}

export async function setAmtrCatalogVersion(baseId: string, version: string): Promise<void> {
  const supabase = db()
  if (!supabase) return
  await supabase.from('amtr_catalog_version').upsert({ base_id: baseId, version, updated_at: new Date().toISOString() } as never, { onConflict: 'base_id' })
}

// ── Supporting files (amtr-files bucket) ───────────────────
// Path convention matches the bucket's path-scoped RLS
// (2026052005_amtr_storage.sql): {member_id}/{timestamp}-{filename}.
// The first path segment is the member UUID, joined server-side to
// resolve base_id for the access check.

export type AmtrFileRow = {
  id: string; member_id: string; name: string; uploaded_at: string | null
  size: string | null; status: string; storage_path: string | null
  mime_type: string | null; created_at: string
}

const AMTR_FILES_BUCKET = 'amtr-files'

/** Upload a supporting file for a member + record its metadata. */
export async function uploadAmtrFile(
  baseId: string, memberId: string, file: File,
): Promise<{ data: AmtrFileRow | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  // Sanitize the filename for the storage key but keep the original
  // for display. Prefix with a timestamp so re-uploading the same
  // name doesn't collide.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const storagePath = `${memberId}/${Date.now()}-${safeName}`
  const { error: upErr } = await supabase.storage.from(AMTR_FILES_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined, upsert: false,
  })
  if (upErr) {
    console.error('amtr file upload failed:', upErr.message)
    return { data: null, error: friendlyError(upErr.message) }
  }
  const row = {
    base_id: baseId, member_id: memberId, name: file.name,
    uploaded_at: new Date().toISOString().slice(0, 10),
    size: humanFileSize(file.size), status: 'Verified',
    storage_path: storagePath, mime_type: file.type || null,
  }
  const { data, error } = await supabase.from('amtr_files').insert(row as never).select().single()
  if (error) {
    // Roll back the orphaned object so a failed row insert doesn't
    // leave a dangling file in the bucket.
    await supabase.storage.from(AMTR_FILES_BUCKET).remove([storagePath])
    console.error('amtr file row insert failed:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as AmtrFileRow, error: null }
}

/** Signed URL for viewing/downloading a stored file (bucket is private). */
export async function getAmtrFileUrl(storagePath: string): Promise<string | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.storage.from(AMTR_FILES_BUCKET).createSignedUrl(storagePath, 60 * 5)
  return data?.signedUrl ?? null
}

/** Delete a file row + its stored object. */
export async function deleteAmtrFile(id: string, storagePath: string | null): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  if (storagePath) await supabase.storage.from(AMTR_FILES_BUCKET).remove([storagePath])
  const { error } = await supabase.from('amtr_files').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/** Bytes → human-readable (e.g. "2.4 MB"). */
function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

export async function deleteAmtrRow(table: string, id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from(table).delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ── Signature RPC wrapper ──────────────────────────────────

export async function amtrSign(
  table: AmtrSignableTable, rowId: string, slot: string, initials: string,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.rpc('amtr_sign', {
    p_table: table, p_row_id: rowId, p_slot: slot, p_initials: initials,
  } as never)
  if (error) {
    console.error('amtr_sign failed:', error.message)
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

/** Clear a single signature block (NAMT/AFM only — enforced server-side). */
export async function amtrReopen(
  table: AmtrSignableTable, rowId: string, slot: string,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.rpc('amtr_reopen', { p_table: table, p_row_id: rowId, p_slot: slot } as never)
  if (error) {
    console.error('amtr_reopen failed:', error.message)
    return { error: friendlyError(error.message) }
  }
  return { error: null }
}

// ── Audit log ──────────────────────────────────────────────

export type AmtrAuditEntry = {
  id: string
  base_id: string
  member_id: string | null
  actor_user_id: string | null
  action: string
  table_name: string | null
  row_id: string | null
  detail: string | null
  created_at: string
}

export async function fetchAmtrAudit(memberId: string): Promise<AmtrAuditEntry[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('amtr_audit_log').select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('Failed to fetch AMTR audit log:', error.message)
    return []
  }
  return (data ?? []) as AmtrAuditEntry[]
}

// ── Notifications ──────────────────────────────────────────

export async function fetchAmtrNotifications(): Promise<AmtrNotification[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('amtr_notifications').select('*')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch AMTR notifications:', error.message)
    return []
  }
  return (data ?? []) as AmtrNotification[]
}

export async function createAmtrNotification(input: {
  base_id: string
  recipient_user_id: string
  member_id: string
  kind: AmtrNotificationKind
  body: string
  target_tab?: string | null
  target_item_id?: string | null
  dedupe_key?: string | null
}): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('amtr_notifications')
    .upsert(input as never, { onConflict: 'recipient_user_id,dedupe_key', ignoreDuplicates: true })
  return { error: error ? friendlyError(error.message) : null }
}

export async function dismissAmtrNotification(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('amtr_notifications')
    .update({ dismissed_at: new Date().toISOString() } as never)
    .eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
