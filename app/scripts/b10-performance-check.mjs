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
 * Auditoría final (6 oct 2026) — contrato de la medición, explícito (la investigación y sus mediciones, en
 * `docs/FINAL_AUDIT_PERFORMANCE_INVESTIGATION.md`):
 *   · INICIO: el evento `click` real sobre la tarjeta del hub (un listener en captura en la página lo sella con
 *     `Date.now()`), NO la llamada `btn.click()` del script. Esa llamada primero hace scroll hasta el botón, y ese
 *     scroll de la portada puede lanzar peticiones de imágenes `loading="lazy"` de OTRAS ciudades (cuatro de Tokio,
 *     273.696 B, en 2 de 6 ejecuciones de la base) que empiezan 55–87 ms antes del clic: pertenecen a la portada.
 *   · FIN: tras recorrer la lista hasta el final y 700 ms de asentamiento.
 *   · ATRIBUCIÓN: por el instante en que se INICIÓ la petición (`request.timing().startTime`, con `Date.now()` en
 *     el evento `request` como respaldo), no por el instante en que termina de leerse su cuerpo. Una petición es de
 *     la ciudad si empezó en el clic o después. Las que el procedimiento anterior habría contado (empezadas tras
 *     vaciar el registro y antes del clic) se informan aparte como «de la portada», sin sumarse.
 *   · Carga diferida: se separa lo que decide el navegador (margen de `loading="lazy"`, mayor en conexiones lentas)
 *     de una carga anticipada del producto (imagen de tarjeta sin `loading="lazy"` que no es la única prioritaria).
 *
 * Uso: `npm run build && node scripts/b10-performance-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
// Opcional, sólo Chromium: `NIHON_CPU_THROTTLE=4` reproduce un equipo lento o cargado (la investigación de la
// auditoría final lo usó para demostrar que la atribución por inicio de petición no depende de la velocidad).
const CPU_THROTTLE = Number(process.env.NIHON_CPU_THROTTLE ?? 1);
const APP = fileURLToPath(new URL("..", import.meta.url));
const HUB_BUDGET_BYTES = 3_500_000; // 06 §6.3
const ENTRY_GZIP_CEILING = 285_000; // medido 277 912 B (+9,5 % vs v1.1.0); B10-P1 cerrado
const CSS_GZIP_CEILING = 28_500; // medido 27 453 B
const ENTRY_GZIP_V110 = 253_742; // BLOCK_14_HANDOFF: referencia v1.1.0
// Margen máximo de `loading="lazy"` en Chromium con una conexión efectiva lenta (3G o peor): 2500 px más allá del
// viewport. Con conexión rápida es 1250 px. Medido con una página de control sin la app (investigación, §4): 1,90
// pantallas sin limitación y 3,79 pantallas con 3G emulada, en 390×844.
const CHROMIUM_SLOW_LAZY_MARGIN_PX = 2500;

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

async function measureHub(hub, viewport, dpr) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  if (CPU_THROTTLE > 1 && BROWSER === "chromium") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  }
  const responses = [];
  const startedAtByUrl = new Map();
  const isImage = (u) => /\.(webp|jpg|jpeg|png|avif)(\?|$)/i.test(u) && u.startsWith(url);
  page.on("request", (req) => {
    if (isImage(req.url())) startedAtByUrl.set(req.url(), Date.now());
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (!isImage(u)) return;
    let bytes = 0;
    let status = res.status();
    try {
      bytes = (await res.body()).length;
    } catch {
      bytes = 0;
    }
    const timing = res.request().timing();
    // `startTime` (época, ms) es el inicio real de la petición; si el navegador no lo da, el del evento `request`.
    const startedAt = timing && timing.startTime > 0 ? timing.startTime : startedAtByUrl.get(u) ?? Date.now();
    responses.push({ url: u, bytes, status, startedAt, finishedAt: Date.now() });
  });
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem("nihon.onboarding.seen.v1", "1"); } catch { /* */ }
    // El INICIO de la medición es el clic real, no la llamada del script (que antes hace scroll hasta el botón).
    window.__nihonClickAt = null;
    document.addEventListener("click", () => { if (window.__nihonClickAt === null) window.__nihonClickAt = Date.now(); }, true);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  // Instante en que el procedimiento anterior «vaciaba el registro»: sólo para informar de lo que habría contado de más.
  const legacyClearedAt = Date.now();
  const btn = page.locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`).filter({ hasText: new RegExp(`^${hub}\\b`) }).first();
  await btn.click();
  const clickAt = await page.evaluate(() => window.__nihonClickAt);
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(700);
  // carga diferida: ¿lo decidió el navegador (margen de `loading="lazy"`) o el producto (imagen sin `lazy`)?
  const lazy = await page.evaluate(({ slowMargin }) => {
    const vh = window.innerHeight;
    const imgs = [...document.querySelectorAll(".place-card img")];
    const loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0);
    const far = loaded.filter((i) => i.getBoundingClientRect().top > vh * 3);
    const priority = imgs.filter((i) => i.getAttribute("fetchpriority") === "high");
    const eager = imgs.filter((i) => i.getAttribute("loading") !== "lazy" && i.getAttribute("fetchpriority") !== "high");
    const describe = (i) => `${i.currentSrc.split("/").pop()}@${Math.round(i.getBoundingClientRect().top)}px`;
    // Defecto del producto: una imagen sin `loading="lazy"` que no es la prioritaria, o más de una prioritaria.
    // Margen del navegador: imagen `lazy` ya cargada a más de 3 pantallas pero dentro del margen máximo de Chromium.
    const farBrowser = far.filter((i) => i.getAttribute("loading") === "lazy" && i.getBoundingClientRect().top <= vh + slowMargin);
    const farDefect = far.filter((i) => !farBrowser.includes(i));
    return {
      total: imgs.length,
      farLoaded: farDefect.length,
      farLoadedDescribed: farDefect.map(describe),
      farWithinBrowserMargin: farBrowser.length,
      farWithinBrowserMarginDescribed: farBrowser.map(describe),
      productEager: eager.length,
      productEagerDescribed: eager.map(describe),
      priorityCards: priority.length,
    };
  }, { slowMargin: CHROMIUM_SLOW_LAZY_MARGIN_PX });
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
  // Atribución por INICIO de la petición: ciudad = empezó en el clic o después; portada = antes.
  const city = responses.filter((r) => r.startedAt >= clickAt);
  const home = responses.filter((r) => r.startedAt < clickAt);
  // Lo que el procedimiento anterior (registro vaciado antes de `btn.click()`, atribución por fin de lectura) habría
  // sumado a la ciudad aunque la petición empezase antes del clic.
  const legacyExtra = home.filter((r) => r.finishedAt >= legacyClearedAt);
  const urls = city.map((r) => r.url);
  return {
    bytes: city.reduce((a, r) => a + r.bytes, 0),
    count: city.length,
    dupes: urls.filter((u, i) => urls.indexOf(u) !== i),
    originals: urls.filter((u) => !/-(400|800)w\.webp/.test(u)),
    failed: city.filter((r) => r.status >= 400),
    lazy,
    oversize: dims.filter((d) => d.natural > d.shown * 2.5 && d.natural > 450),
    homeBytes: home.reduce((a, r) => a + r.bytes, 0),
    homeCount: home.length,
    legacyExtra: { count: legacyExtra.length, bytes: legacyExtra.reduce((a, r) => a + r.bytes, 0), files: legacyExtra.map((r) => r.url.split("/").pop()) },
  };
}

