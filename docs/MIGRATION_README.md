# Aircraft Database Migration — Claude Code Handoff

## Overview

Migrate the aircraft characteristics data from client-side JSON imports to a proper Supabase PostgreSQL table with images served from Supabase Storage. This replaces the local JSON approach with a server-side database that supports full-text search, filtering, and a consistent image delivery pattern matching the existing `regulation-pdfs` bucket.

## Files Provided

| File | Purpose |
|------|---------|
| `migration_aircraft_characteristics.sql` | Supabase migration — creates table, indexes, RLS, storage bucket, search function, summary view |
| `seed_aircraft.ts` | TypeScript seed script — imports JSON data, uploads images, links URLs |
| `commercial_aircraft.json` | 84 commercial aircraft records (Airbus, Boeing, McDonnell Douglas) |
| `military_aircraft.json` | 127 military aircraft records (USAF, Army, Navy, foreign military) |
| `scrape_aircraft_images.py` | Wikimedia Commons image scraper (Python 3, zero dependencies) |

## Step-by-Step Execution

### Step 1: Run the SQL migration

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Copy migration_aircraft_characteristics.sql into Supabase Dashboard → SQL Editor → Run
```

This creates:
- `aircraft_characteristics` table with 50+ columns
- Indexes on category, manufacturer, name, weight, and full-text search
- `updated_at` trigger
- RLS policies (public read, admin write)
- `aircraft-images` storage bucket (public, 5MB limit, JPEG/PNG/WebP)
- `search_aircraft()` PostgreSQL function
- `aircraft_summary` view for common queries

### Step 2: Place the data files

Put these files in the same directory (e.g., `scripts/` or project root):
- `commercial_aircraft.json`
- `military_aircraft.json`
- `seed_aircraft.ts`

### Step 3: Seed the data

```bash
# Make sure environment is set
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Or if using .env.local, the script also checks NEXT_PUBLIC_SUPABASE_URL

# Dry run first
npx tsx seed_aircraft.ts --dry-run

# Seed data (no images yet)
npx tsx seed_aircraft.ts
```

### Step 4: Scrape and upload images (optional, can do later)

```bash
# Download images from Wikimedia Commons (~8-10 min)
python3 scrape_aircraft_images.py --output-dir ./aircraft_images

# Upload images and link to database rows
npx tsx seed_aircraft.ts --images-only

# Or do everything in one shot
npx tsx seed_aircraft.ts --with-images
```

## Updating the App Code

### Before (client-side JSON)

```typescript
// Old approach — local import
import commercialAircraft from '@/data/commercial_aircraft.json';
import militaryAircraft from '@/data/military_aircraft.json';

const allAircraft = [...commercialAircraft, ...militaryAircraft];
const filtered = allAircraft.filter(a => a.manufacturer === 'Boeing');
```

### After (Supabase queries)

```typescript
// New approach — server-side queries
import { createClient } from '@/lib/supabase/server';

// Fetch all aircraft (paginated)
const { data: aircraft } = await supabase
  .from('aircraft_characteristics')
  .select('*')
  .order('aircraft');

// Filter by category
const { data: military } = await supabase
  .from('aircraft_characteristics')
  .select('*')
  .eq('category', 'military')
  .order('aircraft');

// Search by text (uses the PostgreSQL function)
const { data: results } = await supabase
  .rpc('search_aircraft', { search_query: 'C-130 Hercules' });

// Use the summary view for list/card displays
const { data: summary } = await supabase
  .from('aircraft_summary')
  .select('*')
  .eq('category', 'commercial');

// Filter by weight class (e.g., heavy aircraft)
const { data: heavies } = await supabase
  .from('aircraft_characteristics')
  .select('aircraft, manufacturer, max_to_wt_klbs, image_url')
  .gte('max_to_wt_klbs', 300)
  .order('max_to_wt_klbs', { ascending: false });

// Get ACN data for pavement evaluation
const { data: acnData } = await supabase
  .from('aircraft_characteristics')
  .select('aircraft, acn_max_rigid_a, acn_max_rigid_b, acn_max_rigid_c, acn_max_rigid_d, acn_max_flex_a, acn_max_flex_b, acn_max_flex_c, acn_max_flex_d, max_to_wt_klbs')
  .eq('aircraft', 'C-17A Globemaster III')
  .single();
```

### Image Display

```tsx
// Aircraft card component
function AircraftCard({ aircraft }: { aircraft: AircraftCharacteristics }) {
  return (
    <div className="rounded-lg border p-4">
      {aircraft.image_url && (
        <img
          src={aircraft.image_url}
          alt={aircraft.aircraft}
          className="w-full h-48 object-cover rounded-md mb-3"
          loading="lazy"
        />
      )}
      <h3 className="font-semibold">{aircraft.aircraft}</h3>
      <p className="text-sm text-muted-foreground">{aircraft.manufacturer}</p>
      <div className="mt-2 text-xs space-y-1">
        <p>Max T/O: {aircraft.max_to_wt_klbs?.toLocaleString()}k lbs</p>
        <p>Wingspan: {aircraft.wing_span_ft} ft</p>
        <p>Gear: {aircraft.gear_config}</p>
      </div>
    </div>
  );
}
```

## Database Schema Reference

Key columns for common AOMS use cases:

| Use Case | Key Columns |
|----------|-------------|
| Aircraft identification | `aircraft`, `manufacturer`, `category`, `image_url` |
| Airfield compatibility | `max_to_wt_klbs`, `main_contact_pressure_psi`, `gear_config`, `turn_diameter_180_ft` |
| Pavement evaluation | `acn_max_rigid_a` through `acn_max_flex_d`, `main_contact_pressure_psi` |
| Taxiway/runway sizing | `wing_span_ft`, `length_ft`, `turn_radius_ft`, `turn_diameter_180_ft` |
| Weight bearing | `max_to_wt_klbs`, `max_ldg_wt_klbs`, `main_max_single_wheel_load_klbs` |
| Landing gear details | `gear_config`, `main_assemblies_tires`, `nose_assemblies_tires` |

## Notes

- **Service role key**: The seed script needs `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) because it bypasses RLS to insert data. Never expose this in client code.
- **Idempotent**: The seed script deletes existing data before inserting, so it's safe to re-run.
- **Image upload is decoupled**: You can seed the data now and add images later with `--images-only`. The `image_url` column simply stays null until populated.
- **Storage bucket is public**: Aircraft reference images aren't sensitive, so the bucket is public-read. This means `image_url` values work directly in `<img>` tags with no auth tokens needed.
- **Numeric types**: All weight/dimension values are stored as `NUMERIC` in PostgreSQL (not text). The seed script handles the string→number conversion including stripping commas.
