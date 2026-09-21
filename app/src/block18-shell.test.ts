import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
 *
 * Corrección final (Viaje → Lugar, `docs/BLOCK_18_HANDOFF.md §"DESIGN DECISION REQUIRED"`
 * resuelto): describe blocks añadidos al final del fichero cubren la decisión normativa que
 * cierra esa nota abierta — Viaje apila la ficha dentro de sí mismo, «Ver en el mapa» como
 * única salida explícita, el back label por origen, el puente con el historial real del
 * navegador y la separación de los tokens de ancho de Sheet/ficha. El comportamiento en vivo
 * (stack, scroll, single-instance, `page.goBack()`, responsive) lo cubren
 * `scripts/b18-viaje-lugar-check.mjs` y `scripts/b18-browser-back-check.mjs`.
 */

async function read(path: string): Promise<string> {
  return readFile(new URL(`./${path}`, import.meta.url), "utf8");
}

/** Raíz del repositorio git, dos niveles por encima de este fichero (`app/src/…`). */
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** SHA de `origin/main` antes del Bloque 18 — el punto de comparación del gate de tokens. */
const PRE_B18_SHA = "0833912c308fb28f203b69eaae716f5b566f7936";

/**
 * Líneas AÑADIDAS por este bloque a un fichero, respecto al SHA anterior a B18. Devuelve `null`
 * (en vez de lanzar) cuando el SHA base no está disponible en el histórico local — un clon poco
 * profundo, por ejemplo — para que el gate se salte en vez de fallar por una causa ajena al
 * propio código.
 */
