import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Entrada moderna compartida por los gates históricos reescritos (release hardening, Fase 6).
 *
 * Los gates anteriores a B18/B25–B31 abrían las superficies por la interfaz de entonces (`.hub-bar__zones`, panel de guardados,
 * «Construir recorrido»). Estas utilidades siembran un viaje real (borrador V8 + personas) y abren la misma superficie por la
 * interfaz vigente (Viaje › Dónde dormir, ficha de lugar…), de modo que las AFIRMACIONES de cada gate se conservan y sólo cambia la entrada.
 */
export const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const DRAFT_KEY = "nihon.manualPlanningDraft";
export const TRAVELLERS_KEY = "nihon.travellers.v1";
export const ZONE_COMPARISON_KEY = "nihon.zoneComparison.v1";

export const places = JSON.parse(readFileSync(new URL("../../src/data/places.json", import.meta.url), "utf8"));
export const zones = JSON.parse(readFileSync(new URL("../../src/data/accommodation/zones.json", import.meta.url), "utf8")).zones;
export const byHub = (hub) => places.filter((p) => p.hub === hub);

export const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

export function parseArgs(argv = process.argv.slice(2)) {
  const viewportArg = (argv.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
  if (viewportArg !== "all" && !VIEWPORTS[viewportArg]) throw new Error(`unknown viewport: ${viewportArg}`);
  return { targets: viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg], browserPath: (argv.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined };
}

export async function launch({ browserPath } = {}) {
  const server = await preview({ root: APP_ROOT, preview: { host: "127.0.0.1", port: 0 } });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const type = process.env.NIHON_BROWSER === "webkit" ? webkit : chromium;
  const exe = browserPath ?? (type === chromium ? process.env.NIHON_CHROMIUM_PATH : undefined);
  const browser = await type.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  return { server, url, browser, close: async () => { await browser.close(); await server.close(); } };
}

/** Viaje de tres lugares en Tokio + uno de Kioto y dos deseos fuera de la ruta (misma forma que B30). */
export function tripFixture({ travellers = [{ id: "p1", label: "Marta" }], emptyRoute = false } = {}) {
  const tokyo = byHub("Tokio");
  const kyoto = byHub("Kioto");
  const tokyoTripIds = [tokyo[0].id, tokyo[1].id];
  const routeIds = emptyRoute ? [] : [...tokyoTripIds, kyoto[0].id];
  const savedIds = emptyRoute ? [tokyo[0].id, tokyo[1].id] : [...routeIds, tokyo[2].id, kyoto[1].id];
  const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
  const draft = {
    version: 8,
    routeIds,
    days: emptyRoute ? null : [
      { id: "d-tokyo", placeIds: [...tokyoTripIds], accommodationBoundary: none },
      { id: "d-kyoto", placeIds: [kyoto[0].id], accommodationBoundary: none },
    ],
    startDate: "2027-02-22",
    endDate: "2027-03-05",
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    interHubSegments: [],
    zoneAccommodationChoices: [],
  };
  const interests = savedIds.map((placeId) => ({ placeId, stances: travellers.map((t) => ({ travellerId: t.id, stance: "interested" })), carriedOver: false }));
  return { tokyo, kyoto, tokyoTripIds, routeIds, savedIds, draft, travellersDoc: { version: 1, travellers, activeTravellerId: travellers[0].id, interests } };
}

export async function newPage(browser, viewport, { fixture, seed = true, extraInit } = {}) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.dpr ?? 1, hasTouch: viewport.width <= 860 });
  const page = await context.newPage();
  const errors = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|ERR_NAME|tile\.openstreetmap|tile\.|Failed to load resource/i.test(m.text())) return;
    errors.push(m.text());
  });
  await context.addInitScript(({ f, seed }) => {
    window.__writes = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k.startsWith("nihon.")) window.__writes.push({ key: k }); return set.call(this, k, v); };
    if (localStorage.getItem("nihon.onboarding.seen.v1") === null) localStorage.setItem("nihon.onboarding.seen.v1", "1");
    if (seed && f && localStorage.getItem("nihon.manualPlanningDraft") === null && localStorage.getItem("nihon.travellers.v1") === null) {
      localStorage.setItem("nihon.travellers.v1", JSON.stringify(f.travellersDoc));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(f.draft));
    }
  }, { f: fixture ? { draft: fixture.draft, travellersDoc: fixture.travellersDoc } : null, seed });
  if (extraInit) await context.addInitScript(extraInit);
  return { context, page, errors, pageErrors };
}

