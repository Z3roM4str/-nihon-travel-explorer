#!/usr/bin/env python3
"""Deterministic Phase 4M photography stop-vs-continue analysis.

Pure/offline. Reads only canonical data and the committed image assets. It never
downloads anything, never changes photography metadata, blobs or runtime behaviour, and
never authorises an acquisition on its own.

Phase 4K compared grade *scopes* at a range of tranche sizes. Post-4L that test is no
longer sufficient: B has a denominator of 25 and only nine ordinarily eligible members
left, so a single accepted B photograph moves B coverage by 4.0 points against 0.68 for
A. Size alone therefore cannot tell a safe tranche from one that inverts the editorial
grade -> coverage ordering. This module evaluates the explicit **A:B mix**, reports the
exact inversion boundary, and measures how much of the remaining gap any tranche can
actually repair — breadth, hub balance and user-facing prominence, not only percentage.
"""
import argparse
import importlib.util
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES_PATH = ROOT / "data" / "places.json"
CANONICAL_PATH = ROOT / "data" / "visual" / "photography-metadata.json"
APP_PATH = ROOT / "app" / "src" / "data" / "photography-metadata.json"
ASSET_ROOT = ROOT / "app" / "public"
PHASE4K_FIXTURE_PATH = ROOT / "data" / "visual" / "phase4k-successor-fixture.json"

# All 16 carried fail-closed IDs as of the Phase 4M base, by the phase that closed them.
CARRIED_FAILED_CLOSED_IDS = {
    "JP-033", "JP-126", "JP-203", "JP-204",              # Phase 4D
    "JP-050", "JP-195",                                  # Phase 4F
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",    # Phase 4H
    "JP-120", "JP-211", "JP-041", "JP-168",              # Phase 4J
    "JP-140",                                            # Phase 4L
}

# The 15-ID set Phase 4K used, kept only to replay that gate's fixture and so prove this
# module's selector carries no policy drift. It is never used for forward analysis.
PHASE4K_FAILED_CLOSED_IDS = CARRIED_FAILED_CLOSED_IDS - {"JP-140"}

# Accepted-tranche boundaries in the append-only canonical registry.
BATCH_SLICES = (
    ("Phase 4A", 0, 24),
    ("Phase 4D", 24, 36),
    ("Phase 4F", 36, 58),
    ("Phase 4H", 58, 85),
    ("Phase 4J", 85, 113),
    ("Phase 4L", 113, 144),
)
# Phase 4A predates the current resize/quality contract: reported, excluded from the mean.
PROJECTION_BATCHES = ("Phase 4D", "Phase 4F", "Phase 4H", "Phase 4J", "Phase 4L")

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
TRANCHE_SIZES = (8, 12, 16, 24, 32)

# Pooled observed acceptance rate across 4D/4F/4H/4J/4L, computed rather than assumed.
ATTEMPTED_BY_BATCH = {
    "Phase 4D": 16, "Phase 4F": 24, "Phase 4H": 32, "Phase 4J": 32, "Phase 4L": 32,
}
# The dataset's own visitor-pressure field, used as an editorially neutral prominence
# proxy. It is read, never written, and no ranking or grade depends on it.
PROMINENCE_FIELD = "tourismLevel"
HIGH_PROMINENCE = "Extremo"


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
    """Uncovered places of the given grades, minus the carried fail-closed set."""
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
    """Coverage-balanced selection, parameterised by grade scope and tranche size.

    Byte-for-byte the Phase 4I/4K policy; only the exclusion set moves. ``replay-4k``
    proves that by regenerating the pinned Phase 4K fixture from the 113-record baseline.
    """
    covered = {record["placeId"] for record in photography_records}
    eligible = eligible_places(places, covered, allowed_grades, excluded)
    if len(eligible) < tranche_size:
        raise ValueError(f"not enough eligible places: {len(eligible)} < {tranche_size}")

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
    attempted = sum(ATTEMPTED_BY_BATCH[label] for label in PROJECTION_BATCHES)
    footprint = sum(
        (ASSET_ROOT / r["assetPath"]).stat().st_size for r in images
    )
    return {
        "batches": batches,
        "projectionBatches": list(PROJECTION_BATCHES),
        "combinedAccepted": accepted,
        "combinedAttempted": attempted,
        "pooledAcceptanceRate": accepted / attempted,
        "combinedBytes": total,
        "weightedMeanBytes": total / accepted,
        "minBatchMeanBytes": min(means),
        "maxBatchMeanBytes": max(means),
        "footprintBytes": footprint,
        "footprintMiB": footprint / MIB,
        "assetCount": len(images),
    }


