#!/usr/bin/env python3
"""Recompress the 1600px originals of «Lugares nuevos» (JP-215–JP-265) once, at WebP quality 75.

Usage:
    python3 scripts/recompress-new-places-photography.py [--dry-run]
    python3 scripts/build-photography-derivatives.py      # then rebuild 400w/800w + LQIP

Only the photos listed in `data/visual/nihon-lugares-nuevos-acquisition-plan.json` are
touched; every other original stays byte-identical. Each one is re-encoded with the same
conventions as `acquire-photography.py` (longest side ≤ 1600 px, EXIF/ICC dropped, method 6)
at a fixed quality of 75, and replaced only when the result is smaller. The registry
(`photography-metadata.json`: alt, credit, license, source) is not modified here; the
derivatives script refreshes only the LQIP afterwards.

This is a one-shot budget step (2026-11-03), not part of the deterministic rebuild: re-running
it on its own output re-encodes again. See docs/DATA_MODEL.md, «Lugares nuevos».
"""
import argparse
import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
METADATA_PATH = ROOT / "data" / "visual" / "photography-metadata.json"
PLAN_PATH = ROOT / "data" / "visual" / "nihon-lugares-nuevos-acquisition-plan.json"
ASSET_ROOT = ROOT / "app" / "public"
MAX_DIMENSION = 1600
QUALITY = 75


def recompress(data: bytes) -> bytes:
    with Image.open(BytesIO(data)) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        width, height = im.size
        longest = max(width, height)
        if longest > MAX_DIMENSION:
            scale = MAX_DIMENSION / longest
            im = im.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)
        flat = Image.new(im.mode, im.size)
        flat.paste(im)  # drops EXIF/ICC; keeps only pixel data
        buf = BytesIO()
        flat.save(buf, format="WEBP", quality=QUALITY, method=6)
        return buf.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    titles = {entry["title"] for entry in json.loads(PLAN_PATH.read_text(encoding="utf-8"))["entries"]}
    records = [r for r in json.loads(METADATA_PATH.read_text(encoding="utf-8"))["images"] if r["originalTitle"] in titles]
    if len(records) != len(titles):
        sys.exit(f"plan lists {len(titles)} photos but the registry has {len(records)} of them")

    before = after = replaced = 0
    for record in records:
        path = ASSET_ROOT / record["assetPath"]
        current = path.read_bytes()
        encoded = recompress(current)
        before += len(current)
        if len(encoded) < len(current):
            replaced += 1
            after += len(encoded)
            if not args.dry_run:
                tmp = path.with_suffix(".webp.tmp")
                tmp.write_bytes(encoded)
                tmp.replace(path)
        else:
            after += len(current)
    print(f"{replaced}/{len(records)} originals replaced; {before:,} B -> {after:,} B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
