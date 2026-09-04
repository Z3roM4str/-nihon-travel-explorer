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

      Three things make a real bulk run safe to interrupt and safe to start:
        * Rate limiting — every Directions attempt, retries included, passes through
          ors_client.RateLimiter at --directions-per-minute (default: the documented
          40/min). Pacing is proactive; an HTTP 429 is treated as a failure to retry,
          never as the mechanism that keeps us under the ceiling.
        * Checkpointing — data/logistics/walking-scale-results.json is rewritten after
          EVERY completed edge, so a crash costs at most the one in-flight edge. The
          app-facing copy is only synced once the batch covers the whole manifest, so
          the application never sees a half-finished dataset.
        * Preflight — the run refuses to start while any place is missing/stale/
          request-error in the Snap store, and requires an explicit
          --allow-unknown-snap to proceed over "no-snap" places.

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
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    ORS_SNAP_MAX_LOCATIONS_PER_REQUEST,
    ORS_SNAP_MAX_RADIUS_METERS,
    SCALE_MANIFEST_PATH,
    SCALE_RESULTS_PATH,
    SNAP_COVERAGE_MISSING,
    SNAP_COVERAGE_REQUERY_BY_DEFAULT,
    SNAP_COVERAGE_STALE,
    SNAP_COVERAGE_STATES,
    SNAP_PLACES_PATH,
    SNAP_PLACE_STATUS_NO_SNAP,
    SNAP_PLACE_STATUS_REQUEST_ERROR,
    SNAP_PLACE_STATUS_RESOLVED,
    WALKING_MODE_RAW,
    build_snap_place_entry,
    classify_snap_coverage,
    is_snap_entry_current,
    load_json,
    load_nearby,
    load_places,
    load_snap_places_store,
    nearby_by_directed_key,
    places_by_id,
    snap_coverage_summary,
    to_ors_coordinates,
    utc_now_iso,
    write_json,
)
from ors_client import (  # noqa: E402
    MAX_TRANSIENT_RETRIES,
    directions_rate_limiter,
    query_ors_snap_with_retry,
    query_ors_with_retry,
)
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


def places_needing_snap(place_ids, by_id, snap_store, refresh=False, retry_no_snap=False):
    """Which places a backfill run should (re-)query, derived from the live store —
    never from a hardcoded count.

    By default: everything missing, stale, or left in "request-error" (a failed
    request says nothing about the coordinate, so it stays a candidate). Deliberately
    NOT "no-snap": that is the provider's own definitive answer for that coordinate at
    that radius, and re-asking it every run spends quota to learn nothing —
    `retry_no_snap=True` opts into asking again anyway (e.g. after a radius change).
    `refresh=True` re-queries every place regardless of what the store holds.
    """
    needing = []
    for place_id in place_ids:
        if refresh:
            needing.append(place_id)
            continue
        coverage = classify_snap_coverage(place_id, by_id[place_id], snap_store)
        if coverage in SNAP_COVERAGE_REQUERY_BY_DEFAULT:
            needing.append(place_id)
        elif coverage == SNAP_PLACE_STATUS_NO_SNAP and retry_no_snap:
            needing.append(place_id)
    return needing


def snap_preflight(place_ids, by_id, snap_store, allow_unknown_snap=False):
    """Gate in front of every real Directions batch.

    A bulk run is expensive and quota-bound; starting it while the Snap store is
    incomplete means paying for hundreds of Directions calls whose results can only
    come back "unknown" and therefore can never be promoted. Two different kinds of
    incompleteness, treated differently:

      - missing / stale / request-error: fixable by running --backfill-snap-places.
        Blocked unconditionally — there is no good reason to burn the batch first.
      - no-snap: NOT fixable by re-querying (the provider already answered). Running
        anyway is a legitimate choice, but it must be a deliberate, recorded one:
        --allow-unknown-snap. Never the silent default.

    Returns (ok, blocking, summary) where `blocking` lists the coverage states that
    stopped the run (empty when ok).
    """
    summary = snap_coverage_summary(place_ids, by_id, snap_store)
    blocking = [state for state in SNAP_COVERAGE_REQUERY_BY_DEFAULT if summary[state]]
    if summary[SNAP_PLACE_STATUS_NO_SNAP] and not allow_unknown_snap:
        blocking.append(SNAP_PLACE_STATUS_NO_SNAP)
    return (not blocking), blocking, summary