def coverage_state(places, images):
    covered = {r["placeId"] for r in images}
    by_grade = {}
    for grade in GRADE_ORDER:
        members = [p for p in places if p["grade"] == grade]
        hit = sum(1 for p in members if p["id"] in covered)
        by_grade[grade] = {
            "covered": hit, "total": len(members), "uncovered": len(members) - hit
        }
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
    by_id = {p["id"]: p for p in places}
    uncovered_s = [
        p["id"] for p in places if p["grade"] == "S" and p["id"] not in covered
    ]
    return {
        "totalPlaces": len(places),
        # S can only ever move if one of these re-enters through a separate gate.
        "uncoveredSIds": sorted(uncovered_s, key=utf16_key),
        "uncoveredSAllFailClosed": all(
            pid in CARRIED_FAILED_CLOSED_IDS for pid in uncovered_s
        ),
        "covered": len(covered),
        "uncovered": len(places) - len(covered),
        "coveragePct": round(100 * len(covered) / len(places), 1),
        "maxPhotosPerPlace": max(Counter(r["placeId"] for r in images).values()),
        "canonicalAppBytesIdentical": (
            CANONICAL_PATH.read_bytes() == APP_PATH.read_bytes()
        ),
        "byGrade": by_grade,
        "byHub": by_hub,
        "byCategory": by_category,
        "zeroPhotoCategories": sorted(
            (c for c, v in by_category.items() if v["covered"] == 0), key=utf16_key
        ),
        "eligibleUniverses": {
            name: len(eligible_places(places, covered, grades))
            for name, grades in SCOPES.items()
        },
        "eligibleByGrade": {
            grade: len(eligible_places(places, covered, (grade,)))
            for grade in ("A", "B", "C", "D")
        },
        "failClosed": {
            "count": len(CARRIED_FAILED_CLOSED_IDS),
            "allPresent": CARRIED_FAILED_CLOSED_IDS <= set(by_id),
            "allUncovered": all(i not in covered for i in CARRIED_FAILED_CLOSED_IDS),
            "byGrade": dict(sorted(
                Counter(by_id[i]["grade"] for i in CARRIED_FAILED_CLOSED_IDS).items()
            )),
            "ids": sorted(CARRIED_FAILED_CLOSED_IDS, key=utf16_key),
        },
    }


def prominence_gap(places, images):
    """Who the uncovered places are, in the dataset's own visitor-pressure terms.

    Splits the remaining gap into what a tranche could repair and what it structurally
    cannot, so 'materially useful for v1' is measured rather than asserted.
    """
    covered = {r["placeId"] for r in images}
    levels = {}
    for level in sorted({p[PROMINENCE_FIELD] for p in places}, key=utf16_key):
        members = [p for p in places if p[PROMINENCE_FIELD] == level]
        hit = sum(1 for p in members if p["id"] in covered)
        levels[level] = {
            "covered": hit, "total": len(members),
            "pct": round(100 * hit / len(members), 1),
        }

    def classify(place):
        if place["id"] in CARRIED_FAILED_CLOSED_IDS:
            return "unreachableFailClosed"
        if place["grade"] in ("C", "D"):
            return "reachableDeprioritisedCD"
        return "reachableEligibleAB"

    uncovered = [p for p in places if p["id"] not in covered]
    top = [p for p in uncovered if p[PROMINENCE_FIELD] == HIGH_PROMINENCE]
    return {
        "field": PROMINENCE_FIELD,
        "byLevel": levels,
        "uncoveredTotal": len(uncovered),
        "uncoveredClasses": dict(sorted(Counter(classify(p) for p in uncovered).items())),
        "topProminenceUncovered": len(top),
        "topProminenceClasses": dict(sorted(Counter(classify(p) for p in top).items())),
        "topProminenceRepairable": [
            {"placeId": p["id"], "grade": p["grade"], "hub": p["hub"], "name": p["name"]}
            for p in sorted(top, key=lambda x: utf16_key(x["id"]))
            if classify(p) == "reachableEligibleAB"
        ],
    }


