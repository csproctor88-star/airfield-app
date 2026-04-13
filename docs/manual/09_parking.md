# 09 — Aircraft Parking Plans

**Path:** Sidebar → Operations → Parking Plans · URL `/parking`

Parking Plans is where you lay out aircraft on a ramp or apron to-scale on a satellite map, with live UFC 3-260-01 clearance analysis, obstacle and taxilane modeling, and PDF export. This is the most feature-dense module in Glidepath — if you only read one manual file, read this one.

---

## Overview

A **Plan** is a named collection of aircraft positions, obstacles, taxilanes, and apron boundaries on a specific installation's map. You can have many plans at once (e.g., "Air Show 2026," "Wing Exercise," "Winter Storm Relocation"). One plan at a time can be marked **Active** to advertise it as the currently-in-effect plan, but all plans persist in the database until you delete them.

A **Template** is a plan flagged with `is_template = true`. It behaves like a plan but is grouped separately in the plan selector dropdown. Duplicating a template produces a new plan you can edit freely without disturbing the template itself.

The parking map is drawn on **Google Maps satellite imagery** (the entire app uses Google Maps — only the Wildlife heatmap still uses Mapbox). Silhouettes are rendered as rotated canvas images scaled to real-world wingspan and length via a bounds-based icon-scale calculation that re-runs on every zoom change.

---

## Key Concepts

| Concept | What you need to know |
|---|---|
| **Nose-gear position** | Aircraft are anchored at their nose gear coordinates, not their center. The body extends rearward based on the aircraft's fuselage length and pivot-point offset. This matches how a crew chief marshals the aircraft to a spot. |
| **Heading (degrees)** | 0° = nose pointing north; 90° = east; 180° = south; 270° = west. A heading input field accepts any integer 0–360. |
| **Wingspan & length** | Pulled from the Aircraft Database when you select an aircraft type. Do not edit these directly — if the silhouette is wrong, fix the Aircraft Database entry instead. |
| **Clearance** | Wingtip-to-wingtip separation required by UFC 3-260-01. The default is computed from wingspan and apron context. You can override per-aircraft with 10 ft, 15 ft, 25 ft, or "UFC" (recompute from table). |
| **Apron context** | A single setting that determines which UFC table row applies to *the whole plan*. Choices: Parking, Transient, KC Refuel, Interior Taxilane, Peripheral Taxilane, Peripheral Transient. |
| **Taxilane envelope** | A translucent band around a taxilane polyline showing the clearance zone. Half-width = 0.5 × design wingspan + UFC clearance. |
| **Obstacle** | A point, building (rotated rectangle), circle, or line that aircraft must clear. Obstacles can be locked (drag disabled) or unlocked. |
| **Apron boundary** | A named polygon used for visual reference only. Does not affect clearance calculations. |
| **Plan Locked** | When toggled, aircraft drag is disabled for the whole plan. Use this to "freeze" a finalized plan so it isn't accidentally moved. |

---

## Layout

- **Map** fills the main area.
- **Sidebar** (collapsible on desktop, bottom sheet on mobile) has four tabs:
  - **Aircraft** — plan selector, add aircraft button, box-select toggle, multi-select operations, aircraft list grouped by type.
  - **Environment** — obstacles, taxilanes, apron boundaries.
  - **Clearance** — filtered list of all clearance results (violations, warnings, ok).
  - **Settings** — plan name, template flag, apron context, lock toggles, PDF export, silhouette disclaimer.
- **Header** shows the plan selector and Active badge.

Tap the sidebar tabs to switch. The sidebar can be collapsed for more map room, and Space toggles fullscreen.

---

## How to create a plan

1. Open Parking Plans.
2. In the plan selector (top of sidebar on the Aircraft tab), choose **No Plan Selected → + New Plan** (or the dedicated "+ New Plan" button).
3. Enter a **name**. Optional: description. Optional: check **Template** to save it as a template instead of a live plan.
4. Click **Create**.
5. The new plan is selected automatically. If it isn't a template, the map opens centered on your installation's airfield coordinates.

