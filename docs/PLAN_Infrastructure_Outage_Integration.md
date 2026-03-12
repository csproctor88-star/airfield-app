# Implementation Plan: Airfield Visual NAVAIDs Outage Tracking & Discrepancy Integration

**Date:** 2026-03-12
**Scope:** Integrate Airfield Visual NAVAIDs map with discrepancy workflow, implement DAFMAN 13-204v2 Table A3.1 allowable outage tracking, automated alerts, and NOTAM triggering.

---

## 1. Problem Statement

Today, airfield lighting outage tracking is done via a spreadsheet listing all lights/systems and their quantities. When lights go out, airfield managers must:
1. Manually count outages per system
2. Manually calculate if the outage exceeds the DAFMAN 13-204v2 allowable threshold
3. Manually determine what actions are required (NOTAM, notifications, turn-off)
4. Manually create discrepancies and track resolution

This is error-prone, slow, and disconnects the spatial data (infrastructure map) from the operational data (discrepancy log).

## 2. Solution Overview

Bridge the Airfield Visual NAVAIDs map and discrepancy system with three new capabilities:

1. **Per-feature operational status** — Each feature gets a status (Operational/Inoperative). Tapping a light on the map marks it out and **always** auto-creates a discrepancy.
2. **Lighting system definitions** — Group individual features into DAFMAN-defined systems (ALSF-1, SALS, per-taxiway edge lights, etc.) with sub-components. Track outage % at both the per-light and per-system level. Each taxiway/runway is its own system instance (e.g., "TWY A Edge Lights", "TWY B Edge Lights" — not a single "Taxiway Edge Lights").
3. **Automated outage compliance engine** — Compare current outages against DAFMAN Table A3.1 thresholds. Alert when approaching/exceeding limits. Show required actions (NOTAM, notifications, turn-off, waiver authority). Adjacent/consecutive lamp violations are identified.

### Module Rename
The current "Airfield Infrastructure" module (`/infrastructure`) will be renamed to **"Airfield Visual NAVAIDs"** throughout the application (nav labels, page title, route label in sidebar/bottom nav/More menu).

---

## 3. DAFMAN 13-204v2 Table A3.1 — Allowable Outage Data

The complete allowable outage chart extracted from Attachment 3. This becomes the seed data for the outage rules engine.

### 3.1 Approach Lighting Systems

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **ALSF-1** | Overall System | 15% | 1, 2, 3, 4 |
| | Pre-Threshold | 20% | 1, 2 |
| | Terminating Bar | 35% | 1, 2 |
| | 1,000 Foot Bar | 35% | 1, 2 |
| | Centerline Light Bar | 10% or 3 barrettes out (bar = out when 3+ lamps out of 5) | 1, 2 |
| | Sequenced Flashing Lights | 20% | 1, 2, 4 |
| **ALSF-2** | Overall System | 15% | 1, 2, 3, 4 |
| | 500 Foot Bar | 20% | 1, 2 |
| | 1,000 Foot Bar | 20% | 1, 2 |
| | Side Row Lights | 20% | 1, 2 |
| | Centerline Light Bar Inner 1500ft | 20% or 3 barrettes out | 1, 2 |
| | Centerline Light Bar Outer 1500ft | 20% or 3 barrettes out | 1, 2 |
| | Sequenced Flashing Lights | 20% | 1, 2, 4 |
| **SSALR** | Overall System | 15% | 1, 2, 3, 4 |
| | 1,000 Foot Bar | 30% | 1, 2 |
| | Centerline Light Bar | 20% or 1 barrette out | 1, 2 |
| | RAILs | 20% | 1, 2, 4 |
| **MALSR** | Overall System | 15% | 1, 2, 3, 4 |
| | 1,000 Foot Bar | 30% | 1, 2 |
| | Centerline Light Bar | 20% or 1 barrette out | 1, 2 |
| | RAILs | 20% | 1, 2, 4 |
| **SALS** | Overall System | 15% | 1, 2, 3 |
| | Pre-Threshold | 20% | 1, 2 |
| | Terminating Bar | 35% | 1, 2 |
| | 1,000 Foot Bar | 30% | 1, 2 |
| | Centerline Light Bar | 20% or 2 barrettes out | 1, 2 |

