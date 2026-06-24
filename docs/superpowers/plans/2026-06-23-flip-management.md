# FLIP Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the single-file FLIP Tracker prototype into Glidepath as a role-gated, base-scoped `/flip` module that serves as the DAFMAN 13-204V2 ¶2.5.2.18 electronic FLIPs Continuity Binder — Account Overview + References, a non-procedural FLIP Changes pipeline with AFM approval, and FLIP Reviews with the reg-required log fields plus a sequential Custodian→NAMO→AFM sign-off.

**Architecture:** Per-base tables with RLS via the matrix helpers (`user_has_base_access` + `user_has_permission`); two authorization layers (global `flip:*` permission keys + an AMTR-style `flip_role_assignments` table managed from an admin matrix); a `SECURITY DEFINER` RPC (`flip_sign_review`) that derives the signer from `auth.uid()` and enforces role + sequence + permanence; a private `flip` storage bucket served through an authenticated `/api/flip-file` proxy; sign writes routed through the offline write queue; client-side PDF via `lib/pdf-utils.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (Postgres + RLS + Storage + RPC), vitest, jsPDF (+ autotable), Sonner toasts, lucide-react. Theme-aware CSS tokens (`var(--color-*)`), no raw Tailwind greys.

**Reference spec:** `docs/superpowers/specs/2026-06-23-flip-management-design.md`

**Conventions (do not violate):**
- Migrations: one statement-group per file, applied with `npx supabase db query --linked --file <path>` (NEVER `db push`). After applying a migration that creates an object, verify with a `SELECT`.
- Commits gated on `npm run build` (RC 0) — vitest passing is not sufficient. Also run `npx tsc --noEmit` and `npx vitest run`.
- TypeScript strict + ES-target quirk: iterate `Set`/`Map` via `Array.from(...)`, never `for...of` over a Set.
- `lib/supabase/*` modules import the client via `import { createClient } from './client'` and wrap with a local `db()` helper; user-facing errors go through `friendlyError` from `@/lib/utils`.
- Commit co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Migration numbers used (sequential from current HEAD `2026062303`):**
- `2026062304_flip_permissions.sql`
- `2026062305_flip_management.sql`
- `2026062306_flip_storage_bucket.sql`
- `2026062307_flip_sign_rpc.sql`

---

## File structure

**Create:**
- `supabase/migrations/2026062304_flip_permissions.sql` — `flip:*` permission keys + role grants.
- `supabase/migrations/2026062305_flip_management.sql` — 8 tables + RLS.
- `supabase/migrations/2026062306_flip_storage_bucket.sql` — private `flip` bucket + storage RLS.
- `supabase/migrations/2026062307_flip_sign_rpc.sql` — `flip_sign_review` RPC + EXECUTE grant.
- `lib/flip/roles.ts` — pure role/slot/sequence logic + labels.
- `tests/flip-roles.test.ts` — unit tests for the pure logic (regression-guard invariants).
- `lib/supabase/flip.ts` — types + CRUD for all FLIP entities + sign wrapper.
- `lib/supabase/flip-storage.ts` — upload helper + `flipFileUrl`.
- `app/api/flip-file/route.ts` — authenticated download proxy.
- `lib/flip-pdf.ts` — signed-review PDF generator.
- `app/(app)/flip/page.tsx` — module shell + Home (Account Overview + References).
- `app/(app)/flip/changes/page.tsx` — FLIP Changes pipeline. *(See Task 17 note: single-page tab shell vs route per page — this plan uses one `/flip` route with in-page tabs to match the prototype's nav; sub-pages are components, not routes.)*
- `components/flip/editable-section.tsx` — reusable Edit/Save text block.
- `components/flip/flip-list-panel.tsx` — Local FLIP List add/remove.
- `components/flip/references-panel.tsx` — reference cards + add-ref modal (real upload).
- `components/flip/change-board.tsx` — pipeline board.
- `components/flip/change-card.tsx` — one collapsible change card + stage actions.
- `components/flip/coordinate-modal.tsx` — new-change modal.
- `components/flip/reviews-panel.tsx` — reviews list + completed-review card.
- `components/flip/document-review-modal.tsx` — review modal (dropdown-only rows, discrepancy toggle, date_corrected).
- `components/flip/review-signoff.tsx` — sequential sign-off boxes.
- `app/(app)/flip/roles/page.tsx` — FLIP roles admin matrix (mirrors AMTR).

**Modify:**
- `lib/permissions.ts` — add `PERM.FLIP_*`.
- `lib/modules-config.ts` — add `flip` module entry + `'flip'` to `ModuleKey`.
- `lib/sidebar-config.ts` — add `/flip` nav item.
- `components/layout/sidebar-nav.tsx` — add `'/flip': 'flip:view'` to `HREF_TO_VIEW_PERM`.
- `lib/airport-mode.ts` — add FLIP role labels (custodian/alternate) if not covered.
- `lib/sync/write-queue.ts` — add `'flip_review_sign'` to the `WriteType` union.
- `lib/sync/handlers.ts` — add + register `flipReviewSignHandler`.

---

# PHASE 1 — Schema, permissions, storage, RPC, role logic

## Task 1: FLIP permission keys (migration + PERM constants)

**Files:**
- Create: `supabase/migrations/2026062304_flip_permissions.sql`
- Modify: `lib/permissions.ts` (add to the `PERM` object near the `AMTR_*` block)

- [ ] **Step 1: Write the permissions migration**

```sql
-- 2026062304_flip_permissions.sql
-- FLIP Management module permission keys + role grants.
-- Layer A of the FLIP authorization model (module/admin/export access).
-- Per-record action authority lives in flip_role_assignments (Layer B).

INSERT INTO permissions (key, label, category, description) VALUES
  ('flip:view',   'View FLIP Management', 'flip', 'View FLIP Continuity Binder, changes, and reviews'),
  ('flip:write',  'Edit FLIP Records',    'flip', 'Edit text sections, FLIP list, references, changes, and reviews'),
  ('flip:manage', 'Manage FLIP Roles',    'flip', 'Assign FLIP roles (custodian, alternate, NAMO, AFM)'),
  ('flip:export', 'Export FLIP Data',     'flip', 'Generate FLIP review and continuity PDFs')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- sys_admin gets everything
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'flip:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- AFM, NAMO, base_admin + civilian parallels get all flip:* keys
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin'),
             ('accountable_executive'), ('ops_supervisor')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'flip:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

-- AMOPS: view/write/export, no manage
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'flip:view'),
  ('amops', 'flip:write'),
  ('amops', 'flip:export')
ON CONFLICT (role, permission_key) DO NOTHING;

-- read_only / safety / atc: view only
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, 'flip:view'
FROM (VALUES ('read_only'), ('safety'), ('atc')) AS r(role)
ON CONFLICT (role, permission_key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062304_flip_permissions.sql`
Expected: no error.

- [ ] **Step 3: Verify the keys landed**

Create a temp verify file and run it (one SELECT per file — only the last statement's rows return):
Run: `npx supabase db query --linked --file <(echo "SELECT key FROM permissions WHERE key LIKE 'flip:%' ORDER BY key;")`
Expected rows: `flip:export`, `flip:manage`, `flip:view`, `flip:write`.

- [ ] **Step 4: Add PERM constants**

In `lib/permissions.ts`, inside the `export const PERM = { ... } as const` object, immediately after the `AMTR_EXPORT: 'amtr:export',` line, add:

```typescript
  // FLIP Management
  FLIP_VIEW:                            'flip:view',
  FLIP_WRITE:                           'flip:write',
  FLIP_MANAGE:                          'flip:manage',
  FLIP_EXPORT:                          'flip:export',
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/2026062304_flip_permissions.sql lib/permissions.ts
git commit -m "FLIP: add flip:* permission keys + role grants"
```

---

## Task 2: FLIP role/slot/sequence logic (TDD pure module)

**Files:**
- Create: `lib/flip/roles.ts`
- Test: `tests/flip-roles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/flip-roles.test.ts
import { describe, it, expect } from 'vitest'
import {
  rolesForSlot, nextSlot, canSignSlot,
  type SignoffState, type FlipRole,
} from '@/lib/flip/roles'

const empty: SignoffState = { custodian_signed_at: null, namo_signed_at: null, afm_signed_at: null }
const custDone: SignoffState = { custodian_signed_at: '2026-06-23T00:00:00Z', namo_signed_at: null, afm_signed_at: null }
const namoDone: SignoffState = { custodian_signed_at: '2026-06-23T00:00:00Z', namo_signed_at: '2026-06-23T01:00:00Z', afm_signed_at: null }
const allDone: SignoffState = { custodian_signed_at: 'x', namo_signed_at: 'x', afm_signed_at: 'x' }

describe('rolesForSlot', () => {
  it('custodian slot accepts custodian or alternate', () => {
    expect(rolesForSlot('custodian')).toEqual(['custodian', 'alternate'])
  })
  it('namo slot accepts only namo', () => {
    expect(rolesForSlot('namo')).toEqual(['namo'])
  })
  it('afm slot accepts only afm', () => {
    expect(rolesForSlot('afm')).toEqual(['afm'])
  })
})

describe('nextSlot — sequential order', () => {
  it('empty → custodian first', () => expect(nextSlot(empty)).toBe('custodian'))
  it('custodian signed → namo next', () => expect(nextSlot(custDone)).toBe('namo'))
  it('namo signed → afm next', () => expect(nextSlot(namoDone)).toBe('afm'))
  it('all signed → null', () => expect(nextSlot(allDone)).toBeNull())
})

describe('canSignSlot — gates by turn AND role', () => {
  const cust: FlipRole[] = ['custodian']
  const alt: FlipRole[] = ['alternate']
  const namo: FlipRole[] = ['namo']
  const afm: FlipRole[] = ['afm']

  it('custodian can sign custodian slot when it is its turn', () => {
    expect(canSignSlot(cust, 'custodian', empty)).toBe(true)
  })
  it('alternate can also sign the custodian slot', () => {
    expect(canSignSlot(alt, 'custodian', empty)).toBe(true)
  })
  it('NAMO cannot sign before custodian (out of sequence)', () => {
    expect(canSignSlot(namo, 'namo', empty)).toBe(false)
  })
  it('NAMO can sign once custodian is done', () => {
    expect(canSignSlot(namo, 'namo', custDone)).toBe(true)
  })
  it('AFM cannot sign before NAMO', () => {
    expect(canSignSlot(afm, 'afm', custDone)).toBe(false)
  })
  it('AFM signs last, after NAMO', () => {
    expect(canSignSlot(afm, 'afm', namoDone)).toBe(true)
  })
  it('wrong role cannot sign even on its turn', () => {
    expect(canSignSlot(cust, 'namo', custDone)).toBe(false)
  })
  it('a user with multiple roles is allowed if any matches', () => {
    expect(canSignSlot(['custodian', 'afm'], 'afm', namoDone)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/flip-roles.test.ts`
Expected: FAIL — cannot resolve `@/lib/flip/roles`.

- [ ] **Step 3: Implement the module**

```typescript
// lib/flip/roles.ts
// Pure FLIP role + signature-sequence logic. No I/O. Mirrors the
// server-side checks in flip_sign_review (2026062307). Keep in sync.

export type FlipRole = 'custodian' | 'alternate' | 'namo' | 'afm'
export type FlipSignSlot = 'custodian' | 'namo' | 'afm'

export const FLIP_ROLES: FlipRole[] = ['custodian', 'alternate', 'namo', 'afm']

// USAF default labels. UI resolves NAMO/AFM dual-mode labels via airport-mode;
// these are the fallback/admin-matrix labels.
export const FLIP_ROLE_LABELS: Record<FlipRole, string> = {
  custodian: 'Primary FLIP Custodian',
  alternate: 'Alternate FLIP Custodian',
  namo: 'NAMO',
  afm: 'AFM',
}

export const SLOT_ORDER: FlipSignSlot[] = ['custodian', 'namo', 'afm']

export const SLOT_LABELS: Record<FlipSignSlot, string> = {
  custodian: 'FLIP Custodian',
  namo: 'NAMO',
  afm: 'AFM (Final Approval)',
}

export type SignoffState = {
  custodian_signed_at: string | null
  namo_signed_at: string | null
  afm_signed_at: string | null
}

/** Roles permitted to sign a given slot. */
export function rolesForSlot(slot: FlipSignSlot): FlipRole[] {
  switch (slot) {
    case 'custodian': return ['custodian', 'alternate']
    case 'namo': return ['namo']
    case 'afm': return ['afm']
  }
}