## How to switch plans

- Open the plan selector dropdown at the top of the sidebar.
- Plans and Templates are grouped into optgroups.
- Select one — the map and sidebar refresh to show that plan's contents.

## How to mark a plan Active

A plan is **Active** when it is the currently-in-effect plan for the installation. Only one plan can be Active at a time.

1. With the plan selected, go to the **Settings** tab.
2. Toggle **Mark as Active**. The previously Active plan becomes inactive.
3. The Active badge appears in the header.

Active status is informational (surfaced on the dashboard and PDF header); it does not restrict editing.

## How to save a plan as a template (or convert back)

1. Select the plan.
2. Settings tab → **Save as Template** (or **Convert to Plan**).
3. The plan flips between the Plans and Templates optgroups.

Templates cannot be Active. If you toggle a plan to a template while it was Active, the Active flag is cleared.

## How to duplicate a plan or template

1. Select the source plan (or template).
2. Click **Duplicate** in the Settings tab.
3. Enter a new **name** and optional description. Check **Save as template** if you want the duplicate to be a template.
4. Click **Duplicate**.
5. The duplicate is selected automatically and contains a deep copy of every spot, obstacle, taxilane, and boundary from the source.

**Tip:** Build a template once per common configuration (e.g., "Air Show Static Display," "Heavy Wx Hangar Relocation"), and duplicate it when you need a working plan.

## How to delete a plan

1. Select the plan.
2. Settings tab → **Delete Plan**.
3. Confirm at the prompt.
4. All aircraft, obstacles, taxilanes, and boundaries in the plan are removed.

Deleting an Active plan clears the Active flag — the installation no longer has an Active plan until you mark another.

---

## Aircraft

### How to add one aircraft

1. With a plan selected, Aircraft tab → **+ Add Aircraft**.
2. In the picker, search or browse. Each entry shows aircraft type, military/commercial tag, and wingspan.
3. (Optional) Enter a **Heading** in the picker — the aircraft will be placed at this heading. Default 0°.
4. (Optional) Enter a **Quantity** (default 1). Quantities > 1 trigger bulk placement (see next recipe).
5. Click **Select**.
6. The picker closes and a crosshair cursor appears on the map.
7. Click the map at the nose-gear position where you want the aircraft.
8. The aircraft is placed and automatically selected for editing in the sidebar.

### How to bulk-add multiple aircraft of the same type

1. Open the picker as above.
2. Select the aircraft type.
3. Set **Quantity** to the number you want.
4. Click **Select**.
5. Click the map once at the starting nose-gear position.
6. The aircraft are auto-spaced in a row based on wingspan + wingtip clearance, using the heading you set.

All aircraft in the bulk batch share the same heading. Adjust individually after placement if needed.

### How to favorite / unfavorite an aircraft type

1. In the Aircraft Picker, find the entry.
2. Tap the star icon on the right side of the row.
3. Favorited aircraft appear at the top of the picker with a gold border.

Favorites are stored in `localStorage` on the device — they are per-device, not per-user.

### How to cancel aircraft placement

After clicking **Select** in the picker, the cursor is in placement mode. To cancel without placing:

- Press **Esc** — cancels placement and returns to box-select toggle state.
- Or click the **X** on the placement hint toast.

### How to move an aircraft

**Mouse drag (desktop):**
1. Click and hold on the aircraft silhouette.
2. Drag. Distance-to-nearest-neighbors labels appear live, color-coded: green = OK, amber = warning, red = violation.
3. Release. The new position is saved automatically to the database.

**Touch drag (mobile/tablet):**
1. Press and hold briefly on the silhouette until the cursor changes.
2. Drag.
3. Release.

**Keyboard nudge:**
1. Click the aircraft once to select it (blue ring appears around it).
2. Arrow keys move 1 ft in the chosen direction.
3. Shift + Arrow moves 5 ft.
4. Each keypress saves to the database.

