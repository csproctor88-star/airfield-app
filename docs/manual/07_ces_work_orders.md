# 07 — CES Work Orders

**Path:** Sidebar → CES Work Orders · URL `/ces`

The CES Work Order module is a dedicated interface for Civil Engineering Squadron personnel. It shows only the discrepancies routed to their shops, with a restricted status palette that enforces separation of duties — CES can mark work in progress and completed, but cannot close or verify a discrepancy.

---

## Overview

CES Work Orders is effectively a filtered, role-specialized view of the Discrepancies module. Behind the scenes, the records are the same — a CES work order *is* a discrepancy. The interface is tailored so CES personnel see only relevant items and have a controlled status palette.

Who sees what:
- **CES role users** see only discrepancies routed to their shop(s).
- **AFM / AMOPS / Admin** can view the CES dashboard for any shop.
- **Other roles** (Safety, ATC, Read Only) do not see this module.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Shop** | A CE squadron shop (Electrical, Pavements, Structural, HVAC, etc.) configured per-installation in Base Setup. |
| **Type-to-shop mapping** | The routing logic that determines which shop receives which discrepancy type. JSONB on `bases.discrepancy_type_shop_map`. |
| **Restricted status palette** | CES can only set In Work, Project, Work Completed. Cannot close or mark verified — that authority rests with AFM. |
| **Work Order Number** | CES's internal tracking reference. Free-text field. |
| **Assigned To** | The CES individual handling the work. |
| **Separation of duties** | AFM verifies corrective work before a discrepancy is removed from active tracking. |

---

## Layout

The CES dashboard is **tabbed by shop**. Each tab:
- KPI badges: Open, Average Age, Awaiting Action, Awaiting Verification
- Work order list filtered to that shop
- Map toggle to see all discrepancies for the shop spatially

If you're a CES user mapped to multiple shops, you see one tab per shop.

---

## How to view your shop's work orders

1. Open CES Work Orders.
2. If you're assigned to multiple shops, tap the shop tab.
3. The list shows every open discrepancy routed to that shop.
4. Each row: title, type, age, priority, assigned, current status.

## How to filter the work order list

Filter controls at the top:
- Status (In Work / Project / Work Completed / All Open)
- Priority
- Aging tier (fresh / aging / overdue)
- Search by title or work order number

## How to open a work order's detail

Tap the row. The detail view is the same as the Discrepancies module detail view ([06_discrepancies.md](06_discrepancies.md)), but actions available to you are restricted by your CES role.

## How to update work order status (CES)

1. Detail view → **Update Status**.
2. Available statuses for your role:
   - **In Work** — you've started the fix
   - **Project** — requires project-level work (funded out of budget cycle)
   - **Work Completed** — the fix is done, awaiting AFM verification
3. Save.

You cannot set **Closed** or **Verified** — those require AFM action.

## How to assign a work order number

1. Detail view → **Edit**.
2. Fill **Work Order #** (your internal tracking reference).
3. Save.

The Pending W/O filter tab on the main discrepancies list shows discrepancies still missing this field.

## How to assign the work order to a CES individual

1. Detail view → **Edit**.
2. Select **Assigned To** from the user directory.
3. Save.
4. The assigned person sees the work order on their dashboard filtered list.

## How to add notes, photos, or updates

1. Detail view → scroll to the notes / photos section.
2. **Add Photos** — camera or file upload.
3. **Add Note** — free-text update.
4. Notes attach to the status update history.

## How to mark work complete

1. Detail view → **Update Status** → **Work Completed**.
2. Optional completion notes.
3. Save.
4. The discrepancy flips to "work_completed_awaiting_verification."
5. AFM / AMOPS will verify and close.

## How to view completed-but-not-closed work

The CES tab shows these under an **Awaiting Verification** badge or filter. They remain your responsibility until AFM closes them.

## How to see aged work orders

The tab's KPI badges show:
- Average age across all open work orders in your shop
- Count of items older than 14 days (aging)
- Count of items older than 30 days (overdue)

Sort the list by Age descending to see your oldest items first.

---

## Role-specific navigation (CES users)

CES role users see a **flattened sidebar** with only four items:
1. CES Work Orders
2. Discrepancies (read-only detail view)
3. Visual NAVAIDs (read-only)
4. Settings

No other modules (inspections, checks, QRC, parking, etc.) are accessible to CES role. The sidebar lockdown is enforced by the `CES_ALLOWED_ITEMS` set in `components/layout/sidebar-nav.tsx`.

---

## Keyboard shortcuts

None specific to CES Work Orders.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| You don't see a work order you expect | Type-to-shop mapping doesn't route that type to your shop | Ask admin to fix the mapping in Base Setup. |
| Can't set status to Closed | CES cannot close — by design | AFM will close after verification. |
| Multiple shops but see only one tab | You're only mapped to one shop in User Management | Ask admin to add additional shop memberships. |
| Can't edit a work order | RLS restricting — you're not in the shop mapped to the type | Verify the type-to-shop mapping with your admin. |
| "Sidebar missing modules" | CES role has flattened nav by design | This is intentional. |
| Completed work not disappearing from list | AFM hasn't verified yet | Wait for AFM review or nudge them. |

---

## Related manual files

- [06_discrepancies.md](06_discrepancies.md) — Underlying discrepancy data and full lifecycle.
- [08_visual_navaids.md](08_visual_navaids.md) — NAVAID outages that route to CES shops.
- [21_base_setup.md](21_base_setup.md) — CE Shops configuration and type-to-shop mapping.
- [22_user_management.md](22_user_management.md) — Assigning users to shops.
