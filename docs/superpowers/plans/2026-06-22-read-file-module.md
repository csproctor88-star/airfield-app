# Read File Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/read-file` module where Airfield Management leadership uploads documents that operational users must read and acknowledge, with a red sidebar badge for outstanding reviews and a manager-only compliance PDF.

**Architecture:** Two new tables (`read_files` + `read_file_acknowledgments`) + a private `read-files` storage bucket, all permission-matrix-gated. The page mirrors `components/amtr/files-tab.tsx` for upload/storage; the acknowledge-and-report mechanics mirror the QRC monthly-review (`lib/supabase/qrc-reviews.ts`, `lib/qrc-monthly-review-pdf.ts`). The badge plugs into the existing `useSidebarBadgeCounts` hook.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS + Storage), TypeScript, jsPDF + jspdf-autotable, vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-22-read-file-module-design.md`

---

## File Structure

**New files**
- `supabase/migrations/2026062100_read_file_permissions.sql` — permission keys + role grants
- `supabase/migrations/2026062101_read_file_tables.sql` — tables, indexes, RLS
- `supabase/migrations/2026062102_read_file_storage.sql` — bucket + storage RLS
- `supabase/migrations/2026062103_read_file_enable_module.sql` — `enabled_modules` backfill
- `lib/supabase/read-files.ts` — types + CRUD + pure `computeUnacknowledged` / `partitionReviewers` helpers
- `tests/read-files.test.ts` — unit tests for the pure helpers
- `app/(app)/read-file/page.tsx` — the module page
- `lib/read-file-review-pdf.ts` — compliance report generator

**Modified files**
- `lib/permissions.ts` — add `READ_FILE_VIEW` / `READ_FILE_MANAGE`
- `hooks/use-sidebar-badge-counts.ts` — add `readFile` count
- `components/layout/sidebar-nav.tsx` — red dot + `HREF_TO_VIEW_PERM` + section aggregate
- `lib/modules-config.ts` — `ModuleKey` + `MODULES` entry
- `lib/sidebar-config.ts` — nav item + section membership
- `app/(app)/more/page.tsx` — mobile menu entry (if module list is hardcoded there)

**Conventions to follow**
- RLS uses matrix helpers only: `user_has_base_access(uid, base_id)` + `user_has_permission(uid, '<key>')`. Never the dropped `user_can_write` / `user_is_admin`.
- New tables accessed via `as any` casts (types.ts regen deferred), the `lib/supabase/qrc-reviews.ts` pattern.
- Migrations applied individually with `npx supabase db query --linked --file <path>`. Never `db push`. One row-returning SELECT per verification file (only the last statement's rows return).
- Commit after each task. Gate the final commit on `npx tsc --noEmit` + `npm run build` (RC 0) + `npx vitest run` green.

---

## Phase 1 — Schema & data layer

### Task 1: Permissions migration

**Files:**
- Create: `supabase/migrations/2026062100_read_file_permissions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Read File — Migration 1/4: app-permission keys
--
-- read_file:view   — open the module, view files, acknowledge (read & sign).
--                    Granted to the operational roles only (the required
--                    readers). Read-only / ATC / safety are intentionally
--                    excluded — they have no read-file obligation.
-- read_file:manage — add / replace / archive files + run the report.
--
-- Mirror these keys in lib/permissions.ts (PERM.READ_FILE_*).
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('read_file:view',   'View / Sign Read File',   'read_file', 'Open the Read File module, view files, and acknowledge (read & initial) them'),
  ('read_file:manage', 'Manage Read File',        'read_file', 'Add, replace, and archive read files and run the review report')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- sys_admin already has an all-permissions seed, but it ran before these
-- keys existed; grant explicitly (idempotent).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'read_file:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager / namo / base_admin — full control at base.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'read_file:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

