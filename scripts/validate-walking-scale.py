#!/usr/bin/env python3
"""Phase 3B2B-A: walking scale-up pipeline (preparation only — see docs/WALKING_SCALE_PREP.md).

Usage:
    python3 scripts/validate-walking-scale.py --dry-run
    python3 scripts/validate-walking-scale.py --backfill-snap-places [--refresh-snap-places]
    python3 scripts/validate-walking-scale.py --execute [--refresh]
    python3 scripts/validate-walking-scale.py --recombine-snapping

This pipeline is split into independent steps on purpose (Phase 3B2A's pilot pipeline
bundled a Snap request into every Directions query; this one does not):

  --backfill-snap-places: resolves the per-place Snap store (data/logistics/
      walking-snap-places.json) for every place the scale manifest references that
      isn't already resolved there. Snap-only, never touches Directions or the results
      file. Batched (one request can cover many places — see
      ORS_SNAP_MAX_LOCATIONS_PER_REQUEST) and chunked/restart-safe: the store is written
      after every chunk, so an interrupted run loses at most one in-flight chunk, never
      already-written places.

  --execute: Directions-only, one query per pending scale edge (skips a cached
      "validated" edge unless --refresh, exactly like the pilot's --execute). Combines
      each routed distance with whatever the Snap store already has for that edge's two
      places at read time — it does not make a Snap request itself. A validated
      result's `confidence` is always "validated-static" (same schema the pilot uses,
      and the same one getBestTransfer already knows how to gate); the snap-clean-only
      promotion actually happens in app/src/lib/transfer.ts's getBestTransfer, reading
      `endpointSnapping.assessment` exactly as it already does for pilot results.

  --recombine-snapping: recomputes `endpointSnapping` for every currently-"validated"
      scale result using the Snap store's CURRENT contents — no network call at all.
      Useful after a --backfill-snap-places run resolves places that were still
      "unknown" when --execute first ran for their edges.

  --dry-run: no network. Reports what a real scale-up would need (edge/place counts,
      hub and distance-bucket distribution, already-validated vs. pending, planned Snap
      and Directions request counts, and the account-plan quota those numbers are
      checked against). See docs/WALKING_SCALE_PREP.md for the full run against the
      current dataset.

Phase 3B2B-A's own mandate: this script exists and is tested, but --execute is never
invoked against the real ~308-edge batch in this phase, and --backfill-snap-places is
never invoked for real either (the 34 scale places Phase 3B2A already measured were
migrated offline by scripts/seed-walking-snap-store.py, with zero new network calls).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    APP_SCALE_RESULTS_PATH,
    ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED,
    ORS_DIRECTIONS_DAILY_LIMIT_DOCUMENTED,
    ORS_HOST,
    ORS_SNAP_MAX_LOCATIONS_PER_REQUEST,
    SCALE_MANIFEST_PATH,
    SCALE_RESULTS_PATH,
    SNAP_PLACES_PATH,
    WALKING_MODE_RAW,
    build_snap_place_entry,
    is_snap_entry_current,
    load_json,
    load_nearby,
    load_places,
    load_snap_places_store,
    nearby_by_directed_key,
    places_by_id,
    to_ors_coordinates,
    utc_now_iso,
    write_json,
)
from ors_client import MAX_TRANSIENT_RETRIES, RoutingRequestError, query_ors_snap, query_ors_with_retry  # noqa: E402
from walking_result_builder import build_endpoint_snapping, build_failure_result, build_success_result  # noqa: E402

# Same three distance buckets scripts/select-walking-pilot.py uses for its A/B/C
# categories, reused here purely for the dry-run's reporting — not a selection rule
# (the scale manifest is a set difference, not a further sample; see
# select-walking-scale.py).
DISTANCE_BUCKETS = [("<0.5 km", 0.0, 0.5), ("0.5-1 km", 0.5, 1.0), (">=1 km", 1.0, float("inf"))]


def resolve_scale_edges(manifest, places, nearby):
    by_id = places_by_id(places)
    by_directed = nearby_by_directed_key(nearby)
    resolved = []
    for edge in manifest["edges"]:
        from_id, to_id = edge["fromId"], edge["toId"]
        from_place = by_id.get(from_id)
        to_place = by_id.get(to_id)
        relation = by_directed.get((from_id, to_id))
        if from_place is None or to_place is None:
            raise ValueError(f"scale edge {from_id}->{to_id}: place not found")
        if relation is None:
            raise ValueError(f"scale edge {from_id}->{to_id}: no matching nearby.json relation")
        if relation["Modo"] != WALKING_MODE_RAW:
            raise ValueError(
                f"scale edge {from_id}->{to_id}: Modo is {relation['Modo']!r}, expected {WALKING_MODE_RAW!r}"
            )
        resolved.append(
            {"fromId": from_id, "toId": to_id, "fromPlace": from_place, "toPlace": to_place, "relation": relation}
        )
    return resolved


def load_existing_scale_results():
    if SCALE_RESULTS_PATH.exists():
        return load_json(SCALE_RESULTS_PATH)
    return []


def unique_place_ids(edges):
    return sorted({place_id for edge in edges for place_id in (edge["fromId"], edge["toId"])})


def places_needing_snap(place_ids, by_id, snap_store, refresh=False):
    """A place needs (re-)snapping when it has no store entry, a stale one (measured
    against a different coordinate than the dataset currently has), or --refresh was
    passed. Never re-derives this from a hardcoded count — always the live store.
    """
    entries = snap_store.get("places", {})
    needing = []
    for place_id in place_ids:
        entry = entries.get(place_id)
        if refresh or entry is None or not is_snap_entry_current(entry, by_id[place_id]):
            needing.append(place_id)
    return needing


def chunk(sequence, size):
    for i in range(0, len(sequence), size):
        yield sequence[i : i + size]


def dry_run(args):
    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    nearby = load_nearby(args.data_dir)
    by_id = places_by_id(places)
    resolved = resolve_scale_edges(manifest, places, nearby)

    existing_results = load_existing_scale_results()
    validated_keys = {(r["fromId"], r["toId"]) for r in existing_results if r.get("status") == "validated"}
    pending = [e for e in resolved if (e["fromId"], e["toId"]) not in validated_keys]

    place_ids = unique_place_ids(resolved)
    snap_store = load_snap_places_store(SNAP_PLACES_PATH if not args.snap_places else Path(args.snap_places))
    missing_snap_places = places_needing_snap(place_ids, by_id, snap_store)

    hub_counts = {}
    for edge in resolved:
        hub = edge["fromPlace"]["hub"]
        hub_counts[hub] = hub_counts.get(hub, 0) + 1

    bucket_counts = {label: 0 for label, _, _ in DISTANCE_BUCKETS}
    for edge in resolved:
        km = edge["relation"]["Distancia km"]
        for label, lo, hi in DISTANCE_BUCKETS:
            if lo <= km < hi:
                bucket_counts[label] += 1
                break

    snap_chunks_needed = -(-len(missing_snap_places) // ORS_SNAP_MAX_LOCATIONS_PER_REQUEST) if missing_snap_places else 0
    directions_baseline = len(pending)
    directions_worst_case = directions_baseline * (1 + MAX_TRANSIENT_RETRIES)
    minutes_needed_at_rate_limit = (
        -(-directions_baseline // ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED) if directions_baseline else 0
    )

    print(f"Phase 3B2B-A scale-up dry run (manifest: {args.manifest})")
    print(f"Host: {ORS_HOST} — no network requests made.\n")

    print(f"Scale-up edges: {len(resolved)} (derived: total 'A pie' relations minus the 24 pilot edges)")
    print(f"  already validated: {len(validated_keys)}")
    print(f"  pending: {len(pending)}\n")

    print(f"Unique places referenced: {len(place_ids)}")
    print(f"  already snap-resolved (current): {len(place_ids) - len(missing_snap_places)}")
    print(f"  still needing a Snap measurement: {len(missing_snap_places)}\n")

    print("Distribution by hub (counted by each edge's fromId hub):")
    for hub in sorted(hub_counts):
        print(f"  {hub}: {hub_counts[hub]}")
    print()

    print("Distribution by estimated distance bucket:")
    for label, _, _ in DISTANCE_BUCKETS:
        print(f"  {label}: {bucket_counts[label]}")
    print()

    print("Request plan (baseline, no failures/retries):")
    print(
        f"  Snap requests: {snap_chunks_needed} "
        f"(batches of up to {ORS_SNAP_MAX_LOCATIONS_PER_REQUEST} locations covering "
        f"{len(missing_snap_places)} still-unresolved place(s); 0 if all places are "
        "already current)"
    )
    print(f"  Directions requests: {directions_baseline} (one per pending edge)")
    print(
        f"  Directions requests, worst case with the bounded retry policy "
        f"(1 retry/edge): {directions_worst_case}"
    )
    print()

    print("Quota (documented community-plan defaults; verify against the account's own")
    print("dashboard before any real execution — see docs/WALKING_SCALE_PREP.md's sources):")
    print(
        f"  Directions: {ORS_DIRECTIONS_DAILY_LIMIT_DOCUMENTED}/day, "
        f"{ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED}/minute documented default. "
        f"{directions_baseline} pending requests fit in a single day's quota but must "
        f"be paced over at least {minutes_needed_at_rate_limit} minute(s) to respect "
        "the per-minute limit."
    )
    print(
        f"  Snap: up to {ORS_SNAP_MAX_LOCATIONS_PER_REQUEST} locations per request is "
        "documented; its own per-minute/per-day rate limit is not published in the "
        "sources checked, so it is not assumed here."
    )
    return 0


def backfill_snap_places(args):
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print("ORS_API_KEY required to backfill the Snap store")
        return 1

    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    by_id = places_by_id(places)
    nearby = load_nearby(args.data_dir)
    resolved = resolve_scale_edges(manifest, places, nearby)
    place_ids = unique_place_ids(resolved)

    store_path = Path(args.snap_places) if args.snap_places else SNAP_PLACES_PATH
    store = load_snap_places_store(store_path)
    store.setdefault("places", {})

    missing = places_needing_snap(place_ids, by_id, store, refresh=args.refresh_snap_places)
    if not missing:
        print("OK: every scale-manifest place already has a current, resolved Snap entry.")
        return 0

    total_chunks = 0
    for batch in chunk(missing, ORS_SNAP_MAX_LOCATIONS_PER_REQUEST):
        locations = [to_ors_coordinates(by_id[pid]) for pid in batch]
        try:
            snap_distances = query_ors_snap(api_key, locations)
            error = None
        except RoutingRequestError as exc:
            snap_distances = [None] * len(locations)
            error = str(exc)

        for place_id, snap_m in zip(batch, snap_distances):
            reason = f"Snap query failed: {error}" if error and snap_m is None else None
            store["places"][place_id] = build_snap_place_entry(
                by_id[place_id],
                snap_m,
                radius=350,
                provider="openrouteservice",
                profile="foot-walking",
                verified_at=utc_now_iso(),
                reason=reason,
            )
        # Written after every chunk — an interrupted run keeps every already-completed
        # chunk's places resolved; re-running only re-derives what's still missing.
        write_json(store_path, store)
        total_chunks += 1

    resolved_count = sum(1 for pid in missing if store["places"][pid]["status"] == "resolved")
    unknown_count = len(missing) - resolved_count
    print(
        f"OK: resolved {len(missing)} place(s) in {total_chunks} Snap request(s) "
        f"(resolved={resolved_count} unknown={unknown_count}). Wrote {store_path}."
    )
    return 0


def combine_snapping_for_edge(from_id, to_id, routed_distance_m, snap_store, by_id):
    entries = snap_store.get("places", {})

    def snap_value(place_id):
        entry = entries.get(place_id)
        if entry is None:
            return None, f"{place_id} not yet present in the Snap store"
        if not is_snap_entry_current(entry, by_id[place_id]):
            return None, f"{place_id}'s Snap entry is stale (coordinates changed since it was measured)"
        if entry["status"] != "resolved":
            return None, entry.get("reason") or f"{place_id}'s Snap measurement is unresolved"
        return entry["snappedDistanceMeters"], None

    from_snap, from_reason = snap_value(from_id)
    to_snap, to_reason = snap_value(to_id)
    reason = " / ".join(r for r in (from_reason, to_reason) if r) or None
    return build_endpoint_snapping(from_snap, to_snap, routed_distance_m, reason=reason)


def execute(args):
    import os

    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        print("ORS_API_KEY required to execute the scale-up batch")
        print("Set it and re-run:")
        print("  ORS_API_KEY=<your key> python3 scripts/validate-walking-scale.py --execute")
        return 1

    manifest = load_json(Path(args.manifest))
    places = load_places(args.data_dir)
    by_id = places_by_id(places)
    nearby = load_nearby(args.data_dir)
    resolved = resolve_scale_edges(manifest, places, nearby)

    snap_store = load_snap_places_store(Path(args.snap_places) if args.snap_places else SNAP_PLACES_PATH)

    existing = load_existing_scale_results()
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
        outcome, error = query_ors_with_retry(api_key, edge["fromPlace"], edge["toPlace"])
        if outcome is not None:
            distance_m, duration_s = outcome
            endpoint_snapping = combine_snapping_for_edge(edge["fromId"], edge["toId"], distance_m, snap_store, by_id)
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

    write_json(SCALE_RESULTS_PATH, final_results)
    write_json(APP_SCALE_RESULTS_PATH, final_results)

    print(
        f"OK: {queried} queried ({succeeded} validated, {failed} failed), "
        f"{skipped} skipped (cached). Wrote {len(final_results)} results to "
        f"{SCALE_RESULTS_PATH} and {APP_SCALE_RESULTS_PATH}."
    )
    return 0


def recombine_snapping(args):
    """No network. Recomputes endpointSnapping for every currently-validated scale
    result using the Snap store's current contents — for after a
    --backfill-snap-places run resolves places that were "unknown" when --execute
    first ran for their edges. Never touches distance/duration/status.
    """
    places = load_places(args.data_dir)
    by_id = places_by_id(places)
    snap_store = load_snap_places_store(Path(args.snap_places) if args.snap_places else SNAP_PLACES_PATH)

    existing = load_existing_scale_results()
    if not existing:
        print("OK: no scale results yet — nothing to recombine.")
        return 0

    changed = 0
    for result in existing:
        if result.get("status") != "validated":
            continue
        new_snapping = combine_snapping_for_edge(
            result["fromId"], result["toId"], result["distance"]["meters"], snap_store, by_id
        )
        if new_snapping != result.get("endpointSnapping"):
            result["endpointSnapping"] = new_snapping
            changed += 1

    write_json(SCALE_RESULTS_PATH, existing)
    write_json(APP_SCALE_RESULTS_PATH, existing)
    print(f"OK: recombined endpointSnapping for {len(existing)} result(s), {changed} changed.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backfill-snap-places", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--recombine-snapping", action="store_true")
    parser.add_argument("--refresh", action="store_true", help="Re-query every scale edge, including cached validated ones.")
    parser.add_argument("--refresh-snap-places", action="store_true", help="Re-snap every place, including already-current ones.")
    parser.add_argument("--manifest", default=str(SCALE_MANIFEST_PATH))
    parser.add_argument("--snap-places", default=None, help="Override the Snap store path (default: data/logistics/walking-snap-places.json)")
    parser.add_argument("--data-dir", default="data")
    args = parser.parse_args()

    modes = [bool(args.dry_run), bool(args.backfill_snap_places), bool(args.execute), bool(args.recombine_snapping)]
    if sum(modes) != 1:
        parser.error("pass exactly one of --dry-run, --backfill-snap-places, --execute, or --recombine-snapping")

    if args.dry_run:
        return dry_run(args)
    if args.backfill_snap_places:
        return backfill_snap_places(args)
    if args.recombine_snapping:
        return recombine_snapping(args)
    return execute(args)


if __name__ == "__main__":
    sys.exit(main())