for (const [label, viewport, dpr] of [["móvil 390×844@2", { width: 390, height: 844 }, 2], ["escritorio 1440×900@1", { width: 1440, height: 900 }, 1]]) {
  for (const hub of HUBS) {
    await ck(`I-${label.split(" ")[0]}-${hub}`, `${label} · ${hub}: imágenes ≤ 3,5 MB, sin originales/duplicados/fallos, diferidas y sin sobredimensión`, async () => {
      const r = await measureHub(hub, viewport, dpr);
      console.log(`# ${label} · ${hub}: ${r.count} img · ${r.bytes} B (portada previa: ${r.homeCount} img · ${(r.homeBytes / 1e6).toFixed(2)} MB) · ${r.lazy.farLoaded}/${r.lazy.total} lejanas ya cargadas · sobredimensionadas ${r.oversize.length}`);
      if (r.legacyExtra.count > 0) console.log(`#   de la portada, no sumadas (empezaron antes del clic real; el procedimiento anterior las contaba): ${r.legacyExtra.count} img · ${r.legacyExtra.bytes} B · ${r.legacyExtra.files.join(", ")}`);
      if (r.lazy.farWithinBrowserMargin > 0) console.log(`#   cargadas por el margen de loading=lazy del navegador (a >3 pantallas, ≤ ${CHROMIUM_SLOW_LAZY_MARGIN_PX}px más allá del viewport): ${r.lazy.farWithinBrowserMarginDescribed.join(", ")}`);
      evidence.hubs.push({ viewport: label, hub, images: r.count, bytes: r.bytes, budget: HUB_BUDGET_BYTES, homeImages: r.homeCount, homeBytes: r.homeBytes, farLoadedAtOpen: r.lazy.farLoaded, farWithinBrowserMargin: r.lazy.farWithinBrowserMargin, productEager: r.lazy.productEager, legacyExtraBytes: r.legacyExtra.bytes, cards: r.lazy.total, oversize: r.oversize.length, duplicates: r.dupes.length, originals: r.originals.length, failed: r.failed.length });
      ok(r.count > 0, "ninguna imagen medida: el gate no midió nada");
      ok(r.bytes <= HUB_BUDGET_BYTES, `${r.bytes} B > ${HUB_BUDGET_BYTES} B`);
      ok(r.originals.length === 0, `originales descargados: ${r.originals.slice(0, 2)}`);
      ok(r.dupes.length === 0, `duplicados: ${[...new Set(r.dupes)].slice(0, 2)}`);
      ok(r.failed.length === 0, `fallos: ${r.failed.slice(0, 2).map((f) => f.url)}`);
      ok(r.lazy.productEager === 0, `carga anticipada del producto: ${r.lazy.productEager} imagen(es) de tarjeta sin loading="lazy" que no son la prioritaria (${r.lazy.productEagerDescribed.slice(0, 2)})`);
      ok(r.lazy.priorityCards <= 1, `${r.lazy.priorityCards} tarjetas con fetchpriority=high (06 §6.3: sólo la primera visible)`);
      ok(r.lazy.farLoaded === 0, `${r.lazy.farLoaded} imágenes a más de 3 pantallas descargadas al abrir la ciudad fuera del margen de loading=lazy del navegador (${r.lazy.farLoadedDescribed.slice(0, 2)})`);
      ok(r.oversize.length === 0, `sobredimensionadas: ${r.oversize.slice(0, 2).map((d) => `${d.natural}px→${Math.round(d.shown)}px`)}`);
    });
  }
}

await browser.close();
await server.close();
if (process.env.NIHON_B10_PERF_JSON) writeFileSync(process.env.NIHON_B10_PERF_JSON, JSON.stringify(evidence, null, 2) + "\n");
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
