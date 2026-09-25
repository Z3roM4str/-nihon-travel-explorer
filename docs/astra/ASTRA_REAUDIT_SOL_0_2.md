# TRACK: ASTRA

MODEL ROLE: ASTRA DIRECTOR

# ASTRA REAUDIT — SOL-0–SOL-2

**Verdict: FAIL (source/runtime-static); visual certification PARTIAL.** The P0 plan-loss path is blocked in the inspected source, but this second audit found three source-verifiable correction defects: advanced filter state is not durable and multi-category selection is actively reset (P1), scroll/filter restoration remains incomplete (P1), and the image retry button is illegally nested inside the detail link (P1). The advanced-filter dialog also lacks modal focus/inert/Escape ownership (P1). Browser-dependent evidence remains unavailable and is not marked PASS.

## 1. Identity and scope

- Repository: `Z3roM4str/-nihon-travel-explorer`.
- Actual PR implementation HEAD supplied for re-audit: `19c168d39d0ed2c052fb95e8497b46011604fcbe` (`Astra redesign: AppShell, Discovery UI, navigation, plan-safety and lazy-loading`).
- Local branch: `work`, treated as the implementation branch, not the destination `experiment/astra-redesign`.
- Earlier implementation/audit/correction SHAs (`fc09e33`, `523758b`, `1ef890b`, `2ee3dea`, `8af7a69`, `0b19a4c`) are absent because the supplied PR checkout is a recreated/squashed commit. Its parent is still `b986a60` and its diff contains the combined product corrections, tests, audit and handoff described by the PR.
- Initial tree was clean. Diff inspected against `b986a60dc5c115e76af45fd53f8dfd9b7e46d448`. No main/Claude branch was inspected or changed; no merge and no SOL-3 work occurred.

## 2. Browser capability

The correction evidence already records five identical Playwright CDN 403 failures. Per the user's instruction, this re-audit did **not** repeat that installation. A fresh executable inventory found no `chromium`, `chromium-browser`, `google-chrome`, `google-chrome-stable` or `firefox` in PATH, and no browser executable under the standard `/usr`, `/opt` or Playwright cache paths.

