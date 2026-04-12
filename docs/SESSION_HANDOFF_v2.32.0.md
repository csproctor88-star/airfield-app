# Session Handoff — Glidepath v2.32.0

**Date:** 2026-04-11
**Branch:** `tweaks`
**Build:** Clean (zero errors)

---

## What Was Done This Session

### Infrastructure & Parking Performance
- All feature layers hidden on load (user selects which to view)
- Lighting Status panel collapsible (hidden by default)
- Compact header for more mobile map space
- Split monolithic render effect into 4 independent layers (geometry, aircraft, zoom, selection)
- Zoom rescaling via idle event (not zoom_changed) — no flicker
- Position-only fast path for drag completion
- Throttled drag distance labels (80ms)
- Parking page reverted to Mapbox for correct silhouette scaling
- computeIconScale fixed: divide by svgDrawW + 1.03 overcompensation
- Silhouette disclaimer in Settings tab
- Fractional zoom enabled on all Google Maps
- Heading input fix — allows clearing field to type new value

### Airfield Status Layout
- Section-based row layout (Runway, NAVAID, ARFF sections in card containers)
- Sections side-by-side on desktop, stacked on mobile
- Custom status boards assignable to sections (migration 2026040700)
- Editable section headers and NAVAID group names (migration 2026040701)
- Personnel "Mark Completed" button wrapping fix

### Dashboard
- Centered inspection status strip and quick action buttons
- Buttons enlarged (52px min-height, no maxWidth cap)
- Removed New Entry / Use Template buttons
- "View All Recent Activity" links to dedicated page
- Recent Activity unified feed (activity_log + discrepancies + checks + inspections + QRCs + wildlife)
- Edit/Del buttons: admins on all entries, non-admins on their own activity_log entries
- Synthetic entry deletion routes to correct source table

### Personnel Templates
- AMOPS role added to create/edit permissions
- Template editing with inline form
- Race condition fix (read-then-write)
- Delete restricted to admins only

### AFM Out of Office
- Dashboard toggle with editable message
- Semi-transparent sticky banner on Airfield Status (minimizable)
- Command Post initials required on activate/deactivate
- Events log entries on both actions
- Realtime push via airfield_status table (migration 2026040800)
- AMOPS users can toggle

### Ruler Tool
- Google Maps ruler hook (mousedown/mouseup on map div)
- Added to parking page and obstruction evaluation
- NOTAM Reference on obstruction eval (NM distance + bearing from threshold)

### Base Setup
- Established Airfield Elevation field (auto-populated from ICAO import)
- Editable runway data (inline edit form for all fields)
- Editable installation name (click to rename in header)
- Full base directory (155 bases) in invite user modal

### Inspections
- Removed resume activity log entry
- Mobile draft persistence fix (synchronous save in state updater)
- Draft orphan deletion fix (don't delete if localStorage has data)
- Resume button respects localStorage over empty DB draft
- Immediate photo upload on capture (persists across navigation)
- Uploaded photo count badge on resumed items
- Photo toast count fix

### Customer Feedback Module (NEW)
- Public form at /feedback/[baseId] (no auth, QR code accessible)
- Configurable fields (text, textarea, rating, yes/no, dropdown)
- Base Setup step 15 with QR code generation
- Feedback list page with stats (count, avg rating, distribution)
- Analytics card on Reports page
- Migration 2026040900

### Email System
- Branded templates: Approved, Info Needed, Rejected, Signup Pending
- Invite and Password Reset emails branded to match
- Non-DoD endorsement disclaimer on all emails + login page
- replyTo: info@glidepathops.com on all outgoing emails
- /api/user-emails (admin-authenticated) + /api/signup-email (public)

### Reports & Analytics
- Daily ops PDF action labels match events log (template labels, text inference)
- PPR entity label capitalized ("PPR" not "Ppr Entry")
- Demo analytics data seed script for KDMO

### UI/UX
- Dark mode text brightened (all 4 levels)
- Light mode badge fix (white text on colored backgrounds)
- Light mode cyan brightened (#0E7490 → #0891B2)
- Desktop content area widened (1400px max)
- Desktop font sizes scaled up (+1-4px across all tokens)
- Contact Support button (sidebar, More page, Settings)
- Wildlife heatmap reverted to Mapbox
- B-2 Spirit SVG replaced with clean silhouette
- Aircraft picker simplified (name + wingspan only)
- Video walkthrough script + transcripts (23 videos)

### Migrations Applied
- 2026040700 — custom_status_boards.section
- 2026040701 — bases.status_labels
- 2026040800 — afm_out_of_office on airfield_status
- 2026040900 — customer_feedback table + bases.feedback_form_config

---

## In Progress
- Multi-select aircraft in parking plan (box-select, shift+click, group operations)

---

## Current State

| Metric | Count |
|--------|-------|
| Branch | tweaks |
| Commits this session | ~60 |
| Build | Clean |