**Via Fly-To:** Click **Fly To** in the aircraft edit panel to center the map on the aircraft at zoom 19.

### How to change the aircraft's heading

1. Click the aircraft to select it (or click its row in the sidebar).
2. In the sidebar edit panel, use the **Heading** slider or type a number in the degree input.
3. The silhouette rotates live. Changes save on slide release or number commit.

Accepts any integer 0–360. Clearing the number field is allowed while editing — just type a new value.

### How to change the clearance for one aircraft

The default clearance comes from UFC 3-260-01 based on the plan's apron context and the aircraft's wingspan. To override:

1. Select the aircraft.
2. In the edit panel, click one of the four clearance buttons:
   - **UFC** — use the computed value (default; shows the computed number, e.g., `UFC (25ft)`).
   - **10ft** — override to 10 feet.
   - **15ft** — override to 15 feet.
   - **25ft** — override to 25 feet.
3. Clearance polygons on the map update immediately. Clearance violations recompute.

### How to change an aircraft's status

Each aircraft has a status chip: Available, Occupied, Reserved.

1. Select the aircraft.
2. In the edit panel, use the **Status** dropdown.
3. The aircraft's label and color update immediately.

Status is informational — it does not affect clearance analysis.

### How to name a spot or set tail number / callsign

1. Select the aircraft.
2. In the edit panel, fill **Spot Name**, **Tail #**, or **Callsign**.
3. Fields save on blur (when you click away).

Spot Name shows in place of the aircraft type in the sidebar list if set.

### How to duplicate an aircraft

1. Select the aircraft.
2. In the edit panel, click **Duplicate**.
3. A copy is created 50 ft east of the original, with the same heading and clearance.

Or: Ctrl+click (or long-press on touch) the aircraft → **Duplicate** in the context menu.

### How to delete one aircraft

- Edit panel → **Remove**.
- Or context menu (Ctrl+click / long-press) → **Remove**.

---

## Multi-select aircraft (new in v2.32)

Multi-select lets you treat a group of aircraft as one unit for moving, rotating, and deleting.

### How to select multiple aircraft with shift+click

1. Click the first aircraft normally to select it.
2. Hold **Shift** and click additional aircraft on the map (or click their rows in the sidebar list).
3. Each shift+click toggles that aircraft in/out of the selection.
4. Selected aircraft are ringed in purple; the primary (last-single-clicked) is ringed in cyan.

**Note:** Plain-clicking an unselected aircraft *replaces* the multi-selection with just that one. To keep the group, always hold Shift.

### How to select multiple aircraft with a box

1. Click **Box Select** in the Aircraft tab toolbar (or press **Esc** when the map is focused).
2. The map cursor changes to crosshair and panning is disabled.
3. Click-and-drag a rectangle over the aircraft you want to select.
4. Release. Every aircraft whose center is inside the box is added to the selection (existing selection is preserved — draw again to add more).
5. A toast reports "Selected N aircraft."
6. Box-select mode auto-exits after one box.

To cancel before drawing: press **Esc** again.

### How to clear the multi-selection

- Click **Clear (N)** in the Aircraft toolbar.
- Or press **Esc** when a multi-selection is active.
- Or plain-click any single aircraft (replaces the group with that one).
- Or plain-click empty map (clears).

### How to move a group

1. Build the selection (shift+click or box-select).
2. Click-and-hold on **any aircraft in the selection**.
3. Drag. The whole group translates in unison, preserving relative positions.
4. Release. Positions save via one batched database update.

If you click-and-drag an aircraft *not* in the selection, the selection is cleared and that one aircraft is dragged alone.

### How to rotate a group to the same heading

1. Build the selection.
2. In the **Multi-selection panel** at the top of the Aircraft tab (purple-bordered), use the **Heading** slider or number input.
3. Every selected aircraft rotates to the chosen heading.

