# Block 14 — post-redesign release readiness / whole-product audit

**Audited SHA:** `894fdc66145c91acfdee74d780488bc4b1982cfc` (Block 13 closed)
**Branch:** `claude/sleepy-heisenberg-hn7340` — 38 ahead of `origin/main` (`1a11fe8`), 0 behind, merge-base **is** `origin/main`.

This block adds no features. It answers one question: after Blocks 1–13, is Nihon really usable and
publishable as a product on a phone, a tablet and a desktop?

---

## 1. Functional inventory, derived from the code

| area | what exists today | where |
|---|---|---|
| **Discovery** | national map (MLIT geometry) → region → prefecture → hub → list/map → detail; free-text search; filter chips; nearby jumps | `NationalExplorer`, `NationalMap`, `PlaceMap`, `PlaceList`, `PlaceDetail`, `FilterPanel` |
| **Photography** | **157 of 214** places carry a licensed photograph, **163** images (six galleries); every other place falls back to its editorial `imageBrief` | `data/visual/photography-metadata.json`, `place-images.ts` |
| **Two travellers** | two identities, per-person stance per place, derived shared shortlist, coincidence/divergence reporting, roster management | `lib/travellers.ts`, `useTravellers`, `TravellerBar`, `TravellerManager` |
| **Planning** | manual route, day assignment with stable day ids, calendar anchoring + trip bounds, manual visit times, intra/inter-day moves, manual inter-hub segments, whole-trip composition | `lib/planning-draft-v8.ts` (+ V1–V7 chain), `OrderedSequenceBuilder` |
| **Operational evidence** | recorded hours and closures, visit-time fit against recorded intervals, reservation mechanisms, trip-derived reservation dates, route-wide reservation calendar | `reservation-mechanism-*.ts`, `recorded-interval-fit.ts` |
| **Provenance & freshness** | per-source `covers`/claim class, authority tier, `consultedAt`, derived freshness with four states | `lib/source-freshness.ts`, `lib/provenance-claim-class.ts` |
| **Accommodation** | 16 zones across Tokio (6), Kioto (5), Osaka (5); comparison of fact / editorial / derived, distance to saved places, zone-seeded anchors | `lib/accommodation-zone.ts`, `ZoneComparison`, `useZoneComparison` |
| **Logistics** | `estimated` vs `validated-static` transfers from 403 `nearby` relations; honest absence where no evidence exists | `lib/transfer.ts` |
| **Portability** | export/import a versioned JSON backup; preview; replace-never-merge; best-effort rollback; forced reload | `lib/portable-backup.ts`, `usePortableBackup`, `TripBackup` |
| **Persistence** | 5 keys: `travellers.v1`, `manualPlanningDraft` (durable) · `zoneComparison.v1`, `onboarding.seen.v1` (local UI) · `savedPlaceIds` (**legacy, read-only**) | — |

---

## 2. The journey that was run

One continuous story per viewport, on the production build, in `block14-release-readiness-browser-audit.mjs`:

open cold → dismiss the explainer → national map → Tokio → list ⇄ map → search (including a
zero-result query) → filter → place detail → photograph or fallback → **traveller A** marks Tokio →
**traveller B** marks Kioto → **A** marks Osaka → switch traveller → open the planner → three days,
`2027-03-14 … 2027-03-20`, a manual `09:30`, a shinkansen inter-hub segment → Osaka zones, two
compared → reload → export → change the trip → import → preview → confirm → **reload → interact** →
reload again → reopen both lazy surfaces → adversarial storage (missing key, corrupt key, legacy
key, future-version backup) → accessibility → network.

**Result: 226 checks passed, 0 failed** — 76 phone (390×844 DPR 2), 75 tablet (820×1180 DPR 2), 75
desktop (1440×900).

### The integration failures it was built to catch

Each of these crosses a boundary no single-block audit can see:

| risk | how it is exercised |
|---|---|
| **The restore trap** | restore → forced reload → **then interact** → assert the replaced trip did not come back |
| **Multi-hub contamination** | three hubs in one trip; zone selection asserted to be per-hub, filters cleared between hubs, shortlist asserted to be the union |
| **Traveller ↔ planner** | switch active traveller, *then* open the planner; assert it works from the **shared** shortlist, not the active person's |
| **Lazy surfaces after churn** | reopen planner and zone comparison **after** a restore-triggered reload |
| **Legacy migration** | write only `nihon.savedPlaceIds`, reload, assert it migrates as `carriedOver` and is attributed to nobody |

---

## 3. Findings

| # | severity | finding | action |
|---|---|---|---|
| F-1 | **MINOR (fixed)** | The backup's object URL was revoked **synchronously** in the same task as the anchor click. No Chromium-only API is involved and Chromium tolerates it, but Safari has historically cancelled a download whose object URL disappears in the same task — a fragile dependency on one engine's timing, in the one feature whose whole point is moving a trip to another device. | **Fixed:** revoke deferred to a macrotask. Regression test added; proven to fail against the previous code. |
| F-2 | **MINOR (fixed)** | `app/README.md` stated the photography registry holds **"144 of 214"** places. It holds **157 of 214 / 163 images**. Stale since the Phase 4 batches. | **Fixed.** |
| F-3 | **MINOR (fixed)** | `docs/DATA_MODEL.md` stated `nihon.savedPlaceIds` "**remain[s]** the 'Quiero ir' selection's only persisted state". False since Block 5: the shortlist is derived from `nihon.travellers.v1`, and the legacy key is read-only migration input. | **Fixed:** the section now describes the derived shortlist, names the legacy key as legacy, and points at Block 13's storage inventory. |
| F-4 | **MINOR (fixed)** | Both READMEs described the product as a single-user "saved places" app: no mention of the two-traveller model (Block 5) or the portable backup (Block 13), and the root documentation index stopped at Block 3. | **Fixed:** current-status bullets and the index now cover Blocks 4–14. |
| F-5 | **OBSERVATION** | On a phone, an **expanded saved-places sheet intercepts pointer events** over the national start screen's hub cards (`.selection-panel__summary` is the interceptor). A person collapses the sheet with one tap and continues; nothing is lost or corrupted. | **Not fixed** — a layout change is outside this block's remit (§2/§18), and the sheet is where the user put it. Recorded, and the audit collapses the sheet the way a person would. |
| F-6 | **OBSERVATION** | The map's MLIT attribution link renders ~12 px tall on a phone. It is legal fine print rather than a product control, and Block 1 — the authority on tap targets — is green at 142. | **Not fixed.** Recorded. Block 14's coarse tap-target net was narrowed to buttons and inputs so it cannot mask a real control later. |
| F-7 | **OBSERVATION** | `dist/` uses **absolute** asset paths (`/assets/...`), because Vite's `base` is the default `/`. It deploys at a domain root unchanged; a **subpath** deployment (e.g. a project-site path) needs `base` set at build time. | **Not fixed** — no provider is chosen in this block. Recorded with the exact remedy. |
| F-8 | **DEBT (open, unchanged)** | The 160 editorial ratings still have no second human reader. | **Not closed, and deliberately not touched.** See §9. |
| F-9 | **DEBT (open, unchanged)** | Real Safari/iOS device verification of the backup download. | Logic audited (§7); device pending. Drives the verdict. |

**No BLOCKER. No MAJOR.**

### False positives in this block's own instrumentation

Five, all mine, all corrected before any conclusion rested on them:

1. **"the zone comparison is unreachable after multi-hub navigation"** — it is reachable in all
   three hubs. The audit had left the planner overlay open, and later the saved-places sheet
   expanded; an overlay on screen reads exactly like a missing feature. Led to F-5.
2. **"every JS chunk returned 200"** — counted **304 Not Modified** as a failure. A cached response
   is a success; the check now accepts 200 or 304 and still fails any 4xx/5xx.
3. **"Osaka is unreachable"** — the national view carries *two* controls whose accessible name
   starts with a hub's name, and the first in DOM order was not the visible one.
4. **A seeded inter-hub segment silently rejected the whole draft** — the shape was wrong
   (`ManualInterHubSegment` requires all nine keys). The same failure class as Block 13's day shape:
   the draft parser falls back to a fresh draft, so the seed *looks* applied in raw storage.
