import { describe, it, expect } from 'vitest'
import {
  WILDLIFE_SPEC,
  DAILY_REVIEWS_SPEC,
  type WildlifeExportRow,
  type DailyReviewExportRow,
} from '@/lib/export/export-table-specs'

describe('export-table-specs — Wildlife + Daily Reviews (2b-ii)', () => {
  describe('WILDLIFE_SPEC', () => {
    it('maps a sighting row with strike-only cells dashed', () => {
      const row: WildlifeExportRow = {
        date: '2026-05-02T13:00:00Z',
        species: 'Red-tailed Hawk',
        category: 'Bird',
        count: 1,
        kind: 'Sighting',
        location: 'RWY 04',
        observer: 'A1C Diaz',
        aircraft: null,
        damage: null,
      }
      expect(WILDLIFE_SPEC.toRow(row)).toEqual([
        '2026-05-02',
        'Red-tailed Hawk',
        'Bird',
        '1',
        'Sighting',
        'RWY 04',
        'A1C Diaz',
        '—',
        '—',
      ])
    })

    it('maps a strike row including aircraft + damage', () => {
      const row: WildlifeExportRow = {
        date: '2026-05-04T09:30:00Z',
        species: 'Canada Goose',
        category: 'Bird',
        count: 3,
        kind: 'Strike',
        location: 'TWY B',
        observer: 'Tower',
        aircraft: 'C-130',
        damage: 'Minor',
      }
      expect(WILDLIFE_SPEC.toRow(row)).toEqual([
        '2026-05-04',
        'Canada Goose',
        'Bird',
        '3',
        'Strike',
        'TWY B',
        'Tower',
        'C-130',
        'Minor',
      ])
    })

    it('dashes a strike with unknown species/category', () => {
      const row: WildlifeExportRow = {
        date: '2026-05-05T00:00:00Z',
        species: null,
        category: null,
        count: 1,
        kind: 'Strike',
        location: null,
        observer: 'AMOPS',
        aircraft: null,
        damage: 'None',
      }
      expect(WILDLIFE_SPEC.toRow(row)).toEqual([
        '2026-05-05',
        '—',
        '—',
        '1',
        'Strike',
        '—',
        'AMOPS',
        '—',
        'None',
      ])
    })

    it('uses the normalized date as the natural date', () => {
      const row = { date: '2026-05-02T13:00:00Z' } as WildlifeExportRow
      expect(WILDLIFE_SPEC.getDate(row)).toBe('2026-05-02T13:00:00Z')
    })
  })

  describe('DAILY_REVIEWS_SPEC', () => {
    it('maps a fully certified review with per-slot signers', () => {
      const row: DailyReviewExportRow = {
        review_date: '2026-05-02',
        day_amsl: 'SrA Lee',
        swing_amsl: 'SrA Vex',
        mid_amsl: 'A1C Roe',
        namo: 'TSgt Pat',
        afm: 'MSgt Kim',
        certified_at: '2026-05-03T07:10:00Z',
      }
      expect(DAILY_REVIEWS_SPEC.toRow(row)).toEqual([
        '2026-05-02',
        'SrA Lee',
        'SrA Vex',
        'A1C Roe',
        'TSgt Pat',
        'MSgt Kim',
        '2026-05-03 07:10Z',
      ])
    })

    it('dashes unsigned slots and an uncertified review', () => {
      const row: DailyReviewExportRow = {
        review_date: '2026-05-06',
        day_amsl: 'SrA Lee',
        swing_amsl: null,
        mid_amsl: null,
        namo: null,
        afm: null,
        certified_at: null,
      }
      expect(DAILY_REVIEWS_SPEC.toRow(row)).toEqual([
        '2026-05-06',
        'SrA Lee',
        '—',
        '—',
        '—',
        '—',
        '—',
      ])
    })

    it('uses review_date as the natural date', () => {
      const row = { review_date: '2026-05-02' } as DailyReviewExportRow
      expect(DAILY_REVIEWS_SPEC.getDate(row)).toBe('2026-05-02')
    })
  })
})
