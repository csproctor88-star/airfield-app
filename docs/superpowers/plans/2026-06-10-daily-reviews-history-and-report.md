# Daily Reviews — History Access + Certification Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reach and complete daily reviews older than 14 days, export a single-PDF certification roster for any date range, and remove the unused email/delivery flow from the sign modal (sign → close).

**Architecture:** UI + data-layer changes only — no migration, no new permissions (back-dated signing and full-history reads are already permitted). Pure data-shaping helpers are unit-tested; jsPDF rendering and React UI are verified by `npm run build` + manual check. New report follows the existing `lib/reports/*-data.ts` (pure) + `*-pdf.ts` (jsPDF) split and the `lib/pdf-utils.ts` house style.

**Tech Stack:** Next.js 14 / React 18 / TypeScript (strict), Supabase JS, jsPDF + jspdf-autotable, vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-daily-reviews-history-and-report-design.md`

**Build gate:** every task ends green on `npx tsc --noEmit` and (for UI/PDF tasks) `npm run build` RC 0. NOTE: stop any running `next dev` before `npm run build` (Windows locks `.next`).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/supabase/daily-reviews.ts` (modify) | + `signerCompact` (lifted from page, exported), `fetchOutstandingReviews`, `fetchReviewsInRange` |
| `components/daily-reviews/sign-modal.tsx` (modify) | Strip email/download delivery; close-on-sign; drop `defaultPdfEmail` prop |
| `app/(app)/daily-reviews/page.tsx` (modify) | Outstanding section, jump-to-date, Export button; import shared `signerCompact`; drop `defaultPdfEmail` pass-through |
| `lib/reports/daily-review-log-data.ts` (create) | Pure: `buildReviewDateSpine`, `buildCertLogRows`, `CertLogRow` |
| `lib/reports/daily-review-log-pdf.ts` (create) | `generateDailyReviewLogPdf` → `{ doc, filename }` |
| `components/daily-reviews/export-modal.tsx` (create) | Range picker (presets + custom) → Download PDF |
| `tests/daily-review-log.test.ts` (create) | Unit tests for the pure helpers |

---

## PHASE 1 — Remove delivery from the sign modal (Feature C)

### Task 1: Strip email/download from the sign modal; close on sign

**Files:**
- Modify: `components/daily-reviews/sign-modal.tsx`
- Modify: `app/(app)/daily-reviews/page.tsx:300` (the `defaultPdfEmail={defaultPdfEmail}` prop)

- [ ] **Step 1: Remove delivery imports** in `sign-modal.tsx`

Delete these two import lines:
```ts
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
```

- [ ] **Step 2: Remove the `defaultPdfEmail` prop**

In `SignModalProps` delete the line `defaultPdfEmail: string | null`. In the destructure `({ open, ... defaultPdfEmail, onSigned })` remove `defaultPdfEmail`.

- [ ] **Step 3: Remove delivery-only state**

Delete these `useState` lines (keep `pdfUrl` — it drives the preview iframe):
```ts
const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null)
const [pdfFilename, setPdfFilename] = useState<string>('')
const [emailOpen, setEmailOpen] = useState(false)
const [emailSending, setEmailSending] = useState(false)
```
Also delete the now-unused import `import type jsPDF from 'jspdf'`.

- [ ] **Step 4: Trim `regeneratePdf` to preview-only**

Replace the body's tail so it only sets `pdfUrl`:
```ts
  const regeneratePdf = (
    data: DailyReportData,
    currentRow: DailyReviewRow | null,
    currentSigners: Partial<Record<DailyReviewSlot, SignerInfo>>,
  ) => {
    const { doc } = generateDailyOpsPdf(data, {
      startDate: reviewDate,
      endDate: reviewDate,
      isRange: false,
      generatedBy: userName,
      baseName,
      baseIcao,
      review: buildReviewSignoff(currentRow, currentSigners),
    })
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
  }
```

- [ ] **Step 5: Close on sign (both paths)** — replace `handleSign`'s success tails

