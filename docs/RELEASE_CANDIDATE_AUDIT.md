# Phase 5A — Nihon v1 Release Candidate Audit & Blocker Remediation

Status: **audit complete; PR remains Draft pending an independent closure gate**

- Base: `33db8decc6fee1c0f2376246b795b6f3d2a97e6a` (`main` after Phase 4M / PR #117)
- Issue: #118
- Branch: `release/phase-5a-nihon-v1-rc-audit`
- Audit date: **2026-09-16 (America/Mexico_City)**

Authority consulted:
- `docs/ROADMAP.md` (Phase 4M closure and its successor boundary)
- `docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md` (Phase 4M — photography STOP for v1)
- `docs/AB_PHOTOGRAPHY_BATCH_II_RUNTIME.md`, `docs/PHOTOGRAPHY_COVERAGE_STRATEGY_DESIGN.md`
- `docs/WHOLE_TRIP_COMPOSITION_DESIGN.md`, `docs/STABLE_DAY_IDENTITY_DESIGN.md`,
  `docs/TRIP_BOUNDS_DESIGN.md`, `docs/INTER_HUB_TRANSPORT_DESIGN.md`
- `docs/ROUTE_WIDE_OFFICIAL_RESERVATION_CALENDAR_DESIGN.md` and the reservation runtimes
- `docs/ACCESS_POINT_DESIGN.md`, `docs/WALKING_SCALE_EXECUTION.md`, `docs/LOGISTICS.md`
- `app/src/lib/planning-draft.ts` / `planning-draft-v5.ts` (persistence contracts)

## RC decision

> ## **RC-READY**

No open BLOCKER or MAJOR finding remains. Every BLOCKER/MAJOR-class finding raised by this audit
was reproduced, fixed, and covered by a regression test that fails against the unfixed code.

---

## 1. Preflight

| Invariant | Required | Observed |
|---|---|---|
| `origin/main` | `33db8de…` | **`33db8decc6fee1c0f2376246b795b6f3d2a97e6a`** ✓ |
| Branch descends from base | exact | merge-base = base = branch head at start ✓ |
| Working tree | clean | clean ✓ |
| PR #117 | merged | merged 2026-09-16 ✓ |
| Issue #116 | closed completed | `closed`, `state_reason: completed` ✓ |
| Phase 4M verdict | STOP photography for v1 | `docs/PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md` §Decision ✓ |
| Phase 4N | must not exist or be authorized | no branch, no issue, no fixture, no selector ✓ |

**No divergence.** The only references to "Phase 4N" anywhere in the tree are the Phase 4M
statements that no such phase is authorized.

### Baseline established before any edit

| Gate | Baseline at `33db8de` |
|---|---|
| Python tests | **543 passed** |
| Vitest | **2440 passed**, 65 files |
| Lint (`oxlint`) | clean, exit 0 |
| Production build | success |
| `validate-dataset.py` | OK — 214 places, 403 nearby relations, 0 broken references, 13 secondary-metadata warnings |
| `validate-geography.py` | OK — 47 prefectures, 47 polygons, 9 navigation regions, 15 covered prefectures, 7 hubs |
| `validate-logistics.py` | OK — 24 pilot edges + 308 scale edges, results present |
| `validate-photography.py` | OK |
| `validate-access-points.py` | OK — source/app parity |
| `validate-reservation-mechanisms.py` | OK — source/app byte parity |
| `validate-walking-access-point-results.py` | OK — historical results unchanged |

---

## 2. Findings

Severity per Issue #118 §3. Every production change below maps to exactly one finding.

| ID | Severity | Area | Status |
|---|---|---|---|
| **RC-01** | **MAJOR** | Filters / discovery | **fixed** |
| **RC-02** | MINOR | Accessibility copy | **fixed** (trivial, isolated, zero-risk) |
| **RC-03** | **MAJOR** | Documentation truthfulness | **fixed** |
| **RC-04** | **MAJOR** | Documentation truthfulness | **fixed** |
| RC-05 | MINOR | Build performance | documented, deferred post-v1 |

**A note on the two documentation severities, so the closure gate can disagree cheaply.**
RC-03 and RC-04 impair no user journey — nothing in the running product is wrong because of
them, and on the "prevents a user completing a journey" axis they would be MINOR. They are
classified MAJOR under Issue #118 §3's *"materially misleading presentation"* limb, read together
with §14, which makes documentation consistency an explicit audit area and requires correcting
"current-state documentation needed for v1 truthfulness". A README that calls the product a
"Phase 1 MVP" Tokyo map with a 24-place photo pilot, at the moment it is proposed as a release
candidate, is the single most misleading artifact in the repository. Both are fixed either way,
so the classification changes no outcome — only the reading of the severity model.

### RC-01 — MAJOR — the grade filter silently hid every grade-D place

**Reproduction.** Open the Osaka or Kioto hub → open the "Grado" filter group. It offers
**S, A, B, C** only. `data/places.json` contains four grade-**D** places — `JP-056` Yasaka
Kōshin-dō (Kioto), `JP-104` Glico Running Man sign (Osaka), `JP-106` Kuromon Ichiba Market
(Osaka), `JP-177` Heart Rock (Okinawa). `App.tsx`'s `matchesFilters` treats a non-empty
`filters.grades` as exhaustive:

```ts
if (filters.grades.length > 0 && !filters.grades.includes(place.grade)) return false;
```

So ticking every grade on offer — the natural "show me everything graded" gesture — **removed
four real catalogue entries from the list and the map**, and no combination of filters could
reach them. Two of the four (Kuromon Ichiba Market, Glico Running Man sign) are `tourismLevel:
Extremo` places a user would plausibly search for by name.

The defect was a hardcoded vocabulary in `App.tsx` that had fallen behind the data:

```ts
const grades = useMemo(
  () => ["S", "A", "B", "C"].filter((g) => hubPlaces.some((p) => p.grade === g)),
  [hubPlaces]
);
```

Two presentation layers shared the same root cause: `PlaceMap.tsx`'s `gradeColors` had no `D`
entry (grade-D markers reached C's colour only through a `?? gradeColors.C` fallback), and
`App.css` had no `.tag--grade-D` / `.badge--grade-D` rule, so a grade-D badge rendered unstyled
beside styled ones on the place detail and in the list.

**Why the first version of this audit missed it.** The browser check originally ran on Tokio
only — and Tokio has no grade-D place. Broadening it to Tokio + Osaka + Kioto reproduced the
defect immediately. The check is now data-driven across three hubs.

**Fix.** `app/src/App.tsx` — grade vocabulary extended to `["S", "A", "B", "C", "D"]`, kept in
editorial order, with a comment recording why an incomplete literal is unsafe here.
`app/src/components/PlaceMap.tsx` — explicit `D` entry reusing C's existing neutral colour (no
new palette entry, no visual-identity change). `app/src/App.css` — `.tag--grade-D` /
`.badge--grade-D` added to the existing grade-C rule.

**Regression proof.**
- `app/src/App.test.ts` — six tests. They are **data-driven**, not pinned to "D": they read the
  grade vocabulary out of `App.tsx`, the marker keys out of `PlaceMap.tsx` and the badge rules
  out of `App.css`, and compare each against the distinct grades actually present in
  `data/places.json`. A future grade added to the catalogue fails here rather than silently
  disappearing from the UI.
- Verified adversarially: reverting all three source edits makes **4 of the 6 fail**; restoring
  them makes all 9 tests in the file pass.
- `app/scripts/phase5a-rc-browser-audit.mjs` check **A05** asserts the same invariant in a real
  browser against the production build, per hub. Before the fix it reported
  `Osaka: grades present in the place list but not offered as filters: D`. After the fix it
  reports `Tokio:SABC Osaka:SABCD Kioto:SABCD` — D offered exactly where the data has it, and
  correctly absent in Tokio, which has none.

### RC-02 — MINOR — screen-reader count disagreement in the region navigator

**Reproduction.** With a screen reader, browse the national explorer. Chugoku, Shikoku, Kyushu,
Gifu, Shizuoka, Hiroshima, Kagawa and Fukuoka each hold exactly one place and were announced as
**"1 lugar verificado*s*"**. `RegionNavigator.tsx` pluralised the visible noun but hardcoded the
visually-hidden suffix as plural:

```tsx
{summary.placeCount} lugar{summary.placeCount === 1 ? "" : "es"}
<span className="visually-hidden"> verificados</span>
```

Sighted users never saw it; the text exists only for assistive technology. `PrefecturePanel.tsx`
already used the correct pattern, so this was an inconsistency, not a missing decision.

**Severity.** MINOR — nothing is unreachable or misstated factually. Fixed rather than deferred
because Issue #118 §3 permits a MINOR fix that is "trivial, isolated, and provably zero-risk":
this is a two-occurrence ternary copied verbatim from the sibling component that already had it
right, touching no logic, no state and no layout.

**Fix.** `app/src/components/RegionNavigator.tsx` — both occurrences now pluralise the hidden
suffix from the same count expression as the visible noun.

**Regression proof.** `app/src/components/RegionNavigator.test.ts` — four tests, including one
asserting the visible noun and the hidden suffix are driven by the *same* expression, and one
pinning `PrefecturePanel.tsx` as the reference pattern. Reverting the fix fails 3 of the 4.

### RC-03 — MAJOR — the root README described a product 13 phases out of date

**Reproduction.** `README.md` → "Current status: **Phase 2C — National Explorer**", with the
bullet "No itinerary generation, routing, or booking."

The repository at this base ships a full manual planner: ordered route, day assignment, calendar
anchoring from Day 1, stable day identity across reordering, trip bounds, manual inter-hub
segments, whole-trip composition, evidence-complete local swap/relocation, recorded hours and
closure composition, visit start-time fit, reservation mechanisms, trip-derived reservation
dates and a route-wide official reservation calendar — plus 144 licensed photographs closed for
v1 by Phase 4M. The README is the canonical current-state statement a reviewer reads first, and
it materially understated the product.

**Fix.** `README.md` — "Current status" rewritten to the audited current state, with the
distinction that matters preserved and sharpened: there is no **automatic** itinerary generation,
live transit, routing or booking, and the planner never reorders a route for the user.

**Regression proof.** No code change; the claims are the ones this audit verified end to end in
§4–§8 below. Verified against the audit's own evidence, not against the previous text.

### RC-04 — MAJOR — the app README described a Tokyo-only Phase 1 MVP with a 24-place photo pilot

**Reproduction.** `app/README.md` → title "**Nihon — Tokyo Explorer (Phase 1 MVP)**", describing
"an interactive Tokyo map", and under Photography: "a **24-place pilot**, not full dataset
coverage". The registry holds **144** records across **7** hubs and **214** places; the "24-place
pilot" claim is off by 120 records and describes a state five acquisition phases old.

**Fix.** `app/README.md` — title and description corrected to the national explorer plus manual
planner; the photography section restated at 144/214 with the Phase 4M closure linked, the
16 fail-closed exclusions named, and the acquisition instructions prefixed with the fact that no
further acquisition is authorized for v1.

**Regression proof.** No code change. The 144/214 figure, the one-photo-per-place invariant and
the 16 fail-closed exclusions are all asserted by the data-integrity audit in §3 below and by
`validate-photography.py`.

### RC-05 — MINOR — single JS chunk exceeds Vite's 500 kB advisory

The production build emits `(!) Some chunks are larger than 500 kB after minification`. The bundle
is **1,424,842 B raw / 259,730 B gzipped** (CSS 64,458 B raw / 14,290 B gzipped) — an ordinary
size for React + Leaflet plus the full 214-place dataset, and the warning is Vite's default
threshold advisory, not an error.

**Not fixed.** Code-splitting is a refactor, and Issue #118 §16/§17 forbid unrelated refactors in
this phase. Recorded for post-v1. Transfer size is not a release blocker: gzipped first load is
254 KiB of JavaScript.

---

## 3. Canonical-data integrity

Re-derived at HEAD from the canonical files by an audit script independent of the repository's
own validators, then cross-checked against every repository-native validator.

| Check | Result |
|---|---|
| Place count / unique IDs / `JP-nnn` format | **214**, all unique, all well-formed |
| Grade vocabulary | S 32 · A 147 · B 25 · C 6 · D 4 = 214 |
| Hub vocabulary | Fukuoka 1 · Kioto 49 · Nagoya 1 · Okinawa 50 · Osaka 53 · Sapporo 3 · Tokio 57 = 214 |
| Prefecture catalogue | 47 entries; every place prefecture resolves |
| Categories | 29 distinct, all non-empty |
| Nearby relations | **403**, all endpoints resolvable, no self-relations, denormalised names match `places.json` exactly |
| `places[].nearbyIds` | all resolvable, no self-reference |
| Photography canonical/app parity | byte-identical |
| `imageCount` vs records | 144 = 144 |
| Photography records | **144**, one per place, max 1 photo/place |
| Assets on disk | **144** WebP, every `assetPath` present, **no orphan assets** |
| Duplicate `sourceUrl` / `acquisitionUrl` / `assetPath` / `placeId` | **none** |
| Licences | CC BY-SA 4.0 ×63 · CC0 ×15 · CC BY 2.0 ×17 · CC BY 4.0 ×12 · CC BY-SA 3.0 ×12 · CC BY 2.5 ×11 · CC BY-SA 2.0 ×7 · CC BY 3.0 ×5 · CC BY-SA 2.5 ×2 — all inside `validate-photography.py`'s allowlist |
| Source / URL shapes | 144/144 Wikimedia Commons; all `sourceUrl` under `commons.wikimedia.org/wiki/File:`; all `licenseUrl` under `creativecommons.org`; no `acquisitionUrl` query strings |
| Alt text | every record carries non-empty alt |
| Fail-closed set | **16** IDs, all present in the dataset, **all 16 uncovered** |
| Reservation mechanisms | 8 records, canonical/app byte parity, all `placeId`s resolvable, IDs unique |
| Access points | 4 entries, canonical/app byte parity, all `placeId`s resolvable |
| Walking pilot/scale results | canonical/app byte parity |
| `places` / `clusters` / `nearby` / `seasonal-alerts` | canonical/app byte parity |
| Source workbook | unchanged vs base |

**An audit-script false positive, recorded for honesty.** The first pass of the audit script
flagged `CC BY-SA 2.5` (JP-057, JP-123) as outside the licence allowlist. That allowlist was
mine, transcribed from Phase 4L's *batch-local* licence mix rather than from the repository's
authority. `scripts/validate-photography.py:42` lists `CC BY-SA 2.5` explicitly. **The data is
correct; my heuristic was wrong**, and it was corrected to defer to the repository's allowlist.

**A second audit-script false positive.** A broad secret-shaped regex reported 257 "hits", all of
which were the English word *token(s)* in comments, test names and npm package names. Re-run with
provider-specific patterns (AWS/GitHub/OpenAI/Slack key shapes, PEM blocks, JWTs, assigned
long literals, openrouteservice keys): **0 hits**. No `.env` file is tracked; `ORS_API_KEY` is
read from the environment only, by build-time research scripts, never by the application.

---

## 4. Golden-path browser journeys

`app/scripts/phase5a-rc-browser-audit.mjs` — **50 checks**, run at two viewports against the
**production build** served by `vite preview`, not the dev server: an RC gate must exercise the
artifact that would ship, with real bundling, minification and asset paths.

Determinism follows the mechanism Phase 3F-H established: the browser's civil date is fixed
before boot by a test-only `addInitScript` Date shim. **No production test-date prop, query
parameter, localStorage field or planning-draft field exists.** Every non-local request is
recorded and stubbed, which also proves the core UI survives the one optional external resource
failing.

```bash
cd app && npm run build           # the audit runs against dist/, not the dev server
node scripts/phase5a-rc-browser-audit.mjs --viewport=desktop
node scripts/phase5a-rc-browser-audit.mjs --viewport=mobile
```

Set `NIHON_CHROMIUM_PATH` to override the Chromium binary when Playwright's own download is not
available; unset, it uses Playwright's normal resolution.

| Viewport | Result |
|---|---|
| Desktop 1440×900 | **50/50 pass** |
| Mobile 390×844 | **50/50 pass** |

### Journey A — discover → save → plan (A01–A15)

National explorer renders with all navigation regions and surfaces the 214-place catalogue ·
region → prefecture → hub navigation reaches 57 Tokio places · free-text search narrows 57 → 8
and restores to 57 on clear · **grade filter offers every grade present in each hub** (RC-01) ·
place detail renders a local photograph that genuinely decodes (`complete && naturalWidth > 0`)
with Commons attribution and alt text · an uncovered place renders the documented
"Sin fotografía disponible todavía" fallback and **no** image element · five places saved across
**two hubs** (Tokio + Kioto) · saved selection lists all five · ordered sequence built and
distributed into days · **Day 1 anchored to 2027-02-20** and persisted · **weekday composed from
the anchor** — the check computes the expectation with the same `Intl` contract
`formatCivilDateDisplay` uses and then re-anchors to prove derivation:
`sáb, 20 feb 2027 → dom, 21 feb 2027 → sáb, 20 feb 2027` · manual visit start time set and
persisted against the correct place and day · **manual inter-hub segment added across the
Tokio→Kioto boundary** (Shinkansen, 140 min), labelled "140 min registrados manualmente", both
endpoints inside the route · whole-trip composition renders · **reload reproduces saved places,
anchor, route, visit times and inter-hub segments exactly**.

### Journey B — edit an existing plan (B01–B06)

In-day reorder changes the draft · **membership preserved exactly**: the union of day buckets
equals `routeIds` with no duplicate day assignment · **stable day identity**: adding a day does
not regenerate existing day IDs, and a cross-day move preserves every ID while landing the place
in Día 2 · no orphaned visit time after a move · **removal leaves no stale dependent state** ·
edits survive reload.

### Journey C — reservation workflow (C01–C04)

A plan containing JP-044 (Ghibli Museum, monthly fixed release) and JP-050 (PokéPark KANTO,
two active same-scope records) surfaces the reservation preparation and dated reservation
sections · the **route-wide official reservation calendar renders 3 rows with no duplicates** ·
reservation dates derive from the anchored 2027 trip date, with **no `1970`, `Invalid Date` or
`NaN`** leaking · **no invented personal-applicability claim** — the copy never says "aplica para
ti", "eres residente", "puedes comprar" or "recomendamos" · **hours and closure signals never
overclaim** (C05): no "estará abierto", "abre a las", "cierra hoy" or "garantiza" anywhere, the
weekday notice keeps its hedged accessible name *"Posibles coincidencias de cierre semanal"*, and
its body either reports hedged matches (each carrying "posible" and "confirma el horario/cierre
oficial") or states plainly that none were detected — a detection statement, never a claim that a
place is open · **visit-start fit is offered only beside a recorded interval** (C06): every
rendered time input sits next to its raw datum `Dato: «…»`, and the section's disclaimer that it
"no indica si el lugar abre, no revisa cierres ni festivos" is present.

### Journey D — logistics (D01–D02)

A validated-static walking transfer is labelled "Ruta a pie validada" · **no row claims both
validated and estimated provenance**; 3 validated transfers, 0 conflated. The UI never promotes
an estimate to validated-static and never fabricates reverse or chained routing.

### Journey E — photography (E01–E04)

Historical photograph (JP-013 Golden Gai) and Phase 4L photograph (JP-051 Mount Takao) both load
from local `/images/places/…` assets and genuinely decode · carried fail-closed target JP-050
keeps its fallback and renders **no** image · **zero runtime photography-provider requests**
across every intercepted external request in the run.

---

## 5. Mobile / responsive

Full 50-check suite re-run at **390×844**, not a subset.

**The audit's first mobile run failed 25 checks. The harness was wrong, not the product.**
Below the 861 px breakpoint the app is deliberately map-first: `.app__sidebar` — search, filters
and the place list — is `display: none` until the "🔍 Buscar y filtrar" toggle opens it, and
selecting a place closes it again so the detail panel is unobstructed. The harness had assumed
the desktop layout, where the sidebar is always present. It is now viewport-aware, and a
dedicated check (**G01b**) proves the drawer opens on hub entry, closes via "Cerrar búsqueda y
filtros", and reopens with the full 57-place list intact. Recorded here because a reader should
not have to wonder whether a mobile layout that hides its list by default was ever a finding: it
was examined against the CSS and the component, and it is intentional.

- **No horizontal overflow** on national, hub, place-detail or planner screens at either viewport.
- Primary touch targets (place-list rows, selection toggle, filter chips) all ≥ 32 px tall.
- The planner's trip-anchor control is visible, has non-zero size, and **is not covered by any
  fixed element** — asserted with `elementFromPoint` at the control's own centre, so a sticky
  header or drawer overlapping it would fail.
- Filters, search, place list, detail panel, planner and reservation calendar all operable, with
  the drawer opened and closed repeatedly across the run.
- The full planning journey — save across two hubs, order, assign days, anchor Day 1, set a visit
  start time, add a Shinkansen inter-hub segment, reload — completes at 390×844 exactly as at
  1440×900.

---

## 6. Accessibility sanity (F01–F05)

| Check | Result |
|---|---|
| Product images carry alt text | pass — every non-decorative product image labelled |
| Native semantics | pass — no `[onclick]`, `div[role=button]` or `span[role=button]` outside the map |
| Form controls labelled | pass — every `input`/`select`/`textarea` in the planner has a label, `aria-label` or `aria-labelledby` |
| Keyboard focus visible | pass — first tab stop is a `BUTTON` with `outline: solid 3px` |
| No keyboard trap | pass — 60 consecutive Tab presses reach 13 distinct stops inside the planner dialog, and **Escape dismisses it** |

The planner dialog **contains** focus while open, which is the correct behaviour for
`role="dialog" aria-modal="true"` — a trap would be being unable to leave. The audit therefore
asserts the exit: `OrderedSequenceBuilder.tsx` binds Escape, and F05 proves the dialog is actually
detached after pressing it.

The planner's reorder controls carry place-specific accessible names ("Mover *Meiji Jingu* hacia
abajo en Día 1", "Mover *X* al día siguiente"), so a screen-reader user always knows which list
they are moving something within — verified directly in the DOM.

**Observation, not a finding.** Leaflet's own tile `<img>` elements carry no `alt` attribute.
They are third-party decorative map infrastructure, not product content; every product image is
labelled. Recorded for post-v1 alongside any Leaflet upgrade. The F01 check scopes to product
images and excludes `.leaflet-container`, matching F02's existing exclusion.

---

## 7. Runtime / network integrity (H01–H05)

| Check | Result |
|---|---|
| Photography providers contacted | **none** (no wikimedia / wikipedia / creativecommons request) |
| Transit providers activated | **none** (no ekispert / navitime / openrouteservice / mapbox / googleapis) |
| Secret-bearing or localhost-service requests | **none** |
| External hosts reached | **only** `a/b/c.tile.openstreetmap.org` |
| Core UI with external resources failing | pass — 57 places render with every tile stubbed |
| Console errors / page errors | **0 page errors, 0 console errors** |

**The single documented intentional external runtime request is the OpenStreetMap tile layer**
(`PlaceMap.tsx`), attributed in the UI per OSM's licence. The dormant transit provider contract
in `app/src/lib/transit.ts` and `app/server/transit.ts` is **not imported by any component** —
verified by search, and by zero transit requests across both full runs.

---

## 8. Persistence and migration (I01–I02, plus A15/B06)

Two keys: `nihon.savedPlaceIds` and `nihon.manualPlanningDraft` (draft version 7).

| Check | Result |
|---|---|
| Clean first run | pass — empty profile renders, no saved state invented |
| Saved places survive reload | pass |
| Planning draft survives reload | pass — route, day IDs, anchor, visit times, inter-hub segments |
| Stable day IDs survive reorder + reload | pass |
| Visit times stay attached to the right place and day | pass — no orphans after moves |
| Inter-hub segments stay attached | pass — both endpoints always inside the route |
| Deleting a place leaves no stale dependent state | pass |
| Malformed / older payloads fail safe | pass — `{"not":"an array"}`, `[1,2,3]`, `not json at all`, `["JP-XXX"]` each render the app with **0 page errors** |

**No migration system was invented.** The current contract is documented and was verified as-is:
`useSavedPlaces` falls back to `[]` on any non-array or parse failure, and unknown IDs are
dropped at the presentation layer by `savedIds.map(getPlaceById).filter(Boolean)`.

### Two deliberate contracts verified, not "fixed"

Both looked like data loss until the authority was read. Neither is a defect.

1. **Removing a place from the route invalidates the day assignment** (`days: null`).
   `lib/planning-draft.ts::withRoute` documents this: a pure reorder keeps the day assignment,
   but any change to the *set* of places discards it, because the module "never invents which day
   a newly-added place belongs to, or repairs a day that no longer accounts for a removed one".
   The audit verifies what actually matters for release — that **nothing stale survives** the
   reset: visit times, accommodation legs and inter-hub segments are all pruned to the new route.
2. **`reconcileDraft` prunes a stored route to the still-saved places and never auto-appends
   newly saved ones.** Saving a new place does not silently rewrite an existing ordered route.

The audit harness now seeds planning state explicitly rather than depending on a previous
journey's draft, because both contracts (correctly) make that state non-obvious.

---

## 9. Temporal / reservation correctness

Verified against the repository's checked-in evidence model only. No attraction's live hours were
browsed; that is explicitly not what this gate does.

- Day 1 anchoring composes the civil date and weekday correctly, and **re-anchoring recomposes
  them** — proven by moving the anchor one day and asserting the previous label is gone.
- Closure and hours signals render through the recorded-hours vocabulary
  ("Horario registrado", "Sin horario registrado; revisar", "Horario depende de clima o marea;
  revisar", …) and the weekday-closure notice is titled "**Posibles** coincidencias de cierre
  semanal" — a possibility, never a claim that a place is open or closed.
- Visit-start fit renders only for places with both a valid visit date and a recorded interval,
  and carries its own disclaimer that it "no indica si el lugar abre, no revisa cierres ni
  festivos, y no calcula a qué hora llegarías a ningún otro lugar".
- Reservation dates derive from the trip/reference date; no `1970`, `Invalid Date` or `NaN`.
- Same-scope mechanisms compose exhaustively (JP-050 carries two active records sharing one
  `placeId + scope` and both render); purchase/residence context does not disappear.
- The route-wide calendar renders each eligible mechanism exactly once — **no duplicate and no
  missing row** across the audited plans.
- No unsupported live-schedule claim is introduced anywhere.

---

## 10. Planner integrity

Exercised with a **multi-day, multi-hub** plan (Tokio ×3 + Kioto ×2, anchored 2027-02-20, one
visit start time, one Shinkansen inter-hub segment):

- Every selected place appears exactly where expected.
- **No duplicate day assignment** — the union of day buckets is a partition of `routeIds`.
- No lost place after reorder; no invalid cross-day reference.
- Local swap/relocation surfaces ("Alternativas locales con evidencia completa") render and
  preserve membership.
- Inter-hub segment boundaries are coherent: both endpoints are consecutive route members in
  different hubs, and the duration is labelled as manually recorded.
- Trip bounds remain coherent after edits.
- Whole-trip summaries reconcile with the underlying day and segment data.
- **Quantified visit time stays distinct** from transport estimates and day-scale commitments —
  the disclaimer that known transfers "no incluyen tiempo dentro de cada lugar" is rendered, and
  day-scale durations are reported separately as "sin estimación numérica".

**No automatic route optimization was added.** Every ordering decision in the product remains the
user's.

---

## 11. Security / release hygiene

| Check | Result |
|---|---|
| Committed secrets / tokens | **none** (provider-shaped scan over every tracked file) |
| `.env` files tracked | none; `.env` and `.env.*` are gitignored |
| Debug-only code in production paths | **none** — zero `console.*` in non-test `app/src` |
| `TODO` / `FIXME` / `XXX` / `HACK` markers | **none** in `app/src`, `app/server` or `scripts` |
| Development-only URLs | **none** — no `localhost`, `127.0.0.1` or `http://` in shipped source |
| Temporary workflows / files | none — no `.github` directory; prior phases' temporary workflows were removed at their own closure |
| Tracked build artifacts / source maps | none — `dist/` is gitignored, no `.map` tracked |
| Licence / attribution obligations | satisfied — every photograph renders its Commons source link, author credit and licence link; OSM tiles carry their required attribution |

---

## 12. Production quality gates at the final HEAD

| Gate | Result |
|---|---|
| Python tests | **543 passed** (unchanged — Phase 5A adds no Python) |
| Vitest | **2450 passed**, 66 files (+10 tests, +1 file: the RC-01 and RC-02 regressions) |
| Lint (`oxlint`) | clean |
| Production build | success |
| `validate-dataset.py` | OK — 214 places, 403 nearby relations, 0 broken references |
| `validate-geography.py` | OK |
| `validate-logistics.py` | OK |
| `validate-photography.py` | OK |
| `validate-access-points.py` | OK |
| `validate-reservation-mechanisms.py` | OK |
| `validate-walking-access-point-results.py` | OK |
| RC browser audit — desktop | **50/50** |
| RC browser audit — mobile | **50/50** |
| Whitespace gate | clean |
| Dependency install | `npm ci` reproducible from `package-lock.json` |

**No historical assertion was weakened or deleted to make RC pass.** The Vitest count moved only
upward, and the Python suite is byte-for-byte the same 543 tests as the baseline.

### Pre-existing warnings, unchanged by this phase

`validate-dataset.py` emits **13 secondary-metadata warnings**, present identically at the base
commit. Two concern cluster CL-87 (Tokio / Tokyo Marathon): its metadata claims 1 place while its
places give 0, and it lists JP-213 whose own hub+cluster is Tokio/Shinjuku. These are editorial
cluster-metadata inconsistencies in `data/clusters.json`, they do not affect any user-facing
journey audited here, and the validator exits **OK**. Recorded, not fixed: correcting cluster
metadata is a dataset edit outside this phase's remit.

---

## 13. Changed-file scope

```
README.md                                     documentation (RC-03)
app/README.md                                 documentation (RC-04)
app/src/App.tsx                               production fix (RC-01)
app/src/App.css                               production fix (RC-01)
app/src/components/PlaceMap.tsx               production fix (RC-01)
app/src/components/RegionNavigator.tsx        production fix (RC-02)
app/src/App.test.ts                           regression tests (RC-01)
app/src/components/RegionNavigator.test.ts    regression tests (RC-02, new)
app/scripts/phase5a-rc-browser-audit.mjs      RC audit harness (new)
docs/RELEASE_CANDIDATE_AUDIT.md               this document (new)
docs/ROADMAP.md                               Phase 5A entry
```

**Four production-source files changed, each mapping to exactly one documented finding.** No
dataset file, no photography metadata, no image asset, no planner/logistics/reservation/temporal
library, and no historical phase artifact was touched. No feature was added, no grade changed, no
photograph acquired, no transit activated, no automatic scheduling introduced, and no visual
identity redesigned.

---

## 14. Unresolved findings

**No BLOCKER or MAJOR finding remains open.**

Deferred to post-v1, none release-blocking:

| ID | Severity | Item |
|---|---|---|
| RC-05 | MINOR | Single JS chunk above Vite's 500 kB advisory (259,730 B gzipped). Code-splitting is a refactor, forbidden in this phase. |
| OBS-1 | MINOR | Leaflet tile `<img>` elements carry no `alt`. Third-party decorative DOM; all product images are labelled. |
| OBS-2 | MINOR | 13 pre-existing `validate-dataset.py` secondary-metadata warnings, including CL-87's place-count and JP-213 cluster mismatch. Validator exits OK. |
| OBS-3 | MINOR | `JP-149` MIHO Museum is filed under the Osaka hub but sits in Kōka, Shiga — a pre-existing `data/places.json` assignment first recorded by Phase 4L, matching the same convention that files Kobe subjects under Osaka. |

---

## 15. Scope boundary

Phase 5A does **not**: add destinations or places; change editorial grades; acquire photography;
start Phase 4N; activate live transit; add automatic itinerary scheduling; redesign the visual
identity; replace the planning model; broaden reservation semantics beyond the shipped evidence
model; or create a new feature roadmap.

It does not tag or release v1. The next step is the independent Nihon v1 RC closure/release gate,
which Phase 5A does not start.
