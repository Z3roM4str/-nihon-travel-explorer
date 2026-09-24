#!/usr/bin/env python3
"""Build deterministic renditions and LQIP data for committed photography assets.

Usage:
    python3 scripts/build-photography-derivatives.py [--check] [--only PLACE_ID]

Why this exists
---------------
Block 1 made the place list photo-led: every card in the hub explorer now carries a
photograph. Those cards render at roughly 350-390 CSS px, but the only asset that existed
was the 1600px detail hero, averaging ~295 KB. Scrolling the Tokio list therefore pulled
**9.51 MiB** of imagery over the wire to fill 37 card slots, and the saved-places panel
decoded a 1600px image into a 48px box.

This script renders the 400px and 800px derivatives prescribed by the photography strategy,
and generates a 20px-wide WebP LQIP in the canonical metadata. The 1600px original stays
untouched and remains what the detail hero and the lightbox load.

Contract
--------
* **Network-free and registry-driven.** It reads `data/visual/photography-metadata.json`
  and the committed originals under `app/public/`. It never contacts Commons, never
  invents an asset, and never touches a place that has no registered photograph.
* **Deterministic.** Same original bytes in, same derivative bytes out: fixed width, fixed
  quality, fixed encoder method, EXIF/ICC dropped. Re-running it on an unchanged tree
  rewrites byte-identical files, which is what makes `--check` meaningful in CI.
* **Never upscales.** An original narrower than DERIVATIVE_WIDTH is re-encoded at its own
  width rather than stretched, so a derivative is never larger than its source in pixels.
* **Naming is derivable, not declared.** `<slug>.webp` → `<slug>-400w.webp` / `-800w.webp`, next to the
  original. The app computes the derivative URL from the registry path, so no metadata
  field, no second registry and no extra parity surface is introduced.

`--check` verifies every derivative and LQIP is byte-identical to what this script would
produce now, and exits non-zero otherwise. `scripts/validate-photography.py` stays
Pillow-free and network-free; it checks presence and shape only, never pixels.
"""
import argparse
import base64
import json
import sys
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - exercised only when Pillow is missing
    sys.exit(
        "Pillow is required to build photography derivatives (pip install -r "
        "scripts/requirements.txt). Not needed for tests, validation or the app build."
    )

REPO_ROOT = Path(__file__).resolve().parents[1]
METADATA_PATH = REPO_ROOT / "data" / "visual" / "photography-metadata.json"
ASSET_ROOT = REPO_ROOT / "app" / "public"

# One tier, chosen against the real card geometry rather than a round number:
# phone card 371 CSS px, tablet two-up 390, desktop sidebar 348. At DPR 2 the largest
# real requirement is 780px, so 800 covers every card surface without a second tier.
# A DPR 3 phone upscales it 1.39x on a 16:9 thumbnail, which is not perceptible at that
# size and is far cheaper than shipping a ~20 MiB 1200w tier for the difference.
DERIVATIVE_WIDTHS = (400, 800)
DEFAULT_DERIVATIVE_WIDTH = 800
DERIVATIVE_QUALITY = 72
DERIVATIVE_METHOD = 6
# B6.2: the list card loads the 800w rendition of every photographed place in a hub, so the
# 3.5 MB city contract is a sum of 800w files. Growing coverage made Tokio exceed it
# (3,886,132 B after B6.2 batch 1) because a few high-detail frames (foliage, water, dense
# streets) encode far above the typical ~50 KB at quality 72. Instead of lowering quality for
# everyone, an 800w rendition that exceeds its byte target steps quality down in fixed
# increments until it fits or reaches the floor — the same deterministic rule the acquisition
# pipeline applies to originals (PHOTOGRAPHY_TARGET_BYTES) and this script applies to LQIP.
# Renditions already under the target stay byte-identical at quality 72. 400w is not in the
# list payload and is unchanged.
DERIVATIVE_TARGET_BYTES = {800: 70_000}
DERIVATIVE_MIN_QUALITY = 48
DERIVATIVE_QUALITY_STEP = 4
LQIP_WIDTH = 20
LQIP_MAX_DATA_URL_BYTES = 700
LQIP_MIN_QUALITY = 20
LQIP_MIME_PREFIX = "data:image/webp;base64,"


def derivative_path_for(asset_path: str, width: int = DEFAULT_DERIVATIVE_WIDTH) -> str:
    """`images/places/JP-001/x.webp` -> `images/places/JP-001/x-800w.webp`.

    Pure string derivation, mirrored byte for byte by `derivativeUrl()` in the app and by
    `scripts/validate-photography.py`. Keeping the three in agreement is what lets the
    derivative stay out of the registry entirely.
    """
    if not asset_path.endswith(".webp"):
        raise ValueError(f"not a .webp asset path: {asset_path!r}")
    if width not in DERIVATIVE_WIDTHS:
        raise ValueError(f"unsupported derivative width: {width!r}")
    return asset_path[: -len(".webp")] + f"-{width}w.webp"


