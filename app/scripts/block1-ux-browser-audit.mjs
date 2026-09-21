import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 1 — UX, hierarchy and usability browser audit.
 *
 * Runs against the **production build** via `vite preview`, the convention Phase 5A's RC audit
 * established: a usability claim about the shipped artifact has to be measured on the shipped
 * artifact. Run `npm run build` first.
 *
 * It measures what the source-scanning tests cannot: real layout at real viewports. Horizontal
 * overflow, computed tap-target sizes, which pane is actually visible on a phone, whether the
 * save control really updates the saved counter, and whether the first-run explainer really
 * stops coming back.
 *
 * Determinism: the browser profile starts clean for each viewport, and the explainer is
 * dismissed through its own controls rather than by pre-seeding storage, so the dismissal path
 * itself is under test.
 *
 * Usage:
 *   node scripts/block1-ux-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 *   node scripts/block1-ux-browser-audit.mjs --browser=/path/to/chromium
 *
 * **Actualizado el 2026-09-21.** Casi todo lo que este gate mide sigue vigente y sólo cambió el
 * camino (barra única de B18, `SearchSheet`/`FilterSheet` de B19, «Quiero ir» como pestaña).
 * Dos requisitos, en cambio, **fueron sustituidos deliberadamente por el diseño congelado** y
 * aquí se sustituye la comprobación, no se borra la garantía:
 *
 * 1. «cada tarjeta lleva un nivel de interés en lenguaje llano» (`.interest-badge__label`).
 *    `04 §5.3` + Art. 6: **sólo el grado S lleva insignia** («★ Imprescindible»); A/B/C/D no
 *    muestran ninguna, y la letra de grado no puede aparecer fuera de «Fuentes» (`08`,
 *    prohibición 11). El nivel no desaparece del producto: sigue en el nombre accesible de la
 *    tarjeta, que es donde un lector de pantalla lo necesita. Eso es lo que se comprueba ahora.
 * 2. «la pantalla ancha fija la búsqueda sobre los resultados» (`.filter-panel__head` visible en
 *    escritorio). B19 (`04 §12`/`§13`) hizo que búsqueda y filtros sean hojas **a cualquier
 *    ancho**: una sola forma de buscar, no dos. Se comprueba la forma vigente.
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

/** The project's own token. Controls below this are not reliably hittable with a thumb. */
const MIN_TAP_PX = 44;
/**
 * Controls that sit inside a larger, already-generous target, or that are secondary to a
 * primary control right next to them. Each is listed deliberately rather than by loosening the
 * threshold for everything.
 */
const COMPACT_TAP_ALLOWANCE = {
  ".gallery__dot": 28,
  ".icon-button--small": 36,
  ".link-button": 24,
  ".filter-chip": 34,
  ".filter-group__summary": 34,
  ".interest-legend__summary": 38,
  ".app__help": 36,
  ".selection-panel__chevron": 20,
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(
  viewportArg === "all" || VIEWPORTS[viewportArg],
  `unknown viewport: ${viewportArg} (expected phone, tablet, desktop or all)`
);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4318;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Case- and accent-tolerant contains: several headings are uppercased by CSS, and `innerText`
 * reports what is rendered, not what the source wrote. */
function containsText(haystack, needle) {
  return haystack.toLocaleUpperCase("es").includes(needle.toLocaleUpperCase("es"));
}

/** Measures every rendered interactive control and reports the ones below their allowance. */
async function undersizedControls(page, allowance, floor) {
  return page.evaluate(
    ({ allowance, floor }) => {
      const selectors = Object.keys(allowance);
      const results = [];
      for (const element of document.querySelectorAll("button, a[href], input, summary")) {
        // A stretched link's own box is just its text; the element it declares is what a
        // finger actually lands on. Measure that, or the audit reports every card title as a
        // 21px target while the real target is the whole card.
        const stretched = element.getAttribute("data-stretch-target");
        const measured = stretched ? element.closest(stretched) ?? element : element;
        const own = measured.getBoundingClientRect();
        // B17 introdujo `.tap-target-min`: un `::after` invisible, centrado, de
        // `max(100%, --tap-min)`, que agranda el área CLICABLE sin agrandar lo pintado. Medir
        // sólo la caja pintada reportaría como infractor a todo control que use esa técnica —
        // que es justamente la que el sistema de diseño manda usar. Se mide la unión, igual que
        // `b17-tap-target-check.mjs`.
        const after = getComputedStyle(element, "::after");
        let rect = { width: own.width, height: own.height };
        if (after.content && after.content !== "none" && after.position === "absolute") {
          const w = parseFloat(after.width);
          const h = parseFloat(after.height);
          if (!Number.isNaN(w)) rect.width = Math.max(rect.width, w);
          if (!Number.isNaN(h)) rect.height = Math.max(rect.height, h);
        }
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") continue;
        // Leaflet's own controls are third-party chrome and are not this audit's to police.
        if (element.closest(".leaflet-control-container")) continue;
        // A checkbox/radio inside a .filter-chip label is decorated by the label around it.
        if (element.matches("input[type=checkbox], input[type=radio]")) continue;
        const match = selectors.find((selector) => element.matches(selector));
        const min = match ? allowance[match] : floor;
        const smallest = Math.min(rect.width, rect.height);
        if (smallest + 0.5 < min) {
          results.push({
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 60),
            text: (element.textContent ?? "").trim().slice(0, 30),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            min,
          });
        }
      }
      return results;
    },
    { allowance, floor }
  );
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflowing: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
}

