#!/usr/bin/env python3
"""Offline validation for the Phase 3B2H access-point walking revalidation artifacts.

Validates data/logistics/walking-access-point-manifest.json and, when it exists,
data/logistics/walking-access-point-results.json (plus its app copy, if one was ever
published) against the catalog, places.json and the historical walking artifacts.

Never makes a network call and never writes anything. Run:

    python3 scripts/validate-walking-access-point-results.py data
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    ACCESS_POINT_STATUS_ACTIVE,
    ENDPOINT_KIND_ACCESS_POINT,
    ENDPOINT_KIND_PLACE_COORDINATE,
    ENDPOINT_KINDS,
    EXTERNAL_WALK_CONTEXT,
    HISTORICAL_ARTIFACT_BY_ORIGIN,
    RESULTS_PATH,
    RESULT_STATUS_NO_ROUTE,
    RESULT_STATUS_REQUEST_ERROR,
    RESULT_STATUS_VALIDATED,
    REVALIDATION_MANIFEST_PATH,
    REVALIDATION_RESULTS_PATH,
    APP_REVALIDATION_RESULTS_PATH,
    REVALIDATION_TARGET_PLACE_IDS,
    SCALE_RESULTS_PATH,
    SNAP_ASSESSMENTS,
    candidate_key,
    eligible_access_points,
    endpoint_coordinates,
    sha256_of_file,
)

STATUSES = {RESULT_STATUS_VALIDATED, RESULT_STATUS_NO_ROUTE, RESULT_STATUS_REQUEST_ERROR}

# The internal stages an external walking edge may never resolve against. JP-181's
# reception is the only externally applicable point the catalog carries for it; a
# trailhead or shuttle stop describes a stage *inside* the venue and is not an arrival
# point for a city-to-POI walk (docs/ACCESS_POINT_DESIGN.md §13).
INTERNAL_CONTEXTS = {"internal-hike", "internal-shuttle"}

# Loaded lazily so this module imports cleanly for tests that only exercise one check.
_COMPARISON_BUILDER = None


def _build_comparison(lineage, record):
    """The pipeline's own comparison builder, imported by path (the pipeline script's
    filename has dashes and is not an importable module name). Re-deriving comparison
    here with a second implementation would let the two drift and validate nothing."""
    global _COMPARISON_BUILDER
    if _COMPARISON_BUILDER is None:
        import importlib.util

        script = Path(__file__).with_name("revalidate-walking-access-points.py")
        spec = importlib.util.spec_from_file_location("revalidate_walking_access_points", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _COMPARISON_BUILDER = module.build_comparison
    return _COMPARISON_BUILDER(lineage, record)


def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def _valid_coordinate_pair(value):
    """ORS order: [lng, lat], both finite numbers in range. A bool is not a number here
    (isinstance(True, int) is True in Python) — rejecting it explicitly stops a
    JSON `true` from passing as a coordinate."""
    if not isinstance(value, list) or len(value) != 2:
        return False
    lng, lat = value
    for component in (lng, lat):
        if isinstance(component, bool) or not isinstance(component, (int, float)):
            return False
    return -180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0


def validate_endpoint(endpoint, expected_place_id, label, place_ids, ap_by_id, errors):
    """One endpoint identity: known kind, known place, and — for an access-point
    endpoint — a catalogued, active, externally-applicable point whose own placeId
    agrees with the endpoint's."""
    if not isinstance(endpoint, dict):
        errors.append(f"{label}: endpoint must be an object")
        return
    kind = endpoint.get("kind")
    if kind not in ENDPOINT_KINDS:
        errors.append(f"{label}: unknown endpoint kind {kind!r}, expected one of {ENDPOINT_KINDS}")
        return
    place_id = endpoint.get("placeId")
    if place_id not in place_ids:
        errors.append(f"{label}: unknown place {place_id!r}")
    if place_id != expected_place_id:
        errors.append(
            f"{label}: endpoint placeId {place_id!r} does not match the edge's "
            f"{expected_place_id!r}"
        )
    if kind == ENDPOINT_KIND_PLACE_COORDINATE:
        if "accessPointId" in endpoint:
            errors.append(f"{label}: a place-coordinate endpoint must not carry an accessPointId")
        return

    ap_id = endpoint.get("accessPointId")
    point = ap_by_id.get(ap_id)
    if point is None:
        errors.append(f"{label}: orphan accessPointId {ap_id!r} (not in the catalog)")
        return
    if point.get("placeId") != place_id:
        errors.append(
            f"{label}: endpoint placeId {place_id!r} does not match access point {ap_id!r} "
            f"placeId {point.get('placeId')!r}"
        )
    if point.get("status") != ACCESS_POINT_STATUS_ACTIVE:
        errors.append(f"{label}: access point {ap_id!r} is {point.get('status')!r}, not active")
    contexts = set(point.get("applicableContexts") or [])
    if EXTERNAL_WALK_CONTEXT not in contexts:
        errors.append(
            f"{label}: access point {ap_id!r} is not applicable to {EXTERNAL_WALK_CONTEXT!r} "
            f"(contexts: {sorted(contexts)})"
        )
    internal = contexts & INTERNAL_CONTEXTS
    if internal and not contexts - INTERNAL_CONTEXTS:
        errors.append(
            f"{label}: access point {ap_id!r} is an internal stage ({sorted(internal)}) and "
            "may never be an external walking endpoint"
        )


