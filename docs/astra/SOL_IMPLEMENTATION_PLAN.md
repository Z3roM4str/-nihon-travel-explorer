# TRACK: ASTRA — Sol implementation plan

MODEL ROLE: ASTRA DIRECTOR

Repository `Z3roM4str/-nihon-travel-explorer`; base `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81`; branch `experiment/astra-redesign`.
Sol executes the design; does not redesign it. Read DESIGN_AUTHORITY.md (DA) in full, PRODUCT_AUDIT.md and ASTRA_AUDIT_CHECKLIST.md before editing. Historical phase-specific prohibitions are history, not instructions to abandon this authorized redesign; factual/persistence/license safeguards still apply.

## Execution boundary

**First Sol session: SOL-0, SOL-1 and SOL-2 only.** Finish a coherent vertical slice, commit it, and return to Astra. SOL-3 onwards are specified, not an instruction to spend this entire session completing all features. If SOL-0 visual recovery exposes a real contradiction, record evidence and request Astra correction, not a new user design preference. A missing optional external design tool is not a reason to replace the design.

Continue in the Astra branch from the handed-off HEAD; verify it is a descendant of the fixed base. Do not recreate the branch from newer main or merge other work. If remote Astra advanced, inspect only its actual commits and resolve context before changing files. No force push, main edits, merge or deployment. Do not read Claude branches for inspiration.

## Preservation matrix (required engineering ownership)

| Existing capability/source | New entry / adapter | Proof of preservation |
|---|---|---|
| `App.tsx`, `data/store.ts`, `lib/place.ts` | Explorar, global/hub search, same data store | 214 IDs reachable, all 7 hubs, accent/Japanese search |
| `NationalExplorer`, `RegionNavigator`, `PrefecturePanel`, `NationalMap`, `data/geography.ts` | Hub picker → Explorar por región | Uncovered prefecture state; geometry and attribution |
| `FilterPanel`, `lib/planning-block.ts`, `lib/reservation.ts` | Quick / advanced filters | All current values; overlap vs day-scale distinction |
| `PlaceDetail`, `lib/feb-mar-status.ts`, `recorded-hours.ts`, `temporal-availability.ts` | New detail disclosures | Raw warning/action/source fields; no invented availability |
| `PlaceGallery`, `data/place-images.ts`, `lib/photography-attribution.ts` | Card/gallery/fullscreen | Correct image/credit/license/title/processing per asset |
| `useSavedPlaces.ts`, `SelectionPanel` | Legacy pending queue and new own-vote control | No attribution to partner; no loss or overwrite |
| `SelectionAnalysis`, `lib/selection.ts` | Ver distribución y tiempos | Quantified visits separate from day-scale commitments |
| `OrderedSequenceBuilder`, `usePlanningDraft`, `planning-draft-v7` | Nuestro viaje → Planificar | V1–V7 migrations, route comparison, day identity and all manual edits |
| Transfer/access/walking domain libraries | Nearby details, planner transport sections | Directed edges, evidence completeness, missing stays missing |
| Accommodation/inter-hub/trip-bounds/whole-trip modules | Existing planner sections | Real anchors only, explicit bounds, partial totals honest |
| Reservation-mechanism/official-calendar modules | Planner Reservas y horarios | Original identities, date evidence, calendar deduplication |
| Canonical workbook/exported root + app data, scripts validators | Unchanged | Byte equality vs base until a later explicitly data-scoped block |

Paths below are likely edit candidates, not permission to rewrite every file listed. New UI primitives may live in `app/src/astra/` and be integrated gradually. Reuse domain code rather than copying it.

## SOL-0 — Verify and render the authority

- Objective: reproduce baseline and obtain missing rendered evidence before accepting implementation fidelity.
- Files: `docs/astra/reference/*`, new `docs/astra/evidence/` and `SOL_HANDOFF.md`; no product edits needed.
- Behavior: serve repo root for reference (README command); render baseline product and reference at 390, 768/1024 and 1440 widths. Capture initial discovery, missing image and detail. Test own heart focus/state. Record actual viewport and environment. Reference does not implement full couple/map/planner flow.
- Preserve: all tracked application and canonical files; local saved state outside the reference namespace.
- Tests: npm ci/build/test baseline if not already run at identical tree/environment; validate dataset/photography; screenshots and keyboard/overflow checks. Do not call a historical gate a current pass.
- Visual acceptance: DA-03–08 proportions; no page overflow, clipped CTA, giant introductory hero or credit omission. Where reference is incomplete, specification wins.
- Stop conditions: repo/base mismatch, pre-existing dirty tree of unknown owner, required data missing. Browser unavailability must be documented and carried as a fidelity blocker; source-only implementation may proceed but no visual PASS/release claim.
- Dependencies: none. Output is evidence, not a redesign.

