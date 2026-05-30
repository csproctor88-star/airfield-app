// Records Export — the orchestration engine (Phase 4).
//
// Given already-fetched records (so the engine is pure + testable, no network),
// dispatch each selected module to its builder, collect the output files, track
// per-module record/file counts + gaps, and optionally emit a raw-JSON sidecar.
// The page fetches, calls buildExportFiles, then packageExport → download.
import { buildTableModuleFiles, type PdfBuildContext, type OutputMode } from './export-pdf'
import {
  DISCREPANCIES_SPEC,
  CHECKS_SPEC,
  OBSTRUCTIONS_SPEC,
  PERSONNEL_SPEC,
  WILDLIFE_SPEC,
  DAILY_REVIEWS_SPEC,
} from './export-table-specs'
import { buildEventsLogFiles, buildPprFiles, buildScnFiles } from './export-rich-modules'
import { buildInspectionFiles } from './export-inspection-pdf'
import {
  SMS_HAZARDS_SPEC,
  SMS_MITIGATIONS_SPEC,
  SMS_AUDITS_SPEC,
  SMS_MOC_SPEC,
  SMS_SAFETY_REPORTS_SPEC,
  AEP_PLANS_SPEC,
  AEP_AGENCIES_SPEC,
  AEP_DRILLS_SPEC,
  AEP_COMMS_CHECKS_SPEC,
} from './export-civilian-specs'
import { buildWaiverFiles, buildAcsiFiles, buildTrainingFiles } from './export-record-modules'
import { buildExcelFiles } from './export-excel'
import { buildViewerData, buildViewerFiles } from './export-viewer'
import { EXPORT_MODULES } from './export-modules'
import { type ExportPeriod } from './export-period'
import type { ModuleRecords } from './export-data'
import type { ExportFile } from './export-file'
import type { ManifestModuleStat } from './export-manifest'

export interface BuildExportOptions {
  /** Module keys the user picked (registry keys). */
  selectedKeys: string[]
  period: ExportPeriod
  outputMode: OutputMode
  base: { name: string | null; icao: string | null }
  /** Base IANA timezone — used by the PPR generator for local time columns. */
  timezone?: string | null
  include: { pdf: boolean; excel: boolean; json: boolean; viewer?: boolean }
  /** Embed photos inline in per-record PDFs (ACSI + Waivers). Browser-only. */
  embedPhotos?: boolean
  /** ISO timestamp shown in the offline viewer header. */
  generatedAt?: string
}

export interface BuiltExport {
  files: ExportFile[]
  modules: ManifestModuleStat[]
  /** Selected modules that produced zero files. */
  gaps: string[]
}

const labelOf = (key: string): string => EXPORT_MODULES.find((m) => m.key === key)?.label ?? key

function recordCounts(records: ModuleRecords): Record<string, number> {
  return {
    discrepancies: records.discrepancies.length,
    inspections: records.inspections.length,
    checks: records.checks.length,
    obstructions: records.obstructions.length,
    personnel: records.personnel.length,
    wildlife: records.wildlife.length,
    daily_reviews: records.dailyReviews.length,
    events_log: records.eventsLog.length,
    ppr: records.ppr.entries.length,
    scn: records.scn.checks.length,
    sms:
      records.sms.hazards.length +
      records.sms.mitigations.length +
      records.sms.audits.length +
      records.sms.mocs.length +
      records.sms.safetyReports.length,
    aep:
      records.aep.plans.length +
      records.aep.agencies.length +
      records.aep.drills.length +
      records.aep.commsChecks.length,
    waivers: records.waivers.waivers.length,
    acsi: records.acsi.length,
    training_part139: records.training.length,
  }
}

/** Raw record payload per module key, for the optional JSON sidecar. */
function jsonPayload(records: ModuleRecords): Record<string, unknown> {
  return {
    discrepancies: records.discrepancies,
    inspections: records.inspections,
    checks: records.checks,
    obstructions: records.obstructions,
    personnel: records.personnel,
    wildlife: records.wildlife,
    daily_reviews: records.dailyReviews,
    events_log: records.eventsLog,
    ppr: records.ppr,
    scn: records.scn,
    sms: records.sms,
    aep: records.aep,
    waivers: records.waivers,
    acsi: records.acsi,
    training_part139: records.training,
  }
}

function jsonFile(key: string, data: unknown): ExportFile {
  const bytes = new TextEncoder().encode(JSON.stringify(data ?? null, null, 2))
  return { path: `data/${key}.json`, bytes }
}

/**
 * Build all output files for the selected modules. Pure given `records`
 * (PDF/JSON generation only) — no Supabase, so it runs headless in tests.
 */
