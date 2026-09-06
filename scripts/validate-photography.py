#!/usr/bin/env python3
"""Offline validation for the Phase 4A photography pilot manifest and metadata.

Usage:
    python3 scripts/validate-photography.py [data-dir]

Validates, with NO network access:

- data/visual/photography-pilot.json (the 24-place selection)
- data/visual/photography-metadata.json (the licensed-image registry)
- that every asset path the metadata declares actually exists under app/public/
- that the app-facing copy of the metadata (app/src/data/photography-metadata.json)
  matches the source-of-truth copy byte-for-byte, the same parity check
  scripts/validate-access-points.py runs for the logistics access-point catalog.

Every check here is a pure function of files already committed to the repository —
no Wikimedia Commons API call, no image decode. Re-verifying an image's real license
against Commons is the acquisition script's job (scripts/acquire-photography.py),
which runs separately and only when photographs are (re)sourced.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PILOT_PATH = Path("visual/photography-pilot.json")
DEFAULT_METADATA_PATH = Path("visual/photography-metadata.json")
DEFAULT_APP_METADATA_PATH = REPO_ROOT / "app/src/data/photography-metadata.json"
DEFAULT_ASSET_ROOT = REPO_ROOT / "app/public"

APPROVED_ASSET_PREFIX = "images/places/"
ASSET_PATH_PATTERN = re.compile(r"^images/places/(JP-\d{3})/[a-z0-9][a-z0-9-]*\.webp$")
SUPPORTED_LICENSES = {
    "CC0",
    "CC BY 2.0",
    "CC BY 2.5",
    "CC BY 3.0",
    "CC BY 4.0",
    "CC BY-SA 2.0",
    "CC BY-SA 2.5",
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
}
# CC0 is a public-domain dedication: Commons does not require attribution for it, so a
# missing/empty credit is not an error for that one license. Every other supported
# license in SUPPORTED_LICENSES is an attribution license (BY / BY-SA) and a missing
# credit is a real defect.
LICENSES_NOT_REQUIRING_CREDIT = {"CC0"}
PILOT_HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa"]
PLACES_PER_HUB = 6


def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def valid_url(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def is_usable_alt(value):
    if not isinstance(value, str):
        return False
    text = value.strip()
    if len(text) < 12:
        return False
    lowered = text.lower()
    if lowered.startswith("imagen de ") or lowered.startswith("image of "):
        return False
    return True


def validate_pilot(pilot, place_ids):
    errors = []
    if not isinstance(pilot, dict):
        return ["photography-pilot.json top level must be an object"], []
    places = pilot.get("places")
    if not isinstance(places, list):
        return ["photography-pilot.json 'places' must be an array"], []

    if len(places) != len(PILOT_HUBS) * PLACES_PER_HUB:
        errors.append(f"pilot must contain exactly {len(PILOT_HUBS) * PLACES_PER_HUB} places, found {len(places)}")

    seen_ids = set()
    per_hub_count = {}
    pilot_place_ids = []
    for index, entry in enumerate(places):
        label = f"places[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{label}: entry must be an object")
            continue
        place_id = entry.get("placeId")
        pilot_place_ids.append(place_id)
        if place_id in seen_ids:
            errors.append(f"{label}: duplicate placeId {place_id!r} in pilot manifest")
        seen_ids.add(place_id)
        if place_id not in place_ids:
            errors.append(f"{label}: pilot references unknown placeId {place_id!r} (not in data/places.json)")
        hub = entry.get("hub")
        if hub not in PILOT_HUBS:
            errors.append(f"{label}: unexpected hub {hub!r}")
        else:
            per_hub_count[hub] = per_hub_count.get(hub, 0) + 1
        count = entry.get("intendedImageCount")
        if not isinstance(count, int) or count < 1:
            errors.append(f"{label}: intendedImageCount must be a positive integer")

    for hub in PILOT_HUBS:
        if per_hub_count.get(hub, 0) != PLACES_PER_HUB:
            errors.append(f"hub {hub!r}: expected {PLACES_PER_HUB} pilot places, found {per_hub_count.get(hub, 0)}")

    return errors, pilot_place_ids


def validate_metadata(metadata, place_ids, asset_root):
    errors = []
    if not isinstance(metadata, dict):
        return ["photography-metadata.json top level must be an object"], {}
    images = metadata.get("images")
    if not isinstance(images, list):
        return ["photography-metadata.json 'images' must be an array"], {}

    seen_asset_paths = set()
    # (originalTitle or acquisitionUrl) -> set of placeIds it has been declared for.
    # The same photograph must never silently stand in for two different places.
    source_to_places = {}
    images_by_place = {}

    for index, record in enumerate(images):
        label = f"images[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{label}: entry must be an object")
            continue

        place_id = record.get("placeId")
        if place_id not in place_ids:
            errors.append(f"{label}: unknown placeId {place_id!r} (not in data/places.json)")
        images_by_place.setdefault(place_id, []).append(record)

        asset_path = record.get("assetPath")
        if not isinstance(asset_path, str) or not asset_path.startswith(APPROVED_ASSET_PREFIX):
            errors.append(f"{label}: assetPath must live under {APPROVED_ASSET_PREFIX!r}, got {asset_path!r}")
        elif not ASSET_PATH_PATTERN.fullmatch(asset_path):
            errors.append(f"{label}: assetPath {asset_path!r} does not match images/places/<PLACE_ID>/<slug>.webp")
        else:
            path_place_id = ASSET_PATH_PATTERN.fullmatch(asset_path).group(1)
            if path_place_id != place_id:
                errors.append(f"{label}: assetPath place folder {path_place_id!r} does not match placeId {place_id!r}")
            if not asset_path.lower().endswith(".webp"):
                errors.append(f"{label}: unsupported file format for {asset_path!r} (only .webp is accepted)")

        if isinstance(asset_path, str):
            if asset_path in seen_asset_paths:
                errors.append(f"{label}: duplicate assetPath {asset_path!r}")
            seen_asset_paths.add(asset_path)
            if not (asset_root / asset_path).is_file():
                errors.append(f"{label}: referenced asset is missing on disk: {asset_path}")

        source = record.get("source")
        if not isinstance(source, str) or not source.strip():
            errors.append(f"{label}: source must be a non-empty string")

        if not valid_url(record.get("sourceUrl")):
            errors.append(f"{label}: sourceUrl must be a non-empty, well-formed http(s) URL")

        license_ = record.get("license")
        if license_ not in SUPPORTED_LICENSES:
            errors.append(f"{label}: unsupported license {license_!r}")
        elif license_ not in LICENSES_NOT_REQUIRING_CREDIT:
            credit = record.get("credit")
            if not isinstance(credit, str) or not credit.strip():
                errors.append(f"{label}: license {license_!r} requires a non-empty credit")

        if license_ not in LICENSES_NOT_REQUIRING_CREDIT and not valid_url(record.get("licenseUrl")):
            errors.append(f"{label}: licenseUrl must be a well-formed http(s) URL for an attribution license")

        if not is_usable_alt(record.get("alt")):
            errors.append(f"{label}: alt text is missing, too short, or looks like a placeholder")

        if not valid_url(record.get("acquisitionUrl")):
            errors.append(f"{label}: acquisitionUrl must be a well-formed http(s) URL")

        original_title = record.get("originalTitle")
        if not isinstance(original_title, str) or not original_title.strip():
            errors.append(f"{label}: originalTitle is required for Commons provenance")

        source_key = original_title or record.get("acquisitionUrl")
        if source_key:
            source_to_places.setdefault(source_key, set()).add(place_id)

    for source_key, places_using_it in source_to_places.items():
        if len(places_using_it) > 1:
            errors.append(
                f"source {source_key!r} is declared for more than one place: {sorted(places_using_it)} "
                "(the same photograph may never silently represent unrelated places)"
            )

    return errors, images_by_place


def validate(data_dir=Path("data"), asset_root=DEFAULT_ASSET_ROOT, app_metadata_path=DEFAULT_APP_METADATA_PATH):
    data_dir = Path(data_dir)
    errors = []
    try:
        places = load(data_dir / "places.json")
        pilot = load(data_dir / DEFAULT_PILOT_PATH)
        metadata = load(data_dir / DEFAULT_METADATA_PATH)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot load required artifact: {exc}"]

    place_ids = {p.get("id") for p in places if isinstance(p, dict)}

    pilot_errors, pilot_place_ids = validate_pilot(pilot, place_ids)
    errors.extend(pilot_errors)

    metadata_errors, images_by_place = validate_metadata(metadata, place_ids, asset_root)
    errors.extend(metadata_errors)

    for place_id in pilot_place_ids:
        if place_id and not images_by_place.get(place_id):
            errors.append(f"pilot place {place_id!r} has no photograph in photography-metadata.json")

    if app_metadata_path is not None:
        try:
            if load(app_metadata_path) != metadata:
                errors.append("app/source photography-metadata.json parity mismatch")
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"cannot validate app-facing photography-metadata.json: {exc}")

    return errors


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    data_dir = Path(args[0]) if args else Path("data")
    errors = validate(data_dir)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("OK: photography pilot manifest and metadata are valid; all pilot places have a photograph")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
