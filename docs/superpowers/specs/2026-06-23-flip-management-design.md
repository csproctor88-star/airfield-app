# FLIP Management Module — Design Spec

**Date:** 2026-06-23
**Status:** Draft for review
**Author:** Session design (brainstormed from prototype + DAFMAN 13-204V2)
**Source artifacts:** `flip-tracker-spec.md`, `fliptracker.html` prototype (localStorage single-file), 6 prototype screenshots, DAFMAN 13-204V2 (20 Sep 2024) ¶2.5.2.18.

---

## 1. Purpose & regulatory basis

FLIP (Flight Information Publication) Management is the **electronic equivalent of the "FLIPs Continuity Binder"** required by **DAFMAN 13-204V2 ¶2.5.2.18.1** — the system of record by which the appointed primary/alternate FLIPs manager tracks accountability of FLIP products, documents FLIP-edition reviews, and coordinates non-procedural FLIP changes through AFM approval.

It migrates a working single-file HTML/localStorage prototype into Glidepath as a role-gated, multi-user, base-scoped module that follows existing Glidepath conventions (permission matrix + per-module role assignments à la AMTR, RLS via the matrix helpers, offline write queue, `SECURITY DEFINER` signing RPC, private storage bucket, client-side PDF).

### 1.1 Governing requirements (DAFMAN 13-204V2 ¶2.5.2.18)

| ¶ | Requirement (paraphrased; see reg for verbatim) | Where it lands in this module |
|---|---|---|
| 2.5.2.18 | Appoint a **primary and alternate** FLIPs manager. (T-3) | FLIP roles `custodian` + `alternate`; Appointment Letter section. |
| 2.5.2.18.1 | Maintain a FLIPs Continuity Binder **or electronic equivalent** to manage/track accountability of FLIP products. (T-3) | The module as a whole; Home / Account Overview / Local FLIP List / References. |
| 2.5.2.18.2 | Order FLIPs and aeronautical charts per established distribution (see **AFI 11-201**). (T-3) | Ordering Process editable section. |
| 2.5.2.18.2.2 | Review local airfield data in each new FLIP edition for accuracy/consistency. (T-3) | FLIP Reviews page. |
| **2.5.2.18.2.2.1** | **Document FLIP reviews** in an MFR/log/electronic equivalent. Log **must include FLIP title, effective date, review completion date, discrepancies noted, corrective action, date corrected, and name/rank of reviewer.** (T-3) | FLIP Reviews data model (drives required fields incl. **`date_corrected`**). |
| 2.5.2.18.2.2.2 | Prepare/coordinate **non-procedural FLIP changes** with local agencies; **AFM is the approval authority**; monitor/track until corrected. (T-3) | FLIP Changes pipeline; AFM approval gate. |
| 2.5.2.18.2.2.3 | Annotate "NOTAM Manager Airfield" in submitted change text for airfield-diagram changes. (T-3) | Change NOTAM/details fields; guidance copy. |
| 2.5.2.18.2.2.4 | Initiate NOTAM action for non-procedural FLIP changes as necessary. (T-3) | Change NOTAM field. |
| 2.5.2.18.2.2.8 | Post changes to FLIP products; **annotate operating initials and date posted** on each change notice. (T-3) | Publish step captures posted date + operating initials. |

**Note on the sign-off chain.** The reg's review-log minimum (¶2.5.2.18.2.2.1) requires only the **reviewer's name/rank**. The **Custodian → NAMO → AFM** sequential sign-off implemented here is a **local oversight enhancement** requested by the unit, not a reg-mandated tri-signature. The Guide copy will frame it that way (reviewer signature = compliance; NAMO/AFM = local oversight).

---

## 2. Scope

