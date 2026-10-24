# Phase 4B — Photography Attribution Compliance & Scale-Up Design Gate

Status: **design gate only — no runtime/data/test/UI/image implementation in this phase**

Base: `7ddfd6a0e7f9a2c0743f43e2a5e122571f9d1139` (`main` after Phase 4A / PR #26)

Design handoff: Issue #93

Official reuse-source recheck: **2026-09-14 (America/Mexico_City)**

---

## 1. Question this gate answers

Phase 4A proved that Nihon can acquire, locally host, validate and render licensed photography. It did
**not** prove that the visible runtime attribution carries every field the acquired license may
require, nor that scaling from 24 to 214 photographs should happen in one operation.

This gate separates those questions:

1. **attribution compliance** — whether the current runtime faithfully exposes the metadata Phase 4A
   already records;
2. **scale strategy** — how to expand photography only after the attribution surface is correct.

The design intentionally refuses to use "more photography" as a reason to weaken licensing,
provenance, subject-matter review or local-hosting boundaries.

---

## 2. Current Phase 4A state

Dataset and pilot facts at the exact base:

- total places: **214**;
- places with a local licensed photograph: **24**;
- places still using `imageBrief` fallback: **190**;
- current first-photo coverage: **11.2%**;
- pilot asset footprint: **7,090,836 bytes**;
- pilot median image size: **287,282 bytes**;
- every pilot place has exactly one image;
- no pilot place has a second image.

Current uncovered places by hub:

| hub | total | covered | uncovered |
|---|---:|---:|---:|
| Tokio | 57 | 6 | 51 |
| Kioto | 49 | 6 | 43 |
| Osaka | 53 | 6 | 47 |
| Okinawa | 50 | 6 | 44 |
| Sapporo | 3 | 0 | 3 |
| Nagoya | 1 | 0 | 1 |
| Fukuoka | 1 | 0 | 1 |

The current pilot footprint extrapolates to roughly **54.6–56.1 MB of additional assets** to give
one photograph to the remaining 190 places. That is not itself prohibitive, but it makes a one-shot
190-place acquisition a large review surface: every image still requires subject matching, license
verification, attribution review and visual confirmation.

### 2.1 Existing metadata is richer than the runtime shape

`data/visual/photography-metadata.json` already records, for all 24 images:

- `sourceUrl`;
- `credit`;
- `license`;
- `licenseUrl`;
- `originalTitle`;
- acquisition URL/date;
- original dimensions.

All 24 current records have both `licenseUrl` and `originalTitle`.

But `app/src/data/place-images.ts` narrows each metadata record to:

```text
url
alt
credit
source
sourceUrl
license
```

and `PlaceImage` has no `licenseUrl`, source/work title or modification-disclosure field.

The visible `PlaceGallery` attribution currently renders:

- the source name linked to the Commons file page;
- the credit;
- the textual license identifier.

It does **not** render a license link, the recorded original file/work title, or any notice that the
served file has been processed by Nihon.

### 2.2 The acquisition pipeline changes the delivered file

`scripts/acquire-photography.py`:

- obtains a Commons thumbnail;
- may resize it to a maximum dimension of 1600 px;
- converts it to RGB where needed;
- re-encodes it as WebP;
- changes quality as necessary;
- strips EXIF/ICC metadata.

This gate does not make a legal classification of whether any particular processing step creates a
copyright-law derivative work. It does establish a simpler product fact: **the bytes Nihon serves are
not necessarily the original uploaded file**, and that fact can be disclosed truthfully without
making a legal conclusion.

---

## 3. Official reuse guidance recheck

Primary guidance consulted on 2026-09-14:

- Wikimedia Commons reuse guide:
  https://commons.wikimedia.org/wiki/Commons:First_steps/Reuse
- Wikimedia Commons reuse licensing guide:
  https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses
- Wikimedia Commons technical reuse guidance:
  https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical
- Creative Commons CC BY 4.0 deed/legal code:
  https://creativecommons.org/licenses/by/4.0/
  https://creativecommons.org/licenses/by/4.0/legalcode
- Creative Commons CC BY-SA 4.0 legal code:
  https://creativecommons.org/licenses/by-sa/4.0/legalcode
- Creative Commons CC BY 2.0 legal code:
  https://creativecommons.org/licenses/by/2.0/legalcode.en
- Creative Commons CC BY-SA 2.5 legal code:
  https://creativecommons.org/licenses/by-sa/2.5/legalcode.en

The relevant product-level conclusions are intentionally narrow:

1. Commons says individual file-license conditions must be checked; Commons does not guarantee every
   file's licensing metadata.
2. Commons recommends downloading files for reuse rather than relying on hotlinking; Phase 4A's
   local-asset architecture is therefore directionally sound.
3. CC BY / CC BY-SA 4.0 require appropriate credit, a link/URI to the license, and indication of
   modifications when applicable.
4. Older CC 2.x licenses in the current catalog require author credit and, when supplied, the work
   title and relevant URI; their exact wording differs from 4.0.
5. Non-copyright restrictions can exist independently of the copyright license.

This document is an engineering compliance design, not legal advice. When a source file carries
additional attribution instructions or non-copyright warnings, the per-file review remains
authoritative.

---

## 4. Attribution audit

### 4.1 Does every runtime image expose all attribution metadata already stored?

**No.**

The source-of-truth metadata contains `licenseUrl` and `originalTitle`; the runtime shape drops
both.

This is not a request for new external data. It is a parity defect between already-committed metadata
and its user-visible adapter.

### 4.2 Is the current visible license disclosure sufficient to scale?

**Not safely.**

The current UI prints e.g. `CC BY 4.0` as text but cannot link to the recorded license URL because
that value never reaches `PlaceImage`.

At least the current 4.0-licensed records should have the recorded license URI available to the
presentation. Scaling to 190 more images before repairing that adapter would multiply the same gap.

### 4.3 Commons file title is not automatically the licensor-supplied work title

The current metadata records `originalTitle`, which is the Commons file title used by the API.
Older CC licenses in the pilot have title-related attribution language when a title is supplied.

Those two propositions must not be conflated. A filename such as `File:...` is useful provenance,
but this gate does **not** treat it as proof that the licensor supplied that string as the work's
attribution title.

Phase 4C must therefore re-open the 24 current Commons file pages / current file metadata and record
any source-supplied title or other attribution instruction separately if one exists. If none is
supplied, it must not invent one.

`originalTitle` should still survive the adapter as source-file provenance, but it is not itself a
legal-compliance shortcut.

### 4.4 Processing disclosure

The safest neutral product copy is factual rather than legal:

```text
Archivo optimizado por Nihon: redimensionado y convertido a WebP.
```

This says what the pipeline did. It does not say "derivative work", does not characterize copyright
status, and does not claim that every source image was resized if no resize occurred.

Because resize is conditional, the successor should derive the exact note from acquisition metadata
or record a closed processing description rather than falsely saying every asset was resized.

Minimum truthful vocabulary:

- `webp-reencoded`;
- `resized-and-webp-reencoded`.

EXIF/ICC stripping may remain an acquisition implementation detail unless a source/license requires a
specific notice; it must not be represented as removal of copyright attribution because attribution
is preserved structurally outside the binary file.

### 4.5 Validator gap

The Phase 4A validator correctly checks metadata completeness and app/source JSON parity. It does not
prove that all required attribution fields survive the TypeScript adapter and reach visible
presentation.

The successor needs focused tests for this metadata -> registry -> UI chain.

---

## 5. Decision — corrective before scale

**Phase 4B outcome: attribution corrective required before any new photography is authorized.**

The 24 current assets remain valid inputs to the pipeline; this gate does not order their removal.
The finding is about the presentation adapter, not a finding that the underlying Commons licenses are
invalid.

No Phase 4B code or asset change is authorized.

A bounded corrective successor is authorized as **Phase 4C — Photography Attribution Completeness
Corrective**.

No new photograph may be added in Phase 4C. Phase 4C may recheck and enrich attribution metadata for
the existing 24 records only; it may not replace their image bytes unless a new gate explicitly
finds a current asset unusable.

---

## 6. Phase 4C successor contract

Phase 4C may change only the attribution path necessary to make source-backed provenance complete
for the existing 24 assets. It includes a one-time official Commons recheck of those 24 file pages
before code changes.

### 6.1 Runtime shape

Extend `PlaceImage` with optional, attribution-only fields sufficient to carry:

- the recorded license URL;
- the Commons source-file title;
- any separately source-backed attribution title/instruction found by the Phase 4C recheck;
- a closed processing disclosure produced by the acquisition path.

Names are implementation details, but the values must remain factual and source/metadata-backed.

No field may encode:

- visual ranking;
- recommendation;
- popularity;
- freshness score;
- image quality score;
- legal approval;
- rights-clearance boolean;
- user preference.

### 6.2 Existing-24 metadata recheck and registry adapter

Before changing presentation, Phase 4C must recheck all 24 current Commons file pages using current
first-party metadata. For each existing image it must confirm the current creator/credit, license and
license URL and determine whether the source supplies an attribution title or other specific
attribution instruction.

The recheck may enrich `data/visual/photography-metadata.json` and its app copy with narrowly
source-backed attribution fields. It must not invent fields from filenames or page locale.

`app/src/data/place-images.ts` must stop dropping `licenseUrl` and `originalTitle`, and must carry
any newly source-backed attribution field needed by the visible line.

For Phase 4A registry images, it may attach a processing disclosure only when the acquisition
artifact proves that processing mode.

No remote lookup at runtime.

### 6.3 Presentation

The existing compact attribution line remains the owner.

It must expose, without a new panel/modal:

- source/file-page link;
- creator credit when required/recorded;
- Commons source-file title as provenance;
- separately source-backed attribution title/instruction when present;
- license name linked to the recorded `licenseUrl`;
- neutral processing disclosure when present.

No legal badge such as "safe", "cleared", "verified", "compliant" or "approved".

### 6.4 Validation/tests

The successor must prove:

1. all 24 metadata records still parse;
2. root/app metadata parity remains byte-equivalent;
3. every record with a recorded `licenseUrl` renders the license as a link, including CC0 when its
   URL is present;
4. CC0 remains renderable without invented creator credit;
5. `originalTitle` survives metadata -> registry -> presentation as source-file provenance;
6. any attribution title/instruction shown is backed by the Phase 4C source recheck, not inferred
   from `originalTitle`;
7. processing disclosure is factual and closed-vocabulary;
8. a missing optional attribution field fails neutral, never invents text;
9. non-pilot places still render the existing fallback;
10. the 24 image blobs remain byte-unchanged;
11. no new photograph or remote runtime request appears.

### 6.5 Acquisition validator

The Python validator may be tightened only where necessary to keep runtime attribution inputs
complete. It must not broaden the license allowlist.

---

## 7. Scale strategy after Phase 4C

Once Phase 4C is merged and exact-head validated, photography should expand in **bounded batches**,
not all 190 at once.

### 7.1 First image before second image

A second photograph for the existing 24 is deferred.

Reason:

- 190 places still have zero photography;
- the current carousel capability does not create value by itself;
- first-photo coverage reduces a binary content gap;
- second-photo coverage improves an already-functional place.

Until first-photo coverage is materially broader, the marginal value of a first photograph is higher.

### 7.2 First acquisition batch

The first post-corrective acquisition batch should target the **16 currently uncovered S-grade
places**, one image each:

| place | hub |
|---|---|
| JP-033 teamLab Borderless | Tokio |
| JP-044 Ghibli Museum, Mitaka | Tokio |
| JP-066 Fushimi Inari Taisha | Kioto |
| JP-096 Sanjūsangen-dō | Kioto |
| JP-126 SUPER NINTENDO WORLD | Osaka |
| JP-135 Himeji Castle | Osaka |
| JP-142 Kinosaki Onsen | Osaka |
| JP-143 Koyasan temple stay | Osaka |
| JP-144 Okunoin Cemetery | Osaka |
| JP-184 Zamami Island | Okinawa |
| JP-188 Yonaha Maehama Beach | Okinawa |
| JP-192 Kabira Bay | Okinawa |
| JP-197 Iriomote mangrove and jungle expedition | Okinawa |
| JP-203 Tokyo Disneyland | Tokio |
| JP-204 Tokyo DisneySea | Tokio |
| JP-205 Sapporo Snow Festival | Sapporo |

This is an **acquisition-order rule only**. It does not alter the product's place grade, sorting,
recommendations or itinerary behavior.

The list is deterministic from the current dataset and current 24-place coverage.

### 7.3 High-risk subjects remain fail-closed

Several S-grade targets contain branded entertainment, copyrighted installations/characters or
event-specific imagery.

The acquisition phase must not substitute a questionable close-up merely to satisfy coverage.
Architecture, public exterior/signage or another accurately representative image may be used only
when the individual file's license and subject matter are acceptable.

If no suitable file is found, that place remains on `imageBrief`; **no different place is silently
substituted**.

### 7.4 Expected footprint

Using the Phase 4A average asset size, 16 additional images would add roughly **4.7 MB**, taking
coverage from 24/214 (11.2%) to at most 40/214 (18.7%).

This is small enough to review as one acquisition batch while still exercising hard branded and
event subjects before attempting the 155 remaining S/A uncovered places.

### 7.5 Later batches

After the S-grade batch, a later gate may decide how to order A/B/C/D coverage.

Do not encode "highest grade gets a photo" into runtime. Grade is only a deterministic acquisition
queue for repository content work.

---

## 8. Relicensing/source drift

The app remains offline/local at runtime.

Live Commons rechecks belong to acquisition/maintenance tooling, not rendering.

A future maintenance command may re-verify metadata against Commons and report:

- source missing;
- license token changed;
- creator/title metadata changed;
- acquisition URL changed.

It must **report** drift rather than silently replace, delete or rewrite an image.

Automatic runtime calls to Commons remain forbidden.

---

## 9. Explicitly not authorized

Phase 4B does not authorize:

- new image downloads;
- additional image records;
- second images;
- runtime Commons/API calls;
- new remote image provider;
- broader license classes;
- NC/ND/fair-use material;
- automatic visual matching;
- AI-generated place substitutes;
- ranking/recommendation changes;
- itinerary/planning changes;
- user uploads;
- image moderation workflow;
- accounts, secrets or API keys.

Phase 4C is corrective attribution work only.

The 16-image S-grade batch requires its own later acquisition phase after 4C closes.

---

## 10. Hostile review

| challenge | outcome |
|---|---|
| "The license name is already visible" | Insufficient as a scaling argument; the recorded license URI is dropped before UI |
| "The Commons file page link is enough" | It is useful provenance, but it is not the same field as the recorded license URI |
| "Just add licenseUrl" | Too narrow: older-license title requirements and processing disclosure also need audit |
| "Re-encoding is definitely a derivative" | Not asserted; the product only needs to disclose factual processing |
| "Remove the current 24 immediately" | Not justified by this gate; fix the attribution adapter before expansion |
| "Source all remaining 190 now" | Rejected: large manual/legal/visual review surface and ~55 MB additional assets |
| "Add second images to prove carousel" | Rejected while 190 places have zero first image |
| "Use grade in the UI" | Rejected; grade is only an acquisition-order input |
| "Skip branded S-grade places" | No silent substitution; fail closed per place |
| "Hotlink Commons to avoid repository growth" | Rejected; local hosting is retained |
| "Recheck Commons on every app render" | Rejected; network-free runtime remains invariant |
| "Broaden licenses to find more images" | Rejected; coverage never weakens the allowlist |

---

## 11. Normative contracts

1. Phase 4B is docs-only.
2. Phase 4A remains a 24-image pilot.
3. Current coverage is 24/214; 190 places remain without photography.
4. The source metadata contains attribution fields the runtime currently drops.
5. `licenseUrl` must reach presentation before photography scales.
6. Recorded source/work title must no longer be discarded.
7. Processing disclosure must be factual and must not make a legal classification.
8. No new photograph is authorized before the attribution corrective.
9. Phase 4C is the only executable successor authorized by this gate.
10. Phase 4C rechecks current attribution for the existing 24 records and may enrich their metadata.
11. Phase 4C adds zero images and changes zero image blobs.
12. Runtime remains local/offline for photography.
13. The existing license allowlist is not widened.
14. A later acquisition phase may target at most the 16 uncovered S-grade places, one image each.
15. Failure to find a suitable image leaves the place on `imageBrief`.
16. No silent place substitution is permitted.
17. Second photographs remain deferred.
18. No acquisition priority becomes product ranking or recommendation.
19. Relicensing/source drift is checked by tooling, not runtime.
20. Drift is reported fail-closed, never silently normalized.
21. Phase 4D acquisition work is not started by this design.

---

## 12. Successors

### Authorized next implementation

**Phase 4C — Photography Attribution Completeness Corrective**

Recheck the current Commons attribution requirements for the existing 24 records, then correct the
metadata -> registry -> visible-attribution chain for those 24 images only.

### Conditionally bounded later acquisition

After Phase 4C is merged and validated, a later phase may acquire **up to one image for each of the
16 currently uncovered S-grade places** under the same local-hosting, Commons, license and manual
visual-review rules.

That acquisition is not part of Phase 4B and is not started here.
