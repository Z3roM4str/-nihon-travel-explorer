#!/usr/bin/env python3
"""Offline validation for the versioned logistics access-point catalog."""
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROLES = {"visitor-entrance", "gate", "reception", "trailhead", "road-access", "transit-stop", "general-access"}
CONTEXTS = {"external-walk", "external-local-transit", "internal-shuttle", "internal-hike"}
CONFIDENCES = {"official-explicit", "official-derived"}
STATUSES = {"active", "deprecated"}
ID_PATTERN = re.compile(r"^AP-(JP-\d{3})-(\d{3})$")
SECRET_KEYS = {"apikey", "api_key", "authorization", "key", "token", "secret", "password"}
DEFAULT_APP_PATH = Path(__file__).resolve().parents[1] / "app/src/data/logistics/access-points.json"


def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def find_secrets(value, path=""):
    found = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}/{key}"
            if str(key).lower() in SECRET_KEYS and child not in (None, ""):
                found.append(child_path)
            found.extend(find_secrets(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(find_secrets(child, f"{path}[{index}]") )
    return found


def valid_url(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate_catalog(catalog, place_ids):
    errors = []
    if not isinstance(catalog, list):
        return ["access-points.json top level must be an array"]

    seen_ids = set()
    defaults = set()
    coordinate_claims = set()
    for index, point in enumerate(catalog):
        label = f"accessPoints[{index}]"
        if not isinstance(point, dict):
            errors.append(f"{label}: entry must be an object")
            continue
        point_id, place_id = point.get("id"), point.get("placeId")
        match = ID_PATTERN.fullmatch(point_id) if isinstance(point_id, str) else None
        if point_id in seen_ids:
            errors.append(f"{label}: duplicate global id {point_id!r}")
        seen_ids.add(point_id)
        if not match:
            errors.append(f"{label}: id must match AP-<PLACE_ID>-<NNN>")
        elif match.group(1) != place_id:
            errors.append(f"{label}: id namespace does not match placeId {place_id!r}")
        if place_id not in place_ids:
            errors.append(f"{label}: unknown placeId {place_id!r}")

        point_label = point.get("label")
        if not isinstance(point_label, str) or not point_label.strip():
            errors.append(f"{label}: label must be a non-empty string")
        if "notes" in point and not isinstance(point["notes"], str):
            errors.append(f"{label}: notes must be a string when present")

        role = point.get("role")
        if role not in ROLES:
            errors.append(f"{label}: unknown role {role!r}")
        status = point.get("status")
        if status not in STATUSES:
            errors.append(f"{label}: unknown status {status!r}")

        coordinates = point.get("coordinates")
        if not isinstance(coordinates, dict):
            errors.append(f"{label}: coordinates must contain named lat and lng values")
            coordinates = {}
        lat, lng = coordinates.get("lat"), coordinates.get("lng")
        if isinstance(lat, bool) or not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
            errors.append(f"{label}: lat must be within [-90, 90]")
        if isinstance(lng, bool) or not isinstance(lng, (int, float)) or not -180 <= lng <= 180:
            errors.append(f"{label}: lng must be within [-180, 180]")

        contexts = point.get("applicableContexts")
        if not isinstance(contexts, list) or not contexts:
            errors.append(f"{label}: applicableContexts must be a non-empty array")
            contexts = []
        if any(contexts.count(context) > 1 for context in contexts):
            errors.append(f"{label}: applicableContexts contains a duplicate context")
        for context in contexts:
            if context not in CONTEXTS:
                errors.append(f"{label}: unknown context {context!r}")

        provenance = point.get("provenance")
        if not isinstance(provenance, dict):
            errors.append(f"{label}: provenance is required")
            provenance = {}
        if not valid_url(provenance.get("sourceUrl")):
            errors.append(f"{label}: provenance.sourceUrl must be a non-empty http(s) URL")
        for field in ("sourceEntity", "evidence"):
            if not isinstance(provenance.get(field), str) or not provenance.get(field).strip():
                errors.append(f"{label}: provenance.{field} must be non-empty")
        if not valid_date(provenance.get("consultedAt")):
            errors.append(f"{label}: provenance.consultedAt must be a valid YYYY-MM-DD date")
        if provenance.get("confidence") not in CONFIDENCES:
            errors.append(f"{label}: unsupported provenance confidence {provenance.get('confidence')!r}")

        selection = point.get("selection", {})
        if not isinstance(selection, dict):
            errors.append(f"{label}: selection must be an object when present")
            selection = {}
        default_contexts = selection.get("defaultForContexts", [])
        if not isinstance(default_contexts, list):
            errors.append(f"{label}: selection.defaultForContexts must be an array")
            default_contexts = []
        if any(default_contexts.count(context) > 1 for context in default_contexts):
            errors.append(f"{label}: selection.defaultForContexts contains a duplicate context")
        if status == "deprecated" and default_contexts:
            errors.append(f"{label}: deprecated access point cannot be a current default")
        for context in default_contexts:
            if context not in CONTEXTS:
                errors.append(f"{label}: unknown default context {context!r}")
            if context not in contexts:
                errors.append(f"{label}: default context {context!r} is not applicable")
            default_key = (place_id, context)
            if status == "active" and default_key in defaults:
                errors.append(f"{label}: multiple active defaults for {default_key}")
            if status == "active":
                defaults.add(default_key)

        if status == "active" and isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            for context in contexts:
                claim = (place_id, context, role, lat, lng)
                if claim in coordinate_claims:
                    errors.append(f"{label}: duplicate active coordinates for the same place/context/role")
                coordinate_claims.add(claim)

    for secret_path in find_secrets(catalog):
        errors.append(f"possible secret/API credential stored at {secret_path}")
    return errors


def find_orphan_endpoint_references(data_dir, access_points_by_id):
    errors = []
    for path in sorted((Path(data_dir) / "logistics").glob("*.json")):
        if path.name == "access-points.json":
            continue
        try:
            content = load(path)
        except (OSError, json.JSONDecodeError):
            continue

        def walk(value, trail=""):
            if isinstance(value, dict):
                if value.get("kind") == "access-point":
                    ref = value.get("accessPointId")
                    access_point = access_points_by_id.get(ref)
                    if access_point is None:
                        errors.append(f"{path}: orphan accessPointId {ref!r} at {trail}")
                    elif value.get("placeId") != access_point.get("placeId"):
                        errors.append(
                            f"{path}: endpoint placeId {value.get('placeId')!r} does not match "
                            f"access point {ref!r} placeId {access_point.get('placeId')!r} at {trail}"
                        )
                for key, child in value.items():
                    walk(child, f"{trail}/{key}")
            elif isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{trail}[{index}]")
        walk(content)
    return errors


def validate(data_dir=Path("data"), app_path=DEFAULT_APP_PATH):
    data_dir = Path(data_dir)
    source_path = data_dir / "logistics/access-points.json"
    try:
        catalog = load(source_path)
        places = load(data_dir / "places.json")
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot load required artifact: {exc}"]
    errors = validate_catalog(catalog, {place.get("id") for place in places if isinstance(place, dict)})
    errors.extend(
        find_orphan_endpoint_references(
            data_dir, {p.get("id"): p for p in catalog if isinstance(p, dict)}
        )
    )
    if app_path is not None:
        try:
            if load(app_path) != catalog:
                errors.append("app/source access-points.json parity mismatch")
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"cannot validate app-facing access-points.json: {exc}")
    return errors


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    data_dir = Path(args[0]) if args else Path("data")
    errors = validate(data_dir)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("OK: access-point catalog is valid; source/app parity confirmed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