### 2.1 In scope
- New `/flip` module, **dual-mode** (`appliesTo: ['usaf','faa_part139']`), mode-aware terminology.
- Three pages: **Home** (Account Overview + References), **FLIP Changes** (3-stage pipeline), **FLIP Reviews** (documented reviews + sequential locked sign-off).
- Two-layer authorization: global permission-matrix keys (`flip:view|write|manage|export`) + per-module role assignments (`flip_role_assignments`) with an admin roles matrix.
- Real file uploads (references + submitted-change PDFs) to a private `flip` Storage bucket via the authenticated proxy.
- Signed-review **PDF export** (`lib/flip-pdf.ts` → `{ doc, filename }`).
- Glidepath-native theming (theme-aware CSS tokens; **prototype navy/gold palette discarded**).
- Writes routed through the offline write queue; signing via `SECURITY DEFINER` RPC.

### 2.2 Out of scope (this build)
- Events Log (`/activity`) integration. *(Declined; clean add-on later.)*
- Sidebar pending-approval badge. *(Declined; clean add-on later.)*
- Email notifications on stage changes.
- Audit/history beyond the sign-off + posted-by capture.
- Live NOTAM-feed integration (NOTAM is a free-text reference field here).
- In-browser PDF annotation/viewing.

---

## 3. Architecture overview

- **Per-base.** Every table carries `base_id UUID REFERENCES bases(id) ON DELETE CASCADE` + RLS.
- **RLS** uses the matrix helpers only: `user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:<action>')`. No dropped helpers.
- **Two authorization layers** (mirrors AMTR):
  - *Layer A — global matrix:* gates module access + admin/manage + export.
  - *Layer B — `flip_role_assignments`:* gates who may act as custodian/alternate/namo/afm inside records (coordinate, approve, publish, sign).
- **Signing** is done by a single `SECURITY DEFINER` RPC (`flip_sign_review`) that derives the signer from `auth.uid()`, enforces role + sequence + permanence, never trusting a client-supplied identity. Mirrors `amtr_sign` / `sign_daily_review_slot`.
- **Writes** go through `lib/sync/write-queue.ts` (`enqueueOrExecute`) with registered handlers — never direct CRUD from new write surfaces.
- **Files** live in a private `flip` bucket; DB stores the storage path (no bucket prefix); download via an authenticated `/api/flip-file` proxy (mirrors the `photos` pattern).
- **Terminology** resolves through `lib/airport-mode.ts` so role/section labels adapt to USAF vs Part 139.

---

## 4. Roles & permissions

### 4.1 Layer A — global permission-matrix keys

Add to `lib/permissions.ts` (`PERM`) and seed in a permissions migration:

| Key | Label | Gates |
|---|---|---|
| `flip:view` | View FLIP Management | Open the module; read all FLIP pages/records. |
| `flip:write` | Edit FLIP Records | Edit text sections, manage FLIP list, upload references, coordinate changes, enter change dates/PDF, document reviews. |
| `flip:manage` | Manage FLIP Roles | The roles admin menu (assign/remove FLIP role assignments). |
| `flip:export` | Export FLIP Data | Generate review/continuity PDFs. |

**Role grants** (seed in migration, `applies_to '{usaf,faa_part139}'`):
- `sys_admin`, `airfield_manager`, `namo`, `base_admin` → all four keys.
- `amops` → `view`, `write`, `export` (no `manage`).
- `accountable_executive` (civilian AFM parallel), `ops_supervisor` (civilian NAMO parallel) → mirror AFM/NAMO grants for dual-mode.
- `read_only`, `safety`, `atc` → `view` only.

> Exact civilian-role grants to be confirmed against the live `role_permissions` seed during implementation; the principle is "civilian parallels of AFM/NAMO get the same FLIP grants as their USAF counterparts."

### 4.2 Layer B — per-module FLIP role assignments

New table `flip_role_assignments`, **one row per (base, user, role)** so a user may hold multiple FLIP roles (e.g. a person who is both `custodian` and `namo`). Managed from an admin roles matrix gated by `flip:manage`. Mirrors `amtr_role_assignments`.

FLIP roles:

| Role key | USAF label | FAA label (via airport-mode) | Authority |
|---|---|---|---|
| `custodian` | Primary FLIP Custodian | FLIP Custodian | Coordinate changes; enter submitted-stage data; sign the Custodian review slot. |
| `alternate` | Alternate FLIP Custodian | Alternate FLIP Custodian | Same as `custodian` (can sign the Custodian slot). |
| `namo` | NAMO | Operations Supervisor | Sign the NAMO review slot (2nd). |
| `afm` | AFM (Airfield Manager) | Airport Operations Manager | Approve/publish/reject changes; sign the AFM review slot (final). |

> **Why `alternate` is its own role:** ¶2.5.2.18 mandates appointing **both** a primary and an alternate FLIPs manager. Both hold custodian-equivalent signing authority; the distinction is recorded for the appointment letter and is meaningful for the admin matrix. The Custodian review slot accepts a signature from a holder of **either** `custodian` or `alternate`.

### 4.3 Authorization map (per action)

| Action | Layer A (matrix) | Layer B (FLIP role) | Notes |
|---|---|---|---|
| Open module / read | `flip:view` | — | |
| Edit text sections / FLIP list / Directions | `flip:write` | — | Any writer; not gated by FLIP role. |
| Upload / delete reference | `flip:write` | — | |
| Coordinate new change | `flip:write` | `custodian` or `alternate` | |
| Enter creation/processed/published dates + PDF (submitted stage) | `flip:write` | `custodian` or `alternate` | |
| **AFM Approval** (coordination → submitted) | `flip:write` | `afm` | ¶2.5.2.18.2.2.2. |
| **Mark Published** / **Reject** | `flip:write` | `afm` | Publish captures operating initials + posted date (¶2.5.2.18.2.2.8). |
| Document FLIP Review | `flip:write` | `custodian` or `alternate` | |
| Sign Custodian slot | `flip:write` | `custodian` or `alternate` | Slot 1; via RPC. |
| Sign NAMO slot | `flip:write` | `namo` | Slot 2; RPC requires slot 1 signed. |
| Sign AFM slot | `flip:write` | `afm` | Slot 3 (final); RPC requires slot 2 signed. |
| Assign/remove FLIP roles | `flip:manage` | — | Admin roles matrix. |
| Export review/continuity PDF | `flip:export` | — | |

---

## 5. Data model

All tables: RLS enabled; `SELECT` gated on `flip:view`, `INSERT/UPDATE/DELETE` on `flip:write` (role-specific writes additionally enforced by RPC). `base_id` FK + index. Single migration file `2026######_flip_management.sql` (or split per phase — see §11).

### 5.1 `flip_text_sections`
Editable rich-text blocks (one row per base per section_key). Upsert with explicit `onConflict` and toast-on-error.

```sql
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
```

### 5.2 `flip_list`
The Local FLIP List — **sole source** of FLIP titles for the review dropdown (free-text deliberately blocked).

```sql
CREATE TABLE flip_list (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_list_base ON flip_list(base_id);
```

### 5.3 `flip_references`
Uploaded reference documents (real files in the `flip` bucket).

```sql
CREATE TABLE flip_references (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('pdf','docx','pptx','xlsx','other')),
  storage_path TEXT NOT NULL,           -- e.g. '<base_id>/references/<uuid>.pdf' (no bucket prefix)
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_references_base ON flip_references(base_id);
```

### 5.4 `flip_changes`
Non-procedural FLIP change pipeline record.

```sql
CREATE TABLE flip_changes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  flip_title         TEXT NOT NULL,
  notam              TEXT,                       -- NOTAM number/reference (¶.2.2.3/.2.2.4)
  details            TEXT,
  submitted_by_name  TEXT NOT NULL,              -- name/rank as entered
  submitted_by_user  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage              TEXT NOT NULL DEFAULT 'coordination'
                       CHECK (stage IN ('coordination','submitted','completed')),
  rejected           BOOLEAN NOT NULL DEFAULT FALSE,
  afm_approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  afm_approved_at    TIMESTAMPTZ,
  creation_date      DATE,
  processed_date     DATE,
  published_date     DATE,
  posted_initials    TEXT,                       -- operating initials (¶2.5.2.18.2.2.8)
  posted_date        DATE,                       -- date posted to FLIP products (¶.2.2.8)
  pdf_filename       TEXT,
  pdf_storage_path   TEXT,                       -- '<base_id>/changes/<uuid>.pdf'
  coordinated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_changes_base_stage ON flip_changes(base_id, stage);
```

