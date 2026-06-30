# AMTR Inspection Auto-Checks Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-grade three currently-manual inspection items — 4.2 (transcribe reason documented), 3.1 (PME → N/A for non-military), and 2.3 (skill level vs DAFSC) — in the AMTR record-inspection scan.

**Architecture:** Three changes in the pure `lib/amtr/inspection-engine.ts` gap engine, each setting a checklist `auto_key`. Two new keys (`transcribe_reason`, `skill_levels_attained`) added to the `InspectionAutoKey` union and assigned to items 4.2/2.3 in `DEFAULT_INSPECTION_CHECKLIST`; 3.1 reuses the existing `formal_pme_dates` key. One additive migration backfills `auto_key` on already-seeded per-base checklists. Reuses existing helpers (`skillLevelFromName`, `has`, `summarize`, `live`, `RAT_EXEMPT_STATUSES`).

**Tech Stack:** TypeScript (strict), Vitest, Supabase (Postgres). Spec: `docs/superpowers/specs/2026-06-30-amtr-inspection-autochecks-design.md`.

**Conventions:** `npx tsc --noEmit` + `npx vitest run` pass; commits gated on `npm run build` (RC 0). Co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Migrations applied via `npx supabase db query --linked --file` (never `db push`).

---

## File structure

| File | Change |
|---|---|
| `lib/amtr/inspection-checklist.ts` | Add 2 keys to `InspectionAutoKey`; assign to items 2.3 and 4.2 in `DEFAULT_INSPECTION_CHECKLIST` |
| `lib/amtr/inspection-engine.ts` | New rules for 4.2 and 2.3; status gate on 3.1 (`formal_pme_dates`) |
| `tests/amtr-inspection-engine.test.ts` | Tests for all three |
| `supabase/migrations/2026063000_amtr_checklist_autokeys_batch2.sql` | Backfill `auto_key` for existing bases |

Reference (already present, do not redefine):
- `has = (v) => v != null && String(v).trim() !== ''` (`inspection-engine.ts:39`)
- `summarize(missing, noun)` (`inspection-engine.ts:87`)
- `live(rows)` drops retired (`inspection-engine.ts:45`)
- `skillLevelFromName(name)` → 3/5/7/9 or null (`inspection-engine.ts:57`)
- `RAT_EXEMPT_STATUSES` = Set('Civilian','Contractor','Separated') (imported at `inspection-engine.ts:11`)
- `transcribed` = `Set(d.transcribedRowIds.map(String))` (`inspection-engine.ts:107`)
- `m = d.member`, `set(key, auto, findings)` in `runInspectionScan`

---

## Task 1: 4.2 — transcribe reason documented (`transcribe_reason`)

**Files:**
- Modify: `lib/amtr/inspection-checklist.ts` (union + item 4.2)
- Modify: `lib/amtr/inspection-engine.ts` (new rule)
- Test: `tests/amtr-inspection-engine.test.ts`

- [ ] **Step 1: Write the failing tests** — add inside `describe('runInspectionScan', …)` in `tests/amtr-inspection-engine.test.ts`:

```ts
  it('transcribe_reason: na when nothing transcribed', () => {
    expect(runInspectionScan(baseData()).transcribe_reason.auto).toBe('na')
  })
  it('transcribe_reason: yes when a Records Transcribed 623A entry exists', () => {
    const r = runInspectionScan(baseData({
      transcribedRowIds: ['r1'],
      e623a: [{ id: 'e1', entry_type: 'Records Transcribed' }],
    }))
    expect(r.transcribe_reason.auto).toBe('yes')
  })
  it('transcribe_reason: no when rows are transcribed but no entry documents it', () => {
    const r = runInspectionScan(baseData({
      transcribedRowIds: ['r1'],
      e623a: [{ id: 'e1', entry_type: 'General Training Comment' }],
    }))
    expect(r.transcribe_reason.auto).toBe('no')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t transcribe_reason`
Expected: FAIL — `transcribe_reason` is undefined (key not set).

