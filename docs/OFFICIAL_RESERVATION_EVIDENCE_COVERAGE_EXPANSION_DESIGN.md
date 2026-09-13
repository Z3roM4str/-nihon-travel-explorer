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
| JP-002 | SHIBUYA SKY | **successor candidate now** |
| JP-033 | teamLab Borderless | audit further; current source confirms dated tickets, not recurring release cadence |
| JP-038 | teamLab Planets TOKYO | audit further |
| JP-050 | PokéPark KANTO | **successor candidate now; schema extension required** |
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

Current ticket copy states that ordinary web admission tickets are sold for dates up to **two weeks
ahead**.

The workbook editorial value still says `2–4 semanas; atardecer antes`; that is planning advice and
must not be used as mechanism evidence.

Approved structured interpretation for the successor:

- scope: `general-admission`
- mechanism: existing `rolling-day-release`
- `daysBeforeVisit: 14`
- no release clock time invented
- no timezone needed when no clock time is stored
- allocation: `not-stated`
- provenance confidence: `official-derived`

The derived proposition is only the earliest civil date implied by the official rolling horizon. It
does not claim that inventory exists on that date or afterward.

### 4.2 JP-050 — PokéPark KANTO

Official sources consulted:

- `https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?pubDate=20251112`
- `https://ticket-en.pokepark-kanto.co.jp/`

The current official schedule states:

- admissions are handled through an application / lottery system;
- applications are for the visit month **three months in advance**;
- the recurring application period is the **1st through the 12th** of each month;
- the current start time for lottery / first-come sales is **20:00 JST**;
- selected applicants are notified later and must pay by the end of the month;
- later first-come inventory may exist, but its availability is contingent and must not be promoted
  into a deterministic release fact.

This is real evidence for an application window, but it does **not** fit the current
`relative-application-window` shape, whose close edge is defined as N days before the individual
visit date.

The successor therefore needs one new evidence family rather than a lossy conversion.

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

PokéPark KANTO and Nintendo Museum now provide that evidence.

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
closeTimeLocal: HH:mm | null
sourceTimeZone: Asia/Tokyo | null
```

The family shifts to the month `monthsBeforeVisitMonth` before the visit month and derives both
edges inside that month.

Examples:

- PokéPark: shift 3 months; open day 1; close day 12; open 20:00 JST; close time not recorded.
- Nintendo Museum: shift 3 months; open day 1; close last day of month; recurring clock times are not
  invented.

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

Therefore Phase 3F-L is **blocked** from adding JP-050 or JP-097 until the following invariant is
implemented:

> No layer may expose an application window as valid when its derived civil open date is after its
> derived civil close date.

Minimum successor requirements:

1. Phase 3F-D checks `openDate <= closeDate` before returning `application-window`.
2. Phase 3F-F refuses to present a synthetically inverted application-window derivation as an
   ordinary valid window.
3. The offline validator rejects statically invalid monthly-window rule shapes, including an
   impossible fixed day and any same-month fixed-day pair whose open day is after its close day.
4. The new monthly family derives the real last day of February/leap February rather than treating
   "last day" as 31.
5. No layer swaps, sorts or repairs inverted edges.

---

## 7. Scope and identity rules

The existing active uniqueness rule `placeId + scope` stays unchanged for Phase 3F-L.

For JP-050 and JP-097 the successor records represent the deterministic **drawing application
window** for general/park admission.

Later availability-based direct sales are not a second deterministic date mechanism and are not
added as a parallel active record.

If a future place exposes two independently deterministic mechanisms for the same exact scope, that
must receive its own design gate before relaxing active identity uniqueness.

---

## 8. Approved Phase 3F-L data delta

If this gate is accepted, the successor may add exactly these three active records:

1. **JP-002 SHIBUYA SKY** — existing `rolling-day-release`.
2. **JP-050 PokéPark KANTO** — new `monthly-application-window`.
3. **JP-097 Nintendo Museum** — new `monthly-application-window`.

Catalog size after the successor: **8 active records**, assuming no supersession is required during
implementation-time source recheck.

No other place is approved for population merely because it appears in the candidate table.

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
2. all eight records parse;
3. the three new record IDs and scopes are exact;
4. SHIBUYA SKY derives exactly 14 civil days before representative visit dates;
5. PokéPark derives the 1st–12th window in the month three months before the visit month;
6. Nintendo Museum derives the 1st–last-day window in the month three months before the visit month;
7. February 2027 and leap-February synthetic cases derive the correct final day;
8. an inverted old-style `relative-application-window` fails closed in 3F-D;
9. a synthetic inverted application derivation is not rendered as an ordinary valid window in 3F-F;
10. 3F-H and 3F-J retain their existing fail-closed behavior;
11. USJ, SUPER NINTENDO WORLD and AnimeJapan remain absent;
12. the 16 composite/operator-dependent records listed in §2.2–§2.4 remain absent;
13. no booking-state, availability, inventory, deadline, countdown, reminder or automation field is
    introduced;
14. full Vitest, lint, build and repository whitespace gates pass;
15. existing Phase 3F-F/H/J browser audits pass unchanged unless the new evidence legitimately adds
    rows to a fixture used by those audits.

If a browser fixture gains a new evidence row because it explicitly contains JP-002, JP-050 or
JP-097, the test must be updated only for that real new fact; no existing assertion may be weakened.

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
11. SHIBUYA SKY is approved only as a two-week civil release horizon.
12. No SHIBUYA SKY release time is invented.
13. PokéPark's deterministic fact is the monthly lottery application window.
14. PokéPark later availability is not a deterministic release fact.
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
55. The successor adds at most JP-002, JP-050 and JP-097 under this approval.
56. The successor keeps JP-125, JP-126 and JP-211 absent.
57. The successor does not populate audit-further candidates without a new documented official finding.
58. The successor does not populate §2.2–§2.4 records.
59. Existing five evidence records retain their meaning unless a current source recheck explicitly requires supersession.
60. Every added record retains exact official provenance and implementation-time consultation date.

---

## 13. Rejected alternatives

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
- add exactly three high-confidence current-source records;
- preserve every Phase 3F runtime boundary already established;
- run the complete regression gate.

Phase 3F-L is **NOT STARTED** by this design record.
