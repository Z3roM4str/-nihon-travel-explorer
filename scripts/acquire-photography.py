#!/usr/bin/env python3
"""Acquisition pipeline for Phase 4A's licensed photography pilot.

Usage:
    python3 scripts/acquire-photography.py [--metadata PATH] [--out-dir DIR] [--only PLACE_ID]

For every record in data/visual/photography-metadata.json this:

1. Re-queries the Wikimedia Commons API for the record's declared `originalTitle` and
   confirms the API's resolved full-resolution URL matches the record's declared
   `acquisitionUrl` exactly. A mismatch (the file was moved, renamed, or the metadata
   was hand-edited to point somewhere else) is a hard, loud failure — never a silent
   fetch of whatever the API returns instead.
2. Downloads a same-file thumbnail no wider than PHOTOGRAPHY_MAX_DIMENSION (1600px)
   via the API's `iiurlwidth`, which never upscales past the original's own
   resolution — this script performs no resizing of its own beyond what Commons's
   thumbnail renderer already applied.
3. Verifies the response is actually decodable as an image (via Pillow) before
   trusting it.
4. Re-encodes it as WebP (quality tuned down from 90 towards 60 only as needed to
   approach PHOTOGRAPHY_TARGET_BYTES, never below PHOTOGRAPHY_MIN_QUALITY), stripping
   EXIF/ICC metadata.
5. Writes the result to the record's declared `assetPath` under app/public/, atomically.

This script requires network access and the `Pillow` package (see
scripts/requirements.txt) and is deliberately never invoked by `npm test` or by
scripts/validate-photography.py — both must stay network-free. Re-run it only when
data/visual/photography-metadata.json changes.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - exercised only when Pillow is missing
    sys.exit(
        "Pillow is required to run the acquisition pipeline (pip install -r "
        "scripts/requirements.txt). Not needed for tests or validation, which stay "
        "network- and Pillow-free."
    )

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METADATA_PATH = REPO_ROOT / "data/visual/photography-metadata.json"
DEFAULT_OUT_DIR = REPO_ROOT / "app/public"

USER_AGENT = (
    "NihonTravelExplorerPhotographyPipeline/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; travel-planning app, "
    "non-commercial; Phase 4A licensed photography acquisition)"
)
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

PHOTOGRAPHY_MAX_DIMENSION = 1600
PHOTOGRAPHY_TARGET_BYTES = 300_000
PHOTOGRAPHY_MIN_QUALITY = 60
PHOTOGRAPHY_START_QUALITY = 90


def api_get(params, retries=6, base_delay=8):
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code == 429 and attempt < retries - 1:
                time.sleep(base_delay * (attempt + 1))
                continue
            raise
    raise last_error


def _strip_query(url):
    return urllib.parse.urlsplit(url)._replace(query="", fragment="").geturl()


def resolve_commons_file(title, max_width):
    data = api_get(
        {
            "action": "query",
            "format": "json",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": str(max_width),
        }
    )
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo")
        if not infos:
            raise RuntimeError(f"Commons has no imageinfo for {title!r} (deleted or renamed?).")
        info = infos[0]
        return {
            "originalUrl": info["url"],
            "thumbUrl": info.get("thumburl") or info["url"],
            "mime": info.get("mime"),
        }
    raise RuntimeError(f"Commons query returned no page for {title!r}.")


def download_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get("Content-Type", "")
        data = resp.read()
    return data, content_type


def encode_webp(raw_bytes, max_dimension, target_bytes):
    with Image.open(BytesIO(raw_bytes)) as im:
        im.load()  # raises if it isn't actually a decodable image
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        width, height = im.size
        longest = max(width, height)
        if longest > max_dimension:
            scale = max_dimension / longest
            im = im.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)
        image_to_save = Image.new(im.mode, im.size)
        image_to_save.paste(im)  # drops EXIF/ICC profiles; keeps only pixel data

        quality = PHOTOGRAPHY_START_QUALITY
        best = None
        while quality >= PHOTOGRAPHY_MIN_QUALITY:
            buf = BytesIO()
            image_to_save.save(buf, format="WEBP", quality=quality, method=6)
            encoded = buf.getvalue()
            best = encoded
            if len(encoded) <= target_bytes:
                break
            quality -= 10
        return best, image_to_save.size


def acquire_one(record, out_dir, dry_run=False):
    place_id = record["placeId"]
    title = record["originalTitle"]
    declared_url = record["acquisitionUrl"]

    resolved = resolve_commons_file(title, PHOTOGRAPHY_MAX_DIMENSION)
    # Compare ignoring the query string: the API always appends its own
    # utm_source/utm_campaign/utm_content tracking params to "url", which have nothing
    # to do with file identity and would otherwise make every declared URL "mismatch".
    if _strip_query(resolved["originalUrl"]) != _strip_query(declared_url):
        raise RuntimeError(
            f"{place_id}: Commons's current full-resolution URL for {title!r} does not "
            f"match the metadata's declared acquisitionUrl.\n"
            f"  declared: {declared_url}\n"
            f"  resolved: {resolved['originalUrl']}\n"
            "Refusing to substitute a different asset — update the metadata record "
            "deliberately if the file genuinely moved, never auto-accept a mismatch."
        )
    if resolved["mime"] and not resolved["mime"].startswith("image/"):
        raise RuntimeError(f"{place_id}: Commons reports a non-image mime type {resolved['mime']!r} for {title!r}.")

    raw_bytes, content_type = download_bytes(resolved["thumbUrl"])
    if content_type and not content_type.startswith("image/"):
        raise RuntimeError(f"{place_id}: download of {title!r} returned Content-Type {content_type!r}, not an image.")

    webp_bytes, final_size = encode_webp(raw_bytes, PHOTOGRAPHY_MAX_DIMENSION, PHOTOGRAPHY_TARGET_BYTES)

    dest = out_dir / record["assetPath"]
    if dry_run:
        return dest, len(webp_bytes), final_size

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    tmp.write_bytes(webp_bytes)
    tmp.replace(dest)
    return dest, len(webp_bytes), final_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", default=str(DEFAULT_METADATA_PATH))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--only", default=None, help="Acquire a single placeId, for spot-fixing one entry.")
    parser.add_argument("--dry-run", action="store_true", help="Resolve and encode but do not write files.")
    args = parser.parse_args()

    metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    records = metadata["images"]
    if args.only:
        records = [r for r in records if r["placeId"] == args.only]
        if not records:
            sys.exit(f"No metadata record for placeId {args.only!r}.")

    out_dir = Path(args.out_dir)
    failures = []
    for record in records:
        try:
            dest, size, dims = acquire_one(record, out_dir, dry_run=args.dry_run)
            print(f"OK   {record['placeId']:8s} {dest.relative_to(out_dir)}  {size:>7d} bytes  {dims[0]}x{dims[1]}")
        except Exception as exc:  # noqa: BLE001 - report every failure, keep going, exit non-zero at the end
            failures.append((record["placeId"], str(exc)))
            print(f"FAIL {record['placeId']:8s} {exc}", file=sys.stderr)

    if failures:
        print(f"\n{len(failures)} of {len(records)} acquisitions failed.", file=sys.stderr)
        sys.exit(1)
    print(f"\nOK: acquired {len(records)} images.")


if __name__ == "__main__":
    main()
