// Pure scale math for the Visual NAVAIDs map markers
// (docs/superpowers/specs/2026-07-13-navaid-marker-sizing-design.md).
// Signs render in three zoom stages: compact type-colored squares below
// SIGN_LABEL_MIN_ZOOM, uniform floor-height panels at working zooms, then
// ground-proportional growth up to a cap. Lights stay meter-true but are
// clamped to a readable on-screen diameter at both extremes.

/** Below this zoom signs render as compact squares, at/above as labeled panels. */
export const SIGN_LABEL_MIN_ZOOM = 17
/** Minimum sign panel height on screen — labels stay legible. */
export const SIGN_PANEL_FLOOR_PX = 12
/** Maximum sign panel height on screen — max zoom isn't cartoonish. */
export const SIGN_PANEL_CAP_PX = 44
/** Virtual ground height a sign panel tracks between the clamps. */
export const SIGN_PANEL_GROUND_METERS = 6
/** Side of the compact square markers used below SIGN_LABEL_MIN_ZOOM. */
export const COMPACT_SIGN_SIDE_PX = 10
/** True-to-ground light radius (unchanged from the original rendering). */
export const LIGHT_BASE_RADIUS_METERS = 1.5
/** On-screen light diameter clamps. */
export const LIGHT_MIN_DIAMETER_PX = 4
export const LIGHT_MAX_DIAMETER_PX = 12

/** setRadius no-op quantum — small zoom-settles produce identical radii. */
const LIGHT_RADIUS_QUANTUM_M = 0.05

/** Web-mercator ground resolution at a latitude and zoom. */
export function metersPerPixel(zoom: number, latDeg: number): number {
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom
}

/** Sign panel height for a zoom/latitude — ground-proportional, clamped. */
export function signPanelHeightPx(zoom: number, latDeg: number): number {
  const px = SIGN_PANEL_GROUND_METERS / metersPerPixel(zoom, latDeg)
  return Math.min(SIGN_PANEL_CAP_PX, Math.max(SIGN_PANEL_FLOOR_PX, px))
}

/**
 * Growth factor for non-sign icon markers (PAPIs, beacons, INOP rings…):
 * base size at wide zooms, tracking the same ground curve as sign panels,
 * spanning [1, SIGN_PANEL_CAP_PX / SIGN_PANEL_FLOOR_PX].
 */
export function markerScaleFactor(zoom: number, latDeg: number): number {
  return signPanelHeightPx(zoom, latDeg) / SIGN_PANEL_FLOOR_PX
}

export function showSignLabels(zoom: number): boolean {
  return zoom >= SIGN_LABEL_MIN_ZOOM
}

/**
 * Light circle radius in meters: true-to-ground in the middle band, clamped
 * so the on-screen diameter never leaves [LIGHT_MIN, LIGHT_MAX] px, then
 * quantized so consecutive near-identical zooms need no setRadius call.
 */
export function lightRadiusMeters(
  zoom: number,
  latDeg: number,
  baseRadiusM: number = LIGHT_BASE_RADIUS_METERS,
): number {
  const mpp = metersPerPixel(zoom, latDeg)
  const diameterPx = (2 * baseRadiusM) / mpp
  let radius = baseRadiusM
  if (diameterPx < LIGHT_MIN_DIAMETER_PX) radius = (LIGHT_MIN_DIAMETER_PX / 2) * mpp
  else if (diameterPx > LIGHT_MAX_DIAMETER_PX) radius = (LIGHT_MAX_DIAMETER_PX / 2) * mpp
  return Math.round(radius / LIGHT_RADIUS_QUANTUM_M) * LIGHT_RADIUS_QUANTUM_M
}
