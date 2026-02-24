# Multi-Base Scaling — Implementation Plan

**Restore point:** `git checkout v1.0-selfridge-only`

---

## Phase 1: Database — Inspection Templates + Runway Class

### 1A. New migration: `base_inspection_templates`

Create three new tables to store customizable inspection checklists per base:

```sql
-- base_inspection_templates: one row per template (airfield / lighting per base)
CREATE TABLE base_inspection_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('airfield', 'lighting')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, template_type)
);

-- base_inspection_sections: sections within a template
CREATE TABLE base_inspection_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES base_inspection_templates(id) ON DELETE CASCADE,
  section_id    TEXT NOT NULL,        -- e.g. 'af-1', 'lt-3'
  title         TEXT NOT NULL,
  guidance      TEXT,
  conditional   TEXT,                 -- optional conditional label
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(template_id, section_id)
);

-- base_inspection_items: individual checklist items within a section
CREATE TABLE base_inspection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    UUID NOT NULL REFERENCES base_inspection_sections(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,        -- e.g. 'af-1', 'lt-10'
  item_number   INTEGER NOT NULL,
  item_text     TEXT NOT NULL,        -- e.g. 'TWY A', '01 PAPI'
  item_type     TEXT NOT NULL DEFAULT 'pass_fail' CHECK (item_type IN ('pass_fail', 'bwc')),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
```

Seed Selfridge's current 74 items (from `lib/constants.ts`) as the initial data for base `00000000-0000-0000-0000-000000000001`.

### 1B. Add `runway_class` column to `base_runways`

```sql
ALTER TABLE base_runways
  ADD COLUMN IF NOT EXISTS runway_class TEXT NOT NULL DEFAULT 'B'
    CHECK (runway_class IN ('B', 'Army_B'));
```

Update Selfridge's runway to `runway_class = 'B'`.

### 1C. Surface criteria lookup table (code, not DB)

Create `lib/calculations/surface-criteria.ts` with a mapping:

```typescript
export const SURFACE_CRITERIA: Record<string, SurfaceCriteriaSet> = {
  B: { /* current IMAGINARY_SURFACES values */ },
  Army_B: { /* Army Class B values from UFC 3-260-01 Table 3-8 */ },
}
```

**Files changed:**
- New: `supabase/migrations/20260224_inspection_templates.sql`
- New: `lib/calculations/surface-criteria.ts`
- Modified: `lib/calculations/obstructions.ts` — `evaluateObstruction()` accepts `runwayClass` param, looks up criteria from the map instead of using hardcoded `IMAGINARY_SURFACES`

---

## Phase 2: Supabase Data Layer — Fetch/Mutate Inspection Templates

### 2A. New file: `lib/supabase/inspection-templates.ts`

Functions:
- `fetchInspectionTemplate(baseId, type)` — returns sections + items for a template
- `createDefaultTemplate(baseId, type)` — clones Selfridge template as starting point for new bases
- `updateSectionItem(itemId, updates)` — edit item text, type, or number
- `addSectionItem(sectionId, item)` — add new item to section
- `deleteSectionItem(itemId)` — remove item
- `addSection(templateId, section)` — add new section
- `deleteSection(sectionId)` — remove section (cascades items)
- `reorderItems(sectionId, itemIds[])` — update sort_order

### 2B. Update `lib/supabase/types.ts`

Add types for the new tables: `InspectionTemplate`, `InspectionTemplateSection`, `InspectionTemplateItem`.

**Files changed:**
- New: `lib/supabase/inspection-templates.ts`
- Modified: `lib/supabase/types.ts`

---

## Phase 3: Obstruction Engine — Parameterize by Runway Class

### 3A. Refactor `lib/calculations/obstructions.ts`

- Import `SURFACE_CRITERIA` from the new lookup
- `evaluateObstruction()` gains a `runwayClass: string` parameter
- At call time, look up `SURFACE_CRITERIA[runwayClass]` to get surface dimensions
- Keep `IMAGINARY_SURFACES` as the "display metadata" (names, colors, UFC refs) but pull numeric criteria from the lookup
- If class not found, fall back to Class B with a console warning

### 3B. Update obstruction UI pages

**`app/(app)/obstructions/page.tsx`:**
- Line 329: Replace hardcoded `runway_class: 'B'` — read from the selected runway's `runway_class` in the installation context
- Add runway class display in the form (read-only, showing what class the runway is)

**`app/(app)/obstructions/[id]/page.tsx`:**
- Line 246: Replace hardcoded `'01/19 (Class B)'` — read `runway_class` from the evaluation record