def validate_manifest(manifest, places, access_points):
    """The target set and its candidate expansion, independently of any result."""
    errors = []
    if not isinstance(manifest, dict) or not isinstance(manifest.get("candidates"), list):
        return ["manifest must be an object with a 'candidates' array"]

    place_ids = {p.get("id") for p in places if isinstance(p, dict)}
    by_place_id = {p["id"]: p for p in places if isinstance(p, dict)}
    ap_by_id = {p["id"]: p for p in access_points if isinstance(p, dict)}
    targets = set(manifest.get("targetPlaceIds") or [])
    if targets != set(REVALIDATION_TARGET_PLACE_IDS):
        errors.append(
            f"manifest targetPlaceIds {sorted(targets)} != the evidenced targets "
            f"{sorted(REVALIDATION_TARGET_PLACE_IDS)}"
        )

    seen_keys = set()
    by_edge = {}
    for index, candidate in enumerate(manifest["candidates"]):
        label = f"candidate[{index}]"
        if not isinstance(candidate, dict):
            errors.append(f"{label}: must be an object")
            continue
        from_id, to_id = candidate.get("fromId"), candidate.get("toId")
        label = f"candidate[{index}] {from_id}->{to_id}"
        for place_id in (from_id, to_id):
            if place_id not in place_ids:
                errors.append(f"{label}: unknown place {place_id!r}")
        if not targets & {from_id, to_id}:
            errors.append(
                f"{label}: neither endpoint is a revalidation target — this edge is outside "
                "the approved target set and must never be queried by this phase"
            )

        from_endpoint = candidate.get("fromEndpoint")
        to_endpoint = candidate.get("toEndpoint")
        validate_endpoint(from_endpoint, from_id, f"{label} fromEndpoint", place_ids, ap_by_id, errors)
        validate_endpoint(to_endpoint, to_id, f"{label} toEndpoint", place_ids, ap_by_id, errors)

        if isinstance(from_endpoint, dict) and isinstance(to_endpoint, dict):
            # A non-target end must stay on its place coordinate: the comparison against
            # the historical result is only meaningful when exactly one variable moved.
            for endpoint, place_id, side in (
                (from_endpoint, from_id, "fromEndpoint"),
                (to_endpoint, to_id, "toEndpoint"),
            ):
                if place_id not in targets and endpoint.get("kind") != ENDPOINT_KIND_PLACE_COORDINATE:
                    errors.append(
                        f"{label}: {side} for non-target place {place_id!r} must stay a "
                        "place-coordinate endpoint"
                    )
            expected_key = candidate_key(from_endpoint, to_endpoint)
            if candidate.get("candidateKey") != expected_key:
                errors.append(
                    f"{label}: candidateKey {candidate.get('candidateKey')!r} does not match "
                    f"its endpoints (expected {expected_key!r})"
                )
            expected_aps = sorted(
                e["accessPointId"] for e in (from_endpoint, to_endpoint)
                if e.get("kind") == ENDPOINT_KIND_ACCESS_POINT
            )
            if candidate.get("accessPointIds") != expected_aps:
                errors.append(
                    f"{label}: accessPointIds {candidate.get('accessPointIds')!r} does not "
                    f"match its endpoints (expected {expected_aps!r})"
                )

        key = candidate.get("candidateKey")
        if key in seen_keys:
            errors.append(f"{label}: duplicate directed candidate key {key!r}")
        seen_keys.add(key)
        by_edge.setdefault((from_id, to_id), []).append(candidate)

        lineage = candidate.get("lineage")
        if not isinstance(lineage, dict):
            errors.append(f"{label}: missing lineage")
            continue
        for field in ("origin", "artifact", "manifest", "status", "verifiedAt", "query",
                      "fromEndpoint", "toEndpoint"):
            if field not in lineage:
                errors.append(f"{label}: lineage missing {field!r}")
        if lineage.get("artifact") != HISTORICAL_ARTIFACT_BY_ORIGIN.get(lineage.get("origin")):
            errors.append(
                f"{label}: lineage artifact {lineage.get('artifact')!r} does not match origin "
                f"{lineage.get('origin')!r}"
            )
        for side in ("fromEndpoint", "toEndpoint"):
            historical_endpoint = lineage.get(side)
            if isinstance(historical_endpoint, dict) and historical_endpoint.get("kind") != ENDPOINT_KIND_PLACE_COORDINATE:
                errors.append(
                    f"{label}: lineage {side} must be a place-coordinate endpoint — a "
                    "historical result was never routed against an access point"
                )

    # The whole point of §4: every eligible gate is a candidate. A target edge missing
    # one of its place's eligible access points means a candidate was pre-selected
    # somewhere, which is exactly what this phase forbids.
    for (from_id, to_id), candidates in sorted(by_edge.items()):
        for place_id in sorted(targets & {from_id, to_id}):
            eligible = {
                point["id"] for point in eligible_access_points(access_points, place_id, EXTERNAL_WALK_CONTEXT)
            }
            used = set()
            for candidate in candidates:
                for endpoint in (candidate.get("fromEndpoint"), candidate.get("toEndpoint")):
                    if isinstance(endpoint, dict) and endpoint.get("placeId") == place_id and endpoint.get("kind") == ENDPOINT_KIND_ACCESS_POINT:
                        used.add(endpoint.get("accessPointId"))
            unapproved = used - eligible
            if unapproved:
                errors.append(
                    f"{from_id}->{to_id}: candidate(s) use access point(s) {sorted(unapproved)} "
                    f"that are not approved eligible points for {place_id} ({sorted(eligible)})"
                )
            missing = eligible - used
            if missing:
                errors.append(
                    f"{from_id}->{to_id}: missing candidate(s) for {place_id} access point(s) "
                    f"{sorted(missing)} — every eligible point must be routed, never pre-selected"
                )

    del by_place_id  # coordinates are checked against results, not the manifest
    return errors


