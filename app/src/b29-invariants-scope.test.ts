import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B29 (B9.3) — alcance exacto frente a la base Claude B28.
 *
 * B29 no necesita cambiar dominio, modelo ni almacenamiento: la propuesta es estado transitorio y
 * «Usar este orden» repite la mutación B28 `withPlaceMovedToPosition` a través del wrapper B28
 * `movePlaceToPosition`. Por eso la protección no autoriza NINGUNA excepción: frente a la base B28
 * no puede cambiar ni un byte de `lib/` (incluidos `sequence-comparison.ts`, los `evidence-complete-*`
 * y `planning-draft-v8.ts`), de `data/`, del hook `usePlanningDraft.ts` ni del catálogo. Si una
 * extensión futura los necesita, debe llegar con su propio test que la autorice explícitamente.
 */

const BASE_SHA = "dd5fee06e3c0b4bdaa7c03512466b0f967e02eb2"; // HEAD canónico de B28 Claude
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

describe.skipIf(!baseAvailable)("B29 — lo que B28 protege sigue byte a byte igual", () => {
  it("no cambia ningún fichero de lib/, data/, el hook ni el catálogo (salvo tests)", () => {
    const changed = (git("diff", "--name-only", BASE_SHA, "HEAD", "--", "app/src/lib", "app/src/data", "app/src/usePlanningDraft.ts", "data") ?? "")
      .split("\n")
      .filter((file) => file && !file.endsWith(".test.ts") && !D5_COPY.has(file));
    expect(changed).toEqual([]);
  });

  it("sequence-comparison, los cinco evidence-complete-* y planning-draft-v8 no cambian (ni sus tests)", () => {
    const files = [
      "app/src/lib/sequence-comparison.ts",
      "app/src/lib/sequence-comparison.test.ts",
      "app/src/lib/planning-draft-v8.ts",
      "app/src/lib/evidence-complete-local-swap.ts",
      "app/src/lib/evidence-complete-local-relocation.ts",
      "app/src/lib/evidence-complete-interior-transposition.ts",
      "app/src/lib/evidence-complete-four-place-interior-reversal.ts",
      "app/src/lib/evidence-complete-two-pair-block-swap.ts",
    ];
    expect(git("diff", "--name-only", BASE_SHA, "HEAD", "--", ...files)?.trim()).toBe("");
  });

  it("los ficheros nuevos de B29 viven en components/ y no tocan almacenamiento", () => {
    const added = (git("diff", "--name-only", "--diff-filter=A", BASE_SHA, "HEAD", "--", "app/src") ?? "").split("\n").filter(Boolean);
    expect(added).toEqual(expect.arrayContaining(["app/src/components/DayOrderSheet.tsx", "app/src/components/day-order.ts"]));
    expect(added.filter((file) => file.startsWith("app/src/lib/"))).toEqual([]);
  });
});
