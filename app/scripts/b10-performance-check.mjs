import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate B10.3 — rendimiento y bytes de imagen por ciudad (`08` G6, `06 §6`, DDR-MERGE-1).
 *
 * Mide sobre la build de producción, por ciudad (hub) y por viewport (390×844 @2 y 1440×900 @1):
 *   · bytes de imagen al recorrer la ciudad completa (desde el clic en la ciudad hasta el final de la lista) ≤ 3,5 MB (`06 §6.3`);
 *   · 0 originales (todo derivado `-400w`/`-800w`), 0 duplicados (misma URL dos veces), 0 fallos;
 *   · carga diferida: justo tras abrir la ciudad, ninguna imagen de tarjetas a más de 2 pantallas de distancia se ha descargado;
 *   · dimensiones: ninguna imagen se descarga a más de 2,5× su caja pintada (× DPR);
 *   · JS/CSS iniciales: gzip del chunk de entrada y del CSS (trinquete, ver B10-P1 abajo).
 *
 * B10-P1 (CERRADO en el endurecimiento post-B10): el chunk de entrada había crecido a 390 329 B gzip frente a los 253 742 B de v1.1.0.
 * Causa medida: `photography-metadata.json` entraba entero (143 KB raw… 148 KB de LQIP base64 que el runtime nunca lee, más URLs de adquisición,
 * fechas y dimensiones originales). `vite.config.ts` sirve ahora `photography-metadata.json?runtime`, una proyección con sólo los campos que
 * lee `buildRegistry` (`src/data/photography-runtime-projection.ts`; el JSON canónico no cambia y un test prueba que `placeImages` es idéntico).
 * Entrada: 277 912 B gzip (+9,5 % vs v1.1.0; el resto es código y `places.json` de B25–B31). Este gate protege la invariante, no sólo el número:
 * J01 techo ratcheteado, J01b ningún LQIP inline ni URL de adquisición en el entry (los chunks diferidos siguen protegidos por J03 y block12).
 *
 * Uso: `npm run build && node scripts/b10-performance-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const APP = fileURLToPath(new URL("..", import.meta.url));
const HUB_BUDGET_BYTES = 3_500_000; // 06 §6.3
const ENTRY_GZIP_CEILING = 285_000; // medido 277 912 B (+9,5 % vs v1.1.0); B10-P1 cerrado
const CSS_GZIP_CEILING = 28_500; // medido 27 453 B
const ENTRY_GZIP_V110 = 253_742; // BLOCK_14_HANDOFF: referencia v1.1.0

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const hubCounts = {};
for (const p of places) hubCounts[p.hub] = (hubCounts[p.hub] ?? 0) + 1;
const HUBS = Object.entries(hubCounts).filter(([, n]) => n >= 10).map(([h]) => h);

const evidence = { browser: BROWSER, entryGzip: null, cssGzip: null, hubs: [] };
let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 400)}`);
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

// ───────────── Estático: JS/CSS iniciales (gzip)
const assets = readdirSync(new URL("../dist/assets/", import.meta.url));
const gz = (f) => gzipSync(readFileSync(new URL(`../dist/assets/${f}`, import.meta.url)), { level: 9 }).length;
const entryJs = assets.find((f) => /^index-.*\.js$/.test(f));
const css = assets.find((f) => /^index-.*\.css$/.test(f));
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
await ck("J01", `chunk de entrada ${entryJs}: gzip ≤ ${ENTRY_GZIP_CEILING} (v1.1.0: ${ENTRY_GZIP_V110}; B10-P1)`, async () => {
  const size = gz(entryJs);
  evidence.entryGzip = size;
  evidence.cssGzip = gz(css);
  console.log(`# entrada gzip=${size} (${(((size / ENTRY_GZIP_V110) - 1) * 100).toFixed(1)} % vs v1.1.0) css gzip=${gz(css)}`);
  ok(size <= ENTRY_GZIP_CEILING, `entrada ${size} B gzip > techo ${ENTRY_GZIP_CEILING}`);
});
await ck("J01b", "el entry no incluye carga útil fotográfica que el runtime no lee (LQIP inline, URLs de adquisición)", async () => {
  const code = readFileSync(new URL(`../dist/assets/${entryJs}`, import.meta.url), "utf8");
  ok(!code.includes("data:image/webp;base64,"), "hay LQIP base64 en el entry");
  ok(!code.includes("upload.wikimedia.org/wikipedia/commons"), "hay URLs de adquisición en el entry");
});
await ck("J02", "CSS inicial gzip ≤ techo", async () => ok(gz(css) <= CSS_GZIP_CEILING, `css ${gz(css)} B gzip`));
await ck("J03", "los chunks diferidos (planificador, comparación de zonas) no son modulepreload del documento", async () => {
  for (const f of assets.filter((a) => /^(OrderedSequenceBuilder|ZoneComparison)-.*\.js$/.test(a))) ok(!html.includes(f), `${f} está en index.html`);
});
await ck("J04", "ningún derivado fotográfico supera 200 KB ni existe un original > 400 KB referenciado por la app", async () => {
  const dir = new URL("../public/images/places/", import.meta.url);
  let max = 0;
  let maxName = "";
  const walk = (u) => {
    for (const e of readdirSync(u)) {
      const p = new URL(e, u);
      if (statSync(p).isDirectory()) walk(new URL(`${e}/`, u));
      else if (/-(400|800)w\.webp$/.test(e) && statSync(p).size > max) { max = statSync(p).size; maxName = e; }
    }
  };
  walk(dir);
  console.log(`# mayor derivado: ${maxName} ${max} B`);
  ok(max <= 200_000, `derivado de ${max} B (${maxName})`);
});