## SOL-1 — Shell and safe navigation foundation

- Objective: introduce the two-destination shell, URL state and explicit responsive geometry.
- Files: `app/src/App.tsx`, `App.css`, new `astra/tokens.css`, `astra/AppShell.tsx`, `astra/navigation.ts`; `NationalExplorer` integration.
- Required: default Explorar; two-tab mobile footer/header nav on tablet/desktop; native fonts and exact tokens; deep-link detail routing contract; region navigation reachable; placeholder Nuestro viaje may embed the real current selection module until SOL-4, not fake agreement. Separate lazy map/planner boundaries without changing modules' semantics.
- Preserved: all current entry points and initial legacy saved state; nearby trail and all hubs. No change to planner storage.
- Tests: focused route parsing/unknown-value fallback/back behavior tests; existing Vitest; build/lint. Browser switch tab/back/resize/region entry; keyboard shell navigation.
- Visual acceptance: DA-03 viewport table and DA-04 tokens, safe area, nav labels visible, active target obvious.
- Stop: loss of any route/function, inappropriate control under footer, new reliance on unavailable backend.
- Dependencies: SOL-0 evidence assessment.

## SOL-2 — Discovery and real place cards

- Objective: functional all-Japan/hub photo discovery with obvious saving.
- Files: `PlaceList.tsx`, `FilterPanel.tsx`, new `astra/PlaceCard.tsx`, `astra/Discovery.tsx`, `astra/recommendation.ts`, existing store/search/image adapters.
- Required: DA-05 deterministic sorting/pagination and visible search; DA-06 card order; all five translated grades; canonical photo/credit/missing/error states. During this first slice, heart uses existing single-list saved adapter **labelled “Mis guardados”**, not invented Fernando/Ella votes. Wire this temporary adapter explicitly so SOL-4 replaces its ownership; do not ship partner counts yet. Withdrawing an existing saved ID that is in an authored route must require an impact confirmation or be routed to Planificar; never silently prune. Non-plan saves use current persistence.
- Preserved: canonical catalogue, exact categories, current duration/reservation interpreters; current detail may remain openable until SOL-3. Keep every photograph discoverable independent of rank. No data edits for titles/copy.
- Tests: S/A/B/C/D/unknown display; card link vs heart separate actions; search scope; no grade/photo omission; real duration examples; image error fixed size; save after reload; legacy route survives card actions. Existing tests build/lint.
- Visual acceptance: 1/2/3 card columns at breakpoints, 4:3 images, one-tap save from card, no clipped names/metadata, same credit accessible as detail. Reference subset fidelity.
- Stop: cannot prevent route pruning, need new fact to populate UI, required grade/filter hidden, rendering fails.
- Dependencies: SOL-1. **Return to Astra after this block** with known transitional features labelled. Do not call whole product complete.

## SOL-3 — Detail and gallery

- Objective: progressive detail with persistent interest control and accessible media.
- Files: `PlaceDetail.tsx`, `PlaceGallery.tsx`, new disclosure/dialog primitives; `photography-attribution.ts` only if presentation extension needed.
- Required: DA-08 all sections/raw facts, mobile full-height modal / desktop two-column dialog, sticky CTA; one-image controls absent; multi-image test fixture is clearly test-only, never duplicate live image to simulate carousel. Correct swipe-axis discrimination; accessible fullscreen credits.
- Preserved: nearby cross-hub history, confidence footnotes, official links, every practical field and attribution; no changes to parser semantics.
- Tests: modal focus/inert/restore/topmost Escape; 0/1/3 images with separately identified licensed/test-only fixtures; long attribution; failure/retry; vertical gesture doesn't advance; reduced motion. Regression tests/build/lint.
- Visual acceptance: DA-03/08; long content never under footer; retain photo aspect ratio and contain fullscreen.
- Stop: source/credit loss; modal focus leak; merged temporal axes imply availability.
- Dependencies: SOL-2.

## SOL-4 — Votes, review queue and legacy bridge