def validate_results(document, manifest, places, access_points):
    """Every stored candidate result, against the manifest it was generated from."""
    errors = []
    if not isinstance(document, dict) or not isinstance(document.get("candidates"), list):
        return ["results document must be an object with a 'candidates' array"]

    by_place_id = {p["id"]: p for p in places if isinstance(p, dict)}
    ap_by_id = {p["id"]: p for p in access_points if isinstance(p, dict)}
    place_ids = set(by_place_id)
    manifest_by_key = {c.get("candidateKey"): c for c in manifest.get("candidates", [])}

    seen = set()
    for index, record in enumerate(document["candidates"]):
        key = record.get("candidateKey") if isinstance(record, dict) else None
        label = f"result[{index}] {key}"
        if not isinstance(record, dict):
            errors.append(f"{label}: must be an object")
            continue
        if key in seen:
            errors.append(f"{label}: duplicate directed candidate key {key!r}")
        seen.add(key)
        expected = manifest_by_key.get(key)
        if expected is None:
            errors.append(f"{label}: candidate is not in the manifest — this phase queries only the approved target set")
            continue
        for field in ("fromId", "toId", "fromEndpoint", "toEndpoint"):
            if record.get(field) != expected.get(field):
                errors.append(f"{label}: {field} does not match the manifest")

        from_id, to_id = record.get("fromId"), record.get("toId")
        validate_endpoint(record.get("fromEndpoint"), from_id, f"{label} fromEndpoint", place_ids, ap_by_id, errors)
        validate_endpoint(record.get("toEndpoint"), to_id, f"{label} toEndpoint", place_ids, ap_by_id, errors)

        status = record.get("status")
        if status not in STATUSES:
            errors.append(f"{label}: unknown status {status!r}, expected one of {sorted(STATUSES)}")
        if record.get("provider") != "openrouteservice" or record.get("profile") != "foot-walking":
            errors.append(f"{label}: provider/profile must stay openrouteservice/foot-walking")

        query = record.get("query")
        if not isinstance(query, dict) or not _valid_coordinate_pair(query.get("fromCoordinates")) or not _valid_coordinate_pair(query.get("toCoordinates")):
            errors.append(f"{label}: malformed query coordinates")
        else:
            # The bytes actually sent must be the endpoint identity's own coordinate —
            # this is what stops a candidate labelled with one gate from having been
            # routed against another point entirely.
            for side, endpoint in (("from", record.get("fromEndpoint")), ("to", record.get("toEndpoint"))):
                if not isinstance(endpoint, dict):
                    continue
                try:
                    coords = endpoint_coordinates(endpoint, by_place_id, ap_by_id)
                except (KeyError, ValueError) as exc:
                    errors.append(f"{label}: cannot resolve {side}Endpoint coordinates: {exc}")
                    continue
                sent = query[f"{side}Coordinates"]
                if [coords["lng"], coords["lat"]] != list(sent):
                    errors.append(
                        f"{label}: {side}Coordinates {sent} are not {side}Endpoint's own "
                        f"coordinate [{coords['lng']}, {coords['lat']}]"
                    )

        if status == RESULT_STATUS_VALIDATED:
            distance = record.get("distance")
            minutes = record.get("minutes")
            if not isinstance(distance, dict) or not isinstance(distance.get("meters"), (int, float)):
                errors.append(f"{label}: validated result needs a numeric distance.meters")
            if not isinstance(minutes, dict) or not isinstance(minutes.get("minMinutes"), int):
                errors.append(f"{label}: validated result needs integer minutes")
            if record.get("confidence") != "validated-static":
                errors.append(f"{label}: validated result confidence must be 'validated-static'")
            snapping = record.get("endpointSnapping")
            if not isinstance(snapping, dict):
                errors.append(f"{label}: validated result needs an endpointSnapping block")
            elif snapping.get("assessment") not in SNAP_ASSESSMENTS:
                errors.append(f"{label}: unknown snapping assessment {snapping.get('assessment')!r}")
        elif status in (RESULT_STATUS_NO_ROUTE, RESULT_STATUS_REQUEST_ERROR):
            for forbidden in ("distance", "minutes", "confidence"):
                if forbidden in record:
                    errors.append(f"{label}: a {status!r} result must not carry {forbidden!r}")

        lineage = record.get("lineage")
        if not isinstance(lineage, dict):
            errors.append(f"{label}: missing lineage")
            continue
        if lineage != expected.get("lineage"):
            errors.append(f"{label}: lineage does not match the manifest's recorded historical answer")
        comparison = record.get("comparison")
        if not isinstance(comparison, dict):
            errors.append(f"{label}: missing comparison")
        else:
            rebuilt = _build_comparison(lineage, record)
            if comparison != rebuilt:
                errors.append(f"{label}: comparison is not the re-derivable function of lineage and result")

    return errors


