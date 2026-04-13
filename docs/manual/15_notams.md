# 15 — NOTAMs

**Path:** Sidebar → NOTAMs · URL `/notams`

The NOTAMs module retrieves live data from the FAA's official NOTAM API and displays current and upcoming NOTAMs for your airfield identifier. It also supports local NOTAM draft creation with template-based field pre-population for coordination before official FAA submission.

---

## Overview

A **NOTAM** (Notice to Airmen) is an official notice of conditions affecting flight operations. Glidepath doesn't issue official NOTAMs (that flows through designated channels), but it helps with:

- **Viewing** live NOTAMs for your airfield.
- **Tracking expiry** of live NOTAMs so nothing lapses unnoticed.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **NOTAM** | Notice to Airmen — official notice of flight-affecting conditions. |
| **FAA feed** | Live data from `notams.aim.faa.gov` for your installation's ICAO. |
| **Effective window** | When the NOTAM takes effect and when it expires. |
| **E-field** | The free-text description field of a NOTAM (the main content). |

---

## How to view live NOTAMs

1. Open NOTAMs.
2. The list shows current and upcoming NOTAMs for your installation's ICAO.
3. Columns: NOTAM #, Effective Start, Effective End, Description (E-field), Status.
4. Expired NOTAMs are greyed.
5. NOTAMs within 24 hours of expiry are highlighted red.

## How to filter NOTAMs

Filter controls at the top:
- Source (`faa` for live FAA-feed items, `local` for any locally-authored entries retained in the database)
- Active / upcoming / expired
- Type (runway, taxiway, lighting, airspace, obstacle, etc.)
- Date range

## How to read NOTAM details

Tap a row → detail view shows the full NOTAM text with decoded fields:
- **Q-line** (type, scope)
- **A-line** (airport ICAO)
- **B-line** (start)
- **C-line** (end)
- **D-line** (schedule)
- **E-line** (description — the main content)
- **F-line** (lower limit)
- **G-line** (upper limit)

---

## Keyboard shortcuts

None specific to NOTAMs.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Live feed empty | FAA API unreachable, or ICAO misconfigured | Verify ICAO in Base Setup → Installation basics. Check network. |
| Template dropdown empty | Live feed failed | Same fix as above. |
| Draft effective dates in wrong timezone | Draft uses Zulu, but your local picker might default to local | Ensure Zulu when entering. |
| Decoded fields blank | NOTAM text doesn't match expected format | Rare — show raw text instead. |
| Expired NOTAM still shows as Active | FAA feed cache lag | Refresh; feeds typically update every 15 minutes. |

---

## Related manual files

- [10_obstructions.md](10_obstructions.md) — Obstruction Evaluations produce NOTAM-ready references.
- [01_airfield_status.md](01_airfield_status.md) — NOTAM-affecting status changes.
- [21_base_setup.md](21_base_setup.md) — ICAO identifier configuration.
