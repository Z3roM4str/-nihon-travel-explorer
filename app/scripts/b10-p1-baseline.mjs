import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Baseline reproducible de B10-P1 (rendimiento de arranque).
 *
 * Mide sobre una build de producción (`--app <dir>`, por defecto este `app/`):
 *   · bytes raw/gzip/brotli del chunk de entrada y del CSS; módulos de datos dentro del entry;
 *   · FCP y `domContentLoaded` (mediana de N cargas en frío, perfil «4G rápida» + CPU ×4 y perfil sin estrangular);
 *   · waterfall: cuándo se pide cada JS/CSS y las primeras imágenes, y cuántas peticiones JS/CSS hay antes de la primera pintura.
 *
 * Uso: `node scripts/b10-p1-baseline.mjs [--app ../otra/app] [--runs 7] [--json]`
 * Sirve para comparar dos builds (antes/después) en la misma máquina; los números absolutos dependen del entorno.
 */
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const APP = path.resolve(opt("--app", fileURLToPath(new URL("..", import.meta.url))));
const RUNS = Number(opt("--runs", 7));
const dist = path.join(APP, "dist/assets");
const assets = readdirSync(dist);
const entryJs = assets.find((f) => /^index-.*\.js$/.test(f));
const entryCss = assets.find((f) => /^index-.*\.css$/.test(f));
const gz = (f) => gzipSync(readFileSync(path.join(dist, f)), { level: 9 }).length;
const entryCode = readFileSync(path.join(dist, entryJs), "utf8");

const result = {
  app: APP,
  entry: { file: entryJs, raw: Buffer.byteLength(entryCode), gzip: gz(entryJs), css: entryCss, cssGzip: gz(entryCss) },
  inlineLqipInEntry: (entryCode.match(/data:image\/webp;base64,/g) ?? []).length,
  acquisitionUrlsInEntry: (entryCode.match(/upload\.wikimedia\.org\/wikipedia\/commons/g) ?? []).length,
  profiles: {},
};

const server = await preview({ root: APP, preview: { port: 4190, strictPort: true, host: "127.0.0.1" } });
const browser = await chromium.launch({ headless: true, ...(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}) });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function once(throttled) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (throttled) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const reqs = [];
  const t0 = { v: 0 };
  page.on("request", (r) => reqs.push({ url: r.url(), type: r.resourceType(), t: Date.now() }));
  await page.addInitScript(() => {
    window.__fcp = null;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__fcp = e.startTime; }).observe({ type: "paint", buffered: true });
  });
  t0.v = Date.now();
  await page.goto("http://127.0.0.1:4190/", { waitUntil: "load" });
  await page.waitForFunction(() => window.__fcp !== null, null, { timeout: 15000 });
  await page.waitForTimeout(1500); // deja pasar la carga en reposo de los chunks diferidos
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource").map((r) => ({ name: r.name.split("/").slice(3).join("/"), start: Math.round(r.startTime), end: Math.round(r.responseEnd), size: r.encodedBodySize }));
    return { fcp: window.__fcp, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, res };
  });
  await ctx.close();
  const js = nav.res.filter((r) => /\.(js|css)$/.test(r.name));
  const img = nav.res.filter((r) => /\.webp$/.test(r.name));
  return {
    fcp: nav.fcp,
    dcl: nav.dcl,
    jsCssBeforeFcp: js.filter((r) => r.start < nav.fcp).length,
    jsCss: js,
    imagesBeforeFcp: img.filter((r) => r.start < nav.fcp).length,
    firstImageStart: img.length ? Math.min(...img.map((r) => r.start)) : null,
    totalRequests: nav.res.length,
  };
}

for (const [name, throttled] of [["sin estrangular", false], ["4G rápida + CPU×4", true]]) {
  const runs = [];
  await once(throttled); // calentamiento (caché de disco del servidor)
  for (let i = 0; i < RUNS; i++) runs.push(await once(throttled));
  result.profiles[name] = {
    runs: RUNS,
    fcpMedian: Math.round(median(runs.map((r) => r.fcp))),
    fcpAll: runs.map((r) => Math.round(r.fcp)),
    dclMedian: Math.round(median(runs.map((r) => r.dcl))),
    jsCssBeforeFcp: median(runs.map((r) => r.jsCssBeforeFcp)),
    imagesBeforeFcpMedian: median(runs.map((r) => r.imagesBeforeFcp)),
    firstImageStartMedian: Math.round(median(runs.map((r) => r.firstImageStart ?? 0))),
    totalRequestsMedian: median(runs.map((r) => r.totalRequests)),
    waterfall: runs[Math.floor(runs.length / 2)].jsCss.map((r) => `${r.name} ${r.start}→${r.end} ms (${r.size} B)`),
  };
}
await browser.close();
await server.close();
console.log(JSON.stringify(result, null, args.includes("--json") ? 0 : 2));
