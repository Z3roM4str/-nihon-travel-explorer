"""Nihon fotos x4 (PR #6): qué registros añadió y cómo separarlos para los tests de lotes viejos.

Los tests de cada lote histórico (Phase 4E–4M, Block 22 B6.x) comprueban lo que ESE lote dejó
en el registro. Nihon fotos x4 llevó después cada lugar hasta 4 fotos, así que esos tests miran
el registro sin los registros x4 para lo histórico, y el registro completo para el tope actual
de 4 fotos por lugar. La lista de registros x4 vive en
data/visual/nihon-fotos-x4-acquisition-plan.json.

Después, «Lugares nuevos» (JP-215–JP-265) agregó al final del registro las fotos de lugares que
no existían en ningún lote histórico; su plan vive en
data/visual/nihon-lugares-nuevos-acquisition-plan.json y `pre_x4` también los aparta.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "data/visual/nihon-fotos-x4-acquisition-plan.json"
NEW_PLACES_PLAN_PATH = ROOT / "data/visual/nihon-lugares-nuevos-acquisition-plan.json"
MAX_PHOTOS_PER_PLACE = 4


def x4_titles() -> set[str]:
    return {entry["title"] for entry in json.loads(PLAN_PATH.read_text(encoding="utf-8"))["entries"]}


def new_places_titles() -> set[str]:
    """`originalTitle` de cada foto que añadió «Lugares nuevos» (vacío si el plan no existe)."""
    if not NEW_PLACES_PLAN_PATH.is_file():
        return set()
    return {entry["title"] for entry in json.loads(NEW_PLACES_PLAN_PATH.read_text(encoding="utf-8"))["entries"]}


def pre_x4(images: list[dict]) -> list[dict]:
    """El registro tal como estaba antes de Nihon fotos x4, en el mismo orden."""
    titles = x4_titles() | new_places_titles()
    return [image for image in images if image["originalTitle"] not in titles]


# Último id del catálogo antes de «Lugares nuevos»: JP-215–JP-265 llegaron después de todo lote
# histórico (JP-001–JP-214 quedaron idénticos).
LAST_PRE_NEW_PLACES_ID = 214


def pre_new_places(places: list[dict]) -> list[dict]:
    """El catálogo de lugares tal como estaba antes de «Lugares nuevos», en el mismo orden.

    Los lugares JP-215–JP-265 (id numérico > 214) no existían en ninguna línea base histórica
    (Phase 4E–4M, Block 22 B6.x), así que las reproducciones de esos lotes no deben verlos: un
    selector que los recibiera elegiría otros objetivos. Es el análogo de `pre_x4` para lugares.
    Las comprobaciones del estado ACTUAL siguen usando el catálogo completo.
    """
    return [place for place in places if int(place["id"].split("-")[1]) <= LAST_PRE_NEW_PLACES_ID]


def by_place(images: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for image in images:
        grouped.setdefault(image["placeId"], []).append(image)
    return grouped
