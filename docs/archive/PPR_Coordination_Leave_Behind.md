# PPR Coordination — Quick Reference

**Glidepath replaces the paper/email PPR workflow with a single multi-agency coordination platform.** Public form → AMOPS triage → parallel agency coordination → AMOPS approval → automated requester notification. Every action is timestamped, attributed, and exportable as a PDF. *Satisfies DAFMAN 13-204 Vol 1 PPR program requirements.*

---

## The lifecycle

```
Public submission ──► PENDING TRIAGE ──► PENDING COORDINATION ──► PENDING APPROVAL ──► APPROVED
                            │                    │                       │                │
                            └─ pre-coordinated ──┴───────────────────────┴───► DENIED     └─► CANCELED
```

| Status | What it means |
|---|---|
| **Pending Triage** | Public submission landed; AMOPS picks which agencies must coordinate |
| **Pending Coordination** | One or more agencies have a pending row; they concur or non-concur |
| **Pending Approval** | All agencies have responded; AMOPS makes the final call |
| **Approved** | Requester has been emailed the PPR number |
| **Denied** | AMOPS rejected; requester has been emailed the reason |
| **Canceled** | Weather scrub / slip / aircrew pulled — separate from denial |

---

## Who does what

| Role | Action |
|---|---|
| **Transient aircrew** | Submits the public form (QR code or short URL) — no login |
| **AMOPS** | Triages submissions, picks agencies, approves or denies |
| **Supporting agency members** | Concur / non-concur on the slice that affects them |
| **Airfield Manager** | Backstop approver with the same permissions as AMOPS |
| **Base admin** | Configures agencies, agency members, columns, AMOPS reply-to email |

---

## What you get out of it

- **Parallel coordination.** All selected agencies are contacted simultaneously — no serial phone calls.
- **Live status visibility.** Realtime updates; requester gets emailed at every status change.
- **Full audit trail.** Every triage, concur/non-concur, approval, denial, and cancellation is timestamped with the actor's identity.
- **One-click PDF.** Self-contained PPR record satisfying DAFMAN documentation retention.
- **Atomic PPR numbering.** `{DOY}-{seq}-{OI}` format, serialized server-side — no duplicates, no skipped sequences.

---

## Email notifications (all sent automatically)

| When | Goes to |
|---|---|
| Public submission received | Requester (confirmation) |
| PPR routed to agencies | Each agency's members (coordination request) |
| PPR approved | Requester (with PPR number) |
| PPR denied | Requester (with reason) |
| PPR canceled | Requester |

Replies route to the base's AMOPS email — not a no-reply inbox.

---

## To get started at your base

1. **Configure the agency list** — list every supporting agency that may need to coordinate (Security Forces, Fuels, Transient Alert, CE, Med Group, etc.).
2. **Assign agency members** — link the right people to each agency so they get the coordination emails and pending dots.
3. **Configure PPR columns** — what info should the form collect, and which columns are required.
4. **Set the AMOPS reply-to email** — where requester replies should land.
5. **Distribute the QR code / short URL** — the public-form link goes on contact cards, mission planning materials, and the base transient page.

---

**For more detail:** see the in-app `/help` guidance or the full PPR Coordination Briefing.
**Reference:** DAFMAN 13-204 Vol 1 — PPR program requirements.