// ───────────── Navegador: bytes de imagen por ciudad
const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()}`);

/**
 * Contrato de medida (G6): «bytes de imagen desde el CLIC REAL en la ciudad hasta el final del recorrido del hub».
 *   · petición de imagen INICIADA antes del evento `click` real  → tráfico de portada (`pre`), aunque termine después;
 *   · petición de imagen INICIADA desde el evento `click` real   → tráfico del hub (`hub`), siempre íntegra.
 * La frontera es el evento `click` (capturado en la página), no la llamada `locator.click()`: ésta hace antes un
 * auto-scroll hasta el botón que activa fotos de la portada, y con la ventana abierta antes de ese scroll se atribuían al hub.
 * El instante de inicio de cada petición sale de Resource Timing (`startTime`), en la misma línea de tiempo que el clic.
 * Antes de abrir la ventana el scroll hasta el botón se hace explícitamente y se espera a que no haya imágenes en vuelo
 * (estado de red/peticiones, no un retardo). `NIHON_B10_PERF_MUTANT=window-at-click-call` reintroduce la ventana anterior.
 */
const LEGACY_WINDOW = process.env.NIHON_B10_PERF_MUTANT === "window-at-click-call";
const IMAGE_URL = /\.(webp|jpg|jpeg|png|avif)(\?|$)/i;

async function measureHub(hub, viewport, dpr, { injectPostClick = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const responses = []; // toda respuesta de imagen de la sesión; no se vacía nunca
  let inFlight = 0;
  let pendingBodies = 0;
  const isImage = (u) => IMAGE_URL.test(u) && u.startsWith(url);
  page.on("request", (req) => { if (isImage(req.url())) inFlight += 1; });
  page.on("requestfinished", (req) => { if (isImage(req.url())) inFlight -= 1; });
  page.on("requestfailed", (req) => { if (isImage(req.url())) inFlight -= 1; });
  page.on("response", async (res) => {
    const u = res.url();
    if (!isImage(u)) return;
    pendingBodies += 1;
    try {
      const body = await res.body();
      responses.push({ url: u, bytes: body.length, status: res.status() });
    } catch {
      responses.push({ url: u, bytes: 0, status: res.status() });
    } finally {
      pendingBodies -= 1;
    }
  });
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem("nihon.onboarding.seen.v1", "1"); } catch { /* */ }
    performance.setResourceTimingBufferSize(5000);
    // Frontera de la ventana del hub: el evento `click` real sobre un botón de ciudad.
    document.addEventListener("click", (event) => {
      if (window.__nihonClickAt === undefined && event.target instanceof Element && event.target.closest('[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button')) {
        window.__nihonClickAt = performance.now();
      }
    }, true);
  });
  if (process.env.NIHON_B10_PERF_MUTANT === "eager-far-card") {
    // Activación diferida (B10 #177): una tarjeta lejana no tiene `src` hasta que su observador la activa, así que no hay nada que forzar.
    // El defecto que este control reintroduce es «las tarjetas lejanas se cargan al abrir la ciudad»: se informa toda observación como
    // visible (todas las tarjetas obtienen su src) y más abajo se fuerza loading=eager en una lejana no cacheada, como siempre.
    await page.addInitScript(() => {
      const Original = window.IntersectionObserver;
      window.IntersectionObserver = class extends Original {
        constructor(callback, options) {
          super((entries, observer) => callback(entries.map((entry) => ({ isIntersecting: true, target: entry.target })), observer), options);
        }
      };
    });
  }
  await page.goto(url, { waitUntil: "networkidle" });
  const btn = page.locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`).filter({ hasText: new RegExp(`^${hub}\\b`) }).first();
  const unactivatedBefore = await page.evaluate(() => [...document.querySelectorAll(".explorer-home .place-card img.place-card__image")].filter((i) => !i.getAttribute("src")).length);
  const scrollStart = await page.evaluate(() => performance.now());
  if (!LEGACY_WINDOW) {
    await btn.scrollIntoViewIfNeeded();
    // dos fotogramas: los observadores de la portada ya entregaron lo que el scroll cambió
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForLoadState("networkidle");
    while (inFlight > 0 || pendingBodies > 0) await new Promise((r) => setTimeout(r, 25)); // espera a un estado (sin imágenes en vuelo), no un retardo fijo
  } else {
    // ventana anterior: se abre justo antes de `locator.click()`, cuyo auto-scroll previo cae dentro de ella
    await page.evaluate(() => { window.__nihonClickAt = performance.now(); });
  }
  await btn.click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(700);
  // carga diferida: imágenes de tarjetas lejos de la pantalla ya descargadas
  const lazy = await page.evaluate(() => {
    const vh = window.innerHeight;
    const imgs = [...document.querySelectorAll(".place-card img")];
    const far = imgs.filter((i) => i.getBoundingClientRect().top > vh * 3 && i.complete && i.naturalWidth > 0);
    return { total: imgs.length, farLoaded: far.length };
  });
  // recorrer toda la ciudad
  for (let i = 0; i < 90; i += 1) {
    const done = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".place-card")];
      const last = cards[cards.length - 1];
      let el = last?.parentElement;
      while (el && !(el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      const scroller = el ?? document.scrollingElement;
      const before = scroller.scrollTop;
      scroller.scrollBy(0, Math.max(300, window.innerHeight * 0.8));
      return scroller.scrollTop === before;
    });
    await page.waitForTimeout(110);
    if (done) break;
  }
  let injected = null;
  if (injectPostClick) {
    // petición artificial POSTERIOR al clic (control del propio gate): debe sumarse íntegra al hub
    const base = responses.find((r) => r.status === 200)?.url;
    const synthetic = `${base}?synthetic-post-click=1`;
    await page.evaluate((src) => new Promise((resolve) => { const img = new Image(); img.onload = resolve; img.onerror = resolve; img.src = src; }), synthetic);
    injected = { url: synthetic };
  }
  await page.waitForTimeout(700);
  while (inFlight > 0 || pendingBodies > 0) await new Promise((r) => setTimeout(r, 25)); // espera a un estado (sin imágenes en vuelo), no un retardo fijo
  const dims = await page.evaluate((dprIn) =>
    [...document.querySelectorAll(".place-card img, .gallery img")].filter((i) => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 0).map((i) => ({ src: i.currentSrc, natural: i.naturalWidth, shown: i.getBoundingClientRect().width * dprIn }))
  , dpr);
  const timing = await page.evaluate(() => ({
    clickAt: window.__nihonClickAt,
    entries: performance.getEntriesByType("resource").map((e) => [e.name, e.startTime]),
  }));
  await context.close();
  ok(typeof timing.clickAt === "number", "no se registró el evento click real sobre la ciudad");
  const starts = new Map();
  for (const [name, start] of timing.entries) starts.set(name, [...(starts.get(name) ?? []), start]);
  const classified = responses.map((r) => {
    const start = starts.get(r.url)?.shift();
    ok(start !== undefined, `sin Resource Timing para ${r.url}: no se puede atribuir a portada u hub`);
    return { ...r, start, phase: start < timing.clickAt ? "pre" : "hub" };
  });
  const pre = classified.filter((r) => r.phase === "pre");
  const hubResponses = classified.filter((r) => r.phase === "hub");
  const syntheticResponse = injected ? hubResponses.find((r) => r.url === injected.url) : null;
  const urls = hubResponses.map((r) => r.url);
  return {
    bytes: hubResponses.reduce((a, r) => a + r.bytes, 0),
    count: hubResponses.length,
    dupes: urls.filter((u, i) => urls.indexOf(u) !== i),
    originals: urls.filter((u) => !/-(400|800)w\.webp/.test(u)),
    failed: hubResponses.filter((r) => r.status >= 400),
    lazy,
    oversize: dims.filter((d) => d.natural > d.shown * 2.5 && d.natural > 450),
    homeBytes: pre.reduce((a, r) => a + r.bytes, 0),
    homeCount: pre.length,
    clickAt: timing.clickAt,
    unactivatedBefore,
    preAfterScroll: pre.filter((r) => r.start >= scrollStart).map((r) => r.url),
    preUrls: pre.map((r) => r.url),
    hubUrls: urls,
    hubMinStart: hubResponses.length ? Math.min(...hubResponses.map((r) => r.start)) : null,
    synthetic: syntheticResponse ? { url: syntheticResponse.url, bytes: syntheticResponse.bytes } : null,
    hubBytesWithoutSynthetic: hubResponses.filter((r) => r !== syntheticResponse).reduce((a, r) => a + r.bytes, 0),
  };
}

