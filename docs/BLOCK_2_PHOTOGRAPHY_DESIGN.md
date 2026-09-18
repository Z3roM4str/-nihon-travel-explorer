# Block 2 — the photographic layer

**Status:** implemented. **Base:** `claude/brave-wozniak-f79ie3` at `ac54969` (Block 1 closed).
**Authority it starts from:** [`PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md`](PHOTOGRAPHY_STOP_VS_CONTINUE_DESIGN.md)
(Phase 4M) and [`BLOCK_1_UX_HIERARCHY_DESIGN.md`](BLOCK_1_UX_HIERARCHY_DESIGN.md).

Every photograph in Nihon exists to answer one question: **is this worth part of our 8–9 days?**
Nothing in this block was acquired for a coverage percentage.

---

## 1. Reproduced starting state

Recomputed from `data/places.json`, `data/visual/photography-metadata.json` and the committed
assets — not read from any document. Every Phase 4M figure reproduces exactly.

| Quantity | Reproduced | Phase 4M |
|---|---:|---:|
| places | 214 | 214 ✓ |
| covered | 144 (67.3%) | 144 ✓ |
| uncovered | 70 | 70 ✓ |
| max photographs per place | **1** | 1 ✓ |
| assets on disk / registry records | 144 / 144 | — |
| asset bytes | 42,454,392 B = **40.49 MiB** | 40.49 ✓ |
| mean bytes per asset | 294,822 | 294,696 ✓ |
| orphaned or unregistered files | **0** | — |
| canonical ↔ app registry | byte-identical | ✓ |

Grade coverage S 28/32 (87.5%) · A 102/147 (69.4%) · B 14/25 (56.0%) · C 0/6 · D 0/4.
Hubs: Fukuoka/Nagoya/Sapporo 100%, Kioto 69.4%, Okinawa 68.0%, Osaka 64.2%, Tokio 64.9%.
Prominence: `Extremo` 52.3% · `Alto` 80.4% · `Medio` 65.6% · `Bajo` 67.9%.
The 16 carried fail-closed ids all exist and are all uncovered (4 S / 10 A / 2 B).
Eligible universes after exclusions: A 35 · A+B 44 · A+B+C+D 54. All match.

### One divergence, against the Block 1 handoff — not against the data

`docs/BLOCK_1_HANDOFF.md` told a future session that the uncovered places are identified by
`imageStatus: "brief-only"` in `places.json`. **They are not.** `scripts/export-dataset.py`
writes that literal for **all 214** places unconditionally, so the field is a constant, carries
no coverage signal, and is read by nothing in the application. The registry is and always was
the sole source of truth for coverage.

The error was in the Block 1 handoff, not in the dataset, not in Phase 4M — which never claimed
otherwise — and it changes no figure above. It is corrected here rather than silently, because
a future session following that pointer would have concluded every place is uncovered.

---

## 2. Two problems, deliberately not merged into one metric

**Coverage** is a place with no photograph at all. **Depth** is an important place whose single
photograph does not show what the place actually is. Phase 4M measured the first exhaustively
and never measured the second, because at 1 photograph per place there was nothing to measure.

They are kept apart because they trade differently. Coverage is bounded by the editorial
ordering invariant (§3) and by supply. Depth touches neither: a second photograph on a covered
place changes **no** coverage percentage, so it cannot break the ordering at any size.

## 3. Block 1 raised the price of a missing photograph, and the invariant with it

Phase 4M decided STOP against the v1.0.0 interface, where the place list was one-line rows and
the photograph appeared only inside the detail panel. A missing photograph cost nothing while
browsing; you met it only after choosing to open a place.

Block 1 made the list photo-led. Every card now carries a 16:9 image slot, so a missing
photograph is visible on every scroll of the primary browsing surface.

That cuts both ways, and both matter:

1. **The value of a first photograph went up** for exactly the places a reader scrolls past.
2. **Phase 4M's ordering invariant got *more* important, not less.** Its purpose was that
   photography must never contradict the dataset's editorial grading. When photographs lived
   two taps away that was a theoretical concern. Now a B place with a photograph visibly
   outshines an A place without one, in the surface where choosing happens.

So the invariant is **kept in full**. Phase 4M §12 Objection 3 is right that dropping it needs
its own gate; Block 1 is evidence for keeping it, not against. Everything below respects
S ≥ A ≥ B ≥ C ≥ D coverage, and §4's permanent ceiling (≤26 further A, ≤7 further B ever,
programme ceiling 82.7%) is accepted as stated.

---

