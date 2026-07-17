# 10 — Obstruction Evaluations

**Path:** Sidebar → Obstructions · Mobile bottom tab → Obstruction · URL `/obstructions`

The Obstruction Evaluation module implements UFC 3-260-01 Chapter 3 imaginary surface analysis. It tells you whether a proposed or observed object penetrates any runway's imaginary surface and produces a NOTAM-ready reference for the result.

---

## Overview

Every runway has a set of **imaginary surfaces** defined by UFC 3-260-01: approach/departure surfaces, transitional surfaces, inner horizontal, conical, and outer horizontal. Anything sticking up through any of these is an **obstruction** that needs evaluation, NOTAM action, and potentially waiver processing.

Glidepath evaluates the object against every runway at the installation using geodesic math from actual surveyed coordinates, not rounded headings. It pulls elevation from Google's Elevation API when available. Results include surface penetration determination, NOTAM-ready distance and bearing from the nearest threshold, and optional PDF export.

---

## Set-aware surface overlays

The obstruction map, its legend, and the evaluation header all follow the active surface standard rather than assuming UFC 3-260-01 everywhere. USAF airfields evaluate against UFC 3-260-01 by default; civilian Part 139 airports evaluate against FAA Part 77 (14 CFR §77.19). Either can be overridden for a single evaluation with the Surface Set picker on the New Evaluation form, which is useful for a what-if comparison before committing to a change. Part 77 overlays are dimensioned per runway by that runway's FAA approach type, configured in Base Setup → Runways.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Imaginary surface** | UFC 3-260-01-defined airspace surface that must be kept clear of obstructions. Five types evaluated. |
| **Approach / Departure** | Surface sloping up from each runway end. |
| **Transitional** | Sloping surface on the sides of runway. |
| **Inner Horizontal** | Flat surface at airport elevation + 150 ft within a defined radius. |
| **Conical** | Sloping up from the inner horizontal outward. |
| **Outer Horizontal** | Flat surface at airport elevation + 500 ft. |
| **Penetration** | The object extends above the surface. Reported in feet of penetration. |
| **TDG (Taxiway Design Group)** | FAA taxiway classification (1–7) based on aircraft dimensions, used for OFA/Safety Area clearance. |
| **UFC Class A/B** | UFC taxiway clearance line classifications. |
| **NOTAM Reference** | Distance (NM) and bearing from nearest threshold, formatted for direct NOTAM entry. |

---

## How to evaluate an obstruction

1. Open Obstructions.
2. Click **+ New Evaluation**.
3. Set the obstruction:
   - **Location** — click the map to pin it, or enter lat/lng / GPS coordinates directly.
   - **Height Above Ground (AGL)** in feet.
   - **Name / description** (e.g., "crane at building 203," "new antenna mast").
4. (Optional) Set the object type from the dropdown.
5. Click **Evaluate**.
6. The system:
   - Fetches ground elevation from Google Elevation API.
   - Computes object peak elevation (MSL) = ground + AGL.
   - Runs the object against every runway's imaginary surfaces.
   - Reports penetration results.

## How to interpret results

The results panel shows, per runway:
- Each imaginary surface checked
- Whether the object penetrates that surface (Yes/No)
- Margin — how much clearance below (or penetration above) the surface
- The surface height at the object's horizontal position

Color-coded:
- **Green** — clear (object well below surface)
- **Amber** — marginal (within X ft of surface)
- **Red** — penetration (object above surface)

The **NOTAM Reference** section shows distance (NM) and bearing from the nearest runway threshold, ready for NOTAM issuance.

## How to set object coordinates via GPS

1. From the device with GPS enabled.
2. In the new evaluation form, tap **Use Current Location**.
3. Accept the browser's location prompt.
4. Lat/lng auto-fill from GPS.

## How to type coordinates

