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
  A `-800w` file can therefore be narrower than 800px; DERIVATIVE_MAX_BYTES can also make it so.
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
NEW_PLACES_PLAN_PATH = REPO_ROOT / "data" / "visual" / "nihon-lugares-nuevos-acquisition-plan.json"


def new_places_titles() -> frozenset:
    """`originalTitle` de las fotos de «Lugares nuevos» (tope de 5.5 MB por ciudad; ver rebalance)."""
    if not NEW_PLACES_PLAN_PATH.is_file():
        return frozenset()
    entries = json.loads(NEW_PLACES_PLAN_PATH.read_text(encoding="utf-8"))["entries"]
    return frozenset(entry["title"] for entry in entries)

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
# Hard per-file cap (gate J04 of `app/scripts/b10-performance-check.mjs`). A few portrait, high-detail
# frames stay above it even at the quality floor, and that floor is not negotiable, so only those
# step their pixel width down in fixed increments until they fit. The file keeps its `-800w` name:
# like an original narrower than 800px, it is simply narrower than its nominal rendition. Everything
# already under the cap at the floor stays byte-identical.
DERIVATIVE_MAX_BYTES = 200_000
DERIVATIVE_WIDTH_STEP = 40
DERIVATIVE_MIN_RENDER_WIDTH = min(DERIVATIVE_WIDTHS)
IDENTITY_HUB_BUDGET_BYTES = 3_500_000
# «Lugares nuevos» (JP-215–JP-265): with their identity photos counted, each city's 800w list
# payload may reach 5.5 MB. Only the new photos are lowered to fit it; the pre-existing set keeps
# its 3.5 MB cap above (see `rebalance_identity_800` and docs/DATA_MODEL.md). One cap for every
# city, sized for Tokio: 5 MB would need its new photos below DERIVATIVE_MIN_QUALITY, and no
# rendition goes below that floor.
CITY_IDENTITY_BUDGET_BYTES = 5_500_000
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


def encode_derivative_at_quality(original_bytes: bytes, width: int, quality: int, render_width: int | None = None) -> bytes:
    """Encode one rendition at an explicit contract-bounded WebP quality.

    `render_width` is the pixel width actually produced when the byte cap forces it below the
    nominal `width`; by default they are the same.
    """
    if width not in DERIVATIVE_WIDTHS:
        raise ValueError(f"unsupported derivative width: {width!r}")
    if not DERIVATIVE_MIN_QUALITY <= quality <= DERIVATIVE_QUALITY:
        raise ValueError(f"quality outside deterministic range: {quality!r}")
    render_width = width if render_width is None else render_width
    if not DERIVATIVE_MIN_RENDER_WIDTH <= render_width <= width:
        raise ValueError(f"render width outside deterministic range: {render_width!r}")
    with Image.open(BytesIO(original_bytes)) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        source_width, source_height = im.size
        target_width = min(source_width, render_width)
        if im.size[0] > target_width:
            target_height = max(1, round(source_height * target_width / source_width))
            im = im.resize((target_width, target_height), Image.LANCZOS)
        flat = Image.new(im.mode, im.size)
        flat.paste(im)  # drops EXIF/ICC; keeps only pixel data
        buf = BytesIO()
        flat.save(buf, format="WEBP", quality=quality, method=DERIVATIVE_METHOD)
        return buf.getvalue()


def choose_derivative_encoding(original_bytes: bytes, width: int = DEFAULT_DERIVATIVE_WIDTH):
    """Preserve the B6.2 per-file target and return its selected quality plus bytes."""
    target = DERIVATIVE_TARGET_BYTES.get(width)
    quality = DERIVATIVE_QUALITY
    while True:
        encoded = encode_derivative_at_quality(original_bytes, width, quality)
        if target is None or len(encoded) <= target or quality <= DERIVATIVE_MIN_QUALITY:
            return quality, encoded
        quality = max(DERIVATIVE_MIN_QUALITY, quality - DERIVATIVE_QUALITY_STEP)


