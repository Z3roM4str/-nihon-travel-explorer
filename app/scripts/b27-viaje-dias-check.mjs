import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B27 — B9.1 «Días como estructura» (`docs/BLOCK_27_MISSION.md`, `05 §7`,
 * `04 §14`, `10 §B9.1`). Comportamiento real en Chromium sobre la build de producción
 * (`npm run build` antes). Prefijos:
 *
 *   A apertura     Viaje abre en Días, sin «Distribuir por días», una línea de encuadre, sin cajas.
 *   D DayTimeline  cabecera, duración, nº de paradas, pies de día, fechas.
 *   S TripStop     miniatura 400w / fallback, conectores, «Traslado sin datos».
 *   H InterHub     fila entre ciudades (con y sin dato).
 *   U Sin asignar  cajón, contador, teclado, añadir con confirmación.
 *   M mutaciones   añadir/eliminar día (identidad estable), Mover a…, quitar del recorrido.
 *   R retiradas    trío ↑ ↓ × fuera; ninguna semántica de arrastre.
 *   K conservación comparación, alternativas, Reservas, Resumen, `Dato:` (NO se retira: B9.5).
 *   P persistencia esquema V8, clave, refresco.
 *   F ficha        DD-015: PlaceDetail dentro de Viaje, close/back a Días, scroll, instancia única.
 *   L layout       320/360/390/430/768/840/1200/1440: sin overflow, objetivos ≥44, tab bar.
 *   Y teclado/foco foco tras mutaciones, anuncio accesible.
 *   E estados      0 días, 1 día, día largo, muchos sin asignar, sin fechas, mismo hub.
 *   C consola      sin errores propios ni respuestas 4xx/5xx propias.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/b27-viaje-dias-check.mjs`
 * Capturas opcionales: `NIHON_B27_SHOTS=<dir>`.
 */

const executablePath = process.env.NIHON_CHROMIUM_PATH;
const SHOTS = process.env.NIHON_B27_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_KEY = "nihon.manualPlanningDraft";
const FRAMING = "Vosotros decidís el orden. Nihon sólo describe lo que ese orden implica.";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((p) => p.hub === hub).map((p) => p.id);
const NOPHOTO = "JP-041"; // Tokio, sin fotografía en el registro (verificado abajo)
const T = byHub("Tokio").filter((id) => id !== NOPHOTO);
const K = byHub("Kioto");
const O = byHub("Osaka");
const nameOf = (id) => places.find((p) => p.id === id).name;

const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const draft = (days, extra = {}) => ({
  version: 8,
  routeIds: days.flatMap((d) => d.placeIds),
  days: days.map((d) => ({ id: d.id, placeIds: d.placeIds, accommodationBoundary: d.boundary ?? unsel })),
  startDate: null,
  endDate: null,
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
  ...extra,
});
const ACC = { id: "acc-b27", label: "Hotel Prueba", location: { lat: 35.68, lng: 139.76 } };
const rich = () =>
  draft(
    [
      {
        id: "d1",
        placeIds: [T[0], T[1], NOPHOTO],
        boundary: { start: { kind: "unselected" }, end: { kind: "accommodation", accommodationId: ACC.id } },
      },
      { id: "d2", placeIds: [K[0], K[1]] },
      { id: "d3", placeIds: [] },
    ],
    { startDate: "2027-02-22", accommodations: [ACC] }
  );
const richSaved = () => [...rich().routeIds, O[0], O[1], O[2], O[3]];

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 220)}`);
  }
}
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls?.local[0];
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const external = [];

async function boot(viewport, { saved, plan } = {}) {
  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    external.push(u);
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(
    ({ saved, plan, once }) => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        if (once && sessionStorage.getItem("b27-seeded")) return;
        if (saved) localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
        if (plan) localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
        sessionStorage.setItem("b27-seeded", "1");
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    { saved: saved ?? null, plan: plan ?? null, once: true }
  );
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}
async function openViaje(page) {
  await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForTimeout(350);
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), DRAFT_KEY);
const dayCount = (page) => page.locator(".day-timeline").count();
const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const headline = (page, i) => page.locator(".day-timeline__title").nth(i).innerText();
const scroller = (page) => page.locator(".destination-panel:visible .destination-panel--scroll");
const openActions = async (page, placeId) => {
  await page.locator(`#stop-actions-${placeId}`).click();
  await page.locator(".sheet").waitFor();
};

