# Part 139 Certification-Inspection Readiness Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose the civilian (`airport_type = 'faa_part139'`) `/acsi` module into an annual Part 139 certification-inspection readiness audit that faithfully reproduces FAA Form 5280-4, so airports can self-audit before the FAA's inspector visits.

**Architecture:** A new mode-selected checklist array (`PART139_CERT_SECTIONS`) mirrors the shape of the existing `ACSI_CHECKLIST_SECTIONS`, so the existing form/draft/detail/PDF machinery is reused by feeding it the civilian array when the base is `faa_part139`. Stored records resolve their section metadata by `section_id` (namespaced `p139-*` vs `acsi-*`) so historical USAF records are untouched. The USAF ACSI path stays byte-for-byte unchanged; every branch is on `getAirportType(currentInstallation)`.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18.3.1, TypeScript strict, Supabase, jsPDF, vitest. Path alias `@/*` → repo root.

**Design source (authoritative, committed):** `docs/superpowers/specs/2026-07-06-part139-cert-inspection-audit-design.md` — its section/item/citation table is the data source of truth. Content PDFs live at `C:/Users/cspro/Downloads/order-5280-5D-airport-certification.pdf` (Form 5280-4 = Appendix G pp. 144-147; Chapter 4 guidance pp. 4-13…4-52; Appendix H enhanced ARFF pp. H-1…H-21) and `14 CFR Part 139…pdf`. Extracted text: `…/scratchpad/order5280.txt`, `part139.txt`.

## Global Constraints

- **Commit gate — all four must pass before any task is "done":** `npx tsc --noEmit` · `npm run lint` (0 errors) · `npm run test` (vitest) · `npm run build`. vitest is the one that bit CI last session — never skip it.
- **Do NOT touch** `tests/modules-config.test.ts` acsi classification. `acsi.appliesTo` stays `['usaf','faa_part139']`. Changing the gating broke CI on 4 commits last session.
- **USAF ACSI path unchanged.** `ACSI_CHECKLIST_SECTIONS`, its items, the military PDF layout, team roles, and risk-cert must render identically after every task. Everything civilian branches on `getAirportType(currentInstallation) === 'faa_part139'`.
- **No fabricated regulatory text.** Every item label, citation, and guidance string is transcribed verbatim from the source PDFs above, page-referenced in a `// src:` comment. If a source is unclear, stop and flag — do not invent.
- **Conventions:** files kebab-case; React components PascalCase; DB snake_case; import via `@/lib/…`. `AcsiItemResponse = 'pass'|'fail'|'na'|null` is reused (S→pass, U→fail, N/A→na); no new response type, no Day/Night.
- **Commit after each task** with an imperative message + the co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw`.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/constants.ts` (modify) | Extend `AcsiChecklistItem` interface with `citation?` + `guidance?`; add `PART139_TEAM_ROLES`. |
| `lib/part139-cert-checklist.ts` (**create**) | `PART139_CERT_SECTIONS` (22 sections / ~123 items + citations + guidance), `sectionsForAirportType()`, `sectionMetaById()`. The big content file — kept out of `constants.ts` to avoid bloat. |
| `lib/acsi-draft.ts` (modify) | `createNewAcsiDraft(mode?)` seeds civilian team + no signatures; `acsiDraftToItems(draft, sections?)` walks the passed array. |
| `app/(app)/acsi/new/page.tsx` (modify) | Mode-select sections/team; S/U/N-A labels; citation + guidance expander per item; civilian cover fields; corrective-action gate; calendar-year default; hide risk-cert. |
| `app/(app)/acsi/[id]/page.tsx` (modify) | Iterate resolved sections via `sectionMetaById`; render citation + guidance; hide `risk_cert_signatures` for civilian; civilian cover fields. |
| `components/acsi/acsi-item.tsx` (modify) | Optional `citation`/`guidance` props + expander; mode-aware S/U/N-A response labels. |
| `components/acsi/acsi-discrepancy-panel.tsx` (modify) | "Risk Control Measure" label → "Corrective Action" on civilian. |
| `components/acsi/acsi-team-editor.tsx` (modify) | Accept a `roles` prop instead of importing `ACSI_TEAM_ROLES`. |
| `lib/acsi-pdf.ts` (modify) | Civilian Form 5280-4 layout (S/U/N-A + Remarks, resolved sections, civilian header); military layout unchanged. |
| `lib/modules-config.ts` (modify) | Mode-aware `acsi` module description/useCase. `appliesTo` unchanged. |
| `tests/part139-cert-checklist.test.ts` (**create**) | Shape/selector/guidance guards + `acsiDraftToItems` civilian behavior. |

