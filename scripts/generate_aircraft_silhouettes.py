#!/usr/bin/env python3
"""
Build aircraft silhouette library from RexKramer1/AircraftShapesSVG repo.

Reads military_aircraft.json and commercial_aircraft.json, deduplicates by
base aircraft name, maps each to an SVG from the shapes repo, and converts
outline SVGs to solid black filled silhouettes.

Prerequisites:
    git clone https://github.com/RexKramer1/AircraftShapesSVG.git /tmp/aircraft-shapes

Usage:
    python scripts/generate_aircraft_silhouettes.py
    python scripts/generate_aircraft_silhouettes.py --dry-run
    python scripts/generate_aircraft_silhouettes.py --force F-16
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
MILITARY_JSON = PUBLIC_DIR / "military_aircraft.json"
COMMERCIAL_JSON = PUBLIC_DIR / "commercial_aircraft.json"
OUTPUT_DIR = PUBLIC_DIR / "aircraft_silhouettes"
MANIFEST_PATH = PUBLIC_DIR / "aircraft_silhouette_manifest.json"

# Clone location for the shapes repo
SHAPES_DIR = Path(os.environ.get("SHAPES_DIR", str(Path.home() / "AppData/Local/Temp/aircraft-shapes/Shapes SVG")))

# Map our base aircraft names -> SVG filename (without .svg) in the shapes repo.
# Many military variants share airframes, so we map them to the same shape.
SHAPE_MAP = {
    # ── Commercial ──
    "707": "B703",
    "717": "B712",
    "720": "B703",       # 720 is a 707 variant
    "727": "B722",
    "737": "B737",
    "747": "B748",
    "757": "B752",
    "767": "B762",
    "777": "B772",
    "A330": "A332",
    "A340": "A342",
    "A380": "A388",
    "DC-10": "DC10",
    "DC-9": "DC87",
    "MD 81": "DC87",
    "MD 90-30": "DC87",
    "MD 90-30ER": "DC87",
    "MD-10": "DC10",
    "MD-11": "MD11",
    "MD-82": "DC87",
    "MD-83": "DC87",
    "MD-87": "DC87",

    # ── Fighters / Attack ──
    "AO/A-10-A Thunderbolt II": "A10",
    "F-15": "F15",
    "F-16": "F16",
    "F-22": "F22",
    "F-35": "F35",
    "F-5": "F5",
    "F/A-18F Super Hornet": "F18S",
    "AT-38": "T38",
    "T-38": "T38",

    # ── Bombers ──
    "B-1": "B1 slow",
    "B-52": "B52",

    # ── Cargo / Transport ──
    "AC-130": "C130",
    "C-130": "C130",
    "EC-130": "C130",
    "HC-130": "C130",
    "LC-130": "C130",
    "MC-130": "C130",
    "WC-130": "C130",
    "C-17": "C17",
    "C-2": "C2",
    "C-5": "C5M",
    "C-295": "C295",
    "CN-235": "CN35",
    "AN-124": "A124",
    "IL-76": "IL76",

    # ── Tanker / ISR / Special Mission ──
    "KC-10": "DC10",
    "KC-135": "K35E",
    "KC-46": "KC46",
    "E-3": "E737",       # AWACS on 707 airframe
    "E-4": "B742",       # NAOC on 747 airframe
    "E-8": "E8",         # JSTARS
    "EC-135": "R135",
    "OC-135": "R135",
    "RC-135": "R135",
    "WC-135": "R135",

    # ── VIP / Utility (military airframes based on commercial) ──
    "C-9": "DC87",       # DC-9 airframe
    "C-20": "GL5T",      # Gulfstream III/IV
    "C-21": "LJ35",      # Learjet 35
    "C-22": "B722",      # 727 airframe
    "C-32": "B752",      # 757 airframe
    "C-37": "GL5T",      # Gulfstream V
    "C-40": "B737",      # 737 airframe
    "VC-25": "B742",     # Air Force One, 747
    "T-1": "LJ35",       # Jayhawk, Learjet airframe
    "T-43": "B737",      # 737 airframe
    "U-28": "PC12",      # Pilatus PC-12

    # ── Trainers ──
    "T-6": "PC9",        # Similar turboprop trainer
    "T-45": "HAWK",      # Based on BAe Hawk

    # ── Helicopters ──
    "AH-64": "H64",
    "CH-47": "H47",
    "MH-47": "H47",
    "HH-60": "H60",
    "MH-60": "H60",
    "UH-1": "UH1",
    "UH-72": "EC45",     # Eurocopter/Airbus EC145
    "VH-3": "S61",       # Sea King

    # ── Tiltrotor ──
    "MV-22": "V22 slow",

    # ── ISR / Recon ──
    "U-2": "U2",
    "RQ-4": "Q4",        # Global Hawk

    # ── Niche transports (proxy matches) ──
    "C-12": "B350",       # King Air family
    "RC-12": "B350",      # King Air variant
    "C-38": "FA7X",       # Dassault Falcon 900 ~ Falcon 7X
    "DC-8": "DC87",       # DC-8-70 series ICAO code

    # ── Other ──
    "Tornado GR MK1": "TOR slow",
}


# ── Helpers ──────────────────────────────────────────────────────────


def sanitize_filename(name):
    """Convert aircraft name to a safe filename."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    s = s.strip('_')
    return s


