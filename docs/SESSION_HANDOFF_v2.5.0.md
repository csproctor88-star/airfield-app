# Session Handoff — v2.5.0 (2026-02-26)

## Project State Summary

**App**: Glidepath — Airfield OPS Management Suite
**Version**: 2.5.0
**Build**: Clean (Vercel deploys successfully)
**Branch**: `main` and `user_management` at commit `7d02042` (in sync)
**Remote**: Up to date with `origin/main` and `origin/user_management`
**Deployment**: Vercel → https://www.glidepathops.com
**Git config**: `user.email=csproctor88@gmail.com`, `user.name=csproctor88-star` (repo-level)

---

## What's Built (13 Complete Modules)

| Module | Route | Status | Key Features |
|--------|-------|--------|--------------|
| Dashboard | `/` | Complete | Weather, advisory, runway status, NAVAID toggles, activity feed, quick actions |
| Discrepancies | `/discrepancies` | Complete | 11 types, full lifecycle, photos, map, notes, work orders |
| Airfield Checks | `/checks` | Complete | 7 check types, camera, map, history |
| Daily Inspections | `/inspections` | Complete | Configurable templates, combined reports, PDF export |
| Waivers | `/waivers` | Complete | AF-505 lifecycle, annual review, PDF/Excel export, 17 KMTC seed records |
| NOTAMs | `/notams` | Complete | Live FAA feed, ICAO search, local NOTAM creation |
| Obstruction Eval | `/obstructions` | Complete | UFC 3-260-01 multi-runway analysis, interactive map |
| Reports | `/reports` | Complete | Daily ops, open discrepancies, trends, aging — all with PDF export |
| Aircraft Database | `/aircraft` | Complete | 1,000+ entries, ACN/PCN comparison, favorites |
| References | `/regulations` | Complete | 70 regulations, PDF viewer, offline cache, My Documents |
| Settings | `/settings` | Complete | Base setup, inspection templates, themes |
| PDF Library | `/library` | Complete | Admin PDF management, text extraction |
| **User Management** | `/users` | **Complete** | Invite, edit, reset password, roles, deactivate/delete |

**Placeholder modules**: Sync & Data (`/sync`)

**Auth pages** (public, no login required):
- `/login` — Sign in / sign up with forgot password
- `/reset-password` — Set new password after recovery email
- `/setup-account` — Invited user creates password
- `/auth/confirm` — Server-side OTP/PKCE token exchange

---

## Architecture Overview

```
41 routes | 130+ source files | 48 migrations | 25+ database tables
```

- **Framework**: Next.js 14.2.35 (App Router) + TypeScript 5.9.3 strict mode
- **Backend**: Supabase (PostgreSQL + Auth + Storage) — SSR 0.8.0 + JS 2.95.3
- **Styling**: Tailwind CSS 3.4.19 with CSS custom properties (light/dark/auto themes)
- **Maps**: Mapbox GL JS 3.18.1
- **PDF**: jsPDF 4.1.0 (export) + react-pdf 10.3.0 (viewing)
- **Excel**: SheetJS 0.18.5
- **Offline**: PWA (next-pwa 10.2.9) + IndexedDB (6 object stores)
- **Demo Mode**: Full offline operation with mock data when Supabase not configured

### Key Patterns
- **CRUD modules**: `lib/supabase/<entity>.ts` — `createClient()` null check returns empty for demo mode
- **Page layout**: `(app)/layout.tsx` wraps authenticated routes in header + bottom nav, 480px max-width
- **Admin APIs**: `app/api/admin/*` routes use service role key via `getAdminClient()`, authenticate caller via cookie
- **Role checks**: `lib/admin/role-checks.ts` — `isSysAdmin()`, `isBaseAdmin()`, `isAdmin()` used in API routes and pages
- **Theme**: CSS custom properties on `:root` / `[data-theme="dark"]` / `[data-theme="light"]`, toggled in Settings
- **Middleware**: `middleware.ts` guards all routes except `/login`, `/reset-password`, `/setup-account`, `/auth/confirm`, `/api/installations`