---

## PHASE 1 — Data model + checklist skeleton + selectors

Outcome: a fully-typed civilian checklist array (labels + citations; guidance filled in Phase 3-4) with mode selectors, unit-tested. Nothing wired to the UI yet — the USAF app is unaffected.

### Task 1.1: Extend the `AcsiChecklistItem` interface

**Files:**
- Modify: `lib/constants.ts` (the `AcsiChecklistItem` interface, ~line 687)

- [ ] **Step 1: Add optional fields to the interface**

In `lib/constants.ts`, extend the interface (keep existing fields):

```ts
export interface AcsiChecklistItem {
  id: string
  question: string
  subsection?: string
  hasSubFields?: boolean
  isHeading?: boolean
  /** CFR sub-paragraph this item audits, e.g. '§139.305(a)(1)'. Civilian (Part 139) only. */
  citation?: string
  /** Inspector guidance (FAA Order 5280.5D Ch.4 / App.H), shown in an expander. Civilian only. */
  guidance?: string
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (optional fields don't affect existing `ACSI_CHECKLIST_SECTIONS`).

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "Add optional citation/guidance to AcsiChecklistItem for Part 139 audit"
```

### Task 1.2: Create the civilian checklist file with the skeleton + selectors

**Files:**
- Create: `lib/part139-cert-checklist.ts`
- Test: `tests/part139-cert-checklist.test.ts`

**Interfaces:**
- Consumes: `AcsiChecklistSection`, `AcsiChecklistItem` from `@/lib/constants`; `ACSI_CHECKLIST_SECTIONS` from `@/lib/constants`; `AirportType` from `@/lib/airport-mode`.
- Produces: `PART139_CERT_SECTIONS: AcsiChecklistSection[]`; `sectionsForAirportType(t: AirportType): AcsiChecklistSection[]`; `sectionMetaById(sectionId: string): AcsiChecklistSection | undefined`.

- [ ] **Step 1: Write the failing test**

Create `tests/part139-cert-checklist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  PART139_CERT_SECTIONS,
  sectionsForAirportType,
  sectionMetaById,
} from '@/lib/part139-cert-checklist'
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'

describe('PART139_CERT_SECTIONS shape', () => {
  it('has the 22 Form 5280-4 sections with p139- ids', () => {
    expect(PART139_CERT_SECTIONS).toHaveLength(22)
    for (const s of PART139_CERT_SECTIONS) {
      expect(s.id).toMatch(/^p139-/)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.reference.length).toBeGreaterThan(0)
      expect(s.items.length).toBeGreaterThan(0)
    }
  })

  it('every answerable item has a non-empty label and a CFR citation', () => {
    for (const s of PART139_CERT_SECTIONS) {
      for (const it of s.items) {
        if (it.isHeading) continue
        expect(it.question.length, `${it.id} label`).toBeGreaterThan(0)
        expect(it.citation, `${it.id} citation`).toMatch(/§139\./)
      }
    }
  })

  it('has ~123 answerable items total', () => {
    const n = PART139_CERT_SECTIONS
      .flatMap(s => s.items).filter(i => !i.isHeading).length
    expect(n).toBeGreaterThanOrEqual(118)
    expect(n).toBeLessThanOrEqual(128)
  })

  it('uses no section_id that collides with the USAF array', () => {
    const usaf = new Set(ACSI_CHECKLIST_SECTIONS.map(s => s.id))
    for (const s of PART139_CERT_SECTIONS) expect(usaf.has(s.id)).toBe(false)
  })
})

describe('sectionsForAirportType', () => {
  it('returns the Part 139 array for faa_part139, USAF array otherwise', () => {
    expect(sectionsForAirportType('faa_part139')).toBe(PART139_CERT_SECTIONS)
    expect(sectionsForAirportType('usaf')).toBe(ACSI_CHECKLIST_SECTIONS)
  })
})

describe('sectionMetaById', () => {
  it('resolves ids from both namespaces and returns undefined for junk', () => {
    expect(sectionMetaById('p139-paved')?.title).toBe('Paved Areas')
    expect(sectionMetaById('acsi-1')?.number).toBe(1)
    expect(sectionMetaById('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- part139-cert-checklist`