5. **A "secret" in `dist/`** — matched React DOM's internal input-type table (`password: !0`).

---

## 4. Multi-hub, two travellers, planner, persistence

**Multi-hub.** Tokio + Kioto + Osaka in one trip. Switching hub loses no state; the shortlist is the
union of both people's wants across all three; the zone selection is stored **per hub** and no Tokio
zone appears in Osaka's comparison; filters are cleared between hubs by the audit so an empty list
can only mean an empty hub; returning to the national map works from every hub.

**Two travellers.** Two separate identities. What A marked is attributed to A alone and what B marked
to B alone — asserted per place id, not in aggregate. No stance becomes shared state. The planning
draft stays **one shared document** (`version: 8`, not an array, not one per person). The planner,
opened *after* switching traveller, works from the shared shortlist rather than the active person's.
**No code treats `nihon.savedPlaceIds` as authority:** it is read in exactly one place
(`travellers.ts`, only when no travellers document exists) and never written anywhere.

**Planner.** A three-day plan with both trip bounds, a manual visit time and a valid inter-hub
segment is adopted, survives a reload byte-for-byte, and round-trips through export/import.

**Persistence, adversarially.** Losing the draft key does not lose the travellers. Corrupt traveller
storage fails safe and the app still mounts. A legacy-only browser migrates into the traveller model
with places marked `carriedOver` and attributed to nobody. A future-version backup is refused, is
explained, and writes nothing. **And the one that matters most:** after a restore and its forced
reload, a *new* interaction does not resurrect the replaced trip.

---

## 5. Network, runtime, accessibility, responsive

**Network.** Every request was intercepted for the whole journey. The only external hosts seen are
`a|b|c.tile.openstreetmap.org` — the contracted map tiles. **No photograph is fetched from Wikimedia
at runtime** (all images are built into `dist/images/`). Export and import make **zero** requests,
measured with counters scoped to each operation. No secrets, no development endpoint, no dormant
transit provider woke up. No JS chunk 404s.

**Runtime.** Zero page errors, zero unhandled rejections, zero relevant console errors across all
three viewports. **One exclusion only, and it is exact:** Leaflet's own tile-image loads fail because
this sandbox has no route to `tile.openstreetmap.org`. That is the environment, not the product, and
nothing else is filtered.

**Accessibility (sanity gate, not a WCAG claim).** Every visible button has an accessible name.
Dialogs are `role="dialog" aria-modal="true"` with `aria-labelledby`, take focus on open, trap Tab,
close on Escape, and do not strand focus on close. Destructive confirmation (import) states its
consequence before the control exists to press. **This is a precise sanity gate; no WCAG conformance
level is claimed, because none was measured.**

**Responsive.** All three viewports, interacted with rather than screenshotted: no horizontal
overflow at any point in the journey, on any surface. No new tap-target exception was introduced —
Block 13's `.app__backup` was raised to 44 px when Block 1's audit caught it at 36.

---

## 6. Data invariants

| check | result |
|---|---|
| places / unique ids / `JP-nnn` | **214**, all unique, all well-formed |
| hubs | **7** — Tokio 57 · Osaka 53 · Okinawa 50 · Kioto 49 · Sapporo 3 · Fukuoka 1 · Nagoya 1 |
| photography | **163** images over **157** places; `imageCount` agrees |
| accommodation zones | **16** — Tokio 6 · Kioto 5 · Osaka 5 |
| access points · reservation mechanisms | 4 · 8, all parsing under their own validators |
| all 8 argument-free validators | **8/8**, including source↔app byte parity |
| all 13 Python suites | **13/13** |

No dataset was modified in this block. No external source was re-consulted, and no `consultedAt` was
touched.

---

## 7. Portable backup — logical Safari audit

The brief forbids claiming Safari compatibility this repository cannot execute, and requires
auditing everything that *can* be checked from code and standards.