In the **queued** branch, after `onSigned()` add `onClose()`:
```ts
      if (result.status === 'queued') {
        setNotes('')
        toast.success(
          `${labelFor(selectedSlot)} sign queued — will commit when the network returns.`,
          { duration: 6000 },
        )
        onSigned()
        onClose()
        return
      }
```
In the **committed** branch, replace the block from `setRow(data)` to the end of the function with:
```ts
    setRow(data)
    setNotes('')
    toast.success(`Signed as ${labelFor(selectedSlot)}`)
    onSigned()
    onClose()
  }
```
(This deletes the `fetchDailyReviewSigners` refresh, the `regeneratePdf` re-call, and the `if (data.fully_certified_at) setEmailOpen(true)` block.)

- [ ] **Step 6: Delete `handleEmail` and `handleDownload`** entirely.

- [ ] **Step 7: Remove delivery JSX**

Delete `const canDownload = !!pdfDoc && !!row?.fully_certified_at`. Delete the `{pdfDoc && (...)}` "Email this review…" button block, the `{canDownload && (...)}` "Download Reviewed PDF" button block, and the entire `<EmailPdfModal ... />` element near the end.

- [ ] **Step 8: Drop the page's prop pass-through**

In `app/(app)/daily-reviews/page.tsx`, in `<DailyReviewSignModal ...>` delete the line `defaultPdfEmail={defaultPdfEmail}`. Leave `defaultPdfEmail` in the `useInstallation()` destructure if still used elsewhere; if not, remove it from the destructure to avoid an unused-var warning. (It is only used for this prop — remove it.)

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no "unused" or "cannot find name pdfDoc/emailOpen/handleEmail" errors.

- [ ] **Step 10: Build**

Run: `npm run build`
Expected: RC 0.

- [ ] **Step 11: Manual verify**

`npm run dev`, open `/daily-reviews`, open a day, sign a slot → toast appears and the modal closes; no Email/Download buttons anywhere; the left Daily Ops preview still renders before signing.

- [ ] **Step 12: Commit**

```bash
git add components/daily-reviews/sign-modal.tsx app/(app)/daily-reviews/page.tsx
git commit -m "Remove unused email/PDF delivery from daily review sign modal; close on sign"
```

---

## PHASE 2 — Older-review access (Feature A)

### Task 2: Data layer — `signerCompact`, `fetchOutstandingReviews`

**Files:**
- Modify: `lib/supabase/daily-reviews.ts`
- Modify: `app/(app)/daily-reviews/page.tsx` (import the shared `signerCompact`, delete the local copy)
- Test: `tests/daily-review-log.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/daily-review-log.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { signerCompact, type SignerInfo } from '@/lib/supabase/daily-reviews'

const mk = (over: Partial<SignerInfo>): SignerInfo => ({
  id: 'x', name: null, rank: null, operating_initials: null, ...over,
})

describe('signerCompact', () => {
  it('uses last name + operating initials when present', () => {
    expect(signerCompact(mk({ name: 'Jane Doe', operating_initials: 'JD' }))).toBe('Doe (JD)')
  })
  it('falls back to last name only when no initials', () => {
    expect(signerCompact(mk({ name: 'Jane Doe' }))).toBe('Doe')
  })
  it('returns Unknown when no name', () => {
    expect(signerCompact(mk({ operating_initials: 'ZZ' }))).toBe('Unknown (ZZ)')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/daily-review-log.test.ts`
Expected: FAIL — `signerCompact` is not exported from `daily-reviews.ts`.

- [ ] **Step 3: Add `signerCompact` to the data layer**

In `lib/supabase/daily-reviews.ts`, after `formatSigner` add:
```ts
/** Compact signer label for tiles/tables: "Last (initials)" or "Last". */
export function signerCompact(s: SignerInfo): string {
  const last = (s.name || '').trim().split(/\s+/).slice(-1)[0] || 'Unknown'
  return s.operating_initials ? `${last} (${s.operating_initials})` : last
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/daily-review-log.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use the shared helper in the page**

In `app/(app)/daily-reviews/page.tsx`: delete the local `function signerCompact(...)` (lines ~39–43) and add `signerCompact` to the existing import from `@/lib/supabase/daily-reviews`.

- [ ] **Step 6: Add `fetchOutstandingReviews`**

In `lib/supabase/daily-reviews.ts`, after `fetchRecentReviews` add:
```ts
/**
 * Uncertified reviews older than `beforeDate` (exclusive), newest first.
 * A row exists only once ≥1 slot is signed, so `fully_certified_at IS NULL`
 * means "started but not certified". Fetches limit+1 so the caller can show
 * a "+N older" hint.
 */
