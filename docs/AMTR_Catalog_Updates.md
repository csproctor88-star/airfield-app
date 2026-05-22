# AMTR — Updating the Standard Catalogs to a New HAF Version

There are two ways the standard 1C7X1 catalogs get updated. Both feed the same
**no-wipe merge** (`runSyncCatalogs`): items match by a stable natural key, so
existing rows are updated **in place** (member progress keeps its `catalog_id`),
new items are inserted, and removed standard items are **soft-retired** (hidden
from new entry, kept for history). Nothing is ever deleted.

## Option A — Self-service upload (no deploy)
A base admin / NAMT updates a single base in-app:

> **`/amtr` → Admin → Standard Catalogs → "Update from HAF workbook…"**

Upload the new official HAF training-record `.xlsx`, review the preview, confirm.
Extracts JQS-CFETP, DAF 1098, DAF 803, Qualifications, RAT, and Milestones from
the workbook. Catalogs **not** in the workbook (Formal courses, 623A entry types,
inspection checklist) are left on the bundled standard. Records that base only.

## Option B — Bundled baseline (the factory default; requires a deploy)
Updates the default that ships with the app — used to seed **new** bases and made
available to **all** bases via the "Update to vX" button. Do this when you want a
HAF revision to become the app-wide default.

### Source files
| Catalog | File |
|---|---|
| JQS-CFETP | `lib/amtr/data/jqs-catalog.json` |
| DAF 1098 | `lib/amtr/data/recurring-1098.json` |
| DAF 803 (STS items) | `lib/amtr/data/std-803.json` |
| Formal courses | `lib/amtr/data/formal-courses.json` |
| RAT courses | `lib/amtr/data/rat-courses.json` |
| Milestones | `lib/amtr/data/milestones.json` |
| Qualifications / Skill Levels / SEIs | `QUAL_CATALOG` in `lib/amtr/seed-data.ts` |
| 623A entry types | `DEFAULT_623A_ENTRY_TYPES` in `lib/amtr/reference-data.ts` |
| Inspection checklist | `DEFAULT_INSPECTION_CHECKLIST` in `lib/amtr/inspection-checklist.ts` |

### Steps
1. Edit the relevant source file(s) with the new HAF content. **Keep the field
   shapes** (see `JqsSeedRow` / `Recurring1098Row` / etc. in `seed-data.ts`).
2. **Bump `CATALOG_VERSION`** in `lib/amtr/seed-data.ts` (e.g. `'2026.05 (1C7X1)'`
   → `'2026.11 (1C7X1)'`).
3. `npx tsc --noEmit` + `npm run build` to confirm clean, commit, deploy.
4. Each base now shows **"On vOLD · Available vNEW — Update available"** in Admin;
   a NAMT clicks **Update to vNEW** to merge it (no wipe).

### Regenerating the JSON from a workbook
The fastest way to rebuild the bundled JSON from a new HAF `.xlsx` is to reuse the
in-app extractor (`lib/amtr-catalog-import.ts` → `parseStandardCatalogsWorkbook`)
in a small Node script that writes the `lib/amtr/data/*.json` files. The original
generator, `scripts/extract-amtr-seed.mjs`, was tied to the prototype source
format (`public/training/`), not a HAF `.xlsx` — adapt the extractor instead.

## The natural-key rule (important)
Matching is by: JQS = task **number**; 1098/RAT/Formal/Qual = **name**; 803 =
**section + STS item**; Milestones = **path + topic**; Inspection = **kind +
item number**; 623A types = **label**.

Keep these keys stable across versions. If HAF **renames** an item, the merge
sees it as *remove old + add new* → the old one soft-retires (its history is
preserved) and the new one is added. To carry a member's record across a rename,
edit the existing row's key in place rather than replacing it.

## Safety / behavior recap
- **Never deletes** — removed items soft-retire (`retired=true`), preserved for
  history and in the Excel export.
- **Custom items are untouched** — rows a NAMT added (`managed=false`) are never
  retired by a sync.
- **Idempotent** — re-running with no changes writes nothing.
