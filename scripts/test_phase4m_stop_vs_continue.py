#!/usr/bin/env python3
"""Offline tests for the Phase 4M photography stop-vs-continue design gate.

Every figure the Phase 4M decision rests on is pinned here, recomputed from canonical
data rather than read from the design document, so the gate stays provable after later
phases change the catalogue.
"""
import hashlib
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "analyze_phase4m_stop_vs_continue",
    ROOT / "scripts" / "analyze-phase4m-stop-vs-continue.py",
)
analysis = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analysis)

PHASE_4M_BASE = "5707c1405febdb467d2af991eb21e731b887b6cd"


def load_base_inputs():
    """Read the canonical inputs from the Phase 4M base, not the working tree.

    Phase 4M reasoned about the catalogue as it stood at its own base. A later
    acquisition phase may legitimately grow it; pinning the derivation keeps this design
    record provable without freezing the repository.
    """
    places = json.loads(
        subprocess.check_output(["git", "show", f"{PHASE_4M_BASE}:data/places.json"])
    )
    photography = json.loads(
        subprocess.check_output(
            ["git", "show", f"{PHASE_4M_BASE}:data/visual/photography-metadata.json"]
        )
    )
    return places, photography["images"]


class ReproducedStateTests(unittest.TestCase):
    """The starting-state figures Issue #116 requires to be reproduced independently."""

    def setUp(self):
        self.places, self.images = load_base_inputs()
        self.state = analysis.coverage_state(self.places, self.images)

    def test_core_counts(self):
        self.assertEqual(self.state["totalPlaces"], 214)
        self.assertEqual(self.state["covered"], 144)
        self.assertEqual(self.state["uncovered"], 70)
        self.assertEqual(self.state["coveragePct"], 67.3)
        self.assertEqual(self.state["maxPhotosPerPlace"], 1)

    def test_registry_image_count_matches_record_count(self):
        photography = json.loads(
            subprocess.check_output(
                ["git", "show", f"{PHASE_4M_BASE}:data/visual/photography-metadata.json"]
            )
        )
        self.assertEqual(photography["imageCount"], len(photography["images"]))
        self.assertEqual(photography["imageCount"], 144)

    def test_grade_coverage(self):
        self.assertEqual(
            {g: (v["covered"], v["total"]) for g, v in self.state["byGrade"].items()},
            {"S": (28, 32), "A": (102, 147), "B": (14, 25), "C": (0, 6), "D": (0, 4)},
        )
        self.assertEqual(
            sum(v["total"] for v in self.state["byGrade"].values()), 214
        )

    def test_hub_coverage(self):
        self.assertEqual(
            {h: (v["covered"], v["total"]) for h, v in self.state["byHub"].items()},
            {
                "Fukuoka": (1, 1), "Kioto": (34, 49), "Nagoya": (1, 1),
                "Okinawa": (34, 50), "Osaka": (34, 53), "Sapporo": (3, 3),
                "Tokio": (37, 57),
            },
        )
        self.assertEqual(sum(v["total"] for v in self.state["byHub"].values()), 214)

    def test_sixteen_fail_closed_ids_present_and_uncovered(self):
        fail_closed = self.state["failClosed"]
        self.assertEqual(fail_closed["count"], 16)
        self.assertTrue(fail_closed["allPresent"])
        self.assertTrue(fail_closed["allUncovered"])
        self.assertEqual(
            set(fail_closed["ids"]),
            {
                "JP-033", "JP-126", "JP-203", "JP-204",
                "JP-050", "JP-195",
                "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",
                "JP-120", "JP-211", "JP-041", "JP-168",
                "JP-140",
            },
        )

    def test_fail_closed_set_holds_two_b_grade_places(self):
        """The divergence Phase 4M reports: JP-041 *and* JP-140 are both grade B.

        Phase 4L's successor note subtracted only JP-041 when it computed the remaining
        eligible universe, which is why it reported 10 eligible B rather than 9.
        """
        self.assertEqual(
            self.state["failClosed"]["byGrade"], {"A": 10, "B": 2, "S": 4}
        )

    def test_eligible_universes_diverge_from_the_phase_4l_carry_forward(self):
        self.assertEqual(
            self.state["eligibleUniverses"],
            {"A-only": 35, "A+B": 44, "A+B+C+D": 54},
        )
        self.assertEqual(
            self.state["eligibleByGrade"], {"A": 35, "B": 9, "C": 6, "D": 4}
        )
        # Issue #116 and Phase 4L both carry forward 45 = 35 A / 10 B. Reproduced: 44.
        self.assertNotEqual(self.state["eligibleUniverses"]["A+B"], 45)

    def test_zero_photo_categories_are_both_fail_closed_single_member(self):
        self.assertEqual(
            self.state["zeroPhotoCategories"],
            ["🌌 Cielo nocturno", "🐋 Fauna y experiencias estacionales"],
        )
        for category in self.state["zeroPhotoCategories"]:
            members = [p for p in self.places if p["category"] == category]
            self.assertEqual(len(members), 1)
            self.assertIn(
                members[0]["id"], analysis.CARRIED_FAILED_CLOSED_IDS
            )

    def test_every_uncovered_s_place_is_fail_closed(self):
        """The fact that freezes S at 87.5% and caps A permanently."""
        self.assertEqual(
            self.state["uncoveredSIds"], ["JP-033", "JP-126", "JP-203", "JP-204"]
        )
        self.assertTrue(self.state["uncoveredSAllFailClosed"])


