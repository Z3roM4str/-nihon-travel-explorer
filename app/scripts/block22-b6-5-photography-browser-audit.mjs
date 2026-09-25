import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/** B6.5 audit of third-photo galleries, cards, attribution, fallbacks and list budgets. */
const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const PORT = 4325;
const MAX_HUB_BYTES = 3_500_000;
const EXPERIENCE_EXCEPTIONS = new Set([
  "JP-021", "JP-033", "JP-044", "JP-077", "JP-089", "JP-097", "JP-126", "JP-134",
  "JP-152", "JP-179", "JP-188", "JP-192", "JP-197", "JP-203", "JP-204",
]);
const HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa", "Sapporo", "Nagoya", "Fukuoka"];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const places = JSON.parse(readFileSync(path.join(repoRoot, "data/places.json"), "utf8"));
const baseline = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/block22-b6-5-baseline.json"), "utf8"));
const plan = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/block22-b6-5-acquisition-plan.json"), "utf8"));
const metadata = JSON.parse(readFileSync(path.join(repoRoot, "data/visual/photography-metadata.json"), "utf8"));
const placeById = Object.fromEntries(places.map((place) => [place.id, place]));
const recordsById = {};
for (const record of metadata.images) (recordsById[record.placeId] ??= []).push(record);
const entries = plan.batches.flatMap((batch) => batch.entries);
const acquiredByRole = Object.fromEntries(["detail", "context", "seasonal"].map((role) => [role, entries.find((entry) => entry.role === role)]));
const acquiredException = entries.find((entry) => EXPERIENCE_EXCEPTIONS.has(entry.placeId));
assert.ok(acquiredByRole.detail, "B6.5 needs a detail acquisition for the audit");
assert.ok(acquiredByRole.context, "B6.5 needs a context acquisition for the audit");
assert.ok(acquiredByRole.seasonal, "B6.5 needs a seasonal acquisition for the audit");
assert.ok(acquiredException, "B6.5 audit must sample a preserved B6.4 experience exception with a new complement");

const acquiredSamples = [
  acquiredByRole.seasonal,
  acquiredByRole.context,
  acquiredByRole.detail,
  entries.find((entry) => entry.placeId === "JP-142"),
  acquiredException,
].filter(Boolean);
const samples = [...new Map(acquiredSamples.map((entry) => [entry.placeId, entry])).values()].map((entry) => {
  const place = placeById[entry.placeId];
  const records = recordsById[entry.placeId] ?? [];
  assert.ok(place, `missing sample place ${entry.placeId}`);
  assert.ok(records.some((record) => record.role === "identity"), `${entry.placeId} has no identity`);
  assert.equal(records.at(-1).role, entry.role, `${entry.placeId} new complementary role is not last in gallery`);
  return { id: entry.placeId, entry, place, hub: place.hub, records };
});
const threeImageSample = samples.find((sample) => sample.records.length === 3);
assert.ok(threeImageSample, "B6.5 must audit a gallery of exactly three photographs");
assert.ok(samples.some(({ entry }) => entry.role === "seasonal"));
assert.ok(samples.some(({ entry }) => entry.role === "detail"));
assert.ok(samples.some(({ entry }) => entry.role === "context"));
assert.ok(samples.some(({ id }) => EXPERIENCE_EXCEPTIONS.has(id)));

