# TRACK: ASTRA — Content recovery handoff

Date: 2026-09-20 (UTC)  
Branch: `astra/content-recovery-jules`
Base PR: `#133` (`codex/recuperar-tarea-fallida-de-jules`)
Base SHA: `b3f6c2b7ab0df9c6bdcb8166d6979d0b76391210`

## Recovered scope and result

This delivery completes a major licensed photography expansion for Nihon Travel Explorer directly against Wikimedia Commons (`commons.wikimedia.org` / `upload.wikimedia.org`), adding **61 new representative photographs** for previously uncovered locations and establishing multi-photo galleries for popular targets.

### Existing Asset Preservation
Three existing binary assets (`JP-010` `shinjuku-gyoen-footbridge.webp`, `JP-160` `shikinaen-garden.webp`, `JP-173` `churaumi-aquarium-kuroshio-tank.webp`) were re-verified and **restored byte-for-byte** to their exact state from the PR base (`b3f6c2b7ab0df9c6bdcb8166d6979d0b76391210`).

## Verified baseline and resulting coverage

The figures were recomputed directly from `data/places.json`, `data/visual/photography-metadata.json`, and assets under `app/public/images/places`:

| Metric | PR #133 Baseline | Batch 1 & 2 State | Final HEAD State |
|---|---:|---:|---:|
| Places | 214 | 214 | 214 |
| Registered photographs | 144 | 160 | 205 |
| Places with at least one photograph | 144 | 155 | 196 |
| Places without a photograph | 70 | 59 | 18 |
| Places with exactly 1 photograph | 144 | 151 | 188 |
| Places with 2 photographs | 0 | 3 | 7 |
| Places with 3 photographs | 0 | 1 | 1 |
| Places with 4+ photographs | 0 | 0 | 0 |
| Exact duplicate asset SHA-256 groups | 0 | 0 | 0 |

### Final Grade Coverage Summary:
- **Grade S**: 32/32 places covered (**100% coverage**).
- **Grade A**: 134/147 places covered (only 13 remaining uncovered).
- **Grade B**: 22/25 places covered.
- **Grade C**: 5/6 places covered.
- **Grade D**: 3/4 places covered.

### Places with Multi-Photo Galleries (8 places):
- `JP-001` Shibuya Crossing (3 photos)
- `JP-016` Sensō-ji (2 photos)
- `JP-025` Akihabara Electric Town (2 photos)
- `JP-030` Tokyo Station Marunouchi Building (2 photos)
- `JP-054` Kiyomizu-dera (2 photos)
- `JP-066` Fushimi Inari Taisha (2 photos)
- `JP-129` Tōdai-ji (2 photos)
- `JP-135` Himeji Castle (2 photos)

## Pending 18 Uncovered Places Audit

All 18 remaining uncovered places are documented with structured reasons and direct Commons sources in `data/visual/uncovered_audit.json`:
- **Fail-Closed Freedom-of-Panorama**: `JP-041` (Unicorn Gundam statue), `JP-121` (Tower of the Sun by Taro Okamoto).
- **Interactive/Digital Art Venues (No Factual Venue Photo)**: `JP-034` (Mori Art Museum/Tokyo City View - CC BY-NC only), `JP-038` (teamLab Planets), `JP-095` (teamLab Biovortex Kyoto), `JP-120` (teamLab Botanical Garden Osaka - Nagai daytime park photos only), `JP-178` (JUNGLIA OKINAWA).
- **Specialized / Brand Constraints**: `JP-050` (PokéPark KANTO), `JP-211` (AnimeJapan 2027), `JP-156` (Sakaemachi Arcade - unlicensed/Public Domain files only).
- **Ambiguous or Unrelated Search Hits**: `JP-079` (Kyoto Rakusai Bamboo Park - archival ruler documents only), `JP-140` (Mount Rokko night view - only 6.7:1 ultra-wide strip or unknown author), `JP-147` (Enryaku-ji - unapproved licenses), `JP-168` (Yachimun no Sato - Aichi kiln returned), `JP-171` (Blue Cave - Capri, Italy returned), `JP-177` (Heart Rock - Folsom CA returned), `JP-195` (Yaeyama stargazing), `JP-202` (Kerama whale watching - underwater WebM video only).

## Verification of the 7 Recently Acquired Images
- `JP-045` (`kichijoji-inokashira-park.webp`): `File:Inokashira park pond 2024.jpg` | CC BY-SA 4.0 | ARandomName123
- `JP-166` (`mihama-american-village.webp`): `File:Mihama AV D Japan.jpg` | CC BY-SA 3.0 | Amoriver Information
- `JP-199` (`hateruma-island.webp`): `File:2015-12-18 Pemuchi-Beach,Hateruma,Okinawa 波照間島ぺムチ浜 DSCF3518.jpg` | CC BY-SA 4.0 | 松岡明芳
- `JP-025` (`akihabara-electric-town-view-2.webp`): `File:Electric Town Akihabara, Tokyo.jpg` | CC BY-SA 2.0 | Marcus Herzog
- `JP-030` (`tokyo-station-marunouchi-building-view-2.webp`): `File:Tokyo Station Marunouchi Building Night view1 201912.jpg` | CC BY 4.0 | Wpcpey
- `JP-129` (`todai-ji-view-2.webp`): `File:Tōdai-ji Daibutsuden, June 2019.jpg` | CC BY-SA 4.0 | Cun Cun
- `JP-135` (`himeji-castle-view-2.webp`): `File:Himeji Castle with cherry blossoms from front.jpg` | CC BY-SA 4.0 | Seattleite7

All 7 images were verified for visual clarity, correct attribution URLs, valid open licenses, and matching metadata.

## Executed local checks

```bash
python3 scripts/validate-photography.py
python3 scripts/validate-dataset.py
(cd app && npm test -- --run)
(cd app && npm run build)
git diff --check
```

All 70 Vitest test files (2,465 tests) passed; dataset validator passed; photography validator passed; Vite build succeeded.
