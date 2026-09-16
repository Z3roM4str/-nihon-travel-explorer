#!/usr/bin/env python3
"""Shared reconstruction of historical photography baselines for selector fixtures.

Each acquisition phase selected its tranche from the catalog as it stood at that time.
Later phases append accepted records to that same canonical registry, so replaying a
historical selector fixture against the live catalog would legitimately produce a
different tranche. The historical baseline must therefore be rebuilt first.

Every baseline here is derived twice, independently, and the two derivations must agree:

1. *Semantically* -- drop every place ID claimed by an acquisition batch manifest whose
   tranche was selected after that baseline. Failed-closed targets were never acquired,
   so only accepted records are actually removed.
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
)

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
        path = VISUAL_DIR / name
        if not path.is_file():
            raise AssertionError(f"acquisition batch manifest not found: {path}")
        doc = json.loads(path.read_text(encoding="utf-8"))
        target_ids.update(place["placeId"] for place in doc["places"])
    return target_ids


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
    post_ids = batch_target_ids(spec["post"])

    baseline = [record for record in current if record["placeId"] not in post_ids]
    prefix = current[:size]

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
    leaked = sorted(post_ids.intersection(r["placeId"] for r in baseline))
    if leaked:
        raise AssertionError(f"post-{name} targets leaked into the baseline: {leaked}")
    return places, baseline
