# TRACK: ASTRA

MODEL ROLE: ASTRA DIRECTOR

# ASTRA AUDIT — SOL-0–SOL-2

**Verdict: FAIL.** A source-verifiable P0 can prune an authored V7 plan after an ordinary save removal, and several P1 requirements/preserved entry points are absent. Rendered fidelity remains **PARTIAL** because this runner has no browser executable and the official Playwright download returned HTTP 403. This audit does not approve SOL-3.

## 1. Identity, base and evidence

- Repository content: `Z3roM4str/-nihon-travel-explorer`; checkout branch: `work` (implementation branch in this environment, not destination branch `experiment/astra-redesign`).
- Requested SHA: `fc09e33f906963dd5ed51c2615dd4677060f5432`.
- Actual supplied HEAD: `523758b07aa054a0376a0be8a28020805c9cc41f`, commit title `Astra SOL-0–2: responsive discovery foundation`.
- The requested object is absent locally, so byte-for-byte equivalence cannot be proven. The actual HEAD has the same parent (`b986a60`), title/content scope, 10 changed paths and 237 additions/433 deletions described by PR #122. The audit therefore targets actual HEAD `523758b`; the SHA discrepancy is recorded rather than silently ignored.
- Base diff: `b986a60dc5c115e76af45fd53f8dfd9b7e46d448..523758b07aa054a0376a0be8a28020805c9cc41f`. Stable base `1a11fe8c...` and authority `a31c6ea...` are ancestors. Working tree was clean before audit. No main/Claude branch was inspected or changed.
- Reproduction log: `docs/astra/evidence/audit-sol-0-2/static-checks.txt`. No screenshot exists because browser startup could not be provisioned.

## 2. Browser reproduction

Required routes/states were prepared conceptually for `#/explorar`, hub search/category/pagination, place detail, save/reload, `#/viaje`, region navigation and V7-plan survival at 375×812, 390×844, 430×932, 768×1024, 1024×768, 1440×900 and 320px/200% reflow, profile fixture `Mis gustos`, canonical dataset fixture (214 places).

Execution could not begin: no Chromium/Chrome/Firefox binary was present. `npx playwright install chromium` attempted the Playwright CDN five times and each returned exactly `403 Forbidden` for Chrome for Testing 151.0.7922.34. Consequently there is no defensible evidence for layout, focus, keyboard, back/forward, screenshots, image-to-place correctness, overflow, reduced motion or screen-reader output. Those criteria are PARTIAL unless a static contradiction makes them FAIL.

## 3. Findings

### P0 — PLAN-01 / VOTE-05 — authored V7 route can be silently pruned

- **Screen/component:** `Nuestro viaje` removal, card save toggle, then `OrderedSequenceBuilder` / `usePlanningDraft`.
- **Evidence:** `App.tsx` passes only current `savedPlaces` into `OrderedSequenceBuilder`. The trip list calls `removeSaved` directly and every card calls `toggleSaved` directly, without route-impact confirmation. `OrderedSequenceBuilder` derives `savedIds` from that reduced list and calls `usePlanningDraft(savedIds)`. On mount, `loadReconciledDraft` reconciles against those IDs; its effect also calls `reconcileDraft(current, savedIds)`, and the next persistence effect writes the pruned draft.
- **Expected:** SOL-2 requires an impact confirmation or routing to Planificar before withdrawing a saved ID in an authored route. DA-09 and the stop condition forbid save/filter/profile mutations from pruning authored plans.
- **Actual:** Removing a planned save succeeds immediately. Opening Planificar supplies the reduced ID set and can persist a reconciled V7 draft without the planned place.
- **Reason:** Irreversible silent loss of authored route/day/accommodation/logistics state; explicit P0 stop condition.
- **Exact correction:** Add a read-only V7 planned-ID/impact adapter before either unsave path. If the ID is referenced anywhere in the authored draft, do not mutate `nihon.savedPlaceIds`; show a named confirmation/route-to-Planificar flow that explains the impact. Until an explicit route-removal operation exists, cancellation must leave save and complete V7 bytes unchanged. Never reconcile V7 against active-person/filtered liked IDs. Add integration coverage with a genuine V7 fixture.
- **Acceptance test:** Seed a V7 route containing `JP-002`, including stable day IDs, visit time, accommodation boundary/leg and inter-hub evidence. Try unsaving from card and Nuestro viaje; cancel. Reload and open planner: saved list and serialized V7 fixture are byte-equivalent. Any confirmed removal must be an explicit planner operation with impact preview; it must not occur through the card toggle.

