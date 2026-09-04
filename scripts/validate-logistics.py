#!/usr/bin/env python3
"""Integrity checks for the Phase 3B2A walking-validation pilot artifacts.

Usage:
    python3 scripts/validate-logistics.py [data-dir]

Unlike scripts/validate-dataset.py (which checks the workbook-derived export),
this validates data/logistics/walking-pilot-manifest.json and
walking-pilot-results.json — artifacts this pipeline produces itself, not the
workbook. Exits non-zero and prints every failing check if anything is wrong;
otherwise prints a one-line OK summary.

If the manifest doesn't exist yet, this is a hard error (the pipeline is expected to
have generated it). If the results file doesn't exist or is empty, that's fine — it
means the live pilot hasn't run yet — and only manifest checks are performed.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    APP_RESULTS_PATH,
    APP_SCALE_RESULTS_PATH,
    MANIFEST_PATH,
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    PILOT_EDGE_COUNT,
    RESULTS_PATH,
    SCALE_MANIFEST_PATH,
    SCALE_RESULTS_PATH,
    SNAP_ASSESSMENTS,
    SNAP_PLACES_PATH,
    SNAP_PLACE_STATUSES,
    SNAP_PLACE_STATUS_NO_SNAP,
    SNAP_PLACE_STATUS_REQUEST_ERROR,
    SNAP_PLACE_STATUS_RESOLVED,
    WALKING_MODE_RAW,
    classify_endpoint_snapping,
    is_snap_entry_current,
    load_json,
    load_nearby,
    load_places,
    load_snap_places_store,
    nearby_by_directed_key,
    places_by_id,
)

VALID_RESULT_STATUSES = {"validated", "no-route", "request-error"}
SECRET_LIKE_KEYS = {"apikey", "api_key", "authorization", "ors_api_key", "key", "token"}


def check_manifest(manifest, places_ids, nearby_by_directed):
    errors = []
    warnings = []

    edges = manifest.get("edges", [])
    if len(edges) != PILOT_EDGE_COUNT:
        errors.append(f"manifest has {len(edges)} edges, expected exactly {PILOT_EDGE_COUNT}")

    seen = set()
    for i, edge in enumerate(edges):
        from_id, to_id = edge.get("fromId"), edge.get("toId")
        label = f"manifest edge[{i}] {from_id}->{to_id}"

        if from_id not in places_ids:
            errors.append(f"{label}: fromId not found in places.json")
        if to_id not in places_ids:
            errors.append(f"{label}: toId not found in places.json")

        key = (from_id, to_id)
        if key in seen:
            errors.append(f"{label}: duplicate directed edge in manifest")
        seen.add(key)

        relation = nearby_by_directed.get(key)
        if relation is None:
            errors.append(f"{label}: no matching nearby.json relation")
        elif relation["Modo"] != WALKING_MODE_RAW:
            errors.append(f"{label}: relation Modo is {relation['Modo']!r}, expected {WALKING_MODE_RAW!r}")

    return errors, warnings


def find_secrets(obj, path=""):
    """Recursively looks for dict keys that look like a credential, and flags any
    string value that looks like it could be a live ORS key (long, high-entropy,
    typically alphanumeric) sitting under such a key. Names like 'provider' are
    fine; this only reacts to key/value pairs that look like a stored credential.
    """
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            lower = str(k).lower()
            if lower in SECRET_LIKE_KEYS and isinstance(v, str) and v:
                found.append(f"{path}/{k}")
            found += find_secrets(v, f"{path}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += find_secrets(v, f"{path}[{i}]")
    return found


def check_results_coverage(results, manifest_keys):
    """A non-empty results file must cover the manifest's edges exactly: no edge
    missing, no edge beyond the manifest's 24. A missing edge is not "pilot not
    finished" once any results exist — see check()'s all-or-nothing contract."""
    errors = []
    result_keys = {(r.get("fromId"), r.get("toId")) for r in results}
    missing = manifest_keys - result_keys
    extra = result_keys - manifest_keys
    if missing:
        errors.append(
            f"results file is missing {len(missing)} manifest edge(s): {sorted(missing)}"
        )
    if extra:
        errors.append(
            f"results file has {len(extra)} edge(s) not in the manifest's {PILOT_EDGE_COUNT}: {sorted(extra)}"
        )
    return errors


