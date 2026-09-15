#!/usr/bin/env python3
"""Deterministic selection of the 24-place Phase 4A photography pilot sample.

Usage:
    python3 scripts/select-photography-pilot.py [--data-dir data] [--out PATH]

Reads the current data/places.json (never modifies it) and writes
data/visual/photography-pilot.json: the 24 places the photography pilot covers, plus
the rule that chose them. Makes no network calls and needs no API key or licensed
photograph to run — selection is a pure function of the current dataset, separate from
whether a place's photograph has actually been sourced yet (see
data/visual/photography-metadata.json and docs/PHOTOGRAPHY_PILOT.md for that).

Why a separate script from the metadata file: selecting which places the pilot targets
and sourcing a licensed photograph for each are different operations with different
failure modes (one is offline and reproducible from data already in this repository,
the other depends on what a human researcher finds, and clears, on Wikimedia Commons).
Mixing them would make it hard to tell "the targeted place changed" from "the sourced
photograph changed".
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import load_places, write_json  # noqa: E402

PILOT_HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa"]
PLACES_PER_HUB = 6
PILOT_PLACE_COUNT = len(PILOT_HUBS) * PLACES_PER_HUB

# A place's single `category` field (an emoji + Spanish label, e.g. "⛩️ Templos y
# santuarios") is mapped to exactly one of six pilot buckets. Categories not listed
# here fall into "distinct-experience" — the catch-all for the dataset's wide tail of
# nightlife/anime/gastronomy/adventure/etc. categories, none numerous enough on their
# own to deserve a dedicated bucket.
BUCKET_BY_CATEGORY = {
    "⛩️ Templos y santuarios": "temple-shrine",
    "🌸 Jardines y paisajes": "nature",
    "🌸 Naturaleza": "nature",
    "🌿 Naturaleza": "nature",
    "🥾 Senderismo/aventura": "nature",
    "🌊 Playa/mar/islas": "nature",
    "🏛️ Museos": "museum-cultural",
    "🎨 Arte": "museum-cultural",
    "🏛️ Arquitectura": "museum-cultural",
    "🏙️ Ciudad y barrios": "urban-neighborhood",
    "🏯 Historia y patrimonio": "landmark",
    "🌅 Miradores": "landmark",
}
DEFAULT_BUCKET = "distinct-experience"

# Fixed iteration order, not alphabetical: landmark and temple-shrine are resolved
# first because they are the categories most likely to collide with each other in a
# hub with few "🏯 Historia y patrimonio" / "🌅 Miradores" / "⛩️" places, so they get
# first pick of the highest-graded candidate before the more populous buckets mop up
# what remains.
BUCKET_ORDER = [
    "landmark",
    "temple-shrine",
    "urban-neighborhood",
    "nature",
    "museum-cultural",
    "distinct-experience",
]

GRADE_RANK = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4}

SELECTION_METHOD_DESCRIPTION = (
    "Deterministic, code-driven selection over the current data/places.json. For each "
    "of the 4 target hubs (Tokio, Kioto, Osaka, Okinawa), each place is classified into "
    "exactly one of 6 category buckets (landmark, temple-shrine, urban-neighborhood, "
    "nature, museum-cultural, distinct-experience) by its dataset `category` field. "
    "Within a hub and bucket, the highest-graded place wins (S > A > B > C > D, "
    "unclassified grades last), ties broken by ascending place id. No manual "
    "cherry-picking: re-running this script against the same dataset yields the same "
    "24 places, and the rule is documented rather than the picks."
)

BUCKET_DESCRIPTIONS = {
    "landmark": (
        "Category 🏯 Historia y patrimonio or 🌅 Miradores — a widely recognised "
        "monument, castle/palace, or skyline viewpoint."
    ),
    "temple-shrine": "Category ⛩️ Templos y santuarios.",
    "urban-neighborhood": "Category 🏙️ Ciudad y barrios.",
    "nature": (
        "Category 🌸 Jardines y paisajes, 🌸/🌿 Naturaleza, 🥾 Senderismo/aventura, or "
        "🌊 Playa/mar/islas — a garden, forest, trail, waterfall, or coastal/marine "
        "scene."
    ),
    "museum-cultural": "Category 🏛️ Museos, 🎨 Arte, or 🏛️ Arquitectura.",
    "distinct-experience": (
        "Every other category — the dataset's nightlife/anime/gastronomy/pop-culture/"
        "entertainment/onsen/etc. tail, none numerous enough for its own bucket."
    ),
}

DEFAULT_MANIFEST_PATH = Path("data/visual/photography-pilot.json")
MANIFEST_VERSION = 1


def classify(place):
    return BUCKET_BY_CATEGORY.get(place["category"], DEFAULT_BUCKET)


def grade_rank(place):
    return GRADE_RANK.get(place.get("grade"), len(GRADE_RANK))


def select_pilot(places):
    by_hub = {}
    for place in places:
        by_hub.setdefault(place["hub"], []).append(place)

    entries = []
    for hub in PILOT_HUBS:
        hub_places = by_hub.get(hub, [])
        used_ids = set()
        for bucket in BUCKET_ORDER:
            candidates = [
                p
                for p in hub_places
                if classify(p) == bucket and p["id"] not in used_ids
            ]
            candidates.sort(key=lambda p: (grade_rank(p), p["id"]))
            if not candidates:
                raise SystemExit(
                    f"No candidate left for hub={hub!r} bucket={bucket!r} — the "
                    "selection rule needs a documented fallback before this script "
                    "can produce a full pilot from the current dataset."
                )
            pick = candidates[0]
            used_ids.add(pick["id"])
            entries.append(
                {
                    "placeId": pick["id"],
                    "hub": hub,
                    "name": pick["name"],
                    "selectionCategory": bucket,
                    "selectionReason": BUCKET_DESCRIPTIONS[bucket],
                    "intendedImageCount": 1,
                }
            )
    return entries


def build_manifest(places):
    entries = select_pilot(places)
    if len(entries) != PILOT_PLACE_COUNT:
        raise SystemExit(
            f"Selection produced {len(entries)} places, expected {PILOT_PLACE_COUNT}."
        )
    return {
        "version": MANIFEST_VERSION,
        "placeCount": len(entries),
        "hubs": PILOT_HUBS,
        "placesPerHub": PLACES_PER_HUB,
        "selectionMethod": SELECTION_METHOD_DESCRIPTION,
        "buckets": BUCKET_DESCRIPTIONS,
        "places": entries,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="data", help="Directory holding places.json")
    parser.add_argument("--out", default=str(DEFAULT_MANIFEST_PATH), help="Manifest output path")
    args = parser.parse_args()

    places = load_places(Path(args.data_dir))
    manifest = build_manifest(places)
    out_path = Path(args.out)
    write_json(out_path, manifest)
    print(f"OK: wrote {manifest['placeCount']} places to {out_path}")


if __name__ == "__main__":
    main()