-- amops — view + sign only (parallels their AMTR access; no manage).
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'read_file:view')
ON CONFLICT (role, permission_key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062100_read_file_permissions.sql`
Expected: no error.

- [ ] **Step 3: Verify the grants**

Create a scratch verification file `/tmp/verify_read_file_perms.sql`:

```sql
SELECT role, permission_key
FROM role_permissions
WHERE permission_key LIKE 'read_file:%'
ORDER BY permission_key, role;
```

Run: `npx supabase db query --linked --file /tmp/verify_read_file_perms.sql`
Expected: `read_file:manage` for airfield_manager/base_admin/namo/sys_admin; `read_file:view` for those four plus amops.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062100_read_file_permissions.sql
git commit -m "Read File: permission keys + role grants (migration 1/4)"
```

---

### Task 2: Tables + RLS migration

**Files:**
- Create: `supabase/migrations/2026062101_read_file_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Read File — Migration 2/4: tables + RLS
--
-- read_files: one row per uploaded document at a base. `version` is
-- bumped when a manager replaces the file, which (because acks are
-- version-stamped) re-triggers acknowledgment for everyone.
--
-- read_file_acknowledgments: insert-only audit of read & initial events.
-- One row per (file, user, version). Immutable — no UPDATE/DELETE policy.
-- ============================================================

CREATE TABLE read_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX read_files_base_active_idx
  ON read_files(base_id, is_archived, created_at DESC);

CREATE TABLE read_file_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  read_file_id UUID NOT NULL REFERENCES read_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_version INT NOT NULL,
  initials_snapshot TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX read_file_ack_unique_idx
  ON read_file_acknowledgments(read_file_id, user_id, acknowledged_version);

CREATE INDEX read_file_ack_base_idx
  ON read_file_acknowledgments(base_id, read_file_id);

ALTER TABLE read_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_file_acknowledgments ENABLE ROW LEVEL SECURITY;

-- read_files: read with view, mutate with manage.
CREATE POLICY "read_files_select" ON read_files
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_files_insert" ON read_files
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_update" ON read_files
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_delete" ON read_files
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

-- read_file_acknowledgments: read with view (so the report can read all
-- acks at the base); insert only your own row. Immutable thereafter.
CREATE POLICY "read_file_ack_select" ON read_file_acknowledgments
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_file_ack_insert" ON read_file_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'read_file:view')
  );
-- No UPDATE / DELETE policies — acks are immutable (CASCADE on file delete).
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062101_read_file_tables.sql`
Expected: no error.

- [ ] **Step 3: Verify tables + policies exist**

Create `/tmp/verify_read_file_tables.sql`:

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('read_files', 'read_file_acknowledgments')
ORDER BY tablename, policyname;
```

Run: `npx supabase db query --linked --file /tmp/verify_read_file_tables.sql`
Expected: 4 policies on `read_files`, 2 on `read_file_acknowledgments`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062101_read_file_tables.sql
git commit -m "Read File: tables + RLS (migration 2/4)"
```

---

### Task 3: Storage bucket + RLS migration

**Files:**
- Create: `supabase/migrations/2026062102_read_file_storage.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Read File — Migration 3/4: storage bucket
--
-- Bucket 'read-files'. Path convention: {base_id}/{timestamp}-{filename}.
-- The first path segment is the base UUID directly (simpler than AMTR's
-- member->base hop). Access = base access + the read_file permission.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('read-files', 'read-files', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "read_files_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_files_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062102_read_file_storage.sql`
Expected: no error.

- [ ] **Step 3: Verify the bucket exists**

Create `/tmp/verify_read_file_bucket.sql`:

```sql
SELECT id, public FROM storage.buckets WHERE id = 'read-files';
```

Run: `npx supabase db query --linked --file /tmp/verify_read_file_bucket.sql`
Expected: one row, `public = f`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062102_read_file_storage.sql
git commit -m "Read File: storage bucket + RLS (migration 3/4)"
```

---

### Task 4: PERM keys

**Files:**
- Modify: `lib/permissions.ts` (after the AMTR block, ~line 96)

- [ ] **Step 1: Add the keys**

In `lib/permissions.ts`, immediately after the `AMTR_EXPORT:` line (the AMTR block ends ~line 96), insert:

```ts
  // Read File — read-and-initial continuity file (USAF + civilian)
  READ_FILE_VIEW:                       'read_file:view',
  READ_FILE_MANAGE:                     'read_file:manage',
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/permissions.ts
git commit -m "Read File: PERM.READ_FILE_VIEW / READ_FILE_MANAGE keys"
```

---

### Task 5: Data-access module + pure-helper tests

**Files:**
- Create: `lib/supabase/read-files.ts`
- Test: `tests/read-files.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/read-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeUnacknowledged, partitionReviewers } from '@/lib/supabase/read-files'

describe('computeUnacknowledged', () => {
  const files = [
    { id: 'a', version: 1, is_archived: false },
    { id: 'b', version: 2, is_archived: false },
    { id: 'c', version: 1, is_archived: true }, // archived → never outstanding
  ]

  it('returns active files with no ack at the current version', () => {
    const acks = [{ read_file_id: 'a', acknowledged_version: 1 }]
    expect(computeUnacknowledged(files, acks)).toEqual(['b'])
  })

  it('treats an ack for an older version as still outstanding', () => {
    const acks = [{ read_file_id: 'b', acknowledged_version: 1 }] // file b is v2 now
    expect(computeUnacknowledged(files, acks).sort()).toEqual(['a', 'b'])
  })

  it('excludes archived files even with no ack', () => {
    expect(computeUnacknowledged(files, [])).not.toContain('c')
  })

  it('returns empty when everything current is acked', () => {
    const acks = [
      { read_file_id: 'a', acknowledged_version: 1 },
      { read_file_id: 'b', acknowledged_version: 2 },
    ]
    expect(computeUnacknowledged(files, acks)).toEqual([])
  })
})

