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

# ---------------------------------------------------------------------------------------
# Rendition width selection (Block 3 A1)
#
# Block 2 hit a failure mode that was not a fluke and not specific to any file. Commons only
# renders a thumbnail when the requested width is *smaller* than the file's own width. Asking
# for `iiurlwidth=1600` on a file that is 1600px or narrower therefore returns the **original**
# URL on `upload.wikimedia.org`, and original files are rate-limited far more aggressively than
# the cached `/thumb/` renditions. Every one of Block 2's 17 successful acquisitions was wider
# than 1600px and was served a cached thumbnail; both of its failures were the only two files at
# or below 1600px. Retrying the same original URL can never fix that — the request is refused
# because of what it is, not when it happened.
#
# The rule below is deliberately a pure function of the file's own width, not of whether a
# request happened to be refused. A fallback that triggers on failure would make the acquired
# bytes depend on the host's mood, and this pipeline's whole contract is that re-running it
# reproduces the same asset. A file narrower than the smallest standard width has no thumbnail
# at any size, so the original is the only option and is fetched with full backoff.
#
# The cost is explicit, never silent: a 1600px source yields a 1280px asset, which `processing`
# records as resized and which is still well above anything the application displays (the card
# rendition is 800px and the lightbox is bounded by the viewport).
STANDARD_THUMB_WIDTHS = (1280, 1024, 800, 640, 480, 320)

# Politeness floor between two requests to Wikimedia, in seconds. Applied process-wide.
REQUEST_MIN_INTERVAL_SECONDS = 1.0
_last_request_at = 0.0


def choose_render_width(original_width, max_dimension=PHOTOGRAPHY_MAX_DIMENSION):
    """The width to ask Commons for, or None when only the original can be fetched.

    * wider than `max_dimension` -> ask for `max_dimension`; Commons renders and caches it.
    * at or below `max_dimension` -> ask for the largest standard width strictly below the
      file's own width, so a cached thumbnail exists to serve.
    * narrower than every standard width -> None; there is no thumbnail to ask for.
    """
    if not isinstance(original_width, int) or original_width <= 0:
        raise ValueError(f"original width must be a positive int, got {original_width!r}")
    if original_width > max_dimension:
        return max_dimension
    for width in STANDARD_THUMB_WIDTHS:
        if width < original_width:
            return width
    return None


def expected_processing_for(original_width, original_height, served_width):
    """What `processing` must say, given what was actually fetched.

    `served_width` is the width of the rendition that was downloaded. This is a statement about
    the asset, not a restatement of the record, which is why `acquire_one` compares it against
    the declared value and refuses a mismatch instead of quietly writing the file anyway.
    """
    if max(original_width, original_height) > PHOTOGRAPHY_MAX_DIMENSION:
        return "resized-and-webp-reencoded"
    return "webp-reencoded" if served_width >= original_width else "resized-and-webp-reencoded"


def planned_processing_for(original_width, original_height, max_dimension=PHOTOGRAPHY_MAX_DIMENSION):
    """What a *new* record for this file should declare, before anything is fetched.

    Shared with `prepare-block2-photography-metadata.py` so a record is never prepared with an
    intent the acquisition step will then refuse. A file at or below the max dimension gets a
    reduced rendition because that is the only one Commons serves from cache; a file narrower
    than every standard width has no rendition at all and keeps its original resolution.
    """
    if max(original_width, original_height) > max_dimension:
        return "resized-and-webp-reencoded"
    if choose_render_width(original_width, max_dimension) is None:
        return "webp-reencoded"
    return "resized-and-webp-reencoded"


def _throttle():
    """Keep at least REQUEST_MIN_INTERVAL_SECONDS between any two Wikimedia requests."""
    global _last_request_at
    wait = REQUEST_MIN_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.monotonic()


