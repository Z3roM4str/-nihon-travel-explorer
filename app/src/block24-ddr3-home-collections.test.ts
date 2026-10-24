import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) =>
  (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// DDR-B24-3 (resuelta): las colecciones de la portada se comportan como la búsqueda global
// (DDR-B21-05) — la ficha se apila sobre la portada sin cambiar la ciudad activa, y cerrar (UI,
// Escape o back) devuelve exactamente a la portada con su scroll. El comportamiento en vivo lo
// cubre `scripts/b24-ddr3-home-collections-check.mjs`; esto protege la estructura del código.
describe("DDR-B24-3 — colecciones de la portada", () => {
  it("ExplorerHome etiqueta sus selecciones como home-collection", async () => {
    const source = await read("./App.tsx");
    expect(source).toContain('onSelectPlace={(id) => selectPlace(id, "explorar", null, "home-collection")}');
  });

  it("selectPlace no cambia de hub cuando recibe cualquier exploreReturnSurface no nulo", async () => {
    const source = await read("./App.tsx");
    expect(source).toContain(
      'exploreReturnSurface: "global-search" | "home-collection" | null = null'
    );
    expect(source).toContain("if (!exploreReturnSurface && place.hub !== activeHub) {");
  });

  it("pushPlace/goBack respetan el mismo mecanismo para saltos y back dentro de la ficha", async () => {
    const source = await read("./App.tsx");
    expect(source).toContain("!exploreDetailReturnRef.current && place.hub !== activeHub");
    expect(source).toContain("!exploreDetailReturnRef.current && nextPlace && nextPlace.hub !== activeHub");
  });

  it("un back real de navegador (popstate) tampoco restaura un hub cuando la ficha vino de una colección", async () => {
    const source = await read("./App.tsx");
    expect(source).toContain(
      'if (ficheOriginRef.current !== "explorar" || exploreDetailReturnRef.current) return;'
    );
  });
});
