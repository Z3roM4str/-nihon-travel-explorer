#!/usr/bin/env python3
"""Integrity checks for the exported dataset in data/*.json.

Usage:
    python3 scripts/validate-dataset.py [data-dir]

Exits non-zero and prints every failing check if anything is wrong; otherwise prints a
one-line OK summary. Does not touch the workbook — this only checks the JSON output.
"""
import json
import re
import sys
from pathlib import Path

EXPECTED_PLACE_COUNT = 214
JAPAN_BBOX = {"lat_min": 20, "lat_max": 46, "lng_min": 122, "lng_max": 154}

# `nearby.json`'s relation count is reported dynamically (see the OK summary) rather than
# asserted against a fixed number: it is expected to grow as the workbook's logistics
# section is extended, and that growth is legitimate, not a data-quality defect.
#
# The `Modo` / `Relación` vocabularies below mirror `app/src/lib/transfer.ts`'s
# `TransferMode` / `TransferRelation` normalization — Phase 3B1's domain-layer contract for
# these same 403+ relations. Both sides must be extended together whenever the workbook
# introduces a genuinely new mode or relation kind.
KNOWN_NEARBY_MODES = {"A pie", "Transporte local", "Disney Resort Line"}
KNOWN_NEARBY_RELATIONS = {"Mismo cluster", "Cercano", "Alternativas/complementos"}

# Duration families, mirroring app/src/lib/planning-block.ts. Every editorial `raw` must
# fall in exactly one of them; the counts per family are deliberately NOT asserted, since
# they change whenever the workbook does.
DAY_NIGHT_RE = re.compile(r"d[ií]as?\b|noches?\b", re.IGNORECASE)
NIGHTS_RE = re.compile(r"noches?\b", re.IGNORECASE)
PLURAL_DAYS_RE = re.compile(r"\bd[ií]as\b", re.IGNORECASE)
HALF_DAY_RE = re.compile(r"medio\s+d[ií]a", re.IGNORECASE)
FULL_DAY_RE = re.compile(r"d[ií]a\s+completo", re.IGNORECASE)
NUMERIC_RANGE_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(min|minutos?|h|horas?)", re.IGNORECASE
)
NUMERIC_SINGLE_RE = re.compile(r"^(\d+(?:[.,]\d+)?)\s*(min|minutos?|h|horas?)$", re.IGNORECASE)