describe('partitionReviewers', () => {
  const reviewers = [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]

  it('splits reviewers into reviewed vs outstanding for a file version', () => {
    const acks = [{ user_id: 'u1' }, { user_id: 'u3' }]
    const { reviewed, outstanding } = partitionReviewers(reviewers, acks)
    expect(reviewed.sort()).toEqual(['u1', 'u3'])
    expect(outstanding).toEqual(['u2'])
  })

  it('all outstanding when no acks', () => {
    const { reviewed, outstanding } = partitionReviewers(reviewers, [])
    expect(reviewed).toEqual([])
    expect(outstanding.sort()).toEqual(['u1', 'u2', 'u3'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/read-files.test.ts`
Expected: FAIL — cannot resolve `computeUnacknowledged` / `partitionReviewers` (module does not exist yet).

- [ ] **Step 3: Write the data-access module**

Create `lib/supabase/read-files.ts`:

```ts
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
 * Required-reader roster — base_members in READ_FILE_READER_ROLES with
 * profile fields. Two-step query (members then profiles) for the same
 * PostgREST embed-cache reason as fetchEligibleReviewers in qrc-reviews.ts.
 */
export async function fetchReadFileReviewers(baseId: string): Promise<ReadFileReviewer[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: members, error } = await sb
    .from('base_members')
    .select('user_id, role')
    .eq('base_id', baseId)
    .in('role', READ_FILE_READER_ROLES as unknown as string[])
  if (error || !members) return []
  const memberRows = members as { user_id: string; role: string }[]
  if (memberRows.length === 0) return []

  const userIds = memberRows.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials')
    .in('id', userIds)
  type ProfileRow = { id: string; name: string | null; rank: string | null; operating_initials: string | null }
  const byId = new Map<string, ProfileRow>()
  for (const p of (profiles ?? []) as unknown as ProfileRow[]) byId.set(p.id, p)

  return memberRows.map(m => {
    const p = byId.get(m.user_id)
    return {
      user_id: m.user_id,
      name: p?.name ?? '(unknown)',
      rank: p?.rank ?? null,
      operating_initials: p?.operating_initials ?? null,
      role: m.role,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb.from('read_files').update({
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    version: row.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (error) {
    await supabase.storage.from(READ_FILES_BUCKET).remove([path])
    return { error: friendlyError(error.message) }
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/read-files.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/read-files.ts tests/read-files.test.ts
git commit -m "Read File: data-access module + outstanding/partition helpers + tests"
```

---

## Phase 2 — Page

### Task 6: `/read-file` page

**Files:**
- Create: `app/(app)/read-file/page.tsx`

This page mirrors `components/amtr/files-tab.tsx` (table, add dialog, signed-URL open, PII/CUI banner) but is base-scoped and adds the acknowledge flow + manager replace/archive. It uses the shared `Btn` / `Field` from `@/components/amtr/ui` and `EmptyState`.

- [ ] **Step 1: Write the page**

Create `app/(app)/read-file/page.tsx`:

```tsx
'use client'

// Read File — read-and-initial continuity file. Managers (read_file:manage)
// upload documents; operational users (read_file:view) must acknowledge each
// one. Acks are version-stamped, so a manager "Replace" re-triggers everyone.

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  FileText, FileSpreadsheet, FileImage, File as FileIcon, Upload, Archive,
  ArchiveRestore, ExternalLink, ShieldAlert, Paperclip, X, CheckCircle2,
  RefreshCw, FileDown,
} from 'lucide-react'
import {
  fetchReadFiles, fetchMyAcks, getReadFileUrl, addReadFile, replaceReadFile,
  setReadFileArchived, acknowledgeReadFile, humanFileSize,
  type ReadFileRow, type ReadFileAckRow,
} from '@/lib/supabase/read-files'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { Btn, Field } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'docx', 'doc'])
const MAX_BYTES = 25 * 1024 * 1024

function iconFor(name: string, mime: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) return <FileImage size={16} style={{ color: 'var(--color-accent)' }} />
  if (mime === 'application/pdf' || ext === 'pdf') return <FileText size={16} style={{ color: 'var(--color-danger)' }} />
  if (['xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={16} style={{ color: 'var(--color-success)' }} />
  if (['docx', 'doc'].includes(ext)) return <FileText size={16} style={{ color: 'var(--color-accent)' }} />
  return <FileIcon size={16} style={{ color: 'var(--color-text-3)' }} />
}

export default function ReadFilePage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.READ_FILE_MANAGE)

  const [files, setFiles] = useState<ReadFileRow[]>([])
  const [acks, setAcks] = useState<ReadFileAckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [replaceFor, setReplaceFor] = useState<ReadFileRow | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [f, a] = await Promise.all([fetchReadFiles(installationId), fetchMyAcks(installationId)])
    setFiles(f); setAcks(a); setLoading(false)
  }, [installationId])
  useEffect(() => { load() }, [load])

  const ackedVersion = (fileId: string): number | null => {
    const rows = acks.filter(a => a.read_file_id === fileId)
    if (rows.length === 0) return null
    return Math.max(...rows.map(a => a.acknowledged_version))
  }

  const open = async (r: ReadFileRow) => {
    const url = await getReadFileUrl(r.storage_path)
    if (!url) { toast.error('Could not generate a download link'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const acknowledge = async (r: ReadFileRow) => {
    if (!installationId) return
    const { error } = await acknowledgeReadFile(installationId, r.id, r.version)
    if (error) { toast.error(error); return }
    toast.success('Marked as reviewed')
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  const archive = async (r: ReadFileRow) => {
    const next = !r.is_archived
    if (next && !window.confirm(`Archive "${r.title}"? It drops off the review list and badge but stays in the report history.`)) return
    const { error } = await setReadFileArchived(r.id, next)
    if (error) { toast.error(error); return }
    toast.success(next ? 'Archived' : 'Restored')
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  const active = files.filter(f => !f.is_archived)
  const archived = files.filter(f => f.is_archived)

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Read File</h1>
        {canManage && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={() => setShowAdd(true)}>
              <Upload size={15} /> Add file
            </Btn>
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Documents that airfield management personnel must read and acknowledge. Your acknowledgment records your name, operating initials, and the date. When a file is replaced, it must be re-reviewed.
      </div>

      {/* PII / CUI disclaimer — commercial-cloud system, not an authorized enclave. */}
      <div role="alert" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 14,
        borderRadius: 8, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.45,
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: 'var(--color-danger)' }}>Do not upload PII or CUI.</strong>{' '}
          This system is not an authorized repository for Personally Identifiable Information or Controlled Unclassified Information. Redact sensitive data before uploading.
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
      ) : active.length === 0 ? (
        <EmptyState message="No read files yet." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={th}>Document</th><th style={th}>Version</th><th style={th}>Your status</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const acked = ackedVersion(r.id)
                const isCurrent = acked === r.version
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={td}>
                      <button onClick={() => open(r)}
                        style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left' }}>
                        <span style={{ marginTop: 1, flexShrink: 0 }}>{iconFor(r.file_name, r.mime_type)}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {r.title}
                            <ExternalLink size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                          </span>
                          {r.description && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{r.description}</span>}
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{r.file_name}{r.file_size_bytes != null ? ` · ${humanFileSize(r.file_size_bytes)}` : ''}</span>
                        </span>
                      </button>
                    </td>
                    <td style={{ ...td, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>v{r.version}</td>
                    <td style={td}>
                      {isCurrent ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontWeight: 600 }}>
                          <CheckCircle2 size={15} /> Reviewed v{r.version}
                        </span>
                      ) : (
                        <Btn variant="primary" onClick={() => acknowledge(r)}>
                          <CheckCircle2 size={14} /> I have reviewed this file
                        </Btn>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canManage && (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => setReplaceFor(r)} title="Replace file (re-triggers review)"
                            style={iconBtn}><RefreshCw size={14} /></button>
                          <button onClick={() => archive(r)} title="Archive"
                            style={iconBtn}><Archive size={14} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowArchived(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0 }}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                <tbody>
                  {archived.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={td}>
                        <button onClick={() => open(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-2)', fontFamily: 'inherit', fontSize: 'inherit' }}>
                          {iconFor(r.file_name, r.mime_type)} {r.title}
                        </button>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => archive(r)} title="Restore" style={iconBtn}><ArchiveRestore size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && installationId && (
        <UploadDialog
          title="Add read file"
          requireTitle
          onClose={() => setShowAdd(false)}
          onSubmit={async (file, meta) => addReadFile(installationId, file, meta)}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
      {replaceFor && (
        <UploadDialog
          title={`Replace "${replaceFor.title}"`}
          requireTitle={false}
          onClose={() => setReplaceFor(null)}
          onSubmit={async (file) => {
            const { error } = await replaceReadFile(replaceFor, file)
            return { data: error ? null : ({} as ReadFileRow), error }
          }}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
    </div>
  )
}

// ── Upload dialog — used for both Add (title required) and Replace ──
function UploadDialog({ title, requireTitle, onClose, onSubmit, onDone }: {
  title: string
  requireTitle: boolean
  onClose: () => void
  onSubmit: (file: File, meta: { title: string; description?: string }) => Promise<{ data: ReadFileRow | null; error: string | null }>
  onDone: () => void
}) {
  const [docTitle, setDocTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext)) { toast.error(`${f.name}: unsupported type (PDF, JPG, PNG, Excel, Word only)`); return }
    if (f.size > MAX_BYTES) { toast.error(`${f.name}: exceeds 25 MB`); return }
    setFile(f)
    setDocTitle(t => t.trim() ? t : f.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!file || busy) return
    if (requireTitle && !docTitle.trim()) return
    setBusy(true)
    const { error } = await onSubmit(file, { title: docTitle.trim(), description: desc })
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Saved')
    onDone(); onClose()
  }

  const canSubmit = !!file && !busy && (!requireTitle || !!docTitle.trim())
  const close = () => { if (!busy) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <Upload size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          {requireTitle && (
            <>
              <Field label="Document title *">
                <input className="input-dark" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Local OI 13-204 — Read & Initial" autoFocus />
              </Field>
              <Field label="Description (optional)">
                <input className="input-dark" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short context for reviewers" />
              </Field>
            </>
          )}
          <Field label="File *">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} /> {file ? 'Change file' : 'Attach file'}
              </Btn>
              {file ? (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {iconFor(file.name, file.type || null)} {file.name} · {humanFileSize(file.size)}
                </span>
              ) : (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No file selected</span>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={pick} />
            </div>
          </Field>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>PDF, JPG, PNG, Excel, Word — up to 25 MB.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <Btn variant="ghost" onClick={close} disabled={busy}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!canSubmit}>
            <Upload size={14} /> {busy ? 'Uploading…' : 'Upload'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px 12px' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
```

Note: the `FileDown` / `CheckCircle2` imports cover Task 8's report button added later; leaving them now avoids a second edit. If lint flags `FileDown` as unused before Task 8, remove it and re-add in Task 8.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `FileDown` triggers an unused-var error rather than warning, delete it from the import for now.)

- [ ] **Step 3: Manual smoke (dev server already running on :3000)**

Visit `http://localhost:3000/read-file` as a manager: Add file → it appears → click title opens the file → "I have reviewed this file" flips to "Reviewed v1" → Replace bumps to v2 and the button returns.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/read-file/page.tsx"
git commit -m "Read File: module page (list, acknowledge, add/replace/archive)"
```

---

## Phase 3 — Sidebar badge

### Task 7: Wire the red badge

**Files:**
- Modify: `hooks/use-sidebar-badge-counts.ts`
- Modify: `components/layout/sidebar-nav.tsx`

- [ ] **Step 1: Add the count to the hook**

In `hooks/use-sidebar-badge-counts.ts`:

a) Add the import near the other fetch imports (after the `fetchAmtrNotificationCount` import):

```ts
import { fetchUnacknowledgedReadFileCount } from '@/lib/supabase/read-files'
```

b) Add state (after `const [amtrNotifications, setAmtrNotifications] = useState(0)`):

```ts
  const [readFileOutstanding, setReadFileOutstanding] = useState(0)
```

c) In `refresh`, after the AMTR block, add:

```ts
    if (has(PERM.READ_FILE_VIEW)) {
      tasks.push(fetchUnacknowledgedReadFileCount(installationId).then(setReadFileOutstanding))
    } else {
      setReadFileOutstanding(0)
    }
```

d) In the realtime channel chain (after the `amtr_notifications` `.on(...)`), add two subscriptions:

```ts
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_files', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_file_acknowledgments', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
```

e) In the return, add `readFile` and include it in `total`:

```ts
  const ppr = pprTriage + pprApproval + pprCoord
  const qrc = qrcActive
  const discrepancies = discrepanciesPendingVerification
  const amtr = amtrNotifications
  const readFile = readFileOutstanding
  const total = ppr + qrc + discrepancies + amtr + readFile

  return { ppr, qrc, discrepancies, amtr, readFile, total }
```

- [ ] **Step 2: Render the red dot in the sidebar**

In `components/layout/sidebar-nav.tsx`:

a) Add to `HREF_TO_VIEW_PERM` (in the object near line 121, after `'/amtr'`):

```ts
  '/read-file':         'read_file:view',
```

b) After the AMTR dot block (ends ~line 485, the `{href === '/amtr' && …}` closing `)}`), add a red dot block:

```tsx
          {/* Read File outstanding dot — active files the current user hasn't
              acknowledged at the current version. Red: action-required. */}
          {href === '/read-file' && badgeCounts.readFile > 0 && !active && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-danger)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(239,68,68,0.5)',
            }}>
              {badgeCounts.readFile > 9 ? '9+' : badgeCounts.readFile}
            </span>
          )}
```

c) After the open-state AMTR label (ends ~line 512), add the open-state label:

```tsx
        {isOpen && href === '/read-file' && badgeCounts.readFile > 0 && !active && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-danger)', marginLeft: 'auto' }}>
            {badgeCounts.readFile} to review
          </span>
        )}
```

d) In the section-aggregate block (near line 586, where `sectionAmtr` is computed), add and include it in the section total:

```ts
    const sectionReadFile = section.items.includes('/read-file') ? badgeCounts.readFile : 0
```

Find the line that sums the section contributions (e.g. `const sectionTotal = sectionPpr + sectionQrc + sectionDisc + sectionAmtr`) and add `+ sectionReadFile`. Read-file is action-required (red), so it should keep `sectionDotColor` red — no change needed beyond inclusion in the total, since red is the default/highest priority.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke**

As an AMOPS/AFM user with an unacknowledged active file, the `/read-file` sidebar entry shows a red dot; clicking "I have reviewed this file" clears it within a second (the page fires `glidepath:badges-refresh`).

- [ ] **Step 5: Commit**

```bash
git add hooks/use-sidebar-badge-counts.ts components/layout/sidebar-nav.tsx
git commit -m "Read File: red sidebar badge for outstanding reviews"
```

---

## Phase 4 — Review report

### Task 8: Compliance PDF + button

**Files:**
- Create: `lib/read-file-review-pdf.ts`
- Modify: `app/(app)/read-file/page.tsx` (add Report button + handler)

- [ ] **Step 1: Write the report generator**

Create `lib/read-file-review-pdf.ts`:

```ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { formatZuluDateTime } from '@/lib/utils'
import {
  partitionReviewers,
  type ReadFileRow, type ReadFileAckRow, type ReadFileReviewer,
} from '@/lib/supabase/read-files'

export interface ReadFileReviewPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  files: ReadFileRow[]          // active files
  reviewers: ReadFileReviewer[] // required-reader roster
  acks: ReadFileAckRow[]        // all acks at the base
  generatedBy?: string | null
  generatedAtIso: string        // pass an ISO timestamp (Date.now is unavailable in some contexts)
}

function reviewerLabel(u: ReadFileReviewer): string {
  const last = u.name.split(/\s+/).slice(-1)[0]
  const base = u.rank ? `${u.rank} ${last}` : last
  return u.operating_initials ? `${base} (${u.operating_initials})` : base
}

export async function generateReadFileReviewPdf(
  input: ReadFileReviewPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, files, reviewers, acks, generatedBy, generatedAtIso } = input
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const doc = ctx.doc
  let y = drawBaseHeader(ctx, { baseName: baseName ?? undefined, baseIcao: baseIcao ?? undefined })
  y = drawReportTitle(ctx, { title: 'Read File Review Report', subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`, y })

  // Summary: files, reviewers, % fully current.
  const fullyReviewed = files.filter(f => {
    const acksForVersion = acks.filter(a => a.read_file_id === f.id && a.acknowledged_version === f.version)
    const { outstanding } = partitionReviewers(reviewers, acksForVersion)
    return outstanding.length === 0
  }).length
  y = drawStatBox(ctx, {
    y,
    stats: [
      { label: 'Active files', value: String(files.length) },
      { label: 'Required reviewers', value: String(reviewers.length) },
      { label: 'Fully reviewed', value: `${fullyReviewed}/${files.length}` },
    ],
  })

  for (const f of files) {
    const acksForVersion = acks.filter(a => a.read_file_id === f.id && a.acknowledged_version === f.version)
    const ackByUser = new Map(acksForVersion.map(a => [a.user_id, a]))
    const rows = reviewers.map(r => {
      const a = ackByUser.get(r.user_id)
      return [
        reviewerLabel(r),
        a ? 'REVIEWED' : 'OUTSTANDING',
        a ? formatZuluDateTime(a.acknowledged_at) : '—',
        a?.initials_snapshot ?? (a ? '' : '—'),
      ]
    })
    autoTable(doc, {
      ...tableStyles(),
      startY: y + 6,
      head: [[`${f.title}  (v${f.version})`, 'Status', 'Date', 'Initials']],
      body: rows,
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'REVIEWED' ? [34, 139, 64] : [200, 0, 0]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  drawFooter(ctx, { generatedBy: generatedBy ?? undefined })
  const filename = `read-file-review-${(baseIcao || 'base').toLowerCase()}.pdf`
  return { doc, filename }
}
```

Note: confirm the exact exported names in `lib/pdf-utils.ts` (`createPdf`, `drawBaseHeader`, `drawReportTitle`, `drawStatBox`, `drawFooter`, `tableStyles`) by opening it first — they match `lib/qrc-monthly-review-pdf.ts` imports. If a signature differs, mirror exactly what `qrc-monthly-review-pdf.ts` passes.

- [ ] **Step 2: Add the report button + handler to the page**

In `app/(app)/read-file/page.tsx`:

a) Add imports:

```ts
import { fetchAllAcks, fetchReadFileReviewers } from '@/lib/supabase/read-files'
import { generateReadFileReviewPdf } from '@/lib/read-file-review-pdf'
```

b) Add `currentInstallation` from the installation context:

```ts
  const { installationId, currentInstallation } = useInstallation()
```

c) Add a handler inside the component:

```ts
  const runReport = async () => {
    if (!installationId) return
    const [reviewers, allAcks] = await Promise.all([
      fetchReadFileReviewers(installationId),
      fetchAllAcks(installationId),
    ])
    const { doc, filename } = await generateReadFileReviewPdf({
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      files: active,
      reviewers,
      acks: allAcks,
      generatedAtIso: new Date().toISOString(),
    })
    doc.save(filename)
  }
```

d) In the header actions (next to "Add file", manager-only), add:

```tsx
            <Btn variant="secondary" onClick={runReport}>
              <FileDown size={15} /> Review report
            </Btn>
```

- [ ] **Step 3: Type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke**

As a manager, click "Review report" → a PDF downloads listing each active file with each required reviewer marked REVIEWED (date + initials) or OUTSTANDING.

- [ ] **Step 5: Commit**

```bash
git add lib/read-file-review-pdf.ts "app/(app)/read-file/page.tsx"
git commit -m "Read File: manager review report PDF"
```

---

## Phase 5 — Registration & docs

### Task 9: Module + nav registration

**Files:**
- Modify: `lib/modules-config.ts`
- Modify: `lib/sidebar-config.ts`

- [ ] **Step 1: Register the module**

In `lib/modules-config.ts`:

a) Add to the `ModuleKey` union (after `'whmp'`):

```ts
  | 'read_file'
```

b) Add a `MODULES` entry (append before the closing `]` of the `MODULES` array, after the `whmp` entry):

```ts
  {
    key: 'read_file',
    label: 'Read File',
    category: 'compliance',
    description: 'Read-and-initial continuity file — leadership uploads documents that airfield management personnel must read and acknowledge, with a per-version audit trail and a compliance report.',
    useCase: 'Distribute OIs, policy letters, and read-and-initial items to airfield management personnel and track who has reviewed each one.',
    hrefs: ['/read-file'],
    setupSteps: [],
    defaultEnabled: true,
  },
```

(No `appliesTo` → available in both USAF and civilian modes.)

- [ ] **Step 2: Add the nav item**

In `lib/sidebar-config.ts`:

a) Add to `ALL_NAV_ITEMS` (near the `/amtr` entry, ~line 72):