def ordering_is_monotonic(pcts):
    """S >= A >= B >= C >= D on the given percentage mapping."""
    seq = [pcts[g] for g in GRADE_ORDER]
    return all(earlier >= later for earlier, later in zip(seq, seq[1:]))


def mix_simulation(state):
    """Explicit A:B mix sweep — the test Phase 4L's carry-forward demands.

    Inversion is a property of the mix, not of the size. With ``a`` accepted A and ``b``
    accepted B photographs, B overtakes A exactly when

        (B_cov + b) / B_total  >  (A_cov + a) / A_total

    Both the exact boundary and the realised policy mix are reported, so a proposal
    cannot hide a B-heavy draw behind an aggregate tranche size.

    The A:B boundary is not the only one. All four uncovered S places are carried
    fail-closed, so S is permanently capped at its present percentage: A therefore
    crosses *S* after a fixed number of further A photographs, whatever B does. Both
    boundaries are computed here, because a tranche can satisfy one and break the other.
    """
    a_cov, a_tot = state["byGrade"]["A"]["covered"], state["byGrade"]["A"]["total"]
    b_cov, b_tot = state["byGrade"]["B"]["covered"], state["byGrade"]["B"]["total"]
    a_elig = state["eligibleByGrade"]["A"]
    b_elig = state["eligibleByGrade"]["B"]

    def a_pct(a):
        return 100 * (a_cov + a) / a_tot

    def b_pct(b):
        return 100 * (b_cov + b) / b_tot

    def inverted(a, b):
        return b_pct(b) > a_pct(a)

    s_pct = 100 * state["byGrade"]["S"]["covered"] / state["byGrade"]["S"]["total"]
    # S is frozen: every uncovered S place is carried fail-closed, so no ordinary tranche
    # can ever raise it. The largest number of further A photographs that keeps A <= S.
    max_a_under_s = max(
        (a for a in range(0, a_elig + 1) if a_pct(a) <= s_pct), default=None
    )

    def monotonic(a, b):
        return s_pct >= a_pct(a) >= b_pct(b)

    grid = []
    for size in TRANCHE_SIZES:
        rows = []
        safe_max_b = None
        first_inverting_b = None
        for b in range(0, min(b_elig, size) + 1):
            a = size - b
            if a > a_elig:
                continue
            bad = inverted(a, b)
            rows.append({
                "b": b, "a": a,
                "aPct": round(a_pct(a), 1),
                "bPct": round(b_pct(b), 1),
                "gapPoints": round(a_pct(a) - b_pct(b), 1),
                "invertedAB": bad,
                "invertedSA": a_pct(a) > s_pct,
                "monotonic": monotonic(a, b),
            })
            if bad and first_inverting_b is None:
                first_inverting_b = b
            if not bad:
                safe_max_b = b if safe_max_b is None else max(safe_max_b, b)
        grid.append({
            "trancheSize": size,
            "maxSafeB": safe_max_b,
            "firstInvertingB": first_inverting_b,
            "anyFullyMonotonicMix": any(r["monotonic"] for r in rows),
            "rows": rows,
        })

    # Fragility: a tranche is fragile when it is safe as planned but inverts if a single
    # A target fails closed, which the observed acceptance rate makes likely.
    for entry in grid:
        safe_b = entry["maxSafeB"]
        entry["safeMixSurvivesOneAFailure"] = (
            None if safe_b is None
            else not inverted(entry["trancheSize"] - safe_b - 1, safe_b)
        )

    # The largest end state any sequence of tranches can ever reach while keeping the
    # editorial ordering monotonic — a permanent programme ceiling, not a per-batch one.
    best = max(
        (
            (a + b, a, b)
            for a in range(0, a_elig + 1)
            for b in range(0, b_elig + 1)
            if monotonic(a, b)
        ),
        key=lambda item: item[0],
    )

    return {
        "sPctFrozenAt": round(s_pct, 1),
        "sIsFrozen": state["uncoveredSAllFailClosed"],
        "maxFurtherAUnderSCeiling": max_a_under_s,
        "aEligibleUnreachableUnderSCeiling": a_elig - max_a_under_s,
        "monotonicProgrammeCeiling": {
            "furtherPhotos": best[0], "a": best[1], "b": best[2],
            "totalCovered": state["covered"] + best[0],
            "totalCoveredPct": round(
                100 * (state["covered"] + best[0]) / state["totalPlaces"], 1
            ),
            "aPct": round(a_pct(best[1]), 1),
            "bPct": round(b_pct(best[2]), 1),
        },
        "aPointsPerPhoto": round(100 / a_tot, 3),
        "bPointsPerPhoto": round(100 / b_tot, 3),
        "asymmetryRatio": round((100 / b_tot) / (100 / a_tot), 2),
        "currentGapPoints": round(a_pct(0) - b_pct(0), 1),
        "bOnlyPhotosToInvert": next(
            b for b in range(0, b_elig + 1) if inverted(0, b)
        ) if inverted(0, b_elig) else None,
        "exhaustionAPct": round(a_pct(a_elig), 1),
        "exhaustionBPct": round(b_pct(b_elig), 1),
        "exhaustionInverted": inverted(a_elig, b_elig),
        "byTrancheSize": grid,
    }