def encode_derivative(original_bytes: bytes, width: int = DEFAULT_DERIVATIVE_WIDTH) -> bytes:
    if width not in DERIVATIVE_WIDTHS:
        raise ValueError(f"unsupported derivative width: {width!r}")
    with Image.open(BytesIO(original_bytes)) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        source_width, source_height = im.size
        target_width = min(source_width, width)
        if im.size[0] > target_width:
            target_height = max(1, round(source_height * target_width / source_width))
            im = im.resize((target_width, target_height), Image.LANCZOS)
        flat = Image.new(im.mode, im.size)
        flat.paste(im)  # drops EXIF/ICC; keeps only pixel data
        target = DERIVATIVE_TARGET_BYTES.get(width)
        quality = DERIVATIVE_QUALITY
        while True:
            buf = BytesIO()
            flat.save(buf, format="WEBP", quality=quality, method=DERIVATIVE_METHOD)
            encoded = buf.getvalue()
            if target is None or len(encoded) <= target or quality <= DERIVATIVE_MIN_QUALITY:
                return encoded
            quality = max(DERIVATIVE_MIN_QUALITY, quality - DERIVATIVE_QUALITY_STEP)


def encode_lqip(original_bytes: bytes) -> str:
    """Return the same image at 20px wide as an inline WebP data URL.

    Start at maximum WebP quality and step down only when a tall or high-detail frame would
    exceed the strategy's approximate 400–700 byte target. This keeps the tiny preview useful
    while bounding metadata growth. The one historical flat frame that lands at 399 bytes is
    intentionally accepted as the stated target is approximate.
    """
    with Image.open(BytesIO(original_bytes)) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        target_height = max(1, round(im.size[1] * LQIP_WIDTH / im.size[0]))
        im = im.resize((LQIP_WIDTH, target_height), Image.LANCZOS)
        flat = Image.new(im.mode, im.size)
        flat.paste(im)
        data_url = ""
        for quality in range(100, LQIP_MIN_QUALITY - 1, -5):
            buf = BytesIO()
            flat.save(buf, format="WEBP", quality=quality, method=DERIVATIVE_METHOD)
            data_url = LQIP_MIME_PREFIX + base64.b64encode(buf.getvalue()).decode("ascii")
            if len(data_url.encode("ascii")) <= LQIP_MAX_DATA_URL_BYTES:
                break
        return data_url


def _render_metadata(metadata: dict) -> str:
    return json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"


def _write_metadata_atomically(path: Path, payload: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify without writing; non-zero exit on drift.")
    parser.add_argument("--only", default=None, help="Build a single placeId.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    records = metadata["images"]
    if args.only:
        records = [r for r in records if r["placeId"] == args.only]
        if not records:
            sys.exit(f"No metadata record for placeId {args.only!r}.")

    problems = []
    original_bytes_total = 0
    derivative_bytes_total = {width: 0 for width in DERIVATIVE_WIDTHS}
    written = 0
    lqip_updated = 0

    for record in records:
        original = ASSET_ROOT / record["assetPath"]
        if not original.is_file():
            problems.append(f"{record['placeId']}: original missing on disk: {record['assetPath']}")
            continue

        source = original.read_bytes()
        original_bytes_total += len(source)
        for width in DERIVATIVE_WIDTHS:
            derivative_rel = derivative_path_for(record["assetPath"], width)
            derivative = ASSET_ROOT / derivative_rel
            encoded = encode_derivative(source, width)
            derivative_bytes_total[width] += len(encoded)

            if args.check:
                if not derivative.is_file():
                    problems.append(f"{record['placeId']}: derivative missing: {derivative_rel}")
                elif derivative.read_bytes() != encoded:
                    problems.append(
                        f"{record['placeId']}: derivative is stale or hand-edited: {derivative_rel}"
                    )
                continue

            if derivative.is_file() and derivative.read_bytes() == encoded:
                continue
            derivative.parent.mkdir(parents=True, exist_ok=True)
            tmp = derivative.with_suffix(".webp.tmp")
            tmp.write_bytes(encoded)
            tmp.replace(derivative)
            written += 1
            if not args.quiet:
                print(f"OK   {record['placeId']:8s} {derivative.name}  {len(encoded):>7d} B")

        expected_lqip = encode_lqip(source)
        if args.check:
            if record.get("lqip") != expected_lqip:
                problems.append(f"{record['placeId']}: lqip is missing, stale or hand-edited")
        elif record.get("lqip") != expected_lqip:
            record["lqip"] = expected_lqip
            lqip_updated += 1

    if problems:
        for problem in problems:
            print(f"ERROR: {problem}", file=sys.stderr)
        print(f"\n{len(problems)} problem(s) across {len(records)} record(s).", file=sys.stderr)
        return 1

    if not args.check and lqip_updated:
        payload = _render_metadata(metadata)
        _write_metadata_atomically(METADATA_PATH, payload)
        _write_metadata_atomically(REPO_ROOT / "app/src/data/photography-metadata.json", payload)

    verb = "verified" if args.check else "built"
    print(
        f"\nOK: {verb} {len(records)} photography record(s) at "
        f"{', '.join(str(width) + 'px' for width in DERIVATIVE_WIDTHS)}"
        + (f", {written} derivative(s) written, {lqip_updated} LQIP record(s) updated" if not args.check else "")
    )
    for width in DERIVATIVE_WIDTHS:
        total = derivative_bytes_total[width]
        share = (total / original_bytes_total * 100) if original_bytes_total else 0
        print(f"     {width}px {total / 1048576:.2f} MiB ({share:.1f}% of originals)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
