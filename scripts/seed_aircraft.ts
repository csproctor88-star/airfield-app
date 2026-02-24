/**
 * AOMS Aircraft Characteristics — Supabase Seed Script
 * =====================================================
 * Imports aircraft data from JSON files and optionally uploads images
 * from the Wikimedia scraper output to Supabase Storage.
 *
 * Prerequisites:
 *   1. Run migration_aircraft_characteristics.sql first
 *   2. Run scrape_aircraft_images.py to download images (optional)
 *   3. Set environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage:
 *   npx tsx seed_aircraft.ts                    # Data only
 *   npx tsx seed_aircraft.ts --with-images      # Data + image upload
 *   npx tsx seed_aircraft.ts --images-only      # Upload images to existing rows
 *   npx tsx seed_aircraft.ts --dry-run          # Preview without writing
 *
 * Environment:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...  (service role key bypasses RLS)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STORAGE_BUCKET = "aircraft-images";

// Paths — adjust these to match your project structure
const DATA_DIR = path.resolve(__dirname);
const COMMERCIAL_JSON = path.join(DATA_DIR, "commercial_aircraft.json");
const MILITARY_JSON = path.join(DATA_DIR, "military_aircraft.json");
const IMAGES_DIR = path.join(DATA_DIR, "aircraft_images");
const MANIFEST_FILE = path.join(IMAGES_DIR, "image_manifest.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawAircraft {
  aircraft: string;
  manufacturer?: string;
  category: string;
  alc_manager?: string;
  group_index?: string;
  notes?: string;
  wing_span_ft?: string;
  length_ft?: string;
  height_ft?: string;
  vertical_clearance_in?: string;
  pivot_point_ft?: string;
  turn_radius_ft?: string;
  turn_diameter_180_ft?: string;
  controlling_gear?: string;
  basic_empty_wt_klbs?: string;
  basic_mission_to_wt_klbs?: string;
  max_to_wt_klbs?: string;
  basic_mission_ldg_wt_klbs?: string;
  max_ldg_wt_klbs?: string;
  to_dist?: string;
  ldg_dist?: string;
  gear_config?: string;
  nose_assemblies_tires?: string;
  main_assemblies_tires?: string;
  main_pct_gross_load?: string;
  main_max_assembly_load_klbs?: string;
  main_max_single_wheel_load_klbs?: string;
  main_contact_pressure_psi?: string;
  main_contact_area_sqin?: string;
  main_footprint_width_in?: string;
  nose_pct_gross_load?: string;
  nose_max_assembly_load_klbs?: string;
  nose_max_single_wheel_load_klbs?: string;
  nose_contact_pressure_psi?: string;
  nose_contact_area_sqin?: string;
  nose_footprint_width_in?: string;
  acn?: {
    min_wt?: string;
    min_rigid_A?: string;
    min_rigid_B?: string;
    min_rigid_C?: string;
    min_rigid_D?: string;
    min_flex_A?: string;
    min_flex_B?: string;
    min_flex_C?: string;
    min_flex_D?: string;
    max_wt?: string;
    max_rigid_A?: string;
    max_rigid_B?: string;
    max_rigid_C?: string;
    max_rigid_D?: string;
    max_flex_A?: string;
    max_flex_B?: string;
    max_flex_C?: string;
    max_flex_D?: string;
  };
  source_page?: number;
}

interface ImageManifestEntry {
  filename: string;
  source_url: string;
  source_page: string;
  license: string;
  category: string;
  dedup_from?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string to number, stripping commas. Returns null if empty/invalid. */
