import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { readProductCss } from "./test-css";

/**
 * P-04 (release blocker, Safari/iPhone) — «Ver Japón en el mapa» dejaba la pantalla en blanco.
 *
 * Sin excepción de JavaScript: el mapa nacional se montaba completo, pero ~1700px por encima de la
 * pantalla. La portada se desplaza en `.app__body--home` hasta llegar a la tarjeta (está al final), ese
 * mismo nodo pasaba a ser el cuerpo del mapa con `overflow: hidden` y conservaba el `scrollTop`; los
 * `.visually-hidden` absolutos de la hoja escapaban de su scroll y le daban el rango oculto que impedía
 * recortarlo a 0. Mapa, hoja y «‹ Volver a la portada» quedaban fuera de alcance del dedo.
 *
 * Pruebas de fuente (sin jsdom), como el resto de guardas estructurales; el comportamiento en vivo —
 * pulsando por coordenadas, sin el auto-desplazamiento de Playwright que ocultó el fallo — lo cubre
 * `scripts/p04-national-map-reachability-check.mjs` en Chromium y WebKit.
 */

async function read(path: string): Promise<string> {
  return (await readFile(new URL(`./${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("P-04 — el mapa nacional no hereda el desplazamiento de la portada", () => {
  it("portada y mapa nacional montan cuerpos distintos (key según mapOpen)", async () => {
    const app = await read("App.tsx");
    const body = app.match(/<div\s+(?:\/\/[^\n]*\n\s*)*key=\{nationalView\.mapOpen \? "([^"]+)" : "([^"]+)"\}\s*className=\{`app__body app__body--national/);
    expect(body, "el cuerpo de .app__body--national debe llevar key ligada a mapOpen").not.toBeNull();
    expect(body![1]).not.toBe(body![2]);
  });

  it("el scroll de la hoja nacional contiene a sus descendientes absolutos (.visually-hidden)", async () => {
    const css = await readProductCss();
    const sheetContent = rule(css, ".national__sheet-content");
    expect(sheetContent).toMatch(/overflow-y:\s*auto/);
    expect(sheetContent).toMatch(/position:\s*relative/);
    expect(rule(css, ".visually-hidden")).toMatch(/position:\s*absolute/);
  });
});