If the selected aircraft have different headings, the input shows blank with placeholder "mixed" — typing a value applies it to all.

### How to change clearance for a group

1. Build the selection.
2. In the Multi-selection panel, click one of the clearance buttons (**UFC**, **10ft**, **15ft**, **25ft**).
3. Every selected aircraft gets that override.

### How to delete a group

- Multi-selection panel → **Delete All** (with confirm).
- Or press **Delete** or **Backspace** on the keyboard with a multi-selection active (with confirm).

### How to view clearance results for only the selected aircraft

1. Build the selection.
2. Multi-selection panel → **View Clearance**.
3. The sidebar switches to the Clearance tab with filtering in place.

---

## Context menu

Ctrl+click (desktop) or long-press (touch) on an aircraft to open the context menu with per-aircraft actions:

- Fly To
- Duplicate
- Remove
- Toggle Lock (if plan is unlocked)
- Copy Coordinates (DMS format)

Context menu closes on any click outside it.

---

## Obstacles

Obstacles are things aircraft must clear: light poles, hangars, GSE, fuel pits, etc.

### How to place a point obstacle

1. Environment tab → Obstacles section → **Point** button.
2. Click the map at the obstacle's location.
3. Fill the edit panel that appears: Name, Notes.
4. Save (fields save on blur).

### How to place a building obstacle (rotated rectangle)

1. Environment tab → **Building** button.
2. Click-and-drag on the map to set the rectangle's corner-to-corner extent.
3. Release to confirm.
4. Edit panel appears with: Name, Width (ft), Length (ft), Rotation (°), Notes.
5. Adjust rotation numerically if needed.

### How to place a circle obstacle

1. Environment tab → **Circle** button.
2. Click-and-drag from the center outward to set the radius.
3. Release.
4. Edit panel: Name, Radius (ft), Notes.

### How to place a line obstacle

1. Environment tab → **Line** button.
2. Click the map at each vertex of the line.
3. Double-click (or click **Finish**) to complete.
4. Edit panel: Name, Notes.

Line obstacles are open polylines, useful for fences, barriers, cable runs.

### How to move an obstacle

Obstacles are **locked by default** so you don't accidentally drag them while arranging aircraft.

1. Environment tab → toggle **Obstacles Locked → Obstacles Unlocked**.
2. Drag the obstacle. For line obstacles, dragging translates all vertices.
3. Re-lock when done.

### How to edit obstacle properties

1. Click the obstacle (when unlocked) or the obstacle's row in the Environment tab.
2. The edit panel opens in the sidebar.
3. Change Name, dimensions, rotation, notes.

### How to delete an obstacle

Edit panel → **Delete**, or context menu → **Remove**.

---

## Taxilanes

A taxilane is a polyline defining a taxi route. Glidepath computes its clearance envelope (half-width = 0.5 × design wingspan + UFC clearance) and checks that aircraft don't penetrate it.

### How to draw a taxilane

1. Environment tab → Taxilanes section → **+ Interior Taxilane** or **+ Peripheral Taxilane**.
2. The cursor enters draw mode.
3. Click the map at each vertex of the taxilane centerline.
4. Double-click (or click **Finish Taxilane** in the toolbar) to complete.
5. The taxilane is created with a default name and you can adjust properties in the edit panel.

**Interior** vs **Peripheral** determines which UFC row governs the envelope (Item 5(I) vs Item 6(T)).

### How to set taxilane design aircraft

1. Select the taxilane in the Environment tab.
2. In the edit panel, pick a **Design Aircraft** from the dropdown. The wingspan auto-populates from the Aircraft Database.
3. Or set **Design Wingspan (ft)** manually.
4. The envelope half-width recomputes immediately and redraws on the map.

### How to toggle a taxilane as transient

Transient taxilanes use a slightly relaxed clearance row (Peripheral Transient).

1. Edit panel → check **Transient**.
2. The envelope recomputes.

### How to edit taxilane points (new in v2.32)

