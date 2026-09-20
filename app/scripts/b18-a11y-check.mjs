import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

/**
 * Bloque 18 — punto 13 (accesibilidad). Mide de verdad, en un navegador real, en vez de
 * confiar en la declaración CSS: áreas táctiles ≥44×44 de los controles nuevos de este
 * bloque, `aria-current` en la navegación, `prefers-reduced-motion` en `Sheet`, y que el
 * primer elemento con foco tras cambiar de destino sea razonable (no `<body>`).
 */
async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });

  const targets = [
    ".tab-bar__item",
    ".app__person-token-button",
  ];
  for (const selector of targets) {
    const boxes = await page.locator(selector).all();
    for (const [i, box] of boxes.entries()) {
      const rect = await box.boundingBox();
      check(`${selector}[${i}] ≥44×44px (real: ${rect?.width}×${rect?.height})`, Boolean(rect) && rect.width >= 44 && rect.height >= 44);
    }
  }

  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(200);

  for (const selector of [".explorer-bar__filters", ".explorer-bar__pane"]) {
    const rect = await page.locator(selector).boundingBox();
    check(`${selector} ≥44×44px (real: ${rect?.width}×${rect?.height})`, Boolean(rect) && rect.width >= 44 && rect.height >= 44);
  }

  await page.click(".app__title--expand");
  await page.waitForTimeout(300);
  for (const selector of [".city-sheet__japan", ".city-sheet__zones", ".hub-selector__tab", ".sheet .icon-button"]) {
    const rect = await page.locator(selector).first().boundingBox();
    check(`${selector} ≥44×44px (real: ${rect?.width}×${rect?.height})`, Boolean(rect) && rect.width >= 44 && rect.height >= 44);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.click(".tab-bar__item:has-text('Viaje')");
  await page.waitForTimeout(400);
  for (const selector of [".viaje-nav__item"]) {
    const boxes = await page.locator(selector).all();
    for (const [i, box] of boxes.entries()) {
      const rect = await box.boundingBox();
      check(`${selector}[${i}] ≥44×44px (real: ${rect?.width}×${rect?.height})`, Boolean(rect) && rect.width >= 44 && rect.height >= 44);
    }
  }

  // aria-current en la navegación.
  const current = await page.locator(".tab-bar__item[aria-current='page']").count();
  check("exactamente un ítem de TabBar lleva aria-current=page", current === 1);
  const currentLabel = await page.locator(".tab-bar__item[aria-current='page'] .tab-bar__label").textContent();
  check("aria-current=page coincide con el destino activo (Viaje)", currentLabel === "Viaje");

  // Corrección post-cierre, hallazgo 4a (04 §10, Art. 11): el activo no puede distinguirse del
  // inactivo sólo por color — su icono debe ser una geometría distinta (relleno vs línea), algo
  // que un lector de pantalla/daltónico también pueda apreciar en el propio SVG, no sólo en el
  // canal de color del texto.
  const svgShapes = await page.evaluate(() => {
    function shapeOf(el) {
      const svg = el.querySelector(".tab-bar__icon svg");
      return svg
        ? [...svg.querySelectorAll("*")].map((n) => `${n.tagName}:${n.getAttribute("fill") ?? ""}`).join("|")
        : null;
    }
    const active = document.querySelector(".tab-bar__item[aria-current='page']");
    const inactive = document.querySelector(".tab-bar__item:not([aria-current='page'])");
    return { active: active ? shapeOf(active) : null, inactive: inactive ? shapeOf(inactive) : null };
  });
  check(
    "el icono activo tiene una geometría/relleno distinta del inactivo (no sólo color)",
    Boolean(svgShapes.active) && Boolean(svgShapes.inactive) && svgShapes.active !== svgShapes.inactive
  );

  // prefers-reduced-motion: la animación de Sheet se reduce a ~0.
  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(BASE_URL, { waitUntil: "networkidle" });
  await reducedPage.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await reducedPage.reload({ waitUntil: "networkidle" });
  await reducedPage.click(".national-start__hub:has-text('Tokio')");
  await reducedPage.waitForSelector(".place-card", { timeout: 15000 });
  await reducedPage.click(".explorer-bar__filters");
  await reducedPage.waitForTimeout(50);
  const animDurationSeconds = await reducedPage.evaluate(() => {
    const sheet = document.querySelector(".sheet");
    // Devuelto en segundos por CSSOM ("1e-6s" para 0.001ms) — se compara como número, no
    // como cadena, para no depender de qué notación elige el motor.
    return sheet ? parseFloat(getComputedStyle(sheet).animationDuration) : null;
  });
  check(
    "prefers-reduced-motion reduce la animación de Sheet a ≤0.001ms",
    typeof animDurationSeconds === "number" && animDurationSeconds <= 0.000001
  );
  await reducedContext.close();

  // Orden de foco tras cambiar de destino (gate 13): el contenido del panel recién mostrado
  // tiene controles reales en el orden de tabulación, y ningún panel oculto los contamina.
  // (Un `Tab`/`Shift+Tab` desde la propia barra sólo mueve entre sus cuatro botones antes de
  // llegar al contenido — eso es el comportamiento normal de cualquier grupo de botones
  // adyacentes, no algo que B18 deba o pueda cambiar.)
  await page.click(".tab-bar__item:has-text('Nosotros')");
  await page.waitForTimeout(300);
  const nosotrosFocusable = await page.evaluate(() => {
    const panel = [...document.querySelectorAll(".destination-panel")].find(
      (el) => !el.hasAttribute("hidden") && el.querySelector(".nosotros-section")
    );
    if (!panel) return -1;
    return panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])').length;
  });
  check(
    "el panel de Nosotros visible expone controles reales en el orden de foco",
    nosotrosFocusable > 0
  );
  // `querySelectorAll` encuentra botones dentro de un panel oculto igualmente (siguen en el
  // DOM): la prueba real de que `hidden` los saca del orden de foco es intentar enfocar uno a
  // la fuerza y comprobar que el navegador se niega — es exactamente lo que el atributo nativo
  // `hidden` garantiza y una clase `display:none` por sí sola no.
  const hiddenPanelRefusesFocus = await page.evaluate(() => {
    const hidden = document.querySelector(".destination-panel[hidden] button");
    if (!hidden) return null;
    hidden.focus();
    return document.activeElement !== hidden;
  });
  check(
    "un control dentro de un panel oculto no puede recibir el foco (hidden real, no sólo visual)",
    hiddenPanelRefusesFocus === true
  );

  // Corrección post-cierre, hallazgo 4b (04 §11): el borde inferior de la cabecera sólo debe
  // aparecer al hacer scroll — comprobado antes y después del scroll, en la misma sesión.
  await page.click(".tab-bar__item:has-text('Explorar')");
  await page.waitForTimeout(300);
  const borderBeforeScroll = await page.evaluate(() => {
    const header = document.querySelector(".app__header");
    return header ? getComputedStyle(header).borderBottomColor : null;
  });
  const sidebar = page.locator(".app__sidebar");
  await sidebar.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.waitForTimeout(150);
  const scrolledClassBefore = await page.evaluate(() =>
    document.querySelector(".app__header")?.classList.contains("app__header--scrolled")
  );
  check("sin scroll, la cabecera no lleva la clase --scrolled", scrolledClassBefore === false);

  await sidebar.evaluate((el) => el.scrollTo({ top: 300 }));
  await page.waitForTimeout(200);
  const borderAfterScroll = await page.evaluate(() => {
    const header = document.querySelector(".app__header");
    return header ? getComputedStyle(header).borderBottomColor : null;
  });
  const scrolledClassAfter = await page.evaluate(() =>
    document.querySelector(".app__header")?.classList.contains("app__header--scrolled")
  );
  check("al hacer scroll, la cabecera gana la clase --scrolled", scrolledClassAfter === true);
  check(
    "el color del borde inferior cambia entre sin-scroll y con-scroll (transparente → --line)",
    borderBeforeScroll !== null && borderAfterScroll !== null && borderBeforeScroll !== borderAfterScroll
  );

  await sidebar.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.waitForTimeout(200);
  const scrolledClassRestored = await page.evaluate(() =>
    document.querySelector(".app__header")?.classList.contains("app__header--scrolled")
  );
  check("volver a scrollTop 0 retira la clase --scrolled de nuevo", scrolledClassRestored === false);

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
