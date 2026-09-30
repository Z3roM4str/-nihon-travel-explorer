import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B30 (B9.4) — alcance exacto frente a la base Claude B29.
 *
 * B30 es sólo presentación (`docs/BLOCK_30_MISSION.md`): ni cálculo, ni datos, ni almacenamiento, ni
 * los hooks de zona, ni `App.tsx`. Frente a `52fbc6b` no puede cambiar un byte de esos ficheros.
 */

const BASE_SHA = "52fbc6bd029e5fa9e34ce4aa1104a1914bfc0c7e"; // HEAD canónico de B29 Claude
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const baseAvailable = git("cat-file", "-e", `${BASE_SHA}^{commit}`) !== null;

describe.skipIf(!baseAvailable)("B30 — lo que B29 protege sigue byte a byte igual", () => {
  it("no cambia ningún fichero de lib/, data/, ni el catálogo (salvo tests)", () => {
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "data") ?? "")
      .split("\n")
      .filter((file) => file && !file.endsWith(".test.ts"));
    expect(changed).toEqual([]);
  });

  it("no toca App.tsx, los hooks de zona/borrador ni los componentes de Días", () => {
    const protectedFiles = [
      "app/src/App.tsx",
      "app/src/useZonePlanChoice.ts",
      "app/src/useZoneComparison.ts",
      "app/src/usePlanningDraft.ts",
      "app/src/components/OrderedSequenceBuilder.tsx",
      "app/src/components/DayTimeline.tsx",
      "app/src/components/DayOrderSheet.tsx",
    ];
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", ...protectedFiles) ?? "").split("\n").filter(Boolean);
    expect(changed).toEqual([]);
  });
});