def validate_historical_immutability(manifest, data_dir):
    """Two independent guards against this phase mutating the historical artifacts.

    1. Content digest: the manifest recorded sha256 of walking-pilot-results.json and
       walking-scale-results.json when the target set was derived. A changed file means
       a historical result moved under a comparison that claims to be against it.
    2. Semantics: a historical result must never acquire endpoint identities or an
       access-point reference. Per docs/ACCESS_POINT_DESIGN.md §15 those files stay the
       answers to place-coordinate requests, and are not retro-annotated.
    """
    errors = []
    recorded = (manifest.get("sourceContext") or {}).get("historicalResultsDigest") or {}
    for origin, path in (("pilot", RESULTS_PATH), ("scale", SCALE_RESULTS_PATH)):
        expected = recorded.get(origin)
        if expected is None:
            errors.append(f"manifest does not record a {origin} historical results digest")
            continue
        actual = sha256_of_file(path)
        if actual != expected:
            errors.append(
                f"{path} has changed since the target set was derived "
                f"(sha256 {actual} != recorded {expected}) — Phase 3B2H must never mutate "
                "a historical walking result"
            )
    forbidden_keys = {"fromEndpoint", "toEndpoint", "accessPointId", "accessPointIds", "candidateKey", "comparison", "lineage"}
    for path in (RESULTS_PATH, SCALE_RESULTS_PATH):
        try:
            results = load(path)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"cannot read {path}: {exc}")
            continue
        for result in results:
            present = forbidden_keys & set(result)
            if present:
                errors.append(
                    f"{path}: {result.get('fromId')}->{result.get('toId')} carries "
                    f"access-point field(s) {sorted(present)} — historical results stay "
                    "place-coordinate answers and are never retro-annotated"
                )
                break
    return errors


