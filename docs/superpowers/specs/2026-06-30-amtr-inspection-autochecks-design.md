# AMTR Inspection — New Auto-Checks Batch — Design

**Date:** 2026-06-30
**Module:** AMTR record-inspection scan (`lib/amtr/inspection-engine.ts`)
**Status:** Draft for review

## Problem / goal

Several inspection checklist items are currently manual ("—" / no `auto_key`). Three
can be auto-graded reliably from existing data, reducing manual review and catching
real gaps. Scope was narrowed against live data (see Non-goals) to avoid false
positives.

## Scope (3 checks)

1. **4.2 — transcribe reason documented** (new auto-check).
2. **3.1 — PME dates → N/A for non-military** (modify the existing `formal_pme_dates`).
3. **2.3 — skill level vs DAFSC** (new auto-check; reframed from a date-check, which
   isn't viable).

## Non-goals (verified against live data, deliberately excluded)

- **2.2 / 2.4 date-checks** — skill levels and SEIs store **no completion date**
  (attained Yes/No only: 58 skill-level + 18 SEI attained rows, 0 with a date); QTP is
  already 100% dated. A "must have a date" check would false-flag every skill-level/SEI
  row and find zero QTP gaps. Excluded.
- **4.3 / 4.11 upgrade evals** — the standard 623A entry types aren't used at this base
  (custom types instead), and `tsc` is mostly null → no reliable "in upgrade" signal.
- **8.2 milestones started** — `amtr_milestone_progress` has no start date.

---

## Check 1 — 4.2 transcribe reason documented (`transcribe_reason`)

**Checklist item:** 4.2 "If the records were transcribed, is the reason documented?"

**Data:** the scan already receives `transcribedRowIds` (ids of rows flagged
transcribed across forms). The base actively uses a `Records Transcribed` 623A
`entry_type` (70 entries).

**Logic:**
- If `transcribedRowIds` is empty → `na` (nothing was transcribed).
- Else if any `d.e623a` entry has `entry_type` containing `"transcrib"`
  (case-insensitive) → `yes`.
- Else → `no`, findings: `"records transcribed but no 'Records Transcribed' 623A entry
  documenting the reason"`.

Applies to everyone.

---

## Check 2 — 3.1 PME N/A for non-military (`formal_pme_dates`, modified)

**Checklist item:** 3.1 "Has all PME attended … been annotated with start and
completion dates? (BMT, NCOA, SNCOA, Airmanship 300-700)".

**Problem:** PME is military Professional Military Education. Contractors/civilians
don't attend it, but the base formal catalog assigns BMT/Apprentice-Course rows, so the
existing rule flags them (confirmed: contractor CTR Eaton flagged `NO` for missing BMT
and Apprentice Course dates).

**Change:** prepend a status gate to the existing `formal_pme_dates` rule:
- If member `status` ∈ `RAT_EXEMPT_STATUSES` (`Civilian`, `Contractor`, `Separated`) →
  `na`.
- Otherwise the existing logic is unchanged (Active/Guard graded as today).

Reuses the engine's existing non-military status set for consistency. (User confirmed
contractors don't do PME; extending to civilians/separated is consistent.)

---

## Check 3 — 2.3 skill level vs DAFSC (`skill_levels_attained`)

**Checklist item:** 2.3 "Has the individual attained their 3, 5, 7 or 9 skill-levels, if
so, are all corresponding skill levels annotated?"

**Reframe:** a date-check isn't possible (no dates stored). Instead verify the member
has **attained the skill level(s) their DAFSC requires** — the matching level and every
level below it. Works identically for contractors and military (a contractor still
holds 3-/5-level quals — confirmed by Erik Greer's record).

**Data:**
- `amtr_members.dafsc` — e.g. `1C751`. The 4th character is the skill-level digit
  (`1C7`**`5`**`1` = 5-level).
- `amtr_qual_catalog` rows with `category = 'skill_level'`, named with the AFSC at that
  level — `"1C731 Skill Level"`, `"1C751 Skill Level"`, `"1C771 Skill Level"`,
  `"1C791 Skill Level"`. (The same category also holds `Trainer`/`Certifier` quals,
  which carry no AFSC token and are ignored by this rule — they're covered by 2.5/2.6.)
- `amtr_qual_progress.attained` (boolean).

**AFSC parsing helpers (pure, unit-tested):**
- `parseAfscLevel(s)`: match the first AFSC token `\d[A-Z]\d\d\d` in `s`; return
  `{ family: chars[0..2] + char[4], level: Number(char[3]) }`, or `null` if no match.
  - `"1C751"` → `{ family: "1C71", level: 5 }`
  - `"1C731 Skill Level"` → `{ family: "1C71", level: 3 }`
  - `"2101"` (civilian series), `""`, `"Trainer"` → `null`

**Logic:**
- `memberAfsc = parseAfscLevel(member.dafsc)`. If `null` → `na` (civilian job series,
  no AFSC, or unparseable — skill-level requirement doesn't apply).
- `required` = live `skill_level` quals whose `parseAfscLevel(name)` is non-null, shares
  `memberAfsc.family`, and has `level <= memberAfsc.level`.
- If `required` is empty → `na` (this AFSC's levels aren't in the catalog).
- `attained` = set of `catalog_id` where `amtr_qual_progress.attained === true`.
- `missing` = required quals whose id is not in `attained`.
- `missing.length ? 'no' : 'yes'`, findings list the missing skill-level names
  (`summarize(missing, 'required skill level(s) not attained')`).

**Worked examples** (member family `1C71`):
- DAFSC `1C751`, attained 1C731 + 1C751 → `yes`.
- DAFSC `1C751`, attained 1C731 only (1C751 not attained) → `no`, findings:
  `"1 required skill level(s) not attained: 1C751 Skill Level"`.
- DAFSC `1C771`, attained 1C731 + 1C751 (not 1C771) → `no` (1C771 required & missing;
  1C791 is above the member's level so not required).
- Civilian DAFSC `2101` → `na`.

---

## Wiring & data

- Add two keys to the `InspectionAutoKey` union (`lib/amtr/inspection-checklist.ts`):
  `skill_levels_attained`, `transcribe_reason`. Assign them in
  `DEFAULT_INSPECTION_CHECKLIST` (item 2.3 → `skill_levels_attained`, item 4.2 →
  `transcribe_reason`). 3.1 keeps `formal_pme_dates`.
- The engine (`runInspectionScan`) sets the two new keys and adds the status gate to
  `formal_pme_dates`.
- **One migration** — `supabase/migrations/2026063000_amtr_checklist_autokeys_batch2.sql`:
  backfill `amtr_inspection_checklist.auto_key` on existing per-base rows
  (`UPDATE … SET auto_key = '…' WHERE auto_key IS NULL AND item_number = '2.3'`, and
  `'4.2'`), so already-seeded bases connect the new keys. Follows the precedent
  `2026062005_amtr_checklist_autokeys_backfill.sql`. Additive — old code ignores unknown
  keys; applied per the `db query --linked --file` convention (no `db push`).
- New auto-checks pre-fill the suggested Y/N/N-A only; inspectors still override, and the
  results flow into the editable detail / corrective-action UI and the 623A entry exactly
  like every other rule.

## Testing

Unit tests in `tests/amtr-inspection-engine.test.ts` (and AFSC helper tests):
- `parseAfscLevel`: AFSC token, embedded-in-name, civilian series, blank, Trainer.
- `skill_levels_attained`: yes / missing-required / above-level-not-required / civilian
  → na / no-catalog → na.
- `transcribe_reason`: na (nothing transcribed) / yes (entry present) / no (transcribed,
  no entry).
- `formal_pme_dates`: na for Contractor/Civilian/Separated; unchanged for Active/Guard.

## Verification

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` green.
- Apply the migration to the linked DB; confirm `amtr_inspection_checklist` rows for 2.3
  and 4.2 now carry the new `auto_key`s.
- Live smoke (after promotion): Eaton (Contractor) → 3.1 reads N/A; Erik Greer →
  2.3 reflects his attained skill levels vs DAFSC; a record with a transcribed row but
  no Records-Transcribed entry → 4.2 flags.
