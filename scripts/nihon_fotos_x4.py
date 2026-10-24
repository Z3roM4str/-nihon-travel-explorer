"""Nihon fotos x4 (PR #6): qué registros añadió y cómo separarlos para los tests de lotes viejos.

Los tests de cada lote histórico (Phase 4E–4M, Block 22 B6.x) comprueban lo que ESE lote dejó
en el registro. Nihon fotos x4 llevó después cada lugar hasta 4 fotos, así que esos tests miran
el registro sin los registros x4 para lo histórico, y el registro completo para el tope actual
de 4 fotos por lugar. La lista de registros x4 vive en
data/visual/nihon-fotos-x4-acquisition-plan.json.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "data/visual/nihon-fotos-x4-acquisition-plan.json"
MAX_PHOTOS_PER_PLACE = 4


def x4_titles() -> set[str]:
    return {entry["title"] for entry in json.loads(PLAN_PATH.read_text(encoding="utf-8"))["entries"]}


def pre_x4(images: list[dict]) -> list[dict]:
    """El registro tal como estaba antes de Nihon fotos x4, en el mismo orden."""
    titles = x4_titles()
    return [image for image in images if image["originalTitle"] not in titles]


def by_place(images: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for image in images:
        grouped.setdefault(image["placeId"], []).append(image)
    return grouped
