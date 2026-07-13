# Configurable Shifts — Design

**Date:** 2026-07-13
**Status:** Approved (owner), built same session
**Scope:** Shift Checklist + Daily Reviews

## Problem

Bases are forced into a 2-or-3-shift structure with fixed names. The Shift
Checklist hardcodes "Day Shift / Swing Shift / Mid Shift" headings and the
`bases.shift_count` setting only allows 2 or 3. Single-shift operations
can't model their day, and no base can name shifts the way they actually
talk about them.

## Decisions (owner-confirmed)

1. **Scope: both modules.** The shift config drives Shift Checklist
   groupings AND Daily Reviews sign-off slots (1 shift = one AMSL/Lead
   signature required).
2. **1–3 shifts, renameable.** Internal keys stay `day` / `swing` / `mid`;
   only the count gate and display labels change. No arbitrary-N shifts;
   the Daily Reviews signature columns stay fixed.
3. **Reducing shift count auto-moves items** in removed shifts to the
   first shift, with a confirm dialog stating how many will move.
   Nothing strands or disappears.
4. **Approach A** (flat config on `bases`) over adopting the dormant
   `daily_review_slots` table — additive-only schema, no backfill, no new
   RLS surface.

## Data model (one migration, all additive)

- `bases.shift_count` CHECK widened from `IN (2,3)` to `IN (1,2,3)`;
  default stays 2.
- New nullable TEXT columns: `bases.shift_name_day`, `shift_name_swing`,
  `shift_name_mid`. NULL/empty = default label.
- `sign_daily_review_slot` replaced (same signature, grants persist):
  reads `shift_count` from the `bases` row instead of trusting the
  client's `p_shift_count` (param kept for compatibility, ignored), and
  requires swing only when count ≥ 2, mid only when count = 3. This also
  closes an existing hole where a client could pass a false count to
  certify a review early.

## Source of truth: `lib/shifts.ts` (new)

- `getActiveShifts(base)` → ordered `[{ key, label }]` for the active
  shifts. Count clamped 1–3 (null/undefined → 2). Label = trimmed custom
  name, else default.
- `bucketItemsByShift(items, base)` → per-shift sections for rendering;
  items whose shift key is not active fold into the FIRST section
  (safety net — items must never silently vanish from a compliance
  checklist).

## UI

**Wizard / base-config Shift Checklist tab** (one component serves both):
- "Shifts per Day" gains a 1 option; help text is mode-neutral
  ("checklist sections and shift sign-off slots on Daily Reviews").
- Reducing count with items in removed shifts: confirm →
  reassign those items to the first shift → save count. Every write
  toasts on error.
- Per-active-shift controlled name inputs, placeholder = default label,
  save on blur with toast, maxLength 20 (keeps PDF columns sane).
  Clearing reverts to default.
- Per-item shift picker + section headings derive from `getActiveShifts`.

**Shift Checklist page:**
- Sections render from `bucketItemsByShift` (Today + History views).
- "File Checklist (End of Swing Shift)" and the confirm-dialog copy
  become "End of {last active shift's label}".
- Dead `SHIFT_LABELS` map removed.

**Daily Reviews / Activity / PDF:**
- `requiredSlotsForShifts(1)` → `[day_amsl, namo, afm]`;
  `currentAmslSlot(tz, 1)` → always `day_amsl`; `isFullyCertified`
  follows.
- `getSlotLabel(slot, base)`: custom shift name composes with a new
  mode-aware term `shift_signoff_suffix` in `lib/airport-mode.ts`
  (usaf "AMSL" / faa "Lead") → "Alpha AMSL" / "Alpha Lead". No custom
  name = exactly today's labels.

## Tests (named regression guards)

- `getActiveShifts`: counts 1/2/3, custom names, empty-string fallback,
  clamping.
- `bucketItemsByShift`: stray-key fold-into-first, ordering.
- `requiredSlotsForShifts(1)` new + (2)/(3) unchanged.
- `isFullyCertified` count 1 without swing/mid signatures.
- `currentAmslSlot` count 1 at representative hours.
- `getSlotLabel` suffix per mode + no-custom-name regression.

## Out of scope

`daily_review_slots` stays dormant; the five `daily_reviews` signature
column groups unchanged; no 4+ shifts; tour/help/manual copy gets only a
light touch to mention configurability.
