# Accommodation Commute Design Gate (Phase 3D-P)

**Status: design/audit only. No runtime code, UI, persistence migration, dataset, routing-provider call, dependency, package, or lockfile change is authorized by this document.**

Phase 3D-P starts from `main` after Phase 3D-O and addresses the ROADMAP's still-unstarted hotel-origin/return problem. It is not a continuation of reservation timing and it does not reopen the refused opening-hours solver.

---

## 0. Executive decision

**APPROVE A NARROW MANUAL SUCCESSOR; DO NOT APPROVE AUTOMATIC HOTEL ROUTING YET.**

The current repository can truthfully add accommodation-origin/return legs only when both of these are explicit user decisions:

1. **which accommodation anchor applies at that day boundary**; and
2. **the duration of the exact directed accommodation↔place leg**, entered by the user.

A successor may then state only:

> Given the user's chosen accommodation boundary and a user-entered duration for the exact directed accommodation-to-first-place or last-place-to-accommodation leg, include that leg as a clearly labelled manual transfer in that day's logistics context. If the exact leg is absent, report it as unrecorded; never substitute zero, reverse another leg, synthesize geometry, or route live.

This gives Nihon a useful door-to-door planning primitive without fabricating transit evidence.

The recommended successor is **Phase 3D-Q — Manual Accommodation Commute Legs**. Phase 3D-Q is recommended only; it is not started or scheduled by this design gate.

---

## 1. Why this gate exists

The existing day-assignment contract intentionally breaks transfer aggregation at each day boundary. `app/src/lib/day-assignment.ts` explicitly guarantees that no cross-day commute, return-to-hotel leg, or hotel-origin leg is queried.

The existing transfer contract cannot fill that gap automatically:

- `getBestTransfer()` / `lookupTransfer()` operate on pre-recorded directed place IDs;
- no missing edge is synthesized from coordinates;
- walking routing is precomputed and versioned for known place-to-place edges, not queried at runtime;
- `TransferMode` and `TransferProvenance` describe dataset/routing artifacts, not user-authored hotel legs;
- live transit remains off.

The data model also has no accommodation entity. `Place` is a tourism POI and must not be overloaded into a lodging record merely because both have coordinates.

Phase 3D-N already identified the same boundary and required a future accommodation gate to define both an accommodation identity/location contract and an honest evidence source before a hotel commute could be represented. Phase 3D-P closes that design question.

---

## 2. Current contracts that remain authoritative

### 2.1 Day assignment stays place-only

`DayAssignment` continues to describe only the user's partition and order of route place IDs. Phase 3D-P does not insert synthetic hotel IDs into `routeIds`, `days`, `OrderedSequence`, or `nearby.json`.

Accommodation is a boundary around a day, not another tourism place in the route.

### 2.2 Existing transfer lookup stays non-fabricating

`transfer.ts` must keep these invariants:

- directed lookup only;
- no reverse-edge inference;
- no edge synthesis from geometry when a recorded edge is absent;
- no shortest-path chaining;
- no runtime provider call.

A manual accommodation leg therefore must not masquerade as a normal `TransferEdge` returned by `getBestTransfer()`.

### 2.3 Access-point data remains a different contract

`docs/ACCESS_POINT_DESIGN.md` and the later access-point implementation describe **source-backed logistics endpoints for known dataset places**. They do not provide a hotel entity model and must not be reused by pretending an arbitrary user hotel is an official place access point.

The useful architectural lesson is retained: identity/location and transfer observations are separate concepts.

### 2.4 Planning-draft persistence stores decisions, not derived results

`ManualPlanningDraftV3` already stores only user-authored planning decisions and recomputes derived facts. Any successor that persists accommodation choices therefore requires an explicit V4 migration rather than hiding new fields outside the versioned contract.

---

## 3. Accommodation identity/location contract

A successor should introduce a separate user-authored accommodation entity. It must not extend `Place`.

Illustrative domain shape:

```ts
export type AccommodationAnchor = {
  id: string;
  label: string;
  location: {
    lat: number;
    lng: number;
  };
};
```

### 3.1 Identity

