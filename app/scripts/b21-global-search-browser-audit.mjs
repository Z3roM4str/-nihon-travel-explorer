import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

// B21 / DDR-B21-05: exercise the production bundle and the browser history stack.
const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});

// `NIHON_BROWSER=webkit` ejecuta el mismo gate en WebKit (`NIHON_WEBKIT_PATH` opcional), igual que b10-a11y/motion, d0b y d5.
const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const executablePath = BROWSER === "webkit" ? process.env.NIHON_WEBKIT_PATH : process.env.NIHON_CHROMIUM_PATH;

let browser;
let passed = 0;
const viewportName = (process.argv.find((arg) => arg.startsWith("--viewport=")) ?? "--viewport=mobile").split("=")[1];
const viewports = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
assert.ok(viewportName in viewports, `unknown viewport: ${viewportName}`);
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};
const body = (page) => page.locator(".sheet__body:has(.search-sheet)");
const result = (page) => page.locator(".search-sheet .place-card__open");
const detailTitle = (page) => page.locator("#place-detail-title");

async function frame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * Espera la condición real —no un tiempo—: que terminen las animaciones finitas (`sheet-rise` de entrada de la Sheet, fundidos
 * de imagen). Mientras corren, el elemento a pulsar se mueve fracciones de píxel; Playwright exige un bounding box idéntico en
 * dos fotogramas y, si no lo obtiene, REINTENTA el click con `scrollIntoView({ block: "end" })`, lo que deja `scrollTop = 0`
 * en el `.sheet__body` bajo prueba (B21: causa raíz del «scroll changed: 360 -> 0» intermitente; ver docs/B21_ROOT_CAUSE.md).
 * Las animaciones infinitas (`card-shimmer` de los marcadores de imagen) no mueven nada y se excluyen.
 */
async function settled(page) {
  await page.evaluate(async () => {
    const finite = () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    while (finite().length > 0) await Promise.all(finite().map((a) => a.finished.catch(() => undefined)));
  });
  await frame(page);
}

async function openSearch(page, query) {
  await page.locator(".explorer-home__search-button").click();
  await page.locator(".search-sheet__field input").fill(query);
  await page.locator(".search-sheet .place-card__open").first().waitFor();
  await settled(page);
}

/** Registra el scroll del cuerpo de la Sheet en el instante de la selección (fase de captura, antes del manejador de React). */
async function recordScrollAtSelection(page) {
  await page.evaluate(() => {
    window.__scrollAtSelection = null;
    document.addEventListener(
      "click",
      () => { window.__scrollAtSelection = document.querySelector(".sheet__body:has(.search-sheet)")?.scrollTop ?? null; },
      { capture: true, once: true },
    );
  });
}

/** La línea base es el scroll que tenía la lista cuando se eligió el resultado; si el driver lo alterase antes, el fallo lo dice. */
async function assertScrollAtSelection(page, expected, label) {
  const atSelection = await page.evaluate(() => window.__scrollAtSelection);
  check(atSelection !== null && Math.abs(atSelection - expected) <= 4,
    `${label}: the scroll changed before the result was selected (${expected} -> ${atSelection}); that is the driver, not the restore`);
}

async function scrolledSearch(page) {
  await openSearch(page, "a");
  const count = await result(page).count();
  check(count > 15, `expected enough search results to scroll, got ${count}`);
  await body(page).evaluate((element) => { element.scrollTop = 360; });
  await frame(page);
  const scrollTop = await body(page).evaluate((element) => element.scrollTop);
  check(scrollTop > 300, `expected significant body scroll, got ${scrollTop}`);
  const visibleIndex = await result(page).evaluateAll((items) => {
    const owner = document.querySelector(".sheet__body:has(.search-sheet)");
    const bounds = owner.getBoundingClientRect();
    return items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top > bounds.top + 10 && rect.bottom < bounds.bottom - 10;
    });
  });
  check(visibleIndex >= 0, "no fully visible result at the scrolled position");
  await recordScrollAtSelection(page);
  await result(page).nth(visibleIndex).click();
  await detailTitle(page).waitFor();
  await assertScrollAtSelection(page, scrollTop, "selection");
  check(await page.locator(".search-sheet").count() === 0, "search Sheet should close temporarily");
  return { count, scrollTop };
}

async function assertRestored(page, { count, scrollTop, query = "a" }) {
  await page.locator(".search-sheet").waitFor();
  await frame(page);
  const value = await page.locator(".search-sheet__field input").inputValue();
  const currentCount = await result(page).count();
  const currentScroll = await body(page).evaluate((element) => element.scrollTop);
  check(value === query, `query changed: ${value}`);
  check(currentCount === count, `result count changed: ${count} -> ${currentCount}`);
  check(Math.abs(currentScroll - scrollTop) <= 4, `scroll changed: ${scrollTop} -> ${currentScroll}`);
  console.log(`  restored query=${value}, results=${currentCount}, scrollTop=${currentScroll}/${scrollTop}`);
}

