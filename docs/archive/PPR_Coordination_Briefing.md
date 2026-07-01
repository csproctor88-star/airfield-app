# PPR Coordination — Briefing Source Document

> **Purpose of this document.** Hand this to Claude.ai (or any slide
> generator) with a prompt like *"Build a comprehensive briefing slide
> deck from this source — audience is base leadership and supporting
> agencies. Use the suggested outline at the bottom; treat each
> section as one slide unless noted otherwise."*
>
> Everything below describes how Glidepath's PPR (Prior Permission
> Required) coordination process actually works today. It is written
> for an Airfield Management audience and assumes general familiarity
> with PPR concepts under DAFMAN 13-204 Vol 1.

---

## 1. What problem PPR Coordination solves

PPR is the gate that controls transient aircraft arrivals at a host
base. Historically the workflow was paper- or email-based:

- Transient aircrew called or emailed AMOPS to request arrival
  authorization.
- AMOPS typed it into a spreadsheet or paper log.
- AMOPS phoned/emailed each supporting agency (Security Forces,
  Fuels, Transient Alert, CE, Medical, etc.) one at a time to ask
  if they could support.
- Agencies responded by phone/email; AMOPS transcribed each yes/no
  into the same spreadsheet.
- Once everyone concurred, AMOPS called the requester back with a
  PPR number, or denied with a reason.

The problems with that process:

| Pain | Why it matters |
|---|---|
| No durable audit trail | Hard to reconstruct who approved what, when, with what comment |
| Coordination latency | Each phone call is a serial blocker; PPRs that sit overnight waiting on one agency |
| Silent failures | A missed email or voicemail = a transient lands without coordination |
| No visibility for the requester | Aircrew don't know status until AMOPS calls back |
| No standardization across bases | Every host base did this differently |

Glidepath replaces this with a **single multi-agency coordination
workflow** — public request → AMOPS triage → parallel agency
coordination → final approval → automated requester notification —
with every action timestamped and auditable.

---

## 2. The actors

| Actor | What they do | How they access |
|---|---|---|
| **Transient aircrew (requester)** | Submits the PPR request | Public web form, no login (QR code or short URL by ICAO) |
| **AMOPS (triage + approval)** | Receives submission, decides which agencies must coordinate, performs final approve/deny | Logged-in user with `ppr:triage` and `ppr:approve` permissions |
| **Supporting agencies (coordinators)** | Concur or non-concur on the slice of the PPR that affects them | Logged-in user who is a *member* of one or more agencies and holds `ppr:coordinate` |
| **Airfield Manager (AFM)** | Backstop approver — holds the same triage/approve permissions as AMOPS by default | Logged-in user with elevated PPR permissions |
| **Base admin** | Configures the per-base agency list, agency members, PPR columns, and AMOPS reply-to email | Logged-in user with `base_setup:write` |

> **Terminology note.** "AMOPS" in status names refers to the office
> (Airfield Management Operations), not a single user role. The
> triage and approval steps are available to any user holding the
> relevant permission key — by default AMOPS personnel, the Airfield
> Manager, NAMO, base admins, and system admins.

---

## 3. The lifecycle (state diagram)

```
                  ┌──────────────────────────────┐
                  │  Public submission (web form)│
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │   pending_amops_triage       │  ← AMOPS sees a dot in
                  └──────────────┬───────────────┘     the sidebar
                                 │ AMOPS opens the PPR and either:
                                 │   • picks the supporting agencies, or
                                 │   • marks it pre-coordinated (skip)
                                 ▼
                  ┌──────────────────────────────┐
                  │   pending_coordination       │  ← agency users see
                  └──────────────┬───────────────┘     pending dots
                                 │ Each agency concurs or non-concurs.
                                 │ When the last pending row clears…
                                 ▼
                  ┌──────────────────────────────┐
                  │   pending_amops_approval     │  ← AMOPS decides
                  └──────────────┬───────────────┘
                                 │ AMOPS approves or denies.
                  ┌──────────────┴───────────────┐
                  ▼                              ▼
           ┌──────────┐                   ┌──────────┐
           │ approved │                   │  denied  │
           └────┬─────┘                   └──────────┘
                │
                │ Approved PPRs can still be
                │ pulled later (weather scrub,
                │ slip, aircrew cancel).
                ▼
           ┌──────────┐
           │ canceled │
           └──────────┘
```

