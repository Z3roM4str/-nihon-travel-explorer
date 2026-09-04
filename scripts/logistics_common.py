"""Shared constants and helpers for the Phase 3B2A walking-validation pipeline.

Used by scripts/select-walking-pilot.py, scripts/validate-walking-pilot.py,
scripts/report-walking-pilot.py and scripts/validate-logistics.py so the API host,
coordinate-order rule, and minute-rounding rule are defined exactly once.
"""
import hashlib
import json
import math
from pathlib import Path

# openrouteservice / HeiGIT. api.openrouteservice.org is deprecated (shut off
# 2026-09-28); api.heigit.org is the current host. This is the single place that
# string is allowed to appear so a regression test can assert it never appears
# anywhere else in the codebase (see scripts/test_walking_pilot.py).
ORS_HOST = "https://api.heigit.org"
ORS_DIRECTIONS_PATH_TEMPLATE = "/openrouteservice/v2/directions/{profile}/json"
# The Snap endpoint returns, per input coordinate, the nearest point actually on the
# routable network and its distance from the input ("snapped_distance", meters) — see
# https://giscience.github.io/openrouteservice/api-reference/endpoints/snapping/.
# Directions never reports this itself, so a route between two points that both snap
# far from where they really are can look shorter (or longer) than reality without any
# error being raised. See docs/WALKING_PILOT.md's JP-063<->JP-065 finding.
ORS_SNAP_PATH_TEMPLATE = "/openrouteservice/v2/snap/{profile}/json"
ORS_SNAP_MAX_RADIUS_METERS = 350  # the API's own documented maximum snap radius
ORS_PROFILE_FOOT_WALKING = "foot-walking"
ORS_PROVIDER = "openrouteservice"

# Documented account-plan limits, verified 2026-09 against openrouteservice's own docs
# (https://openrouteservice.org/restrictions/ and
# https://giscience.github.io/openrouteservice/frequently-asked-questions) — used only
# for the scale-up dry-run's request-planning report (scripts/validate-walking-scale.py),
# never to decide anything at request time. These are the DEFAULT community-plan values;
# a specific account's actual quota can differ and should be checked against its own
# dashboard before any real scale-up execution.
ORS_DIRECTIONS_DAILY_LIMIT_DOCUMENTED = 2000
ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED = 40
# The Snap endpoint's own per-minute/per-day rate limit is not published in either
# source above (only its per-request location cap is) — the dry-run report says so
# explicitly rather than guessing a number.
ORS_SNAP_MAX_LOCATIONS_PER_REQUEST = 5000

DEPRECATED_ORS_HOST = "api.openrouteservice.org"

# Objective threshold for classifying a validated edge's endpoint snapping: derived from
# the JP-063<->JP-065 diagnostic (see docs/WALKING_PILOT.md), where combined endpoint
# snapping was itself large relative to the routed distance (3.2 m) for a pair of points
# ~22.2 m apart in reality — the textbook sign that the "route" measured is actually the
# gap between two snap points, not a path between the original coordinates. An edge is
# "significant" when the combined snap distance at both endpoints is both non-trivial in
# absolute terms AND large relative to the routed distance, so a long route with an
# ordinary few-meter snap (routine, expected, harmless) is not flagged just because a
# short route with the same absolute snap would be.
SNAP_SIGNIFICANT_ABSOLUTE_METERS = 10.0
SNAP_SIGNIFICANT_ROUTED_DISTANCE_RATIO = 0.5

# A second, per-endpoint absolute criterion, kept OFF (None) by default. Phase 3B2B-A's
# threshold audit (docs/WALKING_SCALE_PREP.md) found that Phase 3B2A's real N=24 sample
# already contains a "clean" edge (JP-184->JP-185) where a single endpoint snapped
# 139.31 m — large in absolute terms — but the edge stayed "clean" because its routed
# distance (1314.1 m) is long enough that 139.31 m is only ~11.7% of it, under the
# combined/ratio rule above. Whether a lone 139 m snap should
# independently disqualify an edge regardless of route length is a real open question
# the audit could not answer: N=24 contains exactly one case anywhere near that
# magnitude, which is not enough to calibrate a second threshold without a real risk of
# reclassifying legitimate long-route cases as spurious "significant". Rather than bury
# a guess in code, this stays an explicit, named, disabled constant: a future phase can
# set it once a larger, more representative batch justifies a specific number, and
# nothing about existing classifications changes until it does (None here always means
# "this criterion contributes nothing", so leaving it unset cannot silently reclassify
# any already-computed Phase 3B2A result).
SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS = None

# The three states an edge's endpoint-snapping assessment can be in. "unknown" is a
# first-class outcome, never silently coerced into "clean": a null snapped_distance
# (the Snap endpoint found no routable point within its radius) or a failed diagnostic
# query means the edge's comparability to the original coordinates was never
# established — that is a different fact from "measured and found small displacement".
SNAP_ASSESSMENTS = ("clean", "significant", "unknown")