### 3.2 Runway Lighting

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **REIL** | — | None | 1, 2, 3, 4 |
| **Threshold Lights** | Overall (incl. Gated) | 25% (VFR/non-precision IFR); 10% (precision) | 1, 2, 3, 4 |
| **End Lights** | — | 25% | 1, 2, 3 |
| **Runway Edge Lights** | Overall | 15% | 1, 2, 3, 4 |
| **Runway Centerline Lights** | — | 10% or 4 consecutive | 1, 2, 3, 4 |
| **Touchdown Zone Lights** | — | 10% on either side or 2 adjacent bars | 1, 2, 3, 4 |
| **RDR Signs (Lighted)** | — | None | 1, 2 |

### 3.3 Taxiway Lighting

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **Taxiway Edge Lights** | — | 15% | 1, 2, 3 |
| **Taxiway Centerline Lights** | — | 10% (CAT III: denies ops below RVR 600) | 1, 2, 3, 4 |
| **Taxiway End Lights** | — | None | 1, 2 |
| **Elevated Runway Guard Lights** | — | 1 lamp out | 1, 2, 3 |
| **In-Pavement Runway Guard Lights** | — | 3 lamps out per location | 1, 2, 3 |
| **Stop Bar Lights** | — | 3 lamps out per location | 1, 2, 3 |
| **Taxiway Clearance Bar Lights** | — | 1 lamp out | 1, 2 |

### 3.4 Visual Glide Slope Indicators

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **PAPI** | — | 1 light per box | 1, 2, 3 |
| **CHAPI** | — | None | 1, 2, 3 |

### 3.5 Beacon, Obstruction, Wind, Signage

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **Rotating Beacon** | — | None | 1, 2 |
| **Fixed Obstruction Lights** | — | None (single globe); 1 lamp (double globe) | 1, 2, 5 |
| **Flashing Hazard Beacon** | — | None | 1, 2, 5 |
| **Rotating Hazard Beacon** | — | None | 1, 2, 5 |
| **Wind Cone** | — | Variable; must be illuminated for night use; must rotate freely | 1, 2 |
| **Airfield Signage** | — | Must be legible; illuminated for night use | 1, 2 |

### 3.6 EALS (Emergency Airfield Lighting System)

| System | Sub-Component | Allowable Outage | Notes |
|--------|--------------|-----------------|-------|
| **EALS** | Approach Lights | 25%; no 2 consecutive in same bar; 1 flasher | 1, 2, 3 |
| | Threshold | None | 1, 2, 3 |
| | End Lights | 1 lamp | 1, 2, 3 |
| | Runway Edge Lights | 15% | 1, 2, 3 |
| | PAPI | None | 1, 2, 3 |
| | Taxiway Edge Lights | 15% | 1, 2, 3 |
| | Obstruction Lights | None | 1, 2, 5 |

### 3.7 DAFMAN Notes — Required Actions When Outages Are Exceeded

| Note | Action |
|------|--------|
| **1** | Document discrepancy and issue appropriate NOTAM(s) |
| **2** | Notify Airfield Lighting (CE Electrical) |
| **3** | Turn off affected lighting system. Notify AFM, AOF/CC, OSS/CC, OG/CC (or equivalents). Installation Commander is waiver authority for up to 24 hours. MAJCOM/A3 is waiver authority for periods > 24 hours. Waiver authority may NOT be delegated. Civil aircraft operations prohibited; other DoD components prohibited unless approved by their respective waiver authority. |
| **4** | Notify TERPs to determine impact to instrument procedures; send NOTAMs accordingly |
| **5** | NOTAMs for unlit obstructions must contain specific attributes per FAAO JO 7930.2, 5-2-3 OBSTACLES, Items 5-10 |

---

## 4. Data Model

### 4.1 Modify `infrastructure_features` — Add Operational Status