def _retry_delay(exc, attempt, base_delay):
    """Honour the server's own Retry-After when it sends one; otherwise back off linearly.

    Capped so a long Retry-After cannot park the pipeline for an unbounded time; the caller
    gives up after a fixed number of attempts rather than looping.
    """
    header = None
    try:
        header = exc.headers.get("Retry-After") if exc.headers else None
    except AttributeError:
        header = None
    if header:
        try:
            return max(1.0, min(120.0, float(header)))
        except ValueError:
            pass
    return min(120.0, base_delay * (attempt + 1))


def api_get(params, retries=6, base_delay=8):
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(retries):
        try:
            _throttle()
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            last_error = exc
            # 503 is Wikimedia's other "slow down" response and was previously fatal here.
            if exc.code in (429, 503) and attempt < retries - 1:
                time.sleep(_retry_delay(exc, attempt, base_delay))
                continue
            raise
    raise last_error


def _strip_query(url):
    return urllib.parse.urlsplit(url)._replace(query="", fragment="").geturl()


def resolve_commons_file(title, render_width=None):
    """Resolve a Commons file, optionally asking for a rendition of a given width.

    `render_width=None` resolves identity and dimensions only, which is what the caller needs
    before it can apply `choose_render_width`. `servedThumbnail` reports whether Commons
    actually handed back a cached `/thumb/` rendition rather than the original file, which is
    the distinction the rate limiting turns on.
    """
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|size",
    }
    if render_width is not None:
        params["iiurlwidth"] = str(render_width)
    data = api_get(params)
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo")
        if not infos:
            raise RuntimeError(f"Commons has no imageinfo for {title!r} (deleted or renamed?).")
        info = infos[0]
        thumb_url = info.get("thumburl")
        served_thumbnail = bool(thumb_url) and "/thumb/" in thumb_url
        return {
            "originalUrl": info["url"],
            "originalWidth": info.get("width"),
            "originalHeight": info.get("height"),
            "thumbUrl": thumb_url or info["url"],
            "thumbWidth": info.get("thumbwidth") or info.get("width"),
            "servedThumbnail": served_thumbnail,
            "mime": info.get("mime"),
        }
    raise RuntimeError(f"Commons query returned no page for {title!r}.")


def download_bytes(url, retries=4, base_delay=8):
    """Fetch an image, backing off politely and giving up after a bounded number of attempts.

    Deliberately not an unbounded retry loop: the failure this pipeline actually hits is a
    refusal of *originals*, which no amount of retrying resolves. Retries exist for genuine
    transient pressure, and `choose_render_width` is what avoids the systematic refusal.
    """
    last_error = None
    for attempt in range(retries):
        try:
            _throttle()
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read(), resp.headers.get("Content-Type", "")
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in (429, 503) and attempt < retries - 1:
                time.sleep(_retry_delay(exc, attempt, base_delay))
                continue
            raise
    raise last_error


