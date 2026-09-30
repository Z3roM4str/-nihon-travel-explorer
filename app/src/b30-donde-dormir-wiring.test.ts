import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * B30 (B9.4) — «Dónde dormir» (`docs/design/05 §8`, `06 §5.5`, DD-015). Contrato de presentación,
 * con la técnica de escaneo de fuente del resto del repo; el comportamiento real está en
 * `scripts/b30-donde-dormir-check.mjs`.
 */

const read = (rel: string) => readFile(new URL(rel, import.meta.url), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("B30 — sin numerales de posición (05 §8, defecto D7)", () => {
  it("ZoneComparison no pinta índices en tarjeta, columna, contrastes ni pin", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).not.toMatch(/zone-card__index|zone-column__index/);
    expect(code).not.toMatch(/\{\s*index\s*\+\s*1\s*\}/);
    expect(code).not.toMatch(/\(\s*zone,\s*index\s*\)|\(\{\s*zone,\s*fit\s*\},\s*index\s*\)/);
    expect(code).toContain("zone-marker__label");
  });

  it("App.css ya no define los índices numerados", async () => {
    const css = await read("./App.css");
    expect(css).not.toMatch(/\.zone-card__index|\.zone-column__index/);
  });

  it("se conservan las cinco marcas editoriales (Ordinal)", async () => {
    const code = await read("./components/ZoneComparison.tsx");
    expect(code).toMatch(/\[1, 2, 3, 4, 5\]\.map/);
    expect(code).toContain("zone-ordinal__step");
  });
});

describe("B30 — espacio fotográfico por zona (06 §5.5, D1)", () => {
  it("PhotoPlaceholder admite icon y brief opcionales y conserva el comportamiento previo", async () => {
    const code = await read("./components/PhotoPlaceholder.tsx");
    expect(code).toMatch(/icon\?: IconName/);
    expect(code).toMatch(/brief\?: string/);
    expect(code).toMatch(/iconOverride \?\? categoryPresentation\(place\.category\)\.icon/);
    expect(code).toMatch(/briefOverride \?\? imageBriefText\(place\)/);
    expect(code).toContain('role="img"');
  });

  it("cada zona monta PhotoPlaceholder con icono de cama y su línea editorial, sin <img> ni assets", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).toMatch(/<PhotoPlaceholder[\s\S]{0,260}icon="cama"[\s\S]{0,80}brief=\{zone\.summary\}/);
    expect(code).not.toMatch(/<img\b|place-images|photography/);
  });
});

describe("B30 — tres registros (05 §8, D4) y línea de encuadre (D5)", () => {
  it("Hechos ◼, Calculado ◇ y Nihon dice ✎ usan EvidenceMark", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).toContain('level="verificado"');
    expect(code).toContain('level="estimado"');
    expect(code).toContain('level="nihon"');
    expect(code).toContain("zone-register--fact");
    expect(code).toContain("zone-register--calc");
    expect(code).toContain("zone-register--voice");
  });

  it("los estilos de registro usan los tokens pedidos", async () => {
    const css = await read("./App.css");
    expect(css).toMatch(/\.zone-register--calc\s*\{[^}]*var\(--surface-sunken\)/);
    expect(css).toMatch(/\.zone-register--voice[\s\S]{0,200}var\(--font-voice\)[\s\S]{0,80}var\(--type-quote-size\)/);
  });

  it("la nota de orden es la única línea de encuadre y conserva la línea recta", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).toMatch(/Ordenadas por cercanía a vuestros\s+sitios guardados/);
    expect(code).toMatch(/distancia en línea recta, no\s+tiempo de trayecto/);
    expect(code).not.toContain("con estrategias distintas. Ninguna es \"la mejor\": cada una cuesta algo.\n          </p>\n        </div>");
    expect(code).toContain("zone-list__closing");
  });
});

describe("B30 — acción por zona (05 §8, D2)", () => {
  it("un solo botón persistente: no pierde el foco al elegir o quitar", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code.match(/zone-choice-action__button/g)?.length).toBe(1);
    expect(code).toContain("Zona elegida");
    expect(code).toContain("Dormir aquí");
    expect(code).not.toMatch(/Usar esta zona en el plan|Cambiar a esta zona|Quitar del plan\b</);
  });

  it("los aria-label nombran la zona", async () => {
    const code = await read("./components/ZoneComparison.tsx");
    expect(code).toMatch(/`Dormir aquí en \$\{zone\.name\}`/);
    expect(code).toMatch(/`Quitar \$\{zone\.name\} del plan`/);
    expect(code).toMatch(/`Comparar \$\{zone\.name\}`/);
  });

  it("sigue escribiendo sólo a través de useZonePlanChoice y el límite de comparar es 4", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).toContain('from "../useZonePlanChoice"');
    expect(code).not.toMatch(/localStorage|sessionStorage|setItem/);
    const hook = await read("./useZoneComparison.ts");
    expect(hook).toMatch(/MAX_COMPARED\s*=\s*4/);
  });
});

describe("B30 — invariantes heredados", () => {
  // B31 (10 §B9.5, DDR-05): B9.5 retira las cuatro apariciones de «Dato:» (03 §10). Contrato que
  // cambia por diseño: «=4» pasa a «=0».
  it("«Dato:» ya no aparece (B9.5 lo retira — 10 §B9.5, DDR-05)", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    expect(code.match(/Dato: «/g)?.length ?? 0).toBe(0);
  });

  it("ZoneComparison no usa lenguaje de ranking ni recomendación", async () => {
    const code = strip(await read("./components/ZoneComparison.tsx"));
    expect(code).not.toMatch(/mejor zona|te conviene|recomendad|ranking|ganador/i);
  });
});
