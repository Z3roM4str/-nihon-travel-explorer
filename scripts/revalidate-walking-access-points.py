#!/usr/bin/env python3
"""Phase 3B2H: targeted access-point walking revalidation.

Usage:
    python3 scripts/revalidate-walking-access-points.py --build-manifest
    python3 scripts/revalidate-walking-access-points.py --dry-run
    python3 scripts/revalidate-walking-access-points.py --backfill-snap
    python3 scripts/revalidate-walking-access-points.py --execute [--refresh]

This is docs/ACCESS_POINT_DESIGN.md §19 **Stage 4**: reroute only the walking edges the
Phase 3B2G access points actually affect, and compare the answers against — never over
— the historical place-coordinate results.

Scope, enforced by the manifest rather than by discipline alone:

  * The target set is every historical directed walking edge (pilot or scale) that has
    JP-029 or JP-181 as an endpoint. It is DERIVED from the committed manifests and
    results, never hand-listed, and it is a set intersection — no edge is invented and
    no edge outside it is ever queried. The other ~326 walking edges are not touched.

  * Each target edge expands into one candidate PER ELIGIBLE ACCESS POINT of its target
    place, keeping direction. JP-029 has three officially designated gates and NO
    default, so each of its four directed edges becomes three candidates, each routed
    and recorded separately (logistics_common.eligible_access_points explains why
    picking one up front — by ID, by array position, or by haversine — is forbidden).
    JP-181 has exactly one external point, so its two edges become one candidate each.
    Comparing candidates, if a later phase needs to, is only ever done on real routed
    results, and this phase promotes no winner to a persistent default.

  * The non-target endpoint of every edge stays a `place-coordinate` endpoint: it is the
    same coordinate the historical result used, so the comparison isolates the single
    variable this phase is about.

The steps are split the same way scripts/validate-walking-scale.py splits them:

  --build-manifest: no network. Derives the target set and its candidates and writes
      data/logistics/walking-access-point-manifest.json, carrying each candidate's
      historical lineage (which artifact, which manifest, the historical status and
      values) so the later comparison is auditable without re-deriving anything.

  --backfill-snap: Snap-only, for ACCESS-POINT coordinates. Place-coordinate endpoints
      are never re-snapped — their measurements already exist in
      data/logistics/walking-snap-places.json and re-querying them would spend quota to
      learn nothing and risk drift against the historical results. One batched request
      covers every pending access point. Restart-safe: the store is written after every
      chunk.

  --execute: Directions-only, one query per pending candidate. Cached "validated"/
      "no-route" candidates are TERMINAL and skipped unless --refresh; "request-error"
      is always retried. Snap measurements are read from the two stores, never queried
      here. Checkpointed after every candidate; fail-fast on a global auth failure,
      exactly as the scale pipeline does.

  --dry-run: no network. Reports the target set, the candidate expansion, the Snap
      coverage of both stores, and the exact Snap/Directions request counts a real run
      would make.

Nothing here changes a threshold, a classification rule, a retry policy or a provider
parameter: endpoint snapping is classified by the same
logistics_common.classify_endpoint_snapping the pilot and scale pipelines use, with
SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS still None, and the result bodies are
built by the same walking_result_builder helpers.

What this phase deliberately does NOT do: touch walking-pilot-results.json or
walking-scale-results.json, write an app-facing copy, feed getBestTransfer(), or turn a
winning gate into a stored default.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    ACCESS_POINT_STATUS_ACTIVE,
    ENDPOINT_KIND_ACCESS_POINT,
    EXTERNAL_WALK_CONTEXT,
    HISTORICAL_ARTIFACT_BY_ORIGIN,
    HISTORICAL_MANIFEST_BY_ORIGIN,
    HISTORICAL_ORIGIN_PILOT,
    HISTORICAL_ORIGIN_SCALE,
    MANIFEST_PATH,
    ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED,
    ORS_HOST,
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    ORS_SNAP_MAX_LOCATIONS_PER_REQUEST,
    ORS_SNAP_MAX_RADIUS_METERS,
    RESULTS_PATH,
    RESULT_STATUS_REQUEST_ERROR,
    REVALIDATION_MANIFEST_PATH,
    REVALIDATION_MANIFEST_VERSION,
    REVALIDATION_RESULTS_PATH,
    REVALIDATION_RESULTS_VERSION,
    REVALIDATION_SNAP_PATH,
    REVALIDATION_SNAP_VERSION,
    REVALIDATION_TARGET_PLACE_IDS,
    SCALE_MANIFEST_PATH,
    SCALE_RESULTS_PATH,
    SNAP_PLACES_PATH,
    SNAP_PLACE_STATUS_NO_SNAP,
    SNAP_PLACE_STATUS_REQUEST_ERROR,
    SNAP_PLACE_STATUS_RESOLVED,
    TERMINAL_RESULT_STATUSES,
    access_point_endpoint,
    access_points_by_id,
    candidate_key,
    classify_snap_coverage,
    dataset_digest,
    eligible_access_points,
    endpoint_as_place,
    endpoint_label,
    load_access_points,
    load_json,
    load_places,
    load_snap_places_store,
    place_coordinate_endpoint,
    places_by_id,
    sha256_of_file,
    to_ors_coordinates,
    utc_now_iso,
    write_json,
)
from ors_client import (  # noqa: E402
    ATTRIBUTION,
    directions_rate_limiter,
    query_ors_snap_with_retry,
    query_ors_with_retry,
)
from walking_result_builder import (  # noqa: E402
    build_endpoint_snapping,
    build_failure_result,
    build_success_result,
)

HISTORICAL_SOURCES = (
    (HISTORICAL_ORIGIN_PILOT, MANIFEST_PATH, RESULTS_PATH),
    (HISTORICAL_ORIGIN_SCALE, SCALE_MANIFEST_PATH, SCALE_RESULTS_PATH),
)


# --------------------------------------------------------------------------- target set


def derive_target_edges(target_place_ids=REVALIDATION_TARGET_PLACE_IDS, data_dir=Path("data")):
    """Every historical directed walking edge with a target place at either end.

    Reads the committed manifests (the authoritative edge sets) and pairs each edge with
    its committed result. A manifest edge with no result, or a result outside its
    manifest, is a real integrity break in the historical artifacts and raises here
    rather than being quietly dropped from the target set — silently revalidating a
    subset would make the phase's "these are all the affected edges" claim false.

    Direction is preserved: JP-028 -> JP-029 and JP-029 -> JP-028 are two separate
    entries, never collapsed into one undirected pair.
    """
    targets = set(target_place_ids)
    edges = []
    seen = {}
    for origin, manifest_path, results_path in HISTORICAL_SOURCES:
        manifest = load_json(manifest_path)
        results = load_json(results_path)
        results_by_key = {(r["fromId"], r["toId"]): r for r in results}
        manifest_keys = [(e["fromId"], e["toId"]) for e in manifest["edges"]]
        missing = [k for k in manifest_keys if k not in results_by_key]
        if missing:
            raise ValueError(f"{results_path}: no result for manifest edge(s) {missing[:5]}")
        extra = sorted(set(results_by_key) - set(manifest_keys))
        if extra:
            raise ValueError(f"{results_path}: result(s) outside {manifest_path}: {extra[:5]}")
        for from_id, to_id in manifest_keys:
            if from_id not in targets and to_id not in targets:
                continue
            key = (from_id, to_id)
            if key in seen:
                raise ValueError(
                    f"directed edge {from_id} -> {to_id} appears in both "
                    f"{seen[key]} and {origin} historical artifacts"
                )
            seen[key] = origin
            edges.append(
                {
                    "fromId": from_id,
                    "toId": to_id,
                    "targetPlaceIds": sorted(targets & {from_id, to_id}),
                    "historicalOrigin": origin,
                    "historicalResult": results_by_key[key],
                }
            )
    edges.sort(key=lambda e: (e["fromId"], e["toId"]))
    return edges


def historical_lineage(edge):
    """The audit trail one candidate carries about the place-coordinate answer it is
    being compared against — copied from the historical result, never recomputed from
    coordinates, and never written back to it."""
    result = edge["historicalResult"]
    origin = edge["historicalOrigin"]
    lineage = {
        "origin": origin,
        "artifact": HISTORICAL_ARTIFACT_BY_ORIGIN[origin],
        "manifest": HISTORICAL_MANIFEST_BY_ORIGIN[origin],
        "status": result["status"],
        "verifiedAt": result["verifiedAt"],
        "query": result["query"],
        # A historical result carries no endpoint identity. Per
        # docs/ACCESS_POINT_DESIGN.md §15 that means place-coordinate at both ends —
        # recorded here explicitly, in the NEW artifact only; the historical file is
        # never rewritten to add it.
        "fromEndpoint": place_coordinate_endpoint(edge["fromId"]),
        "toEndpoint": place_coordinate_endpoint(edge["toId"]),
        "endpointIdentityInferred": True,
    }
    if result["status"] == "validated":
        lineage["distance"] = result["distance"]
        lineage["minutes"] = result["minutes"]
        lineage["durationSecondsRaw"] = result.get("durationSecondsRaw")
        lineage["endpointSnapping"] = result.get("endpointSnapping")
    else:
        lineage["errorCode"] = result.get("errorCode")
        lineage["errorMessage"] = result.get("errorMessage")
    return lineage


def expand_candidates(edges, access_points):
    """One candidate per (directed edge x eligible access point of its target place).

    An edge with two target places would produce a candidate per combination; the
    current catalog has none (JP-029 and JP-181 share no edge), and the loop below is
    written for the general case rather than assuming that stays true.

    A target place with no eligible external-walk access point yields no candidate and
    raises — it would mean the manifest's target set and the catalog disagree.
    """
    candidates = []
    for edge in edges:
        from_options = [place_coordinate_endpoint(edge["fromId"])]
        to_options = [place_coordinate_endpoint(edge["toId"])]
        for place_id in edge["targetPlaceIds"]:
            eligible = eligible_access_points(access_points, place_id, EXTERNAL_WALK_CONTEXT)
            if not eligible:
                raise ValueError(
                    f"{place_id} is a revalidation target but has no active "
                    f"{EXTERNAL_WALK_CONTEXT} access point in the catalog"
                )
            options = [access_point_endpoint(place_id, point["id"]) for point in eligible]
            if place_id == edge["fromId"]:
                from_options = options
            if place_id == edge["toId"]:
                to_options = options
        for from_endpoint in from_options:
            for to_endpoint in to_options:
                access_point_ids = sorted(
                    endpoint["accessPointId"]
                    for endpoint in (from_endpoint, to_endpoint)
                    if endpoint["kind"] == ENDPOINT_KIND_ACCESS_POINT
                )
                candidates.append(
                    {
                        "candidateKey": candidate_key(from_endpoint, to_endpoint),
                        "fromId": edge["fromId"],
                        "toId": edge["toId"],
                        "fromEndpoint": from_endpoint,
                        "toEndpoint": to_endpoint,
                        "accessPointIds": access_point_ids,
                        "lineage": historical_lineage(edge),
                    }
                )
    candidates.sort(key=lambda c: (c["fromId"], c["toId"], c["candidateKey"]))
    duplicates = sorted(
        key for key in {c["candidateKey"] for c in candidates}
        if sum(1 for c in candidates if c["candidateKey"] == key) > 1
    )
    if duplicates:
        raise ValueError(f"duplicate directed candidate key(s): {duplicates}")
    return candidates


def build_manifest_document(data_dir=Path("data")):
    edges = derive_target_edges(data_dir=data_dir)
    access_points = load_access_points(data_dir)
    candidates = expand_candidates(edges, access_points)
    return {
        "revalidationVersion": REVALIDATION_MANIFEST_VERSION,
        "phase": "3B2H",
        "targetPlaceIds": list(REVALIDATION_TARGET_PLACE_IDS),
        "selectionMethod": {
            "description": (
                "Set intersection, not a sample: every historical directed 'A pie' edge "
                "(pilot or scale manifest) with a Phase 3B2G access-point place at either "
                "end. Direction is preserved. Each edge is then expanded into one "
                "candidate per ACTIVE external-walk access point of its target place — "
                "all of them, in catalog order, which carries no priority. No candidate "
                "is pre-selected by ID, array position or haversine, and no winner is "
                "promoted to a default."
            ),
            "nonTargetEndpointRule": (
                "The non-target end of every edge keeps the exact place coordinate the "
                "historical result used, so the only variable that changes is the target "
                "endpoint."
            ),
        },
        "sourceContext": {
            "targetEdgeCount": len(edges),
            "candidateCount": len(candidates),
            "historicalOriginCounts": {
                origin: sum(1 for e in edges if e["historicalOrigin"] == origin)
                for origin, _, _ in HISTORICAL_SOURCES
            },
            "datasetDigest": dataset_digest(data_dir),
            "accessPointsDigest": {
                "algorithm": "sha256",
                "value": sha256_of_file(Path(data_dir) / "logistics/access-points.json"),
            },
            "historicalResultsDigest": {
                "algorithm": "sha256",
                "pilot": sha256_of_file(RESULTS_PATH),
                "scale": sha256_of_file(SCALE_RESULTS_PATH),
            },
        },
        "candidates": candidates,
    }


# ------------------------------------------------------------------------- comparison


def _percent_delta(new_value, old_value):
    """Percent change against the historical value, or None when the historical value
    is zero — a percentage against zero is undefined, and emitting 0/inf/a large number
    would be a fabricated statistic."""
    if old_value in (None, 0):
        return None
    return round((new_value - old_value) / old_value * 100.0, 2)


def build_comparison(lineage, candidate_result):
    """Historical place-coordinate answer vs. one access-point candidate answer.

    Always records both statuses and both endpoint identities. Numeric deltas are
    recorded ONLY when both sides are "validated" — a no-route or request-error has no
    distance or duration, and inventing a delta against a missing value would be the
    exact kind of silent fabrication the pipeline forbids elsewhere. `comparable` says
    which case this is, machine-readably, so no consumer has to infer it from a null.
    """
    historical_status = lineage["status"]
    new_status = candidate_result["status"]
    comparison = {
        "historicalStatus": historical_status,
        "newStatus": new_status,
        "historicalFromEndpoint": lineage["fromEndpoint"],
        "historicalToEndpoint": lineage["toEndpoint"],
        "newFromEndpoint": candidate_result["fromEndpoint"],
        "newToEndpoint": candidate_result["toEndpoint"],
        "comparable": historical_status == "validated" and new_status == "validated",
    }
    historical_snap = lineage.get("endpointSnapping") or {}
    new_snap = candidate_result.get("endpointSnapping") or {}
    comparison["historicalSnapping"] = {
        "assessment": historical_snap.get("assessment"),
        "fromSnapMeters": historical_snap.get("fromSnapMeters"),
        "toSnapMeters": historical_snap.get("toSnapMeters"),
    }
    comparison["newSnapping"] = {
        "assessment": new_snap.get("assessment"),
        "fromSnapMeters": new_snap.get("fromSnapMeters"),
        "toSnapMeters": new_snap.get("toSnapMeters"),
    }
    if not comparison["comparable"]:
        comparison["reason"] = (
            f"not comparable: historical status {historical_status!r}, new status {new_status!r}"
        )
        return comparison

    old_m = lineage["distance"]["meters"]
    new_m = candidate_result["distance"]["meters"]
    old_min = lineage["minutes"]["minMinutes"]
    new_min = candidate_result["minutes"]["minMinutes"]
    old_s = lineage.get("durationSecondsRaw")
    new_s = candidate_result.get("durationSecondsRaw")
    comparison["historicalDistanceMeters"] = old_m
    comparison["newDistanceMeters"] = new_m
    comparison["distanceDeltaMeters"] = round(new_m - old_m, 2)
    comparison["distanceDeltaPercent"] = _percent_delta(new_m, old_m)
    comparison["historicalMinutes"] = old_min
    comparison["newMinutes"] = new_min
    comparison["durationDeltaMinutes"] = new_min - old_min
    comparison["durationDeltaPercent"] = _percent_delta(new_min, old_min)
    if old_s is not None and new_s is not None:
        comparison["historicalDurationSecondsRaw"] = old_s
        comparison["newDurationSecondsRaw"] = new_s
        comparison["durationDeltaSeconds"] = round(new_s - old_s, 2)
    return comparison


# ------------------------------------------------------------------ access-point snap


def load_revalidation_snap_store(path=REVALIDATION_SNAP_PATH):
    if not Path(path).exists():
        return {"snapVersion": REVALIDATION_SNAP_VERSION, "accessPoints": {}}
    return load_json(path)


def build_access_point_snap_entry(
    access_point, snapped_distance_m, radius, verified_at, status=None, reason=None
):
    """Mirrors logistics_common.build_snap_place_entry's discipline exactly, keyed by
    access point instead of place: the coordinate actually sent is stored, a null
    measurement is never coerced into a 0-meter "resolved" entry, and the three
    statuses stay distinct."""
    if status is None:
        status = (
            SNAP_PLACE_STATUS_RESOLVED
            if snapped_distance_m is not None
            else SNAP_PLACE_STATUS_NO_SNAP
        )
    if status == SNAP_PLACE_STATUS_RESOLVED and snapped_distance_m is None:
        raise ValueError("a 'resolved' snap entry must carry a real measurement, never null")
    if status != SNAP_PLACE_STATUS_RESOLVED and snapped_distance_m is not None:
        raise ValueError(f"a {status!r} snap entry must carry a null measurement")
    entry = {
        "accessPointId": access_point["id"],
        "placeId": access_point["placeId"],
        "coordinates": dict(access_point["coordinates"]),
        "snappedDistanceMeters": snapped_distance_m,
        "radiusMeters": radius,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "verifiedAt": verified_at,
        "status": status,
    }
    if status != SNAP_PLACE_STATUS_RESOLVED and reason:
        entry["reason"] = reason
    return entry


def classify_access_point_snap_coverage(access_point, store):
    """Same five-state answer classify_snap_coverage gives for a place, against the
    catalog coordinate instead of the dataset one. Staleness outranks status: an entry
    measured at a coordinate the catalog no longer carries is about a different point."""
    entry = (store.get("accessPoints") or {}).get(access_point["id"])
    if entry is None:
        return "missing"
    if entry.get("coordinates") != dict(access_point["coordinates"]):
        return "stale"
    status = entry.get("status")
    if status in (SNAP_PLACE_STATUS_RESOLVED, SNAP_PLACE_STATUS_NO_SNAP, SNAP_PLACE_STATUS_REQUEST_ERROR):
        return status
    return "missing"


def manifest_access_point_ids(manifest):
    ids = set()
    for candidate in manifest["candidates"]:
        ids.update(candidate["accessPointIds"])
    return sorted(ids)


def manifest_place_coordinate_ids(manifest):
    ids = set()
    for candidate in manifest["candidates"]:
        for endpoint in (candidate["fromEndpoint"], candidate["toEndpoint"]):
            if endpoint["kind"] != ENDPOINT_KIND_ACCESS_POINT:
                ids.add(endpoint["placeId"])
    return sorted(ids)


def endpoint_snap_value(endpoint, place_store, ap_store, by_id, ap_by_id):
    """One endpoint's cached snap measurement, or (None, reason).

    Only a "resolved" entry contributes a number; missing/stale/no-snap/request-error
    all contribute None, which classify_endpoint_snapping turns into "unknown". A null
    is never read as 0 meters, so an unmeasured endpoint can never make a candidate
    look "clean".
    """
    reasons = {
        "missing": "not yet present in the snap store",
        "stale": "snap entry is stale (coordinates changed since it was measured)",
        SNAP_PLACE_STATUS_NO_SNAP: "no routable point found within the snap radius",
        SNAP_PLACE_STATUS_REQUEST_ERROR: "snap request failed (re-query candidate)",
    }
    label = endpoint_label(endpoint)
    if endpoint["kind"] == ENDPOINT_KIND_ACCESS_POINT:
        point = ap_by_id[endpoint["accessPointId"]]
        coverage = classify_access_point_snap_coverage(point, ap_store)
        if coverage == SNAP_PLACE_STATUS_RESOLVED:
            return ap_store["accessPoints"][point["id"]]["snappedDistanceMeters"], None
        return None, f"{label}: {reasons[coverage]}"
    place_id = endpoint["placeId"]
    coverage = classify_snap_coverage(place_id, by_id[place_id], place_store)
    if coverage == SNAP_PLACE_STATUS_RESOLVED:
        return place_store["places"][place_id]["snappedDistanceMeters"], None
    return None, f"{label}: {reasons[coverage]}"


def combine_snapping_for_candidate(
    candidate, routed_distance_m, place_store, ap_store, by_id, ap_by_id
):
    from_snap, from_reason = endpoint_snap_value(
        candidate["fromEndpoint"], place_store, ap_store, by_id, ap_by_id
    )
    to_snap, to_reason = endpoint_snap_value(
        candidate["toEndpoint"], place_store, ap_store, by_id, ap_by_id
    )
    reason = " / ".join(r for r in (from_reason, to_reason) if r) or None
    return build_endpoint_snapping(from_snap, to_snap, routed_distance_m, reason=reason)


# ------------------------------------------------------------------------- result I/O


def load_existing_results(path=REVALIDATION_RESULTS_PATH):
    if not Path(path).exists():
        return {}
    document = load_json(path)
    return {c["candidateKey"]: c for c in document.get("candidates", [])}


def build_results_document(manifest, results_by_key):
    ordered = [
        results_by_key[c["candidateKey"]]
        for c in manifest["candidates"]
        if c["candidateKey"] in results_by_key
    ]
    return {
        "revalidationVersion": REVALIDATION_RESULTS_VERSION,
        "phase": "3B2H",
        "targetPlaceIds": list(manifest["targetPlaceIds"]),
        "manifest": {
            "path": str(REVALIDATION_MANIFEST_PATH),
            "digest": {"algorithm": "sha256", "value": sha256_of_file(REVALIDATION_MANIFEST_PATH)},
            "candidateCount": len(manifest["candidates"]),
        },
        "notes": (
            "Phase 3B2H generation + evidence + comparison only. These results are NOT "
            "read by the app: getBestTransfer() is unchanged and consumes only the "
            "historical pilot/scale artifacts. walking-pilot-results.json and "
            "walking-scale-results.json are untouched by this pipeline; each candidate's "
            "`lineage` copies the historical answer for audit and never writes back to it. "
            "No candidate is promoted to a persistent default for its place."
        ),
        "candidates": ordered,
    }


def write_results_checkpoint(manifest, results_by_key):
    write_json(REVALIDATION_RESULTS_PATH, build_results_document(manifest, results_by_key))


def build_candidate_record(candidate, base_result, endpoint_snapping=None):
    """A walking_result_builder result body, plus the endpoint identities and the
    lineage/comparison this phase exists to record. The provider-facing fields are
    byte-identical in shape to a pilot/scale result — same builder, same schema — so a
    reader compares like with like."""
    record = dict(base_result)
    record["candidateKey"] = candidate["candidateKey"]
    record["fromEndpoint"] = candidate["fromEndpoint"]
    record["toEndpoint"] = candidate["toEndpoint"]
    record["accessPointIds"] = candidate["accessPointIds"]
    if endpoint_snapping is not None:
        record["endpointSnapping"] = endpoint_snapping
    record["lineage"] = candidate["lineage"]
    record["comparison"] = build_comparison(candidate["lineage"], record)
    return record


# ------------------------------------------------------------------------- CLI modes


def _load_context(args):
    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    access_points = load_access_points(args.data_dir)
    return manifest, places_by_id(places), access_points_by_id(access_points)


def build_manifest(args):
    document = build_manifest_document(Path(args.data_dir))
    write_json(REVALIDATION_MANIFEST_PATH, document)
    print(
        f"OK: wrote {REVALIDATION_MANIFEST_PATH} — "
        f"{document['sourceContext']['targetEdgeCount']} target directed edge(s), "
        f"{document['sourceContext']['candidateCount']} candidate(s)."
    )
    return 0


def dry_run(args):
    manifest, by_id, ap_by_id = _load_context(args)
    place_store = load_snap_places_store(SNAP_PLACES_PATH)
    ap_store = load_revalidation_snap_store()
    existing = load_existing_results()

    print(f"Phase 3B2H targeted access-point walking revalidation — DRY RUN (no network)")
    print(f"  Provider: {ORS_PROVIDER} at {ORS_HOST} (profile {ORS_PROFILE_FOOT_WALKING})")
    print(f"  Target places: {', '.join(manifest['targetPlaceIds'])}")
    print(f"  Target directed edges: {manifest['sourceContext']['targetEdgeCount']}")
    for origin, count in manifest["sourceContext"]["historicalOriginCounts"].items():
        print(f"    from {origin}: {count}")
    print(f"  Candidates: {len(manifest['candidates'])}")

    by_place = {}
    for candidate in manifest["candidates"]:
        for place_id in manifest["targetPlaceIds"]:
            if place_id in (candidate["fromId"], candidate["toId"]):
                by_place.setdefault(place_id, []).append(candidate)
    for place_id, items in sorted(by_place.items()):
        print(f"\n  {place_id}: {len(items)} candidate(s)")
        for candidate in items:
            lineage = candidate["lineage"]
            historical = (
                f"{lineage['distance']['meters']} m / {lineage['minutes']['minMinutes']} min"
                if lineage["status"] == "validated"
                else lineage["status"]
            )
            print(
                f"    {candidate['candidateKey']:<44} [{lineage['origin']}] "
                f"historical: {historical}"
            )

    ap_ids = manifest_access_point_ids(manifest)
    pending_ap = [
        ap_id
        for ap_id in ap_ids
        if classify_access_point_snap_coverage(ap_by_id[ap_id], ap_store)
        in ("missing", "stale", SNAP_PLACE_STATUS_REQUEST_ERROR)
    ]
    place_ids = manifest_place_coordinate_ids(manifest)
    place_coverage = {
        place_id: classify_snap_coverage(place_id, by_id[place_id], place_store)
        for place_id in place_ids
    }
    pending_directions = [
        c
        for c in manifest["candidates"]
        if existing.get(c["candidateKey"], {}).get("status") not in TERMINAL_RESULT_STATUSES
    ]

    print(f"\n  Access points referenced: {len(ap_ids)} ({', '.join(ap_ids)})")
    print(f"  Access-point snap pending: {len(pending_ap)}")
    print(f"  Place-coordinate endpoints (reused from {SNAP_PLACES_PATH}, never re-snapped):")
    for place_id, coverage in sorted(place_coverage.items()):
        print(f"    {place_id}: {coverage}")
    print(f"\n  Planned Snap requests: {1 if pending_ap else 0} "
          f"(batched, cap {ORS_SNAP_MAX_LOCATIONS_PER_REQUEST} locations/request, "
          f"radius {ORS_SNAP_MAX_RADIUS_METERS} m)")
    print(f"  Planned Directions requests: {len(pending_directions)} "
          f"(paced at {args.directions_per_minute}/min; documented ceiling "
          f"{ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED}/min)")
    print(f"  Already terminal: {len(manifest['candidates']) - len(pending_directions)}")
    print("\n  No other walking edge is queried by this pipeline; the historical pilot/scale")
    print("  results are read for lineage only and are never rewritten.")
    return 0


def _require_api_key(mode):
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print(f"ORS_API_KEY required to run {mode}")
        print("Set it and re-run:")
        print(f"  ORS_API_KEY=<your key> python3 scripts/revalidate-walking-access-points.py {mode}")
        return None
    return api_key


def backfill_snap(args):
    api_key = _require_api_key("--backfill-snap")
    if not api_key:
        return 1
    manifest, _, ap_by_id = _load_context(args)
    store = load_revalidation_snap_store()
    store.setdefault("accessPoints", {})

    ap_ids = manifest_access_point_ids(manifest)
    pending = [
        ap_id
        for ap_id in ap_ids
        if args.refresh_snap
        or classify_access_point_snap_coverage(ap_by_id[ap_id], store)
        in ("missing", "stale", SNAP_PLACE_STATUS_REQUEST_ERROR)
    ]
    if not pending:
        print(f"OK: nothing to snap — all {len(ap_ids)} access point(s) are current.")
        return 0

    print(f"Snapping {len(pending)} access point(s) in batches of {ORS_SNAP_MAX_LOCATIONS_PER_REQUEST}.")
    for start in range(0, len(pending), ORS_SNAP_MAX_LOCATIONS_PER_REQUEST):
        chunk_ids = pending[start:start + ORS_SNAP_MAX_LOCATIONS_PER_REQUEST]
        locations = [to_ors_coordinates(ap_by_id[ap_id]) for ap_id in chunk_ids]
        verified_at = utc_now_iso()
        distances, error = query_ors_snap_with_retry(
            api_key, locations, radius=ORS_SNAP_MAX_RADIUS_METERS
        )
        for index, ap_id in enumerate(chunk_ids):
            if error is not None:
                entry = build_access_point_snap_entry(
                    ap_by_id[ap_id], None, ORS_SNAP_MAX_RADIUS_METERS, verified_at,
                    status=SNAP_PLACE_STATUS_REQUEST_ERROR, reason=str(error),
                )
            else:
                entry = build_access_point_snap_entry(
                    ap_by_id[ap_id], distances[index], ORS_SNAP_MAX_RADIUS_METERS, verified_at,
                )
            store["accessPoints"][ap_id] = entry
        # Durable after every chunk: an interruption loses at most this chunk.
        write_json(REVALIDATION_SNAP_PATH, store)
        if error is not None:
            print(f"  chunk failed: {error} — recorded as 'request-error' (re-query candidate)")

    resolved = sum(
        1 for e in store["accessPoints"].values() if e["status"] == SNAP_PLACE_STATUS_RESOLVED
    )
    print(f"OK: wrote {REVALIDATION_SNAP_PATH} — {resolved}/{len(store['accessPoints'])} resolved.")
    return 0


def execute(args):
    api_key = _require_api_key("--execute")
    if not api_key:
        return 1
    manifest, by_id, ap_by_id = _load_context(args)
    place_store = load_snap_places_store(SNAP_PLACES_PATH)
    ap_store = load_revalidation_snap_store()

    # Preflight, mirroring the scale pipeline: never spend a quota-bound Directions
    # batch while the snap stores cannot answer for the endpoints being routed.
    blocking = []
    for ap_id in manifest_access_point_ids(manifest):
        coverage = classify_access_point_snap_coverage(ap_by_id[ap_id], ap_store)
        if coverage in ("missing", "stale", SNAP_PLACE_STATUS_REQUEST_ERROR):
            blocking.append(f"{ap_id}: {coverage}")
        elif coverage == SNAP_PLACE_STATUS_NO_SNAP and not args.allow_unknown_snap:
            blocking.append(f"{ap_id}: {coverage}")
    for place_id in manifest_place_coordinate_ids(manifest):
        coverage = classify_snap_coverage(place_id, by_id[place_id], place_store)
        if coverage != SNAP_PLACE_STATUS_RESOLVED and not (
            coverage == SNAP_PLACE_STATUS_NO_SNAP and args.allow_unknown_snap
        ):
            blocking.append(f"{place_id}: {coverage}")
    if blocking:
        print("REFUSED: snap coverage is not ready for a Directions batch.")
        for item in blocking:
            print(f"  blocking — {item}")
        print("  Fix: python3 scripts/revalidate-walking-access-points.py --backfill-snap")
        print("  'no-snap' cannot be fixed by re-querying; pass --allow-unknown-snap to")
        print("  proceed anyway (affected candidates are recorded 'unknown').")
        return 1

    limiter = directions_rate_limiter(args.directions_per_minute)
    results = load_existing_results()
    queried = skipped = succeeded = failed = 0
    fatal_error = None

    for candidate in manifest["candidates"]:
        key = candidate["candidateKey"]
        cached = results.get(key)
        if cached and cached.get("status") in TERMINAL_RESULT_STATUSES and not args.refresh:
            skipped += 1
            continue

        from_place = endpoint_as_place(candidate["fromEndpoint"], by_id, ap_by_id)
        to_place = endpoint_as_place(candidate["toEndpoint"], by_id, ap_by_id)
        queried += 1
        verified_at = utc_now_iso()
        outcome, error = query_ors_with_retry(
            api_key, from_place, to_place, rate_limiter=limiter
        )
        if outcome is not None:
            distance_m, duration_s = outcome
            snapping = combine_snapping_for_candidate(
                candidate, distance_m, place_store, ap_store, by_id, ap_by_id
            )
            base = build_success_result(
                candidate["fromId"], candidate["toId"], distance_m, duration_s,
                from_place, to_place, verified_at,
            )
            results[key] = build_candidate_record(candidate, base, endpoint_snapping=snapping)
            succeeded += 1
        else:
            base = build_failure_result(
                candidate["fromId"], candidate["toId"], error.status, error,
                from_place, to_place, verified_at,
            )
            if getattr(error, "http_status", None) is not None:
                base["errorCode"] = error.http_status
            results[key] = build_candidate_record(candidate, base)
            failed += 1

        write_results_checkpoint(manifest, results)

        if outcome is None and getattr(error, "fatal", False):
            fatal_error = error
            break

    write_results_checkpoint(manifest, results)
    retryable = sum(
        1 for r in results.values() if r.get("status") == RESULT_STATUS_REQUEST_ERROR
    )
    if fatal_error is not None:
        print(
            f"FATAL: HTTP {fatal_error.http_status} — authentication/authorization failure. "
            "Stopping the batch instead of repeating it candidate by candidate."
        )
        print(f"  {queried} candidate(s) attempted ({succeeded} validated, {failed} failed).")
        print(f"  Checkpoint preserved in {REVALIDATION_RESULTS_PATH} ({retryable} 'request-error').")
        return 2

    print(
        f"OK: {queried} queried ({succeeded} validated, {failed} failed), {skipped} skipped "
        f"(cached). Wrote {len(results)} candidate(s) to {REVALIDATION_RESULTS_PATH}."
    )
    if retryable:
        print(f"  {retryable} candidate(s) are 'request-error' (not terminal) — re-run to retry just those.")
    print(f"  Attribution: {ATTRIBUTION}")
    print("  Historical pilot/scale results untouched; nothing published to app/src/data/.")
    return 0


def recompare(args):
    """No network. Rebuilds every candidate's `comparison` block from the manifest's
    lineage and the stored candidate result — for after a lineage or comparison rule
    change, without re-querying anything. Never touches status/distance/duration."""
    manifest, _, _ = _load_context(args)
    results = load_existing_results()
    if not results:
        print(f"Nothing to recompare: {REVALIDATION_RESULTS_PATH} has no candidates yet.")
        return 0
    lineage_by_key = {c["candidateKey"]: c["lineage"] for c in manifest["candidates"]}
    changed = 0
    for key, record in results.items():
        if key not in lineage_by_key:
            continue
        record["lineage"] = lineage_by_key[key]
        rebuilt = build_comparison(lineage_by_key[key], record)
        if rebuilt != record.get("comparison"):
            changed += 1
        record["comparison"] = rebuilt
    write_results_checkpoint(manifest, results)
    print(f"OK: recompared {len(results)} candidate(s); {changed} comparison block(s) changed.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--build-manifest", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backfill-snap", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--recompare", action="store_true")
    parser.add_argument("--refresh", action="store_true", help="Re-query every candidate, including cached terminal ones.")
    parser.add_argument("--refresh-snap", action="store_true", help="Re-snap every access point, including current ones.")
    parser.add_argument(
        "--allow-unknown-snap",
        action="store_true",
        help="Proceed over endpoints the provider has no routable point for; their candidates are recorded 'unknown' and stay un-promotable.",
    )
    parser.add_argument(
        "--directions-per-minute",
        type=int,
        default=ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED,
        help="Directions pacing (default: the documented ceiling).",
    )
    parser.add_argument("--manifest", default=str(REVALIDATION_MANIFEST_PATH))
    parser.add_argument("--data-dir", default="data")
    args = parser.parse_args()

    modes = [args.build_manifest, args.dry_run, args.backfill_snap, args.execute, args.recompare]
    if sum(1 for mode in modes if mode) != 1:
        parser.error("choose exactly one of --build-manifest, --dry-run, --backfill-snap, --execute, --recompare")
    if args.build_manifest:
        return build_manifest(args)
    if args.dry_run:
        return dry_run(args)
    if args.backfill_snap:
        return backfill_snap(args)
    if args.recompare:
        return recompare(args)
    return execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
