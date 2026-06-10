# Daily Reviews — Older-Review Access + Timeframe Certification Report

- **Date:** 2026-06-10
- **Status:** Approved (design)
- **Module:** Daily Reviews (`/daily-reviews`)
- **Regulatory anchor:** DAFMAN 13-204v1 Para 2.5.2.10.3 & 10.4 (shift turnover + daily review)

## Problem

1. The Daily Reviews list is hard-capped at the **last 14 days** (UI only — `for (let i = 0; i < 14; i++)` in `app/(app)/daily-reviews/page.tsx`). Reviews that fall off the bottom of that window without being certified become invisible, so a user cannot go back and complete an overdue review.
2. There is no way to produce a **certification record across a timeframe** — only a per-day Daily Ops PDF exists (in the sign modal). Inspectors/leadership want a single audit artifact showing who certified each day over a span.
3. The sign modal's **email/PDF-delivery apparatus is unused**. After a full certification it auto-opens `EmailPdfModal` and exposes "Email this review…" / "Download Reviewed PDF" buttons — dead weight.

## Goals

- Reach and **complete** any past daily review, regardless of age (no date cap).
- Surface **outstanding** (started-but-not-certified) reviews that have aged out of the 14-day window so they can't hide.
- Export a **single PDF certification roster** for an arbitrary date range (download only).
- Remove the email/delivery flow from the sign modal; **sign → close**.

## Non-Goals

- No schema migration, no new permission keys (reads of all base rows and back-dated signing are already permitted — see Constraints).
- No "amended" detection (events added after a day was certified) in the report — deferred.
- No change to the per-day Daily Ops preview shown while reviewing (it is the content being certified).
- `generateDailyOpsPdf` / `lib/reports/daily-ops-pdf.ts` is **not** removed — `/reports/daily` still uses it.

## Constraints / Facts (verified in code)

- `signDailyReview()` (`lib/supabase/daily-reviews.ts`) imposes **no date restriction** — back-dated signing already works end-to-end, including the offline write-queue path (`daily_review_sign`). It also auto-sets `fully_certified_at` when all required slots fill.
- A `daily_reviews` row exists **only once ≥1 slot is signed**. Therefore: `fully_certified_at IS NULL` ⇔ "started but not certified". Fully-missing past dates have no row (cannot be enumerated infinitely; the jump-to-date picker covers them).
- `fetchDailyReviewsForBase()` already reads all rows for a base (used by records export), so RLS permits reading history.
- Required slots come from `requiredSlotsForShifts(shiftCount)`: 2-shift → `[day_amsl, swing_amsl, namo, afm]`; 3-shift → adds `mid_amsl`.
- Slot labels are mode-aware via `getSlotLabel(slot, currentInstallation)` (USAF vs civilian Part 139). The report and any new UI MUST use it, never hardcoded labels.
- "Today" honors the base's local reset time via `getEffectiveReviewDate(timezone, resetTime)`, not Zulu midnight.

---

## Feature A — Older-review access

### A1. Data layer (`lib/supabase/daily-reviews.ts`)

New function:

```ts
/**
 * Uncertified reviews older than `beforeDate` (exclusive), newest first.
 * "Outstanding" = a row exists (someone started) but it was never fully
 * certified. Capped to keep the list bounded on long-neglected bases.
 */
export async function fetchOutstandingReviews(
  baseId: string,
  beforeDate: string,   // ISO YYYY-MM-DD; the oldest date already shown in the recent window
  limit = 50,
): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('base_id', baseId)
    .is('fully_certified_at', null)
    .lt('review_date', beforeDate)
    .order('review_date', { ascending: false })
    .limit(limit + 1)            // fetch one extra to detect "+N older"
  if (error) { console.error('fetchOutstandingReviews:', error.message); return [] }
  return (data || []) as DailyReviewRow[]
}
```

The page derives `hasMoreOutstanding = rows.length > limit` and renders at most `limit`.

### A2. Page (`app/(app)/daily-reviews/page.tsx`)

- **Header controls** (right-aligned next to the title):
  - **Jump to date**: `<input type="date" max={todayIso}>`. On change → `openSign(value)` (existing modal). Reset the input after open so re-picking the same date re-triggers. No min (no age cap).
  - **Export** button → opens the new export modal (Feature B).
