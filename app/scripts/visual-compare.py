#!/usr/bin/env python3
"""Compara dos carpetas de capturas de `visual-capture.mjs` píxel a píxel.

Uso: python3 scripts/visual-compare.py BASE_DIR NEW_DIR [DIFF_DIR]
Imprime una fila por captura: iguales / nº de píxeles distintos / caja envolvente de la diferencia.
"""
import os
import sys

import numpy as np
from PIL import Image

base, new = sys.argv[1], sys.argv[2]
diff_dir = sys.argv[3] if len(sys.argv) > 3 else None
if diff_dir:
    os.makedirs(diff_dir, exist_ok=True)
same = changed = 0
for name in sorted(os.listdir(base)):
    if not name.endswith(".png"):
        continue
    other = os.path.join(new, name)
    if not os.path.exists(other):
        print(f"MISSING {name}")
        continue
    a = np.asarray(Image.open(os.path.join(base, name)).convert("RGB")).astype(int)
    b = np.asarray(Image.open(other).convert("RGB")).astype(int)
    if a.shape != b.shape:
        print(f"SIZE    {name} {a.shape} vs {b.shape}")
        changed += 1
        continue
    mask = (a != b).any(axis=2)
    n = int(mask.sum())
    if n == 0:
        same += 1
        continue
    changed += 1
    ys, xs = np.where(mask)
    print(f"DIFF    {name}: {n} px, bbox x[{xs.min()}..{xs.max()}] y[{ys.min()}..{ys.max()}]")
    if diff_dir:
        out = (b * 0.35 + 255 * 0.65).astype("uint8")
        out[mask] = [255, 0, 0]
        Image.fromarray(out).save(os.path.join(diff_dir, name))
print(f"iguales={same} distintas={changed}")
