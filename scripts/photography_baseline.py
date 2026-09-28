#!/usr/bin/env python3
"""Shared reconstruction of historical photography baselines for selector fixtures.

Each acquisition phase selected its tranche from the catalog as it stood at that time.
Later phases append accepted records to that same canonical registry, so replaying a
historical selector fixture against the live catalog would legitimately produce a
different tranche. The historical baseline must therefore be rebuilt first.

Every baseline here is derived twice, independently, and the two derivations must agree:

1. *Semantically* -- drop every record appended by an acquisition batch whose tranche was
   selected after that baseline. A batch that declares ``appendedAssetPaths`` is removed by
   those exact records; older manifests, which predate depth and only ever covered
   previously-uncovered places, are removed by place ID as before. Failed-closed targets were
   never acquired, so only accepted records are actually removed.
2. *Positionally* -- take the leading ``size`` records. The canonical registry grows
   append-only, so each historical era is exactly a prefix of it.

Requiring both to agree means a later batch cannot silently shift a fixture onto the
wrong baseline: if it appends records without registering its manifest, or breaks the
append-only ordering, the derivations diverge and reconstruction fails loudly instead of
replaying a different catalog. Record *content* is always read live from the canonical
registry, so source/attribution corrections flow through rather than rotting in a frozen
copy.

These are test fixture boundaries, not runtime selection behavior.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VISUAL_DIR = ROOT / "data" / "visual"
PLACES_PATH = ROOT / "data" / "places.json"
CANONICAL_PATH = VISUAL_DIR / "photography-metadata.json"

# Discovers every selector batch manifest. The Phase 4A pilot manifest deliberately does
# not match this pattern: it predates every baseline below and must stay in the baselines.
BATCH_MANIFEST_GLOB = "*-batch*.json"

# Every acquisition batch manifest, in the order its tranche was appended to the registry.
ACQUISITION_BATCH_MANIFESTS = (
    "a-grade-photography-batch-i.json",    # Phase 4F, batch I
    "a-grade-photography-batch-ii.json",   # Phase 4H, batch II
    "a-b-photography-batch.json",          # Phase 4J, A+B batch
    "phase4k-successor-fixture.json",      # Phase 4L, A+B batch II
    "block2-coverage-batch.json",          # Block 2, prominence-first coverage
    "block2-depth-batch.json",             # Block 2, depth (second facet on covered places)
    "block3-deferred-batch.json",          # Block 3 A1, Block 2's two deferred depth records
)

# Block 22 (B6.1–B6.7) acquired through per-phase acquisition *plans* rather than batch
# manifests, and B6.5 made the registry place-grouped (gallery order identity → experience →
# complementary, `docs/BLOCK_22_B6_5_REPORT.md`): a new record is inserted next to its place's
# earlier records instead of appended at the end. Every one of these phases ran after every
# historical baseline below, so their records are removed from all of them, identified by the
# `originalTitle` each plan entry declares. The append-only invariant still holds for the
# registry *without* them, which is what the positional derivation now reads.
B22_PLAN_GLOB = "block22-b6-*-acquisition-plan.json"
B22_ACQUISITION_PLANS = tuple(f"block22-b6-{n}-acquisition-plan.json" for n in range(1, 8))

# Historical catalog sizes, and the batches selected strictly after each one.
HISTORICAL_BASELINES = {
    "phase4e": {"size": 36, "post": ACQUISITION_BATCH_MANIFESTS},
    "phase4g": {"size": 58, "post": ACQUISITION_BATCH_MANIFESTS[1:]},
    "phase4k": {"size": 113, "post": ACQUISITION_BATCH_MANIFESTS[3:]},
}


def assert_batch_registry_is_complete():
    """Fail loudly if a batch manifest exists that this module does not know about.

    A future acquisition phase that checks in a manifest without registering it here
    would otherwise leave its accepted records inside every historical baseline.
    """
    discovered = {path.name for path in VISUAL_DIR.glob(BATCH_MANIFEST_GLOB)}
    registered = set(ACQUISITION_BATCH_MANIFESTS)
    unregistered = sorted(discovered - registered)
    if unregistered:
        raise AssertionError(
            "unregistered acquisition batch manifest(s) "
            f"{unregistered}: add them to ACQUISITION_BATCH_MANIFESTS and to the "
            "'post' tuple of every baseline they were selected after"
        )
    # A registered manifest need not match the discovery glob: Phase 4L executes the
    # fixture Phase 4K pinned, which is deliberately named outside it. Presence on disk
    # is what matters; the glob only finds manifests nobody has registered yet.
    discovered_plans = {path.name for path in VISUAL_DIR.glob(B22_PLAN_GLOB)}
    unregistered_plans = sorted(discovered_plans - set(B22_ACQUISITION_PLANS))
    if unregistered_plans:
        raise AssertionError(
            f"unregistered Block 22 acquisition plan(s) {unregistered_plans}: add them to "
            "B22_ACQUISITION_PLANS"
        )
    registered = registered | set(B22_ACQUISITION_PLANS)
    missing = sorted(
        name for name in registered if not (VISUAL_DIR / name).is_file()
    )
    if missing:
        raise AssertionError(
            f"registered acquisition batch manifest(s) missing from disk: {missing}"
        )


def batch_target_ids(manifest_names):
    """Every place ID claimed by the named acquisition batch manifests."""
    target_ids = set()
    for name in manifest_names:
        target_ids.update(place["placeId"] for place in _load_manifest(name)["places"])
    return target_ids


def _load_manifest(name):
    path = VISUAL_DIR / name
    if not path.is_file():
        raise AssertionError(f"acquisition batch manifest not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def batch_appended_asset_paths(manifest_names):
    """Asset paths appended by the named batches, for batches that declare them.

    Block 2 introduced **depth**: a batch whose target place was already covered by an earlier
    batch. Removing such a batch by place ID — which is all a pre-Block-2 manifest supports —
    would also delete the earlier batch's record and silently corrupt every historical
    baseline. A batch that can do this therefore declares `appendedAssetPaths`, which
    identifies the records it actually added rather than the places it touched.

    Returns `(asset_paths, place_ids_of_manifests_without_asset_paths)` so the caller can apply
    the precise rule where a batch supports it and the historical place-ID rule where it does
    not.
    """
    asset_paths = set()
    legacy_place_ids = set()
    for name in manifest_names:
        doc = _load_manifest(name)
        declared = doc.get("appendedAssetPaths")
        if declared:
            asset_paths.update(declared)
        else:
            legacy_place_ids.update(place["placeId"] for place in doc["places"])
    return asset_paths, legacy_place_ids


def b22_acquired_titles():
    """`originalTitle` of every record a Block 22 acquisition plan added to the registry."""
    titles = set()
    for name in B22_ACQUISITION_PLANS:
        doc = _load_manifest(name)
        entries = list(doc.get("entries", []))
        for batch in doc.get("batches", []):
            entries.extend(batch.get("entries", []))
        for entry in entries:
            title = entry["title"]
            titles.add(title if title.startswith("File:") else f"File:{title}")
    return titles


def load_current_inputs():
    places_doc = json.loads(PLACES_PATH.read_text(encoding="utf-8"))
    places = places_doc if isinstance(places_doc, list) else places_doc["places"]
    photography = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
    return places, photography["images"]


def load_historical_baseline(name):
    """Return ``(places, baseline_records)`` for a named historical baseline."""
    if name not in HISTORICAL_BASELINES:
        raise AssertionError(f"unknown historical baseline: {name!r}")
    spec = HISTORICAL_BASELINES[name]
    size = spec["size"]

    assert_batch_registry_is_complete()
    places, current = load_current_inputs()
    post_asset_paths, post_place_ids = batch_appended_asset_paths(spec["post"])
    b22_titles = b22_acquired_titles()
    b22_found = {record["originalTitle"] for record in current} & b22_titles
    if b22_found != b22_titles:
        raise AssertionError(
            f"Block 22 plan entries missing from the registry: {sorted(b22_titles - b22_found)}"
        )
    # Place-grouped since B6.5; append-only once Block 22's inserted records are set aside.
    append_only = [record for record in current if record["originalTitle"] not in b22_titles]

    baseline = [
        record
        for record in append_only
        if record["assetPath"] not in post_asset_paths and record["placeId"] not in post_place_ids
    ]
    prefix = append_only[:size]

    if len(baseline) != size:
        raise AssertionError(
            f"{name} baseline reconstruction expected {size} records, "
            f"found {len(baseline)}"
        )
    if [r["placeId"] for r in baseline] != [r["placeId"] for r in prefix]:
        raise AssertionError(
            f"{name} baseline reconstruction disagrees with the append-only registry "
            "prefix; a later batch changed record ordering or is missing from "
            "ACQUISITION_BATCH_MANIFESTS"
        )
    # A later batch's record must not survive into the baseline. Checked by asset path, which
    # is what uniquely identifies a record: a depth batch's place legitimately still appears in
    # the baseline through the earlier record that covered it.
    leaked = sorted(
        record["assetPath"] for record in baseline if record["assetPath"] in post_asset_paths
    )
    leaked += sorted(
        record["placeId"] for record in baseline if record["placeId"] in post_place_ids
    )
    if leaked:
        raise AssertionError(f"post-{name} targets leaked into the baseline: {leaked}")
    return places, baseline