function addedLines(relativePath: string): string[] | null {
  let diff: string;
  try {
    diff = execFileSync("git", ["diff", PRE_B18_SHA, "--", relativePath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return null;
  }
  const added = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  /*
   * Un `git diff` atribuye como «añadida» cualquier línea cuyo contexto se haya desplazado, no
   * sólo las nuevas de verdad: insertar una sección en medio del fichero hace que líneas
   * heredadas e intactas reaparezcan en el lado `+`. Eso convertía este gate en un detector de
   * ruido —`.save-toast`'s `#ff9e9e`, de v1.1.0, saltó así al añadir `PersistenceNotice`— en vez
   * de un detector de valores nuevos. Se descuenta lo que YA ESTABA en la versión base: un color
   * que ya existía no es un color que este bloque introduzca.
   */
  let base: string;
  try {
    base = execFileSync("git", ["show", `${PRE_B18_SHA}:${relativePath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return added;
  }
  const baseLines = new Set(base.split("\n").map((line) => line.trim()));
  return added.filter((line) => !baseLines.has(line.slice(1).trim()));
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
  /**
   * Corrección post-cierre (hallazgo 3, Art. 10): 56/48px son valores que `04 §11`/`05 §4` ya
   * fijan como parte del contrato — se consumen como tokens semánticos (`tokens.css`), no como
   * literales en `App.css`.
   */
  it("la cabecera mide --chrome-header-height y la barra única --chrome-bar-height, vía tokens", async () => {
    const css = await read("App.css");
    const tokens = await read("styles/tokens.css");
    expect(css).toMatch(/\.app__header\s*{[^}]*height:\s*var\(--chrome-header-height\);/);
    expect(css).toMatch(/\.explorer-bar\s*{[^}]*height:\s*var\(--chrome-bar-height\);/);
    expect(tokens).toContain("--chrome-header-height: 56px;");
    expect(tokens).toContain("--chrome-bar-height: 48px;");
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
    // Bloque 19 (B3, `04 §12`): la barra única ya no filtra un campo en el sitio — abre
    // `SearchSheet` como hoja casi a pantalla completa. `showSearch={false}` (el mecanismo B18
    // usaba para apagar un campo que `FilterPanel` sabía renderizar) desaparece porque
    // `FilterPanel` ya no sabe renderizar ningún campo de búsqueda en absoluto: la garantía de
    // "no duplicada" es ahora estructural, no un prop que hay que recordar poner en `false`.
    const tsx = await read("App.tsx");
    expect(tsx).toContain("explorer-bar__search");
    expect(tsx).toMatch(/<SearchSheet[\s\S]{0,600}\/>/);
    const filterPanel = await read("components/FilterPanel.tsx");
    expect(filterPanel).not.toContain("search-field");
    expect(filterPanel).not.toContain('type="search"');
  });
});

describe("Bloque 18 — retirada del conmutador «Eres» (DD-007, 02 §D4, gate 11 §9/§10)", () => {
  it("App.tsx no renderiza TravellerBar dentro de app__header", async () => {
    const source = await read("App.tsx");
    const headerStart = source.indexOf("<header className=");
    const headerEnd = source.indexOf("</header>", headerStart);
    const header = source.slice(headerStart, headerEnd);
    expect(header).toContain("app__header");
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
  it(".app__detail es fixed/inset:0 en base, y vuelve a ser el panel de 480px sólo desde md", async () => {
    const css = await read("App.css");
    const base = css.match(/\.app__detail\s*{([^}]*)}/)?.[1] ?? "";
    expect(base).toMatch(/position:\s*fixed/);
    expect(base).toMatch(/inset:\s*0/);
    const mdBlock = css.slice(css.indexOf("@media (min-width: 840px) {\n  .app__body {"));
    expect(mdBlock).toMatch(/\.app__detail\s*{\s*position:\s*absolute;/);
    // Corrección final (punto 5): `--panel-width` (420px, compartido con `Sheet`) era el error
    // normativo — `02 §D5`/`05 §5` fijan la ficha en 480px, distinto de `Sheet` (`04 §8`). Cada
    // uno tiene ahora su propio token.
    //
    // Corrección de B19 (DD-016, `09 §DD-016`): el segundo término pasa de `100%` a `50%`. La
    // ficha ES el raíl derecho desde `md`, y `02 §D5` acota el raíl a la mitad del ancho («el
    // mapa nunca pasa de la mitad del ancho»); con `100%` la ficha podía comerse la región de
    // lista entera en los anchos bajos de `md`. El token de 480px no cambia.
    expect(mdBlock).toMatch(/width:\s*min\(var\(--place-detail-panel-width\),\s*50%\)/);
  });

  it("el z-index de la ficha supera al de TabBar/NavRail, para cubrirlos de verdad", async () => {
    const css = await read("App.css");
    const detailZ = Number(css.match(/\.app__detail\s*{[^}]*z-index:\s*(\d+)/)?.[1] ?? "0");
    expect(detailZ).toBeGreaterThan(50);
  });
});

describe("Bloque 18 — corrección final: Sheet (420px) y ficha de lugar (480px) ya no comparten token (punto 5)", () => {
  it("tokens.css declara --sheet-panel-width: 420px y --place-detail-panel-width: 480px, y ya no --panel-width", async () => {
    const tokens = await read("styles/tokens.css");
    expect(tokens).toContain("--sheet-panel-width: 420px;");
    expect(tokens).toContain("--place-detail-panel-width: 480px;");
    expect(tokens).not.toMatch(/--panel-width:/);
  });

  it("Sheet en md+ consume --sheet-panel-width, no --place-detail-panel-width", async () => {
    const css = await read("App.css");
    const sheetMdBlock = css.slice(
      css.indexOf("@media (min-width: 840px) {\n  .sheet-scrim"),
      css.indexOf("/* ---------- Destinos: contenedor común")
    );
    expect(sheetMdBlock).toMatch(/\.sheet\s*{[^}]*width:\s*min\(var\(--sheet-panel-width\)/);
  });

  it("ningún componente escribe 420/480px como literal fuera de tokens.css (ambos anchos vía var())", async () => {
    const css = await read("App.css");
    const tsx = await read("App.tsx");
    expect(css).not.toMatch(/width:\s*min\(420px/);
    expect(css).not.toMatch(/width:\s*min\(480px/);
    // Lookbehind negativo: no debe atrapar `max-width: 420px`/`min-width: …`, que son media
    // queries de legado sin relación con el ancho del panel.
    expect(css).not.toMatch(/(?<!-)\bwidth:\s*420px\b/);
    expect(css).not.toMatch(/(?<!-)\bwidth:\s*480px\b/);
    // El único 420/480 aceptable en App.tsx es la constante JS que refleja el token para el
    // cálculo de `panelOffset` del mapa (no hay CSS-in-JS en este proyecto, así que no puede
    // leer var() directamente) — ver DETAIL_PANEL_WIDTH.
    expect(tsx).toContain("const DETAIL_PANEL_WIDTH = 480;");
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
    // Corrección final de B18: `onSelectPlace` ahora envuelve `selectPlace` para etiquetar el
    // origen (`"viaje"`/"Dónde dormir") en vez de pasarla en crudo — la ventana crece para
    // seguir alcanzando `embedded` tras esa prop más larga.
    expect(source).toMatch(/<ZoneComparison[\s\S]{0,400}embedded/);
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

  /**
   * Corrección post-cierre (auditoría independiente): la versión original de este test exigía
   * que `selectPlace` cambiara siempre a Explorar, lo que contradecía literalmente
   * `02 §"Mapa completo de pantallas"` ("Quiero ir └── Lugar · misma ficha que en Explorar") y
   * `02 §D3` ("la profundidad se apila dentro de una pestaña"). El mecanismo correcto: abrir un
   * lugar recibe un `origin`, y sólo cuando ese origen es "explorar" se toca `view`/`filters`/
   * `destination` — Quiero ir abre la misma ficha sin salir de su propia pestaña.
   */
  it("selectPlace acepta un origen y sólo navega a Explorar cuando el origen lo es", async () => {
    const source = await read("App.tsx");
    // Corrección final (punto 7): `selectPlace` gana un tercer parámetro, `originLabel`, para
    // el back label de Viaje — la firma del origen (y la regla de que sólo "explorar" navega)
    // no cambia.
    expect(source).toMatch(
      /const selectPlace = useCallback\(\s*\(id: string, origin: Destination = "explorar", originLabel: string \| null = null\) => \{/
    );
    expect(source).toMatch(/if \(origin === "explorar"\) \{[\s\S]*?setDestination\("explorar"\);/);
  });

  /**
   * Corrección final (`docs/BLOCK_18_HANDOFF.md`, DESIGN DECISION REQUIRED resuelto): la nota
   * abierta decía que abrir un lugar desde `ZoneComparison`/«Dónde dormir» navegaba a Explorar
   * (`ficheOrigin = "explorar"` por defecto) porque `02` no nombraba una ruta "Viaje └── Lugar"
   * propia. El propietario de diseño resolvió la decisión: apila dentro de Viaje, igual que
   * Quiero ir — sin excepciones (`02 §D3`, regla añadida).
   */
  it("Viaje abre lugares con origin=\"viaje\" y una etiqueta de origen, sin tocar el destino activo", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(
      /onSelectPlace=\{\(id\) => selectPlace\(id, "viaje", "Dónde dormir"\)\}/
    );
  });

  it("Quiero ir abre lugares con origin=\"quiero-ir\", sin tocar el destino activo", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/onSelect=\{\(id\) => selectPlace\(id, "quiero-ir"\)\}/);
    expect(source).toMatch(/selectPlace\(id, "quiero-ir"\)/);
  });

  it("un único `placeDetailOverlay` se monta en como mucho uno de los cuatro paneles, según ficheOrigin", async () => {
    const source = await read("App.tsx");
    expect(source).toContain("const placeDetailOverlay = selectedPlace ? (");
    const explorarSlot = (source.match(/\{ficheOrigin === "explorar" && placeDetailOverlay\}/g) ?? []).length;
    const quieroIrSlot = (source.match(/\{ficheOrigin === "quiero-ir" && placeDetailOverlay\}/g) ?? []).length;
    // Corrección final (punto 1): Viaje gana el mismo hueco condicional que Quiero ir ya tenía
    // — un tercer, y último, posible destino para el único `placeDetailOverlay`.
    const viajeSlot = (source.match(/\{ficheOrigin === "viaje" && placeDetailOverlay\}/g) ?? []).length;
    expect(explorarSlot).toBe(1);
    expect(quieroIrSlot).toBe(1);
    expect(viajeSlot).toBe(1);
    // Sólo una construcción de <PlaceDetail — no una copia por cada pestaña que pueda abrirla.
    expect((source.match(/<PlaceDetail\b/g) ?? []).length).toBe(1);
  });

  it("pushPlace/goBack (saltos «cerca de aquí» y volver) sólo tocan el hub de Explorar cuando la ficha es suya", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/const pushPlace = useCallback\(\s*\(id: string\) => \{[\s\S]{0,200}if \(ficheOrigin === "explorar"/);
    expect(source).toMatch(/const goBack = useCallback\(\(\) => \{[\s\S]{0,300}if \(ficheOrigin === "explorar"/);
  });

  it("PlaceList/PlaceMap sólo reciben una selección que sea la suya, nunca la de Quiero ir (evita el choque de Leaflet)", async () => {
    const source = await read("App.tsx");
    expect(source).toContain('const explorarSelectedId = ficheOrigin === "explorar" ? selectedId : null;');
    expect(source).toContain('const explorarSelectedPlace = ficheOrigin === "explorar" ? selectedPlace : null;');
    expect(source).toContain("selectedId={explorarSelectedId}");
    // Corrección final #2: PlaceMap ya no recibe explorarSelectedPlace en crudo — recibe
    // explorarMapPlace (explorarSelectedPlace, o si no hay ficha abierta, el foco dejado por
    // «Ver en el mapa»). PlaceList no cambia: sigue sin abrir nunca una ficha que no sea suya.
    expect(source).toContain("selectedPlace={explorarMapPlace}");
  });

  it("cerrar la ficha limpia también ficheOrigin, no sólo el historial", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/const closeDetail = useCallback\(\(\) => \{\s*setHistory\(\[\]\);\s*setFicheOrigin\(null\);/);
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
    // Bloque 19 (B3): la sección "Search + filters" de App.css quedó migrada por completo a
    // `styles/discovery.css` (08 §"Cómo tratar el CSS actual") y su comentario de cabecera
    // cambió en consecuencia — el límite de esta rebanada se actualiza con él.
    const shellSection = css.slice(
      css.indexOf("/* ---------- Shell (Bloque 18"),
      css.indexOf("/* ---------- Search + filters, PlaceCard, PlaceList")
    );
    expect(shellSection).not.toMatch(/@media\s*\(\s*max-width/);
    expect(shellSection).toMatch(/@media \(min-width: 840px\)/);
  });
});

/**
 * Corrección post-cierre (auditoría independiente, hallazgo 2): el handoff original afirmaba
 * que los cuatro destinos permanecen montados, pero `OrderedSequenceBuilder`/`ZoneComparison`
 * sólo se renderizaban bajo `destination === "viaje" && …`, así que cambiar de pestaña los
 * desmontaba de verdad. `viajeVisited` (fijado una vez, la primera vez que se entra en Viaje,
 * y nunca vuelto a `false`) es lo que ahora decide si se montan — `destination` sólo decide si
 * el panel exterior se ve.
 */
describe("Bloque 18 — Viaje conserva su estado al cambiar de pestaña (02 §D3)", () => {
  it("viajeVisited se fija en la primera visita y nunca vuelve a false", async () => {
    const source = await read("App.tsx");
    expect(source).toContain("const [viajeVisited, setViajeVisited] = useState(false);");
    expect(source).toContain('if (destination === "viaje" && !viajeVisited) setViajeVisited(true);');
  });

  it("el planificador y la comparación de zonas se montan por viajeVisited, no por destination", async () => {
    const source = await read("App.tsx");
    expect(source).not.toMatch(/\{destination === "viaje" && viajeSection === "planificar"/);
    expect(source).not.toMatch(/\{destination === "viaje" && viajeSection === "dormir"/);
    expect(source).toMatch(/\{viajeVisited && viajeSection === "planificar" && \(\s*<OrderedSequenceBuilder/);
    expect(source).toMatch(/\{viajeVisited && viajeSection === "dormir" && zonesHub && \(\s*<ZoneComparison/);
  });

  /**
   * Corrección final (punto 1): Viaje deja de ser un único `div` con ambas clases y pasa a la
   * misma estructura de dos niveles que Quiero ir ya usaba — exterior sin scroll (donde se
   * ancla la ficha, hermana de `.destination-panel--scroll`) e interior que sí scrollea
   * (sub-navegación + secciones). El exterior sigue ocultándose con `hidden` real, sin
   * desmontar nada; lo que cambia es que ya no lleva también la clase de scroll.
   */
  it("el panel exterior de Viaje sigue ocultándose con hidden real, no con un desmontaje", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/<div className="destination-panel" hidden=\{destination !== "viaje"\}>/);
    expect(source).not.toMatch(
      /<div className="destination-panel destination-panel--scroll" hidden=\{destination !== "viaje"\}>/
    );
  });

  it("Viaje apila la ficha dentro de su propio panel, hermana del contenido que scrollea, no de Nosotros", async () => {
    const source = await read("App.tsx");
    const viajeStart = source.indexOf('<div className="destination-panel" hidden={destination !== "viaje"}>');
    const viajeEnd = source.indexOf("{/* ---------------- Nosotros ---------------- */}");
    const viajeBlock = source.slice(viajeStart, viajeEnd);
    expect(viajeBlock).toContain('<div className="destination-panel--scroll">');
    expect(viajeBlock).toContain('{ficheOrigin === "viaje" && placeDetailOverlay}');
  });
});

/**
 * Corrección post-cierre, hallazgo 4a: `04 §10` exige icono relleno en el ítem activo, no sólo
 * un cambio de tinta — el color nunca es el único portador de una diferencia (Art. 11).
 */
describe("Bloque 18 — TabBar/NavRail: el activo cambia de glifo, no sólo de color (04 §10, Art. 11)", () => {
  it("Icon.tsx añade las tres variantes rellenas que faltaban, con la misma técnica que corazon-relleno", async () => {
    const icon = await read("icons/Icon.tsx");
    for (const name of ["explorar-relleno", "calendario-relleno", "personas-relleno"]) {
      expect(icon, name).toContain(`"${name}"`);
    }
    // Misma técnica ya aceptada desde el Bloque 17: la misma geometría, con fill="currentColor"
    // en vez de un icono nuevo o un segundo sistema.
    expect(icon).toMatch(/case "explorar-relleno":[\s\S]{0,150}fill="currentColor"/);
    expect(icon).toMatch(/case "calendario-relleno":[\s\S]{0,200}fill="currentColor"/);
    expect(icon).toMatch(/case "personas-relleno":[\s\S]{0,300}fill="currentColor"/);
  });

  it("AppNav.tsx usa el icono relleno para el ítem activo, el de línea para el resto", async () => {
    const nav = await read("components/AppNav.tsx");
    expect(nav).toMatch(/iconActive: "explorar-relleno"/);
    expect(nav).toMatch(/iconActive: "corazon-relleno"/);
    expect(nav).toMatch(/iconActive: "calendario-relleno"/);
    expect(nav).toMatch(/iconActive: "personas-relleno"/);
    expect((nav.match(/<Icon name=\{isActive \? item\.iconActive : item\.icon\}/g) ?? []).length).toBe(2);
  });
});

/**
 * Corrección post-cierre, hallazgo 4b: `04 §11` — "borde inferior --line que sólo aparece al
 * hacer scroll". La regla base debe dejar el borde transparente (mismo grosor, para no saltar
 * de layout cuando aparece) y sólo `.app__header--scrolled` debe pintarlo.
 */
describe("Bloque 18 — ScreenHeader: el borde inferior sólo aparece al hacer scroll (04 §11)", () => {
  it(".app__header no lleva --line en su borde base; sólo .app__header--scrolled lo hace", async () => {
    const css = await read("App.css");
    const base = css.match(/\.app__header\s*{([^}]*)}/)?.[1] ?? "";
    expect(base).toMatch(/border-bottom:\s*1px solid transparent;/);
    expect(base).not.toMatch(/border-bottom:\s*1px solid var\(--line\)/);
    const scrolled = css.match(/\.app__header--scrolled\s*{([^}]*)}/)?.[1] ?? "";
    expect(scrolled).toMatch(/border-bottom-color:\s*var\(--line\);/);
  });

  it("App.tsx deriva headerScrolled del scroll real de la superficie activa, no de una superficie fija", async () => {
    const source = await read("App.tsx");
    expect(source).toContain("const [headerScrolled, setHeaderScrolled] = useState(false);");
    expect(source).toContain(
      'const OWNER_SELECTOR = ".app__sidebar, .national__sidebar, .destination-panel--scroll";'
    );
    expect(source).toMatch(
      /className=\{`app__header \$\{headerScrolled \? "app__header--scrolled" : ""\}`\}/
    );
  });
});

/**
 * Corrección post-cierre, hallazgo 3: auditoría diff-scoped de Art. 10. Compara sólo las líneas
 * que este bloque añadió a `App.css`/`tokens.css` respecto al SHA anterior a B18 — no el legado
 * de bloques anteriores o posteriores — y falla si alguna introduce un color crudo o un tamaño
 * fuera de la escala de tokens sin pasar por `var(--…)`. Pensado para seguir protegiendo contra
 * regresiones mientras esta rama exista; un bloque futuro que quiera el mismo tipo de gate sobre
 * su propio rango de commits puede copiar el patrón con su propio SHA base.
 */
describe("Bloque 18 — Art. 10 sólo tokens, auditoría diff-scoped (03 §10, gate 11)", () => {
  it("App.css no introduce colores rgb/rgba/hex crudos respecto al SHA anterior a B18", () => {
    const lines = addedLines("app/src/App.css");
    if (lines === null) return; // SHA base no disponible en este checkout — no se puede auditar.
    const offenders = lines.filter((line) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line));
    expect(offenders).toEqual([]);
  });

  it("tokens.css no introduce colores crudos fuera de la sección 1 (paleta) al añadir tokens de shell", () => {
    const lines = addedLines("app/src/styles/tokens.css");
    if (lines === null) return;
    // La sección 8 (cromo del shell, Bloque 18) sólo debe declarar tamaños; ningún color nuevo.
    const shellTokenLines = lines.filter((line) => /--(chrome|person-token|info-button|sheet-grabber)-/.test(line));
    const rawColorInShellTokens = shellTokenLines.filter((line) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line));
    expect(rawColorInShellTokens).toEqual([]);
  });

  it("App.css no introduce tamaños/espaciados/radios/duraciones crudos fuera de var() sin justificación de legado", () => {
    const lines = addedLines("app/src/App.css");
    if (lines === null) return;
    const propertyPattern =
      /^\+\s*(font-size|padding|margin|gap|top|right|bottom|left|width|height|border-radius|animation-duration|transition-duration)\s*:\s*([^;]+);/;
    // Valores que ya existían en `v1.1.0` (antes de B18) y que este bloque se limitó a mover de
    // un mecanismo de layout a otro (grid → flex, max-width → min-width) sin cambiar su cifra —
    // no son una decisión visual nueva de este bloque. Cada uno está documentado en
    // `docs/BLOCK_18_HANDOFF.md`.
    const legacyValues = [
      "372px",
      "340px",
      "44vh",
      "240px",
      "1.3rem",
      "0.75rem",
      "1rem",
      "1.5rem",
      "0.9rem",
      "1.1rem",
      "1.5rem",
      "calc(100% - 1.5rem)",
      "88vh",
      "92vw",
      "72dvh",
      // No es legado de v1.1.0, sino el mismo valor que ya usa el `@media
      // (prefers-reduced-motion: reduce)` global de App.css (Bloque 17) para "instantáneo" —
      // aplicar la misma cifra ya aceptada a la animación nueva de `Sheet` no es un valor de
      // duración distinto, es la misma convención.
      "0.001ms",
      // Bloque 19 (B3): `.map-empty` es legado de v1.1.0, sin tocar por B18 ni por B19 — pero la
      // gran eliminación de B19 en otro punto del fichero (la sección "Search + filters" migrada
      // a `styles/discovery.css`) desplaza lo suficiente el resto del archivo como para que el
      // diff línea a línea de `git diff` deje de alinear `.map-empty` con su versión anterior a
      // B18 y la marque como "añadida" — un artefacto de la herramienta de diff, no un valor
      // nuevo. Las dos cifras de esa regla, documentadas aquí igual que el resto de legado.
      "50%",
      "1.25rem",
    ];
    const offenders = lines.filter((line) => {
      const match = line.match(propertyPattern);
      if (!match) return false;
      const value = match[2].trim();
      if (/var\(--/.test(value)) return false;
      if (/^(0|auto|none|100%|inherit|transparent|-?1)$/.test(value)) return false;
      if (legacyValues.some((legacy) => value.includes(legacy))) return false;
      return true;
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * Corrección final — punto 3/4: PlaceDetail gana `originLabel` (el back label nombra la
 * superficie real, nunca "Viaje" a secas) y `onViewOnMap` («Ver en el mapa», la única salida
 * explícita de una ficha de Viaje). Ninguno de los dos rediseña la ficha del Bloque 4: son
 * props opcionales, `undefined`/`null` reproduce el comportamiento anterior exactamente.
 */
describe("Bloque 18 — corrección final: back label por origen y «Ver en el mapa» en PlaceDetail", () => {
  it("PlaceDetail acepta originLabel/onViewOnMap como props opcionales, sin tocar el resto de la firma", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toMatch(/originLabel\?:\s*string \| null;/);
    expect(source).toMatch(/onViewOnMap\?:\s*\(\) => void;/);
    expect(source).toContain("originLabel = null,");
    expect(source).toContain("onViewOnMap,");
  });

  it("el back label usa previousPlace, luego originLabel, y si no hay ninguno cierra la ficha", async () => {
    // **Actualizada por el Bloque 20 (B4).** El requisito de B18 —el chevron nombra la
    // superficie real a la que vuelve, y `originLabel` decide cuál cuando no hay salto «cerca
    // de aquí»— sigue vigente palabra por palabra. Lo que cambió es el cromo que lo contenía:
    // `05 §5` retira el `×` flotante (defecto D4) y con él `.place-detail__bar`, así que la
    // prioridad ya no se expresa como un ternario de JSX dentro de la barra sino como un único
    // botón flotante cuyo destino se resuelve antes de renderizar. El tercer caso deja de ser
    // un `<span />` de relleno: el mismo botón cierra la ficha, conservando el nombre accesible
    // exacto de v1.1.0.
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain("const backTarget = previousPlace");
    expect(source).toContain("{ label: previousPlace.name, action: onBack }");
    expect(source).toContain("{ label: originLabel, action: onClose }");
    expect(source).toContain("{ label: null, action: onClose }");
    expect(source).toContain("aria-label={backAccessibleName}");
    expect(source).toContain("`Cerrar la ficha de ${place.name}`");
    // D4: ni barra ni `×` flotante.
    expect(source).not.toContain('className="place-detail__bar"');
    expect(source).not.toMatch(/<Icon name="cerrar"/);
  });

  it("«Ver en el mapa» es texto real, nunca icon-only, y sólo se renderiza si onViewOnMap existe", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toMatch(/\{onViewOnMap && \(/);
    expect(source).toMatch(/onClick=\{onViewOnMap\}[\s\S]{0,80}>\s*<Icon name="mapa"[^>]*\/>\s*Ver en el mapa/);
    // Reutiliza el patrón de botón secundario ya existente (mismo que "Abrir el planificador"
    // en ZoneComparison) — cero clase/CSS nueva para este control.
    expect(source).toContain('className="button button--secondary place-detail__view-on-map"');
  });

  it("App.css no define ninguna regla nueva para .place-detail__view-on-map (es sólo un selector de test sobre button--secondary)", async () => {
    const css = await read("App.css");
    expect(css).not.toMatch(/\.place-detail__view-on-map\s*{/);
  });
});

/**
 * Corrección final — punto 1/7: la propia decisión de diseño y el mecanismo de `ficheOrigin`/
 * `ficheOriginLabel`/`viewOnMap` en App.tsx que la implementa.
 */
describe("Bloque 18 — corrección final: Viaje → Lugar apila dentro de Viaje (02 §D3, DD-015)", () => {
  it("ficheOriginLabel se fija junto a ficheOrigin en selectPlace, y se limpia junto a él en closeDetail", async () => {
    const source = await read("App.tsx");
    expect(source).toContain(
      "const [ficheOriginLabel, setFicheOriginLabel] = useState<string | null>(null);"
    );
    expect(source).toMatch(/setFicheOrigin\(origin\);\s*setFicheOriginLabel\(originLabel\);/);
    expect(source).toMatch(/setFicheOrigin\(null\);\s*setFicheOriginLabel\(null\);/);
  });

  it("placeDetailOverlay sólo pasa originLabel/onViewOnMap cuando ficheOrigin es \"viaje\"", async () => {
    const source = await read("App.tsx");
    expect(source).toContain('originLabel={ficheOrigin === "viaje" ? ficheOriginLabel : null}');
    expect(source).toContain('onViewOnMap={ficheOrigin === "viaje" ? viewOnMap : undefined}');
  });
});

/**
 * Corrección final #2 — hallazgo posterior: la primera implementación de `viewOnMap` reutilizaba
 * `selectPlace(id, "explorar")`, que abre `PlaceDetail` de verdad (misma pila `history`/
 * `ficheOrigin` que cualquier apertura normal). La decisión aprobada es "cambia a Explorar y
 * centra el mapa", no "abre la ficha en Explorar" — en teléfono, donde la ficha es pantalla
 * completa, el mapa quedaba tapado justo tras pulsar el botón que decía llevar a verlo. Corregido
 * para cerrar el stack de Viaje del todo y centrar el mapa con un foco separado (`mapFocusId`),
 * sin volver a montar `PlaceDetail`. Comportamiento en vivo:
 * `scripts/b18-viaje-lugar-check.mjs`.
 */
describe("Bloque 18 — corrección final #2: «Ver en el mapa» centra el mapa sin reabrir la ficha", () => {
  it("mapFocusId es estado propio, separado de history/ficheOrigin — no un segundo store de lugar", async () => {
    const source = await read("App.tsx");
    expect(source).toContain("const [mapFocusId, setMapFocusId] = useState<string | null>(null);");
    // Sólo hay una construcción de PlaceDetail y sigue siendo la misma de siempre — mapFocusId
    // no introduce una segunda ficha ni un segundo camino de renderizado hacia PlaceDetail.
    expect((source.match(/<PlaceDetail\b/g) ?? []).length).toBe(1);
  });

  it("explorarMapPlace prioriza una ficha real abierta y sólo si no la hay usa el foco de «Ver en el mapa»", async () => {
    const source = await read("App.tsx");
    expect(source).toContain(
      "const explorarMapPlace = explorarSelectedPlace ?? mapFocusPlace;"
    );
    expect(source).toContain('selectedPlace={explorarMapPlace}');
    // panelOffset (el hueco reservado para el panel de escritorio) sigue atado sólo a que haya
    // una ficha de verdad — un foco de mapa sin ficha no debe reservar hueco de panel.
    //
    // Corrección de B19 (DD-016, `09 §DD-016`): la consulta pasa de `md` a `lg`
    // (`hasMapRail`/`MAP_RAIL_QUERY`). Desde `md` la ficha y el mapa ya no se solapan — son
    // superficies hermanas dentro del cuerpo —, y el mapa sólo vive permanentemente en el raíl
    // desde `lg` (`02 §D5`), que es el único ancho donde la ficha llega a cubrirlo. La condición
    // «sólo con una ficha de verdad abierta» es exactamente la misma.
    expect(source).toContain('panelOffset={hasMapRail && explorarSelectedPlace ? DETAIL_PANEL_WIDTH : 0}');
  });

  it("viewOnMap NO llama a selectPlace — cierra history/ficheOrigin directamente, como closeDetail", async () => {
    const source = await read("App.tsx");
    const start = source.indexOf("const viewOnMap = useCallback(() => {");
    const end = source.indexOf("}, [selectedPlace, activeHub]);", start);
    const body = source.slice(start, end);
    expect(body).toContain("setMapFocusId(place.id);");
    expect(body).toContain("setHistory([]);");
    expect(body).toContain("setFicheOrigin(null);");
    expect(body).toContain("setFicheOriginLabel(null);");
    expect(body).not.toContain("selectPlace(");
  });

  it("viewOnMap deshace del historial real del navegador toda la profundidad empujada por el stack de Viaje", async () => {
    const source = await read("App.tsx");
    const start = source.indexOf("const viewOnMap = useCallback(() => {");
    const end = source.indexOf("}, [selectedPlace, activeHub]);", start);
    const body = source.slice(start, end);
    expect(body).toMatch(/if \(navDepthRef\.current > 0\) \{\s*ignorePopRef\.current \+= 1;\s*window\.history\.go\(-navDepthRef\.current\);\s*navDepthRef\.current = 0;\s*\}/);
  });

  it("viewOnMap cambia a Explorar, selecciona el hub del lugar, y en teléfono cambia a la vista Mapa", async () => {
    const source = await read("App.tsx");
    const start = source.indexOf("const viewOnMap = useCallback(() => {");
    const end = source.indexOf("}, [selectedPlace, activeHub]);", start);
    const body = source.slice(start, end);
    expect(body).toContain('setDestination("explorar");');
    expect(body).toContain("if (place.hub !== activeHub) {");
    expect(body).toContain('setMobilePane("map");');
  });

  it("mapFocusId se limpia en cuanto una apertura real de ficha o un cambio de hub lo vuelven obsoleto", async () => {
    const source = await read("App.tsx");
    /** Extrae el código fuente entre dos marcadores, en el orden en que aparecen en App.tsx. */
    function between(startMarker: string, endMarker: string): string {
      const start = source.indexOf(startMarker);
      const end = source.indexOf(endMarker, start);
      expect(start, startMarker).toBeGreaterThan(-1);
      expect(end, endMarker).toBeGreaterThan(start);
      return source.slice(start, end);
    }
    // selectPlace: cualquier apertura real de lugar (incluido un click normal tras «Ver en el
    // mapa») limpia un foco de mapa que hubiera quedado suelto.
    expect(between("const selectPlace = useCallback(", "const pushPlace = useCallback(")).toContain(
      "setMapFocusId(null);"
    );
    // Cambiar de hub (manual, entrar desde el mapa nacional, o volver a Japón) también lo limpia
    // — el foco no tiene sentido en una ciudad distinta a la que se centró.
    expect(between("const switchHub = useCallback(", "const enterHub = useCallback(")).toContain(
      "setMapFocusId(null);"
    );
    expect(between("const enterHub = useCallback(", "const returnToJapan = useCallback(")).toContain(
      "setMapFocusId(null);"
    );
    expect(between("const returnToJapan = useCallback(", "const selectRegion = useCallback(")).toContain(
      "setMapFocusId(null);"
    );
  });
});

/**
 * Corrección final — punto 4: el puente entre la pila de fichas (`history`) y el historial real
 * del navegador, para que chevron back, gesto back y `page.goBack()` recorran la misma pila. El
 * comportamiento en vivo (`page.goBack()` real en Chromium) lo cubre
 * `scripts/b18-browser-back-check.mjs`; esto sólo protege que el mecanismo siga cableado.
 */
describe("Bloque 18 — corrección final: puente con el historial del navegador (punto 4)", () => {
  it("registra un único listener de popstate, que ignora los eventos auto-provocados", async () => {
    const source = await read("App.tsx");
    expect(source).toContain('window.addEventListener("popstate", onPopState);');
    expect((source.match(/addEventListener\("popstate"/g) ?? []).length).toBe(1);
    expect(source).toContain("if (ignorePopRef.current > 0) {");
  });

  it("selectPlace empuja una entrada nueva desde cero, y reemplaza si ya había una ficha abierta", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/if \(navDepthRef\.current === 0\) syncNavPush\(1\);\s*else syncNavReplace\(1\);/);
  });

  it("pushPlace (salto «cerca de aquí») empuja una entrada nueva por cada nivel", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/const next = \[\.\.\.historyRef\.current, id\];\s*setHistory\(next\);\s*syncNavPush\(next\.length\);/);
  });

  it("goBack/closeDetail mueven el historial real del navegador, no sólo el estado de React", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(/const goBack = useCallback\(\(\) => \{[\s\S]{0,600}window\.history\.back\(\);/);
    expect(source).toMatch(/const closeDetail = useCallback\(\(\) => \{[\s\S]{0,400}window\.history\.go\(-navDepthRef\.current\);/);
  });

  it("no cambia la URL pública: pushState/replaceState nunca reciben un segundo argumento de URL con contenido", async () => {
    const source = await read("App.tsx");
    const calls = [...source.matchAll(/window\.history\.(pushState|replaceState)\(\{[^}]*\},\s*"([^"]*)"\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call[2]).toBe("");
    }
  });
});
