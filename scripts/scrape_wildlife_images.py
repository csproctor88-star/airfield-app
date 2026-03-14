#!/usr/bin/env python3
"""
Download wildlife species images for offline use.

Sources (in priority order):
  1. USFWS Digital Media Library (public domain, U.S. Government work)
  2. Wikimedia Commons API (CC-licensed, proper API — not page scraping)
  3. iNaturalist API (CC-licensed, no API key needed)

Follows the same pattern as scrape_aircraft_images.py:
  - Downloads images to /public/wildlife_images/{group}/
  - Generates /public/wildlife_image_manifest.json
  - wildlife-species-data.ts resolveWildlifeImage() picks up the local path

Usage:
    python scripts/scrape_wildlife_images.py
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────

IIIF_BASE = "https://digitalmedia.fws.gov/digital/iiif/natdiglib"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
INAT_API = "https://api.inaturalist.org/v1"

USER_AGENT = "GlidepathApp/1.0 (wildlife-image-downloader; airfield-safety-app)"

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
    # ── Additional species (comprehensive BASH coverage) ──
    # Swans
    ("Mute Swan", "Cygnus olor", "bird", None),
    ("Tundra Swan", "Cygnus columbianus", "bird", None),
    ("Trumpeter Swan", "Cygnus buccinator", "bird", None),
    # Additional Geese
    ("Greater White-fronted Goose", "Anser albifrons", "bird", None),
    ("Cackling Goose", "Branta hutchinsii", "bird", None),
    ("Ross's Goose", "Anser rossii", "bird", None),
    ("Hawaiian Goose (Nene)", "Branta sandvicensis", "bird", None),
    # Additional Raptors
    ("Golden Eagle", "Aquila chrysaetos", "bird", None),
    ("Ferruginous Hawk", "Buteo regalis", "bird", None),
    ("Rough-legged Hawk", "Buteo lagopus", "bird", None),
    ("Swainson's Hawk", "Buteo swainsoni", "bird", None),
    ("Broad-winged Hawk", "Buteo platypterus", "bird", None),
    ("Harris's Hawk", "Parabuteo unicinctus", "bird", None),
    ("White-tailed Hawk", "Geranoaetus albicaudatus", "bird", None),
    ("Sharp-shinned Hawk", "Accipiter striatus", "bird", None),
    ("Crested Caracara", "Caracara plancus", "bird", None),
    ("Merlin", "Falco columbarius", "bird", None),
    ("Prairie Falcon", "Falco mexicanus", "bird", None),
    # Additional Owls
    ("Barred Owl", "Strix varia", "bird", None),
    ("Burrowing Owl", "Athene cunicularia", "bird", None),
    ("Eastern Screech-Owl", "Megascops asio", "bird", None),
    ("Long-eared Owl", "Asio otus", "bird", None),
    ("Great Gray Owl", "Strix nebulosa", "bird", None),
    # Additional Herons/Egrets/Wading Birds
    ("Snowy Egret", "Egretta thula", "bird", None),
    ("Little Blue Heron", "Egretta caerulea", "bird", None),
    ("Tricolored Heron", "Egretta tricolor", "bird", None),
    ("Yellow-crowned Night-Heron", "Nyctanassa violacea", "bird", None),
    ("White Ibis", "Eudocimus albus", "bird", None),
    ("Glossy Ibis", "Plegadis falcinellus", "bird", None),
    ("White-faced Ibis", "Plegadis chihi", "bird", None),
    ("Roseate Spoonbill", "Platalea ajaja", "bird", None),
    ("Wood Stork", "Mycteria americana", "bird", None),
    ("Anhinga", "Anhinga anhinga", "bird", None),
    # Other Water Birds
    ("American Coot", "Fulica americana", "bird", None),
    ("Common Loon", "Gavia immer", "bird", None),
    ("Whooping Crane", "Grus americana", "bird", None),
    # Additional Waterfowl
    ("Gadwall", "Mareca strepera", "bird", None),
    ("American Wigeon", "Mareca americana", "bird", None),
    ("Northern Shoveler", "Spatula clypeata", "bird", None),
    ("Canvasback", "Aythya valisineria", "bird", None),
    ("Redhead", "Aythya americana", "bird", None),
    ("Ring-necked Duck", "Aythya collaris", "bird", None),
    ("Lesser Scaup", "Aythya affinis", "bird", None),
    ("Greater Scaup", "Aythya marila", "bird", None),
    ("Bufflehead", "Bucephala albeola", "bird", None),
    ("Common Goldeneye", "Bucephala clangula", "bird", None),
    ("Hooded Merganser", "Lophodytes cucullatus", "bird", None),
    ("Common Merganser", "Mergus merganser", "bird", None),
    ("Red-breasted Merganser", "Mergus serrator", "bird", None),
    ("Ruddy Duck", "Oxyura jamaicensis", "bird", None),
    # Additional Gulls/Terns
    ("California Gull", "Larus californicus", "bird", None),
    ("Western Gull", "Larus occidentalis", "bird", None),
    ("Glaucous-winged Gull", "Larus glaucescens", "bird", None),
    ("Glaucous Gull", "Larus hyperboreus", "bird", None),
    ("Iceland Gull", "Larus glaucoides", "bird", None),
    ("Lesser Black-backed Gull", "Larus fuscus", "bird", None),
    ("Franklin's Gull", "Leucophaeus pipixcan", "bird", None),
    ("Royal Tern", "Thalasseus maximus", "bird", None),
    ("Caspian Tern", "Hydroprogne caspia", "bird", None),
    ("Common Tern", "Sterna hirundo", "bird", None),
    ("Least Tern", "Sternula antillarum", "bird", None),
    ("Forster's Tern", "Sterna forsteri", "bird", None),
    ("Black Skimmer", "Rynchops niger", "bird", None),
    # Additional Shorebirds
    ("Willet", "Tringa semipalmata", "bird", None),
    ("Greater Yellowlegs", "Tringa melanoleuca", "bird", None),
    ("Lesser Yellowlegs", "Tringa flavipes", "bird", None),
    ("Spotted Sandpiper", "Actitis macularius", "bird", None),
    ("Least Sandpiper", "Calidris minutilla", "bird", None),
    ("Dunlin", "Calidris alpina", "bird", None),
    ("Long-billed Curlew", "Numenius americanus", "bird", None),
    ("Marbled Godwit", "Limosa fedoa", "bird", None),
    ("American Avocet", "Recurvirostra americana", "bird", None),
    ("Black-necked Stilt", "Himantopus mexicanus", "bird", None),
    ("Black-bellied Plover", "Pluvialis squatarola", "bird", None),
    ("American Golden-Plover", "Pluvialis dominica", "bird", None),
    ("Piping Plover", "Charadrius melodus", "bird", None),
    # Corvids/Blackbirds/Medium Birds
    ("Fish Crow", "Corvus ossifragus", "bird", None),
    ("Common Raven", "Corvus corax", "bird", None),
    ("Black-billed Magpie", "Pica hudsonia", "bird", None),
    ("Brewer's Blackbird", "Euphagus cyanocephalus", "bird", None),
    ("Western Meadowlark", "Sturnella neglecta", "bird", None),
    ("Yellow-headed Blackbird", "Xanthocephalus xanthocephalus", "bird", None),
    ("Rusty Blackbird", "Euphagus carolinus", "bird", None),
    ("Western Kingbird", "Tyrannus verticalis", "bird", None),
    ("Eastern Kingbird", "Tyrannus tyrannus", "bird", None),
    ("Say's Phoebe", "Sayornis saya", "bird", None),
    ("Eastern Phoebe", "Sayornis phoebe", "bird", None),
    ("Belted Kingfisher", "Megaceryle alcyon", "bird", None),
    ("Red-bellied Woodpecker", "Melanerpes carolinus", "bird", None),
    ("Downy Woodpecker", "Dryobates pubescens", "bird", None),
    ("Red-headed Woodpecker", "Melanerpes erythrocephalus", "bird", None),
    # Small Songbirds
    ("Western Bluebird", "Sialia mexicana", "bird", None),
    ("Mountain Bluebird", "Sialia currucoides", "bird", None),
    ("Vesper Sparrow", "Pooecetes gramineus", "bird", None),
    ("Grasshopper Sparrow", "Ammodramus savannarum", "bird", None),
    ("Lark Sparrow", "Chondestes grammacus", "bird", None),
    ("White-crowned Sparrow", "Zonotrichia leucophrys", "bird", None),
    ("Dark-eyed Junco", "Junco hyemalis", "bird", None),
    ("Dickcissel", "Spiza americana", "bird", None),
    ("Bobolink", "Dolichonyx oryzivorus", "bird", None),
    ("American Pipit", "Anthus rubescens", "bird", None),
    ("Bank Swallow", "Riparia riparia", "bird", None),
    ("Northern Rough-winged Swallow", "Stelgidopteryx serripennis", "bird", None),
    ("Ruby-throated Hummingbird", "Archilochus colubris", "bird", None),
    ("Snow Bunting", "Plectrophenax nivalis", "bird", None),
    ("Lapland Longspur", "Calcarius lapponicus", "bird", None),
    # Additional Gamebirds
    ("Greater Sage-Grouse", "Centrocercus urophasianus", "bird", None),
    ("Greater Prairie-Chicken", "Tympanuchus cupido", "bird", None),
    ("California Quail", "Callipepla californica", "bird", None),
    ("Gambel's Quail", "Callipepla gambelii", "bird", None),
    ("Scaled Quail", "Callipepla squamata", "bird", None),
    ("Chukar", "Alectoris chukar", "bird", None),
    ("Gray Partridge", "Perdix perdix", "bird", None),
    ("Greater Roadrunner", "Geococcyx californianus", "bird", None),
    # Alaska/Hawaii/Overseas
    ("Laysan Albatross", "Phoebastria immutabilis", "bird", None),
    ("Black-footed Albatross", "Phoebastria nigripes", "bird", None),
    ("Short-tailed Albatross", "Phoebastria albatrus", "bird", None),
    ("Wedge-tailed Shearwater", "Ardenna pacifica", "bird", None),
    ("Common Myna", "Acridotheres tristis", "bird", None),
    ("Pacific Golden-Plover", "Pluvialis fulva", "bird", None),
    ("Rock Ptarmigan", "Lagopus muta", "bird", None),
    ("Steller's Sea-Eagle", "Haliaeetus pelagicus", "bird", None),
    # Additional Mammals — Large
    ("Elk", "Cervus canadensis", "mammal", None),
    ("Moose", "Alces alces", "mammal", None),
    ("American Black Bear", "Ursus americanus", "mammal", None),
    ("Bobcat", "Lynx rufus", "mammal", None),
    ("Feral Dog", "Canis lupus familiaris", "mammal", None),
    ("Feral Cat", "Felis catus", "mammal", None),
    ("Javelina (Collared Peccary)", "Pecari tajacu", "mammal", None),
    ("American Bison", "Bison bison", "mammal", None),
    ("Caribou", "Rangifer tarandus", "mammal", None),
    ("Mountain Lion", "Puma concolor", "mammal", None),
    ("Kit Fox", "Vulpes macrotis", "mammal", None),
    ("Swift Fox", "Vulpes velox", "mammal", None),
    ("Arctic Fox", "Vulpes lagopus", "mammal", None),
    ("American Badger", "Taxidea taxus", "mammal", None),
    # Additional Mammals — Small/Medium
    ("Desert Cottontail", "Sylvilagus audubonii", "mammal", None),
    ("Black-tailed Jackrabbit", "Lepus californicus", "mammal", None),
    ("White-tailed Jackrabbit", "Lepus townsendii", "mammal", None),
    ("Snowshoe Hare", "Lepus americanus", "mammal", None),
    ("Nutria (Coypu)", "Myocastor coypus", "mammal", None),
    ("Muskrat", "Ondatra zibethicus", "mammal", None),
    ("American Beaver", "Castor canadensis", "mammal", None),
    ("Fox Squirrel", "Sciurus niger", "mammal", None),
    ("Eastern Gray Squirrel", "Sciurus carolinensis", "mammal", None),
    ("Rock Squirrel", "Otospermophilus variegatus", "mammal", None),
    ("Richardson's Ground Squirrel", "Urocitellus richardsonii", "mammal", None),
    ("California Ground Squirrel", "Otospermophilus beecheyi", "mammal", None),
    ("White-tailed Prairie Dog", "Cynomys leucurus", "mammal", None),
    ("Gunnison's Prairie Dog", "Cynomys gunnisoni", "mammal", None),
    ("Long-tailed Weasel", "Mustela frenata", "mammal", None),
    ("Small Indian Mongoose", "Urva auropunctata", "mammal", None),
    # Additional Reptiles
    ("Gopher Tortoise", "Gopherus polyphemus", "reptile", None),
    ("Desert Tortoise", "Gopherus agassizii", "reptile", None),
    ("Eastern Diamondback Rattlesnake", "Crotalus adamanteus", "reptile", None),
    ("Western Diamondback Rattlesnake", "Crotalus atrox", "reptile", None),
    ("Cottonmouth", "Agkistrodon piscivorus", "reptile", None),
    ("Black Racer", "Coluber constrictor", "reptile", None),
    ("Gopher Snake", "Pituophis catenifer", "reptile", None),
    ("Green Iguana", "Iguana iguana", "reptile", None),
    ("American Crocodile", "Crocodylus acutus", "reptile", None),
    ("Red-eared Slider", "Trachemys scripta elegans", "reptile", None),
    ("Painted Turtle", "Chrysemys picta", "reptile", None),
    # Additional Bats
    ("Silver-haired Bat", "Lasionycteris noctivagans", "bat", None),
    ("Tri-colored Bat", "Perimyotis subflavus", "bat", None),
    ("Evening Bat", "Nycticeius humeralis", "bat", None),
    ("Indiana Bat", "Myotis sodalis", "bat", None),
    ("Northern Long-eared Bat", "Myotis septentrionalis", "bat", None),
    ("Pallid Bat", "Antrozous pallidus", "bat", None),
    ("Cave Myotis", "Myotis velifer", "bat", None),
    ("Western Small-footed Myotis", "Myotis ciliolabrum", "bat", None),
    ("Townsend's Big-eared Bat", "Corynorhinus townsendii", "bat", None),
]


def safe_filename(name: str) -> str:
    """Sanitize species name for use as filename."""
    return re.sub(r'[^a-z0-9_]', '', name.lower().replace(' ', '_').replace('-', '_').replace("'", ''))


def download_image(url: str, dest: Path, timeout: int = 30) -> bool:
    """Download an image URL to dest. Returns True on success."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
            # Reject HTML error pages
            if "text/html" in content_type or data[:20].lower().startswith((b"<!doctype", b"<html")):
                return False
            if len(data) < 500:
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True
    except Exception:
        return False