- `id` is a stable local identifier generated when the user creates the anchor.
- The identifier has no geographic, hotel-chain, quality, priority, or booking meaning.
- IDs are unique within `accommodations`; a persisted V4 draft containing duplicate anchor IDs is invalid rather than first-wins/last-wins.
- Array order must not imply priority or conflict resolution.
- Two anchors with the same label and/or coordinates remain distinct unless the user explicitly deletes one; the app does not merge them heuristically.
- Deleting an anchor invalidates day-boundary references and manual legs that point to it; no silent reassignment to another anchor.

The exact ID-generation mechanism belongs to implementation, but it must be injectable/testable if it depends on browser APIs and must retry/fail safely rather than overwrite an existing anchor on collision.

### 3.2 Label

`label` is user-authored display text such as a hotel name or a neutral label (`Hotel Tokio`). It is not parsed as an address, brand, hub, or transport instruction.

### 3.3 Location

The first implementation should accept only a **user-selected map coordinate** (`lat` / `lng`) with normal geographic range validation.

This coordinate is planning context and map identity only. Under the approved Phase 3D-Q scope it must **not** be converted into transfer minutes, walking distance, transit time, or a routing result.

Why require coordinates if the first successor does not route them? Because Phase 3D-N required a real location contract rather than an opaque hotel string, and a map coordinate gives a machine-readable location without introducing geocoding. It also leaves a clean future seam for an independently gated routing phase.

### 3.4 Explicitly not part of the first contract

- no address geocoding;
- no hotel search API;
- no Booking.com/Expedia inventory model;
- no room/night/price fields;
- no check-in/check-out inference;
- no hotel quality/rating semantics;
- no automatic hub assignment from the coordinate;
- no assumption that one accommodation covers the whole trip.

---

## 4. Day-boundary accommodation contract

A trip may change hotels. A single global `hotelId` would therefore be structurally wrong.

Each day bucket needs two independent **explicit choices**, not nullable IDs whose absence is ambiguous:

```ts
export type AccommodationBoundaryChoice =
  | { kind: "unselected" }
  | { kind: "no-accommodation" }
  | { kind: "accommodation"; accommodationId: string };

export type DayAccommodationBoundary = {
  start: AccommodationBoundaryChoice;
  end: AccommodationBoundaryChoice;
};
```

Interpretation:

- `unselected`: the user has not made a decision for this side yet;
- `no-accommodation`: the user explicitly says this side of the day does not use an accommodation
  boundary (for example, an arrival/departure day whose external origin/destination is outside this
  feature); this does **not** assert that the real transfer time is zero and does not model the airport,
  station, port, or other external endpoint;
- `accommodation`: the user explicitly chose the referenced anchor for this side.

Start and end choices are independent. Their accommodation IDs may be equal or different. This
supports ordinary same-hotel days and hotel-change days without inventing a cross-hotel transfer. If
day N ends at Hotel A and day N+1 starts at Hotel B, this contract does **not** infer how the user
moved from A to B.

The distinction between `unselected` and `no-accommodation` is load-bearing. The former is missing
planning input; the latter is an explicit statement that the accommodation-commute model does not
apply on that side. Neither state contributes zero minutes.

### 4.1 Empty day buckets

An empty day has no first/last route place and therefore no accommodation commute to derive. Its
result is `not-applicable` for both sides. Phase 3D-Q should keep that boundary entry `unselected` and
reject/disable attempts to attach an accommodation choice to an empty bucket; there is no endpoint to
which such a choice could honestly connect.

### 4.2 No default hotel

No anchor is silently assigned to a day because it is the only anchor, the nearest anchor, the most recently created anchor, or the anchor used by adjacent days. The user chooses the boundary or explicitly marks that side `no-accommodation`.

---

## 5. Honest accommodation-leg evidence

The first approved evidence source is **manual user entry**.

Illustrative shape:

```ts
export type ManualAccommodationLeg =
  | {
      direction: "accommodation-to-place";
      accommodationId: string;
      placeId: string;
      minutes: number;
      source: { kind: "user-entered" };
    }
  | {
      direction: "place-to-accommodation";
      placeId: string;
      accommodationId: string;
      minutes: number;
      source: { kind: "user-entered" };
    };
```

### 5.1 Exact directed identity

The key is the full directed endpoint pair.

- Hotel A → Place X does not imply Place X → Hotel A.
- Hotel A → Place X does not imply Hotel B → Place X.
- Hotel A → Place X does not imply Hotel A → Place Y.

