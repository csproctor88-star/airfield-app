# Glidepath — Capabilities Brief

**Version 2.34** · *May 2026*

---

## At a glance

Glidepath is a single-platform Airfield Management System for USAF base airfields. One sign-in covers the daily inspection rhythm, the discrepancy lifecycle from report through CES closure, the visual NAVAID outage engine that watches DAFMAN 13-204 thresholds in real time, the parking-plan tooling with UFC 3-260-01 wingtip checks, the obstruction evaluator with imaginary-surface analysis, the PPR coordination workflow with a public submission form, and the audit trail every shift turnover and annual review depends on. It runs in any modern browser, installs as a PWA on phones and tablets, works offline on the flight line, and produces signed PDF artifacts for filing. Overseas installations where Google Maps blurs the airfield can swap the satellite tile source per base without changing anything else.

| | |
|---|---|
| **Audience** | Airfield Managers, NAMOs, AMOPS personnel, CES shop leads, Safety, ATC, MAJCOM RFM/FAM, leadership reviewers, transient aircrew (public-facing forms only) |
| **Deployment today** | Vercel (Next.js 14) + Supabase (Postgres + Auth + Storage + Realtime); Resend for transactional email; Google Maps JS API for cartography with per-base Bing / Esri tile fallback for OCONUS bases; Mapbox retained only for the wildlife BASH heatmap |
| **Deployment roadmap** | Platform One Party Bus migration for IL4/IL5 environments; CAC/PIV authentication |
| **Modules** | 22 core modules + 7 reference/admin surfaces |
| **Permission surface** | 12 roles + per-user overrides; permissions assigned per resource and action |
| **Reports** | PDF generators across every reportable module, with embedded photos and maps; email distribution via Resend, plus AMOPS courtesy-copy on every PPR send |
| **Regulatory backing** | DAFMAN 13-204 Vol 1–3, DAFMAN 91-212, AFMAN 91-203, UFC 3-260-01, UFC 3-535-01, AFI 13-213, AF Forms 483 / 505 / 3616 |
| **Compliance posture** | T-3 waiver on file for the AF Form 3616 CAC-signature requirement (Glidepath is the approved web-based substitute under DAFMAN 13-204 Vol 2 Para 2.5.2.10) |

## Why Glidepath

A working AFM cares about what's true on the airfield right now and what's been signed for since shift turnover. A leader cares about whether the base can prove it in an inspection. Glidepath is built around both.

1. **One source of truth, live.** Runway status, NAVAID status, advisories, ARFF readiness, current personnel on the airfield, today's PPRs, and weather all show on a single Airfield Status board — and update on every connected tablet within a second of any change. Shift turnover stops being a phone call.
2. **The DAFMAN outage engine runs continuously.** As soon as a light is marked inoperative, the system recomputes percentage / count / spatial / consecutive thresholds against DAFMAN 13-204 Vol 2 Table A3.1 and surfaces the right tier (green / yellow / red / black). Bar-out detection is built in — three or more inoperative lights in the same physical bar count as a single bar-out, exactly the way the manual reads it.
3. **Every action is auditable.** `logActivity` writes a Zulu-timestamped row with the user's operating initials for every status change, every check, every inspection, every discrepancy transition, every QRC step. The Events Log is the airfield manager's desk diary, automatically. The Daily Reviews queue rolls those entries into per-shift sign-off slots that satisfy DAFMAN 13-204 Vol 1 Para 2.5.2.10.3/10.4, with a SHA-256 events hash that flags AMENDED entries after certification.
4. **The artifacts you have to produce, you produce.** PDF generators cover the daily operations summary, single-discrepancy report, ACSI report, AF Form 505 waiver package, contractors on the airfield logging, parking diagram with clearance overlay and UFC requirements embedded, obstruction evaluation with surface penetrations automatically calculated, PPR log, daily SCN check log, and lighting health snapshot. Email distribution is one click; the base's AMOPS office is courtesy-copied on every automated PPR send.
5. **It works offline.** The PWA caches reads for QRC, PPR, contractors, discrepancies, regulations, aircraft, and waivers via Workbox. Writes queue to IndexedDB during outages and drain automatically when connectivity returns — including photo uploads.
6. **Permissions are surgical.** A 12-role matrix with per-resource permission keys and per-user overrides means the CES electrician sees only their work orders and can transition CES-stage statuses without seeing wildlife strikes; the Safety officer can update RSC/BWC without touching runway closures; AMOPS can review a PPR and approve it in one session; the read-only MAJCOM RFM/FAM can pull the dashboard across every assigned base without the ability to write anything.
7. **Multi-installation by design.** A single login can switch between bases the user has access to — runways, areas, shops, templates, QRC presets, lighting systems, wildlife species, status boards, PPR columns, AMOPS reply-to, and satellite tile provider are all scoped per-installation. ANG units with multiple aprons or AETC instructors covering several bases work natively.
8. **Regulatory math, not regulatory references.** The wingtip clearance check is UFC 3-260-01 Table 6-1a, computed live as you drag aircraft on the apron. The obstruction evaluator computes 50:1 approach surfaces, transitional surfaces, inner horizontal, and conical surfaces — and tells you which ones an object penetrates. The Visual NAVAID outage engine is DAFMAN 13-204 Vol 2 Table A3.1 with bar-out logic, computed across every system on the field.
9. **OCONUS-ready.** Bases in Germany, Belgium, the Netherlands, and Italy that appear blurred in Google Maps satellite imagery can swap the tile source to Bing or Esri per base. Everything else (markers, polygons, capture-to-PDF, geometry helpers) keeps running on Google Maps JS — only the imagery layer changes.

---

## Part 1 — Operational core

The everyday rhythm: status, checks, inspections, discrepancies, work orders, emergency response, shift turnover, audit.

### 1.1  Airfield Status (`/`)

**What it does.** The default landing page. Real-time picture of runways, taxiways, NAVAIDs, ARFF readiness, BWC / RSC / RCR, advisories, today's PPRs, current personnel on the airfield, and weather — for whichever installation is active.