def duration_family(raw):
    """Names the family a duration text belongs to, or None when nothing recognises it."""
    text = (raw or "").strip()
    if not text:
        return None
    if DAY_NIGHT_RE.search(text):
        if NIGHTS_RE.search(text) or PLURAL_DAYS_RE.search(text):
            return "overnight-plus"
        if HALF_DAY_RE.search(text) and FULL_DAY_RE.search(text):
            return "half-to-full-day"
        if FULL_DAY_RE.search(text):
            return "full-day"
        if HALF_DAY_RE.search(text):
            return "half-day"
        return None
    if NUMERIC_RANGE_RE.search(text) or NUMERIC_SINGLE_RE.match(text):
        return "quantified"
    return None


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check(dataset_dir):
    errors = []
    warnings = []

    places = load(dataset_dir / "places.json")
    nearby = load(dataset_dir / "nearby.json")
    clusters = load(dataset_dir / "clusters.json")

    if len(places) != EXPECTED_PLACE_COUNT:
        errors.append(f"expected {EXPECTED_PLACE_COUNT} places, found {len(places)}")

    ids = [p["id"] for p in places]
    if len(ids) != len(set(ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        errors.append(f"duplicate place ids: {dupes}")

    for place in places:
        lat, lng = place["coordinates"]["lat"], place["coordinates"]["lng"]
        if lat is None or lng is None:
            errors.append(f"{place['id']}: missing coordinates")
        elif not (JAPAN_BBOX["lat_min"] <= lat <= JAPAN_BBOX["lat_max"] and
                   JAPAN_BBOX["lng_min"] <= lng <= JAPAN_BBOX["lng_max"]):
            errors.append(f"{place['id']}: coordinates out of Japan bounding box ({lat}, {lng})")

    ids_set = set(ids)
    broken = [
        (r["Desde ID"], r["Hacia ID"])
        for r in nearby
        if r["Desde ID"] not in ids_set or r["Hacia ID"] not in ids_set
    ]
    if broken:
        errors.append(f"nearby relations with an id not in places.json: {broken}")

    # The 3 Phase 2 editorial corrections must be present.
    by_id = {p["id"]: p for p in places}

    okinawa_region_count = sum(1 for p in places if p["hub"] == "Okinawa" and p["region"] == "Okinawa")
    if okinawa_region_count != 50:
        errors.append(f"expected 50 Okinawa-hub places with region 'Okinawa', found {okinawa_region_count}")
    if any(p["region"] == "Kyushu/Okinawa" for p in places):
        errors.append("stray 'Kyushu/Okinawa' region value still present")

    naoshima = by_id.get("JP-152")
    if not naoshima or naoshima["region"] != "Shikoku" or naoshima["prefecture"] != "Kagawa":
        errors.append(f"JP-152 Naoshima should be prefecture=Kagawa, region=Shikoku; got {naoshima}")

    if by_id.get("JP-203", {}).get("nearbyIds") != ["JP-204"]:
        errors.append(f"JP-203 nearbyIds should be ['JP-204']; got {by_id.get('JP-203', {}).get('nearbyIds')}")
    if by_id.get("JP-204", {}).get("nearbyIds") != ["JP-203"]:
        errors.append(f"JP-204 nearbyIds should be ['JP-203']; got {by_id.get('JP-204', {}).get('nearbyIds')}")

    # ---- Durations -------------------------------------------------------
    # Hard failures: the app derives planning blocks from these fields, so an unclassifiable
    # or self-contradictory duration is a real defect, not stale metadata.
    for place in places:
        raw = (place["duration"].get("raw") or "").strip()
        if not raw:
            errors.append(f"{place['id']}: empty duration.raw")
            continue

        family = duration_family(raw)
        if family is None:
            errors.append(f"{place['id']}: duration {raw!r} matches no known family")

        low = place["duration"].get("minMinutes")
        high = place["duration"].get("maxMinutes")
        if (low is None) != (high is None):
            errors.append(f"{place['id']}: minMinutes and maxMinutes must appear together")
        elif low is not None and low > high:
            errors.append(f"{place['id']}: minMinutes {low} exceeds maxMinutes {high}")

        if family and family != "quantified" and low is not None:
            errors.append(
                f"{place['id']}: day-scale duration {raw!r} also carries normalized minutes"
            )

    # ---- Clusters --------------------------------------------------------
    # The place is authoritative: hub + cluster is the membership the application uses.
    for place in places:
        if not (place.get("cluster") or "").strip():
            errors.append(f"{place['id']}: empty cluster")
        if not (place.get("hub") or "").strip():
            errors.append(f"{place['id']}: empty hub")

    # clusters.json is secondary metadata exported alongside the places. Its own id lists and
    # aggregate columns are not used by the application, so divergence is reported and never
    # silently adopted as truth — and never fails the run.
    # Membership comes from the places, keyed by hub + cluster. The row's own IDs column is
    # read only to report where it disagrees — it never decides who belongs, how many there
    # are, or how many are graded S/A.
    members = {}
    for place in places:
        key = (place.get("hub"), place.get("cluster"))
        members.setdefault(key, []).append(place)

    for row in clusters:
        key = (row.get("Hub"), row.get("Cluster"))
        label = f"{row.get('Cluster ID')} {row.get('Hub')}/{row.get('Cluster')}"
        authoritative_members = members.get(key, [])
        derived_count = len(authoritative_members)

        if derived_count == 0:
            warnings.append(
                f"cluster metadata {label} has no place with that hub + cluster; "
                "it is not shown as a cluster by the application"
            )
        if row.get("N.º fichas") != derived_count:
            warnings.append(
                f"cluster metadata {label}: 'N.º fichas' is {row.get('N.º fichas')}, "
                f"places give {derived_count}"
            )

        listed = [i.strip() for i in (row.get("IDs") or "").split(",") if i.strip()]
        for place_id in listed:
            place = by_id.get(place_id)
            if place is None:
                warnings.append(f"cluster metadata {label}: lists unknown place {place_id}")
            elif (place.get("hub"), place.get("cluster")) != key:
                warnings.append(
                    f"cluster metadata {label}: lists {place_id}, whose own hub + cluster is "
                    f"{place.get('hub')}/{place.get('cluster')}"
                )

        real_sa = sum(1 for place in authoritative_members if place.get("grade") in ("S", "A"))
        if row.get("S/A") != real_sa:
            warnings.append(
                f"cluster metadata {label}: 'S/A' is {row.get('S/A')}, places give {real_sa}"
            )

    # ---- Nearby relations (Phase 3B1 logistics foundation) --------------
    # These are geographic proximity estimates, not routing-grade data (see docs/LOGISTICS.md).
    # Hard failures here are about the *shape* of the relation, never about the estimate's
    # accuracy — accuracy is exactly what Phase 3B1 declines to assert (`confidence:
    # "estimated"` in `app/src/lib/transfer.ts`).
    for index, relation in enumerate(nearby):
        from_id = relation.get("Desde ID")
        to_id = relation.get("Hacia ID")
        label = f"nearby[{index}] {from_id} -> {to_id}"

        if from_id is not None and from_id == to_id:
            errors.append(f"{label}: self edge (Desde ID equals Hacia ID)")

        distance = relation.get("Distancia km")
        if distance is None or distance <= 0:
            errors.append(f"{label}: 'Distancia km' must be > 0, found {distance!r}")

        minutes = relation.get("Min aprox.")
        if minutes is None or minutes <= 0:
            errors.append(f"{label}: 'Min aprox.' must be > 0, found {minutes!r}")

        mode = relation.get("Modo")
        if mode not in KNOWN_NEARBY_MODES:
            errors.append(f"{label}: unknown 'Modo' {mode!r}; known modes are {sorted(KNOWN_NEARBY_MODES)}")

        relation_kind = relation.get("Relación")
        if relation_kind not in KNOWN_NEARBY_RELATIONS:
            errors.append(
                f"{label}: unknown 'Relación' {relation_kind!r}; "
                f"known values are {sorted(KNOWN_NEARBY_RELATIONS)}"
            )

        if relation_kind == "Mismo cluster" and from_id in by_id and to_id in by_id:
            from_place, to_place = by_id[from_id], by_id[to_id]
            if (from_place.get("hub"), from_place.get("cluster")) != (
                to_place.get("hub"),
                to_place.get("cluster"),
            ):
                errors.append(
                    f"{label}: 'Mismo cluster' but hub/cluster differ "
                    f"({from_place.get('hub')}/{from_place.get('cluster')} vs "
                    f"{to_place.get('hub')}/{to_place.get('cluster')})"
                )

    # A→B and B→A are two independently recorded rows; when both exist, divergence is
    # reported (not asserted as corruption) unless a future rule identifies an objective
    # reason to treat a specific kind of mismatch as an error.
    by_direction = {(r["Desde ID"], r["Hacia ID"]): r for r in nearby}
    reported_pairs = set()
    for (from_id, to_id), forward in by_direction.items():
        pair = frozenset((from_id, to_id))
        if pair in reported_pairs:
            continue
        backward = by_direction.get((to_id, from_id))
        if backward is None:
            continue
        reported_pairs.add(pair)
        mismatched_fields = [
            field
            for field in ("Distancia km", "Min aprox.", "Modo", "Relación")
            if forward.get(field) != backward.get(field)
        ]
        if mismatched_fields:
            warnings.append(
                f"nearby {from_id} <-> {to_id}: directions diverge on {mismatched_fields} "
                f"({forward}) vs ({backward})"
            )

    return errors, warnings, len(places), len(nearby)


def main():
    dataset_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    errors, warnings, place_count, nearby_count = check(dataset_dir)

    for warning in warnings:
        print(f"WARNING: {warning}")

    if errors:
        print(f"FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)

    suffix = f" ({len(warnings)} secondary-metadata warning(s))" if warnings else ""
    print(f"OK: {place_count} places, {nearby_count} nearby relations, 0 broken references, "
          f"3 editorial corrections present{suffix}.")


if __name__ == "__main__":
    main()