/** The next slot that must be signed in sequence, or null if fully signed. */
export function nextSlot(s: SignoffState): FlipSignSlot | null {
  if (!s.custodian_signed_at) return 'custodian'
  if (!s.namo_signed_at) return 'namo'
  if (!s.afm_signed_at) return 'afm'
  return null
}

/** True iff `myRoles` may sign `slot` right now: it is this slot's turn AND a role matches. */
export function canSignSlot(
  myRoles: Iterable<FlipRole>,
  slot: FlipSignSlot,
  state: SignoffState,
): boolean {
  if (nextSlot(state) !== slot) return false
  const allowed = rolesForSlot(slot)
  return Array.from(myRoles).some((r) => allowed.includes(r))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/flip-roles.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/flip/roles.ts tests/flip-roles.test.ts
git commit -m "FLIP: add pure role/slot/sequence logic with tests"
```

---

## Task 3: Core tables + RLS

**Files:**
- Create: `supabase/migrations/2026062305_flip_management.sql`

- [ ] **Step 1: Write the tables migration**

```sql
-- 2026062305_flip_management.sql
-- FLIP Management module tables. All per-base, RLS via matrix helpers.

-- 1. Editable rich-text sections (one row per base per section_key)
CREATE TABLE flip_text_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL CHECK (section_key IN
                ('acct_info','appt_letter','ordering','responsibilities','change_directions')),
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (base_id, section_key)
);

-- 2. Local FLIP List — sole source for the review dropdown
CREATE TABLE flip_list (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_list_base ON flip_list(base_id);

-- 3. Reference documents (real files in the flip bucket)
CREATE TABLE flip_references (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('pdf','docx','pptx','xlsx','other')),
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_references_base ON flip_references(base_id);

-- 4. Non-procedural FLIP change pipeline
CREATE TABLE flip_changes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  flip_title         TEXT NOT NULL,
  notam              TEXT,
  details            TEXT,
  submitted_by_name  TEXT NOT NULL,
  submitted_by_user  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage              TEXT NOT NULL DEFAULT 'coordination'
                       CHECK (stage IN ('coordination','submitted','completed')),
  rejected           BOOLEAN NOT NULL DEFAULT FALSE,
  afm_approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  afm_approved_at    TIMESTAMPTZ,
  creation_date      DATE,
  processed_date     DATE,
  published_date     DATE,
  posted_initials    TEXT,
  posted_date        DATE,
  pdf_filename       TEXT,
  pdf_storage_path   TEXT,
  coordinated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_changes_base_stage ON flip_changes(base_id, stage);

-- 5. Review header + items
CREATE TABLE flip_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  cycle       TEXT NOT NULL,
  review_date DATE NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_reviews_base ON flip_reviews(base_id);

CREATE TABLE flip_review_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         UUID NOT NULL REFERENCES flip_reviews(id) ON DELETE CASCADE,
  base_id           UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  flip_title        TEXT NOT NULL,
  effective_date    DATE,
  discrepancy       BOOLEAN NOT NULL DEFAULT FALSE,
  discrepancy_note  TEXT,
  corrective_action TEXT,
  date_corrected    DATE,
  sort_order        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_flip_review_items_review ON flip_review_items(review_id);

-- 6. Review sign-offs (written ONLY by flip_sign_review RPC)
CREATE TABLE flip_review_signoffs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           UUID NOT NULL UNIQUE REFERENCES flip_reviews(id) ON DELETE CASCADE,
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  custodian_signed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  custodian_signed_at TIMESTAMPTZ,
  namo_signed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  namo_signed_at      TIMESTAMPTZ,
  afm_signed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  afm_signed_at       TIMESTAMPTZ
);

-- 7. Per-module role assignments (Layer B; multiple roles per user)
CREATE TABLE flip_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('custodian','alternate','namo','afm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, user_id, role)
);
CREATE INDEX idx_flip_roles_base_user ON flip_role_assignments(base_id, user_id);

-- ===== RLS =====
ALTER TABLE flip_text_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_list              ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_references        ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_changes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_review_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_review_signoffs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_role_assignments  ENABLE ROW LEVEL SECURITY;

-- Standard view/write tables (text sections, list, references, changes, reviews, items)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['flip_text_sections','flip_list','flip_references',
                           'flip_changes','flip_reviews','flip_review_items']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON %1$s FOR SELECT TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
      CREATE POLICY "%1$s_insert" ON %1$s FOR INSERT TO authenticated
        WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
      CREATE POLICY "%1$s_update" ON %1$s FOR UPDATE TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
      CREATE POLICY "%1$s_delete" ON %1$s FOR DELETE TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
    $f$, t);
  END LOOP;
END $$;

-- Sign-offs: SELECT only for clients. All writes go through flip_sign_review (definer).
CREATE POLICY "flip_review_signoffs_select" ON flip_review_signoffs FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));

-- Role assignments: SELECT on flip:view; write on flip:manage
CREATE POLICY "flip_roles_select" ON flip_role_assignments FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
CREATE POLICY "flip_roles_write" ON flip_role_assignments FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:manage'));
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062305_flip_management.sql`
Expected: no error.

- [ ] **Step 3: Verify tables + RLS**

Run: `npx supabase db query --linked --file <(echo "SELECT tablename FROM pg_tables WHERE tablename LIKE 'flip_%' ORDER BY tablename;")`
Expected rows: `flip_changes`, `flip_list`, `flip_references`, `flip_review_items`, `flip_review_signoffs`, `flip_reviews`, `flip_role_assignments`, `flip_text_sections`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062305_flip_management.sql
git commit -m "FLIP: add module tables + RLS"
```

---

## Task 4: Private storage bucket + storage RLS

**Files:**
- Create: `supabase/migrations/2026062306_flip_storage_bucket.sql`

Path convention for the `flip` bucket: `<base_id>/references/<uuid>.<ext>` and `<base_id>/changes/<uuid>.pdf` — **base_id is the first path segment**, so `split_part(name,'/',1)` is the base.

- [ ] **Step 1: Write the storage migration**

```sql
-- 2026062306_flip_storage_bucket.sql
-- Private 'flip' bucket for reference docs + submitted-change PDFs.
-- Path: <base_id>/references/<uuid> | <base_id>/changes/<uuid>

INSERT INTO storage.buckets (id, name, public)
VALUES ('flip', 'flip', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "flip_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
  );

CREATE POLICY "flip_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
    AND user_has_permission(auth.uid(), 'flip:write')
  );

CREATE POLICY "flip_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
    AND user_has_permission(auth.uid(), 'flip:write')
  );
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db query --linked --file supabase/migrations/2026062306_flip_storage_bucket.sql`
Then: `npx supabase db query --linked --file <(echo "SELECT id, public FROM storage.buckets WHERE id = 'flip';")`
Expected: one row `flip | f`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026062306_flip_storage_bucket.sql
git commit -m "FLIP: add private flip storage bucket + RLS"
```

---

## Task 5: Sign RPC (`flip_sign_review`)

**Files:**
- Create: `supabase/migrations/2026062307_flip_sign_rpc.sql`

- [ ] **Step 1: Write the RPC migration**

```sql
-- 2026062307_flip_sign_rpc.sql
-- Sequential, role-gated, permanent FLIP review sign-off.
-- The ONLY writer of flip_review_signoffs.* signature columns.
-- Mirrors the pure logic in lib/flip/roles.ts. Keep in sync.

CREATE OR REPLACE FUNCTION public.flip_sign_review(
  p_review_id UUID, p_slot TEXT
) RETURNS flip_review_signoffs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_base    UUID;
  v_row     flip_review_signoffs;
  v_roles   TEXT[];
  v_role_ok BOOLEAN;
