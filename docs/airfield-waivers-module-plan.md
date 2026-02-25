# Glidepath — Airfield Waivers Module Implementation Plan

**Version:** 1.0  
**Date:** February 25, 2026  
**Author:** Chris Proctor / Claude  
**Status:** Draft — Awaiting Review  

---

## 1. Module Overview

The Airfield Waivers module enables Airfield Managers and AP&W Program Managers to digitally track, manage, and review permanent and temporary airfield waivers across installations. It replaces spreadsheet-based tracking (Appendix B of the AFCEC Playbook) with a mobile-first, always-accessible database integrated into Glidepath's existing ecosystem.

### Key Drivers
- AFC Playbook mandates annual waiver review (UFC 3-260-01, Section B1-2.4)
- AFI 13-204V3 requires quarterly AOB waiver briefings (Sections A3.2.6 & A3.3.8)
- Waivers must be accessible for field reference during airfield inspections
- Current tracking via Excel/PowerPoint is error-prone and disconnected from operations

### Design Principles
- **Multi-installation from day one** — schema supports any USAF installation
- **Mobile-first** — readable and functional on phones/tablets during field inspections
- **Integration-ready** — links to existing Discrepancy Tracking, Obstruction Evaluation, and Reports modules
- **Offline-capable** — read access to waiver data when connectivity is limited (PWA caching)

---

## 2. Database Schema

### 2.1 Core Tables

