# Base Onboarding Guide

How to configure a new military installation in Glidepath. You have two options:
use the **Admin UI** (Settings > Base Setup), or seed data directly via **SQL**.
Both are covered below.

---

## Option A: Admin UI (Recommended for most users)

1. **Create the installation** — Go to **Settings > Installation > Change Installation** and either select from the directory or click **+ Add New Installation**. Enter the full name and ICAO code.

2. **Add runways** — Go to **Settings > Base Setup > Runways** tab. Click **+ Add Runway** and fill in:
   - Runway ID (e.g. `01/19`)
   - Runway Class (`B` or `Army Class B`)
   - Length and width in feet
   - True heading
   - Surface type
   - Both endpoint coordinates (latitude/longitude) and designators

3. **Add NAVAIDs** — Go to the **NAVAIDs** tab. Type each NAVAID name and click **Save**. These will appear on the dashboard for status tracking. Common examples:
   - `ILS 01` / `ILS 19`
   - `TACAN`
   - `ASR-9`
   - `01 Localizer` / `01 Glideslope`
   - `19 REILs`

4. **Add airfield areas** — Go to the **Areas** tab. Add each area your team inspects during checks. Examples:
   - `RWY 01/19`
   - `TWY A`, `TWY B`, `TWY K`
   - `East Ramp`, `West Ramp`
   - `North Hammerhead`, `South Hammerhead`
   - `Perimeter Road`

5. **Add CE shops** — Go to the **CE Shops** tab. Add each Civil Engineering shop that handles airfield work orders. Examples:
   - `Electrical`
   - `Pavements`
   - `Structures`

6. **Initialize inspection templates** — Go to the **Templates** tab and click **Initialize from Default Template**. This clones the Selfridge checklist as a starting point. Then go to **Settings > Manage Templates** to customize sections and items for your base.

7. **Verify** — Click **Preview Dashboard** at the bottom of the Base Setup page to confirm NAVAIDs, areas, and templates are all populated.

---

## Option B: SQL Seed Script

For sys admins who prefer direct database access or need to onboard multiple bases at once. Run this against your Supabase database (SQL Editor or `psql`).

### Step 1: Create the base record

```sql
INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
VALUES (
  gen_random_uuid(),          -- or a specific UUID if you want to reference it later
  'Fort Campbell Army Airfield',
  'KHOP',
  '101st Airborne Division',
  'U.S. Army',
  'Fort Campbell, Kentucky',
  573,                        -- field elevation in feet MSL
  'America/Chicago',
  ARRAY['Electrical', 'Pavements', 'Structures']
)
RETURNING id;
-- Save this UUID — you'll need it for all subsequent inserts
```

### Step 2: Add runways

```sql
-- Replace {BASE_ID} with the UUID from step 1
INSERT INTO base_runways (
  base_id, runway_id, runway_class, length_ft, width_ft, surface,
  true_heading,
  end1_designator, end1_latitude, end1_longitude,
  end2_designator, end2_latitude, end2_longitude
) VALUES (
  '{BASE_ID}',
  '05/23',
  'Army_B',          -- 'B' for Air Force Class B, 'Army_B' for Army Class B
  11,800,
  150,
  'Asphalt',
  50.0,
  '05', 36.66889, -87.49639,
  '23', 36.66028, -87.47278
);
```

