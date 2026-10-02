import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { interestLevelForGrade } from "./lib/interest-level";
import { plannedNote } from "./lib/divergence-presentation";
import { OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE } from "./lib/reservation-mechanism-calendar-presentation";

/**
 * D5 — vocabulario normativo (`docs/D5_NORMATIVE_VOCABULARY_MISSION.md`, `00 Art. 7`, `03 §10`).
 * Distingue código interno de interfaz visible: no hay un grep bruto sobre `app/src`; se fijan las cadenas
 * visibles sustituidas, las excepciones y la deuda registrada, y que `lib/`, `data/` y los hooks no se tocan.
 */

const BASE_SHA = "b854db384c952e827b86d1bb35cac7caa70b035a"; // main tras B31 (base de la reconciliación D0b + D5)
/**
 * Fin del alcance de D5: el merge de #178 (D0b + D5 sobre main tras B31). El test de alcance mide ESE diff, no `HEAD`: comparar con `HEAD`
 * lo rompe con cada cambio legítimo posterior de `lib/` o `data/` (B10, hardening) sin que D5 haya cambiado. Lo posterior lo protegen
 * sus propias pruebas (p. ej. `photography-runtime-projection.test.ts`).
 */
const D5_END_SHA = "2a10ad3f11cd91a7d739e85307f04da9411bf5d1";
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const src = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8");

/** Art. 7 / `03 §10`. */
const FORBIDDEN =
  /\brecorridos?\b|\bsecuencias?\b|\bconstructor\b|\borden(?:es)? [AB]\b|\btramos?\b|\bcandidat[oa]s?\b|\bDato:|\bgrados?\b|\bprovenance\b|\bfreshness\b|analizar selecci[oó]n|\bcobertura\b/i;

/** Cadenas visibles (literales entre comillas o texto JSX) de un fichero, sin comentarios ni imports. */
function visibleStrings(file: string): string[] {
  const code = src(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^import[\s\S]*?;$/gm, "");
  const out: string[] = [];
  for (const m of code.matchAll(/"([^"\n]*[A-Za-zÁ-ú][^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2]);
  for (const m of code.matchAll(/>([^<>{}\n]*[A-Za-zÁ-ú][^<>{}\n]*)</g)) out.push(m[1]);
  for (const m of code.matchAll(/^\s+([A-ZÁ-Ú][^<>{}=;\n]*[a-zá-ú.])\s*$/gm)) out.push(m[1]);
  return out.map((s) => s.replace(/\s+/g, " ").trim());
}

describe("D5 — copy visible sustituido: los términos prohibidos ya no están en los componentes afectados", () => {
  it.each([
    "components/TripBackup.tsx",
    "components/TravellerManager.tsx",
    "components/SequenceCandidateSummary.tsx",
    "components/DayOrderToolPanel.tsx",
    "lib/day-order-tool.ts",
  ])("%s: ninguna cadena visible usa un término de Art. 7", (file) => {
    const bad = visibleStrings(file).filter((s) => FORBIDDEN.test(s));
    expect(bad).toEqual([]);
  });

  /**
   * D5-M1 (CERRADO en el endurecimiento post-B10): las vistas «builder» y «compare» de OrderedSequenceBuilder eran código
   * muerto con copy prohibido («Construir recorrido», «Volver al recorrido», «Guardados fuera del recorrido», «Orden A/B»).
   * Se demostró que no eran alcanzables, que ningún estado persistido ni contrato vigente dependía de ellas y que B29 las
   * sustituyó por «Probar otro orden» (por día, sin A/B): se RETIRARON con su código, copy, CSS y pruebas
   * (`docs/D5_M1_UNREACHABLE_VIEWS_RETIREMENT.md`). Este test fija que no vuelvan, ni ellas ni su copy.
   */
  const RETIRED_VIEW_STRINGS = [
    "Construir recorrido",
    "Volver al recorrido",
    "Este recorrido se guarda automáticamente en este navegador",
    "El recorrido está vacío. Añade lugares guardados",
    "Guardados fuera del recorrido",
    "Siguen en Quiero ir. Añádelos aquí",
    "al recorrido",
    "Comparar otro orden",
    "Comparar órdenes",
    "Orden A",
    "Orden B",
    " en orden A",
    " en orden B",
    "Restablecer lugares y días",
    "Restablecer recorrido",
  ];

  it("OrderedSequenceBuilder: ninguna cadena visible usa un término de Art. 7 (ya no hay excepciones)", () => {
    const bad = visibleStrings("components/OrderedSequenceBuilder.tsx").filter((s) => FORBIDDEN.test(s));
    expect(bad).toEqual([]);
  });

  it("las vistas builder/compare y su copy están retiradas (D5-M1)", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).not.toMatch(/useState<"builder"/);
    expect(builder).not.toMatch(/\bsetView\(/);
    for (const name of ["openComparison", "closeComparison", "openDayAssignment", "comparisonResultText", "candidateAIds", "candidateBIds"]) {
      expect(builder, name).not.toContain(name);
    }
    for (const text of RETIRED_VIEW_STRINGS) expect(builder, text).not.toContain(text);
    // El A/B global no existe tampoco como control en ningún componente vivo.
    for (const file of ["App.tsx", "components/DayOrderToolPanel.tsx", "components/TripReservations.tsx", "components/TripTimeline.tsx"]) {
      for (const text of ["Comparar otro orden", "Comparar órdenes", "Orden A", "Orden B"]) expect(src(file), `${file}: ${text}`).not.toContain(text);
    }
  });

  it("sustituciones exactas (antes → después)", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    for (const text of [
      "en el viaje actual",
      "ya no forma parte del viaje actual.",
      "ya no son consecutivos en el viaje actual.",
      "Este traslado queda inactivo porque el reparto por días no es válido.",
      "Traslado principal entre estos dos puntos",
      "ningún traslado entre ciudades",
      "Eliminar traslado ${fromName} a ${toName}",
      "Duración manual del traslado principal",
      "Añadir traslado",
    ]) {
      expect(builder, text).toContain(text);
    }
    expect(src("components/TripBackup.tsx")).toContain("Lugares en el viaje");
    expect(src("components/TravellerManager.tsx")).toContain("El plan del viaje, los días, las fechas y el");
    expect(src("components/SequenceCandidateSummary.tsx")).toContain("Sin traslados en este día");
    expect(src("lib/day-order-tool.ts")).toContain("Con los traslados desconocidos no se declara un ganador.");
  });
});

