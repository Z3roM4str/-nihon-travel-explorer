#!/usr/bin/env python3
"""Offline validation for the Phase 4A photography pilot and Phase 4C attribution metadata.

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
import base64
import binascii
import hashlib
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

# B6: the compact and card-sized renditions every registered photograph must also ship.
# Mirrors `derivative_path_for()` in scripts/build-photography-derivatives.py and
# `cardImageUrl()` in app/src/data/place-images.ts. This validator stays Pillow-free, so it
# checks that each derivative exists, is non-empty and is smaller than its original — never
# that its pixels are right. `build-photography-derivatives.py --check` does that.
DERIVATIVE_WIDTHS = (400, 800)
CITY_IMAGE_BUDGET_BYTES = 3_500_000
SUPPORTED_ROLES = {"identity", "experience", "detail", "context", "seasonal"}
LQIP_PREFIX = "data:image/webp;base64,"
LQIP_MIN_BYTES = 350
LQIP_MAX_BYTES = 750


def derivative_path_for(asset_path, width=800):
    if not asset_path.endswith(".webp"):
        return None
    if width not in DERIVATIVE_WIDTHS:
        return None
    return asset_path[: -len(".webp")] + f"-{width}w.webp"
SUPPORTED_LICENSES = {
    "CC0",
    "Public Domain",
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
PROCESSING_MAX_DIMENSION = 1600
SUPPORTED_PROCESSING = {
    "webp-reencoded",
    "resized-and-webp-reencoded",
}


def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def valid_url(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def expected_license_path(license_):
    """Canonical creativecommons.org path for a supported license name.

    Derived from the license name rather than a hand-kept table, so a license added to
    SUPPORTED_LICENSES cannot silently skip the licenseUrl agreement check below.
    """
    if license_ == "CC0":
        return "/publicdomain/zero/1.0"
    parts = license_.split()
    if len(parts) != 3 or parts[0] != "CC":
        return None
    return f"/licenses/{parts[1].lower()}/{parts[2]}"


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


def valid_lqip(value):
    if not isinstance(value, str) or not value.startswith(LQIP_PREFIX):
        return False
    encoded = value[len(LQIP_PREFIX):]
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        return False
    return (
        LQIP_MIN_BYTES <= len(value.encode("ascii")) <= LQIP_MAX_BYTES
        and decoded.startswith(b"RIFF")
        and decoded[8:12] == b"WEBP"
    )


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
            if any(asset_path.endswith(f"-{width}w.webp") for width in DERIVATIVE_WIDTHS):
                errors.append(
                    f"{label}: assetPath {asset_path!r} uses a reserved derivative suffix "
                    "(-400w/-800w); register the full-size original instead"
                )

        if isinstance(asset_path, str):
            if asset_path in seen_asset_paths:
                errors.append(f"{label}: duplicate assetPath {asset_path!r}")
            seen_asset_paths.add(asset_path)
            original_file = asset_root / asset_path
            if not original_file.is_file():
                errors.append(f"{label}: referenced asset is missing on disk: {asset_path}")
            else:
                for width in DERIVATIVE_WIDTHS:
                    derivative_rel = derivative_path_for(asset_path, width)
                    derivative_file = asset_root / derivative_rel
                    if not derivative_file.is_file():
                        errors.append(
                            f"{label}: {width}w derivative is missing on disk: {derivative_rel} "
                            "(run scripts/build-photography-derivatives.py)"
                        )
                    else:
                        seen_asset_paths.add(derivative_rel)
                        derivative_size = derivative_file.stat().st_size
                        if derivative_size == 0:
                            errors.append(f"{label}: {width}w derivative is empty: {derivative_rel}")
                        elif derivative_size > original_file.stat().st_size:
                            errors.append(
                                f"{label}: {width}w derivative {derivative_rel} is larger than its original; "
                                "it is meant to be a lighter rendition"
                            )

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

        if license_ in SUPPORTED_LICENSES:
            if license_ == "Public Domain":
                if record.get("licenseBasis") != "PD-self":
                    errors.append(f"{label}: Public Domain requires the verified licenseBasis 'PD-self'")
                if record.get("source") != "Wikimedia Commons" or urlparse(
                    record.get("sourceUrl") or ""
                ).netloc != "commons.wikimedia.org":
                    errors.append(f"{label}: PD-self provenance must point to its Wikimedia Commons file page")
                original_title = record.get("originalTitle")
                if not isinstance(original_title, str) or not original_title.strip():
                    errors.append(f"{label}: PD-self provenance requires originalTitle")
                if record.get("licenseUrl"):
                    errors.append(f"{label}: Public Domain must not carry an invented licenseUrl")
            else:
                license_url = record.get("licenseUrl")
                if not valid_url(license_url):
                    errors.append(
                        f"{label}: licenseUrl must be a well-formed http(s) URL for every supported license"
                    )
                else:
                    # A well-formed URL is not enough: the visible attribution links this URL as the
                    # license, so a by-sa URL under a `CC BY` record would publish a legally wrong
                    # claim while passing every other check.
                    expected_path = expected_license_path(license_)
                    parsed = urlparse(license_url)
                    if expected_path is None:
                        errors.append(
                            f"{label}: no canonical license URL is defined for license {license_!r}"
                        )
                    elif parsed.netloc != "creativecommons.org" or not parsed.path.rstrip("/").startswith(
                        expected_path
                    ):
                        errors.append(
                            f"{label}: licenseUrl {license_url!r} does not match declared license "
                            f"{license_!r}; expected creativecommons.org{expected_path}"
                        )
        elif record.get("licenseBasis"):
            errors.append(f"{label}: licenseBasis is only valid for the Public Domain license")

        if not is_usable_alt(record.get("alt")):
            errors.append(f"{label}: alt text is missing, too short, or looks like a placeholder")

        role = record.get("role")
        if role not in SUPPORTED_ROLES:
            errors.append(f"{label}: role must be one of {sorted(SUPPORTED_ROLES)!r}, got {role!r}")

        if not valid_lqip(record.get("lqip")):
            errors.append(
                f"{label}: lqip must be a valid inline WebP data URL of approximately 400–700 bytes"
            )

        if not valid_url(record.get("acquisitionUrl")):
            errors.append(f"{label}: acquisitionUrl must be a well-formed http(s) URL")

        original_title = record.get("originalTitle")
        if not isinstance(original_title, str) or not original_title.strip():
            errors.append(f"{label}: originalTitle is required for Commons provenance")

        attribution_title = record.get("attributionTitle")
        if attribution_title is not None and (
            not isinstance(attribution_title, str) or not attribution_title.strip()
        ):
            errors.append(f"{label}: attributionTitle must be a non-empty string when present")

        original_width = record.get("originalWidth")
        original_height = record.get("originalHeight")
        dimensions_valid = (
            type(original_width) is int
            and original_width > 0
            and type(original_height) is int
            and original_height > 0
        )
        if not dimensions_valid:
            errors.append(f"{label}: originalWidth/originalHeight must be positive integers")

        processing = record.get("processing")
        if processing not in SUPPORTED_PROCESSING:
            errors.append(
                f"{label}: processing must be one of {sorted(SUPPORTED_PROCESSING)!r}, got {processing!r}"
            )
        elif dimensions_valid:
            # Block 3 A1 relaxed this in one direction only.
            #
            # A file larger than the max dimension *must* have been resized, so claiming
            # `webp-reencoded` for one is still a hard error — that direction is a lie about
            # the asset. But a file at or below the max dimension may legitimately have been
            # fetched as a reduced rendition: Commons only serves cached thumbnails strictly
            # narrower than the source, and asking for the original is what the host refuses
            # (see `choose_render_width` in scripts/acquire-photography.py). So
            # `resized-and-webp-reencoded` is valid at any size, and the only forbidden
            # combination is "not resized" on a file that had to be.
            if (
                max(original_width, original_height) > PROCESSING_MAX_DIMENSION
                and processing != "resized-and-webp-reencoded"
            ):
                errors.append(
                    f"{label}: processing {processing!r} contradicts original dimensions "
                    f"{original_width}x{original_height}; a file larger than "
                    f"{PROCESSING_MAX_DIMENSION}px must be 'resized-and-webp-reencoded'"
                )

        source_key = original_title or record.get("acquisitionUrl")
        if source_key:
            source_to_places.setdefault(source_key, set()).add(place_id)

    # Every file in the asset tree must be accounted for: a registered original, or the card
    # derivative of one. Before Block 2 this validator never looked at the tree at all, so an
    # orphaned blob left behind by a renamed or dropped record would ship unnoticed and
    # unreferenced. `seen_asset_paths` already holds both classes by this point.
    tree_root = asset_root / APPROVED_ASSET_PREFIX
    if tree_root.is_dir():
        for path in sorted(tree_root.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(asset_root).as_posix()
            if relative not in seen_asset_paths:
                errors.append(
                    f"orphaned asset on disk: {relative} is neither a registered photograph "
                    "nor the card derivative of one"
                )

    for source_key, places_using_it in source_to_places.items():
        if len(places_using_it) > 1:
            errors.append(
                f"source {source_key!r} is declared for more than one place: {sorted(places_using_it)} "
                "(the same photograph may never silently represent unrelated places)"
            )

    for place_id, records in images_by_place.items():
        roles = [record.get("role") for record in records]
        if roles.count("identity") != 1:
            errors.append(
                f"place {place_id!r}: expected exactly one identity image, found {roles.count('identity')}"
            )
        duplicate_roles = sorted({role for role in roles if role and roles.count(role) > 1})
        if duplicate_roles:
            errors.append(f"place {place_id!r}: duplicate photography role(s) {duplicate_roles}")

    return errors, images_by_place


def validate_unique_asset_bytes(metadata, asset_root):
    """B6.2: no two registered files (originals or renditions) may share their bytes.

    The title/URL check above catches the same Commons source declared twice; this catches
    the same photograph committed under two names or reused for two places, which a renamed
    or re-downloaded copy would otherwise slip past. Pure hashlib, still Pillow-free.
    """
    errors = []
    seen = {}
    for record in metadata.get("images", []) if isinstance(metadata, dict) else []:
        asset_path = record.get("assetPath") if isinstance(record, dict) else None
        if not isinstance(asset_path, str) or not asset_path.endswith(".webp"):
            continue
        paths = [asset_path] + [derivative_path_for(asset_path, width) for width in DERIVATIVE_WIDTHS]
        for rel in paths:
            file = asset_root / rel
            if not file.is_file():
                continue
            digest = hashlib.sha256(file.read_bytes()).hexdigest()
            if digest in seen:
                errors.append(f"{rel}: byte-identical to {seen[digest]} (duplicate photograph)")
            else:
                seen[digest] = rel
    return errors


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

    errors.extend(validate_unique_asset_bytes(metadata, asset_root))

    places_by_id = {place.get("id"): place for place in places if isinstance(place, dict)}
    for hub in sorted({place.get("hub") for place in places_by_id.values()}):
        total = 0
        for place_id, records in images_by_place.items():
            place = places_by_id.get(place_id)
            if not place or place.get("hub") != hub or not records:
                continue
            derivative = asset_root / derivative_path_for(records[0]["assetPath"], 800)
            if derivative.is_file():
                total += derivative.stat().st_size
        if total > CITY_IMAGE_BUDGET_BYTES:
            errors.append(
                f"hub {hub!r}: first-image 800w list payload is {total} bytes, "
                f"above the {CITY_IMAGE_BUDGET_BYTES}-byte contract"
            )

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