- **Outstanding section** (above the Recent list, only when non-empty):
  - Heading: `⚠ OUTSTANDING — started, not certified` with a count.
  - Source: `fetchOutstandingReviews(installationId, oldestRecentDate)` where `oldestRecentDate = visibleDates[visibleDates.length - 1]` (14 days back).
  - Render each row with the **existing row/SlotTile markup** (extract the row body into a small `ReviewRow` component to share between Outstanding and Recent — targeted refactor, no behavior change). Click → `openSign(date)`.
  - If `hasMoreOutstanding`, append a muted "+ older outstanding reviews — use Jump to date" line.
- **Recent section**: unchanged 14-day window. Add a small "RECENT (last 14 days)" subheading only when the Outstanding section is present (so the two are visually distinct); otherwise keep current bare list.
- Fetch both in `load()` (recent via existing path; outstanding via new fn). Re-fetch both on the `daily_review_sign` write-committed event (existing listener).
- Header tally (`pending`/`reviewed`) stays scoped to the 14-day window; outstanding count is shown in its own section heading.

### A3. Worked example

3-shift base, today = Jun 10. `Mar 30` row has `day_amsl` + `swing_amsl` signed, `mid_amsl`/`namo`/`afm` null, `fully_certified_at` null.
→ `Mar 30` appears under Outstanding: `Day✓ Swing✓ Mid— NAMO— AFM— · PENDING`. Click → sign modal for `2026-03-30`; NAMO signs; if that completes all required slots, `fully_certified_at` fires and the row drops out of Outstanding on next load.

---

## Feature B — Timeframe certification report (download only)

### B1. Data layer (`lib/supabase/daily-reviews.ts`)

```ts
/** All reviews whose review_date is within [startDate, endDate] inclusive, ascending. */
export async function fetchReviewsInRange(
  baseId: string,
  startDate: string,   // YYYY-MM-DD
  endDate: string,     // YYYY-MM-DD
): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('base_id', baseId)
    .gte('review_date', startDate)
    .lte('review_date', endDate)
    .order('review_date', { ascending: true })
  if (error) { console.error('fetchReviewsInRange:', error.message); return [] }
  return (data || []) as DailyReviewRow[]
}
```

### B2. PDF generator (`lib/reports/daily-review-log-pdf.ts` — new)

- Returns `{ doc, filename }` (project convention). Built with `jsPDF` + `jspdf-autotable`, using helpers from `lib/pdf-utils.ts` for header/footer/margins consistency.
- **Inputs:**
  ```ts
  interface DailyReviewLogOptions {
    baseName: string
    baseIcao: string | null
    shiftCount: number
    startDate: string
    endDate: string
    generatedBy: string                       // userName
    rows: DailyReviewRow[]                     // from fetchReviewsInRange
    signers: Map<string, SignerInfo>           // from fetchSignersForRows(rows)
    base: { airport_type?: ... } | null        // for getSlotLabel mode-awareness
  }
  ```
- **Layout:**
  - Title: `DAILY REVIEW CERTIFICATION LOG`.
  - Sub-line: `{baseName} ({ICAO}) · {start}–{end} · {shiftCount}-shift`.
  - Table columns: `Date`, then one column per required slot (mode-aware header via `getSlotLabel`), then `Certified`.
    - Build a **date spine**: every calendar day from `startDate`..`endDate`. Days with no row render all slots `—` and `Certified = PENDING (no entry)`.
    - Slot cell = `signerCompact` (`Last (initials)`) when signed, else `—`. (Shared `signerCompact` helper lifted to the data layer or pdf module.)
    - `Certified` cell = `formatZuluDateTime(fully_certified_at)` when set, else `PENDING`.
  - Footer summary line: `{X} of {Y} days certified · {Z} pending` (Y = total days in range).
  - **Notes footnotes:** if any row has non-empty slot notes, append a "Notes" section below the table: `{date} — {SlotLabel}: {note}`.
  - Standard `pdf-utils` footer: generated-by + Zulu generated-at + page numbers.
- **Filename:** `daily-review-log_{ICAO|base}_{start}_{end}.pdf`.

### B3. Export modal (`components/daily-reviews/export-modal.tsx` — new)

- Props: `{ open, onClose, baseId, baseName, baseIcao, shiftCount, timezone, resetTime, userName, base }`.
- Range controls:
  - Preset buttons: **Last 7 days**, **Last 30 days**, **Month-to-date** (computed from `getEffectiveReviewDate`).
  - Custom **start** / **end** `<input type="date">` (`max=today`; end ≥ start, validated with a toast).