describe("D5 — los valores y relaciones del copy no cambian", () => {
  // E01/E02/E03: approval in B10_AUTHORIZED_CONTINUATION_REPORT; preserve the ratio in partials.
  it("los conteos N/M parciales y de conexiones sin tiempo siguen interpolados", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain('{complete ? "traslados totales" : "traslados conocidos"} · {knownLegCount}');
    expect(builder).toContain('{complete ? "" : ` de ${legCount}`}');
    expect(builder).toContain("{unknownLegCount}");
    expect(builder).toContain('{complete ? "traslados totales" : "traslados conocidos"}');
    expect(src("components/SequenceCandidateSummary.tsx")).toContain("${summary.knownLegCount}/${summary.legCount} traslado");
    expect(src("components/SequenceCandidateSummary.tsx")).toContain("${summary.unknownLegCount} sin traslado");
  });
});

describe("D5 — ARIA y títulos", () => {
  it("el botón de cerrar el planificador nombra la superficie, sin «constructor»", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("aria-label={`Cerrar ${headerTitle}`}");
    expect(builder).toContain("title={`Cerrar ${headerTitle}`}");
    expect(builder).not.toMatch(/constructor de recorrido/);
  });
  it("«Eliminar traslado …» (aria-label y title) conserva origen y destino", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("aria-label={`Eliminar traslado ${fromName} a ${toName}`}");
    expect(builder).toContain("title={`Eliminar traslado ${fromName} a ${toName}`}");
  });
});

describe("D5 — excepciones y términos que NO se tocan", () => {
  it("E1: «Grado original» sigue dentro de «Fuentes» plegado de PlaceDetail", () => {
    const detail = src("components/PlaceDetail.tsx");
    const sources = detail.slice(detail.indexOf('<details className="place-sources">'));
    expect(sources.slice(0, sources.indexOf("</details>"))).toContain("<dt>Grado original</dt>");
  });
  it("«reparto» (12 §11) se conserva", () => {
    expect(src("components/OrderedSequenceBuilder.tsx")).toContain("Este traslado queda inactivo porque el reparto por días no es válido.");
    expect(src("components/OrderedSequenceBuilder.tsx")).toContain("El reparto por días no coincide exactamente con el viaje");
    expect(src("components/OrderedSequenceBuilder.tsx")).toMatch(/El reparto actual no coincide exactamente con el\s+viaje\./);
  });
});