let passed = 0;
let failed = 0;
const budgetRows = [];
const detailRows = [];
function check(label, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function roleRecords(id) {
  return recordsById[id] ?? [];
}

function expectedDerivative(record, width = 800) {
  return `/${record.assetPath.replace(/\.webp$/, `-${width}w.webp`)}`;
}

function viewportContextOptions(viewportName) {
  const { width, height, dpr } = VIEWPORTS[viewportName];
  return { viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: viewportName === "phone" };
}

function makeInstrument(page, origin) {
  const requests = [];
  const pending = [];
  const externalPhotos = [];
  const failedImages = [];
  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith("data:")) return;
    if (/tile\.openstreetmap|basemaps|cartocdn/i.test(url)) return;
    if (/\.(?:webp|jpe?g|png)(?:\?|$)|\/images\/places\//i.test(url)) externalPhotos.push(url);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.includes("/images/places/") || !url.pathname.endsWith(".webp")) return;
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
  return {
    requests,
    externalPhotos,
    failedImages,
    async settle() {
      await page.waitForTimeout(200);
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

function uniqueTransferredBytes(requests) {
  return [...new Map(requests.map((request) => [request.pathname, request.bytes])).values()].reduce((sum, bytes) => sum + bytes, 0);
}

const fullIdentityBudgetByHub = new Map();
for (const place of places) {
  const identity = roleRecords(place.id).find((record) => record.role === "identity");
  if (!identity) continue;
  const bytes = statSync(path.join(appRoot, "public", expectedDerivative(identity).replace(/^\//, ""))).size;
  fullIdentityBudgetByHub.set(place.hub, (fullIdentityBudgetByHub.get(place.hub) ?? 0) + bytes);
}
const hubSamples = Object.fromEntries(HUBS.map((hub) => {
  const chosenGallery = samples.find((sample) => sample.hub === hub && sample.records.length === 3);
  const place = chosenGallery?.place ?? places.find((candidate) => candidate.hub === hub && roleRecords(candidate.id).some((row) => row.role === "identity"));
  assert.ok(place, `no identity photo available in hub ${hub}`);
  return [hub, { id: place.id, hub, place }];
}));

async function openHub(page, url, hub, network) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const hubButton = page.getByRole("button", { name: new RegExp(`^${hub}`) }).first();
  await hubButton.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(350);
  await network.settle();
  network.reset();
  await hubButton.click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function findSearchCard(page, hub, placeName) {
  await page.getByRole("button", { name: new RegExp(`^Buscar en ${hub}`) }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill(placeName);
  await page.waitForTimeout(650);
  return page.locator(".search-sheet .place-card").filter({ hasText: placeName }).first();
}

async function auditHubList(browser, url, viewportName, sample, countSample = false) {
  const { hub, place, id } = sample;
  console.log(`\n── lista · ${viewportName} · ${hub} · ${id} ${place.name}`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const scroller = page.locator(".app__sidebar");
  for (let step = 0; step < 65; step += 1) {
    await scroller.evaluate((element) => element.scrollBy(0, 900));
    await page.waitForTimeout(75);
  }
  const card = page.locator(".place-list .place-card:not(.place-card--compact)").filter({ hasText: place.name }).first();
  await card.waitFor({ state: "attached", timeout: 10000 });
  await card.scrollIntoViewIfNeeded();
  const cardImage = card.locator(".place-card__image");
  await cardImage.waitFor({ state: "visible", timeout: 10000 });
  await cardImage.evaluate((img) => img.decode());
  const identity = roleRecords(id).find((record) => record.role === "identity");
  const cardState = await cardImage.evaluate((img) => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, alt: img.alt }));
  check(`${hub} PlaceCard usa identity`, cardState.src.includes(identity.assetPath.replace(/\.webp$/, "-800w.webp")), cardState.src);
  check(`${hub} PlaceCard mantiene imagen decorativa cargada`, cardState.naturalWidth > 0 && cardState.alt === "", `${cardState.naturalWidth}px`);
  const complementCount = roleRecords(id).length;
  if (countSample && complementCount === 3) {
    check(`${id} indicador de tarjeta dice 3 fotos`, (await card.locator(".place-card__photo-count").innerText()).trim() === "3 fotos");
  }

  await page.waitForTimeout(650);
  await network.settle();
  const requested = new Set(network.requests.map((item) => item.pathname));
  const complementaryPaths = new Set(entries.flatMap((entry) => [entry.title]).map((title) => metadata.images.find((row) => row.originalTitle === title)).filter(Boolean).flatMap((record) => [
    `/${record.assetPath}`, expectedDerivative(record, 800), expectedDerivative(record, 400),
  ]));
  const eagerComplementary = [...complementaryPaths].filter((assetPath) => requested.has(assetPath));
  check(`${hub} lista no descarga fotos complementarias`, eagerComplementary.length === 0, eagerComplementary.slice(0, 3).join(", "));
  const non800 = network.requests.filter((item) => !item.pathname.endsWith("-800w.webp"));
  check(`${hub} lista usa únicamente rendiciones 800w`, non800.length === 0, non800.slice(0, 3).map((item) => item.pathname).join(", "));
  check(`${hub} lista sin fetch fotográfico externo`, network.externalPhotos.length === 0, network.externalPhotos.slice(0, 2).join(" "));
  check(`${hub} lista sin fotos rotas`, network.failedImages.length === 0, network.failedImages.slice(0, 2).join(" "));
  const expectedHubPaths = new Set(places.filter((candidate) => candidate.hub === hub).map((candidate) => roleRecords(candidate.id).find((record) => record.role === "identity")).filter(Boolean).map((record) => expectedDerivative(record)));
  const unexpected = [...requested].filter((assetPath) => !expectedHubPaths.has(assetPath));
  check(`${hub} lista carga solamente identity del hub activo`, unexpected.length === 0, unexpected.slice(0, 3).join(", "));

  const observed = uniqueTransferredBytes(network.requests);
  const fullBudget = fullIdentityBudgetByHub.get(hub) ?? 0;
  const row = { viewport: viewportName, hub, observedBytes: observed, identityBytes: fullBudget, imagePaths: requested.size };
  budgetRows.push(row);
  check(`${hub} presupuesto completo identity -800w ≤ ${MAX_HUB_BYTES.toLocaleString()} B`, fullBudget <= MAX_HUB_BYTES, `${fullBudget.toLocaleString()} B`);
  check(`${hub} transferencia observada no supera el presupuesto identity`, observed <= fullBudget, `${observed.toLocaleString()} / ${fullBudget.toLocaleString()} B`);
  await context.close();
}

async function auditDetail(browser, url, viewportName, sample) {
  const { id, hub, place, records, entry } = sample;
  const ordered = records;
  const count = ordered.length;
  assert.equal(count, 2 + (baseline.gradeSRows.find((row) => row.placeId === id)?.photoCount === 2 ? 1 : 0), `${id} unexpected image count`);
  console.log(`\n── ficha · ${viewportName} · ${hub} · ${id} · ${entry.role} · ${count} imágenes`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const result = await findSearchCard(page, hub, place.name);
  const compactImage = result.locator(".place-card__image");
  await compactImage.evaluate((img) => img.decode());
  const compactSrc = await compactImage.evaluate((img) => img.currentSrc);
  check(`${id} PlaceCard compacto también usa identity`, compactSrc.includes(ordered[0].assetPath.replace(/\.webp$/, "-800w.webp")), compactSrc);
  await result.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__track", { timeout: 15000 });

  const track = page.locator(".place-detail .gallery__track");
  const slides = page.locator(".place-detail .gallery__slide");
  const galleryImages = page.locator(".place-detail .gallery__image");
  const domSources = await galleryImages.evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src").replace(/^\//, "")));
  const expectedSources = ordered.map((record) => record.assetPath);
  check(`${id} ficha abre con identity`, domSources[0] === ordered[0].assetPath, domSources[0]);
  check(`${id} orden respeta identity → experience → complemento`, JSON.stringify(domSources) === JSON.stringify(expectedSources), domSources.join(" → "));
  check(`${id} galería contiene ${count} fotos registradas`, (await slides.count()) === count);
  check(`${id} contador inicia en 1/${count}`, (await page.locator(".gallery__counter").innerText()).trim() === `1 / ${count}`);
  const dotCount = await page.locator(".gallery__dot").count();
  check(`${id} puntos corresponden a las ${count} imágenes`, dotCount === count, `${dotCount} puntos`);
  const snap = await track.evaluate((el) => ({ type: getComputedStyle(el).scrollSnapType, child: getComputedStyle(el.querySelector(".gallery__slide")).scrollSnapAlign }));
  check(`${id} conserva scroll-snap horizontal`, /x\s+mandatory/.test(snap.type) && snap.child !== "none", `${snap.type} / ${snap.child}`);
  check(`${id} imágenes posteriores usan carga diferida`, await galleryImages.evaluateAll((imgs) => imgs.slice(1).every((img) => img.loading === "lazy")));

  for (let index = 0; index < count; index += 1) {
    const image = galleryImages.nth(index);
    await image.evaluate((img) => img.decode());
    const state = await image.evaluate((img) => ({ naturalWidth: img.naturalWidth, alt: img.alt }));
    check(`${id} foto ${index + 1} carga con alt del registro`, state.naturalWidth > 0 && state.alt === ordered[index].alt, `${state.naturalWidth}px · ${state.alt}`);
  }

  const detailImageBytes = new Map();
  async function captureImageCost(index) {
    const image = galleryImages.nth(index);
    await image.evaluate((img) => img.decode());
    const src = await image.evaluate((img) => img.currentSrc);
    await network.settle();
    const pathname = decodeURIComponent(new URL(src).pathname);
    const response = network.requests.filter((item) => item.pathname === pathname).at(-1);
    const bytes = response?.bytes ?? statSync(path.join(appRoot, "public", pathname.replace(/^\//, ""))).size;
    detailImageBytes.set(index, { pathname, bytes });
  }
  await captureImageCost(0);
  for (let index = 1; index < count; index += 1) {
    const dot = page.locator(".gallery__dot").nth(index);
    await dot.click();
    await page.waitForTimeout(250);
    check(`${id} punto ${index + 1} selecciona ${index + 1}/${count}`, (await page.locator(".gallery__counter").innerText()).trim() === `${index + 1} / ${count}`);
    check(`${id} punto ${index + 1} queda seleccionado`, (await dot.getAttribute("aria-selected")) === "true");
    await captureImageCost(index);
  }
  if (count === 3) {
    await track.focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(700);
    check(`${id} teclado vuelve de 3/3 a 2/3`, (await page.locator(".gallery__counter").innerText()).trim() === "2 / 3");
    await track.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
    check(`${id} teclado vuelve a avanzar a 3/3`, (await page.locator(".gallery__counter").innerText()).trim() === "3 / 3");
  }

  const creditsButton = page.locator(".gallery__credits");
  await creditsButton.click();
  await page.waitForSelector(".credits-sheet__list", { timeout: 10000 });
  const creditItems = page.locator(".credits-sheet__list .credits-sheet__item");
  check(`${id} créditos incluyen las ${count} fotos`, (await creditItems.count()) === count);
  for (let index = 0; index < count; index += 1) {
    const text = await creditItems.nth(index).innerText();
    const row = ordered[index];
    check(`${id} crédito ${index + 1} empareja archivo, autor y licencia`, text.includes(row.originalTitle) && text.includes(row.license) && (!row.credit || text.includes(row.credit)), `${row.originalTitle} · ${row.credit} · ${row.license}`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(180);
  check(`${id} cerrar créditos restaura el foco`, await creditsButton.evaluate((el) => document.activeElement === el));

  await page.locator(".gallery__dot").first().click();
  await page.waitForTimeout(250);
  const firstZoom = page.locator(".gallery__zoom").first();
  await firstZoom.click();
  await page.waitForSelector(".lightbox", { timeout: 10000 });
  const lightbox = page.locator(".lightbox__image");
  await lightbox.evaluate((img) => img.decode());
  const lightboxSrc = await lightbox.evaluate((img) => img.currentSrc);
  check(`${id} ampliación carga identity original`, lightboxSrc.includes(ordered[0].assetPath) && !lightboxSrc.includes("-800w"), lightboxSrc.split("/").pop());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(180);
  check(`${id} cerrar ampliación devuelve el foco al control`, await firstZoom.evaluate((el) => document.activeElement === el));

  const responsive = await page.evaluate(() => {
    const trackEl = document.querySelector(".place-detail .gallery__track");
    const box = trackEl?.getBoundingClientRect();
    return { width: box?.width ?? 0, height: box?.height ?? 0, documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
  });
  const expectedRatio = viewportName === "phone" ? 4 / 5 : 4 / 3;
  check(`${id} marco mantiene la proporción responsive existente`, Math.abs(responsive.width / responsive.height - expectedRatio) < 0.04, `${(responsive.width / responsive.height).toFixed(3)} vs ${expectedRatio.toFixed(3)}`);
  check(`${id} ficha no desborda el ancho de pantalla`, responsive.documentWidth <= responsive.viewportWidth + 1, `${responsive.documentWidth}px / ${responsive.viewportWidth}px`);

  await network.settle();
  check(`${id} ficha no hace fetch fotográfico externo`, network.externalPhotos.length === 0, network.externalPhotos.slice(0, 3).join(" "));
  check(`${id} ficha no tiene respuestas fotográficas fallidas`, network.failedImages.length === 0, network.failedImages.slice(0, 3).join(" "));
  const broken = await page.locator(".place-detail .gallery__image").evaluateAll((imgs) => imgs.filter((img) => img.complete && img.naturalWidth === 0).length);
  check(`${id} galería no deja imágenes rotas`, broken === 0, `${broken}`);

  const costs = ordered.map((record, index) => ({ role: record.role, bytes: detailImageBytes.get(index)?.bytes ?? 0 }));
  const identityBytes = costs.find((item) => item.role === "identity")?.bytes ?? 0;
  const experienceBytes = costs.find((item) => item.role === "experience")?.bytes ?? 0;
  const complementaryBytes = costs.filter((item) => item.role !== "identity" && item.role !== "experience").reduce((sum, item) => sum + item.bytes, 0);
  const restBytes = costs.filter((item) => !["identity", "experience"].includes(item.role)).reduce((sum, item) => sum + item.bytes, 0);
  detailRows.push({ viewport: viewportName, id, hub, count, identityBytes, experienceBytes, complementaryBytes, restBytes, totalGalleryBytes: costs.reduce((sum, item) => sum + item.bytes, 0), costs });
  console.log(`      coste · identity ${identityBytes.toLocaleString()} B · experience ${experienceBytes.toLocaleString()} B · complementary ${complementaryBytes.toLocaleString()} B · total ${costs.reduce((sum, item) => sum + item.bytes, 0).toLocaleString()} B`);
  await context.close();
}

async function auditFallback(browser, url, viewportName, sample) {
  const { id, hub, place, records } = sample;
  const identity = records.find((record) => record.role === "identity");
  console.log(`\n── fallback · ${viewportName} · ${id}`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  const identityStem = identity.assetPath.replace(/\.webp$/, "");
  await page.route(`**/${identityStem}*`, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const card = await findSearchCard(page, hub, place.name);
  await page.waitForTimeout(220);
  check(`${id} tarjeta compacta usa placeholder de fallback`, (await card.locator(".place-card__placeholder-compact").count()) === 1 && (await card.locator(".place-card__image").count()) === 0);
  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__error", { timeout: 10000 });
  check(`${id} ficha muestra el estado de error ya existente`, /No se pudo cargar la imagen/.test(await page.locator(".gallery__error").first().innerText()));
  const safe = await page.locator(".place-detail img").evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0 || img.closest(".gallery__slide")?.querySelector(".gallery__error")));
  check(`${id} fallback no deja elemento img roto`, safe);
  check(`${id} fallback sin fetch fotográfico externo`, network.externalPhotos.length === 0);
  await context.close();
}

console.log("B6.5 browser audit — builds from production preview and the existing gallery contract");
console.log(`Samples: ${samples.map(({ id, hub, entry }) => `${id}/${hub}/${entry.role}`).join(", ")}; 3-image sample=${threeImageSample.id}`);
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  for (const viewportName of Object.keys(VIEWPORTS)) {
    for (const hub of HUBS) {
      await auditHubList(browser, url, viewportName, hubSamples[hub], samples.some((sample) => sample.id === hubSamples[hub].id && sample.records.length === 3));
    }
    for (const sample of samples) await auditDetail(browser, url, viewportName, sample);
    await auditFallback(browser, url, viewportName, threeImageSample);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("\nPresupuesto de listas por hub y viewport:");
for (const row of budgetRows) console.log(`  ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} observed=${row.observedBytes.toLocaleString()} B · identity total=${row.identityBytes.toLocaleString()} B · ${row.imagePaths} URLs`);
console.log("Coste de las fichas muestreadas por rol:");
for (const row of detailRows) console.log(`  ${row.id} ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} identity=${row.identityBytes} B experience=${row.experienceBytes} B complementary=${row.complementaryBytes} B resto=${row.restBytes} B total=${row.totalGalleryBytes} B`);
console.log(`\n${"═".repeat(64)}\nB6.5 browser audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
