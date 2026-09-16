#!/usr/bin/env python3
"""Prepare Phase 4H photography metadata from the reviewed Commons acquisition plan.

Networked source recheck only. Resolves every pinned Commons File: title, validates the
current license/source identity, and appends metadata records while preserving the
pre-Phase-4H registry byte-for-byte at record level. Does not download final assets.
"""
import argparse
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyPrepare/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4H)"
)
SUPPORTED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}
LICENSE_URLS = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0",
    "CC BY 2.5": "https://creativecommons.org/licenses/by/2.5",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0",
    "CC BY-SA 2.5": "https://creativecommons.org/licenses/by-sa/2.5",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0",
}
ACQUISITION_DATE = "2026-09-15"


def clean_markup(value):
    if not value:
        return ""
    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def ext_value(metadata, key):
    return clean_markup((metadata.get(key) or {}).get("value", ""))


def normalize_license(raw):
    raw = clean_markup(raw)
    raw = raw.replace("Creative Commons ", "CC ")
    raw = raw.replace("Attribution-ShareAlike", "BY-SA")
    raw = raw.replace("Attribution", "BY")
    raw = re.sub(r"\s+", " ", raw).strip()
    if raw in {"CC0", "CC0 1.0"}:
        return "CC0"
    return raw


def strip_query(url):
    return urllib.parse.urlsplit(url)._replace(query="", fragment="").geturl()


def resolve(title):
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|extmetadata|size",
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.load(response)
    pages = data.get("query", {}).get("pages", [])
    if len(pages) != 1 or pages[0].get("missing"):
        raise RuntimeError(f"Commons title is missing or ambiguous: {title!r}")
    page = pages[0]
    infos = page.get("imageinfo") or []
    if len(infos) != 1:
        raise RuntimeError(f"Commons returned no unique imageinfo for {title!r}")
    info = infos[0]
    if not str(info.get("mime", "")).startswith("image/"):
        raise RuntimeError(f"{title!r} is not a still image: {info.get('mime')!r}")
    ext = info.get("extmetadata") or {}
    license_name = normalize_license(
        ext_value(ext, "LicenseShortName") or ext_value(ext, "UsageTerms")
    )
    if license_name not in SUPPORTED_LICENSES:
        raise RuntimeError(
            f"{title!r}: current Commons license {license_name!r} is outside the allowlist"
        )
    artist = ext_value(ext, "Artist")
    if license_name != "CC0" and not artist:
        raise RuntimeError(f"{title!r}: attribution license has no source-backed artist")
    width = info.get("width")
    height = info.get("height")
    if type(width) is not int or width <= 0 or type(height) is not int or height <= 0:
        raise RuntimeError(f"{title!r}: invalid source dimensions {width!r}x{height!r}")
    return {
        "sourceUrl": info["descriptionurl"],
        "credit": artist,
        "license": license_name,
        "licenseUrl": LICENSE_URLS[license_name],
        "acquisitionUrl": strip_query(info["url"]),
        "originalWidth": width,
        "originalHeight": height,
        "processing": (
            "resized-and-webp-reencoded"
            if max(width, height) > 1600
            else "webp-reencoded"
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--plan", default="data/visual/phase4h-acquisition-plan.json"
    )
    parser.add_argument(
        "--metadata", default="data/visual/photography-metadata.json"
    )
    parser.add_argument(
        "--app-metadata", default="app/src/data/photography-metadata.json"
    )
    args = parser.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    metadata_path = Path(args.metadata)
    app_path = Path(args.app_metadata)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    baseline = list(metadata["images"])

    if metadata.get("imageCount") != 58 or len(baseline) != 58:
        raise SystemExit(
            f"Phase 4H exact base requires 58 photography records, found "
            f"imageCount={metadata.get('imageCount')!r}, len={len(baseline)}"
        )

    accepted = plan["accepted"]
    if plan.get("attemptedTargetCount") != 32 or len(accepted) != 27:
        raise SystemExit("Phase 4H acquisition plan cardinality drift")
    if len(plan.get("failedClosed", [])) != 5:
        raise SystemExit("Phase 4H fail-closed cardinality drift")

    baseline_ids = {row["placeId"] for row in baseline}
    baseline_titles = {row["originalTitle"] for row in baseline}
    new_records = []

    for entry in accepted:
        place_id = entry["placeId"]
        title = entry["originalTitle"]
        if place_id in baseline_ids:
            raise SystemExit(f"{place_id}: target already has photography at Phase 4H base")
        if title in baseline_titles:
            raise SystemExit(f"{place_id}: selected Commons source already used by another place")
        resolved = resolve(title)
        record = {
            "placeId": place_id,
            "assetPath": entry["assetPath"],
            "alt": entry["alt"],
            "source": "Wikimedia Commons",
            "sourceUrl": resolved["sourceUrl"],
            "credit": resolved["credit"],
            "license": resolved["license"],
            "licenseUrl": resolved["licenseUrl"],
            "acquisitionUrl": resolved["acquisitionUrl"],
            "acquisitionDate": ACQUISITION_DATE,
            "originalTitle": title,
            "originalWidth": resolved["originalWidth"],
            "originalHeight": resolved["originalHeight"],
            "processing": resolved["processing"],
        }
        new_records.append(record)
        print(
            f"OK {place_id} {title} — {record['license']} — "
            f"{record['originalWidth']}x{record['originalHeight']}"
        )

    if len({row["placeId"] for row in new_records}) != len(new_records):
        raise SystemExit("duplicate Phase 4H placeId in prepared metadata")
    if len({row["originalTitle"] for row in new_records}) != len(new_records):
        raise SystemExit("duplicate Phase 4H Commons title in prepared metadata")

    metadata["images"] = baseline + new_records
    metadata["imageCount"] = len(metadata["images"])
    if metadata["imageCount"] != 85:
        raise SystemExit(f"expected 85 total images after preparation, got {metadata['imageCount']}")

    rendered = json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    metadata_path.write_text(rendered, encoding="utf-8")
    app_path.write_text(rendered, encoding="utf-8")
    print(f"OK: prepared {len(new_records)} Phase 4H records; total={metadata['imageCount']}")


if __name__ == "__main__":
    main()
