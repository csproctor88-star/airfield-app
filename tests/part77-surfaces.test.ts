import { describe, it, expect } from 'vitest'
import {
  PART77_SURFACES,
  IMAGINARY_SURFACES,
  getSurfaces,
} from '@/lib/calculations/obstructions'

describe('Part 77 imaginary surfaces', () => {
  it('exports the 5 §77.19 surfaces with the correct keys', () => {
    expect(Object.keys(PART77_SURFACES).sort()).toEqual([
      'approach', 'conical', 'horizontal', 'primary', 'transitional',
    ])
  })

  it('primary surface defaults to larger-than-utility non-precision width', () => {
    // 14 CFR §77.19(a): width depends on runway category. Default is the
    // common Class III/IV non-hub commercial case: 500 ft half-width
    // (1,000 ft total) with the 200 ft beyond-runway extension.
    expect(PART77_SURFACES.primary.criteria.halfWidth).toBe(500)
    expect(PART77_SURFACES.primary.criteria.extension).toBe(200)
  })

  it('approach surface slope and length match larger-than-utility non-precision <3/4 mi vis', () => {
    expect(PART77_SURFACES.approach.criteria.slope).toBe(34)
    expect(PART77_SURFACES.approach.criteria.length).toBe(10000)
    expect(PART77_SURFACES.approach.criteria.innerHalfWidth).toBe(500)
    expect(PART77_SURFACES.approach.criteria.outerHalfWidth).toBe(2000)
  })

  it('horizontal surface is 150 ft above airport elevation at 10,000 ft radius', () => {
    expect(PART77_SURFACES.horizontal.criteria.height).toBe(150)
    expect(PART77_SURFACES.horizontal.criteria.radius).toBe(10000)
  })

  it('conical surface is 20:1 slope, 4,000 ft horizontal extent', () => {
    expect(PART77_SURFACES.conical.criteria.slope).toBe(20)
    expect(PART77_SURFACES.conical.criteria.horizontalExtent).toBe(4000)
    expect(PART77_SURFACES.conical.criteria.baseHeight).toBe(150)
  })

  it('transitional surface is 7:1 (same slope as UFC)', () => {
    expect(PART77_SURFACES.transitional.criteria.slope).toBe(7)
    expect(PART77_SURFACES.transitional.criteria.primaryHalfWidth).toBe(500)
  })

  it('every surface cites 14 CFR §77.19 (FAA authority, not UFC)', () => {
    for (const s of Object.values(PART77_SURFACES)) {
      expect(s.ufcRef).toMatch(/§77\.19/)
    }
  })
})

describe('getSurfaces(set)', () => {
  it('defaults to UFC', () => {
    expect(getSurfaces()).toBe(IMAGINARY_SURFACES)
  })

  it('returns UFC for ufc_3_260_01', () => {
    expect(getSurfaces('ufc_3_260_01')).toBe(IMAGINARY_SURFACES)
  })

  it('returns Part 77 for faa_part77', () => {
    expect(getSurfaces('faa_part77')).toBe(PART77_SURFACES)
  })

  it('Part 77 differs from UFC numerically on shared surfaces', () => {
    // Approach slope: UFC 50:1, Part 77 (LTU non-precision) 34:1
    expect(IMAGINARY_SURFACES.approach_departure.criteria.slope).toBe(50)
    expect(PART77_SURFACES.approach.criteria.slope).toBe(34)
    // Conical extent: UFC 7,000 ft, Part 77 4,000 ft
    expect(IMAGINARY_SURFACES.conical.criteria.horizontalExtent).toBe(7000)
    expect(PART77_SURFACES.conical.criteria.horizontalExtent).toBe(4000)
    // Primary half-width: UFC 1,000 ft, Part 77 (LTU non-precision) 500 ft
    expect(IMAGINARY_SURFACES.primary.criteria.halfWidth).toBe(1000)
    expect(PART77_SURFACES.primary.criteria.halfWidth).toBe(500)
  })
})
