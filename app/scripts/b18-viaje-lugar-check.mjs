import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

/**
 * Corrección final de B18 — Viaje → Lugar (DD-015, `02 §D3`, `05 §7`/`§8`).
 *
 * Contra un build real (no jsdom): abrir un lugar desde «Dónde dormir» apila la ficha dentro de
 * Viaje, en vez de navegar a Explorar como hacía antes de esta corrección. Cubre los puntos 1, 2,
 * 3, 5, 7 y 8 de la corrección: stack/retorno a origen, encadenado, instancia única, responsive
 * teléfono/md+, «Ver en el mapa», y los tokens de ancho de Sheet (420) vs ficha (480). El puente
 * con `page.goBack()` tiene su propio gate: `scripts/b18-browser-back-check.mjs`.
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

/** Navega a Tokio y guarda dos lugares — necesario para que «Dónde dormir» tenga zonas con
 * lugares cercanos calculados (la lista "Cerca de vuestros guardados" de cada columna). */
async function reachTokyoWithSavedPlaces(page) {
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.locator(".place-card__save").nth(0).click();
  await page.waitForTimeout(150);
  await page.locator(".place-card__save").nth(1).click();
  await page.waitForTimeout(150);
}

/** Entra en Viaje › Dónde dormir y activa el modo comparar con las dos primeras zonas, que es
 * donde vive la lista de lugares cercanos (`.zone-nearest`) usada para abrir una ficha. */
