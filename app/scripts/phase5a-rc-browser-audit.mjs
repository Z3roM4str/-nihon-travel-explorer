import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Phase 5A — Nihon v1 Release Candidate browser audit.
 *
 * Unlike every earlier phase audit, this one runs against the **production build** via
 * `vite preview`, not the dev server: an RC gate must exercise the artifact that would ship,
 * including the real bundling, minification and asset paths. Run `npm run build` first.
 *
 * It exercises the five golden journeys of Issue #118 §5 end to end on a clean profile, at a
 * desktop and a mobile viewport, and records console errors, page errors and every external
 * network request for the runtime-integrity proof (§8).
 *
 * Determinism: the browser's civil date is fixed before boot with a test-only `addInitScript`
 * Date shim — the mechanism Phase 3F-H established. No production test-date prop, query
 * parameter, localStorage field or planning-draft field exists.
 *
 * Usage: node scripts/phase5a-rc-browser-audit.mjs [--viewport=desktop|mobile]
 *
 * **Actualizado el 2026-09-21.** Los cinco recorridos dorados siguen siendo exactamente los
 * mismos, y la prueba de integridad en tiempo de ejecución (§8) no se toca: lo que se ha
 * reescrito son los AYUDANTES DE NAVEGACIÓN, porque B18 sustituyó el shell entero por cuatro
 * destinos permanentes (`02 §D2`) y B19 rehízo la superficie de descubrimiento.
 *
 * - `.place-list__item` → `.place-card` (`04 §5`, la tarjeta de B19).
 * - El cajón «Buscar y filtrar» y el `.app__sidebar` oculto por debajo de 861px → ya no existen:
 *   la lista es la superficie primaria a cualquier ancho (DD-016), con un conmutador Lista/Mapa
 *   por debajo de `lg` y mapa permanente a partir de ahí.
 * - `.selection-panel__toggle` alcanzado desde Explorar → «Quiero ir» es una pestaña.
 * - La lista carga de 12 en 12 (`05 §4`), así que llegar a un lugar concreto se hace por la hoja
 *   de búsqueda —el camino real de un lector— en vez de suponer que está ya en el DOM.
 * - A05 medía la letra de grado en la lista (`.place-list__grade`), que `08` prohibición 11 sacó
 *   de la interfaz. El requisito —que el filtro ofrezca todo lo que hay en la ciudad— se
 *   conserva, expresado en el vocabulario vigente: niveles de interés, no letras.
 */

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const viewportArg = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "--viewport=desktop")
  .split("=")[1];
assert.ok(VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const viewport = VIEWPORTS[viewportArg];
// `isMobile` desapareció con el cajón «Buscar y filtrar»: desde DD-016 los dos viewports
// recorren exactamente el mismo camino, y lo único que cambia con el ancho (mapa conmutado por
// debajo de `lg`, permanente a partir de ahí) se decide midiendo la página, no suponiéndolo aquí.

console.log(`Phase 5A RC browser audit — ${viewportArg} ${viewport.width}x${viewport.height}`);

const appRoot = fileURLToPath(new URL("..", import.meta.url));

const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64"
);

/** Photography providers that must never be contacted at runtime (Issue #118 §5 Journey E). */
const PHOTO_PROVIDER = /wikimedia|wikipedia|creativecommons|commons\.wikimedia/i;
/** Transit providers that must stay dormant for v1 (Issue #118 §8). */
const TRANSIT_PROVIDER = /ekispert|navitime|openrouteservice|ors\.|googleapis|mapbox/i;

const TRIP_START = "2027-02-20";

/** Only zero-argument `new Date()` and `Date.now()` are intercepted; explicit arguments,
 * `Date.UTC`, `Date.parse` and the prototype pass through unchanged. */
function fixBrowserCivilDate([year, month, day]) {
  const OriginalDate = Date;
  const fixed = new OriginalDate(year, month - 1, day, 12, 0, 0, 0).getTime();
  const shim = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [fixed] : args, newTarget);
    },
    apply() {
      return new OriginalDate(fixed).toString();
    },
    get(target, prop, receiver) {
      if (prop === "now") return () => fixed;
      return Reflect.get(target, prop, receiver);
    },
  });
  globalThis.Date = shim;
  window.Date = shim;
}

const server = await preview({
  root: appRoot,
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});

let browser;
const results = [];
const failures = [];
const externalRequests = [];

const record = (name, detail) =>
  results.push(`  ${name.padEnd(56)}: pass${detail ? ` (${detail})` : ""}`);

async function step(name, fn) {
  let line;
  try {
    const detail = await fn();
    record(name, detail);
    line = results[results.length - 1];
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    line = `  ${name.padEnd(56)}: FAIL (${error.message.split("\n")[0].slice(0, 160)})`;
    results.push(line);
  }
  // Streamed as it happens: a hung or failing step must be visible before the run ends.
  console.log(line);
}

