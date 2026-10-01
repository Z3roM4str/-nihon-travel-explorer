import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("./", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, SRC), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sourceFiles(dir = SRC, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) sourceFiles(child, acc);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(child.pathname);
  }
  return acc;
}

describe("B10-A1…A4 — estructura semántica (cerrados en el endurecimiento post-B10)", () => {
  it("A1: el shell declara exactamente un landmark <main> y ningún otro componente lo declara", () => {
    const mains = sourceFiles().flatMap((f) => (strip(readFileSync(f, "utf8")).match(/<main\b/g) ?? []).map(() => f.split("/src/")[1]));
    expect(mains).toEqual(["App.tsx"]);
    expect(strip(read("App.tsx"))).toMatch(/<main className="app__content">[\s\S]*<\/main>\s*<TabBar/);
  });

  it("A2: la cabecera siempre expone un h1; el selector de ciudad es un botón DENTRO del h1", () => {
    const app = strip(read("App.tsx"));
    expect(app).toMatch(/<h1 className="app__heading">\s*<button[\s\S]*?<\/button>\s*<\/h1>/);
    expect(app).toMatch(/<h1 className="app__title">/);
    // las tarjetas (h3) de la lista de ciudad cuelgan de un h2 propio, no saltan de nivel
    expect(app).toMatch(/<h2 className="visually-hidden">Lugares de \{activeHub\}<\/h2>\s*\{explorerList\}/);
  });

  it("A2: ningún componente fuera de App.tsx declara un h1 (un h1 por pantalla)", () => {
    const h1s = sourceFiles().filter((f) => /<h1\b/.test(strip(readFileSync(f, "utf8")))).map((f) => f.split("/src/")[1]);
    expect(h1s).toEqual(["App.tsx"]);
  });

  it("A3: el h2 de la sección Días no repite el nombre accesible del h1 «Viaje»", () => {
    expect(strip(read("components/OrderedSequenceBuilder.tsx"))).toMatch(
      /<h2 id="sequence-builder-title">\s*\{headerTitle\}\s*(?:\{\}\s*)?\{view === "days" && <span className="visually-hidden"> · Días<\/span>\}\s*<\/h2>/
    );
  });

  it("A4: el zoom de Leaflet amplía el área táctil a 44×44 hacia fuera (CSS), sin tocar lo pintado", () => {
    const css = read("components/PlaceMap.css");
    expect(css).toMatch(/\.leaflet-bar a\.leaflet-control-zoom-in::after\s*\{\s*top: -15px;\s*bottom: 0;/);
    expect(css).toMatch(/\.leaflet-bar a\.leaflet-control-zoom-out::after\s*\{\s*top: 0;\s*bottom: -14px;/);
    expect(css).toMatch(/left: -7px;\s*right: -7px;/);
    // no se redimensionan los botones de Leaflet (eso sí sería una decisión visual)
    expect(css).not.toMatch(/\.leaflet-bar a[^{]*\{[^}]*\b(width|height|line-height)\s*:/);
  });
});
