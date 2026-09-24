import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Bloque 22 — B6.2: muestreo en navegador de las fotografías identity nuevas de grado A,
 * contra el build de producción (`vite preview`).
 *
 * B6.2 no toca UI: las fotografías tienen que aparecer solas por el contrato existente. Este gate
 * lo demuestra en lugares nuevos de los cuatro hubs, en teléfono y escritorio:
 *
 *   - la tarjeta carga la rendición `-800w` local y la capa de carga desaparece tras `load`;
 *   - la ficha con UNA imagen no muestra contador, puntos ni flechas (`06 §5.3`);
 *   - `CreditsSheet` nombra el autor y la licencia exactos del registro;
 *   - ninguna petición de imagen sale del origen de la app;
 *   - si la imagen falla, tarjeta y ficha caen al marcador «No se pudo cargar la imagen»;
 *   - ninguna imagen queda rota (`naturalWidth > 0`).
 *
 * Usage: node scripts/block22-b6-2-photography-browser-audit.mjs [--browser=/path/to/chromium]
 */

const SAMPLES = [
  { id: "JP-024", hub: "Tokio" },
  { id: "JP-083", hub: "Kioto" },
  { id: "JP-147", hub: "Osaka" },
  { id: "JP-211", hub: "Osaka" },
  { id: "JP-175", hub: "Okinawa" },
  { id: "JP-201", hub: "Okinawa" },
];
const FALLBACK_SAMPLE = { id: "JP-088", hub: "Kioto" };
const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

const args = process.argv.slice(2);
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const places = JSON.parse(readFileSync(`${repoRoot}data/places.json`, "utf8"));
const metadata = JSON.parse(readFileSync(`${repoRoot}data/visual/photography-metadata.json`, "utf8"));
const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
const recordsById = {};
for (const record of metadata.images) (recordsById[record.placeId] ??= []).push(record);
const PORT = 4322;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

async function openHub(page, url, hub) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
}

async function searchPlace(page, hub, name) {
  await page.getByRole("button", { name: new RegExp(`^Buscar en ${hub}`) }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill(name);
  await page.waitForTimeout(800);
  return page.locator(".search-sheet .place-card", { hasText: name }).first();
}

async function auditSample(browser, url, viewportName, sample) {
  const { width, height, dpr } = VIEWPORTS[viewportName];
  const place = placeById[sample.id];
  const [record] = recordsById[sample.id];
  console.log(`\n── ${viewportName} · ${sample.id} ${place.name} (${sample.hub})`);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width < 860 });
  const page = await context.newPage();
  const external = [];
  const failures = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image" && !r.url().startsWith(url) && !r.url().startsWith("data:")) {
      if (!/tile\.openstreetmap|basemaps|cartocdn/.test(r.url())) external.push(r.url());
    }
  });
  page.on("response", (r) => {
    if (/\.webp(\?|$)/.test(r.url()) && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, sample.hub);

  const card = await searchPlace(page, sample.hub, place.name);
  const cardImage = card.locator(".place-card__image");
  await cardImage.evaluate((img) => (img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true }))));
  await page.waitForTimeout(300);
  const cardState = await cardImage.evaluate((img) => ({
    src: img.currentSrc,
    natural: img.naturalWidth,
    state: img.dataset.state,
    alt: img.alt,
  }));
  const expected800 = record.assetPath.replace(/\.webp$/, "-800w.webp");
  check("card shows the new identity photograph (-800w)", cardState.src.endsWith(expected800), cardState.src);
  check("card image decoded (not broken)", cardState.natural > 0, `${cardState.natural}`);
  // La tarjeta es decorativa por contrato (el nombre ya está en el encabezado): `alt=""`.
  check("card image stays decorative (alt=\"\")", cardState.alt === "", cardState.alt);
  check(
    "loading layer is gone after load",
    cardState.state === "loaded" && (await card.locator(".place-card__skeleton").count()) === 0,
    cardState.state
  );

  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(900);
  const hero = page.locator(".place-detail .gallery__image").first();
  const heroState = await hero.evaluate((img) => ({ src: img.currentSrc, natural: img.naturalWidth }));
  check("detail hero is this place's photograph", heroState.src.includes(`/images/places/${sample.id}/`), heroState.src);
  check("detail hero decoded", heroState.natural > 0);
  check("detail hero carries the registry alt", (await hero.getAttribute("alt")) === record.alt);
  check("exactly one slide", (await page.locator(".place-detail .gallery__slide").count()) === 1);
  check("no counter with one image", (await page.locator(".place-detail .gallery__counter").count()) === 0);
  check("no dots with one image", (await page.locator(".place-detail .gallery__dot").count()) === 0);
  check("no arrows with one image", (await page.locator(".place-detail .gallery__nav").count()) === 0);

  await page.locator(".place-detail .gallery__credits").click();
  await page.waitForSelector(".credits-sheet__list", { timeout: 10000 });
  const credits = await page.locator(".credits-sheet__list").innerText();
  check("CreditsSheet names the author", record.license === "CC0" || credits.includes(record.credit), record.credit);
  check("CreditsSheet names the licence", credits.includes(record.license), record.license);
  check("CreditsSheet names Commons", /Commons/i.test(credits));
  const licenceHrefs = await page.locator(".credits-sheet__field a").evaluateAll((as) => as.map((a) => a.href));
  check("CreditsSheet links the licence URL", licenceHrefs.some((h) => h.startsWith(record.licenseUrl.replace(/\/$/, ""))), licenceHrefs.join(" "));
  await page.keyboard.press("Escape");

  check("no image request left the app origin", external.length === 0, external.slice(0, 3).join(" "));
  check("no image request failed", failures.length === 0, failures.slice(0, 3).join(" "));
  await context.close();
}