try {
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "vite preview did not expose a local URL");

  browser = await chromium.launch({
    headless: true,
    ...(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}),
  });

  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // Every non-local request is recorded and stubbed. Stubbing also proves the core UI survives
  // an optional external resource (the OpenStreetMap tile layer) failing to render (§8).
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith("data:") || target.startsWith("blob:")) {
      return route.continue();
    }
    externalRequests.push(target);
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });

  await page.addInitScript(fixBrowserCivilDate, [2026, 9, 16]);
  // B17 añadió la explicación de primera apertura, que es un diálogo modal: sin descartarla,
  // cualquier click de estos recorridos golpea el scrim en vez del control. Su propio camino de
  // descarte ya lo prueba `block1-ux-browser-audit.mjs`; aquí sólo estorbaría.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });

  // ---------------------------------------------------------------- helpers
  const detail = () => page.locator(".place-detail");
  /** The ordered-sequence builder renders inside the shared modal dialog. */
  const plannerDialog = () => page.locator(".analysis-dialog");

  async function openNational() {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
  }

  /** Los cuatro destinos de `02 §D2`, por nombre accesible. */
  async function goToDestination(name) {
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name })
      .click();
    await page.waitForTimeout(300);
  }

  /**
   * DD-016: la lista es la superficie primaria a cualquier ancho — ya no hay cajón que abrir. Lo
   * único que puede taparla es el conmutador Lista/Mapa por debajo de `lg`, así que basta con
   * devolverlo a «Lista» si quedó en «Mapa».
   */
  async function ensurePlaceListVisible() {
    if (await page.locator(".place-card").first().isVisible().catch(() => false)) return;
    const toList = page.getByRole("button", { name: /^Lista$/ });
    if (await toList.isVisible().catch(() => false)) {
      await toList.click();
      await page.waitForTimeout(300);
    }
  }

  /**
   * A03 comprueba el recorrido región → prefectura → ciudad, así que se hace por el navegador de
   * regiones y no por el atajo de ciudad de la portada. Hay que acotar el click a
   * `.region-nav__item--prefecture`: la portada ofrece además un atajo por ciudad cuyo nombre
   * empieza igual («Tokio57 lugares» frente a «Tokio東京都54 lugares verificados»), y un
   * `getByRole` a secas resolvía al atajo — que entra directo y deja sin pulsar «Explorar desde».
   */
  async function enterHub(hub, prefecture) {
    const prefButton = page.locator(".region-nav__item--prefecture").filter({ hasText: new RegExp(`^${prefecture}`) }).first();
    if (await prefButton.count() > 0 && await prefButton.isVisible()) {
      await prefButton.click();
      await page.getByRole("button", { name: new RegExp(`Explorar desde ${hub}`) }).first().click();
    } else {
      const shortcut = page.locator(".national-start__hub").filter({ hasText: new RegExp(`^${hub}`) }).first();
      if (await shortcut.count() > 0 && await shortcut.isVisible()) {
        await shortcut.click();
      } else {
        await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
      }
    }
    await ensurePlaceListVisible();
    await page.locator(".place-card").first().waitFor();
  }

  /** Reaches a hub from a clean load, so a failing step cannot strand later steps in the
   * wrong hub. */
  async function gotoHub(hub, prefecture) {
    await page.goto(url, { waitUntil: "networkidle" });
    await enterHub(hub, prefecture);
  }

  /** On mobile the detail panel covers the drawer, so an open one is closed first. Escape is
   * the product's own documented dismissal (`PlaceDetail.tsx` binds it), which also exercises
   * that binding on every place this audit opens. */
  async function closeDetailIfOpen() {
    if ((await detail().count()) === 0) return;
    await page.keyboard.press("Escape");
    await detail().waitFor({ state: "detached" }).catch(() => {});
  }

  /**
   * B19 (`05 §4`) carga la lista de 12 en 12, así que un lugar concreto puede no estar en el DOM.
   * Se busca primero entre lo ya cargado y, si no está, se llega por la hoja de búsqueda — que es
   * además el camino real de un lector que sabe qué quiere ver.
   */
  async function openPlace(name) {
    await closeDetailIfOpen();
    await ensurePlaceListVisible();
    const loaded = page
      .locator(".place-card:not(.place-card--compact)")
      .filter({ hasText: name })
      .first();
    if ((await loaded.count()) > 0) {
      await loaded.scrollIntoViewIfNeeded();
      await loaded.locator(".place-card__open").click();
      await detail().waitFor();
      return;
    }
    await page.getByRole("button", { name: /^Buscar en / }).click();
    await page.waitForSelector(".search-sheet", { timeout: 10000 });
    await page.locator(".search-sheet .search-field__input").fill(name);
    await page.waitForTimeout(600);
    await page.locator(".search-sheet .place-card__open").first().click();
    await detail().waitFor();
  }

  async function savePlace(name) {
    await openPlace(name);
    const button = detail().getByRole("button", { name: /Quiero ir|Guardado/ }).first();
    await button.scrollIntoViewIfNeeded();
    if ((await button.textContent())?.includes("Guardado")) return;
    await button.click();
  }

  /** Opens the planner's day-assignment view from any state. Reloading first makes the step
   * independent of whether a previous journey left the modal open. */
  async function openPlanner({ fresh = true } = {}) {
    if (fresh) await page.goto(url, { waitUntil: "networkidle" });
    else await closeDetailIfOpen();
    if ((await plannerDialog().count()) === 0) {
      // B18 (`02 §D2`, `05 §7`): el planificador dejó de ser un modal abierto desde «Quiero ir»
      // y es ahora una sección permanente de la pestaña Viaje, renderizada `embedded` (mismo
      // componente, misma clase `.analysis-dialog`, sin scrim ni `role="dialog"`).
      await goToDestination("Viaje");
      await page.getByRole("button", { name: /^Planificar$/ }).first().click();
      await page.waitForTimeout(400);
    }
    const toDays = page.getByRole("button", { name: /Distribuir por días/ });
    if ((await toDays.count()) > 0) await toDays.first().click();
    await page.getByRole("heading", { name: "Día 1" }).waitFor();
  }

  /** Back from the day-assignment view to the ordered-route draft (where removal lives). */
  async function openRouteView() {
    await openPlanner();
    await page.getByRole("button", { name: /Volver al recorrido/ }).first().click();
    await page.locator(".sequence-list").first().waitFor();
  }

  /**
   * Puts the profile into a known planning state. Clearing the draft matters: `reconcileDraft`
   * correctly prunes a stored route to the places that are still saved and never auto-appends
   * newly saved ones, so reusing a previous journey's draft would leave a one-place route and no
   * day-assignment affordance (which needs two).
   */
  async function seedPlan(placeIds) {
    await page.goto(url, { waitUntil: "networkidle" });
    // Mismo motivo que en `readSaved`: lo guardado vive desde el Bloque 5 en el documento de
    // viajeros, no en una lista plana. Se siembra con la forma que la aplicación escribe.
    await page.evaluate((ids) => {
      localStorage.removeItem("nihon.manualPlanningDraft");
      localStorage.setItem(
        "nihon.travellers.v1",
        JSON.stringify({
          version: 1,
          travellers: [
            { id: "trav-a", label: "Ana" },
            { id: "trav-b", label: "Beto" },
          ],
          activeTravellerId: "trav-a",
          interests: ids.map((placeId) => ({
            placeId,
            stances: [{ travellerId: "trav-a", stance: "interested" }],
            carriedOver: false,
          })),
        })
      );
    }, placeIds);
    await page.reload({ waitUntil: "networkidle" });
  }

  /**
   * «Lo guardado» ya no es una lista plana. El Bloque 5 lo convirtió en intereses POR VIAJERO
   * (`nihon.travellers.v1`), que es lo que el producto persiste desde entonces: `nihon
   * .savedPlaceIds` sobrevive como clave de migración, pero la aplicación ya no la escribe, así
   * que leerla devolvía siempre una lista vacía. El requisito —lo marcado persiste, entre
   * ciudades y entre recargas— es el mismo; se lee del modelo vigente, para la persona activa.
   */
  const readSaved = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem("nihon.travellers.v1");
      if (!raw) return [];
      const doc = JSON.parse(raw);
      const active = doc.activeTravellerId;
      return (doc.interests ?? [])
        .filter((entry) =>
          (entry.stances ?? []).some((s) => s.travellerId === active && s.stance === "interested")
        )
        .map((entry) => entry.placeId);
    });
  const readDraft = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));

  // ======================================================= JOURNEY A
  await openNational();

  await step("A01 national explorer renders", async () => {
    const heading = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    assert.match(heading.trim(), /^Explorar$/);
    const mapCard = page.locator(".explorer-home__map-card");
    if (await mapCard.count() > 0 && await mapCard.isVisible()) {
      await mapCard.click();
      await page.waitForTimeout(400);
    }
    const regions = await page.locator(".region-nav__item").count();
    assert.ok(regions >= 9, `expected >=9 regions, got ${regions}`);
    return `${regions} regions`;
  });

  await step("A02 national summary counts match catalogue", async () => {
    const body = await page.locator("body").textContent();
    assert.ok(body.includes("214"), "national summary should surface the 214-place catalogue");
    return "214 places surfaced";
  });

  await step("A03 region -> prefecture -> hub navigation", async () => {
    await enterHub("Tokio", "Tokio");
    const count = await page.locator(".place-card:not(.place-card--compact)").count();
    assert.ok(count > 0, "hub list empty");
    return `${count} Tokio places`;
  });

  await step("A04 free-text search filters the list", async () => {
    await ensurePlaceListVisible();
    const before = await page.locator(".place-card:not(.place-card--compact)").count();
    // B19 (`04 §12`): la búsqueda es una hoja propia con resultados en vivo.
    await page.getByRole("button", { name: /^Buscar en / }).click();
    await page.waitForSelector(".search-sheet", { timeout: 10000 });
    const search = page.locator(".search-sheet .search-field__input");
    await search.fill("Shibuya");
    await page.waitForTimeout(400);
    const after = await page.locator(".search-sheet .place-card").count();
    assert.ok(after > 0 && after < before, `search did not narrow: ${before} -> ${after}`);
    await page.locator(".search-sheet .search-field__clear").click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const restored = await page.locator(".place-card:not(.place-card--compact)").count();
    assert.equal(restored, before, "clearing the search did not restore the list");
    return `${before} -> ${after} -> ${restored}`;
  });

  /**
   * Mismo requisito de siempre —el filtro no puede ofrecer menos de lo que la ciudad contiene—,
   * en el vocabulario vigente. `08` prohibición 11 sacó la letra de grado de la interfaz, así que
   * ya no hay `.place-list__grade` que leer; lo que la tarjeta sí declara, en su nombre
   * accesible, es el NIVEL DE INTERÉS en lenguaje llano (`04 §5`), que es exactamente lo que el
   * grupo «Nivel de interés» de la hoja de filtros ofrece. Se comprueba sobre las tres ciudades,
   * no sólo la primera: Tokio no contiene todos los niveles.
   */
  await step("A05 interest filter offers every level present in the hub", async () => {
    const report = [];
    for (const [hub, prefecture] of [["Tokio", "Tokio"], ["Osaka", "Osaka"], ["Kioto", "Kioto"]]) {
      await gotoHub(hub, prefecture);
      await ensurePlaceListVisible();
      // Toda la ciudad, no sólo las 12 primeras tarjetas: se scrollea hasta agotar la lista.
      for (let i = 0; i < 40; i += 1) {
        await page.locator(".app__sidebar").evaluate((el) => el.scrollBy(0, 1200));
        await page.waitForTimeout(80);
      }
      const levelsInHub = await page.evaluate(() => {
        const known = ["Imprescindible", "Muy recomendable", "Recomendable", "Opcional", "Prescindible"];
        const found = new Set();
        for (const card of document.querySelectorAll(".place-card:not(.place-card--compact)")) {
          const text = card.textContent ?? "";
          for (const level of known) if (text.includes(level)) found.add(level);
        }
        return [...found];
      });
      await page.getByRole("button", { name: /^Filtros/ }).click();
      await page.waitForTimeout(500);
      const offered = await page
        .locator(".sheet .filter-group")
        .filter({ has: page.locator("summary", { hasText: "Nivel de interés" }) })
        .locator(".chip-toggle")
        .allTextContents();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const normalise = (list) => list.map((t) => t.replace(/\s+/g, " ").trim());
      const offeredNorm = normalise(offered);
      const missing = levelsInHub.filter((level) => !offeredNorm.some((o) => o.includes(level)));
      assert.deepEqual(missing, [],
        `${hub}: levels present in the place list but not offered as filters: ${missing}`);
      report.push(`${hub}:${levelsInHub.length}/${offeredNorm.length}`);
    }
    return report.join(" ");
  });

  await step("A06 place detail shows photograph and attribution", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const img = detail().locator(".gallery__image");
    await img.waitFor();
    const src = await img.getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `expected local asset, got ${src}`);
    const loaded = await img.evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(loaded, "gallery image did not decode");
    const alt = await img.getAttribute("alt");
    assert.ok(alt && alt.trim().length > 0, "gallery image missing alt text");
    // Bloque 20 (B4, `04 §7`): la atribución sale del flujo y vive tras el `ⓘ` de la galería.
    // El requisito —que el enlace a la fuente exista y sea alcanzable— no cambia de sitio en el
    // recorrido dorado, sólo de superficie.
    await detail().locator(".gallery__credits").click();
    const credit = page.locator(".credits-sheet__list");
    await credit.waitFor();
    assert.ok(await credit.getByRole("link", { name: "Wikimedia Commons" }).count(),
      "missing Commons source link");
    await page.keyboard.press("Escape");
    return "local asset + credit + alt";
  });

  await step("A07 no-photo place shows the documented fallback", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Takeshita Street"); // JP-004, grade C, uncovered
    const body = await detail().textContent();
    assert.match(body, /Sin fotograf[íi]a disponible todav[íi]a/i);
    assert.equal(await detail().locator(".gallery__image").count(), 0,
      "uncovered place must not render an image");
    return "fallback rendered";
  });

  await step("A08 save places across two hubs", async () => {
    await gotoHub("Tokio", "Tokio");
    for (const name of ["Shibuya Crossing", "SHIBUYA SKY", "Meiji Jingu"]) await savePlace(name);
    await gotoHub("Kioto", "Kioto");
    for (const name of ["Nanzen-ji", "Ginkaku-ji"]) await savePlace(name);
    const saved = await readSaved();
    assert.equal(saved.length, 5, `expected 5 saved, got ${saved.length}`);
    return saved.join(",");
  });

  await step("A09 saved selection lists every saved place", async () => {
    await closeDetailIfOpen();
    await goToDestination("Quiero ir");
    const rows = await page.locator(".destination-panel:not([hidden]) .selection-panel__content li").count();
    assert.ok(rows >= 5, `expected >=5 rows, got ${rows}`);
    await goToDestination("Explorar");
    return `${rows} rows`;
  });

  await step("A10 build ordered sequence and assign days", async () => {
    await openPlanner();
    const days = await page.getByRole("heading", { name: /^Día \d+$/ }).count();
    assert.ok(days >= 1, "no days rendered");
    const draft = await readDraft();
    assert.equal(draft.routeIds.length, 5, `draft should carry 5 places, got ${draft.routeIds.length}`);
    return `${days} day(s), ${draft.routeIds.length} places`;
  });

  await step("A11 anchor Day 1 to a civil date", async () => {
    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(200);
    const draft = await readDraft();
    assert.equal(draft.startDate, TRIP_START, `startDate not persisted: ${draft.startDate}`);
    const body = await plannerDialog().textContent();
    assert.ok(/2027/.test(body), "anchored year not surfaced");
    return TRIP_START;
  });

  /** Proves the Day 1 label is *derived* from the anchor rather than a fixed string: the
   * expectation is computed with the same Intl contract `formatCivilDateDisplay` uses, and the
   * anchor is then moved by one day and re-checked. */
  await step("A12 calendar weekday composes correctly from Day 1", async () => {
    const expected = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Intl.DateTimeFormat("es", {
        weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, d)));
    };
    const saturday = await plannerDialog().textContent();
    assert.ok(saturday.includes(expected(TRIP_START)),
      `Day 1 did not render "${expected(TRIP_START)}" for anchor ${TRIP_START}`);

    const nextDay = "2027-02-21";
    await page.locator("#sequence-start-date").fill(nextDay);
    await page.waitForTimeout(250);
    const sunday = await plannerDialog().textContent();
    assert.ok(sunday.includes(expected(nextDay)),
      `re-anchoring to ${nextDay} did not recompose the weekday to "${expected(nextDay)}"`);
    assert.ok(!sunday.includes(expected(TRIP_START)),
      "the previous anchor's Day 1 label survived a re-anchor");

    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(250);
    return `${expected(TRIP_START)} -> ${expected(nextDay)} -> ${expected(TRIP_START)}`;
  });

  await step("A13 set a supported manual visit start time", async () => {
    const input = page.locator("input[id^='visit-start-time-']").first();
    if ((await input.count()) === 0) return "no eligible recorded-interval place in this plan";
    const id = await input.getAttribute("id");
    await input.fill("10:00");
    await page.waitForTimeout(200);
    const draft = await readDraft();
    const values = Object.values(draft.visitStartTimes ?? {});
    assert.ok(values.includes("10:00"), `visit start time not persisted: ${JSON.stringify(draft.visitStartTimes)}`);
    return id;
  });

  /** Journey A step 12 and Issue #118 §11: the route spans Tokio then Kioto, so the boundary
   * between them is the one consecutive pair the manual inter-hub form should offer. */
  await step("A13b add a manual inter-hub segment across the hub boundary", async () => {
    const section = page.locator(".inter-hub-segments");
    await section.first().waitFor();
    const positionSelect = section.locator("select").first();
    const options = await positionSelect.locator("option").allTextContents();
    const pair = options.find((o) => !/Selecciona/.test(o));
    assert.ok(pair, `no inter-hub pair offered; options were ${JSON.stringify(options)}`);
    await positionSelect.selectOption({ label: pair });
    await section.locator("select").nth(1).selectOption({ label: "Shinkansen" });
    await section.locator("input[type=number]").first().fill("140");
    await section.getByRole("button", { name: /Añadir tramo/ }).click();
    await page.waitForTimeout(300);
    const draft = await readDraft();
    assert.equal(draft.interHubSegments.length, 1,
      `expected one inter-hub segment, got ${draft.interHubSegments.length}`);
    const segment = draft.interHubSegments[0];
    const route = new Set(draft.routeIds);
    assert.ok(route.has(segment.fromPlaceId) && route.has(segment.toPlaceId),
      "inter-hub segment references a place outside the route");
    assert.equal(segment.minutes, 140, `segment minutes not persisted: ${segment.minutes}`);
    const rendered = await section.first().textContent();
    assert.match(rendered, /140 min registrados manualmente/,
      "the manual segment duration is not labelled as manually recorded");
    return `${pair} · Shinkansen · 140 min`;
  });

  await step("A14 whole-trip composition renders and reconciles", async () => {
    const summary = page.locator(".whole-trip-composition");
    await summary.first().waitFor();
    const text = await summary.first().textContent();
    assert.ok(text.trim().length > 0, "composition summary empty");
    return "composition present";
  });

  await step("A15 reload reproduces persisted state", async () => {
    const before = await readDraft();
    const savedBefore = await readSaved();
    await page.reload({ waitUntil: "networkidle" });
    const after = await readDraft();
    const savedAfter = await readSaved();
    assert.deepEqual(savedAfter, savedBefore, "saved places changed across reload");
    assert.equal(after.startDate, before.startDate, "anchor lost across reload");
    assert.deepEqual(after.routeIds, before.routeIds, "route changed across reload");
    assert.deepEqual(after.visitStartTimes, before.visitStartTimes, "visit times changed across reload");
    assert.deepEqual(after.interHubSegments, before.interHubSegments,
      "inter-hub segments changed across reload");
    return `${savedAfter.length} saved, anchor ${after.startDate}, ${after.interHubSegments.length} segment(s)`;
  });

  // ======================================================= JOURNEY B
  await step("B01 reorder a place within its day", async () => {
    await openPlanner();
    const before = (await readDraft()).days.map((d) => d.placeIds.join("|")).join(" / ");
    const down = page
      .getByRole("button", { name: /Mover .+ hacia abajo en Día \d+/ })
      .and(page.locator("button:not([disabled])"))
      .first();
    assert.ok(await down.count(), "no enabled in-day reorder control");
    await down.click();
    await page.waitForTimeout(200);
    const after = (await readDraft()).days.map((d) => d.placeIds.join("|")).join(" / ");
    assert.notEqual(after, before, "reorder did not change the draft");
    return "order changed";
  });

  await step("B02 reorder preserves membership exactly", async () => {
    const draft = await readDraft();
    const inDays = draft.days.flatMap((d) => d.placeIds).sort();
    const route = [...draft.routeIds].sort();
    assert.deepEqual(inDays, route, "day membership diverged from routeIds after reorder");
    assert.equal(new Set(inDays).size, inDays.length, "a place is assigned to more than one day");
    return `${inDays.length} places, no duplicates`;
  });

  await step("B03 stable day identity survives add-day and cross-day move", async () => {
    const before = (await readDraft()).days.map((d) => d.id);
    await page.getByRole("button", { name: /Añadir día/ }).first().click();
    await page.waitForTimeout(200);
    const withNewDay = (await readDraft()).days.map((d) => d.id);
    assert.deepEqual(withNewDay.slice(0, before.length), before,
      "adding a day regenerated the existing day IDs");
    const mover = page.getByRole("button", { name: /Mover .* al día siguiente/ }).first();
    assert.ok(await mover.count(), "no cross-day move control after adding a second day");
    await mover.click();
    await page.waitForTimeout(250);
    const after = (await readDraft()).days.map((d) => d.id);
    assert.deepEqual(after, withNewDay, "a cross-day move regenerated day IDs");
    const moved = (await readDraft()).days[1].placeIds;
    assert.ok(moved.length > 0, "cross-day move did not land a place in Día 2");
    return `${after.length} stable day ids, Día 2 holds ${moved.length}`;
  });

  await step("B04 no orphaned visit time after moving a place", async () => {
    const draft = await readDraft();
    const assigned = new Set(draft.days.flatMap((d) => d.placeIds));
    const orphans = Object.keys(draft.visitStartTimes ?? {}).filter((id) => !assigned.has(id));
    assert.deepEqual(orphans, [], `visit times left attached to unassigned places: ${orphans}`);
    return "no orphans";
  });

  /**
   * `lib/planning-draft.ts::withRoute` documents the contract this asserts: a pure reorder keeps
   * the day assignment, but ANY change to the set of places invalidates it (`days: null`) rather
   * than inventing which day a new place belongs to or repairing a day missing a removed one.
   * What matters for release is that nothing stale survives that reset.
   */
  await step("B05 removing a place leaves no stale dependent state", async () => {
    await openRouteView();
    const before = await readDraft();
    const removedName = await page
      .getByRole("button", { name: /Quitar .+ del recorrido/ })
      .first()
      .getAttribute("aria-label");
    const remove = page.getByRole("button", { name: /Quitar .+ del recorrido/ }).first();
    assert.ok(await remove.count(), "no removal control in the route view");
    await remove.click();
    await page.waitForTimeout(300);
    const draft = await readDraft();
    assert.equal(draft.routeIds.length, before.routeIds.length - 1, "route length did not shrink by one");
    const route = new Set(draft.routeIds);
    const assigned = draft.days === null ? route : new Set(draft.days.flatMap((d) => d.placeIds));
    assert.deepEqual([...assigned].filter((id) => !route.has(id)), [],
      "a day still references a place no longer in the route");
    const orphanTimes = Object.keys(draft.visitStartTimes ?? {}).filter((id) => !route.has(id));
    assert.deepEqual(orphanTimes, [], `stale visit times after removal: ${orphanTimes}`);
    const orphanSegments = (draft.interHubSegments ?? []).filter(
      (seg) => !route.has(seg.fromPlaceId) || !route.has(seg.toPlaceId)
    );
    assert.deepEqual(orphanSegments, [], "stale inter-hub segment after removal");
    const orphanLegs = (draft.accommodationLegs ?? []).filter((leg) => !route.has(leg.placeId));
    assert.deepEqual(orphanLegs, [], "stale accommodation leg after removal");
    return `${removedName ?? "a place"} removed; days ${draft.days === null ? "invalidated per contract" : "retained"}, no stale refs`;
  });

  await step("B06 edits survive reload", async () => {
    const before = await readDraft();
    await page.reload({ waitUntil: "networkidle" });
    const after = await readDraft();
    assert.deepEqual(after.routeIds, before.routeIds, "route changed across reload");
    assert.deepEqual(
      after.days === null ? null : after.days.map((d) => d.id),
      before.days === null ? null : before.days.map((d) => d.id),
      "day ids changed across reload"
    );
    return `route ${after.routeIds.length}, days ${after.days === null ? "null" : after.days.length}`;
  });

  // ======================================================= JOURNEY C
  await step("C01 reservation mechanism surfaces for a catalogue entry", async () => {
    await seedPlan(["JP-044", "JP-050", "JP-001"]);
    await openPlanner();
    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(300);
    const body = await plannerDialog().textContent();
    assert.match(body, /Reservas por preparar|Fechas de reserva/,
      "no reservation surface for a plan containing JP-044");
    return "reservation surface present";
  });

  await step("C02 route-wide reservation calendar renders without duplicates", async () => {
    const calendar = page.locator("[aria-labelledby='official-reservation-calendar-heading']");
    if ((await calendar.count()) === 0) return "calendar not applicable to this plan";
    const rows = await calendar.locator("li").allTextContents();
    const normalised = rows.map((r) => r.replace(/\s+/g, " ").trim()).filter(Boolean);
    assert.equal(new Set(normalised).size, normalised.length,
      `duplicate reservation calendar rows: ${normalised.length - new Set(normalised).size}`);
    return `${normalised.length} unique rows`;
  });

  await step("C03 reservation dates derive from the anchored trip date", async () => {
    const body = await plannerDialog().textContent();
    assert.ok(/2027/.test(body), "reservation surface does not reference the trip year");
    assert.ok(!/1970|Invalid Date|NaN/.test(body), "reservation surface leaked an invalid date");
    return "derived from 2027 anchor";
  });

  await step("C04 purchase/residence context is not invented", async () => {
    const body = await plannerDialog().textContent();
    for (const forbidden of [/aplica para ti/i, /eres residente/i, /puedes comprar/i, /recomendamos/i]) {
      assert.ok(!forbidden.test(body), `reservation copy made a personal claim: ${forbidden}`);
    }
    return "no personal applicability claims";
  });

  /** Issue #118 §10: recorded hours and closure signals must never be upgraded into a claim
   * that a place is open or closed on a given date. The product's own vocabulary is hedged
   * ("Posibles coincidencias…", "…; revisar"); this asserts no unhedged claim has crept in. */
  await step("C05 hours and closure signals do not overclaim open/closed status", async () => {
    const body = await plannerDialog().textContent();
    const overclaims = [
      /\bestar[áa] abierto\b/i,
      /\bestar[áa] cerrado\b/i,
      /\babre a las\b/i,
      /\bcierra hoy\b/i,
      /\bconfirmado que abre\b/i,
      /\bgarantiza\b/i,
    ].filter((rx) => rx.test(body));
    assert.deepEqual(overclaims.map(String), [], `hours copy made an unhedged claim: ${overclaims}`);
    const weekday = page.locator(".weekday-signal");
    let weekdayState = "not rendered";
    if ((await weekday.count()) > 0) {
      // The hedge lives in the section's accessible name; the body then either reports
      // hedged matches or states that none were detected — never that a place is open.
      const label = await weekday.first().getAttribute("aria-label");
      assert.match(label ?? "", /Posibles coincidencias de cierre semanal/,
        `the weekday closure notice lost its hedged accessible name: ${label}`);
      const text = (await weekday.first().textContent()) ?? "";
      if (/coincidencia/i.test(text) && !/Sin coincidencias/i.test(text)) {
        assert.match(text, /posible/i, "a reported weekday match dropped its 'posible' hedge");
        assert.match(text, /confirma el horario\/cierre oficial/i,
          "a reported weekday match dropped its confirm-officially instruction");
        weekdayState = "hedged matches reported";
      } else {
        assert.match(text, /Sin coincidencias de cierre semanal detectadas/,
          `unexpected weekday copy: ${text.slice(0, 120)}`);
        weekdayState = "no matches detected";
      }
    }
    return `no unhedged open/closed claim; weekday notice: ${weekdayState}`;
  });

  /** Issue #118 §10: the manual visit-start control is only offered where a recorded interval
   * exists to compare against — every rendered input must sit beside its raw recorded datum. */
  await step("C06 visit-start fit is offered only beside a recorded interval", async () => {
    const items = page.locator(".recorded-interval-fit__item");
    const count = await items.count();
    if (count === 0) return "no eligible place in this plan";
    for (let i = 0; i < count; i += 1) {
      const text = await items.nth(i).textContent();
      assert.match(text, /Dato: «.+»/,
        `a visit-start control rendered without its raw recorded interval: ${text.slice(0, 80)}`);
      assert.equal(await items.nth(i).locator("input[type=time]").count(), 1,
        "recorded-interval item without exactly one time input");
    }
    const disclaimer = await page.locator(".recorded-interval-fit__disclaimer").first().textContent();
    assert.match(disclaimer, /No indica si el lugar abre/,
      "the visit-start disclaimer no longer disclaims opening status");
    return `${count} eligible place(s), all with recorded data`;
  });

  // ======================================================= JOURNEY D
  await step("D01 validated-static walking transfer is labelled as such", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const nearby = await detail().textContent();
    assert.match(nearby, /Ruta a pie validada/, "no validated walking transfer surfaced");
    return "validated-static labelled";
  });

  await step("D02 estimates are never promoted to validated", async () => {
    const text = await detail().textContent();
    const validated = (text.match(/Ruta a pie validada/g) ?? []).length;
    const estimated = (text.match(/estimaci[óo]n|estimado/gi) ?? []).length;
    assert.ok(validated > 0, "expected at least one validated label");
    // An estimate must never carry the validated wording on the same row.
    const rows = await detail().locator(".transfer, .place-detail__nearby li").allTextContents();
    const conflated = rows.filter((r) => /validada/.test(r) && /estimaci[óo]n/i.test(r));
    assert.deepEqual(conflated, [], `row claims both validated and estimated: ${conflated}`);
    return `${validated} validated, ${estimated} estimate mentions, 0 conflated`;
  });

  // ======================================================= JOURNEY E
  await step("E01 historical photograph renders from a local asset", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Golden Gai"); // JP-013, historical batch
    const src = await detail().locator(".gallery__image").getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `not a local asset: ${src}`);
    const ok = await detail().locator(".gallery__image").evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(ok, "historical photograph did not decode");
    return src;
  });

  await step("E02 Phase 4L photograph renders from a local asset", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Mount Takao"); // JP-051, Phase 4L batch
    const src = await detail().locator(".gallery__image").getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `not a local asset: ${src}`);
    const ok = await detail().locator(".gallery__image").evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(ok, "Phase 4L photograph did not decode");
    return src;
  });

  await step("E03 carried fail-closed target keeps its fallback", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("PokéPark KANTO"); // JP-050, fail-closed since Phase 4F
    assert.equal(await detail().locator(".gallery__image").count(), 0,
      "a fail-closed target must not render a photograph");
    const body = await detail().textContent();
    assert.match(body, /Sin fotograf[íi]a disponible todav[íi]a/i);
    return "fallback intact";
  });

  await step("E04 zero runtime photography-provider requests", async () => {
    const offenders = externalRequests.filter((u) => PHOTO_PROVIDER.test(u));
    assert.deepEqual(offenders, [], `photography provider contacted: ${offenders.slice(0, 3)}`);
    return `${externalRequests.length} external requests, 0 photographic`;
  });

  // ======================================================= ACCESSIBILITY
  /**
   * B19 (`04 §5.2`) puso el nombre del lugar SOBRE la fotografía de la tarjeta, dentro del mismo
   * control que la abre. La imagen pasó entonces a ser decorativa —`alt=""`, la forma correcta
   * de marcarla— porque repetir el nombre en el `alt` haría que un lector de pantalla lo
   * anunciara dos veces seguidas. Así que lo que hay que exigir no es «toda imagen tiene alt»,
   * sino: o la imagen tiene texto alternativo, o está marcada como decorativa Y su tarjeta
   * nombra el lugar por otro medio. Las dos mitades se comprueban.
   */
  await step("F01 every image is either labelled or deliberately decorative", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const report = await page.evaluate(() => {
      const decorative = (i) =>
        i.getAttribute("alt") === "" ||
        i.getAttribute("aria-hidden") === "true" ||
        i.getAttribute("role") === "presentation";
      const images = [...document.images].filter((i) => !i.closest(".leaflet-container"));
      const unlabelled = images
        .filter((i) => !i.alt && !decorative(i))
        .map((i) => i.currentSrc || i.src);
      /*
       * Una tarjeta con imagen decorativa tiene que nombrar el lugar por algún medio accesible.
       * DDR-02 cambió CUÁL: el control que abre es ahora un botón vacío que cubre la tarjeta y
       * lleva el nombre en `aria-label`, mientras el nombre visible vive en su propio elemento.
       * El requisito no cambia —la tarjeta nombra el lugar—, así que se aceptan las dos formas.
       */
      const unnamedCards = [...document.querySelectorAll(".place-card")]
        .filter((card) => {
          const img = card.querySelector("img");
          if (!img || !decorative(img)) return false;
          const opener = card.querySelector(".place-card__open");
          const accessibleName = (opener?.getAttribute("aria-label") ?? "").trim();
          const openerText = (opener?.textContent ?? "").trim();
          const visibleName = (
            card.querySelector(".place-card__name-text, .photo-placeholder__name, .place-card__heading")
              ?.textContent ?? ""
          ).trim();
          return accessibleName.length === 0 && openerText.length === 0 && visibleName.length === 0;
        })
        .map((card) => card.className);
      return { unlabelled, unnamedCards, total: images.length };
    });
    assert.deepEqual(report.unlabelled, [],
      `images with neither alt text nor a decorative marker: ${report.unlabelled.slice(0, 3)}`);
    assert.deepEqual(report.unnamedCards, [],
      `cards whose image is decorative but which never name the place: ${report.unnamedCards.slice(0, 3)}`);
    return `${report.total} images, all labelled or deliberately decorative`;
  });

  await step("F02 interactive controls use native semantics", async () => {
    const fake = await page.evaluate(() =>
      [...document.querySelectorAll("[onclick], div[role=button], span[role=button]")]
        .filter((n) => !n.closest(".leaflet-container"))
        .map((n) => n.tagName + "." + n.className).slice(0, 5)
    );
    assert.deepEqual(fake, [], `non-native click targets: ${fake}`);
    return "native buttons/links only";
  });

  await step("F03 form controls are labelled", async () => {
    await openPlanner();
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => {
          if (el.type === "hidden") return false;
          if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
          if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
          return !el.closest("label");
        })
        .map((el) => `${el.tagName}#${el.id || "(no id)"}`)
    );
    assert.deepEqual(unlabelled, [], `unlabelled form controls: ${unlabelled}`);
    return "all controls labelled";
  });

  await step("F04 keyboard reaches primary controls with visible focus", async () => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    assert.ok(first, "Tab did not move focus off <body>");
    const visible =
      (first.outline !== "none" && first.outlineWidth !== "0px") ||
      (first.boxShadow && first.boxShadow !== "none");
    assert.ok(visible, `focused ${first.tag} has no visible focus indicator`);
    return `${first.tag}, outline ${first.outline} ${first.outlineWidth}`;
  });

  await step("F05 no keyboard trap in the planner dialog", async () => {
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    await openPlanner();
    const seen = new Set();
    let repeats = 0;
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      const key = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}#${el.id}.${el.className}` : "none";
      });
      if (seen.has(key)) repeats += 1;
      seen.add(key);
    }
    assert.ok(seen.size > 5, `focus reached only ${seen.size} elements — the planner is not navigable`);
    /*
     * B18 (`02 §D2`, `05 §7`) dejó de montar el planificador como modal: es una sección
     * permanente de la pestaña Viaje, sin scrim ni `role="dialog"`. Un modal DEBE retener el
     * foco y ofrecer Escape como salida; una sección permanente no debe retenerlo en absoluto,
     * así que la salida ya no es «Escape lo cierra» —no hay nada que cerrar— sino que el foco
     * pueda ABANDONARLO tabulando. Es la misma garantía de fondo, expresada sobre la superficie
     * vigente: nadie se queda atrapado dentro.
     */
    const escaped = await page.evaluate(() => {
      const planner = document.querySelector(".analysis-dialog");
      return planner ? !planner.contains(document.activeElement) : true;
    });
    const reachedOutside =
      escaped ||
      (await (async () => {
        for (let i = 0; i < 80; i += 1) {
          await page.keyboard.press("Tab");
          const out = await page.evaluate(() => {
            const planner = document.querySelector(".analysis-dialog");
            return planner ? !planner.contains(document.activeElement) : true;
          });
          if (out) return true;
        }
        return false;
      })());
    assert.ok(reachedOutside, "focus never left the planner — it behaves as a trap");
    const focusAfter = await page.evaluate(
      () => `${document.activeElement?.tagName ?? "none"}.${String(document.activeElement?.className ?? "").slice(0, 40)}`
    );
    return `${seen.size} distinct stops, ${repeats} revisits, focus left the planner (now on ${focusAfter})`;
  });

  // ======================================================= RESPONSIVE
  await step("G01 no horizontal overflow on primary screens", async () => {
    const screens = [];
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    screens.push(["national", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await enterHub("Tokio", "Tokio");
    screens.push(["hub", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await ensurePlaceListVisible();
    screens.push(["hub+drawer", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await openPlace("Shibuya Crossing");
    screens.push(["detail", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await openPlanner();
    screens.push(["planner", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    const overflowing = screens.filter(([, delta]) => delta > 1);
    assert.deepEqual(overflowing, [], `horizontal overflow: ${JSON.stringify(overflowing)}`);
    return screens.map(([n, d]) => `${n}:${d}`).join(" ");
  });

  /**
   * El cajón «Buscar y filtrar» **desapareció** con B18/DD-016: la lista ya no se esconde detrás
   * de un toggle a ningún ancho — es la superficie primaria, y lo que se conmuta por debajo de
   * `lg` es Lista/Mapa. El requisito de fondo (que el lector pueda ir y volver entre lista y mapa
   * sin perder la lista) sigue vivo y es lo que se comprueba aquí.
   */
  await step("G01b list and map alternate without losing the list", async () => {
    await gotoHub("Tokio", "Tokio");
    const before = await page.locator(".place-card:not(.place-card--compact)").count();
    assert.ok(before > 0, "hub did not open on the list");
    const toMap = page.getByRole("button", { name: /^Mapa$/ });
    if ((await toMap.count()) === 0) {
      // `lg`+: mapa permanente, sin conmutador — y sin nada que perder.
      assert.ok(await page.locator(".place-map").isVisible(), "permanent map rail not visible");
      return `permanent map rail, ${before} places always visible`;
    }
    await toMap.click();
    await page.waitForTimeout(700);
    assert.ok(await page.locator(".place-map").isVisible(), "map pane did not take over");
    await page.getByRole("button", { name: /^Lista$/ }).click();
    await page.waitForTimeout(500);
    const after = await page.locator(".place-card:not(.place-card--compact)").count();
    assert.equal(after, before, "the list did not come back intact");
    return `${before} places, list -> map -> list`;
  });

  await step("G02 primary touch targets are usable", async () => {
    await gotoHub("Tokio", "Tokio");
    await ensurePlaceListVisible();
    const small = await page.evaluate(() => {
      const min = 32;
      return [...document.querySelectorAll(".place-card, .selection-panel__toggle, .chip-toggle")]
        .map((n) => ({ cls: n.className, h: Math.round(n.getBoundingClientRect().height) }))
        .filter((x) => x.h > 0 && x.h < min)
        .slice(0, 5);
    });
    assert.deepEqual(small, [], `touch targets under 32px: ${JSON.stringify(small)}`);
    return "all >= 32px";
  });

  await step("G03 planner remains operable at this viewport", async () => {
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    await openPlanner();
    const startDate = page.locator("#sequence-start-date");
    await startDate.waitFor({ state: "visible" });
    const box = await startDate.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0, "trip anchor control not visible");
    const covered = await startDate.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top && !el.contains(top) && top !== el ? top.className : null;
    });
    assert.equal(covered, null, `a fixed element covers the trip anchor control: ${covered}`);
    return `anchor ${Math.round(box.width)}x${Math.round(box.height)}`;
  });

  // ======================================================= RUNTIME
  await step("H01 no transit provider activated", async () => {
    const offenders = externalRequests.filter((u) => TRANSIT_PROVIDER.test(u));
    assert.deepEqual(offenders, [], `transit provider contacted: ${offenders.slice(0, 3)}`);
    return "dormant";
  });

  await step("H02 no secret-bearing or localhost-service request", async () => {
    const offenders = externalRequests.filter(
      (u) => /[?&](key|token|api[_-]?key|secret)=/i.test(u) || /localhost:\d+/.test(u)
    );
    assert.deepEqual(offenders, [], `suspicious request: ${offenders.slice(0, 3)}`);
    return "none";
  });

  await step("H03 external runtime requests are only the documented map tiles", async () => {
    const hosts = [...new Set(externalRequests.map((u) => new URL(u).host))];
    const undocumented = hosts.filter((h) => !/tile\.openstreetmap\.org$/.test(h));
    assert.deepEqual(undocumented, [], `undocumented external hosts: ${undocumented}`);
    return hosts.join(",") || "none";
  });

  await step("H04 core UI survives failed external tiles", async () => {
    await gotoHub("Tokio", "Tokio");
    await ensurePlaceListVisible();
    const count = await page.locator(".place-card:not(.place-card--compact)").count();
    assert.ok(count > 0, "place list did not render with stubbed tiles");
    return `${count} places rendered`;
  });

  await step("H05 no console errors and no page errors", async () => {
    const realConsole = consoleErrors.filter((t) => !/ERR_CERT_AUTHORITY_INVALID|net::ERR_/.test(t));
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.slice(0, 3)}`);
    assert.deepEqual(realConsole, [], `console errors: ${realConsole.slice(0, 3)}`);
    return `0 page errors, ${consoleErrors.length} network-stub console notices ignored`;
  });

  // ======================================================= PERSISTENCE
  await step("I01 clean first run starts empty", async () => {
    const fresh = await context.newPage();
    await fresh.route("**/*", (route) => {
      const t = route.request().url();
      if (t.startsWith(url) || t.startsWith("data:") || t.startsWith("blob:")) return route.continue();
      return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
    });
    await fresh.evaluate(() => {}).catch(() => {});
    await fresh.goto(url, { waitUntil: "networkidle" });
    await fresh.evaluate(() => localStorage.clear());
    await fresh.reload({ waitUntil: "networkidle" });
    const saved = await fresh.evaluate(() => localStorage.getItem("nihon.savedPlaceIds"));
    const body = await fresh.locator("body").textContent();
    assert.ok(!saved || saved === "[]", `clean profile carried saved state: ${saved}`);
    assert.ok(body.includes("Nihon"), "clean profile did not render");
    await fresh.close();
    return "empty and renders";
  });

  await step("I02 malformed persisted payloads fail safe", async () => {
    for (const payload of ['{"not":"an array"}', "[1,2,3]", "not json at all", '["JP-XXX"]']) {
      await page.evaluate((p) => {
        localStorage.setItem("nihon.savedPlaceIds", p);
        localStorage.setItem("nihon.manualPlanningDraft", p);
      }, payload);
      await page.reload({ waitUntil: "networkidle" });
      const body = await page.locator("body").textContent();
      assert.ok(body.includes("Nihon"), `app failed to render after payload ${payload}`);
      assert.deepEqual(pageErrors, [], `payload ${payload} raised a page error`);
    }
    return "4 malformed payloads survived";
  });

  await page.evaluate(() => localStorage.clear());
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}

console.log(
  `\n${results.length - failures.length}/${results.length} checks passed` +
    ` · ${externalRequests.length} external requests recorded`
);
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
}
