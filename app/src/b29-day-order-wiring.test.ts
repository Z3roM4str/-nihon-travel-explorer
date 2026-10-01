import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Place } from "./types";
import { DayOrderSheet } from "./components/DayOrderSheet";
import { PLANNING_DRAFT_STORAGE_KEY, PLANNING_DRAFT_VERSION } from "./lib/planning-draft-v8";

/**
 * B29 (B9.3) — cableado y contrato de copia de «Probar otro orden» (línea Claude). El comportamiento
 * real (foco, teclado, almacenamiento, responsive) lo mide `scripts/b29-day-tools-check.mjs` en
 * Chromium; aquí se fijan las decisiones estructurales y de redacción que no deben degradarse.
 */

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const NEVER = /\b(mejor(?!a)|mejores|recomend\w*|ranking|ganador\w*|gana\b|óptim\w*|optimiz\w*|score|puntuaci\w*|ahorr\w*|más rápid\w*)/i;

describe("B29 — «Probar otro orden» sustituye a la comparación global", () => {
  it("ya no existe la vista global ni el botón de primer nivel", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    expect(builder).not.toMatch(/useState<"compare"/);
    expect(builder).not.toMatch(/openComparison|closeComparison|candidateAIds|candidateBIds|sequence-compare-toggle/);
    expect(builder).not.toMatch(/Comparar órdenes|Volver a los días|Orden A|Orden B/);
    expect(builder).not.toMatch(/ReorderableList|CandidateSummary|comparisonResultText/);
  });

  it("cada día elegible (≥2 paradas) tiene su acción, dirigida por id estable", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    expect(builder).toMatch(/places\.length >= 2 && dayEntity/);
    expect(builder).toContain("id={`day-order-open-${dayEntity.id}`}");
    expect(builder).toContain("setDayOrderFor(dayEntity.id)");
    expect(builder).toContain("dayEntities.findIndex((day) => day.id === dayOrderFor)");
    expect(builder).toContain("aria-label={`Probar otro orden en el Día ${dayIndex + 1}`}");
    expect(builder.match(/<DayOrderSheet/g)).toHaveLength(1);
  });

  it("las alternativas salen de los generadores existentes, agrupadas por el día abierto y sin reordenar", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    for (const generator of [
      "generateEvidenceCompleteLocalSwaps(",
      "generateEvidenceCompleteLocalRelocations(",
      "generateEvidenceCompleteInteriorTranspositions(",
      "generateEvidenceCompleteFourPlaceInteriorReversals(",
      "generateEvidenceCompleteTwoPairBlockSwaps(",
    ]) {
      expect(builder.split(generator).length - 1, generator).toBe(1);
    }
    for (const group of ["localSwapsByDayId", "localRelocationsByDayId", "interiorTranspositionsByDayId", "fourPlaceReversalsByDayId", "twoPairBlockSwapsByDayId"]) {
      expect(builder).toContain(`${group}.get(dayOrderEntity.id) ?? []`);
    }
    expect(builder.match(/<LocalSwapAlternativesSection/g)).toHaveLength(1);
    const section = builder.slice(builder.indexOf("function LocalSwapAlternativesSection"), builder.indexOf("export function OrderedSequenceBuilder("));
    expect(section).not.toMatch(/\.sort\(|\.slice\(|\.reverse\(|\[0\]/);
    // cinco familias, todas etiquetadas
    expect(section.match(/Comprobado con datos completos/g)).toHaveLength(5);
    expect(section.match(/onClick=\{\(\) => onLoad\(alternative\.candidateDayPlaceIds\)\}/g)).toHaveLength(5);
  });

  it("los cinco apply* de dominio ya no se llaman desde la interfaz (nada se aplica solo)", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    expect(builder).not.toMatch(/applyEvidenceComplete\w+\(/);
    expect(builder).not.toMatch(/movePlaceWithinDay|relocatePlaceWithinDay|transposePlacesWithinDay|reverseFourPlacesWithinDay|swapTwoPairBlocksWithinDay/);
  });
});