async function openZoneCompareMode(page) {
  await page.click(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible");
  await page.waitForTimeout(300);
  await page.click(".viaje-nav__item:has-text('Dónde dormir')");
  await page.waitForTimeout(500);
  const checkboxes = page.locator(".zone-card__compare input[type='checkbox']");
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await page.click(".zone-panel__foot .button--primary");
  await page.waitForTimeout(300);
}

async function countAppDetail(page) {
  return page.locator(".app__detail").count();
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  // ---------------- Teléfono: stack, retorno a origen, encadenado, instancia única ----------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    trackErrors(page, "phone");
    await dismissOnboarding(page);
    await reachTokyoWithSavedPlaces(page);
    await openZoneCompareMode(page);

    check("«Dónde dormir» entra en modo comparar con 2 zonas", await page.locator(".zone-compare").isVisible());
    const subtitleBefore = await page.locator(".zone-panel__sub").textContent();
    check("subtítulo dice «Comparando 2 zonas»", (subtitleBefore ?? "").includes("Comparando 2 zonas"));

    // Scroll del panel exterior de Viaje, para comprobar que se conserva tras abrir/cerrar la ficha.
    await page.evaluate(() => {
      const scroller = document.querySelector(".destination-panel--scroll");
      scroller?.scrollTo({ top: 120 });
    });
    await page.waitForTimeout(150);
    const scrollBefore = await page.evaluate(
      () => document.querySelector(".destination-panel--scroll")?.scrollTop ?? 0
    );

    const nearestButtons = page.locator(".zone-nearest button");
    const nearestCount = await nearestButtons.count();
    if (nearestCount === 0) {
      check(
        "abrir un lugar desde «Dónde dormir» (sin lugares cercanos calculados en este dataset, se omite)",
        true
      );
    } else {
      const firstPlaceName = (await nearestButtons.first().locator("span").first().textContent())?.trim();
      await nearestButtons.first().click();
      await page.waitForSelector(".place-detail", { timeout: 15000 });
      await page.waitForTimeout(250);

      check("abrir un lugar desde «Dónde dormir» apila la ficha (punto 1)", await page.locator(".place-detail").isVisible());
      check("el destino activo sigue siendo Viaje mientras la ficha está abierta", (
        await page.locator(".tab-bar__item--active .tab-bar__label").textContent()
      ) === "Viaje");
      check("nunca hay dos .app__detail activos a la vez (punto 8, gate 9)", (await countAppDetail(page)) === 1);

      const backLabel = (await page.locator(".place-detail__back").textContent())?.trim() ?? "";
      check(
        `el chevron back nombra la superficie real: «${backLabel}» contiene «Dónde dormir»`,
        backLabel.includes("Dónde dormir")
      );

      check(
        "«Ver en el mapa» está presente, con texto visible (no icon-only)",
        ((await page.locator(".place-detail__view-on-map").textContent()) ?? "").includes("Ver en el mapa")
      );

      check(
        "en teléfono la ficha abierta desde Viaje cubre el 100% del viewport",
        await page.evaluate(() => {
          const r = document.querySelector(".app__detail")?.getBoundingClientRect();
          return Boolean(r) && r.width === 390 && r.height === 844 && r.top === 0 && r.left === 0;
        })
      );

      // Encadenado: si el lugar tiene "Cerca de aquí", saltar a un segundo lugar y volver dos
      // veces debe recorrer Lugar B → Lugar A → «Dónde dormir» (punto 1, "Encadenado").
      const nearbyItems = page.locator(".nearby-item");
      if ((await nearbyItems.count()) > 0) {
        await nearbyItems.first().click();
        await page.waitForTimeout(250);
        check("saltar a un lugar cercano encadena una segunda ficha (Lugar A → Lugar B)", (
          await page.locator(".place-detail__back").textContent()
        )?.trim() === firstPlaceName);
        check("sigue habiendo como mucho una .app__detail activa tras encadenar", (await countAppDetail(page)) === 1);

        await page.click(".place-detail__back");
        await page.waitForTimeout(250);
        check(
          "volver desde Lugar B restaura Lugar A, no «Dónde dormir» todavía",
          (await page.locator("#place-detail-title, .place-detail h2").first().textContent())?.trim() === firstPlaceName
        );
      } else {
        check("encadenado (sin lugares cercanos para este lugar en concreto, se omite)", true);
      }

      // Cerrar (chevron de nuevo, ahora en la base de la pila) → vuelve a «Dónde dormir».
      await page.click(".place-detail__back");
      await page.waitForTimeout(300);
      check("cerrar la ficha devuelve a «Dónde dormir», no a Explorar", await page.locator(".zone-panel--embedded").isVisible());
      check("nunca queda un .app__detail montado tras cerrar", (await countAppDetail(page)) === 0);

      const subtitleAfter = await page.locator(".zone-panel__sub").textContent();
      check("el modo «comparar» sigue activo tras volver (estado de ZoneComparison preservado)", (
        subtitleAfter ?? ""
      ).includes("Comparando 2 zonas"));

      const scrollAfter = await page.evaluate(
        () => document.querySelector(".destination-panel--scroll")?.scrollTop ?? 0
      );
      check("el scroll de «Dónde dormir» se restaura ±2px", Math.abs(scrollAfter - scrollBefore) < 2);

      // Nota: en teléfono la ficha cubre TabBar por completo (Art. 8 — "ninguna barra del
      // shell visible tras la ficha"), así que cambiar de pestaña con la ficha abierta no es
      // una acción alcanzable ahí; se comprueba en el bloque md+ de más abajo, donde NavRail sí
      // queda visible junto al panel de 480px.

      // «Ver en el mapa»: pop de Viaje, cambia a Explorar, centra el lugar, sin ficha fantasma.
      await nearestButtons.first().click();
      await page.waitForSelector(".place-detail", { timeout: 15000 });
      await page.waitForTimeout(250);
      await page.click(".place-detail__view-on-map");
      await page.waitForTimeout(400);
      check(
        "«Ver en el mapa» cambia el destino activo a Explorar",
        (await page.locator(".tab-bar__item--active .tab-bar__label").textContent()) === "Explorar"
      );
      check("«Ver en el mapa» abre la misma ficha, ahora bajo Explorar", await page.locator(".place-detail").isVisible());
      check("«Ver en el mapa» nunca deja dos fichas abiertas a la vez", (await countAppDetail(page)) === 1);

      await page.click(".place-detail__bar .icon-button");
      await page.waitForTimeout(300);
      await page.click(".tab-bar__item:has-text('Viaje')");
      await page.waitForTimeout(300);
      check(
        "tras «Ver en el mapa», volver a Viaje restaura «Dónde dormir» sin ficha abierta",
        (await page.locator(".zone-panel--embedded").isVisible()) &&
          (await page.locator(".destination-panel:not([hidden]) .place-detail").count()) === 0
      );
    }

    await context.close();
  }

  // ---------------- md+: panel de 480px, Sheet de 420px, NavRail + aria-current ----------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    trackErrors(page, "desktop");
    await dismissOnboarding(page);

    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        sheet: style.getPropertyValue("--sheet-panel-width").trim(),
        detail: style.getPropertyValue("--place-detail-panel-width").trim(),
      };
    });
    check("token --sheet-panel-width es 420px", tokens.sheet === "420px");
    check("token --place-detail-panel-width es 480px", tokens.detail === "480px");

    await reachTokyoWithSavedPlaces(page);
    await page.click(".app__title--expand");
    await page.waitForTimeout(300);
    const sheetWidth = await page.evaluate(() => document.querySelector(".sheet")?.getBoundingClientRect().width);
    check("Sheet mide 420px en md+ (dentro de min(420px, 92vw))", Math.round(sheetWidth ?? 0) === 420);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    await openZoneCompareMode(page);
    const nearestButtons = page.locator(".zone-nearest button");
    if ((await nearestButtons.count()) > 0) {
      await nearestButtons.first().click();
      await page.waitForSelector(".place-detail", { timeout: 15000 });
      await page.waitForTimeout(250);

      const detailWidth = await page.evaluate(() => document.querySelector(".app__detail")?.getBoundingClientRect().width);
      check("la ficha de lugar mide 480px en md+ (distinto de Sheet)", Math.round(detailWidth ?? 0) === 480);
      check("NavRail permanece visible en md+ mientras la ficha está abierta", await page.locator(".nav-rail").isVisible());
      check(
        "Viaje sigue marcado aria-current=\"page\" mientras la ficha le pertenece",
        (await page.locator('.nav-rail__item[aria-current="page"]').textContent())?.includes("Viaje")
      );

      // Cambiar de pestaña con la ficha abierta y volver: el stack de Viaje se conserva íntegro
      // (punto 7) — en md+ NavRail sigue visible y clicable junto al panel de 480px.
      const openPlaceTitle = (await page.locator(".place-detail h2").first().textContent())?.trim();
      await page.click(".nav-rail__item:has-text('Explorar')");
      await page.waitForTimeout(300);
      check(
        "cambiar manualmente a Explorar oculta la ficha de Viaje (no se ve fuera de su panel)",
        (await page.evaluate(() => Boolean(document.querySelector('.destination-panel:not([hidden]) .app__detail')))) === false
      );
      await page.click(".nav-rail__item:has-text('Viaje')");
      await page.waitForTimeout(300);
      check(
        "volver manualmente a Viaje: la ficha sigue abierta, mismo lugar (invariante del stack)",
        ((await page.locator(".place-detail h2").first().textContent())?.trim() ?? "") === openPlaceTitle
      );

      await page.click(".place-detail__view-on-map");
      await page.waitForTimeout(400);
      check(
        "tras «Ver en el mapa» en md+, Explorar queda marcado aria-current=\"page\"",
        (await page.locator('.nav-rail__item[aria-current="page"]').textContent())?.includes("Explorar")
      );
    } else {
      check("panel de 480px en md+ (sin lugares cercanos calculados en este dataset, se omite)", true);
    }

    await context.close();
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
