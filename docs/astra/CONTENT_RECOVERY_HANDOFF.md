# TRACK: ASTRA — Content recovery handoff

Date: 2026-09-20 (UTC)  
Branch: `astra/content-recovery`  
Base: `d24997aa7afa2e2f13079aa0c67d8f51d7414036`  
Final revision: the tip of `astra/content-recovery` containing this handoff (`git rev-parse astra/content-recovery`)

## Recovered scope and result

This is the deliberately bounded replacement for the unavailable `astra/night-content`
delivery. It audits the photographic catalogue on the supplied Astra base, preserves every
place ID, record and asset, and strengthens the existing offline validation contract. It does
not contain or derive from Claude merge `8eb725eeb836ca121180f8dd8b0dc49c65efae25`.
No UI, navigation, itinerary, preference or synchronisation code changed.

The environment could not reach either `commons.wikimedia.org` or
`upload.wikimedia.org`: both HTTPS probes failed at the configured CONNECT tunnel with HTTP
403. Because source pages, licenses and binary downloads could not be independently checked,
**no new photograph or metadata record was added**. Retrying other Commons searches through
the same blocked route would not establish reusable rights and was intentionally avoided.
This is a partial infrastructure-and-audit delivery, not a claim of expanded photography.

## Verified baseline and resulting coverage

The figures were recomputed directly from `data/places.json`,
`data/visual/photography-metadata.json` and the assets under `app/public/images/places`:

| Metric | Before | After |
|---|---:|---:|
| Places | 214 | 214 |
| Registered photographs | 144 | 144 |
| Places with at least one photograph | 144 | 144 |
| Places without a photograph | 70 | 70 |
| Places with exactly one photograph | 144 | 144 |
| Places with 2–3 photographs | 0 | 0 |
| Exact duplicate asset SHA-256 groups | 0 | 0 |

Grade coverage is S 28/32, A 102/147, B 14/25, C 0/6 and D 0/4. The four
uncovered S places and the remaining uncovered A places remain the first acquisition
priority; the existing historical fail-closed sourcing decisions must still be respected.

## Existing runtime contract

`resolvePlaceImages` already appends every registry entry for a place to any embedded images,
and `buildRegistry` preserves metadata order in an array. Therefore the current canonical
manifest supports 2–3 distinct images per place without a parallel catalogue or resolver
change. New assets must be appended to `data/visual/photography-metadata.json`, copied
byte-for-byte to `app/src/data/photography-metadata.json`, and acquired into the declared
`app/public/images/places/<placeId>/...webp` path with
`scripts/acquire-photography.py`.

## Files changed

- `scripts/validate-photography.py`: validates `imageCount` against the registry and hashes
  every present asset with SHA-256, failing when two declared paths contain identical bytes.
  Existing source-identity checks continue to reject reuse of one Commons original across
  places. SHA-256 catches exact duplicate files; it deliberately does not pretend to prove
  that crops or visually similar photographs are distinct.
- `scripts/test_photography.py`: covers count drift and identical binary assets.
- `docs/astra/CONTENT_RECOVERY_HANDOFF.md`: this reproducible audit and continuation record.

## Reproduction

Network check (blocked before acquisition):

```bash
curl --connect-timeout 8 --max-time 15 -sSIL \
  'https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo'
curl --connect-timeout 8 --max-time 15 -sSIL \
  'https://upload.wikimedia.org/wikipedia/commons/b/b0/Shibuya_Scramble_crossing.jpg'
```

Local checks completed:

```bash
python3 scripts/test_photography.py
python3 scripts/validate-photography.py
python3 scripts/validate-dataset.py
(cd app && npm test -- --run)
(cd app && npm run build)
git diff --check
```

The dataset validator passed with 13 pre-existing secondary cluster-metadata warnings. The
build passed with Vite's pre-existing large-chunk warning. All 70 Vitest files / 2,465 tests
passed; all 34 photography validator tests passed.

## Pending acquisition

1. Run from a network that can reach Wikimedia Commons and its upload host.
2. For each candidate, inspect the Commons source page and verify subject identity, author,
   reusable license and a visually distinct viewpoint before creating metadata. Do not infer
   those fields from filenames or search thumbnails.
3. Prioritise uncovered S/A places, then add second and third genuinely distinct views to
   popular/recommended covered places. Preserve metadata order as gallery order.
4. Run `scripts/acquire-photography.py` to re-query each exact `originalTitle`, confirm the
   full-resolution URL, download, decode and WebP-encode the asset.
5. Re-run all checks above and manually review visual distinctness; byte hashing alone cannot
   detect crops of a common original.

## Integration order

This branch is based on the reviewed PR #129 head and is independent of pending PR #131.
Integrate the RouteDialog/#129 line first, then this content-validation branch. Rebase or
reconcile #131 afterward; do not import #131 wholesale and do not treat it as approved.