def check_results(results, manifest_keys):
    errors = []
    warnings = []

    seen = set()
    for i, result in enumerate(results):
        from_id, to_id = result.get("fromId"), result.get("toId")
        key = (from_id, to_id)
        label = f"results[{i}] {from_id}->{to_id}"

        if key in seen:
            errors.append(f"{label}: duplicate directed edge in results")
        seen.add(key)

        status = result.get("status")
        if status not in VALID_RESULT_STATUSES:
            errors.append(f"{label}: invalid status {status!r}")

        if result.get("provider") != ORS_PROVIDER:
            errors.append(f"{label}: provider is {result.get('provider')!r}, expected {ORS_PROVIDER!r}")
        if result.get("profile") != ORS_PROFILE_FOOT_WALKING:
            errors.append(f"{label}: profile is {result.get('profile')!r}, expected {ORS_PROFILE_FOOT_WALKING!r}")

        if status == "validated":
            if not result.get("verifiedAt"):
                errors.append(f"{label}: validated-static result must have a non-null verifiedAt")
            source = result.get("source") or {}
            if source.get("kind") != "routing-provider":
                errors.append(f"{label}: validated result must carry routing-provider provenance")
            if source.get("provider") != result.get("provider"):
                errors.append(
                    f"{label}: source.provider {source.get('provider')!r} does not match "
                    f"top-level provider {result.get('provider')!r}"
                )
            if source.get("profile") != result.get("profile"):
                errors.append(
                    f"{label}: source.profile {source.get('profile')!r} does not match "
                    f"top-level profile {result.get('profile')!r}"
                )
            if result.get("confidence") != "validated-static":
                errors.append(f"{label}: validated result confidence must be 'validated-static', got {result.get('confidence')!r}")
            if result.get("confidence") == "estimated":
                errors.append(f"{label}: pilot result must never be 'estimated'")
            distance = (result.get("distance") or {}).get("meters")
            if distance is None or distance <= 0:
                errors.append(f"{label}: validated result must have distance.meters > 0")
            minutes = result.get("minutes") or {}
            if minutes.get("minMinutes") is None or minutes.get("minMinutes") < 0:
                errors.append(f"{label}: validated result must have minutes.minMinutes >= 0")
            if minutes.get("minMinutes") != minutes.get("maxMinutes"):
                warnings.append(f"{label}: minMinutes != maxMinutes for a single-sample validated result")

            # endpointSnapping is optional (only captured going forward, or via a
            # backfill), but when present it must be internally consistent — the
            # "assessment" is a pure, re-derivable function of the two snap distances
            # and the routed distance, never a free-standing opinion that could
            # silently drift from the rule that computed it. A null snap distance must
            # never be paired with "clean"/"significant": that combination can only
            # come from treating a missing measurement as 0 meters, which is exactly
            # the bug this schema exists to make impossible.
            snapping = result.get("endpointSnapping")
            if snapping is not None:
                radius = snapping.get("radiusMeters")
                if not isinstance(radius, (int, float)) or radius <= 0:
                    errors.append(f"{label}: endpointSnapping.radiusMeters must be > 0")
                for field in ("fromSnapMeters", "toSnapMeters"):
                    value = snapping.get(field)
                    if value is not None and (not isinstance(value, (int, float)) or value < 0):
                        errors.append(f"{label}: endpointSnapping.{field} must be null or >= 0")

                assessment = snapping.get("assessment")
                if assessment not in SNAP_ASSESSMENTS:
                    errors.append(
                        f"{label}: endpointSnapping.assessment is {assessment!r}, expected one of {SNAP_ASSESSMENTS}"
                    )
                expected_assessment = classify_endpoint_snapping(
                    snapping.get("fromSnapMeters"), snapping.get("toSnapMeters"), distance
                )
                if assessment != expected_assessment:
                    errors.append(
                        f"{label}: endpointSnapping.assessment is {assessment!r}, "
                        f"but recomputing from the recorded snap distances gives {expected_assessment!r}"
                    )
                if assessment in ("clean", "significant") and (
                    snapping.get("fromSnapMeters") is None or snapping.get("toSnapMeters") is None
                ):
                    errors.append(
                        f"{label}: endpointSnapping.assessment is {assessment!r} but a snap distance is "
                        "null — a null measurement must be 'unknown', never 'clean' or 'significant'"
                    )
        else:
            if result.get("confidence") is not None:
                errors.append(f"{label}: a {status!r} result must not carry a confidence value")

        secret_paths = find_secrets(result, f"results[{i}]")
        if secret_paths:
            errors.append(f"{label}: possible secret/credential value found at {secret_paths}")

    return errors, warnings


