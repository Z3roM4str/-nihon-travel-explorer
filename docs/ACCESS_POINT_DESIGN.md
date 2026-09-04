# Phase 3B2E — Access-Point Override Design

**Design-only.** This phase defines the data contract and architecture for optional logistics access points without changing any current place coordinate, routing result, runtime behavior, threshold, dataset row, or UI.

## 1. Problem statement

The current `Place` model has one coordinate. Phase 3B2D showed that this single coordinate is serving two different purposes:

- **Display / identity coordinate** — where the POI is shown and what visually represents the place.
- **Logistics access point** — where a routing request should actually enter/leave the place.

Those are often identical for small point venues, but they diverge for large or structured places such as a palace garden with multiple gates, a beach with a distinct road/transit access, or a multi-stage hiking venue with reception and trailhead separated by an internal shuttle.

The architectural problem is therefore not “some coordinates are globally too far from the routing graph.” It is that some places have more than one legitimate physical point depending on the logistics question being asked.

## 2. Goals

The design must:

- preserve the existing `Place` coordinate as the canonical display coordinate;
- allow `0..N` logistics access points per place;
- support multiple gates and multi-stage venues;
- be provider-independent;
- allow applicability by logistics/routing context without overloading `TransferMode`;
- require provenance for every access point;
- give access points stable identifiers;
- remain auditable and reversible;
- fail safely when evidence or selection is insufficient;
- preserve the historical meaning of already-versioned routing results.

## 3. Non-goals

This phase does **not**:

- create `access-points.json`;
- add TypeScript runtime types;
- add loaders or validators;
- change `places.json` or the source workbook;
- add any real coordinates;
- change `getBestTransfer()`;
- reroute any walking edge;
- change Snap thresholds;
- modify pilot/scale result artifacts;
- implement UI;
- start transit validation, sequencing, itinerary generation, or Phase 3C.

## 4. Current evidence

Phase 3B2D identified four important shapes:

- **JP-029 — Imperial Palace East Gardens:** one POI, three official visitor gates. A single access-point field is insufficient.
- **JP-181 — ASMUI Spiritual Hikes:** reception, internal shuttle stage, and hiking start are physically distinct. Not every internal stage is appropriate as an external routing endpoint.
- **JP-185 — Furuzamami Beach:** an official named transit stop exists separately from the beach POI, making a display/access distinction plausible.
- **JP-064 / JP-069:** insufficient evidence. The correct representation is **no access point yet**, not a placeholder.
- **JP-090 — Kyoto Imperial Palace:** clean Snap but repeated `no-route` outcomes. Access-point modeling may help future routing, but the historical `no-route` answers alone do not justify inventing a replacement endpoint.

See `docs/WALKING_EXCEPTIONS_AUDIT.md` for the source-backed evidence and confidence assessments.

## 5. Chosen storage architecture

### Decision: separate versioned logistics artifact

The preferred future storage is a dedicated logistics artifact:

```text
data/logistics/access-points.json
```

and, once runtime consumption exists, an app-facing copied artifact following the same reproducibility pattern already used for logistics data.

### Why not add fields directly to `places.json`

`places.json` is the normalized tourism/domain dataset and currently represents the identity and display location of each place. Access points are different in several ways:

- they are **logistics metadata**, not basic POI identity;
- they may be absent for almost every place;
- they can be multiple per place;
- they can vary by logistics context;
- they need their own evidence/provenance lifecycle;
- they may be added or revised without changing the source tourism workbook;
- historical routing artifacts need to identify which logistics endpoint was used without implying that the POI coordinate itself changed.

Keeping them separate avoids turning the tourism master into a routing-entrance database and keeps the migration incremental.

### Why not store them inside routing results

Routing results are observations of a query, not the authoritative catalog of endpoints. Embedding access-point definitions only inside results would duplicate definitions, make reuse difficult, and blur the distinction between “what endpoint exists” and “what happened when it was routed.”

## 6. Proposed persisted data contract

Conceptual TypeScript equivalent for the future JSON schema:

```ts
type AccessPointRole =
  | "visitor-entrance"
  | "gate"
  | "reception"
  | "trailhead"
  | "road-access"
  | "transit-stop"
  | "general-access";

type AccessContext =
  | "external-walk"
  | "external-local-transit"
  | "internal-shuttle"
  | "internal-hike";

type AccessPointConfidence =
  | "official-explicit"
  | "official-derived";

type AccessPointProvenance = {
  sourceUrl: string;
  sourceEntity: string;
  consultedAt: string; // YYYY-MM-DD
  evidence: string;
  confidence: AccessPointConfidence;
};

type LogisticsAccessPoint = {
  id: string;
  placeId: string;
  label: string;
  role: AccessPointRole;
  coordinates: {
    lat: number;
    lng: number;
  };
  applicableContexts: AccessContext[];
  provenance: AccessPointProvenance;
  selection: {
    defaultForContexts?: AccessContext[];
  };
  status: "active" | "deprecated";
  notes?: string;
};
```

The persisted JSON should use named `{lat, lng}` fields rather than `[number, number]` to avoid coordinate-order ambiguity. Provider request adapters remain responsible for converting to any provider-specific order such as `[lng, lat]`.

## 7. Identity rules

Every access point needs a stable identifier independent of its floating-point coordinates.

### Proposed convention

```text
AP-<PLACE_ID>-<NNN>
```

Examples:

```text
AP-JP-029-001
AP-JP-029-002
AP-JP-181-001
```

Rationale:

- stable and human-auditable;
- namespaced by place;
- does not encode mutable semantics such as gate name or role;
- supports more than one point per place;
- can be referenced by future routing artifacts without repeating coordinate identity.

The ordinal is an identifier only. It must never imply priority, preferred order, or routing selection.

## 8. Roles

The initial role vocabulary should remain small and physical:

- `visitor-entrance` — specifically documented public visitor entry;
- `gate` — named gate where “visitor entrance” would overstate evidence;
- `reception` — arrival/check-in point for a facility;
- `trailhead` — physical start of a trail or hike;
- `road-access` — documented road-side access where no more specific role is supported;
- `transit-stop` — named transit stop directly associated with the place;
- `general-access` — official access point whose physical role is not more specifically classified.

Unknown future roles should not be silently stored as arbitrary strings. The closed vocabulary should be extended deliberately when a real evidenced case requires it.

## 9. Mode/context applicability

### Decision: do not reuse `TransferMode`

`TransferMode` describes the mode of an existing transfer relation (`walk`, `local-transit`, `disney-resort-line`). Access points need to express **endpoint applicability**, including internal stages that are not transfer modes in the current nearby domain.

Therefore use a separate closed vocabulary, provisionally called `AccessContext`:

- `external-walk`
- `external-local-transit`
- `internal-shuttle`
- `internal-hike`

This avoids expanding `TransferMode` merely to model venue structure.

The context list describes where the point may be used, not what travel mode the global trip planner supports. New values should only be added when a real use case appears.

## 10. Provenance model

Every active access point must carry provenance. No provenance means no valid access point.

Required fields:

- `sourceUrl`
- `sourceEntity`
- `consultedAt`
- `evidence`
- `confidence`

### Optional fields deliberately omitted initially

`sourceTitle`, `validFrom`, `validUntil`, and `lastVerifiedAt` may be useful later, but are not required for the first schema. Adding them now would create empty or speculative metadata without a demonstrated operational need.

A future validator may warn when `consultedAt` is old for access points whose physical access is likely to change, but recency policy should be defined separately rather than embedded as an arbitrary expiration date.

## 11. Confidence model

This confidence is distinct from `TransferConfidence`.

Initial allowed values:

- `official-explicit` — the official source directly identifies the exact physical point being represented (for example, a named visitor gate with a verifiable location).
- `official-derived` — the official source establishes the access concept/location sufficiently to derive the point, but does not itself publish the exact coordinate in the persisted form.

No `secondary-derived` value should be allowed in the first implementation. Phase 3B2D established an official-source standard for real overrides; weakening that standard during schema creation would undermine the audit discipline.

If only secondary evidence exists, the system should have **no access point**, not a lower-quality one.

## 12. Multi-access-point semantics

A place may have multiple eligible access points. The array order and identifier order carry **zero selection semantics**.

### Selection rules

A future caller should resolve access points using one of these explicit paths:

1. **Explicit selection:** caller supplies `accessPointId`. This is always unambiguous.
2. **Evidence-backed default:** an access point may be marked as default for one or more `AccessContext` values, but only when the source or product decision explicitly justifies that default.
3. **Multi-candidate routing:** when no justified default exists and the routing task can evaluate multiple endpoints, route all eligible candidate combinations and select later using actual routed outcomes under a documented algorithm.
4. **Ambiguous case:** if multiple eligible access points exist, no justified default exists, and multi-candidate routing is not supported by that caller, resolution must return an explicit ambiguity outcome rather than silently choosing one.

Forbidden selection mechanisms:

- first array element;
- lowest/highest access-point ID;
- nearest by raw haversine distance unless an explicitly documented algorithm calls for it;
- arbitrary “closest gate” without stating the origin and selection rule;
- hidden provider-dependent choice.

### Default constraint

For any `(placeId, AccessContext)` pair, at most one active access point may claim `defaultForContexts` for that context.

## 13. ASMUI and multi-stage venues

Access points must distinguish **external arrival** from **internal experience stages**.

For a conceptual JP-181 record:

- reception could be `role: "reception"`, `applicableContexts: ["external-walk", "external-local-transit"]`;
- trailhead could be `role: "trailhead"`, `applicableContexts: ["internal-hike"]`;
- an internal shuttle stage could use `applicableContexts: ["internal-shuttle"]` only if the evidence supports a distinct point worth representing.

`getBestTransfer()` or any future external city-to-POI walking resolver must **not** automatically choose an `internal-hike` or `internal-shuttle` point.

The context boundary, not array position or role naming, controls eligibility.

## 14. Routing endpoint semantics

Future routing results need to record the endpoint identity actually queried.

Recommended discriminated union:

```ts
type RoutingEndpoint =
  | {
      kind: "place-coordinate";
      placeId: string;
    }
  | {
      kind: "access-point";
      placeId: string;
      accessPointId: string;
    };
```

A future result should persist both `fromEndpoint` and `toEndpoint` alongside the exact query coordinates already stored for auditability.

The endpoint identity answers **which catalogued point was intended**; the query coordinate answers **what bytes were actually sent to the provider**. Both are needed.

## 15. Historical-result compatibility

`walking-pilot-results.json` and `walking-scale-results.json` remain immutable historical answers to requests made with the original place coordinates.

They must never be retrospectively interpreted as if an access point had been used.

Migration rule:

- historical result without endpoint identity => semantically `place-coordinate` for both ends;
- do not rewrite the existing artifacts merely to add that explicit annotation;
- new-generation routing artifacts created after access-point support should persist explicit `RoutingEndpoint` identities from creation time.

This preserves audit history and avoids silently changing the meaning of a provider response.

## 16. Runtime fallback behavior

The future endpoint resolver should return a typed resolution outcome rather than always returning coordinates.

Conceptually:

```ts
type AccessResolution =
  | { kind: "resolved-access-point"; accessPointId: string }
  | { kind: "use-place-coordinate" }
  | { kind: "ambiguous"; candidateAccessPointIds: string[] }
  | { kind: "unavailable"; reason: string };
```

Rules:

- **No access points for place:** use the existing place coordinate.
- **No access point matches requested context:** use the place coordinate unless the caller explicitly requires an access-point-only route.
- **Exactly one eligible active access point:** use it.
- **Multiple eligible points with exactly one justified default for context:** use the default.
- **Multiple eligible points with no default:** return `ambiguous`, unless the caller explicitly supports multi-candidate routing.
- **Deprecated point:** never automatically select it; it remains resolvable only for historical references.
- **Invalid/incomplete provenance:** validator error; artifact must not be published/consumed as valid.
- **Missing place reference:** validator error.

Fallback to the display coordinate is therefore explicit, not silent guesswork.

## 17. Validation rules

### Hard errors

A future `validate-access-points.py` (or equivalent integration into logistics validation) should fail on:

- unknown `placeId`;
- globally duplicate access-point `id`;
- identifier whose place namespace does not match `placeId` if the chosen ID convention is adopted;
- latitude outside `[-90, 90]`;
- longitude outside `[-180, 180]`;
- missing provenance field;
- malformed/empty source URL or source entity;
- invalid `consultedAt` format;
- unknown role;
- unknown access context;
- empty `applicableContexts`;
- unknown confidence value;
- active access point with no valid provenance;
- more than one active default for the same `(placeId, context)`;
- deprecated point marked as a current default;
- exact duplicate active coordinates for the same place/context/role when they are represented as separate IDs without documented justification;
- references from routing artifacts to missing access-point IDs.

### Warnings

Warnings are more appropriate for:

- two distinct access points for one place that are extremely close but carry different roles;
- an old `consultedAt` date under a future documented recency policy;
- multiple eligible points with no default (this may be fully intentional, e.g. JP-029);
- access point defined but currently unused by any routing artifact.

A warning must never silently choose or mutate an endpoint.

## 18. Conceptual examples

These examples intentionally contain **no real replacement coordinates**.

### JP-029 — three gates

```text
AP-JP-029-001 — Ote-mon Gate — role=gate — contexts=[external-walk]
AP-JP-029-002 — Hirakawa-mon Gate — role=gate — contexts=[external-walk]
AP-JP-029-003 — Kitahanebashi-mon Gate — role=gate — contexts=[external-walk]
```

No coordinates are supplied in this design phase, and no gate is marked default because Phase 3B2D did not justify one.

### JP-181 — reception vs. trailhead

```text
AP-JP-181-001: reception, contexts = external-walk / external-local-transit
AP-JP-181-002: trailhead, contexts = internal-hike
```

The external transfer resolver sees the reception candidate, not the trailhead.

### JP-064 / JP-069 — insufficient evidence

```text
(no access-point records)
```

“Unknown access” is represented by absence, never by fabricated coordinates or placeholder entries.

### JP-090 — no-route anomaly

The existing ORS `no-route` results remain untouched. A future access point for JP-090 may only be added if independent evidence identifies a concrete public routing endpoint and its coordinate. `no-route` itself is not provenance.

## 19. Migration strategy

### Stage 0 — current state

- no access-point artifact;
- current `Place` coordinates and `getBestTransfer()` behavior unchanged.

### Stage 1 — data foundation only

- create schema/type/validator and an empty-or-evidenced `access-points.json` artifact;
- runtime does not consume it;
- no routing requests.

### Stage 2 — evidenced access points only

- add records only for cases with sufficiently strong official evidence;
- no placeholder records for JP-064/JP-069-style uncertain cases;
- still no automatic historical-result rewrite.

### Stage 3 — explicit routing opt-in

- routing pipeline can resolve an endpoint explicitly by `accessPointId` or documented selection semantics;
- result records `RoutingEndpoint` identities;
- place-coordinate routing remains available.

### Stage 4 — targeted revalidation

- reroute **only affected/approved edges** where access-point use materially addresses a known exception;
- compare new results against historical place-coordinate results without overwriting them;
- do not regenerate all 332 walking edges merely because the model exists.

No big-bang migration is allowed.

## 20. Risks and open questions

- Exact coordinate evidence may be harder to source than evidence that a named access exists.
- Multiple legitimate gates may make “best” endpoint trip-origin-dependent; this is not solvable by a static default in every case.
- Some places may need context beyond the initial vocabulary; extend only when evidenced.
- Transit stop modeling may eventually overlap with schedule-aware transit data. The access-point layer should identify a place endpoint, not become a timetable database.
- Deprecation/versioning policy needs to preserve historical access-point IDs used by old routing artifacts.
- A future implementation must decide whether multi-candidate routing belongs in the offline pipeline only or also in application-side planning logic. It must never make hidden network calls at runtime.

## 21. Recommendation for the next implementation phase

### Phase 3B2F — Access-Point Data Foundation

The next phase should implement **only Stage 1**:

- introduce the typed access-point contract;
- create the versioned logistics artifact;
- add validator coverage;
- add lookup/read primitives that do **not** change `getBestTransfer()` or routing behavior;
- populate no speculative real coordinates unless the phase separately verifies and approves evidence for them;
- keep historical walking artifacts unchanged;
- make zero ORS requests.

A later, separately approved phase should populate strong-evidence access points and only after that should any routing pipeline opt into them.

This sequencing keeps the architecture testable before it can affect any travel estimate.