describe("B29 — una sola escritura: «Usar este orden»", () => {
  it("la hoja no importa el borrador, el hook ni el almacenamiento; sólo onApply escribe, desde un botón", async () => {
    const sheet = strip(await read("./components/DayOrderSheet.tsx"));
    expect(sheet).not.toMatch(/planning-draft|usePlanningDraft|localStorage|sessionStorage|deviceStorage|setDraft/);
    expect(sheet.match(/onApply\(/g)).toHaveLength(1);
    expect(sheet).toMatch(/onClick=\{\(\) => onApply\(proposalIds\)\}/);
    expect(sheet).toContain("Usar este orden");
    // cerrar / Escape / Cancelar son onClose, nunca onApply
    expect(sheet.match(/onClick=\{onClose\}/g)).toHaveLength(1);
    expect(sheet).toMatch(/<Sheet [^>]*onClose=\{onClose\}/);
    expect(sheet).not.toMatch(/useEffect\([^)]*onApply/);
  });

  it("el builder escribe únicamente desde applyDayOrder, con la mutación B28 de mismo día", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    const start = builder.indexOf("function applyDayOrder");
    const apply = builder.slice(start, builder.indexOf("function addDay", start));
    expect(apply).toContain("planDayOrderMoves(entity.placeIds, proposalIds)");
    expect(apply).toContain("movePlaceToPosition(entity.id, entity.id, move.from, move.to)");
    expect(builder.match(/applyDayOrder\(/g)).toHaveLength(1); // sólo la definición: la hoja lo recibe como referencia
    expect(builder).toContain("onApply={applyDayOrder}");
    expect(builder).toContain("onClose={closeDayOrder}");
    const close = builder.slice(builder.indexOf("function closeDayOrder"), builder.indexOf("function applyDayOrder"));
    expect(close).not.toMatch(/movePlaceToPosition|setDraft/);
  });

  it("la propuesta es estado transitorio: sin persistencia y sin cambio de esquema ni clave", async () => {
    const sheet = strip(await read("./components/DayOrderSheet.tsx"));
    expect(sheet).toMatch(/useState<string\[\]>\(\(\) => \[\.\.\.currentIds\]\)/);
    expect(PLANNING_DRAFT_VERSION).toBe(8);
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });
});

describe("B29 — comparación y redacción neutrales (Art. 5)", () => {
  it("reutiliza sequence-comparison: compareSequences, sin segundo cálculo de tiempos", async () => {
    const sheet = strip(await read("./components/DayOrderSheet.tsx"));
    expect(sheet).toMatch(/compareSequences\(currentIds, proposalIds\)/);
    expect(sheet).not.toMatch(/getBestTransfer|orderedSequenceFromLookup|buildOrderedSequence|minMinutes\s*[-+<>]/);
  });

  it("ninguna copia de la hoja ni de la comparación habla de mejor, recomendado, ranking, ganador o puntuación", async () => {
    const sheet = strip(await read("./components/DayOrderSheet.tsx"));
    // sólo el texto visible: literales y JSX
    const copy = [...sheet.matchAll(/"([^"\n]*[a-záéíóú][^"\n]*)"|`([^`\n]*)`|>\s*([^<>{}\n][^<>{}]*)</g)].map((m) => m[1] ?? m[2] ?? m[3]).join("\n");
    expect(copy).not.toMatch(NEVER);
    expect(copy).toContain("Vosotros decidís el orden");
  });

  it("la redacción de las alternativas de dominio no cambia hacia una recomendación", async () => {
    const builder = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    const section = builder.slice(builder.indexOf("function LocalSwapAlternativesSection"), builder.indexOf("export function OrderedSequenceBuilder("));
    const copy = section.replace(/className="[^"]*"/g, "");
    expect(copy).not.toMatch(NEVER);
  });
});

function place(id: string, name: string): Place {
  return { id, name, duration: { raw: "1 h" } } as unknown as Place;
}

describe("B29 — la hoja al abrirse (render inicial)", () => {
  const placeById = new Map([place("a", "Alfa"), place("b", "Beta"), place("c", "Gamma")].map((p) => [p.id, p]));
  const html = renderToStaticMarkup(
    createElement(DayOrderSheet, {
      headline: "Día 2 · jue 25 feb · Kioto",
      dayNumber: 2,
      currentIds: ["a", "b", "c"],
      placeById,
      renderAlternatives: () => createElement("p", { "data-alt": "" }, "opciones"),
      onApply: () => {},
      onClose: () => {},
    })
  );

  it("muestra «Orden actual» y «Otro orden» con las mismas paradas, en el mismo orden, del día abierto", () => {
    expect(html).toContain("Probar otro orden · Día 2");
    expect(html).toContain("Orden actual");
    expect(html).toContain("Otro orden");
    const names = [...html.matchAll(/sequence-item__name">([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(["Alfa", "Beta", "Gamma", "Alfa", "Beta", "Gamma"]);
  });

  it("empieza igual que el actual: «Usar este orden» deshabilitado y comparación «igual», sin propuesta de Nihon", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Usar este orden<\/button>/);
    expect(html).toContain("El otro orden es igual al orden actual.");
    expect(html).toContain("Cancelar");
    expect(html).toContain("data-alt");
    expect(html).not.toMatch(NEVER);
    expect(html).not.toMatch(/aria-grabbed|draggable/);
  });

  it("primer ↑ y último ↓ de «Otro orden» deshabilitados; nombres accesibles por parada", () => {
    expect(html).toContain('aria-label="Mover Alfa hacia arriba en otro orden"');
    expect(html).toMatch(/id="day-order-up-a"[^>]*disabled=""/);
    expect(html).toMatch(/id="day-order-down-c"[^>]*disabled=""/);
  });
});