| aspect | finding |
|---|---|
| File System Access API (`showSaveFilePicker` etc.) | **not used** — that would have been Chromium-only and a MAJOR |
| vendor-prefixed APIs (`webkit*`, `msSaveBlob`) | **none** |
| export mechanism | `new Blob([...], { type: "application/json" })` → `URL.createObjectURL` → anchor with `download` → click → remove |
| anchor attached before click | **yes** — a detached anchor's synthetic click is ignored on iOS |
| object-URL cleanup | **deferred by a macrotask** (F-1). Previously synchronous |
| import mechanism | `<input type="file" accept="application/json,.json">` → `File.text()` (Safari ≥ 14) |
| encoding / MIME | UTF-8 JSON, `application/json` |
| cancellation | the picker's no-file case is handled and writes nothing |
| `requestIdleCallback` (Block 12 prefetch) | feature-detected with a `setTimeout` fallback |

> **Logical compatibility audited; a real Safari/iOS device test remains outstanding.**
> No claim is made about Safari's actual download behaviour. This is a gap in evidence, not a known
> failure, and it is the sole reason the verdict carries a known limitation.

---

## 8. Bundle and static-hosting readiness

| | Block 12 | Block 13 | Block 14 |
|---|---|---|---|
| initial JS raw | 1,377,479 B | 1,389,634 B | **1,389,652 B** |
| initial JS gzip | 250,628 B | 253,736 B | **253,742 B** |
| initial JS brotli | 201,105 B | 203,677 B | **203,791 B** |
| deferred chunks | 2 | 2 | **2** |

**+6 B gzip** — the `setTimeout` wrapper from F-1. **Block 12 is intact:** the same two lazy chunks,
no duplication, one initial JS request, and neither deferred surface is a `modulepreload` in the
head. The Vite 500 kB advisory still fires and is still deliberately not silenced (Block 12 §4).

**Static hosting.** `dist/` is a plain static site: `index.html`, `assets/`, `images/`, `geography/`,
`favicon.svg`. **No Node server, no API, no runtime environment variable** — the only `import.meta.env`
uses are `BASE_URL`, inlined at build. **No client-side router and no History API use**, so there are
no deep links and therefore **no SPA rewrite/`404.html` rule is needed**: a refresh at `/` always
works. No service worker and no manifest were added (§17). One caveat, F-7: asset paths are absolute,
so a subpath deployment needs Vite's `base` set.

---

## 9. Editorial ratings — debt kept open, deliberately

The 160 editorial ratings still have no second human reader. **Nothing here changed a value, and
Claude is explicitly not the second reader.** Block 9's boundary between *fact*, *derived* and
*editorial* holds: ratings are presented as Nihon's stated opinion, labelled as such and never as
objective fact, so this is **editorial debt and not a technical release blocker**. It can only be
closed by the two travellers.

---

## 10. Evidence limitations

1. **No real Safari/iOS or Android device.** Everything is Chromium at three emulated viewports.
   Layout and logic are verified; engine-specific download behaviour is not.
2. **No throttled network or CPU profile**, so no first-paint, parse-time or TTI figure is claimed
   anywhere (inherited from Block 12).
3. **No WCAG conformance level is claimed** — §5 is a precise sanity gate, not an audit against a
   standard.
4. **No live deployment** was performed; §8 is a readiness inspection of `dist/`, not a deploy.

---

## 11. Verdict

> ## RELEASE-READY WITH KNOWN LIMITATIONS

No BLOCKER and no MAJOR remain. The complete journey works across Tokio, Kioto and Osaka at three
viewports; the two travellers keep separate identities through planning, reload, export and restore;
the restore trap is closed and proven; persistence survives missing, corrupt and legacy storage;
the network is clean; there are no page or console errors; the build is a deployable static site;
Block 12's architecture is intact; and every historical gate is at its exact baseline.

**The limitations that must be stated before publishing:**

1. **Safari/iOS device verification of the backup download is outstanding.** The logic is audited and
   one Safari-fragile pattern was removed (F-1), but no iPhone has run it.
2. **A subpath deployment needs `base` configured** (F-7). At a domain root, none is needed.
3. **The 160 editorial ratings have one reader.** Presented as opinion, never as fact — but the
   second reader is still owed (F-8).
4. **An expanded saved-places sheet can overlay the national start screen on a phone** (F-5); one tap
   collapses it.
