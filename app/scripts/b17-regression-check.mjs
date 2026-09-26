import { chromium } from "playwright";

/**
 * B17 — regresión de capacidades contra un build real.
 *
 * **Qué protege** (gate G2 de `08`, «sin regresión de capacidades»): que las capacidades que
 * v1.1.0 ya tenía sigan alcanzables después de cada bloque de rediseño. No comprueba aspecto:
 * comprueba que un lector puede todavía hacer cada cosa.
 *
 * **Por qué se reescribió (2026-09-21).** El guion original conducía la aplicación por el cromo
 * anterior a B18: `.view-bar__filters`, `.view-switch__option`, `.app__backup`, una
 * `TravellerBar` dentro de Explorar. B18 sustituyó ese cromo por cuatro destinos permanentes
 * (`02 §D2`) con una barra única en Explorar (`05 §4`), y B19 convirtió la búsqueda en una hoja
 * (`04 §12`). El gate llevaba desde entonces fallando en su primer `click`, sin haber
 * comprobado ni una sola capacidad — un gate que no llega a ejecutarse no protege nada.
 *
 * **El requisito no cambió; el camino sí.** Cada comprobación de aquí es la misma de antes,
 * expresada ahora contra el shell vigente y, donde se puede, **por rol y nombre accesible** en
 * vez de por clase interna: así sobrevive al siguiente rediseño visual, que es justo lo que un
 * gate de regresión de capacidades tiene que hacer.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

const consoleErrors = [];
const pageErrors = [];

function trackErrors(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageErrors.push(`[${label}] ${err.message}`));
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  trackErrors(page, "app");

  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  /** Los cuatro destinos de `02 §D2` se alcanzan por su nombre, no por su clase. */
  const goTo = async (name) => {
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name }).click();
    await page.waitForTimeout(300);
  };

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });

  // ---------- Explorar: entrar a una ciudad ----------
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  const initialCards = await page.locator(".place-card").count();
  check("explorar lugares (lista de Tokio)", initialCards > 0);

  // ---------- Búsqueda por texto ----------
  // B19 (`04 §12`): «Buscar en {ciudad}» abre una hoja casi a pantalla completa en vez de
  // filtrar en el sitio. La capacidad —encontrar un lugar escribiendo su nombre— es la misma.
  await page.getByRole("button", { name: /^Buscar en Tokio/ }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  check("la búsqueda abre su propia superficie", await page.locator(".search-sheet").isVisible());
  await page.locator(".search-sheet .search-field__input").fill("Shibuya Crossing");
  await page.waitForTimeout(500);
  const hits = await page.locator(".search-sheet .place-card").count();
  check("búsqueda por texto acota los resultados", hits >= 1 && hits < 10);
  // B19 deliberadamente CONSERVA el término al cerrar la hoja: la barra lo muestra en vez del
  // texto de sugerencia («Buscar en Tokio»), para que nadie se quede con una lista acotada sin
  // saber por qué. Lo que devuelve la lista completa es borrar la búsqueda, no cerrar la hoja.
  await page.getByRole("button", { name: "Borrar búsqueda" }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("borrar la búsqueda devuelve la lista completa", (await page.locator(".place-card").count()) === initialCards);

  // ---------- Filtros ----------
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(400);
  const filterSheetOpen = await page.locator(".sheet .filter-panel").isVisible().catch(() => false);
  check("hoja de filtros abre", filterSheetOpen);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ---------- Mapa ----------
  // B18: el conmutador Lista/Mapa sustituye al `view-switch` de v1.1.0 por debajo de `lg`.
  await page.getByRole("button", { name: "Mapa" }).click();
  await page.waitForTimeout(500);
  check("cambiar a vista de mapa", await page.locator(".leaflet-container").isVisible().catch(() => false));
  await page.getByRole("button", { name: "Lista" }).click();
  await page.waitForTimeout(400);

  // ---------- Ficha: abrir, galería, lightbox ----------
  await page.locator(".place-card__open").first().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  check("abrir ficha de lugar", await page.locator(".place-detail").isVisible());

  const galleryZoom = page.locator(".gallery__zoom").first();
  if (await galleryZoom.isVisible().catch(() => false)) {
    await galleryZoom.click();
    await page.waitForTimeout(300);
    check("lightbox abre desde la galería", await page.locator(".lightbox").isVisible().catch(() => false));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape cierra el lightbox", !(await page.locator(".lightbox").isVisible().catch(() => false)));
  } else {
    check("lightbox abre desde la galería (sin foto en este lugar, se omite)", true);
  }

  // ---------- Quiero ir: dos viajeros, marcas independientes ----------
  // La persona activa se cambia ahora en Nosotros › Viajeros (`02 §D4`), no en una barra dentro
  // de Explorar. La capacidad —dos personas que marcan por separado— es la misma. En teléfono la
  // ficha cubre `TabBar` por diseño (`05 §5`), así que cambiar de destino exige cerrarla antes:
  // eso mismo se aprovecha para comprobar que cerrar devuelve a la lista.
  const savedPlaceName = (await page.locator(".place-detail #place-detail-title").innerText()).trim();
  await page.locator(".place-detail .save-button").click();
  await page.waitForTimeout(300);
  check(
    "Persona 1 marca «Quiero ir»",
    await page.locator(".place-detail .save-button--saved").isVisible().catch(() => false)
  );

  const closeDetail = async () => {
    await page.locator(".place-detail__back").click();
    await page.waitForTimeout(400);
  };
  const reopenSavedPlace = async () => {
    await page
      .locator(".place-card:not(.place-card--compact)")
      .filter({ hasText: savedPlaceName })
      .first()
      .locator(".place-card__open")
      .click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(300);
  };

  await closeDetail();
  check("cerrar ficha vuelve a la lista", await page.locator(".place-card").first().isVisible());

  await goTo("Nosotros");
  const travellerOptions = page.locator(".destination-panel:not([hidden]) .traveller-bar__option");
  const travellerCount = await travellerOptions.count();
  check("hay dos viajeros configurados", travellerCount === 2);

  if (travellerCount === 2) {
    await travellerOptions.nth(1).click();
    await page.waitForTimeout(300);
    await goTo("Explorar");
    await reopenSavedPlace();
    check(
      "Persona 2 ve el lugar como no marcado por ella",
      !(await page.locator(".place-detail .save-button--saved").isVisible().catch(() => false))
    );
    await page.locator(".place-detail .save-button").click();
    await page.waitForTimeout(300);
    check(
      "Persona 2 marca «Quiero ir» de forma independiente",
      await page.locator(".place-detail .save-button--saved").isVisible().catch(() => false)
    );
    await closeDetail();
    await goTo("Nosotros");
    await travellerOptions.nth(0).click();
    await page.waitForTimeout(300);
  }

  // ---------- El lugar marcado aparece en «Quiero ir» ----------
  await goTo("Quiero ir");
  await page.waitForTimeout(400);
  const inWantList = await page
    .locator(".destination-panel:not([hidden])")
    .getByText(savedPlaceName, { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  check("el lugar marcado aparece en «Quiero ir»", inWantList);

  // ---------- Respaldo del viaje ----------
  // v1.1.0 lo abría desde un botón del cromo (`.app__backup`); B18 lo asentó en Nosotros ›
  // Copia del viaje, siempre presente en vez de detrás de un icono sin etiqueta.
  await goTo("Nosotros");
  const backupSection = page.getByRole("region", { name: "Copia del viaje" });
  check("respaldo del viaje sigue alcanzable", await backupSection.isVisible().catch(() => false));
  check(
    "el respaldo ofrece exportar e importar",
    (await backupSection.getByRole("button", { name: /Descargar|Exportar/ }).count()) > 0 &&
      (await backupSection.locator("input[type='file']").count()) > 0
  );

  // ---------- Teclado ----------
  await goTo("Explorar");
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  check("navegación por teclado mueve el foco (Tab)", Boolean(focusedTag) && focusedTag !== "BODY");

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors (${consoleErrors.length}):`);
    for (const err of consoleErrors.slice(0, 10)) console.log(` - ${err}`);
  }
  if (pageErrors.length > 0) {
    console.log(`\nPage errors (${pageErrors.length}):`);
    for (const err of pageErrors.slice(0, 10)) console.log(` - ${err}`);
  }
  if (failed.length > 0 || pageErrors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