```ts
  { name: 'Read File', href: '/read-file', iconName: 'BookOpenCheck' },
```

If `BookOpenCheck` is not in the sidebar's `ICON_MAP`, use an icon that is (e.g. `'FileCheck'` or `'ClipboardCheck'`) — verify against `components/layout/sidebar-nav.tsx` `ICON_MAP`.

b) Add `/read-file` to the `Airfield Management` section `items` array in `DEFAULT_SIDEBAR_CONFIG` (line ~116), after `/amtr`:

```ts
      items: ['/discrepancies', '/infrastructure', '/waivers', '/daily-reviews', '/parking', '/obstructions', '/amtr', '/read-file', '/ces'],
```

- [ ] **Step 3: Verify icon is registered**

Open `components/layout/sidebar-nav.tsx`, find `ICON_MAP`, confirm the chosen icon name exists; if not, import it from `lucide-react` and add it to `ICON_MAP`.

- [ ] **Step 4: Type check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0; `/read-file` appears in the build route list.

- [ ] **Step 5: Commit**

```bash
git add lib/modules-config.ts lib/sidebar-config.ts components/layout/sidebar-nav.tsx
git commit -m "Read File: register module + sidebar nav entry"
```

---

### Task 10: enabled_modules backfill migration

**Files:**
- Create: `supabase/migrations/2026062103_read_file_enable_module.sql`

