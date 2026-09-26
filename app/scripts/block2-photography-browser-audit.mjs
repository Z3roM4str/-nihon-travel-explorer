import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 2 — photographic layer browser audit, against the production build via `vite preview`.
 *
 * It measures the two things Block 2 claims and source-scanning cannot prove: that the card
 * surface really fetches the light rendition rather than the detail hero, and that the carousel
 * — which shipped complete but unreachable at one photograph per place — now actually works on
 * a place that has two.
 *
 * It also re-checks the states a photographic layer can break: a place with no photograph, a
 * failed image load, aspect ratio, and layout shift while images stream in.
 *
 * Usage: node scripts/block2-photography-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 *
 * **Actualizado el 2026-09-21.** Todo lo que este gate mide sigue siendo normativo —las
 * renditions, el presupuesto de bytes, el CLS, el carrusel, el lightbox, la atribución, la
 * miniatura de «Quiero ir»—; lo que cambió fue el camino y una de las expectativas:
 *
 * - `.view-bar__filters` + campo de búsqueda en la barra → B18 dejó una barra única (`05 §4`) y
 *   B19 movió la búsqueda a `SearchSheet` (`04 §12`).
 * - el scroll de la lista se pedía a `.place-list`, que no scrollea: quien scrollea es
 *   `.app__sidebar`. Con `scrollBy` sobre el `<ul>` la carga progresiva no llegaba a dispararse.
 * - `.place-card__placeholder` → `.photo-placeholder` (B19, `04 §9`).
 * - `.selection-panel__toggle` desde Explorar → B18 llevó «Quiero ir» a su propia pestaña.
 * - **la proporción esperada**: ya no es «3:2 en móvil, 16:9 en lo demás» sino la regla de
 *   DD-016 — 4:3 con UNA columna, 16:9 con DOS O MÁS, decidida por el ancho real de la región
 *   de lista y no por el viewport. El gate la deriva contando columnas, como el producto.
 *
 * **Actualizado de nuevo por el Bloque 20 (B4).** El carrusel, el lightbox y la atribución
 * siguen siendo requisitos vigentes; lo que cambió es el contrato de la galería (`04 §6`/`§7`,
 * `05 §5` pt. 1), así que el gate mide el contrato nuevo en vez del viejo:
 *
 * - `.gallery__frame` (una sola imagen en estado) → `.gallery__track`, una pista con
 *   `scroll-snap` donde todas las diapositivas existen.
 * - **las flechas son sólo de `md`+**: siguen en el DOM, pero en teléfono no se ven. El avance
 *   se pide por teclado sobre la pista, que funciona en los tres viewports y es además lo que
 *   comprueba la accesibilidad real del carrusel.
 * - `.gallery__credit` (párrafo de atribución EN EL FLUJO) → botón `ⓘ` + `CreditsSheet`. El
 *   requisito «la atribución existe y nombra la fuente» se conserva palabra por palabra, en su
 *   nuevo sitio; y se añade el que antes no se podía comprobar: que entre la fotografía y el
 *   nombre del lugar no queda ni un carácter de atribución (defecto D2).
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

