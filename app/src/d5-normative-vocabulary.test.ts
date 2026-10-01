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

const BASE_SHA = "4d2163165f791b2ba3b1db8c7cbb968e1c607314"; // HEAD de D0b Claude
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
    "components/StopActionsSheet.tsx",
    "components/TripBackup.tsx",
    "components/viajeResumenModel.ts",
    "components/TravellerManager.tsx",
    "components/DayOrderSheet.tsx",
  ])("%s: ninguna cadena visible usa un término de Art. 7", (file) => {
    const bad = visibleStrings(file).filter((s) => FORBIDDEN.test(s));
    expect(bad).toEqual([]);
  });

  it("OrderedSequenceBuilder: ninguna cadena visible usa un término de Art. 7", () => {
    expect(visibleStrings("components/OrderedSequenceBuilder.tsx").filter((s) => FORBIDDEN.test(s))).toEqual([]);
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
    expect(src("components/StopActionsSheet.tsx").match(/Quitar del día/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src("components/StopActionsSheet.tsx")).toContain("del día. Sigue guardado en Quiero ir.");
    expect(src("components/TripBackup.tsx")).toContain("Lugares en el viaje");
    expect(src("components/TravellerManager.tsx")).toContain("Los lugares planificados, los días, las fechas y el");
    expect(src("components/DayOrderSheet.tsx")).toContain("Sin traslados en este día");
    expect(src("components/DayOrderSheet.tsx")).toContain("al menos un traslado sin registrar");
  });
});

describe("D5 — los valores y relaciones del copy no cambian", () => {
  it("los conteos k/n y de traslados sin registrar siguen interpolados", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("{knownLegCount}/{legCount} traslado");
    expect(builder).toContain("{unknownLegCount}");
    expect(builder).toContain('{complete ? "traslados totales" : "traslados conocidos"}');
    expect(src("components/DayOrderSheet.tsx")).toContain("${summary.knownLegCount}/${summary.legCount} traslado");
    expect(src("components/DayOrderSheet.tsx")).toContain("${summary.unknownLegCount} sin traslado");
  });
  it("«Quitar del día» conserva la relación «sigue en Quiero ir y pasa a Sin asignar»", () => {
    expect(src("components/StopActionsSheet.tsx")).toContain("Sigue en Quiero ir y pasa a «Sin asignar».");
  });
});

describe("D5 — ARIA y títulos", () => {
  it("el botón de cerrar el planificador nombra la superficie, sin «constructor» ni «recorrido»", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("aria-label={`Cerrar ${surfaceTitle}`}");
    expect(builder).toContain("title={`Cerrar ${surfaceTitle}`}");
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
    expect(src("components/viajeResumenModel.ts")).toContain("El reparto por días no coincide exactamente con el viaje");
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

describe.skipIf(!baseAvailable)("D5 — alcance frente a D0b (`4d21631`)", () => {
  it("data/ intacto; lib/ sólo tiene la excepción de copy documentada (D5 DDR: 4 ficheros + sus tests)", () => {
    const allowed = new Set([
      "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
      "app/src/lib/reservation-mechanism-calendar-presentation.ts",
      "app/src/lib/divergence-presentation.ts",
      "app/src/lib/interest-level.ts",
    ]);
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "data") ?? "").split("\n").filter(Boolean);
    expect(changed.filter((f) => !allowed.has(f) && !f.endsWith(".test.ts"))).toEqual([]);
    expect(changed.filter((f) => f.startsWith("data/") || f.startsWith("app/src/data/"))).toEqual([]);
  });
  it("los 4 ficheros de lib/ tocados cambian sólo líneas de copy (misma cantidad de líneas, sólo los términos autorizados)", () => {
    const files = [
      "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
      "app/src/lib/reservation-mechanism-calendar-presentation.ts",
      "app/src/lib/divergence-presentation.ts",
      "app/src/lib/interest-level.ts",
    ];
    const norm = (line: string) =>
      line
        .replace(/intervalo/g, "tramo")
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
  it("no toca hooks, App.tsx, CSS ni index.html", () => {
    const protectedFiles = [
      "app/src/useZonePlanChoice.ts",
      "app/src/useZoneComparison.ts",
      "app/src/usePlanningDraft.ts",
      "app/src/usePlannedPlaceIds.ts",
      "app/src/useTravellers.ts",
      "app/src/usePortableBackup.ts",
      "app/src/App.tsx",
      "app/src/App.css",
      "app/src/index.css",
      "app/src/styles",
      "app/index.html",
    ];
    expect((git("diff", "--name-only", BASE_SHA, "HEAD", "--", ...protectedFiles) ?? "").split("\n").filter(Boolean)).toEqual([]);
  });
});
