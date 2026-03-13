# Glidepath Capability Deep Dive: Real-Time Airfield Operations

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's real-time operational modules — the features an airfield manager interacts with the moment they start their shift. This is the heartbeat of the application: live status, weather, runway conditions, NAVAIDs, and personnel tracking.

---

## The Airfield Status Page — Your Common Operating Picture

When you open Glidepath, the first thing you see is the Airfield Status page. Think of it as your airfield's vital signs on a single screen.

### Active Runway
The current active runway is displayed prominently with its designation (e.g., "18/36"). Runway Surface Condition and Runway Condition Reading values are shown alongside. Changing the active runway is a single tap — toggle the new runway from the active runway status box, and every connected device updates in real-time. The change is logged in the Events Log with the operator's identity and timestamp in Zulu time.

### Bird Watch Condition (BWC)
The current BWC level is displayed with color-coded severity: LOW (green), MODERATE (amber), SEVERE (red), PROHIBIT (red). Changing the BWC is a single tap — select the new level and it pushes to all connected devices instantly. Every BWC change is logged.

### Weather Advisories
Active weather advisories, warnings, and watches are displayed in a dedicated section. Airfield managers can share critical weather information (watches, warnings, or advisories) with free-text descriptions. Active advisories show prominently; completed advisories are archived. Adding or completing an advisory is logged in the Events Log.

### NAVAID Status
All NAVAIDs for the installation are listed with their current status (operational or out of service). Toggling a NAVAID's status is a single tap. The change pushes in real-time and is logged with Zulu timestamp.

### Personnel on Airfield
Active contractors and personnel working on the airfield are displayed as individual cards. Each card shows:
- **Company name** and **contact person**
- **Location** on the airfield (e.g., "Taxiway Bravo," "Runway 18 threshold")
- **Work description** (what they're doing)
- **Radio callsign** (how to reach them)
- **Flag indicator** (meetings vehicle identification requirements from DAFI 13-213 and UFC 3-260-01)
- **Status badge** (active/completed)
- **Day counter** (how many days they've been active)

Adding personnel is a quick form — company, contact, location, work, radio callsign. Mark them complete with one tap when they depart. Adding and completing personnel actions are logged in the Events Log.

### Construction/Misc Items
Active construction projects and miscellaneous items are tracked separately from personnel. These provide awareness of ongoing activities that affect airfield operations without cluttering the personnel view.

---

## The Dashboard — Operational Intelligence

The Dashboard provides a different lens than the Status page. While Status shows current conditions, the Dashboard shows activity and trends.

### Quick Actions
Start new checks and inspections directly from the dashboard. One-tap access to FOD check, RSC/RCR check, airfield inspection, lighting inspection, and more.

### Activity Feed
The most recent operational events scroll in a live feed. New checks filed, inspections completed, discrepancies created, status changes — all visible as they happen. Each entry shows the action, the entity, the operator's operating initials, and the Zulu timestamp.

### User Presence
See who's currently online across your installation. User avatars or initials show active users, giving you awareness of who's working in the system.

### Installation Switcher
Users with access to multiple installations can switch between them instantly. The entire application context changes — different runways, different areas, different discrepancies, different history. All data is isolated by installation through Row-Level Security.

---

## Real-Time Architecture

Glidepath doesn't poll for updates — it receives them instantly. Three database tables are configured with Supabase Realtime subscriptions:

1. **Airfield Status** — Any UPDATE to runway conditions, BWC, advisories, or NAVAIDs pushes to all connected clients immediately
2. **Airfield Checks** — Any new check INSERT appears on dashboards without refresh
3. **Inspections** — Any new inspection INSERT appears on dashboards without refresh

This means if one airfield manager updates the BWC from their phone in the tower, every other user on their laptop in the office sees the change within seconds. No refresh needed. No delay.

---

## Why This Matters for Airfield Managers

### Before Glidepath
- Runway condition changes communicated by radio or phone call, then manually logged
- BWC updates require calling multiple offices individually
- Personnel on the airfield tracked on a whiteboard or paper log
- No single source of truth — information scattered across radio logs, spreadsheets, and memory
- Shift turnover requires verbal briefing or reading handwritten notes
- Weather advisory history lost after shift change

### With Glidepath
- Runway changes propagate to every screen instantly — one tap, everyone knows
- BWC updates visible enterprise-wide the moment they're set
- Personnel tracking is searchable, timestamped, and persistent
- Complete operational picture accessible from any device, anywhere
- Shift turnover is seamless — the next shift sees exactly what's happening
- Full advisory history maintained and searchable
- Every status change logged with who, what, and when — creating an automatic ops log

### Time Impact
A conservative estimate: airfield managers spend 30–45 minutes per shift communicating status changes via phone, radio, and manual logging. Glidepath reduces this to seconds per change with automatic propagation and logging. Across three shifts per day, that's 1.5–2+ hours of recovered operational time — every day.

---

*Glidepath v2.17.0 — Real-time operations for real airfield managers*