const M = { width: 390, height: 844 };

// ─────────────────────────────── A / D / S / H / U / K / P — móvil, plan rico
{
  const { context, page } = await boot(M, { saved: richSaved(), plan: rich() });
  await openViaje(page);

  await ck("A01", "Viaje abre directamente en Días con DayTimeline visible", async () => {
    ok((await page.locator('.viaje-nav__item:has-text("Días")').getAttribute("aria-pressed")) === "true", "Días no está activa");
    ok(await page.locator(".day-timeline").first().isVisible(), "no hay DayTimeline");
    eq(await dayCount(page), 3, "nº de días");
  });
  await ck("A02", "no existe el paso «Distribuir por días» ni «Construir recorrido»", async () => {
    eq(await page.getByRole("button", { name: /Distribuir por días/ }).count(), 0, "botón");
    eq(await page.getByText(/Construir recorrido/).count(), 0, "título");
  });
  await ck("A03", "una sola línea de encuadre exacta, con EvidenceMark ✎", async () => {
    eq(await page.locator("[data-framing-line]").count(), 1, "líneas");
    const line = page.locator("[data-framing-line]");
    ok((await line.innerText()).includes(FRAMING), "texto exacto");
    eq(await line.locator(".evidence-mark").getAttribute("aria-label"), "Nihon dice", "marca");
    ok((await line.innerText()).includes("✎"), "glifo ✎");
    eq(await page.locator(".destination-panel:not([hidden]) .analysis-disclaimer").count(), 0, "cajas de descargo al abrir");
  });
  await ck("A04", "cabecera «Viaje» con rango/acción de fecha", async () => {
    eq(await page.locator("h2#sequence-builder-title").innerText(), "Viaje", "h2");
    ok(await page.getByRole("button", { name: /Cambiar fechas/ }).isVisible(), "acción de fechas");
    ok((await page.locator(".dias__range").innerText()).includes("22 feb"), "rango desde 22 feb");
  });
  await ck("D01", "cabecera de día: «Día N · fecha · ciudad», duración y nº de paradas", async () => {
    ok(/^Día 1 · lun 22 feb · Tokio$/.test(await headline(page, 0)), `d1: ${await headline(page, 0)}`);
    ok(/^Día 2 · mar 23 feb · Kioto$/.test(await headline(page, 1)), `d2: ${await headline(page, 1)}`);
    const meta = await page.locator(".day-timeline__meta").nth(0).innerText();
    ok(/de visitas/.test(meta) && /3 paradas/.test(meta), `meta d1: ${meta}`);
    ok(/0 paradas/.test(await page.locator(".day-timeline__meta").nth(2).innerText()), "día vacío: 0 paradas");
    ok(/^Día 3 · mié 24 feb$/.test(await headline(page, 2)), `día vacío sin ciudad inventada: ${await headline(page, 2)}`);
  });
  await ck("D02", "pie de día: con alojamiento «Dormís en …» y sin alojamiento «Sin alojamiento elegido»", async () => {
    ok((await page.locator(".day-timeline__sleep").nth(0).innerText()).includes("Dormís en Hotel Prueba"), "d1");
    ok((await page.locator(".day-timeline__sleep").nth(1).innerText()).includes("Sin alojamiento elegido"), "d2");
  });
  await ck("D03", "el pie enlaza a Dónde dormir y se puede volver a Días", async () => {
    await page.getByRole("button", { name: "Dónde dormir, desde el Día 1" }).click();
    await page.waitForSelector(".zone-panel, .zone-compare, .zone-card", { timeout: 8000 });
    ok((await page.locator('.viaje-nav__item:has-text("Dónde dormir")').getAttribute("aria-pressed")) === "true", "sección dormir");
    await page.locator('.viaje-nav__item:has-text("Días")').click();
    await page.waitForSelector(".day-timeline");
  });
  await ck("S01", "cada TripStop: miniatura 400w real, nombre y duración", async () => {
    const stops = page.locator(".day-timeline").first().locator(".trip-stop");
    eq(await stops.count(), 3, "paradas d1");
    const img = stops.nth(0).locator("img.trip-stop__image");
    const src = await img.getAttribute("src");
    ok(/-400w\.webp$/.test(src), `miniatura 400w: ${src}`);
    ok((await img.getAttribute("loading")) === "lazy", "lazy");
    await page.waitForFunction(() => [...document.querySelectorAll("img.trip-stop__image")].some((i) => i.complete && i.naturalWidth > 0));
    const box = await img.boundingBox();
    ok(Math.abs(box.width - 56) < 1.5 && Math.abs(box.height - 56) < 1.5, `56×56: ${box.width}×${box.height}`);
    ok((await stops.nth(0).locator(".trip-stop__name").innerText()) === nameOf(T[0]), "nombre");
    ok((await stops.nth(0).locator(".trip-stop__duration").innerText()).length > 0, "duración");
  });
  await ck("S02", "lugar sin fotografía: fallback, sin imagen rota", async () => {
    const stop = page.locator(`.trip-stop[data-place-id="${NOPHOTO}"]`);
    eq(await stop.locator("img").count(), 0, "img");
    ok(await stop.locator(".trip-stop__media--empty").isVisible(), "fallback");
  });
  await ck("S03", "conectores: traslado registrado con evidencia y «Traslado sin datos» (ni rojo ni ?)", async () => {
    const connectors = page.locator(".trip-connector");
    ok((await connectors.count()) >= 2, "conectores");
    const none = page.locator(".trip-connector--none").first();
    const txt = await none.innerText();
    ok(txt.trim() === "Traslado sin datos", `texto: «${txt}»`);
    ok(!txt.includes("?"), "sin ?");
    const color = await none.evaluate((el) => getComputedStyle(el).color);
    const [r, g, b] = color.match(/\d+/g).map(Number);
    ok(!(r > 150 && g < 90 && b < 90), `no rojo: ${color}`);
    ok((await page.locator(".trip-connector:not(.trip-connector--none) .evidence-mark").count()) >= 1, "marca de evidencia en traslado registrado");
  });
  await ck("H01", "InterHubSegment: fila entre Día 1/2 sin dato, con acción «Registrar traslado»", async () => {
    eq(await page.locator("[data-inter-hub-row]").count(), 1, "filas");
    const row = page.locator("[data-inter-hub-row]");
    const txt = await row.innerText();
    ok(/Tokio → Kioto/.test(txt) && /sin datos/.test(txt), txt);
    await row.scrollIntoViewIfNeeded();
    await shot(page, "dos-ciudades");
    await page.locator(".day-timeline").nth(2).scrollIntoViewIfNeeded();
    await shot(page, "dia-vacio");
    await row.getByRole("button", { name: "Registrar traslado" }).click();
    ok(await page.locator("details.dias__logistics").evaluate((d) => d.open), "sección de traslados abierta");
    ok(await page.getByText("Traslados entre ciudades").first().isVisible(), "formulario existente");
  });
  await ck("U01", "Sin asignar: cajón con contador, teclado y contenido", async () => {
    const handle = page.locator("button.unassigned__handle");
    ok((await handle.innerText()).includes("4 sitios sin día"), await handle.innerText());
    eq(await handle.getAttribute("aria-expanded"), "false", "cerrado");
    await handle.focus();
    await page.keyboard.press("Enter");
    eq(await handle.getAttribute("aria-expanded"), "true", "abierto con Enter");
    eq(await page.locator(".unassigned__item").count(), 4, "items");
    await shot(page, "sin-asignar-abierto");
    await page.keyboard.press("Space");
    eq(await handle.getAttribute("aria-expanded"), "false", "cerrado con Espacio");
  });
  // B29 (B9.3): «Probar otro orden» dejó de ser una vista global («Orden A / Orden B») y es una hoja
  // local a un día; las alternativas verificadas viven en ella y ya no en «Horarios, reservas…».
  await ck("K01", "capacidades conservadas: «Probar otro orden» local al día (B29) y vuelve a Días", async () => {
    await page.getByRole("button", { name: /^Probar otro orden en el Día 1$/ }).click();
    ok(await page.getByRole("heading", { name: "Orden actual", exact: true }).isVisible(), "Orden actual");
    ok(await page.getByRole("heading", { name: "Otro orden", exact: true }).isVisible(), "Otro orden");
    eq(await page.getByRole("heading", { name: "Orden A", exact: true }).count(), 0, "sin «Orden A» global");
    await page.getByRole("button", { name: "Cancelar" }).click();
    ok(await page.locator(".day-timeline").first().isVisible(), "de vuelta en Días");
  });
  await ck("K02", "alternativas verificadas: en la hoja del día (B29); totales y alojamiento siguen en las herramientas", async () => {
    const tools = page.locator("details.day-tools").first();
    await tools.locator("summary").click();
    ok(await tools.evaluate((d) => d.open), "abierto");
    ok((await tools.locator(".analysis-totals").count()) >= 1, "totales de visita/traslados del día");
    eq(await tools.locator("[aria-labelledby^='local-swap-heading']").count(), 0, "las alternativas ya no están en las herramientas");
    ok((await tools.locator(".accommodation-commute, [aria-label*='alojamiento' i], h4, h3").count()) >= 1, "alojamiento por día");
    await page.getByRole("button", { name: /^Probar otro orden en el Día 1$/ }).click();
    ok((await page.locator("[data-day-order-sheet] [aria-labelledby^='local-swap-heading']").count()) >= 1, "sección de alternativas locales en la hoja");
    await page.getByRole("button", { name: "Cancelar" }).click();
  });
  await ck("K03", "Reservas y Resumen alcanzables (superficie propia, secciones existentes)", async () => {
    await page.locator('.viaje-nav__item:has-text("Reservas")').click();
    await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
    await page.locator('.viaje-nav__item:has-text("Resumen")').click();
    await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
    // B31 (B9.5, 05 §10): la composición se presenta como cuatro tarjetas de resumen.
    ok(await page.locator(".trip-summary-card").first().isVisible(), "composición (tarjetas de Resumen, B31)");
    await page.locator('.viaje-nav__item:has-text("Días")').click();
    await page.waitForSelector(".day-timeline");
  });
  // B31 (10 §B9.5, DDR-05): contrato cambiado por diseño — B9.5 retira «Dato:» (03 §10): de «=4» a «0».
  await ck("K04", "«Dato:» retirado (B9.5, DDR-05): 0 apariciones en la fuente", async () => {
    const src = readFileSync(new URL("../src/components/OrderedSequenceBuilder.tsx", import.meta.url), "utf8");
    eq(src.split("Dato:").length - 1, 0, "apariciones en fuente");
  });
  await ck("P01", "borrador V8 con la clave de siempre y sin campos nuevos", async () => {
    const d = await stored(page);
    eq(d.version, 8, "versión");
    eq(Object.keys(d).sort(), Object.keys(rich()).sort(), "campos del borrador");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "ids de día estables");
  });
  await ck("P02", "refresco conserva el plan y vuelve a abrir en Días", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await openViaje(page);
    eq(await dayCount(page), 3, "días tras refresco");
    eq((await stored(page)).days.map((x) => x.id), ["d1", "d2", "d3"], "ids");
  });

  // ── Mutaciones sobre el mismo plan
  await ck("M01", "«Añadir día»: día nuevo con identidad estable, sin tocar los demás", async () => {
    const before = await stored(page);
    await page.getByRole("button", { name: /Añadir día/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".day-timeline").length === 4);
    const after = await stored(page);
    eq(after.days.slice(0, 3), before.days, "días previos idénticos");
    ok(after.days[3].id && !before.days.some((d) => d.id === after.days[3].id), "id nuevo y único");
    eq(after.days[3].placeIds, [], "vacío");
    eq(after.routeIds, before.routeIds, "routeIds");
    await page.reload({ waitUntil: "networkidle" });
    await openViaje(page);
    eq(await dayCount(page), 4, "persiste");
  });
  await ck("M02", "eliminar día vacío conserva el contrato (ids de los demás intactos)", async () => {
    const before = await stored(page);
    await page.getByRole("button", { name: "Eliminar Día 4" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".day-timeline").length === 3);
    eq((await stored(page)).days.map((d) => d.id), ["d1", "d2", "d3"], "ids");
    ok((await page.getByRole("button", { name: "Eliminar Día 1" }).isDisabled()), "día con lugares no se elimina");
    eq((await stored(page)).days.slice(0, 2), before.days.slice(0, 2), "días con lugares");
  });
  await ck("R01", "trío ↑ ↓ × retirado de cada fila; ninguna semántica de arrastre", async () => {
    eq(await page.locator(".trip-stop").locator("xpath=.//button[contains(@aria-label,'hacia arriba') or contains(@aria-label,'hacia abajo') or contains(@aria-label,'del recorrido')]").count(), 0, "botones ↑↓×");
    eq(await page.locator(".sequence-item__controls").count(), 0, "controles de fila");
    eq(await page.locator("[draggable='true'], [aria-grabbed], [ondragstart]").count(), 0, "drag");
  });
  await ck("R02", "cada parada tiene UNA acción con nombre accesible (parada N de M)", async () => {
    const b = page.locator(`#stop-actions-${T[1]}`);
    ok(/^Acciones de .+, parada 2 de 3$/.test(await b.getAttribute("aria-label")), await b.getAttribute("aria-label"));
  });
  await ck("M03", "Mover a… dentro del día: posición explícita, mismos ids/routeIds", async () => {
    const before = await stored(page);
    await openActions(page, T[0]);
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.getByLabel("Posición en el día").selectOption("2");
    await page.getByRole("button", { name: "Mover aquí" }).click();
    await page.locator(".sheet").waitFor({ state: "detached" });
    const after = await stored(page);
    eq(after.days[0].placeIds, [T[1], NOPHOTO, T[0]], "orden del día 1");
    eq(after.days.map((d) => d.id), before.days.map((d) => d.id), "ids");
    eq(after.routeIds, before.routeIds, "routeIds");
    eq(after.accommodations, before.accommodations, "alojamientos");
    eq(after.days[0].accommodationBoundary, before.days[0].accommodationBoundary, "límite de alojamiento del día");
  });
  await ck("Y01", "tras mover: foco en la acción de la parada movida y anuncio accesible", async () => {
    const focused = await page.evaluate(() => document.activeElement?.id);
    eq(focused, `stop-actions-${T[0]}`, "foco");
    const said = await page.locator("[data-day-announcer]").innerText();
    ok(/movido al Día 1, posición 3 de 3/.test(said), said);
  });
  await ck("M04", "Mover a… a otro día con posición: ids y routeIds intactos", async () => {
    const before = await stored(page);
    await openActions(page, T[1]);
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.locator(".sheet select").first().selectOption("1");
    await page.getByLabel("Posición en el día").selectOption("0");
    await page.getByRole("button", { name: "Mover aquí" }).click();
    await page.locator(".sheet").waitFor({ state: "detached" });
    const after = await stored(page);
    eq(after.days[1].placeIds, [T[1], K[0], K[1]], "día 2");
    eq(after.days[0].placeIds, [NOPHOTO, T[0]], "día 1");
    eq(after.days.map((d) => d.id), ["d1", "d2", "d3"], "ids");
    eq([...after.routeIds].sort(), [...before.routeIds].sort(), "routeIds");
  });
  await ck("Y02", "teclado: la hoja se abre con Enter, Escape la cierra y devuelve el foco", async () => {
    await page.locator(`#stop-actions-${K[0]}`).focus();
    await page.keyboard.press("Enter");
    await page.locator(".sheet").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".sheet").waitFor({ state: "detached" });
    eq(await page.evaluate(() => document.activeElement?.id), `stop-actions-${K[0]}`, "foco devuelto");
  });
  await ck("M05", "Quitar del día: va a Sin asignar, foco lógico (B28: sin rehacer el reparto)", async () => {
    await openActions(page, K[1]);
    await page.getByRole("button", { name: /Quitar del día/ }).click();
    // B28 (B9.2): «Quitar» ya no rehace el reparto (withPlaceRemovedFromDay); el aviso B27 ya no aplica.
    ok(/se quedan como están/.test(await page.locator(".sheet").innerText()), "aviso: los demás días no cambian");
    ok(!/rehace el reparto/.test(await page.locator(".sheet").innerText()), "ya no se rehace el reparto");
    await page.locator(".sheet").getByRole("button", { name: "Quitar del día" }).click();
    await page.waitForFunction(() => document.querySelector("button.unassigned__handle")?.textContent?.includes("5 sitios sin día"));
    const d = await stored(page);
    ok(!d.routeIds.includes(K[1]), "fuera de la ruta");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "B28: los ids de día siguen (sin rehacer el reparto)");
    eq(d.version, 8, "V8");
    eq(await page.evaluate(() => document.activeElement?.id), "unassigned-title", "foco en Sin asignar");
  });
  await ck("U02", "«Añadir al día…» desde Sin asignar: hoja día+posición, sin confirmar, foco en la parada (B28)", async () => {
    // B28 (B9.2): «Añadir al recorrido» (que rehacía el reparto) pasa a «Añadir al día…».
    await page.locator("button.unassigned__handle").click();
    await page.getByRole("button", { name: `Añadir ${nameOf(K[1])} al día…` }).click();
    await page.locator(".sheet").waitFor();
    await page.locator(".sheet").getByRole("button", { name: "Añadir aquí" }).click();
    await page.waitForFunction((id) => !!document.getElementById(`stop-handle-${id}`), K[1]);
    ok(!(await page.locator(".unassigned__confirm").count()), "sin confirmación");
    const d = await stored(page);
    ok(d.routeIds.includes(K[1]), "de vuelta en la ruta");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "ids de día intactos");
  });
  await context.close();
}

