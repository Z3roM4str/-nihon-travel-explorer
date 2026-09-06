# Phase 4A — Licensed Photography Pipeline & Pilot

## Purpose

Visual Discovery (the `PlaceGallery` component, live since Phase 1) has always been able
to render a real photograph, a lightbox, arrows/dots, and a fallback state — but until
this phase, `app/src/data/place-images.ts`'s registry was intentionally empty, because no
photograph in the dataset had a cleared, checkable license. Every place showed its
editorial `imageBrief` in a gallery placeholder instead of a photo.

This phase makes photography real for a **24-place pilot**, not the full 214-place
dataset: a reproducible pipeline sources one licensed photograph per pilot place from
Wikimedia Commons, records its full provenance, and renders it through the existing
gallery unchanged. Every place outside the pilot still shows its `imageBrief`, exactly as
before.

## The 24 pilot places

Selected deterministically by `scripts/select-photography-pilot.py` from the current
`data/places.json` — see "Selection methodology" below for the rule. Re-running the
script against an unchanged dataset reproduces the same 24 places.

| Hub | Place ID | Category | Name |
|---|---|---|---|
| Tokio | JP-002 | landmark | SHIBUYA SKY |
| Tokio | JP-003 | temple-shrine | Meiji Jingu |
| Tokio | JP-001 | urban-neighborhood | Shibuya Crossing |
| Tokio | JP-010 | nature | Shinjuku Gyoen National Garden |
| Tokio | JP-021 | museum-cultural | Tokyo National Museum |
| Tokio | JP-025 | distinct-experience | Akihabara Electric Town |
| Kioto | JP-089 | landmark | Nijō Castle |
| Kioto | JP-054 | temple-shrine | Kiyomizu-dera |
| Kioto | JP-057 | urban-neighborhood | Gion Shirakawa |
| Kioto | JP-077 | nature | Katsura Imperial Villa |
| Kioto | JP-094 | museum-cultural | Kyoto National Museum |
| Kioto | JP-097 | distinct-experience | Nintendo Museum |
| Osaka | JP-134 | landmark | Hōryū-ji |
| Osaka | JP-129 | temple-shrine | Tōdai-ji |
| Osaka | JP-109 | urban-neighborhood | Shinsekai |
| Osaka | JP-145 | nature | Kumano Nachi Taisha + Nachi Falls |
| Osaka | JP-152 | museum-cultural | Naoshima art island |
| Osaka | JP-125 | distinct-experience | Universal Studios Japan |
| Okinawa | JP-157 | landmark | Shurijo Castle Park |
| Okinawa | JP-162 | temple-shrine | Sefa Utaki |
| Okinawa | JP-196 | urban-neighborhood | Taketomi Island village |
| Okinawa | JP-179 | nature | Yambaru National Park |
| Okinawa | JP-173 | museum-cultural | Okinawa Churaumi Aquarium |
| Okinawa | JP-154 | distinct-experience | First Makishi Public Market |

