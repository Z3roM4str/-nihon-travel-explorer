import { chromium } from "playwright";

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

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });

  // Los cuatro destinos permanentes, en teléfono (gate 11 §3).
  const tabCount = await page.locator(".tab-bar__item").count();
  check("hay exactamente cuatro destinos permanentes en TabBar", tabCount === 4);
  const tabLabels = await page.locator(".tab-bar__label").allTextContents();
  check(
    "los cuatro destinos son Explorar/Quiero ir/Viaje/Nosotros, en ese orden",
    JSON.stringify(tabLabels) === JSON.stringify(["Explorar", "Quiero ir", "Viaje", "Nosotros"])
  );

  // No queda el selector permanente «Eres» en la cabecera (gate 11 §9).
  const headerHasEres = await page
    .locator(".app__header:has-text('ERES')")
    .count();
  check("no queda el selector «Eres» en la cabecera", headerHasEres === 0);

  // PersonToken presente en la cabecera (gate 11 §10; el propio toque se comprueba más abajo,
  // una vez que hay una ciudad y una ficha que perder si el destino cambiase por accidente).
  check("PersonToken visible en la cabecera", await page.locator(".app__person-token").isVisible());

  // Explorar: entrar a Japón → Tokio, lista visible.
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  check("explorar lugares (lista de Tokio)", (await page.locator(".place-card").count()) > 0);

  // Búsqueda: el control vive en la barra única, siempre visible (05 §4), pero desde Bloque 19
  // (B3, `04 §12`) ya no filtra en el sitio — abre `SearchSheet` como hoja casi a pantalla
  // completa con resultados en vivo (`PlaceCard compact`).
  await page.click(".explorer-bar__search");
  await page.waitForSelector(".search-sheet", { timeout: 5000 });
  const searchInput = page.locator(".search-sheet .search-field__input");
  await searchInput.fill("Shibuya Crossing");
  await page.waitForTimeout(400);
  const filteredCount = await page.locator(".search-sheet .place-card--compact").count();
  check("búsqueda por texto filtra los resultados de la hoja de búsqueda", filteredCount >= 1 && filteredCount < 10);
  await searchInput.fill("");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("Escape cierra la hoja de búsqueda", !(await page.locator(".search-sheet").isVisible().catch(() => false)));

  // Filtros: ahora una Sheet, no una barra propia.
  await page.click(".explorer-bar__filters");
  await page.waitForTimeout(300);
  check("hoja de filtros abre", await page.locator(".sheet").isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("Escape cierra la hoja de filtros", !(await page.locator(".sheet").isVisible().catch(() => false)));

  // Selector de ciudad (en el título de la cabecera) — sustituye a la barra de hub.
  await page.click(".app__title--expand");
  await page.waitForTimeout(300);
  check("el selector de ciudad abre desde el título", await page.locator(".city-sheet").isVisible());
  check(
    "el selector de ciudad ofrece «Dónde dormir en Tokio»",
    await page.locator(".city-sheet__zones").isVisible()
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Mapa/Lista: ahora un solo botón que alterna etiqueta.
  await page.click(".explorer-bar__pane");
  await page.waitForTimeout(400);
  check("cambiar a vista de mapa", await page.locator(".leaflet-container").isVisible());
  await page.click(".explorer-bar__pane");
  await page.waitForTimeout(300);

  // Ficha: pantalla completa, sin cromo del shell detrás (Art. 8, gate 11 §8).
  // Guardamos la posición de scroll de la lista antes de abrir un lugar.
  await page.evaluate(() => {
    document.querySelector(".app__sidebar")?.scrollTo({ top: 260 });
  });
  await page.waitForTimeout(150);
  const scrollBefore = await page.evaluate(() => document.querySelector(".app__sidebar")?.scrollTop ?? 0);
  // Bloque 19 (B3): las tarjetas nuevas (foto+overlay+cuerpo, `04 §5`) son más altas que las de
  // B1 — a 260px de scroll, la PRIMERA tarjeta ya no cabe entera en el viewport de
  // `.app__sidebar`, así que Playwright la desplaza de vuelta a la vista antes de poder pulsarla
  // (`scrollIntoViewIfNeeded`, parte de su comprobación de "accionable" antes de cualquier
  // click) — un artefacto de qué tarjeta se elige para la prueba, no del propio scroll real de
  // un lector (que nunca pulsa algo que no ve). Se elige la primera tarjeta que sigue
  // COMPLETAMENTE dentro del viewport visible tras el scroll, como haría una persona real.
  const inViewCard = await page.evaluateHandle(() => {
    const sidebar = document.querySelector(".app__sidebar");
    const sRect = sidebar.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".place-card__open")];
    return cards.find((c) => {
      const r = c.getBoundingClientRect();
      return r.top >= sRect.top && r.bottom <= sRect.bottom;
    });
  });
  await inViewCard.asElement().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(200);
  check("abrir ficha de lugar", await page.locator(".place-detail").isVisible());
  const fichaRect = await page.evaluate(() => {
    const r = document.querySelector(".app__detail").getBoundingClientRect();
    return { w: r.width, h: r.height, top: r.top, left: r.left };
  });
  check(
    "en teléfono la ficha cubre el 100% del viewport",
    fichaRect.w === 390 && fichaRect.h === 844 && fichaRect.top === 0 && fichaRect.left === 0
  );
  // `isVisible()` no basta: la cabecera y `TabBar` siguen en el DOM (nunca se desmontan, para
  // conservar el estado de las demás pestañas), así que la prueba real es de ocupación visual —
  // qué elemento resuelve un punto físico dentro de sus cajas mientras la ficha está abierta.
  const shellOccluded = await page.evaluate(() => {
    const header = document.querySelector(".app__header");
    const tabBar = document.querySelector(".tab-bar");
    const detail = document.querySelector(".app__detail");
    if (!header || !tabBar || !detail) return false;
    const hRect = header.getBoundingClientRect();
    const tRect = tabBar.getBoundingClientRect();
    const atHeader = document.elementFromPoint(hRect.left + hRect.width / 2, hRect.top + hRect.height / 2);
    const atTabBar = document.elementFromPoint(tRect.left + tRect.width / 2, tRect.top + tRect.height / 2);
    return detail.contains(atHeader) && detail.contains(atTabBar);
  });
  check("ninguna barra del shell (cabecera/TabBar) es visible tras la ficha", shellOccluded);

  const galleryZoom = page.locator(".gallery__zoom").first();
  if (await galleryZoom.isVisible().catch(() => false)) {
    await galleryZoom.click();
    await page.waitForTimeout(300);
    check("lightbox abre desde la galería", await page.locator(".lightbox").isVisible().catch(() => false));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check(
      "Escape cierra el lightbox",
      !(await page.locator(".lightbox").isVisible().catch(() => false))
    );
  } else {
    check("lightbox abre desde la galería (sin foto en este lugar, se omite)", true);
  }

  await page.locator(".place-detail__back").click();
  await page.waitForTimeout(300);
  check("cerrar ficha vuelve a la lista", await page.locator(".place-card").first().isVisible());
  const scrollAfter = await page.evaluate(() => document.querySelector(".app__sidebar")?.scrollTop ?? 0);
  check(
    "volver desde la ficha restaura la posición de scroll de Explorar (gate 11 §7)",
    Math.abs(scrollAfter - scrollBefore) < 2
  );

  // Guardar en Quiero ir y comprobar el contador de TabBar (Art. 6, gate 11 §3). Se guardan dos
  // lugares — el segundo hace falta más abajo para que el planificador ofrezca "Comparar otro
  // orden" (routePlaces.length >= 2).
  await page.locator(".place-card__save").nth(0).click();
  await page.waitForTimeout(200);
  await page.locator(".place-card__save").nth(1).click();
  await page.waitForTimeout(300);
  check(
    "el contador de «Quiero ir» aparece en TabBar tras guardar",
    await page.locator(".tab-bar__badge").isVisible()
  );

  // Cambiar de destino y volver conserva el estado (gate 11 §6): mobilePane sigue en "mapa".
  await page.click(".explorer-bar__pane");
  await page.waitForTimeout(300);
  await page.click(".tab-bar__item:has-text('Quiero ir')");
  await page.waitForTimeout(300);
  check(
    "«Quiero ir» muestra el lugar guardado como contenido de la pestaña, no un cajón",
    await page.locator(".selection-panel__content").isVisible()
  );

  // Corrección post-cierre, hallazgo 1: abrir un lugar desde Quiero ir abre la misma ficha SIN
  // navegar a Explorar (02 §"Mapa completo de pantallas": "Quiero ir └── Lugar · misma ficha
  // que en Explorar"; 02 §D3: "la profundidad se apila dentro de una pestaña"). Se comprueba
  // scroll, filtros/segmentos (aquí: qué lugar aparece primero en la lista) y que el destino
  // activo no cambia — todo debe seguir igual al volver.
  await page.evaluate(() => document.querySelector(".destination-panel--scroll")?.scrollTo({ top: 40 }));
  await page.waitForTimeout(150);
  const quieroIrScrollBefore = await page.evaluate(
    () => document.querySelector(".destination-panel--scroll")?.scrollTop ?? 0
  );
  await page.click(".selection-list__name");
  await page.waitForTimeout(400);
  check("abrir un lugar desde Quiero ir abre la ficha", await page.locator(".place-detail").isVisible());
  const activeDestinationWhileFichaOpen = await page
    .locator(".tab-bar__item--active .tab-bar__label")
    .textContent();
  check(
    "el destino activo sigue siendo Quiero ir mientras la ficha (abierta desde ahí) está abierta",
    activeDestinationWhileFichaOpen === "Quiero ir"
  );
  check(
    "la ficha abierta desde Quiero ir también cubre el shell por completo en teléfono",
    (await page.evaluate(() => {
      const detail = document.querySelector(".app__detail");
      const rect = detail?.getBoundingClientRect();
      return rect ? rect.width === 390 && rect.height === 844 : false;
    }))
  );
  await page.locator(".place-detail__back").click();
  await page.waitForTimeout(400);
  check(
    "cerrar la ficha abierta desde Quiero ir vuelve a Quiero ir, no a Explorar",
    await page.locator(".selection-panel").isVisible()
  );
  const quieroIrScrollAfter = await page.evaluate(
    () => document.querySelector(".destination-panel--scroll")?.scrollTop ?? 0
  );
  check(
    "Quiero ir → Lugar → volver conserva el scroll de Quiero ir",
    Math.abs(quieroIrScrollAfter - quieroIrScrollBefore) < 2
  );

  await page.click(".tab-bar__item:has-text('Explorar')");
  await page.waitForTimeout(400);
  check(
    "volver a Explorar conserva la vista de mapa elegida antes de cambiar de pestaña",
    await page.locator(".leaflet-container").isVisible()
  );

  // Viaje: planificador y zonas como contenido, no overlays globales (gate 11 §11).
  await page.click(".tab-bar__item:has-text('Viaje')");
  await page.waitForTimeout(400);
  check(
    "el planificador vive dentro de la pestaña Viaje, no en un overlay con scrim",
    (await page.locator(".analysis-overlay").count()) === 0 &&
      (await page.locator(".sequence-empty, .analysis-dialog--embedded").count()) > 0
  );

  // Corrección post-cierre, hallazgo 2: el handoff original afirmaba que los cuatro destinos
  // permanecen montados, pero el planificador se desmontaba de verdad al salir de Viaje. Se
  // cambia un estado local propio del planificador (`view`, interno a OrderedSequenceBuilder,
  // nunca persistido en storage — a diferencia del propio recorrido) entrando en "Comparar otro
  // orden", se navega a otra pestaña y se vuelve, y se comprueba que sigue exactamente en ese
  // estado: si el componente se hubiera desmontado, `view` habría vuelto a su valor inicial
  // ("builder"/"Construir recorrido").
  const compareToggle = page.locator(".sequence-compare-toggle:has-text('Comparar otro orden')");
  check("hay al menos 2 lugares en el recorrido (necesario para comparar)", await compareToggle.isVisible());
  await compareToggle.click();
  await page.waitForTimeout(300);
  check(
    "entrar en «Comparar otro orden» cambia el estado local del planificador",
    (await page.locator("#sequence-builder-title").textContent()) === "Comparar órdenes"
  );
  await page.click(".tab-bar__item:has-text('Nosotros')");
  await page.waitForTimeout(300);
  await page.click(".tab-bar__item:has-text('Viaje')");
  await page.waitForTimeout(300);
  check(
    "el estado local del planificador (vista «Comparar órdenes») sobrevive a cambiar de pestaña y volver",
    (await page.locator("#sequence-builder-title").textContent()) === "Comparar órdenes"
  );
  await page.click(".link-button.sequence-back");
  await page.waitForTimeout(300);

  await page.click(".viaje-nav__item:has-text('Dónde dormir')");
  await page.waitForTimeout(500);
  check(
    "la comparación de zonas vive dentro de la pestaña Viaje, no en un overlay",
    (await page.locator(".zone-panel--embedded").count()) > 0
  );

  // Nosotros: viajeros, respaldo y fuentes como contenido, no modales (gate 11 §11/§12).
  // Se llega tocando el PersonToken de la cabecera (D4, gate 11 §10), no la pestaña.
  await page.click(".app__person-token-button");
  await page.waitForTimeout(300);
  check(
    "tocar el PersonToken lleva a Nosotros › Viajeros",
    await page.locator(".nosotros-section:has-text('Viajeros')").isVisible()
  );
  const travellerOptions = page.locator(".traveller-bar__option");
  check("hay dos viajeros configurados, alcanzables desde Nosotros", (await travellerOptions.count()) === 2);
  check(
    "el gestor de viajeros vive en Nosotros sin scrim ni role=dialog",
    (await page.locator(".traveller-manager").count()) === 0 &&
      (await page.locator(".traveller-manager__dialog--embedded").count()) === 1
  );
  check(
    "el respaldo del viaje vive en Nosotros sin scrim ni role=dialog",
    (await page.locator(".trip-backup").count()) === 0 &&
      (await page.locator(".trip-backup__dialog--embedded").count()) === 1
  );
  check(
    "la atribución MLIT sigue íntegra, ahora en Nosotros › Fuentes y licencias",
    (await page.locator(".nosotros-section:has-text('Fuentes y licencias') a[href*='mlit.go.jp']").count()) === 1
  );

  await travellerOptions.nth(1).click();
  await page.waitForTimeout(200);
  check("cambiar de persona activa funciona desde Nosotros", await travellerOptions.nth(1).getAttribute("aria-pressed").then((v) => v === "true"));
  await travellerOptions.nth(0).click();
  await page.waitForTimeout(200);

  // MLIT sigue accesible desde el mapa nacional, vía ⓘ (gate 11 §12).
  await page.click(".tab-bar__item:has-text('Explorar')");
  await page.waitForTimeout(300);
  await page.click(".app__title--expand");
  await page.waitForTimeout(200);
  await page.click(".city-sheet__japan");
  // B21 devuelve primero a la portada; el mapa nacional se abre desde su tarjeta.
  await page.locator(".explorer-home__map-card").click();
  await page.waitForTimeout(500);
  await page.click(".national__attribution-button");
  await page.waitForTimeout(300);
  check(
    "el aviso MLIT sigue accesible desde el propio mapa nacional",
    (await page.locator(".sheet:has-text('MLIT')").count()) > 0
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Teclado: Tab mueve el foco.
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  check("navegación por teclado mueve el foco (Tab)", Boolean(focusedTag) && focusedTag !== "BODY");

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
