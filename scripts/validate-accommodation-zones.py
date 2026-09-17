#!/usr/bin/env python3
"""Validator for the accommodation-zone comparison layer (Block 3 Phase B).

Offline and dependency-free, like every other validator here: no network, no image decode.

The contract it enforces exists because this dataset mixes two kinds of statement that must
never be confused, in the data or in the UI:

* `facts`   — checkable claims about infrastructure, each carrying provenance.
* `editorial` — Nihon's own judgement, on a closed ordinal scale, with no provenance because
  there is none to give. A heuristic dressed as a fact is the failure mode this guards against.

It also holds the boundary that `docs/ACCOMMODATION_COMMUTE_DESIGN.md` set: a zone is not a
Place and not a cluster. It may *reference* clusters, and those references must resolve, but it
never carries tourism-place data of its own.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "data" / "accommodation" / "zones.json"
APP_COPY = ROOT / "app" / "src" / "data" / "accommodation" / "zones.json"
PLACES = ROOT / "data" / "places.json"
CLUSTERS = ROOT / "data" / "clusters.json"

ZONE_ID = re.compile(r"^ZN-[A-Z]{3}-[A-Z0-9-]+$")
# Closed ordinal vocabulary. 1..5, integers only: a decimal would imply a precision this data
# does not have, and a free number would invite an arbitrary composite score later.
EDITORIAL_AXES = (
    "nightlife", "food", "quiet", "walkability", "tourismIntensity",
    "luggageEase", "firstVisit", "shortStay", "lateArrival", "earlyDeparture",
)
ORDINAL_MIN, ORDINAL_MAX = 1, 5
REQUIRED_PROVENANCE = ("sourceUrl", "sourceEntity", "consultedAt", "evidence")
# Only these hubs are in scope for Block 3; a zone for an unmodelled hub is a mistake, not a
# feature, because the comparison surface is reached from the hub explorer.
SUPPORTED_HUBS = {"Tokio", "Kioto", "Osaka"}


def validate(doc, place_hubs, cluster_ids):
    errors = []
    zones = doc.get("zones")
    if not isinstance(zones, list) or not zones:
        return ["zones.json must carry a non-empty 'zones' array"]

    if doc.get("zoneCount") != len(zones):
        errors.append(f"zoneCount {doc.get('zoneCount')!r} disagrees with {len(zones)} zones")

    seen_ids, seen_anchor = set(), {}
    by_hub = {}

    for index, zone in enumerate(zones):
        label = f"zones[{index}]"
        zone_id = zone.get("id")
        if not isinstance(zone_id, str) or not ZONE_ID.fullmatch(zone_id):
            errors.append(f"{label}: id {zone_id!r} must match ZN-<HUB>-<NAME>")
        elif zone_id in seen_ids:
            errors.append(f"{label}: duplicate zone id {zone_id!r}")
        else:
            seen_ids.add(zone_id)

        hub = zone.get("hub")
        if hub not in SUPPORTED_HUBS:
            errors.append(f"{label}: hub {hub!r} is outside the supported set {sorted(SUPPORTED_HUBS)}")
        elif hub not in place_hubs:
            errors.append(f"{label}: hub {hub!r} does not exist in places.json")
        else:
            by_hub.setdefault(hub, []).append(zone_id)

        for field in ("name", "japaneseName", "summary"):
            value = zone.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: {field} must be a non-empty string")
        summary = zone.get("summary") or ""
        if len(summary) > 160:
            errors.append(f"{label}: summary is {len(summary)} chars; keep it scannable (<=160)")

        anchor = zone.get("anchor")
        if not isinstance(anchor, dict):
            errors.append(f"{label}: anchor must be an object")
        else:
            lat, lng = anchor.get("lat"), anchor.get("lng")
            if not isinstance(lat, (int, float)) or not (24 <= lat <= 46):
                errors.append(f"{label}: anchor.lat {lat!r} is outside Japan")
            if not isinstance(lng, (int, float)) or not (122 <= lng <= 146):
                errors.append(f"{label}: anchor.lng {lng!r} is outside Japan")
            if not isinstance(anchor.get("label"), str) or not anchor.get("label", "").strip():
                errors.append(f"{label}: anchor.label must be a non-empty string")
            if anchor.get("kind") != "station":
                errors.append(f"{label}: anchor.kind must be 'station'")
            key = (round(float(lat), 5), round(float(lng), 5)) if isinstance(lat, (int, float)) and isinstance(lng, (int, float)) else None
            if key is not None:
                if key in seen_anchor:
                    errors.append(f"{label}: anchor coincides with {seen_anchor[key]}")
                else:
                    seen_anchor[key] = zone_id

        # ---- facts ----
        facts = zone.get("facts")
        if not isinstance(facts, dict):
            errors.append(f"{label}: facts must be an object")
        else:
            lines = facts.get("railLines")
            if not isinstance(lines, list) or not lines or not all(isinstance(x, str) and x.strip() for x in lines):
                errors.append(f"{label}: facts.railLines must be a non-empty array of strings")
            elif len(set(lines)) != len(lines):
                errors.append(f"{label}: facts.railLines repeats a line")

            shinkansen = facts.get("shinkansen")
            if not isinstance(shinkansen, dict) or not isinstance(shinkansen.get("served"), bool):
                errors.append(f"{label}: facts.shinkansen.served must be a boolean")
            elif shinkansen["served"]:
                if not isinstance(shinkansen.get("lines"), list) or not shinkansen["lines"]:
                    errors.append(f"{label}: a zone served by Shinkansen must name the lines")
            else:
                if shinkansen.get("lines"):
                    errors.append(f"{label}: facts.shinkansen names lines but served is false")
                if not shinkansen.get("nearestStation"):
                    errors.append(f"{label}: a zone without Shinkansen must name the nearest station")

            links = facts.get("airportLinks")
            if not isinstance(links, list) or not links:
                errors.append(f"{label}: facts.airportLinks must be a non-empty array")
            else:
                for link in links:
                    if not isinstance(link, dict):
                        errors.append(f"{label}: each airportLink must be an object")
                        continue
                    if not link.get("airport") or not link.get("service"):
                        errors.append(f"{label}: airportLink needs both airport and service")
                    if not isinstance(link.get("directFromZone"), bool):
                        errors.append(f"{label}: airportLink.directFromZone must be a boolean")

            provenance = facts.get("provenance")
            if not isinstance(provenance, dict):
                errors.append(f"{label}: facts.provenance is required — a fact without a source is a heuristic")
            else:
                for field in REQUIRED_PROVENANCE:
                    value = provenance.get(field)
                    if not isinstance(value, str) or not value.strip():
                        errors.append(f"{label}: facts.provenance.{field} must be a non-empty string")
                url = provenance.get("sourceUrl", "")
                if not url.startswith("https://"):
                    errors.append(f"{label}: facts.provenance.sourceUrl must be https")
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", provenance.get("consultedAt", "")):
                    errors.append(f"{label}: facts.provenance.consultedAt must be YYYY-MM-DD")

        # ---- editorial ----
        editorial = zone.get("editorial")
        if not isinstance(editorial, dict):
            errors.append(f"{label}: editorial must be an object")
        else:
            missing = [axis for axis in EDITORIAL_AXES if axis not in editorial]
            if missing:
                errors.append(f"{label}: editorial is missing {missing}")
            extra = [key for key in editorial if key not in EDITORIAL_AXES]
            if extra:
                errors.append(f"{label}: editorial has unknown axes {extra}")
            for axis, value in editorial.items():
                if axis not in EDITORIAL_AXES:
                    continue
                if type(value) is not int or not (ORDINAL_MIN <= value <= ORDINAL_MAX):
                    errors.append(f"{label}: editorial.{axis} must be an integer {ORDINAL_MIN}..{ORDINAL_MAX}, got {value!r}")
            # An editorial block must never carry provenance: it would imply the judgement is
            # sourced, which is exactly the confusion this layer exists to avoid.
            if "provenance" in editorial or "sourceUrl" in editorial:
                errors.append(f"{label}: editorial must not carry provenance; it is Nihon's judgement, not a sourced fact")

        tradeoffs = zone.get("tradeoffs")
        if not isinstance(tradeoffs, list) or len(tradeoffs) < 2:
            errors.append(f"{label}: tradeoffs must list at least two honest drawbacks")
        elif not all(isinstance(x, str) and len(x.strip()) > 15 for x in tradeoffs):
            errors.append(f"{label}: every tradeoff must be a real sentence")

        serves = zone.get("servesClusters")
        if not isinstance(serves, list) or not serves:
            errors.append(f"{label}: servesClusters must be a non-empty array")
        else:
            unknown = [c for c in serves if c not in cluster_ids]
            if unknown:
                errors.append(f"{label}: servesClusters references unknown cluster(s) {unknown}")
            if len(set(serves)) != len(serves):
                errors.append(f"{label}: servesClusters repeats a cluster")

        # A zone is not a Place. Guard the boundary the accommodation design gate set.
        for forbidden in ("grade", "category", "duration", "price", "reservation", "placeId", "imageBrief"):
            if forbidden in zone:
                errors.append(f"{label}: a zone must not carry the place field {forbidden!r}")

    for hub, ids in by_hub.items():
        if not (4 <= len(ids) <= 7):
            errors.append(f"hub {hub!r} has {len(ids)} zones; the comparison needs 4-7 real alternatives")

    missing_hubs = sorted(SUPPORTED_HUBS - set(by_hub))
    if missing_hubs:
        errors.append(f"no zones for supported hub(s) {missing_hubs}")

    return errors


def main():
    try:
        doc = json.loads(CANONICAL.read_text(encoding="utf-8"))
        places = json.loads(PLACES.read_text(encoding="utf-8"))
        clusters = json.loads(CLUSTERS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load required artifact: {exc}")
        return 1

    place_hubs = {p.get("hub") for p in places}
    cluster_ids = {c.get("Cluster ID") for c in clusters}
    errors = validate(doc, place_hubs, cluster_ids)

    if not APP_COPY.is_file():
        errors.append("app-facing copy app/src/data/accommodation/zones.json is missing")
    elif APP_COPY.read_bytes() != CANONICAL.read_bytes():
        errors.append("canonical/app accommodation zones parity mismatch")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    hubs = {}
    for zone in doc["zones"]:
        hubs[zone["hub"]] = hubs.get(zone["hub"], 0) + 1
    summary = ", ".join(f"{hub} {count}" for hub, count in sorted(hubs.items()))
    print(f"OK: {len(doc['zones'])} accommodation zones ({summary}); facts sourced, editorial bounded, source/app parity confirmed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
