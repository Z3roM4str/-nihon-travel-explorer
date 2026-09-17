# TRACK: ASTRA — Audit framework

MODEL ROLE: ASTRA DIRECTOR

Use after every Sol handoff. Inspect actual HEAD/diff and rendered product, not only worker prose. Do not implement broad fixes yourself; issue precise corrections for Sol. Authority: DESIGN_AUTHORITY.md (DA). Base: `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81`.

## Verdict rules

- **PASS**: observed behavior meets criterion with reproducible evidence at stated viewport/state.
- **PARTIAL**: incomplete implementation or incomplete evidence (including unavailable browser). Never imply PASS.
- **FAIL**: observed contradiction. Record expected, actual and exact correction.
- Scope is a separate field `applicable / deferred block`; deferred items still have PARTIAL with explicit reason, never counted as passes.

Per item record: ID, block/HEAD, viewport, state/input, PASS/PARTIAL/FAIL, evidence (screenshot path + DOM/test/log as relevant), expected, actual, impact, correction, acceptance rerun. Screenshots must record viewport, route, chosen profile and fixture seed. Personal test preferences are fixtures, not assertions about Fernando or Ella.

Severity: P0 data loss/fabricated evidence/access violation/critical unusability; P1 wrong navigation, key visual hierarchy or interaction, inaccessible primary flow, omitted real feature; P2 minor spacing/wording/polish. No averaging hides a P0/P1. A partially verified release cannot be approved by counting historical passing tests.

## Audit matrix

| ID | Criterion and pass evidence | DA | Default severity |
|---|---|---|---|
| PRE-01 | Correct repo, base ancestry, branch, actual HEAD, clean/reviewed tree; no main/Claude merge | 00 | P0 |
| PRE-02 | Diff limited to intended blocks; canonical bytes and IDs preserved or separately authorized | 00 | P0 |
| NAV-01 | Two destinations, default Explorar, visible person; 390/768/1440 screenshots | 02–03 | P1 |
| NAV-02 | Browser back/forward, direct place link, nearby cross-hub return, original scroll/filters restore | 02 | P1 |
| NAV-03 | All hubs and region/prefecture coverage reachable, including unresearched state | 02 | P1 |
| VIS-01 | Tokens/weights/type sizes match; no external font dependence or mixed emoji control set | 04 | P1 |
| VIS-02 | Spacing/radius/1–2–3 columns/intro height; no invented giant hero | 03–06 | P1 |
| VIS-03 | 375, 390, 430, 768, 1024, 1440 plus 320px reflow and 200% text; no CTA overflow | 03,13 | P1 |
| DIS-01 | Search visible, all canonical fields/diacritics; deterministic sorting and pagination | 05 | P1 |
| DIS-02 | No grade/rare category/photoless record excluded; 214 reachable | 05,07 | P0 |
| CARD-01 | Exact photo/badge/title/location/description/facts/status/CTA order | 06 | P1 |
| CARD-02 | Detail link and 48px heart separate, not nested; action without opening detail | 06 | P1 |
| CARD-03 | Long names and enlarged text readable; no technical raw ID or arbitrary generated copy | 06 | P1 |
| REC-01 | All five editorial labels plus unknown; D not equated automatically with extreme tourism | 07 | P1 |
| DET-01 | Mobile full dialog/tablet dialog/desktop two columns; sticky CTA never hides content | 03,08 | P1 |
| DET-02 | Every existing practical field/source/warning/action remains reachable; caveat visible early | 08 | P0 |
| DET-03 | Duration range/day scale, reservation interpreter, confidence unchanged | 08 | P0 |
| IMG-01 | Correct-place local image; 4:3 frame; no generated/borrowed substitute | 08 | P0 |
| IMG-02 | Credit/source/license/title/processing reachable card/detail/fullscreen | 08 | P0 |
| IMG-03 | Zero/one/multiple photos: no fake controls or filler; swipe respects vertical scroll | 08 | P1 |
| IMG-04 | Fixed-size loading/error/retry, no layout shift; only active/neighbors loaded | 08 | P1 |
| IMG-05 | Fail-closed list and new asset traceability remain intact | 00,08 | P0 |
| VOTE-01 | Nine person combinations match table; no≠unreviewed, toggle-off only own vote | 09 | P0 |
| VOTE-02 | First save identity/cancel; active reviewer obvious; no claimed backend in local mode | 09 | P1 |
| VOTE-03 | Discard keeps votes, restore candidate, vote-on-discarded explicit reconsider | 09 | P1 |
| VOTE-04 | Legacy saves unassigned, idempotent claim, no overwriting old keys; failures visible | 09 | P0 |
| VOTE-05 | Authored route survives unliking/switching/filtering/discarding; plan removal explicit | 09 | P0 |
| TRIP-01 | Bucket semantics/count overlaps exact; group IDs unique, agreement clear with text | 10 | P1 |
| TRIP-02 | Empty/no-agreement/pending/no/discard states and useful exits | 10 | P1 |
| TRIP-03 | Priority/shortlist/bulk undo; never sets partner vote or automatic itinerary | 10 | P0 |
| PLAN-01 | All prior planner operations reachable; V1–V7 persistence and stable days roundtrip | 09–10 | P0 |
| PLAN-02 | Unordered time excludes transport; daily/whole-trip incomplete evidence stays explicit | 10 | P0 |
| MAP-01 | Same filtered IDs map/list; full results beyond current page; selected out-of-filter state | 11 | P1 |
| MAP-02 | Correct responsive panels, cluster/overlap selection, no auto-pan on interest | 11 | P1 |
| MAP-03 | No presumed GPS/hotel; tiles error leaves usable list; attributions unobscured | 11 | P1 |
| FIL-01 | Quick controls minimal; full vocabulary preserved; OR within/AND across; duration overlap | 11 | P1 |
| FIL-02 | Draft/apply/cancel/clear/zero-count behavior exact; typed confidence not invented month filter | 11 | P1 |
| STAY-01 | No fictional area facts/property/default hotel; real unknown state | 12 | P0 |
| STAY-02 | Compare max 3, criteria provenance/date/unknowns; mobile table usable | 12 | P1 |
| STAY-03 | Zone not an accommodation anchor; no invented transit minutes or safety guarantee | 12 | P0 |
| A11Y-01 | Contrast measurements 4.5:1 text/3:1 controls; non-color state cues | 04,13 | P1 |
| A11Y-02 | Keyboard journey, visible focus, dialog trap/restore/inert; Escape top layer only | 08,13 | P1 |
| A11Y-03 | Meaningful names/aria-pressed/current/status, headings, skip link, no duplicate live output | 13 | P1 |
| A11Y-04 | Targets, safe area, screen keyboard, reduced-motion no slide/scale/smooth scrolling | 03,13 | P1 |
| ERR-01 | Dataset/map/photo/storage failure separately recoverable, no false success | 08,13 | P1 |
| PERF-01 | Map/planner lazy; no initial tile request; image bounds; no acquisition/provider calls | 11,13 | P1 |
| PERF-02 | Same-method bundle delta and measured interaction evidence; no fabricated device score | 13 | P2 |
| SYNC-01 | Two authenticated devices, own-vote authorization, cross-trip denial | 13 / SOL-8 | P0 |
| SYNC-02 | Pending/offline/conflict/revocation/import correctly visible; no silent overwrite | 13 / SOL-8 | P0 |
| QA-01 | Tests/build/lint and relevant validators run at reported HEAD; no weakened assertions | 14 | P0 |
| QA-02 | Screenshots inspected against authority/reference; every deviation has disposition | 14 | P1 |

