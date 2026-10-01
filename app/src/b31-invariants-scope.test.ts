import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B31 (B9.5) — alcance exacto frente a la base Claude B30 (`1444e67`). Sólo presentación
 * (`docs/BLOCK_31_MISSION.md`): ni cálculo, ni datos, ni almacenamiento, ni hooks, ni los
 * componentes de Días/Dónde dormir/ficha. `App.tsx` admite únicamente el cableado H4.
 */

const BASE_SHA = "1444e67805c60cf9a33f4be5c1a3808b900e505b"; // HEAD canónico de B30 Claude
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const baseAvailable = git("cat-file", "-e", `${BASE_SHA}^{commit}`) !== null;

/** D5 (excepción de copy autorizada, `docs/D5_NORMATIVE_VOCABULARY_HANDOFF.md`): sólo cadenas visibles; ni lógica ni datos. */
const D5_COPY = new Set([
  "app/src/lib/reservation-mechanism-reference-date-presentation.ts",
  "app/src/lib/reservation-mechanism-calendar-presentation.ts",
  "app/src/lib/divergence-presentation.ts",
  "app/src/lib/interest-level.ts",
  "app/src/components/DayOrderSheet.tsx",
]);

describe.skipIf(!baseAvailable)("B31 — lo que B30 protege sigue byte a byte igual", () => {
  it("no cambia ningún fichero de lib/, data/, ni el catálogo (salvo tests)", () => {
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "data") ?? "")
      .split("\n")
      .filter((file) => file && !file.endsWith(".test.ts") && !D5_COPY.has(file));
    expect(changed).toEqual([]);
  });

  it("no toca hooks, DayTimeline, DayOrderSheet, TripStop, UnassignedDrawer, ZoneComparison ni PlaceDetail", () => {
    const protectedFiles = [
      "app/src/useZonePlanChoice.ts",
      "app/src/useZoneComparison.ts",
      "app/src/usePlanningDraft.ts",
      "app/src/usePlannedPlaceIds.ts",
      "app/src/components/DayTimeline.tsx",
      "app/src/components/DayOrderSheet.tsx",
      "app/src/components/TripStop.tsx",
      "app/src/components/UnassignedDrawer.tsx",
      "app/src/components/ZoneComparison.tsx",
      "app/src/components/PlaceDetail.tsx",
    ];
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", ...protectedFiles) ?? "").split("\n").filter((file) => file && !D5_COPY.has(file));
    expect(changed).toEqual([]);
  });

  it("App.tsx sólo cambia por el cableado H4: una línea `onNavigateSection`, sin borrados", () => {
    const diff = git("diff", "--unified=0", BASE_SHA, "HEAD", "--", "app/src/App.tsx") ?? "";
    const added = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
    const removed = diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---"));
    expect(removed).toEqual([]);
    expect(added.map((line) => line.slice(1).trim())).toEqual(["onNavigateSection={setViajeSectionTracked}"]);
  });

  it("no crea claves de almacenamiento: ningún fichero nuevo de B31 escribe en storage", () => {
    const added = (git("diff", "--name-only", "--diff-filter=A", BASE_SHA, "HEAD", "--", "app/src") ?? "")
      .split("\n")
      .filter((file) => /\/(Trip\w+|viaje\w+)\.tsx?$/.test(file));
    for (const file of added) {
      const body = git("show", `HEAD:${file}`) ?? "";
      expect(body, file).not.toMatch(/localStorage|sessionStorage|setItem/);
    }
  });
});
