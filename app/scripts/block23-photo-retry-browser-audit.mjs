import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/** Block 23: real-browser coverage for a failed photograph and its retry. */
const VIEWPORTS = [
  { name: "phone 390×844", width: 390, height: 844 },
  { name: "desktop 1440×900", width: 1440, height: 900 },
];
const PORT = 4182;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 12"><rect width="16" height="12" fill="#f5f6f4"/></svg>';
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(appRoot, "..");
const places = JSON.parse(readFileSync(path.join(repoRoot, "data/places.json"), "utf8"));
const metadata = JSON.parse(
  readFileSync(path.join(repoRoot, "data/visual/photography-metadata.json"), "utf8")
);
const galleryPlace = places.find((place) => place.id === "JP-021");
if (!galleryPlace) throw new Error("The fixed gallery sample JP-021 is missing from the catalogue.");
const galleryImages = metadata.images.filter((image) => image.placeId === galleryPlace.id);
if (galleryImages.length !== 2) {
  throw new Error("The fixed gallery sample JP-021 must keep its two licensed photographs.");
}

let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`  ${condition ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function mockImages(page) {
  let failNext = false;
  let failOnlyThisUrl = null;
  let failedUrl = null;
  let failedUrlRequests = 0;
  await page.route("**/*.webp", (route) => {
    const url = route.request().url();
    if (failNext && (!failOnlyThisUrl || url === failOnlyThisUrl)) {
      failNext = false;
      failedUrl = url;
      failedUrlRequests = 1;
      console.log(`  simulated image failure: ${url}`);
      return route.fulfill({ status: 503, contentType: "text/plain", body: "temporary failure" });
    }
    if (failedUrl === url) failedUrlRequests += 1;
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG });
  });
  return {
    failNextRequest(url = null) { failNext = true; failOnlyThisUrl = url; },
    get failedUrl() { return failedUrl; },
    get requests() { return failedUrlRequests; },
  };
}

async function openHome(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
}

async function auditCardRetry(browser, baseUrl, viewport) {
  console.log(`\nPlaceCard · ${viewport.name}`);
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  const images = await mockImages(page);
  await openHome(page, baseUrl);
  check("La portada sin errores no muestra controles de reintento", (await page.locator(".place-card__photo-retry").count()) === 0);
  images.failNextRequest();
  await page.getByRole("button", { name: /Tokio/ }).first().click();
  await page.waitForSelector(".place-card:not(.place-card--compact)", { timeout: 15000 });
  const failedCard = page.locator(".place-card:not(.place-card--compact)").filter({
    has: page.locator(".photo-placeholder[aria-label*='No se pudo cargar la imagen']"),
  }).first();
  const retry = failedCard.locator(".place-card__photo-retry");
  await retry.waitFor({ state: "visible", timeout: 15000 });
  const originalUrl = images.failedUrl;
  if (!originalUrl) throw new Error("The card's failing image request was not captured.");
  const openLabel = await failedCard.locator(".place-card__open").getAttribute("aria-label");
  const card = page.getByRole("button", { name: openLabel, exact: true }).locator("xpath=..");
  check("Un fallo HTTP muestra el estado de error y Reintentar", (await failedCard.locator(".photo-placeholder[aria-label*='No se pudo cargar la imagen']").count()) === 1);
  check("El estado de error conserva Quiero ir", (await failedCard.locator(".place-card__save").count()) === 1);

  const retryBox = await retry.boundingBox();
  check("Reintentar en la tarjeta tiene un área táctil de al menos 44×44", Boolean(retryBox && retryBox.width >= 44 && retryBox.height >= 44), retryBox ? `${retryBox.width.toFixed(0)}×${retryBox.height.toFixed(0)}` : "sin caja visible");
  await retry.focus();
  await retry.press("Enter");
  await page.waitForFunction((url) => [...document.querySelectorAll(".place-card__image")].some((image) => image.src === url && image.dataset.state === "loaded"), originalUrl);
  check("El segundo intento solicita la misma URL y recupera la fotografía", (await card.locator(".place-card__image").evaluate((image) => image.src)) === originalUrl && images.requests === 2);
  check("El teclado conserva el foco en la acción de abrir y no abre PlaceDetail", await card.locator(".place-card__open").evaluate((button) => document.activeElement === button) && (await page.locator(".place-detail").count()) === 0);
  check("La acción desaparece tras recuperar la imagen", (await card.locator(".place-card__photo-retry").count()) === 0);
  await context.close();
}

async function auditGalleryRetry(browser, baseUrl, viewport) {
  console.log(`\nPlaceGallery · ${viewport.name}`);
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  const images = await mockImages(page);
  const identityUrl = new URL(galleryImages[1].assetPath.replace(/^\/+/, ""), baseUrl).href;
  const galleryRequestUrl = identityUrl.replace(/\.webp$/, "-800w.webp");
  await openHome(page, baseUrl);
  await page.getByRole("button", { name: /Tokio/ }).first().click();
  await page.waitForSelector(".place-card:not(.place-card--compact)", { timeout: 15000 });
  await page.getByRole("button", { name: "Buscar en Tokio" }).click();
  await page.getByPlaceholder("Buscar en Tokio").fill(galleryPlace.name);
  const result = page.locator(".search-sheet .place-card__open").first();
  await result.waitFor({ state: "visible", timeout: 10000 });
  const searchImage = result.locator("xpath=..").locator(".place-card__image");
  await searchImage.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction((image) => image.dataset.state === "loaded", await searchImage.elementHandle());
  const resultLabel = await result.getAttribute("aria-label");
  if (!resultLabel?.startsWith(`${galleryPlace.name}.`)) {
    throw new Error(`Search resolved the wrong gallery sample: ${resultLabel}`);
  }
  await page.waitForLoadState("networkidle");
  images.failNextRequest(galleryRequestUrl);
  await result.click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  const retry = page.locator(".gallery__retry");
  await retry.waitFor({ state: "visible", timeout: 15000 });
  if (images.failedUrl !== galleryRequestUrl) throw new Error(`Unexpected failed gallery URL: ${images.failedUrl}`);
  check("Un fallo HTTP muestra estado de error y reintento en la fotografía activa", (await page.locator(".gallery__counter").innerText()).trim() === "1 / 2" && /No se pudo cargar/.test(await page.locator(".gallery__error").innerText()));
  const retryBox = await retry.boundingBox();
  check("Reintentar en la galería tiene un área táctil de al menos 44×44", Boolean(retryBox && retryBox.width >= 44 && retryBox.height >= 44), retryBox ? `${retryBox.width.toFixed(0)}×${retryBox.height.toFixed(0)}` : "sin caja visible");

  const track = page.locator(".gallery__track");
  await track.focus();
  await track.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".gallery__counter")?.textContent?.trim() === "2 / 2");
  await retry.focus();
  await retry.press("Enter");
  await page.waitForFunction((url) => {
    const image = document.querySelector(".gallery__slide:nth-child(2) img");
    return image?.src === url.source && image.currentSrc === url.request && image.complete && image.naturalWidth > 0;
  }, { source: identityUrl, request: galleryRequestUrl });
  check("La galería reintenta la misma foto y conserva el índice activo", images.requests === 2 && (await page.locator(".gallery__counter").innerText()).trim() === "2 / 2");
  check("El foco permanece en la pista para seguir navegando por teclado", await page.locator(".gallery__track").evaluate((track) => document.activeElement === track));

  await track.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector(".gallery__counter")?.textContent?.trim() === "1 / 2");
  await track.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".gallery__counter")?.textContent?.trim() === "2 / 2");
  check("La navegación con flecha sigue funcionando después del reintento", true);
  await page.locator(".gallery__credits").click();
  check("CreditsSheet conserva los créditos de todas las imágenes", (await page.locator(".credits-sheet__item").count()) === 2);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".credits-sheet__item", { state: "detached" });
  const secondZoom = page.locator(".gallery__zoom").nth(1);
  await secondZoom.click();
  await page.waitForSelector(".lightbox[aria-modal='true']");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".lightbox", { state: "detached" });
  check("La lightbox cierra con Escape y devuelve el foco a su control de apertura", await secondZoom.evaluate((button) => document.activeElement === button));
  await context.close();
}

const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const baseUrl = `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    await auditCardRetry(browser, baseUrl, viewport);
    await auditGalleryRetry(browser, baseUrl, viewport);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\nBlock 23 photo retry browser audit: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