**Capabilities:**
- **Runway status** — open / closed / suspended per runway, with optional `estimated_resume_at` for closures and free-text reason notes.
- **NAVAID status** — green / yellow / red toggle per configured NAVAID with notes; only NAVAIDs configured in Base Setup appear, so the panel stays specific to that airfield.
- **ARFF status** — CAT level (Full / Marginal / Critical / Inadequate) and per-aircraft readiness (Full / Marginal / Critical / Inadequate / aircraft-out) with reason notes; both writes log to `arff_status_log` for the Daily Operations PDF.
- **RSC** (Runway Surface Condition) — Dry / Wet / Ice / Snow / Slush / Standing Water with notes.
- **RCR** (Runway Condition Reading) — Dry / Wet / Standing Water and friction values.
- **BWC** (Bird Watch Condition) — LOW / MODERATE / SEVERE / PROHIBITED.
- **Custom status boards** — admin-defined panels (Arresting Systems, Comm Status, etc.) with three-state items per board.
- **WWA Notifications** — typed (WATCH / WARNING / ADVISORY) with effective_start, effective_end (or UFN), and message; auto-expire on schedule with a live 15-second countdown ticker.
- **AMOPS Out-of-Office / Closed-for-Day toggles** — AFM signals coverage state with a saved default message; visible on every connected tablet.
- **Today's PPRs panel** — slim view of the day's approved PPRs (PPR # / Status / Arrival Date / ETA Z / first two admin columns); strikethrough on canceled rows.
- **Personnel on Airfield** — live roster of active contractors with company, location, callsign, radio, AF Form 483 expiration.
- **Weather** — current observation pulled from Open-Meteo (temperature, wind, visibility, conditions); auto-refreshing.
- **Realtime sync** — every change pushes to all connected sessions on the same `airfield_status` channel within a second.

**Roles & permissions.** `airfield_status:view` to see; `airfield_status:write` to change runway / NAVAID / ARFF / advisories / Out-of-Office. Safety holds a narrowed `safety_update_rsc_bwc` SECURITY DEFINER RPC so they can update RSC and BWC without touching runway state.

**Outputs.** No direct PDF; all changes feed the Events Log and the Daily Operations PDF.

**Regulatory backing.** DAFMAN 13-204 Vol 1 (status reporting & shift turnover); DAFMAN 13-204 Vol 2 (NAVAID + ARFF status).

---

### 1.2  Dashboard (`/dashboard`)

**What it does.** Quick-action launcher and AFM coverage controls. Ten compact tiles for the most common workflows, AFM Out-of-Office controls, pending Daily Reviews surfaced when un-certified slots exist.

**Capabilities:**
- **Quick-action tiles** — Checks, New Discrepancy, Personnel, Shift Checklist, QRCs, SCN, PPR, BASH, Out of Office, Close Airfield.
- **AMOPS Out-of-Office** — toggle plus saved default message ("Airfield Management is Out of the Office. Contact …"). Optional Closed-for-Day mode for full-coverage loss; deactivation just unsets the flag.
- **Pending Daily Reviews pill** — surfaces when any of the last 7 days has un-certified shift sign-off slots.
- **"Finish setting up…" banner** — surfaces until the base has completed every enabled-module's setup step.

**Roles & permissions.** `dashboard:view` to see; `airfield_status:write` to toggle Out-of-Office.

**Outputs.** None directly; quick-action tiles deep-link to other modules.

---

### 1.3  Airfield Checks (`/checks`)

**What it does.** Ad-hoc, as-needed inspections that happen throughout the day — FOD Checks, runway condition readings, IFE response work-throughs, BASH sweeps. Distinct from the once-per-day formal inspection. Photo capture, inline discrepancy creation, draft persistence, PDF export.

**Capabilities:**
- **Seven check types** with distinct workflows:
  - **FOD Check** — sweep across selected areas; inline discrepancy creation for any FOD found.
  - **BASH Check** — Bird Watch Condition selection plus embedded wildlife sighting / strike form (species, count, behavior, dispersal, outcome).
  - **RSC / RCR Check** — surface condition + friction value capture for winter operations.
  - **In-Flight Emergency Response** — multi-select coordinated-response checklist (notified ATC / SOF / fire / MOC / wing safety / SF / medical / barrier engagement / post-incident inspection completed) and notified-agencies list.
  - **Ground Emergency Response** — same checklist shape as IFE.
  - **Heavy Aircraft Check** — free-text aircraft type field.
  - **Daily Airfield Check** (any other check type configured at the base).
- **Multi-area scope** — pick from base-defined areas or "Entire Airfield"; multi-select for sweeps spanning multiple locations.
- **Inline discrepancy creation** — add unlimited discrepancies mid-check (type, location, description, GPS, photo per issue).
- **Photo capture** — camera or upload, client-side compressed for the PDF.
- **GPS auto-capture** — current location attached to each issue; manual override via map-based picker.
- **Draft persistence** — auto-save to IndexedDB and Supabase; resume from any device. Started-at timestamp captured the moment a check type is picked.
- **Check history sidebar** — last five completed checks for quick reference.
- **PDF export** with embedded photos, discrepancies, and Zulu timestamps.
- **Email distribution** to the saved default address.
- **Offline support** — entire check (including photos) queues to IndexedDB if the device is offline; drains and writes when connectivity returns.

**Roles & permissions.** `checks:write`. Discrepancies created inline inherit `discrepancies:write`. RSC / RCR fields gate on the `safety_update_rsc_bwc` RPC.

**Outputs.** PDF · Email · Activity log entries · Realtime updates to the Dashboard's "last check" tile.

**Regulatory backing.** DAFMAN 13-204 Vol 1 (FOD Check, daily operational checks); DAFMAN 91-212 (BASH); AFMAN 91-203 (emergency response).

---

### 1.4  Daily Inspections (`/inspections`)

**What it does.** Formal daily airfield + lighting inspections per DAFMAN 13-204 Vol 2, plus construction and joint-monthly variants. Multi-section pass / fail / N/A checklists, photo per failed item, auto-creation of discrepancies for failures, PDF filing.

**Capabilities:**
- **Four inspection variants** — Daily Airfield, Daily Lighting, Construction Meeting, Joint Monthly.
- **Template-driven sections** — base-configurable section lists with item rows; nine standard airfield sections (obstacle clearance, signs/lights, construction, habitat, pavement, driving, FOD, construction pre/post, joint monthly).
- **Default-to-pass logic** — undefined responses are treated as `pass` so inspectors only have to mark exceptions; toggle pattern is pass → fail → N/A → pass.
- **Failed-item photos** — upload per failed item; `issue_index` links each photo to its specific issue.
- **Auto-discrepancy creation** — failed items become linked discrepancies with photos already attached and shop pre-assigned via base type-to-shop mapping.
- **NAVAID status sync** — lighting inspection failures propagate to the relevant infrastructure feature so Visual NAVAIDs and Airfield Status reflect the new state immediately.
- **One-per-day enforcement** — exactly one airfield + one lighting inspection per calendar day per installation, with a 0600L reset (timezone-aware). Cross-user draft isolation prevents two AFMs from each starting the day's inspection.
- **Pause + resume** — pause an in-progress inspection with reason; resume later without losing item state.
- **Started-at + filed-at timestamps** — power the analytics dashboard's average-time-to-file metric.
- **Filter & search** — by type, date range, status, inspector.
- **Reopen / delete** — admin-restricted.
- **PDF export** with sections, results, failed-item photos, and linked discrepancies.

**Roles & permissions.** `inspections:write` to create / edit; `inspections:file` to file; `inspections:delete` to remove.

**Outputs.** PDF · Email · Auto-created discrepancies · NAVAID status updates.

**Regulatory backing.** DAFMAN 13-204 Vol 2 (daily airfield + lighting inspection requirement); DAFMAN 13-204 Vol 2 Para 5.4.3.

---

### 1.5  ACSI Annual Compliance (`/acsi`)

**What it does.** Airfield Certification & Safety Inspection — the annual compliance inspection per DAFMAN 13-204 Vol 2 Para 5.4.3. Ten-section ~100-item checklist, team assignments, per-member signature toggle, PDF report.

**Capabilities:**
- **Ten sections** — Pavement Areas, Safety Clearances & Apron, Markings, Signs, Lighting, Wind Cones, Obstructions, Arresting Systems, Other Hazards, Local Information.
- **~100 items** with parent/sub-field hierarchy (e.g., a sign item with sub-fields for "operable / properly sited / clear of vegetation").
- **Y / N / N/A responses** with optional per-item comments and inline photo / map upload.
- **Inspection team editor** — required slots for AFM, CE, Safety; optional slots for RAWS, Weather, SFS, TERPS, plus arbitrary additional members.
- **Per-member signature toggle** — additional members default to `signature_required: false` so they appear as a compact roster row instead of a full signature block; opt back in per-member.
- **Mark-all-Y action** for bulk pre-fills before a re-inspection.
- **Risk Control Measure (RCM)** — required field on every N (non-conforming) item. Filing blocks with a toast listing any N items missing an RCM. Linking an airfield discrepancy to an N item imports Project #, Estimated Cost, and RCM in one step.
- **Status workflow** — Draft → In Progress → Completed → Staffed.
- **Reopen + draft rebuild** — return a completed ACSI to in-progress without losing photo attachments or comments.
- **PDF export** — full ACSI report with sections, responses, team roster, signature blocks, regulation references; rendered with parent/sub-field hierarchy and inline photos / maps.

**Roles & permissions.** `acsi:write` to create / edit; `acsi:file` to file; `acsi:delete` to remove.

**Outputs.** PDF · Email.

**Regulatory backing.** DAFMAN 13-204 Vol 2 Para 5.4.3 + Attachment 2 (ACSI checklist structure); UFC 3-260-01 (clearance criteria); UFC 3-535-01 (lighting standards).

---

### 1.6  Discrepancies (`/discrepancies`)

**What it does.** Airfield deficiency tracking from initial report through CES action to closure. Photo library, status workflow, map view with live "Use My Location" overlay for COP, configurable PDF export, work-order linkage.

**Capabilities:**
- **Eleven discrepancy types** — FOD Hazard, Pavement Deficiency, Lighting Outage, Marking Deficiency, Signage Deficiency, Drainage Issue, Vegetation Encroachment, Wildlife Hazard, Airfield Obstruction, NAVAID Deficiency, Other.
- **Location tagging** — free-text + GPS + airfield-area dropdown (RWY / TWY / Apron / Shelter / Access Road / Misc).
- **Photo library** — unlimited photos per discrepancy; first photo shows on the map popup.
- **CES workflow statuses** — `submitted_to_afm`, `submitted_to_ces`, `awaiting_action_by_ces`, `waiting_for_project`, `work_completed_awaiting_verification`, plus terminal `completed` / `cancelled`.
- **Type-to-shop auto-assignment** — base-configured `discrepancy_type_shop_map` JSONB picks the right CE shop based on type.
- **Project #, Estimated Cost, Risk Control Measure** — optional discrepancy fields used by the CES project pipeline and the ACSI linkage.
- **Work-order number** field for CES tracking system linkage.
- **Estimated Completion Date (ECD)** — captured on discrepancies and surfaced in aging reports.
- **NAVAID linkage** — discrepancies created from outage events carry `infrastructure_feature_id`; the detail view shows the linked NAVAID card; closing the discrepancy can flip the feature back to operational.
- **Map COP view** — Google Maps with all open discrepancies pinned, popup with photo + type + status, filter by type / status / shop, plus a "Use My Location" overlay chip in the top-right that drops a cyan dot + GPS accuracy ring so the user sees themselves relative to the open work on the airfield.
- **List view** — KPI strip + filters (status, type, shop, age) + search.
- **Edit modal** — update any field post-creation.
- **Configurable PDF export** — choose which fields appear, single or batch; templates persist per user.
- **Email PDF** with optional message.
- **Camera capture** for in-the-field photo evidence.
- **Friendly-error mapping** — RLS denials, unique-key conflicts, and FK violations all become readable toasts.

**Roles & permissions.** `discrepancies:view`, `:write`, `:delete`, `:close`, `:cancel`, `:transition:ces_statuses`, `:update:resolution_notes`, `:add_note` — fine-grained so CES roles can transition CES-stage statuses and add notes without full write.

**Outputs.** PDF (configurable, single or batch) · Email · Map view · Activity log entries · NAVAID linkage.

**Regulatory backing.** DAFMAN 13-204 Vol 1 (discrepancy reporting).

---

### 1.7  CES Work Orders (`/ces`)

**What it does.** Civil Engineering shop landing page. Filtered queue of discrepancies assigned to the current shop, status-stage KPIs, in-line status updates with notes, recently-completed feed, aging alerts.

**Capabilities:**
- **Shop tabs** — every CES shop gets a tab; aggregate "All Shops" tab; per-shop work order count badge.
- **Status-stage KPIs** — five live counters for NEW / IN WORK / PROJECT / VERIFY / OVERDUE (>30 days).
- **Quick status update modal** — inline change to a discrepancy's `current_status` with required note for transitions, written via the `ces_update_discrepancy` SECURITY DEFINER RPC so CES roles can edit without full discrepancy `:write`.
- **Days-open counter** per row.
- **Recently completed feed** — last 10 completed discrepancies in past 7 days across the shop.
- **Type + status badges** with the same color palette as `/discrepancies` so the CES electrician sees the same picture as the AFM.
- **Role-locked navigation** — when the current user holds the `ces` role, the sidebar collapses to CES Work Orders, Discrepancies, Visual NAVAIDs, and Settings only. The status modal is limited to In Work / Project / Work Completed. No create / edit / delete on discrepancies.

**Roles & permissions.** `ces:view`, `discrepancies:transition:ces_statuses`, `discrepancies:update:resolution_notes`. Ungated for any role that holds these keys; the `ces` role gets them by default.

**Outputs.** None directly (export is via `/discrepancies`).

**Regulatory backing.** DAFMAN 13-204 Vol 1 (CES coordination).

---

### 1.8  QRC — Quick Reaction Checklists (`/qrc`)

**What it does.** Quick Reaction Checklists for emergency and contingency response — aircraft mishap, hung ordnance, fuel spill, severe weather, BASH event, etc. 25 default templates plus a built-in editor for creating QRCs from scratch, eight step types, execution tracking, SCN tagging, configurable review cadence, PDF export.

**Capabilities:**
- **25 default QRC templates** covering aircraft mishap, airfield accident, chemical spill, fuel spill, hazardous material, hung ordnance, runway/taxiway/apron emergency, severe weather, tornado, engine shutdown, emergency egress, in-flight fire, avionics failure, hydraulic failure, electrical failure, fuel transfer, barrier engagement, bird strike, low-level ejection, ground fire, towing incident, training mission, contingency ops, emergency kit.
- **Create QRC from scratch** — single dialog supports all 8 step types with type-specific config, sub-steps one level deep, and full SCN-form-fields editor. Imports 25 default templates separately if desired.
- **Eight step types** — confirmation checkbox, radio group, multi-select, text input, numeric input, free text, GPS location, attachments.
- **Per-base review interval** — Monthly (every 30 days) or Quarterly (every 90 days). Drives the Reviews tab threshold, the period picker (month vs quarter), and the consolidated compliance PDF (title, subtitle, window, filename).
- **Per-base template editor** — add / edit / clone / archive QRCs without leaving the platform. Step type editor for non-developers.
- **Execution workflow** — Start → Active → Closed; reopen and cancel transitions supported.
- **SCN notification tagging** — flag steps as "notify backup SCN" with checkbox + auto-timestamp; SCN-related QRCs log "SECONDARY CRASH NET ACTIVATED" to the Events Log.
- **Active QRC sidebar badge** — sidebar nav shows the count of in-progress QRCs across all installations the user can see.
- **Annual review reminder** — templates flag overdue when last reviewed > 12 months.
- **Audit trail** — every step response is timestamped and attributed.
- **PDF export** of the executed checklist with all responses, SCN markers, and timeline.
- **Offline support** — step responses queue to IndexedDB; commits on reconnect.

**Roles & permissions.** `qrc:view`, `qrc:execute` to run a checklist; `qrc:write` to edit templates.

**Outputs.** PDF · Email · Activity log entries · Sidebar badge.

**Regulatory backing.** AFMAN 91-203 (QRC content); SCN coordination procedures.

---

### 1.9  Shift Checklist (`/shift-checklist`)

**What it does.** Per-shift task tracking (day / swing / mid) with daily / weekly / monthly frequency. Three-state toggle per item, daily reset at 0600L, history archive, completed-by attribution.

**Capabilities:**
- **Three shift segments** — Day / Swing / Mid; per-shift item lists.
- **Three-state toggle** — Unchecked → Done ✓ → N/A ⊘ → Unchecked.
- **Daily reset at 0600L** in installation timezone (configurable `checklist_reset_time`).
- **Frequency filter** — daily / weekly / monthly; weekly items appear on the configured day of week.
- **Completed-by tracking** — per item and per shift, with timestamp + user attribution.
- **History tab** — past 30+ days viewable; click any past day to expand and see who marked which item.
- **Per-item audit** — `completed_at` + `completed_by` rows.

**Roles & permissions.** `shift_checklist:view`, `shift_checklist:write`.

**Outputs.** None (display + audit trail).

**Regulatory backing.** DAFMAN 13-204 Vol 1 (shift turnover).

---

### 1.10  Events Log (`/activity`)

**What it does.** Comprehensive Zulu-timestamped audit trail of every airfield action — auto-logged from every module, plus operator-driven manual entries with templates, plus search / filter / export. Structure-first refresh in v2.33 brought tertiary header counts, relative date anchors (Today / Yesterday / weekday), and a single cross-column search bar.

**Capabilities:**
- **Auto-logged events** from every module: airfield_check, inspection, discrepancy, acsi_inspection, qrc, wildlife_sighting, wildlife_strike, contractor, navaid_status, airfield_status, arff_status, weather_info, obstruction_evaluation, ppr_entry, waiver, waiver_review, scn, scn_backup, parking_plan, manual.
- **13 manual entry templates** — Inspections / Checks, AMOPS Reporting, Tower Reporting, Shift Changes, Daily Tasks, QRC, PCAS / SCN Tests, Personnel on Airfield, NOTAMs, ARFF, IFE / GE, CMA Violations, BWC Declarations.
- **Smart action inference** — typing "SHIFT CHANGE" or "SCN CHECK" in the details field auto-picks the right template label.
- **Period filter** — Today / Last 7d / Last 30d / Custom (chip-cluster tabs).
- **Cross-column search** — single search bar covers actor / OI / action / details.
- **OI column** — operator's operating initials with click-to-reveal full-name popover.
- **AMENDED pill** — rows whose `created_at > daily_reviews.fully_certified_at` for the same date show an AMENDED badge so the certifying AFM knows the day's record was edited after sign-off.
- **Relative date anchors** — group headers read "Today · 14 entries" / "Yesterday · 9 entries" / "Mon · 23 entries" with entry counts.
- **Color-coded rows** by entity type + action.
- **Click-through links** to the original entity (check, discrepancy, inspection, etc.).
- **CSV export** of any filtered view.
- **Edit / delete** for manual entries (`activity_log:delete` gated).
- **Infinite scroll** — server-side paginated; previous 500-row cap removed.

**Roles & permissions.** `activity_log:view`, `activity_log:write_manual`, `activity_log:delete`.

**Outputs.** CSV · Visible in every PDF report from other modules.

**Regulatory backing.** DAFMAN 13-204 Vol 1–3 (operational record-keeping); AF Form 3616 (CAC-signature requirement waived via approved T-3 — Glidepath is the substitute).

---

### 1.11  Daily Reviews (`/daily-reviews`)

**What it does.** Per-base, per-day shift sign-off queue satisfying DAFMAN 13-204 Vol 1 Para 2.5.2.10.3 / 10.4. Per-slot signature capture (day / swing / mid AMSL + NAMO + AFM), inline Daily Operations PDF preview, full-certification email-to-file workflow.

**Capabilities:**
- **Per-base shift count** — 2-shift bases use day + swing AMSL slots; 3-shift bases use day + swing + mid. Configured at Base Setup.
- **Five sign-off slots per day** — day_amsl, swing_amsl, mid_amsl, namo, afm; each row tracks `{slot}_signed_by`, `{slot}_signed_at`, `{slot}_notes`, `{slot}_events_hash`, plus a single `fully_certified_at`.
- **Sign modal** — opens an inline iframe of the Daily Operations PDF for that date; reviewer signs with an attestation note.
- **Events hash** — SHA-256 of the sorted entity IDs in the day's Daily Ops rollup; if any entity is amended after sign-off, the hash changes and the AMENDED pill appears in the Events Log.
- **Role gates per slot** — AMSL ← amops / airfield_manager / namo / *_admin; NAMO ← namo / airfield_manager / *_admin; AFM ← airfield_manager / *_admin.
- **14-day rolling queue** — today back through 14 prior days.
- **Dashboard pending pill** — surfaces when the last 7 days has any uncertified slot.
- **Full-certification flow** — opens the Email PDF Modal so the certifying AFM can file the day's PDF with one click.
- **Audit attribution** — every signature stores `signed_by` (UUID) + `signed_at` (Zulu) + free-text notes.

**Roles & permissions.** `daily_reviews:view`, `daily_reviews:sign:amsl`, `daily_reviews:sign:namo`, `daily_reviews:sign:afm`.

**Outputs.** Daily Operations PDF (filed via email) · Activity log entries.

**Regulatory backing.** DAFMAN 13-204 Vol 1 Para 2.5.2.10.3 (daily review + shift turnover); Para 2.5.2.10.4 (AFM daily review certification); AF Form 3616 (CAC-signature requirement waived via approved T-3).

---

## Part 2 — Specialized / domain modules

### 2.1  Visual NAVAIDs / Infrastructure (`/infrastructure`)

**What it does.** Mapped runway / taxiway lighting, signs, and NAVAIDs with the DAFMAN 13-204 Vol 2 Table A3.1 outage engine running continuously across every system on the field. KML import, audit mode, fixture-ID generation, bar-out detection, automatic discrepancy creation on outages, live "Use My Location" overlay for walking the airfield.

**Capabilities:**
- **23 feature types** — runway edge, threshold, approach, PAPI, REIL, runway end light, runway distance markers, taxiway edge, terminating bar, centerline bar, 1000' bar, sequenced flashers, location / directional / informational / mandatory signs, windcone, obstruction lights, stadium lights, rotating beacon, plus base-specific extensions.
- **Per-feature status toggle** — operational / inoperative; instantly recomputes outage thresholds.
- **System + component model** — features roll up into components (e.g., "PAPI Box A"), components roll up into systems ("ALSF-2 Approach Lights").
- **DAFMAN outage engine** — `lib/outage-rules.ts` evaluates percentage / count / spatial / consecutive thresholds per Table A3.1. Four-tier alerts: green (operational) / yellow (approaching threshold) / red (exceeded) / black (system inoperative).
- **Bar-out detection** — `analyzeBarOutages()` groups lights into physical bars via `bar_group_id`; three or more inoperative lights in a bar count as one bar-out per the manual.
- **Audit Mode** — right-side panel for bulk operations: filter-based component assignment, sequential labeling, fixture ID generation, bulk delete, bar group management with bulk rename.
- **Fixture IDs** — auto-generated as `{SystemPrefix}-{TypeAbbrev}-{###}` (e.g., `TWYK-TL-001`); editable in edit mode; primary identifier for all features.
- **KML / CSV / GeoJSON import** — bulk-load NAVAID coordinates from Google Earth or surveyor exports; deduplication, configurable feature type / layer / rotation.
- **Sign system** — labeled signs with editable Sign Text rendered to scale on the map; SIGN_COLORS map drives color coding.
- **Bar placement mode** — drop bars perpendicular to runway centerline at exact intervals; uses geometric `offsetPoint()` from `lib/calculations/geometry.ts`.
- **Outage → Discrepancy link** — reporting an outage from this page auto-creates a discrepancy with structured description (Status / Component / Location + DAFMAN bar-out note when applicable). Marking operational prompts to close linked discrepancies with user attribution + Zulu timestamp. The Airfield Status NAVAID grid only updates status + notes — it does NOT auto-create a discrepancy, so the discrepancy is created exactly once.
- **Live "Use My Location"** — continuous-watch GPS marker (cyan chip in the top-left, blue dot follows the user across the map) for AFMs walking the airfield.
- **NOTAM templates** — pre-filled NOTAM text per component for unlit obstruction reporting.
- **System Health Panel** — real-time outage timeline, system / component / feature tier display, outage history per component.
- **Map health rings** — yellow rings for approaching, red for exceeded / inop.
- **GPS tracking + draw tools** — survey crew can plot features in real time from a tablet.
- **Layer filtering** — toggle visibility per feature type (taxiway / runway / sign / misc) and per source layer (location-based).

**Roles & permissions.** `infrastructure:view`, `infrastructure:write`, `infrastructure:delete`.

**Outputs.** Lighting Report PDF · Discrepancies (auto-created on outage) · Visible in Daily Ops PDF "VISUAL NAVAID OUTAGES" section.

**Regulatory backing.** DAFMAN 13-204 Vol 2 Table A3.1 (outage thresholds); UFC 3-535-01 (lighting standards); FAA JO 7930.2 (NOTAM formatting).

---

### 2.2  Aircraft Parking Plans (`/parking`)

**What it does.** To-scale aircraft parking diagrams with UFC 3-260-01 wingtip / taxilane clearance validation, drag-and-drop spot positioning, multiple plans per base, multi-apron PDF export with the actual satellite map snapshot.

**Capabilities:**
- **Multi-plan management** — save multiple plans (Red Flag Ops, Routine Parking, Exercise X) and toggle which is active. Edit plan name + description after creation.
- **200+ aircraft silhouettes** — military and civilian, true-to-scale vector renders. Continuous rescaling on zoom / rotate via the Mercator meters-per-pixel formula — rotation-stable at any heading.
- **Drag-to-position spots** with snap-to-grid option; native-feeling heading slider per spot (per-tick visual preview, commit on release).
- **Wingtip clearance checks** — UFC 3-260-01 Table 6-1a, computed live. Auto-classifies aircraft into ADG Groups I–VI from wingspan; context-aware clearance per parking apron / transient apron / KC refueling / interior taxilane / peripheral taxilane.
- **Clearance envelope rendering** — colored zones around each aircraft; instant visual on overlap or violation.
- **Taxilane editor** — draw centerlines as polylines; set half-width per UFC; encroachment detection vs. each parked aircraft.
- **Apron boundary editor** — mark apron edges; compute distance-to-apron for each spot.
- **Obstacle markers** — trees, poles, buildings; clearance violations flag.
- **Tabbed sidebar** — Aircraft / Environment / Clearance / Settings panels.
- **Floating panel mode** — desktop overlay panel (340 px, top-right); starts closed, toggles in all modes including fullscreen; mobile Panel button in the toolbar.
- **Spot Name → Aircraft Label** — base-level toggle controls whether spots render their parking-spot name or the assigned aircraft callsign.
- **Bulk-add + grouped list** — add multiple spots at once; group by aircraft type or status.
- **Context menu + obstacle locking** — right-click for actions; lock obstacles to prevent accidental drag.
- **PDF capture pipeline** — WYSIWYG capture-frame overlay shows exactly what the export will include (1600×900 fixed rectangle). "Add Apron" multi-apron flow stitches multiple captures into one PDF with the satellite map on its own landscape page. Tilt locked at 0 (tilt breaks icon scaling); rotation preserved. Filename includes HHmm so same-day exports don't overwrite.
- **Email PDF** for distribution to transient ops or exercise planners.
- **Touch support** for tablets in the field.
- **Persistent storage** — five tables (`parking_plans`, `parking_spots`, `parking_obstacles`, `parking_taxilanes`, `parking_apron_boundaries`); plans are not ephemeral.

**Roles & permissions.** `parking:view`, `parking:write`, `parking:delete`.

**Outputs.** PDF · Email.

**Regulatory backing.** UFC 3-260-01 Chapter 6, Table 6-1a Items 4–6 (wingtip clearance per ADG and apron context); UFC 3-260-01 Ch. 1 Para 1-5 (ADG classification).

---

### 2.3  Obstruction Evaluations (`/obstructions`)

**What it does.** Evaluate objects (proposed construction, temporary obstacles, existing structures) against UFC 3-260-01 imaginary surfaces and DoD APZ land-use criteria. Multi-runway analysis, automatic elevation lookup, photo evidence, technical PDF.

**Capabilities:**
- **Click-to-place** on a Google Map; height entered AGL, elevation auto-fetched MSL via the Google Elevation API server-side proxy.
- **"Use My Location" overlay** — drops a cyan dot + GPS accuracy ring on the map for situational awareness (separate from the inline sidebar button that sets the evaluation point).
- **Multi-runway evaluation** — runs analysis against every configured runway; shows the closest and the worst-case.
- **Imaginary surface analysis** per UFC 3-260-01 Ch. 3 + Appendix B:
  - Primary surface
  - Clear zone (3000 ft × 3000 ft)
  - Graded clear zone
  - Approach / departure clearance surface (50:1)
  - Transitional surface (7:1)
  - Inner horizontal surface (150 ft AGL, 13,120 ft radius)
  - Conical surface (20:1, 7,000 ft horizontal extent)
  - Outer horizontal surface (500 ft AGL, 42,250 ft radius)
- **APZ land-use overlay** per DoD Instruction 4165.57 (APZ I 3000–8000 ft, APZ II 8000–15,000 ft from threshold).
- **Surface-penetration verdict** — color-coded (green clear / yellow approaching / red penetrates) per surface.
- **Taxiway protection surfaces** — OFA + Safety Area generation via `generateCenterlineBuffer()`. FAA mode uses TDG-based OFA + Safety Area; UFC mode uses Class A/B Clearance Line.
- **Runway class selector** — Category B / Army_B with criteria auto-adjusting per FAA / Army standards.
- **History view** — every prior evaluation of the same object; compare before / after.
- **Photo upload** — up to five site photos per evaluation.
- **Notes / justification field** — corrective action, waiver request, approval rationale.
- **PDF export** — surface diagram with penetration analysis, coordinate table, regulation cites, photo attachments.

**Roles & permissions.** `obstructions:view`, `obstructions:write`, `obstructions:delete`.

**Outputs.** PDF · Email.

**Regulatory backing.** UFC 3-260-01 Ch. 3 (imaginary surfaces); UFC 3-260-01 Appendix B (permissible deviations); DoD Instruction 4165.57 (APZ); FAA AC 150/5300-13B (airfield design).

---

### 2.4  Wildlife / BASH (`/wildlife`)

**What it does.** Wildlife sighting + strike logging per DAFMAN 91-212, with a 270+ species database, behavioral tagging, deterrent action tracking, weather auto-fill, BASH heatmap.

**Capabilities:**
- **270+ species** — birds, mammals, bats, reptiles; local photo cache (USFWS / Wikimedia / iNaturalist) for offline picker.
- **Sighting form** — date / Zulu time, species, location, quantity, behavior (roosting / flying / feeding / nesting), weather conditions.
- **Strike form** — aircraft tail number, runway, species, damage level (none / minor / major / destroyed), personnel injury, photo upload.
- **Weather auto-fill** — `weatherToFormFields()` maps Open-Meteo conditions to form values on mount; inspector doesn't have to retype temp / wind / ceiling.
- **Action checklist** — deterrent applied, USDA notified, FOD Check, area closure, hazard reported to ATC.
- **BASH heatmap** — Mapbox GL density visualization (the only Mapbox holdout in the platform; every interactive map elsewhere is Google Maps because the gov network throttles WebGL-heavy renderers).
- **Heatmap capture** for the monthly BASH report.
- **Species favorites** — `is_favorite` flag per base; favorites sorted first with gold border / star in the picker.
- **30 / 7 / 90 / 180 / 365-day analytics** — total sightings / strikes by period, top species, damage breakdown, action effectiveness.
- **Behavioral tags** that drive deterrent strategy.
- **Per-airfield-area location labels** for spatial analysis.

**Roles & permissions.** `wildlife:view`, `wildlife:write`, `wildlife:delete`.

**Outputs.** PDF (analytics + heatmap snapshot) · Email · Activity log entries.

**Regulatory backing.** DAFMAN 91-212 (BASH program — strike reporting, deterrent tactics, BASH officer coordination).

---

### 2.5  Waivers (`/waivers`)

**What it does.** AF Form 505 airfield criteria waivers with six classifications, seven-status state machine, annual review tracking, photo + attachment management.

**Capabilities:**
- **Six classifications** — permanent, temporary, construction, event, extension, amendment.
- **Seven statuses** — draft, pending, approved, active, completed (closed), cancelled, expired; explicit transition map gates illegal moves.
- **Closure dialog with comments** — required `[Closure]` / `[Expired]` / `[Reactivated]` notes saved as coordination activity entries.
- **Criteria linkage** — waive specific UFC 3-260-01 / UFC 3-260-04 / UFC 3-535-01 items by ID.
- **Hazard rating** — low / medium / high / extremely high.
- **Coordination chain** — CE, AFM, Airfield Ops, Base Safety, Installation CC; per-coordinator sign-off + dates.
- **Effective + expiration dates** — automatic status flip on expiry.
- **Corrective action plan** field for temporary waivers.
- **Geographic location** — map coordinates for obstruction waivers; distance from threshold / centerline shown.
- **Photo + attachment library** — section-7 attachments with file-type dropdown + caption; section-6 photos with camera capture + 3-column thumbnail grid.
- **Annual review mode** — anniversary review by AFM / CE; recommend retain / modify / cancel / convert; year-by-year sign-off log.
- **Annual review delete + edit / delete coordination entries** for corrections.
- **PDF export** — AF Form 505–style document with approval chain, criteria, hazard rating, expiration, photos, attachment list.
- **Email PDF** for routing.

**Roles & permissions.** `waivers:view`, `waivers:write`, `waivers:delete`, `waivers:review` (annual).

**Outputs.** PDF · Email · Activity log entries.

**Regulatory backing.** AF Form 505; UFC 3-260-01 Ch. 3 (criteria); DAFMAN 13-204 Vol 2 (waiver authority + annual review requirement).

---

### 2.6  NOTAMs (`/notams`)

**What it does.** Live FAA NOTAM feed with filtering, source / status / type / date-range filters, PDF export.

**Capabilities:**
- **Live FAA feed** — `app/api/notams/sync/route.ts` pulls from `notams.aim.faa.gov`; no API key required; manual sync button.
- **Filtering** — source, status, type, date range.
- **Auto-expire** — NOTAMs flip to expired when FAA end-date passes.
- **Date parsing** for FAA format (MM/DD/YYYY HHMM), "PERM", and ISO.
- **PDF export** — list of active NOTAMs with full text.
- **Email distribution** to stakeholders.
- **Sidebar badge** for expiring NOTAMs.

**Roles & permissions.** `notams:view`, `notams:write`, `notams:cancel`.

**Outputs.** PDF · Email · Sidebar badge.

**Regulatory backing.** DAFMAN 13-204 Vol 1 (NOTAM publication); FAA JO 7930.2 + FAAO JO 7210.3 (NOTAM formatting).

---

### 2.7  Prior Permission Required (`/ppr`)

**What it does.** End-to-end PPR lifecycle for transient aircraft. Public submission form (no login) → AMOPS review → multi-agency parallel coordination → AFM approval / denial / soft-cancel. Configurable admin columns, five email templates, PDF exports, public-form rate limiting, AMOPS courtesy-copy on every outbound automated email.

**Capabilities:**

**Public form** (`/[icao]/ppr-request` and legacy `/ppr-request/[baseId]`):
- **No-auth submission** for transient aircrew.
- **Spine fields** stored on `ppr_entries` directly (always present, never configurable away): requester name, email, phone, aircraft callsign, arrival date, arrival ETA Zulu (HHMM text input — never `<input type="time">`, which forces AM/PM on en-US Chrome).
- **Configurable admin columns** — base-defined fields appear automatically; type-aware inputs (text / date / time / yes/no/N/A / phone / number / email / info-only).
- **5-minute rate limit** per IP / base via localStorage to prevent spam.
- **ICAO base lookup** — short URL `/{ICAO}/ppr-request` resolves to the base.
- **Submit RPC** — SECURITY DEFINER function validates required fields and HHMM ETA shape server-side.
- **Auto-confirmation email** to requester via Resend.

**Staff log** (`/ppr`):
- **Six statuses** — Pending Review → Pending Approval (or Coordinating) → Approved / Denied / Canceled, plus Pending Aircrew while waiting on requester response.
- **Three save modes** in the internal create modal — pre-coordinated (approve now), send to coordination (multi-agency emails), and **save pending — coordinating manually** (no emails, no coord rows; AMOPS does it offline and finalizes later via Decide → Approve).
- **Slim Log table** — PPR # / Status / Arrival Date / ETA (Z) + first two admin summary columns (Callsign + Aircraft Type by convention via case-insensitive `column_name` match).
- **Configurable admin columns** — drag-reorder, info-only flag for read-only display, public vs. staff visibility.
- **Review workflow** — AFM / AMOPS reviews each request, flags issues, assigns to coordination if multi-agency.
- **Multi-agency parallel coordination** — track concur / non-concur per agency with deadline + lead name + remarks.
- **Remarks thread** — visible to all staff; coordination officers add non-concur reasons.
- **Approval / Denial** — auto-emails requester via Resend with reason if provided.
- **Soft-cancel** — distinct from denial; "previously approved/pending entry pulled" (weather scrub, slip, aircrew cancel). Strikethrough + 0.55 opacity on canceled rows; detail dialog renders without strikethrough so the audit trail stays legible.
- **Cancellation email** — slate-grey palette to distinguish from approval / denial; silent skip for internal-create PPRs without a requester email.
- **Atomic PPR # counter** — per-base sequence; never re-issued.
- **Realtime updates** — Log subscribes via `ppr_realtime` channel.
- **Centralized formatter** — `formatPprColumnValue(col, raw)` is the single source of truth for `time` / `yes_no_na` / `date` / `text` rendering. Used by the Log, detail card, review summary, Today's PPRs panel, PDF, and all five email templates.
- **PDF export** — single-entry PDF (cards-per-entry layout) or date-range batch; includes remarks + coordination summary + admin columns.

**Email flows** (5 routes — all use `validReplyTo` gate, all set the base's `amops_email` as reply-to AND **courtesy-copy AMOPS** so the office has a record of every automated message that goes out under their name):
- `/api/send-ppr-confirmation` — to requester on submit.
- `/api/send-ppr-coordination-request` — to agency coordinators when entry moves to `coordinating`.
- `/api/send-ppr-approval` — to requester on approve.
- `/api/send-ppr-denial` — to requester with reason.
- `/api/send-ppr-cancellation` — to requester + agencies on soft-cancel.

**Roles & permissions.** `ppr:view`, `ppr:write`, `ppr:delete`, `ppr:review`, `ppr:coordinate`, `ppr:approve`. AMOPS holds approve + delete.

**Outputs.** PDF (single + batch) · Five email templates with AMOPS CC · Sidebar badge · Realtime panel.

**Regulatory backing.** DAFMAN 13-204 Vol 1 Para 2.5.1 (PPR requirement); AFI 13-213 (transient PPR procedures).

---

### 2.8  Customer Feedback (`/feedback`)

**What it does.** Public QR-scannable feedback form for transient aircrew + contractors, plus a staff inbox with star-rating analytics, configurable form fields per base, PDF export.

**Capabilities:**

**Public form** (`/feedback/[baseId]`):
- **No-auth submission** posted by QR code at base ops, transient counters.
- **5-star rating widget** with labels (Poor / Fair / Good / Very Good / Excellent).
- **Optional Name / Email / Organization** fields.
- **Comments** free text.
- **Per-base custom fields** — admin-defined extra prompts ("Did you encounter any issues?" / "Satisfaction with ground services?").
- **5-minute rate limit** via localStorage.
- **Module-enabled gate** — shows "Feedback disabled" if the base has not enabled the module.
- **Validation + success screen.**

**Staff inbox** (`/feedback`):
- **Inbox sorted newest first** with all submissions; comments + custom-field responses rendered inline (no separate detail screen).
- **Star-rating display** per card; aggregate average in KPI strip.
- **Custom field labels** rendered automatically in cards + PDF.
- **Date filter** — all-time / 30d / 7d.
- **Statistics** — total, average rating, distribution per star, recent count (7d).
- **Delete** — `feedback:delete` gated.
- **PDF export** — feedback summary with average rating, distribution, submission list, with optional emailing.
- **Auto-email to AFM** on each new submission.

**Roles & permissions.** `feedback:view` (staff dashboard), `feedback:configure` (form fields), `feedback:delete`. Public form is open.

**Outputs.** PDF · Email (auto-on-submit + manual distribution).

**Regulatory backing.** DAFMAN 13-204 Vol 1 (customer service / satisfaction measurement, optional guidance).

---

### 2.9  Secondary Crash Net (`/scn`)

**What it does.** Daily SCN communication check log per DAFMAN 13-204 Vol 1 Para 2.5.2.5. Per-agency status tracking, both Primary and Backup checks, color-coded status, monthly PDF audit.

**Capabilities:**
- **One Primary + one Backup check per Zulu day.** Today's check is editable; history is immutable.
- **Per-base agency roster** — Tower, Fire, Medical, SF, Hospital, Civil Engineering, etc. Configured in Base Setup → SCN Agencies (drag-reorder, inline rename via Edit / Save / Cancel; renames are safe — historical SCN records snapshot `agency_name` at submit time).
- **Four agency statuses** — Good (green), Marginal (yellow), Out of Service (red), Message Garbled (orange).
- **Per-agency notes** — e.g., "Radio needs repair, ETA 2 weeks".
- **Operating-initials sign-off** — auto-populated from current user profile.
- **30-day rolling history** below today's card.
- **Monthly PDF report** — calendar-month summary showing every day's check + all agency statuses + notes; trend line.
- **Email monthly report** to AFM / Safety.
- **OOS dialog** — required reason capture when an agency is marked OOS.

**Roles & permissions.** `scn:view`, `scn:write`, `scn:manage_agencies`.

**Outputs.** Monthly PDF · Email · Activity log entries.

**Regulatory backing.** DAFMAN 13-204 Vol 1 Para 2.5.2.5 (daily SCN check); DAFMAN 13-204 Vol 1 Para 2.5.2.2 (required communicating agencies).

---

### 2.10  Personnel on Airfield (`/contractors`)

**What it does.** Tracks when contractors and other personnel are working on the airfield, captures AF Form 483 and personnel information with expiration tracking and reusable contractor templates.

**Capabilities:**
- **Contractor records** — company, contact person, location, description, start date, notes.
- **AF Form 483 fields** — radio callsign, flag designation, contact phone, AF 483 serial number + expiration date.
- **Reusable templates** — saved on the base record as JSONB (company + contact + callsign + notes); load to populate a new entry quickly.
- **Status tracking** — active / completed; filter by status.
- **Expiration alerts** — visual red indicator when AF 483 expires within 30 days.
- **Search** — by company / contact / location / callsign.
- **Edit in place** — change location / status / expiration / notes without creating a new record.
- **PDF export** — AF Form 483 personnel roster with all fields.
- **Email PDF** to Security Forces for perimeter control.

**Roles & permissions.** `contractors:view`, `contractors:write`, `contractors:delete`.

**Outputs.** PDF · Email.

**Regulatory backing.** AF Form 483; DAFMAN 13-204 Vol 1 Para 2.5.2.6 (airfield access control).

---

## Part 3 — Reports, reference, admin

### 3.1  Reports & Analytics (`/reports`)

**What it does.** Executive and operational reporting hub. Daily Operations rollup, configurable Discrepancy reports, Aging analysis, Trend analytics, Lighting Health snapshot, plus the 30-day Analytics dashboard fed by `lib/reports/analytics-data.ts`.

**Sub-routes & capabilities:**
- **`/reports/daily`** — Daily Operations Summary PDF for any chosen date. Sections: airfield status, runway status changes (from `runway_status_log`), ARFF status changes (from `arff_status_log`), inspections / checks / discrepancies for the day, NOTAMs, weather, BWC, Visual NAVAID outages (from `OutageEventForReport` via `fetchOutageEventsForDate()`), wildlife events, manual entries. The artifact filed via the Daily Reviews certification flow.
- **`/reports/discrepancies`** — Filter-based discrepancy report. Pick status / type / shop / location / age; configurable column selection; PDF or email. Aging filter + map view + KPI strip.
- **`/reports/aging`** — Aging analysis grouped by tier (0–7 / 8–30 / 31–90 / 90+ days) with shop responsibility. Surfaces SLA pressure and stale work.
- **`/reports/trends`** — Trend chart (opened vs. closed over time) with time-frame selector (7d / 30d / 90d / 180d / 1yr / custom).
- **`/reports/lighting`** — Lighting system health snapshot per DAFMAN 13-204 Vol 2. Component-level inventory, outage history, current alert tier per system.
- **30-day Analytics Dashboard** (KPI cards on `/reports`) — inspection volume + average time (`started_at → filed_at`, falls back to `created_at` for legacy), check counts split by type + average time, discrepancy pipeline, QRC executions, personnel activity, obstructions, parking plans, wildlife — accepts any `days` parameter.
- **Email PDF** distribution from every report.

**Roles & permissions.** `reports:view`, `reports:export`.

**Outputs.** PDF · Email · KPI dashboard.

**Regulatory backing.** DAFMAN 13-204 Vol 1 (daily ops reporting); DAFMAN 13-204 Vol 2 Table A3.1 (lighting health).

---

### 3.2  Regulations Library (`/regulations`)

**What it does.** Searchable repository of 70+ USAF / FAA regulations with full-text PDF viewer, favorites, custom uploads.

**Capabilities:**
- **70+ pre-loaded regulations** — DAFMAN 13-204 Vol 1–3, UFC 3-260-01, AFMAN 91-203, AF Form 505 guidance, AFI 13-213, DoD 4165.57, FAA AC 150/5300-13B, etc.
- **Tags + categories** — searchable by AM, BASH, NOTAM, RSC, RCR, BWC, FOD Check, airfield checks, etc.
- **In-browser PDF viewer** via react-pdf with page jumping + sidebar nav.
- **Server-side full-text indexing** (`pdf_extraction_status` + `pdf_text_pages` tables) for keyword search across the corpus.
- **Per-user favorites** via localStorage.
- **External URL links** to authoritative FAA / DoD sources where available.
- **Offline reads** — Workbox caches regulation tables (NetworkFirst, 7-day TTL).

**Roles & permissions.** `regulations:view`.

**Outputs.** In-browser viewing + downloads.

---

### 3.3  Aircraft Reference (`/aircraft`)

**What it does.** 200+ aircraft database with physical characteristics for parking, ACN/PCN comparison, and crew reference.

**Capabilities:**
- **200+ aircraft** — military and civilian; silhouettes, MTOW, wheelbase, fuselage dimensions.
- **ACN / PCN calculator** — compare aircraft ACN against airfield PCN; pavement type (rigid / flexible), subgrade (A / B / C / D), weight mode (max / min).
- **Sorting** — by MTOW, wheelbase, wingspan, length; ascending / descending.
- **Per-user favorites** with default-show toggle.
- **Parking module integration** — silhouettes feed `/parking` for live wingtip / taxilane checks.
- **Search + filter** — by name, type (transport / fighter / cargo), MTOW range.

**Roles & permissions.** `aircraft:view`.

**Outputs.** ACN / PCN comparison results · Silhouettes embedded in parking PDFs.

---

### 3.4  Custom Library (`/library`)

**What it does.** Per-base document library — uploaded local procedures, SOPs, base-specific instructions — with the same in-browser PDF viewer + full-text search as `/regulations`.

**Capabilities:**
- **Custom PDF uploads** — admin uploads base-specific docs.
- **Same viewer + indexing** as the regulations library.
- **Permission-gated** — `library:view` to read, `library:manage` to upload / delete.
- **Resolved via the matrix** so the gate matches both the sidebar visibility map and the RLS on `pdf_extraction_status` / `pdf_text_pages`.

**Roles & permissions.** `library:view`, `library:manage`.

**Outputs.** In-browser viewing + downloads.

---

### 3.5  Glidepath Training (`/training`)

**What it does.** Built-in onboarding and per-module documentation for using the Glidepath platform itself — distinct from airfield management training records. The sidebar label reads "Glidepath Training" so users don't confuse it with personnel training compliance. Rebuilt in v2.33 as a role-filterable hub with per-module deep-dive subpages.

**Capabilities:**
- **Role-filterable hub** — chip filter at the top narrows to a role's actionable working set (CES → 4 modules; Safety → 3; PPR → 4; MAJCOM → 5; Read-Only → 5; Sys Admin → all).
- **27 module entries** — overview, key features, how-to-access, workflow, screenshots, FAQ, related modules, and a `roles[]` per module.
- **Per-module deep-dive subpages** at `/training/[module-id]` — 9-section layout (hero with role chips + Open Module + Mark Reviewed; Overview; Key Features card grid; How to Access; Screenshots gallery; Workflow stepper with vertical connecting line; FAQ; Related modules; back-link).
- **Mark Reviewed toggle** — per-user reviewed state stored under the `training:<id>` namespace inside `profiles.tours_completed` JSONB. Hub shows reviewed-vs-unreviewed filter chips + progress counter ("12 of 27 reviewed"). Cards flip to a green-tinted treatment with a check badge when reviewed.
- **Release notes & version history** with `last_seen_release_version` tracking per user — "What's New" dialog appears when a user logs in after a version bump.
- **Setup-wizard tour at `/base-config/setup`** — first-run guided walkthrough; dismissable, persisted per user in `profiles.tours_completed`.

**Roles & permissions.** `training:view`.

**Outputs.** In-app HTML · Release notes dialog.

---

### 3.6  Base Setup Wizard (`/base-config/setup`)

**What it does.** 15-step initial-configuration wizard plus ongoing infrastructure management. Covers airfield topology, personnel, equipment, templates, compliance setup. ~4.7K LOC; the largest single module.

**Wizard steps:**
1. **Runways** — define with coordinates, dimensions, approach lighting, ILS type. **ICAO airport lookup** auto-imports FAA survey-grade data. Also hosts **Established Airfield Elevation** and the **Map Imagery** selector (Google / Bing / Esri per-base satellite tile provider).
2. **Airfield Areas** — location names (e.g., RWY 01/19, East Ramp, TWY A).
3. **Taxiways** — designators for clearance / discrepancy location tagging.
4. **NAVAIDs** — list for Airfield Status green/yellow/red toggles.
5. **CE Shops & Type Mapping** — CE shops + the `discrepancy_type_shop_map` JSONB rules.
6. **ARFF Vehicles** — aircraft names for crash/rescue readiness.
7. **Facilities** — facility numbers for discrepancy / inspection location tagging.
8. **Inspection Templates** — sections + items for daily airfield + lighting inspections.
9. **Shift Checklist** — per-shift tasks with daily / weekly / monthly frequency.
10. **QRCs** — import 25 default templates or use Create QRC for new ones from scratch; per-base review interval (Monthly / Quarterly).
11. **SCN Agencies** — Tower, Fire, Medical, SF, Hospital, etc. (drag + inline rename).
12. **Wildlife Species** — select 270+ species common at the installation.
13. **Lighting Systems** — networks, components, DAFMAN outage thresholds (optional).
14. **Status Boards** — custom Airfield Status panels with three-state items (optional).
15. **PPR Columns** — define the configurable PPR table columns (optional).
16. **Customer Feedback** — configure the public feedback form + custom fields (optional).

**Capabilities beyond the steps:**
- **Modular onboarding** — admins pick which Glidepath modules apply to their base (`bases.enabled_modules`). Sidebar, bottom nav, More menu, dashboard tiles, and the wizard itself all filter automatically. Module Selector at `/base-config/setup/modules` with Recommended / Enable Everything / Clear All presets.
- **Progress tracking** — per-step `complete` / `skipped` / `in_progress` with user attribution. Dashboard "Finish setting up…" banner surfaces until enabled modules are complete.
- **Quick Setup pre-fill** — pulls FAA survey-grade defaults from the ICAO of the configured base (runways, navaids, taxiways, areas, facilities) so the wizard starts ~50% filled.
- **Kiosk token generation** — URL-based public PPR + Feedback forms with no login required.
- **Default PDF email** — preferred address for report distribution.
- **AMOPS email** — used as the reply-to and courtesy-copy address on every automated PPR email.
- **Bulk wildlife import** — add multiple species at once.
- **Shift count** (2 or 3) — drives Daily Reviews slot count.

**Roles & permissions.** `base_setup:view`, `base_setup:write`.

**Outputs.** Configuration stored on `bases` and child tables.

---

### 3.7  User Management (`/users` and `/settings/users`)

**What it does.** Role assignment, per-user permission override, deactivation, base access control, invitations.

**Capabilities:**
- **Invite users** — Resend-delivered email with signup link; bulk import.
- **Role assignment** — pick from 12 roles (sys_admin / airfield_manager / namo / base_admin / amops / ces / safety / atc / read_only / airfield_status / ppr / majcom_rfm).
- **Per-user permission overrides** — grant or revoke individual permission keys regardless of role preset; `granted=FALSE` always wins so sys_admin can revoke even from a role's default.
- **Bulk base assignment** — checkbox list of every installation, pre-checks current memberships, saves all adds/removes in one pass. Primary base stays locked. Designed for MAJCOM/RFM setup.
- **Deactivation** — soft-delete preserves audit trail.
- **Base filtering** — view users by primary base; mass-reassign.
- **Password reset** — Resend-delivered reset link via `/api/admin/reset-password`.
- **Last-seen tracking** — `last_seen_at` powers the header presence dot and the Login Activity dialog.
- **Email privacy** — email hidden from user cards, masked with eye toggle in the edit modal.
- **Operating initials** — per-user `profiles.operating_initials` (max 4 chars), self-service edit in Settings, admin edit in User Management.
- **User deletion** — nullifies 12 FK columns across 10 tables before deleting profile + auth user.

**Roles & permissions.** `users:view`, `users:manage`.

**Outputs.** Audit log entries on every user action.

---

### 3.8  General Settings (`/settings`)

**What it does.** System-wide preferences and per-user defaults.

**Capabilities:**
- **Theme toggle** — dark / light mode with full contrast pass.
- **Default PDF email** — saved to profile.
- **Installation switcher** — pick the active base from accessible installations.
- **Operating initials** self-service edit.
- **About section** — current version, build info.
- **Sign out** button (also mirrored in More menu).

**Roles & permissions.** `settings:view` (read); profile edits write to the user's own profile.

---

## Part 4 — Platform capabilities

The cross-cutting machinery that makes the modules work as a single platform — and where most of the differentiation lives.

### 4.1  Multi-installation fabric

`useInstallation()` is the single hook every page uses to access the current base context. Switching bases re-fetches runways, areas, CE shops, type-to-shop mapping, ARFF aircraft, facilities, default PDF email, default OOO messages, enabled modules, setup progress, and the per-base map provider in parallel via `Promise.all`. All operational tables include `base_id` with RLS enforcing match. Every map component depends on `[token, installationId, mapProvider]` and uses destroy-and-recreate (not early-return guard) to re-init cleanly on installation switch or provider swap. ANG units with multiple aprons or RFMs/FAMs covering several bases work natively from a single login.

### 4.2  Permission matrix (12 roles + per-user overrides)

Permission control is matrix-based, not role-based. Twelve roles in the catalog: `sys_admin`, `airfield_manager`, `namo`, `base_admin`, `amops`, `ces`, `safety`, `atc`, `read_only`, `airfield_status`, `ppr`, `majcom_rfm`. Permission keys are `<resource>:<action>` shaped (`discrepancies:transition:ces_statuses`, `safety_update_rsc_bwc`, etc.) and grow with each new module.

The catalog lives in the `permissions` table; presets in `role_permissions`; per-user exceptions in `user_permission_overrides` with `granted=TRUE/FALSE`. The capability function resolves to: *role grants the key* AND *no override revokes it*, OR *override explicitly grants it*. `granted=FALSE` always wins so sys_admin can revoke from a role.

The same matrix gates three places: client UI (via `usePermissions().has(PERM.X)`), server RPC (SECURITY DEFINER functions check explicitly), and Postgres RLS (every write policy reads `user_has_permission(auth.uid(), '<key>')` and `user_has_base_access(auth.uid(), base_id)`). Three layers, one source of truth.

Three of the twelve roles are tightly scoped:
- **`airfield_status`** (kiosk) — per-base view-only login, sidebar/bottom-nav/installation switcher hidden, `KioskGuard` redirects off any non-root route. Designed for break-room or transient-counter wall tablets.
- **`ppr`** — PPR entries + airfield status view; edits via `ppr:write`. For PPR cell operators who shouldn't see the full app.
- **`majcom_rfm`** — multi-base read-only. Uses `base_members` rows + the header installation switcher to roll up across every assigned installation. The sidebar pending-action counters aggregate across bases for the RFM/FAM workflow.

### 4.3  Real-time collaboration (Supabase Realtime)

Supabase Realtime is enabled on tables where multi-user freshness matters: `airfield_status` (UPDATE), `airfield_checks` (INSERT), `inspections` (INSERT), `ppr_entries` (changes). The DashboardProvider subscribes for advisory + runway state. The Dashboard page subscribes for BWC / RSC / last-check refresh. The PPR Log subscribes for live-status pings. All channels clean up on unmount or `installationId` change. `subscribeWithErrorHandling()` detects CHANNEL_ERROR / TIMED_OUT and surfaces a one-time toast: "Your change was saved, but real-time sync is temporarily unavailable" — the data is always persisted; realtime is the freshness mechanism, not the persistence mechanism.

Custom-event bridges from mutation sites + pathname-change listeners + visibility-gated polling (≥60 s, see §4.4) cover sub-minute updates whenever the user is interacting.

### 4.4  Offline write queue + offline reads (PWA)

The platform is built to operate when connectivity is intermittent — flight line, alert facility, hangar, exercise sites.

**Offline reads.** Workbox runtime caches 18 read-heavy tables under NetworkFirst with a 7-day TTL: `qrc_templates`, `ppr_columns`, `ppr_entries`, `airfield_contractors`, `discrepancies`, `photos`, `waivers`, `waiver_criteria`, `infrastructure_features`, `lighting_systems`, `bases`, `installation_runways`, `installation_areas`, `airfield_facilities`, `profiles`, `discrepancy_status_updates`, `pdf_extraction_status`, `pdf_text_pages`. Storage objects (photos, PDFs) cache CacheFirst with a 30-day TTL. Satellite tiles (Google / Bing / Esri / Mapbox) cache CacheFirst with a 30-day TTL, 2000–4000 entry limits. Cache wipes on logout to prevent cross-user leakage on shared devices.

**Offline writes.** A singleton `WriteQueue` backed by IndexedDB. Each feature module registers a handler at startup; `enqueueOrExecute(type, payload, meta)` tries online first, queues otherwise. Pending photos go in a `pending_photos` table. Exponential backoff with jitter; `ConflictError` for mid-air edits; `NonRetriableError` for permission / validation. On `navigator.onLine → true`, the queue drains and emits `WRITE_COMMITTED_EVENT` per write so the UI can refresh without a full page reload.

**Polling defaults** for any background loop: `getSession()` not `getUser()` (no auth-server roundtrip); ≥60-second interval; `document.visibilityState === 'visible'` gate so background tabs generate zero traffic.

### 4.5  PDF export pipeline

All PDF generation is client-side via jsPDF + jspdf-autotable. Photos and maps embed inline. Every reportable module produces a downloadable / emailable PDF, including the Daily Operations rollup (filed via Daily Reviews), discrepancy reports (single + configurable batch + aging tiers + trend chart), lighting health snapshot, single-check report, ACSI annual report, daily inspection report, obstruction evaluation with surface analysis, to-scale parking diagram with satellite snapshot and multi-apron support, QRC execution with steps + responses + SCN markers, AF Form 483 personnel roster, single + batch PPR with admin columns and coordination summary, AF Form 505 waiver package, customer feedback summary, and the monthly SCN matrix.

Photos compress client-side (max 800 px, 0.7 quality) for PDF embedding; full-resolution storage is preserved in Supabase Storage. Maps embed via canvas-to-dataURL. A shared PDF-utilities layer standardizes chrome across the list-style reports.

### 4.6  Email distribution (Resend)

Sender: `Glidepath <info@glidepathops.com>`. Reply-To: `bases.amops_email` (validated per base; falls back to the sender on malformed addresses). Server-only `RESEND_API_KEY`. Branded transactional templates for invites, password resets, signup confirmations, and the entire PPR flow.

Routes:
- `/api/send-pdf-email` — generic; any module's PDF export can route here. Also drives the Daily Reviews full-certification email-to-file workflow.
- `/api/send-ppr-confirmation` — to requester on PPR submit.
- `/api/send-ppr-coordination-request` — to agency coordinators when entry moves to `coordinating`.
- `/api/send-ppr-approval` — to requester on approve.
- `/api/send-ppr-denial` — to requester with reason.
- `/api/send-ppr-cancellation` — to requester + agencies on soft-cancel.
- `/api/forgot-password` — anonymous endpoint that mints a recovery link via Supabase admin API and sends a branded reset email (enumeration-safe — every failure path returns 200).
- `/api/admin/invite` — invite + magic-link signup.
- `/api/signup-email` — signup confirmation.

**AMOPS courtesy copy.** Every PPR email (confirmation, coordination-request, approval, denial, cancellation) automatically adds the base's `amops_email` as a CC alongside the reply-to. The AMOPS office gets a record of every automated message that goes out under their name without anyone having to remember to CC them manually. Same `validReplyTo` guard that filters malformed reply-to addresses also covers the CC, so a typo in `bases.amops_email` won't kill the send.

Internal-create PPRs without a requester email skip silently. Email is fire-and-forget; UI toasts on success / failure.

### 4.7  Photo capture & storage (entity-FK linkage, RLS)

Photos use entity-specific FK columns — `discrepancy_id`, `check_id`, `inspection_id`, `acsi_inspection_id`, `acsi_item_id` — plus `issue_index` for per-issue / per-discrepancy linking inside checks and inspections. The FK approach gives Postgres clean cascade deletes and RLS targeting.

Storage RLS on the `photos` bucket is path-scoped on `storage.objects`. INSERT requires `photos:write` permission + base access derived from the path's UUID segment. Obstruction-photo paths (no entity UUID) are prefix-scoped only. Email-temp is auth-only.

URLs are fetched via `getPublicUrl()` — the stored `storage_path` does not include the bucket prefix.

Image processing:
- **Upload resize** — max 1600 px, JPEG, 0.82 quality (typical 4–5 MB → 150–300 KB).
- **PDF compression** — max 800 px, 0.7 quality (typical 300–500 KB → 40–80 KB).
- **Thumbnails** — max 200 px, 0.6 quality (5–15 KB).

### 4.8  Mapping (Google Maps everywhere, per-base alternate satellite tiles, Mapbox heatmap)

Google Maps JS API powers every interactive map in the app — discrepancy map, check map, parking diagram, obstruction map, taxiway editor, NAVAID map, infrastructure feature map, inspection detail map, PPR aircraft map, waiver obstruction map, base summary map. Mapbox GL is retained for the wildlife BASH heatmap only, where its density-rendering style is best-in-class. Mapbox is not viable for the interactive modules — the Air Force network reliably throttles WebGL-heavy renderers enough that Mapbox is laggy and choppy on AF-side clients.

**Per-base satellite tile provider.** Bases that appear blurred or pixelated in Google Maps satellite imagery (German installations like Ramstein and Spangdahlem under BKG mandate; some Belgian and Dutch installations) can switch their satellite tile source to **Bing Maps Aerial** or **Esri ArcGIS World Imagery** during base setup. The renderer stays Google Maps JS API in all cases — `google.maps.ImageMapType` swaps only the imagery layer underneath. All markers, polygons, overlays, geometry helpers, `OverlayView` projections, and `html2canvas` capture continue to run on the same Google SDK, which preserves the gov-network performance characteristics. Choice is `bases.map_provider` (`'google' | 'bing' | 'esri'`, default `'google'`) and applies to all 13+ map call sites in the app, including the parking PDF capture pipeline.

**Unified "Use My Location" UI** across every map. One shared `<UseMyLocationButton>` component renders the same cyan chip with a Crosshair icon in two variants: an **overlay chip** (top-right of map viewports — discrepancies map, Visual NAVAIDs map, Obstruction Evaluation map) for "show my position relative to airfield features," and an **inline full-width button** (form companions — Obstruction Evaluation sidebar, /discrepancies/new, /waivers/new, /waivers/[id]/edit, edit-discrepancy modal) for "fill the form's coords with my GPS." Same icon, same labels, same error toasts (denied / unavailable / timeout) everywhere.

**Server-side proxy routes:**
- `/api/elevation` — Google Elevation API (`GOOGLE_ELEVATION_API_KEY`, server-only). Replaced Open-Elevation, which had SSL cert issues.
- `/api/airport-lookup` — ICAO base lookup for the Base Setup Runways step.

### 4.9  Zulu time discipline

Every operational timestamp displays in Zulu (UTC). Helpers in `lib/utils.ts`: `formatZuluTime` (`1500Z`), `formatZuluDate` (`Apr 28, 2026`), `formatZuluDateTime` (`Apr 28, 2026 1500Z`), `formatZuluDateShort` (`Apr 28`). All app surfaces use these. The only exception is the Daily Operations date picker, which uses local time so the AFM picks "today" naturally.

For Zulu / military-time inputs in forms (PPR ETA, ETD columns), the standard is a 4-digit HHMM text input with `inputMode="numeric"` — never `<input type="time">`, which forces AM/PM on en-US Chrome / Edge with no documented override.

### 4.10  Audit log + presence

`logActivity()` and `logManualEntry()` from `lib/supabase/activity.ts` write the immutable record. Auto-logged on every check, inspection, discrepancy state change, NAVAID toggle, advisory create, ARFF readiness change, QRC step, wildlife strike, contractor change, NOTAM lifecycle, PPR transition, waiver review, etc. Every entry stores `(action, entity_type, entity_id, display_id, metadata, user_id, created_at)`. Operating initials from the user's profile show in the Events Log OI column.

The AMENDED pill (Events Log) — when a row's `created_at > daily_reviews.fully_certified_at` for that date, the row is flagged AMENDED so the certifying AFM knows the day's record was edited after sign-off. Combined with the events-hash on each Daily Review slot, this gives a tamper-evident audit trail.

Presence: header status dot from `last_seen_at` (green / yellow / red), with the Login Activity dialog surfaced once per session (per-session flag `glidepath_activity_checked`, fallback to `last_seen_at` from profile).

### 4.11  Demo mode

URL-based auto-login at `/login?demo=true`. Middleware detects unconfigured Supabase and skips the auth gate. Demo AFB contains non-real-world data provided via `supabase/seed-demo-base.sql`; the demo user is `airfield_manager` on the isolated Demo AFB. All demo data lives in `lib/demo-data.ts` (10 arrays); no Supabase writes; airfield-diagram falls back to IndexedDB; full feature parity for evaluation. Risk-free sandbox for stakeholders to click around.

### 4.12  Friendly error mapping

`friendlyError()` in `lib/utils.ts` maps RLS / unique-constraint / FK-violation errors to human-readable messages. Applied across every CRUD module. The toast (Sonner) shows the friendly version; the original error is still logged to the console for engineering. Example: a `discrepancy_type_shop_map` FK error becomes "Map this discrepancy type to a valid CE shop in Base Setup → CE Shops" instead of `ERROR: 23503: insert or update on table "discrepancies" violates foreign key constraint "discrepancies_shop_fkey"`.

---

## Part 5 — Integrations & deployment

### 5.1  External services

| Service | Purpose | Auth | Notes |
|---|---|---|---|
| **Resend** | Transactional email (invites, resets, PDFs, PPR flow with AMOPS CC) | Server-only `RESEND_API_KEY` | Sender `info@glidepathops.com`; reply-to per base |
| **Google Maps JS API** | Every interactive map | Client-exposed `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 13+ distinct map embeds across the app |
| **Google Elevation API** | Obstruction MSL lookup | Server-side proxy at `/api/elevation` | `GOOGLE_ELEVATION_API_KEY` server-only |
| **Bing Maps Aerial (Microsoft)** | Alternate satellite tile source for OCONUS bases | Client-exposed `NEXT_PUBLIC_BING_MAPS_KEY` | Per-base opt-in via Base Setup; quadkey TMS via `ImageMapType` |
| **Esri ArcGIS World Imagery** | Alternate satellite tile source for OCONUS bases | No key for pilot use; ArcGIS Online subscription for commercial production | Per-base opt-in via Base Setup; XYZ TMS via `ImageMapType` |
| **FAA NOTAM Search** | Live NOTAM feed | Public, no key | `/api/notams/sync` calls `notams.aim.faa.gov` |
| **ICAO airport lookup** | Base Setup Runways auto-fill | Public, no key | `/api/airport-lookup` |
| **Open-Meteo** | Weather for Airfield Status + wildlife auto-fill | Public, no key | Open CORS |
| **Supabase** | Postgres + Auth + Storage + Realtime | Project anon key (client) + service role (server) | Primary platform backbone |
| **Mapbox GL** | Wildlife BASH heatmap only | Client `NEXT_PUBLIC_MAPBOX_TOKEN` | Sole remaining Mapbox use — not viable for interactive modules on the AF network |

### 5.2  Deployment today

- **Frontend**: Vercel (Next.js 14 App Router, auto-scaling, CDN).
- **Backend / Auth / DB / Storage / Realtime**: Supabase.
- **Email**: Resend.
- **CDN**: Vercel CDN (images, static assets, generated PDFs).
- **Security headers**: HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.
- **Compliance posture**: HTTPS-only; TypeScript strict + Zod schemas at boundaries; output encoding via `sanitizeRegId` / escape helpers; T-3 waiver on file for AF Form 3616 CAC-signature requirement (Glidepath is the approved web-based substitute).

### 5.3  Roadmap

- **Platform One Party Bus** — DoD cATO via P1 for IL4 / IL5 environments. Approach A: port to Vite SPA + Express API. ~6–8 weeks. Scaffold staged.
- **CAC / PIV authentication** — blocked on Platform One.

---

## Part 6 — Regulatory coverage matrix

| Reference | Where it shows up in Glidepath |
|---|---|
| **DAFMAN 13-204 Vol 1** | Airfield Status, Events Log, Shift Checklist, Daily Reviews, Inspections, Checks, Discrepancies, NOTAMs, PPR, SCN, Personnel on Airfield, Customer Feedback (optional) |
| **DAFMAN 13-204 Vol 2** | NAVAID + ARFF status, Visual NAVAID Outage Engine (Table A3.1), Lighting Report, Waivers (annual review), ACSI |
| **DAFMAN 13-204 Vol 2 Para 5.4.3** | ACSI module — annual compliance, 10-section checklist |
| **DAFMAN 13-204 Vol 2 Para 2.5.2.10** | Web-based program suitable-substitute authorization |
| **DAFMAN 13-204 Vol 1 Para 2.5.2.10.3 / 10.4** | Daily Reviews — shift sign-off, AFM certification (T-3 waiver on AF Form 3616 CAC requirement) |
| **DAFMAN 13-204 Vol 1 Para 2.5.2.5** | Secondary Crash Net daily check |
| **DAFMAN 13-204 Vol 1 Para 2.5.2.6** | Personnel on Airfield (AF Form 483 escort credentials) |
| **DAFMAN 91-212** | Wildlife / BASH module (sightings, strikes, heatmap, deterrent actions) |
| **AFMAN 91-203** | QRC module — 25 default emergency / contingency checklists |
| **UFC 3-260-01 Ch. 3** | Obstruction Evaluations — geodesic imaginary-surface analysis (primary, clear zone, approach, transitional, inner horizontal, conical, outer horizontal) |
| **UFC 3-260-01 Ch. 6 Table 6-1a** | Aircraft Parking — wingtip / taxilane clearance envelopes per ADG and apron context |
| **UFC 3-535-01** | ACSI lighting items, Visual NAVAID standards |
| **DoD Instruction 4165.57** | Obstruction APZ I / APZ II land-use overlay |
| **AF Form 483** | Personnel on Airfield escort credential roster |
| **AF Form 505** | Waivers — 6 classifications, 7-status workflow, annual review |
| **AF Form 3616** | Events Log — CAC-signature requirement waived via approved T-3 |
| **AFI 13-213** | PPR procedures for transient aircraft |
| **FAA AC 150/5300-13B** | Airfield design standards (obstruction context) |
| **FAA JO 7930.2 / FAAO JO 7210.3** | NOTAM formatting + content rules |

---

## Appendix A — Module-permission quick reference

| Module | View | Write | Delete | Specialty keys |
|---|---|---|---|---|
| Airfield Status | `airfield_status:view` | `airfield_status:write` | — | `safety_update_rsc_bwc` (Safety RPC) |
| Dashboard | `dashboard:view` | — | — | — |
| Checks | `checks:view` | `checks:write` | `checks:delete` | — |
| Inspections | `inspections:view` | `inspections:write` | `inspections:delete` | `inspections:file` |
| ACSI | `acsi:view` | `acsi:write` | `acsi:delete` | `acsi:file` |
| Discrepancies | `discrepancies:view` | `discrepancies:write` | `discrepancies:delete` | `:close`, `:cancel`, `:transition:ces_statuses`, `:update:resolution_notes`, `:add_note` |
| CES Work Orders | `ces:view` | (uses discrepancy keys + `ces_update_discrepancy` RPC) | — | — |
| Visual NAVAIDs | `infrastructure:view` | `infrastructure:write` | `infrastructure:delete` | — |
| Parking | `parking:view` | `parking:write` | `parking:delete` | — |
| Obstructions | `obstructions:view` | `obstructions:write` | `obstructions:delete` | — |
| QRC | `qrc:view` | `qrc:write` | — | `qrc:execute` |
| Shift Checklist | `shift_checklist:view` | `shift_checklist:write` | — | — |
| SCN | `scn:view` | `scn:write` | — | `scn:manage_agencies` |
| Wildlife | `wildlife:view` | `wildlife:write` | `wildlife:delete` | — |
| Waivers | `waivers:view` | `waivers:write` | `waivers:delete` | `waivers:review` |
| NOTAMs | `notams:view` | `notams:write` | — | `notams:cancel` |
| PPR | `ppr:view` | `ppr:write` | `ppr:delete` | `ppr:review`, `ppr:coordinate`, `ppr:approve` |
| Feedback | `feedback:view` | (form public) | `feedback:delete` | `feedback:configure` |
| Contractors | `contractors:view` | `contractors:write` | `contractors:delete` | — |
| Daily Reviews | `daily_reviews:view` | (per-slot sign keys) | — | `daily_reviews:sign:amsl`, `:sign:namo`, `:sign:afm` |
| Reports | `reports:view` | — | — | `reports:export` |
| Activity Log | `activity_log:view` | `activity_log:write_manual` | `activity_log:delete` | — |
| Photos (cross-cutting) | (implicit) | `photos:write` | `photos:delete` | — |
| Library | `library:view` | `library:manage` | — | — |
| Regulations | `regulations:view` | — | — | — |
| Aircraft | `aircraft:view` | — | — | — |
| Training | `training:view` | — | — | — |
| Settings | `settings:view` | (writes to own profile) | — | — |
| Base Setup | `base_setup:view` | `base_setup:write` | — | — |
| Users | `users:view` | `users:manage` | — | — |
| Installations | — | — | — | `installations:switch` |

---

## Appendix B — Route inventory

```
/                              Airfield Status (default landing)
/dashboard                     Dashboard (KPI hub + AFM Out-of-Office)
/checks                        Airfield Checks (list)
/checks/new                    Create check
/checks/[id]                   Check detail
/inspections                   Daily Inspections (list)
/inspections/new               Create daily airfield/lighting
/inspections/construction/new  Construction meeting variant
/inspections/joint-monthly/new Joint monthly variant
/inspections/[id]              Inspection detail
/acsi                          ACSI (list)
/acsi/new                      Start ACSI
/acsi/[id]                     ACSI detail
/discrepancies                 Discrepancies (list + map)
/discrepancies/new             Create discrepancy
/discrepancies/[id]            Detail
/ces                           CES Work Orders dashboard
/infrastructure                Visual NAVAIDs map
/parking                       Aircraft Parking Plans
/obstructions                  Obstruction list
/obstructions/[id]             Evaluation detail
/obstructions/history          History view
/qrc                           QRC templates + executions
/shift-checklist               Shift Checklist
/scn                           Secondary Crash Net daily
/wildlife                      Wildlife / BASH (heatmap + sightings + strikes)
/waivers                       Waivers list
/waivers/new                   Create waiver
/waivers/[id]                  Detail
/waivers/[id]/edit             Edit
/waivers/annual-review/[year]  Annual review by year
/notams                        NOTAMs (FAA feed)
/notams/[id]                   Detail
/ppr                           PPR Log (staff)
/ppr-request/[baseId]          PPR public form (legacy URL)
/[icao]/ppr-request            PPR public form (short URL)
/feedback                      Customer Feedback inbox (staff)
/feedback/[baseId]             Customer Feedback public form
/contractors                   Personnel on Airfield (AF Form 483)
/reports                       Reports index + 30-day analytics
/reports/daily                 Daily Operations PDF
/reports/discrepancies         Configurable discrepancy report
/reports/aging                 Aging analysis
/reports/trends                Trend chart
/reports/lighting              Lighting health
/activity                      Events Log
/daily-reviews                 Shift sign-off queue
/regulations                   Regulations Library
/aircraft                      Aircraft Reference + ACN/PCN
/library                       Custom Library
/training                      Glidepath Training hub
/training/[module-id]          Per-module deep-dive
/settings                      General Settings
/base-config/setup             15-step Base Setup Wizard
/base-config/setup/modules     Module enablement toggle
/settings/users                User Management (settings nav)
/users                         User Management (top-level)
/more                          Mobile module menu

/api/admin/invite                    User invite
/api/admin/reset-password            Admin-initiated reset
/api/admin/users/[id]                User edit / delete
/api/forgot-password                 Self-service password reset (branded)
/api/signup-email                    Signup confirmation
/api/elevation                       Google Elevation proxy
/api/airport-lookup                  ICAO base lookup
/api/notams/sync                     FAA NOTAM feed pull
/api/send-pdf-email                  Generic PDF distribution
/api/send-ppr-confirmation           PPR confirmation email (AMOPS CC)
/api/send-ppr-coordination-request   PPR coordination email (AMOPS CC)
/api/send-ppr-approval               PPR approval email (AMOPS CC)
/api/send-ppr-denial                 PPR denial email (AMOPS CC)
/api/send-ppr-cancellation           PPR cancellation email (AMOPS CC)
/api/user-emails                     User email lookup
/api/infrastructure-import           KML / CSV / GeoJSON import
/api/installations                   Installation list
/api/airfield-status                 Airfield status RPC
```

---

*This document reflects Glidepath as of v2.34 (May 2026), incorporating released work through v2.33.0 (2026-05-02) plus the unreleased v2.34 staging (per-base alternate map provider for OCONUS bases, unified "Use My Location" component, PPR AMOPS courtesy-copy, parking PDF capture rebuild, QRC create-from-scratch editor + per-base review interval). For the engineering-side handoff and current build state, see `SESSION_HANDOFF.md` at the repo root. For the per-module user manual, see `docs/manual/`.*
