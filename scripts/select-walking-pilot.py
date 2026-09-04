#!/usr/bin/env python3
"""Deterministic selection of the 24-edge Phase 3B2A walking-validation pilot sample.

Usage:
    python3 scripts/select-walking-pilot.py [--data-dir data] [--out PATH]

Reads the current data/nearby.json and data/places.json (never modifies them) and
writes data/logistics/walking-pilot-manifest.json: the 24 directed "A pie" edges the
pilot will validate against real routing, plus the algorithm that chose them.

This step makes no network calls and requires no API key — selection is a pure
function of the current dataset. Re-running it against an unchanged dataset produces
byte-identical output; running it after a workbook update reselects deterministically
from the new data.

Why a separate script from validate-walking-pilot.py: selecting the sample and
validating it against a routing provider are different operations with different
failure modes (one is offline and reproducible, the other calls a paid, rate-limited
external API). Mixing them would make it hard to tell "the sample changed" from
"the routing result changed".
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    MANIFEST_PATH,
    PILOT_EDGE_COUNT,
    WALKING_MODE_RAW,
    dataset_digest,
    load_nearby,
    load_places,
    places_by_id,
    write_json,
)

# Hubs known to carry "A pie" relations today (see docs/LOGISTICS.md). Not a general
# hub catalogue — only used to spread category E across the hubs this mode actually has.
KNOWN_WALKING_HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa"]

CATEGORY_A = "A-very-short"  # distance < 0.5 km, 4 edges
CATEGORY_B = "B-short"  # 0.5 <= distance < 1.0 km, 5 edges
CATEGORY_C = "C-medium"  # 1.0 <= distance < 2.0 km, 5 edges
CATEGORY_D = "D-speed-anomaly"  # potentially problematic, 6 edges
CATEGORY_E = "E-geo-diversity"  # additional geographic diversity, 4 edges

SELECTION_METHOD_DESCRIPTION = (
    "Deterministic, code-driven selection over the current 332 'A pie' nearby.json "
    "relations. No manual cherry-picking: every edge is chosen by an explicit, "
    "reproducible rule so re-running this script against the same dataset yields the "
    "same 24 edges, and the rules are documented rather than the picks."
)

CATEGORY_DESCRIPTIONS = {
    CATEGORY_A: (
        "distanceKm < 0.5. From this bucket (sorted by distanceKm, then fromId, then "
        "toId), 4 edges are picked at evenly spaced ranks, so the pick spans the "
        "bucket's low/mid/high range instead of clustering at the smallest values."
    ),
    CATEGORY_B: (
        "0.5 <= distanceKm < 1.0. Same evenly-spaced-rank rule as category A, 5 edges."
    ),
    CATEGORY_C: (
        "distanceKm >= 1.0 (the current 'A pie' maximum is 1.79 km, so there is no "
        "upper bound in practice). Same evenly-spaced-rank rule, 5 edges."
    ),
    CATEGORY_D: (
        "The 6 remaining edges with the most extreme implied walking speed "
        "(distanceKm / (minutes/60)): the 3 lowest and the 3 highest. Low-speed "
        "edges are dominated by nearby.json's minutes floor on very short distances "
        "(a likely near-duplicate-point case); high-speed edges are the ones whose "
        "straight-line haversine distance is most likely to understate a real "
        "walking path. 'Problematic' is defined by this objective, code-computed "
        "criterion — never by manually picking cases expected to look bad or good."
    ),
    CATEGORY_E: (
        "4 edges chosen to spread the sample across hubs: for each of the 4 slots, "
        "the least-represented hub so far (tie-broken alphabetically) contributes its "
        "smallest-id remaining edge from a cluster not yet touched by the sample (or, "
        "if none, its smallest-id remaining edge at all). This is what guarantees the "
        "final 24 touch all 4 hubs that currently have 'A pie' relations (Tokio, "
        "Kioto, Osaka, Okinawa) rather than letting whichever hub dominates the A-D "
        "picks dominate the whole sample."
    ),
}


def enrich(relation, by_id):
    from_id, to_id = relation["Desde ID"], relation["Hacia ID"]
    distance_km = relation["Distancia km"]
    minutes = relation["Min aprox."]
    return {
        "fromId": from_id,
        "toId": to_id,
        "distanceKm": distance_km,
        "minutes": minutes,
        "impliedSpeedKmh": (distance_km / (minutes / 60.0)) if minutes else None,
        "fromHub": by_id[from_id]["hub"],
        "fromCluster": by_id[from_id]["cluster"],
    }


def edge_key(edge):
    return (edge["fromId"], edge["toId"])


def evenly_spaced(sorted_list, k):
    n = len(sorted_list)
    if k >= n:
        return list(sorted_list)
    idxs = sorted({round(i * (n - 1) / (k - 1)) for i in range(k)})
    i = 0
    while len(idxs) < k:
        if i not in idxs:
            idxs.append(i)
        i += 1
    idxs = sorted(idxs)[:k]
    return [sorted_list[i] for i in idxs]


def select_pilot_edges(places, nearby):
    by_id = places_by_id(places)
    walking = [r for r in nearby if r["Modo"] == WALKING_MODE_RAW]
    pool = [enrich(r, by_id) for r in walking]

    used = set()

    def take(bucket, k, category):
        candidates = sorted(
            (e for e in bucket if edge_key(e) not in used),
            key=lambda e: (e["distanceKm"], e["fromId"], e["toId"]),
        )
        picked = evenly_spaced(candidates, k)
        for e in picked:
            used.add(edge_key(e))
            e["category"] = category
        return picked

    bucket_a = [e for e in pool if e["distanceKm"] < 0.5]
    bucket_b = [e for e in pool if 0.5 <= e["distanceKm"] < 1.0]
    bucket_c = [e for e in pool if e["distanceKm"] >= 1.0]

    selected = []
    selected += take(bucket_a, 4, CATEGORY_A)
    selected += take(bucket_b, 5, CATEGORY_B)
    selected += take(bucket_c, 5, CATEGORY_C)

    remaining = [e for e in pool if edge_key(e) not in used]
    by_speed = sorted(remaining, key=lambda e: (e["impliedSpeedKmh"], e["fromId"], e["toId"]))
    speed_anomalies = by_speed[:3] + by_speed[-3:]
    for e in speed_anomalies:
        used.add(edge_key(e))
        e["category"] = CATEGORY_D
    selected += speed_anomalies

    remaining = [e for e in pool if edge_key(e) not in used]
    covered_clusters = {(e["fromHub"], e["fromCluster"]) for e in selected}
    hub_counts = {h: 0 for h in KNOWN_WALKING_HUBS}
    for e in selected:
        hub_counts[e["fromHub"]] = hub_counts.get(e["fromHub"], 0) + 1

    diversity_picks = []
    for _ in range(4):
        hub_order = sorted(KNOWN_WALKING_HUBS, key=lambda h: (hub_counts.get(h, 0), h))
        picked = None
        for hub in hub_order:
            new_cluster = sorted(
                (
                    e
                    for e in remaining
                    if edge_key(e) not in used
                    and e["fromHub"] == hub
                    and (e["fromHub"], e["fromCluster"]) not in covered_clusters
                ),
                key=lambda e: (e["fromCluster"], e["fromId"], e["toId"]),
            )
            any_from_hub = sorted(
                (e for e in remaining if edge_key(e) not in used and e["fromHub"] == hub),
                key=lambda e: (e["fromCluster"], e["fromId"], e["toId"]),
            )
            candidates = new_cluster or any_from_hub
            if candidates:
                picked = candidates[0]
                break
        if picked is None:
            fallback = sorted(
                (e for e in remaining if edge_key(e) not in used),
                key=lambda e: (e["fromId"], e["toId"]),
            )
            picked = fallback[0]
        used.add(edge_key(picked))
        picked["category"] = CATEGORY_E
        covered_clusters.add((picked["fromHub"], picked["fromCluster"]))
        hub_counts[picked["fromHub"]] = hub_counts.get(picked["fromHub"], 0) + 1
        diversity_picks.append(picked)
    selected += diversity_picks

    assert len(selected) == PILOT_EDGE_COUNT, f"expected {PILOT_EDGE_COUNT}, got {len(selected)}"
    assert len({edge_key(e) for e in selected}) == PILOT_EDGE_COUNT, "duplicate edge selected"
    return selected


def reason_for(edge):
    if edge["category"] == CATEGORY_D:
        return f"implied speed {edge['impliedSpeedKmh']:.2f} km/h (extreme among 'A pie' edges)"
    return f"distanceKm={edge['distanceKm']} in category {edge['category']}"


def build_manifest(data_dir):
    places = load_places(data_dir)
    nearby = load_nearby(data_dir)
    walking = [r for r in nearby if r["Modo"] == WALKING_MODE_RAW]
    selected = select_pilot_edges(places, nearby)
    selected_sorted = sorted(selected, key=lambda e: (e["fromId"], e["toId"]))

    return {
        "pilotVersion": 1,
        "selectionMethod": {
            "description": SELECTION_METHOD_DESCRIPTION,
            "categories": CATEGORY_DESCRIPTIONS,
        },
        "sourceDatasetContext": {
            "nearbyRelationCount": len(nearby),
            "walkingRelationCount": len(walking),
            # A content hash of the dataset itself, not the git HEAD SHA: this
            # manifest must be byte-identical across two runs against the same
            # data/places.json + data/nearby.json, regardless of which commit is
            # checked out. See dataset_digest()'s docstring in logistics_common.py.
            "datasetDigest": dataset_digest(data_dir),
        },
        "edges": [
            {
                "fromId": e["fromId"],
                "toId": e["toId"],
                "category": e["category"],
                "reason": reason_for(e),
            }
            for e in selected_sorted
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="data", help="Directory holding places.json/nearby.json")
    parser.add_argument("--out", default=str(MANIFEST_PATH), help="Manifest output path")
    args = parser.parse_args()

    manifest = build_manifest(Path(args.data_dir))
    write_json(Path(args.out), manifest)
    print(f"OK: wrote {len(manifest['edges'])} pilot edges to {args.out}")


if __name__ == "__main__":
    main()
