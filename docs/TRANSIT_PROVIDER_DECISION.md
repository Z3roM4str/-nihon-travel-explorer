# Phase 3B3A — Transit & Schedule-Aware Logistics Provider Decision / Coverage Audit

Research + architecture + decision only. This phase does not integrate a provider, does not
call any transit API, does not change `getBestTransfer()` or any runtime code, does not touch
`app/src/lib/transfer.ts`, and does not start ordered-sequence logistics, city-sequence
comparison, day-level itinerary generation, or any other Phase 3C work.

## 1. Current logistics status

Walking (`A pie`) is closed evidence, not open work. Phase 3B2A–H (complete) validated the
walking side of the dataset in three stages:

- **Phase 3B2A/B** (pilot + scale): all 332 `A pie` relations routed against openrouteservice.
  325 promoted to `confidence: "validated-static"` (snap-clean); 2 (`JP-063↔JP-065`) validated
  but with significant endpoint snapping, so they fall back to `estimated`; 5 (the `JP-090`
  cluster) returned `no-route` and also fall back to `estimated`.
- **Phase 3B2D**: independently investigated all 7 of those non-promoted edges plus the large
  Snap displacements against official sources. No threshold change was justified.
- **Phase 3B2E–H**: designed, populated, and exercised an access-point layer for the two places
  (`JP-029`, `JP-181`) whose *display* coordinate was shown to be a poor logistics endpoint,
  without touching `getBestTransfer()` or any historical result.

**This phase does not reopen any of that.** No new ORS request, no threshold change, no
`places.json`/`JP-181` correction, no walking regeneration.

## 2. The gap, derived from the current dataset

Every number below was recomputed against the current checkout — none is carried forward from
a prior phase's report. See the Appendix for the exact, offline, re-runnable code.

| | Count | % of 403 |
|---|---|---|
| Total directed logistics relations (`nearby.json`) | **403** | 100 % |
| Walking (`Modo == "A pie"`) | **332** | 82.4 % |
| Non-walking | **71** | 17.6 % |

Non-walking breaks down by mode as:

| Mode | Count |
|---|---|
| `Transporte local` | 69 |
| `Disney Resort Line` | 2 |

**Every one of these 71 relations is still a pure haversine-distance + fixed-speed-model
estimate** (`confidence: "estimated"`, `source.kind: "derived-geographic"`) — the walking work
never touched them, because they were never `A pie` to begin with. `Nota` on all 69
`Transporte local` rows reads the same generic `"Estimación geográfica; validar ruta real"` as
every other unvalidated relation; there is no per-relation detail (line names, stations,
transfer count) to build on. Their recorded distance/time ranges are 1.81–5.92 km and
14–47 min.

Adding in the walking side's own unresolved edges (never fixed by 3B2D, by design — see
§1) gives the true current gap:

| | Count |
|---|---|
| Walking, promoted `validated-static` | 325 |
| Walking, still `estimated` (2 significant-snap + 5 no-route) | 7 |
| Non-walking, always `estimated` | 71 |
| **Total still `estimated` after all completed work** | **78 / 403 (19.4 %)** |

The 7 walking stragglers are `JP-063↔JP-065` and the `JP-090` cluster — already independently
investigated in Phase 3B2D and explained by place type, not by a fixable routing defect. They
are **not** a transit-provider problem. **The real, addressable gap this phase is about is the
71 non-walking relations.**

### Hub topology of the gap

| Hub | Walking edges | Non-walking edges |
|---|---|---|
| Tokio | 122 | 14 |
| Kioto | 100 | 26 |
| Osaka | 71 | 8 |
| Okinawa | 39 | 23 |
| Fukuoka / Nagoya / Sapporo | 0 | 0 |

