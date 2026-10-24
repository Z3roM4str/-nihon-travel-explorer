# Phase 3F-A — Official Reservation Mechanism Evidence Design Gate

Status: **design/audit only**  
Base audited: `e02a1ac0d61f99bfe4afb8fcb041319b00551788` (`main` after Phase 3E-L)  
Consulted official-source evidence: **2026-09-12**  
Recommended successor if accepted: **Phase 3F-B — Official Reservation Mechanism Evidence Foundation**

---

## 1. Decision

Phase 3E's local-ordering subsystem is closed. The next high-value product gap is not another route move.

It is reservation evidence.

Nihon currently has:

- `reservation.raw`: whether reservation is required/recommended/not required;
- `reservation.leadTime`: one editorial free-text summary;
- Phase 3D-D coarse lead-time classification;
- Phase 3D-H one narrow numeric date-window derivation;
- Phase 3D-O one neutral before/within/after relation to a disclosed reference date.

Those layers are intentionally conservative, but they leave many important attractions opaque even when the official operator publishes a structured booking mechanism.

This gate approves a new **separate official-evidence collection** for reservation mechanisms.

It does **not** approve booking automation, inventory checks, reminders, urgency, "book now", availability claims, automatic calendar actions or live purchasing.

---

## 2. Why this is the next product frontier

Current dataset audit:

- **214 places**
- **41 places** have `reservation.required === true`
- among those 41:
  - **3** have a Class-A explicit numeric day/week range already computable by Phase 3D-H;
  - **12** have coarse non-Class-A magnitudes;
  - **26** are opaque / mechanism-specific.

Therefore **38 of 41 required-reservation places cannot currently produce a Phase 3D-H numeric window**.

That does not mean all 38 are inherently unknowable.

Several current official sources publish precise recurring or fixed booking rules that the existing editorial `leadTime` field cannot represent safely.

Examples verified on 2026-09-12:

### Ghibli Museum — JP-044

Official source:

`https://www.ghibli-museum.jp/en/tickets/`

The operator states that overseas Lawson tickets become available:

- at **10:00 JST**;
- on the **10th of each month**;
- for the **subsequent calendar month**.

That is a structured monthly release rule, not merely "Venta mensual; comprar al abrir".

### Tokyo Disneyland / DisneySea — JP-203 / JP-204

Official source:

`https://www.tokyodisneyresort.jp/en/ticket/index.html`

The operator states that tickets are sold:

- daily from **14:00 JST**;
- for admission on the **same calendar date two months later**;
- with a documented fallback when that same date does not exist.

That is a structured rolling calendar-month release rule.

### Katsura Imperial Villa — JP-077

Official source:

`https://kyoto-gosho.kunaicho.go.jp/pdf/visit-1A3_en.pdf`

For online advance applications, the Imperial Household Agency states:

- applications open **three months in advance from the first day of that month**;
- online applications close **three days before** the preferred visit date;
- if applications exceed allocated capacity, a **lottery** is conducted.

That is a structured relative application window plus an allocation mechanism.

### Universal Studios Japan — JP-125

Current official main-site sources consulted:

- `https://www.usj.co.jp/web/ja/jp/faq/tickets`
- `https://www.usj.co.jp/web/ja/jp/tickets/buy/howto`

Those current main-site pages state that ordinary tickets begin sales **two months before the desired visit date**, while noting that some ticket types may use different sale dates.

A legacy FAQ page under `s.usj.co.jp` still states **three months**. That value conflicts with:

- the current main-site FAQ and purchase guide; and
- USJ's own 2025 Expo notice, which explicitly described the three-month horizon as a temporary Osaka-Expo measure and said the plan was to return to approximately two months afterward.

Therefore this phase must **not** treat the legacy three-month page as the current generic rule.

The current two-month wording is more precise than the editorial `"1–3 meses; Express antes"` shorthand, but it still does not by itself specify every calendar-alignment edge case the first-pass schema would need.

For that reason JP-125 remains a useful evidence example but is **not a mandatory Phase 3F-B pilot record** unless the successor can encode the official rule without inventing missing alignment semantics.

### Grand Sumo Tournament Osaka 2027 — JP-212

Official source:

`https://sumo.or.jp/EnTicket/year_schedule`

The Japan Sumo Association publishes:

- March 2027 Osaka tournament: **March 14–28, 2027**;
- advance ticket sales from **February 6, 2027**.

That is a fixed event-specific sale date.

### Nintendo Museum — JP-097

Official source:

`https://museum.nintendo.com/en/index.html`

The operator explicitly states:

- tickets are advance-reservation only;
- allocation is through a **random drawing**;
- selected applicants must complete purchase.

The current public page also identifies the currently open visit month, but the consulted source does not expose enough recurring release-window detail to justify deriving a stable generic calendar rule in this phase.

This is a useful example of **positive partial evidence that must not be over-normalized**.

### AnimeJapan 2027 — JP-211

Official source:

`https://anime-japan.jp/en/`

The 2027 event dates are published, but the consulted 2027 site does not yet publish the public ticket-sale schedule.

Historical AnimeJapan 2026 sale periods exist, but they must **not** be projected onto 2027.

No 2027 reservation-mechanism record should be created from 2026 ticket dates.

---

## 3. Core architecture decision

Do **not** rewrite `Place.reservation.leadTime`.

Do **not** expand its parser.

The current free-text field is an editorial planning summary and remains authoritative as that summary.

Official reservation mechanism evidence belongs in a separate versioned collection with:

- place identity;
- exact proposition type;
- scope;
- official provenance;
- consultation date;
- raw/evidence summary;
- confidence;
- explicit status.

This mirrors the architecture already used for:

- access points;
- validated walking evidence;
- seasonal supporting data.

The new evidence layer may later be consumed alongside existing reservation facts, but never silently replace them.

---

## 4. Proposed canonical collection

Recommended canonical path for Phase 3F-B:

`data/reservation-mechanisms.json`

Recommended application parity copy when the data foundation lands:

`app/src/data/reservation-mechanisms.json`

The canonical and app copies must be byte-identical or validated structurally by one deterministic parity check.

No workbook rewrite is required by the first data foundation.

---

## 5. Record identity

Every evidence record must have its own stable ID.

Recommended form:

`RM-<PLACE_ID>-<ORDINAL>`

Examples:

- `RM-JP-044-001`
- `RM-JP-203-001`
- `RM-JP-077-001`

The ordinal carries no priority.

A place may have multiple mechanism records when the operator exposes distinct reservation scopes.

Examples:

- park admission;
- area timed entry;
- guided visit;
- workshop;
- event admission;
- stage lottery.

Do not force multiple distinct mechanisms into one flattened record.

---

## 6. Scope is mandatory

A mechanism record must state what is being reserved.

Recommended closed first-pass scope union:

```text
general-admission
park-admission
guided-visit
event-admission
area-timed-entry
workshop
other-explicit
```

A future phase may extend the union only with real evidence.

Do not assume a place has exactly one reservation product.

---

## 7. Approved first-pass mechanism families

Only the following families are approved by this gate because current official examples demonstrate them.

### 7.1 monthly-fixed-release

A fixed day-of-month, optionally with an explicit local release time, for a defined target period.

Canonical motivating example:

Ghibli Museum:

- release day: 10;
- release time: 10:00;
- zone label: JST;
- target relation: subsequent calendar month.

This is not equivalent to "30 days before".

### 7.2 rolling-calendar-month-release

A release aligned to a calendar date a fixed number of months before/after the visit date.

Canonical motivating example:

Tokyo Disney Resort:

- offset: 2 calendar months before visit;
- same calendar day alignment;
- release time: 14:00 JST;
- explicit operator fallback when the aligned day does not exist.

Do not convert calendar-month rules to fixed 30/60-day offsets.

### 7.3 rolling-day-release

A simple exact number of days before a visit date.

Use only when the source itself defines the rule in days.

Do not derive it from "weeks", "months", "a few days" or other prose.

### 7.4 relative-application-window

An operator publishes an opening rule and closing rule relative to the visit date/month.

Canonical motivating example:

Katsura Imperial Villa online application:

- opens from the first day of the month three months before the preferred visit month;
- closes three days before the preferred visit date;
- allocation may become lottery-based if demand exceeds capacity.

This mechanism must preserve both edges independently.

### 7.5 fixed-sale-date

One explicit civil date on which advance sales begin for one named event / visit period.

Canonical motivating example:

Grand Sumo Osaka 2027:

- event window: 2027-03-14 through 2027-03-28;
- advance ticket sale begins: 2027-02-06.

Do not generalize an event-specific fixed date into a recurring rule.

---

## 8. Allocation mechanism is a separate axis

Release timing and allocation are not the same proposition.

Recommended first-pass allocation union:

```text
first-come
drawing
lottery-if-oversubscribed
capacity-limited
not-stated
```

Populate only what the official source explicitly supports.

Examples:

- Nintendo Museum: `drawing`;
- Katsura: `lottery-if-oversubscribed`;
- Disney: daily sales may stop when the daily sales limit is reached, so `capacity-limited` may be recorded if the proposition is scoped carefully.

Do not infer first-come merely because a site has a purchase button.

---

## 9. Time and timezone evidence

Some official mechanisms depend on a release clock time.

The evidence model may record:

- local civil time, e.g. `"10:00"`;
- source timezone label, e.g. `"JST"`;
- canonical IANA zone `"Asia/Tokyo"` only when the source clearly refers to Japanese local time / JST.

This gate authorizes **storing official time-zone evidence**, not performing runtime timezone arithmetic.

No current planning-draft schema changes.

No instant / epoch / countdown logic.

---

## 10. Provenance

Every record requires:

```json
{
  "sourceUrl": "...",
  "sourceEntity": "...",
  "consultedAt": "YYYY-MM-DD",
  "evidence": "...",
  "confidence": "official-explicit | official-derived"
}
```

Rules:

- `sourceUrl` must be official operator/government/organizer evidence for the proposition.
- `consultedAt` is mandatory because reservation rules are time-sensitive.
- `evidence` is a concise paraphrase of the exact supported proposition.
- `official-explicit` means the rule is directly stated.
- `official-derived` is allowed only for simple calendar normalization that preserves the stated rule exactly.
- No blog, OTA, social repost, Reddit, search snippet or travel guide may establish a mechanism record.

---

## 11. Currentness and supersession

Reservation rules can change.

A record therefore needs:

```text
status: active | superseded
```

If a current official source contradicts an existing active record:

1. never silently edit historical meaning;
2. add/update evidence deliberately;
3. mark the stale rule superseded when appropriate;
4. preserve the new consultedAt and source.

The first data foundation may start with active records only if there is no superseded history yet.

---

## 12. Absence means unknown, not no reservation rule

No record must never mean:

- no reservation;
- no release rule;
- booking impossible;
- booking open;
- booking closed.

It means only:

> Nihon has no structured official reservation-mechanism record for that scope.

The original `Place.reservation` fields remain visible and independent.

---

## 13. Do not encode negative evidence from silence

AnimeJapan 2027 is the canonical example.

The 2027 official site currently publishes event dates but not the public ticket-sale schedule.

The correct data result is:

- no fabricated release rule;
- no copied 2026 sale date;
- no "not on sale" boolean inferred from page silence.

A later official ticket announcement may justify a new record.

---

## 14. No historical projection

Historical rules are evidence about history, not automatically about the future.

Prohibited:

- using AnimeJapan 2026 ticket dates as 2027 dates;
- assuming last year's lottery month applies this year;
- assuming a temporary USJ rule persists without a current source;
- copying a previous maintenance/release cycle forward.

A current official recurring rule may be represented as recurring only when the current source states it generically.

---

## 15. Current source conflicts

If two official pages disagree:

1. do not choose silently;
2. prefer the more recent and more directly scoped source only when chronology/scope resolves the contradiction;
3. record the conflict in the audit;
4. omit a structured rule if the conflict cannot be safely resolved.

Example:

USJ is the canonical current-source-conflict example.

A legacy `s.usj.co.jp` FAQ still says three months before the desired visit date.

However:

- the current main-site FAQ says two months;
- the current main-site purchase guide says two months; and
- USJ's 2025 Expo notice explicitly described the three-month horizon as temporary and said the plan was to return to approximately two months after the Expo.

The evidence therefore resolves in favor of the current main-site **two-month** rule, while the stale legacy page is recorded as conflicting evidence rather than silently ignored.

Because the current source still does not define every missing-calendar-day alignment case required by the first-pass `rolling-calendar-month-release` shape, Phase 3F-B should omit a structured USJ record unless that successor narrows the schema safely.

