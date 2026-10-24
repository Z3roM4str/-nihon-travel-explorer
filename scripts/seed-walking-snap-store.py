#!/usr/bin/env python3
"""Phase 3B2B-A: seed the per-place Snap store from Phase 3B2A's already-measured data.

Usage:
    python3 scripts/seed-walking-snap-store.py [--data-dir data]

Makes NO network request. Phase 3B2A's `--backfill-snapping` already made one real,
batched Snap-endpoint request that measured 35 unique places (see
docs/WALKING_PILOT.md). Each validated pilot result's `endpointSnapping` carries the
two place-level measurements that went into it (`fromSnapMeters` for `fromId`,
`toSnapMeters` for `toId`). Since snapping is a property of a coordinate, not of an
edge or a direction, those measurements are re-derivable per place without querying
anything again — this script does exactly that, and cross-checks that a place appearing
in more than one pilot edge always yields the same measurement (a real inconsistency
here would mean the coordinate changed between measurements, or a data-entry error —
either way, refuse rather than silently pick one).

Writes data/logistics/walking-snap-places.json (see logistics_common.py's
build_snap_place_entry / SNAP_PLACES_PATH for the schema). Idempotent: re-running this
against an unchanged walking-pilot-results.json reproduces the same store.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    ORS_PROFILE_FOOT_WALKING,
    ORS_PROVIDER,
    ORS_SNAP_MAX_RADIUS_METERS,
    RESULTS_PATH,
    SNAP_PLACES_PATH,
    SNAP_PLACES_VERSION,
    SNAP_PLACE_STATUSES,
    SNAP_PLACE_STATUS_RESOLVED,
    build_snap_place_entry,
    load_json,
    load_places,
    places_by_id,
    write_json,
)
from ors_client import ATTRIBUTION  # noqa: E402


def extract_measurements(results):
    """Returns {placeId: (snapped_distance_m, verifiedAt)} from every validated pilot
    result's endpointSnapping, raising if the same place ever carries two different
    measurements (which would mean reuse is unsafe, not just inconvenient).
    """
    by_place = {}
    for result in results:
        if result.get("status") != "validated":
            continue
        snapping = result.get("endpointSnapping")
        if not snapping or "assessment" not in snapping:
            continue  # not yet backfilled; nothing to seed from this result
        pairs = ((result["fromId"], snapping["fromSnapMeters"]), (result["toId"], snapping["toSnapMeters"]))
        for place_id, snap_m in pairs:
            if place_id in by_place and by_place[place_id][0] != snap_m:
                raise ValueError(
                    f"inconsistent snap measurement for {place_id}: "
                    f"{by_place[place_id][0]} vs {snap_m} across different pilot edges — "
                    "snapping should be a stable property of the coordinate; refusing to "
                    "silently pick one"
                )
            by_place[place_id] = (snap_m, result["verifiedAt"])
    return by_place


def build_snap_store(data_dir, results_path=RESULTS_PATH):
    places = load_places(data_dir)
    by_id = places_by_id(places)
    results_path = Path(results_path)
    results = load_json(results_path) if results_path.exists() else []
    measurements = extract_measurements(results)

    entries = {}
    for place_id, (snap_m, verified_at) in sorted(measurements.items()):
        place = by_id.get(place_id)
        if place is None:
            raise ValueError(f"pilot result references unknown place id {place_id!r}")
        # Every seeded measurement is a real number Phase 3B2A's Snap request actually
        # returned, so these are all "resolved" — build_snap_place_entry would refuse a
        # null paired with that status, which is the point.
        entries[place_id] = build_snap_place_entry(
            place,
            snap_m,
            radius=ORS_SNAP_MAX_RADIUS_METERS,
            provider=ORS_PROVIDER,
            profile=ORS_PROFILE_FOOT_WALKING,
            verified_at=verified_at,
            status=SNAP_PLACE_STATUS_RESOLVED,
        )
        entries[place_id]["attribution"] = ATTRIBUTION
        entries[place_id]["source"] = "seeded-from-phase-3b2a-pilot-results"

    return {
        "snapVersion": SNAP_PLACES_VERSION,
        "provider": ORS_PROVIDER,
        "profile": ORS_PROFILE_FOOT_WALKING,
        "places": entries,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--out", default=str(SNAP_PLACES_PATH))
    parser.add_argument("--results", default=str(RESULTS_PATH))
    args = parser.parse_args()

    store = build_snap_store(Path(args.data_dir), Path(args.results))
    write_json(Path(args.out), store)
    counts = {status: 0 for status in SNAP_PLACE_STATUSES}
    for entry in store["places"].values():
        counts[entry["status"]] += 1
    breakdown = " ".join(f"{status}={counts[status]}" for status in SNAP_PLACE_STATUSES)
    print(
        f"OK: seeded {len(store['places'])} place(s) into {args.out} from existing "
        f"Phase 3B2A pilot results — no new network request. {breakdown}."
    )


if __name__ == "__main__":
    main()