New `defaultEnabled` modules don't reach existing bases (frozen `enabled_modules`). This backfill adds `read_file` to every base that doesn't already have it.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Read File — Migration 4/4: enable the module on existing bases
--
-- enabled_modules is a frozen text[] per base; new defaultEnabled modules
-- are invisible on existing bases until backfilled. Read File applies to
-- both airport types, so enable it everywhere it isn't already present.
-- ============================================================

UPDATE bases
SET enabled_modules = array_append(enabled_modules, 'read_file')
WHERE NOT ('read_file' = ANY(COALESCE(enabled_modules, '{}')));
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062103_read_file_enable_module.sql`
Expected: no error.

- [ ] **Step 3: Verify backfill**

Create `/tmp/verify_read_file_module.sql`:

```sql
SELECT count(*) AS bases_without_read_file
FROM bases
WHERE NOT ('read_file' = ANY(COALESCE(enabled_modules, '{}')));
```

Run: `npx supabase db query --linked --file /tmp/verify_read_file_module.sql`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062103_read_file_enable_module.sql
git commit -m "Read File: enable module on existing bases (migration 4/4)"
```

---

### Task 11: User manual entry + final gate

**Files:**
- Create: `docs/manual/<NN>_read_file.md` (use the next available number)
- Modify: `app/(app)/more/page.tsx` (only if the mobile menu hardcodes a module list rather than deriving from `MODULES`/sidebar config — check first; if it derives, skip)