---

## What Changed in v2.5.0 (This Session)

### User Management Module — Full Build
Built the complete User Management feature from scratch:

**17 new files created:**
- `lib/admin/role-checks.ts` — Permission system
- `lib/admin/user-management.ts` — Client API wrappers
- `components/admin/` — 9 UI components (role-badge, status-badge, user-card, user-list, user-filters, user-detail-modal, invite-user-modal, installation-selector, delete-confirmation-dialog)
- `app/api/admin/invite/route.ts` — Invite API
- `app/api/admin/reset-password/route.ts` — Password reset API
- `app/api/admin/users/[id]/route.ts` — Profile update + delete API
- `app/auth/confirm/route.ts` — Token exchange route
- `app/reset-password/page.tsx` — Password reset page
- `app/setup-account/page.tsx` — Account setup page

**7 existing files modified:**
- `lib/supabase/types.ts` — Added `base_admin` role, `ProfileStatus`, fixed Update type
- `lib/constants.ts` — Added `base_admin` role config, `RANK_OPTIONS`
- `app/(app)/users/page.tsx` — Complete rewrite from placeholder
- `app/(app)/more/page.tsx` — "User Management" replaces "Users & Security"
- `app/login/page.tsx` — Forgot password, deactivation check, last_seen_at
- `app/globals.css` — Badge CSS classes (dark + light theme)
- `middleware.ts` — Public routes for auth flows

**1 new migration:**
- `supabase/migrations/2026022600_user_management.sql`

### Role System
```
sys_admin          → Full access, all bases, can assign any role
base_admin         → Base-scoped admin (manage users, create records)
airfield_manager   → Same permissions as base_admin
namo               → Same permissions as base_admin
amops              → Can create records, no user management
ces, safety, atc   → Read + limited create, no user management
read_only          → View only (enforced at app layer, not DB)
observer           → Mapped to read_only (legacy DB value)
```

### Bug Fixes During Build
1. **Type error**: `{}[]` not assignable to `Installation[]` — cast fix
2. **Update type**: `last_seen_at` missing from profiles Update — derived from Row
3. **Users not loading**: Rewrote fetch to use direct init() loading with separate base lookup Map
4. **Column not found**: `first_name` doesn't exist in DB — switched to `select('*')` with dynamic parsing
5. **Badge readability**: Light theme badges unreadable — added theme-aware CSS classes
6. **CSS syntax error**: Stray `}` breaking Vercel build — restructured layer/override placement
7. **Role filter broken**: DB has `observer` not `read_only` — added mapping
8. **Password reset not sending**: `generateLink()` doesn't send email — switched to `resetPasswordForEmail()`
9. **Reset link broken**: No `/reset-password` page + middleware blocking — created page + auth confirm route + PKCE code exchange

---

## Supabase Configuration Required

The following must be configured in the Supabase dashboard for auth flows to work:

1. **Authentication → URL Configuration → Site URL**: `https://www.glidepathops.com`
2. **Authentication → URL Configuration → Redirect URLs**: Add `https://www.glidepathops.com/**`
3. **Authentication → Email Templates → Invite User**:
   ```html
   <h2>You've been invited to Glidepath</h2>
   <p>You've been invited to join Glidepath Airfield Operations. Click the link below to set up your account.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/setup-account">Set Up Your Account</a></p>
   ```
4. **Authentication → Email Templates → Reset Password**:
   ```html
   <h2>Reset Your Password</h2>
   <p>Click the link below to reset your Glidepath password.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a></p>
   ```
5. **Authentication → Email Templates → Confirm Signup**:
   ```html
   <h2>Confirm Your Email</h2>
   <p>Click the link below to confirm your Glidepath account.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/">Confirm Email</a></p>
   ```

---

## Tech Debt & Cleanup Items

