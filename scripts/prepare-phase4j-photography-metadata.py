#!/usr/bin/env python3
"""Build Phase 4J canonical photography metadata from live Wikimedia Commons evidence.

Every field written here is read back from the Commons API for the exact reviewed file:
license, license URL, creator, dimensions, Commons filename and acquisition URL. Nothing
is invented. Alt text is authored per target from the reviewed subject.

The script only appends records for the reviewed Phase 4J acceptances; it never mutates
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
    "(https://github.com/Z3roM4str/-nihon-travel-explorer; Phase 4J metadata preparation)"
)
SUPPORTED_LICENSES = {
    "CC0",
    "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
}

# placeId -> (Commons file title, asset slug, Spanish alt text)
ACCEPTED = {
    "JP-214": ("File:Yanagawa cruise ac (7).jpg", "yanagawa-canal-cruise",
               "Barcas donko amarradas junto a un embarcadero de madera en el canal de Yanagawa, Fukuoka."),
    "JP-100": ("File:Toei Kyoto Studio Park from above.jpg", "toei-kyoto-studio-park",
               "Vista elevada de las calles de época del Toei Kyoto Studio Park en Uzumasa, Kioto."),
    "JP-163": ("File:Walking Banyan Tree in the Valley of Gangala 202312.jpg", "valley-of-gangala",
               "Gran higuera banyan y bosque subtropical en el Valle de Gangala, Nanjo, Okinawa."),
    "JP-123": ("File:Church of Light.JPG", "church-of-the-light",
               "Cruz de luz abierta en el muro de hormigón de la Iglesia de la Luz, en Ibaraki, Osaka."),
    "JP-013": ("File:Shinjuku Golden Gai (53147651689).jpg", "golden-gai",
               "Letrero iluminado de Shinjuku Golden Gai sobre el acceso al microbarrio de bares."),
    "JP-073": ("File:Wooden gate in Okochi Sanso Garden, Kyoto, Japan.jpg", "okochi-sanso-garden",
               "Portón de madera abierto hacia el jardín del Ōkōchi Sansō en Arashiyama, Kioto."),
    "JP-183": ("File:Mangroves at Gesashi Bay 202310.jpg", "gesashi-bay-mangrove",
               "Manglares con raíces expuestas en la bahía de Gesashi, Higashi, Okinawa."),
    "JP-022": ("File:Ameya-Yokochō Entrance.jpg", "ameyoko",
               "Entrada de la calle comercial Ameya-Yokochō junto a Ueno, con carteles de tiendas."),
    "JP-055": ("File:Pedestrian road with pavements and paper umbrellas, Higashiyama-ku, Kyoto, Japan, early morning.jpg",
               "sannenzaka-ninenzaka",
               "Calle empedrada de Ninenzaka con casas de madera y sombrillas de papel, a primera hora."),
    "JP-194": ("File:Banna Park south gate, Ishigaki, Okinawa.jpg", "banna-park",
               "Acceso sur del parque Banna en Ishigaki, con escalinata y vegetación subtropical."),
    "JP-014": ("File:Shinjuku-West Omoide-Yokocho.jpg", "omoide-yokocho",
               "Acceso al callejón Omoide Yokocho, al norte de la salida oeste de la estación de Shinjuku."),
    "JP-059": ("File:170923 Kodaiji Kyoto Japan09n.jpg", "kodai-ji",
               "Jardín y pabellones del templo Kōdai-ji en Higashiyama, Kioto."),
    "JP-189": ("File:Irabu Bridge (52204774130).jpg", "irabu-bridge",
               "Puente de Irabu cruzando aguas turquesas entre las islas de Miyako e Irabu, Okinawa."),
    "JP-124": ("File:Osaka Aquarium Kaiyukan 2022-04-24.jpg", "osaka-aquarium-kaiyukan",
               "Fachada del acuario Kaiyukan de Osaka, con su mural exterior de colores en Tempozan."),
    "JP-078": ("File:Saihō-ji (Nishikyo Kyoto) hdsr Garden S5 520.jpg", "saiho-ji-kokedera",
               "Estanque y alfombra de musgo bajo los árboles del jardín de Saihō-ji (Koke-dera), Kioto."),
    "JP-165": ("File:Street in Kudaka Island 202401 02.jpg", "kudaka-island",
               "Camino de la isla de Kudaka bordeado por muros de piedra y vegetación, Nanjo, Okinawa."),
    "JP-117": ("File:Sengan-yagura Turret at Osaka Castle Park, September 2017.jpg", "osaka-castle-park",
               "Torreta Sengan-yagura y muralla de piedra del castillo de Osaka, en el parque del castillo."),
    "JP-043": ("File:Small Worlds Tokyo Koto-ku Tokyo.jpg", "small-worlds-miniature-museum",
               "Exterior del edificio de SMALL WORLDS TOKYO, con su rótulo, en Koto, Tokio."),
    "JP-060": ("File:251213 Nanzen-ji Suirokaku Kyoto Japan01s3.jpg", "nanzen-ji",
               "Acueducto de ladrillo Suirokaku en el recinto del templo Nanzen-ji, Kioto."),
    "JP-138": ("File:Weathercock House Kobe Kitano Ijinkan 風見鶏の館（旧トーマス住宅）.jpg", "kobe-kitano-ijinkan",
               "Casa del Gallo de Viento, antigua residencia Thomas, en el barrio Kitano de Kobe."),
    "JP-006": ("File:Nezu Museum Garten-20091020-RM-114344.jpg", "nezu-museum",
               "Sendero de piedra entre la vegetación del jardín del Museo Nezu, en Minato, Tokio."),
    "JP-081": ("File:Ninna-ji and Ryoan-ji, Kyoto - Ryoanji7753.jpg", "ryoan-ji",
               "Jardín seco de grava rastrillada y rocas del templo Ryōan-ji, Kioto."),
    "JP-198": ("File:Pinaisara Falls (52117077706).jpg", "pinaisara-falls",
               "Cascada de Pinaisara descendiendo entre la selva de la isla de Iriomote, Okinawa."),
    "JP-105": ("File:Osaka - Osaka194.jpg", "hozenji-yokocho",
               "Callejón de Hozenji Yokocho con faroles rojos y fachadas de restaurantes, Osaka."),
    "JP-039": ("File:Toyosu fish market, at Toyosu, Koto, Tokyo (2019-01-01) 01.jpg", "toyosu-market",
               "Edificio del mercado de Toyosu con su rótulo, en Koto, Tokio."),
    "JP-212": ("File:Sumo -Osaka 2010 03 23 a.jpg", "grand-sumo-tournament-osaka",
               "Combate sobre el dohyō ante las gradas durante una edición anterior del torneo de sumo de marzo en Osaka."),
    "JP-011": ("File:Tokyo Metropolitan Government Building taken from Shinjuku NS Building.jpg",
               "tokyo-metropolitan-government-observatory",
               "Torres del Edificio del Gobierno Metropolitano de Tokio, sede del mirador, en Shinjuku."),
    "JP-047": ("File:Tokyo Edo-Tokyo Open Air Architectural Museum entrance.jpg",
               "edo-tokyo-open-air-architectural-museum",
               "Edificio de acceso del Museo Arquitectónico al Aire Libre de Edo-Tokio, en Koganei."),
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
    parser.add_argument("--plan-out", default=str(ROOT / "data/visual/phase4j-acquisition-plan.json"))
    args = parser.parse_args()

    doc = json.loads(CANONICAL.read_text(encoding="utf-8"))
    existing = {r["placeId"] for r in doc["images"]}

    new_records = []
    plan_accepted = []
    for place_id, (title, slug, alt) in ACCEPTED.items():
        if place_id in existing:
            raise SystemExit(f"{place_id} already has a record; Phase 4J must not add a second image")
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