```sql
ALTER TABLE infrastructure_features
  ADD COLUMN status TEXT NOT NULL DEFAULT 'operational'
  CHECK (status IN ('operational', 'inoperative'));

ALTER TABLE infrastructure_features
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN status_changed_by UUID REFERENCES profiles(id);
```

Binary status only (operational/inoperative). "Degraded" is a system-level concept derived from component outage percentages. No "maintenance" status — if a system is down for planned maintenance, it is inoperative with a NOTAM.

### 4.2 New Table: `lighting_systems` — System Definitions Per Base

```sql
CREATE TABLE lighting_systems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,  -- 'alsf1', 'alsf2', 'sals', 'ssalr', 'malsr', 'runway_edge', 'taxiway_edge', etc.
  name TEXT NOT NULL,         -- "ALSF-1 RWY 19", "TWY A Edge Lights", "TWY B Edge Lights"
  runway_or_taxiway TEXT,     -- "RWY 01/19", "TWY A", "TWY B", etc.
  is_precision BOOLEAN DEFAULT false,  -- Affects threshold light allowable (25% vs 10%)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_id, name)
);
```

**Important:** Each taxiway and runway is its own system instance. "TWY A Edge Lights" and "TWY B Edge Lights" are separate systems, each with their own outage thresholds applied independently. This matches how DAFMAN outage rules are applied in practice.

### 4.3 New Table: `lighting_system_components` — Sub-Components Within Systems

Each system has sub-components matching the DAFMAN chart rows. This is where features are grouped and outage thresholds are defined.

```sql
CREATE TABLE lighting_system_components (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES lighting_systems(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,  -- 'overall', 'pre_threshold', 'terminating_bar', '1000ft_bar', 'centerline_bar', 'sfls', 'edge_lights', etc.
  label TEXT NOT NULL,           -- "Centerline Light Bar", "1,000 Foot Bar", etc.
  total_count INT NOT NULL,      -- Total lights in this component (for % calculation)

  -- Outage rules from DAFMAN Table A3.1
  allowable_outage_pct NUMERIC,         -- e.g., 15, 20, 25, 35 (NULL = use count only)
  allowable_outage_count INT,           -- e.g., 3 for "3 barrettes out" (NULL = use pct only)
  allowable_outage_consecutive INT,     -- e.g., 4 for "4 consecutive lights" (NULL = no consecutive rule)
  allowable_no_adjacent BOOLEAN DEFAULT false, -- TRUE = "no 2 adjacent lamps out" rule applies
  allowable_outage_text TEXT,           -- Full DAFMAN text: "10% or 3 Barrettes out (5 lamp bar is considered out when three or more lamps are out)"
  is_zero_tolerance BOOLEAN DEFAULT false, -- TRUE for "None" allowable outage (REIL, obstruction, beacon, etc.)

  -- Required actions (DAFMAN Notes 1-5)
  requires_notam BOOLEAN DEFAULT true,          -- Note 1
  requires_ce_notification BOOLEAN DEFAULT true, -- Note 2
  requires_system_shutoff BOOLEAN DEFAULT false,  -- Note 3
  requires_terps_notification BOOLEAN DEFAULT false, -- Note 4
  requires_obstruction_notam_attrs BOOLEAN DEFAULT false, -- Note 5

  -- NOTAM template
  q_code TEXT,              -- e.g., "QLAAS", "QLEAS"
  notam_text_template TEXT, -- e.g., "Approach Lighting System (Specify Runway and Type) Unserviceable"

  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Supports cloning: when setting up a new base that also has an ALSF-1, the admin can clone component definitions from another base's ALSF-1 system, then adjust `total_count` to match local feature counts.

### 4.4 Link Features to Components

```sql
ALTER TABLE infrastructure_features
  ADD COLUMN system_component_id UUID REFERENCES lighting_system_components(id) ON DELETE SET NULL;
```

Each individual light is assigned to its system component. The existing `layer` and `feature_type` fields provide a natural mapping for bulk assignment during setup.

### 4.5 Link Discrepancies to Infrastructure Features

```sql
ALTER TABLE discrepancies
  ADD COLUMN infrastructure_feature_id UUID REFERENCES infrastructure_features(id) ON DELETE SET NULL,
  ADD COLUMN lighting_system_id UUID REFERENCES lighting_systems(id) ON DELETE SET NULL;