describe("D5 — los cinco DDR cerrados (decisiones L1/L2/L3/R1/latente)", () => {
  it("L1: «intervalo de fechas registrado» (nunca «traslado») en las tres relaciones", () => {
    const lib = src("lib/reservation-mechanism-reference-date-presentation.ts");
    expect(lib).toContain("está antes del intervalo de fechas registrado para la solicitud.");
    expect(lib).toContain("cae dentro del intervalo de fechas registrado para la solicitud.");
    expect(lib).toContain("está después del intervalo de fechas registrado para la solicitud.");
    expect(visibleStrings("lib/reservation-mechanism-reference-date-presentation.ts").filter((s) => FORBIDDEN.test(s))).toEqual([]);
    expect(lib).not.toMatch(/traslado de fechas/);
  });
  it("L2: la nota de ancla del calendario dice «intervalo»", () => {
    expect(OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE).toBe("Situado en esta lista por la fecha de inicio registrada del intervalo.");
    expect(FORBIDDEN.test(OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE)).toBe(false);
  });
  it("L3: «Ya está en un día del viaje», y la lógica no cambia (null para acordados / no planificados)", () => {
    const entry = (group: string, planned: boolean) => ({ group, planned }) as unknown as Parameters<typeof plannedNote>[0];
    expect(plannedNote(entry("only-active", true))).toBe("Ya está en un día del viaje. Esto no lo cambia.");
    expect(plannedNote(entry("agreed", true))).toBeNull();
    expect(plannedNote(entry("only-active", false))).toBeNull();
  });
  it("R1: el botón «Restablecer lugares y días» vivía en la vista retirada (D5-M1); el hook conserva resetRoute", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).not.toContain("Restablecer lugares y días");
    expect(builder).not.toContain("resetRoute");
    expect(builder).not.toContain("Restablecer recorrido");
    expect(src("usePlanningDraft.ts")).toContain("const resetRoute = useCallback");
  });
  it("latente: grado desconocido → «Nivel sin clasificar (X)», conservando letra, rank, level y glyph", () => {
    const d = interestLevelForGrade("Z");
    expect(d.label).toBe("Nivel sin clasificar (Z)");
    expect(d.shortLabel).toBe("Nivel sin clasificar (Z)");
    expect(d.grade).toBe("Z");
    expect(d.rank).toBe(3);
    expect(d.level).toBe("recomendable");
    expect(d.glyph).toBe("●");
    expect(FORBIDDEN.test(d.label)).toBe(false);
  });
  it("TravellerManager: la frase describe lo que NO cambia al cambiar de persona (lugares, días, fechas, alojamiento)", () => {
    expect(src("components/TravellerManager.tsx")).toMatch(/Sólo cambia de quién es cada «Quiero ir»\. El plan del viaje, los días, las fechas y el\s+alojamiento son compartidos por los dos\./);
  });
});

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const baseAvailable = git("cat-file", "-e", `${BASE_SHA}^{commit}`) !== null && git("cat-file", "-e", `${D5_END_SHA}^{commit}`) !== null;

describe.skipIf(!baseAvailable)("D5 — alcance frente a main tras B31 (`b854db3`..`2a10ad3`)", () => {
  it("data/ intacto; lib/ sólo tiene la excepción de copy documentada (D5 DDR: 5 ficheros + sus tests)", () => {
    const allowed = new Set([
      "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
      "app/src/lib/reservation-mechanism-calendar-presentation.ts",
      "app/src/lib/divergence-presentation.ts",
      "app/src/lib/interest-level.ts",
      "app/src/lib/day-order-tool.ts",
    ]);
    const changed = (git("diff", "--name-only", BASE_SHA, D5_END_SHA, "--", "app/src/lib", "app/src/data", "data") ?? "").split("\n").filter(Boolean);
    expect(changed.filter((f) => !allowed.has(f) && !f.endsWith(".test.ts"))).toEqual([]);
    expect(changed.filter((f) => f.startsWith("data/") || f.startsWith("app/src/data/"))).toEqual([]);
  });
  it("los 5 ficheros de lib/ tocados cambian sólo líneas de copy (misma cantidad de líneas, sólo los términos autorizados)", () => {
    const files = [
      "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
      "app/src/lib/reservation-mechanism-calendar-presentation.ts",
      "app/src/lib/divergence-presentation.ts",
      "app/src/lib/interest-level.ts",
      "app/src/lib/day-order-tool.ts",
    ];
    const norm = (line: string) =>
      line
        .replace(/intervalo/g, "tramo")
        .replace(/traslados desconocidos/g, "tramos desconocidos")
        .replace(/día del viaje/g, "día del recorrido")
        .replace(/Nivel sin clasificar \(\$\{grade\}\)/g, "Grado ${grade}");
    for (const file of files) {
      const diff = git("diff", "--unified=0", BASE_SHA, D5_END_SHA, "--", file) ?? "";
      const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
      const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1));
      expect(added.length, file).toBe(removed.length);
      expect(added.map(norm), file).toEqual(removed);
    }
  });
  it("no toca hooks ni index.html; App.tsx sólo cambia líneas de importación de CSS/comentario (B10.4)", () => {
    const strip = (t: string | null) =>
      (t ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^import "\.\/(App|styles\/[\w-]+)\.css";\n/gm, "").trim();
    expect(strip(git("show", `${D5_END_SHA}:app/src/App.tsx`))).toBe(strip(git("show", `${BASE_SHA}:app/src/App.tsx`)));
    const protectedFiles = [
      "app/src/useZonePlanChoice.ts",
      "app/src/useZoneComparison.ts",
      "app/src/usePlanningDraft.ts",
      "app/src/usePlannedPlaceIds.ts",
      "app/src/useTravellers.ts",
      "app/src/usePortableBackup.ts",
      "app/index.html",
    ];
    expect((git("diff", "--name-only", BASE_SHA, D5_END_SHA, "--", ...protectedFiles) ?? "").split("\n").filter(Boolean)).toEqual([]);
  });
});
