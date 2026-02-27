# Session Handoff — v2.7.0

**Date:** 2026-02-27
**Branch:** `main` (up to date with `origin/main`)
**Version:** 2.7.0 (synced: package.json, CHANGELOG.md, README.md)

---

## What Was Done This Session

### Bug Fixes

- **Discrepancy photos not displaying** — Three separate bugs fixed:
  1. Photo URL construction missing `photos/` bucket name in Supabase Storage path (all photos 404'd)
  2. `base_id` never passed during upload → RLS policy `user_has_base_access()` rejected NULL
  3. Same URL bug existed in checks detail page (`checks/[id]/page.tsx`)
- **FOD Check PDF label** — Changed "FOD Walk completed" to "FOD Check completed" in `lib/check-pdf.ts`

### PWA / Android Improvements

- Removed `body { padding-bottom: env(safe-area-inset-bottom) }` that created a gap below fixed nav
- Added `overscroll-behavior: none` to html/body
- Added `.bottom-nav::after` pseudo-element extending background color below the visible area
- Restructured bottom nav to full-width wrapper with centered inner content (480px)
- Added `NetworkFirst` caching strategy for `manifest.json` in service worker config
- Tested fullscreen mode (eliminates system bars) with custom clock — reverted to standalone
- **Final resolution:** The white bar is the Android system navigation bar; Chrome controls its color in standalone mode. User will keep phone on dark theme to hide it.

### UI Improvements

- **Header dark mode** — Removed white border, enlarged dark mode logo from 48px to 64px
- **User Management installation dropdown** — Replaced native `<select>` (takes over screen on Android) with custom scrollable dropdown matching Settings > Installation pattern
- **More page** — Removed ProfileSection component (~95 lines)

### Project Cleanup

- Added `public/Downloads/` to `.gitignore` (prevented accidental commit of ~4.5GB personal files)
- Created comprehensive CHANGELOG.md with full v2.7.0 section
- Updated README.md (version bump, FOD Walk→FOD Check fix, More menu description)

---

## Key Files Changed

| File | What Changed |
|------|-------------|
| `app/globals.css` | PWA fixes: overscroll-behavior, bottom-nav ::after, removed body padding-bottom |
| `app/layout.tsx` | Theme-color set to single `#0B1120` (reverted media-query experiment) |
| `components/layout/bottom-nav.tsx` | Full-width nav wrapper with centered 480px inner content |
| `components/layout/header.tsx` | No dark mode border, larger dark logo (64px) |
| `components/admin/user-detail-modal.tsx` | Custom installation dropdown (replaces native select) |
| `app/(app)/more/page.tsx` | Removed ProfileSection component |
| `app/(app)/discrepancies/[id]/page.tsx` | Fixed photo URL (added `photos/` bucket), added installationId |
| `app/(app)/discrepancies/new/page.tsx` | Pass installationId to uploadDiscrepancyPhoto |
| `app/(app)/checks/[id]/page.tsx` | Fixed photo URL (added `photos/` bucket) |
| `lib/supabase/discrepancies.ts` | base_id fallback lookup in uploadDiscrepancyPhoto |
| `lib/check-pdf.ts` | FOD Walk → FOD Check |
| `next.config.js` | NetworkFirst caching for manifest.json |
| `public/manifest.json` | display: standalone, background/theme: #0B1120 |
| `.gitignore` | Added public/Downloads/ |
| `CHANGELOG.md` | Added full v2.7.0 section |
| `README.md` | Updated version, fixed FOD Walk, updated More menu desc |

---

## Tech Debt & Cleanup Candidates

### High Priority (Safe to Delete)
7 dead files with zero imports anywhere in codebase:
- `lib/validators.ts`
- `lib/installation.ts`
- `lib/supabase/middleware.ts`
- `components/ui/card.tsx`
- `components/ui/input.tsx`
- `components/ui/loading-skeleton.tsx`
- `components/layout/page-header.tsx`

### Medium Priority
- **~134 `as any` casts** across the codebase — fix by running `supabase gen types typescript`
- **~41MB `public/aircraft_images/`** directory — unused, delete candidate
- **3 dark mode logo variants** (4.6MB total) — consolidate
- **Missing `.env.example`** template file
- **`components/PDFLibrary.jsx`** — only JSX file, should convert to TSX

### Low Priority
- NOTAM draft persistence not implemented (form doesn't save to DB)
- Weather API still a stub (no METAR integration)
- No unit or integration test suite
- Database role enforcement is app-layer only (no DB-level RLS for roles)

---

## iPad & Desktop Optimization — Research Summary

A comprehensive feasibility audit was completed (research only, no implementation).

### Current State
- All pages locked to `max-width: 480px` via `app/(app)/layout.tsx`
- Zero media queries, zero responsive Tailwind classes
- All styling uses inline `style={{}}` objects
- Single-column layout throughout

### Estimated Effort
- **Full responsive support:** 25–40 hours
- **Tier 1 — Structural (layout shell + navigation):** ~6 hours
- **Tier 2 — Content pages (dashboard, lists, forms):** ~10–15 hours
- **Tier 3 — Complex components (PDFs, maps, admin panels):** ~10–20 hours

### Recommended Approach
1. Remove the 480px constraint in `app/(app)/layout.tsx`
2. Add responsive breakpoints: mobile (<768px), tablet (768–1024px), desktop (>1024px)
3. Convert inline styles to Tailwind responsive classes progressively
4. Add sidebar navigation for tablet/desktop (keep bottom tabs for mobile)
5. Use 2-column and 3-column grids on wider screens for dashboards and lists

### Priority Order
Mobile (current, maintain) → iPad (high value, moderate effort) → Desktop (lower priority)

---

## Environment

- **Repo:** github.com/csproctor88-star/airfield-app
- **Stack:** Next.js 14.2.35, TypeScript 5.9.3, Supabase SSR 0.8.0, Mapbox GL 3.18.1
- **Branch:** main
- **PWA:** standalone mode, theme_color #0B1120, service worker via @ducanh2912/next-pwa

---

## Suggested Next Steps

1. **Branch for device optimization** — Create `feature/responsive-layout` from main
2. **Start with Tier 1** — Remove 480px lock, add responsive shell, sidebar nav for tablet+
3. **Cleanup sprint** (optional before or after branching):
   - Delete 7 dead files
   - Remove unused aircraft_images directory
   - Run `supabase gen types typescript`
   - Convert PDFLibrary.jsx to TSX
4. **Testing** — No tests exist; consider adding as part of stabilization
5. **RLS re-enablement** — Critical before production
