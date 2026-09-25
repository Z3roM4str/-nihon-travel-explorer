import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/** B6.6 audit for one-photo C/D identity cards and the existing detail/gallery contract. */
const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const PORT = 4326;
const MAX_HUB_BYTES = 3_500_000;
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const places = JSON.parse(readFileSync(path.join(repoRoot, "data/places.json"), "utf8"));
const baseline = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/block22-b6-6-baseline.json"), "utf8"));
const plan = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/block22-b6-6-acquisition-plan.json"), "utf8"));
const metadata = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/photography-metadata.json"), "utf8"));
const placeById = Object.fromEntries(places.map((place) => [place.id, place]));
const recordsById = {};
for (const record of metadata.images) (recordsById[record.placeId] ??= []).push(record);
const acquired = plan.entries;
const targets = baseline.gradeRows.filter((row) => row.needsIdentity).map((row) => row.placeId);
const hubs = Object.keys(baseline.hubIdentity800Bytes).sort();

assert.ok(acquired.length > 0, "B6.6 browser audit requires at least one acquired identity");
assert.ok(acquired.every((entry) => entry.role === "identity"));
for (const entry of acquired) {
  assert.ok(targets.includes(entry.placeId), `${entry.placeId} is not a derived B6.6 target`);
  assert.ok(placeById[entry.placeId], `missing place ${entry.placeId}`);
  assert.equal(recordsById[entry.placeId]?.length, 1, `${entry.placeId} must have exactly one identity image`);
  assert.equal(recordsById[entry.placeId][0].role, "identity");
}

let passed = 0;
let failed = 0;
const budgetRows = [];
const detailRows = [];
function check(label, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function identityFor(placeId) {
  return recordsById[placeId]?.find((record) => record.role === "identity");
}

function derivative(record, width = 800) {
  return `/${record.assetPath.replace(/\.webp$/, `-${width}w.webp`)}`;
}

function viewportOptions(name) {
  const { width, height, dpr } = VIEWPORTS[name];
  return { viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: name === "phone" };
}

function instrument(page, origin) {
  const requests = [];
  const pending = [];
  const inFlightPhotos = new Set();
  const externalPhotos = [];
  const failedImages = [];
  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith("data:")) return;
    if (/tile\.openstreetmap|basemaps|cartocdn/i.test(url)) return;
    if (/\.(?:webp|jpe?g|png)(?:\?|$)|\/images\/places\//i.test(url)) externalPhotos.push(url);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (request.resourceType() === "image" && url.startsWith(origin) && /\/images\/places\/.*\.webp(?:\?|$)/i.test(url)) {
      inFlightPhotos.add(request);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.includes("/images/places/") || !url.pathname.endsWith(".webp")) return;
    inFlightPhotos.delete(response.request());
    const task = (async () => {
      let bytes = 0;
      try {
        bytes = (await response.body()).byteLength;
      } catch {
        try {
          bytes = statSync(path.join(appRoot, "public", decodeURIComponent(url.pathname).replace(/^\//, ""))).size;
        } catch {
          bytes = 0;
        }
      }
      const item = { pathname: decodeURIComponent(url.pathname), bytes, status: response.status() };
      requests.push(item);
      if (item.status >= 400) failedImages.push(`${item.status} ${item.pathname}`);
    })();
    pending.push(task);
  });
  page.on("requestfailed", (request) => inFlightPhotos.delete(request));
  return {
    requests,
    externalPhotos,
    failedImages,
    async settle() {
      const deadline = Date.now() + 10000;
      while (inFlightPhotos.size > 0 && Date.now() < deadline) await page.waitForTimeout(50);
      await Promise.allSettled(pending.slice());
    },
    reset() {
      requests.length = 0;
      externalPhotos.length = 0;
      failedImages.length = 0;
      pending.length = 0;
    },
  };
}

async function openHub(page, url, hub, network) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const hubButton = page.getByRole("button", { name: new RegExp(`^${hub}`) }).first();
  await hubButton.waitFor({ state: "visible", timeoutMs: 15000 });
  await page.waitForTimeout(350);
  await network.settle();
  network.reset();
  await hubButton.click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(350);
}

