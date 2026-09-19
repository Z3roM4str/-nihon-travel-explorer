import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Bloque 17 (B1 — Fundación visual) regression guard.
 *
 * Automates the closing gates `docs/design/08_GUARDRAILS_DE_INGENIERIA.md` §"Puertas de
 * calidad por bloque" requires for G4 ("Sin tokens fuera de sistema"): cero emoji en fuentes de
 * componentes, cero `@media (max-width: …)` nuevo. Specific enough not to confuse legitimate
 * dataset content (the category strings in `data/places.json`, or the `place.category` field
 * threaded through components) with interface iconography — it only scans rendered UI source
 * under `src/components` and `src/lib`, never `src/data`, and it excludes comments, since a
 * code comment quoting the dataset's own emoji (e.g. `place.ts`'s module doc) is not an icon.
 */

const SRC = new URL("./", import.meta.url);

async function read(relative: string): Promise<string> {
  return readFile(new URL(relative, SRC), "utf8");
}

/** Every `.ts`/`.tsx` file under `dir`, excluding tests and (by default) `data/`. */
async function sourceFiles(dir: URL, acc: string[] = [], skipDirs: readonly string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skipDirs.includes(entry.name)) continue;
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await sourceFiles(child, acc, skipDirs);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(child.pathname);
  }
  return acc;
}

/** Strips `/* … *\/` and `// …` comments, so a scan asserts on what renders, not on prose that
 * quotes the dataset's own emoji (e.g. `place.ts`'s "Category strings are stored with a leading
 * emoji" module doc, or this block's own design-decision comments). */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Pictographic / dingbat ranges a real emoji font colourises: misc symbols & pictographs,
 * transport & map symbols, emoticons, supplemental symbols, misc symbols, dingbats, misc
 * technical (stopwatch etc.), supplemental arrows-B (the "⤓" backup icon this gate caught),
 * misc symbols & arrows. Deliberately excludes Geometric Shapes (U+25A0–25FF, the ladder's
 * ★◆●○ family and the ▾▸▴ disclosure chevrons predate this block and are plain monochrome
 * punctuation on every platform) and the plain Arrows block (U+2190–21FF, used throughout the
 * codebase as prose punctuation — "Shibuya → Shinjuku", "Hotel A → Place X" in comments — not
 * as a control icon; every real back-arrow *button* in this codebase was migrated by hand and
 * is verified in the second test below).
 */
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}]/gu;

/**
 * Glyphs the frozen design direction itself specifies and that this scan must not flag:
 * - `ⓘ` (U+24D8, Enclosed Alphanumerics — outside `EMOJI_PATTERN` already, listed for clarity):
 *   the credits/info button glyph named explicitly in `04 §6`/`05 §3`/`05 §5`.
 * - `★` (U+2605, Misc Symbols): the "Imprescindible" badge glyph, `03 §1.4`/`04 §5.3`. It falls
 *   inside `EMOJI_PATTERN`'s range, so it is the one explicit allowance below.
 */
const ALLOWED_GLYPHS = new Set(["★"]);