// ─────────────────────────────── K05 calendario oficial de reservas + `Dato:` en Reservas/día
{
  const plan = draft([{ id: "a", placeIds: [T[0]] }, { id: "b", placeIds: [K[0], "JP-050"] }], { startDate: "2027-02-22" });
  const { context, page } = await boot(M, { saved: plan.routeIds, plan });
  await openViaje(page);
  await ck("K05", "fechas oficiales de reserva: calendario en Reservas y aviso por día conservado; sin «Dato:»", async () => {
    await page.locator('.viaje-nav__item:has-text("Reservas")').click();
    // B31 (DDR-B31-02): la lista oficial es «Fechas oficiales», con su propio h3.
    await page.getByRole("heading", { name: "Fechas oficiales", level: 3 }).waitFor();
    ok(/PokéPark/.test(await page.locator(".viaje-surface").innerText()), "PokéPark en el calendario");
    await page.locator('.viaje-nav__item:has-text("Días")').click();
    await page.waitForSelector(".day-timeline");
    const tools = page.locator("details.day-tools").nth(1);
    await tools.locator("summary").click();
    ok((await tools.locator(".official-reservation-date").count()) >= 1, "aviso de fecha oficial por día");
    const dayText = (await page.locator(".destination-panel:not([hidden])").textContent()) ?? "";
    await page.locator('.viaje-nav__item:has-text("Reservas")').click();
    await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
    const reservasText = (await page.locator(".destination-panel:not([hidden]) .viaje-surface").textContent()) ?? "";
    // B31 (10 §B9.5, DDR-05): «Dato: «…»» → «…» + ◧ Registrado, en Días y en Reservas.
    ok(!/Dato:/.test(dayText + reservasText), "«Dato:» ya no aparece (Días ni Reservas)");
    ok(/«[^»]+»\s*◧ Registrado/.test(dayText + reservasText), "texto entre comillas + ◧ Registrado");
  });
  await context.close();
}

