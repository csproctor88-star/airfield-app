# Session Handoff — v2.2.0

**Date**: 2026-02-24
**Branch**: `feature/scale`
**Version**: 2.2.0 | **Commits**: 457 | **Routes**: 31 | **Source Files**: 94 | **LOC**: ~31,000

---

## What Was Built (v2.2.0 Session)

This session connected the NOTAMs page to live FAA data, overhauled the Settings page UX, and tightened access control for installation switching.

### Features Delivered

1. **Live FAA NOTAM feed** — Replaced the stub API route with a real proxy to `notams.aim.faa.gov/notamSearch/search` (public endpoint, no API key required). The NOTAMs page auto-fetches for the current installation's ICAO, supports searching any airport, and shows full NOTAM text on each card.

2. **Settings page collapsible sections** — All settings sections are now dropdown accordions with chevron indicators. Profile and About default open; everything else collapsed on load.

3. **Settings section reorder** — Profile, Installation, Data & Storage, Regulations Library, Base Configuration, Appearance, About.

4. **Installation switching restricted to sys_admin** — Non-admin users see their current installation as read-only. The change/add/manage installation controls are hidden for all other roles.

5. **NOTAMs in More menu** — Added between Reports and PDF Library.

### Commits (9 in this session)

```
a9c2819 Restrict installation switching to sys_admin only
a59f1f9 Reorder settings sections per user preference
6a5d5e7 Make settings sections collapsible dropdowns
994b1d7 Move NOTAMs above PDF Library in More menu
c800bb8 Show full NOTAM text on cards and fix date parsing
72ab836 Make NOTAM cards expand in-place to show full text
fa9bd85 Switch to FAA public NOTAM Search endpoint (no API key needed)
c96a5c1 Fix FAA NOTAM API to use api.data.gov gateway
c174e05 Add live FAA NOTAM feed integration
```

---

## Build Status

