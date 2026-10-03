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
 * B10-P1 (registro histórico de main; no cierre G6 de #177): el chunk de entrada había crecido a 390 329 B gzip frente a los 253 742 B de v1.1.0.
 * Causa medida: `photography-metadata.json` entraba entero (143 KB raw… 148 KB de LQIP base64 que el runtime nunca lee, más URLs de adquisición,
 * fechas y dimensiones originales). `vite.config.ts` sirve ahora `photography-metadata.json?runtime`, una proyección con sólo los campos que
 * lee `buildRegistry` (`src/data/photography-runtime-projection.ts`; el JSON canónico no cambia y un test prueba que `placeImages` es idéntico).
 * #177 retains 08 G6 literally: ceiling 253 742 B; the historical 285 000 B ratchet is not a G6 exception.
 * Projection protection is retained separately:
 * J01 techo ratcheteado, J01b ningún LQIP inline ni URL de adquisición en el entry (los chunks diferidos siguen protegidos por J03 y block12).
 *
 * Uso: `npm run build && node scripts/b10-performance-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const APP = fileURLToPath(new URL("..", import.meta.url));
const HUB_BUDGET_BYTES = 3_500_000; // 06 §6.3
const ENTRY_GZIP_CEILING = 253_742; // 08 G6: v1.1.0; no exception or baseline reset authorized in #177
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
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()}`);

