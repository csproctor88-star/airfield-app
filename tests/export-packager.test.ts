import { describe, it, expect } from 'vitest'
import { sha256Hex, hashFiles, buildManifest, manifestToReadme } from '@/lib/export/export-manifest'
import { buildZipFilename, packageExport } from '@/lib/export/export-packager'
import type { ExportFile } from '@/lib/export/export-file'

const file = (path: string, text: string): ExportFile => ({ path, bytes: new TextEncoder().encode(text) })

describe('sha256Hex', () => {
  it('matches the known SHA-256 of empty input', async () => {
    expect(await sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('is stable for the same bytes', async () => {
    const a = await sha256Hex(new TextEncoder().encode('glidepath'))
    const b = await sha256Hex(new TextEncoder().encode('glidepath'))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })
})

describe('hashFiles', () => {
  it('returns entries sorted by path with sizes', async () => {
    const entries = await hashFiles([file('documents/B.pdf', 'bbb'), file('documents/A.pdf', 'a')])
    expect(entries.map((e) => e.path)).toEqual(['documents/A.pdf', 'documents/B.pdf'])
    expect(entries[0].bytes).toBe(1)
    expect(entries[1].bytes).toBe(3)
    expect(entries[0].sha256).toHaveLength(64)
  })
})

describe('buildZipFilename', () => {
  it('uses the ICAO and an all-time span', () => {
    expect(buildZipFilename('KTST', { kind: 'all_time' })).toBe('glidepath-records-KTST-all-time.zip')
  })
  it('uses the range span', () => {
    expect(buildZipFilename('KTST', { kind: 'range', from: '2026-01-01', to: '2026-03-31' }))
      .toBe('glidepath-records-KTST-2026-01-01_to_2026-03-31.zip')
  })
  it('falls back to BASE when ICAO is missing', () => {
    expect(buildZipFilename(null, { kind: 'all_time' })).toBe('glidepath-records-BASE-all-time.zip')
  })
})

describe('buildManifest + readme', () => {
  it('hashes content files and renders a readme with the key facts', async () => {
    const m = await buildManifest({
      files: [file('documents/Discrepancies.pdf', 'pdf-bytes')],
      generatedAt: '2026-05-30T12:00:00.000Z',
      generatedBy: 'MSgt Test',
      base: { name: 'Test AAF', icao: 'KTST' },
      period: { kind: 'range', from: '2026-01-01', to: '2026-03-31' },
      outputMode: 'aggregate',
      modules: [{ key: 'discrepancies', label: 'Discrepancies', files: 1, records: 5 }],
      gaps: [],
    })
    expect(m.files).toHaveLength(1)
    expect(m.files[0].sha256).toHaveLength(64)
    const readme = manifestToReadme(m)
    expect(readme).toContain('Test AAF (KTST)')
    expect(readme).toContain('2026-01-01 → 2026-03-31')
    expect(readme).toContain('Discrepancies')
    expect(readme).toContain(m.files[0].sha256)
    expect(readme).toContain('AMTR training records export from the AMTR module')
  })

  it('flags gap modules in the readme', async () => {
    const m = await buildManifest({
      files: [],
      generatedAt: '2026-05-30T12:00:00.000Z',
      base: { name: 'X', icao: null },
      period: { kind: 'all_time' },
      outputMode: 'aggregate',
      modules: [{ key: 'scn', label: 'SCN Tests', files: 0, records: 0 }],
      gaps: ['scn'],
    })
    expect(manifestToReadme(m)).toContain('no records in this window')
  })
})

describe('packageExport', () => {
  it('produces a non-empty blob, correct filename, and content-only manifest', async () => {
    const files = [file('documents/Discrepancies.pdf', 'pdf'), file('data/discrepancies.json', '[]')]
    const pkg = await packageExport({
      files,
      base: { name: 'Test AAF', icao: 'KTST' },
      period: { kind: 'all_time' },
      outputMode: 'aggregate',
      modules: [{ key: 'discrepancies', label: 'Discrepancies', files: 2, records: 1 }],
      gaps: [],
      generatedAt: '2026-05-30T12:00:00.000Z',
    })
    expect(pkg.filename).toBe('glidepath-records-KTST-all-time.zip')
    expect(pkg.bytes.length).toBeGreaterThan(0)
    // Manifest hashes the content files, not the derived cover/readme/manifest.
    expect(pkg.manifest.files.map((f) => f.path)).toEqual([
      'data/discrepancies.json',
      'documents/Discrepancies.pdf',
    ])
  })
})