BEGIN
  IF p_slot NOT IN ('custodian','namo','afm') THEN
    RAISE EXCEPTION 'flip_sign_review: invalid slot %', p_slot;
  END IF;

  SELECT base_id INTO v_base FROM flip_reviews WHERE id = p_review_id;
  IF v_base IS NULL THEN RAISE EXCEPTION 'flip_sign_review: review not found'; END IF;

  -- Layer A
  IF NOT (user_has_base_access(v_caller, v_base) AND user_has_permission(v_caller, 'flip:write')) THEN
    RAISE EXCEPTION 'flip_sign_review: not authorized';
  END IF;

  -- Layer B: role permitted for this slot
  v_roles := CASE p_slot
    WHEN 'custodian' THEN ARRAY['custodian','alternate']
    WHEN 'namo'      THEN ARRAY['namo']
    WHEN 'afm'       THEN ARRAY['afm']
  END;
  SELECT EXISTS (
    SELECT 1 FROM flip_role_assignments a
    WHERE a.base_id = v_base AND a.user_id = v_caller AND a.role = ANY(v_roles)
  ) INTO v_role_ok;
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'flip_sign_review: caller not authorized to sign slot %', p_slot;
  END IF;

  -- Lazily create the signoff row, then lock it for this txn.
  INSERT INTO flip_review_signoffs (review_id, base_id)
    VALUES (p_review_id, v_base)
    ON CONFLICT (review_id) DO NOTHING;
  SELECT * INTO v_row FROM flip_review_signoffs WHERE review_id = p_review_id FOR UPDATE;

  -- Sequence: custodian -> namo -> afm
  IF p_slot = 'namo' AND v_row.custodian_signed_at IS NULL THEN
    RAISE EXCEPTION 'flip_sign_review: custodian must sign first';
  END IF;
  IF p_slot = 'afm' AND v_row.namo_signed_at IS NULL THEN
    RAISE EXCEPTION 'flip_sign_review: NAMO must sign first';
  END IF;

  -- Permanence
  IF (p_slot = 'custodian' AND v_row.custodian_signed_at IS NOT NULL)
  OR (p_slot = 'namo'      AND v_row.namo_signed_at      IS NOT NULL)
  OR (p_slot = 'afm'       AND v_row.afm_signed_at       IS NOT NULL) THEN
    RAISE EXCEPTION 'flip_sign_review: % slot already signed', p_slot;
  END IF;

  EXECUTE format(
    'UPDATE flip_review_signoffs SET %I = $1, %I = now() WHERE review_id = $2 RETURNING *',
    p_slot || '_signed_by', p_slot || '_signed_at'
  ) INTO v_row USING v_caller, p_review_id;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.flip_sign_review(UUID, TEXT) TO authenticated;
```

- [ ] **Step 2: Apply + verify**

Run: `npx supabase db query --linked --file supabase/migrations/2026062307_flip_sign_rpc.sql`
Then: `npx supabase db query --linked --file <(echo "SELECT proname FROM pg_proc WHERE proname = 'flip_sign_review';")`
Expected: one row `flip_sign_review`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026062307_flip_sign_rpc.sql
git commit -m "FLIP: add flip_sign_review sequential signing RPC"
```

---

## Task 6: CRUD library (`lib/supabase/flip.ts`)

**Files:**
- Create: `lib/supabase/flip.ts`

- [ ] **Step 1: Write the types + CRUD module**

```typescript
// lib/supabase/flip.ts
import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlipRole, FlipSignSlot } from '@/lib/flip/roles'

function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

// ===== Types =====
export type FlipSectionKey =
  | 'acct_info' | 'appt_letter' | 'ordering' | 'responsibilities' | 'change_directions'

export type FlipTextSection = { id: string; base_id: string; section_key: FlipSectionKey; content: string; updated_at: string; updated_by: string | null }
export type FlipListItem = { id: string; base_id: string; title: string; sort_order: number; created_at: string }
export type FlipReference = { id: string; base_id: string; title: string; file_type: 'pdf'|'docx'|'pptx'|'xlsx'|'other'; storage_path: string; uploaded_by: string | null; uploaded_at: string }
export type FlipStage = 'coordination' | 'submitted' | 'completed'
export type FlipChange = {
  id: string; base_id: string; flip_title: string; notam: string | null; details: string | null
  submitted_by_name: string; submitted_by_user: string | null
  stage: FlipStage; rejected: boolean
  afm_approved_by: string | null; afm_approved_at: string | null
  creation_date: string | null; processed_date: string | null; published_date: string | null
  posted_initials: string | null; posted_date: string | null
  pdf_filename: string | null; pdf_storage_path: string | null
  coordinated_at: string; updated_at: string
}
export type FlipReview = { id: string; base_id: string; cycle: string; review_date: string; created_by: string | null; created_at: string }
export type FlipReviewItem = {
  id: string; review_id: string; base_id: string; flip_title: string; effective_date: string | null
  discrepancy: boolean; discrepancy_note: string | null; corrective_action: string | null
  date_corrected: string | null; sort_order: number
}
export type FlipSignoff = {
  id: string; review_id: string; base_id: string
  custodian_signed_by: string | null; custodian_signed_at: string | null
  namo_signed_by: string | null; namo_signed_at: string | null
  afm_signed_by: string | null; afm_signed_at: string | null
}
export type FlipRoleAssignment = { id: string; base_id: string; user_id: string; role: FlipRole; created_at: string }

// ===== Text sections =====
export async function fetchFlipTextSections(baseId: string): Promise<FlipTextSection[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_text_sections').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipTextSections:', error.message); return [] }
  return (data ?? []) as FlipTextSection[]
}
export async function saveFlipTextSection(baseId: string, key: FlipSectionKey, content: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_text_sections')
    .upsert({ base_id: baseId, section_key: key, content, updated_at: new Date().toISOString() } as never,
      { onConflict: 'base_id,section_key' })
  return { error: error ? friendlyError(error.message) : null }
}

// ===== FLIP list =====
export async function fetchFlipList(baseId: string): Promise<FlipListItem[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_list').select('*').eq('base_id', baseId).order('sort_order')
  if (error) { console.error('fetchFlipList:', error.message); return [] }
  return (data ?? []) as FlipListItem[]
}
export async function addFlipListItem(baseId: string, title: string, sortOrder: number): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_list').insert({ base_id: baseId, title, sort_order: sortOrder } as never)
  return { error: error ? friendlyError(error.message) : null }
}
export async function removeFlipListItem(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_list').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== References =====
export async function fetchFlipReferences(baseId: string): Promise<FlipReference[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_references').select('*').eq('base_id', baseId).order('uploaded_at', { ascending: false })
  if (error) { console.error('fetchFlipReferences:', error.message); return [] }
  return (data ?? []) as FlipReference[]
}
export async function addFlipReference(input: { baseId: string; title: string; fileType: FlipReference['file_type']; storagePath: string }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_references')
    .insert({ base_id: input.baseId, title: input.title, file_type: input.fileType, storage_path: input.storagePath } as never)
  return { error: error ? friendlyError(error.message) : null }
}
export async function removeFlipReference(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_references').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Changes =====
export async function fetchFlipChanges(baseId: string): Promise<FlipChange[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_changes').select('*').eq('base_id', baseId).order('coordinated_at', { ascending: false })
  if (error) { console.error('fetchFlipChanges:', error.message); return [] }
  return (data ?? []) as FlipChange[]
}
export async function createFlipChange(input: { baseId: string; flipTitle: string; notam: string; details: string; name: string }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('flip_changes').insert({
    base_id: input.baseId, flip_title: input.flipTitle, notam: input.notam || null,
    details: input.details || null, submitted_by_name: input.name, submitted_by_user: user?.id ?? null,
  } as never)
  return { error: error ? friendlyError(error.message) : null }
}
/** Generic partial update for stage transitions + date/PDF entry. */
export async function updateFlipChange(id: string, patch: Partial<FlipChange>): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_changes').update({ ...patch, updated_at: new Date().toISOString() } as never).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
/** AFM approval: coordination -> submitted, stamps approver from auth.uid(). */
export async function approveFlipChange(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('flip_changes').update({
    stage: 'submitted', afm_approved_by: user?.id ?? null, afm_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as never).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Reviews =====
export async function fetchFlipReviews(baseId: string): Promise<FlipReview[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_reviews').select('*').eq('base_id', baseId).order('review_date', { ascending: false })
  if (error) { console.error('fetchFlipReviews:', error.message); return [] }
  return (data ?? []) as FlipReview[]
}
export async function fetchFlipReviewItems(reviewId: string): Promise<FlipReviewItem[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_review_items').select('*').eq('review_id', reviewId).order('sort_order')
  if (error) { console.error('fetchFlipReviewItems:', error.message); return [] }
  return (data ?? []) as FlipReviewItem[]
}
export async function fetchFlipSignoffs(baseId: string): Promise<FlipSignoff[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_review_signoffs').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipSignoffs:', error.message); return [] }
  return (data ?? []) as FlipSignoff[]
}
export type NewReviewItem = { flip_title: string; effective_date: string | null; discrepancy: boolean; discrepancy_note: string | null; corrective_action: string | null; date_corrected: string | null }
export async function createFlipReview(input: { baseId: string; cycle: string; reviewDate: string; items: NewReviewItem[] }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: review, error: rErr } = await supabase.from('flip_reviews')
    .insert({ base_id: input.baseId, cycle: input.cycle, review_date: input.reviewDate, created_by: user?.id ?? null } as never)
    .select().single()
  if (rErr || !review) return { error: friendlyError(rErr?.message ?? 'Failed to create review') }
  const rid = (review as FlipReview).id
  const rows = input.items.map((it, i) => ({ review_id: rid, base_id: input.baseId, sort_order: i, ...it }))
  const { error: iErr } = await supabase.from('flip_review_items').insert(rows as never)
  if (iErr) return { error: friendlyError(iErr.message) }
  return { error: null }
}

// ===== Sign (RPC; called via the offline queue handler 'flip_review_sign') =====
export async function signFlipReviewDirect(reviewId: string, slot: FlipSignSlot): Promise<{ data: FlipSignoff | null; error: string | null }> {
  const supabase = db(); if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.rpc('flip_sign_review', { p_review_id: reviewId, p_slot: slot } as never)
  if (error) { console.error('flip_sign_review:', error.message); return { data: null, error: friendlyError(error.message) } }
  return { data: (data as FlipSignoff) ?? null, error: null }
}

// ===== Role assignments (Layer B) =====
export async function fetchFlipRoleAssignments(baseId: string): Promise<FlipRoleAssignment[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_role_assignments').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipRoleAssignments:', error.message); return [] }
  return (data ?? []) as FlipRoleAssignment[]
}
export async function addFlipRole(baseId: string, userId: string, role: FlipRole): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_role_assignments').insert({ base_id: baseId, user_id: userId, role } as never)
  if (error && !error.message.includes('duplicate')) return { error: friendlyError(error.message) }
  return { error: null }
}
export async function removeFlipRole(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_role_assignments').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/flip.ts
git commit -m "FLIP: add CRUD library + types"
```

