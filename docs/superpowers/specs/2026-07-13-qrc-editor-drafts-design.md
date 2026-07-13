# QRC Editor Draft Persistence — Design

**Date:** 2026-07-13
**Status:** Approved by owner (chat), implementation same session
**Surface:** `components/admin/qrc-editor-dialog.tsx` (Base Setup step 10 — the only QRC authoring surface)

## Problem

The QRC editor dialog holds the entire checklist build in React state.
Cancel, overlay click, navigation, or a crash discards everything, and the
real save requires a complete valid QRC (title, ≥1 step, every step
labeled), so a half-built checklist cannot be persisted at all. Building a
25-step QRC is exactly the kind of long-form work that gets lost.

## Owner decisions

1. **Drafts are device-local** (localStorage), not cross-device. Zero
   server load; auto-save on every change is therefore free.
2. **Resume banner** on reopen (the Checks pattern), not silent restore.

## Design

### 1. Storage — `lib/qrc-draft.ts` (new)

Clone of the `lib/check-draft.ts` pattern. One draft per editing context:

- Key: `qrc_editor_draft_{baseId}_new` (create) ·
  `qrc_editor_draft_{baseId}_{templateId}` (edit).
  Creating one QRC and pausing an edit of another coexist.
- Shape:

```ts
export interface QrcEditorDraft {
  mode: 'create' | 'edit'
  templateId: string | null      // null in create mode
  qrcNumber: number
  title: string
  notes: string
  references: string
  hasScnForm: boolean
  scnFields: { key: string; label: string; type: 'text' | 'textarea' }[]
  steps: QrcStep[]               // full tree incl. sub_steps
  savedAt: string                // ISO, stamped by saveQrcDraft
}
```

- Helpers (all SSR-safe, corrupt JSON → null):
  - `qrcDraftKey(baseId, templateId)` — key derivation.
  - `loadQrcDraft(baseId, templateId): QrcEditorDraft | null`
  - `saveQrcDraft(draft, baseId)` — stamps `savedAt`, writes.
  - `clearQrcDraft(baseId, templateId)`
  - `qrcDraftSignature(draft)` — deterministic JSON of everything except
    `savedAt`; the dirty test is `signature(current) !== signature(initial)`.
    Pure, so the dirty rule is unit-testable without mounting the dialog.

### 2. Auto-save

The dialog computes its initial signature once on mount (blank form in
create mode; the loaded template's fields in edit mode). An effect watches
all form state and, whenever the current signature differs from the
initial one, writes the draft. Every keystroke/add/reorder persists —
localStorage writes are sub-millisecond, no debounce (same as Checks).
Open-and-close without touching anything leaves no draft.

No `beforeunload` handler: unlike Checks (which snapshots via refs), every
state change here saves synchronously in the effect, so the last change is
already on disk when the tab dies.

Reverting the form to exactly its initial state stops further saves but
does not delete an already-written draft (accepted edge; the banner's
timestamp exposes it).

### 3. Resume banner

On mount, `loadQrcDraft` for the context key. If found, banner at the top
of the dialog body:

```
⚠ Unsaved draft from 1410Z (14 steps)   [Resume draft] [Discard]
```

- **Resume** hydrates all form state from the draft; banner closes.
- **Discard** clears the key; banner closes.
- **Ignoring it and editing anyway** overwrites the old draft on the next
  auto-save and closes the banner — the banner is the one warning.
- Edit mode: the QRC number input stays disabled; hydrating it from the
  draft is a no-op by construction (same template).
- Create mode collision: a draft may hold a number that has since been
  taken; the existing live `numberInUse` warning already covers it.

### 4. Lifecycle

- Successful create/update → `clearQrcDraft` for the context, then `onSaved`.
- Cancel / overlay / crash → draft survives (the feature).
- Footer shows `Draft saved {HHMM}Z` (via `formatZuluTime`) once a draft
  has been written this session.
- No expiry; the banner timestamp signals staleness.

### 5. Non-goals

- No DB writes, schema, RLS, or offline-queue changes — the final save
  path (`createQrcTemplate` / `updateQrcTemplate`) is untouched, so the
  offline-queue rule does not apply.
- No cross-admin conflict detection (teammate edits QRC-7 while a draft of
  it exists → resuming and saving wins). Rare at one base; not worth the
  machinery.
- No draft list UI; one draft per context key only.

## Per-file changes

| File | Change |
|---|---|
| `lib/qrc-draft.ts` | New — types + key/load/save/clear/signature helpers |
| `components/admin/qrc-editor-dialog.tsx` | Initial-signature ref, auto-save effect, resume banner, discard/resume handlers, clear-on-save, footer indicator |
| `tests/qrc-draft.test.ts` | New — TDD'd red-first |

## Test plan

`tests/qrc-draft.test.ts`: key derivation (create vs edit), save/load
round-trip incl. sub_steps, savedAt stamping, clear, corrupt-JSON → null,
no-window (SSR) safety, signature ignores `savedAt` but catches every
field change (steps, scnFields, flags).
