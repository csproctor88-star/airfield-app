# 05 — ACSI (Annual Compliance Safety Inspection)

**Path:** Sidebar → ACSI · URL `/acsi`

The ACSI module digitizes the Annual Compliance Safety Inspection required by DAFMAN 13-204 Vol 2, Paragraph 5.4.3. It covers ~100 checklist items across 10 sections, team roster management, risk management certification, and generates both PDF and Excel exports suitable for submission to higher headquarters.

---

## Overview

An ACSI is a large, multi-day effort. The module is designed to support:
- Long-running drafts (auto-saved to localStorage + Supabase on mount)
- Multi-inspector team contributions
- Photo and map documentation at the item level
- Risk management certification
- Parent/sub-field hierarchy in the PDF output
- Reopen for editing after file (admin only)

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Section** | One of 10 inspection areas (e.g., "Airfield Pavement," "Lighting Systems," "Wildlife Management"). |
| **Item** | A single checklist question with Yes/No/N/A response and optional note/photo/map. |
| **Parent / sub-field** | Some items have parent questions with sub-questions nested underneath. PDF rendering preserves this hierarchy. |
| **Team Roster** | The inspection team — inspectors, lead, SMEs, observers. |
| **Risk Management** | Required certification before filing. |
| **Mark All Yes** | A quick action to mark every unanswered item in a section as Yes. Use for sections with no findings. |
| **Discrepancy panel** | When an item is marked Fail (or No), a discrepancy panel opens on that item. Each item can hold one or more discrepancies, entered fresh or linked from the existing Discrepancy Log. |
| **Linked discrepancy** | An existing record from the Discrepancy Log attached to an ACSI item. The link is stored via `linked_discrepancy_id` and preserves bidirectional traceability — pins, photos, and the original title/description come along. |
| **Filed** | A completed, read-only ACSI. Can be reopened by admin. |

---

## How to create an ACSI

1. ACSI list page → **+ New ACSI**.
2. Fill the header: Title, Year, Lead Inspector, Team (add members from the user directory).
3. Set inspection dates (start, end).
4. Save. The draft opens.

## How to work through sections and items

1. Scroll to the first section (or use the table-of-contents jump links).
2. For each item:
   - Tap **Yes**, **No**, or **N/A**.
   - Add a note in the notes field if needed.
   - Attach photos via the camera/upload button.
   - Optionally mark a map pin for the finding's location.
3. Move to the next item. The draft auto-saves.

## How to use "Mark All Yes"

For a section with no findings:

1. Scroll to the section header.
2. Click **Mark All Yes** next to the section title.
3. Every unanswered item in that section flips to Yes.
4. Items already marked (Yes / No / N/A) are not changed.

## How to record a discrepancy on a failed item

When you mark an item **Fail** (or **No** on compliance-style items), a discrepancy panel opens automatically on that item with a blank entry ready to fill.

### Option A — Enter a new discrepancy inline

1. Mark the item Fail.
2. In the auto-created discrepancy panel, fill:
   - **Comment** — narrative of the finding (location tag + title + description).
   - **Work Order #** (if already assigned)
   - **Project Number** and **Estimated Cost** (optional)
   - **Estimated Completion** date
   - **Areas** (drop-down) and **map pin** (click the map)
   - Photos
3. The panel saves automatically as you type.

### Option B — Link an existing discrepancy from the Discrepancy Log

If a matching discrepancy already exists in your Discrepancy Log (pre-existing finding, prior inspection fail, CES-tracked item), link it directly instead of re-typing:

1. Mark the item Fail.
2. In the discrepancy panel, click **Link Existing**.
3. The "Link Existing Discrepancy" picker opens showing every discrepancy at your installation.
4. Search by ID, title, location, or work order number. Filter by status if needed.
5. Tap a discrepancy to link it.
6. The ACSI discrepancy panel populates with:
   - **Comment** built from the discrepancy's location, title, and description
   - **Work Order #** from the discrepancy
   - **Pins** from the discrepancy's lat/lng
   - **Photos** pulled from the discrepancy's photo set
   - **`linked_discrepancy_id`** set to the source discrepancy's ID for traceability
7. A toast confirms: "Linked [ID] with N photo(s)."

Already-linked discrepancies are indicated in the picker so you don't link the same one twice.

### Option C — Add multiple discrepancies to one item

