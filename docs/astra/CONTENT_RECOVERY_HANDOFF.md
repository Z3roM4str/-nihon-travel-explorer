# TRACK: ASTRA — Content recovery handoff

Date: 2026-09-20 (UTC)  
Branch: `astra/content-recovery-jules`
Base PR: `#133` (`codex/recuperar-tarea-fallida-de-jules`)
Base SHA: `b3f6c2b7ab0df9c6bdcb8166d6979d0b76391210`

## Recovered scope and result

Following the recovery setup in PR #133, this execution performed the licensed photography acquisition pipeline directly against Wikimedia Commons (`commons.wikimedia.org` / `upload.wikimedia.org`), successfully adding 16 new representative photographs for 11 previously uncovered S/A places and establishing 2–3 distinct views for popular targets.

## Verified baseline and resulting coverage

The figures were recomputed directly from `data/places.json`, `data/visual/photography-metadata.json`, and assets under `app/public/images/places`:

| Metric | Before | After |
|---|---:|---:|
| Places | 214 | 214 |
| Registered photographs | 144 | 160 |
| Places with at least one photograph | 144 | 155 |
| Places without a photograph | 70 | 59 |
| Places with exactly one photograph | 144 | 151 |
| Places with 2–3 photographs | 0 | 4 |
| Exact duplicate asset SHA-256 groups | 0 | 0 |

### Grade coverage summary:
- **Grade S**: 32/32 places covered (100% coverage; recovered JP-033 teamLab Borderless, JP-126 SUPER NINTENDO WORLD, JP-203 Tokyo Disneyland, JP-204 Tokyo DisneySea).
- **Grade A**: 109/147 places covered (+7 new places: JP-023, JP-024, JP-027, JP-030, JP-031, JP-069, JP-076).
- **Multi-photo places**: JP-001 Shibuya Crossing (3 photos), JP-016 Sensō-ji (2 photos), JP-054 Kiyomizu-dera (2 photos), JP-066 Fushimi Inari Taisha (2 photos).

## Verified assets and provenance

All acquired assets meet the strict Phase 4 contract:
- Sourced from Wikimedia Commons under supported CC0 / CC BY / CC BY-SA licenses.
- Downloaded and WebP-encoded via `scripts/acquire-photography.py`.
- Tested and validated offline for byte-uniqueness (SHA-256), correct dimensions, valid alt text, and accurate attribution URLs.

## Executed local checks

```bash
python3 scripts/validate-photography.py
python3 scripts/validate-dataset.py
(cd app && npm test -- --run)
(cd app && npm run build)
git diff --check
```

All 70 Vitest test suites (2,465 tests) passed; dataset validator passed; photography validator passed.