No reversal, nearest-match, or same-duration symmetry is allowed.

For persisted `accommodationLegs`, the exact directed key is the tuple
`(direction, accommodationId, placeId)`. At most one record may exist for any such key. Array order
has zero conflict-resolution semantics: a V4 draft containing duplicate exact keys is invalid rather
than first-wins or last-wins. A setter for one leg replaces or clears that exact key; it never appends
a second competing record.

### 5.2 Minutes

`minutes` is a **positive safe integer** entered by the user: `Number.isSafeInteger(minutes) && minutes > 0`.
Fractions, zero, negatives, `NaN`, infinities and unsafe integers are rejected rather than rounded or coerced.

The application may display it as a manual estimate, but it must not add an invented ± range or upgrade it to `validated-static` / `schedule-aware` confidence.

A missing leg is `missing`, not `0`.

### 5.3 Optional source note is deferred

A future implementation may eventually let the user record where they looked up the duration, but Phase 3D-Q does not need to parse or trust free-text provider names. The product claim remains only that the number was user-entered.

---

## 6. Deriving the two possible legs for one day

Each side is evaluated independently against the current day bucket and its explicit boundary choice.

For a non-empty day:

- start `{ kind: "accommodation", accommodationId }` looks up exactly
  `accommodationId -> firstPlaceId`;
- end `{ kind: "accommodation", accommodationId }` looks up exactly
  `lastPlaceId -> accommodationId`;
- `unselected` performs no lookup and remains an explicit incomplete-input state;
- `no-accommodation` performs no lookup and means only that this accommodation feature is not
  applicable on that side. It never supplies a zero-minute transfer.

A closed result should distinguish at least:

```ts
type AccommodationBoundaryLegResult =
  | { kind: "not-applicable"; side: "start" | "end"; reason: "empty-day" | "explicit-no-accommodation" }
  | { kind: "boundary-unselected"; side: "start" | "end" }
  | { kind: "manual-leg-missing"; side: "start" | "end"; accommodationId: string; placeId: string }
  | { kind: "manual-leg"; side: "start" | "end"; minutes: number; accommodationId: string; placeId: string };
```

No branch may call `getBestTransfer()` using an accommodation ID. No branch may derive minutes from `AccommodationAnchor.location`, and `not-applicable` never means a known zero-minute real-world leg.

---

## 7. Aggregation and product semantics

Accommodation legs must compose **outside** `OrderedSequenceSummary` so the existing place-to-place contract stays unchanged.

A successor may build a separate day-level view model such as:

```ts
type DayLogisticsWithAccommodation = {
  intraDay: OrderedSequence["summary"];
  outbound: AccommodationBoundaryLegResult;
  returnLeg: AccommodationBoundaryLegResult;
};
```

### 7.1 Complete vs partial totals

The existing `OrderedSequenceSummary.complete` invariant remains load-bearing. Accommodation data
cannot turn a partial intra-day transfer sum into a complete day total.

A numeric **registered subtotal** may add only known intra-day transfer minutes and present manual
accommodation-leg minutes. Unknown place-to-place legs, unselected boundaries, missing manual legs,
and explicit `no-accommodation` sides contribute nothing to that arithmetic — never zero.

The UI may call an accommodation-aware transfer total **complete door-to-door** only when all of the
following are true:

1. the day is non-empty;
2. `intraDay.complete === true`;
3. the start result is `manual-leg`; and
4. the end result is `manual-leg`.

If the intra-day sequence is incomplete, a boundary is `unselected`, a selected exact manual leg is
missing, or either side is explicitly `no-accommodation`, the product must not claim a complete
door-to-door total. It may show the known subtotal/components with an explicit incomplete label.
`no-accommodation` means the accommodation model is out of scope for that side, not that the external
origin/destination transfer is known to be zero.

For a one-place day, `intraDay.complete` is vacuously true and there are no intra-day minutes; if both
manual accommodation legs exist, their sum may be the complete accommodation-to-place-to-
accommodation transfer total. An empty day produces no combined transfer total.

### 7.2 Existing intra-day confidence remains visible

Accommodation minutes do not launder or strengthen the confidence of existing intra-day transfer edges. A day can contain:

- validated-static walking edges;
- geographic estimated edges;
- missing place-to-place edges;
- user-entered accommodation legs.

Those evidence classes remain distinguishable.

### 7.3 Neutral copy

Approved copy families include:

- `Salida desde alojamiento: 25 min · dato manual`
- `Regreso al alojamiento: 30 min · dato manual`
- `Traslado desde alojamiento sin registrar`
- `Regreso al alojamiento sin registrar`
- `Salida desde alojamiento: no aplica en este día` for an explicit `no-accommodation` start choice;
- `Regreso a alojamiento: no aplica en este día` for an explicit `no-accommodation` end choice;
- `Total de traslados registrado: ... · incompleto` whenever the day cannot satisfy the complete-total contract above.

Forbidden copy includes:

- `ruta óptima`;
- `tiempo real`;
- `tráfico actual`;
- `horario de tren confirmado`;
- `mejor hotel`;
- `hotel más conveniente`;
- any wording that says a user-entered duration came from Google/ORS/transit unless the product has a separately verified source contract.

---

## 8. Persistence contract for a successor

Because accommodation anchors, day boundaries, and manual leg durations are user-authored decisions, a runtime implementation should introduce **ManualPlanningDraftV4** under the existing `nihon.manualPlanningDraft` key.

Conceptually:

```ts
export type ManualPlanningDraftV4 = {
  version: 4;
  routeIds: string[];
  days: string[][] | null;
  startDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  dayAccommodationBoundaries: DayAccommodationBoundary[] | null;
  accommodationLegs: ManualAccommodationLeg[];
};
```

### 8.1 Migration

`migrateV3ToV4` must invent no accommodation decision or transfer evidence:

```ts
accommodations: [];
dayAccommodationBoundaries:
  draft.days === null
    ? null
    : draft.days.map(() => ({
        start: { kind: "unselected" },
        end: { kind: "unselected" },
      }));
accommodationLegs: [];
```

The all-`unselected` vector is structural scaffolding, not an inferred hotel choice. It is required
when a V3 draft already contains a valid day partition so the migrated V4 immediately satisfies the
same-length boundary-vector invariant below. A V3 draft with `days: null` still migrates to
`dayAccommodationBoundaries: null`.

### 8.2 Boundary-vector identity and shape

`dayAccommodationBoundaries` is positional state attached to the current ordinal day buckets. The
existing planner has no stable day IDs, so Phase 3D-Q must not pretend it can identify a former day
after an arbitrary re-split.

The persisted shape is therefore strict:

- when `days === null`, `dayAccommodationBoundaries` must also be `null`;
- when `days !== null`, `dayAccommodationBoundaries` must be a non-null array with **exactly the
  same length** as `days`;
- every position contains one explicit `DayAccommodationBoundary`; each side is a tagged
  `AccommodationBoundaryChoice`, and an undecided side is `{ kind: "unselected" }` rather than an
  omitted field or nullable ID;
- every `{ kind: "accommodation" }` choice in the boundary vector must resolve to a live anchor in
  `accommodations`; `no-accommodation` carries no anchor ID;
- an empty day bucket may persist only an all-`unselected` boundary entry;
- accommodation anchor IDs are unique and exact directed manual-leg keys are unique;
- every manual leg references an existing accommodation anchor, and its `placeId` must belong to the
  **stored** `routeIds`; an exact leg for a place outside that stored route could not have been produced
  by the approved setter and makes the stored V4 structurally invalid;
- the V4 parser rejects a length mismatch, a boundary vector present while `days` is null, a null
  vector while `days` exists, a reference to an unknown accommodation, a manual leg whose place is
  outside stored `routeIds`, duplicate anchor IDs, duplicate exact directed leg keys, or an invalid
  manual minute value. It does not pad, truncate, deduplicate, shift, infer, round, or silently repair
  those shapes.

The update rule is equally strict. If a new `days` matrix is element-for-element identical to the
stored matrix, preserve the boundary vector. If **any** part of the day assignment changes — bucket
count, bucket order, place membership, or place order within a bucket — initialize a fresh boundary
vector for the new day count with both sides `{ kind: "unselected" }`. Manual accommodation-leg
records themselves may remain because their identity is endpoint-based; they simply cannot apply
again until the user explicitly chooses the new day boundaries.