```

**Every outage creates a discrepancy.** When a feature is marked inoperative:
- A `lighting` type discrepancy is **always** auto-created, linked to the feature and its parent system
- The discrepancy is assigned to Airfield Management for verification of repair
- The discrepancy auto-logs to the Events Log (via existing `logActivity()`)
- The infrastructure map shows which features have open discrepancies

### 4.6 New Table: `outage_events` — Outage History Log

```sql
CREATE TABLE outage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES infrastructure_features(id) ON DELETE CASCADE,
  system_component_id UUID REFERENCES lighting_system_components(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('reported', 'resolved')),
  reported_by UUID REFERENCES profiles(id),
  discrepancy_id UUID REFERENCES discrepancies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Outage events are logged both here (for structured queries/timeline) and via the auto-created discrepancy → Events Log (for the standard audit trail).

---

## 5. Outage Compliance Engine

### 5.1 Core Calculation

For each `lighting_system_component`:

```typescript
type OutageStatus = {
  componentId: string
  componentLabel: string
  totalCount: number
  inoperativeCount: number
  outagePct: number
  allowablePct: number | null
  allowableCount: number | null
  isZeroTolerance: boolean
  isExceeded: boolean
  isApproaching: boolean  // within 1 light or 5% of threshold
  hasAdjacentViolation: boolean  // 2+ adjacent inoperative features detected
  hasConsecutiveViolation: boolean // consecutive count exceeded
  requiredActions: {
    notam: boolean
    notifyCE: boolean
    systemShutoff: boolean
    notifyTerps: boolean
    obstructionNotamAttrs: boolean
  }
  notamTemplate: string | null
}
```

**Calculation logic:**
```
inoperativeCount = COUNT features WHERE system_component_id = X AND status = 'inoperative'
totalCount = component.total_count
outagePct = (inoperativeCount / totalCount) * 100

isExceeded =
  (isZeroTolerance AND inoperativeCount > 0) OR
  (allowablePct IS NOT NULL AND outagePct > allowablePct) OR
  (allowableCount IS NOT NULL AND inoperativeCount > allowableCount) OR
  (allowable_no_adjacent AND hasAdjacentViolation) OR
  (allowable_outage_consecutive IS NOT NULL AND hasConsecutiveViolation)

isApproaching =
  NOT isExceeded AND (
    (allowablePct IS NOT NULL AND outagePct >= allowablePct - 5) OR
    (allowableCount IS NOT NULL AND inoperativeCount >= allowableCount)
  )
```

### 5.2 Adjacent/Consecutive Lamp Detection

For components with `allowable_no_adjacent = true` or `allowable_outage_consecutive IS NOT NULL`:

Features within a component are ordered by their position (using geodesic distance from a reference point or explicit `sort_order` on the feature). Two features are "adjacent" if they are sequential in this ordering with no operational feature between them.

```typescript
function detectAdjacentViolation(features: InfrastructureFeature[]): boolean {
  const sorted = sortByPosition(features) // sort by lat/lon along the bar/line
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].status === 'inoperative' && sorted[i + 1].status === 'inoperative') {
      return true // two adjacent inoperative
    }
  }
  return false
}

function detectConsecutiveViolation(features: InfrastructureFeature[], maxConsecutive: number): boolean {
  const sorted = sortByPosition(features)
  let streak = 0
  for (const f of sorted) {
    if (f.status === 'inoperative') {
      streak++
      if (streak > maxConsecutive) return true
    } else {
      streak = 0
    }
  }
  return false
}
```

### 5.3 System-Level Rollup

```typescript
type SystemHealth = {
  systemId: string
  systemName: string
  systemType: string
  status: 'operational' | 'degraded' | 'exceeded' | 'inoperative'
  components: OutageStatus[]
  totalFeatures: number
  inoperativeFeatures: number
  overallOutagePct: number
  worstComponent: OutageStatus | null
  exceededComponents: OutageStatus[]
  approachingComponents: OutageStatus[]
}

// Status derivation:
// 'operational' = no outages
// 'degraded' = outages exist but all within allowable limits
// 'exceeded' = one or more components exceed allowable limits → ACTION REQUIRED
// 'inoperative' = overall system exceeds its overall threshold
```