---

## Task 7: Storage helper + download proxy

**Files:**
- Create: `lib/supabase/flip-storage.ts`
- Create: `app/api/flip-file/route.ts`

- [ ] **Step 1: Write the storage helper**

```typescript
// lib/supabase/flip-storage.ts
import { createClient } from './client'

/** Authenticated proxy URL for a flip-bucket storage_path. */
export function flipFileUrl(storagePath: string): string {
  if (!storagePath) return storagePath
  return `/api/flip-file?path=${encodeURIComponent(storagePath)}`
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * Upload a file to the flip bucket under <baseId>/<kind>/<uuid>.<ext>.
 * Returns the storage path (no bucket prefix) for DB persistence.
 */
export async function uploadFlipFile(
  baseId: string, kind: 'references' | 'changes', file: File,
): Promise<{ path: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { path: null, error: 'Supabase not configured' }
  const ext = extOf(file.name) || 'bin'
  const path = `${baseId}/${kind}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('flip').upload(path, file)
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}
```

- [ ] **Step 2: Write the proxy route** (mirrors `app/api/photos/route.ts`)

```typescript
// app/api/flip-file/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const path = new URL(request.url).searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const cookieStore = cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Storage RLS (flip_files_select) confines this to bases the user belongs to.
  const { data, error } = await supabase.storage.from('flip').download(path)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buf = await data.arrayBuffer()
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0 / compiled successfully.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/flip-storage.ts app/api/flip-file/route.ts
git commit -m "FLIP: add flip storage helper + authenticated download proxy"
```

---

## Task 8: Offline write-queue handler for signing

**Files:**
- Modify: `lib/sync/write-queue.ts` (add to the `WriteType` union)
- Modify: `lib/sync/handlers.ts` (add handler + register it)

- [ ] **Step 1: Add the WriteType literal**

In `lib/sync/write-queue.ts`, find the `WriteType` union (the string-literal union of handler keys, e.g. `'daily_review_sign' | ...`) and add `'flip_review_sign'`:

```typescript
// ...existing union members...
  | 'flip_review_sign'
```

- [ ] **Step 2: Add the handler + register it**

In `lib/sync/handlers.ts`, add near the other sign handlers:

```typescript
import { signFlipReviewDirect, type FlipSignoff } from '@/lib/supabase/flip'
import type { FlipSignSlot } from '@/lib/flip/roles'

export type FlipReviewSignPayload = { reviewId: string; slot: FlipSignSlot }
export type FlipReviewSignResult = FlipSignoff | null

const flipReviewSignHandler: WriteHandler<FlipReviewSignPayload, FlipReviewSignResult> = async (payload) => {
  const { data, error } = await signFlipReviewDirect(payload.reviewId, payload.slot)
  // The RPC already enforces sequence + permanence; a server-side rejection
  // (already signed / out of order) is a conflict, not a transient error.
  if (error) throw new ConflictError(error)
  return data
}
```

Then inside `registerAllHandlers(queue)` add:

```typescript
  queue.registerHandler('flip_review_sign', flipReviewSignHandler)
```

> If `ConflictError` is not already imported in `handlers.ts`, add it to the existing import from `./write-queue` (it is used by `dailyReviewSignHandler`, so it is already imported — reuse it).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/sync/write-queue.ts lib/sync/handlers.ts
git commit -m "FLIP: register flip_review_sign offline write handler"
```

---

# PHASE 2 — Module registration + roles admin

## Task 9: Register the module + nav

**Files:**
- Modify: `lib/modules-config.ts`
- Modify: `lib/sidebar-config.ts`
- Modify: `components/layout/sidebar-nav.tsx`

- [ ] **Step 1: Add `'flip'` to `ModuleKey`**

In `lib/modules-config.ts`, find the `ModuleKey` union type and add `'flip'` (alphabetically near other keys).

- [ ] **Step 2: Add the module entry**

In the `MODULES` array, add (place it within the `compliance` grouping, near the `amtr` entry):

```typescript
  {
    key: 'flip',
    label: 'FLIP Management',
    category: 'compliance',
    description: 'Electronic FLIPs Continuity Binder (DAFMAN 13-204V2 §2.5.2.18): account overview, local FLIP list, reference library, non-procedural FLIP change coordination with AFM approval, and documented FLIP edition reviews with sequential Custodian→NAMO→AFM sign-off.',
    useCase: 'Units with an appointed primary/alternate FLIPs manager tracking FLIP products, edition reviews, and non-procedural changes.',
    hrefs: ['/flip'],
    setupSteps: [],
    defaultEnabled: false,
    appliesTo: ['usaf', 'faa_part139'],
  },
```

- [ ] **Step 3: Add the nav item**

In `lib/sidebar-config.ts`, add to `ALL_NAV_ITEMS` (near the `/amtr` entry):

```typescript
  { name: 'FLIP Management', href: '/flip', iconName: 'BookMarked' },
```

(`BookMarked` is a valid lucide icon; confirm it resolves in the sidebar icon switch — if the component uses an explicit icon map, add `BookMarked` to it.)

- [ ] **Step 4: Map the view permission**

In `components/layout/sidebar-nav.tsx`, add to `HREF_TO_VIEW_PERM`:

```typescript
  '/flip':              'flip:view',
```

- [ ] **Step 5: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0. (The `/flip` route does not exist yet — that's fine; nav items don't require the route to compile. The page lands in Task 12.)

- [ ] **Step 6: Commit**

```bash
git add lib/modules-config.ts lib/sidebar-config.ts components/layout/sidebar-nav.tsx
git commit -m "FLIP: register module + sidebar nav entry"
```

---

## Task 10: FLIP roles admin page

**Files:**
- Create: `app/(app)/flip/roles/page.tsx`

This mirrors `app/(app)/amtr/roles/page.tsx` but uses base members (not an AMTR roster). Fetch base members via the existing helper the users/settings page uses; if unsure, use `fetchFlipRoleAssignments` for assignments and the base-members query below.

- [ ] **Step 1: Implement the page**

```typescript
// app/(app)/flip/roles/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFlipRoleAssignments, addFlipRole, removeFlipRole, type FlipRoleAssignment,
} from '@/lib/supabase/flip'
import { FLIP_ROLES, FLIP_ROLE_LABELS, type FlipRole } from '@/lib/flip/roles'

type Member = { user_id: string; full_name: string }

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const tdStyle: React.CSSProperties = { padding: '8px 12px' }

export default function FlipRolesPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.FLIP_MANAGE)

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<FlipRoleAssignment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const supabase = createClient()
    const [a, m] = await Promise.all([
      fetchFlipRoleAssignments(installationId),
      (async (): Promise<Member[]> => {
        if (!supabase) return []
        // Base members with linked profiles. Adjust table/column names to the
        // project's membership source if base_members differs.
        const { data } = await supabase
          .from('base_members')
          .select('user_id, profiles(full_name)')
          .eq('base_id', installationId)
        return (data ?? []).map((r: { user_id: string; profiles: { full_name: string } | null }) => ({
          user_id: r.user_id, full_name: r.profiles?.full_name ?? '(no name)',
        }))
      })(),
    ])
    setAssignments(a)
    setMembers(m)
    setLoading(false)
  }, [installationId])

  useEffect(() => { load() }, [load])

  const assignByKey = useMemo(() => {
    const map = new Map<string, string>()
    assignments.forEach((a) => map.set(`${a.user_id}:${a.role}`, a.id))
    return map
  }, [assignments])

  const filteredMembers = useMemo(
    () => members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase())),
    [members, search],
  )

  const toggleAssign = async (uid: string, role: FlipRole, existingId: string | undefined) => {
    if (!installationId) return
    const key = `${uid}:${role}`
    setSavingKey(key)
    const { error } = existingId ? await removeFlipRole(existingId) : await addFlipRole(installationId, uid, role)
    setSavingKey(null)
    if (error) { toast.error(error); return }
    load()
  }

  if (!canManage) return <div style={{ padding: 24, color: 'var(--color-text-2)' }}>Requires the Manage FLIP Roles permission.</div>
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4 }}>FLIP Role Assignments</h1>
      <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', marginBottom: 16 }}>
        Assign FLIP roles per person. A user may hold multiple roles. Per DAFMAN 13-204V2 §2.5.2.18, appoint a primary and alternate FLIP custodian.
      </p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
        style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', width: 260 }} />
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Member</th>
              {FLIP_ROLES.map((r) => <th key={r} style={{ ...thStyle, textAlign: 'center', width: 110 }}>{FLIP_ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.user_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                {FLIP_ROLES.map((r) => {
                  const key = `${m.user_id}:${r}`
                  const existingId = assignByKey.get(key)
                  return (
                    <td key={r} style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" checked={!!existingId} disabled={savingKey === key}
                        onChange={() => toggleAssign(m.user_id, r, existingId)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr><td colSpan={FLIP_ROLES.length + 1} style={{ ...tdStyle, color: 'var(--color-text-3)' }}>No members.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> **Verify before relying on it:** the `base_members.select('user_id, profiles(full_name)')` shape. If the project's membership/profile join differs, adapt to whatever the existing users page (`app/(app)/settings/users/page.tsx`) already uses to list base members — reuse that helper rather than re-querying.

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0; `/flip/roles` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/flip/roles/page.tsx"
git commit -m "FLIP: add roles admin matrix page"
```

---

# PHASE 3 — Home (Account Overview + References)

## Task 11: Reusable editable section component

**Files:**
- Create: `components/flip/editable-section.tsx`

- [ ] **Step 1: Implement**

```typescript
// components/flip/editable-section.tsx
'use client'

import { useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'

export function EditableSection({
  title, value, placeholder, canEdit, onSave, minHeight = 120,
}: {
  title: string
  value: string
  placeholder: string
  canEdit: boolean
  onSave: (next: string) => Promise<{ error: string | null }>
  minHeight?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const start = () => { setDraft(value); setEditing(true) }
  const save = async () => {
    setSaving(true)
    const { error } = await onSave(draft.trim())
    setSaving(false)
    if (error) { toast.error(error); return }   // surface silent-save failures
    toast.success('Saved')
    setEditing(false)
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: 'var(--color-surface)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{title}</span>
        {canEdit && !editing && (
          <button onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-xs)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--color-text-1)' }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </header>
      <div style={{ padding: 16 }}>
        {!editing ? (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 'var(--fs-sm)', color: value ? 'var(--color-text-1)' : 'var(--color-text-3)', fontStyle: value ? 'normal' : 'italic' }}>
            {value || placeholder}
          </div>
        ) : (
          <>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              style={{ width: '100%', minHeight, padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', lineHeight: 1.6, resize: 'vertical', color: 'var(--color-text-1)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/flip/editable-section.tsx
git commit -m "FLIP: add reusable EditableSection component"
```

