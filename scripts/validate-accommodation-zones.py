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
REQUIRED_PROVENANCE = ("sourceUrl", "sourceEntity", "consultedAt", "evidence", "tier", "covers")
# Block 7. The three kinds of checkable claim a zone makes, so a source can say which of them it
# actually supports instead of one record standing silently behind all three.
FACT_AREAS = ("railLines", "shinkansen", "airportLinks")
# The authority ladder, best first. Stored rather than inferred from the host: "is this the
# operator" is a judgement about the claim, not a fact about a domain name.
SOURCE_TIERS = ("operator", "authority", "official-tourism", "secondary")
# A host that cannot honestly be called a primary or operator source, whatever tier it claims.
SECONDARY_HOSTS = ("wikipedia.org", "wikimedia.org", "britannica.com", "wikivoyage.org")
# Block 8. How the traveller actually moves on one airport link. A closed vocabulary: the dataset
# contains trains and coaches and nothing else, and inventing modes it does not carry would be
# speculation, not a contract.
AIRPORT_LINK_MODES = ("rail", "bus")
# A route described as going *via* somewhere is, by its own words, not direct. This is the one
# text rule worth enforcing: it catches a real contradiction rather than guessing at prose.
VIA_ROUTE = re.compile(r"\bv[ií]a\b", re.I)
# Words that can only mean a coach. The converse is deliberately not enforced — a rail service can
# be named anything, so "no bus word" proves nothing about the mode.
BUS_SERVICE = re.compile(r"autob[úu]s|limusina|\bbus\b", re.I)
# Only these hubs are in scope for Block 3; a zone for an unmodelled hub is a mistake, not a
# feature, because the comparison surface is reached from the hub explorer.
SUPPORTED_HUBS = {"Tokio", "Kioto", "Osaka"}


def check_provenance(provenance, label):
    """One source record: shape, authority tier, and the fact areas it claims to support.

    `covers` is the field this validator cares most about. A source that lists an area it does not
    speak to would reintroduce exactly the problem Block 7 set out to remove — a single record
    standing silently behind claims it never supported — so it must be a non-empty subset of the
    known areas, and it is never defaulted.
    """
    errors = []
    for field in REQUIRED_PROVENANCE:
        if field == "covers":
            continue
        value = provenance.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{label}.{field} must be a non-empty string")

    url = provenance.get("sourceUrl", "")
    if not url.startswith("https://"):
        errors.append(f"{label}.sourceUrl must be https")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", provenance.get("consultedAt", "")):
        errors.append(f"{label}.consultedAt must be YYYY-MM-DD")

    tier = provenance.get("tier")
    if tier not in SOURCE_TIERS:
        errors.append(f"{label}.tier {tier!r} must be one of {list(SOURCE_TIERS)}")
    elif tier != "secondary" and any(host in url for host in SECONDARY_HOSTS):
        # An encyclopedia is a fine source; calling it the operator is not.
        errors.append(f"{label}.tier is {tier!r} but sourceUrl is an encyclopedia: {url}")

    covers = provenance.get("covers")
    if not isinstance(covers, list) or not covers:
        errors.append(f"{label}.covers must be a non-empty array naming the facts this source supports")
    else:
        unknown = [area for area in covers if area not in FACT_AREAS]
        if unknown:
            errors.append(f"{label}.covers names unknown fact area(s) {unknown}")
        if len(set(covers)) != len(covers):
            errors.append(f"{label}.covers repeats a fact area")
    return errors


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
                seen_links = set()
                for link in links:
                    if not isinstance(link, dict):
                        errors.append(f"{label}: each airportLink must be an object")
                        continue
                    if not link.get("airport") or not link.get("service"):
                        errors.append(f"{label}: airportLink needs both airport and service")
                    if not isinstance(link.get("directFromZone"), bool):
                        errors.append(f"{label}: airportLink.directFromZone must be a boolean")

                    # ---- Block 8: one record, one service, and what it means ----
                    mode = link.get("mode")
                    if mode not in AIRPORT_LINK_MODES:
                        errors.append(
                            f"{label}: airportLink.mode {mode!r} must be one of {list(AIRPORT_LINK_MODES)}"
                        )

                    service = link.get("service") or ""
                    # `directFromZone` is a claim about THIS service: that it runs between zone and
                    # airport with no change. A service whose own description routes it via
                    # somewhere else contradicts that, whatever the boolean says.
                    if VIA_ROUTE.search(service) and link.get("directFromZone") is True:
                        errors.append(
                            f"{label}: airportLink {service!r} is described as a route via another point "
                            f"but is marked direct"
                        )
                    # A coach recorded as rail would make the panel tell the traveller to look for
                    # a train that does not exist.
                    if BUS_SERVICE.search(service) and mode != "bus":
                        errors.append(f"{label}: airportLink {service!r} names a coach but mode is {mode!r}")
                    if mode == "bus" and not BUS_SERVICE.search(service):
                        errors.append(f"{label}: airportLink {service!r} is mode 'bus' but names no coach")

                    # Two records for the same airport are how a zone says "a direct coach AND a
                    # rail route with a change". Two identical ones say nothing twice.
                    key = (link.get("airport"), service)
                    if key in seen_links:
                        errors.append(f"{label}: airportLink {key!r} appears twice")
                    seen_links.add(key)

            provenance = facts.get("provenance")
            if not isinstance(provenance, dict):
                errors.append(f"{label}: facts.provenance is required — a fact without a source is a heuristic")
            else:
                errors.extend(check_provenance(provenance, f"{label}: facts.provenance"))

            # ---- Block 7: extra, scoped sources ----
            extra = facts.get("sources")
            if extra is not None:
                if not isinstance(extra, list) or not extra:
                    errors.append(f"{label}: facts.sources, when present, must be a non-empty array")
                else:
                    for position, source in enumerate(extra):
                        if not isinstance(source, dict):
                            errors.append(f"{label}: facts.sources[{position}] must be an object")
                            continue
                        errors.extend(check_provenance(source, f"{label}: facts.sources[{position}]"))

            # Every fact area must be backed by at least one source. This is what makes "which
            # facts have no source" unrepresentable rather than merely undocumented.
            all_sources = [s for s in [provenance] + list(extra or []) if isinstance(s, dict)]
            for area in FACT_AREAS:
                if not any(area in (s.get("covers") or []) for s in all_sources):
                    errors.append(f"{label}: no source covers facts.{area}")

            # Two records pointing at the same page are not two confirmations of the same claim.
            urls = [s.get("sourceUrl") for s in all_sources]
            if len(set(urls)) != len(urls):
                errors.append(f"{label}: the same sourceUrl appears twice in facts")

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
            # Block 7 added `tier`, `covers` and `sources`; an editorial block acquiring any of
            # them would be the same contamination wearing a newer name.
            leaked = [key for key in ("provenance", "sourceUrl", "sources", "tier", "covers") if key in editorial]
            if leaked:
                errors.append(f"{label}: editorial must not carry provenance {leaked}; it is Nihon's judgement, not a sourced fact")

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
