# Nihon v1.1.0

**Release candidate.** Backward-compatible feature release over [`v1.0.0`](RELEASE_V1.0.0.md)
(published 2026-09-17). Every figure below is derived from the repository at the audited commit, not
carried over from the v1.0.0 notes.

| | |
|---|---|
| Previous release | **v1.0.0** — tag `v1.0.0` → `1a11fe8`, published 2026-09-17 |
| This release | **v1.1.0** |
| Commits since v1.0.0 | **42** |
| Diff since v1.0.0 | 327 files, +37,506 / −2,133 |
| Compatibility | **Backward compatible.** A browser holding a v1.0.0 saved list migrates automatically; no data is discarded. |

`RELEASE_V1.0.0.md` and `FINAL_RELEASE_GATE.md` describe v1.0.0 and remain the historical record of
that release. They are not updated here.

---

## Exploración

The catalogue is unchanged at **214 verified places across 7 hubs** — Tokio 57, Osaka 53, Okinawa 50,
Kioto 49, Sapporo 3, Fukuoka 1, Nagoya 1. v1.1.0 adds no new places and no new research: what it
adds is a better way through them.

The phone-first discovery layer is new since v1.0.0. Photo-led place cards state a plain-language
level of interest, what the place is, where it is, why it is worth going and how long it asks for,
with a `Lista` / `Mapa` switch, free-text search, filters, a three-card first-run explainer, and
saving confirmed from every surface.

The national map still opens on all 47 prefectures drawn from official MLIT geometry, and still
makes clear which prefectures Nihon actually covers rather than pretending to cover them all.

## Fotografía

**157 of 214 places carry a licensed photograph, across 163 images** — up from **144 places / 144
images** at v1.0.0. Six places carry a second perspective as a gallery. Every photograph ships a
card-sized rendition as well as a full one.

All images are sourced from Wikimedia Commons under a CC0 / CC BY / CC BY-SA allowlist, with full
attribution, and are **served from the build** — nothing is fetched from Wikimedia at runtime. Every
place without a photograph shows its editorial `imageBrief` rather than an empty frame.

## Dos viajeros

The largest change in this release, and the one that changes what "Quiero ir" means.

Two people plan one trip. Each keeps **their own stance on each place** — interested, not
interested, or no opinion at all, which is a third and distinct state. The shared shortlist is
**derived** from both people's stances on read; it is never stored a second time, so the two cannot
drift apart.

Where they agree, Nihon reports a **coincidence of two preferences** — in those words. It is not a
score, not a percentage, not a compatibility rating, and there is deliberately no function anywhere
that returns a number per place. Where they disagree, the divergence is stated plainly, and a place
only one person wants says so rather than appearing as a shared decision.

A preference never becomes a plan on its own.

## Planificación

The planner remains **manual throughout**: it never reorders a route, never assigns a day, and never
chooses anything on your behalf.

What is **shared**, because two people have one itinerary: the route order, the day assignment, the
calendar anchor and trip bounds, manual visit start times, accommodation anchors and their boundary
legs, manual inter-hub segments, and the zone chosen for each hub.

What is **personal**: the stance on a place. That is the whole of it, and the boundary is deliberate.

Since v1.0.0 the planner gained stable day identity across reordering, whole-trip composition,
evidence-complete local swap and relocation alternatives, and zone-seeded accommodation anchors.

## Alojamiento

**16 accommodation zones** across Tokio (6), Kioto (5) and Osaka (5), presented as distinct lodging
strategies rather than a ranking.

Three kinds of statement are kept visually and structurally apart, and never blended:

- **facts** — sourced transport claims, each carrying the source that supports it;
- **derived** — how far a zone sits from the places you actually saved, computed on read;
- **editorial** — Nihon's own judgement, labelled as opinion.

**No zone is ever called the best.** Choosing a zone can seed an accommodation anchor into the
planner, which is the one place the comparison touches the plan.

## Evidencia y freshness

Nihon records what an official source said, and when it was read. It does **not** poll anything.

Recorded opening hours and closure composition, manual visit-time fit against recorded intervals,
reservation mechanisms, trip-derived reservation dates, and a route-wide official reservation
calendar for the February–March 2027 window.

