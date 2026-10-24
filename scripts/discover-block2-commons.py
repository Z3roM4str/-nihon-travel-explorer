#!/usr/bin/env python3
"""Block 2 — Commons candidate discovery with objective identification evidence.

Usage:
    python3 scripts/discover-block2-commons.py JP-080 [JP-019 ...] [--limit 8] [--search "text"]

For each place id this searches Wikimedia Commons and prints, per candidate, the evidence a
human reviewer needs to accept or reject it **before** anything is downloaded:

* licence and credit, already filtered to the pipeline's allowlist;
* pixel dimensions and mime;
* the file's own GPS coordinates where Commons has them, and the great-circle distance to the
  place's coordinates in `data/places.json`;
* the categories Commons filed it under, which is how Commons itself asserts subject identity;
* the description text.

The distance column is the point. A filename can say anything; a photograph taken 40 km from
the place it claims to show is not that place. Nothing here decides — it assembles evidence so
the reviewer can, and it never writes a metadata record or downloads an asset.
"""
import argparse
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PLACES_PATH = REPO_ROOT / "data" / "places.json"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyPipeline/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; travel-planning app, "
    "non-commercial; Block 2 photography discovery)"
)
# Mirrors SUPPORTED_LICENSES in scripts/validate-photography.py. A candidate outside it is
# filtered out here rather than discovered and rejected later.
ALLOWED_LICENCES = {
    "CC0", "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
LICENCE_ALIASES = {"cc0 1.0": "CC0", "cc-zero": "CC0", "public domain": None}


def api(params):
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=40) as resp:
        return json.load(resp)


def haversine_km(a_lat, a_lng, b_lat, b_lng):
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def strip_html(value):
    out, depth = [], 0
    for ch in value or "":
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return " ".join("".join(out).split())


def normalise_licence(raw):
    if not raw:
        return None
    text = strip_html(raw).strip()
    if text in ALLOWED_LICENCES:
        return text
    lowered = text.lower()
    if lowered in LICENCE_ALIASES:
        return LICENCE_ALIASES[lowered]
    # "CC BY-SA 4.0 International" and similar suffixed spellings
    for allowed in ALLOWED_LICENCES:
        if lowered.startswith(allowed.lower()):
            return allowed
    return None


def search(term, limit):
    data = api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": term, "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo|categories", "cllimit": "20",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "800",
    })
    pages = data.get("query", {}).get("pages", {})
    return sorted(pages.values(), key=lambda p: p.get("index", 999))


def report(place, term, limit):
    print(f"\n{'=' * 78}")
    print(f"{place['id']}  {place['name']}  [{place['grade']} · {place['tourismLevel']} · {place['hub']}]")
    print(f"  place coords : {place['coordinates']['lat']:.5f}, {place['coordinates']['lng']:.5f}")
    print(f"  search       : {term!r}")
    print(f"{'=' * 78}")

    for page in search(term, limit):
        infos = page.get("imageinfo")
        if not infos:
            continue
        info = infos[0]
        meta = info.get("extmetadata", {})
        licence = normalise_licence(meta.get("LicenseShortName", {}).get("value"))
        if not licence:
            continue
        if not (info.get("mime") or "").startswith("image/"):
            continue

        lat = meta.get("GPSLatitude", {}).get("value")
        lng = meta.get("GPSLongitude", {}).get("value")
        distance = "no GPS"
        if lat and lng:
            try:
                distance = "%.2f km" % haversine_km(
                    place["coordinates"]["lat"], place["coordinates"]["lng"], float(lat), float(lng)
                )
            except ValueError:
                distance = "bad GPS"

        cats = [c["title"].replace("Category:", "") for c in page.get("categories", [])]
        print(f"\n  {page['title']}")
        print(f"    {info.get('width')}x{info.get('height')}  {licence}  ·  {strip_html(meta.get('Artist', {}).get('value'))[:44]}")
        print(f"    distance from place: {distance}")
        print(f"    categories: {', '.join(cats[:6]) if cats else '(none)'}")
        desc = strip_html(meta.get("ImageDescription", {}).get("value"))
        if desc:
            print(f"    description: {desc[:150]}")
        print(f"    url: {info['url']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("place_ids", nargs="+")
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--search", default=None, help="Override the search term (single place only).")
    args = parser.parse_args()

    places = {p["id"]: p for p in json.loads(PLACES_PATH.read_text(encoding="utf-8"))}
    if args.search and len(args.place_ids) != 1:
        sys.exit("--search applies to a single place id")

    for place_id in args.place_ids:
        place = places.get(place_id)
        if not place:
            print(f"unknown place id {place_id!r}", file=sys.stderr)
            continue
        report(place, args.search or place["name"], args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
