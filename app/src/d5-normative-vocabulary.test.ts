import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("OrderedSequenceBuilder: sólo queda la deuda registrada (R1 «Restablecer recorrido»)", () => {
    const bad = visibleStrings("components/OrderedSequenceBuilder.tsx").filter(
      (s) => FORBIDDEN.test(s) && !/^Restablecer recorrido$/.test(s)
    );
    expect(bad).toEqual([]);
    expect(src("components/OrderedSequenceBuilder.tsx")).toContain("Restablecer recorrido");
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
  it("DDR: la cadena con origen en lib/ sigue viniendo de lib/ (no se duplica en presentación)", () => {
    const builder = src("components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain("OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE");
    expect(builder).not.toContain("tramo de fechas");
    expect(src("lib/divergence-presentation.ts")).toContain("Ya está en un día del recorrido. Esto no lo cambia.");
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
  it("no cambia ningún fichero de lib/ ni de data/ (ni siquiera tests)", () => {
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "data") ?? "").split("\n").filter(Boolean);
    expect(changed).toEqual([]);
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
