/**
 * AOMS Aircraft Image Linker
 * ===========================
 * Reads the image manifest from the Wikimedia scraper and patches
 * the aircraft JSON databases with image_url paths.
 *
 * No Supabase. No uploads. Just links images to data.
 *
 * Usage:
 *   node seed_aircraft_images.js
 *   node seed_aircraft_images.js --dry-run
 *
 * Input files (same directory as this script):
 *   - commercial_aircraft.json
 *   - military_aircraft.json
 *   - image_manifest.json
 *
 * Output:
 *   - Overwrites commercial_aircraft.json and military_aircraft.json
 *     with image_url, image_license, and image_source_url added to each record
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const COMMERCIAL_JSON = path.join(SCRIPT_DIR, "commercial_aircraft.json");
const MILITARY_JSON = path.join(SCRIPT_DIR, "military_aircraft.json");
const MANIFEST_FILE = path.join(SCRIPT_DIR, "image_manifest.json");

// This is the public-facing path prefix — matches where images live in public/
const IMAGE_PATH_PREFIX = "/aircraft_images";

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  AOMS Aircraft Image Linker");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}\n`);

  // Validate files exist
  for (const [label, filepath] of [
    ["Commercial JSON", COMMERCIAL_JSON],
    ["Military JSON", MILITARY_JSON],
    ["Image Manifest", MANIFEST_FILE],
  ]) {
    if (!fs.existsSync(filepath)) {
      console.error(`❌ ${label} not found: ${filepath}`);
      process.exit(1);
    }
  }

  // Load files
  const commercial = JSON.parse(fs.readFileSync(COMMERCIAL_JSON, "utf-8"));
  const military = JSON.parse(fs.readFileSync(MILITARY_JSON, "utf-8"));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));

  console.log(`📦 Loaded:`);
  console.log(`   Commercial aircraft: ${commercial.length}`);
  console.log(`   Military aircraft:   ${military.length}`);
  console.log(`   Manifest entries:    ${Object.keys(manifest).length}`);

  let matched = 0;
  let unmatched = 0;

  // Process both databases
  function linkImages(aircraftList, label) {
    let count = 0;
    for (const ac of aircraftList) {
      const name = ac.aircraft;
      const entry = manifest[name];

      if (entry) {
        // Build the public path: /aircraft_images/commercial/737-800.jpg
        ac.image_url = `${IMAGE_PATH_PREFIX}/${entry.filename}`;
        ac.image_license = entry.license || null;
        ac.image_source_url = entry.source_url || null;
        count++;
        matched++;
      } else {
        // No image found — clear any stale values
        ac.image_url = null;
        ac.image_license = null;
        ac.image_source_url = null;
        unmatched++;
      }
    }
    console.log(`\n🔗 ${label}: ${count}/${aircraftList.length} matched to images`);

    // Show unmatched
    const missing = aircraftList.filter((a) => !a.image_url);
    if (missing.length > 0) {
      console.log(`   Missing images:`);
      missing.forEach((a) => console.log(`     - ${a.aircraft}`));
    }
  }

  linkImages(commercial, "Commercial");
  linkImages(military, "Military");

  // Write updated files
  if (DRY_RUN) {
    console.log(`\n🏃 [DRY RUN] Would write updated JSON files. No changes made.`);
    console.log(`   Sample record:`);
    const sample = commercial.find((a) => a.image_url) || military.find((a) => a.image_url);
    if (sample) {
      console.log(`   ${sample.aircraft}:`);
      console.log(`     image_url: ${sample.image_url}`);
      console.log(`     image_license: ${sample.image_license}`);
      console.log(`     image_source_url: ${sample.image_source_url}`);
    }
  } else {
    fs.writeFileSync(COMMERCIAL_JSON, JSON.stringify(commercial, null, 2));
    console.log(`\n💾 Wrote: ${COMMERCIAL_JSON}`);

    fs.writeFileSync(MILITARY_JSON, JSON.stringify(military, null, 2));
    console.log(`💾 Wrote: ${MILITARY_JSON}`);
  }

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  ✅ COMPLETE`);
  console.log(`     Matched:   ${matched}`);
  console.log(`     No image:  ${unmatched}`);
  console.log(`═══════════════════════════════════════════════════════`);

  if (matched > 0 && !DRY_RUN) {
    console.log(`\n  Your JSON files now have image_url fields like:`);
    console.log(`    "/aircraft_images/commercial/737-800.jpg"`);
    console.log(`    "/aircraft_images/military/C-17A_Globemaster_III.jpg"`);
    console.log(`\n  Use in your components:`);
    console.log(`    <img src={aircraft.image_url} alt={aircraft.aircraft} />`);
  }
}

main();
