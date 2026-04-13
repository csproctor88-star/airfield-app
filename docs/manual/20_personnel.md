# 20 — Personnel on Airfield & Contractors

**Path:** Airfield Status page → Personnel section · URL `/` (Personnel section)

The Personnel panel tracks who is currently on the airfield, their purpose, contractor credentials, and arrival/departure times. It's part of the Airfield Status page, not a standalone module, but has enough complexity to warrant its own manual entry.

---

## Overview

Two kinds of entries:

1. **Personnel** — individuals on the airfield for specific reasons (aircrew, visitors, military members not normally on the airfield).
2. **Contractors** — recurring contractors with AF Form 483 credentials and expiration tracking.

Contractors use a **template system** so you don't re-enter the same information every time a recurring contractor checks in.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Personnel entry** | A single log of one person's presence on the airfield. |
| **Contractor** | An entry tagged as contractor, with AF Form 483 fields. |
| **Contractor template** | Saved contractor information (name, organization, AF Form 483 #, expiration). Reusable via dropdown. |
| **AF Form 483** | USAF contractor escort form. Tracked with number, expiration date, and contact phone. |
| **Mark Completed** | Close out an entry when the person leaves — moves to the historical log. |

---

## How to add a personnel entry

1. Airfield Status → Personnel section → **+ Add Personnel**.
2. Fill:
   - **Name**
   - **Rank** (if military) or **Organization**
   - **Purpose** — why they're on the airfield (free text)
   - **Arrival Time** (Zulu; auto-fills with current time)
   - **Expected Departure** (optional)
   - **Contact** (phone, radio freq)
3. Save.
4. The entry appears in the Personnel section on Airfield Status.

## How to add a contractor entry

1. **+ Add Personnel** → toggle **Contractor** on the form.
2. Additional fields appear:
   - **AF Form 483 Number**
   - **AF Form 483 Expiration Date**
   - **Contact Phone**
3. If the contractor has a saved template, use the **Template** dropdown to auto-fill.
4. Save.

### Expiration warning

If the AF Form 483 expiration is within 30 days, an amber warning badge displays. If expired, a red warning displays. Contractors with expired forms cannot be marked as on-airfield without admin override.

## How to use a contractor template

1. Adding a contractor → open the **Template** dropdown.
2. Select the template.
3. Name, organization, AF Form 483 #, and expiration auto-fill.
4. Enter today's arrival time and purpose.
5. Save.

## How to create or edit a contractor template

1. Personnel panel → **Manage Templates** (admin/AMOPS).
2. **+ New Template** or tap existing to edit.
3. Fill:
   - Name
   - Organization
   - AF Form 483 # (default — update per-entry if needed)
   - AF Form 483 Expiration
   - Contact Phone
4. Save.

### Who can manage templates

- **Admins, Airfield Manager, NAMO, AMOPS** — create, edit.
- **Only admins** — delete.
- Race-condition-safe (read-then-write).

## How to mark an entry completed (person left)

1. Personnel panel → entry's **Mark Completed** button (or swipe on mobile).
2. Optional departure time (defaults to now).
3. Save.
4. Entry moves to the historical log; no longer counts on the active panel.

## How to view historical (completed) personnel

1. Personnel page → filter tabs at the top: **Active** / **All** / **Completed**.
2. Tap **Completed** to see every closed-out personnel entry. Each shows the start date and end date.
3. Use the search box to filter by company, contact name, or location.

## How to export personnel to PDF

1. Apply the desired filter (Active / All / Completed) and optional search.
2. Click **Export PDF** to download a landscape PDF of the filtered list.
3. Or click **Email PDF** to send via the email modal.
4. The PDF includes status, company, contact, phone, location, work description, radio, flag, callsign, AF Form 483 number with expiration warning, start, and end dates.
5. Expired AF Form 483 entries are highlighted in red bold in the PDF.

---

## Keyboard shortcuts

None specific to Personnel.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Template delete fails | Non-admin trying | Admins only; contact an admin. |
| Expiration warning not showing | Date not set, or outside the 30-day window | Verify expiration date set correctly. |
| Template disappeared after edit by another user | Race condition (very rare) | Templates use read-then-write; re-create if lost. |
| Can't find a contractor template | Template was deleted | Check with admin; re-create. |
| Personnel entry persists after person left | Wasn't marked Completed | Mark Completed now. |
| Expired AF Form 483 still allowing entry | Admin override applied, or date check failed | Verify admin authorization per base policy. |

---

## Related manual files

- [01_airfield_status.md](01_airfield_status.md) — Personnel panel is part of this page.
- [18_reports_analytics.md](18_reports_analytics.md) — 30-day personnel activity KPI.
- [22_user_management.md](22_user_management.md) — User roles and permissions.