**Stage machine (one-directional):**
```
coordination --AFM Approval--> submitted --Mark Published--> completed
      |                              |
      +--------- Reject -------------+--> completed (rejected = TRUE)
```
- Coordination → Submitted requires the `afm` role (sets `afm_approved_by/at`).
- Submitted → Completed requires `creation_date` + `published_date` present and the `afm` role; capture `posted_initials` + `posted_date`.
- Reject (from either active stage) sets `stage='completed', rejected=TRUE`; `afm` role.

### 5.5 `flip_reviews` + `flip_review_items`
Per-cycle review header + per-FLIP rows. Field set driven by **¶2.5.2.18.2.2.1**.

```sql
CREATE TABLE flip_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  cycle        TEXT NOT NULL,                 -- e.g. 'Cycle 2026-03' / '1 JAN 2026 – 24 MAR 2026'
  review_date  DATE NOT NULL,                 -- review completion date
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_reviews_base ON flip_reviews(base_id);

CREATE TABLE flip_review_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         UUID NOT NULL REFERENCES flip_reviews(id) ON DELETE CASCADE,
  flip_title        TEXT NOT NULL,            -- chosen from flip_list (snapshot at submit)
  effective_date    DATE,
  discrepancy       BOOLEAN NOT NULL DEFAULT FALSE,
  discrepancy_note  TEXT,
  corrective_action TEXT,
  date_corrected    DATE,                     -- REQUIRED by ¶2.5.2.18.2.2.1 (prototype lacked this)
  sort_order        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_flip_review_items_review ON flip_review_items(review_id);
```

The required-log field "name/rank of individual performing the review" is satisfied by the **Custodian sign-off** (§5.6) — the signing user's profile name/rank + timestamp.

### 5.6 `flip_review_signoffs`
One row per review; three sequential locked slots. Mirrors `daily_reviews` slot pattern.

```sql
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
```
A signoff row is created (empty) when a review is submitted, or lazily on first sign.

### 5.7 `flip_role_assignments`
Per §4.2. Mirrors `amtr_role_assignments`.

```sql
CREATE TABLE flip_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('custodian','alternate','namo','afm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, user_id, role)
);
CREATE INDEX idx_flip_roles_base_user ON flip_role_assignments(base_id, user_id);
```

### 5.8 RLS policy template (applied to each table)
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<t>_select" ON <t> FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
CREATE POLICY "<t>_insert" ON <t> FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
CREATE POLICY "<t>_update" ON <t> FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
CREATE POLICY "<t>_delete" ON <t> FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
```
`flip_role_assignments` insert/update/delete gate on `flip:manage` instead of `flip:write`. Child tables (`flip_review_items`) join to parent for `base_id` in policies. Slot-specific signing is enforced by the RPC, not by table policies (the RPC is the only writer of `*_signed_by/at`; a trigger or column-grant blocks direct client updates to those columns — see §7).

---

## 6. Storage

- **Bucket:** private `flip` (new). Created in migration; not public.
- **Paths:** `<base_id>/references/<uuid>.<ext>` and `<base_id>/changes/<uuid>.pdf`. DB stores the path without bucket prefix.
- **Storage RLS:** base-scoped read/write keyed on `(storage.foldername(name))[1]::uuid` ∈ the caller's base membership, mirroring `2026062015_photos_bucket_private.sql`.
- **Download:** authenticated proxy route `GET /api/flip-file?path=...` (mirrors `/api/photos`) — validates base access, streams a signed URL or the object. `lib/supabase/flip-storage.ts` exposes `flipFileUrl(path)`.
- **Upload helper:** `uploadFlipFile(baseId, kind, file)` → `{ path, error }`.

---

## 7. Signing RPC (`flip_sign_review`)

`SECURITY DEFINER`, `EXECUTE` granted directly to `authenticated`. Signature:

```
flip_sign_review(p_review_id UUID, p_slot TEXT) RETURNS flip_review_signoffs
```

Logic (pseudocode):
```
v_caller := auth.uid();
v_base   := (SELECT base_id FROM flip_reviews WHERE id = p_review_id);   -- 404 if null