Expected: FAIL (module `@/lib/part139-cert-checklist` not found).

- [ ] **Step 3: Create the file with the full skeleton**

Create `lib/part139-cert-checklist.ts`. Transcribe **all 22 sections and their items from the committed spec's content table** (`docs/superpowers/specs/2026-07-06-part139-cert-inspection-audit-design.md`). Map each Form 5280-4 citation (e.g., `305a1`) to readable CFR form (`§139.305(a)(1)`). Leave `guidance` unset for now (Phase 3-4). Header + first two sections shown as the exact pattern; continue for all 22:

```ts
// Part 139 certification-inspection readiness audit checklist.
// Faithful reproduction of FAA Form 5280-4 (FAA Order 5280.5D, Appendix G, pp.144-147).
// Section references = 14 CFR Part 139 Subpart D; per-item `citation` = the exact
// Form 5280-4 sub-paragraph. `guidance` (added in Phase 3-4) = Order 5280.5D Ch.4 / App.H.
// Do not edit item text without re-checking the source — no fabricated reg text.
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import type { AcsiChecklistSection } from '@/lib/constants'
import { getAirportType } from '@/lib/airport-mode'      // for AirportType type only
type AirportType = ReturnType<typeof getAirportType>

export const PART139_CERT_SECTIONS: AcsiChecklistSection[] = [
  {
    id: 'p139-mpc',
    number: 1,
    title: 'Methods & Procedures for Compliance',
    reference: '14 CFR §139.7',
    items: [
      { id: 'mpc.1', question: 'Compliance with Advisory Circulars', citation: '§139.7' },
    ],
  },
  {
    id: 'p139-records',
    number: 4,
    title: 'Records',
    reference: '14 CFR §139.301',
    items: [
      { id: 'rec.1', question: 'Records furnished upon request', citation: '§139.301(a)' },
      { id: 'rec.2', question: 'Records maintained for specified duration', citation: '§139.301(b)' },
    ],
  },
  // …continue for all 22 sections from the spec table:
  // p139-exempt(139.111), p139-acm(201a/203), p139-personnel(303a-f),
  // p139-paved(305a1-6), p139-safety(309a/b1-4), p139-msl(311a1-e),
  // p139-snow(313a/b1-5), p139-arff(319a-k), p139-hazmat(321a-g),
  // p139-wind(323a/b), p139-aep(325a-i), p139-selfinsp(327a1-c2),
  // p139-vehicles(329a-f1), p139-obstruct(331), p139-navaids(333a-c),
  // p139-public(335a1-2), p139-wildlife(337a-f7), p139-construction(341a1-2),
  // p139-condrpt(339a-d), p139-noncomply(343). `number` = 1..22 in spec order.
]

export function sectionsForAirportType(t: AirportType): AcsiChecklistSection[] {
  return t === 'faa_part139' ? PART139_CERT_SECTIONS : ACSI_CHECKLIST_SECTIONS
}

export function sectionMetaById(sectionId: string): AcsiChecklistSection | undefined {
  return [...ACSI_CHECKLIST_SECTIONS, ...PART139_CERT_SECTIONS].find(s => s.id === sectionId)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- part139-cert-checklist`
Expected: PASS (all shape/selector/resolution assertions green).

- [ ] **Step 5: Full gate + commit**

Run: `npx tsc --noEmit && npm run lint && npm run test -- part139-cert-checklist && npm run build`
Expected: all PASS.

```bash
git add lib/part139-cert-checklist.ts tests/part139-cert-checklist.test.ts
git commit -m "Add Part 139 cert-audit checklist skeleton (Form 5280-4) + mode selectors"
```