def fit_byte_cap(original_bytes: bytes, width: int, quality: int, encoded: bytes):
    """Bring a finished rendition under DERIVATIVE_MAX_BYTES; return (quality, render_width, bytes).

    Quality steps down first. Only a rendition still over the cap at the quality floor then steps
    its width down, so the floor is never crossed to meet the cap. A rendition already under the
    cap comes back untouched, which is what keeps every other file byte-identical.
    """
    render_width = width
    while len(encoded) > DERIVATIVE_MAX_BYTES:
        if quality > DERIVATIVE_MIN_QUALITY:
            quality = max(DERIVATIVE_MIN_QUALITY, quality - DERIVATIVE_QUALITY_STEP)
        elif render_width > DERIVATIVE_MIN_RENDER_WIDTH:
            render_width = max(DERIVATIVE_MIN_RENDER_WIDTH, render_width - DERIVATIVE_WIDTH_STEP)
        else:
            raise ValueError(
                f"rendition stays at {len(encoded)} B, over the {DERIVATIVE_MAX_BYTES} B cap, at "
                f"quality {quality} and width {render_width}"
            )
        encoded = encode_derivative_at_quality(original_bytes, width, quality, render_width)
    return quality, render_width, encoded


def encode_derivative(original_bytes: bytes, width: int = DEFAULT_DERIVATIVE_WIDTH) -> bytes:
    quality, encoded = choose_derivative_encoding(original_bytes, width)
    return fit_byte_cap(original_bytes, width, quality, encoded)[2]


def _fit_hub_under_budget(hub, members, planned, qualities, originals, budget, fixed_bytes=0):
    """Lower the highest-saving next quality step across `members` until the hub fits.

    `fixed_bytes` is what the hub already spends on renditions this pass may not touch. Place id
    and asset path are stable tie-breaks; nothing goes below DERIVATIVE_MIN_QUALITY.
    """
    next_encoded = {}
    for record in members:
        asset_path = record["assetPath"]
        quality = qualities[asset_path]
        if quality > DERIVATIVE_MIN_QUALITY:
            next_quality = max(DERIVATIVE_MIN_QUALITY, quality - DERIVATIVE_QUALITY_STEP)
            next_encoded[asset_path] = encode_derivative_at_quality(originals[asset_path], 800, next_quality)
    total = fixed_bytes + sum(len(planned[row["assetPath"]]) for row in members)
    while total > budget:
        options = []
        for record in members:
            asset_path = record["assetPath"]
            lowered = next_encoded.get(asset_path)
            if lowered is None:
                continue
            saved = len(planned[asset_path]) - len(lowered)
            if saved > 0:
                next_quality = max(DERIVATIVE_MIN_QUALITY, qualities[asset_path] - DERIVATIVE_QUALITY_STEP)
                options.append((-saved, record["placeId"], asset_path, next_quality, lowered))
        if not options:
            raise ValueError(
                f"identity hub {hub} remains {total} B over the {budget} B cap at quality floor {DERIVATIVE_MIN_QUALITY}"
            )
        _, _, asset_path, quality, encoded = min(options)
        total -= len(planned[asset_path]) - len(encoded)
        planned[asset_path] = encoded
        qualities[asset_path] = quality
        if quality > DERIVATIVE_MIN_QUALITY:
            next_quality = max(DERIVATIVE_MIN_QUALITY, quality - DERIVATIVE_QUALITY_STEP)
            next_encoded[asset_path] = encode_derivative_at_quality(originals[asset_path], 800, next_quality)
        else:
            next_encoded.pop(asset_path, None)
    return total