- [ ] **Step 1: Check the mobile /more menu**

Open `app/(app)/more/page.tsx`. If it renders from the sidebar config / `MODULES` (derived), no change is needed — `/read-file` flows through automatically. If it hardcodes entries, add a `/read-file` entry mirroring `/amtr`.

- [ ] **Step 2: Write the manual page**

Create `docs/manual/<NN>_read_file.md`:

```markdown
# Read File

The Read File module is the digital read-and-initial continuity file. Airfield
management leadership uploads documents — operating instructions, policy
letters, read-and-initial items — and the base's operational users (Airfield
Manager, NAMO, AMOPS, Base Admin) must acknowledge each one.

## Adding a file (managers)
1. Open **Read File** in the sidebar.
2. Click **Add file**, enter a title (and optional description), attach the
   document (PDF, JPG, PNG, Excel, or Word, up to 25 MB), and upload.

Every required reviewer now sees a red badge on the Read File sidebar entry
until they acknowledge it.

## Reviewing a file (everyone required)
1. Open **Read File**. Files you still owe a review show a **Needs review**
   action.
2. Click the document title to open it, read it, then click **I have reviewed
   this file**. Your name, operating initials, and the date/time are recorded.

## Replacing a file
Managers can **Replace** a file. This bumps its version and requires everyone to
re-acknowledge the new version — the badge returns until they do.

## Review report
Managers can run the **Review report** (PDF) showing, for each active file, who
has reviewed it (with initials + date) and who is still outstanding.

## Archiving
Archived files drop off the review list and badge but remain in the report
history.
```

