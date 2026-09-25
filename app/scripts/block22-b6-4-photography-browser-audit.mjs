import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * B6.4: browser audit for Grade-S experience galleries and list-image budgets.
 * Runs against the production build through Vite preview and the existing B20 gallery.
 */
const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const SAMPLE_IDS = ["JP-025", "JP-054", "JP-129", "JP-173", "JP-196", "JP-205"];
const FALLBACK_ID = "JP-173";
const PORT = 4323;
const MAX_HUB_BYTES = 3_500_000;

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const places = JSON.parse(readFileSync(path.join(repoRoot, "data/places.json"), "utf8"));
const baseline = JSON.parse(
  readFileSync(path.join(repoRoot, "data/visual/block22-b6-4-baseline.json"), "utf8")
);
const metadata = JSON.parse(
  readFileSync(path.join(repoRoot, "data/visual/photography-metadata.json"), "utf8")
);
const placeById = Object.fromEntries(places.map((place) => [place.id, place]));
const baselineS = new Set(baseline.gradeSRows.map((row) => row.placeId));
const recordsById = {};
for (const record of metadata.images) (recordsById[record.placeId] ??= []).push(record);
const samples = SAMPLE_IDS.map((id) => {
  const place = placeById[id];
  assert.ok(place, `missing sample place ${id}`);
  assert.ok(baselineS.has(id), `${id} is not in the data-derived Grade-S baseline`);
  const records = recordsById[id] ?? [];
  assert.ok(records.some((record) => record.role === "identity"), `${id} has no identity`);
  assert.ok(records.some((record) => record.role === "experience"), `${id} has no experience`);
  return { id, hub: place.hub, place, records };
});
assert.ok(samples.some(({ hub }) => !["Tokio", "Kioto", "Osaka", "Okinawa"].includes(hub)));

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
    if (/\/(images\/places\/)|\.(?:webp|jpe?g|png)(?:\?|$)/i.test(url)) externalPhotos.push(url);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.includes("/images/places/") || !url.pathname.endsWith(".webp")) return;
    const task = (async () => {
      let bytes = 0;
      try {
        bytes = (await response.body()).byteLength;
      } catch {
        const local = path.join(appRoot, "public", decodeURIComponent(url.pathname).replace(/^\//, ""));
        try {
          bytes = statSync(local).size;
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
  const byPath = new Map();
  for (const request of requests) byPath.set(request.pathname, request.bytes);
  return [...byPath.values()].reduce((sum, bytes) => sum + bytes, 0);
}

function expectedDerivative(record, width = 800) {
  return `/${record.assetPath.replace(/\.webp$/, `-${width}w.webp`)}`;
}

function experiencePathsForS() {
  const paths = new Set();
  for (const id of baselineS) {
    for (const record of roleRecords(id).filter((row) => row.role === "experience")) {
      paths.add(`/${record.assetPath}`);
      paths.add(expectedDerivative(record, 800));
      paths.add(expectedDerivative(record, 400));
    }
  }
  return paths;
}

const sExperiencePaths = experiencePathsForS();
const fullIdentityBudgetByHub = new Map();
for (const place of places) {
  const identity = roleRecords(place.id).find((record) => record.role === "identity");
  if (!identity) continue;
  const derivative = expectedDerivative(identity);
  const bytes = statSync(path.join(appRoot, "public", derivative.replace(/^\//, ""))).size;
  fullIdentityBudgetByHub.set(place.hub, (fullIdentityBudgetByHub.get(place.hub) ?? 0) + bytes);
}

async function openHub(page, url, hub, network) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const hubButton = page.getByRole("button", { name: new RegExp(`^${hub}`) }).first();
  await hubButton.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
  await network.settle();
  // Measure the selected city's list, not the national landing surface that precedes it.
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

function viewportContextOptions(viewportName) {
  const { width, height, dpr } = VIEWPORTS[viewportName];
  return {
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: viewportName === "phone",
  };
}

async function auditHubList(browser, url, viewportName, sample) {
  const { hub, place, id } = sample;
  console.log(`\n── list · ${viewportName} · ${hub} · S sample ${id} ${place.name}`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const scroller = page.locator(".app__sidebar");
  for (let step = 0; step < 65; step += 1) {
    await scroller.evaluate((element) => element.scrollBy(0, 900));
    await page.waitForTimeout(90);
  }
  const listCard = page
    .locator(".place-list .place-card:not(.place-card--compact)")
    .filter({ hasText: place.name })
    .first();
  await listCard.waitFor({ state: "attached", timeout: 10000 });
  await listCard.scrollIntoViewIfNeeded();
  const cardImage = listCard.locator(".place-card__image");
  await cardImage.waitFor({ state: "visible", timeout: 10000 });
  await cardImage.evaluate((img) => img.decode());
  const identity = roleRecords(id).find((record) => record.role === "identity");
  const cardState = await cardImage.evaluate((img) => ({
    currentSrc: img.currentSrc,
    naturalWidth: img.naturalWidth,
    alt: img.alt,
  }));
  check(`${hub} PlaceCard uses identity only`, cardState.currentSrc.includes(identity.assetPath.replace(/\.webp$/, "-800w.webp")), cardState.currentSrc);
  check(`${hub} PlaceCard image is decoded`, cardState.naturalWidth > 0, `${cardState.naturalWidth}px`);
  check(`${hub} PlaceCard photo stays decorative`, cardState.alt === "", cardState.alt);

  await page.waitForTimeout(700);
  await network.settle();
  const requestedPaths = new Set(network.requests.map((request) => request.pathname));
  const eagerExperience = [...sExperiencePaths].filter((assetPath) => requestedPaths.has(assetPath));
  check(`${hub} list does not fetch Grade-S experience assets`, eagerExperience.length === 0, eagerExperience.slice(0, 4).join(", "));
  const wrongRenditions = network.requests.filter((request) => !request.pathname.endsWith("-800w.webp"));
  check(`${hub} list requests only 800w photography`, wrongRenditions.length === 0, wrongRenditions.slice(0, 3).map((item) => item.pathname).join(", "));
  check(`${hub} list has no external photo requests`, network.externalPhotos.length === 0, network.externalPhotos.slice(0, 3).join(" "));
  check(`${hub} list has no broken photo responses`, network.failedImages.length === 0, network.failedImages.slice(0, 3).join(" "));

  const bytes = uniqueTransferredBytes(network.requests);
  const hubBudgetBytes = fullIdentityBudgetByHub.get(hub) ?? 0;
  const hubIdentityPaths = new Set(
    places
      .filter((candidate) => candidate.hub === hub)
      .map((candidate) => roleRecords(candidate.id).find((record) => record.role === "identity"))
      .filter(Boolean)
      .map((record) => expectedDerivative(record))
  );
  const unexpectedHubPaths = [...requestedPaths].filter((assetPath) => !hubIdentityPaths.has(assetPath));
  check(`${hub} list requests only identity thumbnails for the active hub`, unexpectedHubPaths.length === 0, unexpectedHubPaths.slice(0, 4).join(", "));
  const row = { viewport: viewportName, hub, bytes, hubBudgetBytes, images: requestedPaths.size };
  budgetRows.push(row);
  check(`${hub} full identity-list budget ≤ ${MAX_HUB_BYTES.toLocaleString()} B`, hubBudgetBytes <= MAX_HUB_BYTES, `${hubBudgetBytes.toLocaleString()} B`);
  check(`${hub} observed list transfer stays within its full identity budget`, bytes <= hubBudgetBytes, `${bytes.toLocaleString()} / ${hubBudgetBytes.toLocaleString()} B`);
  await context.close();
}

async function auditDetail(browser, url, viewportName, sample) {
  const { id, hub, place, records } = sample;
  const ordered = records;
  const identity = ordered[0];
  const experience = ordered[1];
  console.log(`\n── detail · ${viewportName} · ${hub} · ${id} ${place.name}`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, hub, network);
  const result = await findSearchCard(page, hub, place.name);
  const resultImage = result.locator(".place-card__image");
  await resultImage.evaluate((img) => img.decode());
  const resultSrc = await resultImage.evaluate((img) => img.currentSrc);
  check(`${id} compact search card also uses identity`, resultSrc.includes(identity.assetPath.replace(/\.webp$/, "-800w.webp")), resultSrc);
  await result.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__track", { timeout: 15000 });

  const track = page.locator(".place-detail .gallery__track");
  const slides = page.locator(".place-detail .gallery__slide");
  const expectedSources = ordered.map((record) => record.assetPath);
  const domSources = await page.locator(".place-detail .gallery__image").evaluateAll((imgs) =>
    imgs.map((img) => img.getAttribute("src").replace(/^\//, ""))
  );
  check(`${id} detail opens on identity`, domSources[0] === identity.assetPath, domSources[0]);
  check(`${id} second slide is experience`, domSources[1] === experience.assetPath, domSources[1]);
  check(`${id} gallery preserves canonical role order`, JSON.stringify(domSources) === JSON.stringify(expectedSources), domSources.join(" → "));
  check(`${id} detail slide count matches photography registry`, (await slides.count()) === ordered.length, `${await slides.count()} vs ${ordered.length}`);
  check(`${id} detail opens with first counter value`, (await page.locator(".gallery__counter").innerText()).trim() === `1 / ${ordered.length}`);
  check(`${id} gallery uses the B20 scroll-snap track`, (await track.getAttribute("aria-roledescription")) === "carrusel" && /x\s+mandatory/.test(await track.evaluate((el) => getComputedStyle(el).scrollSnapType)));
  check(`${id} counter exists for multiple images`, (await page.locator(".gallery__counter").count()) === 1);
  const dots = await page.locator(".gallery__dot").count();
  check(`${id} dots follow the ≤5 image contract`, dots === (ordered.length <= 5 ? ordered.length : 0), `${dots} dots`);

  const firstImage = page.locator(".gallery__slide").first().locator(".gallery__image");
  await firstImage.evaluate((img) => img.decode());
  const firstState = await firstImage.evaluate((img) => ({
    src: img.currentSrc,
    naturalWidth: img.naturalWidth,
    alt: img.alt,
  }));
  check(`${id} identity image loads with its registry alt`, firstState.naturalWidth > 0 && firstState.alt === identity.alt, `${firstState.naturalWidth}px`);

  const arrow = page.locator(".gallery__nav--next");
  const isPhone = viewportName === "phone";
  check(`${id} gallery arrow visibility follows the B20 breakpoint`, (await arrow.isVisible()) === !isPhone);
  const keyboardNavigate = async (key) => {
    await track.focus();
    await page.keyboard.press(key);
    await page.waitForTimeout(750);
  };
  if (isPhone) await keyboardNavigate("ArrowRight");
  else await arrow.click();
  await page.waitForTimeout(250);
  const secondImage = page.locator(".gallery__slide").nth(1).locator(".gallery__image");
  await secondImage.evaluate((img) => img.decode());
  const secondState = await secondImage.evaluate((img) => ({
    src: img.currentSrc,
    naturalWidth: img.naturalWidth,
    alt: img.alt,
  }));
  const currentCounter = (await page.locator(".gallery__counter").innerText()).trim();
  check(`${id} keyboard/arrow reaches experience second`, currentCounter === `2 / ${ordered.length}` && secondState.naturalWidth > 0, `${currentCounter}; ${secondState.naturalWidth}px`);
  check(`${id} experience image carries its registry alt`, secondState.alt === experience.alt, secondState.alt);

  const detailImageBytes = new Map();
  async function captureImageCost(index) {
    const image = page.locator(".gallery__slide").nth(index).locator(".gallery__image");
    await image.evaluate((img) => img.decode());
    const source = await image.evaluate((img) => img.currentSrc);
    await network.settle();
    const pathname = decodeURIComponent(new URL(source).pathname);
    const response = network.requests.filter((item) => item.pathname === pathname).at(-1);
    const bytes = response?.bytes ?? statSync(path.join(appRoot, "public", pathname.replace(/^\//, ""))).size;
    detailImageBytes.set(index, { pathname, bytes });
  }
  await captureImageCost(0);
  await captureImageCost(1);
  for (let index = 2; index < ordered.length; index += 1) {
    if (isPhone) await keyboardNavigate("ArrowRight");
    else await page.locator(".gallery__nav--next").click();
    await page.waitForTimeout(200);
    check(`${id} remaining gallery slide ${index + 1} is reachable`, (await page.locator(".gallery__counter").innerText()).trim() === `${index + 1} / ${ordered.length}`);
    const rest = page.locator(".gallery__slide").nth(index).locator(".gallery__image");
    const state = await rest.evaluate((img) => ({ naturalWidth: img.naturalWidth, alt: img.alt }));
    if (!state.naturalWidth) await rest.evaluate((img) => img.decode());
    check(`${id} remaining slide ${index + 1} decodes`, (await rest.evaluate((img) => img.naturalWidth)) > 0);
    check(`${id} remaining slide ${index + 1} keeps registry alt`, state.alt === ordered[index].alt, state.alt);
    await captureImageCost(index);
  }

  const creditButton = page.locator(".gallery__credits");
  await creditButton.click();
  await page.waitForSelector(".credits-sheet__list", { timeout: 10000 });
  const credits = page.locator(".credits-sheet__list");
  const creditItems = await credits.locator(".credits-sheet__item").count();
  check(`${id} credits list has one record per attributable photograph`, creditItems === ordered.length, `${creditItems} vs ${ordered.length}`);
  for (let index = 0; index < ordered.length; index += 1) {
    const item = credits.locator(".credits-sheet__item").nth(index);
    const text = await item.innerText();
    check(`${id} credit ${index + 1} names the matching author and license`,
      (!ordered[index].credit || text.includes(ordered[index].credit)) && text.includes(ordered[index].license),
      `${ordered[index].credit} · ${ordered[index].license}`);
    check(`${id} credit ${index + 1} identifies its original file`, text.includes(ordered[index].originalTitle), ordered[index].originalTitle);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check(`${id} credits close returns focus to the info button`, await creditButton.evaluate((el) => document.activeElement === el));

  while ((await page.locator(".gallery__counter").count()) && (await page.locator(".gallery__counter").innerText()).trim() !== `1 / ${ordered.length}`) {
    await keyboardNavigate("ArrowLeft");
  }
  const zoom = page.locator(".gallery__zoom").first();
  await zoom.click();
  await page.waitForSelector(".lightbox", { timeout: 10000 });
  const lightbox = page.locator(".lightbox__image");
  await lightbox.evaluate((img) => img.decode());
  const lightboxState = await lightbox.evaluate((img) => ({ src: img.currentSrc, naturalWidth: img.naturalWidth }));
  check(`${id} lightbox loads the identity original`, lightboxState.src.includes(identity.assetPath) && !lightboxState.src.includes("-800w"), lightboxState.src.split("/").pop());
  check(`${id} lightbox original is decoded`, lightboxState.naturalWidth > 0, `${lightboxState.naturalWidth}px`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(`${id} lightbox close returns focus to its opener`, await zoom.evaluate((el) => document.activeElement === el));

  const responsive = await page.evaluate(() => {
    const trackEl = document.querySelector(".place-detail .gallery__track");
    const box = trackEl?.getBoundingClientRect();
    return {
      width: box?.width ?? 0,
      height: box?.height ?? 0,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  const expectedRatio = isPhone ? 4 / 5 : 4 / 3;
  check(`${id} gallery uses the responsive B20 frame ratio`, Math.abs(responsive.width / responsive.height - expectedRatio) < 0.04, `${(responsive.width / responsive.height).toFixed(3)} vs ${expectedRatio.toFixed(3)}`);
  check(`${id} detail has no viewport-width overflow`, responsive.documentWidth <= responsive.viewportWidth + 1, `${responsive.documentWidth}px vs ${responsive.viewportWidth}px`);

  await network.settle();
  check(`${id} detail makes no external photo requests`, network.externalPhotos.length === 0, network.externalPhotos.slice(0, 3).join(" "));
  check(`${id} detail has no failed photo responses`, network.failedImages.length === 0, network.failedImages.slice(0, 3).join(" "));
  const broken = await page.locator(".place-detail .gallery__image").evaluateAll((imgs) => imgs.filter((img) => img.complete && img.naturalWidth === 0).length);
  check(`${id} gallery has no broken rendered images`, broken === 0, `${broken}`);

  const costs = ordered.map((record, index) => ({ role: record.role, bytes: detailImageBytes.get(index)?.bytes ?? 0 }));
  const identityBytes = costs.find((entry) => entry.role === "identity")?.bytes ?? 0;
  const experienceBytes = costs.find((entry) => entry.role === "experience")?.bytes ?? 0;
  const restBytes = costs.filter((entry) => !["identity", "experience"].includes(entry.role)).reduce((sum, entry) => sum + entry.bytes, 0);
  const detailRow = { viewport: viewportName, id, hub, identityBytes, experienceBytes, restBytes, totalGalleryBytes: costs.reduce((sum, entry) => sum + entry.bytes, 0), costs };
  detailRows.push(detailRow);
  console.log(`      cost · identity ${identityBytes.toLocaleString()} B · experience ${experienceBytes.toLocaleString()} B · rest ${restBytes.toLocaleString()} B`);
  await context.close();
}

async function auditFallback(browser, url, viewportName) {
  const sample = samples.find((entry) => entry.id === FALLBACK_ID);
  const identity = roleRecords(FALLBACK_ID).find((record) => record.role === "identity");
  console.log(`\n── fallback · ${viewportName} · ${FALLBACK_ID}`);
  const context = await browser.newContext(viewportContextOptions(viewportName));
  const page = await context.newPage();
  const network = makeInstrument(page, url);
  const stem = identity.assetPath.replace(/\.webp$/, "");
  await page.route(`**/${stem}*`, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await openHub(page, url, sample.hub, network);
  const card = await findSearchCard(page, sample.hub, sample.place.name);
  await page.waitForTimeout(250);
  check(`${FALLBACK_ID} broken compact card uses its fallback`, (await card.locator(".place-card__placeholder-compact").count()) === 1 && (await card.locator(".place-card__image").count()) === 0);
  await card.locator(".place-card__open").click();
  await page.waitForSelector(".place-detail .gallery__error", { timeout: 10000 });
  check(`${FALLBACK_ID} broken detail image shows the B20 error state`, /No se pudo cargar la imagen/.test(await page.locator(".gallery__error").first().innerText()));
  const noBrokenFallbackImages = await page.locator(".place-detail img").evaluateAll((imgs) =>
    imgs.every((img) => img.complete && img.naturalWidth > 0 || img.closest(".gallery__slide")?.querySelector(".gallery__error"))
  );
  check(`${FALLBACK_ID} fallback leaves no broken img element`, noBrokenFallbackImages);
  check(`${FALLBACK_ID} fallback makes no external photo requests`, network.externalPhotos.length === 0);
  await context.close();
}

console.log("B6.4 Grade-S experience photography browser audit — production build via Vite preview");
console.log(`Samples: ${samples.map(({ id, hub }) => `${id}/${hub}`).join(", ")}`);
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  for (const viewportName of Object.keys(VIEWPORTS)) {
    for (const sample of samples) await auditHubList(browser, url, viewportName, sample);
    for (const sample of samples) await auditDetail(browser, url, viewportName, sample);
    await auditFallback(browser, url, viewportName);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("\nCity-list network budgets by hub and viewport:");
for (const row of budgetRows) console.log(`  ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} observed=${row.bytes.toLocaleString()} B · all identity=${row.hubBudgetBytes.toLocaleString()} B (${row.images} image URLs)`);
console.log("Detail photo costs by role and viewport:");
for (const row of detailRows) {
  console.log(`  ${row.id} ${row.hub.padEnd(10)} ${row.viewport.padEnd(8)} identity=${row.identityBytes} B experience=${row.experienceBytes} B rest=${row.restBytes} B total=${row.totalGalleryBytes} B`);
}
console.log(`\n${"═".repeat(60)}\nB6.4 browser audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