### 5.4 Alert Tiers

| Tier | Condition | UI Treatment | Actions |
|------|----------|-------------|---------|
| **Green** | All components within limits | Green status badge, no alerts | None |
| **Yellow** | Any component approaching threshold (within 1 light or 5%) | Yellow badge, warning banner | "Approaching limit — monitor closely" |
| **Red** | Any component exceeds threshold | Red badge, action required banner | Full DAFMAN Notes display (NOTAM, CE notification, system shutoff, TERPs, etc.) |
| **Black** | Overall system exceeds threshold | Black/red badge, critical banner | All of the above + "System must be turned off per DAFMAN 13-204v2" |

---

## 6. User Workflows

### 6.1 Reporting an Outage (Primary Flow)

**From the Airfield Visual NAVAIDs Map:**
1. User navigates to `/infrastructure` (renamed "Airfield Visual NAVAIDs")
2. User taps a feature (light/sign) on the map
3. Popup shows feature details + current status
4. User taps **"Report Outage"** button
5. Feature status changes to `inoperative`, `status_changed_at` = now, `status_changed_by` = user
6. An `outage_event` record is created (type: 'reported')
7. A `lighting` type discrepancy is **always** auto-created:
   - Title: "[System Name] — [Feature Label] Inoperative"
   - Type: `lighting`
   - Assigned shop: Airfield Management (for verification of repair)
   - Linked to feature and system via FKs
   - Auto-logged to Events Log
8. System immediately recalculates the component's outage status
9. If threshold is **exceeded**:
   - Red alert banner appears with DAFMAN-required actions
   - Displays: "NOTAM REQUIRED — [Q-code template text]" (copyable)
   - Displays notification checklist (CE, AFM, AOF/CC, OSS/CC, OG/CC, TERPs as applicable)
   - If Note 3 applies: "System must be turned off. Installation Commander waiver authority for ≤24 hrs. MAJCOM/A3 for >24 hrs."
   - If Note 5 applies: "NOTAM must include obstruction attributes per FAAO JO 7930.2"
10. If threshold is **approaching**:
    - Yellow warning: "ALSF-1 Centerline Bars: 2 of 3 allowable outages used (67%)"

**From the Discrepancy Form:**
1. User creates a new discrepancy with type "Lighting Outage/Deficiency"
2. New optional field: **"Link to Visual NAVAID"**
   - Opens a mini map picker
   - User taps the affected feature(s)
   - Selected features are marked inoperative
   - Discrepancy is linked to feature(s) and system

**From Daily Inspection / Airfield Check:**
1. User identifies a lighting issue during inspection
2. Existing "Log as Discrepancy" workflow remains
3. New option: **"Link to Visual NAVAID"** on the discrepancy panel
4. Same mini map picker as above

### 6.2 Resolving an Outage

1. CE Electrical completes repair
2. Airfield Management verifies the repair
3. User goes to the Airfield Visual NAVAIDs map → taps the inoperative feature (shown in red)
4. Taps **"Mark Operational"**
5. Feature status changes to `operational`
6. An `outage_event` record is created (type: 'resolved')
7. System recalculates component outage status
8. Linked discrepancy is prompted for closure: "Close linked discrepancy [DIS-XXX]?"
9. If system returns to within limits, green status badge restored
10. Activity log entry created

**OR from the Discrepancy:**
1. User closes the discrepancy (existing workflow)
2. If discrepancy is linked to infrastructure feature(s):
   - Prompt: "Mark linked Visual NAVAID features as operational?"
   - If yes, all linked features restored to operational

### 6.3 Bulk Outage Reporting

For scenarios like "entire approach lighting system is dark":
1. User selects the system from a dropdown (or uses box-select on map)
2. All features in the selected system/component are marked inoperative
3. Single discrepancy created for the system (assigned to Airfield Management)
4. Full DAFMAN action checklist displayed

### 6.4 System Health Panel