export async function fetchOutstandingReviews(
  baseId: string,
  beforeDate: string,
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
    .limit(limit + 1)
  if (error) { console.error('fetchOutstandingReviews:', error.message); return [] }
  return (data || []) as DailyReviewRow[]
}
```

- [ ] **Step 7: Typecheck + test**

Run: `npx tsc --noEmit && npx vitest run tests/daily-review-log.test.ts`
Expected: tsc exit 0; tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/daily-reviews.ts app/(app)/daily-reviews/page.tsx tests/daily-review-log.test.ts
git commit -m "Add signerCompact + fetchOutstandingReviews to daily-reviews data layer"
```

### Task 3: Page — Outstanding section + jump-to-date

**Files:**
- Modify: `app/(app)/daily-reviews/page.tsx`

- [ ] **Step 1: Add imports + state**

Add `fetchOutstandingReviews` to the `@/lib/supabase/daily-reviews` import. In the component add:
```ts
const [outstanding, setOutstanding] = useState<DailyReviewRow[]>([])
const [outstandingCapped, setOutstandingCapped] = useState(false)
```

- [ ] **Step 2: Fetch outstanding in `load()`**

Inside `load()`, after `setRows(reviews)`, compute the window floor and fetch. The recent window is 14 days; its oldest date is `today − 13`. Outstanding = strictly older than that:
```ts
    const todayIso = getEffectiveReviewDate(baseTimezone, baseResetTime)
    const [yy, mm, dd] = todayIso.split('-').map(Number)
    const floor = new Date(Date.UTC(yy, mm - 1, dd))
    floor.setUTCDate(floor.getUTCDate() - 13)
    const floorIso = floor.toISOString().slice(0, 10)
    const out = await fetchOutstandingReviews(installationId, floorIso, 50)
    setOutstandingCapped(out.length > 50)
    setOutstanding(out.slice(0, 50))
```
(Keep the existing `setSignerMap(await fetchSignersForRows(reviews))`; extend it to also include outstanding signers: pass `[...reviews, ...out]`.)

- [ ] **Step 3: Extract a shared `ReviewRow` component**

Lift the per-date card body (the `<div onClick={() => openSign(date)} ...>` block inside `visibleDates.map`) into a component in the same file so Outstanding and Recent share it:
```tsx
function ReviewRow({
  date, row, shiftCount, todayIso, signerMap, currentInstallation, onOpen,
}: {
  date: string
  row: DailyReviewRow | null
  shiftCount: number
  todayIso: string | null
  signerMap: Map<string, SignerInfo>
  currentInstallation: ReturnType<typeof useInstallation>['currentInstallation']
  onOpen: (date: string) => void
}) {
  const required = requiredSlotsForShifts(shiftCount)
  const certified = row ? isFullyCertified(row, shiftCount) : false
  const isToday = date === todayIso
  const dateLabel = formatRowDate(date, todayIso)
  const railColor = certified ? 'var(--color-success)' : isToday ? 'var(--color-amber)' : 'var(--color-text-4)'
  const statusLabel = certified ? 'REVIEWED' : 'PENDING'
  const statusColor = certified ? 'var(--color-success)' : isToday ? 'var(--color-amber)' : 'var(--color-text-3)'
  // ... move the existing card JSX here verbatim, replacing openSign(date) with onOpen(date) ...
}
```
Then render Recent via `visibleDates.map((date) => <ReviewRow key={date} ... onOpen={openSign} />)`.

- [ ] **Step 4: Add the Outstanding section + jump-to-date control**

