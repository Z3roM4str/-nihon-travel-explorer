# Phase 3D-R — Stable Day Identity Design Gate

## 1. Executive decision

**APPROVE a narrow stable-day-identity implementation.**

Phase 3D-Q deliberately stores accommodation boundary choices against **ordinal day positions**. Its safety rule is therefore conservative: any non-identical day matrix resets every start/end accommodation choice to `unselected`, because the planner has no durable fact proving that an old bucket and a new bucket are the same user-authored day.

That rule is correct for V4, but it creates avoidable data loss for ordinary manual edits such as reordering places inside one day or moving one place between two existing days. The next safe step is to give each persisted day bucket an opaque stable local id and bind that day's accommodation boundary to the same entity.

This gate approves only that identity/persistence change. It does **not** approve automatic day matching, automatic hotel routing, itinerary optimization, scheduling, luggage logic, hotel recommendation, or any new transport evidence.

Recommended successor: **Phase 3D-S — Stable Day Identity Runtime**. Phase 3D-S is not started by this document.

---

## 2. Current V4 boundary and the real defect class

`ManualPlanningDraftV4` stores:

```ts
type ManualPlanningDraftV4 = {
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

The two arrays `days` and `dayAccommodationBoundaries` are aligned **by index**. V4 correctly requires equal lengths and resets the boundary vector whenever `withDays(...)` receives any non-identical matrix.

The problem is not that V4 is wrong. The problem is that V4 has no fact stronger than index equality.

Examples V4 cannot safely distinguish:

1. Día 1 keeps the same conceptual identity but its places are reordered.
2. One place moves from Día 1 to Día 2 while both day buckets continue to exist.
3. A new empty day is inserted before an existing day, shifting every later ordinal index.
4. Two empty days exist: both have identical `[]` content, so content equality cannot identify either one.
5. The first or last place changes while the user's accommodation choice for that day is still the same hotel.

Without a stable id, preserving a boundary in those cases would require a heuristic. V4 correctly refuses that heuristic and loses the boundary choices instead.

---

## 3. Identity contract

### 3.1 A day becomes a persisted entity

A future V5 should represent a day as an object with one opaque stable id:

```ts
type PlanningDayV5 = {
  id: string;
  placeIds: string[];
  accommodationBoundary: DayAccommodationBoundary;
};
```

The exact public type name may differ, but the semantics may not.

### 3.2 What the id means

The id means only:

> this is the same user-authored day bucket across manual edits that preserve that bucket.

It carries **no** meaning about:

- ordinal position;
- calendar date;
- weekday;
- hub, city, prefecture or region;
- accommodation;
- first/last place;
- number of places;
- route quality;
- itinerary recommendation;
- creation time or priority.

### 3.3 Identity is id-only

Two days are the same day iff their persisted ids are equal.

The implementation must never infer identity from:

- array index;
- equal or similar `placeIds`;
- first/last place;
- accommodation choice;
- calendar date;
- label such as `Día 1`;
- creation order;
- geographic similarity;
- edit distance or any matching score.

This prohibition is load-bearing. Content-based matching is inherently ambiguous for empty days and can silently transfer a hotel choice to the wrong bucket.

### 3.4 Ordinality remains array order

The visible label `Día N` remains derived from the day's current array position.

A stable id does **not** freeze a date or ordinal number. If a future supported action reorders day entities, the id travels with the day, while the derived civil date changes because `startDate + ordinal offset` is still the existing calendar contract.

Changing `startDate` never changes a day id.

---

## 4. V5 persistence shape

The preferred shape is:

```ts
type ManualPlanningDraftV5 = {
  version: 5;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
};
```

This intentionally removes the separate positional `dayAccommodationBoundaries` vector. The boundary belongs to the stable day entity itself.

Reasons:

1. impossible array-length drift between days and boundaries;
2. impossible accidental boundary shifting by positional splice;
3. parser invariants become local to each day object;
4. deleting a day deletes its boundary structurally;
5. moving/reordering a day carries its boundary automatically.

`accommodationLegs` remains separate and endpoint-keyed exactly as Phase 3D-Q defined it. Day identity must not be added to a manual leg key.

---

## 5. V4 → V5 migration

Migration must preserve every existing user decision and invent no semantic decision.

For each V4 day at index `i`:

- copy `placeIds` exactly;
- copy `dayAccommodationBoundaries[i]` exactly;
- assign one deterministic migration-only stable id.

A safe migration namespace is, illustratively:

```text
legacy-v4-day-0
legacy-v4-day-1
...
```

The exact prefix is an implementation detail, but the following rules are mandatory:

- deterministic across repeated parsing of the same V4 draft;
- unique within the migrated draft;
- derived only from the historical structural position required to create identity once;
- never recomputed after V5 exists;
- never interpreted later as the day's current ordinal position.

This migration does **not** infer that a hotel belongs to a day: V4 already contains that explicit boundary choice. It only packages the existing positional pair into one stable entity.

If `days === null`, V5 keeps `days: null`.

No accommodation anchor, manual leg, visit time, date, route id or boundary choice is created, removed, changed or rebound by migration.

---

## 6. New-day id creation

A day created after migration receives a fresh opaque local id from an injected id factory, following the same collision-safe pattern Phase 3D-Q already uses for accommodation ids.

Requirements:

- non-empty string;
- unique among current day ids;
- collision fails safely or retries within a bounded attempt count;
- no overwrite;
- no id derived from date, index, place ids, hotel id or coordinates;
- no array order semantics.

A UUID-backed browser factory is acceptable. Tests must inject the factory rather than depend on browser randomness.

---

## 7. Strict parser invariants

A V5 parser should preserve V4's all-or-nothing corruption policy.

Reject the whole stored V5 draft when any of these hold:

- `days` is neither `null` nor an array of valid day objects;
- any day id is empty;
- duplicate day ids exist;
- any `placeIds` value is malformed;
- the flattened day partition violates the existing `validateDayPartition(routeIds, ...)` contract;
- an empty day has a boundary whose start or end is not `unselected`;
- a boundary contains an unknown accommodation id;
- any inherited V4 accommodation/manual-leg invariant fails;
- any inherited V1–V4 route/date/visit-time invariant fails.

Do not repair, renumber, deduplicate, content-match, shift, merge or regenerate persisted V5 ids.

A duplicate id is corruption, not evidence that two day records should merge.

---

## 8. Identity-aware edit semantics

The implementation should stop treating every ordinary UI edit as a wholesale replacement of a `string[][]` matrix. Stable identity is valuable only if mutations operate on day entities.

### 8.1 Reorder places inside one day

- same day id;
- same accommodation boundary choices;
- same manual accommodation-leg records;
- recompute first/last endpoints from current `placeIds`;
- an old manual leg simply becomes unused if its endpoint no longer matches;
- never rebind a leg to the new endpoint.

### 8.2 Move one place from Day A to Day B

- Day A id survives;
- Day B id survives;
- each day's accommodation boundary survives **if that day remains non-empty**;
- manual legs survive because they remain exact endpoint-keyed evidence;
- derived boundary result is recomputed from each day's new first/last place;
- if no matching leg exists, result becomes `manual-leg-missing`, never a reused old duration.

This is the principal product benefit of the phase: the user's hotel choice can survive while endpoint evidence remains exact and conservative.

### 8.3 A day becomes empty

An empty day has no first/last place and Phase 3D-Q already forbids an accommodation decision there.

Therefore when an edit removes the last place from a day:

- preserve the day id;
- reset both boundary sides to `unselected` immediately;
- do not retain a hidden/restorable previous boundary;
- do not convert it to `no-accommodation`;
- manual endpoint legs remain independent records and are not deleted solely because this day became empty.

If a place is later moved back into that same day id, the boundary stays `unselected`. The old choice is not resurrected.

### 8.4 Add an empty day

- create one fresh day id;
- `placeIds: []`;
- both boundary sides `unselected`;
- no accommodation inferred;
- no date stored on the day.

### 8.5 Delete an empty day

Under the current UI contract only an empty day is deletable.

Deleting it deletes:

- that day id;
- its necessarily-unselected boundary.

It does **not** delete:

- accommodation anchors;
- endpoint-keyed manual legs;
- visit start times;
- start date;
- any other day.

### 8.6 Day-order change, if ever exposed

Day-order editing is not required by the successor, but identity semantics must be defined now.

If an existing day object moves to another ordinal position:

- its id travels with it;
- its accommodation boundary travels with it;
- its `placeIds` travel with it;
- its derived `Día N` label and civil date change with the new array position;
- no id is regenerated.

This is not itinerary optimization; it is merely the semantics of an explicit user move.

---

## 9. Bulk replacement / compatibility boundary

A raw `withDays(draft, string[][])` API cannot, by itself, identify which changed bucket is which without reintroducing the heuristic this phase exists to eliminate.

Therefore a V5 implementation should prefer explicit identity-aware mutations for UI operations.

If a compatibility bulk setter remains, its contract must be conservative:

1. if the incoming matrix is element-for-element identical to the current matrix, preserve every current day id and boundary;
2. otherwise it must **not** similarity-match old and new buckets;
3. the safest fallback is to create an entirely new set of day entities with fresh ids and all-`unselected` boundaries, while leaving exact endpoint-keyed manual legs untouched.

A different fallback is acceptable only if it is equally non-heuristic and documented before implementation. Positional carry-over after a changed matrix is not acceptable.

---

## 10. Route composition and reconciliation remain conservative

This gate does not reopen Phase 3C-D/V4's existing route-composition rule.

When route composition changes in a way that the existing planning-draft contract invalidates `days`:

- V5 also sets `days: null`;
- all day identities and their embedded boundaries disappear with the invalidated day assignment;
- accommodation anchors survive;
- manual accommodation legs are pruned only for places that left the route, exactly as V4;
- `startDate` remains independent;
- surviving per-place visit start times follow the existing rule.

Stable day identity is not permission to preserve an assignment the existing route contract says no longer exists.

`resetRoute` likewise keeps the current behavior: it clears the day assignment entirely. No day id survives a state in which there is no day assignment.

---

## 11. Calendar semantics

Stable day identity and calendar anchoring are orthogonal.

- `startDate` remains one trip-level field.
- civil date for a day remains `addCivilDays(startDate, ordinalIndex)`.
- no date is persisted inside a day entity.
- changing/clearing `startDate` preserves all day ids, place membership/order and accommodation boundaries.
- inserting/removing/reordering day entities changes downstream ordinal dates by construction, without changing their identity.

A day id is never a date id.

---

## 12. Accommodation semantics after stable identity

Stable identity strengthens **decision preservation**, not transport evidence.

The following remain unchanged from Phase 3D-Q:

- accommodation is not a `Place`;
- coordinates create no minutes;
- exact directed manual legs are the only approved accommodation-transfer evidence;
- missing is missing, never zero;
- reverse/sibling inference is forbidden;
- `getBestTransfer()` never receives accommodation ids;
- a complete door-to-door total still requires complete intra-day transfers plus both manual boundary legs;
- `no-accommodation` is never a zero-minute leg.

The new rule is only:

> an explicit accommodation choice belongs to a stable user-authored day entity, so ordinary edits to that same day need not erase the choice.

Endpoint evidence still recomputes against the current first/last place every time.

---

## 13. UI boundary

The narrow successor needs no new planning mode and no new visual surface.

Existing `Distribuir por días` UI can keep rendering `Día 1`, `Día 2`, … from array position.

A stable id should normally be invisible to the user.

Expected behavioral improvements:

- reorder places inside a day → hotel selections remain;
- move a place between existing non-empty days → hotel selections remain for both days;
- if an endpoint changes and no exact manual duration exists → UI shows `sin registrar` for the new endpoint;
- emptying a day → its hotel choices clear to unselected;
- adding a day → only that new day starts unselected.

No UI may imply the app recognized that two *new* buckets are the same by similarity. Identity is explicit internal state, not an AI/heuristic match.

---

## 14. Test strategy for the successor

At minimum, the implementing phase should prove:

### Migration / parser

- V4 null-days → V5 null-days;
- V4 day matrix + boundary vector migrate one-to-one with deterministic unique ids;
- migration preserves every existing boundary exactly;
- repeated migration of the same V4 shape yields the same migration ids;
- duplicate V5 day ids reject the whole draft;
- empty day + selected boundary rejects;
- unknown accommodation reference rejects;
- inherited V4 corruption tests remain green.

### Identity

- reorder within a day preserves id/boundary;
- move place A→B preserves both ids;
- adding an empty day mints exactly one new id;
- deleting one empty day removes only that id;
- changing startDate preserves every id;
- identical bulk matrix preserves ids;
- non-identical compatibility bulk matrix never positional- or similarity-matches ids.

### Empty-day rule

- moving the last place out preserves the day id but resets both boundary sides to unselected;
- moving a place back does not resurrect old choices.

### Endpoint evidence

- changing first place keeps accommodation choice but resolves the new exact accommodation→place key;
- changing last place keeps accommodation choice but resolves the new exact place→accommodation key;
- absent new key is `manual-leg-missing`;
- reverse/old endpoint leg is never reused;
- unused exact manual legs remain persisted unless their place/anchor is otherwise deleted by existing rules.

### Integration

- one canonical V5 planning state in the hook;
- same `nihon.manualPlanningDraft` storage key;
- no second day-id store/localStorage key;
- existing visible ordinal labels remain correct;
- no new routing/geocoding/provider call;
- no new dependency required.

---

## 15. Explicit non-goals

This gate does not authorize:

- automatic day matching by content/similarity;
- automatic day generation or distribution;
- recommended day order;
- itinerary optimization, TSP, nearest-neighbour or scoring;
- automatic accommodation selection;
- hotel search, inventory, pricing or booking integration;
- geocoding;
- geometry-derived accommodation minutes;
- runtime ORS/Google/other routing;
- live transit;
- hotel-to-hotel transfer inference;
- check-in/check-out inference;
- luggage/takkyubin modelling;
- arrival/departure-time chaining;
- timezone or absolute-instant scheduling;
- a new trip-end-date model.

---

## 16. Decision and successor boundary

Stable day identity is justified now because Phase 3D-Q created the first persisted state whose correctness is directly tied to a day bucket rather than merely to place ids or exact transfer endpoints. V4's reset-on-any-difference rule is safe but unnecessarily destructive once the user edits an existing day.

The approved solution is deliberately small:

1. introduce opaque persistent day ids;
2. embed each accommodation boundary with its day entity;
3. migrate V4 positionally **once** without changing any existing decision;
4. use identity-aware mutations so existing day ids survive ordinary manual edits;
5. keep all current conservative endpoint/manual-leg semantics unchanged.

**Recommended successor: Phase 3D-S — Stable Day Identity Runtime.** It should implement only this contract, including V5 migration and the existing day UI's identity-aware mutations. It should not start any automatic itinerary, hotel-routing, luggage, scheduling, or optimization phase.

Phase 3D-S is **NOT STARTED** by this design gate.