async function searchCard(page, hub, placeName) {
  await page.getByRole("button", { name: new RegExp(`^Buscar en ${hub}`) }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill(placeName);
  await page.waitForTimeout(500);
  return page.locator(".search-sheet .place-card").filter({ hasText: placeName }).first();
}

function totalIdentityBytes(hub) {
  return places.filter((place) => place.hub === hub).reduce((sum, place) => {
    const identity = identityFor(place.id);
    if (!identity) return sum;
    return sum + statSync(path.join(appRoot, "public", derivative(identity).replace(/^\//, ""))).size;
  }, 0);
}

async function auditHubBudget(browser, url, viewportName, hub) {
  const context = await browser.newContext(viewportOptions(viewportName));
  const page = await context.newPage();
  const network = instrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const sidebar = page.locator(".app__sidebar");
  for (let index = 0; index < 65; index += 1) {
    await sidebar.evaluate((element) => element.scrollBy(0, 900));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(450);
  await network.settle();
  const requested = new Set(network.requests.map((item) => item.pathname));
  const unexpected = [...requested].filter((pathname) => !places
    .filter((place) => place.hub === hub)
    .map((place) => identityFor(place.id))
    .filter(Boolean)
    .some((record) => pathname === derivative(record)));
  const listBytes = [...new Map(network.requests.map((item) => [item.pathname, item.bytes])).values()].reduce((sum, bytes) => sum + bytes, 0);
  const budget = totalIdentityBytes(hub);
  const row = { viewport: viewportName, hub, observedBytes: listBytes, identityBytes: budget, requests: requested.size };
  budgetRows.push(row);
  check(`${hub} lista solicita sólo identity -800w`, unexpected.length === 0 && network.requests.every((item) => item.pathname.endsWith("-800w.webp")), unexpected.slice(0, 3).join(", "));
  check(`${hub} lista no hace fetch fotográfico externo`, network.externalPhotos.length === 0, network.externalPhotos.slice(0, 2).join(" "));
  check(`${hub} lista no tiene imágenes rotas`, network.failedImages.length === 0, network.failedImages.slice(0, 2).join(" "));
  check(`${hub} identity ≤ ${MAX_HUB_BYTES.toLocaleString()} B`, budget <= MAX_HUB_BYTES, `${budget.toLocaleString()} B`);
  check(`${hub} bytes observados ≤ suma identity`, listBytes <= budget, `${listBytes.toLocaleString()} / ${budget.toLocaleString()} B`);
  await context.close();
}

async function auditPlace(browser, url, viewportName, entry) {
  const id = entry.placeId;
  const place = placeById[id];
  const record = identityFor(id);
  const context = await browser.newContext(viewportOptions(viewportName));
  const page = await context.newPage();
  const network = instrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, place.hub, network);
  await network.settle();
  network.reset();
  const card = await searchCard(page, place.hub, place.name);
  const cardImage = card.locator(".place-card__image");
  await cardImage.waitFor({ state: "visible", timeoutMs: 10000 });
  await cardImage.evaluate((image) => image.decode());
  const cardState = await cardImage.evaluate((image) => ({ src: image.currentSrc, naturalWidth: image.naturalWidth, alt: image.alt }));
  check(`${id} PlaceCard muestra identity y elimina placeholder`, cardState.src.includes(record.assetPath.replace(/\.webp$/, "-800w.webp")) && cardState.naturalWidth > 0 && await card.locator(".place-card__placeholder-compact").count() === 0, cardState.src);
  check(`${id} PlaceCard no carga una complementaria ni contador`, await card.locator(".place-card__photo-count").count() === 0 && (recordsById[id] ?? []).length === 1);
  check(`${id} identity de PlaceCard es decorativa`, cardState.alt === "", cardState.alt);
  await network.settle();
  check(`${id} lista no solicita original/400w/complementarias`, network.requests.every((item) => item.pathname.endsWith("-800w.webp")), network.requests.map((item) => item.pathname).join(", "));
  check(`${id} lista no hace fetch fotográfico externo`, network.externalPhotos.length === 0);
  check(`${id} lista sin imágenes rotas`, network.failedImages.length === 0);

  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__track", { timeout: 15000 });
  const galleryImages = page.locator(".place-detail .gallery__image");
  const track = page.locator(".place-detail .gallery__track");
  assert.equal(await galleryImages.count(), 1, `${id}: expected a one-photo gallery`);
  const galleryImage = galleryImages.first();
  await galleryImage.evaluate((image) => image.decode());
  const imageState = await galleryImage.evaluate((image) => ({ src: image.getAttribute("src"), currentSrc: image.currentSrc, naturalWidth: image.naturalWidth, alt: image.alt }));
  check(`${id} PlaceDetail abre primero la identity`, imageState.src === `/${record.assetPath}` && imageState.naturalWidth > 0, imageState.currentSrc);
  check(`${id} una foto no muestra contador, puntos ni flechas`, await page.locator(".gallery__counter").count() === 0 && await page.locator(".gallery__dot").count() === 0 && await page.locator(".gallery__nav").count() === 0);
  const snap = await track.evaluate((element) => ({ type: getComputedStyle(element).scrollSnapType, child: getComputedStyle(element.querySelector(".gallery__slide")).scrollSnapAlign }));
  check(`${id} mantiene el scroll-snap existente`, /x\s+mandatory/.test(snap.type) && snap.child !== "none", `${snap.type}/${snap.child}`);

  const creditsButton = page.locator(".gallery__credits");
  assert.equal(await creditsButton.count(), 1, `${id}: expected attribution control`);
  await creditsButton.click();
  await page.waitForSelector(".credits-sheet__list .credits-sheet__item", { timeout: 10000 });
  const credit = page.locator(".credits-sheet__list .credits-sheet__item").first();
  const creditText = await credit.innerText();
  check(`${id} CreditsSheet atribuye título, licencia, autor y fuente`, creditText.includes(record.originalTitle) && creditText.includes(record.license) && (!record.credit || creditText.includes(record.credit)) && creditText.includes(record.source), creditText.replace(/\s+/g, " ").slice(0, 260));
  await page.keyboard.press("Escape");
  check(`${id} cerrar CreditsSheet restaura foco`, await creditsButton.evaluate((element) => document.activeElement === element));

  const responsive = await page.evaluate(() => {
    const box = document.querySelector(".place-detail .gallery__track")?.getBoundingClientRect();
    return { width: box?.width ?? 0, height: box?.height ?? 0, documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
  });
  const ratio = viewportName === "phone" ? 4 / 5 : 4 / 3;
  check(`${id} ficha conserva proporción responsive`, Math.abs(responsive.width / responsive.height - ratio) < 0.04, `${(responsive.width / responsive.height).toFixed(3)} / ${ratio.toFixed(3)}`);
  check(`${id} ficha no desborda la pantalla`, responsive.documentWidth <= responsive.viewportWidth + 1, `${responsive.documentWidth}/${responsive.viewportWidth}`);
  await network.settle();
  check(`${id} ficha no hace fetch fotográfico externo`, network.externalPhotos.length === 0);
  check(`${id} ficha no tiene imágenes fotográficas fallidas`, network.failedImages.length === 0);
  detailRows.push({ viewport: viewportName, id, hub: place.hub, imageBytes: statSync(path.join(appRoot, "public", derivative(record).replace(/^\//, ""))).size });
  await context.close();
}

async function auditFallback(browser, url, viewportName, entry) {
  const place = placeById[entry.placeId];
  const record = identityFor(entry.placeId);
  const context = await browser.newContext(viewportOptions(viewportName));
  const page = await context.newPage();
  const network = instrument(page, url);
  const assetStem = record.assetPath.replace(/\.webp$/, "");
  await page.route(`**/${assetStem}*`, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, place.hub, network);
  const card = await searchCard(page, place.hub, place.name);
  check(`${entry.placeId} tarjeta vuelve al placeholder si falla identity`, await card.locator(".place-card__placeholder-compact").count() === 1 && await card.locator(".place-card__image").count() === 0);
  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__error", { timeout: 10000 });
  check(`${entry.placeId} ficha muestra el fallback existente`, /No se pudo cargar la imagen/.test(await page.locator(".gallery__error").first().innerText()));
  check(`${entry.placeId} fallback no produce fetch fotográfico externo`, network.externalPhotos.length === 0);
  await context.close();
}

console.log(`B6.6 browser audit · targets=${targets.length} · acquired=${acquired.length} · unresolved=${plan.unresolved.length}`);
console.log(`Muestras identity: ${acquired.map((entry) => `${entry.placeId}/${placeById[entry.placeId].hub}`).join(", ")}`);
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  for (const viewportName of Object.keys(VIEWPORTS)) {
    for (const hub of hubs) await auditHubBudget(browser, url, viewportName, hub);
    for (const entry of acquired) await auditPlace(browser, url, viewportName, entry);
    await auditFallback(browser, url, viewportName, acquired[0]);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("\nPresupuesto por hub:");
for (const row of budgetRows) console.log(`  ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} lista=${row.observedBytes.toLocaleString()} B · identidad=${row.identityBytes.toLocaleString()} B · ${row.requests} URLs`);
console.log("Coste de identity de fichas (la galería de una foto carga una imagen):");
for (const row of detailRows) console.log(`  ${row.id} ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} ${row.imageBytes.toLocaleString()} B`);
console.log(`\n${"═".repeat(64)}\nB6.6 browser audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