function toNum(val?: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/[,']/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Convert a raw JSON record to a Supabase row object. */
function transformRecord(raw: RawAircraft) {
  return {
    aircraft: raw.aircraft,
    manufacturer: raw.manufacturer || null,
    category: raw.category,
    alc_manager: raw.alc_manager || null,
    group_index: raw.group_index || null,
    notes: raw.notes || null,

    wing_span_ft: toNum(raw.wing_span_ft),
    length_ft: toNum(raw.length_ft),
    height_ft: toNum(raw.height_ft),
    vertical_clearance_in: toNum(raw.vertical_clearance_in),

    pivot_point_ft: toNum(raw.pivot_point_ft),
    turn_radius_ft: toNum(raw.turn_radius_ft),
    turn_diameter_180_ft: toNum(raw.turn_diameter_180_ft),
    controlling_gear: raw.controlling_gear || null,

    basic_empty_wt_klbs: toNum(raw.basic_empty_wt_klbs),
    basic_mission_to_wt_klbs: toNum(raw.basic_mission_to_wt_klbs),
    max_to_wt_klbs: toNum(raw.max_to_wt_klbs),
    basic_mission_ldg_wt_klbs: toNum(raw.basic_mission_ldg_wt_klbs),
    max_ldg_wt_klbs: toNum(raw.max_ldg_wt_klbs),

    to_dist_ft: toNum(raw.to_dist),
    ldg_dist_ft: toNum(raw.ldg_dist),

    gear_config: raw.gear_config || null,
    nose_assemblies_tires: raw.nose_assemblies_tires || null,
    main_assemblies_tires: raw.main_assemblies_tires || null,

    main_pct_gross_load: toNum(raw.main_pct_gross_load),
    main_max_assembly_load_klbs: toNum(raw.main_max_assembly_load_klbs),
    main_max_single_wheel_load_klbs: toNum(raw.main_max_single_wheel_load_klbs),
    main_contact_pressure_psi: toNum(raw.main_contact_pressure_psi),
    main_contact_area_sqin: toNum(raw.main_contact_area_sqin),
    main_footprint_width_in: toNum(raw.main_footprint_width_in),

    nose_pct_gross_load: toNum(raw.nose_pct_gross_load),
    nose_max_assembly_load_klbs: toNum(raw.nose_max_assembly_load_klbs),
    nose_max_single_wheel_load_klbs: toNum(raw.nose_max_single_wheel_load_klbs),
    nose_contact_pressure_psi: toNum(raw.nose_contact_pressure_psi),
    nose_contact_area_sqin: toNum(raw.nose_contact_area_sqin),
    nose_footprint_width_in: toNum(raw.nose_footprint_width_in),

    // ACN values
    acn_min_wt_klbs: toNum(raw.acn?.min_wt),
    acn_min_rigid_a: toNum(raw.acn?.min_rigid_A),
    acn_min_rigid_b: toNum(raw.acn?.min_rigid_B),
    acn_min_rigid_c: toNum(raw.acn?.min_rigid_C),
    acn_min_rigid_d: toNum(raw.acn?.min_rigid_D),
    acn_min_flex_a: toNum(raw.acn?.min_flex_A),
    acn_min_flex_b: toNum(raw.acn?.min_flex_B),
    acn_min_flex_c: toNum(raw.acn?.min_flex_C),
    acn_min_flex_d: toNum(raw.acn?.min_flex_D),
    acn_max_wt_klbs: toNum(raw.acn?.max_wt),
    acn_max_rigid_a: toNum(raw.acn?.max_rigid_A),
    acn_max_rigid_b: toNum(raw.acn?.max_rigid_B),
    acn_max_rigid_c: toNum(raw.acn?.max_rigid_C),
    acn_max_rigid_d: toNum(raw.acn?.max_rigid_D),
    acn_max_flex_a: toNum(raw.acn?.max_flex_A),
    acn_max_flex_b: toNum(raw.acn?.max_flex_B),
    acn_max_flex_c: toNum(raw.acn?.max_flex_C),
    acn_max_flex_d: toNum(raw.acn?.max_flex_D),

    source_document: raw.category === "commercial" ? "TSC 13-3" : "TSC 13-2",
    source_page: raw.source_page || null,
  };
}

/** Get MIME type from file extension. */
function getMimeType(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

async function seedAircraftData(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<Map<string, string>> {
  console.log("\n📦 Loading aircraft JSON data...");

  const commercial: RawAircraft[] = JSON.parse(fs.readFileSync(COMMERCIAL_JSON, "utf-8"));
  const military: RawAircraft[] = JSON.parse(fs.readFileSync(MILITARY_JSON, "utf-8"));
  const allRaw = [...commercial, ...military];

  console.log(`   Commercial: ${commercial.length}`);
  console.log(`   Military:   ${military.length}`);
  console.log(`   Total:      ${allRaw.length}`);

  // Transform all records
  const rows = allRaw.map(transformRecord);

  if (dryRun) {
    console.log("\n🏃 [DRY RUN] Would insert", rows.length, "records");
    console.log("   Sample:", JSON.stringify(rows[0], null, 2).slice(0, 500));
    // Return a fake name→id map
    const fakeMap = new Map<string, string>();
    allRaw.forEach((r) => fakeMap.set(r.aircraft, "dry-run-uuid"));
    return fakeMap;
  }

  // Clear existing data (idempotent re-runs)
  console.log("\n🗑️  Clearing existing aircraft data...");
  const { error: deleteError } = await supabase
    .from("aircraft_characteristics")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

  if (deleteError) {
    console.error("   Delete error:", deleteError.message);
    // Continue anyway — table might be empty
  }

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  const nameToId = new Map<string, string>();
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("aircraft_characteristics")
      .insert(batch)
      .select("id, aircraft");

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      // Try inserting one at a time to find the problem record
      for (const row of batch) {
        const { data: single, error: singleErr } = await supabase
          .from("aircraft_characteristics")
          .insert(row)
          .select("id, aircraft");
        if (singleErr) {
          console.error(`      Failed: ${row.aircraft} — ${singleErr.message}`);
        } else if (single?.[0]) {
          nameToId.set(single[0].aircraft, single[0].id);
          inserted++;
        }
      }
    } else if (data) {
      data.forEach((d: any) => nameToId.set(d.aircraft, d.id));
      inserted += data.length;
    }

    process.stdout.write(`\r   ✅ Inserted ${inserted}/${rows.length} aircraft`);
  }

  console.log(`\n   Done — ${inserted} aircraft inserted.`);
  return nameToId;
}

async function uploadImages(
  supabase: SupabaseClient,
  nameToId: Map<string, string>,
  dryRun: boolean
): Promise<void> {
  // Check if manifest exists
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.log("\n⚠️  No image manifest found at:", MANIFEST_FILE);
    console.log("   Run scrape_aircraft_images.py first to download images.");
    console.log("   Skipping image upload.");
    return;
  }

  const manifest: Record<string, ImageManifestEntry> = JSON.parse(
    fs.readFileSync(MANIFEST_FILE, "utf-8")
  );

  const entries = Object.entries(manifest);
  console.log(`\n🖼️  Uploading ${entries.length} aircraft images to Supabase Storage...`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [aircraftName, info] of entries) {
    const localPath = path.join(IMAGES_DIR, info.filename);

    // Check local file exists
    if (!fs.existsSync(localPath)) {
      console.log(`   ⚠️  Missing file: ${info.filename}`);
      skipped++;
      continue;
    }

    // Storage path in bucket
    const storagePath = info.filename; // e.g., "commercial/737-800.jpg"

    if (dryRun) {
      process.stdout.write(`\r   🏃 [DRY RUN] Would upload: ${storagePath}          `);
      uploaded++;
      continue;
    }

    // Read file and upload
    const fileBuffer = fs.readFileSync(localPath);
    const mimeType = getMimeType(localPath);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.log(`\n   ❌ Upload failed: ${aircraftName} — ${uploadError.message}`);
      failed++;
      continue;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || null;

    // Find the database row and update with image URL
    const rowId = nameToId.get(aircraftName);
    if (rowId && publicUrl) {
      const { error: updateError } = await supabase
        .from("aircraft_characteristics")
        .update({
          image_url: publicUrl,
          image_license: info.license || null,
          image_source_url: info.source_url || null,
        })
        .eq("id", rowId);

      if (updateError) {
        console.log(`\n   ❌ DB update failed: ${aircraftName} — ${updateError.message}`);
        failed++;
        continue;
      }
    } else if (!rowId) {
      // Try matching by aircraft name directly (handles minor name differences)
      const { error: updateError } = await supabase
        .from("aircraft_characteristics")
        .update({
          image_url: publicUrl,
          image_license: info.license || null,
          image_source_url: info.source_url || null,
        })
        .eq("aircraft", aircraftName);

      if (updateError) {
        console.log(`\n   ⚠️  No DB match for: ${aircraftName}`);
      }
    }

    uploaded++;
    process.stdout.write(`\r   ✅ Uploaded ${uploaded}/${entries.length} images`);
  }

  console.log(`\n   Done — ${uploaded} uploaded, ${skipped} skipped, ${failed} failed.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const withImages = args.includes("--with-images");
  const imagesOnly = args.includes("--images-only");

  console.log("═══════════════════════════════════════════════════════");
  console.log("  AOMS Aircraft Characteristics — Supabase Seed");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode: ${dryRun ? "DRY RUN" : imagesOnly ? "IMAGES ONLY" : withImages ? "DATA + IMAGES" : "DATA ONLY"}`);

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("\n❌ Missing environment variables:");
    if (!SUPABASE_URL) console.error("   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    if (!SUPABASE_KEY) console.error("   SUPABASE_SERVICE_ROLE_KEY");
    console.error("\nSet them in your .env.local or export them:");
    console.error("  export SUPABASE_URL=https://your-project.supabase.co");
    console.error("  export SUPABASE_SERVICE_ROLE_KEY=eyJ...");
    process.exit(1);
  }

  // Validate JSON files exist
  if (!imagesOnly) {
    if (!fs.existsSync(COMMERCIAL_JSON)) {
      console.error(`\n❌ Commercial JSON not found: ${COMMERCIAL_JSON}`);
      console.error("   Place commercial_aircraft.json in the same directory as this script.");
      process.exit(1);
    }
    if (!fs.existsSync(MILITARY_JSON)) {
      console.error(`\n❌ Military JSON not found: ${MILITARY_JSON}`);
      console.error("   Place military_aircraft.json in the same directory as this script.");
      process.exit(1);
    }
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  let nameToId = new Map<string, string>();

  // Step 1: Seed aircraft data
  if (!imagesOnly) {
    nameToId = await seedAircraftData(supabase, dryRun);
  } else {
    // Load existing name→id mapping from database
    console.log("\n📦 Loading existing aircraft records...");
    const { data, error } = await supabase
      .from("aircraft_characteristics")
      .select("id, aircraft");
    if (error) {
      console.error("   ❌ Failed to load existing records:", error.message);
      process.exit(1);
    }
    data?.forEach((d: any) => nameToId.set(d.aircraft, d.id));
    console.log(`   Found ${nameToId.size} existing aircraft records.`);
  }

  // Step 2: Upload images (if requested)
  if (withImages || imagesOnly) {
    await uploadImages(supabase, nameToId, dryRun);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ COMPLETE");
  console.log("═══════════════════════════════════════════════════════");

  if (!withImages && !imagesOnly) {
    console.log("\n  💡 To add images later, run:");
    console.log("     python3 scrape_aircraft_images.py --output-dir ./aircraft_images");
    console.log("     npx tsx seed_aircraft.ts --images-only");
  }
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
