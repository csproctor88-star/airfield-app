# Read File Module — Design Spec

**Date:** 2026-06-22
**Status:** Approved (design) — pending implementation plan
**Author:** Session work (Glidepath)

## Summary

A new standalone **Read File** module at `/read-file`. Managers (Airfield
Manager / NAMT roles + Base Admin) upload documents that the base's operational
users (AFM, NAMO, AMOPS, Base Admin) must read and acknowledge ("read and
initial"). The module mirrors the
AMTR Files tab for upload/storage and the QRC monthly-review for the
acknowledge-and-report mechanics. Users who have not acknowledged an active file
at its current version see a **red action-required badge** on the `/read-file`
sidebar entry. A manager-only PDF report lists, per file, who has reviewed and
who is outstanding.

This implements the standard USAF **read-and-initial continuity file** concept.

## Goals

- Managers add a file once; all base members must review/sign it.
- One-click acknowledgment captures user + timestamp + operating initials.
- Replacing a file re-triggers acknowledgment for everyone (version-stamped).
- Red badge on the sidebar entry while the current user has unreviewed files.
- A compliance PDF report of who has/hasn't reviewed each file.

## Non-Goals

- No typed-signature / CAC flow (one-click + initials snapshot only).
- No per-file audience selection (audience is always "all base members").
- No periodic/recurring re-review (re-sign happens only on file replacement).
- No `types.ts` regen in this work (use `as any` casts, per `qrc-reviews.ts`).

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Placement | Standalone top-level nav module `/read-file` |
| Required audience | Operational roles only — `airfield_manager`, `namo`, `amops`, `base_admin`, `sys_admin` (the QRC `REVIEWER_ROLES` set). Read-only / ATC / safety viewers are NOT tracked. |
| Recurrence | Once per file; re-sign when the file is replaced (version bump) |
| Sign method | One-click "I have reviewed this file" → records user, timestamp, operating initials |
| Airport modes | Available in **both** USAF and civilian (Part 139) modes |
| Archived files | Drop off badge/required list; remain in report history |
| Managers | Also must acknowledge their own files (they are base members) |

## Permissions

New matrix keys (mirror the AMTR grant structure in
`2026052000_amtr_permissions.sql`):

- **`read_file:view`** — open the module, view files, acknowledge. Granted to
  the **operational roles only**: `airfield_manager`, `namo`, `amops`,
  `base_admin`, `sys_admin`. These are exactly the users who must read & sign,
  and the only users who see the module / badge. (Read-only / ATC / safety
  roles are intentionally NOT granted — they have no read-file obligation.)
- **`read_file:manage`** — add/replace/archive files + run the report. Granted
  to `airfield_manager`, `namo`, `base_admin`, `sys_admin` (AMOPS gets view +
  sign, not manage — parallels their AMTR access).

Mirror both keys in `lib/permissions.ts` (`PERM.READ_FILE_VIEW`,
`PERM.READ_FILE_MANAGE`).

**Required-reader set.** The "who is outstanding" / badge / report audience is
the set of `base_members` whose `role` is in
`['airfield_manager', 'namo', 'amops', 'base_admin', 'sys_admin']` — identical
to QRC's `REVIEWER_ROLES` (`lib/supabase/qrc-reviews.ts`). Defensive fold-in:
anyone outside this set who somehow has an ack row still appears in the report
(matches the QRC consolidated-report behavior), but they never drive the badge.

## Data Model

### `read_files`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `base_id` | uuid NOT NULL | FK `bases(id)` |
| `title` | text NOT NULL | document title |
| `description` | text NULL | optional context |
| `storage_path` | text NOT NULL | `{base_id}/{timestamp}-{safeName}` |
| `file_name` | text NOT NULL | original filename |
| `mime_type` | text NULL | |
| `file_size_bytes` | bigint NULL | |
| `version` | int NOT NULL DEFAULT 1 | bumped on replace |
| `is_archived` | bool NOT NULL DEFAULT false | |
| `created_by` | uuid NULL | `profiles(id)` (ON DELETE SET NULL) |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | touched on replace |

### `read_file_acknowledgments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `base_id` | uuid NOT NULL | FK `bases(id)` — denormalized for RLS/report |
| `read_file_id` | uuid NOT NULL | FK `read_files(id)` ON DELETE CASCADE |
| `user_id` | uuid NOT NULL | `profiles(id)` |
| `acknowledged_version` | int NOT NULL | the `read_files.version` at sign time |
| `initials_snapshot` | text NULL | operating initials captured at sign time |
| `acknowledged_at` | timestamptz DEFAULT now() | |

- Unique index on `(read_file_id, user_id, acknowledged_version)` — one ack per
  user per version.
- Rows are immutable (insert-only audit). No UPDATE; DELETE only via the file's
  CASCADE.

### Outstanding logic
For a user **in the required-reader set** at a base: active
(`is_archived = false`) `read_files` for which **no**
`read_file_acknowledgments` row exists matching `(read_file_id, user_id,
acknowledged_version = read_files.version)`. The badge count is the size of that
set. Users outside the required set (read-only/ATC/safety) never see the module,
so the count is moot for them; the `read_file:view` grant already excludes them.

## RLS (matrix helpers only)

`read_files`:
- SELECT — `user_has_base_access(uid, base_id) AND user_has_permission(uid, 'read_file:view')`
- INSERT/UPDATE/DELETE — `… AND user_has_permission(uid, 'read_file:manage')`

`read_file_acknowledgments`:
- SELECT — `… AND user_has_permission(uid, 'read_file:view')` (needed so the
  report can read all acks at the base)
- INSERT — `… AND user_has_permission(uid, 'read_file:view') AND user_id = auth.uid()`
  (you sign only as yourself)
- No UPDATE/DELETE policy (immutable; CASCADE on file delete).

## Storage

- New **private** bucket `read-files`.
- Path: `{base_id}/{timestamp}-{safeName}` (first segment is `base_id` directly —
  simpler than AMTR's member→base resolution).
- Storage RLS (mirror `2026052005_amtr_storage.sql`, but base-id-in-path):
  - SELECT — base access + `read_file:view`
  - INSERT — base access + `read_file:manage`
  - DELETE — base access + `read_file:manage`
- 25 MB cap; accept `.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc` (reuse the
  AMTR `ACCEPT`/`ALLOWED_EXT` constants).
- PII/CUI disclaimer banner reused from `files-tab.tsx`.

## UI — `/read-file`

Single page (`app/(app)/read-file/page.tsx`), pattern-matched to `files-tab.tsx`.

**Header:** title + "Add file" button (visible with `read_file:manage`).

**PII/CUI disclaimer banner** (reused).

**Active files table:**
- **Document** — title + filename; click opens the signed URL in a new tab.
- **Date** — document/updated date.
- **Version** — `v{n}` (shown when > 1).
- **Your status** — `✓ Reviewed v{n}` (muted/green) OR a red **Needs review**
  pill + **"I have reviewed this file"** button. Acknowledge inserts an ack row
  with the current version + the user's operating initials snapshot; the row
  flips to reviewed without a full reload.
- **Reviewed X/Y** — manager-only progress chip per file (acks at current
  version ÷ base member count).
- **Manage actions** (manager-only) — **Replace** (upload new file → version
  bump) and **Archive**.

**Add-file dialog:** Document title (required), description (optional), document
date (required), attach (required) — mirrors `AddFileDialog`.

**Replace dialog:** attach a new file; on success, update `storage_path`,
`file_name`, `mime_type`, `file_size_bytes`, `version = version + 1`,
`updated_at = now()`. Old object may be removed from the bucket after the row
update succeeds.

**Archived section:** collapsed list toggle (manager-only) for archived files.

## Sidebar badge

- Add `readFile` to `useSidebarBadgeCounts`:
  - `fetchUnacknowledgedReadFileCount(baseId, userId)` gated on
    `PERM.READ_FILE_VIEW`.
  - Realtime subscriptions on `read_files` and `read_file_acknowledgments`
    (filtered by `base_id` where possible).
- In `sidebar-nav.tsx`, render a **red** dot (`var(--color-danger)`) on the
  `/read-file` entry when `badgeCounts.readFile > 0 && !active`, with the
  open-state "{n} to review" label. Red = action-required, per the notification
  dot-color convention.
- Include `read_file` in the Operations section-header aggregate dot.

## Review report (PDF)

- `lib/read-file-review-pdf.ts`, returning `{ doc, filename }` (PDF convention).
- Data via `lib/supabase/read-files.ts`:
  - all active files at the base,
  - all acks at the base (current + historical versions),
  - the required-reader roster — `base_members` in the required-reader roles
    with profile fields (name, rank, operating_initials) — two-step query like
    `fetchAllReviewsForBase` / `fetchEligibleReviewers`.
- Layout: per active file — title, version, upload date — then a table of every
  required-reader marked `Reviewed ({initials} · {date})` for the current
  version, or **OUTSTANDING**; per-file and overall summary counts. (Acks from
  users outside the required set still render, per the defensive fold-in.)
- Button on `/read-file`, gated on `read_file:manage`.

## Module registration

- Add a `read_file` module key to the module registry / `enabled_modules`
  (`defaultEnabled`), available in both airport modes.
- Register the route in `sidebar-nav.tsx` and `HREF_TO_VIEW_PERM`
  (`/read-file` → `read_file:view`).
- Add to the mobile `/more` menu and any module-list surfaces.

## Migrations (expand-only; applied individually via `db query --linked --file`)

1. `2026062100_read_file_permissions.sql` — permission keys + role grants.
2. `2026062101_read_file_tables.sql` — `read_files` + `read_file_acknowledgments`
   + indexes + RLS.
3. `2026062102_read_file_storage.sql` — `read-files` bucket + storage RLS.
4. `2026062103_read_file_enable_module.sql` — backfill `enabled_modules` for
   existing bases (closes the known new-`defaultEnabled`-module gap).

Never `db push`; one SELECT-returning statement per verification file. `types.ts`
regen deferred — access new tables via `as any` (the `qrc-reviews.ts` pattern).

## Phasing (review-gated)

1. **Schema** — migrations 1–3 + `lib/supabase/read-files.ts` CRUD + `PERM` keys.
2. **Page** — `/read-file` list, upload, replace, archive, acknowledge.
3. **Badge** — `useSidebarBadgeCounts` + `sidebar-nav.tsx` dot.
4. **Report** — `lib/read-file-review-pdf.ts` + button.
5. **Registration** — `enabled_modules` (migration 4) + nav/more + `docs/manual`.

## Testing

- Unit: outstanding-count logic (active/archived, version match), report data
  preparation (reviewed vs outstanding partition), NOTAM-style pure helpers if any.
- RLS regression guard: a non-manager cannot insert `read_files`; a user cannot
  insert an ack for another `user_id`; cross-base reads are denied.
- Build gate: `npx tsc --noEmit` + `npm run build` RC=0 + `npx vitest run` green.

## Open risks / notes

- **enabled_modules backfill** — existing bases won't see the module until the
  backfill migration runs (known systemic gap).
- **Required-reader count for "Y"** — active `base_members` rows whose `role` is
  in the required-reader set (`airfield_manager`, `namo`, `amops`, `base_admin`,
  `sys_admin`); excludes deactivated accounts and all read-only/ATC/safety
  viewers. Reuse / parallel `REVIEWER_ROLES` from `qrc-reviews.ts` so the two
  modules stay in sync.
