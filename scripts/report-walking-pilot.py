#!/usr/bin/env python3
"""Comparison report for the Phase 3B2A walking-validation pilot.

Usage:
    python3 scripts/report-walking-pilot.py [--data-dir data]

Reads the manifest, nearby.json (for the estimated baseline) and
data/logistics/walking-pilot-results.json (for the routed values), and prints:
  - per-edge estimated vs routed distance/minutes, absolute difference, and ratio;
  - pilot-only aggregate statistics (median/mean/min/max distance and minute ratios);
  - the top 5 outliers by distance ratio and by absolute minute difference.

This is pilot analysis over N=24 edges, not a claim about the other ~308 "A pie"
relations nearby.json still carries as estimates. Nothing here writes to nearby.json,
places.json, or any TransferEdge — it only reads the two artifacts this pipeline
already produced.

Exits 1 with a clear message if walking-pilot-results.json does not exist yet (the
live pilot has not been run) rather than fabricating a report from nothing.
"""
import argparse
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logistics_common import (  # noqa: E402
    MANIFEST_PATH,
    RESULTS_PATH,
    load_json,
    load_nearby,
    load_places,
    nearby_by_directed_key,
    places_by_id,
)


def build_comparisons(manifest, nearby, results, places):
    by_directed = nearby_by_directed_key(nearby)
    by_id = places_by_id(places)
    results_by_key = {(r["fromId"], r["toId"]): r for r in results}

    comparisons = []
    for edge in manifest["edges"]:
        key = (edge["fromId"], edge["toId"])
        relation = by_directed.get(key)
        result = results_by_key.get(key)
        if relation is None:
            continue

        estimated_km = relation["Distancia km"]
        estimated_min = relation["Min aprox."]

        entry = {
            "fromId": key[0],
            "toId": key[1],
            "category": edge.get("category"),
            "fromHub": by_id[key[0]]["hub"],
            "fromCluster": by_id[key[0]]["cluster"],
            "estimatedDistanceKm": estimated_km,
            "estimatedMinutes": estimated_min,
            "status": result["status"] if result else "not-run",
        }

        if result and result.get("status") == "validated":
            routed_km = result["distance"]["meters"] / 1000.0
            routed_min = result["minutes"]["minMinutes"]
            snapping = result.get("endpointSnapping")
            # No resolved assessment at all (shouldn't happen once backfilled, but never
            # assumed clean) counts as "unknown", exactly like an explicit unknown does.
            snap_assessment = snapping.get("assessment") if snapping and "assessment" in snapping else "unknown"
            entry.update(
                {
                    "routedDistanceKm": routed_km,
                    "routedMinutes": routed_min,
                    "distanceAbsDiffKm": abs(routed_km - estimated_km),
                    "distanceRatio": (routed_km / estimated_km) if estimated_km else None,
                    "minutesAbsDiff": abs(routed_min - estimated_min),
                    "minutesRatio": (routed_min / estimated_min) if estimated_min else None,
                    "endpointSnapping": snapping,
                    "snapAssessment": snap_assessment,
                }
            )
        comparisons.append(entry)
    return comparisons