/** Abre Viaje › Dónde dormir y espera a que el panel (embebido) esté listo y con el foco en «Cerrar dónde dormir». */
export async function openZones(page, url) {
  if (url) await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  await page.locator(".viaje-nav__item").filter({ hasText: "Dónde dormir" }).click();
  const panel = page.locator(".zone-panel.zone-panel--embedded");
  await panel.waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Cerrar dónde dormir"]'));
  return panel;
}

export function makeChecker(prefix) {
  const state = { passed: 0, failed: 0 };
  const check = (name, ok, detail = "") => {
    if (ok) { state.passed += 1; console.log(`  ✓ ${name}`); }
    else { state.failed += 1; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  };
  const summary = () => { console.log(`\n${"═".repeat(60)}\n${prefix}: ${state.passed} passed, ${state.failed} failed\n`); return state.failed === 0 ? 0 : 1; };
  return { state, check, summary };
}

export async function overflow(page, panelSel = ".zone-panel__scroll") {
  return page.evaluate((sel) => {
    const doc = document.documentElement;
    const panel = document.querySelector(sel);
    return { page: doc.scrollWidth > doc.clientWidth + 1, panel: panel ? panel.scrollWidth > panel.clientWidth + 1 : false };
  }, panelSel);
}
export const containsText = (haystack, needle) => haystack.toLocaleUpperCase("es").includes(needle.toLocaleUpperCase("es"));

/** Entra en una ciudad desde Explorar (portada o selector) y espera a su lista; si Explorar ya está en esa ciudad, la deja. */
export async function openCity(page, hub, url) {
  if (url) await page.goto(url, { waitUntil: "domcontentloaded" });
  const tab = page.locator('nav[aria-label="Navegación principal"]:visible button').filter({ hasText: "Explorar" }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(400); }
  const title = page.locator(".app__title--expand .app__title-text");
  if ((await page.locator(".place-card").first().isVisible().catch(() => false)) && (await title.count()) && (await title.first().innerText()).trim() === hub) return;
  const btn = page.locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`).filter({ hasText: new RegExp(`^${hub}\\b`) }).first();
  await btn.click();
  await page.waitForSelector(".place-card");
  await page.waitForTimeout(500);
}

/**
 * Viaje sembrado para los gates de zonas: las dos primeras paradas de Tokio, Kioto y Osaka como «Quiero ir» y como ruta (el gate original
 * las marcaba por la interfaz de entonces). Se escribe en el almacenamiento y se recarga UNA vez si aún no existe.
 */
export async function ensureSeed(page, { travellers = 1 } = {}) {
  const doc = {
    version: 1,
    travellers: travellers === 2 ? [{ id: "p1", label: "Marta" }, { id: "p2", label: "Jun" }] : [{ id: "p1", label: "Marta" }],
    activeTravellerId: "p1",
    interests: [],
  };
  const ids = ["Tokio", "Kioto", "Osaka"].flatMap((h) => byHub(h).slice(0, 2).map((p) => p.id));
  doc.interests = ids.map((placeId) => ({ placeId, stances: [{ travellerId: "p1", stance: "interested" }], carriedOver: false }));
  const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
  const draft = { version: 8, routeIds: ids, days: null, startDate: null, endDate: null, visitStartTimes: {}, accommodations: [], accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [] };
  void none;
  const seeded = await page.evaluate(({ doc, draft }) => {
    try {
      // La app escribe sus documentos por defecto al montar; se sobrescriben UNA vez por pestaña (la marca vive en sessionStorage).
      if (sessionStorage.getItem("__seeded") !== null) return false;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("nihon.travellers.v1", JSON.stringify(doc));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
      return true;
    } catch { return false; }
  }, { doc, draft });
  if (seeded) { await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(700); }
}

/** Dónde dormir de UNA ciudad por la entrada vigente de la lista de ciudad (B18/B19): «Dónde dormir en {ciudad}». */
export async function openZonesViaCity(page, hub, url, seedOptions) {
  if (url) await page.goto(url, { waitUntil: "domcontentloaded" });
  await ensureSeed(page, seedOptions);
  await openCity(page, hub);
  const entry = page.locator(".donde-dormir-entry");
  await entry.first().scrollIntoViewIfNeeded();
  await entry.first().click();
  const panel = page.locator(".zone-panel.zone-panel--embedded");
  await panel.waitFor();
  await page.waitForTimeout(600);
  return panel;
}

/** Marca dos zonas y abre la comparación. */
export async function compareFirstTwoZones(page) {
  await page.locator(".zone-card__compare input").nth(0).check();
  await page.locator(".zone-card__compare input").nth(1).check();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Comparar", exact: true }).last().click();
  await page.waitForTimeout(1400);
}

/** Siembra dos personas (para los gates que necesitan lector A/B). Debe llamarse con `context.addInitScript` ANTES de navegar. */
export function twoTravellersInit() {
  try {
    if (localStorage.getItem("nihon.travellers.v1") === null) {
      localStorage.setItem("nihon.travellers.v1", JSON.stringify({
        version: 1,
        travellers: [{ id: "p1", label: "Marta" }, { id: "p2", label: "Jun" }],
        activeTravellerId: "p1",
        interests: [],
      }));
    }
  } catch { /* documento sin almacenamiento */ }
}

/** Cambia de lector por la superficie vigente (Nosotros › Viajeros › «Usar este dispositivo como …»). */
export async function switchReader(page) {
  await page.locator('nav[aria-label="Navegación principal"]:visible button').filter({ hasText: "Nosotros" }).first().click();
  await page.waitForTimeout(500);
  // Sólo la persona que NO usa el dispositivo ofrece «Usar este dispositivo como …»: se pulsa ese botón.
  const use = page.locator(".traveller-card__use");
  await use.first().click();
  await page.waitForTimeout(400);
}

/**
 * Vuelve a Viaje › Dónde dormir y deja abierta la comparación de las zonas nombradas con la disclosure de las diez valoraciones abierta.
 * La pestaña permanece MONTADA entre visitas (B31 conserva el estado), así que puede seguir en la comparación; el gate original
 * reabría un diálogo nuevo cada vez.
 */
export async function reopenZonesAndCompare(page, zoneNames) {
  await page.locator('nav[aria-label="Navegación principal"]:visible button').filter({ hasText: "Viaje" }).first().click();
  await page.locator(".viaje-nav__item").filter({ hasText: "Dónde dormir" }).click();
  await page.locator(".zone-panel.zone-panel--embedded").waitFor();
  await page.waitForTimeout(700);
  if (!(await page.locator(".zone-compare").first().isVisible().catch(() => false))) {
    for (const name of zoneNames) {
      const box = page.locator(".zone-card").filter({ has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) }).first().locator(".zone-card__compare input");
      if (!(await box.isChecked())) await box.check();
      await page.waitForTimeout(200);
    }
    await page.getByRole("button", { name: "Comparar", exact: true }).last().click();
    await page.waitForTimeout(1300);
  }
  const axes = page.locator(".zone-axes");
  if ((await axes.getAttribute("open")) === null) { await axes.locator("summary").click(); await page.waitForTimeout(400); }
}

/** Cierra la pestaña Dónde dormir con su control vigente (antes: Escape cerraba el diálogo modal). */
export async function closeZonesTab(page) {
  const close = page.getByRole("button", { name: "Cerrar dónde dormir" });
  if (await close.count()) { await close.first().click(); await page.waitForTimeout(450); }
}

/** Dos paradas de Tokio y dos de Kioto en la ruta, repartidas en dos días por ciudad (el estado que el gate original construía con la interfaz de entonces). */
export function fourPlaceFixture() {
  const t = byHub("Tokio").slice(0, 2).map((p) => p.id);
  const k = byHub("Kioto").slice(0, 2).map((p) => p.id);
  const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
  const draft = {
    version: 8,
    routeIds: [...t, ...k],
    days: [
      { id: "d-tokyo", placeIds: t, accommodationBoundary: none },
      { id: "d-kyoto", placeIds: k, accommodationBoundary: none },
    ],
    startDate: null,
    endDate: null,
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    interHubSegments: [],
    zoneAccommodationChoices: [],
  };
  const travellers = [{ id: "p1", label: "Marta" }];
  const interests = [...t, ...k].map((placeId) => ({ placeId, stances: [{ travellerId: "p1", stance: "interested" }], carriedOver: false }));
  return { draft, travellersDoc: { version: 1, travellers, activeTravellerId: "p1", interests }, routeIds: [...t, ...k] };
}