### Task 1.3: Add `PART139_TEAM_ROLES`

**Files:**
- Modify: `lib/constants.ts` (near `ACSI_TEAM_ROLES`, ~line 945)

- [ ] **Step 1: Add the civilian roles constant**

```ts
export const PART139_TEAM_ROLES = [
  { value: 'ops',         label: 'Airport Operations',   required: true  },
  { value: 'maintenance', label: 'Airfield Maintenance', required: false },
  { value: 'arff',        label: 'ARFF',                 required: false },
  { value: 'safety',      label: 'Safety / SMS',         required: false },
  { value: 'wildlife',    label: 'Wildlife',             required: false },
  { value: 'other',       label: 'Other',                required: false },
] as const
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add lib/constants.ts
git commit -m "Add PART139_TEAM_ROLES for civilian cert-audit team"
```

---

## PHASE 2 — Wire the form, draft, and detail view to mode-select the audit

Outcome: on a civilian base, `/acsi/new` renders the Form 5280-4 audit with S/U/N-A responses, civilian team, no risk-cert; the record files and the `/acsi/[id]` view renders it back. USAF unchanged.

### Task 2.1: Make `acsiDraftToItems` and `createNewAcsiDraft` mode-aware

**Files:**
- Modify: `lib/acsi-draft.ts`
- Test: `tests/part139-cert-checklist.test.ts` (extend)

**Interfaces:**
- Produces: `acsiDraftToItems(draft, sections?: AcsiChecklistSection[])` (defaults to `ACSI_CHECKLIST_SECTIONS`); `createNewAcsiDraft(mode?: AirportType)`.

- [ ] **Step 1: Write the failing test** (append to the test file)

```ts
import { acsiDraftToItems, createNewAcsiDraft } from '@/lib/acsi-draft'
import { PART139_CERT_SECTIONS } from '@/lib/part139-cert-checklist'

describe('acsiDraftToItems with the civilian array', () => {
  it('emits civilian items and counts S/U/N-A via pass/fail/na', () => {
    const draft = createNewAcsiDraft('faa_part139')
    draft.responses = { 'rec.1': 'pass', 'rec.2': 'fail' }
    draft.discrepancies = { 'rec.2': [{ comment: 'x', work_order: '', project_number: '',
      estimated_cost: '', estimated_completion: '', risk_control_measure: '',
      photo_ids: [], areas: [], latitude: null, longitude: null, pins: [] }] }
    const { items, passed, failed } = acsiDraftToItems(draft, PART139_CERT_SECTIONS)
    expect(items.find(i => i.item_number === 'rec.1')?.response).toBe('pass')
    expect(items.find(i => i.item_number === 'rec.2')?.discrepancies?.length).toBe(1)
    expect(passed).toBe(1); expect(failed).toBe(1)
  })
})

describe('createNewAcsiDraft', () => {
  it('seeds civilian team + no signatures for faa_part139', () => {
    const d = createNewAcsiDraft('faa_part139')
    expect(d.team[0].role).toBe('ops')
    expect(d.signatures).toHaveLength(0)
  })
  it('seeds the military team by default', () => {
    expect(createNewAcsiDraft().team[0].role).toBe('afm')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- part139-cert-checklist`
Expected: FAIL (`acsiDraftToItems` ignores the 2nd arg; `createNewAcsiDraft` takes no arg).

- [ ] **Step 3: Implement**

In `lib/acsi-draft.ts`: import `AcsiChecklistSection` type and `PART139_TEAM_ROLES`; change the signature `export function acsiDraftToItems(draft: AcsiDraftData, sections: AcsiChecklistSection[] = ACSI_CHECKLIST_SECTIONS)` and replace the `for (const section of ACSI_CHECKLIST_SECTIONS)` loop with `for (const section of sections)`. Add the mode param to `createNewAcsiDraft`:

```ts
export function createNewAcsiDraft(mode?: 'usaf' | 'faa_part139'): AcsiDraftData {
  const isFaa = mode === 'faa_part139'
  return {
    responses: {}, comments: {}, discrepancies: {},
    team: isFaa
      ? [{ id: crypto.randomUUID(), role: 'ops', name: '', rank: '', title: 'Airport Operations', signature_required: true }]
      : [
          { id: crypto.randomUUID(), role: 'afm', name: '', rank: '', title: 'Airfield Manager', signature_required: true },
          { id: crypto.randomUUID(), role: 'ce', name: '', rank: '', title: 'CE Representative', signature_required: true },
          { id: crypto.randomUUID(), role: 'safety', name: '', rank: '', title: 'Safety', signature_required: true },
        ],
    signatures: isFaa ? [] : [
      { label: 'OG/CC', organization: '', name: '', rank: '', title: '' },
      { label: 'MSG/CC', organization: '', name: '', rank: '', title: '' },
      { label: 'WG/CC', organization: '', name: '', rank: '', title: '' },
    ],
    notes: '', collapsedSections: {}, localItems: [],
  }
}
```

Note: the civilian array has no `hasSubFields`/`isHeading`/`acsi-10` items, so the existing sub-field and local-item branches in `acsiDraftToItems` are simply never hit for civilian.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- part139-cert-checklist`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: all PASS (military tests unchanged — default arg preserves behavior).

```bash
git add lib/acsi-draft.ts tests/part139-cert-checklist.test.ts
git commit -m "Make acsiDraftToItems/createNewAcsiDraft mode-aware for Part 139 audit"
```

### Task 2.2: Mode-aware response labels (S/U/N-A) + citation/guidance props on AcsiItem

**Files:**
- Modify: `components/acsi/acsi-item.tsx`

- [ ] **Step 1: Add props and mode-aware labels**

Add optional props `citation?: string`, `guidance?: string`, and `responseLabels?: { pass: string; fail: string; na: string }` (default `{ pass: 'Y', fail: 'N', na: 'N/A' }`). Where the Y/N/N-A button labels are rendered, use `responseLabels`. Under the item label, when `citation` is set render it as a subtle suffix (e.g., muted `· §139.305(a)(1)`). When `guidance` is set, render a small "Guidance" disclosure button that toggles a `<div>` showing `guidance` (collapsed by default). Match the file's existing inline-style patterns and `var(--color-*)` tokens.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS (props optional → military callers unaffected).

```bash
git add components/acsi/acsi-item.tsx
git commit -m "AcsiItem: optional citation/guidance/responseLabels for Part 139 audit"
```

### Task 2.3: AcsiTeamEditor takes a `roles` prop

**Files:**
- Modify: `components/acsi/acsi-team-editor.tsx`

- [ ] **Step 1:** Replace the internal `import { ACSI_TEAM_ROLES }` usage with a `roles` prop (`{ value: string; label: string; required?: boolean }[]`), defaulting to `ACSI_TEAM_ROLES` so existing callers are unaffected.
- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`

```bash
git add components/acsi/acsi-team-editor.tsx
git commit -m "AcsiTeamEditor: accept roles prop for mode-aware team"
```

### Task 2.4: Discrepancy panel — mode-aware "Corrective Action" label

**Files:**
- Modify: `components/acsi/acsi-discrepancy-panel.tsx` (~line 222)