---

## Task 12: FLIP list panel + References panel + module shell (Home)

**Files:**
- Create: `components/flip/flip-list-panel.tsx`
- Create: `components/flip/references-panel.tsx`
- Create: `app/(app)/flip/page.tsx`

- [ ] **Step 1: FLIP list panel**

```typescript
// components/flip/flip-list-panel.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { addFlipListItem, removeFlipListItem, type FlipListItem } from '@/lib/supabase/flip'

export function FlipListPanel({ baseId, items, canEdit, onChange }: {
  baseId: string; items: FlipListItem[]; canEdit: boolean; onChange: () => void
}) {
  const [title, setTitle] = useState('')

  const add = async () => {
    const t = title.trim(); if (!t) return
    const { error } = await addFlipListItem(baseId, t, items.length)
    if (error) { toast.error(error); return }
    setTitle(''); onChange(); toast.success('FLIP added to list')
  }
  const remove = async (id: string) => {
    const { error } = await removeFlipListItem(id)
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: 'var(--color-surface)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Local FLIP List</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Source for FLIP Reviews</span>
      </header>
      <div style={{ padding: 16 }}>
        {items.length === 0 ? (
          <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)', marginBottom: 8 }}>No FLIPs added yet.</p>
        ) : items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
            <FileText size={15} style={{ color: 'var(--color-accent)' }} />
            <span style={{ flex: 1 }}>{it.title}</span>
            {canEdit && <button onClick={() => remove(it.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={15} /></button>}
          </div>
        ))}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
              placeholder="FLIP title (e.g., IFR Supplement)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: 'var(--fs-sm)' }} />
            <button onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><Plus size={14} /> Add</button>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: References panel (real upload)**

```typescript
// components/flip/references-panel.tsx
'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { addFlipReference, removeFlipReference, type FlipReference } from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'

const TYPE_FROM_EXT: Record<string, FlipReference['file_type']> = { pdf: 'pdf', docx: 'docx', doc: 'docx', pptx: 'pptx', ppt: 'pptx', xlsx: 'xlsx', xls: 'xlsx' }