async function newPage(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  await page.locator(".explorer-home__search-button").waitFor();
  return page;
}

try {
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "vite preview did not expose a local URL");
  browser = await (BROWSER === "webkit" ? webkit : chromium).launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({ viewport: viewports[viewportName] });
  await context.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  context.setDefaultTimeout(10000);

  console.log("B21 global search — UI back / scroll");
  let page = await newPage(context, url);
  let baseline = await scrolledSearch(page);
  await page.locator(".place-detail__back").click();
  await assertRestored(page, baseline);
  await page.close();

  console.log("B21 global search — browser back / scroll");
  page = await newPage(context, url);
  baseline = await scrolledSearch(page);
  await page.goBack();
  await assertRestored(page, baseline);
  await page.close();

  console.log("B21 global search — national view / explicit close");
  page = await newPage(context, url);
  await openSearch(page, "Shibuya Crossing");
  await result(page).first().click();
  check(await page.locator(".app__body--national .explorer-home").count() === 1,
    "global result changed underlying national view to a hub");
  await page.locator(".place-detail__back").click();
  await page.locator(".search-sheet").waitFor();
  await page.locator(".sheet:has(.search-sheet) .sheet__head button").click();
  check(await page.locator(".app__body--national .explorer-home").count() === 1,
    "closing global search did not return to national home");
  check(await page.locator(".search-sheet").count() === 0, "explicit close left Sheet open");

  console.log("B21 global search — nearby stack / browser back");
  await openSearch(page, "a");
  const nearbyCount = await result(page).count();
  await body(page).evaluate((element) => { element.scrollTop = 360; });
  await frame(page);
  const nearbyScrollTop = await body(page).evaluate((element) => element.scrollTop);
  check(nearbyScrollTop > 300, `nearby chain needs meaningful search scroll, got ${nearbyScrollTop}`);
  const nearbyStartIndex = await result(page).evaluateAll((items) => {
    const bounds = document.querySelector(".sheet__body:has(.search-sheet)").getBoundingClientRect();
    return items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top > bounds.top + 10 && rect.bottom < bounds.bottom - 10;
    });
  });
  check(nearbyStartIndex >= 0, "no visible nearby-chain starting result");
  await recordScrollAtSelection(page);
  await result(page).nth(nearbyStartIndex).click();
  const titleA = await detailTitle(page).innerText();
  await assertScrollAtSelection(page, nearbyScrollTop, "nearby selection");
  check(titleA.length > 0, "A was not opened");
  await page.locator(".nearby-carousel__item .place-card__open").first().click();
  const titleB = await detailTitle(page).innerText();
  check(titleB !== titleA, "nearby B did not open");
  await page.locator(".nearby-carousel__item .place-card__open").first().click();
  const titleC = await detailTitle(page).innerText();
  check(titleC !== titleB, "nearby C did not open");
  check(await page.locator(".app__body--national .explorer-home").count() === 1,
    "nearby stack changed underlying national view");
  await page.goBack();
  check((await detailTitle(page).innerText()) === titleB, "browser back C -> B failed");
  await page.goBack();
  check((await detailTitle(page).innerText()) === titleA, "browser back B -> A failed");
  await page.goBack();
  await assertRestored(page, { query: "a", count: nearbyCount, scrollTop: nearbyScrollTop });
  await page.locator(".sheet:has(.search-sheet) .sheet__head button").click();

  console.log("B21 global search — city search unchanged / no stale return");
  await page.locator(".explorer-home__city-card").first().click();
  await page.locator(".explorer-bar__search").click();
  await page.locator(".search-sheet__field input").fill("Shibuya Crossing");
  check(await result(page).count() === 1, "city search did not filter as before");
  await result(page).first().click();
  check(await page.locator(".search-sheet").count() === 0, "city search Sheet did not close on selection");
  check((await detailTitle(page).innerText()).includes("Shibuya Crossing"), "city detail did not open");
  await page.locator(".place-detail__back").click();
  check(await page.locator(".search-sheet").count() === 0, "city detail adopted global return behavior");
  check(await page.locator(".explorer-bar__search").count() === 1, "city view was lost");
  await page.close();

  console.log(`B21 global search browser audit ${viewportName}: PASS (${passed}/${passed})`);
} catch (error) {
  console.error(`B21 global search browser audit ${viewportName}: FAIL`, error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