def stats_of(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return {
        "median": statistics.median(values),
        "mean": statistics.mean(values),
        "min": min(values),
        "max": max(values),
    }


def print_report(comparisons):
    validated = [c for c in comparisons if c["status"] == "validated"]
    not_validated = [c for c in comparisons if c["status"] != "validated"]
    clean = [c for c in validated if c["snapAssessment"] == "clean"]
    significant = [c for c in validated if c["snapAssessment"] == "significant"]
    unknown = [c for c in validated if c["snapAssessment"] == "unknown"]
    comparable = clean  # only a "clean" assessment makes a routed distance comparable

    print(f"Pilot comparison: {len(comparisons)} manifest edges, {len(validated)} validated, "
          f"{len(not_validated)} not validated ({', '.join(sorted({c['status'] for c in not_validated})) or 'none'}).")
    print(f"Endpoint-snapping distribution: clean={len(clean)} significant={len(significant)} "
          f"unknown={len(unknown)}.\n")

    print("Per-edge (validated only):")
    for c in sorted(validated, key=lambda c: (c["fromId"], c["toId"])):
        flag = ""
        if c["snapAssessment"] == "significant":
            flag = " [EXCLUDED: significant endpoint snapping]"
        elif c["snapAssessment"] == "unknown":
            flag = " [EXCLUDED: endpoint snapping unknown]"
        print(
            f"  [{c['category']}] {c['fromId']}->{c['toId']} ({c['fromHub']}/{c['fromCluster']}): "
            f"estimated {c['estimatedDistanceKm']}km/{c['estimatedMinutes']}min vs "
            f"routed {c['routedDistanceKm']:.3f}km/{c['routedMinutes']}min "
            f"(distance ratio {c['distanceRatio']:.2f}, minute ratio {c['minutesRatio']:.2f}){flag}"
        )

    if significant:
        print(
            f"\n{len(significant)} edge(s) excluded — significant endpoint snapping: their "
            "routed distance is not directly comparable to the distance between the original "
            "coordinates, because at least one endpoint snapped significantly onto the road "
            "network (see docs/WALKING_PILOT.md). Listed here, not silently dropped:"
        )
        for c in sorted(significant, key=lambda c: (c["fromId"], c["toId"])):
            s = c["endpointSnapping"]
            print(
                f"  {c['fromId']}->{c['toId']}: fromSnapMeters={s['fromSnapMeters']} "
                f"toSnapMeters={s['toSnapMeters']} (routed distance {c['routedDistanceKm']*1000:.1f} m)"
            )

    if unknown:
        print(
            f"\n{len(unknown)} edge(s) excluded — endpoint snapping unknown (never measured, "
            "or the Snap diagnostic couldn't resolve a point/failed): comparability to the "
            "original coordinates was never established, so these are excluded exactly like a "
            "'significant' result, not assumed clean:"
        )
        for c in sorted(unknown, key=lambda c: (c["fromId"], c["toId"])):
            s = c.get("endpointSnapping") or {}
            reason = s.get("reason", "no endpointSnapping recorded")
            print(f"  {c['fromId']}->{c['toId']}: {reason}")

    if not comparable:
        print("\nNo comparable (clean) validated results — pilot findings below are empty. "
              "This is not a general statement about walking-edge accuracy.")
        return

    dist_ratio_stats = stats_of([c["distanceRatio"] for c in comparable])
    minute_ratio_stats = stats_of([c["minutesRatio"] for c in comparable])

    print("\nPilot findings (N={}, clean endpoint-snapping assessment only; NOT a general "
          "claim about all 'A pie' edges):".format(len(comparable)))
    print(f"  distance ratio (routed/estimated): median={dist_ratio_stats['median']:.3f} "
          f"mean={dist_ratio_stats['mean']:.3f} min={dist_ratio_stats['min']:.3f} max={dist_ratio_stats['max']:.3f}")
    print(f"  minute ratio (routed/estimated):   median={minute_ratio_stats['median']:.3f} "
          f"mean={minute_ratio_stats['mean']:.3f} min={minute_ratio_stats['min']:.3f} max={minute_ratio_stats['max']:.3f}")

    print("\nTop 5 outliers by distance ratio (routed/estimated, farthest from 1.0):")
    by_dist_outlier = sorted(comparable, key=lambda c: abs(c["distanceRatio"] - 1), reverse=True)[:5]
    for c in by_dist_outlier:
        print(
            f"  {c['fromId']}->{c['toId']} ({c['fromHub']}/{c['fromCluster']}): "
            f"estimated {c['estimatedDistanceKm']}km, routed {c['routedDistanceKm']:.3f}km, "
            f"ratio {c['distanceRatio']:.2f}"
        )

    print("\nTop 5 outliers by absolute minute difference:")
    by_minute_outlier = sorted(comparable, key=lambda c: c["minutesAbsDiff"], reverse=True)[:5]
    for c in by_minute_outlier:
        print(
            f"  {c['fromId']}->{c['toId']} ({c['fromHub']}/{c['fromCluster']}): "
            f"estimated {c['estimatedMinutes']}min, routed {c['routedMinutes']}min, "
            f"abs diff {c['minutesAbsDiff']}min"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--results", default=str(RESULTS_PATH))
    args = parser.parse_args()

    results = load_json(Path(args.results)) if Path(args.results).exists() else []
    if not results:
        print(f"No results in {args.results} — the live pilot has not been run yet.")
        print("Run: ORS_API_KEY=<key> python3 scripts/validate-walking-pilot.py --execute")
        return 1

    manifest = load_json(Path(args.manifest))
    nearby = load_nearby(args.data_dir)
    places = load_places(args.data_dir)

    comparisons = build_comparisons(manifest, nearby, results, places)
    print_report(comparisons)
    return 0


if __name__ == "__main__":
    sys.exit(main())
