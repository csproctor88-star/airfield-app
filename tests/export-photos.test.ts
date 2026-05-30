import { describe, it, expect } from 'vitest'
import { planPhotos, photosIndexCsv, downloadPhotos, type PhotoRow } from '@/lib/export/export-photos'

function photo(p: Partial<PhotoRow>): PhotoRow {
  return {
    id: 'p1', storage_path: 'discrepancies/x/p1.jpg', file_name: 'p1.jpg',
    captured_at: '2026-05-02T13:00:00Z', latitude: null, longitude: null, uploaded_by: null,
    discrepancy_id: null, check_id: null, inspection_id: null, acsi_inspection_id: null,
    wildlife_sighting_id: null, wildlife_strike_id: null,
    ...p,
  }
}

const allTime = { kind: 'all_time' as const }

describe('planPhotos', () => {
  it('routes a discrepancy photo to photos/Discrepancies/<display>/<date>_<file>', () => {
    const rows = [photo({ id: 'a', discrepancy_id: 'd1', file_name: 'crack.jpg', storage_path: 'd/a.jpg' })]
    const planned = planPhotos(rows, { selectedKeys: ['discrepancies'], period: allTime, resolver: { discrepancies: { d1: 'DSC-1042' } } })
    expect(planned).toHaveLength(1)
    expect(planned[0].path).toBe('photos/Discrepancies/DSC-1042/2026-05-02_crack.jpg')
    expect(planned[0].storagePath).toBe('d/a.jpg')
    expect(planned[0].module).toBe('discrepancies')
  })

  it('falls back to the raw UUID prefix when the display id is unresolved', () => {
    const rows = [photo({ id: 'a', discrepancy_id: 'abcdef12-0000', file_name: 'x.jpg' })]
    const planned = planPhotos(rows, { selectedKeys: ['discrepancies'], period: allTime })
    expect(planned[0].path).toBe('photos/Discrepancies/abcdef12-0000/2026-05-02_x.jpg')
  })

  it('drops photos whose module is not selected', () => {
    const rows = [photo({ discrepancy_id: 'd1' })]
    expect(planPhotos(rows, { selectedKeys: ['checks'], period: allTime })).toEqual([])
  })

  it('filters by captured_at against a date range', () => {
    const rows = [
      photo({ id: 'a', discrepancy_id: 'd1', captured_at: '2026-01-10T00:00:00Z', file_name: 'jan.jpg' }),
      photo({ id: 'b', discrepancy_id: 'd1', captured_at: '2026-02-10T00:00:00Z', file_name: 'feb.jpg' }),
    ]
    const planned = planPhotos(rows, { selectedKeys: ['discrepancies'], period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' } })
    expect(planned.map((p) => p.fileName)).toEqual(['feb.jpg'])
  })

  it('de-collides duplicate paths with a numeric suffix', () => {
    const rows = [
      photo({ id: 'a', check_id: 'c1', file_name: 'fod.jpg' }),
      photo({ id: 'b', check_id: 'c1', file_name: 'fod.jpg' }),
    ]
    const planned = planPhotos(rows, { selectedKeys: ['checks'], period: allTime, resolver: { checks: { c1: 'AC-1' } } })
    expect(planned.map((p) => p.path)).toEqual([
      'photos/Checks/AC-1/2026-05-02_fod.jpg',
      'photos/Checks/AC-1/2026-05-02_fod-2.jpg',
    ])
  })

  it('routes both sighting and strike photos to Wildlife', () => {
    const rows = [
      photo({ id: 'a', wildlife_sighting_id: 's1', file_name: 's.jpg' }),
      photo({ id: 'b', wildlife_strike_id: 'x1', file_name: 'x.jpg' }),
    ]
    const planned = planPhotos(rows, { selectedKeys: ['wildlife'], period: allTime, resolver: { wildlife: { s1: 'WS-1', x1: 'WX-1' } } })
    expect(planned.map((p) => p.path).sort()).toEqual([
      'photos/Wildlife/WS-1/2026-05-02_s.jpg',
      'photos/Wildlife/WX-1/2026-05-02_x.jpg',
    ])
  })
})

describe('photosIndexCsv', () => {
  it('emits a header + one row per planned photo, quoting commas', () => {
    const planned = planPhotos(
      [photo({ id: 'a', discrepancy_id: 'd1', file_name: 'a,b.jpg', latitude: 42.6, longitude: -82.8, uploaded_by: 'u1' })],
      { selectedKeys: ['discrepancies'], period: allTime, resolver: { discrepancies: { d1: 'DSC-1' } } },
    )
    const csv = photosIndexCsv(planned)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('path,module,record,captured_at,latitude,longitude,uploaded_by,original_file_name')
    expect(lines[1]).toContain('"a,b.jpg"')
    expect(lines[1]).toContain('42.6')
    expect(lines[1]).toContain('DSC-1')
  })
})

describe('downloadPhotos', () => {
  it('fetches each photo, records failures, and always appends the index CSV', async () => {
    const planned = planPhotos(
      [
        photo({ id: 'ok', discrepancy_id: 'd1', file_name: 'ok.jpg', storage_path: 'good.jpg' }),
        photo({ id: 'bad', discrepancy_id: 'd1', file_name: 'bad.jpg', storage_path: 'missing.jpg' }),
      ],
      { selectedKeys: ['discrepancies'], period: allTime, resolver: { discrepancies: { d1: 'DSC-1' } } },
    )
    // Stub fetch: good.jpg → 3 bytes, missing.jpg → 404.
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('good.jpg')) {
        return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Response
      }
      return { ok: false, status: 404 } as unknown as Response
    }) as typeof fetch

    try {
      const result = await downloadPhotos(planned, { urlFor: (p) => `https://x/${p}`, maxAttempts: 2 })
      // one downloaded image + the index csv
      const paths = result.files.map((f) => f.path).sort()
      expect(paths).toContain('photos/photos-index.csv')
      expect(paths.some((p) => p.endsWith('ok.jpg'))).toBe(true)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].reason).toBe('HTTP 404')
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
