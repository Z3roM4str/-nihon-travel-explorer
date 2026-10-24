import { chromium } from "playwright";

/**
 * Auditoría final — control del margen de `loading="lazy"` del navegador, SIN la aplicación.
 *
 * Una página sintética con 40 imágenes `loading="lazy"` de 390×800 apiladas se abre en un viewport de 390×844 y
 * se mide cuál es la imagen más lejana que el navegador descarga por su cuenta al cargar. Se repite sin limitar
 * la red y con 2G/3G emuladas (CDP, sólo Chromium). Sirve para distinguir el comportamiento permitido del
 * navegador (su margen crece con una conexión efectiva lenta) de una carga anticipada del producto.
 *
 * Uso: `node scripts/final-audit-lazy-margin-control.mjs` (`NIHON_CHROMIUM_PATH` opcional). No es un gate.
 * Resultado en Chromium 141 / Linux: 1,90 pantallas sin limitación; 3,79 con 3G y con 2G emuladas.
 */

const VIEWPORT_HEIGHT = 844;
const IMAGE_HEIGHT = 800;
const browser = await chromium.launch(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {});
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function trial(label, throttle) {
  const context = await browser.newContext({ viewport: { width: 390, height: VIEWPORT_HEIGHT } });
  const page = await context.newPage();
  const html = `<!doctype html><body style="margin:0">${Array.from({ length: 40 }, (_, i) => `<img loading="lazy" src="/img/${i}.png" width="390" height="${IMAGE_HEIGHT}" style="display:block">`).join("")}</body>`;
  const loaded = new Set();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.endsWith("/")) return route.fulfill({ contentType: "text/html", body: html });
    if (u.includes("/img/")) {
      loaded.add(Number(u.match(/img\/(\d+)/)[1]));
      return route.fulfill({ contentType: "image/png", body: PNG });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", throttle);
  }
  await page.goto("http://control.test/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const farthestTop = Math.max(...loaded) * IMAGE_HEIGHT;
  console.log(`${label}: ${loaded.size} imágenes cargadas; la más lejana empieza en ${farthestTop}px = ${(farthestTop / VIEWPORT_HEIGHT).toFixed(2)} pantallas`);
  await context.close();
}

await trial("sin limitación de red", null);
await trial("3G emulada (400 ms, 400 kbps)", { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000, connectionType: "cellular3g" });
await trial("2G emulada (800 ms, 50 kbps)", { offline: false, latency: 800, downloadThroughput: 6_000, uploadThroughput: 6_000, connectionType: "cellular2g" });
await browser.close();