**Where to find runway data:**
- [AirNav.com](https://www.airnav.com) — search by ICAO, has coordinates, dimensions, headings
- [SkyVector.com](https://skyvector.com) — airport diagrams
- FAA Airport/Facility Directory (d-TPP)
- Your base's airfield diagram or AIP entry

### Step 3: Add NAVAIDs

```sql
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  ('{BASE_ID}', 'ILS 05', 0),
  ('{BASE_ID}', 'TACAN', 1),
  ('{BASE_ID}', 'ASR-9', 2),
  ('{BASE_ID}', '05 PAPI', 3),
  ('{BASE_ID}', '23 PAPI', 4);

-- Also create navaid_statuses entries so they appear on the dashboard
INSERT INTO navaid_statuses (navaid_name, base_id, status) VALUES
  ('ILS 05', '{BASE_ID}', 'green'),
  ('TACAN', '{BASE_ID}', 'green'),
  ('ASR-9', '{BASE_ID}', 'green'),
  ('05 PAPI', '{BASE_ID}', 'green'),
  ('23 PAPI', '{BASE_ID}', 'green');
```

**Common NAVAID types:**
| NAVAID | Description |
|--------|-------------|
| ILS {RWY} | Instrument Landing System (localizer + glideslope) |
| {RWY} Localizer | Localizer only (no glideslope) |
| {RWY} Glideslope | Glideslope component |
| TACAN | Tactical Air Navigation (military DME/azimuth) |
| VORTAC | Combined VOR/TACAN |
| ASR-{N} | Airport Surveillance Radar |
| PAR | Precision Approach Radar (GCA) |
| {RWY} PAPI | Precision Approach Path Indicator |
| {RWY} REILs | Runway End Identifier Lights |
| {RWY} MALSR | Medium-intensity Approach Lighting |
| {RWY} SALS | Short Approach Lighting System |

### Step 4: Add airfield areas

```sql
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ('{BASE_ID}', 'RWY 05/23', 0),
  ('{BASE_ID}', 'TWY A', 1),
  ('{BASE_ID}', 'TWY B', 2),
  ('{BASE_ID}', 'TWY C', 3),
  ('{BASE_ID}', 'Main Apron', 4),
  ('{BASE_ID}', 'North Ramp', 5),
  ('{BASE_ID}', 'South Ramp', 6),
  ('{BASE_ID}', 'Helicopter Pad', 7),
  ('{BASE_ID}', 'Perimeter Road', 8),
  ('{BASE_ID}', 'Overruns', 9),
  ('{BASE_ID}', 'Arm/De-Arm Pad', 10),
  ('{BASE_ID}', 'Hot Cargo Pad', 11);
```

**Typical airfield areas to include:**
- Each runway (e.g. `RWY 05/23`)
- Each taxiway (e.g. `TWY A`, `TWY B`)
- Ramp/apron areas (e.g. `East Ramp`, `West Ramp`, `Transient Ramp`)
- Hammerhead/turnaround areas
- Arm/de-arm pads, hot cargo pads
- Overrun areas
- Perimeter/access roads
- Helicopter pads (if applicable)

### Step 5: Add user membership

```sql
-- Link a user (by their profile UUID) to this base
INSERT INTO base_members (base_id, user_id, role) VALUES
  ('{BASE_ID}', '{USER_ID}', 'airfield_manager');

-- Also update their primary base
UPDATE profiles SET primary_base_id = '{BASE_ID}' WHERE id = '{USER_ID}';
```

**Available roles:**
| Role | Access |
|------|--------|
| `read_only` | View-only access |
| `airfield_ops` | Can file inspections, checks, discrepancies |
| `airfield_manager` | Full ops + manage templates, base config |
| `sys_admin` | Everything + multi-base management |

### Step 6: Initialize inspection templates

The easiest approach is to use the **Admin UI** (Settings > Manage Templates > Initialize from Default Template). This clones Selfridge's complete 74-item checklist.

To do it via SQL, use the clone function by calling the app:
1. Log in as the new base's admin
2. Navigate to Settings > Base Setup > Templates
3. Click "Initialize from Default Template"

Or manually insert templates — see the seed data in `supabase/migrations/20260224_inspection_templates.sql` for the complete Selfridge template as a reference.

### Step 7: Initialize airfield status

```sql
INSERT INTO airfield_status (base_id, active_runway, runway_status)
VALUES ('{BASE_ID}', '05', 'open')
ON CONFLICT (base_id) DO NOTHING;
```

---

## Data I Need From You

If you want me to build the SQL seed script for a specific base, provide:

1. **Base info** — Full name, ICAO code, unit, MAJCOM, location, field elevation (MSL), timezone
2. **Runways** — For each runway:
   - Runway ID (e.g. `05/23`)
   - Runway class (`B` or `Army_B`)
   - Length and width (feet)
   - True heading
   - Surface type (Asphalt, Concrete, Asphalt/Concrete)
   - Each end: designator, latitude, longitude, approach lighting type (if any)
3. **NAVAIDs** — List of navigation aids (ILS, TACAN, PAPI, REILs, etc.)
4. **Airfield areas** — List of areas your team inspects during checks
5. **CE shops** — List of Civil Engineering shops
6. **Users** — Names, emails, and roles for initial user accounts

I can find most of #1 and #2 from public aviation databases if you just give me the ICAO code. Items #3-6 are base-specific and typically come from your airfield operations procedures.
