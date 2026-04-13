# 08 — Visual NAVAIDs & Infrastructure

**Path:** Sidebar → Visual NAVAIDs · URL `/infrastructure`

The Visual NAVAIDs module is the interactive map of every lighting fixture, sign, and navigation aid at your installation. It's the largest module in the app (~4,000 lines of code) and combines map interaction, outage tracking, compliance analysis, and import/export tooling.

---

## Overview

Every airfield lighting and signage fixture lives here as a **feature** on a satellite map. Features have type (runway edge light, taxiway centerline, PAPI, sign, etc.), position, rotation, status, and optional links to higher-level components and systems.

Two major subsystems operate on this data:

1. **Outage Engine** — implements DAFMAN 13-204 Vol 2 Table A3.1. Calculates outage percentages and spatial patterns, flags conditions via a 4-tier alert system (Green / Yellow / Red / Black).
2. **Audit Mode** — admin tool for bulk operations: fixture ID generation, sequential labeling, bar group management, bulk delete.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Feature** | A single fixture — a light, sign, PAPI unit, etc. Has `feature_type` (one of 23), position, rotation, optional `component_id` and `system_id`. |
| **Feature type** | One of 23 predefined types (runway_edge_light, taxiway_centerline_light, PAPI, sign, etc.). The type drives the rendered icon. |
| **System** | A logical grouping of components (e.g., "RWY 18L Edge Lights"). |
| **Component** | A logical grouping of features within a system (e.g., one side of a runway's edge lights). |
| **Bar group** | Individual lights physically grouped into a bar (e.g., a 5-light threshold bar). Linked via `bar_group_id`. |
| **Fixture ID** | A human-readable identifier auto-generated as `{SystemPrefix}-{TypeAbbrev}-{###}` (e.g., `TWYK-TL-001`). Editable. |
| **Sign Text** | Editable text shown as a label on sign features on the map. |
| **Outage tier** | Green (healthy), Yellow (approaching threshold), Red (exceeded), Black (inop / no service). |
| **Bar-out** | When ≥3 consecutive lights in a bar are inop, treated as a reportable bar outage per DAFMAN 13-204 Vol 2 Table A3.1. |
| **Audit Mode** | A right-side panel for bulk editing. Mutually exclusive with edit mode. |
| **Edit Mode** | Single-feature editing (move, rotate, change type). |

---

## Layout

- **Map** fills the main area.
- **Header bar** with: map mode (edit / view / audit), layer toggles, outage color toggle, audit mode button, import button.
- **Lighting Status panel** — collapsible, shows outage tier summary (hidden by default).
- **System Health Panel** — expanded outage detail (opens from Lighting Status panel).
- **Legend** — 4 legend groups (Lights, Signs, Markings, Systems). All layers hidden on load; user enables what they need.

---

## How to see features on the map

1. Open Visual NAVAIDs.
2. All layers are hidden by default (performance optimization).
3. Open the **Legend** panel.
4. Toggle layers you want to see — by type group (Lights, Signs, Markings, Systems) or by location (a specific system).
5. Features render as icons at their coordinates.

### Layer groups in the legend

- **Lights** — runway edge, centerline, threshold, touchdown, approach lights, taxiway edge/centerline, stop bars, etc.
- **Signs** — all labeled signs. Sign text renders as the map label.
- **Systems** — grouped display by `system_id` (shows all features belonging to a system).

### Color by Health

Toggle **Color by Health** in the header to overlay outage rings on features: yellow ring = approaching threshold, red ring = exceeded/inop.

## How to see a feature's details

Tap (or click) the feature on the map. A popup shows:
- Fixture ID
- Type (human-readable)
- System / Component
- Status
- Last updated

---

## How to add a feature

1. Toggle **Edit Mode** (header).
2. Click **Add Feature** → select feature type.
3. Click the map to place it.
4. A popup lets you set Fixture ID, system, component, rotation.
5. Save.

## How to move a feature

1. Edit Mode on.
2. Click-and-drag the feature to its new position.
3. Release. Position saves.

## How to rotate a feature

1. Edit Mode on.
2. Click the feature. In the popup, change **Rotation (°)**.
3. Save. Icon rotates.

## How to change a feature's type

1. Edit Mode on.
2. Click the feature. In the popup, change **Type**.
3. Save. Icon updates to the new type.

Note: the type must be one of the 23 allowed values. Custom types require a code change.

## How to link a feature to a system and component

1. Edit Mode on → click feature.
2. Select **System** (drop-down). If empty, first create systems in Base Setup.
3. Select **Component** (drop-down, filtered by system).
4. Save.

Components drive the outage calculations and the System Health Panel.

## How to delete a feature

- Edit Mode → click feature → **Delete**.
- Or Audit Mode → bulk delete (see Audit Mode section below).

---

## How to report a NAVAID outage

1. Find the feature on the map.
2. Click it.
3. Popup → **Mark Out of Service**.
4. Confirm.
5. A discrepancy is auto-created with the feature linked, DAFMAN-formatted description, and CES-shop routing (based on type-to-shop mapping).
6. Feature status flips to Out of Service. Icon color changes (red).
7. Outage Engine re-evaluates Table A3.1 thresholds. Alert tier updates.

## How to mark a NAVAID operational

1. Click the feature.
2. Popup → **Mark Operational**.
3. You're prompted to close the linked discrepancy (with your OI and Zulu timestamp).
4. Confirm.
5. Feature flips to Operational. Outage re-evaluated.

## How to view the System Health Panel

1. Header → **Lighting Status** panel (collapsed by default).
2. Expand the panel.
3. Summary shows tier counts across all systems.
4. Tap a system row → opens the System Health Panel with:
   - Outage percentage (all component-level)
   - Per-component breakdown
   - Bar-level analysis (consecutive outage detection)
   - Outage timeline
   - Alert tier with applicable DAFMAN reference

---

## Audit Mode (admin bulk operations)

### How to enter Audit Mode

1. Header → **Audit Mode** toggle.
2. Right-side panel opens with bulk operation tools.
3. Edit Mode is disabled while Audit Mode is on (they're mutually exclusive).

### How to assign components in bulk

1. Audit Mode → **Assign Component** section.
2. Filter features (by type, missing component, etc.).
3. Select a component from the dropdown.
4. Click **Apply to N features**.

### How to generate sequential labels

1. Audit Mode → **Sequential Label** section.
2. Select features (filter, then select all in filter, or box-select).
3. Enter prefix + starting number.
4. Apply. Features get sequential labels like `A1`, `A2`, `A3`...

### How to generate Fixture IDs

1. Audit Mode → **Generate Fixture IDs**.
2. Filter or box-select the features that need IDs.
3. Click Generate. IDs populate as `{SystemPrefix}-{TypeAbbrev}-{###}`.

Manually edit an individual fixture ID via Edit Mode → feature popup.

### How to manage bar groups

Bar groups tie physical bars of lights together so count-based and spatial thresholds can be evaluated correctly.

1. Audit Mode → **Bar Groups** section.
2. **Create Bar Group** from a box-selected set of features.
3. Or **Link as Bar** via the context menu on a box-select.
4. Bulk rename bar groups as needed.
5. Delete bar groups (features remain, grouping is removed).

### How to bulk-delete features

1. Audit Mode → box-select the features to delete.
2. Click **Bulk Delete**.
3. Confirm.

---

## Box-select

1. Press **Esc** (or header button) to enter box-select.
2. Drag a rectangle over features.
3. Release. Every feature center inside the box is selected.
4. Shift+click adds or removes individual features.
5. Selected features are ringed in purple.
6. Use Audit Mode panel actions on the selection.

---

## How to import infrastructure data

1. Header → **Import**.
2. Choose format: **KML**, **CSV**, **GeoJSON**, or **DXF**.
3. Select your file.
4. Map columns / attributes to Glidepath fields (feature type, layer, rotation).
5. Preview — deduplication by coordinate removes exact-duplicate entries.
6. Confirm import.
7. Features are created in bulk via `bulkCreateInfrastructureFeatures()`.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| **Esc** | Toggle box-select |
| **Shift + click** | Toggle feature in multi-selection |
| **Delete** | Delete selection (confirmation) |
| **Ctrl + click** / **Long-press** | Open context menu |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Map is blank after opening | All layers hidden on load (by design) | Open Legend → enable a layer. |
| Feature won't drag | Edit Mode off, or Audit Mode on | Turn on Edit Mode; turn off Audit Mode. |
| Can't add a new type of feature | Type not in the 23-value check constraint | Contact support for a migration. |
| Imported features appeared at 0,0 | Coordinate mapping wrong in import preview | Re-import; verify X/Y or lat/lng columns. |
| Outage tier shows Green but you know one light is out | Feature not marked Out of Service, or not linked to a component | Mark OOS, and verify component linkage. |
| Bar-level analysis says "no bars" | No `bar_group_id` assigned to features | Audit Mode → create bar groups. |
| System Health Panel empty | No systems / components configured | Base Setup → configure systems and components first. |
| Outage ring not showing | "Color by Health" toggle off | Header → enable Color by Health. |
| Audit Mode Apply button disabled | No features selected or no filter applied | Select features first. |

---

## Related manual files

- [04_daily_inspections.md](04_daily_inspections.md) — Failed lighting inspection items auto-mark features Out of Service.
- [06_discrepancies.md](06_discrepancies.md) — Outages auto-create linked discrepancies.
- [09_parking.md](09_parking.md) — Shares ruler tool and similar map interaction patterns.
- [21_base_setup.md](21_base_setup.md) — NAVAID groups, systems, components, type-to-shop mapping.
