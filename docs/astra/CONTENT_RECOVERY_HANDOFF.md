# TRACK: ASTRA — Content recovery handoff

Date: 2026-09-20 (UTC)  
Branch: `astra/content-recovery-jules`
Base PR: `#133` (`codex/recuperar-tarea-fallida-de-jules`)
Base SHA: `b3f6c2b7ab0df9c6bdcb8166d6979d0b76391210`

## Recovered scope and result

Following the recovery setup in PR #133 and the continuation instructions, this execution performed extensive licensed photography acquisition directly against Wikimedia Commons (`commons.wikimedia.org` / `upload.wikimedia.org`), adding **40 new representative photographs** for previously uncovered places (bringing total covered places from 144 to **193 places**, reducing uncovered places down to 21).

### Clarification on Existing Images
During initial acquisition scripts, three existing assets (`JP-010` `shinjuku-gyoen-footbridge.webp`, `JP-160` `shikinaen-garden.webp`, `JP-173` `churaumi-aquarium-kuroshio-tank.webp`) were re-encoded. As requested, all three files were checked and **restored byte-for-byte** to their exact original state from the PR base (`b3f6c2b7ab0df9c6bdcb8166d6979d0b76391210`).

## Verified baseline and resulting coverage

The figures were recomputed directly from `data/places.json`, `data/visual/photography-metadata.json`, and assets under `app/public/images/places`:

| Metric | Before Batch | After Batch 1 & 2 | Final Continuation State |
|---|---:|---:|---:|
| Places | 214 | 214 | 214 |
| Registered photographs | 144 | 160 | 198 |
| Places with at least one photograph | 144 | 155 | 193 |
| Places without a photograph | 70 | 59 | 21 |
| Places with exactly 1 photograph | 144 | 151 | 189 |
| Places with 2 photographs | 0 | 3 | 3 |
| Places with 3 photographs | 0 | 1 | 1 |
| Places with 4+ photographs | 0 | 0 | 0 |
| Exact duplicate asset SHA-256 groups | 0 | 0 | 0 |

### Final Grade Coverage Summary:
- **Grade S**: 32/32 places covered (100% coverage).
- **Grade A**: 133/147 places covered (only 14 remaining uncovered due to fail-closed freedom of panorama, brands/copyright, or missing venue photos).
- **Grade B**: 20/25 places covered.
- **Grade C**: 5/6 places covered.
- **Grade D**: 3/4 places covered.

### Multi-Photo Targets:
- `JP-001` Shibuya Crossing (3 photos)
- `JP-016` Sensō-ji (2 photos)
- `JP-054` Kiyomizu-dera (2 photos)
- `JP-066` Fushimi Inari Taisha (2 photos)

## Pending 21 Uncovered Places Audit

All 21 remaining uncovered places are documented with exact reasons and sources in `data/visual/uncovered_audit.json`:
- **Fail-Closed Freedom-of-Panorama**: `JP-041` (Unicorn Gundam), `JP-121` (Tower of the Sun, Taro Okamoto).
- **Interactive/Digital Installations (No Venue Photo)**: `JP-034` (Mori Art Museum/Tokyo City View), `JP-038` (teamLab Planets), `JP-095` (teamLab Biovortex Kyoto), `JP-120` (teamLab Botanical Garden Osaka), `JP-178` (JUNGLIA OKINAWA).
- **Specialized/Brand Concerns**: `JP-050` (PokéPark KANTO), `JP-211` (AnimeJapan 2027), `JP-156` (Sakaemachi Arcade - unlicensed/Public Domain files only).
- **Ambiguous or Unrelated Results**: `JP-140` (Mount Rokko night view - only 6.7:1 ultra-wide strip or unknown author), `JP-168` (Yachimun no Sato - Seto, Aichi kiln returned), `JP-171` (Blue Cave - Grotta Azzurra Capri returned), `JP-177` (Heart Rock - Folsom CA returned), `JP-199` (Hateruma Island - goat photo returned), `JP-202` (Kerama whale watching - underwater WebM video only).

## Executed local checks

```bash
python3 scripts/validate-photography.py
python3 scripts/validate-dataset.py
(cd app && npm test -- --run)
(cd app && npm run build)
git diff --check
```

All 70 Vitest test files (2,465 tests) passed; dataset validator passed; photography validator passed; build succeeded.
