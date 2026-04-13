# 13 — Wildlife / BASH

**Path:** Sidebar → Wildlife · URL `/wildlife`

The Wildlife / BASH module supports sighting and strike documentation in compliance with DAFMAN 91-212 (Bird/Wildlife Aircraft Strike Hazard). Forms auto-populate weather conditions from real-time meteorological data, a heatmap visualizes strike and sighting density, and all timestamps use Zulu time.

---

## Overview

Two primary record types:
- **Sighting** — wildlife observed at or near the airfield (flocks of geese, coyotes, deer on approach).
- **Strike** — actual bird or wildlife strike with an aircraft.

Records carry species, count, location, weather conditions (auto-filled), habitat notes, and actions taken. A **heatmap** layer on the airfield map shows aggregated density over configurable time windows.

The Wildlife heatmap has two implementations in the codebase — a Mapbox version and a Google Maps `HeatmapLayer` version. The rest of the app is on Google Maps. Which one renders is controlled at the component level; the default is the Mapbox version for heatmap visual fidelity, but the Google version is available as a swap-in.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Sighting** | Wildlife observation, no strike. |
| **Strike** | Aircraft-wildlife impact. |
| **Favorites** | Per-base favorited species for rapid selection. Stored on `base_wildlife_species.is_favorite`. |
| **Weather auto-fill** | On form mount, live Open-Meteo data populates wind, visibility, ceiling, temperature. |
| **Heatmap** | Mapbox heatmap layer over aggregated sighting + strike locations. |

---

## How to record a sighting

1. Open Wildlife → **+ New Sighting**.
2. Fill:
   - **Species** — pick from list (favorites appear at top with gold border).
   - **Count** — number of animals.
   - **Location** — tap the map or use GPS.
   - **Time Observed** (Zulu) — auto-fills with current time.
   - **Behavior** — optional dropdown (flying, loitering, grazing, etc.).
3. Weather fields **auto-fill** from Open-Meteo based on the location.
4. Review / adjust weather if needed.
5. Add photos (optional).
6. **Habitat Notes** — free text.
7. **Actions Taken** — what was done (harassment, dispersal, nothing).
8. Save.

## How to record a strike

1. Wildlife → **+ New Strike**.
2. Fill:
   - **Species** — as above, with favorites.
   - **Aircraft Type / Tail Number**.
   - **Phase of Flight** (takeoff, approach, cruise, etc.).
   - **Strike Location** — on aircraft (wing, engine, cockpit, etc.).
   - **Damage Assessment**.
   - **Runway / Area**.
3. Weather auto-fills.
4. Add photos.
5. Actions taken, downstream reports filed.
6. Save.

## How to favorite a species

1. In the species picker, tap the star icon next to a species.
2. Gold border + star indicator appears.
3. Favorited species always appear at the top of the picker.
4. Unfavorite by tapping the star again.

Favorites are per-installation (not per-user), shared with everyone at the base.

## How to view the heatmap

1. Wildlife → **Heatmap** tab (or toggle the heatmap layer on the map).
2. The satellite map shows color-gradient heat based on density of sightings + strikes.
3. Time window selector: Last 30 days / 90 days / 1 year / all time.
4. Species filter: all / specific species.
5. Record-type filter: sightings only, strikes only, both.

## How to export reports

### Sighting PDF

1. Open a sighting.
2. **Export PDF** — generates the form-formatted report.
3. **Email PDF** routes to Resend.

### Strike PDF

Same flow from a strike record. Strike PDF includes aircraft info and damage assessment.

### Analytics

- 30-day wildlife KPI on the Reports & Analytics page shows counts and trends.
- See [18_reports_analytics.md](18_reports_analytics.md).

---

## How to manage the species list (admin)

1. Base Setup → **Wildlife Species** section (or similar).
2. Add / remove / edit species entries.
3. Set `is_favorite` toggle on each.
4. Species list is per-installation.

## Species reference database & photos

A built-in reference database (`lib/wildlife-species-data.ts`) ships ~270+ airfield hazard species with scientific names, mass, size category, and strike risk. The picker uses this list to populate dropdowns and to show a thumbnail next to each species.

### Photo source chain

Photos are sourced (in order) from:

1. **USFWS National Digital Library** — public domain, U.S. Government work. Used for North American species with a known IIIF identifier.
2. **Wikimedia Commons API** — CC-licensed images for species not in USFWS.
3. **iNaturalist API** — CC-licensed photos as the final fallback.

All photos are downloaded once and cached in `public/wildlife_images/{group}/{safe_name}.jpg` via the Python scraper.

### How to add a new species to the reference database (developer)

1. Add an entry to `WILDLIFE_SPECIES` in `lib/wildlife-species-data.ts` with `image_url: null`.
2. Append the same species to the `SPECIES` list in `scripts/scrape_wildlife_images.py` (use `None` for the IIIF id so it falls through to Wikimedia / iNat).
3. Run `python scripts/scrape_wildlife_images.py`. The scraper:
   - Skips species with existing image files
   - Downloads only the new ones
   - Updates `public/wildlife_image_manifest.json` with source URLs and licenses
4. Commit the new image files in `public/wildlife_images/{group}/` plus the manifest.

### Filename convention

The reference module's `resolveWildlifeImage()` and the Python scraper share an exact filename convention: lowercase, apostrophes/parens stripped, spaces and hyphens converted to underscores, anything else stripped. Example: "Bonaparte's Gull" → `bonapartes_gull.jpg`.

---

## Keyboard shortcuts

None specific to Wildlife.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Weather fields don't auto-fill | Open-Meteo unreachable, or location not entered yet | Enter location first; check network. Manual entry always possible. |
| Heatmap shows no data | Time window too narrow, or no records for the filters | Expand window; try "all time." |
| Species missing from picker | Not added to the base's species list | Admin: Base Setup → add species. |
| Favorites not sticking | Per-base, not per-user — someone unfavored it | Re-favorite; coordinate with other users if it keeps flipping. |
| Heatmap won't render | Mapbox token missing or network restriction | Admin: verify `NEXT_PUBLIC_MAPBOX_TOKEN`. Wildlife heatmap is the only remaining Mapbox usage. |
| PDF missing weather | Weather was entered manually but not saved before export | Reload and re-check. |

---

## Related manual files

- [03_airfield_checks.md](03_airfield_checks.md) — BASH checks use the same species picker.
- [15_notams.md](15_notams.md) — Persistent wildlife hazard may generate NOTAMs.
- [18_reports_analytics.md](18_reports_analytics.md) — Wildlife KPI card.
- [21_base_setup.md](21_base_setup.md) — Species list configuration.
