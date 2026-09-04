"""Shared constants and helpers for the Phase 3B2A walking-validation pipeline.

Used by scripts/select-walking-pilot.py, scripts/validate-walking-pilot.py,
scripts/report-walking-pilot.py and scripts/validate-logistics.py so the API host,
coordinate-order rule, and minute-rounding rule are defined exactly once.
"""
import json
import math
from pathlib import Path

# openrouteservice / HeiGIT. api.openrouteservice.org is deprecated (shut off
# 2026-09-28); api.heigit.org is the current host. This is the single place that
# string is allowed to appear so a regression test can assert it never appears
# anywhere else in the codebase (see scripts/test_walking_pilot.py).
ORS_HOST = "https://api.heigit.org"
ORS_DIRECTIONS_PATH_TEMPLATE = "/openrouteservice/v2/directions/{profile}/json"
ORS_PROFILE_FOOT_WALKING = "foot-walking"
ORS_PROVIDER = "openrouteservice"

DEPRECATED_ORS_HOST = "api.openrouteservice.org"

# The only Modo value this pilot validates. Phase 3B2A is walking-only.
WALKING_MODE_RAW = "A pie"

MANIFEST_PATH = Path("data/logistics/walking-pilot-manifest.json")
RESULTS_PATH = Path("data/logistics/walking-pilot-results.json")
# Copy the app build reads at runtime (app/src/lib/transfer.ts), mirroring how
# app/src/data/*.json mirrors data/*.json for the workbook-derived files.
APP_RESULTS_PATH = Path("app/src/data/logistics/walking-pilot-results.json")

PILOT_EDGE_COUNT = 24


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_places(data_dir=Path("data")):
    return load_json(Path(data_dir) / "places.json")


def load_nearby(data_dir=Path("data")):
    return load_json(Path(data_dir) / "nearby.json")


def places_by_id(places):
    return {p["id"]: p for p in places}


def nearby_by_directed_key(nearby):
    return {(r["Desde ID"], r["Hacia ID"]): r for r in nearby}


def to_ors_coordinates(place):
    """ORS expects [longitude, latitude]. Our Place stores {lat, lng}. This is the
    single conversion point — never inline a [place['coordinates']['lat'], ...]
    swap anywhere else. See scripts/test_walking_pilot.py for the regression test
    that makes swapping lat/lng here impossible to do silently.
    """
    coords = place["coordinates"]
    return [coords["lng"], coords["lat"]]


def round_half_up_minutes(seconds):
    """ORS duration (seconds, float) -> whole minutes.

    Rounds half away from zero (90s -> 2 min, 89.9s -> 1 min), not Python's
    built-in banker's rounding, so the rule is the intuitive one a reader expects
    and is independent of floating-point parity. No tolerance band is added: the
    single ORS sample becomes a single integer, and minMinutes == maxMinutes for
    every pilot result, because the range's job is to carry a real spread when one
    exists (not a fabricated one) — see TransferEdge.minutes in app/src/lib/transfer.ts.
    """
    return int(math.floor(seconds / 60.0 + 0.5))


def utc_now_iso():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