export async function buildExportFiles(
  records: ModuleRecords,
  opts: BuildExportOptions,
): Promise<BuiltExport> {
  const pdfCtx: PdfBuildContext = {
    period: opts.period,
    outputMode: opts.outputMode,
    baseName: opts.base.name,
    baseIcao: opts.base.icao,
  }
  const recordCtx = { period: opts.period, baseName: opts.base.name, baseIcao: opts.base.icao, includePhotos: opts.embedPhotos }
  const sel = new Set(opts.selectedKeys)
  const counts = recordCounts(records)
  const payload = jsonPayload(records)

  // Accumulate every file per module key, across PDF + JSON.
  const byModule = new Map<string, ExportFile[]>()
  const add = (key: string, fs: ExportFile[]) => {
    if (fs.length === 0) return
    byModule.set(key, [...(byModule.get(key) ?? []), ...fs])
  }

  if (opts.include.pdf) {
    // ── Uniform table modules ──
    const tableJobs: Array<[string, unknown[], Parameters<typeof buildTableModuleFiles>[1]]> = [
      ['discrepancies', records.discrepancies, DISCREPANCIES_SPEC as never],
      ['checks', records.checks, CHECKS_SPEC as never],
      ['obstructions', records.obstructions, OBSTRUCTIONS_SPEC as never],
      ['personnel', records.personnel, PERSONNEL_SPEC as never],
      ['wildlife', records.wildlife, WILDLIFE_SPEC as never],
      ['daily_reviews', records.dailyReviews, DAILY_REVIEWS_SPEC as never],
    ]
    for (const [key, rows, spec] of tableJobs) {
      if (sel.has(key)) add(key, buildTableModuleFiles(rows as never[], spec, pdfCtx))
    }

    // Inspections render as full report forms (one per inspection), not a table.
    if (sel.has('inspections')) {
      add('inspections', buildInspectionFiles(records.inspections, pdfCtx))
    }

    // ── Rich-generator modules ──
    if (sel.has('events_log')) add('events_log', await buildEventsLogFiles(records.eventsLog, pdfCtx))
    if (sel.has('ppr')) {
      add('ppr', await buildPprFiles(
        { columns: records.ppr.columns, entries: records.ppr.entries, coordsByEntry: records.ppr.coordsByEntry, timezone: opts.timezone },
        pdfCtx,
      ))
    }
    if (sel.has('scn')) {
      add('scn', await buildScnFiles({ checks: records.scn.checks, agencies: records.scn.agencies }, pdfCtx))
    }

    // ── Civilian multi-kind modules ──
    if (sel.has('sms')) {
      add('sms', [
        ...buildTableModuleFiles(records.sms.hazards, SMS_HAZARDS_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.sms.mitigations, SMS_MITIGATIONS_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.sms.audits, SMS_AUDITS_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.sms.mocs, SMS_MOC_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.sms.safetyReports, SMS_SAFETY_REPORTS_SPEC, pdfCtx),
      ])
    }
    if (sel.has('aep')) {
      add('aep', [
        ...buildTableModuleFiles(records.aep.plans, AEP_PLANS_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.aep.agencies, AEP_AGENCIES_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.aep.drills, AEP_DRILLS_SPEC, pdfCtx),
        ...buildTableModuleFiles(records.aep.commsChecks, AEP_COMMS_CHECKS_SPEC, pdfCtx),
      ])
    }

    // ── Per-record modules ──
    if (sel.has('waivers')) add('waivers', await buildWaiverFiles(records.waivers, recordCtx))
    if (sel.has('acsi')) add('acsi', await buildAcsiFiles(records.acsi, recordCtx))
    if (sel.has('training_part139')) add('training_part139', buildTrainingFiles(records.training, recordCtx))
  }

  // ── Excel workbooks (per-module; master added unattributed below) ──
  let masterWorkbook: ExportFile | null = null
  if (opts.include.excel) {
    const excel = await buildExcelFiles(records, { selectedKeys: opts.selectedKeys, period: opts.period })
    for (const [key, fs] of Object.entries(excel.perModule)) add(key, fs)
    masterWorkbook = excel.master
  }

  if (opts.include.json) {
    for (const key of opts.selectedKeys) {
      if (key in payload) add(key, [jsonFile(key, payload[key])])
    }
  }

  // Per-module stats + gaps, in the user's selection order.
  const files: ExportFile[] = []
  const modules: ManifestModuleStat[] = []
  const gaps: string[] = []
  for (const key of opts.selectedKeys) {
    const fs = byModule.get(key) ?? []
    files.push(...fs)
    modules.push({ key, label: labelOf(key), files: fs.length, records: counts[key] ?? 0 })
    if (fs.length === 0) gaps.push(key)
  }

  // The master workbook spans modules, so it ships at the top level rather than
  // being attributed to any single module's count.
  if (masterWorkbook) files.push(masterWorkbook)

  // The offline viewer is a top-level folder (also unattributed). It reuses the
  // same table specs, so it never drifts from the documents.
  if (opts.include.viewer) {
    const dataset = buildViewerData(records, {
      selectedKeys: opts.selectedKeys,
      period: opts.period,
      base: opts.base,
      generatedAt: opts.generatedAt ?? '',
    })
    files.push(...buildViewerFiles(dataset))
  }

  return { files, modules, gaps }
}
