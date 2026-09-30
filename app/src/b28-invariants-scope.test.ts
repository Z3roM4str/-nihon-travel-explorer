import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B28 (B9.2) — alcance exacto de lo que B28 puede cambiar frente a la base Claude B27.
 *
 * `b27-model-invariants.test.ts` deja pasar `planning-draft-v8.ts`, `usePlanningDraft.ts` y
 * `stop-reorder.ts` porque B28 los extiende. Este test cierra ese hueco de forma semántica (no un diff
 * textual frágil): del fichero actual se QUITAN exactamente los fragmentos legítimos de B28 y lo que
 * queda debe ser **idéntico byte a byte** al fichero de la base B27. Cualquier otra edición en esos
 * ficheros —aunque sea un espacio o un comentario— hace fallar el test; editar DENTRO de las tres
 * funciones/wrappers permitidos sigue siendo libre.
 */

const BASE_SHA = "b351469024ecedad5fc8952015614973d56226ed"; // HEAD canónico de B27 Claude
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const baseAvailable = git("cat-file", "-e", `${BASE_SHA}^{commit}`) !== null;
const baseFile = (path: string) => git("show", `${BASE_SHA}:${path}`);
const current = (path: string) => readFileSync(`${REPO_ROOT}/${path}`, "utf8");

/** Removes `[start, end)` (start marker inclusive, end marker exclusive); both must exist once. */
function cut(source: string, start: string, end: string): { rest: string; removed: string } {
  expect(source.split(start).length - 1, `marcador único: ${start}`).toBe(1);
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(to, `marcador de fin: ${end}`).toBeGreaterThan(from);
  return { rest: source.slice(0, from) + source.slice(to), removed: source.slice(from, to) };
}
function dropLine(source: string, line: string): string {
  expect(source.split(line).length - 1, `línea única: ${JSON.stringify(line)}`).toBe(1);
  return source.replace(line, "");
}

const V8 = "app/src/lib/planning-draft-v8.ts";
const HOOK = "app/src/usePlanningDraft.ts";

describe.skipIf(!baseAvailable)("B28 — planning-draft-v8.ts sólo crece con las tres mutaciones", () => {
  it("quitando el import y las tres funciones, el fichero es idéntico al de la base B27", () => {
    let source = current(V8);
    source = dropLine(source, "  UNSELECTED_ACCOMMODATION_BOUNDARY,\n");
    const { rest, removed } = cut(source, "/**\n * B28 (B9.2) — moves ONE place to an exact slot", "export function withNewEmptyDay(");
    // El bloque retirado contiene EXACTAMENTE tres exports: las tres mutaciones (y nada más).
    const exported = [...removed.matchAll(/^export (?:async )?(?:function|const|type|class) (\w+)/gm)].map((m) => m[1]);
    expect(exported.sort()).toEqual(["withPlaceAddedToDay", "withPlaceMovedToPosition", "withPlaceRemovedFromDay"]);
    expect(rest).toBe(baseFile(V8));
  });

  it("las funciones existentes no pierden ni cambian: cada `export function` de la base sigue igual", () => {
    const base = baseFile(V8)!;
    const names = [...base.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    for (const name of names) expect(current(V8), name).toContain(`export function ${name}(`);
  });
});

describe.skipIf(!baseAvailable)("B28 — usePlanningDraft.ts sólo añade los tres wrappers", () => {
  it("quitando imports, wrappers y exports de movePlaceToPosition/addPlaceToDay/removePlaceFromDay, es idéntico a la base", () => {
    let source = current(HOOK);
    for (const name of ["withPlaceAddedToDay", "withPlaceMovedToPosition", "withPlaceRemovedFromDay"]) {
      source = dropLine(source, `  ${name},\n`);
    }
    const { rest, removed } = cut(source, "  /** B28: one place to one exact slot", "  /** Phase 3D-S: appends one empty day");
    const consts = [...removed.matchAll(/^ {2}const (\w+) = useCallback/gm)].map((m) => m[1]);
    expect(consts.sort()).toEqual(["addPlaceToDay", "movePlaceToPosition", "removePlaceFromDay"]);
    // Los wrappers sólo llaman a la mutación del mismo nombre, dentro de `setDraft`.
    expect(removed).toMatch(/withPlaceMovedToPosition\(current, fromDayId, toDayId, fromIndex, toIndex\)/);
    expect(removed).toMatch(/withPlaceAddedToDay\(current, dayId, placeId, toIndex, savedIds\)/);
    expect(removed).toMatch(/withPlaceRemovedFromDay\(current, placeId\)/);
    let final = rest;
    for (const name of ["movePlaceToPosition", "addPlaceToDay", "removePlaceFromDay"]) {
      final = dropLine(final, `    ${name},\n`);
    }
    expect(final).toBe(baseFile(HOOK));
  });
});

describe.skipIf(!baseAvailable)("B28 — el resto de lib/, datos y catálogo siguen protegidos", () => {
  it("frente a la base B27 sólo cambian esos tres ficheros y el módulo nuevo stop-reorder (más tests)", () => {
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "app/src/usePlanningDraft.ts", "data") ?? "")
      .split("\n")
      .filter((file) => file && !file.endsWith(".test.ts"))
      .sort();
    expect(changed).toEqual([
      "app/src/lib/planning-draft-v8.ts",
      "app/src/lib/stop-reorder.ts",
      "app/src/usePlanningDraft.ts",
    ]);
  });

  it("stop-reorder.ts es un módulo nuevo (no existe en la base) y puro: sin almacenamiento ni planificación", () => {
    expect(baseFile("app/src/lib/stop-reorder.ts")).toBeNull();
    expect(current("app/src/lib/stop-reorder.ts")).not.toMatch(/localStorage|planning-draft|usePlanningDraft/);
  });
});
