import { friendlyError } from '@/lib/utils'
import { createClient } from './client'

// New tables are not yet in the generated Database type — cast the client
// to `any` for these calls (the lib/supabase/qrc-reviews.ts pattern).

const READ_FILES_BUCKET = 'read-files'

// Required-reader roles — identical to QRC's REVIEWER_ROLES so the two
// modules stay in sync. Drives the badge, "outstanding" set, and report Y.
export const READ_FILE_READER_ROLES = [
  'airfield_manager', 'namo', 'amops', 'base_admin', 'sys_admin',
] as const

export type ReadFileRow = {
  id: string
  base_id: string
  title: string
  description: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  version: number
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ReadFileAckRow = {
  id: string
  base_id: string
  read_file_id: string
  user_id: string
  acknowledged_version: number
  initials_snapshot: string | null
  acknowledged_at: string
}

export type ReadFileReviewer = {
  user_id: string
  name: string
  rank: string | null
  operating_initials: string | null
  role: string
}

// ── Pure helpers (unit-tested) ──────────────────────────────

/** IDs of active files the user has NOT acknowledged at the current version. */
export function computeUnacknowledged(
  files: { id: string; version: number; is_archived: boolean }[],
  acks: { read_file_id: string; acknowledged_version: number }[],
): string[] {
  const ackSet = new Set(acks.map(a => `${a.read_file_id}:${a.acknowledged_version}`))
  return files
    .filter(f => !f.is_archived && !ackSet.has(`${f.id}:${f.version}`))
    .map(f => f.id)
}

/** Split a reviewer roster into reviewed vs outstanding given the acks for one file+version. */
export function partitionReviewers(
  reviewers: { user_id: string }[],
  acksForFileVersion: { user_id: string }[],
): { reviewed: string[]; outstanding: string[] } {
  const acked = new Set(acksForFileVersion.map(a => a.user_id))
  const reviewed: string[] = []
  const outstanding: string[] = []
  for (const r of reviewers) {
    if (acked.has(r.user_id)) reviewed.push(r.user_id)
    else outstanding.push(r.user_id)
  }
  return { reviewed, outstanding }
}

// ── Bytes → human-readable (mirror amtr humanFileSize) ──────
export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

// ── Reads ───────────────────────────────────────────────────

/** All files at a base, newest first (active + archived; caller filters). */
export async function fetchReadFiles(baseId: string): Promise<ReadFileRow[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('read_files')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as ReadFileRow[]
}

/** Current user's acks at a base (all files, all versions). */
export async function fetchMyAcks(baseId: string): Promise<ReadFileAckRow[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('read_file_acknowledgments')
    .select('*')
    .eq('base_id', baseId)
    .eq('user_id', user.id)
  if (error || !data) return []
  return data as ReadFileAckRow[]
}

/** Every ack at a base (for the report). */
export async function fetchAllAcks(baseId: string): Promise<ReadFileAckRow[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('read_file_acknowledgments')
    .select('*')
    .eq('base_id', baseId)
  if (error || !data) return []
  return data as ReadFileAckRow[]
}

/**
 * Required-reader roster — base members whose authoritative role
 * (profiles.role) is in READ_FILE_READER_ROLES.
 *
 * base_members tells us WHO belongs to the base; the role comes from
 * profiles.role — the same source user_has_permission reads and that User
 * Management edits. base_members.role is a legacy per-base column that has
 * drifted (often stale 'read_only'), so filtering on it silently dropped
 * real reviewers (same bug fixed in qrc-reviews.ts fetchEligibleReviewers).
 */
export async function fetchReadFileReviewers(baseId: string): Promise<ReadFileReviewer[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: members, error } = await sb
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
  const readerRoles = READ_FILE_READER_ROLES as readonly string[]

  return ((profiles ?? []) as unknown as ProfileRow[])
    .filter(p => p.role != null && readerRoles.includes(p.role))
    .map(p => ({
      user_id: p.id,
      name: p.name ?? '(unknown)',
      rank: p.rank ?? null,
      operating_initials: p.operating_initials ?? null,
      role: p.role as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Count of active files the current user has not acknowledged at current version. */
export async function fetchUnacknowledgedReadFileCount(baseId: string): Promise<number> {
  const [files, acks] = await Promise.all([fetchReadFiles(baseId), fetchMyAcks(baseId)])
  return computeUnacknowledged(files, acks).length
}

/** Signed URL for viewing a stored file (bucket is private). */
export async function getReadFileUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.storage.from(READ_FILES_BUCKET).createSignedUrl(storagePath, 60 * 5)
  return data?.signedUrl ?? null
}

// ── Writes ──────────────────────────────────────────────────

function storageKey(baseId: string, file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${baseId}/${Date.now()}-${safeName}`
}

/** Upload a new read file + metadata row. */
export async function addReadFile(
  baseId: string, file: File,
  meta: { title: string; description?: string },
): Promise<{ data: ReadFileRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const path = storageKey(baseId, file)
  const { error: upErr } = await supabase.storage.from(READ_FILES_BUCKET).upload(path, file, {
    contentType: file.type || undefined, upsert: false,
  })
  if (upErr) return { data: null, error: friendlyError(upErr.message) }

  const row = {
    base_id: baseId,
    title: meta.title,
    description: meta.description?.trim() || null,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    version: 1,
    is_archived: false,
    created_by: user?.id ?? null,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb.from('read_files').insert(row).select().single()
  if (error) {
    await supabase.storage.from(READ_FILES_BUCKET).remove([path])
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as ReadFileRow, error: null }
}

/** Replace the file on an existing row — bumps version, re-triggers acks. */
export async function replaceReadFile(
  row: ReadFileRow, file: File,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const path = storageKey(row.base_id, file)
  const { error: upErr } = await supabase.storage.from(READ_FILES_BUCKET).upload(path, file, {
    contentType: file.type || undefined, upsert: false,
  })
  if (upErr) return { error: friendlyError(upErr.message) }

  // Optimistic-lock on the version we read: if another manager replaced the
  // same file first, 0 rows update and we bail without clobbering their write.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb.from('read_files').update({
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    version: row.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id).eq('version', row.version).select('id')
  if (error) {
    await supabase.storage.from(READ_FILES_BUCKET).remove([path])
    return { error: friendlyError(error.message) }
  }
  if (!data || data.length === 0) {
    // Stale version — someone else replaced it first. Remove our upload.
    await supabase.storage.from(READ_FILES_BUCKET).remove([path])
    return { error: 'This file was just updated by someone else. Reload and try again.' }
  }
  // Best-effort cleanup of the superseded object.
  if (row.storage_path) await supabase.storage.from(READ_FILES_BUCKET).remove([row.storage_path])
  return { error: null }
}

/** Archive / unarchive a file (drops it off the badge + required list). */
export async function setReadFileArchived(
  id: string, archived: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb.from('read_files')
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/** Record the current user's acknowledgment of a file at its current version. */
export async function acknowledgeReadFile(
  baseId: string, readFileId: string, version: number,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: profile } = await supabase
    .from('profiles').select('operating_initials').eq('id', user.id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb.from('read_file_acknowledgments').insert({
    base_id: baseId,
    read_file_id: readFileId,
    user_id: user.id,
    acknowledged_version: version,
    initials_snapshot: (profile as { operating_initials?: string } | null)?.operating_initials ?? null,
  })
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}