### P1 — NAV-03 / FIL-01 / MAP-01 — existing exploration functions were made unreachable

- **Screen/component:** Explorar controls.
- **Evidence:** The base `App.tsx` wired `FilterPanel`, `PlaceMap`, `HubSelector` and their full filter vocabulary. The PR deletes those imports/render paths. New discovery exposes only search, one hub select, one category select and a region link. `matchesFilters` and the S–D list are retained only as dead expressions (`void preservedFilterContract`, `void grades`). There is no `Filtros (n)` control and no labelled `Lista / Mapa` switch.
- **Expected:** SOL-1 preserves existing region/hub/function entry points; SOL-2 does not remove canonical filter functions. DA-05 requires the three quick controls and labelled list/map switch. Deferred SOL-6 may redesign advanced/map behavior, but cannot make existing mature functions unreachable.
- **Actual:** Grade, tourism, hidden-gem, reservation and planning-block filtering plus hub map exploration disappeared from reachable UI.
- **Reason:** Functional regression and omission of researched functionality; users cannot perform previously supported exploration tasks.
- **Exact correction:** Restore reachable existing FilterPanel/PlaceMap behavior behind Astra-conformant `Filtros (n)` and `Lista / Mapa` controls without implementing SOL-6's future redesign. Keep draft/apply semantics only if already present; otherwise preserve existing semantics visibly and label the transitional scope. Delete dead compatibility expressions only after real wiring replaces them.
- **Acceptance test:** From Explorar, reach every previous filter dimension, apply reservation and duration filters with canonical semantics, switch list/map, and obtain matching IDs/counts. Reach all hubs and region/prefecture navigation. Existing FilterPanel, map and geography tests plus a browser journey pass.

### P1 — NAV-02 — URL history does not preserve exploration state and close/back is incorrect

- **Screen/component:** Discovery → detail → close/back; browser back/forward; hub query.
- **Evidence:** Search, category and pagination never enter the URL or a keyed restoration store. `closeDetail` assigns a new exploration hash instead of consuming the detail history entry. `Discovery` initializes `hub` from props only once; later back/forward route updates can leave the mounted local hub state different from `route.hub`. Nearby detail navigation replaces the origin with only a destination hub query and no ordered trail.
- **Expected:** Back first closes the overlay, forward restores it, search/filter/page/scroll origin returns intact, and nearby cross-hub history unwinds in order.
- **Actual:** Close pushes another entry, browser Back may reopen the just-closed detail, exploration query/category/page/scroll are lost, and route/local hub can diverge.
- **Reason:** Core navigation contract is unreliable and browser controls do not reflect visible state.
- **Exact correction:** Implement a typed navigation state containing validated hub/category/query/page and an origin key; use real history entries for detail/nearby trail. Close should `history.back()` only when a same-app origin exists, otherwise replace/fallback to `#/explorar`. Synchronize component state on `popstate/hashchange`, restore pagination and keyed scroll, and test forward as well as back.
- **Acceptance test:** Search accentlessly, choose category/hub, load 24, scroll, open a place, follow a cross-hub nearby place, Back twice, then Forward twice. Each URL, overlay, results, loaded count and scroll position matches the prior state; direct detail close falls back safely without leaving the app.

### P1 — DIS-01 — default national order is not the authority's interleaving algorithm

- **Screen/component:** Global discovery result ordering.
- **Evidence:** The comparator sorts grade, then hub index, then ID. This groups every place from the first hub before proceeding to the next hub within a grade.
- **Expected:** Grade S→A→B→C→D; within each grade, interleave hubs in canonical stable order; within each hub preserve place-ID order. Explicit hub view uses grade then ID.
- **Actual:** Hubs are grouped, not round-robin interleaved.
- **Reason:** The first pages overrepresent early hubs and contradict the specified reproducible editorial distribution.
- **Exact correction:** Build ordered grade buckets, stable ID queues per hub, then round-robin one item from each canonical hub until exhausted. Retain grade→ID for an explicit hub. Unit-test the exact first 24 IDs and full 214-ID uniqueness/determinism.
- **Acceptance test:** A fixture with uneven two-hub queues produces alternating hub IDs until one queue exhausts; canonical global results contain all 214 IDs once and remain identical across reloads.

### P1 — CARD-01 / IMG-02 / IMG-04 — card structure and photo failure contract are incomplete