- Objective: explicit local two-person interest model without damaging existing saves/plans.
- Files: new `astra/review.ts`, `useReview.ts`, `review-migration.ts`, person selector, interest action; compatibility adapter around `useSavedPlaces`/planner eligibility. Keep V7 domain schema intact.
- Required: DA-09 nine-state truth table plus disposition/priority; first-vote identity choice, no auto-partner assignment; idempotent legacy claim; atomic persistence where possible; storage failure visible. No server sync claim. Additive planner eligibility and explicit removal review.
- Preserved: legacy keys untouched on discovery/migration load; all V7 data survives profile change, no vote, no/unreviewed transitions and undo. No overwritten foreign/newer schema.
- Tests: full truth table, independent person mutations, discard/restore, pending vs no, first-save cancel, undo, malformed/newer state, storage failure, idempotent legacy claim, tab-reload persistence; legacy V1–V7 fixtures and authored plan survival. These tests are necessary for actual loss risk.
- Visual acceptance: person label always clear; both-heart text visible without tooltip; no ambiguous green marker claiming agreement.
- Stop: cannot preserve plan/legacy ownership; migration destructive; requires auth/service not provisioned.
- Dependencies: SOL-3 and Astra review of first slice.

## SOL-5 — Nuestro viaje and deliberate planning bridge

- Objective: compare, review, shortlist and prioritize before constructing a route.
- Files: new `astra/OurTrip.tsx`, review queue, batch controls; `SelectionAnalysis`, `SelectionPanel`, `OrderedSequenceBuilder` entry integration.
- Required: DA-10 buckets/count semantics and empty states; stable review queue; explicit shortlist; batch actions with count/undo, never bulk partner voting. Plan entry retains current full planner, route/days/transfer/reservation/accommodation functions; reorganize presentation in a follow-up subcommit only when coverage is proven.
- Preserved: no automatic plan creation; stable day IDs, dates, directions, evidence quality; local-only truth.
- Tests: membership/count overlaps, no duplicate grouped IDs, own/partner/discard filters, no-results, bulk undo, prior plan roundtrip, new shortlist eligibility. Run all existing golden journey semantics even if selectors need updating for legitimate changed UI; don't weaken assertions.
- Visual acceptance: agreement first, no itinerary calendar on default interests view; 1/2/3 columns, mobile empty states lead to useful actions.
- Stop: any prior planner operation unreachable; phase turns into full domain rewrite.
- Dependencies: SOL-4.

## SOL-6 — Map and advanced filters

- Objective: equivalent list/map discovery with powerful but optional controls.
- Files: `PlaceMap`, `NationalMap`, `FilterPanel`, navigation/filter adapter, lazy load boundary.
- Required: DA-11 cluster/selected/liked states, explicit viewport filtering, source attribution, full filter vocabulary, draft/apply/cancel; visible count is all matches including unrendered cards. Search and selection restored between modes.
- Preserved: existing geography, directed nearby facts, all categories/grades, duration overlap; selected out-of-filter place remains explainable.
- Tests: OR/AND algebra and unknown field behavior; all reservation filter values; map/list ID parity; marker selection, cluster overlap, filter draft cancellation, reset; tile failure list fallback. Test no map requests on initial list load.
- Visual acceptance: desktop two columns only; mobile preview <=35dvh; no hidden map attribution; no multi-colored code requiring a legend to save.
- Stop: tile failure blocks exploration; selected place lost; performance regression without explanation.
- Dependencies: SOL-5 (couple filters real).

## SOL-7 — Photography expansion (separate worker batches)

- Objective: progress toward one valid image for every place, then useful S/A galleries.
- Files: `scripts/acquire-photography.py`, existing selectors/validators; append-only `data/visual/photography-metadata.json` and app mirror; `app/public/images/places/`; batch evidence report.
- Required: first inventory current coverage; define bounded tranche <=12 places, no 214-place acquisition in one turn. Preserve existing bytes/metadata. Source identity/licensing/processing/alt/traceability; no runtime providers. Distinct views, no filler. Extend exact-count historical tests only when their historical meaning remains tested, never simply drop assertions.
- Preserved: all sixteen fail-closed IDs: JP-033, JP-126, JP-203, JP-204, JP-050, JP-195, JP-121, JP-156, JP-095, JP-079, JP-202, JP-120, JP-211, JP-041, JP-168, JP-140. Re-entry requires a separately evidenced new source/rights review; do not rerun failed searches and declare them new evidence.
- Tests: photography validator; source/app byte parity; no duplicates/broken refs; manual image-to-place review and license review; gallery with real multi-image assets; payload measurement.
- Visual acceptance: images explain experience, correct season/context, no mismatched “Japan” fallback.
- Stop: provenance or licensing unclear, re-entry not justified, provider unavailable; leave honest pending image and batch report.
- Dependencies: SOL-3 and SOL-6 fidelity approved. Independent research worker can execute later; no backend dependency.