def download_usfws(natdiglib_id: int, dest: Path) -> str | None:
    """Download image from USFWS IIIF endpoint. Returns source URL or None."""
    url = f"{IIIF_BASE}/{natdiglib_id}/full/800,/0/default.jpg"
    if download_image(url, dest):
        return url
    print(f"    ! USFWS download failed")
    return None


def download_commons_image(scientific_name: str, common_name: str, dest: Path) -> tuple[str, str] | None:
    """
    Search Wikimedia Commons API for species image.
    Uses the proper API endpoint (not Wikipedia page scraping).
    Returns (source_url, page_url) or None.
    """
    # Try scientific name first, then common name
    for search_term in [scientific_name, common_name]:
        params = urllib.parse.urlencode({
            "action": "query",
            "generator": "search",
            "gsrnamespace": "6",  # File namespace
            "gsrsearch": f"{search_term} animal",
            "gsrlimit": "5",
            "prop": "imageinfo",
            "iiprop": "url|size|mime",
            "iiurlwidth": "800",
            "format": "json",
        })
        url = f"{COMMONS_API}?{params}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())

            pages = data.get("query", {}).get("pages", {})
            if not pages:
                continue

            # Find best image: prefer JPEG, reasonable size
            best = None
            for page_id, page in pages.items():
                info_list = page.get("imageinfo", [])
                if not info_list:
                    continue
                info = info_list[0]
                mime = info.get("mime", "")
                if "image" not in mime:
                    continue
                # Prefer the resized thumb URL if available
                thumb_url = info.get("thumburl") or info.get("url")
                page_url = info.get("descriptionurl", "")
                if thumb_url:
                    best = (thumb_url, page_url)
                    break  # take first good result

            if best:
                thumb_url, page_url = best
                if download_image(thumb_url, dest):
                    return (thumb_url, page_url)

        except Exception as e:
            print(f"    ! Commons API error: {e}")
            continue

    return None