/** A place Block 2 gave a second facet to, and a place that deliberately has none. */
const GALLERY_PLACE = "Tōdai-ji";
const GALLERY_HUB = "Osaka";

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4319;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  const isMobileLayout = width <= 860;
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(26)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: isMobileLayout,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const images = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on("response", async (r) => {
    if (!/\.webp(\?|$)/.test(r.url())) return;
    try {
      images.push({ name: r.url().split("/").pop(), bytes: (await r.body()).length, status: r.status() });
    } catch {
      /* body already discarded */
    }
  });

  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  // ---- The card list fetches the card rendition ----
  await page.getByRole("button", { name: new RegExp(`^${GALLERY_HUB}`) }).first().click();
  // DDR-MERGE-1 (opción 1): el presupuesto es del HUB, no de la sesión completa. La portada de
  // Explorar (tarjetas de ciudad/colecciones) ya disparó descargas de imagen antes de este click;
  // se descartan aquí para medir sólo el tráfico que pertenece a partir de entrar al hub.
  images.length = 0;
  await page.waitForTimeout(1400);

  // `.app__sidebar` es quien scrollea (`overflow-y: auto`); `.place-list` es el `<ul>` de dentro
  // y `scrollBy` sobre él no hace nada — con el selector anterior la carga progresiva de B19
  // (12 en 12, `05 §4`) no llegaba a dispararse nunca.
  const scroller = ".app__sidebar";
  for (let i = 0; i < 45; i += 1) {
    await page.locator(scroller).evaluate((el) => el.scrollBy(0, 900));
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(1200);

  const listImages = images.filter((i) => i.status === 200);
  const derivatives = listImages.filter((i) => i.name.includes("-800w"));
  const originals = listImages.filter((i) => !i.name.includes("-800w"));
  const totalMiB = listImages.reduce((a, x) => a + x.bytes, 0) / 1048576;
  check("the card list fetched images at all", listImages.length > 10, `${listImages.length}`);
  check("every card image is the card rendition", originals.length === 0, `${originals.length} originals: ${originals.slice(0, 3).map((o) => o.name).join(", ")}`);
  check(
    "a full hub scroll stays well under the pre-Block-2 cost",
    totalMiB < 5,
    `${totalMiB.toFixed(2)} MiB across ${listImages.length} images`
  );
  console.log(`      (${derivatives.length} derivatives, ${totalMiB.toFixed(2)} MiB total)`);

  // ---- Aspect ratio and reserved box ----
  const media = await page.locator(".place-card__media").first().boundingBox();
  const ratio = media ? media.width / media.height : 0;
  // DD-016 / `04 §5.1`: la proporción la decide EL NÚMERO DE COLUMNAS, no el viewport. Se cuenta
  // igual que lo hace el producto — pistas declaradas por la rejilla — en vez de reimplementar
  // aquí una regla de breakpoints que ya no existe.
  const columns = await page
    .locator(".place-list:not(.place-list--compact)")
    .first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
  const expected = columns === 1 ? 4 / 3 : 16 / 9;
  check(
    `card media holds the ratio its column count implies (${columns} col)`,
    Math.abs(ratio - expected) < 0.05,
    `${ratio.toFixed(3)} vs ${expected.toFixed(3)}`
  );
  const declared = await page.locator(".place-card__image").first().evaluate((el) => ({
    w: el.getAttribute("width"),
    h: el.getAttribute("height"),
    sizes: el.getAttribute("sizes"),
  }));
  check("card images declare width, height and sizes", Boolean(declared.w && declared.h && declared.sizes));

  // ---- No layout shift while the list streams in ----
  const shift = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 1200);
      })
  );
  check("cumulative layout shift stays in the 'good' band", shift < 0.1, `CLS ${Number(shift).toFixed(4)}`);

  // ---- A place with no photograph ----
  // B19 (`04 §9`) renombró el marcador editorial a `.photo-placeholder`.
  const placeholders = await page.locator(".photo-placeholder").count();
  check("uncovered places still render the editorial placeholder", placeholders > 0, `${placeholders}`);

  // ---- The carousel, on a place that now has two photographs ----
  // B19 (`04 §12`): la búsqueda es una hoja propia a cualquier ancho — mismo camino en teléfono,
  // tableta y escritorio, que es además el que un lector usa para encontrar un lugar concreto.
  await page.getByRole("button", { name: new RegExp(`^Buscar en ${GALLERY_HUB}`) }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill(GALLERY_PLACE);
  await page.waitForTimeout(700);
  await page.locator(".search-sheet .place-card__open").first().click();
  await page.waitForTimeout(1200);

  check("the gallery reports more than one photograph", (await page.locator(".gallery__counter").count()) === 1);
  const counterBefore = await page.locator(".gallery__counter").innerText();
  check("the counter starts at the first image", counterBefore.trim().startsWith("1 /"), counterBefore);
  check("navigation arrows are present", (await page.locator(".gallery__nav").count()) === 2);
  // `04 §6`: «Flechas sólo en `md`+». En teléfono el gesto es el dedo sobre la pista; dibujar
  // flechas ahí sería cromo que compite con la fotografía.
  const arrowVisible = await page.locator(".gallery__nav--next").isVisible();
  check(
    "arrows show only from md+ (04 §6)",
    arrowVisible === width >= 840,
    `${width}px → ${arrowVisible ? "visible" : "oculta"}`
  );
  const dots = await page.locator(".gallery__dot").count();
  check("one dot per photograph, up to the cap of 5 (04 §6)", dots >= 2 && dots <= 5, `${dots}`);

  const firstSrc = await page.locator(".gallery__image").first().evaluate((el) => el.currentSrc);
  // El avance se pide por teclado sobre la pista: es el único camino disponible en los tres
  // viewports (las flechas son de `md`+) y de paso prueba que el carrusel es operable sin ratón.
  await page.locator(".gallery__track").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);
  const counterAfter = await page.locator(".gallery__counter").innerText();
  const secondSrc = await page
    .locator(".gallery__slide")
    .nth(1)
    .locator(".gallery__image")
    .evaluate((el) => el.currentSrc);
  check("advancing moves the counter", counterAfter.trim().startsWith("2 /"), counterAfter);
  check("advancing actually changes the photograph", firstSrc !== secondSrc);

  // Defecto D2 (`05 §5`, criterio de aceptación): entre la fotografía y el nombre del lugar no
  // puede quedar ni un carácter de atribución. Antes de B20 el párrafo `.gallery__credit` vivía
  // exactamente ahí.
  check(
    "no attribution paragraph is left in the reading flow (D2)",
    (await page.locator(".gallery__credit").count()) === 0
  );

  // Y la atribución sigue existiendo, íntegra, detrás del `ⓘ` (`04 §7`).
  await page.locator(".gallery__credits").click();
  await page.waitForSelector(".credits-sheet__list", { timeout: 10000 });
  const credit = await page.locator(".credits-sheet__list").innerText();
  check("attribution is rendered inside CreditsSheet", credit.trim().length > 10);
  check("attribution names the source", /Commons/i.test(credit));
  check("attribution keeps its licence link", (await page.locator(".credits-sheet__field a").count()) > 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape closes the credits sheet", (await page.locator(".credits-sheet__list").count()) === 0);

  // Keyboard navigation back.
  await page.locator(".gallery__track").focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(900);
  check(
    "keyboard navigation returns to the first photograph",
    (await page.locator(".gallery__counter").innerText()).trim().startsWith("1 /")
  );

  // ---- Lightbox keeps full resolution ----
  // La pista tiene ahora un botón de zoom por diapositiva; el lightbox se abre desde la que
  // está visible, que tras la vuelta por teclado es la primera.
  await page.locator(".gallery__zoom").first().click();
  await page.waitForTimeout(900);
  check("the lightbox opens", (await page.locator(".lightbox").count()) === 1);
  const lightboxSrc = await page.locator(".lightbox__image").evaluate((el) => el.currentSrc);
  check("the lightbox loads the full-resolution original", !lightboxSrc.includes("-800w"), lightboxSrc.split("/").pop());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape closes the lightbox and keeps the detail open", (await page.locator(".lightbox").count()) === 0 && (await page.locator(".place-detail").count()) === 1);

  // ---- Saved list reuses the same rendition ----
  await page.locator(".place-detail .save-button").click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  // B18 (`02 §D2`): «Quiero ir» es una pestaña, no un panel desplegable dentro de Explorar.
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Quiero ir" })
    .click();
  await page.waitForTimeout(600);
  // En su propia pestaña el panel nace abierto (B18); el plegado se conserva por si el lector
  // lo quiere cerrar. Sólo se pulsa el toggle si hace falta — pulsarlo siempre lo cerraría.
  const toggle = page.locator(".destination-panel:not([hidden]) .selection-panel__toggle");
  if ((await toggle.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await toggle.click();
    await page.waitForTimeout(600);
  }
  const thumbSrc = await page.locator(".selection-list__thumb img").first().evaluate((el) => el.currentSrc);
  check("the saved-list thumbnail uses the card rendition", thumbSrc.includes("-800w"), thumbSrc.split("/").pop());

  // ---- Integrity ----
  const broken = images.filter((i) => i.status >= 400);
  check("no image request failed", broken.length === 0, JSON.stringify(broken.slice(0, 3)));
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 2 photography browser audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 2 photography audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