- **Screen/component:** Place cards, particularly photographed cards and failed image state.
- **Evidence:** Photo credit `<details>` is inserted between the image and card body, so the required vertical sequence does not proceed image → recommendation → title. On image error the card replaces the photo with text but offers no retry; the attribution remains visible for an image that failed. There is no loading skeleton/state in the card implementation.
- **Expected:** Exact DA-06 order; fixed 4:3 loading/error area, retry, and complete accessible attribution without disrupting card hierarchy.
- **Actual:** Credit interrupts the required order, error is terminal, and loading state is unrepresented.
- **Reason:** Hierarchy/fidelity failure and non-recoverable image error.
- **Exact correction:** Keep the exact card content order and expose attribution through a compact, labelled control in the designated photo/status area or detail without inserting it before the recommendation. Add fixed-ratio loading, error text and a 48px retry button that retries the same correct-place local asset; never substitute another image.
- **Acceptance test:** Zero-image, one-image, delayed-load and forced-error fixtures retain identical 4:3 geometry. Forced error exposes Retry; retry reloads the same URL. DOM order is image, recommendation, title, location/category, description, facts, seasonal signal, saved status/action.

### P1 — A11Y-02 / DET-01 — detail overlay is not implemented as an accessible modal route

- **Screen/component:** Place detail overlay.
- **Evidence:** The outer element is `role="presentation"`; the panel has no dialog role/`aria-modal`, no focus trap, no background inerting, no opener focus restoration owned by the route and no top-layer Escape orchestration. Static CSS hides mobile bottom navigation using `:has`, but semantics remain active behind the overlay.
- **Expected:** Mobile fullscreen/tablet/desktop dialog contract, inert background, trapped focus, Escape closes only top layer and focus returns to the invoking title/image.
- **Actual:** A visually overlaid legacy detail is mounted without modal semantics/ownership.
- **Reason:** Keyboard and screen-reader users can reach hidden background controls or lose their place.
- **Exact correction:** Add an Astra route-dialog wrapper with `role="dialog"`, `aria-modal`, labelled heading, focus trap, inert/app isolation, Escape stack and opener restoration. Preserve PlaceDetail factual content; do not begin SOL-3 gallery redesign.
- **Acceptance test:** Keyboard-only open from title and image, cycle focus for two loops, confirm no shell/card focus, Escape closes only the top layer, and focus returns to the exact opener. Repeat with photo lightbox nested above detail.

### P1 — PERF-01 — required lazy boundaries are absent

- **Screen/component:** Initial Explorar load/bundle.
- **Evidence:** `NationalExplorer` and `OrderedSequenceBuilder` are static imports from `App.tsx`; `NationalExplorer` statically imports map code. Build output is one 1,411.01 kB JS chunk and reports the >500 kB advisory.
- **Expected:** SOL-1 explicitly requires separate lazy map/planner boundaries; initial list must not load map/provider code.
- **Actual:** Map/planner modules remain in the initial JavaScript chunk even if not instantiated.
- **Reason:** Avoidable initial payload and failure of a named SOL-1 deliverable.
- **Exact correction:** Use `React.lazy`/dynamic imports with accessible fixed-size fallbacks at the map/national-map and planner boundaries. Do not alter planner semantics. Verify that the initial `#/explorar` network/module trace does not request map/planner chunks or tile/provider resources.
- **Acceptance test:** Clean-load Explorar; network trace contains neither deferred chunk nor tile/provider request. Opening regions/map loads its chunk; opening Planificar loads planner chunk and passes the existing V7 journeys.

### P2 — DIS-01 / A11Y-03 — search/result and pagination announcements do not match contract

- **Screen/component:** Search and “Ver 12 más”.
- **Evidence:** Result status updates immediately rather than after the specified 200ms debounce. Pagination refocuses the same button but does not announce the newly appended result range/heading. There is no conditional clear control when text exists.
- **Expected:** Stable keyboard focus, 200ms debounced status, clear control only for non-empty query, and announcement of newly added results.
- **Actual:** Immediate count chatter, no clear control, no appended-range announcement.
- **Reason:** Noisy assistive output and incomplete keyboard/search affordance.
- **Exact correction:** Keep synchronous filtering but debounce only one live-region message by 200ms; add labelled 48px clear control when query is non-empty; announce `Resultados 13–24 añadidos` while retaining focus on the load-more control.
- **Acceptance test:** Type three characters rapidly: one announcement occurs after 200ms. Clear appears only for text and restores all current-scope matches without focus loss. Loading more announces exactly the appended range once.