- **Download PDF** button → `fetchReviewsInRange` → `fetchSignersForRows` → `generateDailyReviewLogPdf(...)` → `doc.save(filename)`. Show a brief loading state. **No email path.**
- Empty range (no days) is impossible since the spine always has ≥1 day; a range with zero rows still produces an all-PENDING log (useful as a gap report).

### B4. Worked example

2-shift base, range Apr 1–30. 28 rows certified, Apr 2 partial, Apr 7 no row.
→ Table has 30 data rows. Apr 2 row: `Doe (JD) | Roe (AR) | — | — | PENDING`. Apr 7: `— | — | — | — | PENDING (no entry)`. Footer: `28 of 30 days certified · 2 pending`.

---

## Feature C — Remove delivery from the sign modal

### C1. `components/daily-reviews/sign-modal.tsx`

Remove:
- Imports: `sendPdfViaEmail`, `EmailPdfModal`.
- State: `pdfDoc`, `pdfFilename`, `emailOpen`, `emailSending`. (Keep `pdfUrl` — drives the left preview iframe.)
- Functions: `handleEmail`, `handleDownload`.
- JSX: the `<EmailPdfModal>` element, the "Email this review…" button, the "Download Reviewed PDF" button, and `canDownload`.
- Prop: `defaultPdfEmail` (remove from `SignModalProps` and destructure).
- In `regeneratePdf`: keep producing `pdfUrl` for the preview, drop `setPdfDoc`/`setPdfFilename`.
- In `handleSign`:
  - **Committed path:** after `setRow`/`onSigned()`, **`onClose()`** (replaces the `regeneratePdf` refresh + `setEmailOpen(true)` block).
  - **Queued (offline) path:** after the queued toast + `onSigned()`, also **`onClose()`**.

Net: sign → toast → list refreshes → modal closes. Left Daily Ops preview remains for pre-sign review.

### C2. `app/(app)/daily-reviews/page.tsx`

- Stop reading/passing `defaultPdfEmail` to `DailyReviewSignModal`.

---

## Files Touched

| File | Change |
|---|---|
| `lib/supabase/daily-reviews.ts` | + `fetchOutstandingReviews`, `fetchReviewsInRange`; export a shared `signerCompact` helper |
| `app/(app)/daily-reviews/page.tsx` | Header (jump-to-date + Export), Outstanding section, shared `ReviewRow`, drop `defaultPdfEmail` pass-through |
| `components/daily-reviews/sign-modal.tsx` | Strip email/download delivery; close-on-sign; drop `defaultPdfEmail` prop |
| `lib/reports/daily-review-log-pdf.ts` | **New** — certification roster PDF generator |
| `components/daily-reviews/export-modal.tsx` | **New** — range picker + Download |

## Edge Cases

- **Jump to future date:** blocked by `max=today` on the input.
- **Re-pick same date:** reset input value after opening the modal.
- **Long Outstanding list:** capped at 50 + "+N older" hint; jump-to-date reaches the rest.
- **Range end < start:** validated, toast, no generation.
- **Civilian Part 139 base:** all labels via `getSlotLabel`; report headers follow mode.
- **Offline sign of a back-dated review:** existing write-queue path unchanged; modal still closes on queue.
- **3-shift vs 2-shift:** report/Outstanding slot columns follow `requiredSlotsForShifts(shiftCount)`.

## Phasing

1. **Phase 1 — Feature C** (cleanup; smallest, de-risks the modal): strip delivery, close-on-sign. Verify sign still works (online + queued).
2. **Phase 2 — Feature A** (older-review access): data fn + page Outstanding/jump-to-date.
3. **Phase 3 — Feature B** (report): generator + export modal.

Each phase is independently shippable and gated on `npm run build` (RC 0) per project practice.

## Testing

- Unit (vitest): `fetchOutstandingReviews`/`fetchReviewsInRange` query shape; date-spine builder for the report (range → expected day list incl. missing days); `signerCompact`.
- Manual: back-date a sign via jump-to-date; confirm it leaves Outstanding once certified; generate a report spanning certified + partial + empty days; confirm sign modal closes on sign and has no email/download UI.
- Verify `tsc --noEmit` clean and `npm run build` RC 0.