// ─────────────────────────────── U03 confirmación cuando el reparto es de varios días
{
  const { context, page } = await boot(M, { saved: richSaved(), plan: rich() });
  await openViaje(page);
  await ck("U03", "añadir desde Sin asignar con varios días NO rehace el reparto (B28 resuelve la deuda de B27)", async () => {
    // B27 exigía confirmar y rehacer el reparto en un solo día; B28 mete el lugar en un día y posición.
    await page.locator("button.unassigned__handle").click();
    await page.getByRole("button", { name: `Añadir ${nameOf(O[0])} al día…` }).click();
    await page.locator(".sheet").getByRole("button", { name: "Añadir aquí" }).click();
    await page.waitForFunction((id) => !!document.getElementById(`stop-handle-${id}`), O[0]);
    const d = await stored(page);
    eq(d.version, 8, "V8");
    eq(d.days.length, 3, "sigue habiendo 3 días");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "ids intactos");
    ok(d.routeIds.includes(O[0]), "en la ruta");
    eq(d.days[0].accommodationBoundary.end, { kind: "accommodation", accommodationId: ACC.id }, "alojamiento del día 1 intacto");
  });
  await context.close();
}

// ─────────────────────────────── H02 InterHub con dato + mismo hub
{
  const seg = { id: "ih1", fromPlaceId: T[0], toPlaceId: K[0], fromHub: "Tokio", toHub: "Kioto", mode: "shinkansen", minutes: 140, source: { kind: "user-entered" } };
  const plan = draft([{ id: "a", placeIds: [T[0]] }, { id: "b", placeIds: [K[0]] }], { interHubSegments: [seg] });
  const { context, page } = await boot(M, { saved: [T[0], K[0]], plan });
  await openViaje(page);
  await ck("H02", "InterHubSegment registrado: modo y minutos entre días, sin recalcular", async () => {
    const txt = await page.locator("[data-inter-hub-row]").innerText();
    ok(/Tokio → Kioto/.test(txt) && /Shinkansen · 140 min/.test(txt), txt);
    ok(/Editar traslado/.test(txt), "editable");
    eq((await stored(page)).interHubSegments, [seg], "modelo intacto");
  });
  await context.close();
}
{
  const plan = draft([{ id: "a", placeIds: [T[0], T[1]] }, { id: "b", placeIds: [T[2], T[3]] }]);
  const { context, page } = await boot(M, { saved: plan.routeIds, plan });
  await openViaje(page);
  await ck("E01", "mismo hub: sin fila entre ciudades", async () => {
    eq(await page.locator("[data-inter-hub-row]").count(), 0, "filas");
  });
  await context.close();
}