- [ ] **Step 3: Add the union key + checklist assignment** — in `lib/amtr/inspection-checklist.ts`, add `'transcribe_reason'` to the `InspectionAutoKey` union (after `'monthly_inspection_done'`):

```ts
  | 'monthly_inspection_done'
  | 'transcribe_reason'
```

Then assign item 4.2 (line 72) its key — change:

```ts
  I('4.2', 'If the records were transcribed, is the reason documented?'),
```

to:

```ts
  I('4.2', 'If the records were transcribed, is the reason documented?', 'transcribe_reason'),
```

- [ ] **Step 4: Add the engine rule** — in `lib/amtr/inspection-engine.ts`, immediately after the `monthly_inspection_done` line (currently line 321, `set('monthly_inspection_done', …)`), add:

```ts
  // 4.2 — if any rows were transcribed, the reason must be documented in a
  // "Records Transcribed" 623A entry.
  if (transcribed.size === 0) set('transcribe_reason', 'na')
  else {
    const documented = d.e623a.some((e) => String(e.entry_type ?? '').toLowerCase().includes('transcrib'))
    set('transcribe_reason', documented ? 'yes' : 'no',
      documented ? [] : ["records were transcribed but no 'Records Transcribed' 623A entry documents the reason"])
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t transcribe_reason`
Expected: PASS (3 tests).

- [ ] **Step 6: Type-check, build, commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/inspection-checklist.ts lib/amtr/inspection-engine.ts tests/amtr-inspection-engine.test.ts
git commit -m "feat(amtr): auto-check 4.2 transcribe-reason documented

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 3.1 — PME N/A for non-military (`formal_pme_dates` gate)

**Files:**
- Modify: `lib/amtr/inspection-engine.ts:133` (the `evalSection('haf', …)` call)
- Test: `tests/amtr-inspection-engine.test.ts`

- [ ] **Step 1: Write the failing tests** — add inside `describe('runInspectionScan', …)`:

```ts
  it('formal_pme_dates: na for non-military status (PME does not apply)', () => {
    const formalCatalog = [{ id: 'f1', section: 'haf', course: 'BMT' }]
    const formalProgress = [{ catalog_id: 'f1', start_date: '', complete_date: '' }]
    for (const status of ['Contractor', 'Civilian', 'Separated']) {
      const r = runInspectionScan(baseData({
        member: { id: 'm1', user_id: 'u1', full_name: 'Doe', grade: 'CTR', duty_position: 'AMOPS', dafsc: '1C751', tsc: 'A', status },
        formalCatalog, formalProgress,
      }))
      expect(r.formal_pme_dates.auto).toBe('na')
    }
  })
  it('formal_pme_dates: still flags an Active member missing PME dates', () => {
    const formalCatalog = [{ id: 'f1', section: 'haf', course: 'BMT' }]
    const formalProgress = [{ catalog_id: 'f1', start_date: '2026-01-01', complete_date: '' }]
    const r = runInspectionScan(baseData({ formalCatalog, formalProgress }))   // baseData status = Active
    expect(r.formal_pme_dates.auto).toBe('no')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t formal_pme_dates`
Expected: FAIL — the contractor case currently returns `'no'` (BMT has a started-but-incomplete date), not `'na'`.

- [ ] **Step 3: Add the status gate** — in `lib/amtr/inspection-engine.ts`, change line 133:

```ts
    evalSection('haf', 'formal_pme_dates')
```

to:

```ts
    // PME (BMT/NCOA/SNCOA/Airmanship) is military-only — N/A for non-military.
    if (RAT_EXEMPT_STATUSES.has(String(m.status ?? ''))) set('formal_pme_dates', 'na')
    else evalSection('haf', 'formal_pme_dates')
```

