#!/usr/bin/env python3
"""
Aircraft Image Scraper — Wikimedia Commons API
================================================
Fetches representative images for 211 aircraft from Wikimedia Commons.
Designed to run via Claude Code or standalone Python 3.10+.

Usage:
    python3 scrape_aircraft_images.py [--dry-run] [--output-dir ./aircraft_images] [--delay 1.5]

Outputs:
    - ./aircraft_images/commercial/  — Commercial aircraft images
    - ./aircraft_images/military/    — Military aircraft images
    - ./aircraft_images/image_manifest.json — Maps aircraft → image path + metadata
    - ./aircraft_images/failures.json — Aircraft that couldn't be matched (for manual review)

Notes:
    - Wikimedia Commons images are typically CC BY-SA or public domain
    - U.S. military photos are public domain (USGov works)
    - The script respects Wikimedia API etiquette (User-Agent, rate limiting)
    - Deduplication groups are built in — visually identical variants share images
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OUTPUT_DIR = Path("./aircraft_images")
DELAY_SECONDS = 1.5  # Be polite to Wikimedia servers
DRY_RUN = False       # Set True to skip downloads, just test search queries
USER_AGENT = "AOMS-AircraftImageScraper/1.0 (Airfield Operations Management Suite; contact: csproctor88@gmail.com)"
MAX_IMAGE_WIDTH = 1280  # Request thumbnail at this max width (pixels)
PREFERRED_EXTENSIONS = ('.jpg', '.jpeg', '.png')

# Wikimedia API endpoints
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"


# ---------------------------------------------------------------------------
# Aircraft Database
# ---------------------------------------------------------------------------
# Each entry: (aircraft_name, category, search_queries, dedup_group)
# search_queries: list of queries to try in order (first match wins)
# dedup_group: if set, all aircraft with same group share one image

AIRCRAFT_DATABASE = [
    # ======================================================================
    # COMMERCIAL AIRCRAFT (84)
    # ======================================================================

    # Airbus
    ("A330-200", "commercial", ["Airbus A330-200", "Airbus A330-200 side"], None),
    ("A330-300", "commercial", ["Airbus A330-300", "Airbus A330-300 aircraft"], None),
    ("A340-200", "commercial", ["Airbus A340-200", "Airbus A340-200 aircraft"], None),
    ("A340-300", "commercial", ["Airbus A340-300", "Airbus A340-300 aircraft"], None),
    ("A380-841, -861", "commercial", ["Airbus A380", "Airbus A380-800"], None),
    ("A380-843F, -863F", "commercial", ["Airbus A380F freighter", "Airbus A380"], "a380"),

    # DC-8 family
    ("DC-8-43", "commercial", ["Douglas DC-8", "DC-8 aircraft"], "dc8-short"),
    ("DC-8-55", "commercial", ["Douglas DC-8-50", "DC-8 aircraft"], "dc8-short"),
    ("DC-8-55F", "commercial", ["Douglas DC-8-50", "DC-8 aircraft"], "dc8-short"),
    ("DC-8-61, -71", "commercial", ["Douglas DC-8-61", "DC-8 Super 61"], "dc8-long"),
    ("DC-8-61F, -71F", "commercial", ["Douglas DC-8-61", "DC-8-71"], "dc8-long"),
    ("DC-8-62, -72", "commercial", ["Douglas DC-8-62", "DC-8-72"], "dc8-long"),
    ("DC-8-62F, -72F", "commercial", ["Douglas DC-8-62", "DC-8-72"], "dc8-long"),
    ("DC-8-63, -73", "commercial", ["Douglas DC-8-63", "DC-8-73"], "dc8-long"),
    ("DC-8-63F, -73F", "commercial", ["Douglas DC-8-63", "DC-8-73"], "dc8-long"),

    # DC-9 family
    ("DC-9-15, -15F", "commercial", ["Douglas DC-9-10", "Douglas DC-9"], "dc9"),
    ("DC-9-21", "commercial", ["Douglas DC-9-20", "Douglas DC-9"], "dc9"),
    ("DC-9-32, -33F", "commercial", ["Douglas DC-9-30", "DC-9-32"], "dc9"),
    ("DC-9-41", "commercial", ["Douglas DC-9-40", "Douglas DC-9"], "dc9"),
    ("DC-9-51", "commercial", ["Douglas DC-9-50", "Douglas DC-9"], "dc9"),

    # DC-10 family
    ("DC-10-10, -10CF", "commercial", ["McDonnell Douglas DC-10", "DC-10-10"], "dc10"),
    ("DC-10-30, -30CF", "commercial", ["McDonnell Douglas DC-10-30", "DC-10"], "dc10"),
    ("DC-10-40, -40CF", "commercial", ["McDonnell Douglas DC-10-40", "DC-10"], "dc10"),

    # MD family
    ("MD 81", "commercial", ["McDonnell Douglas MD-81", "MD-80 aircraft"], "md80"),
    ("MD-82, -88", "commercial", ["McDonnell Douglas MD-82", "MD-82 aircraft"], "md80"),
    ("MD-83", "commercial", ["McDonnell Douglas MD-83", "MD-83 aircraft"], "md80"),
    ("MD-87", "commercial", ["McDonnell Douglas MD-87", "MD-87 aircraft"], "md80"),
    ("MD 90-30", "commercial", ["McDonnell Douglas MD-90", "MD-90 aircraft"], "md90"),
    ("MD 90-30ER", "commercial", ["McDonnell Douglas MD-90", "MD-90 aircraft"], "md90"),
    ("MD-10-10F", "commercial", ["McDonnell Douglas MD-10", "MD-10 FedEx"], None),
    ("MD-11, -Combi, -Freighter", "commercial", ["McDonnell Douglas MD-11", "MD-11 aircraft"], "md11"),
    ("MD-11ER", "commercial", ["McDonnell Douglas MD-11", "MD-11 aircraft"], "md11"),

    # Boeing 707/720
    ("707-120B", "commercial", ["Boeing 707-120", "Boeing 707"], "707"),
    ("707-320/420", "commercial", ["Boeing 707-320", "Boeing 707"], "707"),
    ("707-320B", "commercial", ["Boeing 707-320B", "Boeing 707"], "707"),
    ("707-320C", "commercial", ["Boeing 707-320C", "Boeing 707"], "707"),
    ("717-200", "commercial", ["Boeing 717", "Boeing 717-200"], None),
    ("720", "commercial", ["Boeing 720 aircraft", "Boeing 720"], "720"),
    ("720B", "commercial", ["Boeing 720B", "Boeing 720"], "720"),

    # Boeing 727
    ("727-100/-100C", "commercial", ["Boeing 727-100", "Boeing 727"], "727"),
    ("727-200", "commercial", ["Boeing 727-200", "Boeing 727-200 aircraft"], None),

    # Boeing 737 Classic
    ("737-100", "commercial", ["Boeing 737-100", "Boeing 737 Original"], "737og"),
    ("737-200", "commercial", ["Boeing 737-200", "Boeing 737-200 aircraft"], "737og"),
    ("737-200ADV/-200C/-200QC", "commercial", ["Boeing 737-200 Advanced", "Boeing 737-200"], "737og"),
    ("737-300", "commercial", ["Boeing 737-300", "Boeing 737 Classic"], "737classic"),
    ("737-300 with Winglets", "commercial", ["Boeing 737-300 winglets", "Boeing 737-300"], None),
    ("737-400", "commercial", ["Boeing 737-400", "Boeing 737-400 aircraft"], "737classic"),
    ("737-500", "commercial", ["Boeing 737-500", "Boeing 737-500 aircraft"], "737classic"),

    # Boeing 737NG
    ("737-600", "commercial", ["Boeing 737-600", "Boeing 737 Next Generation"], "737ng"),
    ("737-600 with Winglets", "commercial", ["Boeing 737-600 winglets", "Boeing 737-600"], "737ng-wl"),
    ("737-700/700C", "commercial", ["Boeing 737-700", "Boeing 737-700 aircraft"], "737ng"),
    ("737-700/700C with Winglets", "commercial", ["Boeing 737-700 winglets", "Boeing 737-700"], "737ng-wl"),
    ("737-800", "commercial", ["Boeing 737-800", "Boeing 737-800 aircraft"], "737ng"),
    ("737-800 with Winglets", "commercial", ["Boeing 737-800 winglets", "Boeing 737-800"], "737ng-wl"),
    ("737-900", "commercial", ["Boeing 737-900", "Boeing 737-900 aircraft"], "737ng"),
    ("737-900 with Winglets", "commercial", ["Boeing 737-900 winglets", "Boeing 737-900"], "737ng-wl"),
    ("737-900ER", "commercial", ["Boeing 737-900ER", "Boeing 737-900ER aircraft"], "737ng"),
    ("737-900ER with Winglets", "commercial", ["Boeing 737-900ER winglets", "Boeing 737-900ER"], "737ng-wl"),
    ("737-BBJ", "commercial", ["Boeing BBJ 737", "Boeing Business Jet 737"], "737ng-wl"),
    ("737-BBJ2", "commercial", ["Boeing BBJ2", "Boeing Business Jet 737"], "737ng-wl"),

    # Boeing 747
    ("747-100B/-300", "commercial", ["Boeing 747-100", "Boeing 747 classic"], "747classic"),
    ("747-200B/-200BCombi/-300", "commercial", ["Boeing 747-200", "Boeing 747-200B"], "747classic"),
    ("747-200C/-200F", "commercial", ["Boeing 747-200F freighter", "Boeing 747-200F"], "747classic"),
    ("747-300Combi", "commercial", ["Boeing 747-300", "Boeing 747-300 Combi"], "747classic"),
    ("747-400", "commercial", ["Boeing 747-400", "Boeing 747-400 aircraft"], "747-400"),
    ("747-400 COMBI", "commercial", ["Boeing 747-400 Combi", "Boeing 747-400"], "747-400"),
    ("747-400 Domestic", "commercial", ["Boeing 747-400D", "Boeing 747-400 domestic"], "747-400"),
    ("747-400 Freighter", "commercial", ["Boeing 747-400F freighter", "Boeing 747-400F"], "747-400"),
    ("747-400ER", "commercial", ["Boeing 747-400ER", "Boeing 747-400"], "747-400"),
    ("747-400ER Freighter", "commercial", ["Boeing 747-400ERF", "Boeing 747-400ER Freighter"], "747-400"),
    ("747-8/-8F", "commercial", ["Boeing 747-8", "Boeing 747-8 Intercontinental"], None),
    ("747-SP", "commercial", ["Boeing 747SP", "Boeing 747-SP"], None),

    # Boeing 757
    ("757-200/-200PF", "commercial", ["Boeing 757-200", "Boeing 757"], None),
    ("757-300", "commercial", ["Boeing 757-300", "Boeing 757-300 aircraft"], None),

    # Boeing 767
    ("767-200", "commercial", ["Boeing 767-200", "Boeing 767"], "767"),
    ("767-200ER", "commercial", ["Boeing 767-200ER", "Boeing 767-200"], "767"),
    ("767-300", "commercial", ["Boeing 767-300", "Boeing 767-300 aircraft"], "767"),
    ("767-300 Freighter", "commercial", ["Boeing 767-300F freighter", "Boeing 767-300F"], "767"),
    ("767-300ER", "commercial", ["Boeing 767-300ER", "Boeing 767-300ER aircraft"], "767"),
    ("767-400ER", "commercial", ["Boeing 767-400ER", "Boeing 767-400"], None),

    # Boeing 777
    ("777-200", "commercial", ["Boeing 777-200", "Boeing 777"], "777"),
    ("777-200LR", "commercial", ["Boeing 777-200LR", "Boeing 777-200LR aircraft"], None),
    ("777-300", "commercial", ["Boeing 777-300", "Boeing 777-300 aircraft"], "777"),
    ("777-300ER", "commercial", ["Boeing 777-300ER", "Boeing 777-300ER aircraft"], None),

    # ======================================================================
    # MILITARY AIRCRAFT (127)
    # ======================================================================

    # Attack/Ground Support
    ("AO/A-10-A Thunderbolt II", "military", ["Fairchild A-10 Thunderbolt II", "A-10 Warthog"], None),
    ("AC-130H Spectre Gunship", "military", ["AC-130H Spectre", "AC-130 gunship"], "ac130"),
    ("AC-130U Spooky Gunship", "military", ["AC-130U Spooky", "AC-130U gunship"], "ac130"),
    ("AV-8 Harrier", "military", ["AV-8B Harrier II", "Harrier jump jet"], None),

    # Bombers
    ("B-1B Lancer", "military", ["Rockwell B-1B Lancer", "B-1B Lancer bomber"], None),
    ("B-2A Spirit", "military", ["Northrop B-2 Spirit", "B-2 stealth bomber"], None),
    ("B-52H Stratofortress", "military", ["Boeing B-52 Stratofortress", "B-52H bomber"], None),

    # Cargo/Transport
    ("C-2A Greyhound", "military", ["Grumman C-2 Greyhound", "C-2A Greyhound"], None),
    ("C-5A/B/C Galaxy", "military", ["Lockheed C-5 Galaxy", "C-5 Galaxy aircraft"], None),
    ("C-9A/C Nightingale", "military", ["C-9A Nightingale", "McDonnell Douglas C-9"], None),
    ("C-12 C/D Huron", "military", ["Beechcraft C-12 Huron", "C-12 Huron"], "c12"),
    ("C-12F Huron", "military", ["Beechcraft C-12 Huron", "C-12 Huron"], "c12"),
    ("C-12J Huron", "military", ["Beechcraft C-12 Huron", "C-12J Huron"], "c12"),
    ("C-17A Globemaster III", "military", ["Boeing C-17 Globemaster III", "C-17 aircraft"], None),
    ("C-20A/B/C/D Gulfstream III", "military", ["Gulfstream III C-20", "C-20 Gulfstream USAF"], "c20"),
    ("C-20F/G/H Gulfstream IV", "military", ["Gulfstream IV C-20", "C-20 Gulfstream IV USAF"], None),
    ("C-21A", "military", ["Learjet C-21A", "C-21A USAF Learjet"], None),
    ("C-22B", "military", ["Boeing C-22 727", "C-22B USAF"], None),
    ("C-27J Spartan", "military", ["Alenia C-27J Spartan", "C-27J Spartan aircraft"], None),
    ("C-32A/B", "military", ["Boeing C-32", "C-32A USAF 757"], None),
    ("C-37A Gulfstream V", "military", ["Gulfstream V C-37A", "C-37A USAF"], None),
    ("C-38A Courier", "military", ["C-38A Courier aircraft", "Gulfstream G100 USAF"], None),
    ("C-40A Clipper", "military", ["Boeing C-40 Clipper", "C-40A Clipper Navy"], None),
    ("C-40B/C", "military", ["Boeing C-40B", "C-40B USAF"], None),
    ("C-41A CASA 212", "military", ["CASA C-212 Aviocar", "CASA 212 military"], None),
    ("C-130E/H Hercules", "military", ["Lockheed C-130 Hercules", "C-130H Hercules"], "c130"),
    ("C-130J Hercules", "military", ["Lockheed C-130J Super Hercules", "C-130J"], "c130"),
    ("C-130J-30 Hercules", "military", ["C-130J-30 Super Hercules stretched", "C-130J-30"], None),
    ("C-141C Starlifter", "military", ["Lockheed C-141 Starlifter", "C-141 aircraft"], None),
    ("C-295 CASA", "military", ["CASA C-295", "Airbus C-295 military"], None),
    ("CH-46E Sea Knight", "military", ["Boeing Vertol CH-46 Sea Knight", "CH-46 Sea Knight"], None),
    ("CH-47D/F Chinook", "military", ["Boeing CH-47 Chinook", "CH-47 Chinook helicopter"], None),
    ("CH-53E Super Stallion", "military", ["Sikorsky CH-53E Super Stallion", "CH-53E helicopter"], None),
    ("CN-235 CASA, Ver 1 (Civ)", "military", ["CASA CN-235", "CN-235 aircraft"], "cn235"),
    ("CN-235 CASA, Ver 2 (Mil)", "military", ["CASA CN-235 military", "CN-235 aircraft"], "cn235"),
    ("CN-235 CASA, Ver 3 (Opt Tires)", "military", ["CASA CN-235", "CN-235 aircraft"], "cn235"),
    ("CV-580 Conair/Convair", "military", ["Convair CV-580", "CV-580 aircraft"], None),

    # EW / ISR
    ("E-2C Hawkeye", "military", ["Grumman E-2 Hawkeye", "E-2C Hawkeye aircraft"], None),
    ("E-3B/C Sentry (AWACS)", "military", ["Boeing E-3 Sentry AWACS", "E-3 AWACS aircraft"], None),
    ("E-4B National Airborne Operations Center", "military", ["Boeing E-4 Nightwatch", "E-4B NAOC aircraft"], None),
    ("E-8C Joint STARS", "military", ["Northrop Grumman E-8 Joint STARS", "E-8C JSTARS"], None),
    ("EC-130E Commando Solo", "military", ["EC-130E Commando Solo", "EC-130 Commando Solo"], "c130"),
    ("EC-130H Compass Call", "military", ["EC-130H Compass Call", "EC-130H aircraft"], "c130"),
    ("EC-130J Commando Solo", "military", ["EC-130J Commando Solo", "EC-130J aircraft"], "c130"),
    ("EC-130J Super J", "military", ["EC-130J Super J", "EC-130J aircraft"], "c130"),
    ("EC-135Y", "military", ["Boeing EC-135", "EC-135 aircraft"], "kc135"),
    ("OC-135B Open Skies", "military", ["Boeing OC-135B Open Skies", "OC-135 aircraft"], "kc135"),
    ("RC-12N", "military", ["Beechcraft RC-12 Guardrail", "RC-12 aircraft"], "c12"),
    ("RC-26B", "military", ["Fairchild RC-26B Metroliner", "RC-26B aircraft"], None),
    ("RC-135S Cobra Ball", "military", ["Boeing RC-135 Cobra Ball", "RC-135S aircraft"], "kc135"),
    ("RC-135U Combat Sent", "military", ["Boeing RC-135U Combat Sent", "RC-135 aircraft"], "kc135"),
    ("RC-135V Rivet Joint", "military", ["Boeing RC-135 Rivet Joint", "RC-135V aircraft"], "kc135"),
    ("RC-135W Rivet Joint", "military", ["Boeing RC-135W Rivet Joint", "RC-135 aircraft"], "kc135"),

    # Fighters
    ("AT-38B Talon", "military", ["Northrop T-38 Talon", "T-38 Talon aircraft"], "t38"),
    ("F-4E Phantom II", "military", ["McDonnell Douglas F-4 Phantom II", "F-4E Phantom"], None),
    ("F-5E/F Tiger II", "military", ["Northrop F-5 Tiger II", "F-5E Tiger II"], None),
    ("F-14 Tomcat", "military", ["Grumman F-14 Tomcat", "F-14 Tomcat aircraft"], None),
    ("F-15A Eagle", "military", ["McDonnell Douglas F-15 Eagle", "F-15 Eagle aircraft"], "f15"),
    ("F-15B Eagle", "military", ["McDonnell Douglas F-15 Eagle", "F-15B Eagle"], "f15"),
    ("F-15C Eagle", "military", ["McDonnell Douglas F-15C Eagle", "F-15C aircraft"], "f15"),
    ("F-15D Eagle", "military", ["McDonnell Douglas F-15D Eagle", "F-15D aircraft"], "f15"),
    ("F-15E Strike Eagle", "military", ["Boeing F-15E Strike Eagle", "F-15E Strike Eagle"], None),
    ("F-16A Fighting Falcon", "military", ["General Dynamics F-16 Fighting Falcon", "F-16 aircraft"], "f16"),
    ("F-16B Fighting Falcon", "military", ["General Dynamics F-16B Fighting Falcon", "F-16B"], "f16"),
    ("F-16C Fighting Falcon", "military", ["Lockheed Martin F-16C Fighting Falcon", "F-16C"], "f16"),
    ("F-16D Fighting Falcon", "military", ["Lockheed Martin F-16D Fighting Falcon", "F-16D"], "f16"),
    ("F-22 Raptor", "military", ["Lockheed Martin F-22 Raptor", "F-22 Raptor aircraft"], None),
    ("F-35A Joint Strike Fighter CTOL", "military", ["Lockheed Martin F-35A Lightning II", "F-35A aircraft"], None),
    ("F-35B Joint Strike Fighter STOVL", "military", ["Lockheed Martin F-35B Lightning II", "F-35B STOVL"], None),
    ("F-35C Joint Strike Fighter CV", "military", ["Lockheed Martin F-35C Lightning II", "F-35C carrier"], None),
    ("F-117A Nighthawk", "military", ["Lockheed F-117 Nighthawk", "F-117A stealth"], None),
    ("F/A-18F Super Hornet", "military", ["Boeing F/A-18F Super Hornet", "F-18 Super Hornet"], None),
    ("Tornado GR MK1", "military", ["Panavia Tornado GR1", "Tornado GR4 aircraft"], None),

    # Helicopters
    ("AH-1W/Z Super Cobra/Viper", "military", ["Bell AH-1Z Viper", "AH-1W Super Cobra"], None),
    ("AH-64 Apache Longbow", "military", ["Boeing AH-64 Apache", "AH-64 Apache helicopter"], None),
    ("HH-60G Pave Hawk", "military", ["Sikorsky HH-60 Pave Hawk", "HH-60G Pave Hawk"], "uh60"),
    ("MH-47E Chinook", "military", ["Boeing MH-47 Chinook special operations", "MH-47E Chinook"], None),
    ("MH-53J/M Pave Low (VH-53 is Similar)", "military", ["Sikorsky MH-53 Pave Low", "MH-53J Pave Low"], None),
    ("MH-60K/L/R/S Black Hawk", "military", ["Sikorsky MH-60 Black Hawk", "MH-60 Black Hawk"], "uh60"),
    ("MH/AH-6M Little Bird", "military", ["MD MH-6 Little Bird", "AH-6 Little Bird helicopter"], None),
    ("MV-22 Osprey VSTOL", "military", ["Bell Boeing V-22 Osprey", "MV-22 Osprey tiltrotor"], None),
    ("OH-58D Kiowa", "military", ["Bell OH-58 Kiowa", "OH-58D Kiowa Warrior"], None),
    ("TH-57B/C JetRanger", "military", ["Bell TH-57 Sea Ranger", "TH-57 JetRanger Navy"], None),
    ("TH-67A Creek", "military", ["Bell TH-67 Creek", "TH-67A Creek helicopter"], None),
    ("UH-1H Iroquois", "military", ["Bell UH-1 Iroquois Huey", "UH-1H Huey"], "uh1"),
    ("UH-1N Twin Huey", "military", ["Bell UH-1N Twin Huey", "UH-1N helicopter"], None),
    ("UH-1V Huey", "military", ["Bell UH-1 Iroquois", "UH-1 Huey helicopter"], "uh1"),
    ("UH-72A Lakota", "military", ["Eurocopter UH-72 Lakota", "UH-72A Lakota helicopter"], None),
    ("VH-3D Sea King", "military", ["Sikorsky VH-3D Sea King Marine One", "VH-3D Sea King"], None),

    # Tankers
    ("HC-130P/N Combat Tanker/Combat Shadow", "military", ["HC-130P Combat Shadow", "HC-130 tanker"], "c130"),
    ("KC-10A Extender", "military", ["McDonnell Douglas KC-10 Extender", "KC-10 tanker"], None),
    ("KC-135E Stratotanker", "military", ["Boeing KC-135 Stratotanker", "KC-135 tanker"], "kc135"),
    ("KC-135R/T Stratotanker", "military", ["Boeing KC-135R Stratotanker", "KC-135R tanker"], "kc135"),
    ("KC-46 Pegasus", "military", ["Boeing KC-46 Pegasus", "KC-46A Pegasus tanker"], None),

    # Special Operations
    ("LC-130H Hercules", "military", ["Lockheed LC-130 Hercules ski", "LC-130H ski aircraft"], None),
    ("M-28A Skytruck", "military", ["PZL M-28 Skytruck", "M-28 Skytruck aircraft"], None),
    ("MC-130E Combat Talon I", "military", ["Lockheed MC-130 Combat Talon", "MC-130E aircraft"], "c130"),
    ("MC-130H Combat Talon II", "military", ["Lockheed MC-130H Combat Talon II", "MC-130H"], "c130"),
    ("MC-130P Combat Shadow", "military", ["MC-130P Combat Shadow", "MC-130P aircraft"], "c130"),

    # Recon/Special
    ("SR-71A Blackbird", "military", ["Lockheed SR-71 Blackbird", "SR-71 aircraft"], None),
    ("U-2S Dragon Lady", "military", ["Lockheed U-2 Dragon Lady", "U-2S reconnaissance"], None),
    ("U-28A", "military", ["Pilatus PC-12 USAF U-28A", "U-28A Pilatus PC-12"], None),
    ("WC-130H Hercules", "military", ["WC-130H Hercules weather", "WC-130 aircraft"], "c130"),
    ("WC-130J Hercules", "military", ["WC-130J Hercules weather", "WC-130J aircraft"], "c130"),
    ("WC-135C Constant Phoenix", "military", ["Boeing WC-135 Constant Phoenix", "WC-135 aircraft"], "kc135"),
    ("WC-135W Constant Phoenix", "military", ["Boeing WC-135 Constant Phoenix", "WC-135W"], "kc135"),

    # Trainers
    ("T-1A Jayhawk", "military", ["Raytheon T-1A Jayhawk", "T-1A Jayhawk USAF"], None),
    ("T-6A Texan II", "military", ["Beechcraft T-6 Texan II", "T-6A Texan II trainer"], None),
    ("T-37B Tweet", "military", ["Cessna T-37 Tweet", "T-37B Tweet aircraft"], None),
    ("T-38A/C Talon", "military", ["Northrop T-38 Talon", "T-38 Talon trainer"], "t38"),
    ("T-43A", "military", ["Boeing T-43 aircraft", "T-43A USAF 737"], None),
    ("T-45A Goshawk", "military", ["Boeing T-45 Goshawk", "T-45A Goshawk trainer"], None),

    # VIP
    ("VC-25A Air Force One", "military", ["Boeing VC-25 Air Force One", "VC-25A Air Force One"], None),

    # UAS/Drones
    ("MQ-1B Predator", "military", ["General Atomics MQ-1 Predator", "MQ-1 Predator drone"], None),
    ("MQ-1C Gray Eagle", "military", ["General Atomics MQ-1C Gray Eagle", "MQ-1C Gray Eagle UAS"], None),
    ("MQ-5B Hunter", "military", ["Northrop Grumman MQ-5B Hunter", "RQ-5 Hunter UAV"], None),
    ("MQ-8 Fire Scout", "military", ["Northrop Grumman MQ-8 Fire Scout", "MQ-8 Fire Scout UAV"], None),
    ("MQ-9A Reaper", "military", ["General Atomics MQ-9 Reaper", "MQ-9 Reaper drone"], None),
    ("RQ-4A Global Hawk Blk 10", "military", ["Northrop Grumman RQ-4 Global Hawk", "RQ-4 Global Hawk"], "rq4"),
    ("RQ-4B Global Hawk Blk 20+", "military", ["Northrop Grumman RQ-4B Global Hawk", "RQ-4B Global Hawk"], "rq4"),
    ("RQ-7A/B Shadow 200", "military", ["AAI RQ-7 Shadow", "RQ-7 Shadow 200 UAV"], None),

    # Foreign Military
    ("AN-124 Ruslan", "military", ["Antonov An-124 Ruslan", "An-124 aircraft"], None),
    ("IL-76MD Candid B", "military", ["Ilyushin Il-76 aircraft", "Il-76MD Candid"], "il76"),
    ("IL-76MF Candid (Stretched)", "military", ["Ilyushin Il-76MF stretched", "Il-76MF aircraft"], None),
    ("IL-76T Candid A", "military", ["Ilyushin Il-76 aircraft", "Il-76T Candid"], "il76"),
    ("IL-76TD Candid A", "military", ["Ilyushin Il-76TD", "Il-76 cargo aircraft"], "il76"),

    # Other
    ("Space Shuttle Orbiter", "military", ["Space Shuttle Orbiter", "NASA Space Shuttle landing"], None),
]


# ---------------------------------------------------------------------------
# API Helper Functions
# ---------------------------------------------------------------------------

def api_request(url: str, params: dict) -> Optional[dict]:
    """Make a GET request to a MediaWiki API endpoint."""
    params["format"] = "json"
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    req = urllib.request.Request(full_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f"    API error: {e}")
        return None


def search_commons_images(query: str, limit: int = 5) -> list[dict]:
    """
    Search Wikimedia Commons for images matching query.
    Returns list of {title, pageid} for File: pages.
    """
    params = {
        "action": "query",
        "generator": "search",
        "gsrnamespace": "6",  # File namespace
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": str(MAX_IMAGE_WIDTH),
    }
    data = api_request(COMMONS_API, params)
    if not data or "query" not in data:
        return []

    pages = data["query"].get("pages", {})
    results = []
    for pid, page in pages.items():
        if int(pid) < 0:
            continue
        ii = page.get("imageinfo", [{}])[0]
        title = page.get("title", "")
        url = ii.get("thumburl") or ii.get("url", "")
        mime = ii.get("mime", "")
        width = ii.get("width", 0)
        height = ii.get("height", 0)
        desc_url = ii.get("descriptionurl", "")

        # Extract license info
        ext = ii.get("extmetadata", {})
        license_short = ext.get("LicenseShortName", {}).get("value", "unknown")

        if url and "image/" in mime:
            results.append({
                "title": title,
                "url": url,
                "desc_url": desc_url,
                "mime": mime,
                "width": width,
                "height": height,
                "license": license_short,
            })

    # Prefer landscape images, larger, and JPEG/PNG
    def score(r):
        s = 0
        if r["width"] > r["height"]:
            s += 100  # Landscape preferred
        if r["width"] >= 800:
            s += 50
        if ".jpg" in r["url"].lower() or ".jpeg" in r["url"].lower():
            s += 20
        if "public domain" in r["license"].lower() or "pd" in r["license"].lower():
            s += 30  # Prefer public domain
        elif "cc" in r["license"].lower():
            s += 15
        return s

    results.sort(key=score, reverse=True)
    return results


def try_wikipedia_image(query: str) -> Optional[dict]:
    """
    Fallback: try to get the main image from the Wikipedia article.
    """
    params = {
        "action": "query",
        "titles": query,
        "prop": "pageimages",
        "piprop": "original|name",
        "pilimit": "1",
    }
    data = api_request(WIKIPEDIA_API, params)
    if not data or "query" not in data:
        return None

    pages = data["query"].get("pages", {})
    for pid, page in pages.items():
        if int(pid) < 0:
            continue
        orig = page.get("original", {})
        if orig.get("source"):
            return {
                "title": page.get("pageimage", ""),
                "url": orig["source"],
                "desc_url": "",
                "mime": f"image/{orig.get('source', '').split('.')[-1]}",
                "width": orig.get("width", 0),
                "height": orig.get("height", 0),
                "license": "see Wikipedia",
            }
    return None


def download_image(url: str, filepath: Path) -> bool:
    """Download an image from URL to local file."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            filepath.parent.mkdir(parents=True, exist_ok=True)
            with open(filepath, "wb") as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"    Download failed: {e}")
        return False