// ─────────────────────────────── E estados: 0 días, 1 día, largo, muchos, sin fechas
{
  const { context, page } = await boot(M, { saved: [O[0], O[1]], plan: { ...draft([]), days: null } });
  await openViaje(page);
  await ck("E02", "0 días: estado vacío honesto, Sin asignar con lo guardado, «Añadir día» crea uno vacío", async () => {
    eq(await dayCount(page), 0, "días");
    ok(await page.locator("[data-empty-trip]").isVisible(), "estado vacío");
    ok((await page.locator("button.unassigned__handle").innerText()).includes("2 sitios sin día"), "contador");
    await page.getByRole("button", { name: /Añadir día/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".day-timeline").length === 1);
    eq((await stored(page)).days[0].placeIds, [], "día vacío");
  });
  await context.close();
}
{
  const { context, page } = await boot(M, { saved: T.slice(0, 5) });
  await openViaje(page);
  await ck("E03", "1 día: sin borrador previo, Días se abre con un día con todo el recorrido (sin heurística)", async () => {
    await page.waitForSelector(".day-timeline");
    eq(await dayCount(page), 1, "días");
    eq(await page.locator(".trip-stop").count(), 5, "paradas");
    const d = await stored(page);
    eq(d.version, 8, "V8");
    eq(d.days.length, 1, "un día");
    eq(d.days[0].placeIds, d.routeIds, "orden = el del recorrido");
  });
  await ck("E04", "sin fechas: «Poner fecha de inicio» abre el panel; fijar fecha actualiza cabeceras", async () => {
    eq(await page.locator(".dias__range").count(), 0, "sin rango");
    await page.getByRole("button", { name: "Poner fecha de inicio" }).click();
    await page.locator("#sequence-start-date").fill("2027-03-01");
    await page.waitForFunction(() => /desde el 1 mar/.test(document.querySelector(".dias__range")?.textContent ?? ""));
    ok(/^Día 1 · lun 1 mar · Tokio$/.test(await headline(page, 0)), await headline(page, 0));
    eq((await stored(page)).startDate, "2027-03-01", "startDate");
    ok(await page.locator("#sequence-end-date").isVisible(), "fecha de fin disponible");
  });
  await context.close();
}
{
  const many = [...T, ...K, ...O];
  const long = draft([{ id: "L", placeIds: T.slice(0, 12) }]);
  const { context, page } = await boot(M, { saved: many, plan: long });
  await openViaje(page);
  await ck("E05", "día largo (12 paradas) y muchos sin asignar: sin overflow horizontal, panel con scroll propio", async () => {
    eq(await page.locator(".trip-stop").count(), 12, "paradas");
    const handle = page.locator("button.unassigned__handle");
    ok(/sitios sin día/.test(await handle.innerText()), "contador");
    await handle.click();
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ph: document.querySelector(".unassigned__panel").clientHeight, vh: innerHeight }));
    ok(m.sw <= m.cw, `overflow ${m.sw}>${m.cw}`);
    ok(m.ph <= m.vh * 0.51, `panel ${m.ph}px de ${m.vh}px`);
  });
  await context.close();
}

