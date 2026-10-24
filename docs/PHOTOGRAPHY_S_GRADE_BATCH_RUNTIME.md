# Phase 4D — S-Grade Licensed Photography Acquisition Batch

Status: **implemented and exact-head validated**

Base: `440f814439360e2c5e7423cd243546e415e1a591` (`main` after Phase 4C / PR #96)

Contract: GitHub Issue #97

Acquisition date: **2026-09-15**

---

## 1. Result

Sixteen S-grade targets were researched independently. **Twelve were acquired; four failed
closed.** Catalog goes **24 → 36** records, coverage **36/214 (16.8%)**, against a maximum
possible 40/214 (18.7%).

No target was force-covered, no place was silently substituted for another, and the license
allowlist was not widened.

### 1.1 Acquired

| place | subject | license | creator |
|---|---|---|---|
| JP-044 | Ghibli Museum exterior | CC BY-SA 2.0 | Olivier Lejade |
| JP-066 | Fushimi Inari senbon torii path | CC BY-SA 4.0 | Hyppolyte de Saint-Rambert |
| JP-096 | Sanjūsangen-dō main hall | CC BY 3.0 | Nesnad |
| JP-135 | Himeji Castle keep | CC BY-SA 4.0 | Anagoria |
| JP-142 | Kinosaki Onsen, Otani River canal | CC BY-SA 4.0 | Asturio Cantabrio |
| JP-143 | Ren'ge-in, a Koyasan lodging temple | CC BY 4.0 | Hyppolyte de Saint-Rambert |
| JP-144 | Okunoin memorial mound | CC BY-SA 4.0 | Josep M. Gracia |
| JP-184 | Zamami Island coast | CC BY-SA 4.0 | Rickard Törnblad |
| JP-188 | Yonaha Maehama Beach | CC BY 2.5 | 663highland |
| JP-192 | Kabira Bay | CC BY 2.5 | 663highland |
| JP-197 | Nakama River mangroves, Iriomote | CC BY 2.5 | 663highland |
| JP-205 | Odori Park during the Snow Festival | CC BY 2.5 | Eckhard Pecher |

### 1.2 Failed closed — still on `imageBrief`

**JP-033 — teamLab Borderless.** Every allowed-license candidate is a photograph whose subject
*is* a copyrighted immersive artwork, because the artwork is the venue; there is no
architecture, exterior or signage alternative that still represents the place. Most Commons
candidates additionally depict the **closed former Odaiba location**, which the venue left in
2024, so they would also be factually wrong. Subject-matter risk cannot be bounded.

**JP-126 — SUPER NINTENDO WORLD.** The one entrance-signage candidate — the shape Phase 4A
established as defensible for Universal Studios Japan — has an identifiable private individual
out of focus but dominating the foreground, which is its own problem. Every other allowed-license
candidate takes the Nintendo-IP themed environment (Peach's Castle, warp pipes, themed
structures) as its subject rather than neutral architecture or signage.

**JP-203 — Tokyo Disneyland.** The only defensible allowed-license candidate shows the Tokyo
Disneyland *Hotel* and the Resort Line monorail, not the park. It would be captioned as a place
it does not actually depict, which Issue #97 forbids independently of licensing.

**JP-204 — Tokyo DisneySea.** The available candidates depict themed lands — Arabian Coast —
that are themselves creative environments derived from specific copyrighted films, not neutral
architecture or park signage. Subject-matter risk cannot be bounded.

These four remain available to a later phase if a defensible, correctly-located candidate
appears. Nothing about them was weakened to make them pass.

---

## 2. Method

For every target independently:

1. candidates were listed from the current Commons API, never from a third-party summary;
2. license, license URL, creator and any restriction field were read from the **file page's own
   metadata**, not inferred;
3. candidates outside the existing allowlist were discarded without exception;
4. the leading candidate was **downloaded and looked at** before acceptance — subject match was
   judged from the photograph, never from its filename;
5. accepted records were acquired through `scripts/acquire-photography.py` unchanged, one
   `--only` invocation per place so no existing blob was ever rewritten;
6. the pipeline's own hard check re-resolved each declared `acquisitionUrl` against Commons at
   download time and would have refused any mismatch.

Several candidates were rejected during step 4 for representing the place poorly rather than for
licensing: a street view where Sanjūsangen-dō was barely visible, a carp-streamer close-up for
Kinosaki, a night shot of a minor Ghibli outbuilding, and a sponsor-branded ski ramp for the
Snow Festival. Each was replaced by a stronger candidate under the same rules.

### 2.1 Attribution titles

**None of the twelve records carries an `attributionTitle`.** No file page among them was
verified to assert a separately source-backed work title, and Phase 4C's contract forbids
promoting the Commons filename into one. The catalog therefore still holds exactly the three
attribution titles Phase 4C verified.

### 2.2 Credits

Credits follow the existing convention: the creator name without the Flickr-style geographic
suffix Commons appends (the catalog records `Stephen Kelly`, not `Stephen Kelly from San
Francisco, CA, USA`). Only JP-044 needed this normalization.

---

## 3. Invariants preserved

- the twenty-four Phase 4A/4C image blobs are **byte-identical to base** — zero changed paths;
- the twenty-four existing metadata records are byte-identical; only appends were made;
- no place has a second image; every covered place has exactly one;
- canonical and app-facing metadata are byte-identical;
- the license allowlist is unchanged;
- no source file represents more than one place;
- no runtime Commons or network dependency — asserted in-browser;
- no ranking, itinerary, recommendation, grade, routing or planning behaviour changed; no such
  file was touched.

---

## 4. Asset budget

| | bytes | KiB |
|---|---|---|
| twelve new assets | 3,607,446 | 3,523 |
| twenty-four existing | 7,090,836 | 6,925 |
| total (36) | 10,698,282 | 10,448 |

All twelve were re-encoded to WebP at a longest side of 1600px with EXIF/ICC stripped, by the
unchanged pipeline. Four exceed the pipeline's 300 KB soft target because they reached its
quality floor of 60 before getting under it — the same behaviour nine of the original
twenty-four already show. The largest new asset, JP-144 at 476,750 bytes, is above the previous
maximum of 402,386; it is a high-texture forest scene, and no pipeline rule was relaxed for it.

JP-205 is the catalog's first portrait-orientation asset. The gallery frame is `16/10` with
`object-fit: cover`, so the rendered card shows the central band; that band was checked and is
the park corridor with its snow sculptures and crowds, which is the part that matters. It was
kept because the alternatives either buried the festival in a city skyline or showed a
sponsor-branded sports ramp instead.

---

## 5. Validation

Photography validator, Python suite, focused photography/attribution tests, full Vitest, lint,
build, and a Phase 4D browser audit covering an ordinary heritage subject (JP-066), the one
branded subject that passed sourcing (JP-044), and the untouched no-photo fallback for deferred
targets (JP-033, JP-203). The Phase 4C browser audit continues to pass unchanged.

No legal clearance is claimed anywhere. The records carry evidence and constraints only.

---

## 6. Successor boundary

Phase 4D acquires photographs only. It authorizes no gallery, ranking or runtime change, and it
does not start any later phase.
