# Geographic layer (National Explorer)

Nihon's National Explorer draws Japan from real administrative geometry. This document
records where that geometry comes from, exactly how it was transformed, and what the source
licence requires. Everything here is about the **geographic** layer; the tourism dataset
(`data/source/Nihon-Base-Maestra-v2.xlsx` and the JSON exported from it) is a separate
concern and is not touched by any of it.

## Source

| | |
| --- | --- |
| Publisher | 国土交通省 (Ministry of Land, Infrastructure, Transport and Tourism — MLIT) |
| Service | 国土数値情報ダウンロードサイト (National Land Numerical Information download site) |
| Dataset | 国土数値情報 行政区域データ (N03 — Administrative Area Data) |
| Version | 2026年（令和8年）版 |
| Reference date of the data | 2026-01-01 |
| Dataset page | https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html |
| File downloaded | `https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_GML.zip` (803,201,348 bytes) |
| SHA-256 of the archive | `1f714fca019e22e6f84012dba420384fc7b49c6ad8bd0a867ab1cfb593a78477` |
| Archive last modified | 2026-05-20 |
| Consulted / downloaded on | 2026-09-03 |
| Coordinate reference system | 世界測地系 JGD2011, geographic (lon/lat) |
| Original resolution | 125,130 municipal polygons nationwide |

MLIT's own primary sources for N03 are 国土地理院「数値地図（国土基本情報）」 and
「地理院タイル」, plus 総務省「全国地方公共団体コード一覧」, under
「測量法に基づく国土地理院長承認（複製）R 7JHf 351」.

This is the primary source. Nihon does not use a third-party redistribution of Japanese
boundaries as its source of truth.

## Licence and attribution

The N03 dataset is published as オープンデータ（CC BY 4.0）. The download site's terms
(利用規約, in force from 2026-03-23) apply 公共データ利用規約 第1.0版 (PDL 1.0), which
requires that:

- the source is credited;
- when the content is **edited or processed**, the name of the content used and the fact
  that it was edited/processed are stated in addition to the source credit;
- processed information is **not** presented as if it had been produced by the State.

MLIT also notes that secondary use of this data may require an application to
国土地理院 (Geospatial Information Authority of Japan) in some cases, because N03 derives
from GSI survey results under the Survey Act.

Nihon therefore ships a **derived, simplified** version and says so:

- `docs/GEOGRAPHY.md` (this file) is the full record.
- The National Explorer shows a visible credit next to the map:
  *"Geometría derivada del 国土数値情報 行政区域データ (N03, 2026) del 国土交通省 / MLIT.
  Versión simplificada creada por Nihon; no es un producto oficial de MLIT."*

Source credit, in the format the terms ask for:

> 「国土数値情報（行政区域データ）」（国土交通省）
> https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html をもとに Nihon が加工

## Transformation

The build is reproducible through `scripts/build-geography.sh`, which performs exactly the
steps below. The tooling is **build-time only**: mapshaper is fetched with `npx` and is not
a dependency of `app/package.json`, so nothing extra reaches the production runtime.

1. Download `N03-20260101_GML.zip` from the URL above.
2. Extract the nationwide shapefile (`N03-20260101.shp/.shx/.dbf/.prj/.cpg`, UTF-8).
3. Run mapshaper `0.6.109`:

   ```
   mapshaper \
     -i N03-20260101.shp encoding=utf8 \
     -each 'code = N03_007.substring(0, 2), nameJa = N03_001' \
     -simplify percentage=1% keep-shapes \
     -dissolve2 code copy-fields=nameJa \
     -filter-islands min-area=1km2 \
     -filter-fields code,nameJa \
     -sort 'code' \
     -o app/public/geography/japan-prefectures.geojson format=geojson precision=0.0001 id-field=code
   ```

What each step does and why:

- **`code` derivation.** `N03_007` is the 5-digit 全国地方公共団体コード: two JIS X 0401
  prefecture digits followed by three JIS X 0402 municipality digits. The first two digits
  are the canonical prefecture code, and are the join key used everywhere in the
  application. All 125,130 source features carry a code — none was dropped.
- **Simplification.** Visvalingam simplification at 1% retention, topology-aware
  (`keep-shapes` prevents any polygon collapsing to nothing). Because mapshaper simplifies
  shared arcs identically, neighbouring prefectures keep matching borders and no gaps or
  overlaps appear between them.
- **Dissolve.** `-dissolve2` merges the municipal polygons into one feature per prefecture
  and removes the internal municipal boundaries. 125,130 features → 47 features.
- **Island filter.** Detached rings smaller than 1 km² are dropped. This removes the very
  long tail of rocks and islets while keeping the islands that matter for orientation —
  Okinawa's outer islands, Naoshima, Miyajima, Sado, Awaji, and so on. Okinawa still spans
  122.9°E–131.3°E after the filter, i.e. Yonaguni and the Daitō islands survive.
- **Attribute trim.** Only `code` and `nameJa` (the untouched 都道府県名 from the source)
  are kept; `code` is also written as the GeoJSON feature `id`.