## SOL-8 — Shared backend (future provisioning gate)

- Objective: same truthful two-person model across devices; not just two local tabs.
- Files: new backend adapter/schema and auth integration only after service choice/access exists; existing review store remains provider-independent.
- Required: shared trip ID, authenticated participant membership, own-vote-only authorization, server-controlled membership, operation IDs/revisions, retries/offline outbox and conflict UI per DA-13; local import preview with explicit user action, never auto-upload unrelated saved data. Revocation stops further writes. No public anonymous write token embedded in client. Do not invite/send messages automatically.
- Preserved: local mode and unsynced choices, separate editorial dataset, current plan ownership. Data export and disconnect behavior specified before activation.
- Tests: two distinct authenticated clients, cross-trip read/write denied, own-vote restrictions enforced server-side, stale conflicts, duplicate requests, offline reconnect, revocation, partial import; test service adapter failure.
- Visual acceptance: Local / Guardando / Guardado / Sin conexión / Conflicto text truthful. “Ambos” only from actual two votes.
- Stop: credentials/provider/payment needed; service not provisioned. Deliver schema/API/error-state contract and blocker, not pretend sync. Do not stop unrelated local blocks.
- Dependencies: SOL-4/5 stable. No specific vendor selected by Astra.

## SOL-9 — Area comparison and accommodation research

- Objective: DA-12 zones-before-properties flow without fabricated facts.
- Files: new area schema/evidence dataset/adapter and area UI; existing `accommodation-commute` and V7 anchor integration only after explicit real accommodation choice.
- Required: Tokio/Osaka/Kioto entries, unknown/research-pending state, comparison max 3, sourced criterion/date/confidence; reviewed relationship to selected places; no centroid as lodging anchor. Research is a separate bounded task using current sources, not LLM-generated facts in JSX.
- Preserved: all actual legacy user anchors, boundary and leg evidence; no default hotel, no generated transport duration, no guaranteed area safety/cleanliness.
- Tests: missing criterion, different evidence dates, compare limit/remove, changes in selected places, no-date/property state, explicit anchor creation only with real user choice.
- Visual acceptance: table readable at mobile, unknown is visible, source link per criterion, criteria match authority.
- Stop: live price/recommendation without sources, no dates for property query, missing routing evidence; render unknown rather than invent.
- Dependencies: SOL-5; shared mode optional, not required.

## SOL-10 — Full implementation QA and handoff

- Objective: verify end-to-end fidelity and preserve researched functionality.
- Files: focused browser tests/audit evidence; production corrections only tied to findings.
- Required: full audit matrix PASS/PARTIAL/FAIL; screenshot states/viewports, screen-reader/keyboard checks, performance trace, data parity, build delta, legacy state recovery. Astra audits independently after this.
- Tests: npm test/lint/build; Python suite using repository's documented invocation; seven passive validators; browser golden journeys from `app/scripts/phase5a-rc-browser-audit.mjs` adapted without weakening domain assertions; review/couple/gallery new journeys; don't run walking acquisition harnesses as passive validation. No mass warning cleanup.
- Visual acceptance: all applicable DA rules; zero P0/P1. P2 must have evidence and disposition; no checkbox-only “looks good”.
- Stop: partial visual coverage or data regression; report precisely, no merge/release.
- Dependencies: all local scope blocks intended for the current delivery. SOL-8/9 unfinished features explicitly remain deferred, not falsely tested.

## Required commit and checkpoint rhythm

One coherent block per commit, meaningful message `astra(sol-N): ...`. Record baseline, current HEAD, files, behavior tested and known limitations in `docs/astra/SOL_HANDOFF.md`. Commit before handing off; push the Astra branch if available, never force. Do not ask the user to approve routine reversible engineering choices.

After each block, evaluate remaining context. If next block cannot fit: do not start. Finish current coherent work, run relevant checks, commit, and write continuation prompt with exact SHAs, branch, tests, dirty files, blockers and next objective. Never leave unexplained broken code at a voluntary stop. Astra returns P0/P1/P2 findings with exact corrections; Sol corrects, does not replace the visual language.