Instead of tapping the map, type a point into the **Enter coordinates** field beneath the map and press **Place Pin** (or Enter). The field auto-detects the notation as you type — decimal degrees (`42.60522, -82.82047`), degrees-minutes-seconds (`42°36'19"N 082°49'13"W`), degrees-decimal-minutes (`42 36.31N 082 49.23W`), MGRS (`17TLG1234567890`), and the packed obstacle-NOTAM form (`423619N0824913W`) are all accepted. A live preview line under the field confirms the detected format and the normalized decimal-degrees value before you commit. Once placed, the map pans and the pin drops exactly as with a map tap, and elevation, surface analysis, and the NOTAM reference all follow. If the point lands more than 30 NM from the airfield, an advisory warning appears to help you catch a hemisphere or format slip — it never blocks the evaluation.

## How to save an evaluation

1. After evaluating, click **Save Evaluation**.
2. The evaluation is stored with all inputs, outputs, and timestamp.
3. It appears on the Obstructions list page and on the obstruction history map.

## How to export an evaluation to PDF

1. Open a saved evaluation.
2. Click **Export PDF**.
3. The PDF includes:
   - Object details (coordinates, elevation, AGL)
   - Per-runway results (every imaginary surface)
   - Map snapshot with object pin and runway centerlines
   - NOTAM reference text
4. Click **Email PDF** to route through the Email PDF modal.

---

## Taxiway clearance envelopes

The obstruction map also renders taxiway clearance envelopes so you can evaluate objects near taxiways.

### How to toggle envelopes

1. Map legend → **Taxiway Clearance** layer (hidden by default; re-enable via legend).
2. Two standards:
   - **FAA** — TDG-based OFA + Safety Area
   - **UFC** — Class A/B Clearance Line
3. Choose the standard in the settings panel.

### How to check if an object penetrates a taxiway envelope

1. Click an object (or the map at the object's location) with envelopes visible.
2. The evaluation results include a "taxiway clearance" section listing any taxiway envelopes the object touches.

---

## Obstruction history map

All saved evaluations render together on an **Obstruction History** map for trend visibility.

### How to open history

1. Obstructions list → **History View** button (or map icon).
2. Every saved evaluation's object appears as a pin.
3. Color coding by penetration severity.
4. Tap a pin → opens that evaluation's detail.

---

## Ruler tool

Use to measure distance between any two points on the map.

1. Header → **Ruler** button.
2. Click two points.
3. Distance (ft and m) and bearing (°) display.
4. Toggle ruler off when done.

Shared with Parking.

---

## Satellite imagery alignment

Google satellite tiles have a typical ~10–30 ft georegistration offset from surveyed GPS coordinates. A disclaimer appears on the obstruction map noting this. Obstruction evaluations use **surveyed runway coordinates** for calculations, not imagery — but the imagery you see may not exactly align with the runway centerlines shown.

---

## Keyboard shortcuts

None specific to Obstructions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Elevation not populating | Google Elevation API unreachable from the server, or key not configured | Admin: verify `GOOGLE_ELEVATION_API_KEY` env var on server. |
| Results say "no runways evaluated" | Installation has no runways configured | Base Setup → configure runways. |
| Runway overlay misaligned with satellite imagery | Google tile georegistration offset | Expected; rely on runway coordinates, not imagery. |
| Taxiway envelope not appearing | Envelope layer not enabled, or taxiway coordinates missing | Legend → enable; Base Setup → add taxiway centerlines. |
| NOTAM Reference blank | Distance too far from any threshold (>50 NM), or runway geometry error | Verify runway coordinates; object may be outside the notam scope. |
| Evaluation shows penetration at object below surface height | Wrong AGL entered, or ground elevation API returned wrong value | Re-check inputs; try a manual elevation override. |

---

## Related manual files

- [09_parking.md](09_parking.md) — Shares ruler tool and map interaction.
- [15_notams.md](15_notams.md) — Obstructions often generate NOTAMs.
- [14_waivers.md](14_waivers.md) — Unresolved obstructions may require waivers.
- [21_base_setup.md](21_base_setup.md) — Runway and taxiway configuration.
