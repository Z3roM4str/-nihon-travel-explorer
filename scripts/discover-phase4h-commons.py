#!/usr/bin/env python3
"""Phase 4H Commons candidate discovery audit.

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
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4H review)"
)
ALLOWED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
HUB_SEARCH = {
    "Kioto": "Kyoto",
    "Okinawa": "Okinawa",
    "Osaka": "Osaka",
    "Sapporo": "Hokkaido",
    "Tokio": "Tokyo",
}
QUERY_OVERRIDES = {
    "JP-121": ["Expo 70 Commemorative Park Osaka", "Expo 70 Park Osaka", "Tower of the Sun Osaka"],
    "JP-207": ["Lake Shikotsu Ice Festival", "Shikotsu Ice Festival Hokkaido", "支笏湖 氷濤まつり"],
    "JP-008": ["Shibuya PARCO Tokyo", "Nintendo TOKYO Shibuya"],
    "JP-090": ["Kyoto Imperial Palace Kogosho", "Kyoto Gosho", "京都御所"],
    "JP-095": ["teamLab Biovortex Kyoto", "teamLab Kyoto Biovortex"],
    "JP-098": ["Byodoin Phoenix Hall Uji", "Byōdō-in Uji Kyoto"],
    "JP-156": ["Naha Sakaemachi Ichiba", "Sakaemachi Market Naha", "栄町市場 那覇"],
    "JP-151": ["Ine Funaya", "Ine-ura Kyoto", "伊根 舟屋"],
    "JP-159": ["Shuri Kinjocho ishidatami", "Kinjocho ishidatami-michi", "首里金城町石畳道"],
    "JP-079": ["Rakusai Bamboo Park Kyoto", "Kyoto City Rakusai Bamboo Park", "洛西竹林公園"],
    "JP-202": ["Kerama humpback whale", "Zamami whale Okinawa", "Kerama whales Okinawa"],
    "JP-127": ["Jikko Knives Sakai", "Sakai knives Osaka", "堺 刃物"],
    "JP-208": ["Kawazu Shizuoka cherry blossoms", "Kawazu sakura Shizuoka", "河津桜 河津町"],
    "JP-167": ["Koza Music Town Okinawa", "コザミュージックタウン", "Gate 2 Street Okinawa"],
    "JP-026": ["Super Potato Akihabara", "Mandarake Akihabara"],
    "JP-049": ["Otome Road Ikebukuro", "乙女ロード 池袋", "Ikebukuro anime"],
    "JP-181": ["Daisekirinzan Okinawa", "ASMUI Okinawa"],
    "JP-015": ["Kagurazaka Tokyo", "Kagurazaka alley Tokyo", "神楽坂 路地"],
}


def api_get(params, retries=5):
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
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
        "iiurlwidth": "640",
        "cllimit": "30",
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
        "categories": categories,
    }


def download(url, path):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
        content_type = response.headers.get("Content-Type", "")
    if not content_type.startswith("image/"):
        raise RuntimeError(f"non-image response: {content_type}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        default="data/visual/a-grade-photography-batch-ii.json",
    )
    parser.add_argument("--out", default="phase4h-commons-review")
    parser.add_argument("--per-target", type=int, default=8)
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    out = Path(args.out)
    thumbs = out / "thumbs"
    out.mkdir(parents=True, exist_ok=True)

    report = {
        "version": 1,
        "source": "Wikimedia Commons search API",
        "targetCount": len(manifest["places"]),
        "targets": [],
    }

    for index, target in enumerate(manifest["places"], start=1):
        place_id = target["placeId"]
        name = target["name"]
        hub = HUB_SEARCH.get(target["hub"], target["hub"])
        queries = QUERY_OVERRIDES.get(place_id, [f'"{name}"', f"{name} {hub} Japan"])

        found = {}
        errors = []
        for query in queries:
            try:
                for page in search(query):
                    candidate = candidate_from_page(page, query)
                    title = candidate.get("title")
                    if title and title not in found:
                        found[title] = candidate
            except Exception as exc:  # noqa: BLE001
                errors.append({"query": query, "error": str(exc)})

        candidates = list(found.values())
        # Review useful/allowed files first without hiding disallowed evidence.
        candidates.sort(
            key=lambda c: (
                0 if c["licenseAllowed"] else 1,
                0 if c.get("thumbUrl") else 1,
                c.get("title") or "",
            )
        )
        candidates = candidates[: args.per_target]

        for rank, candidate in enumerate(candidates, start=1):
            thumb_url = candidate.get("thumbUrl")
            if not thumb_url:
                continue
            suffix = Path(urllib.parse.urlsplit(thumb_url).path).suffix or ".jpg"
            thumb_path = thumbs / place_id / f"{rank:02d}{suffix}"
            try:
                download(thumb_url, thumb_path)
                candidate["localThumbnail"] = str(thumb_path.relative_to(out))
            except Exception as exc:  # noqa: BLE001
                candidate["thumbnailError"] = str(exc)

        report["targets"].append({
            **target,
            "queries": queries,
            "errors": errors,
            "candidateCount": len(candidates),
            "candidates": candidates,
        })
        print(
            f"[{index:02d}/{len(manifest['places'])}] {place_id} {name}: "
            f"{len(candidates)} review candidates"
        )

    (out / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lines = ["# Phase 4H Commons candidate review", ""]
    for target in report["targets"]:
        lines.append(f"## {target['placeId']} — {target['name']}")
        if target["errors"]:
            lines.append(f"Search errors: {target['errors']}")
        for idx, c in enumerate(target["candidates"], start=1):
            lines.append(
                f"{idx}. {c['title']} — {c['license'] or 'license unknown'} — "
                f"{c['artist'] or 'artist unknown'}"
            )
            lines.append(f"   - source: {c['descriptionUrl']}")
            lines.append(f"   - thumb: {c.get('localThumbnail', 'unavailable')}")
            if c["description"]:
                lines.append(f"   - description: {c['description'][:500]}")
        lines.append("")
    (out / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