class AssetEvidenceTests(unittest.TestCase):
    """Per-batch byte evidence through Phase 4L, measured from the committed assets.

    Reads the Phase 4M base registry, like every other test here. Phase 4M reasoned about the
    catalogue as it stood at its own base, and later blocks legitimately append to it — Block 2
    took it from 144 records to 161 and Block 3 to 163. The per-batch slices and the footprint
    are statements about that gate's evidence, not about the live catalogue, so they must be
    derived from the base or they simply measure a different thing each time the registry grows.
    The asset blobs themselves are append-only, so the base's records still resolve on disk.
    """

    def setUp(self):
        _places, self.images = load_base_inputs()
        self.evidence = analysis.asset_evidence(self.images)

    def test_per_batch_bytes(self):
        self.assertEqual(
            {k: (v["accepted"], v["bytes"]) for k, v in self.evidence["batches"].items()},
            {
                "Phase 4A": (24, 7_090_836),
                "Phase 4D": (12, 3_607_446),
                "Phase 4F": (22, 5_457_240),
                "Phase 4H": (27, 7_438_738),
                "Phase 4J": (28, 9_672_140),
                "Phase 4L": (31, 9_187_992),
            },
        )

    def test_phase_4l_delta_matches_its_runtime_record(self):
        phase4l = self.evidence["batches"]["Phase 4L"]
        self.assertEqual(phase4l["bytes"], 9_187_992)
        self.assertEqual(round(phase4l["bytes"] / analysis.MIB, 2), 8.76)

    def test_weighted_mean_and_sensitivity_band(self):
        self.assertEqual(self.evidence["combinedAccepted"], 120)
        self.assertEqual(self.evidence["combinedBytes"], 35_363_556)
        self.assertAlmostEqual(self.evidence["weightedMeanBytes"], 294_696.30, places=2)
        self.assertEqual(round(self.evidence["minBatchMeanBytes"]), 248_056)
        self.assertEqual(round(self.evidence["maxBatchMeanBytes"]), 345_434)

    def test_phase_4k_rising_cost_trend_did_not_continue(self):
        """Phase 4K treated the newest batch as the worst case; Phase 4L was not."""
        means = self.evidence["batches"]
        self.assertLess(
            means["Phase 4L"]["meanBytes"], means["Phase 4J"]["meanBytes"]
        )

    def test_pooled_acceptance_rate(self):
        self.assertEqual(self.evidence["combinedAttempted"], 136)
        self.assertEqual(round(100 * self.evidence["pooledAcceptanceRate"], 1), 88.2)

    def test_footprint(self):
        self.assertEqual(self.evidence["assetCount"], 144)
        self.assertEqual(self.evidence["footprintBytes"], 42_454_392)
        self.assertEqual(round(self.evidence["footprintMiB"], 2), 40.49)


class OrderingCeilingTests(unittest.TestCase):
    """The S ceiling: the constraint that decides the gate."""

    def setUp(self):
        places, images = load_base_inputs()
        self.mix = analysis.mix_simulation(analysis.coverage_state(places, images))

    def test_s_is_permanently_frozen(self):
        self.assertTrue(self.mix["sIsFrozen"])
        self.assertEqual(self.mix["sPctFrozenAt"], 87.5)

    def test_a_has_a_permanent_budget_of_twenty_six_further_photographs(self):
        self.assertEqual(self.mix["maxFurtherAUnderSCeiling"], 26)
        self.assertEqual(self.mix["aEligibleUnreachableUnderSCeiling"], 9)

    def test_monotonic_programme_ceiling(self):
        ceiling = self.mix["monotonicProgrammeCeiling"]
        self.assertEqual(ceiling["furtherPhotos"], 33)
        self.assertEqual((ceiling["a"], ceiling["b"]), (26, 7))
        self.assertEqual(ceiling["totalCovered"], 177)
        self.assertEqual(ceiling["totalCoveredPct"], 82.7)
        self.assertEqual(ceiling["aPct"], 87.1)
        self.assertEqual(ceiling["bPct"], 84.0)


