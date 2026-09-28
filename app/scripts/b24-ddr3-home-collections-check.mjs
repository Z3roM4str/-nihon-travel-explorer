import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

// DDR-B24-3 (resuelta): abrir un lugar desde una colección de la portada se comporta como la
// búsqueda global (DDR-B21-05) — la ficha se apila sobre la portada dentro de Explorar, sin
// cambiar la ciudad activa; cerrar (UI, Escape o back) devuelve exactamente al scroll que tenía
// la portada justo antes de abrirse (el propio clic puede desplazarla para traer la tarjeta a la
// vista, como haría cualquier navegador — eso no es lo que este gate comprueba).

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});

let browser;
let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};

async function frame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function newPage(context, url) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.locator(".app__body--home").waitFor();
  return page;
}

async function firstCollectionCard(page) {
  const card = page.locator(".explorer-home__collection-item .place-card__open").first();
  await card.waitFor();
  return card;
}

async function openFromCollection(page) {
  const home = page.locator(".app__body--home");
  const card = await firstCollectionCard(page);
  await card.click();
  await page.locator("#place-detail-title").waitFor();
  // Posición real de la portada justo antes de abrirse la ficha (tras el propio scroll del
  // clic, si lo hubo) — es la que debe recuperarse al cerrar.
  const scrollTop = await home.evaluate((element) => element.scrollTop);
  return { home, scrollTop };
}

try {
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "vite preview did not expose a local URL");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}),
  });
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));

  {
    const page = await newPage(context, url);
    const { home, scrollTop } = await openFromCollection(page);
    check(await page.locator(".app__body--home").count() === 1, "la portada debe seguir montada bajo la ficha");
    check(
      (await page.locator(".explorer-bar").count()) === 0,
      "no debe aparecer cromo de ciudad (la vista no debe cambiar a un hub)"
    );

    // Cierre por UI (chevron/×): sin lugar anterior en la pila, `.place-detail__back` cierra.
    await page.locator(".place-detail__back").first().click();
    await page.locator("#place-detail-title").waitFor({ state: "detached" });
    await frame(page);
    const restoredScroll = await home.evaluate((element) => element.scrollTop);
    check(Math.abs(restoredScroll - scrollTop) <= 4, `scroll no restaurado tras cierre por UI: ${scrollTop} -> ${restoredScroll}`);
    await page.close();
  }

  {
    const page = await newPage(context, url);
    const { home, scrollTop } = await openFromCollection(page);
    await page.keyboard.press("Escape");
    await page.locator("#place-detail-title").waitFor({ state: "detached" });
    await frame(page);
    check(await page.locator(".app__body--home").count() === 1, "Escape debe volver a la portada, no a otra vista");
    const restoredScroll = await home.evaluate((element) => element.scrollTop);
    check(Math.abs(restoredScroll - scrollTop) <= 4, `scroll no restaurado tras Escape: ${scrollTop} -> ${restoredScroll}`);
    await page.close();
  }

  {
    const page = await newPage(context, url);
    const { home, scrollTop } = await openFromCollection(page);
    await page.goBack();
    await page.locator("#place-detail-title").waitFor({ state: "detached" });
    await frame(page);
    check(await page.locator(".app__body--home").count() === 1, "el back del navegador debe volver a la portada");
    check(
      (await page.locator(".explorer-bar").count()) === 0,
      "el back del navegador no debe dejar la vista en un hub"
    );
    const restoredScroll = await home.evaluate((element) => element.scrollTop);
    check(Math.abs(restoredScroll - scrollTop) <= 4, `scroll no restaurado tras back: ${scrollTop} -> ${restoredScroll}`);
    await page.close();
  }

  {
    // La ausencia de cambio implícito de ciudad se sostiene también tras un salto «Cerca de
    // aquí» dentro de la ficha abierta desde una colección: sigue sin activarse cromo de hub.
    const page = await newPage(context, url);
    await openFromCollection(page);
    check(
      (await page.locator(".explorer-bar").count()) === 0,
      "abrir desde una colección no debe activar en ningún momento la vista de un hub"
    );
    await page.close();
  }

  console.log(`OK — ${passed} comprobaciones (DDR-B24-3)`);
} finally {
  await browser?.close();
  await server.close();
}
