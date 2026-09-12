#!/usr/bin/env python3
"""Offline validation for the versioned official reservation-mechanism catalog."""

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

SCOPES = {
    "general-admission",
    "park-admission",
    "guided-visit",
    "event-admission",
    "area-timed-entry",
    "workshop",
    "other-explicit",
}
KINDS = {
    "monthly-fixed-release",
    "rolling-calendar-month-release",
    "rolling-day-release",
    "relative-application-window",
    "fixed-sale-date",
}
ALLOCATIONS = {
    "first-come",
    "drawing",
    "lottery-if-oversubscribed",
    "capacity-limited",
    "not-stated",
}
CONFIDENCES = {"official-explicit", "official-derived"}
STATUSES = {"active", "superseded"}
TIME_ZONES = {None, "Asia/Tokyo"}
ID_PATTERN = re.compile(r"^RM-(JP-\d{3})-(\d{3})$")
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
SECRET_KEYS = {"apikey", "api_key", "authorization", "key", "token", "secret", "password"}

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_PATH = ROOT / "data/reservation-mechanisms.json"
DEFAULT_APP_PATH = ROOT / "app/src/data/reservation-mechanisms.json"
DEFAULT_PLACES_PATH = ROOT / "data/places.json"


def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def valid_url(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def valid_time_or_null(value):
    return value is None or (isinstance(value, str) and TIME_PATTERN.fullmatch(value) is not None)


def positive_safe_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value <= 9_007_199_254_740_991


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
            found.extend(find_secrets(child, f"{path}[{index}]"))
    return found


def require_exact_keys(value, expected, label, errors):
    actual = set(value) if isinstance(value, dict) else set()
    missing = expected - actual
    extra = actual - expected
    if missing:
        errors.append(f"{label}: missing fields {sorted(missing)}")
    if extra:
        errors.append(f"{label}: unsupported fields {sorted(extra)}")


def validate_clock_fields(mechanism, label, errors):
    if not valid_time_or_null(mechanism.get("releaseTimeLocal")):
        errors.append(f"{label}: releaseTimeLocal must be null or HH:mm")
    if mechanism.get("sourceTimeZone") not in TIME_ZONES:
        errors.append(f"{label}: sourceTimeZone must be null or 'Asia/Tokyo'")


def validate_mechanism(mechanism, label, errors):
    if not isinstance(mechanism, dict):
        errors.append(f"{label}: mechanism must be an object")
        return
    kind = mechanism.get("kind")
    if kind not in KINDS:
        errors.append(f"{label}: unsupported mechanism kind {kind!r}")
        return

    if kind == "monthly-fixed-release":
        require_exact_keys(
            mechanism,
            {"kind", "releaseDayOfMonth", "releaseTimeLocal", "sourceTimeZone", "target"},
            label,
            errors,
        )
        day = mechanism.get("releaseDayOfMonth")
        if not isinstance(day, int) or isinstance(day, bool) or not 1 <= day <= 31:
            errors.append(f"{label}: releaseDayOfMonth must be an integer in 1..31")
        validate_clock_fields(mechanism, label, errors)
        if mechanism.get("target") != "subsequent-calendar-month":
            errors.append(f"{label}: unsupported monthly target {mechanism.get('target')!r}")

    elif kind == "rolling-calendar-month-release":
        require_exact_keys(
            mechanism,
            {
                "kind",
                "monthsBeforeVisit",
                "alignment",
                "missingAlignedDayRule",
                "releaseTimeLocal",
                "sourceTimeZone",
            },
            label,
            errors,
        )
        if not positive_safe_integer(mechanism.get("monthsBeforeVisit")):
            errors.append(f"{label}: monthsBeforeVisit must be a positive safe integer")
        if mechanism.get("alignment") != "same-calendar-day":
            errors.append(f"{label}: alignment must be 'same-calendar-day'")
        if mechanism.get("missingAlignedDayRule") not in {"first-day-of-next-month", "not-recorded"}:
            errors.append(f"{label}: unsupported missingAlignedDayRule")
        validate_clock_fields(mechanism, label, errors)

    elif kind == "rolling-day-release":
        require_exact_keys(
            mechanism,
            {"kind", "daysBeforeVisit", "releaseTimeLocal", "sourceTimeZone"},
            label,
            errors,
        )
        if not positive_safe_integer(mechanism.get("daysBeforeVisit")):
            errors.append(f"{label}: daysBeforeVisit must be a positive safe integer")
        validate_clock_fields(mechanism, label, errors)

    elif kind == "relative-application-window":
        require_exact_keys(mechanism, {"kind", "openRule", "closeRule"}, label, errors)
        open_rule = mechanism.get("openRule")
        close_rule = mechanism.get("closeRule")
        if not isinstance(open_rule, dict):
            errors.append(f"{label}: openRule must be an object")
        else:
            require_exact_keys(
                open_rule,
                {"kind", "monthsBeforeVisitMonth", "timeLocal", "sourceTimeZone"},
                f"{label}.openRule",
                errors,
            )
            if open_rule.get("kind") != "month-offset-first-day":
                errors.append(f"{label}.openRule: kind must be 'month-offset-first-day'")
            if not positive_safe_integer(open_rule.get("monthsBeforeVisitMonth")):
                errors.append(f"{label}.openRule: monthsBeforeVisitMonth must be a positive safe integer")
            if not valid_time_or_null(open_rule.get("timeLocal")):
                errors.append(f"{label}.openRule: timeLocal must be null or HH:mm")
            if open_rule.get("sourceTimeZone") not in TIME_ZONES:
                errors.append(f"{label}.openRule: unsupported sourceTimeZone")
        if not isinstance(close_rule, dict):
            errors.append(f"{label}: closeRule must be an object")
        else:
            require_exact_keys(
                close_rule,
                {"kind", "daysBeforeVisit", "timeLocal", "sourceTimeZone"},
                f"{label}.closeRule",
                errors,
            )
            if close_rule.get("kind") != "days-before-visit":
                errors.append(f"{label}.closeRule: kind must be 'days-before-visit'")
            if not positive_safe_integer(close_rule.get("daysBeforeVisit")):
                errors.append(f"{label}.closeRule: daysBeforeVisit must be a positive safe integer")
            if not valid_time_or_null(close_rule.get("timeLocal")):
                errors.append(f"{label}.closeRule: timeLocal must be null or HH:mm")
            if close_rule.get("sourceTimeZone") not in TIME_ZONES:
                errors.append(f"{label}.closeRule: unsupported sourceTimeZone")

    elif kind == "fixed-sale-date":
        require_exact_keys(
            mechanism,
            {
                "kind",
                "saleDate",
                "releaseTimeLocal",
                "sourceTimeZone",
                "appliesToStartDate",
                "appliesToEndDate",
            },
            label,
            errors,
        )
        if not valid_date(mechanism.get("saleDate")):
            errors.append(f"{label}: saleDate must be a valid YYYY-MM-DD date")
        validate_clock_fields(mechanism, label, errors)
        start = mechanism.get("appliesToStartDate")
        end = mechanism.get("appliesToEndDate")
        if start is not None and not valid_date(start):
            errors.append(f"{label}: appliesToStartDate must be null or a valid YYYY-MM-DD date")
        if end is not None and not valid_date(end):
            errors.append(f"{label}: appliesToEndDate must be null or a valid YYYY-MM-DD date")
        if valid_date(start) and valid_date(end) and start > end:
            errors.append(f"{label}: appliesToStartDate must not be after appliesToEndDate")


def validate_catalog(catalog, place_ids):
    errors = []
    if not isinstance(catalog, list):
        return ["reservation-mechanisms.json top level must be an array"]

    seen_ids = set()
    active_identity = set()
    for index, record in enumerate(catalog):
        label = f"reservationMechanisms[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{label}: entry must be an object")
            continue

        require_exact_keys(
            record,
            {"id", "placeId", "scope", "mechanism", "allocation", "status", "provenance"},
            label,
            errors,
        )

        record_id = record.get("id")
        place_id = record.get("placeId")
        match = ID_PATTERN.fullmatch(record_id) if isinstance(record_id, str) else None
        if record_id in seen_ids:
            errors.append(f"{label}: duplicate global id {record_id!r}")
        seen_ids.add(record_id)
        if not match:
            errors.append(f"{label}: id must match RM-<PLACE_ID>-<NNN>")
        elif match.group(1) != place_id:
            errors.append(f"{label}: id namespace does not match placeId {place_id!r}")
        if place_id not in place_ids:
            errors.append(f"{label}: unknown placeId {place_id!r}")

        scope = record.get("scope")
        if scope not in SCOPES:
            errors.append(f"{label}: unsupported scope {scope!r}")
        allocation = record.get("allocation")
        if allocation not in ALLOCATIONS:
            errors.append(f"{label}: unsupported allocation {allocation!r}")
        status = record.get("status")
        if status not in STATUSES:
            errors.append(f"{label}: unsupported status {status!r}")

        validate_mechanism(record.get("mechanism"), f"{label}.mechanism", errors)

        provenance = record.get("provenance")
        if not isinstance(provenance, dict):
            errors.append(f"{label}: provenance is required")
            provenance = {}
        else:
            require_exact_keys(
                provenance,
                {"sourceUrl", "sourceEntity", "consultedAt", "evidence", "confidence"},
                f"{label}.provenance",
                errors,
            )
        if not valid_url(provenance.get("sourceUrl")):
            errors.append(f"{label}: provenance.sourceUrl must be a non-empty https URL")
        for field in ("sourceEntity", "evidence"):
            if not isinstance(provenance.get(field), str) or not provenance.get(field).strip():
                errors.append(f"{label}: provenance.{field} must be non-empty")
        if not valid_date(provenance.get("consultedAt")):
            errors.append(f"{label}: provenance.consultedAt must be a valid YYYY-MM-DD date")
        if provenance.get("confidence") not in CONFIDENCES:
            errors.append(f"{label}: unsupported provenance confidence {provenance.get('confidence')!r}")

        if status == "active" and place_id in place_ids and scope in SCOPES:
            identity = (place_id, scope)
            if identity in active_identity:
                errors.append(f"{label}: duplicate active placeId + scope identity {identity}")
            active_identity.add(identity)

    for secret_path in find_secrets(catalog):
        errors.append(f"possible secret/API credential stored at {secret_path}")
    return errors


def validate(source_path=DEFAULT_SOURCE_PATH, app_path=DEFAULT_APP_PATH, places_path=DEFAULT_PLACES_PATH):
    try:
        catalog = load(source_path)
        places = load(places_path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot load required artifact: {exc}"]

    place_ids = {place.get("id") for place in places if isinstance(place, dict)}
    errors = validate_catalog(catalog, place_ids)

    if app_path is not None:
        try:
            source_text = Path(source_path).read_text(encoding="utf-8")
            app_text = Path(app_path).read_text(encoding="utf-8")
            if source_text != app_text:
                errors.append("app/source reservation-mechanisms.json byte parity mismatch")
        except OSError as exc:
            errors.append(f"cannot validate app-facing reservation-mechanisms.json: {exc}")
    return errors


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    source = Path(args[0]) if args else DEFAULT_SOURCE_PATH
    app = Path(args[1]) if len(args) > 1 else DEFAULT_APP_PATH
    places = Path(args[2]) if len(args) > 2 else DEFAULT_PLACES_PATH
    errors = validate(source, app, places)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("OK: reservation-mechanism catalog is valid; source/app byte parity confirmed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