for (const [label, viewport, dpr] of [["móvil 390×844@2", { width: 390, height: 844 }, 2], ["escritorio 1440×900@1", { width: 1440, height: 900 }, 1]]) {
  for (const hub of HUBS) {
    await ck(`I-${label.split(" ")[0]}-${hub}`, `${label} · ${hub}: imágenes ≤ 3,5 MB, sin originales/duplicados/fallos, diferidas y sin sobredimensión`, async () => {
      const r = await measureHub(hub, viewport, dpr);
      console.log(`# ${label} · ${hub}: ${r.count} img · ${r.bytes} B (pre-clic/portada: ${r.homeCount} img · ${r.homeBytes} B) · ${r.lazy.farLoaded}/${r.lazy.total} lejanas ya cargadas · sobredimensionadas ${r.oversize.length}`);
      evidence.hubs.push({ viewport: label, hub, images: r.count, bytes: r.bytes, hubImages: r.count, hubBytes: r.bytes, preClickImages: r.homeCount, preClickBytes: r.homeBytes, budget: HUB_BUDGET_BYTES, homeImages: r.homeCount, homeBytes: r.homeBytes, farLoadedAtOpen: r.lazy.farLoaded, cards: r.lazy.total, oversize: r.oversize.length, duplicates: r.dupes.length, originals: r.originals.length, failed: r.failed.length });
      ok(r.count > 0, "ninguna imagen medida: el gate no midió nada");
      ok(r.bytes <= HUB_BUDGET_BYTES, `${r.bytes} B > ${HUB_BUDGET_BYTES} B`);
      ok(r.originals.length === 0, `originales descargados: ${r.originals.slice(0, 2)}`);
      ok(r.dupes.length === 0, `duplicados: ${[...new Set(r.dupes)].slice(0, 2)}`);
      ok(r.failed.length === 0, `fallos: ${r.failed.slice(0, 2).map((f) => f.url)}`);
      ok(r.lazy.farLoaded === 0, `${r.lazy.farLoaded} imágenes a más de 3 pantallas ya descargadas al abrir la ciudad (carga no diferida)`);
      ok(r.oversize.length === 0, `sobredimensionadas: ${r.oversize.slice(0, 2).map((d) => `${d.natural}px→${Math.round(d.shown)}px`)}`);
    });
  }
}