**All 403 relations, with no exception, are intra-hub.** `computeLogisticsMetrics`'s directed
lookup never assumed otherwise, but it is worth stating plainly: **the dataset today contains
zero inter-hub relations** — no Tokyo↔Kyoto, no mainland↔Okinawa, nothing that a Shinkansen or
a domestic flight would serve. Three of the app's seven hubs (Fukuoka, Nagoya, Sapporo) carry
no logistics relation of any kind yet, walking or otherwise.

This matters for scoping a provider decision: **inter-city transport is not a hole in today's
403 relations — it is an entirely unmodeled category.** Filling it isn't "validate an existing
estimate," it's "decide whether and how the schema should represent a relation type that does
not exist in `nearby.json` at all." That is out of scope for this phase and is named explicitly
in §16.

### What already needed schedule information before this phase started

`Disney Resort Line` (2 relations) is a real fixed-headway monorail, not schedule-critical in
the way a low-frequency inter-city bus is — but it is still schedule-*aware* in principle, not
schedule-*estimated* as it is recorded today. It is included in the "non-walking" gap above,
not carved out, because no work has been done on it yet either.

## 3. Provider requirements, derived from what the dataset and the trip actually need

Before comparing vendors, what does "transit" have to mean here? Minimum requirements, derived
from §2 plus the destination profile (`docs/GEOGRAPHY.md`'s 7 hubs across Honshu, Kyushu,
Hokkaido, and Okinawa) — **not** from the February–March 2027 trip's specific dates, which this
phase does not plan for:

- **Modes**: urban rail/metro, JR, bus — confirmed necessary today (`Transporte local`).
  Shinkansen, ferry, and domestic flight are **not** in today's 403 relations but are realistic
  needs for a multi-hub Japan trip and should not be architecturally foreclosed.
- **Departure-time and arrival-time routing** — both, not just one; a traveller plans some legs
  by "I want to arrive by X" and others by "I'm free to leave after Y."
- **Stations, transfers, real trip duration** — not just an origin/destination pair; a
  meaningful transit result needs to say *which* line and *how many* transfers, unlike the
  current single-number `Min aprox.`.
- **Service calendars** — weekday/weekend/holiday variation is real in Japan (reduced service,
  last-train timing) and must be a first-class fact, not folded into a single "typical" number.
- **National coverage, Okinawa included** — Okinawa has no JR network; its `Transporte local`
  edges are monorail (Yui Rail) + bus only. A provider evaluated only against Kanto/Kansai rail
  data is not actually evaluated for this dataset's full hub set.
- **A directed `from → to` request shape** — matching this project's existing
  `lookupTransfer(fromId, toId)` model, so a future integration is a new `TransferProvenance`
  member and a new precomputed artifact, not a redesign of the domain layer.
- **Provenance and `verifiedAt` on every result** — same discipline as `RoutingProviderProvenance`
  and the walking pilot/scale artifacts: `provider`, `profile`/mode, the exact query, and an ISO
  timestamp, so an old schedule-aware answer is never silently read as current (see §8).

Airports are *not* currently represented as places in the dataset (`places.json` has no
airport-typed entry), so a provider's flight-schedule coverage is a nice-to-have, not a
requirement this phase can justify demanding.

## 4. Providers evaluated

Only official, currently published documentation was used (linked inline); nothing here is
recalled from training knowledge without a live check this session. No account, key, or billing
was created for any of these, and **no request was made against any of them.**

### Commercial, schedule-aware, general-purpose

