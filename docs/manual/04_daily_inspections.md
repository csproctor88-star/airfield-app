# 04 — Daily Inspections

**Path:** Sidebar → Inspections · URL `/inspections`

Daily Inspections are the DAFMAN 13-204 required airfield and lighting inspections, plus less-frequent construction-meeting and joint-monthly inspections. The system enforces one airfield and one lighting inspection per calendar day, with the boundary reset at 0600 local time.

---

## Overview

Four inspection types are supported:

- **Airfield Inspection** — daytime, covers pavement, markings, FOD, surface condition, signage, wildlife. Once per day.
- **Lighting Inspection** — typically dusk/nighttime, covers runway/taxiway edge lights, threshold lights, approach lighting, PAPI/VASI, signage illumination, rotating beacon. Once per day.
- **Construction Meeting Inspection** — walkthrough with construction stakeholders; no one-per-day enforcement. Reached through its own new-inspection flow (`/inspections/construction/new`).
- **Joint Monthly Inspection** — combined joint-review inspection; no one-per-day enforcement. Reached through `/inspections/joint-monthly/new`.

The daily airfield and lighting types enforce **one-per-day**. Construction meeting and joint monthly inspections do not — create as many as needed.

Failed items on any inspection type auto-generate discrepancies with pre-populated context.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **One-per-day rule** | Only one airfield inspection and one lighting inspection per calendar day. Enforced by both UI guard and database constraint. Boundary at 0600 local time in the installation's configured timezone. |
| **Default-to-Pass** | New inspection items default to "Pass." Inspectors toggle to Fail or N/A only where applicable. |
| **Three-state toggle** | Each checklist item cycles: Pass → Fail → N/A → Pass. |
| **Draft** | In-progress inspection; auto-saves to both Supabase `draft_data` and localStorage. localStorage wins if newer. |
| **Filed** | Completed, read-only inspection. |
| **Per-discrepancy photos** | A single inspection can generate multiple discrepancies. Photos can be attached to each one via `disc_index`. |
| **`started_at`** | Timestamp when the inspection was first created (used for duration analytics). |

---

## How to start a daily inspection

1. Open Inspections (or tap the Inspection Status Strip on the Dashboard).
2. Click **+ New Inspection**.
3. Select type: **Airfield** or **Lighting**.
4. If one of that type has already been filed today, a blocked dialog appears — dismiss and wait until after the 0600L reset (or open the existing inspection instead).
5. The form loads with checklist items defaulted to Pass.
6. `started_at` is captured on insert.

## How to work through the checklist

1. Scroll through sections (Pavement, Markings, Lighting, etc. — sections depend on the installation's template).
2. Tap an item to cycle its state: **Pass (green) → Fail (red) → N/A (gray) → Pass**.
3. For Fail:
   - A note field appears — describe the issue.
   - Optionally attach photos.
   - If the item is linked to infrastructure (e.g., Airfield Lighting), the failure will sync to the Visual NAVAIDs module on filing.
4. For N/A: optional note explaining why.

## How to attach photos to a failed item

1. Fail an item.
2. Camera / upload button appears.
3. Choose **Take Photo** or **Upload File**.
4. Photos upload immediately and persist across navigation (fixed in v2.32).
5. Thumbnail appears with a count badge on resumed items.

## How to save and resume a draft

- Drafts auto-save on every field change to both Supabase and localStorage.
- Or tap **Save Draft** to force a save.
- Close the page and come back anytime — Resume picks up where you left off.
- localStorage overrides an empty or older Supabase draft (fixes mobile orphan issues).

**Cross-user isolation:** Your drafts are yours. You won't see another user's inspection drafts in your resume list.

## How to resume on a different device

1. Open Inspections on the second device.
2. The list page shows in-progress drafts at the top.
3. Tap the one you started earlier.
4. The latest saved state is loaded.

## How to file the inspection

1. Complete (or at least acknowledge) every item.
2. Click **File Inspection** at the bottom.
3. A summary appears: how many Pass / Fail / N/A, how many linked discrepancies will be auto-created.
4. Confirm.
5. Fails generate discrepancies (one per fail) with pre-populated context (location, description, item reference).
6. NAVAID-linked fails mark the corresponding infrastructure feature as Out of Service.
7. The inspection flips to Filed status. Events Log posts entry.

## How to file a partial inspection (abort / file with uninspected items)

If the inspection must be filed without completing all items (shift end, weather, etc.):

1. Mark remaining items as N/A with a note ("shift ended," "weather precluded," etc.).
2. File normally.

There is no formal "abort" state — the three-state toggle covers partial/unclear items.

## How to view a filed inspection

1. Inspections list → tap the filed inspection.
2. The detail view shows all items, photos, linked discrepancies, and metadata.
3. **Export PDF** or **Email PDF** buttons generate the formatted report.

## How to reopen a filed inspection (admin)

Regular users cannot reopen a filed inspection. Administrators can:

1. Open the filed inspection.
2. Admin toolbar → **Reopen for Editing**.
3. The inspection flips back to Draft. `draft_data` is rebuilt from filed items.
4. Make changes and refile.

---

## Linked discrepancies

A Fail item generates a discrepancy with:
- **Title** inferred naturally from the item (e.g., "Taxiway Alpha centerline lights OOS")
- **Type** matched from the item's discrepancy-type hint
- **Description** including inspection context and notes
- **Location** on runway/taxiway
- **Photos** copied from the inspection item
- **Linked inspection ID** for traceability

Close the inspection's linked discrepancies normally in the Discrepancies module ([06_discrepancies.md](06_discrepancies.md)).

---

## NAVAID status sync

When you file a lighting inspection with failed NAVAID items:

1. The corresponding infrastructure feature is marked Out of Service in Visual NAVAIDs.
2. A discrepancy is auto-created linked to that feature.
3. The Outage Engine re-evaluates DAFMAN 13-204 Vol 2 Table A3.1 thresholds.
4. If thresholds are exceeded, alert tiers update on the System Health Panel.

To manually clear a NAVAID outage later, mark it Operational in Visual NAVAIDs — the system prompts to close the linked discrepancy.

---

## Keyboard shortcuts

None specific to inspections.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "You have already filed today's inspection" block | One-per-day rule (0600L reset) | Open the existing inspection. Wait for next day's reset if needed. |
| Draft resume opens a blank form | localStorage was cleared, Supabase draft is empty | Check if someone else filed one. Re-start. |
| Photos missing after resume | Photo upload raced with navigation | v2.32 fix uploads photos immediately; update if on older version. |
| One-per-day blocks at wrong time | Installation timezone not configured | Base Setup → Installation basics → Timezone. |
| NAVAID didn't update after lighting inspection file | Item not linked to the feature in the template | Admin: edit the inspection template to link the item to the correct feature. |
| Can't file — validation error | Required field missing | Scroll to the first red-bordered field. |
| Linked discrepancy has wrong type | Discrepancy-type hint in the inspection template is wrong | Admin: edit template in Base Setup. |

---

## Related manual files

- [03_airfield_checks.md](03_airfield_checks.md) — Ad-hoc checks distinct from daily inspections.
- [06_discrepancies.md](06_discrepancies.md) — Inspection fails become discrepancies here.
- [08_visual_navaids.md](08_visual_navaids.md) — Lighting inspection fails update NAVAID status.
- [18_reports_analytics.md](18_reports_analytics.md) — Inspection duration analytics.
- [21_base_setup.md](21_base_setup.md) — Inspection templates per installation.
