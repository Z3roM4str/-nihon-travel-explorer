#!/usr/bin/env python3
"""Deterministic Phase 4K photography coverage-strategy analysis.

Pure/offline analysis. Reads only canonical data and the committed image assets; it
never downloads anything, never changes photography metadata, blobs or runtime, and
never selects a fixture for execution on its own authority.

It reproduces the live coverage state, measures the real per-batch asset evidence from
the append-only registry, and evaluates every candidate grade scope against every
candidate tranche size using the same coverage-balanced policy Phase 4I established,
extended to the current 15-ID carried fail-closed set.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES_PATH = ROOT / "data" / "places.json"
CANONICAL_PATH = ROOT / "data" / "visual" / "photography-metadata.json"
ASSET_ROOT = ROOT / "app" / "public"

# All 15 carried fail-closed IDs as of the Phase 4K base, by the phase that closed them.
CARRIED_FAILED_CLOSED_IDS = {
    "JP-033", "JP-126", "JP-203", "JP-204",              # Phase 4D
    "JP-050", "JP-195",                                  # Phase 4F
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",    # Phase 4H
    "JP-120", "JP-211", "JP-041", "JP-168",              # Phase 4J
}

# Accepted-tranche boundaries in the append-only canonical registry.
BATCH_SLICES = (
    ("Phase 4A", 0, 24),
    ("Phase 4D", 24, 36),
    ("Phase 4F", 36, 58),
    ("Phase 4H", 58, 85),
    ("Phase 4J", 85, 113),
)
# Batches whose asset evidence is used for projection (Phase 4A predates the current
# pipeline's resize/quality contract and is reported but excluded from the mean).
PROJECTION_BATCHES = ("Phase 4D", "Phase 4F", "Phase 4H", "Phase 4J")

GRADE_ORDER = ("S", "A", "B", "C", "D")
GRADE_PRIORITY = {grade: index for index, grade in enumerate(GRADE_ORDER)}
TEMPORAL_CATEGORIES = {"🎆 Eventos", "🐋 Fauna y experiencias estacionales"}
TEMPORAL_NAME_TOKENS = ("festival", "tournament", "animejapan")
MIB = 1024 * 1024

SCOPES = {
    "A-only": ("A",),
    "A+B": ("A", "B"),
    "A+B+C+D": ("A", "B", "C", "D"),
}
TRANCHE_SIZES = (16, 24, 32, 40)

# The Phase 4K decision: one more bounded A+B coverage-balanced tranche of 32.
RECOMMENDED_SCOPE = ("A", "B")
RECOMMENDED_TRANCHE_SIZE = 32
SUCCESSOR_FIXTURE_PATH = ROOT / "data" / "visual" / "phase4k-successor-fixture.json"


def utf16_key(value):
    """Stable ECMAScript-like code-unit ordering for deterministic tiebreaks."""
    return value.encode("utf-16-be")


def is_temporal_risk(place):
    name = place.get("name", "").casefold()
    return (
        place.get("category") in TEMPORAL_CATEGORIES
        or any(token in name for token in TEMPORAL_NAME_TOKENS)
    )


def load_inputs():
    places_doc = json.loads(PLACES_PATH.read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
    return places, photography["images"]


def eligible_places(places, covered, allowed_grades, excluded=None):
    """Uncovered places of the given grades, minus the carried fail-closed set.

    ``excluded`` defaults to the current 15-ID set; it is a parameter so the policy can
    be replayed against a historical exclusion set to prove it is unchanged.
    """
    excluded = CARRIED_FAILED_CLOSED_IDS if excluded is None else excluded
    return [
        place
        for place in places
        if place["grade"] in allowed_grades
        and place["id"] not in covered
        and place["id"] not in excluded
    ]


def allocate_hub_quotas(eligible, tranche_size):
    """Phase 4I allocation: one seat per nonempty hub, then largest remainder."""
    hubs = sorted({p["hub"] for p in eligible}, key=utf16_key)
    if tranche_size < len(hubs):
        raise ValueError("tranche is too small to give one seat to every eligible hub")

    counts = {hub: sum(1 for p in eligible if p["hub"] == hub) for hub in hubs}
    quotas = {hub: 1 for hub in hubs}
    remaining = tranche_size - len(hubs)
    residual_total = sum(max(counts[hub] - 1, 0) for hub in hubs)
    if remaining and residual_total <= 0:
        raise ValueError("not enough residual candidates to fill tranche")

    remainders = []
    floor_assigned = 0
    for hub in hubs:
        residual = max(counts[hub] - 1, 0)
        raw = remaining * residual / residual_total if residual_total else 0
        floor = int(raw)
        quotas[hub] += floor
        floor_assigned += floor
        remainders.append((raw - floor, hub))

    remainders.sort(key=lambda item: (-item[0], utf16_key(item[1])))
    for _remainder, hub in remainders[: remaining - floor_assigned]:
        quotas[hub] += 1

    if sum(quotas.values()) != tranche_size:
        raise AssertionError("hub quotas do not sum to tranche size")
    if any(quotas[hub] > counts[hub] for hub in hubs):
        raise AssertionError("hub quota exceeds eligible candidates")
    return hubs, counts, quotas


def select_batch(places, photography_records, allowed_grades, tranche_size, excluded=None):
    """Coverage-balanced selection, parameterised by grade scope and tranche size."""
    covered = {record["placeId"] for record in photography_records}
    eligible = eligible_places(places, covered, allowed_grades, excluded)
    if len(eligible) < tranche_size:
        raise ValueError(
            f"not enough eligible places: {len(eligible)} < {tranche_size}"
        )

    by_id = {place["id"]: place for place in places}
    photographed_by_category = Counter(
        by_id[pid]["category"] for pid in covered if pid in by_id
    )
    eligible_by_category = Counter(place["category"] for place in eligible)

    hubs, counts, quotas = allocate_hub_quotas(eligible, tranche_size)
    pools = {hub: [p for p in eligible if p["hub"] == hub] for hub in hubs}
    selected_in_hub = {hub: 0 for hub in hubs}
    selected_by_category = Counter()
    selected = []

    while len(selected) < tranche_size:
        progressed = False
        for hub in hubs:
            if len(selected) >= tranche_size:
                break
            if selected_in_hub[hub] >= quotas[hub]:
                continue

            def priority(place):
                category = place["category"]
                return (
                    selected_by_category[category],
                    photographed_by_category[category],
                    GRADE_PRIORITY[place["grade"]],
                    1 if is_temporal_risk(place) else 0,
                    eligible_by_category[category],
                    utf16_key(place["id"]),
                )

            pools[hub].sort(key=priority)
            if not pools[hub]:
                raise AssertionError(f"hub {hub!r} ran out of candidates")
            pick = pools[hub].pop(0)
            selected.append(pick)
            selected_in_hub[hub] += 1
            selected_by_category[pick["category"]] += 1
            progressed = True

        if not progressed:
            raise AssertionError("selector stalled before filling tranche")

    return {
        "version": 1,
        "trancheSize": tranche_size,
        "gradeScope": list(allowed_grades),
        "eligibleCount": len(eligible),
        "hubEligibleCounts": counts,
        "hubQuotas": quotas,
        "gradeCounts": dict(sorted(Counter(p["grade"] for p in selected).items())),
        "distinctCategoryCount": len({p["category"] for p in selected}),
        "places": [
            {
                "placeId": p["id"],
                "hub": p["hub"],
                "grade": p["grade"],
                "name": p["name"],
                "category": p["category"],
                "temporalRisk": is_temporal_risk(p),
                "intendedImageCount": 1,
            }
            for p in selected
        ],
    }


def asset_evidence(images):
    """Measured bytes per accepted tranche, read from the committed WebP assets."""
    batches = {}
    for label, start, end in BATCH_SLICES:
        records = images[start:end]
        total = sum((ASSET_ROOT / r["assetPath"]).stat().st_size for r in records)
        batches[label] = {
            "accepted": len(records),
            "bytes": total,
            "meanBytes": total / len(records),
        }
    projection = [batches[label] for label in PROJECTION_BATCHES]
    accepted = sum(b["accepted"] for b in projection)
    total = sum(b["bytes"] for b in projection)
    means = [b["meanBytes"] for b in projection]
    return {
        "batches": batches,
        "projectionBatches": list(PROJECTION_BATCHES),
        "combinedAccepted": accepted,
        "combinedBytes": total,
        "weightedMeanBytes": total / accepted,
        "minBatchMeanBytes": min(means),
        "maxBatchMeanBytes": max(means),
    }


def coverage_state(places, images):
    covered = {r["placeId"] for r in images}
    by_grade = {}
    for grade in GRADE_ORDER:
        members = [p for p in places if p["grade"] == grade]
        hit = sum(1 for p in members if p["id"] in covered)
        by_grade[grade] = {"covered": hit, "total": len(members),
                           "uncovered": len(members) - hit}
    by_hub = {}
    for hub in sorted({p["hub"] for p in places}, key=utf16_key):
        members = [p for p in places if p["hub"] == hub]
        hit = sum(1 for p in members if p["id"] in covered)
        by_hub[hub] = {"covered": hit, "total": len(members)}
    by_category = {}
    for category in sorted({p["category"] for p in places}, key=utf16_key):
        members = [p for p in places if p["category"] == category]
        hit = sum(1 for p in members if p["id"] in covered)
        by_category[category] = {"covered": hit, "total": len(members)}
    return {
        "totalPlaces": len(places),
        "covered": len(covered),
        "uncovered": len(places) - len(covered),
        "maxPhotosPerPlace": max(Counter(r["placeId"] for r in images).values()),
        "byGrade": by_grade,
        "byHub": by_hub,
        "zeroPhotoCategories": sorted(
            (c for c, v in by_category.items() if v["covered"] == 0), key=utf16_key
        ),
        "eligibleUniverses": {
            name: len(eligible_places(places, covered, grades))
            for name, grades in SCOPES.items()
        },
        "failClosed": {
            "count": len(CARRIED_FAILED_CLOSED_IDS),
            "allUncovered": all(i not in covered for i in CARRIED_FAILED_CLOSED_IDS),
            "ids": sorted(CARRIED_FAILED_CLOSED_IDS, key=utf16_key),
        },
    }


def build_report():
    places, images = load_inputs()
    state = coverage_state(places, images)
    evidence = asset_evidence(images)
    wm = evidence["weightedMeanBytes"]
    lo = evidence["minBatchMeanBytes"]
    hi = evidence["maxBatchMeanBytes"]

    matrix = {}
    for scope_name, grades in SCOPES.items():
        covered = {r["placeId"] for r in images}
        eligible_n = len(eligible_places(places, covered, grades))
        rows = {}
        for size in TRANCHE_SIZES:
            if size > eligible_n:
                rows[str(size)] = {"feasible": False,
                                   "reason": f"only {eligible_n} eligible places"}
                continue
            fixture = select_batch(places, images, grades, size)
            max_cov = state["covered"] + size
            rows[str(size)] = {
                "feasible": True,
                "eligibleCount": eligible_n,
                "gradeCounts": fixture["gradeCounts"],
                "hubQuotas": fixture["hubQuotas"],
                "distinctCategoryCount": fixture["distinctCategoryCount"],
                "temporalRiskCount": sum(1 for p in fixture["places"] if p["temporalRisk"]),
                "maxCoverage": max_cov,
                "maxCoveragePct": round(100 * max_cov / state["totalPlaces"], 1),
                "eligibleRemainingAfter": eligible_n - size,
                "projectedBytes": round(size * wm),
                "projectedMiB": round(size * wm / MIB, 2),
                "sensitivityMinMiB": round(size * lo / MIB, 2),
                "sensitivityMaxMiB": round(size * hi / MIB, 2),
                "placeIds": [p["placeId"] for p in fixture["places"]],
            }
        matrix[scope_name] = rows

    return {"state": state, "assetEvidence": evidence, "matrix": matrix}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=None, help="Write the JSON report to this path.")
    parser.add_argument(
        "--fixture-out",
        default=None,
        help="Write the recommended successor fixture to this path.",
    )
    args = parser.parse_args()

    if args.fixture_out:
        places, images = load_inputs()
        fixture = select_batch(
            places, images, RECOMMENDED_SCOPE, RECOMMENDED_TRANCHE_SIZE
        )
        Path(args.fixture_out).write_text(
            json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {args.fixture_out}")
        return

    report = build_report()
    payload = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(payload, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
