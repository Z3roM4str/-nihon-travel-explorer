#!/usr/bin/env python3
"""Phase 4J Commons candidate discovery audit.

Read-only against Wikimedia Commons. Produces a review artifact with metadata and
small thumbnails; it never changes canonical photography metadata or app assets.
"""
import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyDiscovery/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4J review)"
)
ALLOWED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}

# Per-target query sets. English and Japanese forms are both issued because Commons
# recall differs sharply between them for Japanese subjects.
QUERIES = {
    "JP-214": ["Yanagawa canal Fukuoka", "柳川 川下り", "Yanagawa donko boat", "Yanagawa Fukuoka boat"],
    "JP-100": ["Toei Kyoto Studio Park", "太秦映画村", "Uzumasa Eigamura Kyoto", "Toei Uzumasa Eigamura"],
    "JP-163": ["Gangala Valley Okinawa", "ガンガラーの谷", "Valley of Gangala Nanjo", "Gangala no Tani"],
    "JP-123": ["Church of the Light Ibaraki", "光の教会", "Tadao Ando Church of the Light", "Ibaraki Kasugaoka Church"],
    "JP-013": ["Shinjuku Golden Gai", "新宿ゴールデン街", "Golden Gai Tokyo"],
    "JP-073": ["Okochi Sanso Arashiyama", "大河内山荘", "Okochi Sanso garden Kyoto"],
    "JP-183": ["Gesashi Bay mangrove", "慶佐次 ヒルギ林", "Gesashi mangrove Higashi Okinawa", "Gesashi River mangrove"],
    "JP-120": ["teamLab Botanical Garden Osaka", "長居植物園 チームラボ", "Nagai Botanical Garden Osaka"],
    "JP-022": ["Ameyoko Ueno", "アメヤ横丁", "Ameyayokocho Tokyo", "Ameyoko market Taito"],
    "JP-055": ["Sannenzaka Kyoto", "産寧坂", "Ninenzaka Kyoto", "二年坂 京都"],
    "JP-194": ["Banna Park Ishigaki", "バンナ公園", "Banna koen Ishigaki"],
    "JP-211": ["AnimeJapan Tokyo Big Sight", "アニメジャパン", "AnimeJapan convention"],
    "JP-014": ["Omoide Yokocho Shinjuku", "思い出横丁", "Omoide Yokocho Tokyo"],
    "JP-059": ["Kodaiji Kyoto", "高台寺", "Kodai-ji temple Kyoto"],
    "JP-189": ["Irabu Bridge Miyakojima", "伊良部大橋", "Irabuohashi Miyako"],
    "JP-124": ["Osaka Aquarium Kaiyukan", "海遊館", "Kaiyukan Osaka building"],
    "JP-041": ["Unicorn Gundam DiverCity Odaiba", "ユニコーンガンダム立像", "DiverCity Tokyo Plaza Gundam"],
    "JP-078": ["Saihoji Kyoto moss", "西芳寺", "Kokedera Kyoto", "Saiho-ji moss garden"],
    "JP-165": ["Kudaka Island Okinawa", "久高島", "Kudakajima Nanjo"],
    "JP-117": ["Osaka Castle Park", "大阪城公園", "Osaka Castle exterior", "Osakajo tenshukaku"],
    "JP-043": ["SMALL WORLDS TOKYO", "スモールワールズ", "Small Worlds miniature museum Ariake"],
    "JP-060": ["Nanzenji Kyoto", "南禅寺", "Nanzen-ji aqueduct Suirokaku"],
    "JP-168": ["Yachimun no Sato Yomitan", "やちむんの里", "Yomitan pottery village Okinawa"],
    "JP-138": ["Kitano Ijinkan Kobe", "北野異人館", "Kobe Kitano-cho western houses", "Weathercock House Kobe"],
    "JP-006": ["Nezu Museum Tokyo", "根津美術館", "Nezu Museum garden Minato"],
    "JP-081": ["Ryoanji Kyoto", "龍安寺", "Ryoan-ji rock garden"],
    "JP-198": ["Pinaisara Falls Iriomote", "ピナイサーラの滝", "Pinaisara waterfall Taketomi"],
    "JP-105": ["Hozenji Yokocho Osaka", "法善寺横丁", "Hozenji Namba Osaka"],
    "JP-039": ["Toyosu Market Tokyo", "豊洲市場", "Toyosu fish market Koto"],
    "JP-212": ["Grand Sumo Osaka Haru basho", "大相撲 大阪場所", "EDION Arena Osaka sumo", "Osaka Prefectural Gymnasium sumo"],
    "JP-011": ["Tokyo Metropolitan Government Building observatory", "東京都庁 展望室", "Tocho observation deck Shinjuku"],
    "JP-047": ["Edo-Tokyo Open Air Architectural Museum", "江戸東京たてもの園", "Tatemonoen Koganei"],
}


