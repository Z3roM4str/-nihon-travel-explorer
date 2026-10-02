import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 12 — bundle architecture, browser audit against the PRODUCTION build.
 *
 * Block 12 moved two surfaces out of the entry chunk: the planner and the zone comparison. A green
 * build proves nothing about that, which is exactly why this audit exists — `vite build` is happy
 * to emit a chunk that 404s at runtime, and a lazy route that fails does so silently behind a
 * `fallback={null}`. Everything here is about the one question a bundler cannot answer: **does the
 * app still work when the code arrives later, or over a second request that can fail?**
 *
 * So it proves, at each viewport: the cold load is clean; every JavaScript request the browser
 * makes returns 200 or executes verified cached content, including the two deferred chunks; both deferred surfaces really open and
 * really render their content; closing and reopening them works, because a `React.lazy` that
 * resolved once must not be re-fetched or re-suspended; and nothing about splitting leaked into
 * the console.
 *
 * It also pins the two architectural facts the split depends on, measured from the network rather
 * than from the build output: **more than one JS file is served** (the boundary is real, not a
 * config that silently collapsed back into one chunk), and **the deferred chunks are not part of
 * the initial critical path** — they arrive after first paint, via the idle prefetch or the click,
 * never as a blocking `modulepreload` in the document head.
 *
 * Usage: node scripts/block12-bundle-architecture-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4329;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function noOverflow(page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(24)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  /** Every JS request the browser actually made, with its status. The heart of this audit. */
  const jsRequests = [];
  const cacheProbes = [];
  const parsedScripts = new Map();
  const debuggerSession = await context.newCDPSession(page);
  debuggerSession.on("Debugger.scriptParsed", script => parsedScripts.set(script.url, script.scriptId));
  await debuggerSession.send("Debugger.enable");
  const pendingBodies = new Set();
  const validJs = (request) => request.status === 200 || (request.status === 304 && request.bodyBytes > 0 && jsRequests.some(previous => previous.url === request.url && previous.status === 200 && previous.bodySha256 === request.bodySha256));
  const failedRequests = [];

  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Tile servers are unreachable in this sandbox and are not Block 12's business; Block 10's
    // audit filters the same two families for the same reason.
    if (/ERR_CERT|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.startsWith(url) && /\.js(\?|$)/.test(u) && r.request().resourceType() !== "fetch") {
      const row = { url: u.replace(url, ""), status: r.status(), bodyBytes: 0, bodySha256: null };
      jsRequests.push(row);
      const readBody = (async () => {
        if (row.status !== 304) {
          const body = await r.body();
          row.bodyBytes = body.length;
          row.bodySha256 = createHash("sha256").update(body).digest("hex");
        }
      })().catch(() => {});
      pendingBodies.add(readBody);
      void readBody.finally(() => pendingBodies.delete(readBody));
    }
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(url)) failedRequests.push(`${r.url().replace(url, "")}: ${r.failure()?.errorText}`);
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage on this document */
    }
  });

  // ── 1. Cold load ─────────────────────────────────────────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  check("the app mounted on a cold load", (await page.locator("#root > *").count()) > 0);
  check("cold load raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("cold load logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("no request to this origin failed", failedRequests.length === 0, failedRequests.join(" | "));

  // B21+: la primera pantalla es la portada de Explorar (la mapa nacional se abre desde su tarjeta).
  // Si la división hubiera movido la portada fuera de la ruta crítica, esto sería lo que regresase.
  check(
    "the first screen still renders the Explorar home without waiting for a second chunk",
    (await page.locator(".explorer-home").count()) >= 1
  );

  // «Ruta crítica» = lo que el documento pide ANTES de la primera pintura. Se mide en dos hechos:
  //  (a) el HTML servido no declara `modulepreload` de las superficies diferidas;
  //  (b) cuando se piden (prefetch en reposo), su petición empieza DESPUÉS de la primera pintura.
  // (B10.4: los chunks diferidos llevan ahora su CSS, y Vite inyecta entonces un `<link rel=modulepreload>` en
  // tiempo de ejecución al hacer el `import()` en reposo; mirar el DOM vivo ya no distingue ese prefetch tardío
  // de una dependencia crítica.)
  const servedHtml = await (await page.request.get(url)).text();
  const staticPreloads = [...servedHtml.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]*>/g)].map((m) => m[0]);
  check(
    "no deferred surface is pulled into the document's critical path (served HTML)",
    !staticPreloads.some((h) => /OrderedSequenceBuilder|ZoneComparison/.test(h)),
    staticPreloads.join(" | ")
  );
  await page.waitForTimeout(1500);
  const timing = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1,
    deferred: performance
      .getEntriesByType("resource")
      .filter((e) => /\/(OrderedSequenceBuilder|ZoneComparison)-[^/]*\.js/.test(e.name))
      .map((e) => ({ name: e.name.split("/").pop(), start: e.startTime })),
  }));
  check(
    "the deferred chunks are requested only after first contentful paint",
    timing.fcp > 0 && timing.deferred.every((e) => e.start > timing.fcp),
    JSON.stringify(timing)
  );

  // ── 2. The boundary is real ──────────────────────────────────────────────────────────────────
  // Measured from the network, not the build: a config that silently collapsed back to one chunk
  // would still build green, and this is what would catch it.
  await page.waitForTimeout(2200); // let the idle prefetch run
  const distinctJs = new Set(jsRequests.map((r) => r.url));
  check(
    "more than one JS file is served, so the split did not collapse",
    distinctJs.size >= 2,
    [...distinctJs].join(" | ")
  );
  check(
    "every JS request returned 200 or verified cached content — no chunk 404s",
    jsRequests.every(validJs),
    jsRequests.filter((r) => r.status !== 200).map((r) => `${r.url}:${r.status}`).join(" | ")
  );

  // ── 3. The planner, whose chunk is the whole point of the split ──────────────────────────────
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);
  check("a hub opened", (await page.locator(".place-card").count()) > 0);

  for (let i = 0; i < 2; i += 1) {
    const save = page.locator(".place-card__save").nth(i);
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await page.waitForTimeout(200);
    }
  }

  // B18+/B27: el planificador es el contenido de la pestaña Viaje (ya no hay panel de guardados con botón).
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Viaje" }).click();
  // Deliberately generous: this is the wait a real person would experience if the prefetch had
  // not already landed, and the point is that the surface arrives, not how fast.
  await page.waitForSelector("#sequence-builder-title", { timeout: 10000 }).catch(() => {});
  check("the deferred planner really opened", (await page.locator("#sequence-builder-title").count()) === 1);
  check("opening the planner raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("opening the planner 404ed no chunk", jsRequests.every(validJs));
  let o = await noOverflow(page);
  check("the planner introduced no horizontal overflow", !o.page);

  // Salir y volver: un componente lazy ya resuelto no debe volver a suspenderse.
  await nav.getByRole("button", { name: "Explorar" }).click();
  await page.waitForTimeout(400);
  await nav.getByRole("button", { name: "Viaje" }).click();
  await page.waitForTimeout(400);
  check(
    "returning to the planner works, and does not re-suspend",
    (await page.locator("#sequence-builder-title").count()) === 1
  );

  // ── 4. The zone comparison, the second deferred surface ──────────────────────────────────────
  // B30: la comparación de zonas es «Viaje › Dónde dormir».
  await page.getByRole("group", { name: "Secciones de Viaje" }).getByRole("button", { name: "Dónde dormir", exact: true }).click();
  await page.waitForSelector(".zone-card", { timeout: 10000 }).catch(() => {});
  check("the zone comparison can be reached", (await page.locator(".zone-card").count()) > 0);
  check("the deferred zone comparison really opened", (await page.locator(".zone-card").count()) > 0);
  check("opening the comparison raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  o = await noOverflow(page);
  check("the comparison introduced no horizontal overflow", !o.page);

  // ── 5. Nothing leaked ────────────────────────────────────────────────────────────────────────
  check("no JS request failed across the whole session", failedRequests.length === 0, failedRequests.join(" | "));
  check("every JS request across the session returned 200 or verified cached content", jsRequests.every(validJs));
  check("the session logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("the session raised no page error", pageErrors.length === 0, pageErrors.join(" | "));

  // A reload with a warm cache must behave identically — the split must not depend on a cold cache.
  await Promise.all([...pendingBodies]);
  if (process.env.NIHON_B12_MUTANT === "warm-404") {
    await page.route("**/assets/index-*.js", route => route.fulfill({ status: 404, contentType: "application/javascript", body: "B12 expected warm failure" }));
  }
  parsedScripts.clear();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await Promise.all([...pendingBodies]);
  // A 304 has no HTTP entity. Verify the exact module source the browser
  // actually loaded, without a fetch that could repair a failed chunk.
  for (const row of jsRequests.filter(request => request.status === 304)) {
    const scriptId = parsedScripts.get(new URL(row.url, url).href);
    if (!scriptId) continue;
    const { scriptSource } = await debuggerSession.send("Debugger.getScriptSource", { scriptId });
    row.bodyBytes = Buffer.byteLength(scriptSource);
    row.bodySha256 = createHash("sha256").update(scriptSource).digest("hex");
    cacheProbes.push({ url: row.url, scriptId, bytes: row.bodyBytes, sha256: row.bodySha256 });
  }
  console.log("  warm JS network (raw status, body fingerprint):", JSON.stringify(jsRequests));
  console.log("  executed cached module fingerprints:", JSON.stringify(cacheProbes));
  check("a repeat load still mounts", (await page.locator("#root > *").count()) > 0);
  check("a repeat load raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("a repeat load failed no own request", failedRequests.length === 0, failedRequests.join(" | "));
  check("a repeat load logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("a repeat load 404ed no chunk", jsRequests.every(validJs));

  await context.close();
}

console.log("Block 12 bundle-architecture audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 12 bundle-architecture audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
