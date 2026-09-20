import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 4 — the wiring contract for choosing a zone and using it in the planner.
 *
 * Same source-scanning technique the rest of this directory uses: the repository still has no
 * component-level DOM harness and this block adds no dependency, so the pure invariants live in
 * `lib/planning-draft-v8.test.ts` and `lib/zone-plan-link.test.ts`, the real-viewport behaviour
 * lives in `scripts/block4-zone-planner-browser-audit.mjs`, and these assertions prove the
 * components actually wire the pure modules, render only honest copy, and never reach for a
 * routing, geometry-as-time, or booking shortcut.
 */

function readSource(name: string): Promise<string> {
  return readFile(new URL(`./${name}`, import.meta.url), "utf8");
}

function readAppSource(name: string): Promise<string> {
  return readFile(new URL(`../${name}`, import.meta.url), "utf8");
}

/** Strips comments, so a vocabulary scan asserts on what a component RENDERS rather than on what
 * its documentation explains. Block 4's doc comments deliberately name the things it refuses to do
 * ("no travel time", "never the best zone"), and scanning them raw would make the explanation
 * itself look like the violation. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("ZonePlanSection.tsx — what a chosen zone is allowed to say about the days", () => {
  it("reads the derived link from the pure module and computes no geometry of its own", async () => {
    const code = withoutComments(await readSource("ZonePlanSection.tsx"));
    expect(code).toMatch(/from "\.\.\/lib\/zone-plan-link"/);
    expect(code).not.toMatch(/straightLineKm|Math\.asin|Math\.atan2|EARTH_RADIUS/);
  });

  /**
   * The section's copy uses the word "minuto" on purpose — to say Nihon computed none, and that the
   * reader still types them. So this forbids a minute VALUE, not the vocabulary: no minute
   * formatter, no transfer lookup, and no interpolated number rendered as a duration.
   */
  it("never converts distance into time, and never calls the transfer graph", async () => {
    const code = withoutComments(await readSource("ZonePlanSection.tsx"));
    expect(code).not.toMatch(/getBestTransfer|lookupTransfer|formatMinutes|formatRange/);
    expect(code).not.toMatch(/\{[^}]*\}\s*min\b/);
    expect(code).not.toMatch(/\.minutes\b/);
    expect(code).not.toMatch(/\bfetch\b|XMLHttpRequest|navigator\./);
  });

  it("the only numbers it renders are kilometres and day ordinals", async () => {
    const code = withoutComments(await readSource("ZonePlanSection.tsx"));
    expect(code).toContain("formatZoneKm");
    expect(code).toContain("km");
    expect(code).toContain("dayOrdinal + 1");
  });

  it("labels every derived number as calculated and as straight-line", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toContain("zone-plan__tag--derived");
    expect(source).toContain("calculado");
    expect(source).toMatch(/línea recta/);
  });

  it("makes no optimality, ranking or recommendation claim", async () => {
    const code = withoutComments(await readSource("ZonePlanSection.tsx"));
    expect(code).not.toMatch(
      /ruta óptima|mejor zona|mejor hotel|te conviene|más conveniente|recomendad|recomienda|sugerimos|ideal para ti/i
    );
  });

  it("says out loud that nothing was booked and no time was computed", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toMatch(/no es un hotel reservado/i);
    expect(source).toMatch(/no ha calculado/i);
  });

  it("reports a different anchor as a neutral fact rather than a warning or an error", async () => {
    const code = withoutComments(await readSource("ZonePlanSection.tsx"));
    expect(code).toContain('case "other-anchor"');
    expect(code).not.toMatch(/conflicto|error|incorrecto|aviso|warning/i);
  });

  it("keeps a hub's zone out of another hub's day by requiring a single hub", async () => {
    const link = withoutComments(
      await readFile(new URL("../lib/zone-plan-link.ts", import.meta.url), "utf8")
    );
    expect(link).toContain("const singleHub = hubs.length === 1 ? hubs[0] : null;");
    expect(link).toContain("const rawChoice = singleHub ? findZoneChoiceForHub(choices, singleHub) : null;");
  });

  it("uses semantic buttons with accessible names, never a clickable div", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toMatch(/<button\s+type="button"/);
    expect(source).toMatch(/aria-label=\{`Quitar la zona elegida para \$\{link\.hub\}`\}/);
    expect(source).not.toMatch(/<div[^>]*onClick/);
    expect(source).not.toMatch(/<span[^>]*onClick/);
  });

  it("renders an honest empty state instead of hiding itself", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toContain("zone-plan__empty");
    expect(source).toMatch(/No habéis elegido ninguna zona todavía/);
  });

  it("explains a multi-hub day rather than attaching a zone to it", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toContain("zone-plan__multi-hub");
    expect(source).toMatch(/más de una ciudad/);
  });

  it("survives a zone that has left the catalogue without deleting the decision", async () => {
    const source = await readSource("ZonePlanSection.tsx");
    expect(source).toMatch(/zona ya no disponible/);
    expect(source).toMatch(/siguen aquí\s*\n?\s*intactos|intactos/);
  });
});