class MixSimulationTests(unittest.TestCase):
    """A:B mix is the test, not tranche size."""

    def setUp(self):
        places, images = load_base_inputs()
        self.mix = analysis.mix_simulation(analysis.coverage_state(places, images))
        self.by_size = {e["trancheSize"]: e for e in self.mix["byTrancheSize"]}

    def test_per_photograph_asymmetry(self):
        self.assertEqual(self.mix["aPointsPerPhoto"], 0.68)
        self.assertEqual(self.mix["bPointsPerPhoto"], 4.0)
        self.assertEqual(self.mix["asymmetryRatio"], 5.88)
        self.assertEqual(self.mix["currentGapPoints"], 13.4)

    def test_four_b_only_photographs_invert_the_ordering(self):
        self.assertEqual(self.mix["bOnlyPhotosToInvert"], 4)

    def test_exhausting_the_corrected_universe_does_not_invert_a_over_b(self):
        """Supersedes Phase 4L's projection table, which reported B 96.0% > A 93.2%."""
        self.assertEqual(self.mix["exhaustionAPct"], 93.2)
        self.assertEqual(self.mix["exhaustionBPct"], 92.0)
        self.assertFalse(self.mix["exhaustionInverted"])

    def test_max_safe_b_by_tranche_size(self):
        self.assertEqual(
            {size: entry["maxSafeB"] for size, entry in self.by_size.items()},
            {8: 4, 12: 4, 16: 5, 24: 6, 32: 7},
        )

    def test_only_the_smallest_tranche_is_fragile_to_one_a_failure(self):
        """n=8 at its max safe mix inverts if a single A target fails closed."""
        self.assertFalse(self.by_size[8]["safeMixSurvivesOneAFailure"])
        for size in (12, 16, 24, 32):
            with self.subTest(size=size):
                self.assertTrue(self.by_size[size]["safeMixSurvivesOneAFailure"])

    def test_the_knife_edge_mix_at_n_eight(self):
        row = next(r for r in self.by_size[8]["rows"] if r["b"] == 4)
        self.assertEqual((row["aPct"], row["bPct"], row["gapPoints"]), (72.1, 72.0, 0.1))
        self.assertFalse(row["invertedAB"])
        failed = next(r for r in self.by_size[8]["rows"] if r["b"] == 5)
        self.assertTrue(failed["invertedAB"])


class StrategyComparisonTests(unittest.TestCase):
    """STOP against every continuation candidate, on the dimensions that discriminate."""

    def setUp(self):
        self.places, self.images = load_base_inputs()
        self.state = analysis.coverage_state(self.places, self.images)
        self.prominence = analysis.prominence_gap(self.places, self.images)
        self.strategies = analysis.strategy_matrix(
            self.places, self.images, self.state, self.prominence
        )

    def test_stop_preserves_the_editorial_ordering(self):
        stop = self.strategies["STOP"]
        self.assertTrue(stop["orderingMonotonic"])
        self.assertEqual(stop["maxCoveragePct"], 67.3)
        self.assertEqual(
            stop["gradePctAfter"],
            {"S": 87.5, "A": 69.4, "B": 56.0, "C": 0.0, "D": 0.0},
        )

    def test_no_tranche_at_any_size_or_scope_unlocks_a_new_category(self):
        """Breadth is fully saturated — the strongest diminishing-return signal."""
        for scope in ("A-only", "A+B", "A+B+C+D"):
            for size, row in self.strategies[scope].items():
                if not row["feasible"]:
                    continue
                with self.subTest(scope=scope, size=size):
                    self.assertEqual(row["newCategoriesUnlocked"], 0)

    def test_thirty_two_breaks_the_ordering_for_both_a_only_and_a_plus_b(self):
        """Not on the A/B boundary — on S >= A, which no prior phase measured."""
        a_only = self.strategies["A-only"]["32"]
        a_plus_b = self.strategies["A+B"]["32"]
        self.assertFalse(a_only["orderingMonotonic"])
        self.assertEqual(a_only["gradePctAfter"]["A"], 91.2)
        self.assertFalse(a_plus_b["orderingMonotonic"])
        self.assertEqual(a_plus_b["gradePctAfter"]["A"], 88.4)

    def test_a_only_re_widens_the_a_b_gap(self):
        row = self.strategies["A-only"]["32"]
        self.assertEqual(row["gradePctAfter"]["B"], 56.0)
        self.assertEqual(
            round(row["gradePctAfter"]["A"] - row["gradePctAfter"]["B"], 1), 35.2
        )

    def test_the_selector_does_not_over_draw_b(self):
        """No artificial B cap is needed; the policy under-draws B above n=8."""
        self.assertEqual(self.strategies["_bShareOfEligiblePct"], 20.5)
        shares = {
            size: row["bShareOfTranche"]
            for size, row in self.strategies["A+B"].items()
            if row["feasible"]
        }
        self.assertEqual(
            shares, {"8": 25.0, "12": 16.7, "16": 18.8, "24": 12.5, "32": 12.5}
        )

    def test_widening_to_c_d_inverts_the_editorial_signal(self):
        row = self.strategies["A+B+C+D"]["32"]
        self.assertFalse(row["orderingMonotonic"])
        self.assertEqual(row["gradePctAfter"]["C"], 100.0)
        self.assertGreater(row["gradePctAfter"]["C"], row["gradePctAfter"]["S"])

    def test_c_d_widening_front_loads_the_lowest_grades(self):
        row = self.strategies["A+B+C+D"]["8"]
        self.assertEqual(row["gradeCounts"], {"A": 2, "C": 5, "D": 1})

    def test_largest_fully_monotonic_incumbent_policy_tranche_is_thirty(self):
        def monotonic_at(size):
            fixture = analysis.select_batch(self.places, self.images, ("A", "B"), size)
            counts = fixture["gradeCounts"]
            a_pct = 100 * (102 + counts.get("A", 0)) / 147
            b_pct = 100 * (14 + counts.get("B", 0)) / 25
            return 87.5 >= a_pct >= b_pct

        self.assertTrue(monotonic_at(30))
        self.assertFalse(monotonic_at(31))