export function ReferencesPanel({ baseId, refs, canEdit, onChange }: {
  baseId: string; refs: FlipReference[]; canEdit: boolean; onChange: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = () => fileRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setPending(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }
  const submit = async () => {
    if (!pending || !title.trim()) { toast.error('Pick a file and enter a title.'); return }
    setBusy(true)
    const { path, error: upErr } = await uploadFlipFile(baseId, 'references', pending)
    if (upErr || !path) { setBusy(false); toast.error(upErr ?? 'Upload failed'); return }
    const ext = pending.name.split('.').pop()?.toLowerCase() ?? ''
    const { error } = await addFlipReference({ baseId, title: title.trim(), fileType: TYPE_FROM_EXT[ext] ?? 'other', storagePath: path })
    setBusy(false)
    if (error) { toast.error(error); return }
    setPending(null); setTitle(''); onChange(); toast.success('Reference added')
  }
  const remove = async (id: string) => {
    const { error } = await removeFlipReference(id)
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Reference Documents</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {refs.map((r) => (
          <a key={r.id} href={flipFileUrl(r.storage_path)} target="_blank" rel="noreferrer"
            style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--color-text-1)', background: 'var(--color-surface-2)' }}>
            <FileText size={28} style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontSize: 'var(--fs-xs)', textAlign: 'center' }}>{r.title}</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-3)' }}>.{r.file_type}</span>
            {canEdit && <button onClick={(e) => { e.preventDefault(); remove(r.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={13} /></button>}
          </a>
        ))}
      </div>
      {refs.length === 0 && <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)', margin: '8px 0' }}>No references uploaded yet.</p>}
      {canEdit && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={pick} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
            {pending ? pending.name : 'Choose file…'}
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: 'var(--fs-sm)' }} />
          <button onClick={submit} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            <Plus size={14} /> {busy ? 'Uploading…' : 'Add Reference'}
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Module shell + Home page** (tabs across Home / Changes / Reviews; this task wires Home only — Changes/Reviews panels render as stubs imported in Tasks 14 & 16)

```typescript
// app/(app)/flip/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchFlipTextSections, saveFlipTextSection, fetchFlipList, fetchFlipReferences,
  type FlipTextSection, type FlipSectionKey, type FlipListItem, type FlipReference,
} from '@/lib/supabase/flip'
import { EditableSection } from '@/components/flip/editable-section'
import { FlipListPanel } from '@/components/flip/flip-list-panel'
import { ReferencesPanel } from '@/components/flip/references-panel'
import { ChangeBoard } from '@/components/flip/change-board'      // Task 14
import { ReviewsPanel } from '@/components/flip/reviews-panel'    // Task 16

type Tab = 'home' | 'changes' | 'reviews'
type HomeSub = 'overview' | 'references'

const SECTION_META: { key: FlipSectionKey; title: string; placeholder: string }[] = [
  { key: 'acct_info', title: 'Account Information', placeholder: 'No account information entered. Click Edit to add details.' },
  { key: 'appt_letter', title: 'Current Appointment Letter', placeholder: 'No appointment letter details entered. Click Edit to add.' },
  { key: 'ordering', title: 'Ordering Process (IAW AFI 11-201)', placeholder: 'No ordering process information entered. Click Edit to add.' },
  { key: 'responsibilities', title: 'FLIP Manager Responsibilities', placeholder: 'No responsibilities listed. Click Edit to add.' },
]

export default function FlipPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.FLIP_WRITE)
  const canManage = has(PERM.FLIP_MANAGE)

  const [tab, setTab] = useState<Tab>('home')
  const [homeSub, setHomeSub] = useState<HomeSub>('overview')
  const [sections, setSections] = useState<Record<string, string>>({})
  const [list, setList] = useState<FlipListItem[]>([])
  const [refs, setRefs] = useState<FlipReference[]>([])

  const loadHome = useCallback(async () => {
    if (!installationId) return
    const [s, l, r] = await Promise.all([
      fetchFlipTextSections(installationId), fetchFlipList(installationId), fetchFlipReferences(installationId),
    ])
    const map: Record<string, string> = {}
    s.forEach((row: FlipTextSection) => { map[row.section_key] = row.content })
    setSections(map); setList(l); setRefs(r)
  }, [installationId])

  useEffect(() => { loadHome() }, [loadHome])

  const saveSection = (key: FlipSectionKey) => async (next: string) => {
    if (!installationId) return { error: 'No base selected' }
    const res = await saveFlipTextSection(installationId, key, next)
    if (!res.error) setSections((m) => ({ ...m, [key]: next }))
    return res
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 16px', cursor: 'pointer', background: 'none', border: 'none',
    borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
    color: tab === t ? 'var(--color-text-1)' : 'var(--color-text-3)', fontWeight: 600, fontSize: 'var(--fs-sm)',
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>FLIP Management</h1>
        {canManage && <Link href="/flip/roles" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', textDecoration: 'none' }}><Settings size={15} /> Roles</Link>}
      </div>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', marginBottom: 16 }}>Electronic FLIPs Continuity Binder — DAFMAN 13-204V2 §2.5.2.18.</p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <button style={tabStyle('home')} onClick={() => setTab('home')}>Home</button>
        <button style={tabStyle('changes')} onClick={() => setTab('changes')}>FLIP Changes</button>
        <button style={tabStyle('reviews')} onClick={() => setTab('reviews')}>FLIP Reviews</button>
      </div>

      {tab === 'home' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setHomeSub('overview')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: homeSub === 'overview' ? 'var(--color-accent)' : 'var(--color-surface)', color: homeSub === 'overview' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Account Overview</button>
            <button onClick={() => setHomeSub('references')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: homeSub === 'references' ? 'var(--color-accent)' : 'var(--color-surface)', color: homeSub === 'references' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>References</button>
          </div>
          {homeSub === 'overview' ? (
            <>
              <EditableSection title={SECTION_META[0].title} value={sections[SECTION_META[0].key] ?? ''} placeholder={SECTION_META[0].placeholder} canEdit={canWrite} onSave={saveSection(SECTION_META[0].key)} />
              {installationId && <FlipListPanel baseId={installationId} items={list} canEdit={canWrite} onChange={loadHome} />}
              {SECTION_META.slice(1).map((m) => (
                <EditableSection key={m.key} title={m.title} value={sections[m.key] ?? ''} placeholder={m.placeholder} canEdit={canWrite} onSave={saveSection(m.key)} />
              ))}
            </>
          ) : (
            installationId && <ReferencesPanel baseId={installationId} refs={refs} canEdit={canWrite} onChange={loadHome} />
          )}
        </>
      )}

      {tab === 'changes' && installationId && <ChangeBoard baseId={installationId} canWrite={canWrite} />}
      {tab === 'reviews' && installationId && <ReviewsPanel baseId={installationId} canWrite={canWrite} />}
    </div>
  )
}
```

> Because `app/(app)/flip/page.tsx` imports `ChangeBoard` and `ReviewsPanel` (created in Tasks 14 & 16), implement this task's panels first but add **temporary stub files** for those two components so the page compiles now, then replace them in Phases 4–5. Stub example:
> ```typescript
> // components/flip/change-board.tsx (TEMP STUB — replaced in Task 14)
> export function ChangeBoard(_: { baseId: string; canWrite: boolean }) { return null }
> ```
> ```typescript
> // components/flip/reviews-panel.tsx (TEMP STUB — replaced in Task 16)
> export function ReviewsPanel(_: { baseId: string; canWrite: boolean }) { return null }
> ```

- [ ] **Step 4: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0; `/flip` route present.

- [ ] **Step 5: Commit**

```bash
git add components/flip/flip-list-panel.tsx components/flip/references-panel.tsx components/flip/change-board.tsx components/flip/reviews-panel.tsx "app/(app)/flip/page.tsx"
git commit -m "FLIP: Home page — account overview, FLIP list, references (with stubs)"
```

---

# PHASE 4 — FLIP Changes pipeline

## Task 13: Coordinate-new-change modal

**Files:**
- Create: `components/flip/coordinate-modal.tsx`

- [ ] **Step 1: Implement**

```typescript
// components/flip/coordinate-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createFlipChange } from '@/lib/supabase/flip'

export function CoordinateModal({ baseId, open, onClose, onCreated }: {
  baseId: string; open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [flipTitle, setFlipTitle] = useState('')
  const [notam, setNotam] = useState('')
  const [details, setDetails] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const submit = async () => {
    if (!flipTitle.trim() || !name.trim()) { toast.error('FLIP Title and Name/Rank are required.'); return }
    setBusy(true)
    const { error } = await createFlipChange({ baseId, flipTitle: flipTitle.trim(), notam: notam.trim(), details: details.trim(), name: name.trim() })
    setBusy(false)
    if (error) { toast.error(error); return }
    setFlipTitle(''); setNotam(''); setDetails(''); setName('')
    onCreated(); onClose(); toast.success('Change coordinated — awaiting AFM approval')
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', color: 'var(--color-text-2)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 12, width: '100%', maxWidth: 560, overflow: 'hidden' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Coordinate FLIP Change</header>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={label}>FLIP Title *</label><input style={field} value={flipTitle} onChange={(e) => setFlipTitle(e.target.value)} placeholder="e.g., IFR Supplement" /></div>
          <div><label style={label}>NOTAM</label><input style={field} value={notam} onChange={(e) => setNotam(e.target.value)} placeholder="NOTAM number or reference" /></div>
          <div><label style={label}>Details</label><textarea style={{ ...field, minHeight: 90, resize: 'vertical' }} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the proposed change…" /></div>
          <div><label style={label}>Name / Rank *</label><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., MSgt Smith" /></div>
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>{busy ? 'Saving…' : 'Coordinate'}</button>
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected exit 0)
```bash
git add components/flip/coordinate-modal.tsx
git commit -m "FLIP: add coordinate-new-change modal"
```

---

## Task 14: Change card + Change board (replaces stub)

**Files:**
- Create: `components/flip/change-card.tsx`
- Modify (replace stub): `components/flip/change-board.tsx`

The board needs the FLIP `afm` role for approve/publish/reject; fetch the current user's FLIP roles. Compute them from `fetchFlipRoleAssignments` filtered by the signed-in user id.

- [ ] **Step 1: Change card**

```typescript
// components/flip/change-card.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateFlipChange, approveFlipChange, type FlipChange } from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'

const STAGE_COLOR: Record<string, string> = {
  coordination: 'var(--color-warning)', submitted: 'var(--color-info)', completed: 'var(--color-success)', rejected: 'var(--color-danger)',
}
function badgeLabel(c: FlipChange): string {
  if (c.rejected) return 'Rejected'
  return { coordination: 'Awaiting AFM Approval', submitted: 'Submitted / Awaiting Publication', completed: 'Published' }[c.stage]
}

export function ChangeCard({ change, isAfm, canWrite, baseId, onChange }: {
  change: FlipChange; isAfm: boolean; canWrite: boolean; baseId: string; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const c = change
  const stageKey = c.rejected ? 'rejected' : c.stage

  const setField = async (patch: Partial<FlipChange>) => {
    const { error } = await updateFlipChange(c.id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const approve = async () => { setBusy(true); const { error } = await approveFlipChange(c.id); setBusy(false); if (error) return toast.error(error); onChange(); toast.success('Approved — moved to Submitted') }
  const reject = async () => { setBusy(true); const { error } = await updateFlipChange(c.id, { stage: 'completed', rejected: true }); setBusy(false); if (error) return toast.error(error); onChange(); toast('Change rejected') }
  const publish = async () => {
    if (!c.creation_date || !c.published_date) { toast.error('Creation date and Published date are required to publish.'); return }
    const initials = window.prompt('Operating initials (annotated on the change notice per §2.5.2.18.2.2.8):', c.posted_initials ?? '')
    if (initials === null) return
    setBusy(true)
    const { error } = await updateFlipChange(c.id, { stage: 'completed', posted_initials: initials.trim() || null, posted_date: c.posted_date ?? new Date().toISOString().slice(0, 10) })
    setBusy(false)
    if (error) return toast.error(error); onChange(); toast.success('Marked published')
  }
  const onPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    const { path, error } = await uploadFlipFile(baseId, 'changes', f)
    setBusy(false)
    if (error || !path) return toast.error(error ?? 'Upload failed')
    setField({ pdf_filename: f.name, pdf_storage_path: path })
  }

  const dateInput = (val: string | null, onSet: (v: string) => void, label: string) => (
    <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 3 }}>{label}{val ? ' ✓' : ''}</div>
      <input type="date" value={val ?? ''} onChange={(e) => onSet(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: 'var(--fs-xs)' }} /></div>
  )

  return (
    <div style={{ border: '1px solid var(--color-border)', borderLeft: `3px solid ${STAGE_COLOR[stageKey]}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--color-surface)' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
        {open ? <ChevronDown size={16} style={{ color: 'var(--color-text-3)', marginTop: 2 }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-3)', marginTop: 2 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{c.flip_title}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', display: 'flex', gap: 12, marginTop: 2 }}>
            <span>{c.submitted_by_name}</span>{c.notam && <span>NOTAM: {c.notam}</span>}<span>{c.coordinated_at.slice(0, 10)}</span>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: STAGE_COLOR[stageKey] }}>{badgeLabel(c)}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
          {c.details && <p style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>{c.details}</p>}

          {c.stage === 'coordination' && !c.rejected && isAfm && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={approve} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><CircleCheck size={14} /> AFM Approval</button>
              <button onClick={reject} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><X size={14} /> Reject</button>
            </div>
          )}

          {c.stage === 'submitted' && !c.rejected && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                {dateInput(c.creation_date, (v) => setField({ creation_date: v }), 'Creation Date')}
                {dateInput(c.processed_date, (v) => setField({ processed_date: v }), 'Processed Date')}
                {dateInput(c.published_date, (v) => setField({ published_date: v }), 'Published Date')}
              </div>
              <label style={{ display: 'block', border: '2px dashed var(--color-border)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: c.pdf_filename ? 'var(--color-success)' : 'var(--color-text-3)', marginBottom: 10 }}>
                {c.pdf_filename ?? 'Upload submitted change PDF'}
                <input type="file" accept=".pdf" onChange={onPdf} style={{ display: 'none' }} />
              </label>
              {isAfm && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={publish} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><CircleCheck size={14} /> Mark Published</button>
                  <button onClick={reject} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><X size={14} /> Reject</button>
                </div>
              )}
            </>
          )}

          {c.stage === 'completed' && (
            <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><strong>Coordinated:</strong> {c.coordinated_at.slice(0, 10)}</div>
              {c.creation_date && <div><strong>Creation:</strong> {c.creation_date}</div>}
              {c.published_date && <div><strong>Published:</strong> {c.published_date}</div>}
              {c.posted_date && <div><strong>Posted:</strong> {c.posted_date} {c.posted_initials ? `(${c.posted_initials})` : ''}</div>}
              {c.pdf_storage_path && <a href={flipFileUrl(c.pdf_storage_path)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{c.pdf_filename ?? 'Download PDF'}</a>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Change board (replace stub file)**

```typescript
// components/flip/change-board.tsx  (REPLACES the Task 12 stub)
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchFlipChanges, fetchFlipRoleAssignments, fetchFlipTextSections, saveFlipTextSection, type FlipChange } from '@/lib/supabase/flip'
import { ChangeCard } from '@/components/flip/change-card'
import { CoordinateModal } from '@/components/flip/coordinate-modal'
import { EditableSection } from '@/components/flip/editable-section'

export function ChangeBoard({ baseId, canWrite }: { baseId: string; canWrite: boolean }) {
  const [sub, setSub] = useState<'board' | 'directions'>('board')
  const [changes, setChanges] = useState<FlipChange[]>([])
  const [isAfm, setIsAfm] = useState(false)
  const [isCustodian, setIsCustodian] = useState(false)
  const [directions, setDirections] = useState('')
  const [modal, setModal] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
    const [ch, roles, secs] = await Promise.all([
      fetchFlipChanges(baseId), fetchFlipRoleAssignments(baseId), fetchFlipTextSections(baseId),
    ])
    setChanges(ch)
    const mine = roles.filter((r) => r.user_id === user?.id).map((r) => r.role)
    setIsAfm(mine.includes('afm'))
    setIsCustodian(mine.includes('custodian') || mine.includes('alternate'))
    setDirections(secs.find((s) => s.section_key === 'change_directions')?.content ?? '')
  }, [baseId])

  useEffect(() => { load() }, [load])

  const byStage = (stage: FlipChange['stage']) =>
    stage === 'completed' ? changes.filter((c) => c.stage === 'completed' || c.rejected) : changes.filter((c) => c.stage === stage && !c.rejected)

  const STAGES: { stage: FlipChange['stage']; label: string }[] = [
    { stage: 'coordination', label: 'Coordination' },
    { stage: 'submitted', label: 'Submitted / Awaiting Publication' },
    { stage: 'completed', label: 'Completed' },
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => setSub('board')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: sub === 'board' ? 'var(--color-accent)' : 'var(--color-surface)', color: sub === 'board' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Change Board</button>
        <button onClick={() => setSub('directions')} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: sub === 'directions' ? 'var(--color-accent)' : 'var(--color-surface)', color: sub === 'directions' ? '#fff' : 'var(--color-text-1)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>Directions</button>
        {sub === 'board' && canWrite && isCustodian && (
          <button onClick={() => setModal(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 999, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><Plus size={14} /> Coordinate New Change</button>
        )}
      </div>

      {sub === 'directions' ? (
        <EditableSection title="Directions" value={directions} placeholder="No directions entered. Click Edit to add guidance for coordinating non-procedural FLIP changes (§2.5.2.18.2.2.2)." canEdit={canWrite}
          onSave={async (next) => { const r = await saveFlipTextSection(baseId, 'change_directions', next); if (!r.error) setDirections(next); return r }} minHeight={180} />
      ) : (
        STAGES.map(({ stage, label }) => {
          const items = byStage(stage)
          return (
            <div key={stage} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-3)', marginBottom: 8 }}>{label} · {items.length}</div>
              {items.length === 0 ? <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)' }}>No changes.</p>
                : items.map((c) => <ChangeCard key={c.id} change={c} isAfm={isAfm} canWrite={canWrite} baseId={baseId} onChange={load} />)}
            </div>
          )
        })
      )}

      <CoordinateModal baseId={baseId} open={modal} onClose={() => setModal(false)} onCreated={load} />
    </>
  )
}
```

> **Theme tokens to verify:** `--color-warning`, `--color-info`, `--color-success`, `--color-danger`. If the project uses different token names (check an existing badge component, e.g. discrepancy status chips), substitute the real token names.

- [ ] **Step 3: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/flip/change-card.tsx components/flip/change-board.tsx
git commit -m "FLIP: implement Changes pipeline (board, cards, stage actions)"
```

---

# PHASE 5 — FLIP Reviews + sequential sign-off

## Task 15: Document-review modal

**Files:**
- Create: `components/flip/document-review-modal.tsx`

Enforces: FLIP title is a dropdown sourced ONLY from `flip_list` (empty → amber warning, no free text); discrepancy toggle reveals note + corrective action + **date corrected**.

- [ ] **Step 1: Implement**

```typescript
// components/flip/document-review-modal.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createFlipReview, type FlipListItem, type NewReviewItem } from '@/lib/supabase/flip'

type Row = NewReviewItem

export function DocumentReviewModal({ baseId, flipList, open, onClose, onCreated }: {
  baseId: string; flipList: FlipListItem[]; open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [cycle, setCycle] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [rows, setRows] = useState<Row[]>([{ flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows((rs) => [...rs, { flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!cycle.trim() || !reviewDate) { toast.error('Cycle and Review Date are required.'); return }
    const clean = rows.filter((r) => r.flip_title)
    if (clean.length === 0) { toast.error('Add at least one FLIP row.'); return }
    setBusy(true)
    const { error } = await createFlipReview({ baseId, cycle: cycle.trim(), reviewDate, items: clean })
    setBusy(false)
    if (error) { toast.error(error); return }
    setCycle(''); setReviewDate(''); setRows([{ flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
    onCreated(); onClose(); toast.success('FLIP review documented')
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, marginBottom: 4, color: 'var(--color-text-2)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Document FLIP Review</header>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={label}>FLIP Cycle</label><input style={field} value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="e.g., 1 JAN 2026 – 24 MAR 2026" /></div>
            <div><label style={label}>FLIP Review Date</label><input type="date" style={field} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></div>
          </div>

          {flipList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: 'var(--color-warning-bg, rgba(180,83,9,0.12))', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontSize: 'var(--fs-sm)' }}>
              <TriangleAlert size={16} /> Add FLIP titles to the Local FLIP List (Home) before documenting a review.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8 }}>FLIPs Reviewed</div>
              {rows.map((r, i) => (
                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--color-surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)' }}>FLIP {i + 1}</span>
                    {rows.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={14} /></button>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={label}>FLIP Title</label>
                      <select style={field} value={r.flip_title} onChange={(e) => setRow(i, { flip_title: e.target.value })}>
                        <option value="">Select a FLIP…</option>
                        {flipList.map((f) => <option key={f.id} value={f.title}>{f.title}</option>)}
                      </select>
                    </div>
                    <div><label style={label}>Effective Date</label><input type="date" style={field} value={r.effective_date ?? ''} onChange={(e) => setRow(i, { effective_date: e.target.value || null })} /></div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Discrepancies</label>
                    <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', width: 160 }}>
                      <button onClick={() => setRow(i, { discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null })}
                        style={{ flex: 1, padding: 7, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', background: !r.discrepancy ? 'var(--color-success-bg, rgba(45,125,79,0.15))' : 'var(--color-surface)', color: !r.discrepancy ? 'var(--color-success)' : 'var(--color-text-2)' }}>No</button>
                      <button onClick={() => setRow(i, { discrepancy: true })}
                        style={{ flex: 1, padding: 7, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', background: r.discrepancy ? 'var(--color-danger-bg, rgba(185,28,28,0.12))' : 'var(--color-surface)', color: r.discrepancy ? 'var(--color-danger)' : 'var(--color-text-2)' }}>Yes</button>
                    </div>
                  </div>
                  {r.discrepancy && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                      <div><label style={label}>Discrepancy</label><textarea style={{ ...field, minHeight: 56, resize: 'vertical' }} value={r.discrepancy_note ?? ''} onChange={(e) => setRow(i, { discrepancy_note: e.target.value })} /></div>
                      <div><label style={label}>Corrective Action</label><textarea style={{ ...field, minHeight: 56, resize: 'vertical' }} value={r.corrective_action ?? ''} onChange={(e) => setRow(i, { corrective_action: e.target.value })} /></div>
                      <div style={{ maxWidth: 220 }}><label style={label}>Date Corrected (§2.5.2.18.2.2.1)</label><input type="date" style={field} value={r.date_corrected ?? ''} onChange={(e) => setRow(i, { date_corrected: e.target.value || null })} /></div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addRow} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}><Plus size={14} /> Add FLIP</button>
            </>
          )}
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
          <button onClick={submit} disabled={busy || flipList.length === 0} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>{busy ? 'Saving…' : 'Complete Review'}</button>
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected exit 0)
```bash
git add components/flip/document-review-modal.tsx
git commit -m "FLIP: add document-review modal (dropdown-only, discrepancy + date corrected)"
```

---

## Task 16: Sign-off boxes + reviews panel (replaces stub)

**Files:**
- Create: `components/flip/review-signoff.tsx`
- Modify (replace stub): `components/flip/reviews-panel.tsx`

Signing goes through the offline queue (`flip_review_sign`). Get the queue via the project's accessor (the daily-review sign modal uses `getWriteQueue()` from `@/lib/sync/write-queue`).

- [ ] **Step 1: Sign-off component**

```typescript
// components/flip/review-signoff.tsx
'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getWriteQueue } from '@/lib/sync/write-queue'
import { canSignSlot, SLOT_ORDER, SLOT_LABELS, type FlipRole, type FlipSignSlot, type SignoffState } from '@/lib/flip/roles'
import type { FlipSignoff } from '@/lib/supabase/flip'
import type { FlipReviewSignPayload, FlipReviewSignResult } from '@/lib/sync/handlers'

export function ReviewSignoff({ reviewId, baseId, userId, signoff, myRoles, onSigned }: {
  reviewId: string; baseId: string; userId: string
  signoff: FlipSignoff | null; myRoles: FlipRole[]; onSigned: () => void
}) {
  const [busy, setBusy] = useState<FlipSignSlot | null>(null)
  const state: SignoffState = {
    custodian_signed_at: signoff?.custodian_signed_at ?? null,
    namo_signed_at: signoff?.namo_signed_at ?? null,
    afm_signed_at: signoff?.afm_signed_at ?? null,
  }

  const sign = async (slot: FlipSignSlot) => {
    setBusy(slot)
    try {
      const res = await getWriteQueue().enqueueOrExecute<FlipReviewSignPayload, FlipReviewSignResult>(
        'flip_review_sign', { reviewId, slot }, { baseId, userId, optimisticEntityId: reviewId },
      )
      if (res.status === 'queued') toast.success('Signature queued — will commit when online')
      else toast.success('Signed')
      onSigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign failed')
    } finally { setBusy(null) }
  }

  const signedBy = (slot: FlipSignSlot): string | null => {
    const at = state[`${slot}_signed_at` as keyof SignoffState]
    return at ?? null
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
      {SLOT_ORDER.map((slot) => {
        const at = signedBy(slot)
        const locked = !!at
        const canSign = !locked && canSignSlot(myRoles, slot, state)
        return (
          <div key={slot} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-surface-2)', padding: '6px 10px', fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{SLOT_LABELS[slot]}</div>
            <div style={{ padding: 10 }}>
              {locked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 'var(--fs-sm)' }}>
                  <CheckCircle2 size={16} /> Signed {at?.slice(0, 16).replace('T', ' ')}Z
                </div>
              ) : canSign ? (
                <button onClick={() => sign(slot)} disabled={busy === slot}
                  style={{ width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 6, padding: 7, cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                  {busy === slot ? 'Signing…' : 'Sign'}
                </button>
              ) : (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', textAlign: 'center', padding: 4 }}>
                  {slot === 'custodian' ? 'Awaiting custodian' : state[slot === 'namo' ? 'custodian_signed_at' : 'namo_signed_at'] ? 'Not your role' : 'Awaiting prior signature'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Reviews panel (replace stub file)**

```typescript
// components/flip/reviews-panel.tsx  (REPLACES the Task 12 stub)
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, ClipboardPlus, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFlipReviews, fetchFlipReviewItems, fetchFlipSignoffs, fetchFlipList, fetchFlipRoleAssignments,
  type FlipReview, type FlipReviewItem, type FlipSignoff, type FlipListItem,
} from '@/lib/supabase/flip'
import { DocumentReviewModal } from '@/components/flip/document-review-modal'
import { ReviewSignoff } from '@/components/flip/review-signoff'
import { nextSlot, type FlipRole } from '@/lib/flip/roles'
import { generateFlipReviewPdf } from '@/lib/flip-pdf'   // Task 17

export function ReviewsPanel({ baseId, canWrite }: { baseId: string; canWrite: boolean }) {
  const [reviews, setReviews] = useState<FlipReview[]>([])
  const [signoffs, setSignoffs] = useState<FlipSignoff[]>([])
  const [flipList, setFlipList] = useState<FlipListItem[]>([])
  const [itemsByReview, setItemsByReview] = useState<Record<string, FlipReviewItem[]>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [myRoles, setMyRoles] = useState<FlipRole[]>([])
  const [userId, setUserId] = useState('')
  const [modal, setModal] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
    setUserId(user?.id ?? '')
    const [rv, so, fl, roles] = await Promise.all([
      fetchFlipReviews(baseId), fetchFlipSignoffs(baseId), fetchFlipList(baseId), fetchFlipRoleAssignments(baseId),
    ])
    setReviews(rv); setSignoffs(so); setFlipList(fl)
    setMyRoles(roles.filter((r) => r.user_id === user?.id).map((r) => r.role))
  }, [baseId])

  useEffect(() => { load() }, [load])

  const expand = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!itemsByReview[id]) {
      const items = await fetchFlipReviewItems(id)
      setItemsByReview((m) => ({ ...m, [id]: items }))
    }
  }

  const signoffFor = (rid: string) => signoffs.find((s) => s.review_id === rid) ?? null
  const sigStatus = (rid: string) => {
    const so = signoffFor(rid)
    const ns = nextSlot({ custodian_signed_at: so?.custodian_signed_at ?? null, namo_signed_at: so?.namo_signed_at ?? null, afm_signed_at: so?.afm_signed_at ?? null })
    return ns === null ? 'Fully signed' : 'Unsigned'
  }

  const exportPdf = async (rv: FlipReview) => {
    const items = itemsByReview[rv.id] ?? await fetchFlipReviewItems(rv.id)
    const { doc, filename } = generateFlipReviewPdf({ review: rv, items, signoff: signoffFor(rv.id) })
    doc.save(filename)
    toast.success('PDF generated')
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {canWrite && <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><ClipboardPlus size={14} /> Document FLIP Review</button>}
      </div>

      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8 }}>Completed Reviews</div>
      {reviews.length === 0 && <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)' }}>No reviews documented yet.</p>}

      {reviews.map((rv) => {
        const items = itemsByReview[rv.id] ?? []
        const discCount = items.filter((i) => i.discrepancy).length
        return (
          <div key={rv.id} style={{ border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-success)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--color-surface)' }}>
            <div onClick={() => expand(rv.id)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              {openId === rv.id ? <ChevronDown size={16} style={{ color: 'var(--color-text-3)' }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-3)' }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{rv.cycle}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{rv.review_date}{openId === rv.id && items.length ? ` · ${items.length} FLIPs · ${discCount} discrepanc${discCount === 1 ? 'y' : 'ies'}` : ''}</div>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: sigStatus(rv.id) === 'Fully signed' ? 'var(--color-success)' : 'var(--color-text-3)' }}>{sigStatus(rv.id)}</span>
            </div>
            {openId === rv.id && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                  <thead><tr style={{ background: 'var(--color-surface-2)' }}>
                    {['FLIP Title', 'Effective', 'Disc.', 'Discrepancy', 'Corrective Action', 'Date Corrected'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: 'var(--color-text-2)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '7px 10px' }}>{it.flip_title}</td>
                        <td style={{ padding: '7px 10px' }}>{it.effective_date ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: it.discrepancy ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>{it.discrepancy ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.discrepancy_note ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.corrective_action ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.date_corrected ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ReviewSignoff reviewId={rv.id} baseId={baseId} userId={userId} signoff={signoffFor(rv.id)} myRoles={myRoles} onSigned={load} />
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={() => exportPdf(rv)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}><FileDown size={14} /> Export Review PDF</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <DocumentReviewModal baseId={baseId} flipList={flipList} open={modal} onClose={() => setModal(false)} onCreated={load} />
    </>
  )
}
```

> This panel imports `generateFlipReviewPdf` (Task 17). Add a temporary stub `lib/flip-pdf.ts` returning `{ doc: new (await import('jspdf')).jsPDF(), filename: 'flip-review.pdf' }` only if you implement this before Task 17; otherwise do Task 17 first. Recommended: do Task 17 before building this task.

- [ ] **Step 3: Build** (after Task 17 exists)

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/flip/review-signoff.tsx components/flip/reviews-panel.tsx
git commit -m "FLIP: implement Reviews panel + sequential sign-off"
```

---

# PHASE 6 — PDF export, Guide, polish

## Task 17: Signed-review PDF generator

**Files:**
- Create: `lib/flip-pdf.ts`

- [ ] **Step 1: Implement** (verify exact `pdf-utils` helper signatures against `lib/pdf-utils.ts`; adjust calls if option shapes differ)

```typescript
// lib/flip-pdf.ts
import autoTable from 'jspdf-autotable'
import { createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles, BLOCK_POST_SPACING_MM } from '@/lib/pdf-utils'
import type { FlipReview, FlipReviewItem, FlipSignoff } from '@/lib/supabase/flip'

export function generateFlipReviewPdf(input: {
  review: FlipReview; items: FlipReviewItem[]; signoff: FlipSignoff | null
  baseName?: string; baseIcao?: string
}): { doc: import('jspdf').jsPDF; filename: string } {
  const { review, items, signoff } = input
  const ctx = createPdf()
  let y = 15
  y = drawBaseHeader(ctx, y, { baseName: input.baseName, baseIcao: input.baseIcao })
  y = drawReportTitle(ctx, y, { title: 'FLIP MANAGEMENT REVIEW', subtitle: 'DAFMAN 13-204V2 §2.5.2.18.2.2.1' })
  y = drawStatBox(ctx, y, [
    { label: 'FLIP Cycle', value: review.cycle },
    { label: 'Review Date', value: review.review_date },
    { label: 'FLIPs Reviewed', value: String(items.length) },
    { label: 'Discrepancies', value: String(items.filter((i) => i.discrepancy).length) },
  ])
  y += BLOCK_POST_SPACING_MM

  autoTable(ctx.doc, {
    startY: y,
    head: [['FLIP Title', 'Effective', 'Disc.', 'Discrepancy', 'Corrective Action', 'Date Corrected']],
    body: items.map((it) => [
      it.flip_title, it.effective_date ?? '—', it.discrepancy ? 'Yes' : 'No',
      it.discrepancy_note ?? '—', it.corrective_action ?? '—', it.date_corrected ?? '—',
    ]),
    ...tableStyles(ctx),
  })

  // Sign-off block
  // @ts-expect-error autotable augments doc with lastAutoTable
  let sy = (ctx.doc.lastAutoTable?.finalY ?? y) + 10
  ctx.doc.setFontSize(10)
  ctx.doc.text('Sign-Off (Custodian → NAMO → AFM)', ctx.margin, sy); sy += 6
  const sig = (label: string, at: string | null) => {
    ctx.doc.setFontSize(9)
    ctx.doc.text(`${label}: ${at ? `Signed ${at.slice(0, 16).replace('T', ' ')}Z` : '________________'}`, ctx.margin, sy)
    sy += 6
  }
  sig('FLIP Custodian', signoff?.custodian_signed_at ?? null)
  sig('NAMO', signoff?.namo_signed_at ?? null)
  sig('AFM (Final Approval)', signoff?.afm_signed_at ?? null)

  drawFooter(ctx)
  return { doc: ctx.doc, filename: `flip-review-${review.review_date}.pdf` }
}
```

> The signature block shows the timestamp; signer **name/rank** can be added by joining `*_signed_by` → `profiles.full_name` in `fetchFlipSignoffs` (extend the select). For v1 the timestamp + role satisfies the record; add names if the reviewer wants them on the PDF.

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/flip-pdf.ts
git commit -m "FLIP: add signed-review PDF generator"
```

---

## Task 18: Help & Training Guide section + final verification

**Files:**
- Modify: `app/(app)/help/page.tsx` (add a FLIP Management section following the existing 6-section Guide pattern)

- [ ] **Step 1: Add the Guide section**

Follow the existing `/help` structure (find an existing module's Guide block, e.g. AMTR or daily-reviews, and add a parallel `FLIP Management` entry). Content (text, not live preview), citing the reg:
- *What it is:* the electronic FLIPs Continuity Binder (DAFMAN 13-204V2 §2.5.2.18.1).
- *Home:* account info, appointment letter, FLIP ordering (IAW AFI 11-201), responsibilities, Local FLIP List, References.
- *FLIP Changes:* coordinate non-procedural changes; AFM is the approval authority (§2.5.2.18.2.2.2); annotate "NOTAM Manager Airfield" for airfield-diagram changes (§.2.2.3); record operating initials + posted date (§.2.2.8).
- *FLIP Reviews:* review each new FLIP edition (§2.5.2.18.2.2); the log captures FLIP title, effective date, review completion date, discrepancies, corrective action, date corrected, and reviewer (§.2.2.1); Custodian→NAMO→AFM sign-off is local oversight.
- *Roles:* assign Primary/Alternate FLIP Custodian, NAMO, AFM from the Roles menu (§2.5.2.18 requires a primary and alternate).

- [ ] **Step 2: Full verification gate**

Run all three and confirm green:
```bash
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: tsc exit 0; vitest all pass (incl. `tests/flip-roles.test.ts`); build compiled successfully with `/flip` and `/flip/roles` in the route list.

- [ ] **Step 3: Manual smoke test (document results)**

With a USAF test base: enable the FLIP module (base setup), assign yourself `custodian` + `afm` (and a second user `namo` if available) in `/flip/roles`, then:
1. Home: add a FLIP-list title; save each text section; upload a reference and confirm it downloads via the proxy.
2. Changes: coordinate a change → approve (AFM) → enter dates + upload PDF → mark published (enter initials).
3. Reviews: document a review (dropdown-only title, one discrepancy with date-corrected) → sign Custodian → confirm NAMO is gated until custodian signed → export the PDF.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/help/page.tsx"
git commit -m "FLIP: add Help & Training Guide section + final verification"
```

---

## Self-review notes (gaps to confirm during execution)

These are the verify-before-relying-on-it items flagged inline, consolidated:
1. **Base-members query** in Task 10 — reuse whatever `app/(app)/settings/users/page.tsx` already uses to list base members + names; the `base_members.select('user_id, profiles(full_name)')` shape is an assumption.
2. **Theme token names** — `--color-warning/info/success/danger` (+ `*-bg` variants) used in Tasks 14–16. Confirm against an existing status-chip component; substitute real token names if different.
3. **`WriteType` union + `getWriteQueue()`** location/exports in `lib/sync/write-queue.ts` (Tasks 8, 16) — confirm the union member is added and the accessor is exported as used by the daily-review sign modal.
4. **`pdf-utils` option shapes** (Task 17) — `drawReportTitle`/`drawStatBox`/`drawBaseHeader` option objects; adjust to the real signatures.
5. **Sidebar icon resolution** (Task 9) — if the sidebar maps icon names through an explicit map rather than dynamic lucide lookup, add `BookMarked` to it.
6. **Module enablement** — `defaultEnabled: false`; the module must be turned on per base in setup. No backfill migration needed (matches the "new defaultEnabled modules don't reach existing bases" known behavior — intentional here).
7. **`base_id` denormalized onto `flip_review_items`** so its RLS + `fetchFlipSignoffs`/PDF queries stay simple; ensure inserts always set it (Task 6 `createFlipReview` does).
```
