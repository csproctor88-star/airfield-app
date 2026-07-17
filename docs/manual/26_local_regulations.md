# 26 — Local Regulations

**Path:** Sidebar → Reference Library → **Base Regs** tab (Reference section) · Also on the Menu
(`/more`) on mobile, under Reference Library · URL `/regulations` (deep link `?tab=base-regs`)
**Module status:** On by default. An Airfield Manager, NAMO, or Base Administrator can turn it off
at **Base Configuration → Modules** (`/base-config/modules`) if a base doesn't want it — it ships
enabled on both new and existing bases, unlike the opt-in Flight Planning Room Check and Airfield
Driving Spot Check modules.

Local Regulations gives airfield management a recurring read-and-attest cycle for standing local
publications — base operating instructions, wing instructions, local supplements — instead of a
paper initial sheet that goes stale the moment the document is reissued. Leadership uploads the
current PDF; every required reviewer must re-review it on a monthly or quarterly cadence (set per
document), and a red badge follows anyone with a review outstanding until they clear it. Managers
get a per-document compliance view — who has reviewed the current edition and who hasn't — and a
PDF export for the Airfield Operations Board or an inspection package.

The review cadence is a locally configurable setting, not a fixed regulatory mandate — pick
monthly or quarterly per document to match your wing's publication currency policy.

---

## Overview

Local Regulations lives as the third tab on the Reference Library page (`/regulations`), alongside
**References** and **My Documents**. It only appears for users who hold view access to it; the tab
carries a red due-count chip whenever the signed-in user has at least one document to review.

Each document row shows the title, current version (`v2`, `v3`, … once replaced), review interval,
and **Your status** — a green **Reviewed {date}** line when current, or a colored pill (**Never
reviewed**, **Updated — review required**, or **Overdue**) with a **Mark reviewed** button.
Managers additionally see an interval selector, a **Reviewed X/Y this cycle** chip that expands
into the full roster breakdown, and Replace / Archive actions.

A PII/CUI banner matching the Read File module's warns against uploading Personally Identifiable
Information or Controlled Unclassified Information — this system is a commercial-cloud platform,
not an authorized repository for either.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Version** | Bumped every time a manager replaces the PDF. Shown as `v{n}` once above 1. |
| **Review interval** | Monthly (30 days) or Quarterly (90 days), set per document. Changing it never touches existing review records — status recalculates live. |
| **Never reviewed** | The signed-in user has no review on record for this document. |
| **Current** | The user's most recent review is at the live version and inside the interval window. |
| **Overdue** | More days have passed since the user's last review than the document's interval allows, and the version hasn't changed. |
| **Updated — review required** | A manager replaced the PDF since the user's last review. This always overrides Overdue — a new edition must be re-read now, regardless of when the user last reviewed the prior one. |
| **Re-upload resets the cycle** | Replacing a document immediately puts every required reviewer into Updated status; their next review re-stamps the version and restarts their own interval clock. |
| **Open-then-attest** | Clicking a document's title opens the PDF in a new tab and unlocks that document's **Mark reviewed** button for the rest of the page session — a nudge to actually open the file, not a security control. |
| **Required-reviewer roster** | Base members whose role is Airfield Manager, NAMO, AMOPS, or Base Administrator. This is the "Y" in every "X/Y reviewed" count and the compliance report's roster. |
| **Compliance report (PDF)** | Per document: title, version, interval, and a roster table marking each required reviewer Reviewed (with initials and date) or OUTSTANDING for the current cycle, plus summary counts. |
| **Archive** | Drops a document off the review list and the badge; it stays visible in the compliance report's history. Restoring resumes tracking from existing review records. |

---

## How to review a document (everyone with view access)

1. Open **Reference Library** from the sidebar (or the Menu on mobile) and switch to the **Base
   Regs** tab.
2. Find a document whose status isn't green. Click its title — this opens the PDF in a new tab and
   enables that row's **Mark reviewed** button.
3. Read the document, then return to Glidepath and click **Mark reviewed**. Your name, operating
   initials, and the date are recorded, and the row flips to green immediately.

**Mark reviewed** stays disabled until you've opened that document during the current page
session — it re-locks if you reload the page without having opened it again.

## How the badge works

A red dot appears on the Reference Library sidebar entry (and the Menu entry on mobile) whenever
you have at least one Local Regulations document in **Never reviewed**, **Updated**, or
**Overdue** status. The expanded sidebar shows "**N to review**" next to the entry. The dot clears
the moment you attest to every outstanding document — no reload needed.

