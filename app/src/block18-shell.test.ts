import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Bloque 18 — B2 "Shell de navegación" (`docs/design/10_ROADMAP_DE_BLOQUES.md`).
 *
 * Guardas permanentes de este bloque: cuatro destinos, consolidación de cromo, retirada del
 * conmutador «Eres», ficha a pantalla completa en teléfono, y las cinco superficies que dejan
 * de ser modales globales de navegación (gate 11 de la especificación). Igual que
 * `block17-design-foundation.test.ts`, son pruebas de fuente (sin jsdom): lo que protegen es
 * la estructura del código, no el comportamiento en vivo — eso lo cubren
 * `scripts/b18-*.mjs` contra un build real.
 */

async function read(path: string): Promise<string> {
  return readFile(new URL(`./${path}`, import.meta.url), "utf8");
}

describe("Bloque 18 — cuatro destinos permanentes (DD-001, 02 §D2)", () => {
  it("lib/destination.ts declara exactamente Explorar · Quiero ir · Viaje · Nosotros, en ese orden", async () => {
    const source = await read("lib/destination.ts");
    expect(source).toContain(
      'export type Destination = "explorar" | "quiero-ir" | "viaje" | "nosotros";'
    );
    expect(source).toMatch(
      /DESTINATIONS[\s\S]*=\s*\["explorar",\s*"quiero-ir",\s*"viaje",\s*"nosotros"\]/
    );
  });

  it("AppNav.tsx monta siempre los cuatro ítems, en el mismo orden, en TabBar y en NavRail", async () => {
    const source = await read("components/AppNav.tsx");
    const items = source.match(/const ITEMS: NavItem\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
    const ids = [...items.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["explorar", "quiero-ir", "viaje", "nosotros"]);
    // Un único inventario de ítems alimenta ambos componentes — no hay una segunda lista que
    // pueda desincronizarse.
    expect(source).toContain("export function TabBar(");
    expect(source).toContain("export function NavRail(");
    expect((source.match(/ITEMS\.map/g) ?? []).length).toBe(2);
  });

  it("sólo «Quiero ir» lleva contador, y sólo cuando es > 0 (Art. 6)", async () => {
    const source = await read("components/AppNav.tsx");
    const badgeMatches = [...source.matchAll(/item\.id === "([a-z-]+)" && wantToGoCount > 0/g)];
    expect(badgeMatches.map((m) => m[1])).toEqual(["quiero-ir", "quiero-ir"]);
  });

  it("TabBar y NavRail nunca coexisten: un único breakpoint (840px, `md`, 02 §D5) decide cuál se ve", async () => {
    const css = await read("App.css");
    expect(css).toContain(".nav-rail {\n  display: none;\n}");
    const mdBlock = css.slice(css.indexOf('@media (min-width: 840px) {\n  .tab-bar'));
    expect(mdBlock.slice(0, 200)).toMatch(/\.tab-bar\s*{\s*display:\s*none;/);
  });
});

describe("Bloque 18 — cromo consolidado (05 §4, gate 11 §1)", () => {
  it("la cabecera mide 56px y la barra única 48px, ambas como tokens de altura literal", async () => {
    const css = await read("App.css");
    expect(css).toMatch(/\.app__header\s*{[^}]*height:\s*56px;/);
    expect(css).toMatch(/\.explorer-bar\s*{[^}]*height:\s*48px;/);
  });

  it("no queda ni `.hub-bar` ni `.view-bar` como selector real: la ciudad y los filtros migraron a la barra única/Sheet", async () => {
    const css = await read("App.css");
    const tsx = await read("App.tsx");
    // Comentarios que citan los nombres antiguos para explicar la migración (08 §"comentarios
    // del código") son legítimos; lo que no puede quedar es la propia regla o el className.
    expect(css).not.toMatch(/^\.hub-bar\b[^;]*\{/m);
    expect(css).not.toMatch(/^\.view-bar\b[^;]*\{/m);
    expect(tsx).not.toMatch(/className="[^"]*\b(hub|view)-bar/);
  });

  it("la búsqueda vive en la barra única, no duplicada dentro de la hoja de filtros", async () => {
    const tsx = await read("App.tsx");
    expect(tsx).toContain("explorer-bar__search");
    expect(tsx).toMatch(/<FilterPanel[\s\S]*?showSearch=\{false\}/);
  });
});

describe("Bloque 18 — retirada del conmutador «Eres» (DD-007, 02 §D4, gate 11 §9/§10)", () => {
  it("App.tsx no renderiza TravellerBar dentro de app__header", async () => {
    const source = await read("App.tsx");
    const headerStart = source.indexOf('<header className="app__header">');
    const headerEnd = source.indexOf("</header>", headerStart);
    const header = source.slice(headerStart, headerEnd);
    expect(header).not.toContain("TravellerBar");
    expect(header).toContain("PersonToken");
  });

  it("TravellerBar sigue existiendo, ahora dentro de Nosotros › Viajeros", async () => {
    const source = await read("App.tsx");
    const nosotrosStart = source.indexOf('aria-label="Viajeros"');
    const nosotrosEnd = source.indexOf("</section>", nosotrosStart);
    expect(source.slice(nosotrosStart, nosotrosEnd)).toContain("<TravellerBar");
  });

  it("el PersonToken de la cabecera es un control real que lleva a Nosotros (D4)", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(
      /className="app__person-token-button"[\s\S]{0,120}onClick=\{\(\) => setDestination\("nosotros"\)\}/
    );
  });

  it("PersonToken distingue a/b por orden de creación, no por color solo, y nunca apila dos tokens", async () => {
    const source = await read("components/PersonToken.tsx");
    expect(source).toContain('variant === "b"');
    expect(source).toContain("{initial}");
    expect(source).toMatch(/both[\s\S]*aria-label="Los dos queréis ir"/);
  });
});

describe("Bloque 18 — ficha a pantalla completa en teléfono (Art. 8, gate 11 §8)", () => {
  it(".app__detail es fixed/inset:0 en base, y vuelve a ser el panel de 420px sólo desde md", async () => {
    const css = await read("App.css");
    const base = css.match(/\.app__detail\s*{([^}]*)}/)?.[1] ?? "";
    expect(base).toMatch(/position:\s*fixed/);
    expect(base).toMatch(/inset:\s*0/);
    const mdBlock = css.slice(css.indexOf("@media (min-width: 840px) {\n  .app__body {"));
    expect(mdBlock).toMatch(/\.app__detail\s*{\s*position:\s*absolute;/);
    expect(mdBlock).toMatch(/width:\s*min\(420px,\s*100%\)/);
  });

  it("el z-index de la ficha supera al de TabBar/NavRail, para cubrirlos de verdad", async () => {
    const css = await read("App.css");
    const detailZ = Number(css.match(/\.app__detail\s*{[^}]*z-index:\s*(\d+)/)?.[1] ?? "0");
    expect(detailZ).toBeGreaterThan(50);
  });
});

describe("Bloque 18 — cinco superficies dejan de ser modales globales (gate 11 §11)", () => {
  const embeddedComponents: Array<[string, string]> = [
    ["components/SelectionAnalysis.tsx", "analysis-dialog--embedded"],
    ["components/OrderedSequenceBuilder.tsx", "analysis-dialog--embedded"],
    ["components/ZoneComparison.tsx", "zone-panel--embedded"],
    ["components/TravellerManager.tsx", "traveller-manager__dialog--embedded"],
    ["components/TripBackup.tsx", "trip-backup__dialog--embedded"],
  ];

  it.each(embeddedComponents)("%s acepta `embedded` y retira role=dialog/aria-modal cuando está activo", async (file) => {
    const source = await read(file);
    expect(source, file).toMatch(/embedded\??:\s*boolean/);
    expect(source, file).toMatch(/embedded\s*=\s*false/);
    expect(source, file).toMatch(/embedded\s*\?\s*undefined\s*:\s*(?:"dialog"|true)/);
  });

  it("App.tsx monta las cinco siempre con `embedded`, nunca como overlay global con scrim", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/<SelectionAnalysis[\s\S]{0,400}embedded/);
    expect(source).toMatch(/<OrderedSequenceBuilder[\s\S]{0,200}embedded/);
    expect(source).toMatch(/<ZoneComparison[\s\S]{0,300}embedded/);
    expect(source).toMatch(/<TravellerManager[\s\S]{0,400}embedded/);
    expect(source).toMatch(/<TripBackup[\s\S]{0,400}embedded/);
    // Las banderas booleanas de la era de overlays no deben sobrevivir como estado — pueden
    // seguir citadas en un comentario que explique el cambio (08 §"comentarios del código").
    for (const gone of [
      "travellerManagerOpen",
      "backupOpen",
      "sequenceBuilderOpen",
      "zonesOpen",
    ]) {
      expect(source, gone).not.toMatch(new RegExp(`use[Ss]tate[^;]*\\b${gone}\\b`));
    }
    expect(source).not.toMatch(/const \[analysisOpen, setAnalysisOpen\]/);
  });
});