// ─────────────────────────────── F ficha dentro de Viaje (DD-015)
{
  const { context, page } = await boot(M, { saved: richSaved(), plan: rich() });
  await openViaje(page);
  await ck("F01", "abrir una parada apila PlaceDetail DENTRO de Viaje, con el chevron «Días»", async () => {
    await scroller(page).evaluate((el) => (el.scrollTop = 260));
    const before = await scroller(page).evaluate((el) => el.scrollTop);
    ok(before > 0, "hay scroll");
    await page.locator(`.trip-stop[data-place-id="${T[0]}"] .trip-stop__open`).click();
    await page.waitForSelector(".place-detail__back");
    ok((await page.locator(".place-detail__back").innerText()).includes("Días"), await page.locator(".place-detail__back").innerText());
    eq(await page.locator(".place-detail").count(), 1, "instancia única");
    await shot(page, "ficha-desde-tripstop");
    ok((await page.locator(".tab-bar__item[aria-current='page']").first().innerText()).includes("Viaje"), "sigue en Viaje");
    await page.locator(".place-detail__back").click();
    await page.waitForSelector(".day-timeline");
    await page.waitForTimeout(200);
    const after = await scroller(page).evaluate((el) => el.scrollTop);
    ok(Math.abs(after - before) <= 2, `scroll ${before} → ${after}`);
    ok((await page.locator('.viaje-nav__item:has-text("Días")').getAttribute("aria-pressed")) === "true", "Días");
  });
  await ck("F02", "browser back desde la ficha vuelve a Días (no a Explorar)", async () => {
    await page.locator(`.trip-stop[data-place-id="${T[1]}"] .trip-stop__open`).click();
    await page.waitForSelector(".place-detail__back");
    await page.goBack();
    await page.waitForSelector(".day-timeline");
    await page.waitForFunction(() => !document.querySelector(".place-detail__back"));
    ok((await page.locator(".tab-bar__item[aria-current='page']").first().innerText()).includes("Viaje"), "Viaje");
  });
  await ck("F03", "un lugar de «Sin asignar» también abre la ficha dentro de Viaje", async () => {
    await page.locator("button.unassigned__handle").click();
    await page.locator(".unassigned__open").first().click();
    await page.waitForSelector(".place-detail__back");
    eq(await page.locator(".place-detail").count(), 1, "una ficha");
    await page.locator(".place-detail__back").click();
    await page.waitForSelector(".day-timeline");
  });
  await context.close();
}