def strategy_matrix(places, images, state, prominence):
    """STOP plus every continuation candidate, scored on what each actually repairs."""
    covered = {r["placeId"] for r in images}
    repairable_top = {
        entry["placeId"] for entry in prominence["topProminenceRepairable"]
    }
    total = state["totalPlaces"]
    base_pcts = {
        g: 100 * state["byGrade"][g]["covered"] / state["byGrade"][g]["total"]
        for g in GRADE_ORDER
    }
    results = {
        "STOP": {
            "feasible": True,
            "attempted": 0,
            "topProminenceRepaired": 0,
            "topProminenceRepairable": len(repairable_top),
            "maxCoverage": state["covered"],
            "maxCoveragePct": state["coveragePct"],
            "gradePctAfter": {g: round(v, 1) for g, v in base_pcts.items()},
            "orderingMonotonic": ordering_is_monotonic(base_pcts),
            "newCategoriesUnlocked": 0,
            "projectedMiB": 0.0,
        }
    }
    for scope_name, grades in SCOPES.items():
        eligible_n = len(eligible_places(places, covered, grades))
        rows = {}
        for size in TRANCHE_SIZES:
            if size > eligible_n:
                rows[str(size)] = {
                    "feasible": False, "reason": f"only {eligible_n} eligible places"
                }
                continue
            fixture = select_batch(places, images, grades, size)
            picked = Counter(p["grade"] for p in fixture["places"])
            pcts = {
                g: 100 * (state["byGrade"][g]["covered"] + picked.get(g, 0))
                / state["byGrade"][g]["total"]
                for g in GRADE_ORDER
            }
            picked_cats = {p["category"] for p in fixture["places"]}
            unlocked = sorted(
                c for c in picked_cats if state["byCategory"][c]["covered"] == 0
            )
            max_cov = state["covered"] + size
            rows[str(size)] = {
                "feasible": True,
                "eligibleCount": eligible_n,
                "gradeCounts": fixture["gradeCounts"],
                "bShareOfTranche": round(
                    100 * picked.get("B", 0) / size, 1
                ),
                "hubQuotas": fixture["hubQuotas"],
                "distinctCategoryCount": fixture["distinctCategoryCount"],
                "newCategoriesUnlocked": len(unlocked),
                # Of the high-prominence places a tranche *could* repair, how many this
                # strategy actually draws. Raw coverage cannot distinguish strategies;
                # this is one of the dimensions that can.
                "topProminenceRepaired": len(
                    repairable_top.intersection(p["placeId"] for p in fixture["places"])
                ),
                "topProminenceRepairable": len(repairable_top),
                "temporalRiskCount": sum(
                    1 for p in fixture["places"] if p["temporalRisk"]
                ),
                "maxCoverage": max_cov,
                "maxCoveragePct": round(100 * max_cov / total, 1),
                "gradePctAfter": {g: round(v, 1) for g, v in pcts.items()},
                "orderingMonotonic": ordering_is_monotonic(pcts),
                "eligibleRemainingAfter": eligible_n - size,
                "placeIds": [p["placeId"] for p in fixture["places"]],
            }
        results[scope_name] = rows
    # B share of the eligible pool, to test whether the policy over-draws B.
    ab_eligible = eligible_places(places, covered, ("A", "B"))
    results["_bShareOfEligiblePct"] = round(
        100 * sum(1 for p in ab_eligible if p["grade"] == "B") / len(ab_eligible), 1
    )
    return results