describe("Bloque 18 — destinos como estado, no como historial (02 §D3, gate 11 §6/§7)", () => {
  it("los cuatro paneles de destino están siempre montados y se ocultan con `hidden`, no desmontados", async () => {
    const source = await read("App.tsx");
    const hiddenMatches = [...source.matchAll(/hidden=\{destination !== "([a-z-]+)"\}/g)].map((m) => m[1]);
    expect(hiddenMatches.sort()).toEqual(["explorar", "nosotros", "quiero-ir", "viaje"].sort());
  });

  it("`.destination-panel[hidden]` fuerza display:none con especificidad de atributo, no !important", async () => {
    const css = await read("App.css");
    expect(css).toContain(".destination-panel[hidden] {\n  display: none;\n}");
    expect(css).not.toMatch(/destination-panel[^{]*!important/);
  });

  it("seleccionar un lugar desde Quiero ir o Viaje reutiliza selectPlace, y cambia el destino a Explorar", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/const selectPlace = useCallback\(\s*\(id: string\) => \{[\s\S]*?setDestination\("explorar"\);/);
    expect(source).toContain("onSelect={selectPlace}");
    expect(source).toContain("onSelectPlace={selectPlace}");
  });
});

describe("Bloque 18 — MLIT reubicado, no eliminado (05 §3, gate 11 §12)", () => {
  it("MlitAttribution.tsx es la única fuente del texto, usada por el mapa nacional y por Nosotros", async () => {
    const mlit = await read("components/MlitAttribution.tsx");
    expect(mlit).toContain("mlit.go.jp");
    expect(mlit).toMatch(/no es un\s+producto oficial de MLIT/);
    const national = await read("components/NationalExplorer.tsx");
    expect(national).toContain("<MlitAttribution");
    const app = await read("App.tsx");
    expect(app).toContain("<MlitAttribution");
  });

  it("el aviso ya no es una franja permanente bajo el mapa: vive detrás de un botón ⓘ", async () => {
    const national = await read("components/NationalExplorer.tsx");
    expect(national).toContain("national__attribution-button");
    expect(national).toContain('aria-label="Fuente de la geometría del mapa (MLIT)"');
  });
});

describe("Bloque 18 — sin @media (max-width) nuevo (Art. 8, gate G4)", () => {
  it("App.css no gana ninguna consulta max-width nueva respecto al Bloque 17 (sigue en ≤9)", async () => {
    const css = await read("App.css");
    const count = [...css.matchAll(/@media\s*\(\s*max-width/g)].length;
    expect(count).toBeLessThanOrEqual(9);
  });

  it("toda regla nueva de shell usa min-width, nunca max-width", async () => {
    const css = await read("App.css");
    const shellSection = css.slice(
      css.indexOf("/* ---------- Shell (Bloque 18"),
      css.indexOf("/* ---------- Search + filters ---------- */")
    );
    expect(shellSection).not.toMatch(/@media\s*\(\s*max-width/);
    expect(shellSection).toMatch(/@media \(min-width: 840px\)/);
  });
});