## 4. Workstream 1 — the derivative tier (no sourcing, no risk, largest win)

Block 1 created a performance defect and did not pay for it. The only asset that existed was
the 1600px detail hero at ~295 KB mean, and the card list rendered it into a 350–390 CSS px
slot. The saved-places panel decoded it into a **48px** box.

Measured before any change, scrolling one hub's full card list:

| hub | card images | bytes over the wire |
|---|---:|---:|
| Tokio | 37 | **9.51 MiB** |
| Kioto | 34 | 10.39 MiB |
| Osaka | 34 | 9.27 MiB |
| Okinawa | 34 | 9.99 MiB |

`scripts/build-photography-derivatives.py` renders one 800px rendition per registered
photograph. 800 is chosen against the real card geometry — phone card 371 CSS px, tablet two-up
390, desktop sidebar 348, so the largest true requirement at DPR 2 is 780px. A DPR 3 phone
upscales it 1.39× on a 16:9 thumbnail, which is not perceptible at that size and is far cheaper
than a ~20 MiB 1200w tier for the difference.

Measured alternatives at quality 72, mean bytes per asset across a 20-asset sample:
480px 31,714 (10.9%) · 640px 55,027 (18.9%) · **800px 83,238 (28.5%)** · 960px 116,069 (39.8%).
A second 480w tier was considered and rejected: it would add ~5.6 MiB to serve DPR 1, which is
mostly desktop, where bandwidth matters least — and it would split cache reuse with the saved
list. One tier, reused everywhere, was the better trade.

**The name is derived, not declared.** `slug.webp` → `slug-800w.webp`. A second URL field on
every record would have added 144 hand-maintained strings and a second parity surface between
the canonical and app registries. Three places now mirror one string rule — the build script,
`cardImageUrl()` in the app, and the validator — and tests hold them together.

Measured after, in Chromium, scrolling the whole Tokio list: **2.63 MiB at both 390×844 DPR 2
and 1440×900 — a 72% reduction**, with 37 of 37 responses being derivatives and no original
fetched by the list at all. The detail hero offers both through `srcset`; the lightbox still
loads the original, which is the one place full resolution matters.

The validator gained two rules and now looks at the asset tree for the first time: every
registered photograph must ship its derivative, and no file may be an orphan. Both were proven
to fail on a planted fault and recover.

**Marginal cost:** +10.92 MiB in the repository, which no user ever downloads in full, to
remove 6.88 MiB from *every* phone visit that scrolls a hub.

## 5. Workstream 2 — prominence-first coverage

Phase 4M §11 backlog item 1 named six reachable high-prominence gaps its coverage-balanced
selector would never choose, and flagged the obstacle: 4 of the 6 are grade B, and 4 B
photographs alone invert B over A.

The tranche is therefore **prominence targets plus A ballast**, sized so the ordering survives
sourcing failures, with the hub mix chosen so hub spread improves rather than decays.

**14 attempted · 13 accepted · 1 failed closed.**

| | before | after |
|---|---:|---:|
| coverage | 144 (67.3%) | **157 (73.4%)** |
| S | 87.5% | 87.5% |
| A | 69.4% | **76.2%** |
| B | 56.0% | **68.0%** |
| A−B margin | +13.4 pts | **+8.2 pts** |
| large-hub spread | 5.2 pts | **3.8 pts** |
| `Extremo` | 52.3% | **63.6%** |
| `Alto` | 80.4% | **87.5%** |

S ≥ A ≥ B ≥ C ≥ D holds. Hub spread is a **new programme minimum** — Phase 4M called 5.2 "the
tightest in the programme's history" and "the programme minimum"; the mix was chosen to beat it
rather than spend it. The prominence inversion Phase 4M measured is materially repaired:
`Extremo` +11.3 points.

Accepted: JP-019 Tokyo Skytree, JP-080 Kinkaku-ji, JP-153 Kokusai Street (B);
JP-038 teamLab Planets, JP-072 Tenryū-ji, JP-030 Tokyo Station Marunouchi,
JP-034 Mori Art Museum, JP-086 Sanzen-in, JP-131 Kasuga Taisha, JP-148 Hikone Castle,
JP-119 Shitennō-ji, JP-132 Isuien Garden, JP-187 Aharen Beach (A).

**JP-080 Kinkaku-ji** — the single most conspicuous absence in the catalogue, which Phase 4M
proved no tranche up to n=32 would ever select — is now covered by a Commons Featured Picture
at 0.01 km.

### JP-171 Blue Cave at Cape Maeda — failed closed, the 17th

