// Records Export — packager (Phase 4): assemble the organized ZIP.
//
// Takes the already-built content files (documents/, spreadsheets/, data/),
// computes the manifest, renders the audit cover + README, and zips everything
// into a single downloadable blob. This is the step that turns the built
// per-module logic into a usable artifact.
//
// jszip rides along with our exceljs dependency (exceljs depends on jszip@^3.10);
// imported directly here rather than re-declared, to match the installed tree.
import JSZip from 'jszip'
import type { ExportFile } from './export-file'
import {
  buildManifest,
  manifestToReadme,
  type ExportManifest,
  type ManifestModuleStat,
} from './export-manifest'
import { buildCoverFile } from './export-cover-pdf'

export interface PackageExportInput {
  /** Content files under documents/ · spreadsheets/ · data/. */
  files: ExportFile[]
  base: { name: string | null; icao: string | null }
  period: { kind: string; from?: string; to?: string }
  outputMode: string
  modules: ManifestModuleStat[]
  gaps: string[]
  generatedAt: string
  generatedBy?: string | null
  /** Photos that failed to download (recorded in the manifest + cover). */
  photoFailures?: { path: string; reason: string }[]
}

export interface PackagedExport {
  /** Raw ZIP bytes. Kept as a Uint8Array (not a Blob) so packaging runs
   *  headless in tests/SSR; the browser download wraps it in a Blob. */
  bytes: Uint8Array
  filename: string
  manifest: ExportManifest
}

/** ZIP filename: glidepath-records-<ICAO>-<range|all-time>.zip */
export function buildZipFilename(
  icao: string | null | undefined,
  period: { kind: string; from?: string; to?: string },
): string {
  const code = (icao || 'BASE').replace(/[^a-zA-Z0-9]/g, '') || 'BASE'
  const span = period.kind === 'all_time'
    ? 'all-time'
    : `${period.from || 'start'}_to_${period.to || 'end'}`
  return `glidepath-records-${code}-${span}.zip`
}

/**
 * Build the manifest, render cover + README, and zip all files. The cover,
 * README, and manifest.json are NOT self-referenced in the hash list (they are
 * derived from it); the manifest hashes the content files only.
 */
export async function packageExport(input: PackageExportInput): Promise<PackagedExport> {
  const manifest = await buildManifest({
    files: input.files,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy ?? null,
    base: input.base,
    period: input.period,
    outputMode: input.outputMode,
    modules: input.modules,
    gaps: input.gaps,
    photoFailures: input.photoFailures,
  })

  const cover = buildCoverFile(manifest)
  const readme = manifestToReadme(manifest)
  const manifestJson = JSON.stringify(manifest, null, 2)

  // Re-wrap every byte array in this realm's Uint8Array before handing to
  // jszip. Under jsdom (and any cross-realm caller) a foreign Uint8Array fails
  // jszip's instanceof check ("Can't read the data of …"); copying via the
  // ArrayBuffer normalizes the realm. No-op cost in the browser.
  const norm = (b: Uint8Array) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

  const zip = new JSZip()
  zip.file(cover.path, norm(cover.bytes))
  zip.file('00-README.txt', readme)
  zip.file('manifest.json', manifestJson)
  for (const f of input.files) {
    zip.file(f.path, norm(f.bytes))
  }

  // 'uint8array' works in every JS runtime; 'blob' trips jsdom (it parses a
  // data: URL internally), so we wrap in a Blob only at download time.
  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return {
    bytes,
    filename: buildZipFilename(input.base.icao, input.period),
    manifest,
  }
}

/** Trigger a browser download of a packaged export. Browser-only. */
export function downloadPackagedExport(pkg: PackagedExport): void {
  const blob = new Blob([pkg.bytes as unknown as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = pkg.filename
  a.click()
  URL.revokeObjectURL(url)
}