def rebalance_identity_800(
    records,
    originals,
    hub_by_place,
    budget=IDENTITY_HUB_BUDGET_BYTES,
    new_place_titles=frozenset(),
    city_budget=CITY_IDENTITY_BUDGET_BYTES,
):
    """Fit identity card renditions under the per-hub caps without crossing their quality floor.

    First apply the existing deterministic per-file rule. If that leaves a hub over budget,
    lower the highest-saving next quality step across that hub, with place id and asset path as
    stable tie-breaks. Source images, 400px renditions, and non-identity roles are untouched.

    Two passes, so the photos that were already shipped stay byte-identical:

    1. Pre-existing identity photos keep their historical `budget` (3.5 MB per hub).
    2. «Lugares nuevos» (JP-215–JP-265, the titles in `new_place_titles`) are then added to the
       same hub sum, and only they are lowered until the whole city fits `city_budget` (5.5 MB),
       down to the same DERIVATIVE_MIN_QUALITY. The 3.5 MB contract was sized for ~50 places per hub; with
       60–85 it cannot hold even at quality 48 (see docs/DATA_MODEL.md).

    Returns the renditions, their qualities and each hub's full total (both passes).
    """
    planned, qualities, existing, added = {}, {}, {}, {}
    for record in records:
        if record.get("role") != "identity":
            continue
        place_id, asset_path = record["placeId"], record["assetPath"]
        hub = hub_by_place.get(place_id)
        if not hub:
            raise ValueError(f"identity place has no hub: {place_id}")
        quality, encoded = choose_derivative_encoding(originals[asset_path], 800)
        planned[asset_path] = encoded
        qualities[asset_path] = quality
        group = added if record.get("originalTitle") in new_place_titles else existing
        group.setdefault(hub, []).append(record)

    totals = {}
    for hub, members in sorted(existing.items()):
        totals[hub] = _fit_hub_under_budget(hub, members, planned, qualities, originals, budget)
    for hub, members in sorted(added.items()):
        totals[hub] = _fit_hub_under_budget(
            hub, members, planned, qualities, originals, city_budget, fixed_bytes=totals.get(hub, 0)
        )
    return planned, qualities, dict(sorted(totals.items()))


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
    all_records = metadata["images"]
    records = all_records
    if args.only:
        records = [r for r in records if r["placeId"] == args.only]
        if not records:
            sys.exit(f"No metadata record for placeId {args.only!r}.")

    places = json.loads((REPO_ROOT / "data" / "places.json").read_text(encoding="utf-8"))
    hub_by_place = {place["id"]: place.get("hub") for place in places}
    identity_originals = {}
    for record in all_records:
        if record.get("role") != "identity":
            continue
        original = ASSET_ROOT / record["assetPath"]
        if not original.is_file():
            sys.exit(f"{record['placeId']}: original missing on disk: {record['assetPath']}")
        identity_originals[record["assetPath"]] = original.read_bytes()
    try:
        identity_800, identity_qualities, identity_hub_totals = rebalance_identity_800(
            all_records, identity_originals, hub_by_place, new_place_titles=new_places_titles()
        )
        # After the rebalance: the cap only ever lowers a file, so no city can go back over budget.
        hub_by_asset = {r["assetPath"]: hub_by_place[r["placeId"]] for r in all_records if r.get("role") == "identity"}
        for asset_path, encoded in identity_800.items():
            quality, render_width, capped = fit_byte_cap(
                identity_originals[asset_path], 800, identity_qualities[asset_path], encoded
            )
            identity_hub_totals[hub_by_asset[asset_path]] -= len(encoded) - len(capped)
            identity_800[asset_path], identity_qualities[asset_path] = capped, quality
    except ValueError as exc:
        sys.exit(f"identity 800w budget rebalance failed: {exc}")

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

        source = identity_originals[record["assetPath"]] if record.get("role") == "identity" else original.read_bytes()
        original_bytes_total += len(source)
        for width in DERIVATIVE_WIDTHS:
            derivative_rel = derivative_path_for(record["assetPath"], width)
            derivative = ASSET_ROOT / derivative_rel
            encoded = identity_800[record["assetPath"]] if width == 800 and record.get("role") == "identity" else encode_derivative(source, width)
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
    for hub, total in sorted(identity_hub_totals.items()):
        adjusted = sum(identity_qualities[row["assetPath"]] < DERIVATIVE_QUALITY for row in all_records
                       if row.get("role") == "identity" and hub_by_place.get(row["placeId"]) == hub)
        print(f"     identity 800w {hub}: {total:,} B / {CITY_IDENTITY_BUDGET_BYTES:,} B city cap ({adjusted} image(s) quality-adjusted)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