Commons carries no licensable photograph of the Blue Cave. The only allowlisted candidate for
the cape is a low-resolution panorama that does not show the dive site the place is named for,
so it fails the identification bar rather than the licence bar. Recorded as fail-closed;
re-entry needs materially new sourcing evidence, per the existing convention.

## 6. Workstream 3 — depth, and the criterion that bounds it

`PlaceGallery` has shipped a complete carousel since before Block 1 — swipe, arrows, dots with
real hit areas, a visible `n / total` counter, keyboard navigation, a focus trap in the
lightbox, per-image attribution — and **production has never once exercised it**, because
`total > 1` was never true at 1 photograph per place. Block 1 added the counter and the dot hit
areas to code that no data could reach.

A second photograph is added **only** when all three hold:

1. the place is grade **S**, or grade A with `tourismLevel` `Extremo`/`Alto`;
2. its existing photograph shows **one facet that does not convey the actual experience** —
   an exterior, entrance or approach for a place whose value is inside, or a wide/aerial frame
   for a place whose value is at human scale;
3. a licensable photograph of a **materially different** facet of the **same place** exists.

Criterion 2 is auditable from the committed `alt` text, so the judgement is reproducible from
data rather than from memory.

**10 assessed · 6 accepted · 4 failed the criterion · 4 shipped, 2 deferred (§6.1).**

| place | existing facet | added facet | shipped |
|---|---|---|---|
| JP-129 Tōdai-ji | hall facade | the Great Buddha inside it | ✅ |
| JP-152 Naoshima | the **ferry terminal** | Benesse House Museum above the Seto sea | ✅ |
| JP-089 Nijō Castle | Ninomaru palace facade | the Ninomaru garden | ✅ |
| JP-021 Tokyo National Museum | lobby staircase | the Honkan building and its pool | ✅ |
| JP-205 Sapporo Snow Festival | aerial of Odori Park | a lit sculpture at human scale | deferred |
| JP-125 Universal Studios Japan | entrance plaza | an actual attraction inside | deferred |

Naoshima is the clearest case: its only photograph was the ferry terminal — the least
interesting thing on an art island, and an image that actively undersold a grade S place.

**Rejected, with reasons:**

- **JP-096 Sanjūsangen-dō** — every licensable candidate is the same long-hall exterior the
  existing photograph already shows. The 1001 Kannon are the experience and photography of them
  is prohibited. Near-duplicate; fails criterion 3.
- **JP-044 Ghibli Museum** — interior photography is prohibited; all candidates are further
  exterior views. Near-duplicate; fails criterion 3.
- **JP-097 Nintendo Museum**, **JP-179 Yambaru** — no allowlisted candidate exists at all.
- **JP-135 Himeji Castle**, **JP-173 Churaumi Aquarium** — assessed and rejected at criterion 2:
  their existing photograph already *is* the experience (the keep; the whale shark tank). A
  second would be decoration.

### 6.1 Two accepted candidates deferred — a pipeline limitation, not a sourcing failure

JP-205 and JP-125 passed every gate, including visual inspection, and could not be downloaded.
`upload.wikimedia.org` returned HTTP 429 for both, persistently, across a seven-minute backoff,
while the existing assets of the *same two places* re-downloaded successfully in the same runs.

The cause is specific and worth recording, because it is a real limitation of
`scripts/acquire-photography.py` rather than bad luck:

> The script requests a thumbnail at `iiurlwidth=1600`. When a file's own width is **at or
> below** 1600, Commons has no thumbnail to render and returns the **original** file URL. Every
> one of the 17 successful acquisitions was wider than 1600px and was therefore served a
> **cached** `/thumb/` rendition. These two files — 1600×1067 and 1440×810 — are the only ones
> in Block 2 where the pipeline fetches an original, and original fetches are what the host
> throttles. The 429 body says so directly: *"instead use thumbnail images in sizes listed on
> …"*.

**The proposed fix is not implemented here.** When the resolved URL is the original and the
fetch is refused, the script should fall back to the largest standard cached width *below* the
original — which stays inside its existing contract, since `PHOTOGRAPHY_MAX_DIMENSION` is a
maximum and the script already never upscales. It is left for a future session because the
Commons API had by then rate-limited this environment as well, and shipping an unexercised
fallback path into an acquisition pipeline is worse than shipping none.

Both records were therefore **removed from the registry** rather than left dangling: the
validator refuses a record whose asset is missing, and it was right to. Their entries remain in
`data/visual/block2-depth-batch.json`, verified and ready, so a future session acquires them with
one command once the fix lands. They are **not** fail-closed — that term is reserved for a
sourcing or identification failure, and these are neither.