## How to add a regulation (managers)

1. On the **Base Regs** tab, click **Add regulation**.
2. Enter a document title and, optionally, a short description for reviewers.
3. Pick the review cadence — **Monthly** or **Quarterly**.
4. Attach the PDF (PDF only, up to 25 MB) and click **Upload**.

Every required reviewer immediately shows **Never reviewed** for the new document and their badge
goes red.

## How to replace a document (managers)

1. Click the replace icon on the document's row.
2. Attach the new PDF and confirm.

This bumps the document's version. Every required reviewer — including anyone who reviewed the
prior edition minutes ago — flips to **Updated — review required**, and the badge returns for all
of them.

## How to change a document's review interval (managers)

1. Use the interval selector on the document's row (table view) or in its card (mobile).
2. Pick **Monthly** or **Quarterly**.

Shrinking the window (Quarterly → Monthly) can immediately put reviewers whose last review is
older than 30 days into **Overdue** — a confirmation prompt warns you before the change applies.
Changing the interval never deletes or alters existing review records.

## How to check compliance on a document (managers)

1. Click the **Reviewed X/Y this cycle** chip on a document's row.
2. The panel expands into two lists — **Reviewed this cycle** (name, initials, date) and
   **Outstanding** (name only) — covering the required-reviewer roster for that document.

A reviewer who isn't on the required-reviewer roster (for example, someone granted access
individually) but has reviewed the document still shows in the Reviewed list, labeled as outside
the required roster (and tagged with the edition they reviewed if it isn't the current one); they
never count toward the Y denominator. The compliance report PDF folds these reviewers in the same
way.

## How to archive or restore a document (managers)

1. Click **Archive** on a document's row. Confirm the prompt.
2. The document drops off the active list, the tab's due-count chip, and everyone's badge, but
   stays visible in the archived list and in the compliance report's history.
3. To bring it back, open the archived list and click **Restore**. Tracking resumes from whatever
   review records already exist — restoring does not reset anyone's status.

## How to run the compliance report (managers)

1. On the **Base Regs** tab, click **Compliance report**.
2. The PDF downloads immediately — no dialog. It lists every active document with its version,
   interval, and a roster table marking each required reviewer **Reviewed** (with initials and
   date) or **OUTSTANDING** for the current cycle, plus a per-document and an overall summary
   count.

---

## Enabling (or disabling) the module

Local Regulations ships **on by default** on every base — it needs no setup step to appear, unlike
Flight Planning Room Check or Airfield Driving Spot Check. If a base doesn't want it:

1. Go to **Base Configuration → Modules** (`/base-config/modules`).
2. Turn off **Local Regulations**.
3. The **Base Regs** tab and its badge disappear immediately; References and My Documents are
   unaffected. Turning it back on resumes tracking from whatever documents and reviews already
   exist — nothing is lost while it's off.

---

## Keyboard shortcuts

None specific to Local Regulations.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No **Base Regs** tab on Reference Library | Module disabled, or the signed-in user lacks view access | Base Configuration → Modules → confirm Local Regulations is on. Otherwise this is a role/permission matter — contact your base admin. |
| **Mark reviewed** stays disabled after reading the document | The soft open-then-attest gate hasn't registered for this page session | Click the document's title again to reopen it, then try **Mark reviewed**. |
| A document I just reviewed shows **Updated — review required** again | A manager replaced the PDF since your review | Open the new edition and mark it reviewed again — this is expected; re-upload always resets the cycle. |
| Compliance report is missing an expected reviewer | They aren't on the required-reviewer roster (role isn't Airfield Manager, NAMO, AMOPS, or Base Administrator) | If they should be reviewing, verify their role in User Management. |
| No **Compliance report** or interval/replace/archive controls | Signed in without manage access | Only Airfield Manager, NAMO, and Base Administrator roles (plus system admin) can manage Local Regulations; AMOPS has view/review access only. |
| Badge doesn't clear right after marking every document reviewed | Realtime hiccup | It self-corrects within 60 seconds (polling fallback), or switch tabs and back to force a refresh. |

---

## Related manual files

- [23_read_file.md](23_read_file.md) — the sibling one-time read-and-initial module. Local
  Regulations differs by adding a recurring monthly/quarterly cycle instead of a single
  acknowledgment per version.
- [21_base_setup.md](21_base_setup.md) — Base Configuration → Modules, where this module can be
  turned off.
- [22_user_management.md](22_user_management.md) — where reviewer roles (Airfield Manager, NAMO,
  AMOPS, Base Administrator) are assigned.
