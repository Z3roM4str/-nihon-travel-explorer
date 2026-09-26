import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) =>
  (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

describe("B21 global search return contract", () => {
  it("keeps Sheet scroll support optional and restores the actual body", async () => {
    const source = await read("./components/Sheet.tsx");
    expect(source).toContain("initialBodyScrollTop?: number");
    expect(source).toContain("onBodyScroll?: (scrollTop: number) => void");
    expect(source).toContain("bodyRef.current.scrollTop = initialBodyScrollTop");
    expect(source).toContain("onBodyScroll(event.currentTarget.scrollTop)");
  });

  it("preserves city SearchSheet closing by default and prevents focus scrolling", async () => {
    const source = await read("./components/SearchSheet.tsx");
    expect(source).toContain("closeOnSelect?: boolean");
    expect(source).toContain("closeOnSelect = true");
    expect(source).toContain("if (closeOnSelect) onClose()");
    expect(source).toContain("focus({ preventScroll: true })");
  });

  it("tags only global results and leaves city search on its existing path", async () => {
    const source = await read("./App.tsx");
    expect(source).toContain('selectPlace(id, "explorar", null, "global-search")');
    // DDR-B24-3 (resuelta): las colecciones de la portada comparten el mismo mecanismo de
    // "no cambiar de hub implícitamente" que la búsqueda global — la comprobación se generalizó
    // de "=== global-search" a "cualquier exploreReturnSurface no nulo".
    expect(source).toContain("!exploreDetailReturnRef.current && place.hub !== activeHub");
    expect(source).toContain("closeOnSelect={false}");
    expect(source).toContain("onClose={closeGlobalSearch}");
    expect(source).toMatch(/\{searchOpen && \([\s\S]*?<SearchSheet[\s\S]*?onSelect=\{selectPlace\}[\s\S]*?onClose=\{\(\) => setSearchOpen\(false\)\}/);
  });
});
