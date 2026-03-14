#!/usr/bin/env python3
"""
Download USFWS wildlife species images for offline use.

Follows the same pattern as scrape_aircraft_images.py:
  - Downloads images to /public/wildlife_images/{group}/
  - Generates /public/wildlife_image_manifest.json
  - wildlife-species-data.ts resolveWildlifeImage() picks up the local path

Usage:
    python scripts/scrape_wildlife_images.py

All images are public domain (U.S. Government work — USFWS).
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────

IIIF_BASE = "https://digitalmedia.fws.gov/digital/iiif/natdiglib"
# Fallback: Wikimedia Commons search for species without USFWS IDs
WIKI_API = "https://en.wikipedia.org/w/api.php"

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
IMAGE_DIR = PUBLIC_DIR / "wildlife_images"
MANIFEST_PATH = PUBLIC_DIR / "wildlife_image_manifest.json"

# Species list: (common_name, scientific_name, group, natdiglib_id_or_none)
# Extracted from lib/wildlife-species-data.ts
SPECIES = [
    # Large birds
    ("Canada Goose", "Branta canadensis", "bird", 1489),
    ("Snow Goose", "Anser caerulescens", "bird", 15275),
    ("Turkey Vulture", "Cathartes aura", "bird", 1611),
    ("Black Vulture", "Coragyps atratus", "bird", 7747),
    ("Red-tailed Hawk", "Buteo jamaicensis", "bird", 18455),
    ("Great Blue Heron", "Ardea herodias", "bird", 6891),
    ("Great Horned Owl", "Bubo virginianus", "bird", 8058),
    ("Bald Eagle", "Haliaeetus leucocephalus", "bird", 6773),
    ("Osprey", "Pandion haliaetus", "bird", 8094),
    ("Sandhill Crane", "Antigone canadensis", "bird", 5590),
    ("Great Egret", "Ardea alba", "bird", 6879),
    ("Wild Turkey", "Meleagris gallopavo", "bird", 8756),
    ("Double-crested Cormorant", "Nannopterum auritum", "bird", 7289),
    ("Brown Pelican", "Pelecanus occidentalis", "bird", 3771),
    ("American White Pelican", "Pelecanus erythrorhynchos", "bird", 8136),
    ("Red-shouldered Hawk", "Buteo lineatus", "bird", 7515),
    ("Cooper's Hawk", "Accipiter cooperii", "bird", 7494),
    ("Northern Harrier", "Circus hudsonius", "bird", 7501),
    ("Snowy Owl", "Bubo scandiacus", "bird", 8072),
    # Medium birds
    ("Mallard", "Anas platyrhynchos", "bird", 9090),
    ("Herring Gull", "Larus argentatus", "bird", 6800),
    ("Ring-billed Gull", "Larus delawarensis", "bird", 6804),
    ("Laughing Gull", "Leucophaeus atricilla", "bird", 6796),
    ("Rock Pigeon", "Columba livia", "bird", 17706),
    ("Mourning Dove", "Zenaida macroura", "bird", 7372),
    ("American Crow", "Corvus brachyrhynchos", "bird", 7330),
    ("American Kestrel", "Falco sparverius", "bird", 776),
    ("Barn Owl", "Tyto alba", "bird", 8038),
    ("Killdeer", "Charadrius vociferus", "bird", 12311),
    ("Common Nighthawk", "Chordeiles minor", "bird", 7938),
    ("Peregrine Falcon", "Falco peregrinus", "bird", 7474),
    ("Short-eared Owl", "Asio flammeus", "bird", 8066),
    ("American Robin", "Turdus migratorius", "bird", 7691),
    ("Northern Mockingbird", "Mimus polyglottos", "bird", 7680),
    ("Blue Jay", "Cyanocitta cristata", "bird", 7326),
    ("Northern Flicker", "Colaptes auratus", "bird", 8000),
    ("Red-winged Blackbird", "Agelaius phoeniceus", "bird", 7205),
    ("Common Grackle", "Quiscalus quiscula", "bird", 7215),
    ("Eastern Meadowlark", "Sturnella magna", "bird", 7218),
    ("Brown-headed Cowbird", "Molothrus ater", "bird", 7210),
    ("Great-tailed Grackle", "Quiscalus mexicanus", "bird", 7217),
    ("Cattle Egret", "Bubulcus ibis", "bird", 6876),
    ("Green Heron", "Butorides virescens", "bird", 6895),
    ("Black-crowned Night-Heron", "Nycticorax nycticorax", "bird", 6903),
    ("Chimney Swift", "Chaetura pelagica", "bird", 7928),
    ("Scissor-tailed Flycatcher", "Tyrannus forficatus", "bird", 7633),
    ("Loggerhead Shrike", "Lanius ludovicianus", "bird", 7670),
    ("Mississippi Kite", "Ictinia mississippiensis", "bird", 7507),
    ("Upland Sandpiper", "Bartramia longicauda", "bird", 4358),
    ("Eurasian Collared-Dove", "Streptopelia decaocto", "bird", 7369),
    ("Boat-tailed Grackle", "Quiscalus major", "bird", None),
    ("Great Black-backed Gull", "Larus marinus", "bird", 6808),
    ("Bonaparte's Gull", "Chroicocephalus philadelphia", "bird", 6792),
    # Small birds
    ("European Starling", "Sturnus vulgaris", "bird", 7700),
    ("Horned Lark", "Eremophila alpestris", "bird", 7649),
    ("Barn Swallow", "Hirundo rustica", "bird", 7584),
    ("House Sparrow", "Passer domesticus", "bird", 7697),
    ("Song Sparrow", "Melospiza melodia", "bird", 7254),
    ("Savannah Sparrow", "Passerculus sandwichensis", "bird", 7248),
    ("Cliff Swallow", "Petrochelidon pyrrhonota", "bird", 7590),
    ("Tree Swallow", "Tachycineta bicolor", "bird", 7598),
    ("Eastern Bluebird", "Sialia sialis", "bird", 7684),
    ("Purple Martin", "Progne subis", "bird", 7594),
    ("American Goldfinch", "Spinus tristis", "bird", 7232),
    ("House Finch", "Haemorhous mexicanus", "bird", 7226),
    ("Cedar Waxwing", "Bombycilla cedrorum", "bird", 7711),
    # Waterfowl
    ("American Black Duck", "Anas rubripes", "bird", 9082),
    ("Northern Pintail", "Anas acuta", "bird", 9104),
    ("Green-winged Teal", "Anas crecca", "bird", 9118),
    ("Blue-winged Teal", "Spatula discors", "bird", 9114),
    ("Wood Duck", "Aix sponsa", "bird", 9072),
    # Shorebirds
    ("American Woodcock", "Scolopax minor", "bird", 4345),
    ("Wilson's Snipe", "Gallinago delicata", "bird", 4389),
    ("Semipalmated Plover", "Charadrius semipalmatus", "bird", 4367),
    # Gamebirds
    ("Ring-necked Pheasant", "Phasianus colchicus", "bird", 8747),
    ("Northern Bobwhite", "Colinus virginianus", "bird", 8741),
    # Mammals — Large
    ("White-tailed Deer", "Odocoileus virginianus", "mammal", 17496),
    ("Mule Deer", "Odocoileus hemionus", "mammal", 5010),
    ("Coyote", "Canis latrans", "mammal", 11774),
    ("Red Fox", "Vulpes vulpes", "mammal", 4915),
    ("Gray Fox", "Urocyon cinereoargenteus", "mammal", 4911),
    ("Feral Pig", "Sus scrofa", "mammal", 5031),
    ("Pronghorn", "Antilocapra americana", "mammal", 4998),
    # Mammals — Medium/Small
    ("Eastern Cottontail", "Sylvilagus floridanus", "mammal", 12317),
    ("Striped Skunk", "Mephitis mephitis", "mammal", 4960),
    ("Raccoon", "Procyon lotor", "mammal", 4946),
    ("Virginia Opossum", "Didelphis virginiana", "mammal", 4865),
    ("Nine-banded Armadillo", "Dasypus novemcinctus", "mammal", 4860),
    ("Woodchuck", "Marmota monax", "mammal", 4932),
    ("Thirteen-lined Ground Squirrel", "Ictidomys tridecemlineatus", "mammal", 4928),
    ("Black-tailed Prairie Dog", "Cynomys ludovicianus", "mammal", 4920),
    # Reptiles
    ("American Alligator", "Alligator mississippiensis", "reptile", 4777),
    ("Common Snapping Turtle", "Chelydra serpentina", "reptile", 4800),
    ("Eastern Box Turtle", "Terrapene carolina", "reptile", 4815),
    ("Black Rat Snake", "Pantherophis obsoletus", "reptile", None),
    # Bats
    ("Brazilian Free-tailed Bat", "Tadarida brasiliensis", "bat", 4841),
    ("Big Brown Bat", "Eptesicus fuscus", "bat", 4835),
    ("Little Brown Bat", "Myotis lucifugus", "bat", 4845),
    ("Hoary Bat", "Lasiurus cinereus", "bat", 4849),
    ("Eastern Red Bat", "Lasiurus borealis", "bat", 4838),
]


def safe_filename(name: str) -> str:
    """Sanitize species name for use as filename."""
    return re.sub(r'[^a-z0-9_]', '', name.lower().replace(' ', '_').replace('-', '_').replace("'", ''))


def download_usfws(natdiglib_id: int, dest: Path) -> str | None:
    """Download image from USFWS IIIF endpoint. Returns source URL or None."""
    url = f"{IIIF_BASE}/{natdiglib_id}/full/800,/0/default.jpg"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GlidepathApp/1.0 (wildlife-image-downloader)"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            if len(data) < 1000:
                print(f"    ⚠ Suspiciously small response ({len(data)} bytes), skipping")
                return None
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return url
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"    ✗ USFWS download failed: {e}")
        return None


def download_wikipedia_image(scientific_name: str, dest: Path) -> tuple[str, str] | None:
    """Fallback: fetch thumbnail from Wikipedia article. Returns (source_url, page_url) or None."""
    # Search for the Wikipedia article
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": scientific_name,
        "prop": "pageimages",
        "pithumbsize": 800,
        "format": "json",
        "redirects": 1,
    })
    url = f"{WIKI_API}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GlidepathApp/1.0 (wildlife-image-downloader)"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                continue
            thumb = page.get("thumbnail", {}).get("source")
            if not thumb:
                continue
            # Download the thumbnail
            req2 = urllib.request.Request(thumb, headers={"User-Agent": "GlidepathApp/1.0"})
            with urllib.request.urlopen(req2, timeout=30) as resp2:
                img_data = resp2.read()
                if len(img_data) < 500:
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(img_data)
                page_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(scientific_name.replace(' ', '_'))}"
                return (thumb, page_url)
    except Exception as e:
        print(f"    ✗ Wikipedia fallback failed: {e}")
    return None


def main():
    print("=" * 60)
    print("Wildlife Species Image Downloader")
    print("Downloads USFWS public-domain photos for offline use")
    print("=" * 60)
    print()

    manifest: dict[str, dict] = {}
    success = 0
    failed = 0
    skipped = 0

    # Load existing manifest for incremental runs
    if MANIFEST_PATH.exists():
        try:
            existing = json.loads(MANIFEST_PATH.read_text())
            print(f"Found existing manifest with {len(existing)} entries")
        except Exception:
            existing = {}
    else:
        existing = {}

    for common_name, scientific_name, group, natdiglib_id in SPECIES:
        fname = safe_filename(common_name)
        rel_path = f"{group}/{fname}.jpg"
        dest = IMAGE_DIR / group / f"{fname}.jpg"

        # Skip if already downloaded (incremental mode)
        if common_name in existing and dest.exists():
            manifest[common_name] = existing[common_name]
            skipped += 1
            print(f"  ⏭ {common_name} (already downloaded)")
            continue

        print(f"  ↓ {common_name} ({scientific_name})...")

        source_url = None
        source_page = "https://digitalmedia.fws.gov/digital/collection/natdiglib"
        license_info = "Public Domain (U.S. Government Work)"

        # Try USFWS first
        if natdiglib_id is not None:
            source_url = download_usfws(natdiglib_id, dest)
            if source_url:
                source_page = f"https://digitalmedia.fws.gov/digital/collection/natdiglib/id/{natdiglib_id}"

        # Fallback to Wikipedia
        if source_url is None:
            print(f"    → Trying Wikipedia fallback...")
            result = download_wikipedia_image(scientific_name, dest)
            if result:
                source_url, source_page = result
                license_info = "CC BY-SA (Wikipedia)"

        if source_url and dest.exists():
            manifest[common_name] = {
                "filename": rel_path,
                "source_url": source_url,
                "source_page": source_page,
                "license": license_info,
                "group": group,
            }
            size_kb = dest.stat().st_size / 1024
            print(f"    ✓ Saved ({size_kb:.0f} KB)")
            success += 1
        else:
            print(f"    ✗ No image available")
            failed += 1

        # Be polite to servers
        time.sleep(0.5)

    # Write manifest
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    print()
    print("=" * 60)
    print(f"Done! {success} downloaded, {skipped} skipped, {failed} failed")
    print(f"Images: {IMAGE_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    import urllib.parse
    main()