Displayed on both the **Airfield Visual NAVAIDs page** (full detail) and the **Dashboard** (summary badge/KPI).

**Full detail (infrastructure page):**
```
┌─────────────────────────────────────────────────┐
│  LIGHTING SYSTEM STATUS                         │
├─────────────────────────────────────────────────┤
│  ● ALSF-1 RWY 19        DEGRADED    2/87 out   │
│    ├ Centerline Bars     ⚠ WARNING   2/24 (8%)  │
│    │   → 1 more outage = exceeds 10% limit      │
│    ├ Terminating Bar     ✓ OK        0/6        │
│    ├ 1,000ft Bar         ✓ OK        0/11       │
│    ├ Pre-Threshold       ✓ OK        0/5        │
│    └ SFLs                ✓ OK        0/21       │
│                                                 │
│  ● SALS RWY 01           OPERATIONAL 0/30       │
│  ● RWY 01/19 Edge Lights OPERATIONAL 0/98       │
│  ● TWY A Edge Lights     OPERATIONAL 0/47       │
│  ● TWY B Edge Lights     OPERATIONAL 0/32       │
│  ● TWY K Edge Lights     OPERATIONAL 0/28       │
│  ● PAPI RWY 19           OPERATIONAL 0/4        │
│  ● PAPI RWY 01           OPERATIONAL 0/4        │
│  ● Obstruction Lights    ✓ OK        0/12       │
│  ● Windcone              ✓ OK        0/1        │
└─────────────────────────────────────────────────┘
```

Each row is clickable → expands to show sub-components, outage details, and linked discrepancies.

**Dashboard summary:** KPI badge showing system count with worst status color. Clickable to open detail dialog or navigate to the Visual NAVAIDs page.

### 6.5 Map Visualization

On the map, inoperative features are visually distinct:
- **Operational**: Normal icon (current behavior)
- **Inoperative**: Red circle overlay or red "X" overlay on the icon
- **System Exceeded**: All features in the exceeded system get a pulsing red border

Filter controls:
- Toggle: "Show outages only" — filters map to only inoperative features
- Color-code by system health (green/yellow/red)

---

## 7. NOTAM Integration

When an outage exceeds the allowable threshold and Note 1 applies:

1. **Alert banner** appears: "NOTAM REQUIRED"
2. Banner includes the Q-code and pre-filled NOTAM text from the DAFMAN template
3. NOTAM text is **copyable** — NOTAMs are published outside the application, but the template helps users view and copy the correct verbiage
4. When the outage is resolved, the app alerts: "NOTAM may need to be cancelled"

The app does NOT auto-publish NOTAMs — it alerts and provides the template for the user to copy into external NOTAM systems.

---

## 8. Notification System

Based on DAFMAN Notes 2-4, the app determines who needs to be notified. Notifications are **in-app only** (banner + activity log + checklist in the outage alert).

### Notification Matrix

| Note | Who | Trigger |
|------|-----|---------|
| 2 | CE Electrical (Airfield Lighting) | Any outage exceeding allowable |
| 3 | AFM, AOF/CC, OSS/CC, OG/CC | System shutoff required |
| 4 | TERPs | Impact to instrument procedures (approach lights, REIL, centerline, TDZ) |

### Implementation

The notification is displayed as a checklist in the outage alert:

```
┌──────────────────────────────────────────────────┐
│  ⛔ OUTAGE EXCEEDS ALLOWABLE LIMIT               │
│  ALSF-1 RWY 19 — Centerline Bars: 4/24 out (17%)│
│  Allowable: 10% or 3 barrettes (DAFMAN Table A3.1)│
│                                                  │
│  REQUIRED ACTIONS:                               │
│  ☐ Issue NOTAM (QLAAS — Approach Lighting System │
│    Centerline Lights RWY 19 Unserviceable) [Copy]│
│  ☐ Notify CE Electrical / Airfield Lighting      │
│  ☐ Notify TERPs — may impact instrument procs    │
│                                                  │
│  Discrepancy DIS-0147 auto-created               │
│  Assigned to: Airfield Management                │
└──────────────────────────────────────────────────┘
```