def api_get(params, retries=6):
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt == retries - 1:
                raise
            time.sleep(3 * (attempt + 1))
    raise last


def clean_markup(value):
    if not value:
        return ""
    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def ext_value(metadata, key):
    item = metadata.get(key) or {}
    return clean_markup(item.get("value", ""))


def search(query, limit=12):
    data = api_get({
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": query,
        "gsrlimit": str(limit),
        "prop": "imageinfo|categories",
        "iiprop": "url|mime|extmetadata|size",
        "iiurlwidth": "800",
        "cllimit": "40",
    })
    return data.get("query", {}).get("pages", [])


def normalize_license(raw):
    raw = clean_markup(raw)
    raw = raw.replace("Creative Commons ", "CC ")
    raw = raw.replace("Attribution-ShareAlike", "BY-SA")
    raw = raw.replace("Attribution", "BY")
    raw = re.sub(r"\s+", " ", raw).strip()
    if raw in {"CC0 1.0", "CC0"}:
        return "CC0"
    return raw


def candidate_from_page(page, query):
    info = (page.get("imageinfo") or [{}])[0]
    ext = info.get("extmetadata") or {}
    license_short = normalize_license(
        ext_value(ext, "LicenseShortName") or ext_value(ext, "UsageTerms")
    )
    categories = [
        c.get("title", "").removeprefix("Category:")
        for c in page.get("categories", [])
    ]
    return {
        "query": query,
        "title": page.get("title"),
        "pageId": page.get("pageid"),
        "descriptionUrl": info.get("descriptionurl"),
        "originalUrl": info.get("url"),
        "thumbUrl": info.get("thumburl") or info.get("url"),
        "mime": info.get("mime"),
        "width": info.get("width"),
        "height": info.get("height"),
        "license": license_short,
        "licenseAllowed": license_short in ALLOWED_LICENSES,
        "licenseUrl": ext_value(ext, "LicenseUrl"),
        "artist": ext_value(ext, "Artist"),
        "credit": ext_value(ext, "Credit"),
        "objectName": ext_value(ext, "ObjectName"),
        "description": ext_value(ext, "ImageDescription"),
        "dateTimeOriginal": ext_value(ext, "DateTimeOriginal"),
        "restrictions": ext_value(ext, "Restrictions"),
        "categories": categories,
    }


def download(url, path):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=90) as response:
        body = response.read()
        content_type = response.headers.get("Content-Type", "")
    if not content_type.startswith("image/"):
        raise RuntimeError(f"non-image response: {content_type}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--targets", nargs="*", default=None, help="Subset of place IDs.")
    parser.add_argument("--out", default="phase4j-commons-review")
    parser.add_argument("--per-target", type=int, default=10)
    parser.add_argument("--thumbs", action="store_true", help="Download review thumbnails.")
    args = parser.parse_args()

    fixture = json.loads(
        (Path(__file__).resolve().parents[1] / "data/visual/a-b-photography-batch.json")
        .read_text(encoding="utf-8")
    )
    target_ids = [p["placeId"] for p in fixture["places"]]
    if args.targets:
        target_ids = [t for t in target_ids if t in set(args.targets)]

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {}
    for place_id in target_ids:
        seen = {}
        for query in QUERIES.get(place_id, []):
            try:
                pages = search(query, limit=args.per_target)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {place_id} query {query!r} failed: {exc}")
                continue
            for page in pages:
                cand = candidate_from_page(page, query)
                if not (cand["mime"] or "").startswith("image/"):
                    continue
                seen.setdefault(cand["title"], cand)
            time.sleep(1.0)
        allowed = [c for c in seen.values() if c["licenseAllowed"]]
        report[place_id] = sorted(allowed, key=lambda c: -(c["width"] or 0))
        print(f"{place_id}: {len(seen)} files seen, {len(allowed)} license-allowed")
        if args.thumbs:
            for idx, cand in enumerate(report[place_id][:6]):
                ext = ".jpg"
                try:
                    download(cand["thumbUrl"], out_dir / place_id / f"{idx:02d}{ext}")
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! thumb failed {cand['title']}: {exc}")

    (out_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nwrote {out_dir/'report.json'}")


if __name__ == "__main__":
    main()
