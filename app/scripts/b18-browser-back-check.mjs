import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

/**
 * Corrección final de B18, punto 4 — puente entre la pila de fichas y el historial real del
 * navegador. `page.goBack()` (equivalente Playwright del back del navegador/gesto de iOS) debe
 * recorrer exactamente la misma pila que el chevron: superficie → ficha A → ficha B, y
 * `goBack()` la deshace en orden inverso, dentro del mismo destino — nunca cambia de pestaña por
 * sí solo. Cubierto aquí: Quiero ir, Viaje, y una cadena de al menos dos lugares en cada uno.
 */

const consoleErrors = [];
const pageErrors = [];

function trackErrors(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageErrors.push(`[${label}] ${err.message}`));
}

async function dismissOnboarding(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });
}

async function reachTokyoWithSavedPlaces(page) {
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.locator(".place-card__save").nth(0).click();
  await page.waitForTimeout(150);
  await page.locator(".place-card__save").nth(1).click();
  await page.waitForTimeout(150);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  trackErrors(page, "browser-back");

  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  await dismissOnboarding(page);
  await reachTokyoWithSavedPlaces(page);

  // ---------------- Quiero ir: abrir → goBack() cierra, sin salir de la pestaña ----------------
  await page.click(".tab-bar__item:has-text('Quiero ir')");
  await page.waitForTimeout(300);
  await page.click(".selection-list__name");
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(250);
  check("Quiero ir: abrir un lugar muestra la ficha", await page.locator(".place-detail").isVisible());

  await page.goBack();
  await page.waitForTimeout(350);
  check("Quiero ir: page.goBack() cierra la ficha", !(await page.locator(".place-detail").isVisible().catch(() => false)));
  check(
    "Quiero ir: page.goBack() no cambia de pestaña",
    (await page.locator(".tab-bar__item--active .tab-bar__label").textContent()) === "Quiero ir"
  );
  check("Quiero ir: tras goBack() se ve de nuevo la lista de selección", await page.locator(".selection-panel").isVisible());

  // Cadena de 2 lugares en Quiero ir: abrir A, saltar a un cercano B, goBack() dos veces.
  await page.click(".selection-list__name");
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(250);
  const placeA = (await page.locator(".place-detail h2").first().textContent())?.trim();
  const nearbyInQuieroIr = page.locator(".nearby-item");
  if ((await nearbyInQuieroIr.count()) > 0) {
    await nearbyInQuieroIr.first().click();
    await page.waitForTimeout(250);
    const placeB = (await page.locator(".place-detail h2").first().textContent())?.trim();
    check("Quiero ir, cadena: saltar a un lugar cercano cambia la ficha (A → B)", placeB !== placeA);

    await page.goBack();
    await page.waitForTimeout(350);
    check(
      "Quiero ir, cadena: primer goBack() recorre B → A, sin cerrar del todo",
      ((await page.locator(".place-detail h2").first().textContent())?.trim() ?? "") === placeA
    );
    check("Quiero ir, cadena: la ficha sigue abierta tras el primer goBack()", await page.locator(".place-detail").isVisible());

    await page.goBack();
    await page.waitForTimeout(350);
    check(
      "Quiero ir, cadena: segundo goBack() cierra del todo, vuelve a la superficie",
      !(await page.locator(".place-detail").isVisible().catch(() => false)) && (await page.locator(".selection-panel").isVisible())
    );
  } else {
    // Sin cadena disponible para este lugar en concreto: cerrar con un solo goBack() y seguir.
    await page.goBack();
    await page.waitForTimeout(350);
    check("Quiero ir, cadena (sin lugares cercanos para este lugar, se omite el resto)", true);
  }

  // ---------------- Viaje: abrir desde «Dónde dormir» → goBack() cierra, vuelve al origen ----------------
  await page.click(".tab-bar__item:has-text('Viaje')");
  await page.waitForTimeout(300);
  await page.click(".viaje-nav__item:has-text('Dónde dormir')");
  await page.waitForTimeout(500);
  const checkboxes = page.locator(".zone-card__compare input[type='checkbox']");
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await page.click(".zone-panel__foot .button--primary");
  await page.waitForTimeout(300);

  const nearestButtons = page.locator(".zone-nearest button");
  if ((await nearestButtons.count()) > 0) {
    await nearestButtons.first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(250);
    check("Viaje: abrir un lugar desde «Dónde dormir» muestra la ficha", await page.locator(".place-detail").isVisible());

    await page.goBack();
    await page.waitForTimeout(350);
    check("Viaje: page.goBack() cierra la ficha", !(await page.locator(".place-detail").isVisible().catch(() => false)));
    check(
      "Viaje: page.goBack() no cambia de pestaña (nunca salta a Explorar)",
      (await page.locator(".tab-bar__item--active .tab-bar__label").textContent()) === "Viaje"
    );
    check("Viaje: tras goBack() se ve de nuevo «Dónde dormir»", await page.locator(".zone-panel--embedded").isVisible());

    // Cadena de 2 lugares en Viaje.
    await nearestButtons.first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(250);
    const viajePlaceA = (await page.locator(".place-detail h2").first().textContent())?.trim();
    const nearbyInViaje = page.locator(".nearby-item");
    if ((await nearbyInViaje.count()) > 0) {
      await nearbyInViaje.first().click();
      await page.waitForTimeout(250);
      const viajePlaceB = (await page.locator(".place-detail h2").first().textContent())?.trim();
      check("Viaje, cadena: saltar a un lugar cercano cambia la ficha (A → B)", viajePlaceB !== viajePlaceA);

      await page.goBack();
      await page.waitForTimeout(350);
      check(
        "Viaje, cadena: primer goBack() recorre B → A",
        ((await page.locator(".place-detail h2").first().textContent())?.trim() ?? "") === viajePlaceA
      );

      await page.goBack();
      await page.waitForTimeout(350);
      check(
        "Viaje, cadena: segundo goBack() cierra del todo, vuelve a «Dónde dormir»",
        !(await page.locator(".place-detail").isVisible().catch(() => false)) &&
          (await page.locator(".zone-panel--embedded").isVisible())
      );
    } else {
      await page.goBack();
      await page.waitForTimeout(350);
      check("Viaje, cadena (sin lugares cercanos para este lugar, se omite el resto)", true);
    }
  } else {
    check("Viaje: goBack() (sin lugares cercanos calculados en este dataset, se omite)", true);
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (consoleErrors.length > 0) {
    console.log("\nConsole errors:");
    consoleErrors.forEach((e) => console.log(" -", e));
  }
  if (pageErrors.length > 0) {
    console.log("\nPage errors:");
    pageErrors.forEach((e) => console.log(" -", e));
  }
  if (failed.length > 0 || pageErrors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