**Six total statuses:**

| Status | What it means | What happens next |
|---|---|---|
| `pending_amops_triage` | Public submission has landed; awaiting AMOPS review | AMOPS picks agencies (or skips coordination) |
| `pending_coordination` | One or more agencies have a pending coordination row | Agencies act; when the last clears, status auto-advances |
| `pending_amops_approval` | All agencies have responded; awaiting AMOPS final decision | AMOPS approves or denies |
| `approved` | PPR is good; requester has been emailed the PPR number | Can be canceled later if circumstances change |
| `denied` | AMOPS rejected; requester has been emailed the denial reason | Terminal (a fresh submission would start over) |
| `canceled` | A previously pending or approved PPR was pulled | Terminal; reason is stored for audit |

**Important: `denied` ≠ `canceled`.** Denial is an AMOPS rejection
of a request the agency could not support. Cancellation is for
weather scrubs, mission slips, or aircrew-initiated cancels on a
PPR that was already approved or in progress.

---

## 4. Configuration prerequisites (one-time, per base)

Before PPR Coordination can run, a base admin sets up:

### 4.1 The agency list — `ppr_agencies`

Per-base, free-text list of supporting agencies. Examples:

- Security Forces
- Transient Alert
- Fuels (POL)
- Civil Engineering — Pavement
- Medical Group / Bioenvironmental
- Wildlife / BASH
- Command Post
- ATC Tower
- Weapons Safety
- Anti-terrorism / Force Protection

Each agency has a sort order so the coordination panel displays
them in a consistent sequence.

### 4.2 Agency members — `ppr_agency_members`

This is the **missing link** between an agency label and the actual
people who handle that agency's coordination. Each row says
*"user U is a member of agency A at base B."* A user can be a
member of multiple agencies. Members:

- Receive the coordination-request email when a PPR is routed to
  their agency.
- See a pending coordination dot in their sidebar.
- Are who the audit log identifies as `coordinated_by` when they
  concur or non-concur.

A user does *not* have to be an agency member to act on a coord row
(any user with `ppr:coordinate` can act), but in practice agencies
own their members so the right people get notified.

### 4.3 PPR columns — `ppr_columns`

Per-base configurable column set that defines what data is captured
on a PPR. Three independent visibility flags per column:

| Flag | Effect |
|---|---|
| `show_on_form` | Column appears on the public submission form |
| `show_on_log` | Column appears in the on-screen PPR log table |
| `show_on_status` | Column surfaces on the Airfield Status / Today's PPRs panel |

Plus a `is_required` flag (enforced both client-side and in the
SECURITY DEFINER RPC).

Column types: `text`, `time` (Zulu or local display), `date`,
`yes_no_na`, `info_only` (read-only blurb shown on the form).

Examples of common columns: Callsign, Aircraft Type, Tail Number,
Number of PAX, Cargo on Board, Special Requirements, Lodging
Required, Vehicle Support, Fuel Required, ETA Zulu, ETD Zulu.

### 4.4 AMOPS reply-to email — `bases.amops_email`

Single email address used as the `replyTo` on every outbound PPR
email (coordination request, approval, denial, cancellation,
confirmation). If a recipient hits Reply, their response goes
directly to AMOPS, not to a no-reply mailbox. Validated server-side
so malformed entries don't kill the send.

---

## 5. The submission paths

There are **two ways** a PPR can enter the system.

### 5.1 Public submission (the headline workflow)

The transient aircrew goes to a short URL — either:

- `https://glidepathops.com/{ICAO}/ppr-request` (preferred, ICAO-keyed)
- `https://glidepathops.com/ppr-request/{baseId}` (legacy UUID form)

The URL is typically distributed as a QR code on AMOPS contact
cards, mission planning materials, or the base's transient page.

The form:

1. Loads the base name and the `is_public` column set via the
   `get_public_ppr_config` RPC (no authentication required).
2. Collects requester name, requester email, requester phone (now
   required as of `2026042900`), arrival date, plus all the
   public column values.
3. Submits via the `submit_public_ppr_request` SECURITY DEFINER
   RPC. Server-side validation enforces required fields and base /
   module enablement.
4. Lands as `status = 'pending_amops_triage'` with
   `public_submission = true`.
5. Mints a PPR number with an `XX` OI placeholder (no logged-in
   user, so the approver-initials slot is filled in later).
6. Returns a generic *"Request received"* confirmation. **The PPR
   number is not exposed to the requester until AMOPS approves.**
7. A confirmation email goes to the requester acknowledging
   receipt.

### 5.2 Internal create (AMOPS-initiated)

Logged-in AMOPS users can create a PPR directly from the `/ppr`
admin page, e.g., when the request arrived by phone. The internal
create modal offers **three mutually exclusive save modes**:

| Mode | Status on save | Coord rows | Emails sent |
|---|---|---|---|
| **Pre-coordinated (approve now)** | `approved` immediately | None | Approval email to requester (if email provided) |
| **Send to coordination** | `pending_coordination` | One row per selected agency | Coordination-request email to each selected agency's members |
| **Save pending — coordinating manually** | `pending_amops_approval` | None | None — AMOPS handles coordination offline (phone, face-to-face), finalizes later |

The third mode exists because not every coordination happens
in-app — sometimes AMOPS coordinates by phone with one agency and
just needs a placeholder that they can later flip to approved
without emailing the requester twice.

---

## 6. The triage step

Triage is what AMOPS does when a public submission lands.

The triage modal shows:

- All requester contact info (name, email, phone).
- All column values the requester provided.
- Free-form notes from the public form.
- The list of configured agencies (multi-select).
- An approver-initials field (OI) for the PPR number.

AMOPS chooses one of two paths:

| Choice | Effect |
|---|---|
| **Select 1+ agencies → Route** | Entry transitions to `pending_coordination`. One coordination row is inserted per selected agency. Each agency's members receive a coordination-request email. Triage actor + timestamp are stamped on the entry. |
| **Select no agencies → Skip (pre-coordinated)** | Entry transitions directly to `approved`. PPR number's `XX` placeholder is rewritten to the approver's actual OI. Approval email fires to the requester. |

The skip-coordination path covers the *"I just talked to all the
agencies on the phone — this is good, push it through"* scenario.

---

## 7. Coordination — the parallel multi-agency step

Once an entry hits `pending_coordination`, the work fans out.

**For each selected agency:**

1. A row exists in `ppr_coordination` with
   `status = 'pending'`, `agency_name` denormalized so deleting
   the agency config doesn't lose history.
2. Every agency *member* (per `ppr_agency_members`) receives a
   coordination-request email with the PPR details, requester
   contact, arrival info, and a link back into the app.
3. The agency members also see a pending dot on the `/ppr`
   sidebar entry — the badge counts coord rows where the current
   user is a member of the assigned agency.

**Each agency acts independently:**

- A coordinator opens the PPR, reviews the request, and either
  **concurs** or **non-concurs**, optionally adding a comment.
- The action is timestamped (`coordinated_by`, `coordinated_at`).
- The comment is mirrored into the PPR's `ppr_remarks` thread —
  prefixed with `[Agency Name — CONCUR]` or
  `[Agency Name — NON-CONCUR]` — so the remarks tab is a single
  human-readable timeline of who said what.

**Auto-advance:**