- [ ] **Step 1:** Add an optional prop `correctiveActionLabel?: string` (default `'Risk Control Measure'`). Use it for the required-field label at line ~225. Thread the prop down from the panel group if needed (`acsi-discrepancy-panel-group.tsx`). Civilian callers pass `'Corrective Action'`.
- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`

```bash
git add components/acsi/acsi-discrepancy-panel.tsx components/acsi/acsi-discrepancy-panel-group.tsx
git commit -m "Discrepancy panel: mode-aware Corrective Action label"
```

### Task 2.5: Wire `/acsi/new` to the civilian audit

**Files:**
- Modify: `app/(app)/acsi/new/page.tsx`

- [ ] **Step 1: Mode-select sections, team, labels**

Near the top of the component add:

```ts
import { sectionsForAirportType } from '@/lib/part139-cert-checklist'
import { PART139_TEAM_ROLES, ACSI_TEAM_ROLES } from '@/lib/constants'
// …
const airportType = getAirportType(currentInstallation)
const isFaa = airportType === 'faa_part139'
const sections = sectionsForAirportType(airportType)
const teamRoles = isFaa ? PART139_TEAM_ROLES : ACSI_TEAM_ROLES
const responseLabels = isFaa ? { pass: 'S', fail: 'U', na: 'N/A' } : { pass: 'Y', fail: 'N', na: 'N/A' }
```

Replace `ACSI_CHECKLIST_SECTIONS.map(...)` (render loop, ~line 573) with `sections.map(...)`. Pass `citation={item.citation}`, `guidance={item.guidance}`, `responseLabels={responseLabels}` to `<AcsiItem>`. Pass `roles={teamRoles}` to `<AcsiTeamEditor>`. Pass `correctiveActionLabel={isFaa ? 'Corrective Action' : 'Risk Control Measure'}` to the discrepancy panels. Change `acsiDraftToItems(draft)` calls (4 of them) to `acsiDraftToItems(draft, sections)`. Change `createNewAcsiDraft()` (~line 170) to `createNewAcsiDraft(airportType)`.

- [ ] **Step 2: Hide risk-cert + calendar-year default for civilian**

Wrap `<AcsiRiskCert>` (~line 751) in `{!isFaa && (...)}`. Change the fiscal-year default (lines ~52-55 and ~174-175) so civilian uses the calendar year: `isFaa ? now.getFullYear() : (now.getMonth() >= 9 ? now.getFullYear()+1 : now.getFullYear())`. Relabel the "Inspection Year" helper if needed (already mode-neutral).

- [ ] **Step 3: Civilian cover fields (Form 5280-4 header)**

Add civilian-only inputs (behind `{isFaa && …}`) for **ARFF Index** (text), **Airport Classification** (Class I/II/III/IV select), **Inspector**, **Inspection Dates** — stored on the draft. Extend `AcsiDraftData` in `lib/supabase/types.ts` with optional `arff_index?: string`, `airport_class?: string`, `inspector?: string` and persist them through `saveAcsiDraft`. (Keep additive/optional so USAF is unaffected.)

- [ ] **Step 4: Manual smoke + gate**

Run the app on a civilian base (KDMO/KDRA), open `/acsi/new`, confirm the 22 sections render with S/U/N-A, a citation suffix, no risk-cert, civilian team. Then:

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/acsi/new/page.tsx" lib/supabase/types.ts
git commit -m "Wire /acsi/new to the Part 139 cert-audit on civilian bases"
```

### Task 2.6: Wire `/acsi/[id]` detail view to resolved sections

**Files:**
- Modify: `app/(app)/acsi/[id]/page.tsx`

- [ ] **Step 1:** Replace the render loop over `ACSI_CHECKLIST_SECTIONS` (~line 312) with an iteration over the sections present in the record: derive them from the grouped `itemsBySection` keys via `sectionMetaById(key)` (skip unknown), preserving spec order. Render each item's `citation`/`guidance` (look up via the resolved section's items by `item_number`). Wrap the `risk_cert_signatures` block (~line 477) in `{!isFaa && …}` where `isFaa = getAirportType(currentInstallation) === 'faa_part139'`. Render civilian cover fields (ARFF Index, Class, Inspector) when present.
- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`. Smoke: file a civilian audit, open its `/acsi/[id]`, confirm sections/citations render and no risk-cert shows.

```bash
git add "app/(app)/acsi/[id]/page.tsx"
git commit -m "Render Part 139 cert-audit records via resolved sections in detail view"
```

---

## PHASE 3 — Transcribe Chapter 4 per-item inspector guidance

Outcome: every civilian item carries `guidance` from FAA Order 5280.5D Chapter 4. Grouped into tasks by area cluster; each is pure content transcription + a presence/spot-check test. Read the cited pages in `…/scratchpad/order5280.txt` (or render the PDF pages) and transcribe concisely — paraphrase-tight where the source is verbose, verbatim for thresholds/tests. Prefix each with `// src: 5280.5D §4.x pp.4-yy`.

### Task 3.1: Guidance — physical airfield (paved, safety, marking/signs/lighting, wind)

**Files:** Modify `lib/part139-cert-checklist.ts`
**Source:** Ch.4 §4.11 (Paved, pp.4-16), §4.13 (Safety, pp.4-18), §4.14 (Marking/Signs/Lighting, pp.4-21), §4.20 (Wind, pp.4-38).

