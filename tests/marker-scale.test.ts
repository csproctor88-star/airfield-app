import { describe, it, expect } from 'vitest'
import {
  metersPerPixel,
  signPanelHeightPx,
  markerScaleFactor,
  showSignLabels,
  lightRadiusMeters,
  SIGN_LABEL_MIN_ZOOM,
  SIGN_PANEL_FLOOR_PX,
  SIGN_PANEL_CAP_PX,
  LIGHT_BASE_RADIUS_METERS,
  LIGHT_MIN_DIAMETER_PX,
  LIGHT_MAX_DIAMETER_PX,
} from '@/lib/infrastructure/marker-scale'

const LAT = 38.7 // KDMO-ish

describe('metersPerPixel', () => {
  it('halves with each zoom level', () => {
    const z16 = metersPerPixel(16, LAT)
    const z17 = metersPerPixel(17, LAT)
    expect(z16 / z17).toBeCloseTo(2, 6)
  })

  it('shrinks with latitude (cos factor)', () => {
    expect(metersPerPixel(16, 60)).toBeLessThan(metersPerPixel(16, 0))
  })

  it('matches the web-mercator constant at the equator', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03392, 3)
  })
})

describe('signPanelHeightPx', () => {
  it('sits at the floor at the label threshold zoom', () => {
    expect(signPanelHeightPx(SIGN_LABEL_MIN_ZOOM, LAT)).toBe(SIGN_PANEL_FLOOR_PX)
  })

  it('caps at very high zoom', () => {
    expect(signPanelHeightPx(21, LAT)).toBe(SIGN_PANEL_CAP_PX)
  })

  it('is monotonically non-decreasing in zoom', () => {
    let prev = 0
    for (let z = 14; z <= 22; z += 0.5) {
      const h = signPanelHeightPx(z, LAT)
      expect(h).toBeGreaterThanOrEqual(prev)
      prev = h
    }
  })

  it('is ground-proportional between the clamps', () => {
    // zoom 19 at this latitude sits between floor and cap on the worked curve
    const h = signPanelHeightPx(19, LAT)
    expect(h).toBeGreaterThan(SIGN_PANEL_FLOOR_PX)
    expect(h).toBeLessThan(SIGN_PANEL_CAP_PX)
  })
})

describe('markerScaleFactor', () => {
  it('is 1 at/below the threshold zoom and spans to CAP/FLOOR', () => {
    expect(markerScaleFactor(15, LAT)).toBe(1)
    expect(markerScaleFactor(22, LAT)).toBeCloseTo(SIGN_PANEL_CAP_PX / SIGN_PANEL_FLOOR_PX, 6)
  })
})

describe('showSignLabels', () => {
  it('flips exactly at the threshold', () => {
    expect(showSignLabels(SIGN_LABEL_MIN_ZOOM - 0.01)).toBe(false)
    expect(showSignLabels(SIGN_LABEL_MIN_ZOOM)).toBe(true)
  })
})

describe('lightRadiusMeters', () => {
  it('returns the true radius in the middle band', () => {
    // zoom 18 at this latitude: 1.5 m renders between the px clamps
    expect(lightRadiusMeters(18, LAT)).toBeCloseTo(LIGHT_BASE_RADIUS_METERS, 2)
  })

  it('clamps up when zoomed out so the light stays visible', () => {
    const r = lightRadiusMeters(14, LAT)
    expect(r).toBeGreaterThan(LIGHT_BASE_RADIUS_METERS)
    const diameterPx = (2 * r) / metersPerPixel(14, LAT)
    expect(diameterPx).toBeCloseTo(LIGHT_MIN_DIAMETER_PX, 0)
  })

  it('clamps down at max zoom so lights are not blobs', () => {
    const r = lightRadiusMeters(21, LAT)
    expect(r).toBeLessThan(LIGHT_BASE_RADIUS_METERS)
    const diameterPx = (2 * r) / metersPerPixel(21, LAT)
    expect(diameterPx).toBeCloseTo(LIGHT_MAX_DIAMETER_PX, 0)
  })

  it('quantizes so tiny zoom-settles are no-ops', () => {
    const r = lightRadiusMeters(14, LAT)
    expect(Math.round(r / 0.05)).toBeCloseTo(r / 0.05, 6)
  })

  it('respects a per-layer base radius in the middle band', () => {
    // Taxiway lights run 2.0 m; at zoom 18 that is still inside the px clamps.
    expect(lightRadiusMeters(18, LAT, 2.0)).toBeCloseTo(2.0, 2)
    // …and the zoomed-out clamp is the same regardless of base radius.
    expect(lightRadiusMeters(14, LAT, 2.0)).toBeCloseTo(lightRadiusMeters(14, LAT), 3)
  })
})