def check_scale_manifest(scale_manifest, places_ids, nearby_by_directed):
    """Phase 3B2B-A: structurally the same checks check_manifest() runs on the pilot
    manifest, applied to the scale-up manifest — every edge must resolve to a real
    place pair and a real 'A pie' relation, with no duplicate directed edge."""
    errors = []
    edges = scale_manifest.get("edges", [])
    seen = set()
    for i, edge in enumerate(edges):
        from_id, to_id = edge.get("fromId"), edge.get("toId")
        label = f"scale manifest edge[{i}] {from_id}->{to_id}"

        if from_id not in places_ids:
            errors.append(f"{label}: fromId not found in places.json")
        if to_id not in places_ids:
            errors.append(f"{label}: toId not found in places.json")

        key = (from_id, to_id)
        if key in seen:
            errors.append(f"{label}: duplicate directed edge in scale manifest")
        seen.add(key)

        relation = nearby_by_directed.get(key)
        if relation is None:
            errors.append(f"{label}: no matching nearby.json relation")
        elif relation["Modo"] != WALKING_MODE_RAW:
            errors.append(f"{label}: relation Modo is {relation['Modo']!r}, expected {WALKING_MODE_RAW!r}")

    return errors


def check_pilot_scale_partition(pilot_manifest, scale_manifest, nearby):
    """pilot ∪ scale must equal exactly the current dataset's 'A pie' edges, with zero
    overlap: every walking edge is covered by exactly one of the two manifests, never
    both and never neither. This is the invariant that makes "scale is everything the
    pilot didn't cover" actually true, not just true by construction at write time."""
    errors = []
    walking_edges = {(r["Desde ID"], r["Hacia ID"]) for r in nearby if r["Modo"] == WALKING_MODE_RAW}
    pilot_keys = {(e["fromId"], e["toId"]) for e in pilot_manifest.get("edges", [])}
    scale_keys = {(e["fromId"], e["toId"]) for e in scale_manifest.get("edges", [])}

    overlap = pilot_keys & scale_keys
    if overlap:
        errors.append(f"pilot and scale manifests overlap on {len(overlap)} edge(s): {sorted(overlap)[:5]}")

    union = pilot_keys | scale_keys
    missing = walking_edges - union
    if missing:
        errors.append(
            f"{len(missing)} 'A pie' edge(s) covered by neither the pilot nor the scale "
            f"manifest: {sorted(missing)[:5]}"
        )
    extra = union - walking_edges
    if extra:
        errors.append(
            f"{len(extra)} edge(s) in the pilot/scale manifests are not current 'A pie' "
            f"relations at all: {sorted(extra)[:5]}"
        )

    return errors