def validate(data_dir=Path("data")):
    data_dir = Path(data_dir)
    try:
        manifest = load(REVALIDATION_MANIFEST_PATH)
        places = load(data_dir / "places.json")
        access_points = load(data_dir / "logistics/access-points.json")
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot load required artifact: {exc}"]

    errors = validate_manifest(manifest, places, access_points)
    errors.extend(validate_historical_immutability(manifest, data_dir))

    if Path(REVALIDATION_RESULTS_PATH).exists():
        try:
            document = load(REVALIDATION_RESULTS_PATH)
        except (OSError, json.JSONDecodeError) as exc:
            return errors + [f"cannot load {REVALIDATION_RESULTS_PATH}: {exc}"]
        errors.extend(validate_results(document, manifest, places, access_points))
        recorded = (document.get("manifest") or {}).get("digest", {}).get("value")
        actual = sha256_of_file(REVALIDATION_MANIFEST_PATH)
        if recorded != actual:
            errors.append(
                f"{REVALIDATION_RESULTS_PATH} was generated from a different manifest "
                f"(sha256 {recorded} != {actual}) — re-run --execute or --recompare"
            )
        if Path(APP_REVALIDATION_RESULTS_PATH).exists():
            try:
                if load(APP_REVALIDATION_RESULTS_PATH) != document:
                    errors.append("app/source walking-access-point-results.json parity mismatch")
            except (OSError, json.JSONDecodeError) as exc:
                errors.append(f"cannot validate the app-facing copy: {exc}")
    elif Path(APP_REVALIDATION_RESULTS_PATH).exists():
        errors.append(
            f"{APP_REVALIDATION_RESULTS_PATH} exists without a source "
            f"{REVALIDATION_RESULTS_PATH}"
        )
    return errors


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    data_dir = Path(args[0]) if args else Path("data")
    errors = validate(data_dir)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    executed = Path(REVALIDATION_RESULTS_PATH).exists()
    print(
        "OK: Phase 3B2H manifest is valid; historical walking results unchanged"
        + ("; candidate results validated." if executed else "; no results artifact yet (not executed).")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