This deliberately prefers losing stale ordinal-day assignments over silently attaching Hotel A to
a different day. A future phase may preserve boundaries across richer day edits only after adding a
stable day-identity contract; similarity matching or positional shifting is not approved here.

A route-composition change already invalidates `days` under `withRoute`; V4 must therefore set
`dayAccommodationBoundaries` to `null` at the same boundary. A pure route reorder retains the exact
existing `days` matrix under the current contract and therefore retains its boundary vector.

### 8.3 Reconciliation

A successor must define and test these rules explicitly:

- anchors survive route-place reordering and ordinary route edits until the user deletes the anchor;
- deleting an anchor removes manual legs using that anchor and changes every affected `{ kind: "accommodation" }` boundary choice to `{ kind: "unselected" }`; it never rewrites the choice to `no-accommodation` or to another anchor;
- after shape parsing, reconciliation against the caller's current saved IDs prunes manual accommodation legs whose place is pruned from the route; it never rebinds that leg to another place or accommodation. This mirrors the existing parse-then-reconcile split for stale place-scoped planning state;
- a pure route-place reorder preserves the exact manual legs because their identity is endpoint-based, not ordinal-position-based;
- any non-identical `withDays` assignment clears all ordinal-day boundary choices before the new split is persisted; no old boundary is shifted or similarity-matched into the new matrix;
- changing a day's first/last place therefore requires an explicit boundary choice again, and a stale duration from the former endpoint is never applied implicitly;
- endpoint-keyed manual leg records may survive a re-split while unused; they become applicable only if the user later chooses a boundary whose exact directed endpoints match that record;
- a route-composition change that invalidates `days` also sets `dayAccommodationBoundaries` to `null`;
- `startDate` changes do not alter accommodation anchors, boundaries, or manual leg minutes.

The precise UI reducer mechanics belong to implementation, but these semantic invariants are required.

---

## 9. Interaction with multiple cities and hotel changes

The design deliberately does not bind accommodations to a hub or prefecture.

A coordinate and explicit day-boundary assignment are sufficient. This avoids creating a false rule that a Tokyo-labelled hotel cannot be used on a day whose first place is editorially assigned to another hub.

The user may create multiple anchors and use different start/end anchors on different days. No accommodation is chosen automatically from proximity.

A hotel-change day may therefore have:

- start Hotel A -> first place;
- intra-day place sequence;
- last place -> end Hotel B.

It still says nothing about luggage transfer, check-out/check-in timing, or a direct Hotel A -> Hotel B move outside those chosen day boundaries.

---

## 10. Luggage remains a separate axis

Takkyubin, station lockers, hotel luggage storage, oversized Shinkansen reservations, airport baggage, and check-in/check-out windows materially affect real travel logistics, but none is implied by accommodation commute minutes.

Phase 3D-P does not model baggage. A future luggage feature must have its own exact proposition and evidence inputs.

---

## 11. Rejected alternatives

### 11.1 Insert a hotel as a synthetic `Place`

Rejected. It pollutes tourism data, breaks source provenance, and creates fake compatibility with `nearby.json` and place-only classifiers.

### 11.2 Use the nearest dataset place as a proxy hotel endpoint

Rejected. That changes the physical origin and can materially distort the first/last commute.

### 11.3 Haversine-speed estimate from the hotel pin

Rejected for the first successor. The current app deliberately refuses to synthesize missing transfer edges from geometry, and a hotel commute is exactly where mode, network topology, station access, river crossings and luggage can dominate straight-line distance.

### 11.4 Reverse an existing manual leg

Rejected. Directionality is load-bearing throughout Nihon's logistics contract.

### 11.5 Runtime openrouteservice walking query

Rejected for Phase 3D-Q. Current ORS integration is an offline, versioned validation pipeline with snap-screening and reproducibility rules. Turning it into a per-user runtime service is a different architecture and provider-terms decision.

### 11.6 Live transit routing

Rejected. Live transit remains off and no timetable provider is activated.

### 11.7 One global hotel for the whole trip

Rejected. The target Japan trip can span multiple cities and accommodations; a global value would silently produce false boundary legs on hotel-change days.

### 11.8 Infer hotel from booking data

Rejected. Nihon has no lodging booking integration or booking-record contract.