def select_records(records, place_id=None, original_title=None):
    """Select exact acquisition rows without widening a one-photo request to the identity.

    `--only` remains place-wide for compatibility. `original_title` is a narrower, exact
    selector for adding or retrying one already-approved complementary photograph.
    """
    if place_id and original_title:
        raise ValueError("choose either a place id or an exact original title, not both")
    if original_title:
        return [record for record in records if record.get("originalTitle") == original_title]
    if place_id:
        return [record for record in records if record.get("placeId") == place_id]
    return list(records)


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

    # Identity and dimensions first: the width decides which rendition can be asked for.
    identity = resolve_commons_file(title)
    # Compare ignoring the query string: the API always appends its own
    # utm_source/utm_campaign/utm_content tracking params to "url", which have nothing
    # to do with file identity and would otherwise make every declared URL "mismatch".
    if _strip_query(identity["originalUrl"]) != _strip_query(declared_url):
        raise RuntimeError(
            f"{place_id}: Commons's current full-resolution URL for {title!r} does not "
            f"match the metadata's declared acquisitionUrl.\n"
            f"  declared: {declared_url}\n"
            f"  resolved: {identity['originalUrl']}\n"
            "Refusing to substitute a different asset — update the metadata record "
            "deliberately if the file genuinely moved, never auto-accept a mismatch."
        )
    if identity["mime"] and not identity["mime"].startswith("image/"):
        raise RuntimeError(f"{place_id}: Commons reports a non-image mime type {identity['mime']!r} for {title!r}.")

    original_width = identity["originalWidth"]
    original_height = identity["originalHeight"]
    if not isinstance(original_width, int) or not isinstance(original_height, int):
        raise RuntimeError(f"{place_id}: Commons did not report pixel dimensions for {title!r}.")
    # The record's declared dimensions are cross-checked by the validator; if Commons now
    # reports different ones the file was replaced in place, which is an identity change.
    if (original_width, original_height) != (record["originalWidth"], record["originalHeight"]):
        raise RuntimeError(
            f"{place_id}: Commons now reports {original_width}x{original_height} for {title!r}, "
            f"but the record declares {record['originalWidth']}x{record['originalHeight']}. "
            "The file was replaced; re-verify it deliberately rather than acquiring silently."
        )

    # The record's own `processing` decides which rendition to fetch, so acquisition is a pure
    # function of committed data rather than of how the host happens to be behaving.
    #
    # `webp-reencoded` on a file at or below the max dimension asserts the asset IS the
    # original resolution, so the original is what must be fetched — that is how the seven
    # pre-Block-3 records of small files were made, and they stay exactly reproducible.
    # `resized-and-webp-reencoded` asserts a reduced rendition, which is what
    # `prepare-*-metadata.py` now records for any new small file, and which Commons will serve
    # from cache instead of refusing.
    if original_width <= PHOTOGRAPHY_MAX_DIMENSION and record["processing"] == "webp-reencoded":
        render_width = None
    else:
        render_width = choose_render_width(original_width)

    if render_width is None:
        # Narrower than every standard width: no thumbnail exists at any size, so the original
        # is the only rendition there is. Fetched with the same backoff as anything else.
        resolved = identity
        served_width = original_width
    else:
        resolved = resolve_commons_file(title, render_width)
        if not resolved["servedThumbnail"]:
            raise RuntimeError(
                f"{place_id}: asked Commons for a {render_width}px rendition of {title!r} and it "
                f"returned the original instead. Refusing to fetch the original as a substitute — "
                "that is the request pattern the host rate-limits, and it would also mean the "
                "asset is not the rendition this pipeline recorded."
            )
        served_width = resolved["thumbWidth"] or render_width

    raw_bytes, content_type = download_bytes(resolved["thumbUrl"])
    if content_type and not content_type.startswith("image/"):
        raise RuntimeError(f"{place_id}: download of {title!r} returned Content-Type {content_type!r}, not an image.")

    # `processing` is a claim about the asset. Never write a file whose bytes contradict it.
    expected = expected_processing_for(original_width, original_height, served_width)
    if record["processing"] != expected:
        raise RuntimeError(
            f"{place_id}: this acquisition produces a {served_width}px rendition of a "
            f"{original_width}x{original_height} original, so processing must be {expected!r}, "
            f"but the record declares {record['processing']!r}. Refusing to write an asset whose "
            "recorded provenance would be untrue — correct the record, then re-run."
        )

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
    parser.add_argument(
        "--only-title",
        default=None,
        help="Acquire the one exact originalTitle; avoids re-acquiring an existing identity for a complementary photo.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Resolve and encode but do not write files.")
    args = parser.parse_args()
    if args.only and args.only_title:
        parser.error("--only and --only-title cannot be combined")

    metadata = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    records = select_records(metadata["images"], args.only, args.only_title)
    if args.only or args.only_title:
        if not records:
            selector = f"placeId {args.only!r}" if args.only else f"originalTitle {args.only_title!r}"
            sys.exit(f"No metadata record for {selector}.")

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