The missing capability is exact: **an installed Playwright-compatible Chromium/Chrome/Firefox executable (or an authorized browser runner able to reach this checkout's localhost server), with screenshot, keyboard/focus, viewport/reflow and network-request inspection**. Without it, the seven handoff journeys and required 375/390/430/768/1024/1440/320 viewports cannot be executed or captured. No visual, gesture, focus-loop, image-identity or initial-network PASS is claimed.

## 3. Eight correction groups

### Group 1 — PLAN-01 / VOTE-05 plan-safe unsave — PASS (source and unit scope)

**Evidence.** `plan-safety.ts` parses the stored draft read-only; both removal paths call `canRemoveSavedPlace`; malformed stored state fails closed. `App.tsx` passes the planner a union of saved and authored route IDs, so the planner is not reconciled against a reduced preference set. `plan-safety.test.ts` passes its valid-V7/read-only, planned/unrelated ID and malformed-state cases; correction wiring tests confirm both guards and planner union.

**Expected vs actual.** Expected: ordinary unsave cannot prune an authored plan. Actual source: planned IDs are blocked and routed to a non-destructive alert/Planificar entry; no save mutation occurs.

**Residual verification.** The exact mounted-browser journey with a full accommodation/inter-hub V7 fixture and serialized-byte comparison remains pending because no browser exists. This is not a discovered defect and does not reopen the original source-verifiable P0.

**Correction required:** none from static re-audit. Browser acceptance still required before global approval.

### Group 2 — NAV-03 / FIL-01 / MAP-01 restored filters and map — FAIL (P1)

**Evidence.** `Filtros (n)`, `Lista / Mapa`, FilterPanel vocabulary and lazy PlaceMap are reachable in source. However, `ExploreState` stores only one `category`; grades, planning blocks, hidden-gem statuses, tourism levels and reservation are absent from URL/history. `updateFilters` serializes category only when exactly one is selected. Selecting a second category writes `category=""`; the synchronization effect then resets `filters.categories` to `[]` on the next task. Thus a supported OR-within-category selection destroys itself. Region/unmount/reload also loses every advanced filter.

The newly added advanced-filter surface declares `role="dialog" aria-modal="true"` but has no focus trap, background inerting, Escape close handling or opener focus restoration. This is a concrete accessible-primary-flow regression, not merely missing browser evidence.

**Expected.** All preserved filter dimensions stay usable; stable filter selections are encoded/restored; OR within a group works; modal keyboard ownership matches DA-13.

**Actual.** Single values render/filter, but multi-category selection is actively cleared and advanced dimensions are transient. The modal can expose background controls to keyboard/screen-reader users.

**Exact correction.** Extend the typed exploration state/URL with stable repeated values for categories, grades, planning blocks, hidden/tourism statuses and reservation; validate each value against canonical vocabularies. Make this route state the single source of truth instead of asynchronously rewriting local filters. Preserve OR-within/AND-across. Wrap the advanced-filter sheet in the same tested modal primitive (or equivalent) with inert background, focus trap/restore and top-layer Escape; retain current FilterPanel semantics and do not begin SOL-6 redesign.

**Acceptance test.** Select two categories plus grade D, a duration block and `recommended`; close, open detail, Back, visit regions, Back, reload and Forward. URL and controls retain the same selections and matching IDs. Tab cannot leave the filter dialog; Escape closes only it and restores the Filtros button.

### Group 3 — NAV-02 history/state restoration — FAIL (P1)

**Evidence.** Hub/query/single-category/page/mode are parsed and serialized; detail uses a same-app history marker and direct-link fallback. But there is no scroll restoration store or scroll key anywhere in `navigation.ts`, `Discovery.tsx` or `App.tsx`. Advanced filter axes are absent as described in Group 2. The `history.state.explore` object written on detail entry is never read during pop restoration; restoration depends only on the incomplete hash.

**Expected.** Back/Forward restores complete search/filter/page/hub/mode and keyed scroll; nearby cross-hub history unwinds in order.

**Actual.** Basic hash state and overlay entries improved, but scroll and most filters are lost, so the audited correction is incomplete.

**Exact correction.** Add a stable exploration key derived from every filter axis + hub + mode; save scroll before opening overlays/leaving exploration and restore it after results/page render on pop/hash navigation. Restore the full typed filter state from URL. Read or remove unused `history.state.explore`; there must be one authoritative restoration path. Add pure URL tests and a browser history journey when available.

**Acceptance test.** Load 24 results, scroll to a known card, apply multi-axis filters, open detail, nearby cross-hub detail, Back twice and Forward twice. Each step restores URL, result IDs/count, loaded page and scroll anchor.

### Group 4 — DIS-01 deterministic interleaving — PASS

**Evidence.** `orderDiscoveryPlaces` implements grade buckets, canonical-hub round-robin and stable ID order; explicit hub view uses grade then ID. Tests cover uneven queues, explicit-hub order, deterministic repetition and all 214 unique IDs. Full Vitest passes.

**Correction required:** none.

### Group 5 — CARD-01 / IMG-02 / IMG-04 card image contract — FAIL (P1)

**Evidence.** Loading/error/missing states keep the 4:3 frame; retry increments a key and requests the same image URL; attribution no longer precedes recommendation/title. But the error-state `<button>Reintentar</button>` is rendered inside `.astra-card__image-link`, an `<a>`. This is invalid nested interactive content and violates the separate-target contract. Keyboard/assistive activation can be ambiguous despite `preventDefault`/`stopPropagation` handlers.

**Expected.** Detail link and every button are siblings; no interactive descendant inside another interactive target.

**Actual.** Retry is a button nested inside the image detail anchor.

**Exact correction.** Make the 4:3 frame a non-interactive wrapper. Render the image/detail anchor only around the image or normal pending visual; in error state render a sibling 48px retry button inside the frame but outside any anchor. Keep title as a separate same-href detail link and save as a sibling button. Add a DOM-oriented test (not only source substring) asserting no `a button` descendant for loading/error/success fixtures.

**Acceptance test.** Forced error: Tab reaches Retry as its own control; Enter retries without opening detail; next Tab reaches title/detail and later save. DOM query `article a button` returns zero.

### Group 6 — A11Y-02 / DET-01 detail modal — PARTIAL

**Evidence.** Static implementation supplies dialog semantics, inert shell/content, initial focus, Tab loop, lightbox-aware Escape suppression and opener restoration. Source integration tests pass. No contradictory source defect was found for the detail wrapper.

**Pending.** Actual keyboard loop, nested lightbox Escape ordering, focus restoration, mobile nav hiding and screen-reader modal isolation require a browser. The advanced-filter modal defect is separately recorded in Group 2.

**Correction required:** none for `RouteDialog` from static inspection; browser acceptance remains mandatory.

### Group 7 — PERF-01 lazy boundaries — PARTIAL

**Evidence.** Source uses dynamic imports for PlaceMap, NationalExplorer and OrderedSequenceBuilder. Build produces separate `PlaceMap` (3.65 kB), `NationalExplorer` (10.22 kB), `OrderedSequenceBuilder` (127.40 kB) and `MapContainer` (152.65 kB) chunks. Initial JS remains 1,136.85 kB (186.05 kB gzip) and triggers the >500 kB advisory.

**Pending.** A build graph strongly supports splitting, but the required clean-load network proof—no map/planner chunk and no tile/provider request on initial `#/explorar`—cannot be observed without a browser/network inspector.

**Correction required:** no new P1 from static inspection. Retain the existing bundle advisory as P2 measurement debt; prove requests during browser re-audit.

### Group 8 — DIS-01 / A11Y-03 search and pagination announcements — FAIL (P2)

**Evidence.** Discovery has a 200ms delayed live message, conditional clear and appended-range message with button refocus. However, when the advanced panel is open, the reused `FilterPanel` also renders an immediate `<p role="status">` result count. That creates a second, non-debounced live output for the same changing result set, contrary to the single-announcement contract. Browser speech output remains unverified.

**Expected.** One debounced result announcement, no duplicate live output, one appended-range announcement, stable focus.

**Actual.** The outer debounced live region coexists with FilterPanel's immediate result status.

**Exact correction.** Give FilterPanel an option to render its count visually without `role=status` when Discovery owns the live region (default may preserve legacy behavior). Ensure one live owner per mounted surface. Add a source/DOM test that exactly one result-count live region exists with the Astra filter dialog open.

**Acceptance test.** Type three characters rapidly with filters open: screen-reader/event observer records exactly one count announcement after 200ms. Loading more announces the appended range once and leaves focus on `Ver 12 más`.

## 4. Severity summary

- **P0:** none newly found. Original PLAN-01/VOTE-05 source path is corrected; full browser fixture remains pending.
- **P1:** advanced filter state/multi-category reset and filter-dialog keyboard ownership; incomplete scroll/filter history restoration; nested retry button inside detail anchor.
- **P2:** duplicate immediate/debounced result live regions; initial bundle remains >500 kB and needs measured follow-up.
- **Visual/global approval:** blocked and therefore not granted.

## 5. Checks executed at audited HEAD

- `npm test -- --run`: PASS — 70 files, 2463 tests.
- `npm run lint`: PASS — no diagnostics.
- `npm run build`: PASS — lazy chunks emitted; initial >500 kB advisory remains.
- `python scripts/validate-dataset.py`: PASS — 214 places, 403 relations, 0 broken; 13 known secondary warnings.
- `python scripts/validate-photography.py`: PASS.
- `python scripts/validate-geography.py`: PASS — 47 prefectures, 9 regions, 214 places, 7 hubs.
- `python scripts/validate-logistics.py`: PASS.
- `python scripts/validate-reservation-mechanisms.py`: PASS.
- `git diff --check b986a60..HEAD`: PASS.
- Browser executable inventory: BLOCKED — none installed. Installation was intentionally not retried because the same environment restriction is already evidenced.

## 6. Required next action

Return only the bounded P1/P2 corrections above to SOL IMPLEMENTER, then re-run this audit. Do not begin SOL-3. Final SOL-0–SOL-2 approval still requires the seven browser journeys and all mandated viewports on a runner with an installed authorized browser executable and localhost/network inspection.