**Files changed:**
- Modified: `lib/calculations/obstructions.ts`
- New: `lib/calculations/surface-criteria.ts` (from Phase 1C)
- Modified: `app/(app)/obstructions/page.tsx`
- Modified: `app/(app)/obstructions/[id]/page.tsx`

---

## Phase 4: Remove All Hardcoded Selfridge References

### 4A. `lib/constants.ts`

- **Remove** the `INSTALLATION` constant entirely (all data now comes from DB via installation context)
- **Remove** `AIRFIELD_AREAS` constant (already in `base_areas` table)
- **Remove** `AIRFIELD_INSPECTION_SECTIONS` and `LIGHTING_INSPECTION_SECTIONS` (moved to DB)
- **Keep** everything else (discrepancy types, severity config, check types, BWC options, roles, etc. — these are universal, not base-specific)

### 4B. `lib/installation-context.tsx`

- Line 10: Replace `SELFRIDGE_INSTALLATION_ID` fallback — fall back to first available installation from DB, or show a "select base" prompt if none
- Line 63: Remove `AIRFIELD_AREAS` fallback (if no areas in DB, show empty state with instruction to configure)

### 4C. `app/(app)/page.tsx`

- Lines 55-63: Remove `DEFAULT_NAVAIDS` fallback — fetch from `base_navaids` for current installation; show "No NAVAIDs configured" empty state if empty

### 4D. `lib/weather.ts`

- Lines 5-6: Remove `SELFRIDGE_LAT/LON` — accept coordinates as parameters, sourced from installation context (base elevation_msl, runway midpoint)

### 4E. `app/layout.tsx`

- Lines 7-8: Change to generic branding:
  - `title: 'Glidepath'`
  - `description: 'Glidepath — Airfield Operations Suite'`

### 4F. `public/manifest.json`

- Line 4: Change description to `"Glidepath — Airfield Operations Suite"`

### 4G. PDF exports — parameterize headers/filenames

All 5 PDF files need to accept installation name + ICAO as parameters instead of hardcoding:

| File | Lines | Change |
|------|-------|--------|
| `lib/pdf-export.ts` | 44, 232, 373, 563, 593, 687 | Accept `baseName`, `icao`, `unit` params; format header dynamically |
| `lib/reports/daily-ops-pdf.ts` | 100 | Use `baseName (icao)` |
| `lib/reports/open-discrepancies-pdf.ts` | 70, 203 | Use `baseName (icao)`, `{icao}_Open_Discrepancies_` |
| `lib/reports/aging-discrepancies-pdf.ts` | 78, 213 | Same pattern |
| `lib/reports/discrepancy-trends-pdf.ts` | 58, 155 | Same pattern |

Each PDF function gets a new parameter (or options object) with `baseName`, `baseIcao`, `baseUnit`. Callers pass these from `useInstallation()`.

### 4H. API routes

- `app/api/weather/route.ts`: Accept `station` as query param instead of hardcoding `KMTC`
- `app/api/notams/sync/route.ts`: Accept `icao` as query param

**Files changed:**
- Modified: `lib/constants.ts`
- Modified: `lib/installation-context.tsx`
- Modified: `app/(app)/page.tsx`
- Modified: `lib/weather.ts`
- Modified: `app/layout.tsx`
- Modified: `public/manifest.json`
- Modified: `lib/pdf-export.ts`
- Modified: `lib/reports/daily-ops-pdf.ts`
- Modified: `lib/reports/open-discrepancies-pdf.ts`
- Modified: `lib/reports/aging-discrepancies-pdf.ts`
- Modified: `lib/reports/discrepancy-trends-pdf.ts`
- Modified: `app/api/weather/route.ts`
- Modified: `app/api/notams/sync/route.ts`

---

## Phase 5: Inspection Template Management UI

### 5A. New page: `app/(app)/settings/templates/page.tsx`

Accessible from Settings page for `airfield_manager` and `sys_admin` roles.

**UI Features:**
- Toggle between Airfield / Lighting template
- Displays sections in order, each expandable
- Within each section, items are listed with:
  - Item text (editable inline)
  - Item type toggle (pass/fail vs BWC)
  - Delete button (with confirm)
  - Drag handle for reorder (or up/down arrows)
- "Add Item" button at bottom of each section
- "Add Section" button at bottom of template
- "Delete Section" button on each section header (with confirm, warns about cascade)
- All changes save immediately via the supabase functions from Phase 2A

### 5B. Update Settings page

Add a link/card to "Manage Inspection Templates" in the Settings page, visible only to `airfield_manager` / `sys_admin`.

### 5C. Update inspections page

- `app/(app)/inspections/page.tsx`: Fetch template from DB (`fetchInspectionTemplate`) instead of importing constants
- Add loading state while template loads
- Handle "no template configured" empty state

