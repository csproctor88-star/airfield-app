# Manager-Addable DAF 803 Sections — Design

**Date:** 2026-06-30
**Module:** AMTR — DAF Form 803 (Standard Task Evaluations)
**Status:** Draft for review

## Goal

Let training managers add a new **Section** under DAF 803 from the AMTR Admin page; the
new section shows as a chip on member records like the built-in sections, and managers
can add tasks under it. Also rename sections and delete custom ones.

## Background

- 803 **tasks** are already a per-base catalog (`amtr_803_catalog`: `section`, `sts_item`).
- 803 **sections are hardcoded** in `DAF803_SECTIONS` (`lib/amtr/reference-data.ts:267`)
  — 5 keys: `apprenticeGrad`, `amslAmos`, `fiveLevel`, `sevenLevel`, `afm`.
- The member table `amtr_803.section` has a `CHECK (section IN (...))` constraint locking
  those 5 keys — the blocker for new sections.
- JQS already stores sections as data (catalog rows with a `kind`); this mirrors that idea
  with a dedicated sections table.

## Data model

New table **`amtr_803_sections`** (per base):

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `base_id` | uuid → bases | |
| `section_key` | text NOT NULL | stable key stored on `amtr_803_catalog.section` + `amtr_803.section`. Built-ins use their canonical keys; custom = generated uuid |
| `label` | text NOT NULL | chip label |
| `builtin` | boolean DEFAULT false | the 5 defaults — cannot be deleted (rename only) |
| `sort_order` | int | chip order |
| `created_at`, `updated_at` | timestamptz | |

`UNIQUE (base_id, section_key)`. RLS: select = `amtr:view`, write = `amtr:manage` (mirror
`amtr_803_catalog`).

Sections relate to tasks/evals **by the `section` text key** (no FK) — unchanged from
today; we only move the section *list* from a const into this table.

## Migration — `supabase/migrations/2026063001_amtr_803_sections.sql`

Applied to the linked DB via `npx supabase db query --linked --file` (never `db push`).

1. `create table amtr_803_sections (...)` + RLS policies (select `amtr:view`, write
   `amtr:manage`, using the matrix helpers `user_has_base_access` + `user_has_permission`).
2. **Drop the member-table CHECK**: `alter table amtr_803 drop constraint if exists
   <name>;`. The exact constraint name will be read from the linked DB first
   (`information_schema`/`pg_constraint`) — the inline check is auto-named, likely
   `amtr_803_section_check`.
3. **Backfill** the 5 built-in sections for every base (idempotent):
   `insert into amtr_803_sections (base_id, section_key, label, builtin, sort_order)
   select b.id, v.key, v.label, true, v.ord from bases b cross join (values
   ('apprenticeGrad','Apprentice Grad',0), ('amslAmos','AMSL/AMOS',1),
   ('fiveLevel','5-Level',2), ('sevenLevel','7-Level',3), ('afm','AFM',4)) as v(key,label,ord)
   on conflict (base_id, section_key) do nothing;`

Safe to apply **before** deploy: old code reads `DAF803_SECTIONS` (ignores the new table);
dropping the CHECK only relaxes inserts (old code still inserts built-in keys). New code
reads the table.

`lib/amtr/seed-data.ts` also seeds the 5 built-in sections into `amtr_803_sections` for
newly-created bases (alongside the existing `STD_803` catalog seed).

## Record display

- `app/(app)/amtr/[memberId]/page.tsx`: load `sections803 = fetchAmtrByBase('amtr_803_sections', installationId)`
  (sorted by `sort_order`); pass to `Form803Tab`.
- `components/amtr/form803-tab.tsx`: accept a `sections` prop and iterate it for the chips
  (key = `section_key`, label = `label`) instead of `DAF803_SECTIONS`. Fall back to
  `DAF803_SECTIONS` when the prop is empty (defensive). `SECTION_NOTES` stays keyed by the
  built-in keys; custom sections render no blurb.

## Admin

- `app/(app)/amtr/roles/page.tsx`: load `sections803` and pass to `Form803CatalogEditor`.
- `components/amtr/form803-catalog-editor.tsx`:
  - Iterate the fetched sections (not the const) to group tasks.
  - **"+ Add Section"**: prompts for a label → `upsertAmtrRow('amtr_803_sections',
    { base_id, section_key: crypto.randomUUID(), label, builtin: false, sort_order: max+1 })`.
  - **Rename** (inline): `updateAmtrRow('amtr_803_sections', id, { label })` — allowed for
    built-ins and custom.
  - **Delete** (custom only, hidden/disabled for `builtin`): guard — query
    `amtr_803` for any row with `section = section_key` at this base; if any exist, toast
    "Members have evaluations under this section — move/remove them first" and abort. Else
    delete the section row and its `amtr_803_catalog` rows for that key.
  - Existing per-section "+ Add Task" is unchanged.

## Pure helper (testable)

`lib/amtr/form803-sections.ts`:
- `resolveSections(fetched): { key, label, builtin }[]` — returns the fetched sections
  sorted by `sort_order`, or the `DAF803_SECTIONS` defaults (builtin=true) when empty.
Unit-tested (empty → defaults; non-empty → sorted passthrough).

## Testing

- Unit-test `resolveSections`.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` green.
- After applying the migration: query the linked DB to confirm the table exists, the CHECK
  is gone, and the 5 sections backfilled per base.
- Manual smoke: Admin → DAF 803 → Add Section "Test" → add a task under it → open a member
  record → "Test" chip appears with the task; rename works; delete blocked when a member
  has an eval under it, allowed otherwise.

## Non-goals

- Reordering sections by drag (deferred — `sort_order` exists; only +Add appends).
- Changing how tasks/evals reference sections (still by `section` text key).
- Built-in section deletion (rename only).
