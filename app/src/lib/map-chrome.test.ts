import { describe, expect, it } from "vitest";
import { blockedTargets, chromeClearingShift, type Point, type Rect } from "./map-chrome";
import { MARKER_HIT_SIZE } from "./map-grouping";

const VIEWPORT: Rect = { left: 0, top: 0, right: 375, bottom: 500 };
// Leyenda cerrada en la esquina inferior izquierda (medida aproximada a 375×667).
const LEGEND: Rect = { left: 12, top: 448, right: 230, bottom: 488 };

function box(point: Point): Rect {
  const half = MARKER_HIT_SIZE / 2;
  return { left: point.x - half, top: point.y - half, right: point.x + half, bottom: point.y + half };
}

function overlaps(a: Rect, b: Rect) {
  return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
}

describe("B24 P0-4e — el cromo del mapa es zona de exclusión (Art. 11)", () => {
  it("no se mueve si ninguna caja de impacto toca el cromo", () => {
    expect(chromeClearingShift([{ x: 100, y: 100 }], [LEGEND], VIEWPORT)).toBeNull();
    expect(chromeClearingShift([{ x: 100, y: 100 }], [], VIEWPORT)).toBeNull();
  });

  it("libera un marcador bajo la leyenda con la traslación más corta", () => {
    const targets = [{ x: 120, y: 470 }, { x: 200, y: 200 }];
    const shift = chromeClearingShift(targets, [LEGEND], VIEWPORT);
    expect(shift).not.toBeNull();
    expect(blockedTargets(targets, [LEGEND], shift!)).toHaveLength(0);
    // Subir el marcador por encima de la leyenda es lo más corto.
    expect(shift!.dy).toBeLessThan(0);
    expect(Math.abs(shift!.dx)).toBeLessThanOrEqual(Math.abs(shift!.dy));
  });

  it("una traslación no mete otro marcador bajo el cromo", () => {
    // Justo encima de la leyenda hay otro marcador: subir sólo 46 px lo metería debajo del
    // segundo rectángulo de cromo (control arriba a la izquierda).
    const chrome = [LEGEND, { left: 12, top: 380, right: 230, bottom: 420 }];
    const targets = [{ x: 120, y: 470 }, { x: 300, y: 300 }];
    const shift = chromeClearingShift(targets, chrome, VIEWPORT)!;
    const moved = targets.map((t) => box({ x: t.x + shift.dx, y: t.y + shift.dy }));
    for (const rect of chrome) for (const b of moved) expect(overlaps(b, rect)).toBe(false);
  });

  it("nunca saca del encuadre al lugar que se debe conservar", () => {
    // Subir sería lo más corto, pero sacaría por arriba al lugar seleccionado: se desplaza a un lado.
    const keep = { x: 100, y: 30 };
    const targets = [{ x: 60, y: 455 }, keep];
    const shift = chromeClearingShift(targets, [LEGEND], VIEWPORT, [keep])!;
    expect(blockedTargets(targets, [LEGEND], shift)).toHaveLength(0);
    expect(shift.dy).toBeGreaterThanOrEqual(0);
    const kept = box({ x: keep.x + shift.dx, y: keep.y + shift.dy });
    expect(kept.right).toBeLessThanOrEqual(VIEWPORT.right);
    expect(kept.left).toBeGreaterThanOrEqual(VIEWPORT.left);
    expect(kept.top).toBeGreaterThanOrEqual(VIEWPORT.top);
  });

  it("no depende del tamaño de la leyenda: sigue funcionando si crece", () => {
    const bigger: Rect = { ...LEGEND, top: 300 };
    const targets = [{ x: 120, y: 400 }, { x: 150, y: 330 }];
    const shift = chromeClearingShift(targets, [bigger], VIEWPORT)!;
    expect(blockedTargets(targets, [bigger], shift)).toHaveLength(0);
  });

  it("una malla densa de marcadores separados ≥52 px siempre encuentra hueco", () => {
    const targets: Point[] = [];
    for (let x = 30; x < 375; x += 60) for (let y = 30; y < 500; y += 60) targets.push({ x, y });
    const shift = chromeClearingShift(targets, [LEGEND], VIEWPORT);
    expect(shift).not.toBeNull();
    expect(blockedTargets(targets, [LEGEND], shift!)).toHaveLength(0);
  });
});
