// Records Export — photos (Phase 5).
//
// Two layers, split so the planning logic is pure + unit-testable and only the
// actual network fetch is browser-only:
//   - planPhotos / photosIndexCsv  → PURE: given photo rows + period + an id→
//     display-id resolver, decide each photo's ZIP path and build the CSV.
//   - downloadPhotos               → BROWSER: fetch each planned photo (3x
//     retry), return ExportFile[] + failures[]. Never throws; a dead
//     storage_path becomes a failure, not an aborted export (design §10).
//
// Layout (design §5): photos/<Module>/<record>/<captured>_<file>.jpg, plus a
// photos-index.csv provenance manifest at photos/photos-index.csv.
import type { ExportFile } from './export-file'
import { isInRange, type ExportPeriod } from './export-period'

/** Raw photo row (subset of the photos table) the export needs. */
export interface PhotoRow {
  id: string
  storage_path: string
  file_name: string
  captured_at: string
  latitude: number | null
  longitude: number | null
  uploaded_by: string | null
  discrepancy_id: string | null
  check_id: string | null
  inspection_id: string | null
  acsi_inspection_id: string | null
  wildlife_sighting_id: string | null
  wildlife_strike_id: string | null
}

/** Per-module folder + the FK column that ties a photo to that module's record. */
const MODULE_BINDINGS: { key: keyof PhotoRow; module: string; folder: string }[] = [
  { key: 'discrepancy_id', module: 'discrepancies', folder: 'Discrepancies' },
  { key: 'check_id', module: 'checks', folder: 'Checks' },
  { key: 'inspection_id', module: 'inspections', folder: 'Inspections' },
  { key: 'acsi_inspection_id', module: 'acsi', folder: 'ACSI' },
  { key: 'wildlife_sighting_id', module: 'wildlife', folder: 'Wildlife' },
  { key: 'wildlife_strike_id', module: 'wildlife', folder: 'Wildlife' },
]

/** Maps a record UUID → its human display id (e.g. DSC-1042), per module key. */
export type DisplayIdResolver = Record<string, Record<string, string>>

export interface PlannedPhoto {
  /** Path inside the ZIP, e.g. 'photos/Discrepancies/DSC-1042/2026-05-02_crack.jpg'. */
  path: string
  /** storage_path (no bucket prefix) — the caller resolves this to a fetch URL. */
  storagePath: string
  module: string
  /** Folder-safe record id (display id when resolvable, else the raw UUID). */
  record: string
  capturedAt: string
  latitude: number | null
  longitude: number | null
  uploadedBy: string | null
  fileName: string
}

/** Filesystem-safe slug for a path segment. */
function slug(s: string, fallback: string): string {
  const out = (s || '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return out || fallback
}

/** The selected module a photo belongs to + the record UUID, or null if none. */
function bindingFor(row: PhotoRow, selected: Set<string>): { module: string; folder: string; recordId: string } | null {
  for (const b of MODULE_BINDINGS) {
    const recordId = row[b.key] as string | null
    if (recordId && selected.has(b.module)) return { module: b.module, folder: b.folder, recordId }
  }
  return null
}

/**
 * Plan every in-window photo for the selected modules into a ZIP path. Pure.
 * Photos whose module isn't selected, or that fall outside the period (by
 * captured_at), are dropped. Duplicate paths are de-collided with a -2/-3 suffix.
 */
export function planPhotos(
  rows: PhotoRow[],
  opts: { selectedKeys: string[]; period: ExportPeriod; resolver?: DisplayIdResolver },
): PlannedPhoto[] {
  const selected = new Set(opts.selectedKeys)
  const resolver = opts.resolver ?? {}
  const usedPaths = new Set<string>()
  const out: PlannedPhoto[] = []

  for (const row of rows) {
    if (!isInRange(row.captured_at, opts.period)) continue
    const binding = bindingFor(row, selected)
    if (!binding) continue

    const display = resolver[binding.module]?.[binding.recordId]
    const record = slug(display || binding.recordId, binding.recordId.slice(0, 8))
    const date = (row.captured_at || '').slice(0, 10) || 'undated'
    const fileSlug = slug(row.file_name || `${row.id}.jpg`, `${row.id}.jpg`)

    let path = `photos/${binding.folder}/${record}/${date}_${fileSlug}`
    if (usedPaths.has(path)) {
      const dot = path.lastIndexOf('.')
      const stem = dot > 0 ? path.slice(0, dot) : path
      const ext = dot > 0 ? path.slice(dot) : ''
      let n = 2
      while (usedPaths.has(`${stem}-${n}${ext}`)) n++
      path = `${stem}-${n}${ext}`
    }
    usedPaths.add(path)

    out.push({
      path,
      storagePath: row.storage_path,
      module: binding.module,
      record,
      capturedAt: row.captured_at,
      latitude: row.latitude,
      longitude: row.longitude,
      uploadedBy: row.uploaded_by,
      fileName: row.file_name,
    })
  }
  return out
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Provenance CSV for the planned photos (one row per file). Pure. */
export function photosIndexCsv(planned: PlannedPhoto[]): string {
  const header = ['path', 'module', 'record', 'captured_at', 'latitude', 'longitude', 'uploaded_by', 'original_file_name']
  const lines = [header.join(',')]
  for (const p of planned) {
    lines.push([
      csvCell(p.path), csvCell(p.module), csvCell(p.record), csvCell(p.capturedAt),
      csvCell(p.latitude), csvCell(p.longitude), csvCell(p.uploadedBy), csvCell(p.fileName),
    ].join(','))
  }
  return lines.join('\n') + '\n'
}

export interface PhotoFailure {
  path: string
  storagePath: string
  reason: string
}

export interface DownloadPhotosResult {
  files: ExportFile[]
  failures: PhotoFailure[]
}

export interface DownloadPhotosOptions {
  /** Resolve a photo's storage_path to a fetchable URL. */
  urlFor: (storagePath: string) => string
  /** Progress callback: (done, total). */
  onProgress?: (done: number, total: number) => void
  /** Max attempts per photo before recording a failure. Default 3. */
  maxAttempts?: number
}

/**
 * Fetch every planned photo into an ExportFile. Browser-only (uses fetch).
 * Each photo is retried up to maxAttempts; persistent failures are collected
 * (not thrown) plus the photos-index.csv is always appended so the tree is
 * self-describing even when some files are missing.
 */
export async function downloadPhotos(
  planned: PlannedPhoto[],
  opts: DownloadPhotosOptions,
): Promise<DownloadPhotosResult> {
  const maxAttempts = opts.maxAttempts ?? 3
  const files: ExportFile[] = []
  const failures: PhotoFailure[] = []

  let done = 0
  for (const p of planned) {
    const url = opts.urlFor(p.storagePath)
    let saved = false
    let lastReason = 'unknown error'
    for (let attempt = 1; attempt <= maxAttempts && !saved; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) { lastReason = `HTTP ${res.status}`; continue }
        const buf = await res.arrayBuffer()
        files.push({ path: p.path, bytes: new Uint8Array(buf) })
        saved = true
      } catch (e) {
        lastReason = e instanceof Error ? e.message : String(e)
      }
    }
    if (!saved) failures.push({ path: p.path, storagePath: p.storagePath, reason: lastReason })
    done++
    opts.onProgress?.(done, planned.length)
  }

  // Always include the provenance index (covers both downloaded + missing).
  files.push({ path: 'photos/photos-index.csv', bytes: new TextEncoder().encode(photosIndexCsv(planned)) })

  return { files, failures }
}