Every source carries what it supports, how close it is to the thing it describes, and `consultedAt`
— the civil date Nihon opened that page and confirmed it backed the claim beside it. From that,
freshness is **derived on read**: a source is current, due for a look, governed by no periodic
rhythm at all, or of an interval Nihon cannot honestly derive. **Age is never treated as falsehood**,
and nothing is deleted, downgraded or hidden because a date got old.

**This is not live data**, and nothing in the interface suggests it is.

## Rendimiento

The planner and the zone comparison load on demand — the two surfaces with enough exclusive code to
justify a boundary, measured from the module graph rather than guessed. Both are prefetched once the
browser is idle after first paint, so the split moves bytes off the critical path without moving the
wait to the person who opens them.

Initial JavaScript: **1,389,652 B raw / 253,742 B gzipped / 203,791 B brotli**, plus two deferred
chunks totalling 37,660 B gzipped. Roughly 105 kB of the gzipped payload is the dataset itself.

The build still prints Vite's 500 kB advisory. **That is a threshold on raw bytes, not a user-facing
problem**, and it was deliberately not silenced: most of what it counts is highly repetitive JSON
that compresses to a fraction of its raw size.

## Respaldo portátil

New in v1.1.0, and the answer to "my trip only exists in this browser".

**Export** writes your durable decisions — both travellers' stances and the shared plan — to a
readable JSON file you keep. **Import** reads that file back in another browser.

It is manual, local and explicit. There is **no account, no server, no upload and no sync**: the file
never leaves your device unless you move it yourself. Importing **replaces** what is in the browser
rather than merging — merging two trips would mean deciding whose route wins, and nobody has
answered that — and it says so before the button exists to press, with a preview of what the file
contains in units you recognise. A backup that can no longer be fully restored says how many places
are affected instead of reporting success.

The file carries decisions only. No catalogue, no photographs, no zones, no provenance, no derived
values, no storage keys, no URLs.

## Privacidad

Everything Nihon knows lives in your browser's local storage. No account, no backend, no telemetry,
no analytics. The only external request the application makes is to OpenStreetMap's tile servers to
draw the map.

---

## Non-goals

Unchanged from v1.0.0, and still deliberate:

- **no booking or payments**;
- **no live transit** and no real-time departures;
- **no routing provider** and no estimated travel times beyond recorded evidence;
- **no automatic itinerary generation** — the planner never reorders a route for you;
- **no backend, no accounts, no automatic sync**;
- no hotels, no flights, no prices.

---

## Known limitations

Stated plainly, because a release that hides these is worth less than one that does not.

1. **The portable backup has not been exercised on a physical iPhone.** Its logic has been audited
   against web standards — no Chromium-only API is used, the file APIs are the standard ones, and
   one Safari-fragile pattern was removed before this candidate — and it passes 226 integration
   checks in Chromium at three viewports. But no iOS device has run it. **This is a gap in evidence,
   not a known defect**, and it is the single item gating this release candidate.
2. **The 160 editorial ratings have one reader.** They are presented as Nihon's stated opinion,
   labelled as such and never as objective fact. A second human reader is still owed.
3. **A subpath deployment needs Vite's `base` configured.** The build uses absolute asset paths, so
   it deploys unchanged at a domain root but not under a path prefix.
4. **On a phone, an expanded saved-places sheet can overlay the national start screen.** One tap
   collapses it; nothing is lost or corrupted.
5. **No throttled-network or CPU measurement**, so no first-paint or time-to-interactive figure is
   claimed anywhere.
6. **No WCAG conformance level is claimed.** Accessibility was verified as a precise sanity gate —
   accessible names, labelled modals, focus management, Escape, tap targets — not audited against a
   standard.

---

## Verification

At the audited commit, on the production build:

| | |
|---|---|
| Unit tests | **3,179** across 92 files |
| Python suites | **13 / 13** |
| Data validators | **8 / 8**, including source↔app byte parity |
| Browser audits | **1,958 checks** across 13 suites at three viewports, all passing |
| Lint · typecheck · build | clean |

The browser audits run against the production build at 390×844 DPR 2, 820×1180 DPR 2 and 1440×900,
and include one continuous end-to-end journey across Tokio, Kioto and Osaka — discovery, both
travellers, planning, zones, export, restore, reload — rather than isolated feature demos.
