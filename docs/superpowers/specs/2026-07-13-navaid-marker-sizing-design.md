# Visual NAVAIDs Marker Sizing — Design

**Date:** 2026-07-13
**Status:** Approved by owner (chat), implementation same session
**Surface:** `app/(app)/infrastructure/page.tsx` map rendering (signs + lights)

## Problem

1. **Signs scale inconsistently.** Every labeled sign's source panel is a
   constant 56px tall (width from its label), but rotation is baked into
   the registered image, and `markerBaseSize` applies its 12px floor to
   the *rotated bounding box's* shorter side. A short unrotated "L" gets
   inflated to the floor while a long rotated "1-19" doesn't — at max
   zoom the "L" panel renders taller than the "1-19" panel.
2. **Signs fake-overlap at working zooms.** Signs render at a fixed pixel
   size at zoom ≤16 (then grow 2×/level, capped 4×), regardless of ground
   scale. Two signs 5 m apart are a few screen px apart at zoom 15 while
   the markers are 30–60px wide. Only at max zoom does the ground outgrow
   the capped markers.
3. **Lights** are true-to-ground 1.5 m Circles: invisible dots zoomed
   out, ~40px blobs at max zoom.

## Owner decisions

- Three-stage sign behavior approved: compact squares below zoom 17 →
  uniform floor-size panels 17–18 → ground-proportional growth 19+.
- Lights: clamp both ends (≥ ~4px, ≤ ~12px on-screen diameter).

## Design

### 1. New pure module — `lib/infrastructure/marker-scale.ts` (TDD'd)

```ts
metersPerPixel(zoom, latDeg)          // 156543.03392·cos(lat)/2^zoom
signPanelHeightPx(zoom, latDeg)       // clamp(GROUND_M/mpp, FLOOR, CAP)
markerScaleFactor(zoom, latDeg)       // signPanelHeightPx/FLOOR ∈ [1, CAP/FLOOR]
showSignLabels(zoom)                  // zoom >= SIGN_LABEL_MIN_ZOOM
lightRadiusMeters(zoom, latDeg)       // radius clamped so screen diameter ∈ [MIN,MAX]
```

Named dials (one-line tuning after preview):

| Constant | Value | Meaning |
|---|---|---|
| `SIGN_LABEL_MIN_ZOOM` | 17 | below → compact squares, at/above → labeled panels |
| `SIGN_PANEL_FLOOR_PX` | 12 | minimum panel height (readability) |
| `SIGN_PANEL_CAP_PX` | 44 | maximum panel height |
| `SIGN_PANEL_GROUND_METERS` | 6 | virtual ground height a panel tracks |
| `COMPACT_SIGN_SIDE_PX` | 10 | compact square side |
| `LIGHT_BASE_RADIUS_METERS` | 1.5 | true-to-ground radius (unchanged) |
| `LIGHT_MIN_DIAMETER_PX` / `LIGHT_MAX_DIAMETER_PX` | 4 / 12 | screen clamp |

Worked curve at KDMO (lat ≈ 38.7°, mpp ≈ 122166/2^z m/px):
zoom 17 → 6.4px → floor 12 · zoom 18 → ~13px · zoom 19 → ~26px ·
zoom 20 → 51px → cap 44. Lights: true size between z≈17.3 and z≈18.9,
clamped outside. `lightRadiusMeters` quantizes to 0.05 m so small
zoom-settles are set-radius no-ops.

### 2. Uniform panel height

`createLabeledSign` additionally returns the **unrotated panel** dims
(w,h); `registerLabeledSigns` records them in a ref map keyed by image
name (graphic signs record their square side). Sign display size becomes
`bbox × (signPanelHeightPx / panelH)` — every sign has the identical
panel height at a given zoom; rotation only tilts the box. The old
`SIGN_DISPLAY_SCALE`, `SIGN_MIN_SIDE`, `markerZoomFactor`,
`MARKER_REF_ZOOM`, `MARKER_MAX_GROWTH` die.

### 3. Zoom-staged sign rendering

- **Compact stage (zoom < 17):** sign features render the already-
  registered generic type icons (`icon-location-sign`,
  `icon-directional-sign`, `icon-informational-sign`,
  `icon-mandatory-sign`, `icon-runway-distance-marker`) at
  `COMPACT_SIGN_SIDE_PX`. The two graphic types (AGM, do-not-enter) render
  their own per-feature image scaled to the compact side — their glyphs
  read fine at 10px.
- **Panel stage (zoom ≥ 17):** per-feature labeled/graphic image at the
  normalized panel scale.
- `markerMetaRef` meta gains `compactKey` (generic icon name or the
  per-feature graphic key) alongside `signKey` so the idle handler can
  switch stages on existing markers — the marker-reuse path must apply
  visual-state changes itself (2026-06 render-fast-path lesson).

### 4. Idle rescale handler (rewrite of the existing one)

On map `idle`: compute `zoom`, center `lat`, then `panelH`, `factor`,
`labelStage`, `lightR`. Single guard — if all four match the previous
settle, return. Otherwise:

- Sign markers: stage-appropriate icon + size (`setIcon` with url,
  scaledSize, centered anchor — as today).
- INOP rings: `ringBase × factor` (unchanged mechanism, new factor fn).
- Other icon markers (PAPIs, beacons, thresholds, windcones…):
  `base × factor` — smooth ground-tracking growth in the same 1–3.7×
  range today's 1–4× bucket growth covered.
- Light Circles: `setRadius(lightR)` only when the quantized radius
  changed — one pass over ~1,300 native Circles per zoom-settle at most,
  no per-frame work, preserving gov-hardware zoom smoothness.

The creation path (`renderFeatures`) uses the same functions so first
paint matches whatever zoom the map is at.

## Non-goals

- No collision detection / spiderfying: co-located features (a sign
  array entered as two features at one point) still overlap at any zoom —
  that is ground truth, not fake overlap.
- No changes to layer toggles, legend, popups, Edit/Audit modes, or the
  status-flag fast path beyond carrying the new meta.
- Lights keep their color/status styling; only radius policy changes.

## Per-file changes

| File | Change |
|---|---|
| `lib/infrastructure/marker-scale.ts` | New — constants + 5 pure functions |
| `tests/marker-scale.test.ts` | New — TDD'd red-first |
| `app/(app)/infrastructure/page.tsx` | `createLabeledSign` returns panel dims; registration records them; creation path stage/size logic; idle handler rewrite; light radius clamp; dead constants removed |

## Test plan

`tests/marker-scale.test.ts`: mpp halves per zoom level and shrinks with
latitude; panel height floors/caps at the worked-curve zooms and is
monotonic between; `markerScaleFactor` spans exactly [1, CAP/FLOOR];
`showSignLabels` boundary at 17; light radius true in the middle band,
clamped at both ends, quantized to 0.05 m.