## Golden journeys

1. Clean first visit → see actual place → open/close detail → one interest action with first-profile choice → reload → saved choice remains → Nuestro viaje. Repeat second save: one tap, no identity question.
2. Fernando yes / Ella unreviewed → “Falta Ella”; switch reviewer → yes → “Ambos quieren ir”; toggle off → partner yes remains; explicitly no → “Gustos diferentes”. Neither action builds a route.
3. Seed a genuine prior V7 plan with accommodation and inter-hub legs via existing UI/test fixture → load redesigned app → do not claim legacy saves → browse and change own votes → plan unchanged. Explicit route removal must preview impact and be undoable as designed.
4. Search accentless place → category + duration overlap → apply → map → select → nearby cross-hub → Back twice → same filtered list/scroll. Empty filters recover without clearing user interests.
5. Missing image → useful card/details; one photo → no carousel controls; three distinct test images → arrow/swipe/keyboard/fullscreen → credits → Escape topmost only; failed image → retry.
6. Nuestro viaje → no agreement state → review → shortlist → explicit planner → reorder day, dates, reservation calendar, lodging boundary and inter-hub segment → reload. Preserve original domain assertions.
7. Dónde alojarnos with no research/no hotel → honest empty state; sourced areas when available → compare 3 → fourth rejected non-destructively; no origin/route generated from a zone.
8. Keyboard-only and screen-reader spot check of journeys 1/2/5; reduced motion; 320px reflow. Actual manual screen reader unavailable means PARTIAL, not automatic PASS from aria attributes alone.

## Correction contract

```text
TRACK: ASTRA
MODEL ROLE: ASTRA DIRECTOR
ASTRA AUDIT — [block] — [HEAD]
Verdict: PASS / PARTIAL / FAIL
P0 — [id] [screen/component]
Evidence: [reproduction, screenshot/test, viewport and state]
Expected: [DA rule and concrete behavior]
Actual: [observed behavior]
Reason: [user impact]
Exact correction: [bounded change for Sol; no vague “improve”]
Acceptance test: [steps/result]
P1 — ...
P2 — ...
Unaudited surfaces: ...
Next worker scope: ...
```

After corrections inspect new diff, reproduce failing journey and targeted regression neighbors. Do not rerun unrelated acquisition or invent hundreds of redundant tests. Final fidelity approval requires all applicable items PASS, no P0/P1 outstanding, explicitly stated deferred backend/research scope, and a clean committed tree. Do not merge.
