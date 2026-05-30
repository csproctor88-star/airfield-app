// Records Export — rich-generator modules (Phase 2b-iii).
//
// Unlike the uniform table modules (export-table-specs.ts), these three reuse
// the app's existing bespoke PDF generators so the exported record matches the
// in-app export byte-for-byte in layout:
//   - Events Log → generateEventsLogPdf  (AF Form 3616-style operational log)
//   - PPR        → generatePprPdf         (per-PPR cards + coordination)
//   - SCN        → generateScnMonthlyPdf  (per-month daily-check matrix)
//
// Each builder is a thin async function that takes already-fetched records
// (export-data.ts owns the fetch), filters by the export period, renders via the
// shared generator, and returns ExportFile[]. They follow buildTableModuleFiles'
// contract: [] when nothing falls in the period; never throw past their own
// boundary so one module can't abort a multi-module export.
import { EXPORT_MODULES, type ExportModule } from './export-modules'
import { isInRange, groupByMonth, monthBucket, type ExportPeriod } from './export-period'
import { periodSubtitle, type PdfBuildContext } from './export-pdf'
import { pdfToExportFile, type ExportFile } from './export-file'
import { generateEventsLogPdf, type EventsLogPdfRow } from '@/lib/events-log-pdf'
import { generatePprPdf } from '@/lib/ppr-pdf'
import { generateScnMonthlyPdf } from '@/lib/scn-pdf'
import type { PprColumn, PprEntry, PprCoordination } from '@/lib/supabase/ppr'
import type { ScnCheckWithResults } from '@/lib/supabase/scn'

function mod(key: string): ExportModule {
  const m = EXPORT_MODULES.find((x) => x.key === key)
  if (!m) throw new Error(`Records Export: unknown module "${key}"`)
  return m
}

/** Wrap a builder so a throw degrades to [] + a logged skip, matching buildTableModuleFiles. */
async function guard(key: string, fn: () => Promise<ExportFile[]>): Promise<ExportFile[]> {
  try {
    return await fn()
  } catch (err) {
    console.error(`Records Export: module "${key}" failed to render and was skipped.`, err)
    return []
  }
}

// ── Events Log ────────────────────────────────────────────────
// Pre-formatted by export-data.ts into EventsLogPdfRow (same formatAction /
// buildDetailsString the on-screen log uses, via lib/activity-format.ts).
export async function buildEventsLogFiles(
  rows: EventsLogPdfRow[],
  ctx: PdfBuildContext,
): Promise<ExportFile[]> {
  return guard('events_log', async () => {
    const m = mod('events_log')
    const filtered = rows.filter((r) => isInRange(r.createdAt, ctx.period))
    if (filtered.length === 0) return []

    const render = async (subRows: EventsLogPdfRow[], from: string, to: string, path: string) => {
      const { doc } = await generateEventsLogPdf({
        rows: subRows,
        startDate: from,
        endDate: to,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
      })
      return pdfToExportFile(doc, path)
    }

    if (ctx.outputMode === 'monthly') {
      const out: ExportFile[] = []
      for (const [month, monthRows] of Array.from(groupByMonth(filtered, (r) => r.createdAt).entries())) {
        out.push(await render(monthRows, `${month}-01`, `${month}-31`, `documents/${m.folder}/${month}.pdf`))
      }
      return out
    }

    const { from, to } = periodBounds(ctx.period, filtered.map((r) => r.createdAt))
    return [await render(filtered, from, to, `documents/${m.folder}.pdf`)]
  })
}

// ── PPR ────────────────────────────────────────────────────────
// Reuses the rich per-PPR card generator. Coordination rows are passed through
// (batch-fetched in export-data.ts); per-entry remark threads are intentionally
// omitted — they have no batch fetcher and would be N+1 on large exports.
export async function buildPprFiles(
  input: {
    columns: PprColumn[]
    entries: PprEntry[]
    coordsByEntry: Record<string, PprCoordination[]>
    timezone?: string | null
  },
  ctx: PdfBuildContext,
): Promise<ExportFile[]> {
  return guard('ppr', async () => {
    const m = mod('ppr')
    // PPR's natural date is arrival_date (matches the registry dateColumn).
    const filtered = input.entries.filter((e) => isInRange(e.arrival_date, ctx.period))
    if (filtered.length === 0) return []

    const render = async (entries: PprEntry[], from: string, to: string, subtitle: string, path: string) => {
      const { doc } = await generatePprPdf({
        columns: input.columns,
        entries,
        dateFrom: from,
        dateTo: to,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
        timezone: input.timezone,
        coordsByEntry: input.coordsByEntry,
        subtitle,
      })
      return pdfToExportFile(doc, path)
    }

    if (ctx.outputMode === 'monthly') {
      const out: ExportFile[] = []
      for (const [month, monthEntries] of Array.from(groupByMonth(filtered, (e) => e.arrival_date).entries())) {
        out.push(await render(monthEntries, `${month}-01`, `${month}-31`, `Arrival date: ${month}`, `documents/${m.folder}/${month}.pdf`))
      }
      return out
    }

    const { from, to } = periodBounds(ctx.period, filtered.map((e) => e.arrival_date))
    return [await render(filtered, from, to, `Arrival date: ${periodSubtitle(ctx.period)}`, `documents/${m.folder}.pdf`)]
  })
}

// ── SCN ────────────────────────────────────────────────────────
// SCN is inherently a per-month calendar matrix — there is no meaningful
// multi-month combined grid. It therefore ALWAYS emits one matrix PDF per month
// (documents/SCN/YYYY-MM.pdf) regardless of the chosen output mode; the period
// just bounds which months are produced. checks are filtered on check_date.
export async function buildScnFiles(
  input: { checks: ScnCheckWithResults[]; agencies: string[] },
  ctx: PdfBuildContext,
): Promise<ExportFile[]> {
  return guard('scn', async () => {
    const m = mod('scn')
    const filtered = input.checks.filter((c) => isInRange(c.check_date, ctx.period))
    if (filtered.length === 0) return []

    // Bucket by month, then render each month's matrix from that month's checks.
    const byMonth = groupByMonth(filtered, (c) => c.check_date)
    const out: ExportFile[] = []
    for (const [month, monthChecks] of Array.from(byMonth.entries())) {
      const { doc } = generateScnMonthlyPdf({
        monthYyyyMm: month,
        checks: monthChecks,
        agencies: input.agencies,
      })
      out.push(pdfToExportFile(doc, `documents/${m.folder}/${month}.pdf`))
    }
    return out
  })
}

/**
 * Resolve a concrete {from,to} date-range label for an aggregate render.
 * For a bounded range, use its from/to. For all_time, derive the span from the
 * actual record dates so the generator's stat box reads honestly (rather than
 * an empty/"…" range).
 */
function periodBounds(period: ExportPeriod, dates: string[]): { from: string; to: string } {
  if (period.kind === 'range') {
    return { from: period.from ?? minDate(dates), to: period.to ?? maxDate(dates) }
  }
  return { from: minDate(dates), to: maxDate(dates) }
}

function minDate(dates: string[]): string {
  let min = ''
  for (const d of dates) {
    const day = (d ?? '').slice(0, 10)
    if (day && (min === '' || day < min)) min = day
  }
  return min
}

function maxDate(dates: string[]): string {
  let max = ''
  for (const d of dates) {
    const day = (d ?? '').slice(0, 10)
    if (day && day > max) max = day
  }
  return max
}

// monthBucket is re-exported for tests that assert SCN/Events month pathing.
export { monthBucket }
