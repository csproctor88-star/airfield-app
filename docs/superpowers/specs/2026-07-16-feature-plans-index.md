# 2026-07-16 Feature Plans — Index

Seven implementation-ready design specs produced in one planning session. Each is
self-contained (an implementer needs no other context), grounded in the current
codebase with `path:line` citations, and regulatory claims are split into
verified citations vs. flagged assumptions (each spec's §13). All specs were
adversarially verified against the repo before landing (spot-checked file
paths, symbols, table/column names, and house-rule compliance).

## The specs

| Spec | Module | Scope | Migrations |
|---|---|---|---|
| [obstruction-manual-coordinates](2026-07-16-obstruction-manual-coordinates-design.md) | Obstructions | Typed coordinate entry (DD / DMS / DDM / MGRS / FAA NOTAM DDMMSS) placing the evaluation pin via the existing `flyToPoint` + `handlePointSelected` pipeline; new `lib/calculations/coordinates.ts` parser + `mgrs` package; four-format point display with copy | none |
| [obstruction-part77-surfaces](2026-07-16-obstruction-part77-surfaces-design.md) | Obstructions | FAA Part 77 polygon builders (`lib/calculations/part77-geometry.ts`) and surface-set-aware map rendering, legends, labels, and PDF row; fixes four UFC-hardwired page paths; widens the base-config FAA approach selector gate | none |
| [flight-planning-room-check](2026-07-16-flight-planning-room-check-design.md) | FPR Check (new, standalone, SCN-patterned) | Base-config-editable checklist; users start/work/complete checks with history + PDF export | `2026071620`–`21` (`fpr_*` tables + permissions) |
| [local-regulations-review](2026-07-16-local-regulations-review-design.md) | Local Regs (References) | Base admins upload local regulation PDFs; per-doc monthly/quarterly recurring review with QRC-parity red-dot; leadership compliance view | `2026071630`–`33` (tables, permissions, storage, module key) |
| [namo-namt-report-tool](2026-07-16-namo-namt-report-tool-design.md) | Reports & Analytics | Per-user activity matrix (wildlife/BASH, inspections, checks, discrepancies, QRCs, …) over a date range; PDF + Excel export; per-domain attribution coverage labeling | `2026071640`–`42` (permission + attribution FKs) |
| [airfield-driving-spot-check](2026-07-16-airfield-driving-spot-check-design.md) | 43 Check Log (Airfield Management) | DAFI 13-213 airfield driving spot check: start-check form (AF Form 483 verification, vehicle, FOD, radio), history, AOB-ready PDF export | `2026071650`–`51` (`driving_check_*` tables + permissions) |
| [airfield-surface-set-expansion](2026-07-16-airfield-surface-set-expansion-design.md) | Obstructions / Base Configuration | Selectable surface standards — AF Class A, AF Class B, Army Class B, ICAO Annex 14, FAA Part 77 — via a surface-set registry + per-runway classification in the base-config Runways step; builds on (and generalizes) the Part 77 polygons spec | `2026071660`–`62` (CHECK widening, ICAO runway columns, `runway_class` nullable) |

Migration numbers are pre-assigned in non-overlapping ranges so the specs can
be built in any order without collisions; bump each file's `YYYYMMDDXX` to the
actual implementation date when it lands.

## Recommended build order

1. **Obstruction manual coordinates** — zero migrations, client-only, small
   surface area; immediate field value.
2. **Part 77 surface polygons** — zero migrations; completes the already-shipped
   Part 77 evaluation story (civilian/joint-use bases currently see wrong
   shapes, which reads as a defect).
   1. **Surface-set expansion** follows directly after it (it generalizes that
      spec's architecture), but its §13 item 2 — the audit of the currently
      encoded Class B dimensions against UFC 3-260-01 Table 3-7 — is an
      **owner decision needed before build**, since correcting Class B changes
      all future evaluation results.
3. **NAMO/NAMT attribution migrations only** (`2026071641`, `2026071642`) —
   land these early even though the report UI comes later: per-user attribution
   only accrues from the moment the columns exist, and the report's usefulness
   scales with collected history.
4. **Flight Planning Room Check** — standalone module, no dependencies.
5. **43 Check Log** — standalone module, no dependencies; pairs naturally with
   the FPR check build since both reuse the same module-enablement recipe.
6. **Local regulations review** — the largest build (storage + recurring-review
   engine + References UI).
7. **NAMO/NAMT report UI** — last, when the most attributed data exists to
   report on.

## Open questions

Each spec carries its own §13 *Assumptions & open questions* — the items that
need an owner decision or a check against the current publication before or
during implementation. The most consequential: the surface-set expansion's
finding that the currently encoded UFC Class B dimensions conflict with the
verified Table 3-7 values (inner horizontal 13,120 ft vs 7,500 ft; ADCS model)
— an owner decision, since correcting them changes future evaluation results —
and the report tool's per-domain coverage-start labeling. The Part 77
subsection-lettering question is now **resolved** against the owner-supplied
eCFR PDF (§77.19: (a) Horizontal, (b) Conical, (c) Primary, (d) Approach,
(e) Transitional).