---

## 16. Relationship to Phase 3D-H / 3D-O

The new official mechanism evidence does not replace:

- `ReservationDeadlineSignal`;
- `ReservationDateWindow`;
- `ReservationWindowReferenceRelation`.

Those modules derive conservative facts from the existing editorial `leadTime`.

Phase 3F evidence is a **second source domain**.

A future runtime must decide explicitly how official mechanism evidence composes with editorial lead-time evidence.

No composition is approved by this gate.

---

## 17. Why not expand reservation-deadline.ts now

Because the current parser answers:

> what safely follows from this one static free-text field?

The new evidence answers:

> what does an official operator currently publish about its reservation mechanism?

Those are different evidence contracts.

Adding operator-specific regexes to `reservation-deadline.ts` would:

- conflate editorial shorthand with official source evidence;
- lose consultation dates;
- lose provenance;
- make time-sensitive rules look timeless;
- create fragile place-specific parsers.

Rejected.

---

## 18. Why not put rules directly on Place

The `Place` object is the exported destination research record.

Reservation mechanisms are:

- more volatile;
- potentially multi-record per place;
- source/provenance heavy;
- scope-specific;
- sometimes event-specific;
- sometimes superseded.

Flattening them into `Place.reservation` would force a one-record shape onto a many-record domain and blur editorial vs official evidence.

Rejected.

---

## 19. Candidate TypeScript domain for a later consumer

Phase 3F-A does not ship this type.

A later runtime may derive a closed union resembling:

```ts
type ReservationMechanismEvidence =
  | {
      kind: "monthly-fixed-release";
      releaseDayOfMonth: number;
      releaseTimeLocal: string | null;
      sourceTimeZone: "Asia/Tokyo" | null;
      target: "subsequent-calendar-month";
    }
  | {
      kind: "rolling-calendar-month-release";
      monthsBeforeVisit: number;
      alignment: "same-calendar-day";
      missingAlignedDayRule: "first-day-of-next-month" | "not-recorded";
      releaseTimeLocal: string | null;
      sourceTimeZone: "Asia/Tokyo" | null;
    }
  | {
      kind: "rolling-day-release";
      daysBeforeVisit: number;
      releaseTimeLocal: string | null;
      sourceTimeZone: "Asia/Tokyo" | null;
    }
  | {
      kind: "relative-application-window";
      openRule: unknown;
      closeRule: unknown;
      allocation: "first-come" | "drawing" | "lottery-if-oversubscribed" | "capacity-limited" | "not-stated";
    }
  | {
      kind: "fixed-sale-date";
      saleDate: string;
      releaseTimeLocal: string | null;
      sourceTimeZone: "Asia/Tokyo" | null;
      appliesToStartDate: string | null;
      appliesToEndDate: string | null;
    };
```

The `unknown` placeholders above are deliberate design markers: Phase 3F-B must not invent a generic mini-language until the actual populated application-window records prove what structure is required.

Do not land an unused TypeScript abstraction in Phase 3F-A.

---

## 20. Recommended Phase 3F-B data pilot

The first data-foundation successor should populate a small, high-confidence official pilot rather than all 41 required places at once.

Recommended initial positive-evidence targets:

1. JP-044 — Ghibli Museum
2. JP-203 — Tokyo Disneyland
3. JP-204 — Tokyo DisneySea
4. JP-077 — Katsura Imperial Villa
5. JP-212 — Grand Sumo Tournament Osaka 2027

Optional only if the successor can encode the exact official proposition without guessing:

- JP-125 — Universal Studios Japan
- JP-097 — Nintendo Museum

Explicitly do not populate from unsupported projection:

- JP-211 — AnimeJapan 2027 ticket timing, until the 2027 official sale schedule is published.

The pilot is meant to validate the schema against materially different mechanism families.

---

## 21. Data validation contract for Phase 3F-B

At minimum:

1. every record ID unique;
2. every `placeId` exists in canonical places data;
3. scope belongs to the closed supported scope union;
4. mechanism kind belongs to the supported first-pass union;
5. required numeric fields are positive safe integers;
6. civil dates validate;
7. local times validate `HH:mm`;
8. timezone, if present, is exactly allowed by the first-pass contract;
9. provenance source URL non-empty and official;
10. consultedAt valid civil date;
11. confidence closed to approved values;
12. no duplicate `placeId + scope + active mechanism` identity unless explicitly permitted;
13. active/superseded status valid;
14. app parity copy equals canonical data;
15. no place/workbook mutation;
16. no HTTP request in runtime;
17. no network request in tests;
18. no automatic inference from `reservation.leadTime`;
19. no historical rule promoted as current without current official support;
20. absence remains absence/unknown.

---

## 22. No runtime consumer in Phase 3F-B

The immediate successor should be a **data foundation**, not UI.

It should not yet:

- show booking dates;
- calculate release dates for the user's itinerary;
- compare current date to a release rule;
- emit reminders;
- use Japan timezone arithmetic;
- label anything "open";
- label anything "late";
- rank reservations;
- make purchase recommendations.

The purpose of 3F-B is to establish trustworthy official evidence first.

---

## 23. Future runtime questions deliberately deferred

A later design gate must separately decide:

- how to choose among multiple scopes for one place;
- whether a rule can derive an exact release date for a chosen visit date;
- timezone/clock conversion;
- what to do at DST boundaries outside Japan if notifications are ever user-local;
- how current/superseded records are selected;
- how official evidence composes with `reservation.leadTime`;
- whether a route-wide reservation calendar is useful;
- reminder semantics;
- update/refresh cadence;
- source staleness policy;
- availability vs release timing;
- cancellation/refund rules.

None is approved here.

---

## 24. Explicit non-goals

Phase 3F-A does not implement:

- runtime TypeScript;
- UI;
- React hooks;
- reminders;
- automations;
- notifications;
- current-date urgency;
- "book now";
- "too late";
- availability;
- inventory;
- live ticket APIs;
- booking;
- payment;
- scraping;
- browser automation;
- login/session handling;
- hotel booking;
- transport booking;
- fare search;
- itinerary optimisation;
- opening-hours solving;
- schedule chaining;
- package changes;
- planning-draft V8;
- new localStorage keys.

---

## 25. Product value

This evidence layer directly addresses a current mismatch.

Today:

- Ghibli is effectively an opaque string;
- Disney is effectively an opaque "1–2 months" editorial summary;
- Katsura is effectively "weeks; limited capacity";
- USJ is effectively "1–3 months; Express earlier";
- Sumo already has a known 2027 fixed sale date but no typed mechanism.

After Phase 3F-B, Nihon can hold the exact official propositions without pretending they already constitute actionable booking advice.

That creates the evidence foundation required for a future reservation calendar or reminder feature.

---

## 26. Acceptance gate

Accept Phase 3F-A only if review agrees that:

1. reservation mechanism evidence is the next useful product frontier after Phase 3E closure;
2. the current 41 required places / 3 Class-A / 12 coarse / 26 opaque distribution is accurate;
3. official operator evidence proves multiple structured mechanism families exist;
4. the evidence belongs in a separate collection, not in the editorial `leadTime` parser;
5. provenance and consultedAt are mandatory;
6. multiple scopes per place are allowed;
7. only positive explicit official evidence may create a structured rule;
8. historical rules are never projected forward without current support;
9. source conflicts are resolved explicitly or remain unstructured;
10. release timing and allocation are separate axes;
11. no runtime timezone arithmetic is approved;
12. no availability/booking-open/urgency claim is approved;
13. Phase 3F-B is data-only;
14. the recommended mandatory pilot exercises monthly, exact rolling-calendar, application-window and fixed-date rules without requiring USJ's unresolved alignment detail;
15. AnimeJapan 2027 ticket timing remains unstructured until current 2027 evidence exists;
16. existing Phase 3D reservation semantics remain unchanged.

---

## 27. Conclusion

Nihon's current reservation runtime is conservative for the right reason: it only computes what can be justified from the static editorial lead-time field.

But that field is now the limiting evidence source.

Of 41 required-reservation places, only 3 currently produce the narrow Class-A numeric window.

Official operator sources demonstrate that several important opaque records have richer, structured and time-sensitive mechanisms.

The correct next move is therefore not a stronger parser and not an alert engine.

It is to create a small, versioned, provenance-rich official reservation mechanism evidence layer.

**Recommended successor: Phase 3F-B — Official Reservation Mechanism Evidence Foundation. NOT STARTED.**
