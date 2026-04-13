# 14 — Waivers

**Path:** Sidebar → Waivers · URL `/waivers`

The Waivers module implements the full AF Form 505 lifecycle for airfield waivers. Waivers are tracked through initial submission, coordination, approval, and annual review cycles, with a map view for spatial awareness and PDF/Excel export for MAJCOM submission.

---

## Overview

A waiver documents an approved deviation from a regulatory requirement — e.g., a building inside the runway safety area, a lighting configuration that doesn't meet UFC, a runway shorter than the nominal length for the aircraft category.

Glidepath tracks:
- **Six classification types**: Permanent, Temporary, Construction, Event, Extension, Amendment
- **Seven status values**: Draft, Pending, Approved, Active, Closed (stored as `completed`), Cancelled, Expired
- Associated location (map pin or region)
- Photos and attached documents
- Coordination history

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Waiver** | A recorded deviation with justification, approval authority, and status. |
| **Classification** | One of six types: Permanent, Temporary, Construction, Event, Extension, Amendment. |
| **Status** | One of seven values: Draft, Pending, Approved, Active, Closed, Cancelled, Expired. |
| **Status transitions** | Not all transitions are allowed — e.g., Draft can only go to Pending or Cancelled; Approved can only go to Active or Cancelled. |
| **Annual Review** | Approved waivers require annual review per DAFMAN 13-204. Glidepath flags waivers approaching their review date. |
| **AF Form 505** | The standard USAF waiver form. Glidepath's PDF export maps to this format. |

---

## How to create a waiver

1. Waivers → **+ New Waiver**.
2. Fill:
   - **Title** — short descriptive name.
   - **Classification** — pick from the six types.
   - **Description** — full narrative of the deviation.
   - **Justification** — why the waiver is needed / mitigations in place.
   - **Location** — click the map to pin, or describe the area.
   - **Regulatory Reference** — which UFC/DAFMAN paragraph being waived.
   - **Approval Authority** — who must approve (MAJCOM, Wing, etc.).
3. Upload supporting documents.
4. Save as **Draft** or submit to next status.

## How to move a waiver through the lifecycle

1. Waiver detail → **Update Status**.
2. Allowed transitions:
   - Draft → Pending, Cancelled
   - Pending → Approved, Draft, Cancelled
   - Approved → Active, Cancelled
   - Active → Closed, Expired, Cancelled
   - Closed → Active, Expired
   - Cancelled → Draft
3. Each status change logs to the waiver's coordination history.

## How to attach coordination history

1. Waiver detail → **Add Coordination Entry**.
2. Record:
   - Who coordinated
   - When (Zulu)
   - Outcome / action
   - Notes
3. Save.

## How to set or update expiration / review dates

1. Waiver detail → **Edit**.
2. Set **Expiration Date** (final) and **Annual Review Date**.
3. Save.

Approaching review dates are flagged in the list view (amber within 30 days, red overdue).

## How to view the map of active waivers

1. Waivers list → **Map View**.
2. Every active waiver appears as a pin at its recorded location.
3. Tap to see a popup; tap again for full detail.

## How to export a waiver to PDF

1. Waiver detail → **Export PDF**.
2. Generates an AF Form 505–formatted PDF with the narrative, justification, location, photos, and coordination history.
3. Download or **Email PDF**.

## How to export all waivers to Excel

1. Waivers list → **Export Excel**.
2. A spreadsheet with one row per waiver is downloaded.
3. Suitable for MAJCOM waiver-register submission.

## How to upload supporting documents

1. Waiver detail → **Documents** section.
2. **Upload File** — PDF, image, or Office document.
3. File is stored in Supabase Storage and linked to the waiver.
4. Tap a document to download.

---

## Keyboard shortcuts

None specific to Waivers.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Waiver map pin missing | Location not set, or set to 0,0 | Edit the waiver and drop a proper pin. |
| Annual review date flag not showing | Review date blank or far in the future | Edit waiver → set Annual Review Date. |
| Document upload fails | File size exceeds Supabase Storage limit, or type not allowed | Compress; try PDF/JPG/PNG under 25MB. |
| Status won't advance | Required fields empty for the new status | Check the edit modal for validation errors. |
| Excel export empty | No waivers meet the current filter | Clear filters. |

---

## Related manual files

- [10_obstructions.md](10_obstructions.md) — Obstructions that require waivers.
- [18_reports_analytics.md](18_reports_analytics.md) — Waiver summary reports.
- [19_events_log.md](19_events_log.md) — Status changes logged here.
