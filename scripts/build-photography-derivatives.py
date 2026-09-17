#!/usr/bin/env python3
"""Block 2 — derivative (card-sized) renditions of the committed photography assets.

Usage:
    python3 scripts/build-photography-derivatives.py [--check] [--only PLACE_ID]

Why this exists
---------------
Block 1 made the place list photo-led: every card in the hub explorer now carries a
photograph. Those cards render at roughly 350-390 CSS px, but the only asset that existed
was the 1600px detail hero, averaging ~295 KB. Scrolling the Tokio list therefore pulled
**9.51 MiB** of imagery over the wire to fill 37 card slots, and the saved-places panel
decoded a 1600px image into a 48px box.

This script renders one derivative per registered photograph at DERIVATIVE_WIDTH, which is
what every card surface actually needs at DPR 2, and which the app selects through `srcset`.
The 1600px original stays untouched and remains what the detail hero and the lightbox load.

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
* **Naming is derivable, not declared.** `<slug>.webp` → `<slug>-800w.webp`, next to the
  original. The app computes the derivative URL from the registry path, so no metadata
  field, no second registry and no extra parity surface is introduced.

`--check` verifies every derivative exists and is byte-identical to what this script would
produce now, and exits non-zero otherwise. `scripts/validate-photography.py` stays
Pillow-free and network-free; it checks presence and shape only, never pixels.
"""
import argparse
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
DERIVATIVE_WIDTH = 800
DERIVATIVE_SUFFIX = f"-{DERIVATIVE_WIDTH}w"
DERIVATIVE_QUALITY = 72
DERIVATIVE_METHOD = 6


def derivative_path_for(asset_path: str) -> str:
    """`images/places/JP-001/x.webp` -> `images/places/JP-001/x-800w.webp`.

    Pure string derivation, mirrored byte for byte by `derivativeUrl()` in the app and by
    `scripts/validate-photography.py`. Keeping the three in agreement is what lets the
    derivative stay out of the registry entirely.
    """
    if not asset_path.endswith(".webp"):
        raise ValueError(f"not a .webp asset path: {asset_path!r}")
    return asset_path[: -len(".webp")] + DERIVATIVE_SUFFIX + ".webp"


def encode_derivative(original_bytes: bytes) -> bytes:
    with Image.open(BytesIO(original_bytes)) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        width, height = im.size
        if width > DERIVATIVE_WIDTH:
            target_height = max(1, round(height * DERIVATIVE_WIDTH / width))
            im = im.resize((DERIVATIVE_WIDTH, target_height), Image.LANCZOS)
        flat = Image.new(im.mode, im.size)
        flat.paste(im)  # drops EXIF/ICC; keeps only pixel data
        buf = BytesIO()
        flat.save(buf, format="WEBP", quality=DERIVATIVE_QUALITY, method=DERIVATIVE_METHOD)
        return buf.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify without writing; non-zero exit on drift.")
    parser.add_argument("--only", default=None, help="Build a single placeId.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    records = json.loads(METADATA_PATH.read_text(encoding="utf-8"))["images"]
    if args.only:
        records = [r for r in records if r["placeId"] == args.only]
        if not records:
            sys.exit(f"No metadata record for placeId {args.only!r}.")

    problems = []
    original_bytes_total = 0
    derivative_bytes_total = 0
    written = 0

    for record in records:
        original = ASSET_ROOT / record["assetPath"]
        derivative = ASSET_ROOT / derivative_path_for(record["assetPath"])
        if not original.is_file():
            problems.append(f"{record['placeId']}: original missing on disk: {record['assetPath']}")
            continue

        source = original.read_bytes()
        encoded = encode_derivative(source)
        original_bytes_total += len(source)
        derivative_bytes_total += len(encoded)

        if args.check:
            if not derivative.is_file():
                problems.append(f"{record['placeId']}: derivative missing: {derivative_path_for(record['assetPath'])}")
            elif derivative.read_bytes() != encoded:
                problems.append(
                    f"{record['placeId']}: derivative is stale or hand-edited: "
                    f"{derivative_path_for(record['assetPath'])}"
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

    if problems:
        for problem in problems:
            print(f"ERROR: {problem}", file=sys.stderr)
        print(f"\n{len(problems)} problem(s) across {len(records)} record(s).", file=sys.stderr)
        return 1

    saved = original_bytes_total - derivative_bytes_total
    share = (derivative_bytes_total / original_bytes_total * 100) if original_bytes_total else 0
    verb = "verified" if args.check else "built"
    print(
        f"\nOK: {verb} {len(records)} derivative(s) at {DERIVATIVE_WIDTH}px"
        + (f", {written} written" if not args.check else "")
    )
    print(
        f"     originals {original_bytes_total / 1048576:.2f} MiB -> "
        f"derivatives {derivative_bytes_total / 1048576:.2f} MiB "
        f"({share:.1f}% of original, {saved / 1048576:.2f} MiB lighter per full pass)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