def check_snap_places_store(store, places_ids, places_by_id_map):
    """Keyed strictly by placeId (never by edge or direction), with a machine-readable
    three-state status: only "resolved" may carry a measurement, and "no-snap" (the
    provider's own "no routable point" answer) and "request-error" (the request itself
    failed) must both carry null — a null is never a real 0 m measurement, and those
    two are not interchangeable, since only the second is worth re-querying.

    Returns (errors, warnings). Staleness is a warning, not an error: an entry measured
    against coordinates the dataset has since changed is a legitimate "needs re-query"
    state that --backfill-snap-places fixes, and the Directions preflight (see
    scripts/validate-walking-scale.py) is what actually blocks a run over one.
    """
    errors = []
    warnings = []
    for place_id, entry in store.get("places", {}).items():
        label = f"snap store[{place_id}]"
        if place_id not in places_ids:
            errors.append(f"{label}: not a place id in places.json")
            continue

        status = entry.get("status")
        if status not in SNAP_PLACE_STATUSES:
            errors.append(f"{label}: status is {status!r}, expected one of {SNAP_PLACE_STATUSES}")

        snap_m = entry.get("snappedDistanceMeters")
        if status == SNAP_PLACE_STATUS_RESOLVED and snap_m is None:
            errors.append(f"{label}: status is 'resolved' but snappedDistanceMeters is null")
        if status in (SNAP_PLACE_STATUS_NO_SNAP, SNAP_PLACE_STATUS_REQUEST_ERROR) and snap_m is not None:
            errors.append(
                f"{label}: status is {status!r} but snappedDistanceMeters is {snap_m!r}, expected null"
            )
        if snap_m is not None and (not isinstance(snap_m, (int, float)) or snap_m < 0):
            errors.append(f"{label}: snappedDistanceMeters must be null or >= 0")

        radius = entry.get("radiusMeters")
        if not isinstance(radius, (int, float)) or radius <= 0:
            errors.append(f"{label}: radiusMeters must be > 0")

        place = places_by_id_map.get(place_id)
        if place is not None and not is_snap_entry_current(entry, place):
            warnings.append(
                f"{label}: coordinates are stale (the dataset moved this place) — "
                "re-run --backfill-snap-places before the next Directions batch"
            )

        secret_paths = find_secrets(entry, label)
        if secret_paths:
            errors.append(f"{label}: possible secret/credential value found at {secret_paths}")

    return errors, warnings


def check_scale_results_coverage(results, manifest_keys):
    """The scale-up results file doubles as an --execute checkpoint, so a run that was
    interrupted legitimately leaves it covering only part of the manifest. Missing
    edges are therefore a warning ("batch in progress"), while an edge that isn't in
    the manifest at all is still an error — that can only be corruption or a manifest
    that changed under a half-finished run."""
    errors = []
    warnings = []
    result_keys = {(r.get("fromId"), r.get("toId")) for r in results}
    missing = manifest_keys - result_keys
    extra = result_keys - manifest_keys
    if missing:
        warnings.append(
            f"scale results cover {len(result_keys)}/{len(manifest_keys)} manifest edges — "
            f"{len(missing)} still pending (an interrupted or not-yet-finished --execute run)"
        )
    if extra:
        errors.append(
            f"scale results contain {len(extra)} edge(s) not in the scale manifest: {sorted(extra)[:5]}"
        )
    return errors, warnings