def sanitize_filename(name: str) -> str:
    """Convert aircraft name to safe filename."""
    # Replace common problem characters
    name = name.replace("/", "-").replace("\\", "-")
    name = name.replace(", ", "_").replace(",", "_")
    name = name.replace(" ", "_")
    name = re.sub(r'[^\w\-.]', '', name)
    name = re.sub(r'_+', '_', name)
    return name


# ---------------------------------------------------------------------------
# Main Scraper Logic
# ---------------------------------------------------------------------------

def scrape_all():
    """Main entry point — scrape images for all aircraft."""
    manifest = {}
    failures = []
    dedup_cache = {}  # group_name -> (image_path, metadata)

    # Create output dirs
    (OUTPUT_DIR / "commercial").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "military").mkdir(parents=True, exist_ok=True)

    total = len(AIRCRAFT_DATABASE)
    print(f"\n{'='*60}")
    print(f"Aircraft Image Scraper — {total} aircraft to process")
    print(f"Output: {OUTPUT_DIR.resolve()}")
    print(f"Dry run: {DRY_RUN}")
    print(f"{'='*60}\n")

    for idx, (aircraft_name, category, queries, dedup_group) in enumerate(AIRCRAFT_DATABASE, 1):
        safe_name = sanitize_filename(aircraft_name)
        print(f"[{idx}/{total}] {aircraft_name}")

        # Check dedup cache first
        if dedup_group and dedup_group in dedup_cache:
            src_path, src_meta = dedup_cache[dedup_group]
            ext = src_path.suffix
            dest_path = OUTPUT_DIR / category / f"{safe_name}{ext}"

            if not DRY_RUN and src_path.exists():
                # Copy the file
                import shutil
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_path, dest_path)

            manifest[aircraft_name] = {
                "filename": f"{category}/{safe_name}{ext}",
                "source_url": src_meta["url"],
                "source_page": src_meta.get("desc_url", ""),
                "license": src_meta.get("license", "unknown"),
                "dedup_from": src_meta.get("original_aircraft", ""),
                "category": category,
            }
            print(f"    -> Dedup from group '{dedup_group}' ({src_meta.get('original_aircraft', '')})")
            continue

        # Try each search query
        found = False
        for q in queries:
            print(f"    Searching: '{q}'")
            results = search_commons_images(q, limit=5)

            if results:
                best = results[0]
                ext = ".jpg"
                url_lower = best["url"].lower()
                if ".png" in url_lower:
                    ext = ".png"
                elif ".jpeg" in url_lower:
                    ext = ".jpg"

                filepath = OUTPUT_DIR / category / f"{safe_name}{ext}"

                if DRY_RUN:
                    print(f"    [DRY RUN] Would download: {best['url'][:80]}...")
                    print(f"    License: {best['license']} | {best['width']}x{best['height']}")
                    success = True
                else:
                    success = download_image(best["url"], filepath)

                if success:
                    meta = {
                        "url": best["url"],
                        "desc_url": best.get("desc_url", ""),
                        "license": best.get("license", "unknown"),
                        "width": best.get("width", 0),
                        "height": best.get("height", 0),
                        "original_aircraft": aircraft_name,
                    }
                    manifest[aircraft_name] = {
                        "filename": f"{category}/{safe_name}{ext}",
                        "source_url": best["url"],
                        "source_page": best.get("desc_url", ""),
                        "license": best.get("license", "unknown"),
                        "category": category,
                    }
                    # Cache for dedup
                    if dedup_group:
                        dedup_cache[dedup_group] = (filepath, meta)

                    print(f"    -> Saved: {filepath.name} ({best['license']})")
                    found = True
                    break

            time.sleep(DELAY_SECONDS)

        # Fallback: try Wikipedia article image
        if not found:
            print(f"    Commons failed, trying Wikipedia fallback...")
            for q in queries[:1]:
                wp_result = try_wikipedia_image(q)
                if wp_result:
                    ext = ".jpg"
                    if ".png" in wp_result["url"].lower():
                        ext = ".png"

                    filepath = OUTPUT_DIR / category / f"{safe_name}{ext}"

                    if DRY_RUN:
                        print(f"    [DRY RUN] Wikipedia: {wp_result['url'][:80]}...")
                        success = True
                    else:
                        success = download_image(wp_result["url"], filepath)

                    if success:
                        meta = {
                            "url": wp_result["url"],
                            "desc_url": wp_result.get("desc_url", ""),
                            "license": wp_result.get("license", "see Wikipedia"),
                            "original_aircraft": aircraft_name,
                        }
                        manifest[aircraft_name] = {
                            "filename": f"{category}/{safe_name}{ext}",
                            "source_url": wp_result["url"],
                            "source_page": "Wikipedia",
                            "license": wp_result.get("license", "see Wikipedia"),
                            "category": category,
                        }
                        if dedup_group:
                            dedup_cache[dedup_group] = (filepath, meta)
                        print(f"    -> Wikipedia fallback saved: {filepath.name}")
                        found = True
                        break

                time.sleep(DELAY_SECONDS)

        if not found:
            failures.append({
                "aircraft": aircraft_name,
                "category": category,
                "queries_tried": queries,
            })
            print(f"    !! FAILED — no image found")

    # Write manifest
    manifest_path = OUTPUT_DIR / "image_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written: {manifest_path}")

    # Write failures
    failures_path = OUTPUT_DIR / "failures.json"
    with open(failures_path, "w") as f:
        json.dump(failures, f, indent=2)
    print(f"Failures written: {failures_path}")

    # Summary
    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"  Total aircraft: {total}")
    print(f"  Images found:   {len(manifest)}")
    print(f"  Failures:       {len(failures)}")
    print(f"  Dedup groups:   {len(dedup_cache)} groups saved downloads")
    print(f"{'='*60}")

    if failures:
        print(f"\nFailed aircraft (need manual images):")
        for f_item in failures:
            print(f"  - {f_item['aircraft']} ({f_item['category']})")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape aircraft images from Wikimedia Commons")
    parser.add_argument("--dry-run", action="store_true", help="Test searches without downloading")
    parser.add_argument("--output-dir", type=str, default="./aircraft_images", help="Output directory")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    DRY_RUN = args.dry_run
    OUTPUT_DIR = Path(args.output_dir)
    DELAY_SECONDS = args.delay

    scrape_all()
