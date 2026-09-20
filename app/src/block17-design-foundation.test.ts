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
 * - `✎` (U+270E, Dingbats): Bloque 19 (B3) — one of the four evidence-grammar glyphs `03 §1.4`
 *   fixes by shape, not colour (`◼ ◧ ◇ ✎`); `EvidenceMark` (`04 §2`) is its only renderer. The
 *   other three (`◼◧◇`) already sit in the excluded Geometric Shapes block; this one alone falls
 *   inside Dingbats, so it needs the same explicit allowance as `★` for the same reason: it is
 *   normative typographic punctuation the frozen system names by codepoint, not a UI icon a
 *   component invented.
 */
const ALLOWED_GLYPHS = new Set(["★", "✎"]);

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

  /**
   * Bloque 18, `02 §D2`: el botón de respaldo deja de vivir en la cabecera — «Copia del viaje»
   * pasa a ser contenido de Nosotros, sin un icono-botón propio en el cromo permanente. Lo que
   * este test sigue protegiendo (Art. 00) es que el glifo crudo `⤓` no reaparezca en ninguno de
   * los dos ficheros que antes lo llevaban.
   */
  it("no raw ⤓ glyph survives in App.tsx or TripBackup.tsx", async () => {
    const app = await read("App.tsx");
    const backup = await read("components/TripBackup.tsx");
    expect(app).not.toContain("⤓");
    expect(backup).not.toContain("⤓");
  });
});

