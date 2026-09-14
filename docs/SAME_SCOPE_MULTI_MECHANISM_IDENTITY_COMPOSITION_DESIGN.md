# Phase 3F-M — Same-Scope Multi-Mechanism Identity & Composition Design Gate

Status: **design gate only — hostile-review corrected; no runtime/data implementation in this phase**

Base: `7bf0f385ccc6b5fdb635be4e6b3717c156aa2c6c` (`main` after Phase 3F-L / PR #82)

Official PokéPark KANTO source recheck: **2026-09-14**

---

## 1. Problem statement

Phase 3F-K deliberately kept PokéPark KANTO (`JP-050`) out of the official reservation-mechanism
catalog because the current catalog rejects more than one active record for the same
`placeId + scope`.

The domestic source initially appears to make that restriction the blocking architectural fact,
because it publishes **two different calendar mechanisms for the same admission scope**:

1. a monthly drawing application window for admission three months ahead; and
2. a daily first-come sale release for admission two months ahead.

The hostile review found a more important boundary before relaxing cardinality: those mechanisms are
published inside a **Japan-resident purchase context** requiring a Japanese mobile number / SMS,
while residents outside Japan are directed to a separate official English store with its own
application flow.

Therefore Phase 3F-M separates two questions:

1. **identity:** can the runtime technically distinguish multiple same-scope records? Yes —
   `recordId` already does;
2. **applicability context:** can the current evidence/presentation model safely show multiple
   mechanisms from purchase contexts with different audience requirements as if they were equally
   applicable? No.

The architectural same-scope finding is retained, but the hostile review blocks implementation of
that relaxation until purchase-context/applicability semantics are designed explicitly.

---

## 2. Current official evidence recheck

### 2.1 Domestic official ticket page

Primary current source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

The current official page states, for the Japan-resident official ticket site:

- users may apply for the drawing;
- some tickets are also sold first-come;
- drawing admission target: the calendar month three months ahead;
- drawing application period: the 1st through the 12th of each month;
- first-come target: admission on the same calendar date two months ahead;
- first-come release: 20:00 on the same calendar date two months before;
- if target dates exceed the length of the shifted month, the last day of that shifted month releases
  the remaining target-month dates through month-end;
- first-come sales end when sold out;
- methods and schedules may change.

The same page explicitly requires a Japan mobile number / SMS verification for the Japan-resident
site and directs residents outside Japan to a separate English official store.

That purchase-audience distinction is provenance/context. **Phase 3F-M does not infer that every
recorded mechanism is usable by every user.** The Phase 3F evidence layer records operator-published
mechanisms; it does not yet evaluate purchaser eligibility.

### 2.2 Start-time corroboration

Supporting source:

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

The official June 16, 2026 notice states that, from July 2026 onward, both drawing and first-come
sales start at **20:00**, with examples for each mechanism.

The implementation successor must recheck the applicable official source immediately before writing JP-050 evidence.

### 2.3 Official store for residents outside Japan

Current official international purchase surface:

`https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`

The operator's English ticket information directs residents outside Japan to this official store.

The store states:

- admission tickets use an application system;
- applications are for admission three months ahead, one admission month at a time;
- application period is the 1st through the 12th of each month;
- only selected applicants are notified around month-end;
- selected applicants then complete payment.

The current international store evidence therefore supports one deterministic
`monthly-application-window` proposition.

It does **not** establish the domestic first-come two-month mechanism as an option for residents
outside Japan.

The international store explicitly states that ticket sales and Application periods start at
**20:00 JST**. It also describes the process as a lottery, including unsuccessful applicants and a
possible redraw of the lottery.

Therefore the international record may carry:

- `openTimeLocal: "20:00"`;
- `openSourceTimeZone: "Asia/Tokyo"`;
- `allocation: "drawing"`.

The rechecked international source does not establish a recurring closing clock time for the 12th,
so the close time and close timezone remain null.

---

## 3. Existing runtime identity audit

The current one-active-`placeId + scope` rule is **not** the runtime identity model.

The real identity already carried through Phase 3F is `recordId`:

- every derivation variant carries `recordId`;
- Phase 3F-F pairs a derivation to its exact evidence record by `recordId`;
- Phase 3F-F presentation carries `recordId`;
- Phase 3F-H relation identity carries `recordId + placeId + scope`;
- Phase 3F-H presentation verifies matching `recordId + placeId + scope`;
- Phase 3F-J pairs back to the exact source record by `recordId`;
- Phase 3F-J output carries `recordId`;
- per-day React rendering uses `presentation.recordId` as the article key;
- route-wide deterministic tie-breaking already has the source-record index after date and plan
  ordinal.

Therefore `placeId + scope` is currently a **catalog cardinality restriction**, not an identity
requirement.

---

## 4. Identity decision

### 4.1 Record identity remains `recordId`

Phase 3F-M approves this model:

> `recordId` is the unique identity of one official reservation-mechanism evidence proposition.

`placeId` identifies the place.

`scope` identifies what is being reserved.

Neither field identifies the acquisition path.

### 4.2 `placeId + scope` is not the fundamental runtime identity — but cardinality stays unchanged for now

The identity audit proves that multiple records **could** technically coexist because every
downstream layer retains `recordId`.

However Phase 3F-M does **not** authorize the successor to remove the active
`placeId + scope` uniqueness rule yet.

Reason:

The only current fixture motivating that relaxation, PokéPark domestic ticketing, also introduces a
purchase-context/applicability distinction that the current schema and UI do not model explicitly.

Relaxing cardinality before that semantic dimension exists would make it easier to render two
official records while leaving the user unable to tell which purchase context actually applies.

Therefore:

- `recordId` remains the true evidence-record identity;
- active `placeId + scope` uniqueness remains a temporary catalog safety invariant;
- a future purchase-context design gate may remove that invariant once applicability is representable.

### 4.3 Global ID uniqueness remains mandatory

The successor does **not** change either current structural uniqueness rule:

- duplicate global record IDs remain rejected;
- duplicate active `placeId + scope` identities remain rejected for now.

ID namespace matching remains unchanged:

`RM-<PLACE_ID>-<NNN>`

### 4.4 No `channel` field

Phase 3F-M explicitly rejects adding:

- `channel`;
- `acquisitionChannel`;
- `pathway`;
- `mechanismRole`;
- or any equivalent new identity field.

Reason:

The runtime already has a stable, globally unique record identity. A second identity axis would add
schema surface without solving a runtime ambiguity.

Mechanism kind, allocation, provenance and the exact record ID already describe the proposition.

If a later UX needs a user-facing taxonomy such as “sorteo” versus “venta directa”, that is a
separate presentation design question, not evidence identity.

---

## 5. Composition decision

### 5.1 Future same-scope records must not be merged

When a future purchase-context design gate eventually authorizes multiple active records for one
place/scope, they must remain distinct records.

No layer may:

- coalesce them into one synthetic mechanism;
- choose a preferred record;
- treat one as fallback for the other;
- infer that one becomes relevant only if the other fails;
- deduplicate them merely because `placeId + scope` matches.

### 5.2 Existing per-day composition remains valid

The existing per-day composition already:

1. derives every record for the place;
2. pairs every derivation back to its exact record by `recordId`;
3. renders one article per presentation;
4. keys the article by `recordId`.

The existing composition audit is sufficient for this design gate. Phase 3F-N does not create a
same-place/same-scope fixture and therefore does not need to modify production composition code.

### 5.3 Phase 3F-H remains record-local

Each relation is evaluated against one derivation.

Two same-scope records produce two independent relations because their `recordId` values differ.

No combined “best acquisition path” relation is authorized.

### 5.4 Phase 3F-J remains one row per eligible record

The route-wide calendar continues to emit one item per eligible record.

If a future gate authorizes two PokéPark admission records for one applicable purchase context, the
expected result would be two rows when both derive applicable calendar facts. Phase 3F-N does not
exercise that future behavior.

The existing chronological comparator remains:

1. anchor civil date;
2. plan ordinal;
3. source-record index.

Source-record index is a deterministic tie-breaker only. It is not priority, recommendation,
availability or operator preference.

---

## 6. New calendar-alignment requirement

PokéPark first-come sales expose a second independent gap in the current union.

Current `rolling-calendar-month-release` supports:

- `first-day-of-next-month`; and
- `not-recorded`

when the aligned day does not exist in the shifted month.

PokéPark requires different semantics.

Example:

- visit date: 2027-04-30;
- nominal two-month shift: 2027-02-30, which does not exist;
- official rule: February 28 releases April 28, 29 and 30.

Therefore using Disney's existing `first-day-of-next-month` rule would incorrectly derive
March 1.

### 6.1 Documented future extension — not authorized for Phase 3F-N

The correct future closed value would be:

`last-day-of-shifted-month`

for `rolling-calendar-month-release.missingAlignedDayRule`.

Semantics:

1. shift the visit month by `-monthsBeforeVisit`;
2. try the same calendar day;
3. if that civil date does not exist and the rule is `last-day-of-shifted-month`, use the real last
   civil day of the shifted month;
4. preserve the recorded release time and source timezone;
5. never clamp a valid aligned day;
6. never use instant/timezone arithmetic.

Examples:

- 2027-04-30 → 2027-02-28;
- 2028-04-30 → 2028-02-29;
- 2027-05-31 → 2027-03-31;
- 2027-06-30 → 2027-04-30.

Disney's existing `first-day-of-next-month` behavior remains unchanged.

Because Phase 3F-N will not encode the domestic first-come path, it must **not** add
`last-day-of-shifted-month` yet. Unused mechanism complexity is deferred until a purchase-context
gate authorizes a concrete record that needs it.

---

## 7. Hostile-review successor data decision for JP-050

Phase 3F-N may add **exactly one** JP-050 record, sourced from the official store used for
non-Japanese / outside-Japan ticket purchase.

This is intentionally smaller than the first draft.

### 7.1 Record — international application / drawing

Provisional identity:

`RM-JP-050-001`

Required shape, subject to implementation-day source recheck:

```text
placeId: JP-050
scope: general-admission
status: active
mechanism:
  kind: monthly-application-window
  monthsBeforeVisitMonth: 3
  openDay:
    kind: fixed-day-of-month
    day: 1
  closeDay:
    kind: fixed-day-of-month
    day: 12
  openTimeLocal: 20:00
  openSourceTimeZone: Asia/Tokyo
  closeTimeLocal: null
  closeSourceTimeZone: null
allocation: drawing
```

The international store supports the 1st–12th application span, explicitly identifies the process
as a lottery, describes selected and unsuccessful applicants plus possible redraw, and states that
Application periods start at 20:00 JST.

That 20:00 evidence is independently present on the international source; it is not copied from the
domestic purchase path.

No recurring close time is established for the 12th, so the close edge remains untimed.

### 7.2 Provenance context

The canonical source should be the official international ticket store or the operator's official
English page that directly links residents outside Japan to it.

`sourceEntity` must make the context visible in the presentation layer, for example:

`PokéPark KANTO Official Store — non-Japanese ticket purchase`

The evidence text must retain that this is the outside-Japan purchase context.

Phase 3F-N does not add the domestic first-come record.

---

## 8. Audience / applicability boundary

The hostile review found that provenance-only storage is not sufficient justification for silently
combining purchase contexts.

The current UI renders:

- a mechanism heading;
- its dates;
- allocation text;
- a short provenance line built from `sourceEntity`;
- the official source link.

It does **not** render the full provenance evidence text and it has no typed purchaser-applicability
field.

Therefore a domestic-only mechanism requiring Japan mobile/SMS must not be added alongside an
international mechanism until that distinction can be represented safely.

Phase 3F-N keeps the schema unchanged and uses only the international official-store proposition.

A future purchase-context design gate may evaluate a closed context vocabulary such as
domestic/international or a more evidence-faithful alternative. Phase 3F-M does not pre-commit to
that schema.

---

## 9. Domestic first-come boundary

The current domestic Japanese page publishes the two-month first-come calendar and its month-end
rule.

A historical official first-come announcement also states that first-come sales may not be conducted
depending on lottery-sale conditions. The current page says only that **some tickets** are sold
first-come.

Those facts make the domestic first-come proposition unsuitable for an unconditional generic
`general-admission` record in the current audience-agnostic model.

Phase 3F-M therefore defers:

- the domestic first-come JP-050 record;
- `last-day-of-shifted-month` runtime support;
- active same-`placeId + scope` cardinality relaxation;
- any “this option applies to you” interpretation.

This is a fail-closed decision, not a statement that the domestic first-come mechanism does not
exist.

---

## 10. Phase 3F-N implementation boundary

Phase 3F-N may change only what is necessary to add and prove the one international JP-050
application record:

1. canonical reservation-mechanism evidence JSON;
2. app-facing parity JSON;
3. focused evidence/parser tests;
4. derivation tests using the existing `monthly-application-window`;
5. Phase 3F-F/H/J focused tests only where the new real record adds useful coverage;
6. documentation/runtime record;
7. full regression and browser gates.

Not authorized:

- removing active `placeId + scope` uniqueness;
- `last-day-of-shifted-month`;
- domestic JP-050 first-come evidence;
- new React UX taxonomy;
- new grouping UI;
- new record-channel field;
- new scope value;
- purchase-context schema field;
- planning-draft migration;
- localStorage change;
- availability fetch;
- account integration;
- user-residency model;
- personalized eligibility;
- ranking or recommendation between mechanisms;
- notifications/reminders/calendar export.

---

## 11. Phase 3F-N validation gate

Phase 3F-N must prove at minimum:

1. canonical/app evidence parity;
2. catalog grows from 6 to exactly 7 active records;
3. global record IDs remain unique;
4. active `placeId + scope` uniqueness remains enforced;
5. JP-050 record ID is exactly `RM-JP-050-001`;
6. JP-050 scope is exactly `general-admission`;
7. JP-050 source context is explicitly international / non-Japanese purchase;
8. no second active JP-050 general-admission record exists;
9. no `channel`/pathway identity field exists;
10. JP-050 derives the month three months before the visit month, day 1 through day 12;
11. the open edge preserves exactly 20:00 Asia/Tokyo from the international source;
12. the close edge invents no clock time or timezone;
13. allocation remains `drawing` and is supported by explicit lottery/redraw language;
14. Phase 3F-F presents the international-source context through the existing provenance surface;
15. Phase 3F-H relation behavior remains record-local;
16. Phase 3F-J emits one JP-050 row, not a synthetic combined mechanism;
17. `last-day-of-shifted-month` is absent from the runtime union;
18. existing Disney missing-day behavior remains unchanged;
19. domestic JP-050 first-come evidence remains absent;
20. no availability/inventory/current-sale-state field is introduced;
21. no purchaser-eligibility claim is introduced;
22. no user-residency field is introduced;
23. JP-002, JP-125, JP-126 and JP-211 remain absent;
24. existing six records preserve their meaning unless implementation-time source recheck requires a
    documented correction;
25. full Vitest passes;
26. lint passes;
27. build passes;
28. repository whitespace gates pass;
29. Phase 3F-F/H/J browser audits pass;
30. official international PokéPark source is rechecked on implementation day before data write.

A changed source may remove JP-050 from Phase 3F-N. It may not silently reactivate the deferred
domestic same-scope work.

---

## 12. Normative contracts

1. Phase 3F-M changes documentation only.
2. Phase 3F-M writes no JP-050 data.
3. `recordId` is the evidence-record identity.
4. `placeId` is place identity, not evidence-record identity.
5. `scope` describes what is reserved, not who may use a purchase path.
6. Runtime already preserves `recordId` through D/F/H/J.
7. A future design may allow multiple active records with one `placeId + scope`.
8. Phase 3F-N does not remove the current active `placeId + scope` uniqueness rule.
9. Global record ID uniqueness remains mandatory.
10. ID namespace matching remains mandatory.
11. No `channel` field is introduced.
12. No fake scope is introduced to encode acquisition method.
13. Allocation does not become identity.
14. Mechanism kind does not become identity.
15. Same-scope technical composability does not imply same user applicability.
16. Domestic and international purchase contexts are materially distinct PokéPark evidence contexts.
17. Japan-resident PokéPark purchase currently requires Japan mobile/SMS.
18. Residents outside Japan are directed to a separate official English store.
19. The international official store currently documents a three-month-ahead application system.
20. The international application period is the 1st through the 12th.
21. The international selected-applicant flow supports `allocation: drawing`.
22. The international source independently records Application start at 20:00 JST.
23. International 20:00 evidence is not dependent on or copied from the domestic source.
24. Phase 3F-N may add exactly one JP-050 record.
25. That record uses the international / non-Japanese official purchase context.
26. That record uses existing `monthly-application-window`.
27. Catalog size under this approval becomes 7, not 8.
28. Domestic JP-050 first-come remains absent.
29. Same-scope cardinality relaxation remains deferred.
30. `last-day-of-shifted-month` remains design knowledge only and is not implemented by Phase 3F-N.
31. Disney's existing fallback remains unchanged.
32. Historical domestic first-come contingency is not normalized away.
33. “Some tickets” first-come wording is not generalized to every admission product.
34. Sold-out language is not encoded as mechanism closure.
35. Inventory is not encoded.
36. Availability is not encoded.
37. Current sale state is not encoded.
38. User lottery result is not encoded.
39. Urgency is not encoded.
40. Deadline is not encoded.
41. Recommendation between acquisition mechanisms is not encoded.
42. User residency is not encoded.
43. Personalized purchaser eligibility is not inferred.
44. Source context must be visible through existing provenance presentation.
45. A mechanism record does not mean “available to every user”.
46. Runtime performs no network request.
47. No planning-draft version changes.
48. No localStorage changes.
49. No notification/reminder/calendar integration.
50. No source precedence with Phase 3D.
51. Existing evidence semantics remain unchanged unless revalidated source evidence requires a
    documented correction.
52. Implementation-time international PokéPark source recheck is mandatory.
53. A changed source may remove the JP-050 candidate.
54. A changed source may not silently add the domestic first-come record.
55. A changed source may not silently remove the audience-context caution.
56. The successor keeps SHIBUYA SKY absent.
57. The successor keeps USJ ordinary admission absent.
58. The successor keeps SUPER NINTENDO WORLD absent.
59. The successor keeps AnimeJapan 2027 absent.
60. A future purchase-context design gate is required before same-scope domestic/international
    coexistence is implemented.

### 12.1 Hostile-review corrective

The first draft treated the domestic PokéPark page as one neutral mechanism source and concluded that
the next implementation should immediately remove active `placeId + scope` uniqueness.

The hostile review rejected that jump for two independent reasons:

1. **purchase context:** the domestic path requires Japan mobile/SMS and residents outside Japan are
   sent to a separate official store. `recordId` solves record identity but does not make those
   records equally applicable to one purchaser;
2. **domestic first-come contingency/granularity:** official material has stated that first-come may
   depend on lottery-sale conditions, and the current domestic page says “some tickets” are sold
   first-come. A generic unconditional `general-admission` release record would be broader than the
   evidence warrants.

The current international official store supplies a simpler, directly useful proposition: lottery
application for admission three months ahead, from the 1st through the 12th, starting at 20:00 JST,
with selected applicants notified later and possible redraw described explicitly.

The corrected successor therefore adds only that international application record and defers the
same-scope cardinality change, domestic first-come record and month-end fallback runtime until a
purchase-context model is designed.

---

## 13. Rejected alternatives

### “Use a new scope for lottery versus first-come”

Rejected. Both mechanisms obtain the same admission product. Scope describes the reserved object,
not acquisition method.

### “Add a channel field”

Rejected for this successor. It duplicates identity already supplied by `recordId` and would expand
every downstream type without resolving a real ambiguity.

### “Relax placeId + scope uniqueness immediately”

Rejected. The runtime could technically handle it, but the current PokéPark fixture crosses purchase
contexts with different audience requirements. Identity readiness is not applicability readiness.

### “Merge both mechanisms into one record”

Rejected. One is an application span with drawing allocation; the other is a release date with
first-come allocation. A synthetic union would erase their independent calendar facts.

### “Implement last-day-of-shifted-month now anyway”

Rejected. The rule is correctly documented for the domestic first-come mechanism, but Phase 3F-N no
longer adds that mechanism. Implementing unused runtime complexity would provide no current value.

### “Treat sold-out as the close edge of first-come sales”

Rejected. Sold-out is contingent inventory state, not a deterministic civil-date close rule.

### “Assume the current user can use the Japan-resident purchase path”

Rejected. The operator explicitly separates Japan-resident and outside-Japan purchase flows. The
current UI has no typed applicability model, so the domestic path remains deferred.

### “Copy the domestic 20:00 start onto the international application record”

Rejected. The 20:00 notice applies to the domestic flow. The international source rechecked for this
gate establishes the date span but not a recurring opening clock time.

---

## 14. Recommended successor

**Phase 3F-N — PokéPark Overseas Application Evidence Foundation**

One bounded implementation:

- keep active `placeId + scope` uniqueness unchanged;
- keep global `recordId` uniqueness unchanged;
- add exactly one current-source JP-050 record from the official outside-Japan purchase flow;
- reuse existing `monthly-application-window` with day 1 → day 12, three months before visit month;
- preserve the internationally recorded 20:00 Asia/Tokyo open edge;
- invent no close time or close timezone;
- preserve `allocation: drawing` from explicit lottery evidence;
- expose the international purchase context through existing provenance presentation;
- do not implement the domestic first-come path;
- do not implement `last-day-of-shifted-month`;
- preserve every existing no-state/no-network/no-persistence boundary;
- run the full regression gate.

A later design gate may address purchase-context semantics and then revisit same-scope
multi-mechanism cardinality.

Phase 3F-N is **NOT STARTED** by this design record.