describe("ZoneComparison.tsx — the choice itself", () => {
  it("offers an explicit action whose wording is the reader's decision, not Nihon's verdict", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toContain("Usar esta zona en el plan");
    expect(source).toContain("Cambiar a esta zona");
    const code = withoutComments(source);
    expect(code).not.toMatch(/mejor zona|te conviene|recomendad|la más recomendable|deberíais elegir/i);
  });

  it("states what the choice did and what it did not do", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toMatch(/No es un hotel reservado/i);
    expect(source).toMatch(/no ha calculado ningún tiempo/i);
    expect(source).toMatch(/los\s*\n?\s*minutos de cada trayecto los seguís escribiendo vosotros|minutos de cada trayecto/i);
  });

  it("announces the change immediately through a live status region", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toMatch(/className="zone-choice-banner" role="status"/);
  });

  it("can always change or remove the choice", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toContain("Quitar del plan");
    expect(source).toContain("Quitar la zona elegida");
    expect(source).toMatch(/onClick=\{clearZone\}/);
  });

  it("gives the two remove controls distinct accessible names", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toMatch(/aria-label=\{`Quitar la zona elegida para \$\{hub\}`\}/);
    expect(source).toMatch(/aria-label=\{`Quitar \$\{zone\.name\} del plan`\}/);
  });

  it("names the zone in every accessible label, so the control is unambiguous out of context", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toMatch(/aria-label=\{`Quitar \$\{zone\.name\} del plan`\}/);
    expect(source).toMatch(/Cambiar la zona del plan a \$\{zone\.name\}/);
    expect(source).toMatch(/Usar \$\{zone\.name\} en el plan/);
  });

  it("offers the empty state as an invitation, not as a nag", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toMatch(/Aún no habéis elegido zona/);
  });

  it("hands the reader on to the planner rather than opening a second modal", async () => {
    const source = await readSource("ZoneComparison.tsx");
    expect(source).toContain("Abrir el planificador");
    expect(source).toMatch(/onClick=\{onOpenPlanner\}/);
    expect(withoutComments(source)).not.toMatch(/role="dialog"[\s\S]{0,200}role="dialog"/);
  });

  it("writes through the pure module and computes no travel time", async () => {
    const code = withoutComments(await readSource("ZoneComparison.tsx"));
    expect(code).toContain('from "../useZonePlanChoice"');
    expect(code).not.toMatch(/getBestTransfer|lookupTransfer|\bfetch\b/);
  });
});