Above the Recent list, render (only when `outstanding.length > 0`):
```tsx
{outstanding.length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-amber)', letterSpacing: '0.04em', marginBottom: 8 }}>
      ⚠ OUTSTANDING — started, not certified ({outstanding.length}{outstandingCapped ? '+' : ''})
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {outstanding.map((r) => (
        <ReviewRow key={r.review_date} date={r.review_date} row={r}
          shiftCount={shiftCount} todayIso={todayIso} signerMap={signerMap}
          currentInstallation={currentInstallation} onOpen={openSign} />
      ))}
    </div>
    {outstandingCapped && (
      <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
        Showing the 50 most recent outstanding reviews — use “Jump to date” to reach older ones.
      </div>
    )}
    <div style={{ marginTop: 14, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.04em' }}>
      RECENT — last 14 days
    </div>
  </div>
)}
```
In the header row (next to the "Daily Reviews" title), add a jump-to-date input:
```tsx
<input
  type="date"
  max={todayIso ?? undefined}
  onChange={(e) => { if (e.target.value) { openSign(e.target.value); e.target.value = '' } }}
  className="input-dark"
  style={{ maxWidth: 170 }}
  aria-label="Jump to a past review date"
/>
```
(Place the title + this control in a flex row with `justifyContent: 'space-between'`.)

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit` then (stop dev server first) `npm run build`
Expected: tsc exit 0; build RC 0.

- [ ] **Step 6: Manual verify**

With seed data that has an uncertified review older than 14 days, confirm it appears under Outstanding; clicking it opens the sign modal for that date; picking a date in the Jump-to-date control opens the modal for that date; completing all slots removes it from Outstanding after the list reloads.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/daily-reviews/page.tsx
git commit -m "Daily Reviews: Outstanding (overdue) section + jump-to-date for older reviews"
```

---

## PHASE 3 — Timeframe certification report (Feature B)

### Task 4: Report data helpers (pure, TDD) + `fetchReviewsInRange`

**Files:**
- Create: `lib/reports/daily-review-log-data.ts`
- Modify: `lib/supabase/daily-reviews.ts` (add `fetchReviewsInRange`)
- Test: `tests/daily-review-log.test.ts` (append)

- [ ] **Step 1: Append failing tests**

Add to `tests/daily-review-log.test.ts`:
```ts
import { buildReviewDateSpine, buildCertLogRows } from '@/lib/reports/daily-review-log-data'
import type { DailyReviewRow } from '@/lib/supabase/daily-reviews'

describe('buildReviewDateSpine', () => {
  it('is inclusive of both ends', () => {
    expect(buildReviewDateSpine('2026-04-01', '2026-04-03'))
      .toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })
  it('returns a single day when start === end', () => {
    expect(buildReviewDateSpine('2026-04-01', '2026-04-01')).toEqual(['2026-04-01'])
  })
  it('crosses month boundaries', () => {
    expect(buildReviewDateSpine('2026-03-30', '2026-04-01'))
      .toEqual(['2026-03-30', '2026-03-31', '2026-04-01'])
  })
  it('returns [] when start is after end', () => {
    expect(buildReviewDateSpine('2026-04-05', '2026-04-01')).toEqual([])
  })
})

describe('buildCertLogRows', () => {
  const required = ['day_amsl', 'swing_amsl', 'namo', 'afm'] as const
  const signers = new Map([['u1', { id: 'u1', name: 'Jane Doe', rank: null, operating_initials: 'JD' }]])
  const partial = {
    review_date: '2026-04-02', day_amsl_signed_by: 'u1', fully_certified_at: null,
  } as unknown as DailyReviewRow

  it('renders — for unsigned slots and PENDING (no entry) for missing days', () => {
    const spine = ['2026-04-01', '2026-04-02']
    const rowByDate = new Map<string, DailyReviewRow>([['2026-04-02', partial]])
    const rows = buildCertLogRows(spine, rowByDate, signers, [...required], null)
    expect(rows[0].certifiedText).toBe('PENDING (no entry)')
    expect(rows[0].slots).toEqual(['—', '—', '—', '—'])
    expect(rows[1].slots[0]).toBe('Doe (JD)')
    expect(rows[1].certifiedText).toBe('PENDING')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/daily-review-log.test.ts`
Expected: FAIL — module `daily-review-log-data` not found.

- [ ] **Step 3: Implement `lib/reports/daily-review-log-data.ts`**