- [ ] **Step 1: Write the failing guidance test** (append to test file)

```ts
describe('Part 139 guidance (Phase 3-4)', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items).filter(i => !i.isHeading)
  it('paved-area hole item carries the 5-inch/45-degree test guidance', () => {
    const hole = items.find(i => i.citation === '§139.305(a)(2)')
    expect(hole?.guidance ?? '').toMatch(/5[- ]?inch|45/)
  })
})
```

- [ ] **Step 2: Run — FAIL** (`npm run test -- part139-cert-checklist`), guidance undefined.
- [ ] **Step 3:** Transcribe guidance for every item in `p139-paved`, `p139-safety`, `p139-msl`, `p139-wind` from the cited pages into each item's `guidance`.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -m "Add Ch.4 guidance: physical-airfield audit items"`.

### Task 3.2: Guidance — records/manual/personnel/exemptions/compliance

**Source:** Ch.4 §4.9 (Records, pp.4-13), §4.10 (Personnel, pp.4-15), Ch.3/§4 ACM, §139.7/§139.111 intro.
- [ ] Transcribe guidance for `p139-mpc`, `p139-exempt`, `p139-acm`, `p139-records`, `p139-personnel`. Gate + commit.

### Task 3.3: Guidance — programs (snow, hazmat, AEP, self-insp, vehicles, condition reporting)

**Source:** Ch.4 §4.15 (Snow, pp.4-26), §4.19 (Hazmat, pp.4-36), §4.21 (AEP, pp.4-38), §4.22 (Self-insp, pp.4-39), §4.23 (Vehicles, pp.4-40), §4.28 (Condition reporting, pp.4-51).
- [ ] Transcribe guidance for `p139-snow`, `p139-hazmat`, `p139-aep`, `p139-selfinsp`, `p139-vehicles`, `p139-condrpt`. Gate + commit.

### Task 3.4: Guidance — obstructions/NAVAIDs/public/wildlife/construction/noncompliance

**Source:** Ch.4 §4.24 (Obstructions, pp.4-43), §4.25 (NAVAIDs, pp.4-44), §4.26 (Public, pp.4-44), §4.27 (Wildlife, pp.4-45), §4.29 (Construction, pp.4-51), §4.30 (Noncompliance, pp.4-52).
- [ ] Transcribe guidance for `p139-obstruct`, `p139-navaids`, `p139-public`, `p139-wildlife`, `p139-construction`, `p139-noncomply`. Gate + commit.

---

## PHASE 4 — Enhanced ARFF guidance (Appendix H)

Outcome: the 16 ARFF items (`p139-arff`) carry rich Appendix H guidance.

### Task 4.1: ARFF guidance from Appendix H

**Files:** Modify `lib/part139-cert-checklist.ts`
**Source:** Order 5280.5D Appendix H, pp.H-1…H-21 (`order5280.txt` from ~line 7049) + Ch.4 §§4.16-4.18 (Index/Equipment/Ops).

- [ ] **Step 1: Write the failing test**