**Google Routes API (transit mode)** — [transit route guide](https://developers.google.com/maps/documentation/routes/transit-route),
[Directions/Routes caching policy](https://developers.google.com/maps/documentation/directions/policies).
Already evaluated in Phase 3B1 (`docs/LOGISTICS.md` §"Transit provider research") and
re-verified live this session: the transit time window is still documented as **"up to and
including 100 days after `now`"** — feb–mar 2027 is roughly 5–8 months out from this checkout's
date (2026-09), so it is still outside that window and will remain so for some time yet. The
policy page also confirms, independently of the date problem, that **response data (excluding
place IDs) is "subject to caching and storage restrictions as defined in your Google
Agreement"** — the specific limit isn't published inline, but the direction is clear:
Google's model is *query live, don't republish as static data*, which is the opposite of how
this project has worked so far (ORS results committed as versioned JSON, exactly as `nearby.json`
itself is). **Excluded, same reasons as before, reconfirmed.**

**HERE Public Transit API** — [dev guide](https://developer.here.com/documentation/public-transit/dev_guide/index.html).
HERE's own routing documentation states plainly: **"Access to the Routing service in Japan
region is restricted. If your business requires this, please contact HERE."** This is not a
quota or a paid-tier gate — it's a market-access gate that requires a direct commercial
conversation, not a self-serve signup. **Excluded**: not evaluable as a self-serve option for a
personal/portfolio project without engaging HERE's sales process, which this phase is not
authorized to do.

**NAVITIME API** — [API portal](https://api-sdk.navitime.co.jp/api/), [plan/pricing overview](https://api-sdk.navitime.co.jp/api/specs/description/about_navitime_api.html).
Genuinely broad: rail, bus, ferry, walking, taxi in one door-to-door query, with a documented
timetable-based (時刻表) routing mode — i.e., real departure-time/arrival-time schedule
awareness, not just an average. Access is either a direct contract with NAVITIME Japan (custom
pricing, a 90-day trial) or a marketplace listing (RapidAPI/SBI API Hub) at **$200–300/month**
for a usable tier; the free/trial tier caps at 500 requests. Nationwide claim is explicit;
Okinawa is not called out by name in the docs reviewed. **Not excluded on capability** — excluded
on cost proportionality for a personal project at this stage (§11), and its caching/storage
terms were not located in the documentation reviewed this session (a real open question, not
assumed favorable).

**Ekispert API (駅すぱあと API, formerly Ekispert Web Service)** — [product page](https://ekispert.jp/products/api),
[API docs](https://docs.ekispert.com/v1/api/), [plans](https://api-info.ekispert.com/plan/).
Japan-specific and comprehensive by design: rail (including Shinkansen), bus, plane, and ferry,
plus commuter-pass fare calculation — closer to a "does everything Japan-specific transit needs"
product than NAVITIME's more general door-to-door framing. Pricing is the most personal-project-
friendly of the commercial options found: a **free plan** (no monthly/annual fee) and a genuine
**pay-as-you-go tier** (¥5,500 for 5,000 requests, purchased via Amazon, no subscription). The
catch: the **free plan's route search returns only average-wait-time results, not real
timetable-based search** — schedule-aware output requires a paid tier. Okinawa/Yui-Rail
coverage was **not confirmed** in the pages reviewed (the product page mentions "nationwide
railway network" without enumerating Okinawa specifically, and Okinawa has no JR line at all —
this needs a direct check, not an assumption). **Terms of use covering caching/storage of
responses are in a separate PDF this session did not open** — the documentation page only links
to it; that PDF is the single most important unread document for this decision (see §16).

### Open data / self-hosted

**ODPT — Public Transportation Open Data Center** — [overview](https://www.odpt.org/en/overview/).
Free (registration required; the fee model is described as applying to *operators* who charge for
their own data, not to API consumers), and its stated scope is real open data (some CC0, general
terms under a "Public Transportation Open Data Basic License") — the license family is
compatible in spirit with caching/versioning, unlike the commercial APIs above. The catch: the
overview page's own description of its origin is **"starting with data related to railway and bus
provided by Bureau of Transportation, Tokyo Metropolitan Government"** — this reads as a
Tokyo-centric starting point that has since expanded to more operators, but this session could not
confirm operator-level coverage for Kyoto, Osaka, or Okinawa specifically. ODPT gives you *data*
(GTFS + a REST API over cleansed schedules), not a *routing engine* — turning it into an actual
"from → to, this time" answer requires either writing trip-planning logic or deploying something
like OpenTripPlanner against the GTFS feeds.

**GTFS feed aggregators (Transitland / MobilityDatabase)** — [Transitland Toei feed example](https://www.transit.land/feeds/f-toei~data~toei~train~gtfs~jp),
[MobilityDatabase](https://mobilitydatabase.org/). Confirmed real Japanese feeds exist in these
catalogs (e.g. Tokyo's Toei subway and bus), contributed by the open community rather than
guaranteed complete. Same fundamental limitation as ODPT: a feed catalog is not a routing
service. Coverage for Kyoto/Osaka private rail and Okinawa bus/monorail was not confirmed in
either catalog this session — each feed's own license also varies by contributing operator and
would need per-feed review before any could be cached/redistributed.

**openrouteservice (already in use for walking)** — [services](https://openrouteservice.org/services/).
Confirmed via its own service/profile listing: **driving, cycling, walking, and wheelchair
profiles only. No public transit profile exists.** This is not a gap in this project's usage —
it is a real product boundary. **ORS cannot be extended to cover the transit gap; a different
provider or architecture is required for it by construction, not by choice.**

## 5. Comparative matrix

| | Google Routes | HERE Transit | NAVITIME | Ekispert | ODPT (open data) | GTFS aggregators |
|---|---|---|---|---|---|---|
| Japan coverage | Global, incl. Japan | Restricted access in Japan | Nationwide (Japan-native) | Nationwide (Japan-native) | Growing, Tokyo-origin | Patchy, community-contributed |
| Okinawa confirmed | Not checked (moot — excluded) | Not checked (moot — excluded) | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Rail/metro/JR | Yes | Yes | Yes | Yes | Partial (rail operators onboarded) | Partial (per feed) |
| Shinkansen | Yes (as transit) | Unconfirmed | Not explicit in docs reviewed | Yes (explicit) | Unconfirmed | Unconfirmed |
| Bus | Yes | Yes | Yes | Yes | Yes (bus GTFS is a stated focus) | Yes (per feed) |
| Ferry | Limited | Unconfirmed | Yes | Yes | Some | Rare |
| Departure/arrival time | Yes, both | Yes | Yes (時刻表) | Paid tier only | Static timetable only (no live query engine) | Static only |
| Free tier | No (pay-per-use, but architecturally excluded) | N/A (access-gated) | 500 req / 90-day trial | Yes, but average-time only | Yes (registration) | Yes |
| Affordable paid tier for a personal project | N/A | N/A | No ($200+/mo) | **Yes (¥5,500/5,000 req, no subscription)** | Free | Free |
| Self-serve signup | Yes | **No — sales contact required** | Yes (direct or marketplace) | Yes | Yes | Yes |
| Cacheable/versionable as static repo data | **No** (ToS restricts storage) | Unconfirmed (access-gated before it matters) | **Not confirmed — ToS not reviewed** | **Not confirmed — ToS PDF not reviewed** | **Yes, by design** (GTFS is meant to be downloaded/versioned) | **Yes, by design**, per-feed license varies |
| Matches directed `from→to` + provenance model | Yes | Yes | Yes | Yes | Requires building the routing layer ourselves | Requires building the routing layer ourselves |
| Lock-in risk | High (commercial, license-restricted) | High (sales-gated) | Medium (commercial) | Medium (commercial) | Low (open license) | Low, but per-feed |
| Engineering effort to reach a working answer | Low (if terms allowed it) | N/A | Low | Low | **High** (need our own trip planner) | **High** (need our own trip planner) |
| Trip-date horizon problem (100-day window) | **Yes — hard blocker today** | N/A | Not documented as limited | Not documented as limited | N/A (static schedules, not date-bound the same way) | N/A |

## 6. Static validated vs. schedule-aware — the boundary this phase must define

This project already has one precedent for "real but not schedule-aware": `validated-static`
(walking). Transit needs a second, more careful boundary, because unlike a footpath, a train
timetable genuinely changes by date, day-of-week, and season — a fact `validated-static` was
never asked to represent.

- **`static-validated`** (reusing the existing spelling convention, not a new taxonomy): a
  routed path/duration/transfer-count that does not depend on a specific calendar date — the
  physical existence of a line, its typical trip time, its typical transfer count. This is safe
  to commit as versioned JSON exactly like `walking-scale-results.json`, with the same
  `verifiedAt` discipline.
- **`schedule-aware`** (already reserved in `TransferConfidence`, unused): a result tied to an
  actual timetable for a specific date/day-of-week — a real departure and arrival time, not a
  typical duration. **A `schedule-aware` result must never be treated as evergreen.** A query
  made today for "next Tuesday" is a fact about *that* Tuesday's timetable revision, current
  service calendar, and season — not a fact that generalizes forward to February–March 2027
  just because the route exists today.

**Concretely, a `schedule-aware` result's provenance must record**, at minimum: the exact
requested departure or arrival timestamp, the *service date* the timetable answer is valid for
(not just when the query was made), and the provider's own timetable/service-calendar version if
exposed. Any consumer reading a `schedule-aware` edge must be able to tell, from the record
alone, whether it is still describing the calendar day a caller cares about — a query run today
for "typical Tuesday" must never be silently reused as if it were a query for "the specific
Tuesday in March 2027." This project does not yet have that consumer or that query, and this
phase does not build one; it only names the requirement so a future phase can't skip it.

## 7. Should the architecture be single-provider or hybrid?

Not forced either way — evaluated on the actual gap:

- **Walking** is closed and stays on openrouteservice. Nothing here changes that.
- **Non-walking, intra-hub** (`Transporte local`, `Disney Resort Line` — the actual 71-relation
  gap in §2) is exactly the kind of "urban rail/bus/metro trip" a Japan-specific commercial
  provider (NAVITIME or Ekispert) is built for, and neither ORS nor open GTFS data alone can
  answer without building a routing engine.
- **Inter-hub** (Shinkansen, domestic flight — not yet in the dataset at all, per §2) may end up
  needing a different source or a different modeling decision entirely (it might not even belong
  in `nearby.json`'s directed-relation shape, since it connects hubs, not places within one) —
  that is explicitly **not decided here** (§16).

So a **hybrid is architecturally plausible** (ORS for walking, stays; a commercial Japan transit
API for intra-hub non-walking; inter-hub treated as a separate, later question) but this phase
does **not** commit to it, because the intra-hub piece itself is not yet resolved to a specific
provider (§8/§16). Hybrid is noted as the shape the evidence points toward, not adopted as a
final architecture.

## 8. Provenance strategy (specification only)

Extending the existing, closed `TransferProvenance` discriminated union — never repurposing
`GeographicProvenance` or `RoutingProviderProvenance` — with a new member, e.g.:

```ts
type TransitProviderProvenance = {
  kind: "transit-provider";
  provider: string;        // e.g. "ekispert" | "navitime" — closed set once chosen
  mode: "static-validated" | "schedule-aware";
  requestedAt: string;                 // ISO 8601 UTC — when the query was made
  serviceDate?: string;                // ISO date the timetable answer is valid FOR
                                        // (schedule-aware only; absent for static-validated)
  timetableVersion?: string;           // provider's own schedule-revision identifier, if exposed
};
```

This is a specification for a *future* phase, not code added here — no such type exists in
`app/src/lib/transfer.ts` yet, and this phase does not add it. It is recorded so a future
integration phase has the shape agreed rather than improvised, the same way Phase 3B2E specified
`RoutingEndpoint` before Phase 3B2F ever created an access-point record.

## 9. How a future transit layer must interact with access points — without touching them now

Phase 3B2H's own findings apply directly here, and are the reason this section exists at all:

- A `Place.coordinates` display point is not always the correct logistics endpoint (`JP-029`).
- The correct endpoint can be origin-dependent (`JP-029`'s three gates), so a future transit
  resolver must not silently default to one.
- A display coordinate can misrepresent the actual arrival point entirely (`JP-181`).

The access-point model already anticipates a non-walking consumer: `AccessContext` includes
`"external-local-transit"` alongside `"external-walk"` — defined in Phase 3B2E, **still used by
zero access points today**. A future transit layer should resolve an endpoint exactly the way
Phase 3B2H's revalidation pipeline resolved a walking one: call
`getAccessPointsForContext(placeId, "external-local-transit")`, route against every eligible
point it returns (never pick one by ID, order, or distance), and fall back to the place
coordinate when the context has no eligible point — the same `AccessResolution` outcome shape
(`resolved-access-point` / `use-place-coordinate` / `ambiguous` / `unavailable`) `ACCESS_POINT_DESIGN.md`
§16 already specifies.

**Nothing here is created or changed.** No access point gains `"external-local-transit"`; no
default is set; `JP-181` is not corrected. This section only confirms the existing model does
not need to be redesigned for transit to use it later.

## 10. Recommendation

### Decision: **BLOCKED**

Not for lack of a plausible path — two candidate providers (Ekispert, NAVITIME) look genuinely
capable, and Ekispert in particular has pricing that fits a personal project. It is blocked
because committing to either now would mean deciding an architecture-defining question — *can a
schedule-aware response be cached and versioned in this repository the way every other artifact
in `data/logistics/` is, or must it be queried live* — **without having read the one document
that actually answers it**: each provider's terms of use governing caching/storage of API
responses. Google's case shows exactly why this matters: its documented policy is caching-hostile
and would force a completely different architecture than the one this project has used
successfully since Phase 3B2A. Proceeding on an unread assumption that Ekispert's or NAVITIME's
terms are more permissive would repeat, in slow motion, the same mistake Phase 3B2A's own
snapping guard exists to prevent for coordinates: treating an unmeasured fact as if it were a
measured, favorable one.

A secondary, independent open question — Okinawa/Yui-Rail and Kyoto/Osaka private-rail coverage
— was also not confirmed for any commercial candidate. Given that 23 of the current 71
non-walking relations (32 %) are in Okinawa specifically, a provider decision made without
checking that coverage risks choosing a provider that cannot answer for nearly a third of the
actual gap.

### Primary candidate (pending the unblock work in §16): **Ekispert API**

Best fit on cost (a real, non-subscription pay-as-you-go tier), on domestic breadth (rail
including Shinkansen, bus, plane, ferry, fare calculation — a closer match to "what does a
Japan trip need" than a more generic door-to-door router), and on architectural compatibility
(a directed, query-per-request shape that maps cleanly onto this project's existing
`lookupTransfer`/precomputed-artifact pattern) — contingent entirely on its unread terms of use
turning out to allow the same commit-as-static-JSON pattern this project already uses, and on
confirming Okinawa coverage.

### Secondary candidate: **NAVITIME API**

Comparable capability and an explicit timetable-based (時刻表) mode, but weaker cost fit for a
personal project ($200+/month for a usable marketplace tier vs. a 500-request trial) and the
same unread-terms problem as Ekispert.

### Not viable as evaluated

- **Google Routes** — structurally excluded: 100-day transit horizon (trip is ~5–8 months out)
  and a caching/storage policy that conflicts with this project's static-artifact architecture.
- **HERE Public Transit** — sales-gated in Japan; not self-serve.
- **ODPT / GTFS aggregators alone** — open licensing is attractive, but neither is a routing
  engine; adopting either means committing to build and operate a trip planner (e.g.
  OpenTripPlanner), which is a materially larger engineering commitment than this phase, or the
  research it's based on, was scoped to evaluate.

## 11. Risks

- **Licensing risk (primary)**: proceeding on either commercial candidate before reading its ToS
  risks discovering — after building a pipeline — that caching is prohibited, exactly as it is
  for Google.
- **Coverage risk**: Okinawa (32 % of today's non-walking gap) and Kyoto/Osaka private rail are
  unconfirmed for every commercial candidate reviewed.
- **Cost risk**: NAVITIME's realistic tier is disproportionate to a personal/portfolio project's
  budget; Ekispert's paid tier is affordable but its free tier cannot produce a schedule-aware
  result at all, so any real evaluation will cost real (small) money.
- **Scope risk**: the inter-hub gap (Shinkansen, flights) is not just unresolved but unmodeled —
  a future phase could discover `nearby.json`'s directed-relation shape itself doesn't fit an
  inter-hub relation, which is a data-model question, not a provider question.
- **Staleness risk**: a `schedule-aware` result is calendar-bound in a way `validated-static`
  never was. Building the pipeline before the provenance/versioning discipline in §6/§8 is
  actually implemented risks reintroducing exactly the "false precision" `TransferConfidence` was
  designed to prevent (`docs/LOGISTICS.md` §"Confidence taxonomy").

## 12. What was NOT decided here

- No provider was chosen for integration.
- No API key, account, or billing relationship was created for any provider.
- No caching/storage terms were confirmed for Ekispert or NAVITIME — their ToS PDFs were not
  opened this session.
- No confirmation of Okinawa or Kyoto/Osaka private-rail coverage for any commercial candidate.
- No decision on how (or whether) inter-hub relations fit `nearby.json`'s directed-relation
  shape.
- No `TransitProviderProvenance` type was added to `app/src/lib/transfer.ts`.
- No access point gained `"external-local-transit"`; no default was created; `JP-181` was not
  corrected.
- No static-vs-schedule-aware artifact format was finalized — §6/§8 are a specification, not an
  implementation.

## 13. Proposed next phase (not started)

**Phase 3B3B — Provider Terms & Coverage Confirmation** (name proposed, not authorized by this
phase): read Ekispert's and NAVITIME's actual terms of use for caching/storage of API responses;
confirm Okinawa/Yui-Rail and Kyoto/Osaka private-rail coverage for whichever survives that
reading; and only then decide PROCEED / PROCEED WITH HYBRID for the intra-hub non-walking gap
specifically. Inter-hub modeling stays a separate, later question. This phase does not start
that work, and its name is a proposal for the next session to confirm or rename, not a
commitment.

## Appendix — reproducing the dataset figures in §2

Offline, deterministic, no network, no file writes. Re-run against any future checkout to check
whether the gap has changed:

```python
import json
from collections import Counter

places = json.load(open("data/places.json"))
nearby = json.load(open("data/nearby.json"))
pilot = json.load(open("data/logistics/walking-pilot-results.json"))
scale = json.load(open("data/logistics/walking-scale-results.json"))
places_by_id = {p["id"]: p for p in places}

mode_counts = Counter(r["Modo"] for r in nearby)
walking_keys = {(r["Desde ID"], r["Hacia ID"]) for r in nearby if r["Modo"] == "A pie"}
non_walking = [r for r in nearby if r["Modo"] != "A pie"]

validated_clean, validated_not_clean, no_route = set(), set(), set()
for source in (pilot, scale):
    for r in source:
        k = (r["fromId"], r["toId"])
        if r["status"] == "validated":
            (validated_clean if (r.get("endpointSnapping") or {}).get("assessment") == "clean"
             else validated_not_clean).add(k)
        elif r["status"] == "no-route":
            no_route.add(k)

print("total:", len(nearby), "| walking:", len(walking_keys), "| non-walking:", len(non_walking))
print("mode distribution:", dict(mode_counts))
print("still estimated (walking):", len(walking_keys - validated_clean))
print("still estimated (total, incl. non-walking):",
      len(walking_keys - validated_clean) + len(non_walking))

def hub_of(pid): return places_by_id.get(pid, {}).get("hub")
intra = sum(1 for r in nearby if hub_of(r["Desde ID"]) == hub_of(r["Hacia ID"]))
print("intra-hub:", intra, "/ inter-hub:", len(nearby) - intra)
```