def check(data_dir):
    errors = []
    warnings = []

    if not MANIFEST_PATH.exists():
        return {
            "errors": [f"{MANIFEST_PATH} does not exist — run scripts/select-walking-pilot.py first"],
            "warnings": [],
            "manifest_edge_count": 0,
            "result_count": 0,
            "scale_edge_count": None,
            "scale_result_count": 0,
        }

    manifest = load_json(MANIFEST_PATH)
    places = load_places(data_dir)
    nearby = load_nearby(data_dir)
    places_by_id_map = places_by_id(places)
    places_ids = set(places_by_id_map.keys())
    nearby_by_directed = nearby_by_directed_key(nearby)

    manifest_errors, manifest_warnings = check_manifest(manifest, places_ids, nearby_by_directed)
    errors += manifest_errors
    warnings += manifest_warnings

    manifest_keys = {(e["fromId"], e["toId"]) for e in manifest.get("edges", [])}

    results = load_json(RESULTS_PATH) if RESULTS_PATH.exists() else []
    if results:
        errors += check_results_coverage(results, manifest_keys)
        results_errors, results_warnings = check_results(results, manifest_keys)
        errors += results_errors
        warnings += results_warnings

        if APP_RESULTS_PATH.exists():
            app_results = load_json(APP_RESULTS_PATH)
            if app_results != results:
                errors.append(
                    f"{APP_RESULTS_PATH} does not match {RESULTS_PATH} — app copy is out of sync"
                )
        else:
            errors.append(f"{RESULTS_PATH} has results but {APP_RESULTS_PATH} (app copy) is missing")

    # Phase 3B2B-A artifacts are optional prep — absent entirely is fine (nothing to
    # check yet); present means they must be internally consistent and consistent with
    # the pilot manifest and the live dataset.
    scale_edge_count = None
    scale_result_count = 0
    if SCALE_MANIFEST_PATH.exists():
        scale_manifest = load_json(SCALE_MANIFEST_PATH)
        scale_edge_count = len(scale_manifest.get("edges", []))
        errors += check_scale_manifest(scale_manifest, places_ids, nearby_by_directed)
        errors += check_pilot_scale_partition(manifest, scale_manifest, nearby)

        scale_manifest_keys = {(e["fromId"], e["toId"]) for e in scale_manifest.get("edges", [])}
        scale_results = load_json(SCALE_RESULTS_PATH) if SCALE_RESULTS_PATH.exists() else []
        scale_result_count = len(scale_results)
        if scale_results:
            coverage_errors, coverage_warnings = check_scale_results_coverage(scale_results, scale_manifest_keys)
            errors += coverage_errors
            warnings += coverage_warnings
            scale_results_errors, scale_results_warnings = check_results(scale_results, scale_manifest_keys)
            errors += scale_results_errors
            warnings += scale_results_warnings

            scale_complete = {(r["fromId"], r["toId"]) for r in scale_results} == scale_manifest_keys
            if APP_SCALE_RESULTS_PATH.exists():
                app_scale_results = load_json(APP_SCALE_RESULTS_PATH)
                if app_scale_results != scale_results:
                    errors.append(
                        f"{APP_SCALE_RESULTS_PATH} does not match {SCALE_RESULTS_PATH} — app copy is out of sync"
                    )
            elif scale_complete:
                # Only a COMPLETE batch owes the app a copy. A partial checkpoint
                # deliberately doesn't publish one (see publish_app_copy in
                # scripts/validate-walking-scale.py), so its absence is correct.
                errors.append(
                    f"{SCALE_RESULTS_PATH} covers the whole manifest but "
                    f"{APP_SCALE_RESULTS_PATH} (app copy) is missing"
                )

    if SNAP_PLACES_PATH.exists():
        snap_store = load_snap_places_store(SNAP_PLACES_PATH)
        snap_errors, snap_warnings = check_snap_places_store(snap_store, places_ids, places_by_id_map)
        errors += snap_errors
        warnings += snap_warnings

    return {
        "errors": errors,
        "warnings": warnings,
        "manifest_edge_count": len(manifest.get("edges", [])),
        "result_count": len(results),
        "scale_edge_count": scale_edge_count,
        "scale_result_count": scale_result_count,
    }


def main():
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    outcome = check(data_dir)
    errors, warnings = outcome["errors"], outcome["warnings"]

    for warning in warnings:
        print(f"WARNING: {warning}")

    if errors:
        print(f"FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)

    suffix = f" ({len(warnings)} warning(s))" if warnings else ""
    status = "results present" if outcome["result_count"] else "no results yet (pilot not run)"
    scale_part = ""
    if outcome["scale_edge_count"] is not None:
        scale_status = "results present" if outcome["scale_result_count"] else "no results yet"
        scale_part = (
            f" | scale: {outcome['scale_edge_count']} manifest edges, "
            f"{outcome['scale_result_count']} results, {scale_status}"
        )
    print(
        f"OK: {outcome['manifest_edge_count']} manifest edges, {outcome['result_count']} "
        f"pilot results, {status}{scale_part}{suffix}."
    )


if __name__ == "__main__":
    main()