| Check | Status |
|-------|--------|
| TypeScript (`tsc --noEmit`) | 20 pre-existing errors (none from this session's files) |
| All 31 routes render | Confirmed |
| Demo mode | Works (no Supabase required) |
| ESLint (`next lint`) | Blocked by missing `@ducanh2912/next-pwa` in node_modules |

**Note**: Run `npm install` to restore 3 missing packages (`@ducanh2912/next-pwa`, `react-zoom-pan-pinch`, `jspdf-autotable`) which will resolve all 20 type errors and unblock lint.

---

## Tech Debt & Cleanup Items

### Priority 1 — Fix before next feature work

| Item | Location | Description |
|------|----------|-------------|
| **Missing node_modules** | `package.json` | 3 packages declared but not installed. Run `npm install` |
| **Stale .next cache** | `.next/types/app/(app)/inspections/new/` | References a deleted page. Delete `.next/` and rebuild |
| **`SectionHeader` dead code** | `app/(app)/settings/page.tsx:102` | Replaced by `CollapsibleSection` but definition left behind |
| **`FAA_NOTAM_API_KEY` in .env.local** | `.env.local:7` | No longer needed — the public FAA endpoint requires no key. Can remove |
| **NOTAM detail page broken for live data** | `app/(app)/notams/[id]/page.tsx` | Only looks up `DEMO_NOTAMS` by ID; live FAA NOTAMs show "NOT FOUND". Cards now show full text inline, but this page is still reachable via direct URL |
| **Selfridge toast message** | `app/(app)/settings/base-setup/page.tsx:830` | Toast says "Default templates created from Selfridge template" — should be generic |
| **Hardcoded source base UUID** | `lib/supabase/inspection-templates.ts:103` | Uses Selfridge UUID for template cloning — should accept parameter |

### Priority 2 — Orphaned / Dead Code

5 files exist in the source tree but are never imported:

| File | Assessment |
|------|-----------|
| `components/layout/page-header.tsx` | Dead — zero references |
| `components/ui/loading-skeleton.tsx` | Dead — zero references |
| `lib/validators.ts` | Dead — Zod schemas never called (possibly incomplete feature) |
| `lib/installation.ts` | Dead — self-documented as "superseded by useInstallation() context" |
| `lib/supabase/regulations.ts` | Dead — no imports (distinct from `lib/regulations-data.ts` which IS used) |

### Priority 3 — Ongoing

| Item | Description |
|------|-------------|
| **RLS disabled** | Row-Level Security stripped for MVP. Must re-enable before production |
| **No test suite** | Zero unit/integration/e2e tests |
| **Weather API stub** | `app/api/weather/route.ts` returns placeholder; client uses Open-Meteo directly |
| **Implicit `any` types** | 13 untyped callback parameters in PDF report files and RegulationPDFViewer |
| **Large page files** | `regulations/page.tsx` (~1,647 lines), `inspections/page.tsx`, `obstructions/page.tsx` could decompose |
| **Bundle size** | `/library` route is 241 KB first-load JS — evaluate code splitting for react-pdf |

---

## Placeholder Pages (Coming Soon)

| Route | Module | Notes |
|-------|--------|-------|
| `/waivers` | Waivers | Airfield waiver lifecycle (request, review, approve, expire) |
| `/users` | Users & Security | User management, role assignment, base membership admin |
| `/sync` | Sync & Data | Offline queue, data export, import, audit |

---

## Architecture Notes

### FAA NOTAM Integration

```
User loads /notams
  → useInstallation() provides currentInstallation.icao (e.g., KMTC)
  → Client fetches /api/notams/sync?icao=KMTC
  → API route POSTs to notams.aim.faa.gov/notamSearch/search
     body: searchType=0&designatorsForLocation=KMTC
  → FAA returns JSON with notamList[]
  → API normalizes to { id, notam_number, source, status, notam_type, title, full_text, effective_start, effective_end }
  → Client renders cards with full NOTAM text
  → 5-minute server-side cache via next: { revalidate: 300 }
```

### Settings CollapsibleSection Pattern

```tsx
<CollapsibleSection label="PROFILE" icon={User} defaultOpen>
  <ProfileSectionContent />
</CollapsibleSection>
```

Each section component (`*SectionContent`) renders just the body content. The `CollapsibleSection` wrapper provides the dropdown header with chevron toggle. `useState(defaultOpen)` controls visibility.

### Access Control for Installation Switching

In `InstallationSectionContent`, the change/add/manage installation UI is wrapped in:
```tsx
{userRole === 'sys_admin' && (<> ... </>)}
```
Non-admin users see only the "CURRENT INSTALLATION" read-only display.

### Multi-Base Data Flow (unchanged)

```
User logs in → profiles.primary_base_id → loads base config
  → base_runways, base_navaids, base_areas, base_ce_shops
  → All data queries include WHERE base_id = $currentBase
  → Settings page allows switching (sys_admin only) via base_members
```

### Key State Patterns (unchanged)

- **No global state library** — page-level `useState` + Supabase queries
- **Installation context** — `useInstallation()` React Context provides `currentInstallation`, `userRole`, etc.
- **Demo mode** — `createClient()` returns null when Supabase env vars are missing
- **Theme** — `localStorage('theme')` → `data-theme` attribute on `<html>`

---

## File Inventory (Updated)

| Feature | Pages | API Routes | Lib Modules | DB Tables |
|---------|-------|-----------|-------------|-----------|
| Dashboard | 1 | 1 (airfield-status) | weather.ts, activity.ts, navaids.ts | airfield_status, navaid_statuses, activity_log, runway_status_log |
| Discrepancies | 3 | 0 | discrepancies.ts | discrepancies, status_updates, photos |
| Checks | 3 | 0 | checks.ts | airfield_checks, check_comments, photos |
| Inspections | 2 | 0 | inspections.ts, inspection-draft.ts, inspection-templates.ts | inspections, inspection_template_* |
| Obstructions | 3 | 0 | obstructions.ts, geometry.ts, surface-criteria.ts | obstruction_evaluations, photos |
| Reports | 5 | 0 | pdf-export.ts, reports/*.ts | (reads from other tables) |
| Regulations | 2 | 0 | regulations-data.ts, idb.ts, pdfTextCache.ts | regulations, pdf_text_pages |
| Aircraft | 1 | 0 | aircraft-data.ts | (static data) |
| Settings | 3 | 1 (installations) | installation-context.tsx, inspection-templates.ts | bases, base_*, inspection_template_* |
| NOTAMs | 3 | 1 (notams/sync) | — | notams |
| Auth | 1 | 0 | client.ts, server.ts | profiles, base_members |

---

## Files to Read First in a New Session

```
README.md                              — Project overview, tech stack, all modules
CHANGELOG.md                           — Full version history (v0.0.1 → v2.2.0)
docs/SESSION_HANDOFF_v2.2.0.md        — This document (tech debt, architecture, file map)
lib/constants.ts                       — App constants, checklists, types, categories
lib/supabase/types.ts                  — TypeScript types for all database tables
supabase/schema.sql                    — Base database schema
docs/SRS.md                            — Software Requirements Specification (authoritative spec)
```

---

## Suggested Next Session Priorities

1. **Run `npm install`** and clean up the 3 missing packages / 20 type errors
2. **Delete 5 orphaned files** (or wire them back in if intended)
3. **Remove unused `SectionHeader` function** from settings page
4. **Fix NOTAM detail page** (`/notams/[id]`) to work with live FAA data or redirect to list
5. **Waivers module** — next placeholder to fill out
6. **Users & Security module** — role management UI
7. **Re-enable RLS** with base-scoped policies for production readiness