describe("useZonePlanChoice.ts — one writer, one truth", () => {
  it("writes the planning draft and never a second storage key", async () => {
    const source = await readAppSource("useZonePlanChoice.ts");
    expect(source).toContain('from "./lib/planning-draft-v8"');
    const keys = [...source.matchAll(/"nihon\.[A-Za-z0-9.]+"/g)].map((match) => match[0]);
    expect(keys).toEqual([]);
    expect(withoutComments(source)).not.toContain("nihon.zoneComparison");
  });

  it("re-reads the canonical draft on every mutation rather than caching one", async () => {
    const code = withoutComments(await readAppSource("useZonePlanChoice.ts"));
    expect(code.match(/readDraft\(savedIds\)/g) ?? []).toHaveLength(3);
    expect(code).toContain("writeDraft(browserStorage, next)");
    // The only React state is the render-only snapshot, never a draft.
    expect(code.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(code).toMatch(/useState<ZonePlanChoiceSnapshot>/);
  });

  it("seeds the anchor from the zone's own registry label and coordinate", async () => {
    const code = withoutComments(await readAppSource("useZonePlanChoice.ts"));
    expect(code).toContain("label: zone.anchor.label");
    expect(code).toContain("location: { lat: zone.anchor.lat, lng: zone.anchor.lng }");
  });

  it("derives no duration, distance or ranking", async () => {
    const code = withoutComments(await readAppSource("useZonePlanChoice.ts"));
    expect(code).not.toMatch(/straightLineKm|minutes|rank|score|getBestTransfer|\bfetch\b/i);
  });

  it("surfaces whether removing the zone would keep the anchor", async () => {
    const source = await readAppSource("useZonePlanChoice.ts");
    expect(source).toContain("anchorInUse");
    expect(source).toContain("isAccommodationAnchorInUse");
  });
});

/**
 * Bloque 18 (`02 §D2`, gate 11) — el planificador y la comparación de zonas dejan de ser dos
 * overlays booleanos independientes ("cerrar uno abre el otro") y pasan a ser las dos secciones,
 * mutuamente excluyentes POR CONSTRUCCIÓN, de un único `ViajeSection` en la pestaña «Viaje». La
 * invariante de un solo escritor del borrador (Bloque 4) es la misma; sólo cambia el mecanismo de
 * ingeniería que la hace cumplir, de dos booleanos coordinados a mano a un enum de un solo valor.
 */
describe("App.tsx — exactly one writer of the draft at a time", () => {
  it("makes the comparison and the planner mutually exclusive via a single section enum", async () => {
    const source = await readAppSource("App.tsx");
    expect(source).toMatch(/type ViajeSection = "planificar" \| "dormir";/);
    expect(source).toMatch(/const \[viajeSection, setViajeSection\] = useState<ViajeSection>\("planificar"\);/);
  });

  it("routes every entry point through the tracked section setter or the planner/zones navigators", async () => {
    const source = await readAppSource("App.tsx");
    expect(source).toContain('setViajeSectionTracked("planificar")');
    expect(source).toContain('setViajeSectionTracked("dormir")');
    expect(source).toContain("onBuildSequence={goToPlanner}");
    expect(source).toContain("onOpenPlanner={goToPlanner}");
    // The raw setter must not be reachable from a rendered control directly — only through the
    // tracked wrapper, which is what bumps `plannerRevision` on the way out of "planificar".
    expect(source).not.toMatch(/onClick=\{\(\) => setViajeSection\("dormir"\)\}/);
  });

  /**
   * Corrección post-cierre (auditoría independiente, hallazgo 2): "sólo mientras su sección
   * está activa" se leyó primero como "mientras `destination === 'viaje'`", lo que desmontaba
   * el planificador/las zonas al cambiar de pestaña — el handoff original afirmaba lo contrario.
   * La lectura correcta de `02 §D3` es "mientras `viajeSection` sigue siendo la suya", sin
   * importar qué pestaña esté activa; `viajeVisited` decide el primer montaje (una sola vez).
   */
  it("keeps the planner and the zone comparison mounted by viajeSection, independently of the active tab", async () => {
    const source = await readAppSource("App.tsx");
    expect(source).toMatch(
      /\{viajeVisited && viajeSection === "planificar" && \(\s*<OrderedSequenceBuilder/
    );
    expect(source).toMatch(
      /\{viajeVisited && viajeSection === "dormir" && zonesHub && \(\s*<ZoneComparison/
    );
  });
});

describe("OrderedSequenceBuilder.tsx — the planner's side of the link", () => {
  it("renders the zone section from the draft's own choices", async () => {
    const source = await readSource("OrderedSequenceBuilder.tsx");
    expect(source).toContain("<ZonePlanSection");
    expect(source).toContain("choices={zoneAccommodationChoices}");
    expect(source).toContain("onClear={clearZoneAccommodation}");
  });

  it("derives the day links on read and persists nothing derived", async () => {
    const source = await readSource("OrderedSequenceBuilder.tsx");
    expect(source).toMatch(/const zoneDayLinks = useMemo\(/);
    expect(source).toMatch(/const zoneHubLinks = useMemo\(/);
    expect(source).not.toMatch(/setDraft[\s\S]{0,80}zoneDayLinks/);
  });

  it("marks zone-seeded anchors in the manager without giving them any privilege", async () => {
    const source = await readSource("OrderedSequenceBuilder.tsx");
    expect(source).toContain("findZoneChoiceForAnchor(zoneChoices, anchor.id)");
    expect(source).toContain("de la zona elegida en {seeding.hub}");
    // Still one flat list: nothing sorts, filters or promotes a seeded anchor.
    expect(source).not.toMatch(/accommodations\s*\.\s*(sort|filter)\(/);
  });

  it("warns that deleting a seeded anchor also drops the zone choice", async () => {
    const source = await readSource("OrderedSequenceBuilder.tsx");
    expect(source).toMatch(/se quita también esa zona elegida/);
    expect(source).toMatch(/Eliminar alojamiento \$\{anchor\.label\} y la zona elegida en \$\{seeding\.hub\}/);
  });

  it("leaves the manual accommodation contract untouched — the user still types every minute", async () => {
    const source = await readSource("OrderedSequenceBuilder.tsx");
    expect(source).toContain("Minutos de este trayecto (dato manual)");
    expect(source).toContain("isValidManualAccommodationMinutes(value)");
    // No zone value is ever written into a leg.
    expect(source).not.toMatch(/onLegChange\([^)]*zone/i);
  });
});
