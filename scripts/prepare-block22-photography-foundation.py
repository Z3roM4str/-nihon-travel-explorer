#!/usr/bin/env python3
"""Apply the evidence-backed B6 role migration to the photography registry.

The migration is deliberately closed over the exact 163-record B20 base. Every first image
keeps its established cover position and becomes ``identity``. The six historical second
images are classified from the facet audit already recorded in
``docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md``; an unexpected additional image fails closed instead of
receiving a guessed role.

LQIP values are generated separately by ``build-photography-derivatives.py`` from the actual
committed pixels. This script never writes base64 by hand and never changes image order.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "data/visual/photography-metadata.json"
APP_COPY = ROOT / "app/src/data/photography-metadata.json"
EXPECTED_BASE_COUNT = 163

# Evidence: docs/BLOCK_2_PHOTOGRAPHY_DESIGN.md §6 and the committed, specific alt text.
SECOND_IMAGE_ROLES = {
    "images/places/JP-021/tokyo-national-museum-honkan.webp": "context",
    "images/places/JP-089/nijojo-ninomaru-garden.webp": "detail",
    "images/places/JP-125/usj-wizarding-world-castle.webp": "experience",
    "images/places/JP-129/todaiji-daibutsu.webp": "detail",
    "images/places/JP-152/benesse-house-museum.webp": "context",
    "images/places/JP-205/sapporo-snow-sculpture.webp": "experience",
}


def write_atomically(path: Path, payload: str) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(payload, encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    metadata = json.loads(CANONICAL.read_text(encoding="utf-8"))
    images = metadata.get("images", [])
    if metadata.get("imageCount") != EXPECTED_BASE_COUNT or len(images) != EXPECTED_BASE_COUNT:
        raise SystemExit(
            "B6.1 role migration requires the exact 163-record B20 base; "
            f"found imageCount={metadata.get('imageCount')!r}, len={len(images)}"
        )

    seen_places = set()
    second_paths_seen = set()
    for record in images:
        place_id = record["placeId"]
        asset_path = record["assetPath"]
        if place_id not in seen_places:
            record["role"] = "identity"
            seen_places.add(place_id)
            continue
        role = SECOND_IMAGE_ROLES.get(asset_path)
        if role is None:
            raise SystemExit(
                f"STOP: historical non-cover image {asset_path!r} has no reviewed role"
            )
        record["role"] = role
        second_paths_seen.add(asset_path)

    missing_reviewed = sorted(set(SECOND_IMAGE_ROLES) - second_paths_seen)
    if missing_reviewed:
        raise SystemExit(f"STOP: reviewed second images missing from registry: {missing_reviewed}")

    payload = json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    write_atomically(CANONICAL, payload)
    write_atomically(APP_COPY, payload)
    print(
        f"OK: assigned roles to {len(images)} records "
        f"({len(seen_places)} identity, {len(second_paths_seen)} complementary)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