For Note 3 (system shutoff):

```
│  ⚠ SYSTEM SHUTOFF MAY BE REQUIRED               │
│  Waiver authority: Installation Commander (≤24hr)│
│  MAJCOM/A3 for >24 hours                        │
│  Civil aircraft operations PROHIBITED            │
```

---

## 9. Database Migrations

### Migration 1: `2026031200_add_feature_status.sql`
- Add `status`, `status_changed_at`, `status_changed_by` to `infrastructure_features`

### Migration 2: `2026031201_create_lighting_systems.sql`
- Create `lighting_systems` table
- Create `lighting_system_components` table (with `allowable_no_adjacent` column)
- Add `system_component_id` FK to `infrastructure_features`

### Migration 3: `2026031202_link_discrepancies_to_infrastructure.sql`
- Add `infrastructure_feature_id` and `lighting_system_id` FKs to `discrepancies`

### Migration 4: `2026031203_create_outage_events.sql`
- Create `outage_events` audit table

### Migration 5: `2026031204_seed_outage_rule_templates.sql`
- Create `outage_rule_templates` table with all DAFMAN Table A3.1 entries
- Used as a source for cloning when setting up new bases

### Migration 6: `2026031205_rls_lighting_systems.sql`
- RLS policies for `lighting_systems`, `lighting_system_components`, `outage_events`

---

## 10. File Changes

### New Files

| File | Purpose |
|------|---------|
| `lib/supabase/lighting-systems.ts` | CRUD for lighting_systems, components, outage calculations |
| `lib/outage-rules.ts` | DAFMAN Table A3.1 seed data as TypeScript constants + outage calculation engine |
| `components/infrastructure/outage-alert.tsx` | Red/yellow alert banner with DAFMAN required actions checklist |
| `components/infrastructure/system-health-panel.tsx` | Collapsible system health display with component breakdowns |
| `components/ui/infrastructure-picker.tsx` | Mini map modal for linking discrepancies to features |
| `supabase/migrations/2026031200-05` | 6 new migrations |

### Modified Files

| File | Changes |
|------|---------|
| `lib/supabase/types.ts` | Add LightingSystem, LightingSystemComponent, OutageEvent types |
| `lib/supabase/infrastructure-features.ts` | Add `updateFeatureStatus()`, `bulkUpdateStatus()` |
| `lib/supabase/discrepancies.ts` | Accept optional `infrastructure_feature_id` and `lighting_system_id` on create; auto-create from outage |
| `lib/constants.ts` | Add outage severity configs, system type configs |
| `app/(app)/infrastructure/page.tsx` | Rename to "Airfield Visual NAVAIDs", add status toggle, system health panel, outage visualization, alert banners |
| `app/(app)/discrepancies/new/page.tsx` | Add "Link to Visual NAVAID" field with infrastructure picker |
| `app/(app)/discrepancies/[id]/page.tsx` | Show linked infrastructure feature, outage context |
| `app/(app)/dashboard/page.tsx` | Add lighting system health KPI badge |
| `app/(app)/settings/base-setup/page.tsx` | Add lighting system setup section with clone support |
| `components/layout/sidebar-nav.tsx` | Rename "Infrastructure" → "Visual NAVAIDs" |
| `components/layout/bottom-nav.tsx` | Update label if infrastructure appears in bottom nav |

---

## 11. Implementation Phases

### Phase 1: Foundation (Database + Status)
1. Rename module to "Airfield Visual NAVAIDs" throughout the app
2. Create migrations for `status` column, `lighting_systems`, `lighting_system_components`, FKs
3. Add `updateFeatureStatus()` to infrastructure-features.ts
4. Add status toggle ("Report Outage" / "Mark Operational") to map popup
5. Visual indicator for inoperative features on map (red overlay)
6. Auto-create discrepancy on every outage report (assigned to Airfield Management)
7. Create `outage_events` table and logging