## 4. Audit matrix (scope SOL-0–SOL-2)

| ID | Verdict | Evidence/disposition |
|---|---|---|
| PRE-01 | PARTIAL | Correct ancestry/base and clean initial tree; requested SHA absent, actual equivalent-scope HEAD `523758b` audited. |
| PRE-02 | PASS | Diff limited to app Astra shell/discovery plus handoff; validators show canonical counts/assets unchanged. |
| NAV-01 | PARTIAL | Two labels/person exist statically; no rendered 390/768/1440 evidence. |
| NAV-02 | FAIL | P1 history/state restoration finding. |
| NAV-03 | FAIL | Regions remain reachable, but map/full filter function entry points were removed. |
| VIS-01 | PARTIAL | Tokens/native stack present; rendered typography/icons not inspected. |
| VIS-02 | PARTIAL | CSS declares 1/2/3 columns; no rendered proportions evidence. |
| VIS-03 | PARTIAL | Browser blocked at every required viewport/reflow. |
| DIS-01 | FAIL | Search exists; national ordering, URL/restoration and announcements fail contract. |
| DIS-02 | PASS | Source filters begin from all 214 places and do not exclude grade/photo by default; validator confirms 214. |
| CARD-01 | FAIL | Credit interrupts exact order; see P1. |
| CARD-02 | PASS | Source has sibling detail anchors and save button, not nested. |
| CARD-03 | PARTIAL | No raw IDs/generated copy in card source; enlarged-text clipping unrendered. |
| REC-01 | PASS | S/A/B/C/D and unknown have distinct editorial labels; no automatic tourism equivalence. |
| DET-01 | FAIL | Static accessible-modal failure; responsive rendering additionally unverified. |
| DET-02 | PARTIAL | Legacy PlaceDetail retained, but browser reachability/content disclosure unverified. |
| DET-03 | PASS | Card/detail reuse canonical duration/reservation adapters; no data edits. |
| IMG-01 | PARTIAL | Registry resolves correct-place local asset or honest pending state; visual identity/aspect not inspected. |
| IMG-02 | FAIL | Attribution exists but card hierarchy violates contract; rendered reachability unverified. |
| IMG-03 | PARTIAL | Existing gallery retained; gestures/browser states unverified and SOL-3 deferred. |
| IMG-04 | FAIL | No card retry/loading state. |
| IMG-05 | PASS | Photography validator passes; fail-closed metadata/data unchanged. |
| VOTE-01–03 | PARTIAL / deferred | SOL-4 couple model correctly not claimed; temporary adapter is labelled single-reviewer. |
| VOTE-04 | PASS for applicable slice | Existing save key remains; no ownership migration introduced. |
| VOTE-05 | FAIL | P0 authored-plan pruning path. |
| TRIP-01–03 | PARTIAL / deferred | SOL-4/5; no partner counts claimed. Transitional trip surface only. |
| PLAN-01 | FAIL | Planner reachable, but unsave→planner reconciliation can prune prior V7 state. |
| PLAN-02 | PASS for unchanged domain | Domain tests pass; product code for calculations unchanged. |
| MAP-01–03 | FAIL/PARTIAL deferred | Existing map entry removed (P1); SOL-6 redesign deferred. |
| FIL-01 | FAIL | Required minimal controls and preserved vocabulary are not reachable. |
| FIL-02 | PARTIAL / deferred | SOL-6 advanced sheet deferred, but existing functionality must first be restored. |
| A11Y-01 | PARTIAL | Token contrast can be statically inferred; rendered pixels/states unavailable. |
| A11Y-02 | FAIL | Detail lacks accessible modal ownership; keyboard run blocked. |
| A11Y-03 | FAIL | Search/pagination live behavior incomplete; other rendered semantics unverified. |
| A11Y-04 | PARTIAL | CSS targets/reduced-motion rules exist; touch/safe-area/reflow not rendered. |
| ERR-01 | FAIL | Image error has no retry; dataset/map/storage recovery not browser-tested. |
| PERF-01 | FAIL | Static imports defeat required lazy map/planner boundaries. |
| PERF-02 | PARTIAL | Build measured; no baseline delta/interaction trace, 1.41 MB advisory remains. |
| QA-01 | PASS | 2453 tests, lint, build and five passive validators pass; assertions not changed. |
| QA-02 | PARTIAL | Browser/CDN 403; no screenshots or independent visual certification. |