This is how you adjust the taxilane's shape after it's been drawn.

1. Select the taxilane.
2. In the edit panel, click **Edit Points**.
3. Draggable markers appear:
   - **Blue solid dots** — existing vertices.
   - **White dots with blue outline** — midpoints between adjacent vertices.
4. **To move a vertex:** drag the blue dot to a new location. Release to save.
5. **To insert a new vertex:** click a white midpoint dot. A new blue vertex is created at that midpoint, splitting the segment into two.
6. **To delete a vertex:** Shift+click a blue vertex. Minimum two vertices are enforced — you cannot delete below that.
7. When done, click **Exit Edit Points**.

The envelope polygon and centerline redraw automatically as you edit.

### How to rename or change taxilane type

1. Select the taxilane.
2. Edit **Name** in the edit panel.
3. Use the **Type** dropdown (Interior / Peripheral) to change classification.
4. Changes save on blur.

### How to delete a taxilane

Edit panel → **Delete**, confirm.

---

## Apron boundaries

Apron boundaries are named polygons used for visual reference and plan organization. They do **not** affect clearance analysis.

### How to draw an apron boundary

1. Environment tab → **+ Apron Boundary** button.
2. Click the map at each vertex of the polygon.
3. Minimum 3 points.
4. Double-click (or click **Finish**) to close the polygon.

### How to rename or delete a boundary

1. Select the boundary in the Environment tab.
2. Edit panel → change Name or click **Delete**.

---

## Clearance analysis

### How to change the apron context

The apron context governs which UFC 3-260-01 table row applies to the *whole plan*.

1. Settings tab → **Apron Context** dropdown.
2. Options:
   - Item 4(P) — Parking Apron (default)
   - Item 4(P) — Transient Apron (C-5/C-17)
   - Item 4(P) — KC Refueling Operations
   - Item 5(I) — Interior Taxilane
   - Item 6(T) — Peripheral Taxilane
   - Item 6(T) — Peripheral Taxilane (Transient)
3. All clearance polygons and results recompute immediately.

### How to view the clearance results list

1. Clearance tab on the sidebar.
2. The list shows every pairwise clearance result — aircraft↔aircraft, aircraft↔obstacle, aircraft↔taxilane.
3. Each row has: status (violation / warning / ok), distance, required distance, and labels identifying the two items.

### How to filter clearance results

Tabs at the top of the Clearance panel:

- **All** — every result.
- **Violations** — distance below required.
- **Warnings** — within 10% of minimum.
- **OK** — adequate clearance.

Violations are also reflected in color on the map (red polygon around the aircraft) and a `!` badge on the sidebar row.

### How to hide the clearance polygons

- Settings tab → uncheck **Show Clearances**.
- Or Environment tab layer toggle → toggle **Clearance** off.

The results list still computes — only the on-map overlay is hidden.

---

## Visibility layers

Layer toggles in the Environment tab control what renders on the map without deleting anything:

| Layer | Default | Toggle |
|---|---|---|
| Aircraft | On | AC |
| Obstacles | On | OB |
| Taxilanes | On | TL |
| Apron Boundaries | On | AB |
| Clearance polygons | On | (Show Clearances in Settings) |

Tap the two-letter abbreviation in the Environment tab toolbar to toggle.

---

## Ruler tool

1. Header → **Ruler** button (icon).
2. Click two points on the map.
3. Distance (ft and m) and bearing (°) display between them.
4. Click **Exit Ruler** (or the Ruler button again) to dismiss.

The ruler does not create anything in the database — it's a live measurement overlay.

---

## Plan Locked mode

Plan Locked disables aircraft drag for the whole plan. Use it once you've finalized a plan and want to prevent accidental moves while showing it to visitors or leadership.

1. Settings tab → toggle **Plan Locked**.
2. Aircraft drag is disabled. Keyboard nudge and sidebar edits still work (intentional — you can still make deliberate edits).
3. To unlock: toggle again.

