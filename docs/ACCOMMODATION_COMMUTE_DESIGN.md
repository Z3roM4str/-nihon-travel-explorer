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
- Array order must not imply priority.
- Deleting an anchor invalidates day-boundary references and manual legs that point to it; no silent reassignment to another anchor.

The exact ID-generation mechanism belongs to implementation, but it must be injectable/testable if it depends on browser APIs.

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

Each day bucket needs two independent optional boundary references:

```ts
export type DayAccommodationBoundary = {
  startAccommodationId: string | null;
  endAccommodationId: string | null;
};
```

Interpretation:

- `startAccommodationId`: where the user says the day begins before its first route place;
- `endAccommodationId`: where the user says the day ends after its last route place.

The two may be equal, different, or independently null.

This supports ordinary same-hotel days and hotel-change days without inventing a cross-hotel transfer. If day N ends at Hotel A and day N+1 starts at Hotel B, this contract does **not** infer how the user moved from A to B.

### 4.1 No accommodation on an empty side

A boundary reference by itself is not a transfer. A transfer leg only exists when the day has the relevant first/last place and an exact manual leg has been recorded for that endpoint pair.

### 4.2 No default hotel

No anchor is silently assigned to a day because it is the only anchor, the nearest anchor, the most recently created anchor, or the anchor used by adjacent days. The user chooses the boundary.

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

### 5.2 Minutes

`minutes` is a finite positive integer entered by the user.

The application may display it as a manual estimate, but it must not add an invented ± range or upgrade it to `validated-static` / `schedule-aware` confidence.

A missing leg is `missing`, not `0`.

### 5.3 Optional source note is deferred

A future implementation may eventually let the user record where they looked up the duration, but Phase 3D-Q does not need to parse or trust free-text provider names. The product claim remains only that the number was user-entered.

---

## 6. Deriving the two possible legs for one day

Given a non-empty day bucket:

- outbound candidate = `startAccommodationId -> firstPlaceId`;
- return candidate = `lastPlaceId -> endAccommodationId`.

Each side is evaluated independently.

A closed result should distinguish at least:

```ts
type AccommodationBoundaryLegResult =
  | { kind: "not-applicable" }
  | { kind: "boundary-not-chosen"; side: "start" | "end" }
  | { kind: "manual-leg-missing"; side: "start" | "end"; accommodationId: string; placeId: string }
  | { kind: "manual-leg"; side: "start" | "end"; minutes: number; accommodationId: string; placeId: string };
```

No branch may call `getBestTransfer()` using an accommodation ID. No branch may derive minutes from `AccommodationAnchor.location`.

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

A combined door-to-door transfer total is safe only for the manual/recorded legs actually present.

If an expected accommodation leg is missing, the UI may show a partial subtotal but must label it as incomplete. It must never treat the missing leg as zero or claim a complete door-to-door total.

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
- `Total de traslados registrado: ... · incompleto` when a required side is missing.

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

`migrateV3ToV4` must invent nothing:

- `accommodations: []`;
- `dayAccommodationBoundaries: null`;
- `accommodationLegs: []`.

### 8.2 Reconciliation

A successor must define and test these rules explicitly:

- anchors survive route-place reordering and ordinary route edits until the user deletes the anchor;
- deleting an anchor removes boundary references and manual legs using that anchor;
- removing a place from the route prunes manual accommodation legs using that place, matching the existing no-orphan discipline for `visitStartTimes`;
- a pure place reorder preserves the exact manual legs because their identity is endpoint-based, not ordinal-position-based;
- changing a day's first/last place changes which exact manual leg is looked up; a stale duration from the former endpoint must not be reused;
- `startDate` changes do not alter accommodation anchors, boundaries, or manual leg minutes;
- if day buckets are removed, their boundary assignments do not leak into another ordinal day.

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
4. deleting one anchor never reassigns its boundaries to another.

### Directional manual legs

5. accommodation A -> place X resolves only that exact direction;
6. place X -> accommodation A is independent;
7. another accommodation never reuses A's value;
8. another place never reuses X's value;
9. missing exact leg stays missing, never zero;
10. no geometry-derived fallback;
11. no `getBestTransfer()` call with accommodation IDs;
12. no live routing/network call.

### Day boundaries

13. outbound uses exactly the current first place;
14. return uses exactly the current last place;
15. changing first place does not reuse the former outbound leg;
16. changing last place does not reuse the former return leg;
17. start and end accommodations may differ;
18. no hotel-to-hotel leg is inferred across days;
19. empty day produces no fabricated commute.

### Persistence

20. V3 -> V4 migration creates empty accommodation state only;
21. route reorder preserves endpoint-keyed legs;
22. place removal prunes its legs;
23. anchor deletion prunes its references/legs;
24. day removal does not shift a removed boundary onto another day;
25. start-date change leaves accommodation decisions untouched;
26. malformed persisted accommodation state rejects under the same fail-safe policy as the rest of the draft.

### Presentation/aggregation

27. manual legs are visibly labelled manual;
28. missing expected leg makes any combined total explicitly incomplete;
29. missing leg never contributes zero;
30. existing place-to-place transfer confidence/provenance remains visible and unchanged;
31. no copy claims real-time routing, traffic, timetable validity, hotel optimality or booking state.

---

## 13. Scope of this design gate

Phase 3D-P itself changes documentation only.

Authorized files for this phase:

- `docs/ACCOMMODATION_COMMUTE_DESIGN.md`;
- `docs/ROADMAP.md`.

No `.ts`, `.tsx`, `.css`, JSON dataset, logistics artifact, workbook, package, lockfile or persistence schema is changed by this gate.

**Phase 3D-Q or later work is NOT STARTED by this document.**
