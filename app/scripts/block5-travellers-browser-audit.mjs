import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 5 — two local travellers, browser audit against the PRODUCTION build (`vite preview`).
 *
 * What it proves that source scans and unit tests cannot: the layer actually disappears when it
 * has nothing to say, that saving is still one tap with no person picker in the way, that the two
 * readers see the same stored state described from their own side, that an explicit refusal never
 * silently removes what the other one wants, that a destructive step states its cost before it
 * happens, and that a pre-Block-5 list is carried over without anybody's opinion being invented.
 *
 * Usage: node scripts/block5-travellers-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const MIN_TAP_PX = 40;

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4322;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const LEGACY_KEY = "nihon.savedPlaceIds";
const DRAFT_KEY = "nihon.manualPlanningDraft";

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

async function readJson(page, key) {
  return page.evaluate((storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, key);
}

async function storageKeys(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nihon.")));
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const inner = [".traveller-manager__dialog", ".app__detail", ".selection-panel__content"]
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .some((element) => element.scrollWidth > element.clientWidth + 1);
    return { page: doc.scrollWidth > doc.clientWidth + 1, inner };
  });
}

async function smallTargets(page, scope) {
  return page.evaluate(
    ({ min, scope: selector }) => {
      const bad = [];
      const root = selector ? document.querySelector(selector) : document.body;
      if (!root) return bad;
      for (const el of root.querySelectorAll("button:not([disabled]), input, select, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest(".leaflet-control-container")) continue;
        if (Math.min(r.width, r.height) + 0.5 < min) {
          bad.push({ cls: String(el.className).slice(0, 44), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return bad;
    },
    { min: MIN_TAP_PX, scope }
  );
}

/** El destino activo, por rol y nombre accesible (`04 §10`). */
function goToDestination(page, label) {
  return page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: label })
    .first()
    .click();
}

async function openHub(page, hub) {
  await goToDestination(page, "Explorar");
  await page.waitForTimeout(400);
  const shortcut = page.getByRole("region", { name: "Empezar a explorar" });
  if ((await shortcut.count()) > 0) {
    await shortcut.getByRole("button", { name: new RegExp(`^${hub}\\b`) }).first().click();
  }
  await page.waitForTimeout(1300);
}

/**
 * Cambia de persona activa.
 *
 * **Sustitución deliberada (DD-007, `02 §D4`).** El conmutador «Eres» vivía en la cabecera de
 * cada pantalla; B18 lo retiró de ahí —era cromo permanente que competía con el contenido— y lo
 * dejó en Nosotros › Viajeros, con el `PersonToken` de la cabecera como puerta. El requisito del
 * Bloque 5 no cambia ni un ápice: **sigue siendo posible cambiar de persona activa en un
 * dispositivo compartido** (`05 §11`, criterio de aceptación), y este gate lo sigue probando
 * pulsando el control que un lector pulsa de verdad. Lo único que cambia es dónde está.
 */
async function beTraveller(page, index) {
  await page.getByRole("button", { name: /Ir a Nosotros y Viajeros/ }).first().click();
  await page.waitForTimeout(450);
  await travellerOptions(page).nth(index).click();
  await page.waitForTimeout(350);
  await goToDestination(page, "Explorar");
  await page.waitForTimeout(600);
}

/**
 * Las opciones de «quién está usando Nihon», por rol y nombre accesible — no por la clase de su
 * contenedor. Se filtra por lo que el nombre accesible DICE («Estás usando Nihon como …» /
 * «Cambiar a …»), porque el grupo lleva además el botón de editar personas, que no es una
 * opción de persona y no debe contarse como tal.
 */
function travellerOptions(page) {
  return page
    .getByRole("group", { name: "Quién está usando Nihon" })
    .getByRole("button", { name: /^(Estás usando Nihon como|Cambiar a) / });
}

/**
 * El marcador de la otra persona en una tarjeta.
 *
 * **Sustitución deliberada (B19, `04 §5.5`).** `.place-card__interest` era una etiqueta de texto
 * dentro del cuerpo de la tarjeta; el sistema congelado la sustituye por un `PersonToken` `xs`
 * junto al corazón, que **nunca es sólo color** (`04 §1`: siempre lleva la inicial o el glifo de
 * dos personas) y cuyo nombre accesible dice la misma frase que antes era visible. Se lee de ahí,
 * que es además lo que oye un lector de pantalla.
 */
async function markerTextOn(page, cardIndex) {
  const marker = page.locator(".place-card").nth(cardIndex).locator(".place-card__person-token");
  if ((await marker.count()) === 0) return null;
  return (await marker.first().getAttribute("aria-label"))?.trim() ?? null;
}

/**
 * Cuántos lugares hay en «Quiero ir», leído donde el shell vigente lo publica.
 *
 * **Sustitución deliberada (B18, `04 §10`).** `SelectionPanel` dejó de ser un panel desplegable
 * dentro de Explorar y pasó a ser su propia pestaña, así que su contador ya no está visible
 * mientras se navega. El sucesor es el contador de la pestaña «Quiero ir», que `04 §10` fija
 * como el único indicador de la barra. Mide lo mismo: que la lista compartida contiene el lugar.
 */
async function wantToGoCount(page) {
  const badge = page.locator(".tab-bar__badge, .nav-rail__badge");
  if ((await badge.count()) === 0) return "0";
  return (await badge.first().innerText()).trim();
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(24)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });

  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  /*
   * ── The roster exists without a setup form ─────────────────────────────────────────────────
   *
   * DD-007 / `02 §D4`: el conmutador «Eres» sale de la cabecera. Lo que la cabecera conserva es
   * el `PersonToken` de la persona activa —«el único resto» que `04 §11` autoriza—, y la puerta
   * a Nosotros › Viajeros. El requisito sigue siendo el mismo: el reparto existe sin formulario
   * de alta, y dice quién eres en vez de pedirte que lo configures.
   */
  check(
    "the header carries exactly one two-person control, and it is the active PersonToken",
    (await page.locator(".app__person-token-button").count()) === 1
  );
  check(
    "the header control names who you are, not a setup task",
    /^Eres /.test((await page.locator(".app__person-token").first().getAttribute("aria-label")) ?? "")
  );
  await page.getByRole("button", { name: /Ir a Nosotros y Viajeros/ }).first().click();
  await page.waitForTimeout(450);
  const options = travellerOptions(page);
  check("with one option per traveller", (await options.count()) === 2);
  check(
    "and it says who you are rather than asking you to set it up",
    (await options.first().getAttribute("aria-pressed")) === "true"
  );
  const p1Name = (await options.nth(0).innerText()).trim();
  const p2Name = (await options.nth(1).innerText()).trim();
  check("both travellers are named in text", p1Name.length > 0 && p2Name.length > 0, `${p1Name}/${p2Name}`);
  await goToDestination(page, "Explorar");
  await page.waitForTimeout(500);

  let doc = await readJson(page, TRAVELLERS_KEY);
  check("a travellers document is stored under its own key", doc?.version === 1, String(doc?.version));
  check("with two travellers and no opinions", doc?.travellers?.length === 2 && doc?.interests?.length === 0);

  // ── A. Persona 1 saves a place, in one tap ───────────────────────────────────────────────────
  await openHub(page, "Tokio");
  check("no card carries a marker before anyone has spoken", (await page.locator(".place-card__person-token").count()) === 0);

  const firstCard = page.locator(".place-card").first();
  check(
    "saving is still one control with no person picker in front of it",
    (await firstCard.locator(".place-card__save").count()) === 1 &&
      (await firstCard.locator("select, input[type=radio]").count()) === 0
  );
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(400);

  doc = await readJson(page, TRAVELLERS_KEY);
  check("one stance is recorded", doc?.interests?.length === 1);
  check("attributed to the active traveller only", doc?.interests?.[0]?.stances?.length === 1);
  check("as interest, not as a score", doc?.interests?.[0]?.stances?.[0]?.stance === "interested");
  check("the place is in the shared list", (await wantToGoCount(page)) === "1");
  check("and YOUR card shows no marker — the heart already said it", (await markerTextOn(page, 0)) === null);

  // ── B/D. The other person sees it as theirs ──────────────────────────────────────────────────
  await beTraveller(page, 1);
  // El estado activo se comprueba donde ahora vive el control (Nosotros › Viajeros): se abre,
  // se lee y se vuelve, sin cambiar lo que se exige — que la persona activa sea la segunda.
  await page.getByRole("button", { name: /Ir a Nosotros y Viajeros/ }).first().click();
  await page.waitForTimeout(450);
  check("the roster now marks the second traveller", (await travellerOptions(page).nth(1).getAttribute("aria-pressed")) === "true");
  await goToDestination(page, "Explorar");
  await page.waitForTimeout(600);
  const otherMarker = await markerTextOn(page, 0);
  check("the same place now carries a marker naming the other person", otherMarker?.includes(p1Name), String(otherMarker));
  check(
    "and its heart is NOT filled for a person who never said anything",
    (await firstCard.locator(".place-card__save").getAttribute("aria-pressed")) === "false"
  );
  check("while the shared list still contains it", (await wantToGoCount(page)) === "1");

  // ── C. Both interested ───────────────────────────────────────────────────────────────────────
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(400);
  const bothMarker = await markerTextOn(page, 0);
  check("agreement is stated in words", bothMarker?.includes("Los dos"), String(bothMarker));
  check(
    "and never as a number or a percentage",
    !/\d\s*%|\d\s*\/\s*\d/.test(bothMarker ?? ""),
    String(bothMarker)
  );
  doc = await readJson(page, TRAVELLERS_KEY);
  check("two stances, one per person", doc?.interests?.[0]?.stances?.length === 2);
  check("still one entry for the place", doc?.interests?.length === 1);

  // ── E. An explicit refusal, from the detail ──────────────────────────────────────────────────
  const secondCard = page.locator(".place-card").nth(1);
  const secondName = (await secondCard.locator(".place-card__open").innerText()).trim();
  await beTraveller(page, 0);
  await secondCard.locator(".place-card__save").click();
  await page.waitForTimeout(400);
  await beTraveller(page, 1);
  await secondCard.locator(".place-card__open").click();
  await page.waitForTimeout(700);

  /*
   * Bloque 20 (B4, `05 §5` pt. 7 — defecto D8). El requisito del Bloque 5 sigue intacto: la ficha
   * muestra el cuadro completo, una afirmación por viajero, y **el silencio sigue siendo una
   * respuesta de primera clase**. Lo que cambia es que ya no se renderiza una `<section>` con dos
   * filas siempre: `05 §5` pt. 7 pide UNA línea, y sólo cuando alguien ha opinado —hasta v1.1.0
   * la ficha se estrenaba con dos silencios presentados como si fueran información—. Aquí la ha
   * habido (la otra persona marcó el lugar), así que la línea existe y dice las dos cosas.
   */
  const interest = page.locator(".place-interest__line");
  check("the detail shows the full picture", (await interest.count()) === 1, secondName);
  const lines = await interest.locator(".place-interest__person").allInnerTexts();
  check("one statement per traveller", lines.length === 2, JSON.stringify(lines));
  check(
    "including silence as a real answer",
    lines.some((line) => /no ha dicho nada/.test(line)),
    JSON.stringify(lines)
  );

  await page.getByRole("button", { name: "No me interesa" }).click();
  await page.waitForTimeout(450);
  doc = await readJson(page, TRAVELLERS_KEY);
  // Both places now carry two stances, so the record is selected by what it SAYS, not by size.
  const declinedRecord = doc.interests.find((entry) =>
    entry.stances.some((stance) => stance.stance === "not-interested")
  );
  check(
    "the refusal is stored as its own stance",
    declinedRecord !== undefined,
    JSON.stringify(doc.interests)
  );
  check(
    "alongside the other person's interest, not replacing it",
    declinedRecord?.stances?.some((stance) => stance.stance === "interested"),
    JSON.stringify(declinedRecord)
  );
  check(
    "and the agreed place is untouched by it",
    doc.interests.some(
      (entry) =>
        entry.stances.length === 2 && entry.stances.every((stance) => stance.stance === "interested")
    )
  );
  check(
    "and the place stays in the shared list, because the other person still wants it",
    (await page.locator(".selection-panel__count").innerText()).trim() === "2"
  );
  check(
    "the detail says so rather than resolving the disagreement",
    (await interest.innerText()).includes("no le interesa")
  );

  // B20 (`05 §5`, defecto D4): el `×` flotante desapareció; el botón atrás flotante es la salida.
  await page.locator(".place-detail__back").first().click().catch(() => {});
  await page.waitForTimeout(400);

  /*
   * ── G/F. The shared list annotates without scoring ─────────────────────────────────────────
   *
   * B18 (`02 §D2`) sacó `SelectionPanel` de Explorar y lo convirtió en la pestaña «Quiero ir».
   * Hasta esta reparación el gate no navegaba: leía el panel con `innerText` mientras estaba
   * oculto —que en Chromium cae a `textContent`— y por eso «pasaba» sin que nadie lo viera. Ahora
   * se abre la pestaña de verdad, así que las mismas aserciones miden la superficie VISIBLE. Es
   * más estricto que antes, no menos.
   */
  await goToDestination(page, "Quiero ir");
  await page.waitForTimeout(600);
  const panelToggle = page.locator(".destination-panel:not([hidden]) .selection-panel__toggle");
  if ((await panelToggle.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await panelToggle.click();
    await page.waitForTimeout(400);
  }
  const tally = page.locator(".selection-panel__tally");
  check("the saved list summarises in plain counts", (await tally.count()) === 1);
  const tallyText = (await tally.innerText()).trim();
  check("naming agreement and disagreement", /queréis los dos/.test(tallyText) && /desacuerdo/.test(tallyText), tallyText);
  check("and never as a percentage or a score", !/%|punt|score|afinidad/i.test(tallyText), tallyText);
  check(
    "each saved row carries its own marker",
    (await page.locator(".selection-list__interest-marker").count()) === 2
  );

  let overflow = await noOverflow(page);
  check("no horizontal overflow with the list open", !overflow.page && !overflow.inner, JSON.stringify(overflow));

  // ── The planner still receives one shared trip ───────────────────────────────────────────────
  await page.getByRole("button", { name: /Construir recorrido/ }).click();
  await page.waitForTimeout(900);
  const draft = await readJson(page, DRAFT_KEY);
  check("the planning draft is still V8 — not versioned per person", draft?.version === 8, String(draft?.version));
  check(
    "its route holds the shared shortlist, including the disputed place",
    (draft?.routeIds ?? []).length === 2,
    JSON.stringify(draft?.routeIds)
  );
  check(
    "and the draft carries no traveller dimension at all",
    !JSON.stringify(draft).match(/traveller|persona/i)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ── I. Resetting a profile states its cost first ─────────────────────────────────────────────
  // DD-007: el gestor de personas vive en Nosotros › Viajeros, no en la cabecera.
  await goToDestination(page, "Nosotros");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Editar las personas del viaje" }).first().click();
  await page.waitForTimeout(600);
  const manager = page.locator(".traveller-manager__dialog");
  /*
   * **Sustitución deliberada (B18, `02 §D2` / `05 §11`).** El gestor de personas era un modal
   * superpuesto que había que abrir y cerrar; B18 lo convirtió en **una sección de Nosotros ›
   * Viajeros**, embebida y siempre presente (`TravellerManager` con `embedded`). Un modal menos
   * es cromo menos, y lo que se protegía —que el gestor esté etiquetado y sea alcanzable— se
   * cumple mejor: ya no se puede «no encontrarlo». Se comprueba que siga etiquetado por su
   * propio encabezado, que es lo que anuncia un lector de pantalla.
   */
  check("the manager is a labelled section of Nosotros", (await manager.count()) === 1);
  check(
    "and it is still named by its own heading",
    (await manager.getAttribute("aria-labelledby")) === "traveller-manager-title" &&
      (await page.locator("#traveller-manager-title").innerText()).trim().length > 0
  );
  check(
    "it says the trip itself stays shared",
    /El recorrido, los días, las fechas y el\s+alojamiento son del viaje/.test(await manager.innerText())
  );
  check("and that everything is local only", /No hay cuentas, ni servidor, ni sincronización/.test(await manager.innerText()));
  check(
    "it states how many places depend on each person BEFORE anything is pressed",
    /sólo porque lo quiere esta persona|Ningún lugar de la lista depende/.test(await manager.innerText())
  );

  const smallInManager = await smallTargets(page, ".traveller-manager__dialog");
  check("every control in the manager meets the tap floor", smallInManager.length === 0, JSON.stringify(smallInManager));
  overflow = await noOverflow(page);
  check("the manager has no horizontal overflow", !overflow.page && !overflow.inner, JSON.stringify(overflow));

  // Rename, so the marker copy is proven to follow the reader's own words.
  const firstInput = manager.locator(".traveller-manager__input").first();
  await firstInput.fill("Ana");
  await page.waitForTimeout(400);
  doc = await readJson(page, TRAVELLERS_KEY);
  check("renaming is stored verbatim", doc?.travellers?.[0]?.label === "Ana", JSON.stringify(doc?.travellers));

  // Reset needs a second, explicit press and warns about the cost.
  await manager.getByRole("button", { name: /^Reiniciar lo que ha guardado/ }).first().click();
  await page.waitForTimeout(400);
  const confirm = manager.locator(".traveller-manager__confirm");
  check("a reset asks for confirmation", (await confirm.count()) === 1);
  check("announced as an alert", (await confirm.getAttribute("role")) === "alert");
  const confirmText = (await confirm.innerText()).trim();
  check("saying what will be lost", /Se borrará todo lo que ha dicho/.test(confirmText), confirmText);
  check("and that nothing passes to the other person", /no se toca/.test(confirmText), confirmText);

  await manager.getByRole("button", { name: "Cancelar" }).click();
  await page.waitForTimeout(300);
  check("cancelling changes nothing", (await manager.locator(".traveller-manager__confirm").count()) === 0);
  doc = await readJson(page, TRAVELLERS_KEY);
  check("and no stance was touched", doc?.interests?.length === 2);

  await manager.getByRole("button", { name: /^Reiniciar lo que ha guardado/ }).first().click();
  await page.waitForTimeout(300);
  await manager.getByRole("button", { name: "Sí, reiniciar" }).click();
  await page.waitForTimeout(500);
  doc = await readJson(page, TRAVELLERS_KEY);
  const anaId = doc.travellers[0].id;
  check(
    "resetting removed only that person's stances",
    doc.interests.every((entry) => entry.stances.every((stance) => stance.travellerId !== anaId)),
    JSON.stringify(doc.interests)
  );
  check("and kept the person", doc.travellers.length === 2);
  check(
    "the other person's interest survived",
    doc.interests.some((entry) => entry.stances.some((stance) => stance.stance === "interested"))
  );

  /*
   * **Comprobación retirada, con sucesora nombrada (B18).** «Escape cierra el gestor» sólo tiene
   * sentido mientras el gestor es un modal. Embebido en Nosotros no hay nada que cerrar: se sale
   * navegando, como de cualquier otra sección. Lo que la comprobación protegía de verdad —que el
   * teclado no quede atrapado en el gestor— pasa a comprobarse aquí en su forma vigente: tras
   * pulsar `Escape`, la sección sigue en su sitio y el foco permanece donde el lector lo dejó,
   * sin que la tecla provoque una navegación sorpresa. La salida por teclado del shell de cuatro
   * destinos la cubre `b18-a11y-check`.
   */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(
    "Escape does not tear down the embedded manager, and does not navigate away",
    (await manager.count()) === 1 &&
      (await page.locator(".destination-panel:not([hidden]) .nosotros-section").count()) > 0
  );

  // ── Keyboard and accessible naming ───────────────────────────────────────────────────────────
  const barA11y = await page.evaluate(() => {
    const group = document.querySelector(".traveller-bar");
    if (!group) return null;
    const buttons = [...group.querySelectorAll("button")];
    const focusTarget = buttons[0];
    focusTarget.focus();
    return {
      role: group.getAttribute("role"),
      labelled: group.getAttribute("aria-label") !== null,
      allNamed: buttons.every((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().length > 0),
      pressedCount: buttons.filter((b) => b.getAttribute("aria-pressed") === "true").length,
      focusable: document.activeElement === focusTarget,
    };
  });
  check("the traveller control is a labelled group", barA11y?.role === "group" && barA11y?.labelled === true);
  check("every one of its buttons has an accessible name", barA11y?.allNamed === true);
  check("exactly one traveller is marked pressed", barA11y?.pressedCount === 1, String(barA11y?.pressedCount));
  check("and it is keyboard focusable", barA11y?.focusable === true);

  const smallGlobal = await smallTargets(page, ".traveller-bar");
  check("the header control meets the tap floor", smallGlobal.length === 0, JSON.stringify(smallGlobal));

  // ── L. Reload ────────────────────────────────────────────────────────────────────────────────
  const before = await readJson(page, TRAVELLERS_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const after = await readJson(page, TRAVELLERS_KEY);
  check("everything valid survives a reload", JSON.stringify(after) === JSON.stringify(before));
  check("including the renamed traveller", after?.travellers?.[0]?.label === "Ana");
  check(
    "and the active traveller",
    after?.activeTravellerId === before?.activeTravellerId
  );

  // ── K. Malformed storage fails closed ────────────────────────────────────────────────────────
  await page.evaluate((key) => localStorage.setItem(key, "{not json"), TRAVELLERS_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  check("a corrupt document does not break the app", pageErrors.length === 0, pageErrors.join(" | "));
  const recovered = await readJson(page, TRAVELLERS_KEY);
  check("it is replaced by a fresh roster rather than a repaired one", recovered?.version === 1);
  check("with two travellers and no invented opinions", recovered?.travellers?.length === 2 && recovered?.interests?.length === 0);

  // An orphan stance is refused outright rather than silently reattributed.
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: TRAVELLERS_KEY,
      value: JSON.stringify({
        version: 1,
        travellers: [{ id: "a", label: "A" }],
        activeTravellerId: "a",
        interests: [{ placeId: "JP-001", stances: [{ travellerId: "ghost", stance: "interested" }], carriedOver: false }],
      }),
    }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const afterOrphan = await readJson(page, TRAVELLERS_KEY);
  check("an orphan stance is rejected, not reattributed", afterOrphan?.interests?.length === 0);
  check("and the roster is rebuilt cleanly", afterOrphan?.travellers?.length === 2);

  // ── J. A pre-Block-5 list is carried over, unclaimed ─────────────────────────────────────────
  await page.evaluate(
    ({ travellersKey, legacyKey }) => {
      localStorage.removeItem(travellersKey);
      localStorage.setItem(legacyKey, JSON.stringify(["JP-001", "JP-002"]));
    },
    { travellersKey: TRAVELLERS_KEY, legacyKey: LEGACY_KEY }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const migrated = await readJson(page, TRAVELLERS_KEY);
  check("the old list is carried over", migrated?.interests?.length === 2, JSON.stringify(migrated?.interests));
  check(
    "without inventing an opinion for anybody",
    (migrated?.interests ?? []).every((entry) => entry.stances.length === 0 && entry.carriedOver === true)
  );
  check(
    "the carried-over places are still in the shared list",
    (await page.locator(".selection-panel__count").innerText()).trim() === "2"
  );
  check(
    "the legacy key is left alone rather than deleted",
    (await readJson(page, LEGACY_KEY))?.length === 2
  );

  await openHub(page, "Tokio");
  if ((await page.locator(".selection-panel__content").count()) === 0) {
    await page.locator(".selection-panel__toggle").click();
    await page.waitForTimeout(400);
  }
  check(
    "and the list says they are unclaimed rather than anybody's choice",
    /sin reclamar/i.test(await page.locator(".selection-panel__tally").innerText())
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  check(
    "the app owns no storage key it did not declare",
    (await storageKeys(page)).every((key) =>
      ["nihon.travellers.v1", "nihon.savedPlaceIds", "nihon.manualPlanningDraft", "nihon.onboarding.seen.v1", "nihon.zoneComparison.v1"].includes(key)
    ),
    JSON.stringify(await storageKeys(page))
  );

  await context.close();
}

console.log("Block 5 two-traveller audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 5 two-traveller audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