def download_inaturalist_image(scientific_name: str, dest: Path) -> tuple[str, str] | None:
    """
    Search iNaturalist API for species photo.
    Returns (photo_url, taxa_page_url) or None.
    """
    # Skip generic "spp." entries
    if "spp." in scientific_name:
        return None

    params = urllib.parse.urlencode({
        "q": scientific_name,
        "per_page": "3",
        "is_active": "true",
    })
    url = f"{INAT_API}/taxa?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        results = data.get("results", [])
        for taxon in results:
            # Match on scientific name (case-insensitive)
            taxon_name = taxon.get("name", "")
            if taxon_name.lower() != scientific_name.lower():
                # Also check if our name is a subspecies match
                if not scientific_name.lower().startswith(taxon_name.lower()):
                    continue

            photo = taxon.get("default_photo")
            if not photo:
                continue

            # Use medium_url (500px) or original
            photo_url = photo.get("medium_url") or photo.get("url")
            if not photo_url:
                continue

            # Upgrade to larger size: replace "medium" with "large" in URL (iNat convention)
            photo_url_large = photo_url.replace("/medium.", "/large.").replace("square.", "large.")

            taxa_url = f"https://www.inaturalist.org/taxa/{taxon.get('id', '')}"

            if download_image(photo_url_large, dest):
                return (photo_url_large, taxa_url)
            # Fallback to medium if large fails
            if download_image(photo_url, dest):
                return (photo_url, taxa_url)

    except Exception as e:
        print(f"    ! iNaturalist API error: {e}")

    return None