async function auditFallback(browser, url, viewportName) {
  const { width, height, dpr } = VIEWPORTS[viewportName];
  const place = placeById[FALLBACK_SAMPLE.id];
  const [record] = recordsById[FALLBACK_SAMPLE.id];
  console.log(`\n── ${viewportName} · fallback on ${FALLBACK_SAMPLE.id} ${place.name}`);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width < 860 });
  const page = await context.newPage();
  const stem = record.assetPath.replace(/\.webp$/, "");
  await page.route(`**/${stem}*`, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, FALLBACK_SAMPLE.hub);
  // Tarjeta normal de la lista: se recorre la carga progresiva hasta encontrarla.
  const listCard = page.locator(".place-list .place-card:not(.place-card--compact)", { hasText: place.name }).first();
  for (let i = 0; i < 60 && (await listCard.count()) === 0; i += 1) {
    await page.locator(".app__sidebar").evaluate((el) => el.scrollBy(0, 900));
    await page.waitForTimeout(120);
  }
  await listCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  check("failed list-card image falls back to the placeholder", (await listCard.locator(".photo-placeholder").count()) === 1);
  check("placeholder says the image could not load", /No se pudo cargar la imagen/.test(await listCard.innerText()));
  check("no broken <img> left in the list card", (await listCard.locator(".place-card__image").count()) === 0);
  // Tarjeta compacta de SearchSheet: su fallback es el icono de categoría.
  const card = await searchPlace(page, FALLBACK_SAMPLE.hub, place.name);
  await page.waitForTimeout(800);
  check("failed compact card falls back to its category icon", (await card.locator(".place-card__placeholder-compact").count()) === 1);
  check("no broken <img> left in the compact card", (await card.locator(".place-card__image").count()) === 0);
  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(900);
  check("failed detail image shows the error state", (await page.locator(".place-detail .gallery__error").count()) === 1);
  await context.close();
}

console.log("B6.2 grade-A photography browser audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const viewportName of Object.keys(VIEWPORTS)) {
    for (const sample of SAMPLES) await auditSample(browser, url, viewportName, sample);
    await auditFallback(browser, url, viewportName);
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nB6.2 photography audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