**Files changed:**
- New: `app/(app)/settings/templates/page.tsx`
- Modified: `app/(app)/settings/page.tsx`
- Modified: `app/(app)/inspections/page.tsx`

---

## Phase 6: Base Onboarding — Admin UI + Data Guide

### 6A. Enhance existing installation management in Settings

The Settings page already has an Installation section with base switching. Enhance it:

- **Add Base** button — opens a modal/form with:
  - Search/select from the 200+ base directory (`bases` table with `is_active`)
  - Or create custom entry (name, ICAO, unit, MAJCOM, location, elevation, timezone)
  - On selection: create `base_members` entry, create default inspection templates (clone from Selfridge)
- **Configure Base** — link to a setup wizard for the selected base:
  - Runway configuration (add/edit runways with class, geometry, approach lighting)
  - NAVAID definitions (add/edit/remove)
  - Airfield areas (add/edit/remove)
  - CE shops (add/edit/remove)
  - Inspection templates (link to Phase 5A page)

### 6B. Data guide for new base onboarding

To onboard a new base, you will need:

1. **Base metadata** — Name, ICAO code, unit, MAJCOM, location, elevation (MSL), timezone
2. **Runway data** (per runway):
   - Designators (e.g., "09/27")
   - Length and width (ft)
   - Surface type
   - True heading
   - Threshold coordinates (lat/lon for each end)
   - Magnetic heading for each end
   - Approach lighting system for each end (e.g., MALSR, ALSF-2, SSALR)
   - Runway class (B or Army B)
3. **NAVAIDs** — List of NAVAID names to track (e.g., "09 ILS", "27 Localizer")
4. **Airfield areas** — List of named areas for check scoping (e.g., "RWY 09/27", "TWY C", "Main Apron")
5. **CE shops** — List of CE shop names for discrepancy routing
6. **Inspection checklist items** — Can start from Selfridge template and customize, or build from scratch

Sources for this data:
- **AIP / FAA Airport Facility Directory (AF/D)** for ICAO, coordinates, elevation, runway dimensions
- **Base Civil Engineering** for CE shop names, areas, runway class
- **Airfield Manager** for inspection checklist items, NAVAIDs, approach lighting

**Files changed:**
- Modified: `app/(app)/settings/page.tsx`
- New: `app/(app)/settings/base-setup/page.tsx` (or modal components)

---

## Phase 7: Build Verification

- Run `npm run build` — fix any TypeScript errors from removed constants / changed function signatures
- Run `npm run lint` — fix any lint issues
- Verify all pages render correctly with installation context
- Test PDF export with dynamic headers

**No new files — fix-up pass across all modified files.**

---

## Execution Order

```
Phase 1  →  Phase 2  →  Phase 3  →  Phase 4  →  Phase 5  →  Phase 6  →  Phase 7
  DB          Data        Engine      Cleanup      UI          Admin       Verify
 schema      layer       refactor    hardcodes    templates   onboard      build
```

Phases 1-3 are foundational. Phase 4 is the bulk cleanup. Phases 5-6 are new UI. Phase 7 validates everything compiles.

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260224_inspection_templates.sql` | New tables + Selfridge seed |
| `lib/calculations/surface-criteria.ts` | Runway class → surface dimensions lookup |
| `lib/supabase/inspection-templates.ts` | CRUD functions for templates |
| `app/(app)/settings/templates/page.tsx` | Template management UI |
| `app/(app)/settings/base-setup/page.tsx` | Base configuration wizard |

## Summary of All Modified Files

| File | Change |
|------|--------|
| `lib/constants.ts` | Remove INSTALLATION, AIRFIELD_AREAS, inspection template constants |
| `lib/calculations/obstructions.ts` | Parameterize by runway class |
| `lib/installation-context.tsx` | Remove Selfridge UUID fallback |
| `lib/weather.ts` | Accept coordinates as params |
| `lib/supabase/types.ts` | Add new table types |
| `lib/pdf-export.ts` | Dynamic headers/footers |
| `lib/reports/*.ts` (4 files) | Dynamic headers/filenames |
| `app/layout.tsx` | Generic metadata |
| `public/manifest.json` | Generic description |
| `app/(app)/page.tsx` | Remove DEFAULT_NAVAIDS fallback |
| `app/(app)/obstructions/page.tsx` | Read runway class from DB |
| `app/(app)/obstructions/[id]/page.tsx` | Read runway class from record |
| `app/(app)/inspections/page.tsx` | Fetch templates from DB |
| `app/(app)/settings/page.tsx` | Add template + base config links |
| `app/api/weather/route.ts` | Accept station param |
| `app/api/notams/sync/route.ts` | Accept ICAO param |