SYNC/STAY and full SOL-3+ gallery/couple/map/filter/backend/research criteria are deferred, not passed. No deferred item is represented as delivered.

## 5. Tests and validators

- `npm test -- --run`: PASS, 67 files / 2453 tests.
- `npm run lint`: PASS, no diagnostics.
- `npm run build`: PASS with >500 kB chunk advisory; output JS 1,411.01 kB (257.48 kB gzip).
- `python scripts/validate-dataset.py`: PASS, 214 places/403 relations/0 broken; 13 known secondary warnings.
- `python scripts/validate-photography.py`: PASS.
- `python scripts/validate-geography.py`: PASS, 47 prefectures/9 regions/214 places/7 hubs.
- `python scripts/validate-logistics.py`: PASS.
- `python scripts/validate-reservation-mechanisms.py`: PASS.
- `git diff --check b986a60..HEAD`: PASS.
- `npx playwright install chromium`: BLOCKED, five HTTP 403 responses; no browser evidence.

## 6. PROMPT PARA SOL — CORRECCIONES

```text
TRACK: ASTRA
MODEL ROLE: SOL IMPLEMENTER

Repository: Z3roM4str/-nihon-travel-explorer
Destination remains experiment/astra-redesign; work only on the PR implementation branch supplied by the environment. Do not modify main, merge, force-push, inspect Claude branches or begin SOL-3.

Audit target actually inspected: 523758b07aa054a0376a0be8a28020805c9cc41f. The user-requested fc09e33f906963dd5ed51c2615dd4677060f5432 was absent from the audit checkout; 523758b has parent b986a60 and the same PR #122 scope/statistics. Read docs/astra/ASTRA_AUDIT_SOL_0_2.md fully before editing.

Correct only these SOL-0–SOL-2 findings, in severity order:
1. P0 PLAN-01/VOTE-05: block ordinary unsave of any ID referenced by the authored V7 draft. Add a read-only impact adapter and explicit confirmation/Planificar route; cancel preserves save and byte-equivalent V7 state. Never reconcile planning against filtered/active-person likes. Add a genuine V7 survival integration test covering day IDs, visit times, accommodation boundary/legs and inter-hub evidence.
2. P1 NAV-03/FIL-01/MAP-01: restore reachable existing FilterPanel and PlaceMap capabilities behind authority-compliant Filtros (n) and Lista/Mapa controls. Preserve all existing filter semantics and region/hub entry points; do not implement the broader SOL-6 redesign.
3. P1 NAV-02: implement typed hash/history origin state for hub/query/category/page/scroll and ordered nearby details. Close consumes same-app detail history or safely replaces on direct link. Back/Forward must restore visible state.
4. P1 DIS-01: implement grade buckets with canonical-hub round-robin interleaving and stable ID order; hub view remains grade→ID. Test exact deterministic IDs and all 214 unique results.
5. P1 CARD-01/IMG-02/IMG-04: restore exact card DOM order; move attribution without interrupting image→recommendation→title; add fixed-ratio loading/error and retry of the same correct-place local image.
6. P1 A11Y-02/DET-01: add accessible route-dialog ownership around retained PlaceDetail: dialog semantics, inert background, focus trap/restore and top-layer Escape. Do not redesign detail/gallery (SOL-3 remains forbidden).
7. P1 PERF-01: add real dynamic/lazy boundaries for national/map and planner modules with accessible fallbacks; prove initial Explorar loads no deferred map/planner chunk or provider/tile request.
8. P2 DIS-01/A11Y-03: debounce only the live count by 200ms, add conditional clear, and announce the appended pagination range while keeping focus.

Browser certification remains mandatory but was blocked in audit: Playwright Chromium download returned HTTP 403 five times. If your runner has a browser, capture 375×812, 390×844, 430×932, 768×1024, 1024×768, 1440×900 and 320px/200% reflow for default discovery, photographed/missing/error cards, filters, detail, Nuestro viaje and seeded-plan survival. Record route, viewport, profile Mis gustos, canonical 214-place fixture and steps. If blocked again, preserve the exact error and report PARTIAL; never claim visual PASS.

Run: focused new tests, full npm test -- --run, npm run lint, npm run build, dataset/photography/geography/logistics/reservation validators, git diff --check. Do not weaken existing assertions. Commit coherent corrections as astra(sol-1): / astra(sol-2): and update SOL_HANDOFF with actual SHAs, evidence and remaining PARTIAL items. Stop after corrections and return to Astra audit; do not start SOL-3.
```