def diminishing_returns(state, evidence):
    """Marginal value per accepted photograph, across the acquisition series."""
    rows = []
    running = 0
    for label, start, end in BATCH_SLICES:
        accepted = end - start
        running += accepted
        rows.append({
            "batch": label,
            "accepted": accepted,
            "cumulativeCovered": running,
            "cumulativePct": round(100 * running / state["totalPlaces"], 1),
            "pointsAdded": round(100 * accepted / state["totalPlaces"], 1),
            "meanBytes": round(evidence["batches"][label]["meanBytes"]),
        })
    return {
        "series": rows,
        "reachableCeilingAB": state["covered"] + state["eligibleUniverses"]["A+B"],
        "reachableCeilingABPct": round(
            100 * (state["covered"] + state["eligibleUniverses"]["A+B"])
            / state["totalPlaces"], 1
        ),
        "reachableCeilingAll": state["covered"] + state["eligibleUniverses"]["A+B+C+D"],
        "reachableCeilingAllPct": round(
            100 * (state["covered"] + state["eligibleUniverses"]["A+B+C+D"])
            / state["totalPlaces"], 1
        ),
        "permanentlyUnreachable": len(CARRIED_FAILED_CLOSED_IDS),
    }


def projections(evidence):
    wm = evidence["weightedMeanBytes"]
    lo = evidence["minBatchMeanBytes"]
    hi = evidence["maxBatchMeanBytes"]
    return {
        str(size): {
            "projectedMiB": round(size * wm / MIB, 2),
            "sensitivityMinMiB": round(size * lo / MIB, 2),
            "sensitivityMaxMiB": round(size * hi / MIB, 2),
            "expectedAccepted": round(size * evidence["pooledAcceptanceRate"], 1),
        }
        for size in TRANCHE_SIZES
    }


def replay_phase4k():
    """Policy-fidelity proof: regenerate the pinned Phase 4K fixture from its baseline.

    If this module's selector had drifted from the Phase 4I/4K policy, every forward
    figure would be suspect. Replaying the historical 113-record baseline with the
    historical 15-ID exclusion set must reproduce the checked-in fixture exactly and in
    order; only then is a difference in this analysis attributable to its inputs.
    """
    spec = importlib.util.spec_from_file_location(
        "photography_baseline", Path(__file__).resolve().parent / "photography_baseline.py"
    )
    baseline_support = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline_support)

    places, baseline = baseline_support.load_historical_baseline("phase4k")
    fixture = select_batch(
        places, baseline, ("A", "B"), 32, excluded=PHASE4K_FAILED_CLOSED_IDS
    )
    pinned = json.loads(PHASE4K_FIXTURE_PATH.read_text(encoding="utf-8"))
    return {
        "reproduced": [p["placeId"] for p in fixture["places"]]
        == [p["placeId"] for p in pinned["places"]],
        "eligibleCountMatches": fixture["eligibleCount"] == pinned["eligibleCount"],
        "gradeCountsMatch": fixture["gradeCounts"] == pinned["gradeCounts"],
        "hubQuotasMatch": fixture["hubQuotas"] == pinned["hubQuotas"],
        "targets": len(fixture["places"]),
    }


def build_report():
    places, images = load_inputs()
    state = coverage_state(places, images)
    evidence = asset_evidence(images)
    prominence = prominence_gap(places, images)
    return {
        "state": state,
        "prominence": prominence,
        "assetEvidence": evidence,
        "projections": projections(evidence),
        "mixSimulation": mix_simulation(state),
        "strategies": strategy_matrix(places, images, state, prominence),
        "diminishingReturns": diminishing_returns(state, evidence),
        "policyFidelity": replay_phase4k(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=None, help="Write the JSON report to this path.")
    args = parser.parse_args()
    report = build_report()
    payload = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(payload, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