describe("Bloque 17 (B1) — cero emoji en iconografía de interfaz (gate G4)", () => {
  it("no component or lib source renders a pictographic character as a UI icon", async () => {
    const files = await sourceFiles(new URL("./", SRC), [], ["data", "icons"]);
    const offenders: string[] = [];
    for (const file of files) {
      const code = withoutComments(await readFile(file, "utf8"));
      const matches = [...code.matchAll(EMOJI_PATTERN)].map((m) => m[0]).filter((g) => !ALLOWED_GLYPHS.has(g));
      if (matches.length > 0) {
        offenders.push(`${file.replace(SRC.pathname, "")}: ${[...new Set(matches)].join(" ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the dataset's own category emoji is stripped, not styled, wherever it reaches presentation", async () => {
    // `splitCategory` still exposes `.icon` (the raw dataset glyph) for callers that might need
    // it, but no B1 surface renders it any more — 03 §8 "se recorta el emoji al renderizar".
    for (const file of [
      "components/PlaceCard.tsx",
      "components/PlaceDetail.tsx",
      "components/PlaceGallery.tsx",
      "components/FilterPanel.tsx",
      "components/SelectionPanel.tsx",
    ]) {
      const code = await read(file);
      expect(code, file).not.toContain("category.icon");
      expect(code, file).not.toContain("categoryIcon");
    }
  });
});

describe("Bloque 17 (B1) — tokens.css es la fuente del sistema visual (gate G2/G4)", () => {
  it("main.tsx imports styles/tokens.css before any other stylesheet", async () => {
    const main = await read("main.tsx");
    const tokensIndex = main.indexOf("./styles/tokens.css");
    expect(tokensIndex).toBeGreaterThan(-1);
    for (const otherStyle of ["leaflet/dist/leaflet.css", "./index.css"]) {
      const otherIndex = main.indexOf(otherStyle);
      expect(otherIndex, otherStyle).toBeGreaterThan(-1);
      expect(tokensIndex, otherStyle).toBeLessThan(otherIndex);
    }
  });

  it("tokens.css declares every token family from 03_SISTEMA_DE_DISENO.md", async () => {
    const tokens = await read("styles/tokens.css");
    for (const token of [
      "--ink-900",
      "--paper",
      "--shu-600",
      "--person-a",
      "--person-b",
      "--font-voice",
      "--font-record",
      "--type-body-size",
      "--space-4",
      "--radius-md",
      "--elev-1",
      "--dur-base",
      "--ease-standard",
      "--tap-min",
      "--tap-primary",
      "--focus-ring-color",
    ]) {
      expect(tokens, token).toContain(token);
    }
  });

  it("App.css no longer defines its own hex for the legacy colour/shadow variables it aliases", async () => {
    const css = await read("App.css");
    const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(":root {") + 1600);
    for (const legacyVar of ["--color-bg", "--color-accent", "--color-text", "--shadow-panel"]) {
      const line = rootBlock.split("\n").find((entry) => entry.trim().startsWith(`${legacyVar}:`));
      expect(line, legacyVar).toBeDefined();
      expect(line, legacyVar).toMatch(/var\(--/);
      expect(line, legacyVar).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

describe("Bloque 17 (B1) — mobile-first literal (gate G4)", () => {
  it("the new B1 stylesheets never use @media (max-width: …)", async () => {
    for (const file of ["styles/tokens.css", "styles/fonts.css", "index.css"]) {
      const css = await read(file);
      expect(css, file).not.toMatch(/@media\s*\(\s*max-width/);
    }
  });

  it("App.css gains no new @media (max-width: …) query", async () => {
    // 9 pre-existing queries predate B1 and are converted to `min-width` only when B2+
    // migrates their surface (08 §"Cómo tratar el CSS actual": "no antes"). This count must
    // never grow; it is free to shrink as later blocks convert one.
    const css = await read("App.css");
    const count = [...css.matchAll(/@media\s*\(\s*max-width/g)].length;
    expect(count).toBeLessThanOrEqual(9);
  });
});

describe("Bloque 17 (B1) — controles de retroceso y respaldo usan el set de iconos", () => {
  it("every back-navigation control renders the 'atras' icon, not a raw arrow glyph", async () => {
    for (const file of [
      "App.tsx",
      "components/PlaceDetail.tsx",
      "components/RegionNavigator.tsx",
      "components/ZoneComparison.tsx",
      "components/OrderedSequenceBuilder.tsx",
    ]) {
      const code = await read(file);
      expect(code, file).not.toMatch(/aria-hidden="true">\s*←/);
    }
  });

  it("the header backup control renders the 'descargar' icon, not the raw ⤓ glyph", async () => {
    const code = await read("App.tsx");
    expect(code).not.toContain("⤓");
    expect(code).toContain('name="descargar"');
  });
});

describe("Bloque 17 (B1) — letra de grado retirada de la ficha (Art. 00)", () => {
  it("PlaceDetail no longer prints the raw S/A/B/C/D letter as visible text", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).not.toContain("Grado {place.grade}");
    expect(source).not.toContain("tag__grade-letter");
  });
});