def classify_endpoint_snapping(
    from_snap_meters,
    to_snap_meters,
    routed_distance_meters,
    per_endpoint_absolute_cap_meters=SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS,
):
    """Pure function of the three numbers — no I/O — reused by the pipeline, the
    validator, the report, and mirrored by getBestTransfer's TypeScript counterpart
    (which reads the stored result of this function rather than recomputing it).

    Returns "unknown" whenever either endpoint's snap distance is None: a null is
    never treated as 0 meters, because an unmeasured endpoint means the pair's
    comparability to the original coordinates is undetermined, not confirmed clean.
    Only when both endpoints have a real measurement does this return "clean" or
    "significant" per the threshold(s) below.

    `per_endpoint_absolute_cap_meters` is an optional second criterion: when set (not
    None) and either endpoint's own snap distance meets or exceeds it, the edge is
    "significant" regardless of the combined/ratio rule. It defaults to
    SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS (None = disabled) so every existing
    caller — and every already-computed Phase 3B2A result — keeps its exact prior
    classification unless a caller explicitly opts into a real cap.
    """
    if from_snap_meters is None or to_snap_meters is None:
        return "unknown"
    if per_endpoint_absolute_cap_meters is not None and (
        from_snap_meters >= per_endpoint_absolute_cap_meters
        or to_snap_meters >= per_endpoint_absolute_cap_meters
    ):
        return "significant"
    combined = from_snap_meters + to_snap_meters
    if (
        combined >= SNAP_SIGNIFICANT_ABSOLUTE_METERS
        and combined >= SNAP_SIGNIFICANT_ROUTED_DISTANCE_RATIO * max(routed_distance_meters, 1e-9)
    ):
        return "significant"
    return "clean"

# The only Modo value this pilot validates. Phase 3B2A is walking-only.
WALKING_MODE_RAW = "A pie"

MANIFEST_PATH = Path("data/logistics/walking-pilot-manifest.json")
RESULTS_PATH = Path("data/logistics/walking-pilot-results.json")
# Copy the app build reads at runtime (app/src/lib/transfer.ts), mirroring how
# app/src/data/*.json mirrors data/*.json for the workbook-derived files.
APP_RESULTS_PATH = Path("app/src/data/logistics/walking-pilot-results.json")

PILOT_EDGE_COUNT = 24

# Phase 3B2B-A: scale-up manifest/results and the per-place Snap store. Named the same
# way as the pilot's own paths (data/logistics/*.json, mirrored to app/src/data/ only
# once a phase actually ships results the app should read — the scale manifest and the
# snap-places store are prep artifacts, not consumed by the app, so they are NOT
# mirrored under app/src/data/; only SCALE_RESULTS_PATH would be, if/when a future phase
# actually executes the scale batch and getBestTransfer needs to read it).
SCALE_MANIFEST_PATH = Path("data/logistics/walking-scale-manifest.json")
SCALE_RESULTS_PATH = Path("data/logistics/walking-scale-results.json")
APP_SCALE_RESULTS_PATH = Path("app/src/data/logistics/walking-scale-results.json")

# Snap is a property of a place's coordinate, not of a directed edge or a pair — see
# ORS_SNAP_PATH_TEMPLATE's docstring above. This store is keyed by placeId exactly once,
# so N edges sharing a place never re-snap it: a single batched Snap request can resolve
# every place a whole scale-up manifest needs, deduplicated, regardless of how many
# edges reference each one.
SNAP_PLACES_PATH = Path("data/logistics/walking-snap-places.json")
SNAP_PLACES_VERSION = 1


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


def sha256_of_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dataset_digest(data_dir=Path("data")):
    """Content hash of the two files the pilot selection reads, keyed by algorithm.

    Deliberately NOT the git HEAD SHA: two commits can carry byte-identical
    places.json/nearby.json (e.g. an unrelated doc change), and the manifest's
    reproducibility promise is about the *dataset*, not about which commit happened
    to be checked out when it was generated. Re-running the selector against
    unchanged data must produce a byte-identical manifest; a HEAD-based value would
    break that every time the branch tip moves for an unrelated reason.
    """
    data_dir = Path(data_dir)
    return {
        "algorithm": "sha256",
        "places": sha256_of_file(data_dir / "places.json"),
        "nearby": sha256_of_file(data_dir / "nearby.json"),
    }


def load_snap_places_store(path=SNAP_PLACES_PATH):
    """Returns {} if the store doesn't exist yet — a missing store is "nothing resolved
    yet", never an error, mirroring load_existing_results()'s pilot-side convention."""
    if not Path(path).exists():
        return {"snapVersion": SNAP_PLACES_VERSION, "places": {}}
    return load_json(path)


def build_snap_place_entry(
    place, snapped_distance_m, radius, provider, profile, verified_at, reason=None
):
    """One placeId's entry in the Snap store. `coordinates` is the exact coordinate
    that was actually sent to the Snap endpoint (not re-read from places.json at
    lookup time) so a later dataset edit that moves the place is visible as a stale
    entry (see is_snap_entry_current) instead of silently attaching an old
    measurement to a new coordinate.

    `status` is "resolved" only when a real snapped_distance came back; a None
    measurement (unsnappable point, or a failed query) is "unknown" — never coerced
    into a 0-meter "resolved" entry, for exactly the same reason
    classify_endpoint_snapping never treats a None snap distance as 0.
    """
    status = "resolved" if snapped_distance_m is not None else "unknown"
    entry = {
        "coordinates": {"lat": place["coordinates"]["lat"], "lng": place["coordinates"]["lng"]},
        "snappedDistanceMeters": snapped_distance_m,
        "radiusMeters": radius,
        "provider": provider,
        "profile": profile,
        "verifiedAt": verified_at,
        "status": status,
    }
    if status == "unknown" and reason:
        entry["reason"] = reason
    return entry


def is_snap_entry_current(entry, place):
    """A cached snap entry is only reusable while it was measured against the exact
    coordinate the dataset currently has for that place. If a workbook update ever
    moves a place, its old entry must not be silently reused — this makes that check
    explicit rather than assuming a placeId's coordinates never change.
    """
    coords = place["coordinates"]
    return entry.get("coordinates") == {"lat": coords["lat"], "lng": coords["lng"]}