#### `waivers`
The primary waiver record, modeled after AF Form 505 fields and the Selfridge waiver package data.

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `installation_id` | uuid, FK → installations | Installation this waiver belongs to |
| `waiver_number` | text, unique | Formatted waiver ID (supports both VGLZ and P-CODE-YY-## formats) |
| `classification` | enum | `permanent`, `temporary`, `construction`, `event`, `extension`, `amendment` |
| `status` | enum | `draft`, `pending_installation`, `pending_afcec`, `pending_majcom`, `approved`, `completed`, `cancelled`, `expired` |
| `hazard_rating` | enum | `low`, `medium`, `high`, `extremely_high` |
| `action_requested` | enum | `new`, `extension`, `amendment` |
| `description` | text | Full violation description (Item 3 of AF Form 505) |
| `justification` | text | Justification for waiver (Item 4 of AF Form 505) |
| `risk_assessment_summary` | text | Summary from AF Form 4437 (Item 5) |
| `corrective_action` | text | Planned corrective action |
| `criteria_impact` | text | Short description of criteria impact (e.g., "25' deficiency", "9' into clear zone") |
| `proponent` | text | Requesting organization/symbol |
| `project_number` | text | Associated project number (e.g., VGLZ009082) |
| `program_fy` | integer | Programmed fiscal year for corrective action |
| `estimated_cost` | decimal | Estimated project cost |
| `project_status` | text | Current status of corrective project |
| `faa_case_number` | text | FAA OE/AAA Part 77 Case/ASN number |
| `period_valid` | text | Validity period (e.g., "Indefinite", "8-Years", "Duration of Construction") |
| `date_submitted` | date | Date waiver was first submitted |
| `date_approved` | date | Date MAJCOM approval granted |
| `expiration_date` | date | Calculated expiration (approval + 8 years for temporary) |
| `last_reviewed_date` | date | Date of last annual review |
| `next_review_due` | date | Calculated next annual review due date |
| `location_description` | text | Text description of obstruction location |
| `location_lat` | decimal | GPS latitude of obstruction |
| `location_lng` | decimal | GPS longitude of obstruction |
| `notes` | text | General notes field |
| `created_by` | uuid, FK → profiles | User who created the record |
| `updated_by` | uuid, FK → profiles | User who last updated |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

#### `waiver_criteria`
Multiple UFC/criteria references per waiver (one-to-many).

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `waiver_id` | uuid, FK → waivers | Parent waiver |
| `criteria_source` | enum | `ufc_3_260_01`, `ufc_3_260_04`, `ufc_3_535_01`, `other` |
| `reference` | text | Specific reference (e.g., "Table 5.1, Item 1", "Para 6.12.3") |
| `description` | text | Description of the specific criteria violated |
| `sort_order` | integer | Display order (most restrictive first per playbook guidance) |

#### `waiver_attachments`
Photos, maps, AF Form 4437, UFC excerpts, and other supporting documents.

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `waiver_id` | uuid, FK → waivers | Parent waiver |
| `file_path` | text | Supabase Storage path |
| `file_name` | text | Original filename |
| `file_type` | enum | `photo`, `site_map`, `risk_assessment`, `ufc_excerpt`, `faa_report`, `coordination_sheet`, `af_form_505`, `other` |
| `file_size` | integer | File size in bytes |
| `mime_type` | text | MIME type |
| `caption` | text | Optional description/caption |
| `uploaded_by` | uuid, FK → profiles | Uploader |
| `created_at` | timestamptz | Upload timestamp |

#### `waiver_reviews`
Tracks annual review actions per waiver per review cycle.

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `waiver_id` | uuid, FK → waivers | Waiver being reviewed |
| `review_year` | integer | Calendar year of the review |
| `review_date` | date | Date review was conducted |
| `reviewed_by` | uuid, FK → profiles | User who conducted review |
| `recommendation` | enum | `retain`, `modify`, `cancel`, `convert_to_temporary`, `convert_to_permanent` |
| `mitigation_verified` | boolean | Safety precautions still being employed? |
| `project_status_update` | text | Updated status of corrective project |
| `notes` | text | Review notes/comments |
| `presented_to_facilities_board` | boolean | Was this included in Facilities Board briefing? |
| `facilities_board_date` | date | Date presented to Facilities Board |
| `created_at` | timestamptz | Record creation timestamp |

#### `waiver_coordination`
Tracks installation-level coordination signatures (mirrors AF Form 505 Section I, Item 6).

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `waiver_id` | uuid, FK → waivers | Parent waiver |
| `office` | enum | `civil_engineer`, `airfield_manager`, `airfield_ops_terps`, `base_safety`, `installation_cc`, `other` |
| `office_label` | text | Custom label for "Other" entries (e.g., "Security Forces") |
| `coordinator_name` | text | Name of coordinator |
| `coordinated_date` | date | Date coordinated/signed |
| `status` | enum | `pending`, `concur`, `non_concur` |
| `comments` | text | Coordination comments |

### 2.2 Supporting Tables (Existing / Shared)

#### `installations` (likely exists or needs creation)

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | Primary key |
| `name` | text | Full installation name (e.g., "Selfridge ANGB") |
| `installation_code` | text | 4-letter code for waiver numbering (e.g., "VGLZ") |
| `icao_code` | text | ICAO identifier (e.g., "KMTC") |
| `majcom` | text | Responsible MAJCOM |
| `state` | text | State |
| `runway_class` | enum | `class_a`, `class_b` |

### 2.3 Integration Points

**Discrepancy Tracking → Waivers:**
- Add optional `waiver_id` FK column to existing `discrepancies` table
- When an obstruction discrepancy is identified, user can initiate a waiver directly
- Waiver record back-links to originating discrepancy

**Obstruction Evaluation → Waivers:**
- Add optional `waiver_id` FK to `obstruction_evaluations` table
- Obstruction evaluation results feed into AF Form 505 Item 3 description

**Reports Module:**
- Waivers module exposes data for Daily Operations Report (active waiver count, any expiring soon)
- Annual review completion status available for command reporting
- Quarterly AOB briefing data pull

### 2.4 Row Level Security (RLS)

```sql
-- Users can view waivers for installations they have access to
CREATE POLICY "Users view own installation waivers"
  ON waivers FOR SELECT
  USING (installation_id IN (
    SELECT installation_id FROM user_installations
    WHERE user_id = auth.uid()
  ));

-- Only users with 'editor' or 'admin' roles can insert/update
CREATE POLICY "Editors manage waivers"
  ON waivers FOR ALL
  USING (
    installation_id IN (
      SELECT installation_id FROM user_installations
      WHERE user_id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );
```

### 2.5 Supabase Storage

- **Bucket:** `waiver-attachments`
- **Path structure:** `{installation_id}/{waiver_id}/{file_type}/{filename}`
- **Max file size:** 10MB per file
- **Accepted types:** JPEG, PNG, PDF, DOCX

---

## 3. User Interface

### 3.1 Page Structure

```
/waivers                          → Dashboard / List View
/waivers/new                      → Create New Waiver
/waivers/[id]                     → Waiver Detail View
/waivers/[id]/edit                → Edit Waiver
/waivers/annual-review            → Annual Review Workflow
/waivers/annual-review/[year]     → Review for specific year
```

### 3.2 Dashboard / List View (`/waivers`)

**Header Area:**
- Installation selector (dropdown, persists across sessions)
- "New Waiver" button
- "Annual Review" button
- "Export" button (future: Excel export)

**Filter Bar:**
- Classification: All | Permanent | Temporary | Construction | Event
- Status: All | Approved | Draft | Pending | Expired | Cancelled
- Hazard Rating: All | Low | Medium | High | Extremely High
- Search: free text search across waiver number, description, corrective action

**Summary Cards (top of dashboard):**
- Total Active Waivers (count)
- Permanent vs Temporary breakdown
- Expiring Within 12 Months (count, amber highlight)
- Overdue for Annual Review (count, red highlight)

**Waiver List:**
Mobile-optimized card layout (not a table), each card shows:
- Waiver number + classification badge (color-coded)
- Short description (truncated)
- Hazard rating indicator
- Status badge
- Last reviewed date
- Tap to expand → full detail view

**Sort options:** By waiver number, date approved, hazard rating, last reviewed

### 3.3 Waiver Detail View (`/waivers/[id]`)

**Tabbed layout for mobile:**

**Tab 1 — Overview:**
- Waiver number, classification, status, hazard rating
- Full description of violation
- Criteria impact summary
- Corrective action plan
- Project number, program FY, estimated cost, project status

**Tab 2 — Criteria & Risk:**
- List of all UFC criteria violated (from `waiver_criteria`)
- Risk assessment summary
- FAA OE/AAA case number
- Link to AF Form 4437 attachment if uploaded

**Tab 3 — Attachments:**
- Grid of photos with lightbox viewer
- Site maps
- Supporting documents (downloadable)
- Upload button (camera + file picker)

**Tab 4 — Coordination:**
- Status of each coordination office
- Timeline of coordination actions
- Installation CC approval status

**Tab 5 — Review History:**
- Chronological list of annual reviews
- Current review status
- "Conduct Review" button (during review period)

**Tab 6 — Linked Items:**
- Associated discrepancies (from Discrepancy Tracking module)
- Associated obstruction evaluations
- Related NOTAMs issued

### 3.4 Create / Edit Waiver Form

**Multi-step form (wizard pattern for mobile):**

1. **Basic Info** — Waiver number (auto-generated with override), classification, action requested, proponent
2. **Violation Details** — Description, criteria violated (add multiple), criteria impact
3. **Justification & Corrective Action** — Justification text, corrective action, project number, program FY, cost
4. **Risk Assessment** — Hazard rating, risk summary, FAA case number
5. **Attachments** — Upload photos, maps, documents
6. **Review & Submit** — Summary of all entered data, submit as draft or for coordination

### 3.5 Annual Review Workflow (`/waivers/annual-review`)

**Dashboard showing:**
- Review year selector
- Progress tracker: X of Y waivers reviewed
- List of all active waivers needing review, grouped by status:
  - 🔴 Not yet reviewed
  - 🟡 Review in progress
  - 🟢 Review complete
- "Finalize Review" button (marks the review cycle complete)

**Per-waiver review form:**
- Recommendation (retain / modify / cancel / convert)
- Mitigation measures verified? (Y/N)
- Project status update
- Notes
- Mark as reviewed

**On finalization:**
- Updates `last_reviewed_date` and `next_review_due` on all reviewed waivers
- Generates data package for Facilities Board (future: PDF/PPTX export)

---

## 4. Waiver Numbering

The system supports **flexible waiver numbering** to accommodate different installation conventions:

**Standard AFCEC Format:** `{Type}-{InstCode}-{YY}-{Seq}`
- Example: `P-VGLZ-26-01` (Permanent, Selfridge, 2026, sequence 01)
- Auto-generated based on installation code, year, and next available sequence

**Legacy/Custom Format:** Free-text override
- Example: `VGLZ050224007` (existing Selfridge format)
- Supports importing historical waivers without reformatting

**Auto-generation logic:**
```
Type prefix: P (Permanent), T (Temporary), C (Construction), E (Event)
Installation code: from installations.installation_code
Year: current 2-digit year
Sequence: next available number for that type + installation + year
```

---

## 5. Alerts & Notifications

### Automated Alerts (via Supabase Edge Functions + email/in-app)

| Trigger | Recipients | Timing |
|---|---|---|
| Temporary waiver within 12 months of expiration | Installation AM, AP&W PM | Monthly |
| Temporary waiver expired | Installation AM, AP&W PM, CE | On expiration date |
| Annual review due (not yet started) | Installation AM, AP&W PM | 60 days before anniversary |
| Annual review overdue | Installation AM, AP&W PM, CE | On anniversary date |
| Waiver status change | Waiver creator, Installation AM | On status change |

### In-App Indicators
- Dashboard cards show counts of expiring/overdue waivers
- Waiver cards show visual indicators (amber/red badges)
- Annual review page shows progress tracker

---

## 6. Excel Export (Phase 4)

Generates a spreadsheet matching the **Appendix B Annual Airfield & Airspace Waiver Review Sheet** format:

**Header rows:**
- Installation Name, MAJCOM, Installation POC, Installation/CC, Approval Date

**Column mapping:**

| Sheet Column | Source |
|---|---|
| Current Waiver ID | `waivers.waiver_number` |
| New Waiver ID | (blank for new numbering) |
| Waiver Description | `waivers.description` |
| Waiver Type | `waivers.classification` |
| Risk Level | `waivers.hazard_rating` |
| Date Approved | `waivers.date_approved` |
| Term | `waivers.period_valid` |
| ORM Review | Latest `waiver_reviews.review_date` exists for current year |
| Remove | Latest `waiver_reviews.recommendation` = 'cancel' |
| Corrective Action | `waivers.corrective_action` |
| Project Status | `waivers.project_status` |

**Implementation:** Server-side generation using ExcelJS or SheetJS via Supabase Edge Function, triggered from the UI.

---

## 7. Phased Build Plan

### Phase 1: Foundation (Weeks 1-3)
**Goal:** Core CRUD and dashboard with filtering

- [ ] Create database tables and RLS policies
- [ ] Create `installations` table and seed with initial data
- [ ] Build waiver list/dashboard page with filter bar and summary cards
- [ ] Build create waiver multi-step form
- [ ] Build waiver detail view (tabbed layout)
- [ ] Build edit waiver form
- [ ] Implement waiver numbering (auto-generate + manual override)
- [ ] Add `waiver_criteria` CRUD (inline on waiver form)
- [ ] Add integration columns to discrepancies and obstruction_evaluations tables

### Phase 2: Annual Review & Alerts (Weeks 4-5)
**Goal:** Annual review workflow and expiration tracking

- [ ] Build annual review dashboard page
- [ ] Build per-waiver review form
- [ ] Implement expiration date auto-calculation for temporary waivers
- [ ] Add `next_review_due` auto-calculation
- [ ] Build in-app alert indicators (dashboard badges, waiver card badges)
- [ ] Create Supabase Edge Function for email notifications
- [ ] Add review history tab to waiver detail view

### Phase 3: Attachments (Weeks 6-7)
**Goal:** Photo and document management

- [ ] Create `waiver-attachments` Supabase Storage bucket
- [ ] Build attachment upload component (camera + file picker)
- [ ] Build photo grid with lightbox viewer
- [ ] Build document list with download capability
- [ ] Implement file type categorization (photo, site map, risk assessment, etc.)
- [ ] Add attachment tab to waiver detail view

### Phase 4: Excel Export & Reporting (Week 8)
**Goal:** Appendix B format export and Reports module integration

- [ ] Build Excel export Edge Function (Appendix B format)
- [ ] Add export button to dashboard and annual review pages
- [ ] Integrate waiver summary data into Reports module
- [ ] Add waiver counts/status to Daily Operations Report

### Phase 5: Polish & Enhancement (Weeks 9-10)
**Goal:** Coordination tracking, offline access, and refinement

- [ ] Build coordination tracking UI (Item 6 of AF Form 505)
- [ ] Implement PWA caching for offline read access
- [ ] Add linked items tab (discrepancies, obstruction evals, NOTAMs)
- [ ] Performance optimization and mobile UX refinement
- [ ] User acceptance testing

---

## 8. Open Questions for Chris

1. **Role-based access:** Should all Glidepath users at an installation see waivers, or limit to specific roles (AM, CE, Safety)? Current thinking: all users can view, editors/admins can create/edit.

2. **Waiver numbering preference:** Should Selfridge's existing VGLZ-format numbers be imported as-is, with the new AFCEC standard format used going forward? Or keep both options available indefinitely?

3. **Coordination signatures:** Full digital signature workflow (each office signs in-app) or simplified status tracking (AM manually marks "CE coordinated on [date]")?

4. **Historical data import:** Do you want a bulk import capability to load existing waivers from Excel/PowerPoint, or will they be entered manually?

5. **Offline depth:** Read-only offline access to waiver list and details, or also need offline photo capture that syncs later?

6. **NOTAM integration:** Should the system track which NOTAMs are associated with each waiver, or is that handled separately in the existing workflow?

---

## 9. Technical Notes

- **Stack:** Next.js + TypeScript + Supabase (consistent with existing Glidepath architecture)
- **Storage:** Supabase Storage for attachments (same pattern as `regulation-pdfs` bucket)
- **Export:** SheetJS (xlsx) for client-side or ExcelJS for server-side Excel generation
- **Offline:** Service Worker + IndexedDB cache of waiver data for PWA offline support
- **Search:** Supabase full-text search on description, justification, corrective_action fields

---

*This plan is a living document. Updates will be made as requirements are refined and development progresses.*