// ─────────────────────────────── L layout
const viewports = [
  [320, 700], [360, 740], [390, 844], [430, 932], [768, 1024], [840, 900], [1200, 800], [1440, 900],
];
for (const [w, h] of viewports) {
  const { context, page } = await boot({ width: w, height: h }, { saved: richSaved(), plan: rich() });
  await openViaje(page);
  await ck(`L${w}`, `${w}×${h}: sin overflow, objetivos ≥44, CTA visible y no tapado`, async () => {
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, main: document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll")?.scrollWidth, mainc: document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll")?.clientWidth }));
    ok(m.sw <= m.cw && m.main <= m.mainc, `overflow ${JSON.stringify(m)}`);
    for (const sel of [".trip-stop__open", ".trip-stop__actions", ".viaje-nav__item", ".sequence-add-day", ".dias__dates-toggle"]) {
      const b = await page.locator(sel).first().boundingBox();
      ok(b.height >= 43.5 && b.width >= 43.5, `${sel} ${b.width}×${b.height}`);
    }
    const nav = await page.locator(".tab-bar:visible").count();
    await page.locator(".sequence-add-day").scrollIntoViewIfNeeded();
    const add = await page.locator(".sequence-add-day").boundingBox();
    if (nav) {
      const tb = await page.locator(".tab-bar").boundingBox();
      ok(add.y + add.height <= tb.y + 1, `«Añadir día» bajo la tab bar (${add.y + add.height} > ${tb.y})`);
    }
    if (w >= 1200) {
      const un = await page.locator(".unassigned").boundingBox();
      const days = await page.locator(".day-timeline").first().boundingBox();
      ok(un.x >= days.x + days.width - 1, "lg: «Sin asignar» es una columna a la derecha");
      ok(await page.locator("#unassigned-panel").isVisible(), "lg: contenido visible sin abrir");
    }
    if (w === 390 || w === 768 || w === 1440) await shot(page, `dias-${w}`);
  });
  await context.close();
}

// ─────────────────────────────── C consola
await ck("C01", "sin errores de consola/página ni respuestas 4xx/5xx propias; sin red externa real", async () => {
  eq(pageErrors, [], "pageerror");
  eq(consoleErrors.filter((t) => !/Failed to load resource.*204|tile/i.test(t)), [], "console.error");
  eq(badResponses, [], "respuestas");
});

await browser.close();
await server.close();
console.log(`\nB27 Viaje › Días: ${pass}/${pass + failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