---

## Fullscreen

Press **Space** to toggle fullscreen on the map. The sidebar collapses and the map fills the viewport. Useful when presenting or on mobile.

Press Space again to restore.

---

## PDF export

### How to export a parking plan to PDF

1. With the plan selected, Settings tab → **Export PDF**.
2. The map is temporarily resized to 1600×900, pitch is flattened, bearing is preserved, and the canvas is captured.
3. A PDF downloads with:
   - Cover page (plan name, installation, date, Active flag)
   - Map snapshot with silhouettes and overlays
   - Legend
   - Clearance results table (violations first)
   - Aircraft roster with spot name, tail #, callsign, coordinates (DMS), and clearance
4. Download is handled by your browser.

Map view is restored automatically after capture.

### How to email the PDF

1. Settings tab → **Email PDF**.
2. The PDF is generated as above, then opened in the Email PDF modal.
3. Enter one or more recipient emails (comma or newline separated). Your default PDF email from Settings → Profile is pre-filled.
4. Optional subject and message.
5. Click **Send**. Delivered via Resend.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| **Space** | Toggle fullscreen |
| **Esc** | Toggle box-select / cancel placement / clear selection |
| **Arrow keys** | Nudge selected aircraft 1 ft |
| **Shift + Arrow** | Nudge selected aircraft 5 ft |
| **Delete / Backspace** | Delete multi-selection |
| **Shift + click** | Toggle aircraft in multi-selection |
| **Ctrl + click** (desktop) | Context menu on aircraft |
| **Long-press** (touch) | Context menu on aircraft |
| **Double-click** (in draw mode) | Finish a line / taxilane / boundary |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Aircraft silhouette is wrong size | Pivot-point or wingspan data is wrong in the Aircraft Database | Fix the Aircraft Database entry. All plans using that type will rescale. |
| Can't drag an aircraft | Plan Locked is on | Settings → toggle Plan Locked off. |
| Can't drag an obstacle | Obstacles Locked is on (default) | Environment tab → Obstacles Unlocked. |
| Silhouette flickers during zoom | Known historical issue — fixed in v2.32 (idle-event rescaling) | Make sure you're on v2.32 or later. |
| Bulk-add placed all aircraft at one point | You clicked only once and the bulk-add spacing hit the map edge or an offset edge case | Undo via selection + Delete, then re-add with a clearer starting point. |
| Clearance polygons missing | Show Clearances off, or Clearance layer toggle off | Settings → Show Clearances on; Environment → Clearance layer on. |
| Group drag moves only one aircraft | The aircraft you dragged wasn't in the selection | Shift+click it first, then drag. |
| Box select doesn't start | You pressed Esc while placing an aircraft (cancels placement instead) | Press Esc again after placement cancels. |
| Taxilane Edit Points markers don't appear | Edit Points toggled off, or taxilane has < 2 vertices | Toggle Edit Points on; if < 2 vertices, the taxilane is invalid and needs redraw. |
| Shift+click in sidebar doesn't add to selection | You clicked without Shift first, replacing the selection | Shift+click from the start, or use box-select. |
| Rotate / heading input won't accept clear | Fixed in v2.32 — clearing is allowed during edit | Update to v2.32+. |
| PDF export captures wrong map area | The map hadn't settled before capture | Wait 1–2 seconds after panning, then retry. |
| Demo mode plan shows no aircraft | Demo AFB only ships with one seeded plan | Switch installations or add aircraft to the demo plan. |

---

## Related manual files

- [08_visual_navaids.md](08_visual_navaids.md) — Infrastructure map uses similar drag, select, and layer patterns.
- [10_obstructions.md](10_obstructions.md) — Same ruler tool; similar map interaction.
- [21_base_setup.md](21_base_setup.md) — Runway coordinates and installation elevation configured here feed parking plans.
- [00_getting_started.md](00_getting_started.md) — Sidebar collapse, fullscreen, installation switcher.
