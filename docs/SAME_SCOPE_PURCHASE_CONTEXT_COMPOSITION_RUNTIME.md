# Phase 3F-S — Same-Scope Purchase-Context Composition Foundation

Status: **implemented and repository-native validated**

Base: `d2bc655ccef4c510c032f089592c7521035ba69c` (`main` after Phase 3F-R / PR #88)

Design authority: [`docs/SAME_SCOPE_PURCHASE_CONTEXT_COMPOSITION_DESIGN.md`](SAME_SCOPE_PURCHASE_CONTEXT_COMPOSITION_DESIGN.md)

Official PokéPark KANTO source recheck: **2026-09-15**

---

## 1. Implementation-day source gate

Three official sources were re-opened immediately before the catalog was written.

Residence routing:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

Domestic ticket information:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

Timing notice:

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

All six required propositions were still explicit:

1. guests residing outside Japan are asked to use the separate external English ticket website —
   *"We ask guests residing outside of Japan to please use this external website (English only)."*;
2. residents of Japan use the Japanese official route — *"Residents of Japan can purchase tickets
   via PokéPark KANTO's official website (only in Japanese)."*;
3. the Japan-resident route still requires registration and SMS through a Japan-usable phone —
   *"To purchase tickets, you will need to register as a member and carry out SMS verification via a
   mobile phone that can be used in Japan."*, and on the Japanese page
   *「会員登録とチケットのお申し込み・ご購入には日本国内の携帯電話番号によるSMS認証が必要です。」*;
4. the domestic drawing still targets admission three calendar months ahead —
   *「■3か月先の入場分（1か月単位）」*;
5. the drawing application period is still the 1st through the 12th —
   *「○ 抽選申込期間：毎月1日～12日」*;
6. the official evidence still supports a 20:00 JST opening — the timing notice states
   *「2026年7月から　20:00」* with the worked drawing example
   *「7月1日20:00に10月入場分チケットの抽選申込を開始」*.

No proposition changed materially, disappeared or became ambiguous, so implementation proceeded.

The domestic first-come sale for admission two months ahead is also still published. It remains
deliberately unencoded — see section 7.

---

## 2. Cardinality change

### 2.1 What was removed

The catalog previously rejected every second **active** record sharing one `placeId + scope`, in
both the TypeScript parser and the Python validator.

That temporary safety invariant conflicted with evidence the operator genuinely publishes.

### 2.2 What replaces it

An **active same-scope collision group** is two or more active records sharing one
`placeId + scope`.

For every such group, every active member must carry a specific purchase-residence context:

- `resides-in-japan`; or
- `resides-outside-japan`.

`purchaseResidenceContext: not-recorded`:

- remains valid while it is the only active record for its `placeId + scope`;
- is rejected the moment it participates in an active same-scope collision group.

Superseded records never participate: a retired route makes no current applicability claim, so it
cannot collide with a live one. Two superseded records may share `placeId + scope` freely.

### 2.3 Why the guard is evaluated after the whole catalog is read

A collision group is not knowable record-by-record. A solitary `not-recorded` record is valid when
it is read, and only a *later* active record sharing its `placeId + scope` turns it into a collision
member retroactively.

Both implementations therefore group first and judge the completed groups afterwards. The guard
rejects the offending catalog regardless of which member is read first.

### 2.4 What was deliberately NOT introduced

No uniqueness on `placeId + scope + purchaseResidenceContext`.

That key would still incorrectly reject two legitimate domestic mechanisms. Purchase-residence
context is applicability evidence published by the source, never an identity axis, so two active
same-scope records may share one specific context. A three-member group all carrying
`resides-in-japan` parses successfully and is covered by a focused test in both languages.

No `channel`, `pathway`, `acquisitionChannel`, `mechanismRole`, fake scope, allocation-as-identity
or mechanism-kind-as-identity field was added. `recordId` remains the only evidence-record identity.

### 2.5 Invariants explicitly preserved

- global record-ID uniqueness;
- ID namespace matching (`RM-<PLACE_ID>-<NNN>` against `placeId`);
- fail-closed parsing with no synthesized defaults;
- every existing closed vocabulary, unchanged.

Focused tests prove the relaxed cardinality did not weaken global ID uniqueness or namespace
matching.

---

## 3. New record

`RM-JP-050-002` was added to both parity catalogs:

```text
id: RM-JP-050-002
placeId: JP-050
scope: general-admission
purchaseResidenceContext: resides-in-japan
status: active
mechanism:
  kind: monthly-application-window
  monthsBeforeVisitMonth: 3
  openDay: { kind: fixed-day-of-month, day: 1 }
  closeDay: { kind: fixed-day-of-month, day: 12 }
  openTimeLocal: "20:00"
  openSourceTimeZone: Asia/Tokyo
  closeTimeLocal: null
  closeSourceTimeZone: null
allocation: drawing
```

Canonical source: `https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

Supporting timing source: `https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

Supporting residence-routing source, retained inside `provenance.evidence`:
`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

The provenance evidence states the published routing proposition explicitly and records that the
Japan-resident assignment rests on that statement — *not inferred from page language, locale, domain
or source entity*. A focused test asserts that exact sentence is present.

No close-edge time or timezone was invented: the source publishes an opening time only.

### 3.1 Catalog result

Catalog size: **7 → 8**.

JP-050 active `general-admission` records are exactly two, in catalog order:

1. `RM-JP-050-001` — `resides-outside-japan` — existing international application/drawing, unchanged;
2. `RM-JP-050-002` — `resides-in-japan` — new domestic application/drawing.

No third JP-050 record exists. Canonical and app-facing catalogs remain byte-identical
(`md5 9d82fc39dab77f0b7db835d5fc84781a`), proven by the validator's byte comparison and by focused tests in both
languages.

---

## 4. Composition after relaxation

### 4.1 Phase 3F-D — date derivation

Unchanged and record-local. `deriveReservationMechanismDatesForPlace` returns two derivations for
JP-050, keyed by distinct `recordId` values, each carrying its own dates.

For a 2027-03-15 visit both records derive open `2026-12-01` at `20:00 Asia/Tokyo` and close
`2026-12-12` with null close time and timezone. Identical dates across two distinct records are
valid and are not merged.

A focused test mutates only residence context and requires every derived date to stay identical.

### 4.2 Phase 3F-F — presentation

Reused unchanged. `RM-JP-050-002` renders through the existing Phase 3F-P `resides-in-japan` copy:

`La fuente oficial citada presenta esta ruta de compra para residentes en Japón.`

No badge, tag, grouping label, route-kind, "preferred"/"alternative" marker or any other taxonomy
was added for same-scope composition. A focused test asserts the presentation module contains no
such field. Both routes share scope label, heading and detail lines and are distinguished only by
the evidence they each cite.

No personal applicability copy exists on either route: a focused test rejects "aplica para ti",
"eres residente", "eres elegible", "puedes comprar", "para ti" and recommendation wording.

### 4.3 Phase 3F-H — temporal relation

Unchanged and record-local. Each JP-050 record is evaluated independently against the same reference
date. The two relations carry distinct `recordId` values and are never shared, reused, preferred or
collapsed, even when every date field they report is equal.

### 4.4 Phase 3F-J — route-wide calendar

Unchanged. The aggregator emits one row per eligible record, so JP-050 contributes two rows with the
same anchor date, place, scope, day number and visit date.

Nothing deduplicates by date, place, scope, mechanism or context.

The comparator remains exactly:

1. anchor civil date;
2. plan ordinal;
3. source-record index.

`purchaseResidenceContext` is not a comparator key. A focused test reverses only the catalog order
and requires the row order to reverse with it, proving the tie-break is source-record index and not
context, allocation, mechanism or operator preference. Another test swaps only the contexts and
requires identical row identity and order.

The calendar module source is asserted to contain no residence-context reference and no
dedupe/distinct/unique construct.

---

## 5. Browser acceptance

The existing Phase 3F-F/H/J browser audits never route through JP-050, so the behaviour this phase
actually changes had no browser proof. `app/scripts/phase3f-s-browser-audit.mjs` was added and
proves in a real Chromium session that:

- the per-day surface renders one article per record (two for JP-050), same place and same scope;
- each article carries its own residence-context line, in catalog order;
- each article links to its own official source URL;
- both records render their own recorded open edge — identical dates appear twice, not once;
- Phase 3F-H composes one relation per record;
- the route-wide calendar emits two rows with one identical anchor date, same place, day and visit
  date, ordered ahead of a later-anchored place;
- no badge, group, variant, route-kind or duplicate-marker class exists;
- no personalized applicability or preferred-route copy appears on either surface;
- nothing about the pair is persisted to the planning draft.

It uses the same test-only `addInitScript` date shim the Phase 3F-H/J audits established. No
production test hook, query parameter or storage field was added.

The three existing Phase 3F audits continue to pass unchanged.

---

## 6. Ownership boundaries preserved

- `recordId` is the only evidence-record identity;
- `purchaseResidenceContext` is applicability evidence, never identity;
- same-scope records are never merged, preferred, hidden, ranked or date-deduplicated;
- no automatic filtering by residence context;
- the application does not ask for, infer, store or model the current user's residence;
- source-record index remains a deterministic tie-breaker only.

---

## 7. Deferred work

The domestic first-come sale for admission two months ahead is published by the operator and is
still **not** encoded.

It requires `rolling-calendar-month-release.missingAlignedDayRule = last-day-of-shifted-month`,
which Phase 3F-S does not add. That value remains absent from the runtime union, from both catalogs
and from every mechanism; focused tests in both languages assert its absence.

Disney's `first-day-of-next-month` missing-day behaviour is unchanged, and a Python test pins both
Disney records to it.

The collision guard implemented here already permits the future third JP-050 record, because every
active member of that group would carry an explicit context.

---

## 8. Not introduced by Phase 3F-S

No new mechanism kind, scope value or residence-context value. No user residence, nationality,
citizenship, visa, country profile or eligibility field. No filtering, ranking, recommendation,
availability, inventory, current-sale-state or lottery-result model. No persistence or localStorage
change, no network request, no account integration, no notifications, reminders or calendar export,
and no new grouping UI.

---

## 9. Changed scope

Runtime and data:

- `app/src/lib/reservation-mechanism-evidence.ts` — collision guard replaces active uniqueness;
- `scripts/validate-reservation-mechanisms.py` — same rule, mirrored;
- `data/reservation-mechanisms.json` — `RM-JP-050-002` added;
- `app/src/data/reservation-mechanisms.json` — byte-identical copy.

Tests:

- `scripts/test_reservation_mechanisms.py`;
- `app/src/lib/reservation-mechanism-evidence.test.ts`;
- `app/src/lib/reservation-mechanism-date-derivation.test.ts`;
- `app/src/lib/reservation-mechanism-presentation.test.ts`;
- `app/src/lib/reservation-mechanism-reference-date.test.ts`;
- `app/src/lib/reservation-mechanism-calendar.test.ts`;
- `app/scripts/phase3f-s-browser-audit.mjs` (new).

Documentation:

- this runtime authority (new);
- `docs/ROADMAP.md`.

No presentation, component, CSS, schema, dependency, storage or network file changed.

---

## 10. Current gate

**IMPLEMENTED + REPOSITORY-NATIVE VALIDATED.**

Phase 3F-T and the domestic first-come route are not started.