class ProminenceTests(unittest.TestCase):
    """Who is uncovered, in the dataset's own visitor-pressure terms."""

    def setUp(self):
        places, images = load_base_inputs()
        self.prominence = analysis.prominence_gap(places, images)

    def test_coverage_is_inverted_against_visitor_prominence(self):
        levels = {k: v["pct"] for k, v in self.prominence["byLevel"].items()}
        self.assertEqual(
            levels, {"Alto": 80.4, "Bajo": 67.9, "Extremo": 52.3, "Medio": 65.6}
        )
        self.assertLess(levels["Extremo"], 67.3)

    def test_uncovered_places_split_into_three_classes(self):
        self.assertEqual(
            self.prominence["uncoveredClasses"],
            {
                "reachableDeprioritisedCD": 10,
                "reachableEligibleAB": 44,
                "unreachableFailClosed": 16,
            },
        )

    def test_most_prominence_gaps_are_structurally_unreachable(self):
        self.assertEqual(self.prominence["topProminenceUncovered"], 21)
        self.assertEqual(
            self.prominence["topProminenceClasses"],
            {
                "reachableDeprioritisedCD": 9,
                "reachableEligibleAB": 6,
                "unreachableFailClosed": 6,
            },
        )

    def test_the_six_repairable_gaps_are_majority_grade_b(self):
        repairable = self.prominence["topProminenceRepairable"]
        self.assertEqual(
            [entry["placeId"] for entry in repairable],
            ["JP-019", "JP-038", "JP-072", "JP-080", "JP-153", "JP-171"],
        )
        self.assertEqual(sum(1 for e in repairable if e["grade"] == "B"), 4)


class SelectorCannotDeliverTheProminenceCaseTests(unittest.TestCase):
    """The instrument does not hit the target that motivates continuation."""

    def setUp(self):
        self.places, self.images = load_base_inputs()

    def test_kinkakuji_is_never_selected_at_any_candidate_size(self):
        for size in analysis.TRANCHE_SIZES:
            with self.subTest(size=size):
                fixture = analysis.select_batch(
                    self.places, self.images, ("A", "B"), size
                )
                self.assertNotIn(
                    "JP-080", {p["placeId"] for p in fixture["places"]}
                )

    def test_top_prominence_repaired_by_size(self):
        state = analysis.coverage_state(self.places, self.images)
        prominence = analysis.prominence_gap(self.places, self.images)
        strategies = analysis.strategy_matrix(
            self.places, self.images, state, prominence
        )
        self.assertEqual(
            {
                size: row["topProminenceRepaired"]
                for size, row in strategies["A+B"].items()
                if row["feasible"]
            },
            {"8": 2, "12": 2, "16": 2, "24": 2, "32": 4},
        )


