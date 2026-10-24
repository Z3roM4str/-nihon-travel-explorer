#!/usr/bin/env python3
"""Build Phase 4L canonical photography metadata from live Wikimedia Commons evidence.

Every field written here is read back from the Commons API for the exact reviewed file:
license, license URL, creator, dimensions, Commons filename and acquisition URL. Nothing
is invented. Alt text is authored per target from the reviewed subject.

The script only appends records for the reviewed Phase 4L acceptances; it never mutates
or reorders pre-existing records.
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
CANONICAL = ROOT / "data/visual/photography-metadata.json"
APP_COPY = ROOT / "app/src/data/photography-metadata.json"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "NihonTravelExplorerPhotographyPipeline/1.0 "
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4L metadata preparation)"
)
CARRIED_FAILED_CLOSED_IDS = {
    "JP-033", "JP-126", "JP-203", "JP-204",              # Phase 4D
    "JP-050", "JP-195",                                  # Phase 4F
    "JP-121", "JP-156", "JP-095", "JP-079", "JP-202",    # Phase 4H
    "JP-120", "JP-211", "JP-041", "JP-168",              # Phase 4J
}
SUPPORTED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}

# placeId -> (Commons file title, asset slug, Spanish alt text)
ACCEPTED = {
    "JP-084": ("File:詩仙堂 02.jpg", "shisen-do",
               "Jardín de setos podados y arena visto desde la sala de tatami del Shisen-dō, Kioto."),
    "JP-190": ("File:Toriike.jpg", "toriike-ponds",
               "Estanque circular de Toriike, cueva colapsada junto al mar en Shimoji, Miyakojima, Okinawa."),
    "JP-149": ("File:241119 MIHO MUSEUM Koga Shiga pref Japan08s3.jpg", "miho-museum",
               "Acceso escalonado y pabellón de entrada del MIHO Museum, en las montañas de Shigaraki, Shiga."),
    "JP-012": ("File:Colorful neon street signs in Kabukichō, Shinjuku, Tokyo.jpg", "kabukicho",
               "Calle de Kabukichō de noche, con letreros de neón a ambos lados, en Shinjuku, Tokio."),
    "JP-062": ("File:Eikan-do Zenrin-ji, November 2016 -03.jpg", "eikan-do",
               "Estanque del Eikan-dō Zenrin-ji rodeado de arces rojos de otoño, Kioto."),
    "JP-176": ("File:Kouri Bridge 202006.jpg", "kouri-island-bridge",
               "Puente de Kouri tendido sobre aguas turquesas hacia la isla de Kouri, Nakijin, Okinawa."),
    "JP-122": ("File:Minoh Falls Minoh Osaka pref Japan05s5.jpg", "minoh-falls",
               "Cascada de Minoh cayendo sobre la poza rocosa del parque de Minoh, Osaka."),
    "JP-213": ("File:Tokyo Marathon 2019 Runner (46348789105).jpg", "tokyo-marathon",
               "Grupo de corredores por las calles de Tokio durante una edición anterior del maratón."),
    "JP-087": ("File:Hosenin (Kyoto) ac (3).jpg", "hosen-in",
               "Pabellón de madera y jardín del templo Hōsen-in, en Ōhara, Kioto."),
    "JP-200": ("File:Yonaguni Monument Main Terrace.jpg", "yonaguni-monument",
               "Buceadora junto a la terraza principal de la formación submarina de Yonaguni, Okinawa."),
    "JP-112": ("File:Umeda Sky Building, Osaka, November 2016 -01.jpg", "umeda-sky-building",
               "Torres gemelas del Umeda Sky Building y su pasarela superior vistas desde abajo, Osaka."),
    "JP-053": ("File:Edo-Tokyo Museum.jpg", "edo-tokyo-museum",
               "Estructura elevada del Museo Edo-Tokio, obra de Kiyonori Kikutake, en Ryōgoku, Tokio."),
    "JP-064": ("File:Kyoto, Honen-in - panoramio (1).jpg", "honen-in",
               "Portón de techo de paja del templo Hōnen-in al final de una escalinata de piedra, Kioto."),
    "JP-158": ("File:Tamaudun01s3s4592.jpg", "tamaudun",
               "Muros y cámaras de piedra del mausoleo real Tamaudun, junto a Shuri, Naha, Okinawa."),
    "JP-113": ("File:Grand Green Osaka 20250831.jpg", "grand-green-osaka",
               "Torres y zona verde de Grand Green Osaka, junto a la estación de Osaka en Umekita."),
    "JP-007": ("File:Ota Memorial Museum of Art, exterior 2018.JPG", "ota-memorial-museum-of-art",
               "Exterior del Museo Conmemorativo Ōta de Arte, dedicado al ukiyo-e, en Harajuku, Tokio."),
    "JP-063": ("File:Tetsugaku-no-michi - Philosopher's Walk - Kyoto.jpg", "philosophers-path",
               "Sendero del Camino del Filósofo junto al canal arbolado, en Higashiyama, Kioto."),
    "JP-185": ("File:Furuzamami beach Okinawa Zamami.jpg", "furuzamami-beach",
               "Arena blanca y agua turquesa de la playa de Furuzamami, en la isla de Zamami, Okinawa."),
    "JP-130": ("File:Sika deer doe and fawn Nara 2026 dllu.jpg", "nara-park-deer",
               "Cierva sika con su cervatillo en un camino del parque de Nara."),
    "JP-042": ("File:Rainbow Bridge, Tokyo, South view from Odaiba 20190419 1.jpg", "odaiba-rainbow-bridge",
               "Puente Rainbow visto desde la bahía de Odaiba, en Tokio."),
    "JP-065": ("File:Sunlight through clouds and view of Ginkaku-ji Temple from above, Kyoto, Japan.jpg",
               "ginkaku-ji",
               "Vista elevada del recinto del Ginkaku-ji entre arboledas, con Kioto al fondo."),
    "JP-172": ("File:Onna Okinawa Japan Cape-Manzamo-01.jpg", "cape-manzamo",
               "Acantilado de Cabo Manzamo con su roca en forma de trompa de elefante, Onna, Okinawa."),
    "JP-139": ("File:Nunobiki Falls Kobe 2026 dllu.jpg", "nunobiki-falls-herb-gardens",
               "Cascada de Nunobiki descendiendo por la garganta boscosa sobre Kobe, Hyōgo."),
    "JP-051": ("File:Takao-san hike during winter 11.jpg", "mount-takao",
               "Panorámica de la llanura de Tokio desde las alturas del monte Takao en invierno."),
    "JP-067": ("File:Kyoto Tofuku-ji Tsuten-kyo 04.jpg", "tofuku-ji",
               "Puente cubierto Tsūtenkyō del templo Tōfuku-ji sobre el barranco arbolado, Kioto."),
    "JP-169": ("File:座喜味城趾 - panoramio.jpg", "zakimi-castle-ruins",
               "Murallas de piedra caliza y puerta en arco del castillo de Zakimi, Yomitan, Okinawa."),
    "JP-114": ("File:Nakanoshima 2023-09-01 (2).jpg", "nakanoshima-waterfront",
               "Paseo ribereño de Nakanoshima al anochecer, con los edificios del centro de Osaka."),
    "JP-020": ("File:Tokyo, sumida hokusai museum, esterno 01.jpg", "sumida-hokusai-museum",
               "Volumen metálico facetado del Museo Hokusai de Sumida, obra de Kazuyo Sejima, Tokio."),
    "JP-186": ("File:Aka Beach And Aka Village 2010 (7788).JPG", "aka-island",
               "Bahía y caserío de la isla de Aka, en las Kerama, Okinawa."),
    "JP-052": ("File:Mitake Shrine @ Hike from Mitake to Okutama (10181698756).jpg",
               "mount-mitake-musashi-mitake-shrine",
               "Pabellón bermellón del santuario Musashi-Mitake, en la cima del monte Mitake, Ōme, Tokio."),
    "JP-017": ("File:Asakusa Culture Tourist Information Center 2016.jpg",
               "asakusa-culture-tourist-information-center",
               "Edificio escalonado del Centro de Información Turística y Cultural de Asakusa, obra de Kengo Kuma."),
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


def normalize_license(raw):
    raw = clean_markup(raw)
    raw = raw.replace("Creative Commons ", "CC ")
    raw = raw.replace("Attribution-ShareAlike", "BY-SA")
    raw = raw.replace("Attribution", "BY")
    raw = re.sub(r"\s+", " ", raw).strip()
    return "CC0" if raw in {"CC0 1.0", "CC0"} else raw


def fetch(title):
    data = api_get({
        "action": "query", "format": "json", "formatversion": "2",
        "titles": title, "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
    })
    pages = data["query"]["pages"]
    page = pages[0]
    if page.get("missing"):
        raise SystemExit(f"Commons page missing: {title}")
    info = page["imageinfo"][0]
    ext = info.get("extmetadata") or {}
    def ev(key):
        return clean_markup((ext.get(key) or {}).get("value", ""))
    license_url = ev("LicenseUrl")
    # Commons still serves some creativecommons.org deed URLs over http://. The repository
    # contract (and every pre-existing record) requires https://, so normalise the scheme
    # without changing the URL itself.
    if license_url.startswith("http://creativecommons.org/"):
        license_url = "https://" + license_url[len("http://"):]
    # The Commons API appends utm_source/utm_campaign/utm_content tracking parameters to
    # "url". They have nothing to do with file identity, every pre-existing record stores
    # a clean URL, and the acquisition pipeline compares ignoring the query string, so the
    # stored acquisitionUrl drops them.
    acquisition_url = info["url"].split("?", 1)[0]
    return {
        "resolvedTitle": page["title"],
        "descriptionUrl": info["descriptionurl"],
        "url": acquisition_url,
        "width": info["width"],
        "height": info["height"],
        "license": normalize_license(ev("LicenseShortName") or ev("UsageTerms")),
        "licenseUrl": license_url,
        "artist": ev("Artist"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquisition-date", required=True)
    parser.add_argument("--plan-out", default=str(ROOT / "data/visual/phase4l-acquisition-plan.json"))
    args = parser.parse_args()

    doc = json.loads(CANONICAL.read_text(encoding="utf-8"))
    existing = {r["placeId"] for r in doc["images"]}

    leaked = sorted(set(ACCEPTED) & CARRIED_FAILED_CLOSED_IDS)
    if leaked:
        raise SystemExit(f"STOP: carried fail-closed ID(s) in the acceptance set: {leaked}")
    fixture = json.loads(
        (ROOT / "data/visual/phase4k-successor-fixture.json").read_text(encoding="utf-8")
    )
    authorised = {p["placeId"] for p in fixture["places"]}
    outside = sorted(set(ACCEPTED) - authorised)
    if outside:
        raise SystemExit(f"STOP: acceptance outside the authorised fixture: {outside}")

    new_records = []
    plan_accepted = []
    for place_id, (title, slug, alt) in ACCEPTED.items():
        if place_id in existing:
            raise SystemExit(f"{place_id} already has a record; Phase 4L must not add a second image")
        meta = fetch(title)
        if meta["license"] not in SUPPORTED_LICENSES:
            raise SystemExit(f"{place_id}: license {meta['license']!r} outside the supported allowlist")
        if meta["resolvedTitle"] != title:
            raise SystemExit(f"{place_id}: Commons resolved {meta['resolvedTitle']!r}, expected {title!r}")
        asset_path = f"images/places/{place_id}/{slug}.webp"
        record = {
            "placeId": place_id,
            "assetPath": asset_path,
            "alt": alt,
            "source": "Wikimedia Commons",
            "sourceUrl": meta["descriptionUrl"],
            "credit": meta["artist"],
            "license": meta["license"],
            "licenseUrl": meta["licenseUrl"],
            "acquisitionUrl": meta["url"],
            "acquisitionDate": args.acquisition_date,
            "originalTitle": title,
            "originalWidth": meta["width"],
            "originalHeight": meta["height"],
            "processing": "resized-and-webp-reencoded",
        }
        new_records.append(record)
        plan_accepted.append({"placeId": place_id, "assetPath": asset_path,
                              "originalTitle": title, "license": meta["license"]})
        print(f"{place_id}: {meta['license']:12} {meta['width']}x{meta['height']}  {title}")
        time.sleep(0.6)

    doc["images"].extend(new_records)
    doc["imageCount"] = len(doc["images"])
    payload = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    CANONICAL.write_text(payload, encoding="utf-8")
    APP_COPY.write_text(payload, encoding="utf-8")
    print(f"\ncanonical now holds {doc['imageCount']} records")

    plan = json.loads(Path(args.plan_out).read_text(encoding="utf-8")) if Path(args.plan_out).exists() else {}
    plan["version"] = 1
    plan["attemptedTargetCount"] = 32
    plan["acceptedCount"] = len(plan_accepted)
    plan["accepted"] = plan_accepted
    Path(args.plan_out).write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.plan_out}")


if __name__ == "__main__":
    main()