```ts
it('ARFF response-drill item carries the 3-minute standard', () => {
  const items = PART139_CERT_SECTIONS.flatMap(s => s.items)
  const drill = items.find(i => i.citation?.includes('319(h)'))
  expect(drill?.guidance ?? '').toMatch(/3[- ]?min|midpoint/i)
})
it('every civilian item now has non-empty guidance', () => {
  const missing = PART139_CERT_SECTIONS.flatMap(s => s.items)
    .filter(i => !i.isHeading && !(i.guidance && i.guidance.length > 0))
    .map(i => i.id)
  expect(missing).toEqual([])
})
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3:** Transcribe Appendix H detail into each `p139-arff` item's `guidance` (PPE ensemble, 3-/4-min response, agent-discharge demo, vehicle readiness, alerting, NFPA 1931/1001/1403 refs). Backfill any remaining item with no guidance from its Chapter 4 area.
- [ ] **Step 4: Run — PASS** (both ARFF spot-check and the all-items-have-guidance guard).
- [ ] **Step 5: Gate + commit** `git commit -m "Add enhanced ARFF guidance (App.H) + complete Part 139 audit guidance"`.

---

## PHASE 5 — Civilian PDF (Form 5280-4 layout) + cover fields

Outcome: filing/exporting a civilian audit produces a Form 5280-4-style PDF.

### Task 5.1: Civilian PDF layout

**Files:** Modify `lib/acsi-pdf.ts`

- [ ] **Step 1:** In the PDF builder, branch on `options.airportType === 'faa_part139'`. Walk the resolved sections (`sectionMetaById` per stored `section_id`, or `PART139_CERT_SECTIONS` directly). For civilian, render the header block (Airport Name, City/State, Site No., Certificate Holder, ARFF Index, Airport Class, Inspector, Inspection Dates) and a sectioned table with columns **Facility/Condition · S · U · N/A · Remarks** (map response → S/U/N-A; put discrepancy `comment`/corrective action in Remarks). Omit the risk-cert statement for civilian. Do **not** print `guidance` (keep the PDF clean). Leave the military layout path exactly as-is.
- [ ] **Step 2: Verify + smoke**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`. Smoke: export a civilian audit PDF, confirm S/U/N-A columns + civilian header, and confirm a USAF ACSI PDF is unchanged.

- [ ] **Step 3: Commit** `git commit -m "Add Form 5280-4 PDF layout for civilian Part 139 audits"`.

---

## PHASE 6 — Module copy + final verification

### Task 6.1: Mode-aware module description

**Files:** Modify `lib/modules-config.ts` (`acsi` entry, ~line 92)

- [ ] **Step 1:** Update the `acsi` `description`/`useCase` so the civilian meaning reads as the Part 139 certification-inspection readiness audit (either neutral wording covering both modes, or mode-aware copy if the module registry supports it). **Do not change `appliesTo`.**
- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`.

```bash
git add lib/modules-config.ts
git commit -m "Reframe acsi module copy for Part 139 cert-readiness audit"
```

### Task 6.2: Full regression verify

- [ ] **Step 1:** Run the complete gate in CI order:

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: tsc clean · lint 0 errors · vitest all pass (incl. `modules-config.test.ts` still green) · build succeeds.

- [ ] **Step 2:** Manual matrix: on a **USAF** base, `/acsi/new` + an existing filed ACSI `/acsi/[id]` + its PDF render identically to before (regression). On a **civilian** base, the full audit → file → detail → PDF round-trips with S/U/N-A, citations, guidance expanders, civilian team, no risk-cert.
- [ ] **Step 3:** Update `SESSION_HANDOFF.md` with what shipped and any follow-ups. Commit.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** content (Ph.1/3/4), S/U/N-A model (Ph.2.2/2.5), mode selection + historical-record safety (Ph.1.2/2.6), team + risk-cert (Ph.2.3/2.5), corrective-action label + gate (Ph.2.4/2.5), calendar year (Ph.2.5), cover fields (Ph.2.5), citations (Ph.1.2), guidance + enhanced ARFF (Ph.3/4), PDF (Ph.5), module copy (Ph.6), testing/gate (every task). All spec sections map to a task.
- **Placeholder scan:** transcription tasks reference exact source pages + the committed spec table (the authoritative enumerations) rather than restating 123 rows; all logic steps show code. No "TBD"/"add error handling".
- **Type consistency:** `sectionsForAirportType`/`sectionMetaById`/`PART139_CERT_SECTIONS` names consistent across tasks; `acsiDraftToItems(draft, sections?)` signature consistent between 2.1 and its callers in 2.5; `AcsiItemResponse` reused throughout.

## Known risk / watch items

- **`acsiDraftToItems` default arg** must stay `ACSI_CHECKLIST_SECTIONS` so the 3+ existing military callers are byte-for-byte unchanged — verify military vitest stays green after Task 2.1.
- **Guidance volume** (~123 strings from ~60 source pages) is the bulk of the effort; Phases 3-4 are transcription-bound. Keep each `// src:` page ref so a reviewer can spot-check against the PDF.
- **`[id]` ordering:** rendering only sections present in the record (2.6) changes order logic vs. the old "iterate all sections" — verify a partially-answered record still groups correctly.