```ts
import { formatZuluDateTime } from '@/lib/utils'
import {
  signerCompact, getSlotLabel,
  type DailyReviewRow, type DailyReviewSlot, type SignerInfo,
} from '@/lib/supabase/daily-reviews'

export interface CertLogRow {
  date: string
  slots: string[]              // aligned to requiredSlots; signerCompact or '—'
  certifiedAt: string | null
  certifiedText: string        // Zulu time | 'PENDING' | 'PENDING (no entry)'
  notes: { slotLabel: string; note: string }[]
}

/** Every calendar day from startDate..endDate inclusive (UTC math, TZ-safe). [] if start > end. */
export function buildReviewDateSpine(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  let cur = Date.UTC(sy, sm - 1, sd)
  const end = Date.UTC(ey, em - 1, ed)
  const out: string[] = []
  while (cur <= end) {
    out.push(new Date(cur).toISOString().slice(0, 10))
    cur += 86400000
  }
  return out
}

/** Shape each spine day into a certification-log row. Pure. */
export function buildCertLogRows(
  spine: string[],
  rowByDate: Map<string, DailyReviewRow>,
  signers: Map<string, SignerInfo>,
  requiredSlots: DailyReviewSlot[],
  base: { airport_type?: 'usaf' | 'faa_part139' | null } | null,
): CertLogRow[] {
  return spine.map((date) => {
    const row = rowByDate.get(date) ?? null
    const slots = requiredSlots.map((slot) => {
      const id = row ? (row[`${slot}_signed_by` as keyof DailyReviewRow] as string | null) : null
      const signer = id ? signers.get(id) : null
      return signer ? signerCompact(signer) : '—'
    })
    const certifiedAt = row?.fully_certified_at ?? null
    const certifiedText = certifiedAt
      ? formatZuluDateTime(certifiedAt)
      : row ? 'PENDING' : 'PENDING (no entry)'
    const notes: { slotLabel: string; note: string }[] = []
    if (row) {
      for (const slot of requiredSlots) {
        const note = row[`${slot}_notes` as keyof DailyReviewRow] as string | null
        if (note && note.trim()) notes.push({ slotLabel: getSlotLabel(slot, base), note: note.trim() })
      }
    }
    return { date, slots, certifiedAt, certifiedText, notes }
  })
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/daily-review-log.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Add `fetchReviewsInRange`**

In `lib/supabase/daily-reviews.ts`, after `fetchOutstandingReviews` add:
```ts
/** All reviews with review_date within [startDate, endDate] inclusive, ascending. */
export async function fetchReviewsInRange(
  baseId: string,
  startDate: string,
  endDate: string,
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

- [ ] **Step 6: Typecheck + test + commit**

Run: `npx tsc --noEmit && npx vitest run tests/daily-review-log.test.ts`
Expected: tsc 0; tests PASS.
```bash
git add lib/reports/daily-review-log-data.ts lib/supabase/daily-reviews.ts tests/daily-review-log.test.ts
git commit -m "Add daily-review certification log data helpers + fetchReviewsInRange"
```

### Task 5: PDF generator `daily-review-log-pdf.ts`

**Files:**
- Create: `lib/reports/daily-review-log-pdf.ts`

- [ ] **Step 1: Implement the generator**

```ts
import type jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  getSlotLabel, requiredSlotsForShifts,
  type DailyReviewRow, type SignerInfo,
} from '@/lib/supabase/daily-reviews'
import { buildReviewDateSpine, buildCertLogRows } from './daily-review-log-data'

export interface DailyReviewLogOptions {
  baseName: string
  baseIcao: string | null
  shiftCount: number
  startDate: string
  endDate: string
  generatedBy: string
  rows: DailyReviewRow[]
  signers: Map<string, SignerInfo>
  base: { airport_type?: 'usaf' | 'faa_part139' | null } | null
}

export function generateDailyReviewLogPdf(opts: DailyReviewLogOptions): { doc: jsPDF; filename: string } {
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: opts.baseName, baseIcao: opts.baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'DAILY REVIEW CERTIFICATION LOG',
    subtitle: `${opts.startDate} → ${opts.endDate} · ${opts.shiftCount}-shift`,
  })

  const required = requiredSlotsForShifts(opts.shiftCount)
  const spine = buildReviewDateSpine(opts.startDate, opts.endDate)
  const rowByDate = new Map(opts.rows.map((r) => [r.review_date, r] as const))
  const logRows = buildCertLogRows(spine, rowByDate, opts.signers, required, opts.base)
  const certified = logRows.filter((r) => r.certifiedAt !== null).length

  y = drawStatBox(ctx, y, [
    { label: 'Range', value: `${opts.startDate} – ${opts.endDate}` },
    { label: 'Days', value: String(spine.length) },
    { label: 'Certified', value: `${certified} of ${spine.length}` },
    { label: 'Pending', value: String(spine.length - certified) },
  ])

  const certCol = required.length + 1
  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['Date', ...required.map((s) => getSlotLabel(s, opts.base)), 'Certified']],
    body: logRows.map((r) => [r.date, ...r.slots, r.certifiedText]),
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === certCol
          && /PENDING/.test(String(data.cell.raw))) {
        data.cell.styles.textColor = [150, 90, 0]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: () => drawFooter(ctx),
  })

  // Notes appendix (only if any)
  const withNotes = logRows.filter((r) => r.notes.length > 0)
  if (withNotes.length > 0) {
    // @ts-expect-error lastAutoTable is added by jspdf-autotable at runtime
    let ny = (doc.lastAutoTable?.finalY ?? y) + 8
    doc.setFontSize(10); doc.setTextColor(0)
    doc.text('NOTES', margin, ny); ny += 6
    doc.setFontSize(8); doc.setTextColor(60)
    for (const r of withNotes) {
      for (const n of r.notes) {
        const line = sanitizePdfText(`${r.date} — ${n.slotLabel}: ${n.note}`)
        const wrapped = doc.splitTextToSize(line, ctx.contentWidth)
        if (ny > ctx.pageHeight - 16) { doc.addPage(); ny = margin; drawFooter(ctx) }
        doc.text(wrapped, margin, ny)
        ny += wrapped.length * 4 + 1
      }
    }
  }

  const slug = (opts.baseIcao || opts.baseName || 'base').replace(/[^A-Za-z0-9]+/g, '-')
  const filename = `daily-review-log_${slug}_${opts.startDate}_${opts.endDate}.pdf`
  return { doc, filename }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `autoTable` import errors, match the import style used in `lib/reports/daily-ops-pdf.ts`.)

- [ ] **Step 3: Commit**

```bash
git add lib/reports/daily-review-log-pdf.ts
git commit -m "Add daily review certification log PDF generator"
```

### Task 6: Export modal + wire the page Export button

**Files:**
- Create: `components/daily-reviews/export-modal.tsx`
- Modify: `app/(app)/daily-reviews/page.tsx`

- [ ] **Step 1: Implement the export modal**

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { fetchReviewsInRange, fetchSignersForRows, getEffectiveReviewDate } from '@/lib/supabase/daily-reviews'
import { generateDailyReviewLogPdf } from '@/lib/reports/daily-review-log-pdf'

interface Props {
  open: boolean
  onClose: () => void
  baseId: string
  baseName: string
  baseIcao: string | null
  shiftCount: number
  timezone: string | null
  resetTime: string | null
  userName: string
  base: { airport_type?: 'usaf' | 'faa_part139' | null } | null
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + delta)
  return t.toISOString().slice(0, 10)
}

export default function DailyReviewExportModal({
  open, onClose, baseId, baseName, baseIcao, shiftCount, timezone, resetTime, userName, base,
}: Props) {
  const todayIso = getEffectiveReviewDate(timezone, resetTime)
  const [start, setStart] = useState(addDaysIso(todayIso, -29))
  const [end, setEnd] = useState(todayIso)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const applyPreset = (days: number) => { setStart(addDaysIso(todayIso, -(days - 1))); setEnd(todayIso) }
  const applyMtd = () => { setStart(todayIso.slice(0, 8) + '01'); setEnd(todayIso) }

  const onDownload = async () => {
    if (start > end) { toast.error('Start date must be on or before end date'); return }
    setBusy(true)
    try {
      const rows = await fetchReviewsInRange(baseId, start, end)
      const signers = await fetchSignersForRows(rows)
      const { doc, filename } = generateDailyReviewLogPdf({
        baseName, baseIcao, shiftCount, startDate: start, endDate: end,
        generatedBy: userName, rows, signers, base,
      })
      doc.save(filename)
      onClose()
    } catch (e) {
      console.error('export daily review log:', e)
      toast.error('Failed to generate report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 460, border: '1px solid var(--color-border-mid)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-mid)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            Export Certification Log
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => applyPreset(7)} className="input-dark" style={{ cursor: 'pointer' }}>Last 7</button>
            <button onClick={() => applyPreset(30)} className="input-dark" style={{ cursor: 'pointer' }}>Last 30</button>
            <button onClick={applyMtd} className="input-dark" style={{ cursor: 'pointer' }}>Month-to-date</button>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Start
            <input type="date" max={todayIso} value={start} onChange={(e) => setStart(e.target.value)} className="input-dark" style={{ width: '100%' }} />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>End
            <input type="date" max={todayIso} value={end} onChange={(e) => setEnd(e.target.value)} className="input-dark" style={{ width: '100%' }} />
          </label>
          <button onClick={onDownload} disabled={busy}
            style={{ marginTop: 6, width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-cyan)', color: 'var(--color-cyan-btn-text)', fontWeight: 800,
              border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the Export button + modal to the page**

In `app/(app)/daily-reviews/page.tsx`:
- Import: `import DailyReviewExportModal from '@/components/daily-reviews/export-modal'`
- State: `const [exportOpen, setExportOpen] = useState(false)`
- In the header flex row (with the jump-to-date input), add:
```tsx
<button onClick={() => setExportOpen(true)} className="input-dark" style={{ cursor: 'pointer', fontWeight: 700 }}>
  Export…
</button>
```
- Near the sign modal render, add:
```tsx
{exportOpen && installationId && (
  <DailyReviewExportModal
    open={exportOpen}
    onClose={() => setExportOpen(false)}
    baseId={installationId}
    baseName={baseName}
    baseIcao={baseIcao}
    shiftCount={shiftCount}
    timezone={baseTimezone}
    resetTime={baseResetTime}
    userName={userName}
    base={currentInstallation as { airport_type?: 'usaf' | 'faa_part139' | null } | null}
  />
)}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then (stop dev server) `npm run build`
Expected: tsc 0; build RC 0.

- [ ] **Step 4: Manual verify**

Open `/daily-reviews` → Export… → pick Last 30 → Download PDF. Confirm a landscape "DAILY REVIEW CERTIFICATION LOG" PDF downloads with one row per day, signer initials per slot, Certified column showing Zulu time or PENDING, and a NOTES appendix when notes exist. Test a custom range with a missing day (shows "PENDING (no entry)") and a 3-shift base (adds the Mid column).

- [ ] **Step 5: Commit**

```bash
git add components/daily-reviews/export-modal.tsx app/(app)/daily-reviews/page.tsx
git commit -m "Daily Reviews: timeframe certification log export (download PDF)"
```

### Task 7: Final verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green (existing suite + new `daily-review-log.test.ts`).

- [ ] **Step 2: Clean build**

Run: (stop dev server) `npm run build`
Expected: RC 0.

- [ ] **Step 3: Manual end-to-end pass**

- Sign a recent review → modal closes, no email/download UI.
- Back-date via Jump-to-date → sign → completes → leaves Outstanding.
- Outstanding shows only uncertified rows older than 14 days.
- Export a range spanning certified + partial + missing days → roster correct.

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-Review Notes (author)

- **Spec coverage:** Feature A → Tasks 2–3; Feature B → Tasks 4–6; Feature C → Task 1. No-cap back-dating relies on the existing `signDailyReview` (verified) — no task needed. Notes-as-footnotes → Task 5. Amended detection explicitly out of scope (no task), per spec.
- **Type consistency:** `signerCompact`, `fetchOutstandingReviews`, `fetchReviewsInRange`, `buildReviewDateSpine`, `buildCertLogRows`, `CertLogRow`, `generateDailyReviewLogPdf`, `DailyReviewLogOptions` are defined once and referenced with identical signatures across tasks. `getSlotLabel(slot, base)` and `requiredSlotsForShifts(shiftCount)` are existing exports.
- **Window boundary:** Recent = today−13…today (14 days); Outstanding floor = today−13 with `.lt()` → first outstanding candidate is today−14. Gap-free, overlap-free.