-- Layer A
IF NOT (user_has_base_access(v_caller, v_base)
        AND user_has_permission(v_caller, 'flip:write')) THEN RAISE 'not authorized'; END IF;

-- Layer B: role required per slot
required_roles := CASE p_slot
  WHEN 'custodian' THEN ARRAY['custodian','alternate']
  WHEN 'namo'      THEN ARRAY['namo']
  WHEN 'afm'       THEN ARRAY['afm']
END;
IF NOT EXISTS (SELECT 1 FROM flip_role_assignments
               WHERE base_id=v_base AND user_id=v_caller AND role = ANY(required_roles))
  THEN RAISE 'caller not authorized to sign slot %', p_slot; END IF;

-- upsert signoff row; lock existing
row := SELECT/INSERT flip_review_signoffs for p_review_id;

-- Sequence: custodian -> namo -> afm
IF p_slot='namo' AND row.custodian_signed_at IS NULL THEN RAISE 'custodian must sign first'; END IF;
IF p_slot='afm'  AND row.namo_signed_at      IS NULL THEN RAISE 'NAMO must sign first';      END IF;

-- Permanence: slot already signed -> error
IF row.<slot>_signed_at IS NOT NULL THEN RAISE '% already signed', p_slot; END IF;

UPDATE flip_review_signoffs
   SET <slot>_signed_by = v_caller, <slot>_signed_at = now()
 WHERE review_id = p_review_id