(`evalSection('continuation', 'formal_continuation_dates')` on the next line stays unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t formal_pme_dates`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check, build, commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/inspection-engine.ts tests/amtr-inspection-engine.test.ts
git commit -m "fix(amtr): 3.1 PME reads N/A for Contractor/Civilian/Separated

Fixes contractors flagged for missing BMT/Apprentice Course dates.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 2.3 — skill level vs DAFSC (`skill_levels_attained`)

**Files:**
- Modify: `lib/amtr/inspection-checklist.ts` (union + item 2.3)
- Modify: `lib/amtr/inspection-engine.ts` (new rule)
- Test: `tests/amtr-inspection-engine.test.ts`

- [ ] **Step 1: Write the failing tests** — add inside `describe('runInspectionScan', …)`:

```ts
  describe('skill_levels_attained', () => {
    const skillCat = [
      { id: 's3', category: 'skill_level', name: '1C731 Skill Level' },
      { id: 's5', category: 'skill_level', name: '1C751 Skill Level' },
      { id: 's7', category: 'skill_level', name: '1C771 Skill Level' },
      { id: 'tr', category: 'skill_level', name: 'Trainer' },          // not a skill level
    ]
    const member = (dafsc: string) => ({ id: 'm1', user_id: 'u1', full_name: 'Doe', grade: 'SSgt', duty_position: 'AMOPS', dafsc, tsc: 'A', status: 'Active' })

    it('yes when required levels (DAFSC and below) are attained', () => {
      const qualProgress = [{ catalog_id: 's3', attained: true }, { catalog_id: 's5', attained: true }]
      expect(runInspectionScan(baseData({ member: member('1C751'), qualCatalog: skillCat, qualProgress })).skill_levels_attained.auto).toBe('yes')
    })
    it('no when a required level is not attained', () => {
      const qualProgress = [{ catalog_id: 's3', attained: true }]   // 1C751 missing
      const r = runInspectionScan(baseData({ member: member('1C751'), qualCatalog: skillCat, qualProgress }))
      expect(r.skill_levels_attained.auto).toBe('no')
      expect(r.skill_levels_attained.findings.join(' ')).toContain('1C751 Skill Level')
    })
    it('levels above the DAFSC are not required', () => {
      const qualProgress = [{ catalog_id: 's3', attained: true }, { catalog_id: 's5', attained: true }]
      // 1C771 not attained, but member is a 5-level → not required → yes
      expect(runInspectionScan(baseData({ member: member('1C751'), qualCatalog: skillCat, qualProgress })).skill_levels_attained.auto).toBe('yes')
    })
    it('na for a civilian / unparseable DAFSC', () => {
      expect(runInspectionScan(baseData({ member: member('2101'), qualCatalog: skillCat, qualProgress: [] })).skill_levels_attained.auto).toBe('na')
    })
    it('na when no skill-level quals match the AFSC', () => {
      expect(runInspectionScan(baseData({ member: member('1C751'), qualCatalog: [{ id: 'tr', category: 'skill_level', name: 'Trainer' }], qualProgress: [] })).skill_levels_attained.auto).toBe('na')
    })
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t skill_levels_attained`
Expected: FAIL — `skill_levels_attained` is undefined.

- [ ] **Step 3: Add the union key + checklist assignment** — in `lib/amtr/inspection-checklist.ts`, add `'skill_levels_attained'` to the union (after the `transcribe_reason` line added in Task 1):

```ts
  | 'transcribe_reason'
  | 'skill_levels_attained'
```

Then assign item 2.3 (line 60) — change:

```ts
  I('2.3', 'Has the individual attained their 3, 5, 7 or 9 skill-levels, if so, are all corresponding skill levels annotated?'),
```

to:

```ts
  I('2.3', 'Has the individual attained their 3, 5, 7 or 9 skill-levels, if so, are all corresponding skill levels annotated?', 'skill_levels_attained'),
```

- [ ] **Step 4: Add the engine rule** — in `lib/amtr/inspection-engine.ts`, immediately after the `member_identity` block (currently ends at line 115, before the `2.5 / 2.6` comment at line 117), add:

```ts
  // 2.3 — member has attained the skill level(s) their DAFSC requires (the
  // matching level and every level below). Reuses skillLevelFromName, which
  // encodes the 1C7X1 family; a non-AFSC DAFSC parses to null → na. Applies to
  // contractors too (they hold 3-/5-level quals).
  {
    const memberLevel = skillLevelFromName(m.dafsc)
    if (memberLevel == null) set('skill_levels_attained', 'na')
    else {
      const attained = new Set(d.qualProgress.filter((p) => p.attained === true).map((p) => String(p.catalog_id)))
      const required = live(d.qualCatalog).filter((c) => {
        if (c.category !== 'skill_level') return false
        const lvl = skillLevelFromName(c.name)
        return lvl != null && lvl <= memberLevel
      })
      if (required.length === 0) set('skill_levels_attained', 'na')
      else {
        const missing = required.filter((c) => !attained.has(String(c.id))).map((c) => String(c.name ?? c.id))
        set('skill_levels_attained', missing.length ? 'no' : 'yes', summarize(missing, 'required skill level(s) not attained'))
      }
    }
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t skill_levels_attained`
Expected: PASS (5 tests).

- [ ] **Step 6: Type-check, build, commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/inspection-checklist.ts lib/amtr/inspection-engine.ts tests/amtr-inspection-engine.test.ts
git commit -m "feat(amtr): auto-check 2.3 skill level vs DAFSC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backfill migration for existing bases

**Files:**
- Create: `supabase/migrations/2026063000_amtr_checklist_autokeys_batch2.sql`

Existing per-base `amtr_inspection_checklist` rows for items 2.3 and 4.2 were seeded with `auto_key = NULL`. Without this backfill, the new keys connect only on freshly-seeded bases. (3.1 already has `formal_pme_dates`, so no backfill needed there.)

- [ ] **Step 1: Create the migration file**

```sql
-- Connect the new auto-checks (2.3 skill-level-vs-DAFSC, 4.2 transcribe-reason)
-- to existing per-base inspection checklists. Additive; only fills NULLs so a
-- base that already customized these items is untouched.
update amtr_inspection_checklist set auto_key = 'skill_levels_attained'
  where auto_key is null and item_number = '2.3';
update amtr_inspection_checklist set auto_key = 'transcribe_reason'
  where auto_key is null and item_number = '4.2';
```

- [ ] **Step 2: Apply to the linked DB**

Run: `npx supabase db query --linked --file supabase/migrations/2026063000_amtr_checklist_autokeys_batch2.sql`
Expected: completes without error (no rows returned for UPDATEs).

- [ ] **Step 3: Verify the backfill** — create `/tmp/verify_autokeys.sql`:

```sql
select item_number, auto_key, count(*) n
from amtr_inspection_checklist
where item_number in ('2.3','4.2')
group by item_number, auto_key order by item_number;
```

Run: `npx supabase db query --linked --file /tmp/verify_autokeys.sql`
Expected: 2.3 rows show `skill_levels_attained`, 4.2 rows show `transcribe_reason` (any rows a base explicitly cleared stay NULL — acceptable).

- [ ] **Step 4: Commit the migration**

```bash
git add supabase/migrations/2026063000_amtr_checklist_autokeys_batch2.sql
git commit -m "migrate(amtr): backfill checklist auto_keys for 2.3 + 4.2 auto-checks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full-suite gate + push

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all pass (current baseline 1056 + ~10 new tests).

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean, RC 0.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Record manual smoke (after promotion)**
  - Eaton (Contractor): 3.1 reads **N/A** (no longer flagged for BMT/Apprentice).
  - Erik Greer: 2.3 reflects attained skill levels vs his DAFSC (yes if his required levels are attained).
  - A record with a transcribed row but no "Records Transcribed" 623A entry: 4.2 flags **No**; add the entry → **Yes**.

---

## Self-review

- **Spec coverage:** 4.2 → Task 1; 3.1 → Task 2; 2.3 → Task 3; wiring/migration → Tasks 1/3/4; tests → each task. All spec sections mapped.
- **Type consistency:** new keys `transcribe_reason` (Task 1) and `skill_levels_attained` (Task 3) are spelled identically in the union, checklist assignment, engine `set(...)`, tests, and migration. `formal_pme_dates` reused unchanged.
- **Helper reuse:** `skillLevelFromName`, `has`, `summarize`, `live`, `RAT_EXEMPT_STATUSES`, `transcribed` are all pre-existing (referenced in File structure) — no redefinition.