Hub distribution: exactly 6 places each for Tokio, Kioto, Osaka, Okinawa (the dataset's
other three hubs — Sapporo, Nagoya, Fukuoka — carry only 1–3 places each and are out of
scope for this pilot). Total: 24 places, 24 photographs (one per place — within the
task's ~24–30 target, at the low end because a second image per place would have meant
either doubling the manual licensing research or padding the count with a redundant
second angle of the same place; one well-verified photograph per place seemed the more
honest use of the pilot's scope).

## Selection methodology

`scripts/select-photography-pilot.py` classifies every place into one of six category
buckets from its single dataset `category` field:

- **landmark** — 🏯 Historia y patrimonio or 🌅 Miradores
- **temple-shrine** — ⛩️ Templos y santuarios
- **urban-neighborhood** — 🏙️ Ciudad y barrios
- **nature** — 🌸/🌿 Naturaleza, 🌸 Jardines y paisajes, 🥾 Senderismo/aventura, 🌊 Playa/mar/islas
- **museum-cultural** — 🏛️ Museos, 🎨 Arte, 🏛️ Arquitectura
- **distinct-experience** — everything else (nightlife, anime/pop-culture, gastronomy,
  entertainment, onsen, etc. — the dataset's wide tail)

For each of the 4 target hubs and each of the 6 buckets, the highest-graded place wins
(S > A > B > C > D), ties broken by ascending place id. This is a rule over the dataset,
not a hand-picked list — the manifest documents the exact rule
(`data/visual/photography-pilot.json`'s `selectionMethod` field) so a workbook refresh
would reselect deterministically rather than silently going stale.

## Sources

Every photograph came from **Wikimedia Commons**, the only source this phase treats as
acceptable by default, because individual files expose a machine-checkable license,
uploader/author, and a durable file page for provenance. No image was taken from Google
Images, Google Maps, Instagram, Facebook, Pinterest, X, a travel blog, a tourism board
site, or any other commercial or "official-looking" source — none of those expose a
reusable license the way a Commons file page does, so none were used regardless of how
official they looked.

## Licensing policy

**Accepted license classes**: CC0, Public Domain, CC BY (any version), CC BY-SA (any
version) — see `SUPPORTED_LICENSES` in `scripts/validate-photography.py`, the single
place this list is defined. Every one of the 24 photographs carries one of these; the
validator rejects anything else (e.g. CC BY-NC, CC BY-ND, or no license at all) outright,
and there is no "looks probably fine" tier.

**Rejected source classes** (never used, regardless of image quality or how commonly a
travel guide would use them): Google Images/Maps search results, Instagram, Facebook,
Pinterest, X/Twitter, personal travel blogs, tourism-board or hotel/attraction "official"
websites. An official-looking source is not automatically a licensed one.

**Attribution**: CC BY / CC BY-SA images carry the uploader's name as `credit`, plus
`source: "Wikimedia Commons"`, a `sourceUrl` pointing at the Commons **file page** (not
the raw CDN image URL), and a `licenseUrl`. CC0 images carry no attribution requirement,
but `credit` is still recorded where the uploader is known, as a courtesy rather than an
obligation.

**A note on subject matter vs. photograph license**: two pilot places — Naoshima art
island (JP-152) and Universal Studios Japan (JP-125) — are widely known for
individually-copyrighted contents (site-specific art installations; licensed
characters/branding) that are a separate legal question from the photograph's own
Commons license. For both, the photograph actually used shows architecture/general
signage rather than a close-up of a specific copyrighted artwork or character
(Naoshima: the SANAA-designed ferry terminal building; Universal Studios Japan: the
public entrance plaza and archway) — the same treatment already accepted elsewhere in
this pilot for storefront signage (Akihabara) and a museum's own branding (Nintendo
Museum).

## Derivative / local asset policy

Runtime never hotlinks a third-party host. The flow is:

```
data/visual/photography-metadata.json (approved source metadata, hand-curated)
  → scripts/acquire-photography.py (acquisition script; needs network + Pillow)
  → app/public/images/places/<PLACE_ID>/<slug>.webp (optimized local derivative)
  → app/src/data/place-images.ts (existing gallery contract, unchanged shape)
```

`scripts/acquire-photography.py`:

1. Re-queries the Commons API for the metadata record's declared `originalTitle` and
   confirms the resolved full-resolution URL matches the declared `acquisitionUrl`
   (ignoring Commons's own tracking query params) — a mismatch is a hard failure, never
   a silent substitution of a different file.
2. Downloads a Commons-generated thumbnail no wider than 1600px (Commons's own resizer
   never upscales past the original).
3. Verifies the response actually decodes as an image (Pillow) before trusting it.
4. Re-encodes as WebP, stripping EXIF/ICC metadata, at quality 90 stepping down toward
   60 only as needed to approach a 300 KB target.
5. Writes atomically to `app/public/images/places/<PLACE_ID>/<slug>.webp`.

This script is never run by `npm test` or `scripts/validate-photography.py` — both stay
fully network-free, per the automation boundary. It requires `Pillow`
(`scripts/requirements.txt`), a Python-only, acquisition-time dependency; no npm runtime
dependency was added to the app.

## Optimization

- Format: WebP (browser support matches the rest of this app's baseline; no new asset
  pipeline dependency).
- Longest dimension: ≤ 1600 px, never upscaled past the source image's own resolution.
- Quality: 90 stepped down toward a floor of 60 to approach the 300 KB soft target.
- Metadata stripped (EXIF/ICC) on re-encode.

## Image sizes

24 images, 6,918 KiB (7,090,836 bytes) total.

| | bytes |
|---|---|
| minimum | 145,172 (JP-173, Churaumi Aquarium) |
| median | 287,282 |
| maximum | 402,386 (JP-057, Gion Shirakawa canal) |

10 of the 24 images land above the 300 KB soft target after the quality floor (60) was
reached — mostly high-detail scenes (dense foliage, night neon, crowds) where quality 60
WebP still exceeds 300 KB. The task's own guidance ("aim for ≤300 KB/image when this can
be achieved without visibly degrading the asset") treats this as a soft target, not a
hard ceiling, and the pipeline never pushes quality below 60 to force a smaller file at
the cost of visible degradation.

## Sourcing failures / replacements

None. All 24 places the deterministic selector chose were successfully sourced from
Commons on the first attempt with a clearly compatible license — no place needed a
fallback substitution to a different bucket candidate. (During research, a small number
of *candidate* photographs for a given place were reviewed and rejected in favor of a
better-licensed or better-composed alternative for the *same* place — e.g. preferring a
2007 color photograph over a color-shifted 1977 scan for Katsura Imperial Villa — but no
*place* in the 24-place selection itself had to be swapped for another.)

## Limitations

- This is a 24-place pilot. The remaining 190 places in the dataset still show their
  editorial `imageBrief` in the gallery fallback, exactly as before this phase.
- One photograph per pilot place, not a multi-image carousel — the gallery's arrows,
  dots, and swipe paging exist and are unchanged, but none of the 24 pilot places
  currently has more than one image to page through.
- Photograph dates range from 2007 to 2026; a couple of subjects (Katsura Imperial
  Villa's teahouse pond, Shurijo Castle's Shureimon gate) are img circa their capture
  date, not necessarily what a visitor sees today down to the season or exact renovation
  state — alt text describes only what is visibly in the frame, never an invented
  "current" claim.
- No image was independently re-verified against Commons a second time after
  acquisition; if a photographer later relicenses or deletes a file, the next validator
  run stays green (it checks local files, not live Commons state) until
  `scripts/acquire-photography.py` is re-run.

## Recommendation for Phase 4B

If the pilot's real-photo experience is judged worth expanding: extend
`select-photography-pilot.py`'s deterministic rule (or a variant of it) to more hubs and
more places per hub, budget real research time per photograph (each one here required a
Commons search, a license check, and a visual confirmation — this does not scale by
simply widening a loop), and consider whether a second photograph per already-piloted
place (a genuinely different angle, not a duplicate) is worth the additional per-image
research cost before duplicating this pilot's one-per-place pattern at a larger scale.
