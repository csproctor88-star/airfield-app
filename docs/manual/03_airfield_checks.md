# 03 — Airfield Checks

**Path:** Sidebar → Airfield Checks · URL `/checks`

Airfield Checks are the ad-hoc, as-needed inspections that happen throughout the day: FOD walks, runway condition readings, IFE response walkdowns, BASH sweeps. They are distinct from the once-per-day Daily Inspection (see [04_daily_inspections.md](04_daily_inspections.md)).

---

## Overview

Glidepath supports seven check types, each with its own tailored data entry form:

| Check Type | Purpose |
|---|---|
| **FOD Walk** | Foreign Object Debris sweep |
| **RSC / RCR** | Runway Surface Condition reading, with optional Runway Condition Reading reported in the same check |
| **IFE Response** | In-Flight Emergency response walkdown |
| **Ground Emergency** | Ground emergency response |
| **Heavy Aircraft** | Post-heavy-aircraft inspection |
| **BASH** | Bird/Wildlife Aircraft Strike Hazard sweep |

RSC and RCR are separate values in the database but share one check flow — you capture an RSC reading and optionally toggle **Report RCR** to add an RCR reading to the same check.

Checks support cross-device draft persistence, per-issue photo documentation, and feed into the Daily Operations Report. Completed checks appear on the dashboard and in the Events Log.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Draft** | A check in progress. Saved automatically to Supabase and localStorage. Resumable from any of your devices. |
| **Filed** | A completed, read-only check record. |
| **Per-issue photos** | Photos attached to a specific finding within a check via `issue_index`, not just the check as a whole. |
| **`started_at`** | Timestamp captured the moment you select the check type — used for duration analytics. |
| **Findings / Issues** | The items you note during a check. Each can have its own description, photos, and severity. |

---

## How to start a check

1. Open Airfield Checks, or tap **Begin Check** on the Dashboard.
2. Select the **Check Type**.
3. `started_at` is captured automatically at this moment.
4. Fill the form — fields vary by check type:
   - Runway / area
   - Weather conditions
   - Start time (Zulu)
   - Findings / issues (add as many as needed)
5. As you add findings, you can attach photos to each one.

## How to add a finding / issue to a check

1. In the check form, click **+ Add Issue** (or the equivalent per check type).
2. Fill: Description, Severity (if applicable), Location on runway.
3. Attach photos (see next recipe).
4. Save / continue.

## How to attach photos to a specific finding

1. Within the finding, click the camera / upload button.
2. Choose: **Take Photo** (mobile, uses rear camera) or **Upload File**.
3. Photos upload immediately and are linked to this finding via `issue_index` — they are not attached to the check generically.
4. Thumbnail appears. Tap to preview, long-press to remove.

Multi-photo upload supported: select multiple files at once.

## How to save a draft

- Drafts auto-save on every field change.
- Or click **Save Draft** to force an immediate save.
- Close the page without filing — the draft persists.

## How to resume a draft from another device

1. Open Airfield Checks on any device.
2. The list page shows your in-progress drafts at the top.
3. Tap one to open it.
4. The latest saved state (Supabase + localStorage) is loaded — whichever is newer.

**Cross-user isolation:** You only see your own drafts. Another user's draft is invisible.

## How to file a completed check

1. Fill all required fields.
2. Click **File Check** at the bottom.
3. A confirmation shows the summary.
4. Confirm.
5. The check flips from Draft to Filed. An entry posts to Events Log.

Once filed, a check is read-only. Edits require admin intervention (reopen flow).

## How to view a filed check

1. Airfield Checks list → tap the filed check.
2. The detail view shows all findings, photos, and metadata.
3. Click **Export PDF** to download a formatted report.
4. Click **Email PDF** to send via Resend.

## How to export / email a check PDF

1. Open the filed check's detail page.
2. **Export PDF** — generates a jsPDF document with header, findings table, and embedded photos, and downloads it.
3. **Email PDF** — same generation, but routes through the Email PDF modal. Recipients can be entered freely; your default PDF email pre-fills.

---

## Check types — specific fields

### FOD Check
- Runway / taxiway / ramp area
- Duration
- Items found (with photos per item)
- Collection method

### RSC / RCR
- Runway
- Surface condition (dry, wet, ice, slush, snow, standing water)
- Depth / coverage
- BWC reading
- Temperature
- **Report RCR** toggle — when enabled, additional RCR reading fields appear so the same check captures both

### IFE Response
- Aircraft type / tail
- Nature of emergency
- Crash axis / debris
- ARFF deployed?
- Walkdown findings

### Ground Emergency
- Type (fuel spill, fire, medical, etc.)
- Location
- Response agencies
- Outcome

### Heavy Aircraft
- Aircraft type / tail
- Parking spot
- Pavement damage observations
- Fuel / fluid spills

### BASH
- Area swept
- Species observed (from favorites list)
- Count
- Habitat conditions
- Actions taken

---

## Analytics

Check durations are calculated from `started_at` → `completed_at`. Short checks (<1 minute) are excluded from the average-time analytic to filter accidental submissions. See [18_reports_analytics.md](18_reports_analytics.md) for the full 30-day rollup.

---

## Keyboard shortcuts

None specific to checks.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Draft not resuming on another device | Supabase draft saved later than localStorage, or vice versa | Force-refresh the list page; newest wins. |
| Photos uploaded but don't appear after reopening | Photo upload failed silently (rare) | Re-open, re-attach. Check network. |
| Can't start a check | Realtime disconnected; form validation failing | Refresh; ensure all required fields populated. |
| Filed check shows wrong duration | `started_at` wasn't captured (pre-v2.25 behavior) | Modern app captures on check-type selection; for old records, this field may be blank. |
| PDF missing photos | Photos failed to load from Storage at export time | Open the check detail, ensure all thumbnails load, then re-export. |
| "Duplicate check" error on filing | Another user filed a check of the same type for the same runway at the same time | Review theirs; file yours with a different scope or merge notes. |

---

## Related manual files

- [04_daily_inspections.md](04_daily_inspections.md) — The once-per-day required inspection, distinct from checks.
- [06_discrepancies.md](06_discrepancies.md) — Findings in a check can generate discrepancies.
- [13_wildlife_bash.md](13_wildlife_bash.md) — BASH-specific species/strike tracking with weather auto-fill.
- [18_reports_analytics.md](18_reports_analytics.md) — Check duration analytics.
- [19_events_log.md](19_events_log.md) — Filed checks appear here.