### Phase 2: System Definitions + Outage Engine
1. Create `lib/outage-rules.ts` with DAFMAN Table A3.1 seed data
2. Build `lib/supabase/lighting-systems.ts` CRUD module
3. Build system setup UI in Base Configuration (with clone-from-base support)
4. Implement outage calculation engine (percentage, count, adjacent, consecutive)
5. Build System Health Panel component
6. Seed Selfridge system definitions from existing feature data

### Phase 3: Alerts + Integration
1. Build Outage Alert Banner with DAFMAN required actions and copyable NOTAM template
2. Adjacent/consecutive lamp violation detection
3. Bidirectional resolution (close discrepancy ↔ restore feature, with Airfield Management verification)
4. "Link to Visual NAVAID" field on discrepancy create/edit forms
5. Infrastructure feature picker component (mini map modal)
6. Dashboard KPI badge for lighting system health

### Phase 4: Polish + Reporting
1. Outage history/timeline view per system
2. Daily Ops Report integration (include outage summary section)
3. Map visualization enhancements (system health color coding, "show outages only" filter)
4. Discrepancy detail page shows linked Visual NAVAID context

---

## 12. Selfridge-Specific System Definitions

Based on the existing infrastructure features in the database (1,305 features), the initial systems for KMTC/Selfridge would be:

| System | Type | Features | Components |
|--------|------|----------|------------|
| ALSF-1 RWY 19 | alsf1 | ~87 | Terminating Bar, Centerline Bars (8), 1000ft Bar, SFLs (21), Pre-Threshold |
| SALS RWY 01 | sals | ~30 | Terminating Bar, Centerline Bars (4), 1000ft Bar, SFLs (5) |
| RWY 01/19 Edge Lights | runway_edge | ~98 | Edge Lights |
| PAPI RWY 19 | papi | 4 | PAPI |
| PAPI RWY 01 | papi | 4 | PAPI |
| TWY A Edge Lights | taxiway_edge | ~47 | Edge Lights |
| TWY B Edge Lights | taxiway_edge | ~32 | Edge Lights |
| TWY K Edge Lights | taxiway_edge | ~28 | Edge Lights |
| Threshold Lights RWY 01 | threshold | ~TBD | Threshold Lights |
| Threshold Lights RWY 19 | threshold | ~TBD | Threshold Lights |
| Obstruction Lights | obstruction | ~12 | Fixed/Flashing |
| REIL RWY 19 | reil | 2 | REIL |
| Airfield Signs | signage | ~200+ | Various |

These would be configured during Phase 2 via the Base Configuration UI or a setup wizard.

---

## 13. Key Design Decisions

1. **Binary feature status (operational/inoperative)** — No "degraded" or "maintenance" status at the feature level. Degradation is a system-level concept. This keeps the tap-to-toggle UX simple and the math clean.

2. **Explicit system-component-feature hierarchy** — Rather than deriving system membership from `layer`/`feature_type`, we use explicit `system_component_id` FKs. Each taxiway is identified separately (TWY A, TWY B, etc.) because that is how outage rules are applied — not "Taxiway Edge Lights" as a whole.

3. **Outage rules stored in the database, not hardcoded** — Each base can have custom thresholds if their MAJCOM has different guidance. Defaults seeded from DAFMAN Table A3.1. Supports cloning between bases.

4. **NOTAM alert with copyable template, not auto-publish** — NOTAMs are published outside the application. The app tells the user a NOTAM is required, displays the Q-code and template text, and makes it easy to copy.

5. **Discrepancies always created on outage** — Every feature marked inoperative auto-creates a `lighting` type discrepancy assigned to Airfield Management for verification of repair. This ensures full audit trail and integrates with the existing discrepancy workflow.

6. **Outage events as structured audit trail** — In addition to the auto-created discrepancy logging to the Events Log, the `outage_events` table provides structured data (feature ID, component ID, timestamps) for timeline queries and reporting.

7. **Adjacent/consecutive detection** — Features within a component are ordered by position. The engine detects adjacent and consecutive inoperative features for components where the DAFMAN specifies spatial rules ("no 2 adjacent lamps out", "4 consecutive lights").

---

*This plan implements DAFMAN 13-204v2 Attachment 3, Table A3.1 allowable outage tracking with full regulatory compliance alerting.*
