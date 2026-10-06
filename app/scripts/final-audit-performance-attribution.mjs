import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Auditoría final — investigación del gate de rendimiento (`b10-performance-check.mjs`).
 *
 * El gate original conservó tres fallos en la auditoría independiente: Kioto móvil (4.132.690 B) y
 * Osaka móvil (3.589.036 B) sobre el presupuesto de 3.500.000 B, y la carga diferida de Tokio
 * móvil. Este script NO es un gate: es el instrumento que separa causa de hipótesis. Replica
 * exactamente el procedimiento del gate (misma secuencia, mismos selectores, mismo scroll) y mide
 * cada imagen de dos maneras a la vez:
 *
 *  - como la atribuye el gate: por el momento en que su manejador de `response` termina de leer el
 *    cuerpo y la mete en el registro vaciado justo antes del clic;
 *  - como la atribuye el contrato (`DDR-MERGE-1`, `06 §6.3`): por el momento en que se INICIÓ la
 *    petición — antes del clic en el hub = superficie de la portada; después = recorrido de la ciudad.
 *
 * Definición de la medición (contrato vigente): empieza en el clic en la tarjeta del hub y termina
 * tras recorrer la lista hasta el final y esperar 700 ms de asentamiento. Una imagen pertenece a
 * la ciudad si su petición empezó DESPUÉS del clic.
 *
 * Además, para la carga diferida registra, de cada imagen de tarjeta ya descargada al abrir la
 * ciudad, su atributo `loading`, su `fetchpriority` y su distancia al viewport, de modo que se pueda
 * distinguir lo que el navegador decide (margen de `loading="lazy"`) de una carga anticipada del
 * producto (imagen sin `loading="lazy"` o con prioridad alta).
 *
 * Uso: `npm run build && node scripts/final-audit-performance-attribution.mjs`
 *   NIHON_RUNS=5  NIHON_HUBS=Tokio,Kioto,Osaka  NIHON_PERF_VIEWPORT=movil|escritorio
 *   NIHON_CPU_THROTTLE=4   (sólo Chromium) ralentiza la CPU para reproducir un equipo lento o cargado
 *   NIHON_IMAGE_DELAY_MS=300  retrasa cada respuesta de imagen, como una red lenta
 *   NIHON_EVIDENCE_OUT=<dir>  NIHON_BROWSER=webkit  NIHON_CHROMIUM_PATH=<ruta>
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const RUNS = Number(process.env.NIHON_RUNS ?? 3);
const OUT = process.env.NIHON_EVIDENCE_OUT ?? null;
const APP = fileURLToPath(new URL("..", import.meta.url));
const BUDGET = 3_500_000;
const VIEWPORTS = {
  movil: { label: "móvil 390×844@2", viewport: { width: 390, height: 844 }, dpr: 2 },
  escritorio: { label: "escritorio 1440×900@1", viewport: { width: 1440, height: 900 }, dpr: 1 },
};
const CPU_THROTTLE = Number(process.env.NIHON_CPU_THROTTLE ?? 1);
const IMAGE_DELAY_MS = Number(process.env.NIHON_IMAGE_DELAY_MS ?? 0);
const viewportKey = process.env.NIHON_PERF_VIEWPORT ?? "movil";
const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const counts = {};
for (const place of places) counts[place.hub] = (counts[place.hub] ?? 0) + 1;
const HUBS = process.env.NIHON_HUBS
  ? process.env.NIHON_HUBS.split(",")
  : Object.entries(counts).filter(([, n]) => n >= 10).map(([hub]) => hub);

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" : undefined;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()} · ${VIEWPORTS[viewportKey].label} · ${RUNS} ejecuciones por ciudad · CPU ×${CPU_THROTTLE} · retraso de imagen ${IMAGE_DELAY_MS} ms`);