describe("Bloque 17 (B1) — letra de grado retirada de la ficha (Art. 00)", () => {
  it("PlaceDetail no longer prints the raw S/A/B/C/D letter as visible text", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).not.toContain("Grado {place.grade}");
    expect(source).not.toContain("tag__grade-letter");
  });

  it("PlaceDetail no longer exposes the raw grade through `title` either (compliance fix)", async () => {
    // 00 "Patrones explícitamente prohibidos": "Mostrar la letra de grado … Sólo en «Fuentes»
    // plegado" — that section doesn't exist yet (B4), so the letter must not surface ANYWHERE
    // in the UI meanwhile, `title`/`aria-label` included. A first B17 pass moved the letter
    // from visible text into `title={... grado original: ${place.grade}}`, which still exposed
    // it (an independent audit caught this). `place.grade` may still drive the CSS class
    // (`tag--grade-${place.grade}`, a class name, never rendered as text or read aloud) and the
    // internal `interestLevelForGrade`/`markerIcon` lookups — just never a `title`/`aria-label`.
    const source = await read("components/PlaceDetail.tsx");
    expect(source).not.toContain("grado original");
    expect(source).not.toMatch(/title=\{[^}]*place\.grade/);
    expect(source).toContain("title={interest.description}");
  });

  it("no title/aria-label anywhere in components/ or lib/ interpolates the raw grade", async () => {
    // General regression guard, not just PlaceDetail: catches the same mistake if it is ever
    // reintroduced anywhere else (e.g. a future PlaceCard/SelectionPanel grade tooltip).
    const files = await sourceFiles(new URL("./", SRC), [], ["data", "icons"]);
    const offenders: string[] = [];
    const ATTR_WINDOW = /\b(?:title|aria-label)=(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|"[^"]*")/g;
    for (const file of files) {
      const code = withoutComments(await readFile(file, "utf8"));
      for (const m of code.matchAll(ATTR_WINDOW)) {
        if (/\.grade\b/.test(m[1])) {
          offenders.push(`${file.replace(SRC.pathname, "")}: ${m[0].slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // Self-test: proves the detector above actually catches the exact violation an independent
  // audit found, so this gate cannot silently stop working.
  it("(self-test) the title/aria-label grade detector actually fires on the original bug", () => {
    const ATTR_WINDOW = /\b(?:title|aria-label)=(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|"[^"]*")/g;
    const bugged = 'title={`${interest.description} (grado original: ${place.grade})`}';
    const matches = [...bugged.matchAll(ATTR_WINDOW)].filter((m) => /\.grade\b/.test(m[1]));
    expect(matches.length).toBe(1);
  });
});

describe("Bloque 17 (B1) — suelo táctil 44×44 (Art. 11, manda sobre 04 en conflicto)", () => {
  it("tokens.css fixes --tap-min at 44px", async () => {
    const tokens = await read("styles/tokens.css");
    expect(tokens).toMatch(/--tap-min:\s*44px/);
  });

  it("the .tap-target-min hit-area technique exists and is anchored to --tap-min", async () => {
    const css = await read("App.css");
    expect(css).toContain(".tap-target-min {");
    expect(css).toContain(".tap-target-min::after {");
    const after = css.slice(css.indexOf(".tap-target-min::after {"));
    const block = after.slice(0, after.indexOf("}"));
    expect(block).toContain("position: absolute");
    expect(block).toMatch(/width:\s*max\(100%,\s*var\(--tap-min\)\)/);
    expect(block).toMatch(/height:\s*max\(100%,\s*var\(--tap-min\)\)/);
  });

  it("ChipToggle carries the same hit-area technique via its own className", async () => {
    // Bloque 19 (B3): `.filter-chip` (a checkbox-carrying <label>) was replaced by
    // `ChipToggle` — a <button>, used across the six FilterSheet groups (`04 §3`/`§13`). It
    // reuses `.tap-target-min` directly as a className (`ChipToggle.tsx`) instead of baking the
    // technique into its own rule, which is an equally valid application of the same pattern —
    // see `.tap-target-min`'s own module comment in App.css for why a `::after` pseudo-element
    // is a real hit-area expansion in every current render engine.
    const component = await read("components/ChipToggle.tsx");
    expect(component).toContain('className={`chip-toggle tap-target-min');
    const css = await read("App.css");
    expect(css).toContain(".tap-target-min {");
    const afterRule = css.slice(css.indexOf(".tap-target-min::after {"));
    const afterBlock = afterRule.slice(0, afterRule.indexOf("}"));
    expect(afterBlock).toContain("position: absolute");
    expect(afterBlock).toMatch(/width:\s*max\(100%,\s*var\(--tap-min\)\)/);
  });

  it("isolated controls under 44px visual carry .tap-target-min", async () => {
    // Each pair: file, and a substring that must include "tap-target-min" in the same
    // className. `.filter-chip` itself is covered by the rule-level fix above, not a className.
    // These sit in rows with enough gap that the invisible ::after expansion cannot reach
    // a sibling (see the dense-row exception below) — confirmed by direct gap-vs-expansion
    // arithmetic against App.css at the time each was added.
    //
    // Bloque 18: `.app__help` (el «?» de la cabecera) desapareció con la cabecera antigua — «Cómo
    // funciona Nihon» es ahora un botón normal `button--secondary` (44px por `04 §4`) dentro de
    // Nosotros, que no necesita el mecanismo de expansión de esta prueba.
    const targets: Array<[string, string]> = [
      ["components/TripBackup.tsx", 'className="trip-backup__close tap-target-min"'],
      // Bloque 19 (B3): el campo de búsqueda libre vivía dentro de `FilterPanel.tsx`; ahora es
      // `SearchSheet.tsx` (`04 §12`) — el botón de borrar se mudó con él, mismo className.
      ["components/SearchSheet.tsx", 'className="search-field__clear tap-target-min"'],
    ];
    for (const [file, needle] of targets) {
      const code = await read(file);
      expect(code, file).toContain(needle);
    }
  });

  it("dense-row controls (icon-button--small, gallery__dot) do NOT use .tap-target-min", async () => {
    // Second compliance correction: `.sequence-item__controls`, `.day-card__header-actions` and
    // `.gallery__dots` pack same-sized siblings closer together than twice the ::after
    // expansion needs, so the invisible-expansion technique would make neighbouring 44×44 hit
    // zones overlap. These use a REAL 44×44 box instead (see the next test), so the className
    // must never regain `tap-target-min` — that would silently reintroduce the overlap bug.
    for (const file of ["components/OrderedSequenceBuilder.tsx", "components/SelectionPanel.tsx"]) {
      const code = await read(file);
      expect(code, file).not.toContain("tap-target-min");
      expect((code.match(/icon-button--small/g) ?? []).length, file).toBeGreaterThan(0);
    }
    const gallery = await read("components/PlaceGallery.tsx");
    expect(gallery).not.toContain("gallery__dot tap-target-min");
    expect(gallery).toContain("gallery__dot");
  });

  it("icon-button--small grows its REAL box to --tap-min and keeps the visual small via ::before", async () => {
    const css = await read("App.css");
    const rule = css.slice(css.indexOf(".icon-button--small {"), css.indexOf(".icon-button--small {") + 400);
    expect(rule).toMatch(/width:\s*var\(--tap-min\)/);
    expect(rule).toMatch(/height:\s*var\(--tap-min\)/);
    expect(css).toContain(".icon-button--small::before {");
    const before = css.slice(css.indexOf(".icon-button--small::before {"));
    const beforeBlock = before.slice(0, before.indexOf("}"));
    expect(beforeBlock).toContain("position: absolute");
    // The visual circle must stay a fixed, small size — never var(--tap-min) — or the box and
    // its painted content would grow together and the row would stop being dense.
    expect(beforeBlock).not.toMatch(/var\(--tap-min\)/);
  });

  it("gallery__dot grows its REAL box to --tap-min and keeps the visual dot small via ::before", async () => {
    const css = await read("App.css");
    const rule = css.slice(css.indexOf(".gallery__dot {"), css.indexOf(".gallery__dot {") + 400);
    expect(rule).toMatch(/width:\s*var\(--tap-min\)/);
    expect(rule).toMatch(/height:\s*var\(--tap-min\)/);
    expect(css).toContain(".gallery__dot::before {");
    const before = css.slice(css.indexOf(".gallery__dot::before {"));
    const beforeBlock = before.slice(0, before.indexOf("}"));
    expect(beforeBlock).not.toMatch(/var\(--tap-min\)/);
  });
});

describe("Bloque 17 (B1) — botones de icono sin texto llevan aria-label y title (04 §4)", () => {
  it("no icon-only <button> in components/ has aria-label without title, or neither", async () => {
    // Ports scripts/b17-tap-target-check.mjs's companion audit into a permanent, fast,
    // no-browser gate. A "icon-only" button is one whose rendered children — after stripping
    // aria-hidden decorative spans, self-closing <Icon/> calls, JSX comments and whitespace-only
    // expressions — contain no real text. Self-closing buttons (`<button ... />`) count as
    // icon-only with empty content.
    const files = await sourceFiles(new URL("./", SRC), [], ["data", "icons"]);
    const offenders: string[] = [];

    for (const file of files) {
      const text = await readFile(file, "utf8");
      let pos = 0;
      for (;;) {
        const start = text.indexOf("<button", pos);
        if (start === -1) break;
        let depth = 0;
        let i = start + "<button".length;
        let tagClose = -1;
        let selfClosing = false;
        for (; i < text.length; i++) {
          const c = text[i];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === ">" && depth === 0) {
            tagClose = i;
            selfClosing = text[i - 1] === "/";
            break;
          }
        }
        if (tagClose === -1) {
          pos = start + 7;
          continue;
        }
        const opening = text.slice(start, tagClose + 1);
        const hasAria = /aria-label=/.test(opening);
        const hasTitle = /\btitle=/.test(opening);

        let hasVisibleText = true;
        if (selfClosing) {
          pos = tagClose + 1;
          hasVisibleText = false;
        } else {
          const end = text.indexOf("</button>", tagClose);
          if (end === -1) {
            pos = tagClose + 1;
            continue;
          }
          const body = text.slice(tagClose + 1, end);
          pos = end + "</button>".length;
          let stripped = body.replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, "");
          stripped = stripped.replace(/<Icon\b[^/]*\/>/g, "");
          stripped = stripped.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
          stripped = stripped.replace(/\{"\s*"\}/g, "");
          stripped = stripped.replace(/<[^>]+\/?>/g, "");
          hasVisibleText = /[A-Za-zÀ-ÿ]{2,}/.test(stripped.trim());
        }

        if (!hasVisibleText && (!hasAria || !hasTitle)) {
          const line = text.slice(0, start).split("\n").length;
          offenders.push(`${file.replace(SRC.pathname, "")}:${line} aria=${hasAria} title=${hasTitle}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