After each coord row is updated, the system counts remaining
pending rows for that entry. When **zero pending rows remain**, the
entry auto-advances to `pending_amops_approval` (idempotently
guarded so it can't advance twice). The status flip happens
inside the same client call that completed the last coord row —
no cron job, no polling delay.

> **Note: today coordination is parallel — all selected agencies
> get the request simultaneously.** Sequential / dependent
> coordination (e.g., "Fuels can't coordinate until Transient Alert
> does") is a deferred enhancement, not in v1.

---

## 8. Final approval

When all agencies have responded, an AMOPS user (or AFM, NAMO,
base admin) opens the PPR and sees the full picture:

- All agency decisions (CONCUR / NON-CONCUR) with timestamps and
  comments.
- The merged remarks timeline.
- All column values + notes.
- Requester contact info.

They click **Approve** or **Deny**.

### 8.1 Approve

1. Status flips to `approved`.
2. The PPR number's trailing OI segment is rewritten from `XX` to
   the approver's actual initials. *(Internal pre-coordinated
   PPRs already have the right OI baked in, so they're left
   alone.)*
3. The approval email fires to the requester with the PPR number
   and arrival details.
4. The action is logged in the activity log with the approver's
   identity.

### 8.2 Deny

1. Status flips to `denied`.
2. A denial reason is captured (required field).
3. The denial email fires to the requester with the reason.
4. The action is logged.

Even if one or more agencies non-concurred, AMOPS has the final
authority — they can still approve with documented rationale, or
deny with reference to the non-concurrence.

---

## 9. Cancellation

Cancellation is a **separate terminal state** from denial. Use cases:

- Weather scrub before arrival.
- Mission slip.
- Aircrew calls to cancel a previously approved PPR.
- AMOPS pulls a still-pending PPR because the requester withdrew.

**Mechanics:**

- Any user with `ppr:write` can cancel a non-terminal entry.
- A cancellation reason is required.
- Status flips to `canceled`; cancellation reason is stored.
- A cancellation email fires to the requester (slate-grey palette
  to visually distinguish it from approval / denial mail).
- The cancellation appears in the activity log.

Why separate from denial? Because denial means *"AMOPS rejected
the request"* (a negative judgment), while cancellation means
*"the request is no longer needed"* (often initiated by the
requester). Mixing them would corrupt the audit narrative.

---

## 10. Email notifications

All PPR emails are sent via **Resend** with branded HTML
templates. There are five distinct email routes:

| Route | Trigger | Recipient | Palette |
|---|---|---|---|
| `send-ppr-confirmation` | Public submission lands | Requester | Brand cyan |
| `send-ppr-coordination-request` | Triage routes to N agencies | Each agency's members | Brand cyan |
| `send-ppr-approval` | AMOPS approves | Requester | Brand cyan |
| `send-ppr-denial` | AMOPS denies | Requester | Brand cyan |
| `send-ppr-cancellation` | Anyone cancels | Requester | Slate grey |

**All emails:**

- Use the base's `amops_email` as `replyTo`, falling back to
  `info@glidepathops.com` if malformed.
- Pass through `formatPprColumnValue()` — the single helper that
  renders `time` / `yes_no_na` / `date` / `text` values
  consistently across the on-screen log, detail dialog, PDF, and
  every email template. Changing a display rule in one place
  changes it everywhere.
- Are best-effort — a failed email never rolls back the status
  change. Internal-create PPRs without a requester email simply
  skip the requester-facing emails silently.

---

## 11. The PPR number format

`{DOY}-{seq}-{OI}`

- **`DOY`** — Day-of-year of the arrival date (`001`–`366`), 3 digits, zero-padded.
- **`seq`** — Sequence within that base × arrival date, 3 digits, zero-padded.
- **`OI`** — Approver's office initials (2 characters by convention).

Examples:

- `145-001-JD` — first PPR of arrival day 145 (May 25), approved by user JD.
- `145-002-XX` — second PPR of arrival day 145, public submission still awaiting triage (XX placeholder).

**Atomicity:** Numbers are minted server-side via the
`_ppr_generate_number` PL/pgSQL function backed by an atomic
counter table (migration `2026042803`). Concurrent submissions on
the same `(base, arrival_date)` are serialized — no duplicate
numbers, no skipped sequence.

**OI rewrite on public approval:** Public submissions can't know
the approver's OI at submit time, so they mint with `XX` and the
trailing segment is rewritten on approval. Internal pre-coordinated
PPRs carry the creator's OI from the start.

---

## 12. Audit trail and visibility

Every PPR action is captured in three layers:

| Layer | What it records | Where it surfaces |
|---|---|---|
| **Entry status fields** | Triage actor + timestamp, approval actor + timestamp, denial reason, cancellation reason | PPR detail dialog, PDF export |
| **Coordination rows** | Which agency, who acted, when, concur/non-concur, comment | Coordination panel on the PPR, PDF |
| **Remarks thread** | All free-form remarks + coordination comments mirrored in | Remarks tab on the PPR detail |
| **Activity log** | Every create / triage / coordinate / approve / deny / cancel as a discrete event | `/activity` (Events Log) |
| **PDF export** | Full PPR snapshot: all columns, coordination state, remarks, audit fields | One-click PDF export, optional email distribution |

The PDF is the artifact that satisfies the DAFMAN 13-204 Vol 1
documentation requirement — a single self-contained record of the
PPR from submission through final disposition.

---

## 13. Permission keys (who can do what)

The PPR module is gated by the platform's permission matrix. The
PPR-specific keys:

| Key | What it allows | Default holders |
|---|---|---|
| `ppr:view` | Read PPR entries and coordination | AMOPS, AFM, NAMO, base admins, sys admins, plus the plain `ppr` role |
| `ppr:write` | Create / edit / cancel PPR entries | AMOPS, AFM, NAMO, base admins, sys admins |
| `ppr:triage` | Triage a public submission (assign agencies) | AMOPS, AFM, NAMO, base admins, sys admins |
| `ppr:coordinate` | Concur / non-concur on a coord row | All of the above + the plain `ppr` role (so agency members holding `ppr` can act) |
| `ppr:approve` | Final approve / deny | AMOPS, AFM, NAMO, base admins, sys admins |

The plain `ppr` role is the one assigned to a user who is *only* a
coordinating agency member — they can see and act on their agency's
coord rows but cannot triage or finalize.

Permissions can be re-assigned per-base from the admin user
management UI. Every CRUD path and every SECURITY DEFINER RPC
re-checks the relevant permission key on every call.

---

## 14. Realtime + offline behavior

- **Realtime:** The `/ppr` page subscribes to `ppr_entries` and
  `ppr_coordination` for live updates. When an agency coordinator
  acts in their browser, AMOPS sees the row flip from pending to
  concur within a second — no refresh needed.

- **Offline writes:** PPR CRUD is wrapped in the offline write
  queue. If a user submits an action on a flaky network, the
  action queues locally and replays on reconnect. The OFFLINE
  pill in the sidebar flags this state.

- **Sidebar badge:** Counts pending coordination rows for the
  current user (rows where the user is a member of the assigned
  agency and the row is still pending). Polled defensively per
  the platform's polling rules (60s+, visibility-gated) but the
  realtime channel keeps it fresh sub-second when the tab is
  active.

---

## 15. Where this fits in DAFMAN 13-204 Vol 1

DAFMAN 13-204 Vol 1 requires host bases to control transient
aircraft arrivals via a PPR program. Specific compliance points
this module satisfies:

| Requirement | How Glidepath satisfies it |
|---|---|
| Documented PPR process with audit trail | Every action timestamped + actor-identified + retained indefinitely |
| Coordination with affected base agencies | Multi-agency parallel coordination with concur / non-concur capture |
| Aircrew notification of approval / denial | Automated branded email to requester at every status change |
| Standardized PPR numbering | Atomic `{DOY}-{seq}-{OI}` format, serialized per base × arrival date |
| Records retention | Database-backed, PDF-exportable, indefinite retention |

The "AMOPS controller approves PPR" line in DAFMAN is satisfied by
the `ppr:approve` permission + the approval audit fields
(`approval_user_id`, `approval_at`, `approver_oi`).

---

## 16. What this module *does not* do (current scope)

For honesty with the audience — known limitations as of this
briefing:

- **Sequential coordination.** All selected agencies are
  contacted in parallel. There's no dependency chain
  (e.g., "Fuels coordinates only after Transient Alert
  concurs"). Deferred until customer demand surfaces.
- **Public-form file uploads.** Aircrew can't attach a load
  manifest or dangerous-goods declaration to the public form.
  Deferred.
- **Bulk coordinate.** An agency member can't action multiple
  PPRs in one click — each is its own row. Deferred.

None of these are blocking gaps; they're enhancements waiting on
operational feedback.

---

## 17. Demo-mode and pilot considerations

- The demo base ships with a representative agency list and a
  small set of seeded PPRs in each lifecycle state, so a demo
  walks naturally from public submission → triage → coordination
  → approval without prep work.
- Each pilot base goes through the 15-step Base Setup Wizard,
  which includes a dedicated PPR configuration step (columns +
  agencies + members + AMOPS email).
- The public form URL is the QR code material the base distributes
  to inbound aircrew through their normal mission-planning
  channels.

---

# Suggested slide deck outline

Use this as the deck skeleton. Each numbered item = one slide
unless marked *(2 slides)*.

1. **Title** — *PPR Coordination — How Glidepath Replaces the
   Paper/Email Workflow*
2. **What is PPR and why it matters** — DAFMAN 13-204 Vol 1
   context + the cost of getting it wrong
3. **The old way** — Pain table from §1 (paper logs, phone calls,
   serial blocking, no audit trail)
4. **The new way at a glance** — One-line summary: public form →
   AMOPS triage → parallel agency coord → AMOPS approval →
   automated requester notification
5. **The actors** — Visual lineup (Requester / AMOPS / Agencies /
   AFM / Admin) from §2
6. **The lifecycle** *(2 slides)* — State diagram from §3, plus
   the six-status table
7. **Step 1 — Public submission** — From §5.1, screenshot of QR
   code + form
8. **Step 2 — AMOPS triage** — From §6, screenshot of triage modal
9. **Step 3 — Parallel agency coordination** — From §7, emphasize
   the fan-out + auto-advance
10. **Step 4 — Final approval (or denial)** — From §8
11. **Cancellation as a separate state** — From §9, emphasize
    `denied ≠ canceled` and why
12. **Email notifications** — Table from §10 (5 routes, what each
    one does)
13. **The PPR number** — Format from §11, atomicity guarantee
14. **Audit trail** *(2 slides)* — Table from §12, plus a sample
    PDF export screenshot
15. **Permission model** — Role matrix from §13 — who can triage,
    who can coordinate, who can approve
16. **Configuration prerequisites** — From §4 — agencies, members,
    columns, AMOPS email (one bullet each)
17. **Realtime and offline** — From §14 — live updates + offline
    queue + sidebar badges
18. **DAFMAN compliance mapping** — Table from §15
19. **Internal create modes (advanced)** — From §5.2 — three save
    modes for AMOPS-initiated PPRs
20. **Known limitations (honesty slide)** — From §16 — sequential
    coord, file uploads, bulk action — all deferred
21. **What this looks like in practice** — Suggested screenshot
    tour: QR poster → form → AMOPS triage → agency view → final
    PDF
22. **Q&A**

> **Tone suggestion for the deck:** This is a compliance + ops
> efficiency briefing for a mixed audience (leadership +
> coordinating agencies). Lead with the time savings and audit
> trail benefits; reserve regulatory citations for the back half
> when establishing credibility with the compliance-minded
> stakeholders. Avoid jargon like "RPC", "RLS", "JSONB" — those
> are implementation details, not briefing content.
