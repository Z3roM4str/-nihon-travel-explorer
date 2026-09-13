# Phase 3F-K — Official Reservation Evidence Coverage Expansion Design Gate

Status: **design/audit only**  
Base audited: `f217228a4f6fb980ee4ccd89f82905ac7dee1006` (`main` after PR #80)  
Current official-source consultation: **2026-09-13**  
Recommended successor if accepted: **Phase 3F-L — Official Reservation Evidence Coverage Expansion Foundation**

---

## 1. Decision

Phase 3F-J closed the runtime chain that consumes structured official reservation-mechanism evidence.

The next useful step is **not another presentation layer**. It is a controlled expansion of the evidence
catalog, but only where a current official source supports a mechanism that Nihon can represent without
inventing missing booking semantics.

This gate therefore approves a **bounded evidence-coverage expansion** and explicitly rejects a
"41 required places must become 41 mechanism records" target.

`Place.reservation.required === true` is an editorial requirement signal. It is **not** the eligibility
predicate for Phase 3F evidence.

A place is eligible for a structured Phase 3F mechanism record only when all of the following hold:

1. the proposition belongs to a clearly identified reservable scope;
2. the source is the operator, organizer, government owner or its explicitly linked official ticketing
   surface;
3. the source states a stable date rule or a fixed event sale date;
4. the rule can be encoded without inferring an unstated calendar alignment, release time, timezone,
   availability state or inventory condition;
5. the resulting rule is useful as a civil-date fact even when live availability is unknown.

---

## 2. Coverage audit

The canonical place dataset still contains **214 places**, of which **41** have
`reservation.required === true`.

The Phase 3F catalog currently covers **5 places**:

- JP-044 — Ghibli Museum
- JP-077 — Katsura Imperial Villa
- JP-203 — Tokyo Disneyland
- JP-204 — Tokyo DisneySea
- JP-212 — Grand Sumo Tournament Osaka 2027

That leaves **36 required-reservation places with no Phase 3F evidence record**.

The 36 are not one homogeneous backlog.

### 2.1 Operator / organizer admission candidates — 20

These have a direct operator/organizer product or a clearly scoped admission experience and are
therefore legitimate candidates for official-mechanism research:

| ID | Place | Gate disposition |
| --- | --- | --- |
| JP-002 | SHIBUYA SKY | audit further; current source proves a two-week sales horizon, not an exact release cadence |
| JP-033 | teamLab Borderless | audit further; current source confirms dated tickets, not recurring release cadence |
| JP-038 | teamLab Planets TOKYO | audit further |
| JP-050 | PokéPark KANTO | defer; two deterministic same-scope channels exceed current active identity model |
| JP-078 | Saiho-ji (Koke-dera) | audit further |
| JP-095 | teamLab Biovortex Kyoto | audit further |
| JP-097 | Nintendo Museum | **successor candidate now; schema extension required** |
| JP-101 | Gion Corner | audit further |
| JP-112 | Umeda Sky Building | audit further |
| JP-120 | teamLab Botanical Garden Osaka | audit further |
| JP-121 | Expo ’70 Park + Tower of the Sun | audit further; scope must be Tower interior, not the whole park |
| JP-123 | Church of the Light | audit further |
| JP-124 | Osaka Aquarium Kaiyukan | audit further; current official FAQ confirms timed tickets but not a stable release cadence |
| JP-125 | Universal Studios Japan | **keep excluded: current official-source conflict is not safely resolved for ordinary admission** |
| JP-126 | SUPER NINTENDO WORLD | **keep outside calendar-release successor: same-day/dynamic area-entry semantics** |
| JP-157 | Shurijo Castle Park | audit further; paid-area admission is not enough to justify a release rule |
| JP-163 | Valley of Gangala | audit further; official booking exists, but no stable release cadence verified |
| JP-173 | Okinawa Churaumi Aquarium | audit further |
| JP-178 | JUNGLIA OKINAWA | audit further; ticket availability exists, release cadence not yet established |
| JP-211 | AnimeJapan 2027 | **keep excluded until the 2027 ticket schedule is published** |

### 2.2 Composite destination / accommodation products — 3

These records do not describe one stable operator admission product and must not be forced into one
Phase 3F mechanism record:

- JP-142 — Kinosaki Onsen
- JP-143 — Koyasan temple stay
- JP-152 — Naoshima art island

A future evidence model may represent individual ryokan, temple stays or museum products, but that
would require separate product identity. The current place IDs are too broad.

### 2.3 Operator-dependent tours / activities — 9

These are reservable in practice, but the booking rule depends on the selected commercial operator,
not on one canonical place-level official mechanism:

- JP-171 — Blue Cave at Cape Maeda
- JP-183 — Gesashi Bay Mangrove Kayak
- JP-191 — Yabiji coral reef
- JP-195 — Yaeyama stargazing experience
- JP-197 — Iriomote mangrove and jungle expedition
- JP-198 — Pinaisara Falls
- JP-200 — Yonaguni Island and underwater monument dive
- JP-201 — Hatenohama
- JP-202 — Whale watching in the Kerama waters

These remain outside Phase 3F unless Nihon later introduces explicit operator/product identity.

### 2.4 Ferry / transport / lodging composites — 4

These reservation requirements combine transport, accommodation or tour inventory rather than one
operator-ticket-release rule:

- JP-184 — Zamami Island
- JP-186 — Aka Island
- JP-187 — Aharen Beach
- JP-199 — Hateruma Island

They are not Phase 3F evidence-coverage failures.

---

## 3. The denominator changes

The product should no longer describe Phase 3F coverage as "5 of 41 required places" except when
explaining historical dataset coverage.

That denominator invites unsafe normalization.

The operational denominator for future Phase 3F coverage work is:

> **places/scopes for which current official evidence establishes a structured, civil-date mechanism
> proposition that the approved schema can encode without invention.**

Absence from the Phase 3F catalog still means only:

> Nihon has no structured official reservation-mechanism record for that scope.

It does not mean no reservation is needed.

---

## 4. Current-source findings that justify the first expansion

### 4.1 JP-002 — SHIBUYA SKY

Official source consulted:

`https://www.shibuya-scramble-square.com/sky/ticket/`

The current ticket page states that admission tickets are sold for dates up to **two weeks ahead**.

That is a current **sales horizon**, but the consulted source does not state that each visit date is
released exactly fourteen civil days before admission, nor does it state the cadence or clock time at
which a newly eligible date enters the sale window.

Therefore the earlier draft's proposed `rolling-day-release(daysBeforeVisit: 14)` was too strong.
Phase 3F records exact mechanism propositions, not merely the outer bound of the dates currently sold.

Disposition:

- no Phase 3F-L record;
- keep the workbook's `2–4 semanas; atardecer antes` as separate editorial planning text;
- retain JP-002 as an operator candidate for a future audit if SHIBUYA SKY publishes an explicit
  release cadence.

### 4.2 JP-050 — PokéPark KANTO

Official sources consulted:

- `https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?pubDate=20251112`
- `https://ticket-en.pokepark-kanto.co.jp/`
- `https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

The current official schedule publishes **two deterministic mechanisms for the same admission
scope**:

1. **Lottery application** for the visit month three months ahead:
   - application period: 1st through 12th of each month;
   - current start time: 20:00 JST;
   - result notification later in the month;
   - selected applicants pay by month end.
2. **First-come sale** for admission dates two months ahead:
   - each visit date begins sale at 20:00 on the same calendar date two months earlier;
   - month-end handling is explicitly documented;
   - sale ends when sold out.

The first draft incorrectly described the later first-come path as non-deterministic merely because
inventory is contingent. Inventory is contingent, but the **sale-start rule itself is deterministic**.

This creates a model problem rather than an evidence problem. The current catalog enforces one active
record per `placeId + scope`, and the scope describes what is reserved, not the acquisition channel.
Silently recording only one of two deterministic official mechanisms would make the structured
evidence knowingly incomplete while also preventing the second active record from being represented.

Disposition:

- JP-050 is **not approved for Phase 3F-L**;
- do not misuse `scope` to encode lottery vs first-come channels;
- do not relax active identity uniqueness inside a data-expansion phase;
- a future design gate may introduce explicit mechanism-channel identity and define how two
  same-scope deterministic mechanisms compose in Phase 3F-D/F/H/J.

### 4.3 JP-097 — Nintendo Museum

Official sources consulted:

- `https://museum-tickets.nintendo.com/en`
- `https://museum-tickets.nintendo.com/en/calendar`

The official ticketing site states:

- tickets are first offered through a random drawing;
- for the canonical example, a July visit enters the drawing from **April 1 through April 30**;
- the current calendar on 2026-09-13 is accepting drawing entries for **December 2026** through
  **September 30**;
- later no-drawing sales may occur based on remaining availability.

The stable deterministic proposition is therefore the **drawing application month**, not later
availability-based sales.

Like PokéPark, this requires a month-relative application window whose two edges are fixed within the
month a stated number of months before the visit month.

### 4.4 JP-125 — Universal Studios Japan remains excluded

Current official evidence is still not clean enough for ordinary park-admission normalization.

Relevant official evidence includes:

- a legacy official FAQ that still says **three months** before the desired visit date;
- USJ's April 18, 2025 official notice saying the three-month horizon was a temporary Osaka Expo
  measure and that the plan was to return to approximately two months afterward;
- current Express Pass guidance saying those products are sold from approximately two months before
  the visit;
- current ordinary-ticket surfaces that expose dated inventory but do not provide one clean,
  contradiction-free generic rule suitable for this catalog.

Phase 3F must not resolve this by preference or by borrowing the Express Pass rule for ordinary
admission.

JP-125 stays absent.

### 4.5 JP-126 — SUPER NINTENDO WORLD is a different mechanism class

Current official USJ guidance says area timed-entry tickets can be obtained after park entry through
the official app, may end early, and in some cases are bundled in advance through selected Express
Passes or travel products.

That is a same-day/dynamic access mechanism with multiple acquisition channels.

It is not an ordinary pre-trip release-date rule and does not belong in the Phase 3F-L calendar
expansion.

### 4.6 JP-211 — AnimeJapan 2027 still has no 2027 sale schedule

Official source:

`https://anime-japan.jp/en/about/`

The 2027 dates and venue are published: March 27–28, 2027 at INTEX Osaka.

The currently indexed detailed ticket schedule is still the **2026** schedule. Historical 2026 dates
must not be projected onto 2027.

No JP-211 mechanism record is approved by this gate.

---

## 5. New mechanism family justified by real evidence

Phase 3F-A allowed the mechanism union to grow only when real official evidence required it.

Nintendo Museum provides sufficient real official evidence for this family on its own. PokéPark
KANTO also exhibits a monthly lottery window, but its simultaneous deterministic first-come rule
means JP-050 itself is deferred until same-scope multi-mechanism identity is designed.

Approved new family name:

`monthly-application-window`

Required semantics:

```text
kind: monthly-application-window
monthsBeforeVisitMonth: positive integer
openDay:
  kind: fixed-day-of-month
  day: 1..31
closeDay:
  kind: fixed-day-of-month | last-day-of-month
  day?: 1..31
openTimeLocal: HH:mm | null
openSourceTimeZone: Asia/Tokyo | null
closeTimeLocal: HH:mm | null
closeSourceTimeZone: Asia/Tokyo | null
```

The family shifts to the month `monthsBeforeVisitMonth` before the visit month and derives both
edges inside that month.

Canonical successor example:

- Nintendo Museum: shift 3 months; open day 1; close last day of month; recurring clock times and
  edge timezones are not invented.

PokéPark's 1st–12th lottery window proves the same family can describe real evidence, but JP-050 is
not a Phase 3F-L data record because its second deterministic same-scope channel cannot be represented
honestly under the current active identity rule.

The two edge timezone fields are deliberately separate. That matches the already-shipped
`application-window` derivation shape and prevents an explicit timezone attached to one recorded clock
from being silently copied onto an edge whose clock/timezone proposition was never stated.

This is **not** a booking-state model. It records only the application interval.

---

## 6. Mandatory inverted-span correction before expansion

Phase 3F-J correctly refuses an application span when `openDate > closeDate`.

The lower layers are currently asymmetric:

- the offline validator validates the two symbolic rules separately;
- Phase 3F-D derives both edges but does not reject `openDate > closeDate`;
- Phase 3F-F can present an inverted derivation as an ordinary application window;
- Phase 3F-H and Phase 3F-J already fail closed.

That asymmetry is harmless for the current Katsura record, but it becomes unacceptable when the
catalog admits additional application-window families.

Therefore Phase 3F-L is **blocked** from adding JP-097 until the following invariant is
implemented:

> No layer may expose an application window as valid when its derived civil open date is after its
> derived civil close date.

Minimum successor requirements:

1. Phase 3F-D checks `openDate <= closeDate` before returning `application-window`.
2. Phase 3F-F returns `null` before formatting when given a synthetically inverted
   `application-window` derivation. It must not create a new neutral/error presentation state and
   must not format either edge as an ordinary valid window.
3. The offline validator rejects statically invalid monthly-window rule shapes, including an
   impossible fixed day and any same-month fixed-day pair whose open day is after its close day.
4. The new monthly family derives the real last day of February/leap February rather than treating
   "last day" as 31.
5. No layer swaps, sorts or repairs inverted edges.

---

## 7. Scope and identity rules

The existing active uniqueness rule `placeId + scope` stays unchanged for Phase 3F-L.

For JP-097 the successor record represents the deterministic **drawing application window** for
general admission.

Nintendo's later direct-sale path remains availability-dependent and its public example does not
establish one exact generic release date suitable for this phase.

PokéPark is the concrete counterexample that proves why the current identity rule matters: it exposes
two independently deterministic mechanisms for the same admission scope. Representing that case
requires a future design gate before relaxing active identity uniqueness or adding an explicit
mechanism-channel identity axis.

---

## 8. Approved Phase 3F-L data delta

If this gate is accepted, the successor may add exactly one active record:

1. **JP-097 Nintendo Museum** — new `monthly-application-window`.

Catalog size after the successor: **6 active records**, assuming no supersession is required during
implementation-time source recheck.

JP-002 and JP-050 are explicitly **not** approved by this successor. No other place is approved for
population merely because it appears in the candidate table.

---

## 9. Implementation-time source recheck

Reservation rules are time-sensitive.

Immediately before writing each Phase 3F-L record, the implementer must re-open the exact official
source.

If the proposition changed after 2026-09-13:

- do not preserve this gate's value by inertia;
- stop that record;
- document the new evidence;
- either adapt within the already approved family without semantic expansion or return to a design
  gate if the mechanism shape changed.

`consultedAt` in the record must be the actual implementation-time consultation date.

---

## 10. What Phase 3F-L may change

Approved:

- canonical and app parity reservation-mechanism JSON;
- validator and validator tests;
- TypeScript evidence parser/types and focused tests;
- Phase 3F-D derivation and focused tests;
- Phase 3F-F fail-closed presentation guard and focused tests;
- any source-boundary tests required to pin the new family;
- execution documentation and ROADMAP.

Phase 3F-L does **not** change active-record identity semantics and does not add a channel field.

Not approved:

- planner schema or localStorage;
- current-date capture behavior;
- 3F-H relation vocabulary;
- 3F-J chronology semantics;
- ranking, urgency or priority;
- inventory/availability fetches;
- reminders, notifications or calendar export;
- network calls from runtime;
- source conflict UI;
- Phase 3D precedence or replacement;
- editorial workbook rewrite.

---

## 11. Successor validation gate

Phase 3F-L must at minimum prove:

1. source/app evidence parity;
2. all six records parse;
3. the new JP-097 record ID and scope are exact;
4. Nintendo Museum derives the 1st–last-day window in the month three months before the visit month;
5. February 2027 and leap-February synthetic cases derive the correct final day;
6. an inverted old-style `relative-application-window` fails closed in 3F-D;
7. a synthetic inverted application derivation returns `null` from 3F-F before either edge is
   formatted;
8. 3F-H and 3F-J retain their existing fail-closed behavior;
9. SHIBUYA SKY and PokéPark remain absent for the reasons fixed by this gate;
10. USJ, SUPER NINTENDO WORLD and AnimeJapan remain absent;
11. the 16 composite/operator-dependent records listed in §2.2–§2.4 remain absent;
12. no booking-state, availability, inventory, deadline, countdown, reminder or automation field is
    introduced;
13. active `placeId + scope` uniqueness remains unchanged;
14. no mechanism-channel field is introduced;
15. full Vitest, lint, build and repository whitespace gates pass;
16. existing Phase 3F-F/H/J browser audits pass unchanged unless the new JP-097 evidence legitimately
    adds a row to a fixture used by those audits.

If a browser fixture gains a new evidence row because it explicitly contains JP-097, the test must be
updated only for that real new fact; no existing assertion may be weakened.

---

## 12. Normative contracts

1. Phase 3F-K changes documentation only.
2. Phase 3F-K does not modify the evidence catalog.
3. Phase 3F-K does not modify runtime code.
4. `reservation.required` is not Phase 3F eligibility.
5. Coverage is measured against structured official mechanisms, not all required places.
6. Composite destinations are not flattened into fake operator mechanisms.
7. Third-party tour products require explicit operator identity before Phase 3F evidence can cover them.
8. Ferry/accommodation combinations are not operator-admission mechanisms.
9. Current official evidence beats editorial lead-time text for Phase 3F propositions.
10. Editorial lead-time text remains a separate Phase 3D/editorial fact.
11. SHIBUYA SKY's two-week statement is a sales horizon, not an approved exact release date.
12. SHIBUYA SKY remains absent until an official source states a release cadence precisely enough to derive a civil date.
13. PokéPark exposes both a deterministic lottery window and a deterministic first-come release for the same admission scope.
14. PokéPark remains absent until same-scope multi-mechanism identity and composition are designed.
15. Nintendo Museum's deterministic fact is the monthly drawing window.
16. Nintendo later availability-based direct sales are not promoted into a release date.
17. USJ ordinary admission remains excluded while current official sources do not resolve the rule cleanly.
18. Express Pass timing never substitutes for ordinary admission timing.
19. SUPER NINTENDO WORLD same-day timed entry is not normalized as a pre-trip release.
20. AnimeJapan 2026 ticket dates never project onto AnimeJapan 2027.
21. `monthly-application-window` exists because two current official sources require it.
22. The new family is civil-date arithmetic only.
23. The new family never performs instant or timezone conversion.
24. "last day of month" is derived calendar structure, not a hard-coded day 31.
25. Invalid calendar days fail closed.
26. Inverted application windows fail closed.
27. Inverted edges are never swapped.
28. Inverted edges are never sorted.
29. Inverted edges are never repaired.
30. 3F-D owns mechanism-date derivation.
31. 3F-F does not independently derive dates.
32. 3F-H remains a civil-date relation only.
33. 3F-J remains chronology-only.
34. Application-window relation never becomes booking-open/closed state.
35. `consultedAt` stays provenance, not a freshness score.
36. Runtime makes no network request.
37. Runtime stores no derived mechanism date.
38. No planning-draft version change is authorized.
39. No new localStorage key is authorized.
40. No reminder or notification is authorized.
41. No `.ics` or calendar integration is authorized.
42. No ranking field is authorized.
43. No urgency field is authorized.
44. No availability field is authorized.
45. No inventory field is authorized.
46. No deadline field is authorized.
47. No current-sale-state field is authorized.
48. No source precedence with Phase 3D is authorized.
49. No conflict badge/UI is authorized.
50. Phase 3F-L must recheck official sources immediately before data write.
51. A changed source may remove a candidate from Phase 3F-L.
52. A changed source may not silently expand the approved mechanism union.
53. Active `placeId + scope` uniqueness stays in force.
54. A second deterministic mechanism for one active scope requires a future gate.
55. The successor adds only JP-097 under this approval.
56. The successor keeps JP-002, JP-050, JP-125, JP-126 and JP-211 absent.
57. The successor does not populate audit-further candidates without a new documented official finding.
58. The successor does not populate §2.2–§2.4 records.
59. Existing five evidence records retain their meaning unless a current source recheck explicitly requires supersession.
60. Every added record retains exact official provenance and implementation-time consultation date.
61. Application-window edge timezones are recorded independently; one edge's timezone is never copied
    onto the other edge by implication.
62. A synthetically inverted application-window derivation returns `null` from Phase 3F-F before
    formatting; no new presentation state is invented for that impossible input.
63. A published sales horizon is not converted into a release date without an explicit release cadence.
64. Deterministic same-scope acquisition channels are not silently collapsed into one evidence record.

---

## 12.1 Hostile design review corrective

A post-draft hostile review checked the gate against the real Phase 3F-D and Phase 3F-F interfaces and
against the current official sources.

Two design ambiguities were found and corrected before Ready transition:

1. **Shared timezone field on the new monthly window.** The first draft proposed one
   `sourceTimeZone` for both application-window edges. Existing Phase 3F semantics keep
   `openSourceTimeZone` and `closeSourceTimeZone` independent. The new family now does the same,
   so PokéPark's explicit 20:00 JST opening evidence cannot silently assign a timezone proposition to
   its un-timed closing edge.
2. **Undefined Phase 3F-F fail-closed result.** "Refuse to present" did not state whether the
   presentation layer should return `null` or invent another presentation kind. The contract now
   requires `null` before any edge formatting, matching the existing function boundary and
   forbidding a new neutral/error presentation state.

The independent source recheck changed two core gate decisions. SHIBUYA SKY's official page confirms
only a two-week sales horizon, not an exact release cadence. PokéPark's official ticket page confirms
both the three-month-ahead 1st–12th lottery window **and** a deterministic daily first-come release
two months before the visit date at 20:00, which the current one-active-`placeId + scope` identity
cannot represent without collapsing a real acquisition channel. Nintendo Museum still documents the
monthly drawing model; SUPER NINTENDO WORLD still has same-day app distribution plus advance channels;
and the public AnimeJapan 2027 site publishes the event dates while no indexed 2027 public sale
schedule establishes a mechanism record.

No runtime, data, schema or evidence artifact was changed by this corrective.

---

## 13. Rejected alternatives

### "Treat SHIBUYA SKY's two-week horizon as a 14-day release"

Rejected. "Sold up to two weeks ahead" bounds the visible sale horizon but does not state the exact
cadence at which a new visit date becomes sellable.

### "Record only PokéPark's lottery and ignore its deterministic first-come rule"

Rejected. The official source publishes both for the same admission scope. The current identity model
cannot honestly represent both, and this gate does not misuse scope or silently drop the second
deterministic channel.

### "Populate all 36 missing required places"

Rejected. Sixteen are not even one place-level operator reservation product, and many of the remaining
twenty do not publish a stable recurring release rule.

### "Use the workbook Anticipación field as evidence"

Rejected. It is editorial planning text and may intentionally be coarser than current official rules.

### "Treat any visible booking calendar as a release mechanism"

Rejected. A calendar showing purchasable dates does not establish when each date first became
available.

### "Use historical ticket patterns when the future event page is silent"

Rejected. AnimeJapan is the canonical counterexample.

### "Resolve USJ by choosing the most convenient official page"

Rejected. Source conflict is evidence, not permission to guess.

### "Represent SUPER NINTENDO WORLD as visit-date release"

Rejected. The official mechanism depends on park entry, app state, distribution conditions and
multiple acquisition channels.

### "Skip the inverted-span correction because current Katsura data is safe"

Rejected. Adding new application-window semantics while knowingly leaving lower-layer asymmetry would
turn a latent correctness debt into an active one.

---

## 14. Recommended successor

**Phase 3F-L — Official Reservation Evidence Coverage Expansion Foundation**

One bounded implementation:

- harden application-window fail-closed invariants;
- add `monthly-application-window`;
- add exactly one high-confidence current-source record: Nintendo Museum;
- preserve active `placeId + scope` identity unchanged;
- preserve every Phase 3F runtime boundary already established;
- run the complete regression gate.

Phase 3F-L is **NOT STARTED** by this design record.