def get_base_name(aircraft_name):
    """Extract the base aircraft name for deduplication."""
    name = aircraft_name.strip()
    mil_match = re.match(r'^([A-Z]{1,3}-\d{1,3})', name)
    if mil_match:
        return mil_match.group(1)
    comm_match = re.match(
        r'^(?:Airbus|Boeing|Bombardier|Embraer|McDonnell Douglas|Cessna|ATR|Saab|'
        r'de Havilland|BAe|Fokker|Lockheed|Beech|Gulfstream|Dassault|Pilatus)?\s*'
        r'([A-Z]?\d{2,4})', name
    )
    if comm_match:
        return comm_match.group(1)
    return name


def load_aircraft():
    """Load and deduplicate aircraft from both JSON files."""
    aircraft_map = {}
    for json_path, category in [(MILITARY_JSON, "military"), (COMMERCIAL_JSON, "commercial")]:
        if not json_path.exists():
            print(f"[WARN] {json_path.name} not found, skipping")
            continue
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for entry in data:
            full_name = entry.get("aircraft", "").strip()
            if not full_name:
                continue
            base = get_base_name(full_name)
            if base not in aircraft_map:
                aircraft_map[base] = {
                    "base_name": base,
                    "display_name": full_name,
                    "category": category,
                }
    return aircraft_map


def load_manifest():
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_manifest(manifest):
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def convert_to_filled_silhouette(svg_content):
    """
    Convert an outline SVG to a solid black filled silhouette.

    Strategy:
    1. Change all stroke-only paths to filled black paths
    2. Remove accent/detail layers (keep only outline layer)
    3. Set fill to black, remove stroke
    """
    lines = svg_content.split('\n')
    result = []
    in_accent_layer = False
    accent_depth = 0

    for line in lines:
        # Skip accent/detail layers — we only want the main outline
        if 'inkscape:label="Accent"' in line or 'inkscape:label="Detail"' in line:
            in_accent_layer = True
            accent_depth = 1
            continue
        if in_accent_layer:
            accent_depth += line.count('<g') - line.count('</g')
            if accent_depth <= 0:
                in_accent_layer = False
            continue

        # Convert outline paths to filled black
        if 'style="' in line and 'stroke' in line:
            # Replace fill:none with fill:black, remove stroke properties
            line = re.sub(r'fill:\s*none', 'fill:#000000', line)
            line = re.sub(r'stroke:[^;]+;?', '', line)
            line = re.sub(r'stroke-width:[^;]+;?', '', line)
            line = re.sub(r'stroke-linecap:[^;]+;?', '', line)
            line = re.sub(r'stroke-linejoin:[^;]+;?', '', line)
            line = re.sub(r'stroke-opacity:[^;]+;?', '', line)
            # Clean up double semicolons and trailing semicolons
            line = re.sub(r';{2,}', ';', line)
            line = re.sub(r';\s*"', '"', line)

        result.append(line)

    return '\n'.join(result)


def main():
    parser = argparse.ArgumentParser(description="Build aircraft silhouette library")
    parser.add_argument("--dry-run", action="store_true", help="List mappings without copying")
    parser.add_argument("--force", type=str, help="Force re-process a specific base name")
    args = parser.parse_args()

    # Check shapes repo
    if not SHAPES_DIR.exists():
        print("[ERROR] Shapes repo not found. Run:")
        print("  git clone https://github.com/RexKramer1/AircraftShapesSVG.git /tmp/aircraft-shapes")
        sys.exit(1)

    aircraft_map = load_aircraft()
    print(f"Found {len(aircraft_map)} unique aircraft")

    # Build processing list
    mapped = []
    unmapped = []
    for base in sorted(aircraft_map.keys()):
        info = aircraft_map[base]
        if base in SHAPE_MAP:
            shape_file = SHAPES_DIR / f"{SHAPE_MAP[base]}.svg"
            if shape_file.exists():
                mapped.append((base, info, shape_file))
            else:
                print(f"[WARN] Shape file missing: {SHAPE_MAP[base]}.svg for {base}")
                unmapped.append((base, info))
        else:
            unmapped.append((base, info))

    print(f"Mapped: {len(mapped)}, Unmapped: {len(unmapped)}")

    if args.dry_run:
        print("\n-- MAPPED --")
        for base, info, shape_file in mapped:
            print(f"  {base:30s} <- {info['display_name']:40s} -> {shape_file.name}")
        print(f"\n-- UNMAPPED ({len(unmapped)}) --")
        for base, info in unmapped:
            print(f"  {base:30s} <- {info['display_name']}")
        return

    # Process mapped aircraft
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()

    processed = 0
    for base, info, shape_file in mapped:
        if args.force and args.force != base:
            continue
        if not args.force and base in manifest:
            continue

        filename = sanitize_filename(base) + ".svg"
        output_path = OUTPUT_DIR / filename

        # Read source SVG
        with open(shape_file, 'r', encoding='utf-8') as f:
            svg_content = f.read()

        # Convert to solid black fill
        filled_svg = convert_to_filled_silhouette(svg_content)

        # Write output
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(filled_svg)

        size_kb = len(filled_svg.encode('utf-8')) / 1024
        print(f"  [OK] {base:20s} -> {filename} ({size_kb:.0f} KB)")

        manifest[base] = {
            "base_name": base,
            "display_name": info["display_name"],
            "category": info["category"],
            "filename": filename,
            "path": f"/aircraft_silhouettes/{filename}",
            "source_shape": shape_file.name,
        }
        processed += 1

    save_manifest(manifest)

    print(f"\n-- Results --")
    print(f"  Processed: {processed}")
    print(f"  Total in manifest: {len(manifest)}")

    if unmapped:
        print(f"\n-- Missing ({len(unmapped)}) --")
        for base, info in unmapped:
            print(f"  - {base} ({info['display_name']})")


if __name__ == "__main__":
    main()