RETURNING *;
```

**Protecting signature columns from direct writes:** revoke client `UPDATE` on the `*_signed_by/at` columns (column-level grant) OR add a `BEFORE UPDATE` trigger that rejects changes to signed columns from anyone but the RPC. The RPC (definer-owned) bypasses. Decision deferred to plan (column-grant preferred; simpler and matches AMTR's RPC-only write of signature columns).

Client wrapper `lib/supabase/flip.ts → signFlipReview(reviewId, slot)` calls the RPC, routed through the offline write queue handler `flip_review_sign`.

---

## 8. Pages & features

### 8.1 `/flip` Home — Account Overview + References
**Sub-nav pills:** Account Overview · References.

**Account Overview** — five editable sections (Account Information, Current Appointment Letter, Ordering Process, FLIP Manager Responsibilities, and — on the Changes page — Directions). Each: display formatted text / italic empty-state placeholder; explicit Edit → textarea → Save (no auto-save); **toast on save error** (uncontrolled-input silent-save guard); persists to `flip_text_sections` via upsert with explicit `onConflict: 'base_id,section_key'`. Gated `flip:write`.

**Local FLIP List** — add (title + Add / Enter) / remove (trash). Sole source for the review dropdown. Empty list → review modal shows an **amber warning** (theme token), never a free-text fallback.

**References** — icon cards by file type (pdf/docx/pptx/xlsx) linking to authenticated download; **Add Reference** modal does a real upload (file picker → `uploadFlipFile` → insert `flip_references`). Delete removes the row and (best-effort) the object.

### 8.2 `/flip` → FLIP Changes
**Sub-nav pills:** Change Board · Directions · [+ Coordinate New Change].

**Change Board** — three collapsible stage sections (Coordination / Submitted–Awaiting Publication / Completed) with stage badges (theme tokens: amber=coordination, blue=submitted, green=completed, red=rejected). Cards collapsed by default; header shows FLIP title, name/rank, NOTAM, coordinated date, stage badge; expand for details/dates/actions/PDF link. One-directional.

- **Coordinate New Change** modal (FLIP Title*, NOTAM, Details, Name/Rank*) → inserts `stage='coordination'`. Gated `custodian`/`alternate`.
- **Coordination actions:** *AFM Approval* → `submitted`; *Reject* → completed+rejected. Gated `afm`.
- **Submitted actions:** date inputs (creation/processed/published), PDF upload; *Mark Published* (requires creation+published) → completed, capture `posted_initials`+`posted_date`; *Reject*. Gated `afm` for publish/reject; date/PDF entry gated `custodian`/`alternate`.
- **Completed:** read-only; PDF download link; red "Rejected" badge when applicable.

**Directions** — single editable section (`change_directions`), guidance copy referencing ¶2.5.2.18.2.2.2–.3.

### 8.3 `/flip` → FLIP Reviews
**[+ Document FLIP Review]** → modal: FLIP Cycle*, Review Date*, dynamic FLIP rows (add/remove). Each row: FLIP Title (**dropdown from `flip_list` only**), Effective Date, Discrepancies Yes/No toggle; if Yes → Discrepancy note + Corrective Action + **Date Corrected** (reg-required); if No → those fields hidden. Submit → inserts `flip_reviews` + `flip_review_items` + empty `flip_review_signoffs`; record becomes read-only.

**Completed review card** — collapsed; header shows cycle, review date, FLIP count, discrepancy count, sign-off status. Expand → full table (FLIP Title | Effective Date | Discrepancies | Discrepancy | Corrective Action | Date Corrected) + three sequential sign-off boxes.

**Sign-off boxes** (Custodian → NAMO → AFM): unsigned slot shows a **Sign** button enabled only when (a) it's this slot's turn in sequence and (b) the user holds the slot's FLIP role. Signing calls `flip_sign_review`; name auto-populates from the signed-in user's profile; locked state shows name/rank + formatted Zulu timestamp + green check, permanently. Reviews are fully read-only after submission.

**Export** — *Export Review PDF* (gated `flip:export`) → `lib/flip-pdf.ts`.

### 8.4 UI / theme
- **Discard the prototype navy/gold palette.** Build with Glidepath theme-aware CSS tokens (`[data-theme]` variables), existing card/badge/modal/toast components, Sonner toasts, lucide icons. No raw Tailwind greys, no `dark:`.
- Dates only (no Zulu HHMM time inputs needed); timestamps display via existing Zulu helpers.

---

## 9. PDF export (`lib/flip-pdf.ts`)
`generateFlipReviewPdf(input) → { doc, filename }` using `lib/pdf-utils.ts` helpers (`createPdf`, `drawBaseHeader`, `drawReportTitle`, `drawStatBox`, `tableStyles`, `drawFooter`, gap constants). Content: base header; title "FLIP MANAGEMENT REVIEW"; stat box (Cycle, Review Date, FLIP/discrepancy counts); the review items table (incl. Date Corrected); the three sign-off blocks with name/rank + timestamps; footer with DAFMAN 13-204V2 ¶2.5.2.18.2.2.1 citation. Filename `flip-review-<review_date>.pdf`.
*(A "FLIP Continuity Binder" summary PDF is a possible later add — out of scope now.)*

---

## 10. Module registration, nav, terminology, setup

- **`lib/modules-config.ts`** — add a `flip` entry: `key:'flip'`, `label:'FLIP Management'`, `category:'compliance'`, `hrefs:['/flip']`, `appliesTo:['usaf','faa_part139']`, `defaultEnabled:false`, `setupSteps:[]` (plus a `enabled_modules` backfill consideration — see Known-tech-debt: new `defaultEnabled` modules don't auto-reach existing bases; this one defaults **off**, enabled per base in setup).
- **`components/layout/sidebar-nav.tsx`** — map `'/flip' → 'flip:view'` in `HREF_TO_VIEW_PERM`; nav item under the compliance group with a suitable lucide icon.
- **`lib/airport-mode.ts`** — add FLIP role/section term keys for dual-mode labels (NAMO/AFM parallels already exist; add custodian/alternate labels and any section labels that differ).
- **`/help`** — add a FLIP Management section (6-section written Guide style) with the ¶2.5.2.18.x compliance citations; text-over-live-preview.

---

## 11. Per-file change list & phasing

Review-gated phases; each ends on `npm run build` (RC 0) + `npx tsc --noEmit` + `npx vitest run` green. Migrations applied individually via `npx supabase db query --linked --file` (never `db push`); verify `pg_*` objects after apply.

**Phase 1 — Schema, RLS, RPC, storage, CRUD lib**
- `supabase/migrations/…_flip_permissions.sql` — seed `flip:*` keys + role grants.
- `supabase/migrations/…_flip_management.sql` — all tables (§5) + RLS + `flip` bucket + storage RLS.
- `supabase/migrations/…_flip_sign_rpc.sql` — `flip_sign_review` + signature-column protection + EXECUTE grant.
- `lib/permissions.ts` — `PERM.FLIP_*`.
- `lib/supabase/flip.ts` — types + CRUD (text sections, list, references, changes, reviews+items, signoffs, role assignments) with `friendlyError`.
- `lib/supabase/flip-storage.ts` + `app/api/flip-file/route.ts` — upload/proxy.
- `lib/sync/handlers.ts` + registration — `flip_review_sign` (and any other queued writes).
- Tests: RPC role/sequence/permanence (regression-guard invariants); `flip-list`-drives-dropdown invariant.

**Phase 2 — Module registration + roles admin**
- `lib/modules-config.ts`, `components/layout/sidebar-nav.tsx`, `lib/airport-mode.ts`.
- `app/(app)/flip/roles/page.tsx` — roles matrix (members × {custodian,alternate,namo,afm}), instant-save, `flip:manage`. Modeled on `app/(app)/amtr/roles/page.tsx`.

**Phase 3 — Home (Account Overview + References + uploads)**
- `app/(app)/flip/page.tsx` (shell + Home), `components/flip/*` (editable section, FLIP list, references grid + add-ref modal).

**Phase 4 — FLIP Changes pipeline**
- Changes board, coordinate/edit/approve/publish/reject, Directions. `components/flip/change-card.tsx`, `coordinate-modal.tsx`.

**Phase 5 — FLIP Reviews + sequential sign-off**
- Review modal (dynamic rows, dropdown-only, discrepancy + date-corrected), completed-review card, sign-off boxes wired to `flip_sign_review` via the queue.

**Phase 6 — PDF export + Guide + polish**
- `lib/flip-pdf.ts`; `/help` FLIP section; empty-states, a11y, responsive, theme-token pass.

---

## 12. Conventions honored
- RLS via matrix helpers only (`user_has_permission` + `user_has_base_access`).
- Per-module roles mirror AMTR (`*_role_assignments`, admin matrix, RPC role check).
- Writes via the offline queue (registered handler **and** wired caller).
- Upserts toast on error; explicit `onConflict`.
- `SECURITY DEFINER` RPC derives signer from `auth.uid()`; EXECUTE granted to roles, never PUBLIC; never revoke from `user_has_*`.
- Theme-aware tokens; HHMM-free; no PII gating.
- No fabricated reg text — all citations trace to DAFMAN 13-204V2 ¶2.5.2.18.x (verbatim in the reg).
- Commits gated on build RC 0; migrations applied one-per-file against the linked DB.

## 13. Open items to confirm during planning
1. Civilian (`faa_part139`) role grant specifics for `accountable_executive` / `ops_supervisor` (mirror AFM/NAMO).
2. Signature-column protection mechanism: column-level grant vs trigger (lean column-grant).
3. Whether `enabled_modules` needs an explicit backfill for any base on launch, or stays setup-driven (default off).
4. Module category placement in the sidebar (`compliance` vs `core-ops`).