def main():
    print("=" * 60)
    print("Wildlife Species Image Downloader")
    print("Sources: USFWS > Wikimedia Commons > iNaturalist")
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
            print(f"  [skip] {common_name} (already downloaded)")
            continue

        print(f"  >> {common_name} ({scientific_name})...")

        source_url = None
        source_page = ""
        license_info = ""

        # 1. Try USFWS first
        if natdiglib_id is not None:
            source_url = download_usfws(natdiglib_id, dest)
            if source_url:
                source_page = f"https://digitalmedia.fws.gov/digital/collection/natdiglib/id/{natdiglib_id}"
                license_info = "Public Domain (U.S. Government Work)"

        # 2. Fallback: Wikimedia Commons API
        if source_url is None:
            print(f"    -> Trying Wikimedia Commons...")
            result = download_commons_image(scientific_name, common_name, dest)
            if result:
                source_url, source_page = result
                license_info = "CC BY-SA (Wikimedia Commons)"

        # 3. Fallback: iNaturalist
        if source_url is None:
            print(f"    -> Trying iNaturalist...")
            result = download_inaturalist_image(scientific_name, dest)
            if result:
                source_url, source_page = result
                license_info = "CC (iNaturalist)"

        if source_url and dest.exists():
            manifest[common_name] = {
                "filename": rel_path,
                "source_url": source_url,
                "source_page": source_page,
                "license": license_info,
                "group": group,
            }
            size_kb = dest.stat().st_size / 1024
            print(f"    OK ({size_kb:.0f} KB) [{license_info}]")
            success += 1
        else:
            print(f"    FAIL - no image available")
            failed += 1

        # Be polite — 1.5s between requests
        time.sleep(1.5)

    # Write manifest
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    print()
    print("=" * 60)
    print(f"Done! {success} new, {skipped} skipped, {failed} failed")
    print(f"Total in manifest: {len(manifest)}")
    print(f"Images: {IMAGE_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
