# Glidepath Training Guide — Coverage for v2.34 Modules

**Date:** 2026-06-01
**Status:** Design approved; pending implementation plan
**Author:** Claude (with csproctor88)

## Problem

The in-app Glidepath Help & Training page (`/help`) is data-driven from the
`MODULES` array in `lib/training/modules.ts` and currently carries 27 module
guides. The v2.34 release announces several modules that have **no training
guide**:

- **AMTR** (`/amtr`) — Airfield Management Training Record. A release headline
  (now surfaced in nav this cycle), USAF-only.
- **Records Export** (`/settings/exports`) — new feature, announced; available
  to both base types.
- **Civilian FAA Part 139 modules** — **SMS**, **§139.303 Training**, **AEP**,
  **Field Conditions / TALPA**, **WHMP**. All announced, all civilian-only.

A second gap: the help page does **not** gate guides by airport type. It filters
only by role/search, so a civilian base sees USAF-only guides (SCN, ACSI) and a
USAF base would see the new civilian guides. Base configuration is already
correct here — `lib/modules-config.ts` carries all 23 module keys (incl. the new
ones) with descriptions, use-cases, and reg cites, gated by `appliesTo`; and
`lib/base-setup-guide.ts` (`Record<WizardStepKey, StepGuide>`) covers all 17
wizard steps including the new civilian `aepagencies` step. Only the **training
guide** is out of sync.

## Goal

Bring the training guide to parity with the shipped module set before cutting
v2.34: author the seven missing guides and add airport-type gating to the help
page so each base type sees exactly the guides for the modules it has.

## Non-goals

- Screenshots for the new guides. Guides ship **text-only**; the user captures
  PNGs into `public/training/` and wires filenames afterward (caption-first:
  final captions are written against the real image, not before it exists).
- Fixing the pre-existing nav-reorg drift in the 27 existing guides + Quick
  Start ("Operations" → "Daily Operations", "Settings" → "Admin"). Noted as an
  optional follow-up; **new** guides use the correct current section names.
- No new `TrainingRole` values. The role enum is reused across both base types.

## Design

### 1. Type + gating (`lib/training/modules.ts`)

Add an optional field to `ModuleRef`:

```ts
import type { AirportType } from '@/lib/airport-mode'
// ...
appliesTo?: AirportType[]   // omitted = both modes; ['usaf'] / ['faa_part139'] = single mode
```

Add a small helper (mirroring `moduleAppliesToAirport` in `modules-config.ts`):

```ts
export function moduleRefAppliesToAirport(
  m: ModuleRef,
  airportType: AirportType | null | undefined,
): boolean {
  if (!m.appliesTo) return true
  if (!airportType) return true // unknown mode → fail open
  return m.appliesTo.includes(airportType)
}
```

Set `appliesTo` on the type-specific guides (existing + new) so the page is
consistent for **both** base types:

- USAF-only: `acsi`, `scn`, **`amtr`** (new)
- Civilian-only: **`sms`**, **`training-part139`**, **`aep`**,
  **`field-conditions`**, **`whmp`** (new)
- Both (default / omitted): everything else, including new **`records-export`**

### 2. Seven new guide entries

Each is a full `ModuleRef` (overview, keyFeatures, howToAccess, workflow, faq,
relatedModules, readMinutes). `screenshots` omitted (user wires later).

| id | name | path | appliesTo | icon (lucide) |
|---|---|---|---|---|
| `amtr` | Training Records (AMTR) | `/amtr` | `['usaf']` | GraduationCap / ClipboardList |
| `records-export` | Records Export | `/settings/exports` | — (both) | Download / Archive |
| `sms` | Safety Management System | `/sms` | `['faa_part139']` | ShieldCheck |
| `training-part139` | Training (§139.303) | `/training` | `['faa_part139']` | GraduationCap |
| `aep` | Airport Emergency Plan | `/aep` | `['faa_part139']` | Siren / Radio |
| `field-conditions` | Field Conditions / TALPA | `/field-conditions` | `['faa_part139']` | Snowflake / Gauge |
| `whmp` | Wildlife Hazard Management Plan | `/wildlife/whmp` | `['faa_part139']` | Bird |

Insertion order: place new entries near related existing guides (AMTR after
`users`/compliance cluster; civilian modules grouped; Records Export near
`settings`). Final ordering decided during implementation to read sensibly in
the role-filtered grid.

**Content sourcing — anti-fabrication.** Guide prose is written by reading each
module's actual implementation (page + lib), plus reusing the descriptions and
reg citations already present in `lib/modules-config.ts` (14 CFR §139.401–415,
AC 150/5200-37A, §139.303, §139.325, AC 150/5200-30D, §139.337, etc.). No reg
paragraph text is invented; only references that already exist in the codebase
are restated.

**Roles.** Civilian guides take sensible tags from the existing `TrainingRole`
set, e.g. SMS → ops core + `safety`; AEP/Field Conditions/WHMP/§139.303 →
ops core (+ `safety` where it fits). AMTR → ops core (airfield_manager / namo /
amops / base_admin / sys_admin). Records Export → admin-ish (sys_admin /
base_admin + ops core).

### 3. Help page (`app/(app)/help/page.tsx`)

- Read `const airportType = currentInstallation?.airport_type ?? null` from
  `useInstallation()` (same source the base-config modules page uses).
- Filter `MODULES` through `moduleRefAppliesToAirport(m, airportType)` before
  the existing role/search/reviewed filters.
- The Modules count pill and the "X of Y reviewed" total reflect the **gated**
  set, not the raw 34.
- The `/help/[module-id]` detail route renders any id in `MODULES`; gating only
  affects which cards are listed, so a direct link to a non-applicable id still
  resolves (acceptable — not linked in the gated grid).

### 4. Suggested screenshots (for the user's later capture pass)

Per new module, a short shot list (filename convention `/<module-id>_N.png`
under `public/training/`) is recorded so the user knows what to capture. Final
captions are authored against the real images (caption-first rule). Indicative:

- `amtr`: roster view; a member's 1098 with task → auto-623A; import/export
  round-trip dialog.
- `records-export`: the Records Export builder (range + output kinds); the
  offline viewer; the tamper-evident cover/manifest.
- `sms`: hazard register + 5×5 risk matrix; SPI dashboard.
- `training-part139`: compliance matrix; a record with expiry/renewal chain.
- `aep`: versioned plan + AE sign-off; agency roster / comms-check.
- `field-conditions`: per-third RwyCC matrix; generated FICON NOTAM text.
- `whmp`: annual WHMP with AE sign-off countdown; species register →
  promote-to-SMS-hazard.

## Testing

- `npx tsc --noEmit` — the `appliesTo: AirportType[]` addition + new entries
  type-check; the `Record`-keyed base guide is unaffected.
- `npm run build` — gate (vitest-pass ≠ build-pass).
- `npx vitest run` — existing suite stays green.
- Optional unit test: `moduleRefAppliesToAirport` returns the right set for
  `usaf` / `faa_part139` / `null`, and the new ids carry the expected
  `appliesTo` (a small guard so a future edit can't silently un-gate a civilian
  guide onto USAF bases).

## Risks / notes

- **Module count change**: a USAF base sees 27 − civilian-only + AMTR +
  Records Export; a civilian base sees 27 − USAF-only (SCN/ACSI/AMTR) +
  5 civilian + Records Export. Both intended.
- **Content accuracy** is the main quality risk — mitigated by reading each
  module's real implementation before writing its guide.
