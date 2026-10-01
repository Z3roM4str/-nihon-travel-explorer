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
   * Vistas «builder» y «compare» de OrderedSequenceBuilder: `view` arranca en «days» y ningún control lo cambia a
   * «builder» (`setView("builder")` sólo existe en `closeComparison`, alcanzable únicamente desde «compare», que a su
   * vez sólo se abre desde «builder»). No se renderizan en main. Su copy no se inventa (DESIGN DECISION REQUIRED:
   * «Construir recorrido», «Volver al recorrido», «Guardados fuera del recorrido», «Orden A/B»); este test fija la lista
   * exacta para que cualquier otro término visible nuevo falle.
   */
  const UNREACHABLE_VIEW_STRINGS = [
    "Construir recorrido",
    "lugares en el recorrido",
    "en el recorrido",
    "Volver al recorrido",
    "Este recorrido se guarda automáticamente en este navegador, junto con el reparto por días si lo creas.",
    "El recorrido está vacío. Añade lugares guardados desde la lista de abajo.",
    "Guardados fuera del recorrido",
    "Siguen en Quiero ir. Añádelos aquí si quieres incluirlos en este recorrido.",
    "Añadir ${place.name} al recorrido",
    "Entre estos dos órdenes, el orden A tiene menor tiempo de traslado.",
    "Entre estos dos órdenes, el orden B tiene menor tiempo de traslado.",
    "El orden A contiene al menos un traslado sin registrar.",
    "El orden B contiene al menos un traslado sin registrar.",
    "Orden A",
    "Orden B",
    " en orden A",
    " en orden B",
  ];

  it("OrderedSequenceBuilder: ninguna cadena visible usa un término de Art. 7, salvo las de las vistas no alcanzables", () => {
    const bad = visibleStrings("components/OrderedSequenceBuilder.tsx").filter((s) => FORBIDDEN.test(s));
    const unexpected = bad.filter((s) => !UNREACHABLE_VIEW_STRINGS.some((u) => s.includes(u) || u.includes(s)));
    expect(unexpected).toEqual([]);
  });

  it("las vistas builder/compare siguen sin ser alcanzables (si esto falla, hay que resolver su copy)", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain('useState<"builder" | "compare" | "days">("days")');
    expect(builder.match(/setView\("builder"\)/g)?.length).toBe(1);
    expect(builder.match(/setView\("compare"\)/g)?.length).toBe(1);
    expect(builder.match(/openComparison\b/g)?.length).toBe(3); // definición + control del builder + referencia en comentario
  });

  it("sustituciones exactas (antes → después)", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    for (const text of [
      "en el viaje actual",
      "ya no forma parte del viaje actual.",
      "ya no son consecutivos en el viaje actual.",
      "el traslado no se aplica.",
      "Traslado principal entre estos dos puntos",
      "ningún traslado entre ciudades",
      "Eliminar traslado ${fromName} a ${toName}",
      "Duración manual del traslado principal",
      "Añadir traslado",
    ]) {
      expect(builder, text).toContain(text);
    }
    expect(src("components/TripBackup.tsx")).toContain("Lugares en el viaje");
    expect(src("components/TravellerManager.tsx")).toContain("Los lugares planificados, los días, las fechas y el");
    expect(src("components/SequenceCandidateSummary.tsx")).toContain("Sin traslados en este día");
    expect(src("lib/day-order-tool.ts")).toContain("Con los traslados desconocidos no se declara un ganador.");
  });
});

describe("D5 — los valores y relaciones del copy no cambian", () => {
  it("los conteos k/n y de traslados sin registrar siguen interpolados", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("{knownLegCount}/{legCount} traslado");
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
    expect(src("components/OrderedSequenceBuilder.tsx")).toContain("El reparto por días no es estructuralmente válido; el traslado no se aplica.");
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
  it("R1: «Restablecer lugares y días»; resetRoute conserva su nombre interno", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toMatch(/onClick=\{resetRoute\}>\s*Restablecer lugares y días\s*</);
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
    expect(src("components/TravellerManager.tsx")).toMatch(/Sólo cambia de quién es cada «Quiero ir»\. Los lugares planificados, los días, las fechas y el\s+alojamiento son del viaje/);
  });
});

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const baseAvailable = git("cat-file", "-e", `${BASE_SHA}^{commit}`) !== null;

describe.skipIf(!baseAvailable)("D5 — alcance frente a main tras B31 (`b854db3`)", () => {
  it("data/ intacto; lib/ sólo tiene la excepción de copy documentada (D5 DDR: 5 ficheros + sus tests)", () => {
    const allowed = new Set([
      "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
      "app/src/lib/reservation-mechanism-calendar-presentation.ts",
      "app/src/lib/divergence-presentation.ts",
      "app/src/lib/interest-level.ts",
      "app/src/lib/day-order-tool.ts",
    ]);
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "data") ?? "").split("\n").filter(Boolean);
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
      const diff = git("diff", "--unified=0", BASE_SHA, "HEAD", "--", file) ?? "";
      const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
      const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1));
      expect(added.length, file).toBe(removed.length);
      expect(added.map(norm), file).toEqual(removed);
    }
  });
  it("no toca hooks, App.tsx ni index.html (el CSS sólo cambia por D0b: gate D0b)", () => {
    const protectedFiles = [
      "app/src/useZonePlanChoice.ts",
      "app/src/useZoneComparison.ts",
      "app/src/usePlanningDraft.ts",
      "app/src/usePlannedPlaceIds.ts",
      "app/src/useTravellers.ts",
      "app/src/usePortableBackup.ts",
      "app/src/App.tsx",
      "app/index.html",
    ];
    expect((git("diff", "--name-only", BASE_SHA, "HEAD", "--", ...protectedFiles) ?? "").split("\n").filter(Boolean)).toEqual([]);
  });
});