- [ ] **Step 3: Full verification gate**

Run all three and confirm each passes:

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: `tsc` exit 0; vitest all green (including `tests/read-files.test.ts`); build compiles successfully (RC 0) with `/read-file` in the route list.

- [ ] **Step 4: Commit**

```bash
git add docs/manual app/(app)/more/page.tsx
git commit -m "Read File: user manual entry + mobile menu"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Standalone `/read-file` module → Tasks 6, 9 ✓
- Permissions (view all operational roles, manage subset) → Task 1, 4 ✓
- `read_files` + `read_file_acknowledgments` tables + RLS → Task 2 ✓
- Versioned re-sign on replace → Tasks 2 (schema), 5 (`replaceReadFile`), 6 (UI) ✓
- Private `read-files` bucket + storage RLS → Task 3 ✓
- One-click acknowledge w/ initials snapshot → Task 5 (`acknowledgeReadFile`), 6 ✓
- Required-reader set = QRC `REVIEWER_ROLES` → Task 5 (`READ_FILE_READER_ROLES`) ✓
- Red sidebar badge, action-required → Task 7 ✓
- Manager compliance PDF (reviewed vs outstanding per file) → Task 8 ✓
- Module + nav registration, both airport modes → Task 9 ✓
- enabled_modules backfill → Task 10 ✓
- Docs → Task 11 ✓

**Open verification items for the implementer:**
- Confirm `lib/pdf-utils.ts` exports the helper names used in Task 8 (mirror `qrc-monthly-review-pdf.ts` exactly; adjust call sites if a signature differs).
- Confirm the chosen lucide icon name exists in `sidebar-nav.tsx` `ICON_MAP` (Task 9 Step 3).
- Confirm `app/(app)/more/page.tsx` derives its list (Task 11 Step 1); only edit if hardcoded.
- `tableStyles()` spread in Task 8 assumes it returns an autoTable options object — verify against `qrc-monthly-review-pdf.ts` usage; if QRC passes `...tableStyles` differently, match that.
```