Some items have several deficiencies. Add additional discrepancy entries:

1. In the panel, click **+ Add Discrepancy**.
2. Fill manually or **Link Existing** for each.
3. Reorder or remove individual entries as needed.

### How the linkage carries into the PDF

When you file the ACSI, linked discrepancies appear in the PDF output with their full details (ID, comment, pins, photos) under the relevant item. The `linked_discrepancy_id` persists so you can trace back to the source discrepancy anytime.

## How to attach a photo to an item

1. Tap the item.
2. Camera / upload button → Take Photo or Upload File.
3. Photos link to that specific item (not the ACSI as a whole) and render inline in the PDF.

## How to attach a map pin to an item

1. Tap the map icon on the item.
2. A map opens centered on your installation.
3. Click the map to drop a pin.
4. The pin location is stored with the item and appears in the PDF.

## How to manage the team roster

1. ACSI detail page → **Team** section.
2. **+ Add Member** — search by name, select role (Lead / Inspector / SME / Observer).
3. Remove a member with the X icon.
4. Lead Inspector has edit authority on every item.

## How to complete Risk Management certification

Risk Management is a required pre-filing step:

1. Scroll to the **Risk Management** section (usually near the end).
2. Answer the RM questions.
3. Add RM matrix if applicable.
4. Certify electronically (your user stamp attaches).

Without RM certification, the File button is disabled.

## How to file a completed ACSI

1. Verify all sections have no unanswered items (indicator shows completion percentage).
2. Verify Risk Management is certified.
3. Click **File ACSI**.
4. Review the summary modal.
5. Confirm.
6. The ACSI flips to Filed. An entry posts to Events Log.

## How to export to PDF / Excel

1. Open a filed (or draft) ACSI detail page.
2. **Export PDF** — generates a long-form PDF with:
   - Cover page (title, year, team roster)
   - Per-section items with parent/sub hierarchy
   - Inline photos and map thumbnails
   - Risk Management page
   - Summary statistics
3. **Export Excel** — row-per-item spreadsheet for data analysis.
4. **Email PDF** — sends via Resend.

## How to reopen a filed ACSI (admin only)

Regular users cannot reopen. Administrators:

1. ACSI list page → filed ACSI → **Reopen** button (inline on list page or on detail page).
2. Confirm.
3. The ACSI flips to Draft. `draft_data` is rebuilt from the filed items (v2.28+ fix).
4. Edit as needed.
5. Refile.

## How to delete an ACSI (admin only)

1. ACSI list page → filed or draft ACSI → **Delete** button (inline).
2. Confirm.
3. All photos, pins, and item data are removed.

---

## Keyboard shortcuts

None specific to ACSI.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Reopen produces a blank draft | Pre-v2.28 behavior (blank rebuild) | Update to v2.28+; reopen rebuilds from filed items. |
| Photos missing from PDF | Storage load failed at export time | Preview each photo in the detail page first, then re-export. |
| File button disabled | Risk Management not certified, or required items unanswered | Scroll to the completion indicator; fix the gaps. |
| Team member can't edit items | Their role in the ACSI is "Observer" | Lead Inspector: change role in the team roster. |
| Excel export is slow | 100+ items with embedded metadata | Accept the wait; Excel generation runs client-side. |
| Parent/sub-field hierarchy wrong in PDF | Template mis-parenting | Admin: fix the ACSI template (in code — contact support). |
| Link Existing picker shows nothing | No discrepancies exist at your installation, or all are already linked to other ACSI items | Verify in the Discrepancy module; already-linked entries are flagged in the picker. |
| Linked discrepancy photos missing after link | Photo records hadn't loaded yet at link time | Close and reopen the panel; photos repopulate from the linked discrepancy. |
| Need to unlink a discrepancy | Remove the discrepancy entry from the item | Panel → remove entry (X / trash icon). The source discrepancy is untouched; only the link is cleared. |

---

## Related manual files

- [04_daily_inspections.md](04_daily_inspections.md) — Daily inspections inform the ACSI but are separate.
- [06_discrepancies.md](06_discrepancies.md) — Existing discrepancies can be linked directly from any ACSI item via the Link Existing picker.
- [18_reports_analytics.md](18_reports_analytics.md) — ACSI frequency and findings summary.
- [19_events_log.md](19_events_log.md) — File events appear here.
