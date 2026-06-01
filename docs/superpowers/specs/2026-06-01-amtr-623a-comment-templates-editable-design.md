# Editable 623A Comment Templates (AMTR) — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Author:** Session (brainstormed with user)

## Summary

Make the AMTR **623A comment templates** (the DAFMAN 13-204v2 comment shells
inserted via the "Insert DAFMAN template…" picker) editable by admins from the
623A catalog admin page (`/amtr/roles`, gated on `amtr:manage`). Today they are
a hardcoded, read-only const (`COMMENT_TEMPLATES` in `lib/amtr/reference-data.ts`).
Move them to a per-base Supabase table seeded from the shipped defaults, add a
catalog editor, and point the two read consumers at the table (with a fallback
to the bundled defaults so unseeded bases don't regress).

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Edit scope | Full: label, citation, body + add / delete / reorder |
| Defaults model | Per-base copy seeded from the 12 bundled defaults; "Restore standards" rides the existing **Sync standard catalogs** control |
| Placement | New "623A Comment Templates" CollapsibleCard next to "623A Entry Types" on `/amtr/roles` |

## Data model

New table **`amtr_623a_comment_templates`** (mirrors `amtr_623a_entry_types`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `base_id` | uuid | `references bases(id) on delete cascade` |
| `key` | text | stable sync identity (e.g. `monthlyEval`); generated for user-added rows |
| `label` | text | picker label |
| `cite` | text | IAW citation (advisory; editable) |
| `body` | text | the labeled-blank lines **without** the auto-header |
| `sort_order` | int | |
| `created_at` / `updated_at` | timestamptz | `now()` |

RLS: `FOR ALL TO authenticated USING (user_has_base_access(auth.uid(), base_id)
AND user_has_permission(auth.uid(), 'amtr:manage'))` — copy of the
`amtr_623a_entry_types` policy. Expand-only migration `2026062002`.

`lib/supabase/types.ts`: add the table Row/Insert/Update.

## Insert-time composition

The shipped `tpl()` composes `text = "(${label} — IAW ${cite})\n\n" + lines`.
We store `body` = the lines only and recompose on insert:

```
composeTemplateText(label, cite, body) =>
  `(${label} — IAW ${cite})\n\n${body}`   // body trimmed of leading/trailing blank lines
```

So editing label/cite updates the inserted header automatically. Pure + TDD'd.

## Defaults / seeding

`lib/amtr/reference-data.ts` exports `bundled623aCommentTemplates()` mapping the
existing `COMMENT_TEMPLATES` → `{ key, label, cite, body, sort_order }`, deriving
`body` by stripping the first two composed lines (header + blank). **No reg text
is rewritten** — defaults seed verbatim from what ships today.

`lib/amtr/seed-data.ts`: register `amtr_623a_comment_templates` in
`seedBaseCatalogs`, `CATALOG_SYNC_META` (key = `r.key`; fields = `key, label,
cite, body, sort_order`), `BUNDLED`, and `SEED_COUNTS`. Bump `CATALOG_VERSION`
so the sync diff surfaces the new catalog. "Restore standards" = the existing
`syncStandardCatalogs` flow (re-adds missing by key, updates fields) — no new UI.

## UI

`components/amtr/form623a-template-editor.tsx` — modeled on `SimpleCatalogEditor`
(same warning banner, add/Done, drag-reorder, delete-confirm) but each row has:
a label input, a citation input, and a **textarea** for body. A one-line hint:
"Edits change this base's inserted shells; citations are advisory." Add uses a
generated `key` (e.g. `custom-<sort>`); label/cite/body default to empty/new.

`app/(app)/amtr/roles/page.tsx`: load `amtr_623a_comment_templates` into state in
`load()`, render a "623A Comment Templates" CollapsibleCard with the new editor.

## Read-consumer rewire

New hook `hooks/use-amtr-623a-templates.ts` →
`useAmtr623aTemplates(installationId): CommentTemplate[]` — fetches the per-base
rows, maps to `{ key, label, cite, text: composeTemplateText(...) }`, and
**falls back to `COMMENT_TEMPLATES`** when the table is empty/unseeded or
`installationId` is null.

- `components/amtr/form623a-tab.tsx` — replace the `COMMENT_TEMPLATES` import in
  the "Insert DAFMAN template…" dropdown with the hook.
- `components/amtr/auto-623a-dialog.tsx` — same for its template dropdown. Its
  per-source (1098/JQS/797/803) auto pre-fill stays as-is — that's row-data
  prefill built from catalog rows, not a comment template.

## Testing

`tests/amtr-623a-templates.test.ts` (pure):
- `composeTemplateText` — header line format; body trimmed; cite/label reflected.
- `bundled623aCommentTemplates()` — returns 12 rows; each has non-empty
  key/label/cite/body; body excludes the `(… — IAW …)` header; round-trip
  `composeTemplateText(label, cite, body)` reproduces the original const `text`.

Gate on `npx tsc --noEmit` + `npx vitest run` + `npm run build` (RC 0).

## Out of scope (YAGNI)

- Per-template restore button (global Sync standard catalogs covers it).
- Editing the auto-dialog's per-source inline pre-fill text.
- Cross-base / global template sets (everything is `base_id`-scoped).
- Rich-text / formatting in the body (plain text shells only).
