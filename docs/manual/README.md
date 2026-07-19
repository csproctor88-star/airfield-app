# Glidepath User Manual

**Version 2.32.0** | April 2026

This manual covers every module, tool, and workflow in Glidepath. Each file is self-contained — open just the one you need, or read the whole thing. Cross-references use relative links so it all works the same way in a file viewer, GitHub, or NotebookLM.

---

## Modules

| # | Module | File |
|---|---|---|
| 00 | Getting Started (sign in, navigation, customization) | [00_getting_started.md](00_getting_started.md) |
| 01 | Airfield Status | [01_airfield_status.md](01_airfield_status.md) |
| 02 | Dashboard | [02_dashboard.md](02_dashboard.md) |
| 03 | Airfield Checks | [03_airfield_checks.md](03_airfield_checks.md) |
| 04 | Daily Inspections | [04_daily_inspections.md](04_daily_inspections.md) |
| 05 | ACSI Annual Compliance | [05_acsi.md](05_acsi.md) |
| 06 | Discrepancy Management | [06_discrepancies.md](06_discrepancies.md) |
| 07 | CES Work Orders | [07_ces_work_orders.md](07_ces_work_orders.md) |
| 08 | Visual NAVAIDs & Infrastructure | [08_visual_navaids.md](08_visual_navaids.md) |
| 09 | Aircraft Parking Plans | [09_parking.md](09_parking.md) |
| 10 | Obstruction Evaluations | [10_obstructions.md](10_obstructions.md) |
| 11 | Quick Reaction Checklists (QRC) | [11_qrc.md](11_qrc.md) |
| 12 | Shift Checklist | [12_shift_checklist.md](12_shift_checklist.md) |
| 13 | Wildlife / BASH | [13_wildlife_bash.md](13_wildlife_bash.md) |
| 14 | Waivers | [14_waivers.md](14_waivers.md) |
| 15 | NOTAMs | [15_notams.md](15_notams.md) |
| 16 | Prior Permission Required (PPR) | [16_ppr.md](16_ppr.md) |
| 17 | Customer Feedback | [17_customer_feedback.md](17_customer_feedback.md) |
| 18 | Reports & Analytics | [18_reports_analytics.md](18_reports_analytics.md) |
| 19 | Events Log | [19_events_log.md](19_events_log.md) |
| 20 | Personnel on Airfield & Contractors | [20_personnel.md](20_personnel.md) |
| 21 | Base Setup | [21_base_setup.md](21_base_setup.md) |
| 22 | User Management | [22_user_management.md](22_user_management.md) |
| 23 | Read File | [23_read_file.md](23_read_file.md) |
| 24 | Flight Planning Room Check | [24_flight_planning_room.md](24_flight_planning_room.md) |
| 25 | Airfield Driving Spot Check | [25_driving_spot_check.md](25_driving_spot_check.md) |
| 26 | Local Regulations | [26_local_regulations.md](26_local_regulations.md) |
| 27 | Modifications & Exemptions | [27_modifications_exemptions.md](27_modifications_exemptions.md) |

---

## How to Use This Manual

Every module follows the same layout:

1. **Overview** — what the module does and where to find it.
2. **Key concepts** — terminology and ideas that the workflows assume.
3. **How to…** — numbered step-by-step recipes for every common task.
4. **Keyboard shortcuts** — a table of all shortcuts for the module.
5. **Troubleshooting** — symptom → cause → fix table.
6. **Related** — links to other manual files that intersect.

If you're hunting for a specific action, use your browser's **Ctrl+F** (or **Cmd+F** on Mac) inside a module file — every recipe starts with "How to" so the search is reliable.

---

## Global Keyboard Shortcut Cheatsheet

These shortcuts work throughout the app (context varies — see the per-module file for specifics).

| Key | Action | Modules |
|---|---|---|
| **Space** | Toggle fullscreen map | Parking, Infrastructure, Obstruction |
| **Esc** | Toggle box-select / cancel selection | Parking, Infrastructure |
| **Arrow keys** | Nudge selected item 1 ft | Parking |
| **Shift + Arrow** | Nudge selected item 5 ft | Parking |
| **Delete / Backspace** | Delete selection | Parking (multi-select) |
| **Shift + click** | Add/toggle in multi-select | Parking, Infrastructure |
| **Ctrl / Cmd + click** | Open context menu | Parking, Infrastructure |
| **Long-press (touch)** | Open context menu | Parking, Infrastructure |

---

## Common Terms

| Term | Meaning |
|---|---|
| **Installation** | A base — your data is scoped to installations. "Switch installation" switches context. |
| **Plan** (parking) | A named parking plan — many aircraft, obstacles, taxilanes, boundaries in one map. |
| **Template** (parking, personnel, QRC, events log) | A reusable starting point. |
| **Draft** (inspection, check, ACSI) | An unfinished record that is saved automatically and can be resumed across devices. |
| **Filed** | A completed, read-only record. Can sometimes be reopened by administrators. |
| **Zulu / UTC** | All timestamps in the app are Zulu (UTC). A trailing **Z** indicates Zulu (e.g., `1500Z`). |
| **Operating Initials (OI)** | 1–4 character identifier shown on events log entries. Set in Settings → Profile. |
| **RLS** | Row-Level Security — the database enforces who can see or change what. If an action is silently refused, RLS may be the reason. |
| **Realtime** | Live updates pushed from the database. If realtime disconnects, a warning appears when you try to act on stale data. |

---

## Feedback and Corrections

If a recipe is wrong or missing, note the module file, the section, and what doesn't match. The manual updates faster than the videos or training pages because it's all plain Markdown.