def chunk(sequence, size):
    for i in range(0, len(sequence), size):
        yield sequence[i : i + size]


def ordered_results(results_by_key, manifest_keys):
    """Deterministic on-disk order: manifest order (sorted directed keys), skipping
    edges that have no result yet. A partial checkpoint is therefore a prefix-stable
    subset, not a re-shuffle of whatever finished first."""
    return [results_by_key[k] for k in sorted(manifest_keys) if k in results_by_key]


def write_checkpoint(results_by_key, manifest_keys):
    """Durably persist progress to the ROOT artifact only.

    Called after every completed edge, so an interruption costs at most the single
    in-flight edge — never the whole run. The app-facing copy is deliberately NOT
    written here: publishing a half-finished batch into app/src/data/ would hand the
    application a dataset that looks authoritative and isn't. See publish_app_copy().
    """
    results = ordered_results(results_by_key, manifest_keys)
    write_json(SCALE_RESULTS_PATH, results)
    return results


def publish_app_copy(results, manifest_keys):
    """Sync the app-consumable copy, and only when the batch is actually complete:
    every manifest edge has a result. Returns True if it published.

    "Complete" here means covered, not necessarily all-validated — a genuine
    "no-route"/"request-error" outcome for an edge is a finished answer for that edge
    (see WalkingPilotResult's status union), and getBestTransfer already falls back to
    the estimated edge for anything that isn't a snap-clean validated result.
    """
    covered = {(r["fromId"], r["toId"]) for r in results}
    if covered != set(manifest_keys):
        return False
    write_json(APP_SCALE_RESULTS_PATH, results)
    return True


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

    coverage = snap_coverage_summary(place_ids, by_id, snap_store)
    print(f"Unique places referenced: {len(place_ids)}")
    print("  Snap coverage (machine-readable states, never parsed from text):")
    for state in SNAP_COVERAGE_STATES:
        print(f"    {state}: {len(coverage[state])}")
    print(f"  would be (re-)queried by --backfill-snap-places: {len(missing_snap_places)}")
    preflight_ok, blocking, _ = snap_preflight(place_ids, by_id, snap_store)
    if preflight_ok:
        print("  Directions preflight: PASS — a bulk run may start.\n")
    else:
        print(
            f"  Directions preflight: BLOCKED by {', '.join(blocking)} — "
            "--execute refuses to start until these are resolved "
            "(or, for 'no-snap' only, --allow-unknown-snap is passed explicitly).\n"
        )

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

    missing = places_needing_snap(
        place_ids,
        by_id,
        store,
        refresh=args.refresh_snap_places,
        retry_no_snap=args.retry_no_snap,
    )
    if not missing:
        print("OK: no scale-manifest place needs a Snap query right now.")
        _print_snap_coverage(place_ids, by_id, store)
        return 0

    total_chunks = 0
    for batch in chunk(missing, ORS_SNAP_MAX_LOCATIONS_PER_REQUEST):
        locations = [to_ors_coordinates(by_id[pid]) for pid in batch]
        # A transport-level failure (network/5xx/429/auth) is a different fact from a
        # per-location "no routable point": the first is retried once and then recorded
        # as "request-error" (a re-query candidate next run), the second comes back as a
        # None inside a successful response and is recorded as "no-snap". Neither is
        # ever a 0-meter measurement.
        snap_distances, error = query_ors_snap_with_retry(api_key, locations)

        for index, place_id in enumerate(batch):
            if error is not None:
                snap_m, status, reason = None, SNAP_PLACE_STATUS_REQUEST_ERROR, f"Snap request failed: {error}"
            elif snap_distances[index] is None:
                snap_m, status, reason = (
                    None,
                    SNAP_PLACE_STATUS_NO_SNAP,
                    f"no routable point within {ORS_SNAP_MAX_RADIUS_METERS} m",
                )
            else:
                snap_m, status, reason = snap_distances[index], SNAP_PLACE_STATUS_RESOLVED, None
            store["places"][place_id] = build_snap_place_entry(
                by_id[place_id],
                snap_m,
                radius=ORS_SNAP_MAX_RADIUS_METERS,
                provider=ORS_PROVIDER,
                profile=ORS_PROFILE_FOOT_WALKING,
                verified_at=utc_now_iso(),
                status=status,
                reason=reason,
            )
        # Written after every chunk — an interrupted run keeps every already-completed
        # chunk's places resolved; re-running only re-derives what's still outstanding.
        write_json(store_path, store)
        total_chunks += 1

    counts = {state: 0 for state in (SNAP_PLACE_STATUS_RESOLVED, SNAP_PLACE_STATUS_NO_SNAP, SNAP_PLACE_STATUS_REQUEST_ERROR)}
    for place_id in missing:
        counts[store["places"][place_id]["status"]] += 1
    print(
        f"OK: queried {len(missing)} place(s) in {total_chunks} Snap request(s) — "
        f"resolved={counts[SNAP_PLACE_STATUS_RESOLVED]} "
        f"no-snap={counts[SNAP_PLACE_STATUS_NO_SNAP]} "
        f"request-error={counts[SNAP_PLACE_STATUS_REQUEST_ERROR]}. Wrote {store_path}."
    )
    if counts[SNAP_PLACE_STATUS_REQUEST_ERROR]:
        print(
            "  NOTE: 'request-error' places are re-query candidates — re-run "
            "--backfill-snap-places to retry just those."
        )
    return 0


