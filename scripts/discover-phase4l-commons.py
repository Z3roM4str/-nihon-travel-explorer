#!/usr/bin/env python3
"""Phase 4L Commons candidate discovery audit.

Read-only against Wikimedia Commons. Produces a review artifact with metadata and
thumbnails; it never changes canonical photography metadata or app assets.

Carries the full 15-ID carried fail-closed set as its own execution artifact and refuses
to run if any of them appears in the authoritative Phase 4K fixture.
"""
import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "data" / "visual" / "phase4k-successor-fixture.json"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyDiscovery/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4L review)"
)
ALLOWED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
# All 15 carried fail-closed IDs as of the Phase 4L base. None may be attempted.
CARRIED_FAILED_CLOSED_IDS = {
    "JP-033", "JP-126", "JP-203", "JP-204",              # Phase 4D
    "JP-050", "JP-195",                                  # Phase 4F
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",    # Phase 4H
    "JP-120", "JP-211", "JP-041", "JP-168",              # Phase 4J
}

QUERIES = {
    "JP-084": ["Shisendo Kyoto", "詩仙堂", "Shisen-do garden Sakyo Kyoto"],
    "JP-190": ["Toriike Miyakojima", "通り池 宮古島", "Toriike ponds Irabu"],
    "JP-149": ["Miho Museum Shigaraki", "ミホミュージアム", "Miho Museum Koka Shiga"],
    "JP-012": ["Kabukicho Shinjuku", "歌舞伎町", "Kabukicho gate Tokyo"],
    "JP-062": ["Eikando Zenrinji Kyoto", "永観堂", "Eikan-do autumn Kyoto"],
    "JP-176": ["Kouri Bridge Okinawa", "古宇利大橋", "Kouri Island Nakijin"],
    "JP-122": ["Minoo Falls Osaka", "箕面大滝", "Minoh waterfall Osaka"],
    "JP-213": ["Tokyo Marathon", "東京マラソン", "Tokyo Marathon runners Shinjuku"],
    "JP-087": ["Hosen-in Ohara Kyoto", "宝泉院", "Hosenin garden Ohara"],
    "JP-200": ["Yonaguni monument", "与那国島海底地形", "Yonaguni Island Okinawa", "Yonaguni underwater"],
    "JP-112": ["Umeda Sky Building", "梅田スカイビル", "Umeda Sky Building floating garden"],
    "JP-053": ["Edo-Tokyo Museum", "江戸東京博物館", "Edo Tokyo Museum Ryogoku building"],
    "JP-064": ["Honen-in Kyoto", "法然院", "Honenin gate moss Kyoto"],
    "JP-158": ["Tamaudun Naha", "玉陵", "Tamaudun royal mausoleum Shuri"],
    "JP-113": ["Grand Green Osaka", "グラングリーン大阪", "Umekita Park Osaka"],
    "JP-007": ["Ota Memorial Museum of Art", "太田記念美術館", "Ota Memorial Museum Harajuku"],
    "JP-063": ["Philosopher's Path Kyoto", "哲学の道", "Tetsugaku no michi Kyoto"],
    "JP-185": ["Furuzamami Beach Zamami", "古座間味ビーチ", "Furuzamami beach Okinawa"],
    "JP-130": ["Nara Park deer", "奈良公園 鹿", "Sika deer Nara Park"],
    "JP-042": ["Odaiba Seaside Park Rainbow Bridge", "お台場海浜公園", "Rainbow Bridge Odaiba Tokyo"],
    "JP-065": ["Ginkakuji Kyoto", "銀閣寺", "Ginkaku-ji silver pavilion"],
    "JP-172": ["Cape Manzamo Okinawa", "万座毛", "Manzamo Onna"],
    "JP-139": ["Nunobiki Falls Kobe", "布引の滝", "Nunobiki Herb Garden Kobe"],
    "JP-051": ["Mount Takao Tokyo", "高尾山", "Takaosan Hachioji"],
    "JP-067": ["Tofukuji Kyoto", "東福寺", "Tofuku-ji Tsutenkyo bridge"],
    "JP-169": ["Zakimi Castle Yomitan", "座喜味城跡", "Zakimi gusuku Okinawa"],
    "JP-114": ["Nakanoshima Osaka", "中之島 大阪", "Nakanoshima park Osaka river"],
    "JP-020": ["Sumida Hokusai Museum", "すみだ北斎美術館", "Sumida Hokusai Museum building"],
    "JP-186": ["Aka Island Zamami", "阿嘉島", "Akajima Okinawa"],
    "JP-140": ["Mount Rokko night view Kobe", "六甲山 夜景", "Rokko Garden Terrace Kobe"],
    "JP-052": ["Mount Mitake Ome", "武蔵御嶽神社", "Mitakesan Tokyo shrine"],
    "JP-017": ["Asakusa Culture Tourist Information Center", "浅草文化観光センター", "Asakusa bunka kanko center"],
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
    return clean_markup((metadata.get(key) or {}).get("value", ""))


def search(query, limit=10):
    data = api_get({
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "search", "gsrnamespace": "6", "gsrsearch": query,
        "gsrlimit": str(limit), "prop": "imageinfo|categories",
        "iiprop": "url|mime|extmetadata|size", "iiurlwidth": "800", "cllimit": "40",
    })
    return data.get("query", {}).get("pages", [])


def normalize_license(raw):
    raw = clean_markup(raw).replace("Creative Commons ", "CC ")
    raw = raw.replace("Attribution-ShareAlike", "BY-SA").replace("Attribution", "BY")
    raw = re.sub(r"\s+", " ", raw).strip()
    return "CC0" if raw in {"CC0 1.0", "CC0"} else raw


def candidate_from_page(page, query):
    info = (page.get("imageinfo") or [{}])[0]
    ext = info.get("extmetadata") or {}
    lic = normalize_license(ext_value(ext, "LicenseShortName") or ext_value(ext, "UsageTerms"))
    return {
        "query": query,
        "title": page.get("title"),
        "descriptionUrl": info.get("descriptionurl"),
        "originalUrl": info.get("url"),
        "thumbUrl": info.get("thumburl") or info.get("url"),
        "mime": info.get("mime"),
        "width": info.get("width"),
        "height": info.get("height"),
        "license": lic,
        "licenseAllowed": lic in ALLOWED_LICENSES,
        "licenseUrl": ext_value(ext, "LicenseUrl"),
        "artist": ext_value(ext, "Artist"),
        "objectName": ext_value(ext, "ObjectName"),
        "description": ext_value(ext, "ImageDescription"),
        "dateTimeOriginal": ext_value(ext, "DateTimeOriginal"),
        "restrictions": ext_value(ext, "Restrictions"),
        "categories": [c.get("title", "").removeprefix("Category:") for c in page.get("categories", [])],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--targets", nargs="*", default=None)
    parser.add_argument("--out", default="phase4l-commons-review")
    parser.add_argument("--per-target", type=int, default=10)
    args = parser.parse_args()

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    target_ids = [p["placeId"] for p in fixture["places"]]
    leaked = sorted(set(target_ids) & CARRIED_FAILED_CLOSED_IDS)
    if leaked:
        raise SystemExit(f"STOP: carried fail-closed ID(s) present in the fixture: {leaked}")
    if len(target_ids) != 32:
        raise SystemExit(f"STOP: fixture holds {len(target_ids)} targets, expected 32")
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

    (out_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nwrote {out_dir/'report.json'}")


if __name__ == "__main__":
    main()