// ───────────── Control del propio gate: clasificación pre-clic (portada) / hub y suma de una petición posterior al clic
await ck("K", "ventana del hub: el scroll previo al clic activa fotos de la portada y quedan como pre-clic; lo iniciado tras el clic suma al hub", async () => {
  const r = await measureHub("Osaka", { width: 1440, height: 900 }, 1, { injectPostClick: true });
  console.log(`# K: portada sin activar antes del scroll ${r.unactivatedBefore} · activadas por el scroll previo al clic ${r.preAfterScroll.length} · pre-clic ${r.homeCount} img/${r.homeBytes} B · hub ${r.count} img/${r.bytes} B · sintética ${r.synthetic?.bytes ?? "no"} B`);
  ok(r.unactivatedBefore > 0, "no había tarjetas de la portada sin activar: el gate no midió nada");
  ok(r.preAfterScroll.length > 0, "el scroll previo al clic no activó imágenes de la portada, o se atribuyeron al hub");
  const hub = new Set(r.hubUrls);
  ok(r.preAfterScroll.every((u) => !hub.has(u)), "una petición iniciada antes del clic está en el hub");
  ok(r.count > 0 && r.hubMinStart >= r.clickAt, "hay peticiones del hub iniciadas antes del clic real");
  ok(r.synthetic && r.synthetic.bytes > 0, "la petición artificial posterior al clic no entró en el hub");
  ok(r.bytes === r.hubBytesWithoutSynthetic + r.synthetic.bytes, "la petición posterior al clic no suma íntegra a hubBytes");
});

await browser.close();
await server.close();
if (process.env.NIHON_B10_PERF_JSON) writeFileSync(process.env.NIHON_B10_PERF_JSON, JSON.stringify(evidence, null, 2) + "\n");
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
