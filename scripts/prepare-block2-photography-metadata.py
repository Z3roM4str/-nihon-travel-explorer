#!/usr/bin/env python3
"""Block 2 — turn accepted Commons candidates into registry records.

Usage:
    python3 scripts/prepare-block2-photography-metadata.py PLAN.json > records.json

The plan is a list of `{placeId, slug, title, alt}`. Everything else in the record —
licence, licence URL, credit, full-resolution acquisition URL, original pixel dimensions and
the `processing` value — is read from the Commons API at preparation time rather than typed
by hand, because every one of those is a field `scripts/validate-photography.py` cross-checks
and a transcription slip would be caught late or, worse, be internally consistent and wrong.

`processing` is computed from the real dimensions using the same 1600px rule the validator
applies, so it can never contradict them.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyPipeline/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; travel-planning app, "
    "non-commercial; Block 2 photography preparation)"
)
PROCESSING_MAX_DIMENSION = 1600
# Shared with scripts/acquire-photography.py: Commons only serves a cached thumbnail strictly
# narrower than the source file, so any file at or below the max dimension is acquired as a
# reduced rendition and must be recorded as one. Importing the rule rather than restating it
# keeps preparation and acquisition from disagreeing about what a record means.
STANDARD_THUMB_WIDTHS = (1280, 1024, 800, 640, 480, 320)


def planned_processing_for(width, height, max_dimension=PROCESSING_MAX_DIMENSION):
    if max(width, height) > max_dimension:
        return "resized-and-webp-reencoded"
    if any(standard < width for standard in STANDARD_THUMB_WIDTHS):
        return "resized-and-webp-reencoded"
    return "webp-reencoded"

LICENCE_URLS = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC BY 2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY-SA 2.5": "https://creativecommons.org/licenses/by-sa/2.5/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
}


def _open(url, timeout=40):
    for attempt in range(7):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503) and attempt < 6:
                time.sleep(4 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def strip_html(value):
    out, depth = [], 0
    for ch in value or "":
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return " ".join("".join(out).split())


def normalise_licence(raw, categories=None):
    text = strip_html(raw).strip()
    if text in LICENCE_URLS:
        return text
    lowered = text.lower()
    for allowed in LICENCE_URLS:
        if lowered.startswith(allowed.lower()):
            return allowed
    if lowered == "public domain":
        public_domain_basis(categories)
        return "Public Domain"
    raise SystemExit(f"licence {text!r} is outside the pipeline's allowlist")


def public_domain_basis(categories=None):
    """Return an explicit Commons public-domain basis supported by the registry contract."""
    category_names = {item.strip() for item in strip_html(categories).split("|")}
    if "PD-self" in category_names:
        return "PD-self"
    # Public-domain basis used by Commons for works whose copyright term expired under
    # Japanese law. Keep this explicit (and limited to the exact Commons category) rather
    # than treating generic PD-old labels as sufficient evidence.
    if "PD-Japan" in category_names:
        return "PD-Japan"
    if category_names & {"PD US Military", "PD US Marines"}:
        return "PD-USGov"
    raise SystemExit(
        "Commons reports Public domain but does not expose an explicitly supported basis"
    )


def strip_query(url):
    return urllib.parse.urlsplit(url)._replace(query="", fragment="").geturl()


def build(entry, acquisition_date):
    data = json.loads(
        _open(
            COMMONS_API
            + "?"
            + urllib.parse.urlencode(
                {
                    "action": "query",
                    "format": "json",
                    "titles": entry["title"],
                    "prop": "imageinfo",
                    "iiprop": "url|size|mime|extmetadata",
                }
            )
        )
    )
    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()))
    infos = page.get("imageinfo")
    if not infos:
        raise SystemExit(f"{entry['placeId']}: Commons has no imageinfo for {entry['title']!r}")
    info = infos[0]
    meta = info.get("extmetadata", {})

    categories = meta.get("Categories", {}).get("value", "")
    licence = normalise_licence(meta.get("LicenseShortName", {}).get("value"), categories)
    basis = public_domain_basis(categories) if licence == "Public Domain" else None
    credit = strip_html(meta.get("Artist", {}).get("value"))
    if licence != "CC0" and not credit:
        raise SystemExit(f"{entry['placeId']}: {licence} requires a credit and Commons reports none")

    width, height = info["width"], info["height"]
    record = {
        "placeId": entry["placeId"],
        "assetPath": f"images/places/{entry['placeId']}/{entry['slug']}.webp",
        "alt": entry["alt"],
        "source": "Wikimedia Commons",
        "sourceUrl": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(entry['title'].replace(' ', '_'))}",
        "credit": credit,
        "license": licence,
        "acquisitionUrl": strip_query(info["url"]),
        "acquisitionDate": acquisition_date,
        "originalTitle": entry["title"],
        "originalWidth": width,
        "originalHeight": height,
        "processing": planned_processing_for(width, height),
    }
    if licence in LICENCE_URLS:
        record["licenseUrl"] = LICENCE_URLS[licence]
    elif licence == "Public Domain":
        # Public-domain works have no canonical license URL. Keep an explicit Commons
        # category basis without inventing a license destination.
        record["licenseBasis"] = basis
    return record


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    plan = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    date = plan["acquisitionDate"]
    records = []
    for entry in plan["entries"]:
        records.append(build(entry, date))
        print(f"prepared {entry['placeId']}", file=sys.stderr)
        time.sleep(1.0)
    print(json.dumps(records, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