def _print_snap_coverage(place_ids, by_id, store):
    summary = snap_coverage_summary(place_ids, by_id, store)
    parts = [f"{state}={len(summary[state])}" for state in SNAP_COVERAGE_STATES]
    print("  Snap coverage: " + " ".join(parts))


def combine_snapping_for_edge(from_id, to_id, routed_distance_m, snap_store, by_id):
    """Routed distance + the two places' cached Snap measurements -> endpointSnapping.

    Branches on the machine-readable coverage state, never on any `reason` text. Only
    a "resolved" place contributes a measurement; missing/stale/no-snap/request-error
    all contribute None, which classify_endpoint_snapping turns into "unknown" — a
    null is never read as 0 meters, so an unmeasured endpoint can never make an edge
    look "clean".
    """
    entries = snap_store.get("places", {})
    coverage_reasons = {
        SNAP_COVERAGE_MISSING: "not yet present in the Snap store",
        SNAP_COVERAGE_STALE: "Snap entry is stale (coordinates changed since it was measured)",
        SNAP_PLACE_STATUS_NO_SNAP: "no routable point found within the snap radius",
        SNAP_PLACE_STATUS_REQUEST_ERROR: "Snap request failed (re-query candidate)",
    }

    def snap_value(place_id):
        coverage = classify_snap_coverage(place_id, by_id[place_id], snap_store)
        if coverage == SNAP_PLACE_STATUS_RESOLVED:
            return entries[place_id]["snappedDistanceMeters"], None
        return None, f"{place_id}: {coverage_reasons[coverage]}"

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

    # Preflight: never start a quota-bound bulk run against an incomplete Snap store.
    place_ids = unique_place_ids(resolved)
    ok, blocking, summary = snap_preflight(
        place_ids, by_id, snap_store, allow_unknown_snap=args.allow_unknown_snap
    )
    if not ok:
        print("REFUSED: Snap store is not ready for a Directions batch.")
        _print_snap_coverage(place_ids, by_id, snap_store)
        for state in blocking:
            examples = ", ".join(summary[state][:5])
            print(f"  blocking — {state}: {len(summary[state])} place(s) (e.g. {examples})")
        if any(state in SNAP_COVERAGE_REQUERY_BY_DEFAULT for state in blocking):
            print("  Fix: python3 scripts/validate-walking-scale.py --backfill-snap-places")
        if SNAP_PLACE_STATUS_NO_SNAP in blocking:
            print(
                "  'no-snap' places cannot be fixed by re-querying — the provider has no "
                "routable point for them. Proceeding anyway is a valid choice, but it must "
                "be explicit: re-run with --allow-unknown-snap (their edges will be recorded "
                "'unknown' and will never be promoted to validated-static)."
            )
        return 1

    if args.allow_unknown_snap and summary[SNAP_PLACE_STATUS_NO_SNAP]:
        print(
            f"NOTE: proceeding with --allow-unknown-snap over "
            f"{len(summary[SNAP_PLACE_STATUS_NO_SNAP])} 'no-snap' place(s); every edge "
            "touching one is recorded 'unknown' and stays un-promotable."
        )

    # Real pacing, not 429-driven backoff: every Directions attempt (retries included)
    # goes through this limiter — see ors_client.RateLimiter.
    limiter = directions_rate_limiter(args.directions_per_minute)

    existing = load_existing_scale_results()
    existing_by_key = {(r["fromId"], r["toId"]): r for r in existing}
    results = dict(existing_by_key)
    manifest_keys = {(e["fromId"], e["toId"]) for e in manifest["edges"]}
    queried, skipped, succeeded, failed = 0, 0, 0, 0

    for edge in resolved:
        key = (edge["fromId"], edge["toId"])
        cached = existing_by_key.get(key)
        if cached and cached.get("status") == "validated" and not args.refresh:
            skipped += 1
            continue

        queried += 1
        verified_at = utc_now_iso()
        outcome, error = query_ors_with_retry(
            api_key, edge["fromPlace"], edge["toPlace"], rate_limiter=limiter
        )
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

        # Durable after EVERY edge: an interruption here (crash, ^C, quota cut-off)
        # costs at most this one in-flight edge, never the ones already answered.
        write_checkpoint(results, manifest_keys)

    final_results = ordered_results(results, manifest_keys)
    write_json(SCALE_RESULTS_PATH, final_results)
    published = publish_app_copy(final_results, manifest_keys)

    print(
        f"OK: {queried} queried ({succeeded} validated, {failed} failed), "
        f"{skipped} skipped (cached). Wrote {len(final_results)} result(s) to {SCALE_RESULTS_PATH}."
    )
    if published:
        print(f"  Batch complete ({len(manifest_keys)}/{len(manifest_keys)} edges) — synced {APP_SCALE_RESULTS_PATH}.")
    else:
        print(
            f"  Batch incomplete ({len(final_results)}/{len(manifest_keys)} edges) — "
            f"{APP_SCALE_RESULTS_PATH} deliberately NOT written. Re-run to resume; "
            "already-answered edges are not re-queried."
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
    manifest = load_json(Path(args.manifest)) if Path(args.manifest).exists() else None
    published = False
    if manifest is not None:
        published = publish_app_copy(existing, {(e["fromId"], e["toId"]) for e in manifest["edges"]})
    print(f"OK: recombined endpointSnapping for {len(existing)} result(s), {changed} changed.")
    if not published:
        print(
            f"  Results do not yet cover the whole manifest — {APP_SCALE_RESULTS_PATH} "
            "deliberately NOT written (no partial publish to the app)."
        )
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backfill-snap-places", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--recombine-snapping", action="store_true")
    parser.add_argument("--refresh", action="store_true", help="Re-query every scale edge, including cached validated ones.")
    parser.add_argument("--refresh-snap-places", action="store_true", help="Re-snap every place, including already-current ones.")
    parser.add_argument(
        "--retry-no-snap",
        action="store_true",
        help="Also re-query places the provider already answered 'no routable point' for "
        "(skipped by default — re-asking spends quota to learn nothing unless the radius "
        "or the dataset changed).",
    )
    parser.add_argument(
        "--allow-unknown-snap",
        action="store_true",
        help="Proceed with --execute even though some places are 'no-snap'. Their edges are "
        "recorded 'unknown' and can never be promoted to validated-static. Missing/stale/"
        "request-error places still block regardless of this flag — run "
        "--backfill-snap-places for those.",
    )
    parser.add_argument(
        "--directions-per-minute",
        type=int,
        default=ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED,
        help="Directions attempts per minute the rate limiter enforces, retries included "
        f"(default: {ORS_DIRECTIONS_PER_MINUTE_LIMIT_DOCUMENTED}, openrouteservice's "
        "documented community-plan ceiling). Lower it for an account whose plan is smaller; "
        "0 disables pacing entirely.",
    )
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