This session generated enough Commons traffic to exhaust its own API budget. That is recorded
as a process finding: the discovery, contact-sheet and acquisition steps should share one
throttle rather than three independent ones.

A Super Nintendo World photograph was available and rejected for JP-125: SUPER NINTENDO WORLD
is `JP-126`, a **separate catalogue entry**, and using its image for USJ would blur two places —
the exact hazard the validator's one-source-one-place rule exists to prevent.

## 7. How a wrong image was prevented

A wrong photograph is worse than no photograph, so identification was gated three times before
anything was downloaded:

1. **Licence**, filtered to the pipeline allowlist at discovery, not after.
2. **Coordinates.** `scripts/discover-block2-commons.py` reports the great-circle distance from
   the file's own Commons GPS to the place's coordinates. Accepted candidates that carry GPS
   are all within 0.2 km. A filename can claim anything; a photograph taken 40 km away cannot
   be the place.
3. **Sight.** Every candidate was rendered into a contact sheet and looked at.

Step 3 caught what steps 1 and 2 could not. **Two candidates that passed licence, title and
coordinates were rejected on sight** — JP-086 Sanzen-in (autumn foliage, no temple in frame)
and JP-148 Hikone (a blossom close-up with no castle) — and replaced. And a text search for
"Blue Cave" returned a cave in **Montenegro**, which is precisely the substitution the rules
forbid and which no amount of metadata checking would have caught.

All 19 accepted assets were then re-inspected **as committed WebP**, not as Commons previews,
so what was approved is what shipped.

`scripts/prepare-block2-photography-metadata.py` reads licence, licence URL, credit,
acquisition URL, original dimensions and `processing` from the Commons API rather than by hand.
Every one of those is cross-checked by the validator, and a hand-typed value can be internally
consistent and wrong.

## 8. Asset budget and the marginal cost of each improvement

| | assets | bytes |
|---|---:|---:|
| Block 2 start | 144 | 40.49 MiB |
| + coverage tranche (13) | 157 | 44.06 MiB |
| + depth tranche (6) | 163 | ~45.8 MiB |
| + 800w derivatives (163) | 326 files | ~+12.5 MiB |

Marginal cost per improvement:

- **−72% list bandwidth on every phone visit**: +10.92 MiB repository, 0 KB user cost.
- **+13 covered places, +11.3 points of `Extremo` prominence**: ~3.6 MiB originals, ~1.1 MiB
  derivatives.
- **6 galleries on grade S places, and the carousel exercised at all**: ~1.8 MiB originals,
  ~0.5 MiB derivatives.

No tranche approaches Phase 4M's 14 MiB hard stop or its 11 MiB soft budget.

## 9. STOP criterion

Block 2 stops here, and the criterion is stated so it binds a future session rather than
inviting one more round:

**Coverage stops** when the next photograph would have to be either (a) a place the ordering
invariant forbids — A is now at 76.2% against a permanent ceiling of 87.1%, leaving 16 of the
26 lifetime A slots, and B at 68.0% against 84.0% — or (b) a place whose photograph would not
change a reader's decision. The prominence set that motivated this tranche is **exhausted**:
of Phase 4M's six named reachable gaps, five are covered and one is fail-closed. There is no
remaining *named* product motive, only percentage — which is precisely the trap Phase 4M §9
identified, and it is still a trap at 73.4%.

**Depth stops** when criterion 2 no longer has candidates. It already nearly does: 10 assessed
produced 6, and the four rejections were not sourcing accidents — two are places where
photography of the experience is *legally prohibited*, and two have no allowlisted image at
all. Depth is not a supply that scales.

**Neither resumes on a percentage.** A future block should re-enter only with a *named* reason:
a specific place whose absence or single facet is demonstrably costing a decision.

## 10. Preserved

Block 1 is a regression contract and nothing in it was touched: hierarchy, the phone
`Lista`/`Mapa` switch, the tablet grid, filters, onboarding, saved places, the `aria-live`
confirmation, attribution, accessibility, responsive behaviour, empty states, stretched links,
practical information, the Feb–Mar 2027 block, "Cerca de aquí" and official links. The Block 1
audit runs at 142/142 unchanged.

`grade` remains the source of truth. **No place was re-ranked because of a photograph, and no
place's interest level was reduced for lacking one** — the interest ladder does not read the
registry, and `block1-ux.test.ts` still proves the placeholder path.