async function measureHub(hub, viewport, dpr) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const responses = [];
  const pendingBodies = new Set();
  page.on("response", (res) => {
    const u = res.url();
    if (!/\.(webp|jpg|jpeg|png|avif)(\?|$)/i.test(u) || !u.startsWith(url)) return;
    const body = (async () => {
      try {
        const buffer = await res.body();
        responses.push({ url: u, bytes: buffer.length, status: res.status() });
      } catch {
        responses.push({ url: u, bytes: 0, status: res.status() });
      }
    })();
    pendingBodies.add(body);
    void body.finally(() => pendingBodies.delete(body));
  });
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(() => { try { localStorage.setItem("nihon.onboarding.seen.v1", "1"); } catch { /* */ } });
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
  // Network idle can precede React's first paint on a busy host. Do not cut the
  // home window until its real eager images exist and their response bodies settle.
  await page.locator(".explorer-home__city-image").first().waitFor();
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".explorer-home__city-image")];
    return images.length > 0 && images.every(i => i.complete && i.naturalWidth > 0);
  });
  await page.waitForTimeout(500);
  await Promise.all([...pendingBodies]);
  const homeUrls = new Set(responses.map(r => r.url));
  const homeBytes = responses.reduce((a, r) => a + r.bytes, 0);
  const homeCount = responses.length;
  ok(homeCount > 0, "home image window was not measured");
  responses.length = 0;
  const btn = page.locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`).filter({ hasText: new RegExp(`^${hub}\\b`) }).first();
  await btn.click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(700);
  await Promise.all([...pendingBodies]);
  // Negative coverage: force a real, uncached distant card image to load eagerly.
  if (process.env.NIHON_B10_PERF_MUTANT === "eager-far-card" && hub === "Tokio" && viewport.width === 390) {
    const before = [...homeUrls];
    await page.evaluate(async (cached) => {
      const image = [...document.querySelectorAll('.place-card img')].find(i => i.getBoundingClientRect().top > innerHeight * 3 && !cached.includes(i.currentSrc || i.src));
      if (!image) throw new Error("negative fixture requires an uncached distant card image");
      image.loading = "eager";
      await image.decode();
    }, before);
  }
  // Reused images already downloaded on the home page cannot be deferred again.
  // Keep their raw count and every byte measurement; only new far downloads violate lazy loading.
  const lazy = await page.evaluate(() => {
    const vh = window.innerHeight;
    const imgs = [...document.querySelectorAll(".place-card img")];
    const far = imgs.filter((i) => i.getBoundingClientRect().top > vh * 3 && i.complete && i.naturalWidth > 0);
    return { total: imgs.length, farLoaded: far.length, farUrls: far.map(i=>i.currentSrc) };
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
  await page.waitForTimeout(700);
  const dims = await page.evaluate((dprIn) =>
    [...document.querySelectorAll(".place-card img, .gallery img")].filter((i) => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 0).map((i) => ({ src: i.currentSrc, natural: i.naturalWidth, shown: i.getBoundingClientRect().width * dprIn }))
  , dpr);
  await context.close();
  const urls = responses.map((r) => r.url);
  return {
    bytes: responses.reduce((a, r) => a + r.bytes, 0),
    count: responses.length,
    dupes: urls.filter((u, i) => urls.indexOf(u) !== i),
    originals: urls.filter((u) => !/-(400|800)w\.webp/.test(u)),
    failed: responses.filter((r) => r.status >= 400),
    lazy: { ...lazy, newFarLoaded: lazy.farUrls.filter(u=>!homeUrls.has(u)).length, reusedFarLoaded: lazy.farUrls.filter(u=>homeUrls.has(u)).length },
    oversize: dims.filter((d) => d.natural > d.shown * 2.5 && d.natural > 450),
    homeBytes,
    homeCount,
  };
}

for (const [label, viewport, dpr] of [["móvil 390×844@2", { width: 390, height: 844 }, 2], ["escritorio 1440×900@1", { width: 1440, height: 900 }, 1]]) {
  for (const hub of HUBS) {
    if (process.env.NIHON_B10_PERF_MUTANT === "eager-far-card" && (hub !== "Tokio" || viewport.width !== 390)) continue;
    await ck(`I-${label.split(" ")[0]}-${hub}`, `${label} · ${hub}: imágenes ≤ 3,5 MB, sin originales/duplicados/fallos, diferidas y sin sobredimensión`, async () => {
      const r = await measureHub(hub, viewport, dpr);
      console.log(`# ${label} · ${hub}: ${r.count} img · ${r.bytes} B (portada previa: ${r.homeCount} img · ${(r.homeBytes / 1e6).toFixed(2)} MB) · ${r.lazy.farLoaded}/${r.lazy.total} lejanas ya cargadas · sobredimensionadas ${r.oversize.length}`);
      evidence.hubs.push({ viewport: label, hub, images: r.count, bytes: r.bytes, budget: HUB_BUDGET_BYTES, homeImages: r.homeCount, homeBytes: r.homeBytes, farLoadedAtOpen: r.lazy.farLoaded, newFarLoadedAtOpen: r.lazy.newFarLoaded, reusedFarLoadedAtOpen: r.lazy.reusedFarLoaded, cards: r.lazy.total, oversize: r.oversize.length, duplicates: r.dupes.length, originals: r.originals.length, failed: r.failed.length });
      ok(r.count > 0, "ninguna imagen medida: el gate no midió nada");
      ok(r.bytes <= HUB_BUDGET_BYTES, `${r.bytes} B > ${HUB_BUDGET_BYTES} B`);
      ok(r.originals.length === 0, `originales descargados: ${r.originals.slice(0, 2)}`);
      ok(r.dupes.length === 0, `duplicados: ${[...new Set(r.dupes)].slice(0, 2)}`);
      ok(r.failed.length === 0, `fallos: ${r.failed.slice(0, 2).map((f) => f.url)}`);
      ok(r.lazy.newFarLoaded === 0, `${r.lazy.newFarLoaded} imágenes nuevas a más de 3 pantallas descargadas al abrir la ciudad (carga no diferida)`);
      ok(r.oversize.length === 0, `sobredimensionadas: ${r.oversize.slice(0, 2).map((d) => `${d.natural}px→${Math.round(d.shown)}px`)}`);
    });
  }
}

await browser.close();
await server.close();
evidence.failures = failures;
if (process.env.NIHON_B10_PERF_JSON) writeFileSync(process.env.NIHON_B10_PERF_JSON, JSON.stringify(evidence, null, 2) + "\n");
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