class PolicyFidelityTests(unittest.TestCase):
    """The analysis selector must be the Phase 4I/4K policy, not a drifted variant."""

    def test_replaying_the_phase_4k_baseline_reproduces_its_pinned_fixture(self):
        fidelity = analysis.replay_phase4k()
        self.assertTrue(fidelity["reproduced"])
        self.assertTrue(fidelity["eligibleCountMatches"])
        self.assertTrue(fidelity["gradeCountsMatch"])
        self.assertTrue(fidelity["hubQuotasMatch"])
        self.assertEqual(fidelity["targets"], 32)

    def test_analysis_is_deterministic(self):
        places, images = load_base_inputs()
        first = analysis.select_batch(places, images, ("A", "B"), 16)
        second = analysis.select_batch(places, images, ("A", "B"), 16)
        self.assertEqual(first, second)


class NoSuccessorAuthorisedTests(unittest.TestCase):
    """Phase 4M is a STOP. It must not pin a fixture or authorise a tranche."""

    def test_phase_4m_pins_no_successor_fixture(self):
        for path in (ROOT / "data" / "visual").glob("phase4m*"):
            self.fail(f"Phase 4M must not pin an acquisition fixture: {path.name}")

    def test_analysis_module_exposes_no_recommended_tranche(self):
        self.assertFalse(hasattr(analysis, "RECOMMENDED_TRANCHE_SIZE"))
        self.assertFalse(hasattr(analysis, "SUCCESSOR_FIXTURE_PATH"))

    def test_analysis_module_never_writes_outside_an_explicit_out_path(self):
        source = (
            ROOT / "scripts" / "analyze-phase4m-stop-vs-continue.py"
        ).read_text(encoding="utf-8")
        self.assertEqual(source.count("write_text"), 1)
        self.assertNotIn("urllib", source)
        self.assertNotIn("requests", source)


class DesignOnlyScopeTests(unittest.TestCase):
    """Phase 4M itself changed no photograph, asset or dataset file.

    This is a historical claim about the Phase 4M design commit range. Pinning both
    endpoints keeps the proof valid even if a later post-v1 phase legitimately changes
    photography.
    """

    PHASE_4M_DESIGN_HEAD = "277949e827cb52c2c48cccb038d8a73a04cb348e"

    FROZEN = (
        "data/visual/photography-metadata.json",
        "app/src/data/photography-metadata.json",
        "data/places.json",
    )

    def _blob(self, rev, path):
        return subprocess.check_output(["git", "show", f"{rev}:{path}"])

    def test_phase_4m_changed_no_frozen_file(self):
        for path in self.FROZEN:
            with self.subTest(path=path):
                self.assertEqual(
                    hashlib.sha256(self._blob(PHASE_4M_BASE, path)).hexdigest(),
                    hashlib.sha256(self._blob(self.PHASE_4M_DESIGN_HEAD, path)).hexdigest(),
                )

    def test_canonical_and_app_photography_metadata_stayed_in_parity(self):
        canonical = self._blob(
            self.PHASE_4M_DESIGN_HEAD, "data/visual/photography-metadata.json"
        )
        app_copy = self._blob(
            self.PHASE_4M_DESIGN_HEAD, "app/src/data/photography-metadata.json"
        )
        self.assertEqual(canonical, app_copy)

    def test_phase_4m_changed_no_image_asset(self):
        base = subprocess.check_output(
            ["git", "ls-tree", "-r", PHASE_4M_BASE, "app/public/images/places/"]
        ).decode()
        design = subprocess.check_output(
            ["git", "ls-tree", "-r", self.PHASE_4M_DESIGN_HEAD, "app/public/images/places/"]
        ).decode()
        self.assertEqual(base, design)

    def test_no_fail_closed_id_entered_the_registry_at_design_head(self):
        photography = json.loads(
            self._blob(
                self.PHASE_4M_DESIGN_HEAD,
                "data/visual/photography-metadata.json",
            )
        )
        registered = {record["placeId"] for record in photography["images"]}
        self.assertEqual(registered & analysis.CARRIED_FAILED_CLOSED_IDS, set())

    def test_phase_4m_changed_only_documentation_analysis_and_tests(self):
        changed = subprocess.check_output(
            ["git", "diff", "--name-only", PHASE_4M_BASE, self.PHASE_4M_DESIGN_HEAD]
        ).decode().split()
        allowed = {
            "docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md",
            "docs/ROADMAP.md",
            "scripts/analyze-phase4m-stop-vs-continue.py",
            "scripts/test_phase4m_stop_vs_continue.py",
        }
        self.assertEqual(set(changed) - allowed, set())


if __name__ == "__main__":
    unittest.main()