- **Precision.** Coordinates are rounded to 4 decimal places (~11 m), which is far below
  what a national browsing map can show and well above cadastral accuracy — the derived file
  is explicitly *not* suitable for measurement or legal use.

Result:

| | |
| --- | --- |
| Output | `app/public/geography/japan-prefectures.geojson` |
| Features | 47 (one per prefecture) |
| Vertices | 70,392 |
| Size | 1,329,210 bytes (≈357 KB gzipped) |
| Geometry types | `Polygon` / `MultiPolygon` |
| Properties | `code` (2-digit prefecture code), `nameJa` (Japanese prefecture name) |

The file is served as a static asset from Nihon's own origin and fetched asynchronously at
runtime. It is never bundled into the JavaScript, and the application makes no request to
MLIT or to any third-party host while it runs — if those sites are down, the National
Explorer is unaffected.

## Prefecture metadata

`app/src/data/prefectures.json` holds one canonical record per prefecture:

- `code` — JIS X 0401 prefecture code, 2 digits. The join key against the GeoJSON.
- `japaneseName` — 都道府県名 as published by MLIT.
- `displayName` — the name Nihon shows in the interface.
- `region` — the navigation region (below).
- `aliases` — optional, **language/transliteration only**.

Display names follow the editorial Spanish spellings Nihon already uses (`Tokio`, `Kioto`).
Aliases exist so a tourism value written `Tokyo` or `Kyoto` resolves to the same prefecture
without anyone rewriting the editorial dataset. Matching is done on a normalised key
(NFD, diacritics stripped, trimmed, lower-cased), so `Hyogo`/`Hyōgo` and `Kochi`/`Kōchi`
also resolve. Nothing is ever guessed: a value that is not a display name, a Japanese name
or a declared alias fails the check in `scripts/validate-geography.py` rather than being
mapped to something plausible.

## Navigation regions

The interface groups the 47 prefectures into nine regions:

| Region | Prefectures |
| --- | --- |
| Hokkaido | Hokkaido |
| Tohoku | Aomori, Iwate, Miyagi, Akita, Yamagata, Fukushima |
| Kanto | Ibaraki, Tochigi, Gunma, Saitama, Chiba, Tokio, Kanagawa |
| Chubu | Niigata, Toyama, Ishikawa, Fukui, Yamanashi, Nagano, Gifu, Shizuoka, Aichi |
| Kansai | Mie, Shiga, Kioto, Osaka, Hyogo, Nara, Wakayama |
| Chugoku | Tottori, Shimane, Okayama, Hiroshima, Yamaguchi |
| Shikoku | Tokushima, Kagawa, Ehime, Kochi |
| Kyushu | Fukuoka, Saga, Nagasaki, Kumamoto, Oita, Miyazaki, Kagoshima |
| Okinawa | Okinawa |

This is a **product-level navigation taxonomy**, not a new administrative division. It is
the conventional eight-region geography of Japan with Okinawa separated from Kyushu, which
is how a traveller reads the country and how Nihon's own tourism data is already organised.
Two conventions worth stating: Mie is placed in Kansai (it is also commonly counted with
Tōkai/Chūbu), and Okinawa is its own region rather than part of Kyushu.

Every prefecture belongs to exactly one region — no prefecture is unassigned and none
appears twice. `scripts/validate-geography.py` enforces this.

## Geography is not the hub structure

Three things are deliberately kept apart:

- a **hub** is an editorial/travel grouping ("explore this from Osaka");
- a **prefecture** is real administrative geography;
- a **navigation region** is a grouping of prefectures for browsing.

A hub routinely contains places that sit physically in another prefecture, and sometimes in
another region. The dataset already contains such cases — for example the Nagoya hub's place
is physically in Gifu, and the Osaka hub reaches into Kagawa (Shikoku) and Hiroshima
(Chūgoku). The national map therefore places every place by its **prefecture**, while the
button offered for it opens the **hub** it belongs to editorially. Coverage, counts and hub
lists are all derived from the real places at load time; no count is written down anywhere.

## Validation

`python3 scripts/validate-geography.py` checks, from the repository root:

- the GeoJSON parses and is a `FeatureCollection`;
- exactly 47 features, 47 unique 2-digit codes, no feature without geometry;
- every coordinate falls inside a Japan-wide bounding box;
- the metadata has 47 complete, uniquely coded entries;
- every prefecture is assigned to exactly one of the nine navigation regions, and no region
  is empty;
- metadata codes and polygon codes are the same set;
- every `place.prefecture` in `data/places.json` resolves unambiguously;
- no place and no hub is lost in the tourism ↔ geography join.

It contains no hard-coded tourism counts, so refreshing the workbook cannot invalidate it.

## Regenerating

```
scripts/build-geography.sh          # re-downloads and rebuilds the derived GeoJSON
python3 scripts/validate-geography.py
```

If MLIT publishes a newer N03 reference year, update `DATASET_YEAR`/`DATASET_DATE` in the
script, re-run both commands, and update the Source table above (version, reference date,
archive size, checksum, consultation date).
