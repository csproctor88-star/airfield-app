# KDRA demo-base seed (marketing captures)

One-off SQL that seeds **KDRA "Demo Regional Airport"**
(`base_id = ea2b542e-72cc-4300-9037-bfe18c0bf7ae`) to look like a fully-operational
**FAA Part 139 Class III** airport that has been running Glidepath for ~6 months
(history spans 2026-01-24 → 2026-07-23, weighted toward recent weeks). Built for the
civilian marketing screenshots / video captured against the deployed app.

These are **NOT migrations** — do not put them in `supabase/migrations/`. They are a
reproducible record of demo-data seeding, applied directly to the linked DB. Companion:
`../clone-demo-base.sql` (deep-clones a whole base; used to stand up EDGP from KDRA).

## How to run

From the repo root, one file at a time, **in numeric order**:

```
npx supabase db query --linked --file scripts/seed-demo-base-kdra/00_auth_users.sql
npx supabase db query --linked --file scripts/seed-demo-base-kdra/01_roster.sql
...
npx supabase db query --linked --file scripts/seed-demo-base-kdra/91_cleanup_spi003.sql
```

Every file is a single `BEGIN;…COMMIT;` transaction, INSERT/UPDATE-only, with
deterministic `md5('kdra-<table>-…')` ids + `ON CONFLICT DO NOTHING`, so **re-applying is
idempotent**. Writes run in-sandbox with no extra flags; a `DELETE` (file `90`) may need to
be re-run or run via the owner's `!` prefix if the auto-mode classifier blocks it.

## Order & dependencies

| # | File | Notes |
|---|------|-------|
| 00 | `auth_users.sql` | Clones the demo user's `auth.users` row for the 8 fabricated staff. **Must run before `01` and before `14` (SMS)** — `profiles.id` and the SMS author columns FK to `auth.users`. |
| 01 | `roster.sql` | Renames the demo login → **Marcus Delgado** (Airport Operations Manager) and inserts 8 staff `profiles` + `base_members`. Wrapped in `session_replication_role=replica` so it also works if `00` is skipped. |
| 02 | `disable_modules.sql` | Removes `waivers`, `acsi`, `amtr` from `bases.enabled_modules` (military-voiced). |
| 10–18 | cluster seeds | Independent of each other; run after 00–02. `14_sms` **requires** `00`. |
| 90 | `cleanup_aep_agencies.sql` | De-dupes the base-setup's duplicate `aep_response_agencies` (14 → 6); re-points referenced comms results first. Contains a `DELETE`. |
| 91 | `cleanup_spi003.sql` | Rewrites the broken SPI-003 "Daily Self-Inspection Completion Rate" measurements (were 0%) to a realistic high-90s trend. |

## Staff roster (the only record authors)

Demo login `af9a39db…` renamed **Marcus Delgado** (`airfield_manager`). Eight fabricated,
display-only staff (`md5('kdra-staff-<slug>')`, `*@draregional.com`): Karen Whitfield
(accountable_executive), Anthony Ruiz (ops_supervisor), Danielle Pearce / Brian Okafor /
Olivia Brenner (amops / Ops Specialist), Sara Lindqvist (sms_manager), James Holloway
(aep_coordinator), Ramon Castellano (arff_chief).

## Gotchas baked into these files (for anyone adapting them)

- **`profiles.id` FKs to `auth.users`** (the FK is in the `auth` schema, invisible to
  `information_schema` for the linked role). Create `auth.users` rows first, or wrap the
  profiles insert in `SET LOCAL session_replication_role=replica`.
- **Generated columns must not be inserted:** `sms_risk_assessments.{risk_index, risk_band,
  residual_risk_index, residual_risk_band}` and `auth.users.confirmed_at`.
- **UUID literals across a `UNION`/`UNION ALL` need explicit `::uuid` casts** (implicit
  coercion to the target column only happens in a plain `INSERT…SELECT`).
- **Proxy-child tables** (no `base_id`, scoped via a parent FK): `shift_checklist_responses`
  (checklist_id), `field_condition_thirds` (report_id), `aep_comms_check_results` (check_id),
  `ppr_coordination` (entry_id).

## Scope / voice

Civilian §139 voice throughout (self-inspection / NOTAM / ARFF / movement area); real 14 CFR
Part 139 citations only, no fabricated regulatory text; fabricated free-text is expected. No
sensitive personal data. NOTAMs are intentionally not seeded (that module renders the live FAA
feed). File downloads for Local Regs / Read File / Mods attachments 404 by design (no objects
uploaded — list/detail views render).
