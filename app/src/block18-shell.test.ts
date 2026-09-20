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
  return diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
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
    const tsx = await read("App.tsx");
    expect(tsx).toContain("explorer-bar__search");
    expect(tsx).toMatch(/<FilterPanel[\s\S]*?showSearch=\{false\}/);
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
  it(".app__detail es fixed/inset:0 en base, y vuelve a ser el panel de 420px sólo desde md", async () => {
    const css = await read("App.css");
    const base = css.match(/\.app__detail\s*{([^}]*)}/)?.[1] ?? "";
    expect(base).toMatch(/position:\s*fixed/);
    expect(base).toMatch(/inset:\s*0/);
    const mdBlock = css.slice(css.indexOf("@media (min-width: 840px) {\n  .app__body {"));
    expect(mdBlock).toMatch(/\.app__detail\s*{\s*position:\s*absolute;/);
    expect(mdBlock).toMatch(/width:\s*min\(var\(--panel-width\),\s*100%\)/);
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
    expect(source).toMatch(
      /const selectPlace = useCallback\(\s*\(id: string, origin: Destination = "explorar"\) => \{/
    );
    expect(source).toMatch(/if \(origin === "explorar"\) \{[\s\S]*?setDestination\("explorar"\);/);
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
    expect(explorarSlot).toBe(1);
    expect(quieroIrSlot).toBe(1);
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
    expect(source).toContain("selectedPlace={explorarSelectedPlace}");
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
    const shellSection = css.slice(
      css.indexOf("/* ---------- Shell (Bloque 18"),
      css.indexOf("/* ---------- Search + filters ---------- */")
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

  it("el panel exterior de Viaje sigue ocultándose con hidden real, no con un desmontaje", async () => {
    const source = await read("App.tsx");
    expect(source).toMatch(
      /<div className="destination-panel destination-panel--scroll" hidden=\{destination !== "viaje"\}>/
    );
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
