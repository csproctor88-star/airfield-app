// Records Export — manifest + integrity (Phase 4).
//
// Builds the tamper-evident manifest: a SHA-256 of every content file (sorted
// by path) plus per-module counts and gap notes. The cover PDF and README are
// rendered from this object, and manifest.json ships in the ZIP so a recipient
// can re-hash the files and verify nothing was altered after export.
import type { ExportFile } from './export-file'

export interface ManifestFileEntry {
  path: string
  bytes: number
  sha256: string
}

export interface ManifestModuleStat {
  key: string
  label: string
  /** Number of output files this module produced. */
  files: number
  /** Number of source records considered (after period filter where applicable). */
  records: number
}

export interface ExportManifest {
  generator: string
  generatedAt: string
  generatedBy: string | null
  base: { name: string | null; icao: string | null }
  period: { kind: string; from?: string; to?: string }
  outputMode: string
  modules: ManifestModuleStat[]
  /** Selected modules that produced zero files (empty in the window). */
  gaps: string[]
  files: ManifestFileEntry[]
}

const GENERATOR = 'Glidepath Records Export'

/** Hex SHA-256 of a byte array via Web Crypto (browser + Node ≥18). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Records Export: Web Crypto subtle is unavailable')
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Hash every file, returned sorted by path for a stable, comparable manifest. */
export async function hashFiles(files: ExportFile[]): Promise<ManifestFileEntry[]> {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const out: ManifestFileEntry[] = []
  for (const f of sorted) {
    out.push({ path: f.path, bytes: f.bytes.length, sha256: await sha256Hex(f.bytes) })
  }
  return out
}

export interface BuildManifestInput {
  files: ExportFile[]
  generatedAt: string
  generatedBy?: string | null
  base: { name: string | null; icao: string | null }
  period: { kind: string; from?: string; to?: string }
  outputMode: string
  modules: ManifestModuleStat[]
  gaps: string[]
}

export async function buildManifest(input: BuildManifestInput): Promise<ExportManifest> {
  return {
    generator: GENERATOR,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy ?? null,
    base: input.base,
    period: input.period,
    outputMode: input.outputMode,
    modules: input.modules,
    gaps: input.gaps,
    files: await hashFiles(input.files),
  }
}

function periodLabel(p: ExportManifest['period']): string {
  if (p.kind === 'all_time') return 'All time'
  return `${p.from ?? '…'} → ${p.to ?? '…'}`
}

/** Plain-text README equivalent of the audit cover, for `00-README.txt`. */
export function manifestToReadme(m: ExportManifest): string {
  const lines: string[] = []
  lines.push('GLIDEPATH RECORDS EXPORT')
  lines.push('========================')
  lines.push('')
  lines.push(`Base:         ${m.base.name ?? 'Unknown'}${m.base.icao ? ` (${m.base.icao})` : ''}`)
  lines.push(`Period:       ${periodLabel(m.period)}`)
  lines.push(`Output mode:  ${m.outputMode}`)
  lines.push(`Generated:    ${m.generatedAt}${m.generatedBy ? ` by ${m.generatedBy}` : ''}`)
  lines.push(`Generator:    ${m.generator}`)
  lines.push('')
  lines.push('WHAT THIS IS')
  lines.push('------------')
  lines.push('Standalone, reviewable records produced from Glidepath for Air Force')
  lines.push('records disposition and continuity. Each record series is a separate')
  lines.push('document so it can be filed per the AF Records Disposition Schedule')
  lines.push('(RDS, in AFRIMS). These files open in any standard tool — no server,')
  lines.push('no internet, no Glidepath account required.')
  lines.push('')
  lines.push('AMTR training records export from the AMTR module, not here.')
  lines.push('')
  lines.push('MODULES')
  lines.push('-------')
  for (const mod of m.modules) {
    const gap = m.gaps.includes(mod.key) ? '  (no records in this window)' : ''
    lines.push(`  ${mod.label.padEnd(26)} ${String(mod.records).padStart(5)} records → ${mod.files} file(s)${gap}`)
  }
  lines.push('')
  lines.push('INTEGRITY (SHA-256)')
  lines.push('-------------------')
  lines.push('Re-hash any file and compare to verify it has not been altered.')
  lines.push('')
  for (const f of m.files) {
    lines.push(`  ${f.sha256}  ${f.path}`)
  }
  lines.push('')
  return lines.join('\n')
}
