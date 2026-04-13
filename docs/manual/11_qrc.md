# 11 — Quick Reaction Checklists (QRC)

**Path:** Sidebar → QRC · URL `/qrc`

Quick Reaction Checklists digitize 25 emergency and contingency checklists used by Airfield Management personnel. Each QRC guides personnel through the correct response sequence during high-stress situations. Active QRC executions are visible on the dashboard for leadership awareness.

---

## Overview

QRCs are pre-defined step-by-step procedures stored as templates per installation. Examples: IFE response, ground emergency, crash / fire, hijacking, bomb threat, severe weather, hazmat spill. When an emergency occurs, personnel execute the QRC, stepping through each item and recording completion.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **QRC Template** | The definition — the steps, step types, required fields. Configured in Base Setup. |
| **QRC Execution** | A live run of a template during an emergency. Tracks step completion and timestamps. |
| **Step Type** | How a step is answered or displayed. Eight types: Checkbox, Checkbox with Note, Fill-in Field, Time Field, Notify Agencies, Conditional, Text (read-only line), Text Area (read-only paragraph). |
| **SCN Form** | Secondary Crash Net form. Auto-generated when an emergency QRC with `has_scn_form` is activated. |
| **Active QRC** | An in-progress execution. Visible on the dashboard. |
| **Completed QRC** | A filed execution, archived with full step-by-step record. |

---

## How to execute a QRC

1. QRC module → browse available QRCs.
2. Click the one matching your situation (e.g., "IFE Response").
3. Click **Activate** (or equivalent).
4. A timestamped execution record is created.
5. Step through each item in order:
   - **Checkbox** — tap to mark done.
   - **Checkbox with Note** — tap to mark done; optionally add note.
   - **Fill-in Field** — type the required value.
   - **Time Field** — enter or capture a time (Zulu). Tap "Now" to auto-fill current Zulu.
   - **Notify Agencies** — select agency from list; confirm contact made.
   - **Conditional** — a branching step (e.g., "If ARFF on scene, go to step 12").
   - **Text** — read-only single line of guidance. No interaction; not counted in the progress denominator.
   - **Text Area** — read-only paragraph (multi-line guidance, instructions, references). No interaction; not counted in the progress denominator.
6. As you complete steps, the progress bar advances.
7. When every required step is complete, the **Complete** button activates.
8. Click Complete. The execution archives.

## How to activate an emergency QRC with SCN

Emergency QRCs flagged with `has_scn_form` (IFE, major crash, etc.):

1. Activate as above.
2. On activation, the system automatically:
   - Generates the SCN form.
   - Logs a **"SECONDARY CRASH NET ACTIVATED"** entry to the Events Log.
3. Proceed with the QRC steps.

If you cancel the QRC before completion, the SCN activity log entries are removed. If you complete it, they remain.

## How to cancel a QRC

1. Active QRC detail page → **Cancel**.
2. Confirm.
3. The QRC is discarded (not archived as completed).
4. Any SCN entries are deleted from the Events Log.

**Note:** Only cancel when the emergency turned out to be false, not as a shortcut to stop mid-response. For genuinely completed responses where some steps weren't applicable, mark the step as acknowledged and complete normally.

## How to view an active QRC from the Dashboard

Active QRCs appear:
- On the Dashboard in the **Active QRC** badge.
- On the QRC module list, tagged as "Active."

Tap to open and resume.

## How to see completed QRCs

QRC module → **History** tab (or equivalent). Shows all completed QRC executions with:
- Date/time
- Who activated
- Duration
- Full step-by-step record with timestamps

## How to export a completed QRC to PDF

1. Open a completed QRC.
2. Click **Export PDF** at the top of the detail view.
3. The PDF includes header (QRC number + title), status / opened / closed info box, every step with response details (checked/unchecked, fill-in values, time values, notifications confirmed, notes), and SCN details if applicable.
4. Read-only Text and Text Area steps render without checkboxes — they appear as guidance blocks alongside the actionable steps.
5. Click **Email PDF** to send through the email modal.

---

## Editing QRC templates (admin)

QRC templates are configured in Base Setup:

1. Base Setup → **QRC Templates** step.
2. Select a template to edit.
3. Add/remove/reorder steps.
4. **Change step type** via the dropdown on each step (v2.30+). Eight types available:
   - Checkbox
   - Checkbox with Note
   - Fill-in Field
   - Time Field
   - Notify Agencies
   - Conditional
   - Text (read-only line)
   - Text Area (read-only paragraph)
5. For Notify Agencies steps, configure the agency list.
6. For emergency QRCs requiring an SCN form, toggle **has_scn_form**.
7. Save.

---

## Keyboard shortcuts

None specific to QRC.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Complete button stays disabled | A required step wasn't fully answered | Scroll through — each step indicates required vs optional. |
| SCN entry missing from Events Log | QRC template doesn't have `has_scn_form` enabled | Admin: Base Setup → edit template → enable SCN form. |
| QRC not in your list | Template disabled for your installation, or role restricted | Admin: Base Setup → verify templates enabled. |
| Time field won't accept input | Zulu format expected (HHMM or HH:MM Z) | Use 4-digit format, or tap "Now." |
| Cancelled QRC still shows as Active | Rare sync issue | Refresh the page. |
| Step type dropdown not visible | Pre-v2.30 app; read-only step type | Update to v2.30+. |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — Active QRC badge and quick action.
- [19_events_log.md](19_events_log.md) — SCN activations and QRC completions logged here.
- [21_base_setup.md](21_base_setup.md) — QRC template editing.
