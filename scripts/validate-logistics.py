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
    MANIFEST_PATH,
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    PILOT_EDGE_COUNT,
    RESULTS_PATH,
    WALKING_MODE_RAW,
    load_json,
    load_nearby,
    load_places,
    nearby_by_directed_key,
    places_by_id,
    snap_warning,
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
            # one-off --diagnose-snap backfill), but when present it must be internally
            # consistent — the "significant" flag is a pure, re-derivable function of
            # the two snap distances and the routed distance, never a free-standing
            # opinion that could silently drift from the rule that computed it.
            snapping = result.get("endpointSnapping")
            if snapping is not None:
                radius = snapping.get("radiusMeters")
                if not isinstance(radius, (int, float)) or radius <= 0:
                    errors.append(f"{label}: endpointSnapping.radiusMeters must be > 0")
                for field in ("fromSnapMeters", "toSnapMeters"):
                    value = snapping.get(field)
                    if value is not None and (not isinstance(value, (int, float)) or value < 0):
                        errors.append(f"{label}: endpointSnapping.{field} must be null or >= 0")
                expected_significant = snap_warning(
                    snapping.get("fromSnapMeters"), snapping.get("toSnapMeters"), distance
                )
                if snapping.get("significant") != expected_significant:
                    errors.append(
                        f"{label}: endpointSnapping.significant is {snapping.get('significant')!r}, "
                        f"but recomputing from the recorded snap distances gives {expected_significant!r}"
                    )
        else:
            if result.get("confidence") is not None:
                errors.append(f"{label}: a {status!r} result must not carry a confidence value")

        secret_paths = find_secrets(result, f"results[{i}]")
        if secret_paths:
            errors.append(f"{label}: possible secret/credential value found at {secret_paths}")

    return errors, warnings


def check(data_dir):
    errors = []
    warnings = []

    if not MANIFEST_PATH.exists():
        return [f"{MANIFEST_PATH} does not exist — run scripts/select-walking-pilot.py first"], [], 0, 0

    manifest = load_json(MANIFEST_PATH)
    places = load_places(data_dir)
    nearby = load_nearby(data_dir)
    places_ids = set(places_by_id(places).keys())
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

    return errors, warnings, len(manifest.get("edges", [])), len(results)


def main():
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    errors, warnings, edge_count, result_count = check(data_dir)

    for warning in warnings:
        print(f"WARNING: {warning}")

    if errors:
        print(f"FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)

    suffix = f" ({len(warnings)} warning(s))" if warnings else ""
    status = "results present" if result_count else "no results yet (pilot not run)"
    print(f"OK: {edge_count} manifest edges, {result_count} pilot results, {status}{suffix}.")


if __name__ == "__main__":
    main()
