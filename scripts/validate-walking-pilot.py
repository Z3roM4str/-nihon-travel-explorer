#!/usr/bin/env python3
"""Phase 3B2A walking-validation pilot pipeline.

Usage:
    python3 scripts/validate-walking-pilot.py --dry-run
    python3 scripts/validate-walking-pilot.py --execute [--refresh] [--data-dir data]

--dry-run:
    Loads data/logistics/walking-pilot-manifest.json, resolves each edge's Place and
    matching nearby.json relation, asserts Modo == "A pie", and prints exactly what
    would be queried (fromId/toId, ORS-ordered coordinates, current estimated
    distance/minutes for comparison). Makes no network requests. Always safe to run.

--execute:
    Requires the ORS_API_KEY environment variable (never read from a file, a CLI
    flag, or a default). Queries openrouteservice's Directions API (foot-walking
    profile) for edges that don't already have a cached "validated" result, writes
    data/logistics/walking-pilot-results.json and its app/src/data/logistics copy.
    --refresh re-queries every manifest edge, including already-validated ones.

Never validates more than the manifest's 24 edges. Never invents a result for a
request that failed — see WalkingPilotResult's "no-route" / "request-error" status.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    APP_RESULTS_PATH,
    MANIFEST_PATH,
    ORS_DIRECTIONS_PATH_TEMPLATE,
    ORS_HOST,
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    ORS_SNAP_MAX_RADIUS_METERS,
    ORS_SNAP_PATH_TEMPLATE,
    RESULTS_PATH,
    WALKING_MODE_RAW,
    classify_endpoint_snapping,
    load_json,
    load_nearby,
    load_places,
    nearby_by_directed_key,
    places_by_id,
    round_half_up_minutes,
    to_ors_coordinates,
    utc_now_iso,
    write_json,
)

# Verified against openrouteservice's terms of service and the OpenStreetMap Foundation's
# attribution guidelines during Phase 3B2A. Two distinct things are credited here, per
# their own separate licenses: the routing computation itself (openrouteservice/HeiGIT,
# CC BY 4.0) and the underlying map data (OpenStreetMap contributors, ODbL). Terms can
# change — re-verify at https://openrouteservice.org and
# https://www.openstreetmap.org/copyright before any production or public-facing use.
ATTRIBUTION = (
    "(c) openrouteservice.org by HeiGIT (routing computation, CC BY 4.0) | "
    "Map data (c) OpenStreetMap contributors, available under the Open Database "
    "License (ODbL). See https://openrouteservice.org and "
    "https://www.openstreetmap.org/copyright for current terms."
)

# One bounded retry for a transient failure (timeout / HTTP 429 or 5xx) per edge.
# Never retried: a successful non-route answer (2010/2009) or a client error (401/403).
MAX_TRANSIENT_RETRIES = 1
RETRY_DELAY_SECONDS = 2
REQUEST_TIMEOUT_SECONDS = 15

# ORS error codes documented as "no routable point" / "route not found" — a real,
# deterministic answer from the provider, not a transient failure. Never retried.
NO_ROUTE_ERROR_CODES = {2009, 2010}


class RoutingRequestError(Exception):
    """status is the WalkingPilotResult status this failure should become:
    'no-route' only for ORS's own "no routable point / no route" answer,
    'request-error' for everything else (auth, malformed response, rate limit,
    network, timeout). transient controls the one bounded retry and is
    independent of status — a 429 is transient and still ends up 'request-error'
    if the retry also fails.
    """

    def __init__(self, message, status, transient):
        super().__init__(message)
        self.status = status
        self.transient = transient


def resolve_manifest_edges(manifest, places, nearby):
    by_id = places_by_id(places)
    by_directed = nearby_by_directed_key(nearby)
    resolved = []
    for edge in manifest["edges"]:
        from_id, to_id = edge["fromId"], edge["toId"]
        from_place = by_id.get(from_id)
        to_place = by_id.get(to_id)
        relation = by_directed.get((from_id, to_id))
        if from_place is None or to_place is None:
            raise ValueError(f"manifest edge {from_id}->{to_id}: place not found")
        if relation is None:
            raise ValueError(f"manifest edge {from_id}->{to_id}: no matching nearby.json relation")
        if relation["Modo"] != WALKING_MODE_RAW:
            raise ValueError(
                f"manifest edge {from_id}->{to_id}: Modo is {relation['Modo']!r}, expected {WALKING_MODE_RAW!r}"
            )
        resolved.append(
            {
                "fromId": from_id,
                "toId": to_id,
                "category": edge.get("category"),
                "fromPlace": from_place,
                "toPlace": to_place,
                "relation": relation,
            }
        )
    return resolved


def query_ors(api_key, from_place, to_place):
    """POST the Directions API for one directed edge. Returns (distance_m, duration_s)
    on success. Raises RoutingRequestError('no-route', ...) only for ORS's own "no
    routable point / no route" answer; every other failure raises it with
    status='request-error' (auth, malformed body, rate limit, network, timeout).
    """
    url = ORS_HOST + ORS_DIRECTIONS_PATH_TEMPLATE.format(profile=ORS_PROFILE_FOOT_WALKING)
    body = json.dumps(
        {
            "coordinates": [to_ors_coordinates(from_place), to_ors_coordinates(to_place)],
            "geometry": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            payload = None
        error_code = None
        error_message = str(exc)
        if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
            error_code = payload["error"].get("code")
            error_message = payload["error"].get("message", error_message)
        if error_code in NO_ROUTE_ERROR_CODES:
            raise RoutingRequestError(error_message, status="no-route", transient=False) from exc
        transient = exc.code == 429 or exc.code >= 500
        raise RoutingRequestError(
            f"HTTP {exc.code}: {error_message}", status="request-error", transient=transient
        ) from exc
    except urllib.error.URLError as exc:
        raise RoutingRequestError(f"network error: {exc.reason}", status="request-error", transient=True) from exc
    except TimeoutError as exc:
        raise RoutingRequestError("request timed out", status="request-error", transient=True) from exc

    try:
        summary = payload["routes"][0]["summary"]
        return summary["distance"], summary["duration"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RoutingRequestError(
            f"unexpected response shape: {exc}", status="request-error", transient=False
        ) from exc


def query_ors_with_retry(api_key, from_place, to_place):
    """query_ors, plus exactly one retry for a transient failure."""
    attempts = 0
    while True:
        try:
            return query_ors(api_key, from_place, to_place), None
        except RoutingRequestError as exc:
            attempts += 1
            if exc.transient and attempts <= MAX_TRANSIENT_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue
            return None, exc


def query_ors_snap(api_key, locations, radius=ORS_SNAP_MAX_RADIUS_METERS):
    """POST the Snap endpoint for a batch of [lng, lat] locations (one request covers
    both endpoints of an edge). Returns a list of snapped_distance values in meters —
    None where no snap point was found within radius — in the same order as the input.
    Raises RoutingRequestError the same way query_ors does on failure.
    """
    url = ORS_HOST + ORS_SNAP_PATH_TEMPLATE.format(profile=ORS_PROFILE_FOOT_WALKING)
    body = json.dumps({"locations": locations, "radius": radius}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            error_payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            error_payload = None
        message = str(exc)
        if isinstance(error_payload, dict) and isinstance(error_payload.get("error"), dict):
            message = error_payload["error"].get("message", message)
        transient = exc.code == 429 or exc.code >= 500
        raise RoutingRequestError(f"HTTP {exc.code}: {message}", status="request-error", transient=transient) from exc
    except urllib.error.URLError as exc:
        raise RoutingRequestError(f"network error: {exc.reason}", status="request-error", transient=True) from exc
    except TimeoutError as exc:
        raise RoutingRequestError("request timed out", status="request-error", transient=True) from exc

    try:
        return [loc["snapped_distance"] if loc else None for loc in payload["locations"]]
    except (KeyError, TypeError) as exc:
        raise RoutingRequestError(
            f"unexpected snap response shape: {exc}", status="request-error", transient=False
        ) from exc


def build_endpoint_snapping(
    from_snap_m, to_snap_m, routed_distance_m, radius=ORS_SNAP_MAX_RADIUS_METERS, reason=None
):
    """`reason` is only meaningful (and only ever set) when the assessment comes out
    "unknown" — e.g. "Snap query failed: ..." or a genuinely unsnappable point (None).
    Never fabricates a "clean"/"significant" verdict when a measurement is missing.
    """
    assessment = classify_endpoint_snapping(from_snap_m, to_snap_m, routed_distance_m)
    result = {
        "assessment": assessment,
        "fromSnapMeters": from_snap_m,
        "toSnapMeters": to_snap_m,
        "radiusMeters": radius,
    }
    if assessment == "unknown" and reason:
        result["reason"] = reason
    return result


def build_success_result(
    from_id, to_id, distance_m, duration_s, from_place, to_place, verified_at, endpoint_snapping=None
):
    minutes = round_half_up_minutes(duration_s)
    result = {
        "fromId": from_id,
        "toId": to_id,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "status": "validated",
        "distance": {"meters": distance_m},
        "minutes": {"minMinutes": minutes, "maxMinutes": minutes},
        "confidence": "validated-static",
        "verifiedAt": verified_at,
        "source": {
            "kind": "routing-provider",
            "provider": ORS_PROVIDER,
            "profile": ORS_PROFILE_FOOT_WALKING,
        },
        "query": {
            "fromCoordinates": to_ors_coordinates(from_place),
            "toCoordinates": to_ors_coordinates(to_place),
        },
        "durationSecondsRaw": duration_s,
        "attribution": ATTRIBUTION,
    }
    if endpoint_snapping is not None:
        result["endpointSnapping"] = endpoint_snapping
    return result


def build_failure_result(from_id, to_id, status, error, from_place, to_place, verified_at):
    result = {
        "fromId": from_id,
        "toId": to_id,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "status": status,
        "verifiedAt": verified_at,
        "query": {
            "fromCoordinates": to_ors_coordinates(from_place),
            "toCoordinates": to_ors_coordinates(to_place),
        },
        "errorMessage": str(error),
    }
    return result


def dry_run(args):
    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    nearby = load_nearby(args.data_dir)
    resolved = resolve_manifest_edges(manifest, places, nearby)

    print(f"Dry run: {len(resolved)} manifest edges resolved, Modo == 'A pie' confirmed for all.")
    print(f"Would query: {ORS_HOST}{ORS_DIRECTIONS_PATH_TEMPLATE.format(profile=ORS_PROFILE_FOOT_WALKING)}")
    print("No network requests made.\n")
    for edge in resolved:
        from_coords = to_ors_coordinates(edge["fromPlace"])
        to_coords = to_ors_coordinates(edge["toPlace"])
        relation = edge["relation"]
        print(
            f"[{edge['category']}] {edge['fromId']} -> {edge['toId']} | "
            f"ORS coords {from_coords} -> {to_coords} | "
            f"estimated {relation['Distancia km']} km / {relation['Min aprox.']} min"
        )
    return 0


def load_existing_results():
    if RESULTS_PATH.exists():
        return load_json(RESULTS_PATH)
    return []


def execute(args):
    api_key = None
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print("ORS_API_KEY required to execute walking pilot")
        print("Set it and re-run:")
        print("  ORS_API_KEY=<your key> python3 scripts/validate-walking-pilot.py --execute")
        return 1

    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    nearby = load_nearby(args.data_dir)
    resolved = resolve_manifest_edges(manifest, places, nearby)

    existing = load_existing_results()
    existing_by_key = {(r["fromId"], r["toId"]): r for r in existing}

    results = dict(existing_by_key)
    queried, skipped, succeeded, failed = 0, 0, 0, 0

    for edge in resolved:
        key = (edge["fromId"], edge["toId"])
        cached = existing_by_key.get(key)
        if cached and cached.get("status") == "validated" and not args.refresh:
            skipped += 1
            continue

        queried += 1
        verified_at = utc_now_iso()
        (outcome, error) = query_ors_with_retry(api_key, edge["fromPlace"], edge["toPlace"])
        if outcome is not None:
            distance_m, duration_s = outcome
            # Endpoint-snapping diagnostic (one extra Snap request per freshly-queried
            # edge, batching both coordinates): a failure here must never invalidate an
            # otherwise-successful route, so it degrades to an explicit "unknown"
            # assessment (never a fabricated "clean") rather than turning this edge
            # into a failure or silently omitting the field.
            try:
                snap_distances = query_ors_snap(
                    api_key,
                    [to_ors_coordinates(edge["fromPlace"]), to_ors_coordinates(edge["toPlace"])],
                )
                endpoint_snapping = build_endpoint_snapping(snap_distances[0], snap_distances[1], distance_m)
            except RoutingRequestError as snap_exc:
                endpoint_snapping = build_endpoint_snapping(
                    None, None, distance_m, reason=f"Snap query failed: {snap_exc}"
                )
            results[key] = build_success_result(
                edge["fromId"], edge["toId"], distance_m, duration_s,
                edge["fromPlace"], edge["toPlace"], verified_at,
                endpoint_snapping=endpoint_snapping,
            )
            succeeded += 1
        else:
            results[key] = build_failure_result(
                edge["fromId"], edge["toId"], error.status, error,
                edge["fromPlace"], edge["toPlace"], verified_at,
            )
            failed += 1

    manifest_keys = {(e["fromId"], e["toId"]) for e in manifest["edges"]}
    final_results = [results[k] for k in sorted(manifest_keys) if k in results]

    write_json(RESULTS_PATH, final_results)
    write_json(APP_RESULTS_PATH, final_results)

    print(
        f"OK: {queried} queried ({succeeded} validated, {failed} failed), "
        f"{skipped} skipped (cached). Wrote {len(final_results)} results to "
        f"{RESULTS_PATH} and {APP_RESULTS_PATH}."
    )
    return 0


def diagnose_snap(args):
    """One-off, minimal Snap-endpoint diagnostic for a single already-validated
    directed edge — used to retroactively explain an existing result without
    re-querying Directions for it or touching any other edge. Exactly one Snap
    request (both coordinates batched into it). See docs/WALKING_PILOT.md.
    """
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print("ORS_API_KEY required to diagnose snapping")
        return 1

    from_id, to_id = args.diagnose_snap
    places = load_places(args.data_dir)
    by_id = places_by_id(places)
    from_place, to_place = by_id.get(from_id), by_id.get(to_id)
    if from_place is None or to_place is None:
        print(f"unknown place id(s): {from_id}, {to_id}")
        return 1

    existing = load_existing_results()
    existing_by_key = {(r["fromId"], r["toId"]): r for r in existing}
    key = (from_id, to_id)
    result = existing_by_key.get(key)
    if result is None or result.get("status") != "validated":
        print(f"no existing validated result for {from_id}->{to_id}; nothing to diagnose")
        return 1

    try:
        snap_distances = query_ors_snap(
            api_key, [to_ors_coordinates(from_place), to_ors_coordinates(to_place)]
        )
    except RoutingRequestError as exc:
        print(f"snap query failed: {exc}")
        return 1

    endpoint_snapping = build_endpoint_snapping(
        snap_distances[0], snap_distances[1], result["distance"]["meters"]
    )
    result["endpointSnapping"] = endpoint_snapping

    final_results = [existing_by_key[k] for k in sorted(existing_by_key)]
    write_json(RESULTS_PATH, final_results)
    write_json(APP_RESULTS_PATH, final_results)

    print(
        f"OK: diagnosed {from_id}->{to_id}: fromSnapMeters={snap_distances[0]} "
        f"toSnapMeters={snap_distances[1]} assessment={endpoint_snapping['assessment']}"
    )
    return 0


def edges_needing_snap_assessment(manifest_edges, results_by_key):
    """Every manifest edge whose current result is validated but has no resolved
    endpointSnapping.assessment yet — includes an edge with no endpointSnapping field
    at all, and an edge carrying a pre-three-state-model record (no 'assessment' key).
    Never hardcoded: derived fresh from whatever the results file actually contains.
    """
    needing = []
    for edge in manifest_edges:
        key = (edge["fromId"], edge["toId"])
        result = results_by_key.get(key)
        if result is None or result.get("status") != "validated":
            continue
        snapping = result.get("endpointSnapping")
        if not snapping or "assessment" not in snapping:
            needing.append(key)
    return needing


def backfill_snapping(args):
    """Fills in endpointSnapping for every manifest edge whose result lacks a resolved
    assessment. Makes exactly ONE Snap request covering the deduplicated union of
    unique place coordinates those edges need — never one request per edge, and never
    a request for a place outside the manifest's 24 edges. Never re-queries Directions.
    """
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print("ORS_API_KEY required to backfill snapping")
        return 1

    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    by_id = places_by_id(places)

    existing = load_existing_results()
    results_by_key = {(r["fromId"], r["toId"]): r for r in existing}

    missing_keys = edges_needing_snap_assessment(manifest["edges"], results_by_key)
    if not missing_keys:
        print("OK: every manifest edge already has a resolved endpointSnapping assessment.")
        return 0

    needed_place_ids = sorted({place_id for key in missing_keys for place_id in key})
    locations = [to_ors_coordinates(by_id[place_id]) for place_id in needed_place_ids]

    try:
        snap_distances = query_ors_snap(api_key, locations)
        snap_error = None
    except RoutingRequestError as exc:
        snap_distances = [None] * len(locations)
        snap_error = str(exc)

    snap_by_place = dict(zip(needed_place_ids, snap_distances))

    counts = {"clean": 0, "significant": 0, "unknown": 0}
    for key in missing_keys:
        from_id, to_id = key
        result = results_by_key[key]
        routed_distance_m = result["distance"]["meters"]
        from_snap = snap_by_place.get(from_id)
        to_snap = snap_by_place.get(to_id)
        reason = None
        if snap_error and (from_snap is None or to_snap is None):
            reason = f"Snap query failed: {snap_error}"
        endpoint_snapping = build_endpoint_snapping(from_snap, to_snap, routed_distance_m, reason=reason)
        result["endpointSnapping"] = endpoint_snapping
        counts[endpoint_snapping["assessment"]] += 1

    final_results = [results_by_key[k] for k in sorted(results_by_key)]
    write_json(RESULTS_PATH, final_results)
    write_json(APP_RESULTS_PATH, final_results)

    print(
        f"OK: backfilled endpointSnapping for {len(missing_keys)} edge(s) using 1 Snap "
        f"request covering {len(needed_place_ids)} unique place(s). "
        f"clean={counts['clean']} significant={counts['significant']} unknown={counts['unknown']}"
    )
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument(
        "--diagnose-snap",
        nargs=2,
        metavar=("FROM_ID", "TO_ID"),
        help="Retroactively backfill endpointSnapping for one existing validated result. "
        "Makes exactly one Snap request; never re-queries Directions.",
    )
    parser.add_argument(
        "--backfill-snapping",
        action="store_true",
        help="Resolve endpointSnapping for every manifest edge that doesn't have it yet, "
        "in exactly one batched Snap request. Never re-queries Directions.",
    )
    parser.add_argument("--refresh", action="store_true", help="Re-query every manifest edge, including cached validated ones.")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--data-dir", default="data")
    args = parser.parse_args()

    modes = [bool(args.dry_run), bool(args.execute), bool(args.diagnose_snap), bool(args.backfill_snapping)]
    if sum(modes) != 1:
        parser.error("pass exactly one of --dry-run, --execute, --diagnose-snap, or --backfill-snapping")

    if args.dry_run:
        return dry_run(args)
    if args.diagnose_snap:
        return diagnose_snap(args)
    if args.backfill_snapping:
        return backfill_snapping(args)
    return execute(args)


if __name__ == "__main__":
    sys.exit(main())
