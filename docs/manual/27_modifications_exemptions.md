# 27 — Modifications & Exemptions

**Path:** Sidebar → Training & Compliance → **Modifications & Exemptions** · Also on the Menu
(`/more`) on mobile · URL `/modifications-exemptions`
**Availability:** FAA Part 139 (civilian) airports only — the module never appears on USAF bases.
**Module status:** On by default. A base administrator can turn it off at **Base Configuration →
Modules** (`/base-config/modules`).

Modifications & Exemptions is the airport's own record of the three formal ways it differs from a
published requirement:

- **Modification of Standards (MOS)** — a case-by-case FAA-approved deviation from an airport
  design, construction, material, or equipment standard, processed under **FAA Order 5300.1G**.
  The FAA's system of record is the Airports GIS MOS Tool; this module tracks the airport's side —
  what was requested, where it stands, what the approval letter says, and when it expires.
- **Part 139 exemption** — a petition under **14 CFR §139.111** (via 14 CFR Part 11) to be excused
  from a Part 139 requirement, including the small-airport ARFF path in §139.111(b).
- **Emergency deviation (§139.113)** — a record that the airport deviated from Subpart D or the
  ACM during an emergency, with the required notification to the Regional Airports Division
  Manager within **14 days**.

Why it matters at inspection time: the FAA inspector's pre-inspection document request list
(Order 5280.5D) includes *"Modifications to Standards and exemptions"* outright, the ACM must
carry every current exemption (§139.203(b)), and the certification-inspection checklist asks
whether each exemption's justification is **still valid** — which this module answers with its
annual review log.

---

## The record list

The page opens on a stat strip (Active MOS · Active exemptions · Decision pending · Reviews due ·
Expired) over a filterable list. Every row shows the record type, title, the exact standard or
regulation it touches, and a status chip. Two extra chips appear on their own:

- **Expired** — an approved/granted record whose expiration date has passed. This is computed
  from the date; nobody has to remember to flip a status.
- **Annual review overdue / due soon** — approved relief must be reviewed each year for currency
  (Order 5280.5D §2.12.2); the chip turns amber 30 days out and red once the date passes. For
  deviations, the same slot warns when the 14-day RADM notification window is about to lapse or
  already has.

Click a row to expand its full detail: dates, decision summary and conditions, the review
history, and attachments.

## Creating a record

**New record** (requires write access) opens the form with a type picker. The form only shows the
fields that exist for that type:

- **MOS** — the standard being modified, the Order 5300.1G Appendix A category/subcategory picker,
  review authority (ADO / Regional / Headquarters), AGIS or airspace case number, and the
  baseline / proposed-difference / justification / safety narratives that mirror the ¶11.a
  certifications. A hint panel lists the situations where a MOS is **not** applicable (¶8.i) —
  RSA dimensions, OFZ surfaces, approach/departure surfaces, matching existing equipment, RPZ
  land use — so a doomed request never gets drafted.
- **Exemption** — the 14 CFR section(s), the §11.81 narratives (extent of relief, public
  interest, equivalent level of safety), and the FAA docket number once assigned. Ticking
  **ARFF small-airport petition** reveals the §139.111(b)(2) completeness checklist (itemized
  cost, staffing, financial report, enplanements, service history…) and the 120-day advance
  filing reminder.
- **Deviation** — the emergency date, what was deviated from, nature/extent/duration, and the
  RADM notification tracking (date notified; whether written notice was requested and provided).
  The form computes the exact 14-day deadline from the deviation date.

Statuses follow the real decision vocabulary: a MOS is **Approved/Disapproved**, an exemption is
**Granted / Partially granted / Denied** (partial grants are real — Order 5280.5D §8.6). Denied
exemptions show the §11.101 reconsideration deadline (60 days) while it's still open. A note on
approved MOS: the FAA does not amend an approved MOS — if something changes, a **new** MOS is
submitted (¶8.g), so create a new record rather than rewriting the old one.

## Annual reviews

On any approved/granted record, **Log annual review** records the §2.12.2 currency check: review
date, whether the justification is still valid, a recommendation (retain / resubmit / terminate),
and notes. Logging a review stamps the record's last-reviewed date and rolls **next review due**
forward one year automatically. The latest answer appears on the register PDF — it is exactly
what the inspector's "Justification Still Valid — No. on record" item wants.

## Attachments

Each record carries its own document file: petition, decision letter, SRM documentation,
airspace (OE/AAA) review, correspondence. **PDF only, 25 MB max** — the FAA itself wants
supporting findings in a non-editable format. Files live in private storage scoped to your base;
downloads are short-lived signed links.

## PDF exports

- **Register PDF** (top of the page) — the inspector-handoff document: the MOS table with the
  exact columns the ALP must carry (standard modified, approval-letter date, effective period,
  airspace case number, conditions — Order 5300.1G ¶12.b), the ACM current-exemptions list with
  each record's latest annual-review answer, any §139.113 deviations, and a **History** section
  where denied, withdrawn, and expired records remain on the record instead of vanishing.
- **Record PDF** (in each expanded row) — a single record's full detail with review history and
  attachment inventory.

## Access

| Role | Can |
|---|---|
| Airfield Manager · NAMO¹ · Base Admin · Ops Supervisor · Sys Admin | View + full manage (records, reviews, attachments) |
| Accountable Executive · SMS Manager · ARFF Chief · AEP Coordinator · AMOPS · Safety · Read Only · MAJCOM/RFM | View |
| ATC · PPR · kiosk roles | No access |

¹ Role labels adapt on civilian bases; the shared roles keep their permissions.

## Notes

- The module never files anything with the FAA. MOS submissions happen in Airports GIS; exemption
  petitions go to the Regional Airports Division Manager and the Federal Docket Management System.
  This is the airport's tracking record — the one that has to survive staff turnover and be
  producible when asked for.
- Terms and expirations come from the FAA's decision letter. The module deliberately does not
  hardcode a maximum exemption term (FAA's own handbook states both "3 years" and "2 years" in
  different paragraphs); enter the letter's dates and let the review cycle do the tracking.