async function measureOnce(hub) {
  const { viewport, dpr } = VIEWPORTS[viewportKey];
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();

  const gateRegistry = []; // procedimiento del gate: se rellena al TERMINAR de leer el cuerpo
  const started = new Map(); // url → instante de INICIO de la petición
  const log = [];
  const isImage = (u) => /\.(webp|jpg|jpeg|png|avif)(\?|$)/i.test(u) && u.startsWith(url);
  page.on("request", (request) => {
    if (isImage(request.url())) started.set(request.url(), Date.now());
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (!isImage(u)) return;
    let bytes = 0;
    try {
      bytes = (await res.body()).length;
    } catch {
      bytes = 0;
    }
    const finishedAt = Date.now();
    const timing = res.request().timing();
    const startedAt = timing && timing.startTime > 0 ? timing.startTime : started.get(u) ?? null;
    const entry = { url: u, bytes, status: res.status(), startedAt, finishedAt };
    gateRegistry.push(entry);
    log.push(entry);
  });
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (IMAGE_DELAY_MS > 0 && isImage(u)) await new Promise((resolve) => setTimeout(resolve, IMAGE_DELAY_MS));
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  if (CPU_THROTTLE > 1 && BROWSER === "chromium") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  }
  await page.addInitScript(() => {
    try { localStorage.setItem("nihon.onboarding.seen.v1", "1"); } catch { /* */ }
    window.__nihonClickAt = null;
    document.addEventListener("click", () => { if (window.__nihonClickAt === null) window.__nihonClickAt = Date.now(); }, true);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const homeBytesAtClear = gateRegistry.reduce((a, r) => a + r.bytes, 0);
  const homeImagesAtClear = gateRegistry.length;
  gateRegistry.length = 0; // «vaciar el registro justo antes del clic» (DDR-MERGE-1, opción 1)
  const clearedAt = Date.now();

  const button = page
    .locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`)
    .filter({ hasText: new RegExp(`^${hub}\\b`) })
    .first();
  const clickAt = Date.now();
  await button.click();
  const clickEventAt = await page.evaluate(() => window.__nihonClickAt);
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(700);

  const lazy = await page.evaluate(() => {
    const vh = window.innerHeight;
    const cards = [...document.querySelectorAll(".place-card img")];
    const loaded = cards
      .filter((img) => img.complete && img.naturalWidth > 0)
      .map((img) => ({
        src: img.currentSrc.split("/").pop(),
        top: Math.round(img.getBoundingClientRect().top),
        screens: Math.round((img.getBoundingClientRect().top / vh) * 100) / 100,
        loading: img.getAttribute("loading"),
        fetchpriority: img.getAttribute("fetchpriority"),
      }));
    return {
      vh,
      total: cards.length,
      eager: cards.filter((img) => img.getAttribute("loading") !== "lazy").map((img) => img.currentSrc.split("/").pop()),
      far: loaded.filter((entry) => entry.top > vh * 3),
      farthestLoaded: loaded.reduce((max, entry) => Math.max(max, entry.top), 0),
      loadedCount: loaded.length,
    };
  });

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
  await context.close();

  const sum = (entries) => entries.reduce((a, r) => a + r.bytes, 0);
  const gateAttributed = [...gateRegistry];
  const byStart = log.filter((entry) => entry.startedAt !== null && entry.startedAt >= clickAt);
  // Contrato: ciudad = la petición empezó en el EVENTO de clic (no en la llamada del script, que antes hace scroll).
  const byRealClick = log.filter((entry) => entry.startedAt !== null && entry.startedAt >= clickEventAt);
  const startedBetweenCallAndEvent = log.filter((entry) => entry.startedAt !== null && entry.startedAt >= clickAt && entry.startedAt < clickEventAt);
  const leaked = gateAttributed.filter((entry) => entry.startedAt === null || entry.startedAt < clickAt);
  const missed = byStart.filter((entry) => !gateAttributed.includes(entry));
  const urls = gateAttributed.map((entry) => entry.url);
  return {
    hub,
    gate: { bytes: sum(gateAttributed), images: gateAttributed.length, overBudget: sum(gateAttributed) > BUDGET, files: gateAttributed.map((e) => e.url.split("/").pop()).sort() },
    byRealClickEvent: { bytes: sum(byRealClick), images: byRealClick.length, overBudget: sum(byRealClick) > BUDGET, files: byRealClick.map((e) => e.url.split("/").pop()).sort() },
    startedBetweenCallAndClickEvent: { images: startedBetweenCallAndEvent.length, bytes: sum(startedBetweenCallAndEvent), files: startedBetweenCallAndEvent.map((e) => e.url.split("/").pop()), msBeforeClick: startedBetweenCallAndEvent.map((e) => Math.round(clickEventAt - e.startedAt)) },
    callToClickEventMs: Math.round(clickEventAt - clickAt),
    byRequestStart: { bytes: sum(byStart), images: byStart.length, overBudget: sum(byStart) > BUDGET },
    leakedFromBeforeClick: { bytes: sum(leaked), images: leaked.length, files: leaked.map((e) => e.url.split("/").pop()) },
    startedAfterClickButNotInGate: { bytes: sum(missed), images: missed.length },
    home: { bytesAtClear: homeBytesAtClear, imagesAtClear: homeImagesAtClear, clearToClickMs: clickAt - clearedAt },
    duplicates: urls.filter((u, i) => urls.indexOf(u) !== i).length,
    lazy,
  };
}

const all = [];
for (const hub of HUBS) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    const r = await measureOnce(hub);
    runs.push(r);
    console.log(
      `# ${hub} #${i + 1}: gate ${r.gate.bytes} B/${r.gate.images} img${r.gate.overBudget ? " (EXCEDE)" : ""} · por inicio de petición desde la llamada ${r.byRequestStart.bytes} B/${r.byRequestStart.images} img · por INICIO desde el clic real ${r.byRealClickEvent.bytes} B/${r.byRealClickEvent.images} img${r.byRealClickEvent.overBudget ? " (EXCEDE)" : ""} · empezadas entre la llamada y el clic ${r.startedBetweenCallAndClickEvent.images} img/${r.startedBetweenCallAndClickEvent.bytes} B (${r.startedBetweenCallAndClickEvent.msBeforeClick.join("/")} ms antes) · filtradas de antes de la llamada ${r.leakedFromBeforeClick.bytes} B/${r.leakedFromBeforeClick.images} · lejanas cargadas ${r.lazy.far.length} (más lejana ${r.lazy.farthestLoaded}px = ${(r.lazy.farthestLoaded / r.lazy.vh).toFixed(2)} pantallas) · sin loading=lazy: ${r.lazy.eager.length}`
    );
  }
  all.push({ hub, runs });
}

await browser.close();
await server.close();
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  const suffix = `${CPU_THROTTLE > 1 ? `-cpu${CPU_THROTTLE}` : ""}${IMAGE_DELAY_MS > 0 ? `-delay${IMAGE_DELAY_MS}` : ""}`;
  writeFileSync(`${OUT}/performance-attribution-${viewportKey}-${BROWSER}${suffix}.json`, JSON.stringify({ browser: BROWSER, viewport: VIEWPORTS[viewportKey].label, runs: RUNS, cpuThrottle: CPU_THROTTLE, imageDelayMs: IMAGE_DELAY_MS, budget: BUDGET, results: all }, null, 2));
}