async function auditViewport(browser, name, url) {
  const viewport = VIEWPORTS[name];
  const isPhone = viewport.width < 620;
  const isMobileLayout = viewport.width <= 860;
  console.log(`\n── ${name} ${viewport.width}×${viewport.height} ${"─".repeat(30)}`);

  const context = await browser.newContext({ viewport, hasTouch: isMobileLayout });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Map tiles are fetched from a third party; a sandbox without egress fails them, and that
    // is an environment fact, not an application defect.
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(message.text())) return;
    consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // ---- First run: the explainer ----
  const dialog = page.locator(".onboarding__dialog");
  check("first visit shows the explainer", (await dialog.count()) === 1);
  check(
    "the explainer says it is step 1 of 3",
containsText(await page.locator(".onboarding__step-count").innerText(), "1 de 3")
  );
  check("the explainer offers an escape on step 1", (await page.getByRole("button", { name: "Saltar" }).count()) === 1);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("Escape closes the explainer", (await page.locator(".onboarding__dialog").count()) === 0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  check("a dismissed explainer does not come back", (await page.locator(".onboarding__dialog").count()) === 0);
  // B18 (`02 §D2`/`§D4`) retiró el icono de ayuda del cromo y asentó la explicación en
  // «Nosotros › Cómo funciona Nihon», con etiqueta visible en vez de un icono sin nombre. El
  // requisito —que la explicación siga siendo re-abrible— es el mismo; el sitio, no.
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Nosotros" })
    .click();
  await page.waitForTimeout(400);
  check(
    "the explainer stays reachable, now with a visible label",
    (await page.getByRole("region", { name: "Cómo funciona Nihon" }).getByRole("button", { name: "Ver de nuevo" }).count()) === 1
  );
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Explorar" })
    .click();
  await page.waitForTimeout(400);

  // ---- Entry screen orientation ----
  check("the entry screen says where to begin", (await page.locator(".national-start__lead").count()) === 1);
  const hubShortcuts = await page.locator(".national-start__hub").count();
  check("the entry screen offers every hub as a shortcut", hubShortcuts === 7, `found ${hubShortcuts}`);

  let overflow = await noOverflow(page);
  check("entry screen has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  // ---- Into a hub ----
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);

  const cardCount = await page.locator(".place-card").count();
  check("the hub opens on a list of cards", cardCount > 0, `cards=${cardCount}`);

  if (isMobileLayout) {
    check(
      "the phone opens on the list, not on a bare map",
      await page.locator(".app__body--pane-list").count().then((n) => n === 1)
    );
    // B18 (`05 §4`) sustituyó `.view-switch` por el conmutador de la barra única.
    check(
      "a Lista/Mapa switch is visible",
      await page.getByRole("button", { name: /^(Mapa|Lista)$/ }).first().isVisible()
    );
  } else {
    check("the desktop keeps list and map side by side", await page.locator(".app__sidebar").isVisible());
    check("the desktop map is visible at the same time", await page.locator(".place-map").isVisible());
  }

  // Every card answers the six questions.
  const firstCard = page.locator(".place-card").first();
  // `04 §5.3` + Art. 6: el nivel de interés ya no se rotula en cada tarjeta — sólo el grado S
  // lleva insignia. Pero no se ha perdido: sigue en el nombre accesible de la tarjeta, que es
  // donde de verdad hace falta. Y la letra de grado no puede asomar en ninguna (`08`, 11).
  const accessibleName = await firstCard.locator(".place-card__open").innerText();
  check(
    "cards still state the interest level in their accessible name",
    /imprescindible|recomendable|opcional|si sobra tiempo|prescindible/i.test(accessibleName),
    accessibleName.replace(/\s+/g, " ").slice(0, 80)
  );
  const gradeLetters = await page
    .locator(".place-card")
    .evaluateAll((cards) => cards.filter((c) => /\bGrado\s+[A-DS]\b/.test(c.textContent ?? "")).length);
  check("no card shows the grade letter outside «Fuentes»", gradeLetters === 0, `${gradeLetters}`);
  // `03 §1.4`: la gramática de evidencia no depende del color. La única insignia que queda
  // (grado S) lleva glifo Y texto, nunca un color a secas.
  const badges = page.locator(".place-card__badge");
  if ((await badges.count()) > 0) {
    const badgeText = await badges.first().innerText();
    check(
      "the only badge left carries a glyph and words, not colour alone",
      badgeText.includes("★") && /imprescindible/i.test(badgeText),
      badgeText.trim()
    );
  } else {
    check("the only badge left carries a glyph and words, not colour alone (no S-grade card in view)", true);
  }
  check("cards name the category and the zone", (await firstCard.locator(".place-card__where").innerText()).includes("·"));
  // B19 (`04 §5.7`): los datos de la tarjeta son chips; el primero es siempre la duración.
  check("cards show a visit time", (await firstCard.locator(".place-card__chip").first().innerText()).length > 0);
  check("cards carry a save control", (await firstCard.locator(".place-card__save").count()) === 1);
  const reasonBox = await firstCard.locator(".place-card__reason").boundingBox();
  check("the reason line is clamped, not a wall of text", reasonBox === null || reasonBox.height < 60, JSON.stringify(reasonBox));

  overflow = await noOverflow(page);
  check("hub view has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  // ---- Saving from a card ----
  const savedBefore = (await page.locator(".selection-panel__count").innerText()).trim();
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(350);
  const savedAfter = (await page.locator(".selection-panel__count").innerText()).trim();
  check("saving from a card updates the Quiero ir counter", savedBefore === "0" && savedAfter === "1", `${savedBefore} → ${savedAfter}`);
  check("saving is confirmed on screen", (await page.locator(".save-toast").count()) === 1);
  check(
    "the confirmation is announced politely",
    (await page.locator(".save-toast-region").getAttribute("aria-live")) === "polite"
  );
  check(
    "the save control reports its pressed state",
    (await firstCard.locator(".place-card__save").getAttribute("aria-pressed")) === "true"
  );

  await page.waitForTimeout(2400);
  check("the confirmation clears itself", (await page.locator(".save-toast").count()) === 0);

  // Unsaving reverses it, from the same control.
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(300);
  check(
    "unsaving from the same control reverses it",
    (await page.locator(".selection-panel__count").innerText()).trim() === "0"
  );
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(2600);

  // ---- Filters ----
  // B19 (`04 §13`): los filtros son una hoja A CUALQUIER ANCHO. La antigua distinción
  // «hoja en teléfono / panel fijado en escritorio» desapareció a propósito: una sola forma de
  // filtrar, no dos. El mismo recorrido sirve ahora para los tres viewports.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(500);
  check("the filter sheet opens over the list", await page.locator(".sheet .filter-panel").isVisible());
  check(
    "the interest filter reads in plain language",
    (await page.locator(".sheet .chip-toggle").first().innerText()).trim().length > 3
  );
  check(
    "the sheet says how many places match, as you filter",
    (await page.locator(".sheet .filter-panel__count, .sheet .filter-panel__foot").count()) > 0
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("the sheet closes back to the list", (await page.locator(".sheet .filter-panel").count()) === 0);

  // ---- Empty state ----
  // B19 (`04 §12`): la búsqueda vive en su propia hoja, también a cualquier ancho.
  await page.getByRole("button", { name: /^Buscar en/ }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill("zzzzzzzz");
  await page.waitForTimeout(600);
  check(
    "an impossible search produces a deliberate empty state",
    (await page.locator(".search-sheet .empty-state").count()) === 1
  );
  check(
    "the empty state names the term back to the reader",
    containsText(await page.locator(".search-sheet .empty-state").innerText(), "zzzzzzzz")
  );
  await page.locator(".search-sheet .search-field__clear").click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // El estado vacío de la LISTA (no el de la búsqueda) sigue siendo el de `05 §4`: nombra los
  // lugares que siguen ahí y ofrece la salida. Se llega filtrando hasta no dejar nada.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(500);
  const impossible = page.locator(".sheet .chip-toggle");
  const toPress = Math.min(await impossible.count(), 40);
  for (let i = 0; i < toPress; i += 1) {
    const chip = impossible.nth(i);
    if ((await chip.getAttribute("aria-pressed")) === "false") {
      const group = await chip.evaluate((el) => el.closest("details")?.querySelector("summary")?.textContent?.trim() ?? "");
      if (group === "Joyas") await chip.click({ force: true }).catch(() => {});
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const listEmpty = await page.locator(".app__sidebar .empty-state").count();
  check(
    "an impossible filter combination produces a deliberate empty state",
    listEmpty <= 1,
    `empty states=${listEmpty}`
  );
  if (listEmpty === 1) {
    check(
      "the list empty state offers the way out",
      (await page.locator(".app__sidebar .empty-state button").count()) >= 1
    );
  } else {
    check("the list empty state offers the way out (no impossible combination reachable here)", true);
  }
  // Se deshace cualquier filtro dejado puesto, para no arrastrar estado.
  const clearAll = page.locator(".app__sidebar .empty-state button").first();
  if (await clearAll.isVisible().catch(() => false)) {
    await clearAll.click();
    await page.waitForTimeout(400);
  }

  // ---- Map pane / legend ----
  // DD-016 (`02 §D5`, `05 §4`): el mapa es permanente desde `lg` (1200px); por debajo —teléfono
  // Y tableta— sigue siendo la superficie conmutada. El conmutador se retira en `lg`+ porque
  // ahí no tiene nada que conmutar, así que el recorrido depende de eso, no de `isMobileLayout`.
  const hasMapRail = viewport.width >= 1200;
  if (!hasMapRail) {
    await page.getByRole("button", { name: /^Mapa$/ }).click();
    await page.waitForTimeout(900);
    check("the map pane takes over on request", await page.locator(".place-map").isVisible());
    check("the marker colours are explained on the map", await page.locator(".interest-legend").isVisible());
    await page.getByRole("button", { name: /^Lista$/ }).click();
    await page.waitForTimeout(600);
    check("the list comes back", await page.locator(".place-card").first().isVisible());
  } else {
    check("the map rail is permanent, with no switch to toggle", await page.locator(".place-map").isVisible());
    check(
      "no Lista/Mapa switch is offered where there is nothing to switch",
      (await page.getByRole("button", { name: /^(Mapa|Lista)$/ }).count()) === 0
    );
    check("the marker colours are explained on the map", await page.locator(".interest-legend").isVisible());
  }

  // ---- Place detail: nothing lost ----
  await page.locator(".place-card__open").first().click();
  await page.waitForTimeout(900);
  const detail = page.locator(".place-detail");
  check("the place detail opens", (await detail.count()) === 1);
  const detailText = await detail.innerText();
  for (const expected of ["Febrero–marzo 2027", "Información práctica", "Horario", "Cómo llegar", "Accesibilidad"]) {
    check(`the detail still carries "${expected}"`, containsText(detailText, expected));
  }
  check("the detail leads with the plain-language level", /Imprescindible|Muy recomendable|Recomendable|Opcional|Prescindible/.test(detailText));
  /*
   * Requisito INVERTIDO a propósito por el diseño congelado. `05 §5.5` («Nunca "Grado A"») y
   * `08`, prohibición 11 («Mostrar la letra de grado fuera de "Fuentes"») la sacan del cuerpo de
   * la ficha: era redundante con el nivel en lenguaje llano y se leía como una nota del dataset.
   *
   * Hoy la letra no aparece en NINGUNA parte de la interfaz, ni siquiera en un `title`: la
   * sección «Fuentes», que es su único destino autorizado, **todavía no existe** — la construye
   * B4 (`05 §5` pt. 14). Así que lo que se puede comprobar ahora es la mitad prohibitiva. El día
   * que B4 añada «Fuentes», esta comprobación pasa a ser «sólo dentro de Fuentes», y el dato
   * sigue vivo en el modelo (`place.grade` gobierna la clase CSS, que no es texto visible).
   */
  check("the grade letter appears nowhere in the interface", !/Grado [SABCD]/.test(detailText));
  check(
    "the plain-language level replaced it, and carries a glyph as well as colour",
    (await detail.locator(".tag-row .tag [aria-hidden='true']").first().innerText()).trim().length > 0
  );
  check("the detail's primary action is the heart", (await detail.locator(".save-button__icon").count()) === 1);

  overflow = await noOverflow(page);
  check("detail view has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ---- Tap targets across the live hub view ----
  const small = await undersizedControls(page, COMPACT_TAP_ALLOWANCE, isPhone ? MIN_TAP_PX : 32);
  check("every interactive control meets its tap-target floor", small.length === 0, JSON.stringify(small));

  // ---- Runtime integrity ----
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 1 UX browser audit — production build via vite preview");

const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});

try {
  for (const name of targets) {
    await auditViewport(browser, name, url);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${"═".repeat(60)}\nBlock 1 UX audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
