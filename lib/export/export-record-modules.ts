// Records Export — per-record (one-PDF-per-record) modules (Phase 2c).
//
// Waivers (AF 505), ACSI inspections, and civilian §139.303 Training reuse the
// app's bespoke single-record generators, one PDF per record:
//   documents/Waivers/<waiver_number>.pdf
//   documents/ACSI/<display_id>.pdf
//   documents/Training/<trainee>.pdf   (per-trainee transcript)
//
// Period filters which records are included (per the design spec: per-record
// modules always emit one PDF per record; the period only scopes the set).
// Photos: when ctx.includePhotos is set, ACSI embeds via skipPhotos:false and
// Waivers embed their image attachments. Both photo paths are browser-only
// (network fetch) and degrade to text-only in headless / no-client contexts, so
// the builders stay safe to unit-test. Each builder degrades a single bad record
// to a skip (logged) rather than aborting.
import { EXPORT_MODULES, type ExportModule } from './export-modules'
import { isInRange, type ExportPeriod } from './export-period'
import { pdfToExportFile, type ExportFile } from './export-file'
import { generateWaiverPdf } from '@/lib/waiver-pdf'
import { generateAcsiPdf } from '@/lib/acsi-pdf'
import { generateTrainingTranscriptPdf, type TrainingTranscriptInput } from '@/lib/training-part139-pdf'
import { createClient } from '@/lib/supabase/client'
import { compressImageForPdf } from '@/lib/utils'
import type {
  WaiverRow,
  WaiverCriteriaRow,
  WaiverReviewRow,
  WaiverCoordinationRow,
  WaiverAttachmentRow,
} from '@/lib/supabase/waivers'
import type { AcsiInspection } from '@/lib/supabase/types'

export interface RecordBuildContext {
  period: ExportPeriod
  baseName?: string | null
  baseIcao?: string | null
  /** Embed photos inline (ACSI + Waiver images). Browser-only; ignored headless. */
  includePhotos?: boolean
}

function mod(key: string): ExportModule {
  const m = EXPORT_MODULES.find((x) => x.key === key)
  if (!m) throw new Error(`Records Export: unknown module "${key}"`)
  return m
}

/** Filesystem-safe slug for a per-record filename segment. */
function slug(s: string | null | undefined, fallback: string): string {
  const out = (s ?? '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return out || fallback
}

// ── Waivers ────────────────────────────────────────────────────
export interface WaiverRecordBundle {
  waivers: WaiverRow[]
  criteriaByWaiver: Record<string, WaiverCriteriaRow[]>
  reviewsByWaiver: Record<string, WaiverReviewRow[]>
  coordinationByWaiver: Record<string, WaiverCoordinationRow[]>
  attachmentsByWaiver: Record<string, WaiverAttachmentRow[]>
}

/**
 * Build inline photo data URLs for a waiver's image attachments. Browser-only:
 * resolves each 'photo'-type attachment from the waiver-attachments bucket to a
 * signed URL, fetches it, and compresses it for the PDF. Returns [] in headless
 * / no-client contexts (so the export stays text-only there) and skips any
 * single attachment that fails — never throws.
 */
async function buildWaiverPhotoDataUrls(
  attachments: WaiverAttachmentRow[],
): Promise<{ name: string; dataUrl: string }[]> {
  const supabase = createClient()
  if (!supabase) return []
  const photos = attachments.filter((a) => a.file_type === 'photo')
  const out: { name: string; dataUrl: string }[] = []
  for (const a of photos) {
    try {
      const { data } = await supabase.storage.from('waiver-attachments').createSignedUrl(a.file_path, 3600)
      if (!data?.signedUrl) continue
      const res = await fetch(data.signedUrl)
      if (!res.ok) continue
      const blob = await res.blob()
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      out.push({ name: a.caption || a.file_name, dataUrl: await compressImageForPdf(rawDataUrl) })
    } catch {
      // Skip a failed attachment; the standalone photos/ tree still carries it.
    }
  }
  return out
}

export async function buildWaiverFiles(bundle: WaiverRecordBundle, ctx: RecordBuildContext): Promise<ExportFile[]> {
  const m = mod('waivers')
  const out: ExportFile[] = []
  // Natural date = created_at (matches the registry dateColumn).
  const filtered = bundle.waivers.filter((w) => isInRange(w.created_at, ctx.period))
  for (const w of filtered) {
    try {
      const attachments = bundle.attachmentsByWaiver[w.id] ?? []
      const photoDataUrls = ctx.includePhotos ? await buildWaiverPhotoDataUrls(attachments) : []
      const { doc } = generateWaiverPdf({
        waiver: w,
        criteria: bundle.criteriaByWaiver[w.id] ?? [],
        reviews: bundle.reviewsByWaiver[w.id] ?? [],
        coordination: bundle.coordinationByWaiver[w.id] ?? [],
        attachments,
        photoDataUrls,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
      })
      out.push(pdfToExportFile(doc, `documents/${m.folder}/${slug(w.waiver_number, w.id)}.pdf`))
    } catch (err) {
      console.error(`Records Export: waiver "${w.waiver_number}" failed to render and was skipped.`, err)
    }
  }
  return out
}

// ── ACSI ───────────────────────────────────────────────────────
export async function buildAcsiFiles(
  inspections: AcsiInspection[],
  ctx: RecordBuildContext & { baseId?: string | null },
): Promise<ExportFile[]> {
  const m = mod('acsi')
  const out: ExportFile[] = []
  const filtered = inspections.filter((i) => isInRange(i.created_at, ctx.period))
  for (const insp of filtered) {
    try {
      // generateAcsiPdf self-fetches from the photos table when skipPhotos is
      // false; it's browser-guarded (no client → no fetch), so this is safe
      // headless and only embeds images when includePhotos is set in the browser.
      const { doc } = await generateAcsiPdf(insp, {
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
        baseId: ctx.baseId,
        // Mode inferred from the record's own display_id prefix (P139 = FAA
        // Part 139, ACSI = USAF) so the export title matches the record.
        airportType: (insp.display_id || '').startsWith('P139') ? 'faa_part139' : 'usaf',
        skipPhotos: !ctx.includePhotos,
      })
      out.push(pdfToExportFile(doc, `documents/${m.folder}/${slug(insp.display_id, insp.id)}.pdf`))
    } catch (err) {
      console.error(`Records Export: ACSI "${insp.display_id}" failed to render and was skipped.`, err)
    }
  }
  return out
}

// ── Training (per-trainee transcript) ──────────────────────────
// The §139.303 "record" unit is a person's transcript: their topics, completions
// and certificates. export-data assembles one TrainingTranscriptInput per
// trainee; here we just render each. No period filter — a transcript is a
// current-state snapshot of a person's standing (like the watermark-less tables
// in the design spec); the period scopes nothing for per-trainee transcripts.
export function buildTrainingFiles(
  transcripts: TrainingTranscriptInput[],
  _ctx: RecordBuildContext,
): ExportFile[] {
  const m = mod('training_part139')
  const out: ExportFile[] = []
  for (const t of transcripts) {
    try {
      const { doc } = generateTrainingTranscriptPdf(t)
      out.push(pdfToExportFile(doc, `documents/${m.folder}/${slug(t.user.name, 'trainee')}.pdf`))
    } catch (err) {
      console.error(`Records Export: training transcript for "${t.user.name}" failed and was skipped.`, err)
    }
  }
  return out
}