---

## 12. Testing contract for Phase 3D-Q

A successor should prove at least:

### Identity/location

1. coordinates reject non-finite and out-of-range values;
2. labels are displayed, not parsed into routing semantics;
3. multiple anchors coexist without implicit priority;
4. duplicate accommodation IDs are rejected rather than resolved by array order;
5. equal labels/coordinates do not heuristically merge distinct anchor IDs;
6. deleting one anchor never reassigns its boundaries to another.

### Directional manual legs

7. accommodation A -> place X resolves only that exact direction;
8. place X -> accommodation A is independent;
9. another accommodation never reuses A's value;
10. another place never reuses X's value;
11. duplicate exact directed leg keys are rejected rather than first-wins/last-wins;
12. setting an existing exact leg replaces that record rather than appending a duplicate;
13. manual minutes accept only positive safe integers and reject fractions, zero, negatives and unsafe values without coercion;
14. missing exact leg stays missing, never zero;
15. no geometry-derived fallback;
16. no `getBestTransfer()` call with accommodation IDs;
17. no live routing/network call.

### Day boundaries

18. `unselected` and explicit `no-accommodation` are distinct states;
19. `no-accommodation` performs no accommodation-leg lookup and never contributes zero minutes;
20. outbound with an accommodation choice uses exactly the current first place;
21. return with an accommodation choice uses exactly the current last place;
22. changing first place does not reuse the former outbound leg;
23. changing last place does not reuse the former return leg;
24. start and end accommodations may differ;
25. no hotel-to-hotel leg is inferred across days;
26. empty day produces `not-applicable` and cannot retain a selected accommodation boundary.

### Persistence

27. V3 -> V4 migration with `days: null` creates `dayAccommodationBoundaries: null`, while a V3 draft with existing days creates an exactly same-length all-`unselected` vector and no accommodation/leg evidence;
28. route reorder preserves endpoint-keyed legs and, when the existing day matrix is retained exactly, its boundary vector;
29. a persisted manual leg whose `placeId` is outside the stored route is rejected as malformed, while a leg whose formerly-live place is later removed from current saved IDs is pruned during reconciliation without rebinding;
30. anchor deletion prunes its legs and changes affected accommodation choices to `unselected`, never to another anchor or `no-accommodation`;
31. any non-identical valid day assignment resets every new ordinal-day boundary side to `{ kind: "unselected" }` rather than shifting or similarity-matching old boundaries;
32. an element-for-element identical day assignment preserves the existing boundary vector;
33. `days === null` requires a null boundary vector, while a non-null `days` matrix requires a boundary vector of exactly the same length;
34. persisted boundaries referencing an unknown accommodation are rejected, never silently cleared or rebound;
35. persisted manual legs referencing an unknown accommodation or out-of-route place are rejected/pruned only according to the explicitly defined parse-then-reconcile boundary, never rebound to another endpoint;
36. start-date change leaves accommodation decisions untouched;
37. malformed persisted accommodation state rejects under the same fail-safe policy as the rest of the draft.

### Presentation/aggregation

38. manual legs are visibly labelled manual;
39. `intraDay.complete === false` forbids a complete day transfer-total claim even when both accommodation legs are present;
40. an unselected boundary makes any accommodation-aware combined total incomplete;
41. a missing selected accommodation leg makes any combined total incomplete;
42. explicit `no-accommodation` never upgrades the registered subtotal into a complete door-to-door claim;
43. missing/unknown legs never contribute zero;
44. existing place-to-place transfer confidence/provenance remains visible and unchanged;
45. a one-place day with both manual accommodation legs can produce a complete accommodation-to-place-to-accommodation transfer total;
46. an empty day produces no combined transfer total;
47. no copy claims real-time routing, traffic, timetable validity, hotel optimality or booking state.

---

## 13. Scope of this design gate

Phase 3D-P itself changes documentation only.

Authorized files for this phase:

- `docs/ACCOMMODATION_COMMUTE_DESIGN.md`;
- `docs/ROADMAP.md`.

No `.ts`, `.tsx`, `.css`, JSON dataset, logistics artifact, workbook, package, lockfile or persistence schema is changed by this gate.

**Phase 3D-Q or later work is NOT STARTED by this document.**
