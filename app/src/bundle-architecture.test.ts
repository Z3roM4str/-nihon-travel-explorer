import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 12 — the architectural invariants the bundle split depends on.
 *
 * These deliberately assert on **architecture, not bundler output**. No chunk hash, no byte count,
 * no file name from `dist/` appears here: all three are incidental, they change when a dependency
 * is bumped, and a test that pins them would fail for reasons nobody wants to read about. What is
 * pinned instead is the shape that *causes* the split, so the guard stays true whatever rolldown
 * decides to call the files.
 *
 * The runtime half — that the chunks actually resolve, that nothing 404s, that both surfaces still
 * open — cannot be proven from source at all and is proven in
 * `scripts/block12-bundle-architecture-browser-audit.mjs` against the production build.
 */

const SRC = new URL("./", import.meta.url);

async function read(relative: string): Promise<string> {
  return readFile(new URL(relative, SRC), "utf8");
}

/** Strips comments, so a scan asserts on what the code DOES, not on what its documentation says. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Every source file under `src/`, excluding tests. */
async function sourceFiles(dir = SRC, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await sourceFiles(child, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(child.pathname);
  }
  return acc;
}

/** The surfaces Block 12 moved out of the entry chunk. */
const DEFERRED = ["OrderedSequenceBuilder", "ZoneComparison"] as const;

/**
 * The surfaces that must STAY in the entry chunk.
 *
 * `NationalExplorer` is what Nihon renders first — `INITIAL_VIEW.mode` is `"national"` — and it
 * owns the map. Deferring either would trade a real first paint for a smaller number, which is the
 * trade this block exists to refuse.
 */
const CRITICAL = ["NationalExplorer", "PlaceMap", "PlaceList", "PlaceDetail"] as const;

describe("Block 12 — the split exists, and where it was argued to be", () => {
  it("App.tsx reaches both deferred surfaces only through a dynamic import", async () => {
    const app = withoutComments(await read("App.tsx"));
    for (const name of DEFERRED) {
      expect(app).toMatch(new RegExp(`import\\("\\./components/${name}"\\)`));
      // The static form would pull it straight back into the entry chunk.
      expect(app).not.toMatch(new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`));
    }
  });

  it("both deferred surfaces are wrapped in a Suspense boundary", async () => {
    const app = await read("App.tsx");
    expect(app).toMatch(/import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*"react"/);
    expect(app).toMatch(/lazy\(loadOrderedSequenceBuilder\)/);
    expect(app).toMatch(/lazy\(loadZoneComparison\)/);
    expect((app.match(/<Suspense\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("nothing else static-imports a deferred surface, so the entry cannot re-absorb it", async () => {
    // The failure this catches is real and quiet: one `import { ZoneComparison } from …` anywhere
    // in the first-render graph silently undoes the split while every test and the build stay green.
    const files = await sourceFiles();
    for (const file of files) {
      const code = withoutComments(await readFile(file, "utf8"));
      for (const name of DEFERRED) {
        const staticImport = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["'][^"']*${name}["']`);
        expect(staticImport.test(code), `${file} static-imports ${name}`).toBe(false);
      }
    }
  });
});

describe("Block 12 — the critical path was left alone, on purpose", () => {
  it("the first-render surfaces are NOT lazy", async () => {
    const app = withoutComments(await read("App.tsx"));
    for (const name of CRITICAL) {
      expect(app).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`));
      expect(app).not.toMatch(new RegExp(`import\\("\\./components/${name}"\\)`));
    }
  });

  it("the map stays on the critical path, because the first screen is the national view", async () => {
    const app = await read("App.tsx");
    expect(app).toMatch(/INITIAL_VIEW\s*:\s*ViewState\s*=\s*\{\s*mode:\s*"national"/);
    // NationalExplorer owns NationalMap, which owns Leaflet. Static all the way down.
    const explorer = withoutComments(await read("components/NationalExplorer.tsx"));
    expect(explorer).toMatch(/import\s*\{\s*NationalMap\s*\}\s*from/);
    const map = withoutComments(await read("components/NationalMap.tsx"));
    expect(map).toMatch(/from\s*"react-leaflet"/);
    expect(map).not.toMatch(/import\(/);
  });
});

describe("Block 12 — the split does not move the wait onto the user", () => {
  it("both chunks are prefetched once the browser is idle after first paint", async () => {
    const app = withoutComments(await read("App.tsx"));
    expect(app).toMatch(/function prefetchOnDemandSurfaces/);
    expect(app).toMatch(/requestIdleCallback/);
    // A browser without requestIdleCallback must still warm them.
    expect(app).toMatch(/setTimeout\(warm/);
    expect(app).toMatch(/useEffect\(\(\) => prefetchOnDemandSurfaces\(\), \[\]\)/);
  });

  it("a failed prefetch can never surface as an error", async () => {
    const app = withoutComments(await read("App.tsx"));
    expect(app).toMatch(/loadOrderedSequenceBuilder\(\)\.catch\(\(\) => \{\}\)/);
    expect(app).toMatch(/loadZoneComparison\(\)\.catch\(\(\) => \{\}\)/);
  });

  it("the prefetch is cancellable, so it cannot outlive the component", async () => {
    const app = withoutComments(await read("App.tsx"));
    expect(app).toMatch(/cancelled = true/);
    expect(app).toMatch(/cancelIdleCallback/);
  });
});

describe("Block 12 — the deferred surfaces still mount only while open", () => {
  it("the Suspense boundary sits outside the condition, not inside it", async () => {
    // Block 12 placed the boundary outside so the planner still unmounts on close — the invariant
    // `ZonePlanSection.test.ts` pins, and the reason reopening re-reads what the comparison wrote.
    // Asserting it here too states the intent, rather than leaving it to a regex written elsewhere
    // for a different purpose.
    const app = await read("App.tsx");
    expect(app).toMatch(/<Suspense fallback=\{null\}>\s*\{sequenceBuilderOpen && \(/);
    expect(app).toMatch(/<Suspense fallback=\{null\}>\s*\{zonesOpen && activeHub && \(/);
  });
});
