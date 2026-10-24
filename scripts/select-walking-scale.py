#!/usr/bin/env python3
"""Phase 3B2B-A: deterministic selection of the walking scale-up manifest.

Usage:
    python3 scripts/select-walking-scale.py [--data-dir data]
        [--pilot-manifest data/logistics/walking-pilot-manifest.json]
        [--out data/logistics/walking-scale-manifest.json]

Derives, from the current data/nearby.json, every directed "A pie" edge NOT already
covered by Phase 3B2A's pilot manifest, and writes
data/logistics/walking-scale-manifest.json. This is the pool Phase 3B2B would validate
against real routing in a future phase — nothing here queries a routing provider, and
nothing here executes that batch. See docs/WALKING_SCALE_PREP.md.

The edge count is never hardcoded: it is `len(all "A pie" edges) - len(pilot edges)`,
computed fresh from whatever data/nearby.json and the pilot manifest actually contain
right now. Re-running this against an unchanged dataset and an unchanged pilot manifest
reproduces the same manifest byte-for-byte (same discipline as
scripts/select-walking-pilot.py: a sha256 content digest, not a git SHA).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    MANIFEST_PATH,
    PILOT_EDGE_COUNT,
    SCALE_MANIFEST_PATH,
    WALKING_MODE_RAW,
    dataset_digest,
    load_json,
    load_nearby,
    load_places,
    sha256_of_file,
    write_json,
)

SELECTION_METHOD_DESCRIPTION = (
    "Every directed 'A pie' nearby.json relation NOT already selected by "
    "scripts/select-walking-pilot.py's Phase 3B2A manifest. This is a set "
    "difference, not a further sample: it is the entire remaining pool a future "
    "scale-up phase would validate, computed fresh from the current dataset and the "
    "committed pilot manifest, never a hardcoded count."
)


def build_scale_manifest(data_dir, pilot_manifest_path):
    places = load_places(data_dir)
    nearby = load_nearby(data_dir)
    place_ids = {p["id"] for p in places}

    walking = [r for r in nearby if r["Modo"] == WALKING_MODE_RAW]
    walking_edges = {(r["Desde ID"], r["Hacia ID"]) for r in walking}
    if len(walking_edges) != len(walking):
        raise ValueError(
            "duplicate directed 'A pie' edge in nearby.json — refuse to build a scale "
            "manifest over an already-inconsistent dataset (see validate-dataset.py)"
        )

    pilot_manifest = load_json(Path(pilot_manifest_path))
    pilot_edges = [(e["fromId"], e["toId"]) for e in pilot_manifest["edges"]]
    pilot_edge_set = set(pilot_edges)
    if len(pilot_edge_set) != len(pilot_edges):
        raise ValueError("pilot manifest itself contains a duplicate directed edge")
    if len(pilot_edge_set) != PILOT_EDGE_COUNT:
        raise ValueError(
            f"pilot manifest has {len(pilot_edge_set)} edges, expected exactly "
            f"{PILOT_EDGE_COUNT} — refusing to derive a scale manifest against an "
            "unexpected pilot scope"
        )
    if not pilot_edge_set.issubset(walking_edges):
        missing = sorted(pilot_edge_set - walking_edges)
        raise ValueError(
            f"pilot manifest references {len(missing)} edge(s) not present as 'A pie' "
            f"relations in the current dataset: {missing}"
        )

    scale_edges = sorted(walking_edges - pilot_edge_set)

    for from_id, to_id in scale_edges:
        if from_id not in place_ids or to_id not in place_ids:
            raise ValueError(f"scale edge {from_id}->{to_id}: place not found in places.json")

    return {
        "scaleVersion": 1,
        "selectionMethod": {"description": SELECTION_METHOD_DESCRIPTION},
        "sourceDatasetContext": {
            "nearbyRelationCount": len(nearby),
            "walkingRelationCount": len(walking),
            "pilotEdgeCount": len(pilot_edge_set),
            "scaleEdgeCount": len(scale_edges),
            "datasetDigest": dataset_digest(data_dir),
            "pilotManifestDigest": {
                "algorithm": "sha256",
                "value": sha256_of_file(pilot_manifest_path),
            },
        },
        "edges": [{"fromId": f, "toId": t} for f, t in scale_edges],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default="data", help="Directory holding places.json/nearby.json")
    parser.add_argument("--pilot-manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--out", default=str(SCALE_MANIFEST_PATH))
    args = parser.parse_args()

    manifest = build_scale_manifest(Path(args.data_dir), Path(args.pilot_manifest))
    write_json(Path(args.out), manifest)
    print(
        f"OK: wrote {len(manifest['edges'])} scale-up edges to {args.out} "
        f"({manifest['sourceDatasetContext']['walkingRelationCount']} total 'A pie' "
        f"relations minus {manifest['sourceDatasetContext']['pilotEdgeCount']} pilot edges)."
    )


if __name__ == "__main__":
    main()