### High Priority (fix before production)
1. **RLS role enforcement missing at DB level** — `read_only` and other non-admin roles can write data if they bypass the UI. Add RLS policies that check `profiles.role` before allowing INSERT/UPDATE/DELETE on operational tables.
2. **70+ `@typescript-eslint/no-explicit-any` suppression comments** in `lib/supabase/` files. Run `supabase gen types typescript` to regenerate types and eliminate most casts.
3. **Duplicate Supabase server auth initialization** — 3 API routes copy-paste the same cookie client setup. Extract to `lib/supabase/server-auth.ts`.

### Medium Priority (cleanup)
4. **Dead files**: `lib/validators.ts` (Zod schemas, mostly unused), `lib/installation.ts` (empty stub), `lib/supabase/middleware.ts` (superseded by root middleware.ts)
5. **`supabase/.temp/` not gitignored** — Auto-generated CLI metadata. Add to `.gitignore`.
6. **`CLAUDE_CODE_PROMPT_USER_MANAGEMENT.md` untracked** — Prompt file in repo root. Add `CLAUDE_CODE_PROMPT*.md` to `.gitignore` or delete.
7. **Waiver number generation duplicated** — Logic exists in both `app/(app)/waivers/new/page.tsx` and `lib/supabase/waivers.ts`. Extract to shared utility.
8. **Console logging in production** — 77+ `console.error/log` calls in `lib/supabase/` files. Consider structured logging or removing for production.

### Low Priority (nice to have)
9. **profiles table schema mismatch** — App expects `first_name`/`last_name` columns but falls back to parsing `name`. Migration `2026022303_add_profile_fields.sql` adds these columns but may not be applied on all environments.
10. **`observer` role in DB** — 4 users have `observer` instead of `read_only`. Consider running `UPDATE profiles SET role = 'read_only' WHERE role = 'observer'` to normalize.
11. **Weather API stub** — `/api/weather` returns placeholder data. METAR integration (aviationweather.gov) is planned.

---

## Database State

**48 migrations** in `supabase/migrations/`, latest: `2026022600_user_management.sql`

**Key tables for User Management:**
- `profiles` — `id, email, name, first_name, last_name, rank, role, status, primary_base_id, is_active, last_seen_at`
- `bases` — `id, name, icao, location, installation_code`
- `base_members` — `base_id, user_id, role` (join table)

**Current profile data:**
- 5 users total: 1 `sys_admin`, 4 `observer` (mapped to `read_only` in app)
- Bases: Selfridge ANG Base (KMTC), Mountain Home AFB (KMUO)

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]         # Required for admin API routes
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://www.glidepathops.com    # Optional, used in password reset redirects
```

---

## Suggested Next Phases

1. **Sync & Data module** — Offline queue, conflict resolution, data export/import
2. **RLS hardening** — Database-level role enforcement for all operational tables
3. **METAR weather integration** — Replace Open-Meteo with aviationweather.gov METAR data
4. **Notification system** — In-app notifications for discrepancy assignments, status changes
5. **Type regeneration** — `supabase gen types typescript` to eliminate `as any` casts
6. **Testing** — Unit tests for role-checks, API routes; E2E tests for auth flows

---

## Branch Strategy

Currently `main` and `user_management` are in sync. Safe to:
- Delete `user_management` branch if no longer needed
- Branch from `main` for the next feature phase

---

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| SRS | `docs/SRS.md` | Software Requirements Specification (1,291 lines) |
| Base Onboarding | `docs/BASE-ONBOARDING.md` | Guide for adding new installations |
| Scaling Assessment | `docs/SCALING-ASSESSMENT.md` | Multi-base architecture assessment |
| Integration Guide | `docs/INTEGRATION_GUIDE.md` | PDF text search integration |
| Waiver Module Plan | `docs/airfield-waivers-module-plan.md` | Waiver feature design |
| User Management Spec | `CLAUDE_CODE_PROMPT_USER_MANAGEMENT.md` | Original requirements for user management |
| Session Handoff v2.4 | `docs/SESSION_HANDOFF_v2.4.0.md` | Previous session state |
| Changelog | `CHANGELOG.md` | Full version history |
