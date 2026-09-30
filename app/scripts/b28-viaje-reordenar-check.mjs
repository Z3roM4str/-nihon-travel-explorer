import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B28 — B9.2 «Reordenar» (`docs/BLOCK_28_MISSION.md`). Comportamiento real en
 * Chromium sobre la build de producción (`npm run build` antes). Línea Claude: continúa B27.
 *
 *   D puntero   arrastrar con ratón: mismo día, entre días, primero↔último, día vacío, Sin asignar
 *               (ida y vuelta), feedback durante el arrastre, cancelación (Escape / soltar fuera).
 *   T táctil    arrastre con eventos táctiles reales (CDP), `touch-action` sólo en el asa, scroll.
 *   K teclado   coger/mover/soltar/cancelar con el asa; foco y anuncio `aria-live`.
 *   M Mover a…  la alternativa completa (día + posición, día vacío, Añadir al día…, cancelar, foco).
 *   I invariantes  persistencia tras recargar, ids de día estables, sin duplicados ni pérdidas,
 *               conectores, alojamiento / legs intactos, hoja «Probar otro orden» (B29), PlaceDetail/back.
 *   L layout    320/360/390/430/768/840/1200/1440: sin overflow, objetivos ≥44, asa sin solaparse,
 *               arrastre y cancelación también en 320.
 *   C consola   sin errores propios.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/b28-viaje-reordenar-check.mjs`
 * Capturas opcionales: `NIHON_B28_SHOTS=<dir>`.
 */

const executablePath = process.env.NIHON_CHROMIUM_PATH;
const SHOTS = process.env.NIHON_B28_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_KEY = "nihon.manualPlanningDraft";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((p) => p.hub === hub).map((p) => p.id);
const NOPHOTO = "JP-041";
const T = byHub("Tokio").filter((id) => id !== NOPHOTO);
const K = byHub("Kioto");
const O = byHub("Osaka");
const nameOf = (id) => places.find((p) => p.id === id).name;

const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const ACC = { id: "acc-b28", label: "Hotel Prueba", location: { lat: 35.68, lng: 139.76 } };
const LEG = { direction: "place-to-accommodation", placeId: T[1], accommodationId: ACC.id, minutes: 20, source: { kind: "user-entered" } };
const D1 = [T[0], T[1], NOPHOTO];
const D2 = [K[0], K[1]];
const draft = () => ({
  version: 8,
  routeIds: [...D1, ...D2],
  days: [
    { id: "d1", placeIds: [...D1], accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "accommodation", accommodationId: ACC.id } } },
    { id: "d2", placeIds: [...D2], accommodationBoundary: unsel },
    { id: "d3", placeIds: [], accommodationBoundary: unsel },
  ],
  startDate: "2027-02-22",
  endDate: null,
  visitStartTimes: { [T[0]]: "09:30" },
  accommodations: [ACC],
  accommodationLegs: [LEG],
  interHubSegments: [],
  zoneAccommodationChoices: [],
});
const SAVED = () => [...draft().routeIds, O[0], O[1], O[2], O[3]];

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 260)}`);
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

async function boot(viewport, { touch = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: false });
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
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(
    ({ saved, plan }) => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        if (sessionStorage.getItem("b28-seeded")) return; // un reload NO vuelve a sembrar: prueba la persistencia
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
        localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
        sessionStorage.setItem("b28-seeded", "1");
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    { saved: SAVED(), plan: draft() }
  );
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForSelector(".day-timeline");
  await page.waitForTimeout(300);
  return { context, page };
}

const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), DRAFT_KEY);
const dayOrder = async (page) => (await stored(page)).days.map((d) => d.placeIds);
const domOrder = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".day-timeline")].map((d) => [...d.querySelectorAll(".trip-stop")].map((li) => li.dataset.placeId)));
const say = (page) => page.locator("[data-day-announcer]").innerText();
const activeId = (page) => page.evaluate(() => document.activeElement?.id ?? null);
const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const handle = (page, id) => page.locator(`#stop-handle-${id}`);
const unHandle = (page, id) => page.locator(`#unassigned-handle-${id}`);
const day = (page, i) => page.locator(".day-timeline").nth(i);
const stopBox = (page, id) => page.locator(`.trip-stop[data-place-id="${id}"]`).boundingBox();
const centerOf = async (loc) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const invariants = (before, after) => {
  eq(after.days.map((d) => d.id), before.days.map((d) => d.id), "ids de día");
  eq(after.accommodations, before.accommodations, "alojamientos");
  eq(after.accommodationLegs, before.accommodationLegs, "legs");
  eq(after.startDate, before.startDate, "fecha");
  eq(after.visitStartTimes, before.visitStartTimes, "horas");
  eq(after.version, 8, "V8");
  const flat = after.days.flatMap((d) => d.placeIds);
  eq(new Set(flat).size, flat.length, "duplicados");
  eq([...flat].sort(), [...after.routeIds].sort(), "days particiona routeIds");
};

/** Arrastre con ratón: pulsa el asa, mueve en pasos, (suelta). Devuelve el punto final. */
async function mouseDrag(page, fromLoc, to, { release = true } = {}) {
  const a = await centerOf(fromLoc);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  if (release) await page.mouse.up();
}
/** Punto «justo encima de la parada» (índice k del día, sin contar la arrastrada). */
const above = async (page, id) => {
  const b = await stopBox(page, id);
  return { x: b.x + b.width / 2, y: b.y + 3 };
};
const below = async (page, id) => {
  const b = await stopBox(page, id);
  return { x: b.x + b.width / 2, y: b.y + b.height - 3 };
};
/** Arrastre táctil real (CDP): eventos touch → pointer events con pointerType «touch». */
async function touchDrag(cdp, from, to, { release = true, steps = 14 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + 6, y: from.y + 6, id: 1 }] });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }],
    });
  }
  if (release) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

// ───────────────────────────── D puntero (escritorio, alto suficiente para ver los tres días)
{
  const { context, page } = await boot({ width: 1440, height: 1500 });
  const seed = await stored(page);

  await ck("D01", "mismo día: arrastrar la primera bajo la última (primero → último)", async () => {
    await mouseDrag(page, handle(page, T[0]), await below(page, NOPHOTO));
    await page.waitForFunction((id) => !document.querySelector(".stop-ghost") && document.querySelector(`.trip-stop[data-place-id="${id}"]`), T[0]);
    eq((await dayOrder(page))[0], [T[1], NOPHOTO, T[0]], "orden persistido");
    eq((await domOrder(page))[0], [T[1], NOPHOTO, T[0]], "orden en pantalla");
    invariants(seed, await stored(page));
  });
  await ck("D02", "mismo día: último → primero", async () => {
    await mouseDrag(page, handle(page, T[0]), await above(page, T[1]));
    await page.waitForTimeout(150);
    eq((await dayOrder(page))[0], [T[0], T[1], NOPHOTO], "orden persistido");
  });
  await ck("D03", "feedback durante el arrastre: fantasma, atenuada, barra de inserción y día destino", async () => {
    const a = await centerOf(handle(page, T[0]));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
    const target = await above(page, K[1]);
    await page.mouse.move(target.x, target.y, { steps: 12 });
    ok(await page.locator(".stop-ghost").isVisible(), "fantasma visible");
    ok(/Día 2 .*posición 2 de 3/.test(await page.locator(".stop-ghost__where").innerText()), await page.locator(".stop-ghost__where").innerText());
    ok((await page.locator(`.trip-stop[data-place-id="${T[0]}"]`).getAttribute("class")).includes("trip-stop--dragging"), "origen atenuado");
    eq(await page.locator(".trip-stop--drop-before").count(), 1, "una barra de inserción");
    eq(await page.locator(".trip-stop--drop-before").getAttribute("data-place-id"), K[1], "barra antes de la parada destino");
    ok((await day(page, 1).getAttribute("class")).includes("day-timeline--drop-target"), "día 2 resaltado");
    ok(/Soltar en Día 2, posición 2 de 3/.test(await say(page)), await say(page));
    await shot(page, "arrastrando-1440");
    eq((await dayOrder(page))[0], [T[0], T[1], NOPHOTO], "durante el arrastre NO se ha persistido nada");
    await page.mouse.up();
  });
  await ck("D04", "entre días: T[0] cae entre las dos paradas del día 2; ids de día intactos", async () => {
    await page.waitForTimeout(150);
    eq(await dayOrder(page), [[T[1], NOPHOTO], [K[0], T[0], K[1]], []], "orden");
    invariants(seed, await stored(page));
    ok(/movido al Día 2, posición 2 de 3/.test(await say(page)), await say(page));
    eq(await activeId(page), `stop-handle-${T[0]}`, "foco en el asa de la parada movida");
  });
  await ck("D05", "conectores tras mover: N−1 por día, sin filas rotas", async () => {
    const counts = await page.evaluate(() => [...document.querySelectorAll(".day-timeline")].map((d) => [d.querySelectorAll(".trip-stop").length, d.querySelectorAll(".trip-connector").length]));
    eq(counts, [[2, 1], [3, 2], [0, 0]], "paradas/conectores");
    ok((await page.locator(".trip-connector").first().innerText()).length > 0, "conector con texto");
  });
  await ck("D06", "a un día vacío: zona «Suelta aquí» y la parada llega sola", async () => {
    const a = await centerOf(handle(page, NOPHOTO));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
    const empty = await centerOf(day(page, 2).locator(".day-timeline__empty"));
    await page.mouse.move(empty.x, empty.y, { steps: 14 });
    ok(/Suelta aquí/.test(await day(page, 2).locator(".day-timeline__empty").innerText()), "zona de suelta en el día vacío");
    await shot(page, "arrastrando-dia-vacio-1440");
    await page.mouse.up();
    await page.waitForTimeout(150);
    eq(await dayOrder(page), [[T[1]], [K[0], T[0], K[1]], [NOPHOTO]], "orden");
    invariants(seed, await stored(page));
  });
  await ck("D07", "día → Sin asignar: sale de la ruta sin rehacer el reparto; contador sube", async () => {
    const un = await centerOf(page.locator("[data-unassigned]"));
    await mouseDrag(page, handle(page, K[1]), un, { release: false });
    ok((await page.locator("[data-unassigned]").getAttribute("class")).includes("unassigned--drop-target"), "Sin asignar resaltado");
    await page.mouse.up();
    await page.waitForTimeout(150);
    const d = await stored(page);
    ok(!d.routeIds.includes(K[1]), "fuera de la ruta");
    eq(d.days.map((x) => x.placeIds), [[T[1]], [K[0], T[0]], [NOPHOTO]], "los demás días no cambian");
    invariants({ ...seed, routeIds: d.routeIds }, d);
    ok((await page.locator("#unassigned-title").innerText()).includes("5 sitios sin día"), await page.locator("#unassigned-title").innerText());
    eq(await activeId(page), "unassigned-title", "foco lógico");
  });
  await ck("D08", "Sin asignar → día (ruta inversa): la parada entra en el hueco exacto", async () => {
    await mouseDrag(page, unHandle(page, K[1]), await above(page, K[0]));
    await page.waitForTimeout(150);
    eq(await dayOrder(page), [[T[1]], [K[1], K[0], T[0]], [NOPHOTO]], "orden");
    ok((await stored(page)).routeIds.includes(K[1]), "de vuelta en la ruta");
    ok((await page.locator("#unassigned-title").innerText()).includes("4 sitios sin día"), "contador baja");
    eq(await activeId(page), `stop-handle-${K[1]}`, "foco en el asa");
  });
  await ck("D09", "Sin asignar → día vacío y a una posición final", async () => {
    await mouseDrag(page, unHandle(page, O[0]), await below(page, T[1]));
    await page.waitForTimeout(150);
    eq((await dayOrder(page))[0], [T[1], O[0]], "al final del día 1");
    const d = await stored(page);
    ok(d.routeIds.includes(O[0]), "en la ruta");
    eq(d.days[0].accommodationBoundary.end, { kind: "accommodation", accommodationId: ACC.id }, "alojamiento del día 1 intacto");
  });
  await ck("D10", "cancelar con Escape a mitad de arrastre: nada cambia, anuncio de cancelación", async () => {
    const before = await stored(page);
    const a = await centerOf(handle(page, T[1]));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
    const t = await above(page, K[0]);
    await page.mouse.move(t.x, t.y, { steps: 10 });
    ok(await page.locator(".stop-ghost").isVisible(), "arrastrando");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".stop-ghost"));
    await page.mouse.up();
    eq(await stored(page), before, "borrador idéntico");
    ok(/cancelado/i.test(await say(page)), await say(page));
    eq(await page.locator(".trip-stop--dragging, .trip-stop--drop-before, .trip-stop--drop-after, .day-timeline--drop-target").count(), 0, "sin restos visuales");
  });
  await ck("D11", "soltar fuera de cualquier destino cancela", async () => {
    const before = await stored(page);
    await mouseDrag(page, handle(page, T[1]), { x: 4, y: 4 });
    await page.waitForTimeout(150);
    eq(await stored(page), before, "borrador idéntico");
    ok(/cancelado/i.test(await say(page)), await say(page));
  });
  await ck("D12", "soltar en la misma posición no escribe nada", async () => {
    const before = await stored(page);
    const b = await stopBox(page, T[1]);
    await mouseDrag(page, handle(page, T[1]), { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await page.waitForTimeout(150);
    eq(await stored(page), before, "borrador idéntico");
  });
  await ck("I01", "persistencia: recargar conserva el orden, sin duplicados ni pérdidas", async () => {
    const before = await stored(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
    await page.waitForSelector(".day-timeline");
    eq(await stored(page), before, "borrador tras recargar");
    eq(await domOrder(page), before.days.map((d) => d.placeIds), "orden en pantalla tras recargar");
  });
  // B29 (B9.3): la comparación global A/B se retiró; la hoja local al día no toca el plan al abrir/cancelar.
  await ck("I02", "«Probar otro orden» (hoja del día, B29) abre y cancela sin cambiar el orden reordenado", async () => {
    const before = await dayOrder(page);
    await page.getByRole("button", { name: /^Probar otro orden en el Día 1$/ }).click();
    ok(await page.getByRole("heading", { name: "Orden actual", exact: true }).isVisible(), "Orden actual");
    ok(await page.getByRole("heading", { name: "Otro orden", exact: true }).isVisible(), "Otro orden");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.waitForSelector(".day-timeline");
    eq(await dayOrder(page), before, "el plan no cambió al probar");
  });
  await ck("I03", "PlaceDetail apilado y back intactos tras reordenar; el asa no abre la ficha", async () => {
    await handle(page, T[1]).click(); // un clic en el asa no hace nada
    eq(await page.locator(".place-detail").count(), 0, "el asa no abre la ficha");
    await page.locator(`.trip-stop[data-place-id="${T[1]}"] .trip-stop__open`).click();
    await page.waitForSelector(".place-detail__back");
    ok((await page.locator(".place-detail__back").innerText()).includes("Días"), "chevron Días");
    await page.goBack();
    await page.waitForSelector(".day-timeline");
    await page.waitForFunction(() => !document.querySelector(".place-detail__back"));
  });
  await context.close();
}

// ───────────────────────────── K teclado (móvil 390)
{
  const { context, page } = await boot({ width: 390, height: 844 });
  const seed = await stored(page);
  await ck("K01", "el asa es un botón con nombre «Reordenar X, parada N de M» y descripción de uso", async () => {
    const h = handle(page, T[0]);
    eq(await h.getAttribute("aria-label"), `Reordenar ${nameOf(T[0])}, parada 1 de 3`, "nombre");
    eq(await h.getAttribute("aria-describedby"), "reorder-instructions", "descripción");
    ok(/Espacio o Intro coge/.test(await page.locator("#reorder-instructions").innerText()), "instrucciones");
    eq(await h.evaluate((el) => el.tagName), "BUTTON", "botón nativo");
  });
  await ck("K02", "Espacio coge, ↓↓ mueve, Intro suelta: mismo día, con anuncio en vivo y foco restaurado", async () => {
    await handle(page, T[0]).focus();
    await page.keyboard.press("Space");
    eq(await handle(page, T[0]).getAttribute("aria-pressed"), "true", "aria-pressed al coger");
    ok(/cogido/.test(await say(page)), await say(page));
    await page.keyboard.press("ArrowDown");
    ok(/Día 1, posición 2 de 3/.test(await say(page)), await say(page));
    await shot(page, "teclado-cogido-390");
    await page.keyboard.press("ArrowDown");
    eq((await dayOrder(page))[0], [T[0], T[1], NOPHOTO], "durante el movimiento nada se persiste");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    eq((await dayOrder(page))[0], [T[1], NOPHOTO, T[0]], "orden");
    ok(/movido al Día 1, posición 3 de 3/.test(await say(page)), await say(page));
    eq(await activeId(page), `stop-handle-${T[0]}`, "foco");
    eq(await handle(page, T[0]).getAttribute("aria-pressed"), null, "suelto");
    invariants(seed, await stored(page));
  });
  await ck("K03", "teclado entre días: ↓ cruza al día siguiente por su extremo", async () => {
    await handle(page, T[1]).focus();
    await page.keyboard.press("Space");
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowDown");
    ok(/Día 2, posición 1 de 3/.test(await say(page)), await say(page));
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    eq(await dayOrder(page), [[NOPHOTO, T[0]], [T[1], K[0], K[1]], []], "orden");
    invariants(seed, await stored(page));
  });
  await ck("K04", "Escape cancela: nada cambia, anuncio y el foco sigue en el asa", async () => {
    const before = await stored(page);
    await handle(page, K[0]).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Escape");
    eq(await stored(page), before, "sin cambios");
    ok(/cancelado/i.test(await say(page)), await say(page));
    eq(await activeId(page), `stop-handle-${K[0]}`, "foco");
    eq(await handle(page, K[0]).getAttribute("aria-pressed"), null, "no está cogida");
  });
  await ck("K05", "salir del asa (Tab) mientras se lleva una parada cancela, no suelta", async () => {
    const before = await stored(page);
    await handle(page, K[0]).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Tab");
    eq(await stored(page), before, "sin cambios");
    eq(await page.locator("[aria-pressed='true'].trip-stop__handle").count(), 0, "nada cogido");
  });
  await ck("K06", "teclado hasta Sin asignar: ↓ pasado el último día quita del día sin rehacer el reparto", async () => {
    await handle(page, K[1]).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown"); // Día 3 (vacío)
    ok(/Día 3, posición 1 de 1/.test(await say(page)), await say(page));
    await page.keyboard.press("ArrowDown");
    ok(/Sin asignar/.test(await say(page)), await say(page));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const d = await stored(page);
    ok(!d.routeIds.includes(K[1]), "fuera de la ruta");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "ids");
    eq(await activeId(page), "unassigned-title", "foco");
  });
  await ck("K07", "teclado desde Sin asignar: ↑ entra en el último día (vacío) y Intro lo añade", async () => {
    await page.locator("button.unassigned__handle").click();
    await unHandle(page, O[1]).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    ok(/Día 3, posición 1 de 1/.test(await say(page)), await say(page));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    eq((await dayOrder(page))[2], [O[1]], "día 3");
    eq(await activeId(page), `stop-handle-${O[1]}`, "foco");
    invariants({ ...seed, routeIds: (await stored(page)).routeIds }, await stored(page));
  });
  await context.close();
}

// ───────────────────────────── M «Mover a…» sigue siendo la alternativa completa
{
  const { context, page } = await boot({ width: 390, height: 844 });
  const seed = await stored(page);
  const actions = (id) => page.locator(`#stop-actions-${id}`);
  await ck("M01", "Mover a… en el mismo día: elegir posición; anuncio y foco en la acción", async () => {
    await actions(T[0]).click();
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.locator(".sheet select").nth(1).selectOption("2");
    await page.locator(".sheet").getByRole("button", { name: "Mover aquí" }).click();
    await page.waitForTimeout(150);
    eq((await dayOrder(page))[0], [T[1], NOPHOTO, T[0]], "orden");
    ok(/movido al Día 1, posición 3 de 3/.test(await say(page)), await say(page));
    eq(await activeId(page), `stop-actions-${T[0]}`, "foco");
    invariants(seed, await stored(page));
  });
  await ck("M02", "Mover a… otro día (vacío): día y posición; primero → día 3", async () => {
    await actions(T[1]).click();
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.locator(".sheet select").nth(0).selectOption("2");
    await page.locator(".sheet").getByRole("button", { name: "Mover aquí" }).click();
    await page.waitForTimeout(150);
    eq(await dayOrder(page), [[NOPHOTO, T[0]], D2, [T[1]]], "orden");
    invariants(seed, await stored(page));
  });
  await ck("M03", "cancelar: Escape cierra la hoja sin cambios y devuelve el foco a la acción", async () => {
    const before = await stored(page);
    await actions(K[0]).click();
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.locator(".sheet select").nth(0).selectOption("0");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".sheet"));
    eq(await stored(page), before, "sin cambios");
    eq(await activeId(page), `stop-actions-${K[0]}`, "foco");
  });
  await ck("M04", "«Añadir al día…» desde Sin asignar: elige día y posición, sin rehacer el reparto", async () => {
    await page.locator("button.unassigned__handle").click();
    await page.getByRole("button", { name: `Añadir ${nameOf(O[2])} al día…` }).click();
    await page.locator(".sheet select").nth(0).selectOption("1");
    await page.locator(".sheet select").nth(1).selectOption("0");
    await page.locator(".sheet").getByRole("button", { name: "Añadir aquí" }).click();
    await page.waitForTimeout(150);
    const d = await stored(page);
    eq(d.days[1].placeIds, [O[2], ...D2], "día 2");
    eq(d.days.map((x) => x.id), ["d1", "d2", "d3"], "ids");
    ok(/añadido al Día 2, posición 1 de 3/.test(await say(page)), await say(page));
  });
  await ck("M05", "«Añadir al día…» cancelar devuelve el foco al botón del cajón", async () => {
    const before = await stored(page);
    await page.getByRole("button", { name: `Añadir ${nameOf(O[3])} al día…` }).click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    eq(await stored(page), before, "sin cambios");
    eq(await activeId(page), `unassigned-add-${O[3]}`, "foco");
  });
  await ck("M06", "reordenar días (↑ ↓ de día) se conserva y mueve la entidad con sus paradas", async () => {
    const before = await stored(page);
    await page.getByRole("button", { name: "Mover Día 2 hacia arriba" }).click();
    await page.waitForTimeout(150);
    const d = await stored(page);
    eq(d.days.map((x) => x.id), ["d2", "d1", "d3"], "orden de días");
    eq(d.days[0], before.days[1], "la entidad viaja entera");
  });
  await context.close();
}

// ───────────────────────────── T táctil (móvil 390, touch real)
{
  const { context, page } = await boot({ width: 390, height: 844 }, { touch: true });
  const cdp = await context.newCDPSession(page);
  const seed = await stored(page);
  await ck("T01", "`touch-action: none` SOLO en el asa; la tarjeta y el resto siguen desplazándose", async () => {
    const styles = await page.evaluate((id) => {
      const li = document.querySelector(`.trip-stop[data-place-id="${id}"]`);
      const ta = (el) => getComputedStyle(el).touchAction;
      return {
        handle: ta(li.querySelector(".trip-stop__handle")),
        card: ta(li.querySelector(".trip-stop__card")),
        open: ta(li.querySelector(".trip-stop__open")),
        actions: ta(li.querySelector(".trip-stop__actions")),
        list: ta(li.closest("ol")),
        body: ta(document.body),
      };
    }, T[0]);
    eq(styles.handle, "none", "asa");
    for (const key of ["card", "open", "actions", "list", "body"]) ok(styles[key] !== "none", `${key}: ${styles[key]}`);
  });
  await ck("T02", "un gesto de scroll que empieza en el cuerpo de una parada SÍ desplaza la pantalla", async () => {
    const sc = page.locator(".destination-panel:visible .destination-panel--scroll");
    await sc.evaluate((el) => (el.scrollTop = 0));
    const b = await page.locator(`.trip-stop[data-place-id="${T[1]}"] .trip-stop__text`).boundingBox();
    const x = b.x + b.width / 2;
    const y = Math.min(b.y + b.height / 2, 560);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 10; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(400);
    ok((await sc.evaluate((el) => el.scrollTop)) > 40, "la pantalla no se desplazó");
    await sc.evaluate((el) => (el.scrollTop = 0));
    eq(await stored(page), seed, "un scroll no toca el plan");
    eq(await page.locator(".stop-ghost").count(), 0, "un scroll no arranca un arrastre");
  });
  await ck("T06", "auto-scroll: llevar una parada al borde superior desplaza la lista (sin perder nada)", async () => {
    await page.setViewportSize({ width: 390, height: 600 });
    const sc = page.locator(".destination-panel:visible .destination-panel--scroll");
    await sc.evaluate((el) => (el.scrollTop = 420));
    const before = await sc.evaluate((el) => el.scrollTop);
    ok(before > 100, `hay recorrido de scroll (${before})`);
    const vis = await page.evaluate(() => {
      const ids = [...document.querySelectorAll(".trip-stop")].filter((li) => {
        const r = li.querySelector(".trip-stop__handle").getBoundingClientRect();
        return r.top > 120 && r.bottom < 480;
      });
      return ids[0]?.dataset.placeId;
    });
    ok(vis, "una parada visible");
    const from = await centerOf(handle(page, vis));
    await touchDrag(cdp, from, { x: from.x, y: 30 }, { release: false });
    await page.waitForTimeout(700);
    const during = await sc.evaluate((el) => el.scrollTop);
    ok(during < before - 40, `auto-scroll ${before} → ${during}`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.waitForTimeout(100);
    invariants(seed, await stored(page));
    eq(await page.locator(".stop-ghost").count(), 0, "sin fantasma");
  });
  await ck("T05", "pointercancel (el sistema toma el gesto) cancela el arrastre sin mover nada", async () => {
    const before = await stored(page);
    await page.locator(".destination-panel:visible .destination-panel--scroll").evaluate((el) => (el.scrollTop = 0));
    const from = await centerOf(handle(page, T[1]));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x, y: from.y + 40, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.waitForTimeout(150);
    eq(await stored(page), before, "sin cambios");
    eq(await page.locator(".stop-ghost").count(), 0, "sin fantasma");
    eq(await page.evaluate(() => document.body.classList.contains("is-reordering")), false, "sin estado de arrastre en body");
  });
  await context.close();
}

{
  const { context, page } = await boot({ width: 390, height: 2500 }, { touch: true });
  const cdp = await context.newCDPSession(page);
  const seed = await stored(page);
  await ck("T03", "arrastre táctil real: mueve entre días, con anuncio y sin quedarse colgado", async () => {
    const from = await centerOf(handle(page, T[0]));
    const to = await above(page, K[1]);
    await touchDrag(cdp, from, to);
    await page.waitForTimeout(200);
    eq(await dayOrder(page), [[T[1], NOPHOTO], [K[0], T[0], K[1]], []], "orden tras el arrastre táctil");
    invariants(seed, await stored(page));
    eq(await page.locator(".stop-ghost").count(), 0, "sin fantasma colgado");
  });
  await ck("T04", "arrastre táctil hasta Sin asignar (cajón cerrado, asa visible) y de vuelta a un día", async () => {
    const un = await centerOf(page.locator("[data-unassigned]"));
    await page.locator(`.trip-stop[data-place-id="${K[1]}"]`).scrollIntoViewIfNeeded();
    const from = await centerOf(handle(page, K[1]));
    await touchDrag(cdp, from, un);
    await page.waitForTimeout(200);
    ok(!(await stored(page)).routeIds.includes(K[1]), "fuera de la ruta");
    await page.locator("button.unassigned__handle").click();
    await page.locator(".destination-panel:visible .destination-panel--scroll").evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(600); // el contenedor puede desplazarse con suavizado
    const pick = await centerOf(unHandle(page, K[1]));
    const target = await above(page, T[1]);
    // el destino está en pantalla (el panel abierto ocupa la mitad inferior en 390×844)
    ok(target.y > 0 && target.y < 2500, `destino en pantalla (${target.y})`);
    await touchDrag(cdp, pick, target);
    await page.waitForTimeout(200);
    ok((await stored(page)).routeIds.includes(K[1]), "de vuelta en la ruta");
    eq((await dayOrder(page))[0], [K[1], T[1], NOPHOTO], "entra en su hueco exacto");
    invariants({ ...seed, routeIds: (await stored(page)).routeIds }, await stored(page));
  });
  await context.close();
}

// ───────────────────────────── L layout y arrastre en cada ancho
const viewports = [[320, 700], [360, 740], [390, 844], [430, 932], [768, 1024], [840, 900], [1200, 800], [1440, 900]];
for (const [w, h] of viewports) {
  const { context, page } = await boot({ width: w, height: h });
  await ck(`L${w}`, `${w}×${h}: sin overflow, asa y acción ≥44 sin solaparse, texto legible, arrastre y cancelación`, async () => {
    const m = await page.evaluate(() => {
      const sc = document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll");
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, main: sc?.scrollWidth, mainc: sc?.clientWidth };
    });
    ok(m.sw <= m.cw && m.main <= m.mainc, `overflow ${JSON.stringify(m)}`);
    const li = page.locator(`.trip-stop[data-place-id="${T[0]}"]`);
    const h1 = await li.locator(".trip-stop__handle").boundingBox();
    const a1 = await li.locator(".trip-stop__actions").boundingBox();
    const o1 = await li.locator(".trip-stop__open").boundingBox();
    const t1 = await li.locator(".trip-stop__text").boundingBox();
    ok(h1.width >= 43.5 && h1.height >= 43.5, `asa ${h1.width}×${h1.height}`);
    ok(a1.width >= 43.5 && a1.height >= 43.5, `acción ${a1.width}×${a1.height}`);
    const overlap = (p, q) => p.x < q.x + q.width - 0.5 && q.x < p.x + p.width - 0.5 && p.y < q.y + q.height - 0.5 && q.y < p.y + p.height - 0.5;
    ok(!overlap(h1, a1) && !overlap(h1, o1) && !overlap(a1, o1), "asa, «acciones» y «abrir» no se solapan");
    const cardBox = await li.locator(".trip-stop__card").boundingBox();
    ok(h1.x >= cardBox.x && a1.x + a1.width <= cardBox.x + cardBox.width + 0.5, "asa y acciones dentro de la tarjeta");
    ok(t1.width >= 70, `texto de la parada demasiado estrecho: ${t1.width}px`);
    // arrastre completo en este ancho: el primero a un día vacío
    await page.locator(`.trip-stop[data-place-id="${T[0]}"]`).scrollIntoViewIfNeeded();
    const empty = day(page, 2).locator(".day-timeline__empty");
    const a = await centerOf(handle(page, T[0]));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
    // acercamos el día vacío a la vista sin soltar: el auto-scroll o el scroll de rueda lo hacen posible
    await empty.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const e = await centerOf(empty);
    await page.mouse.move(e.x, e.y, { steps: 12 });
    const during = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(during.sw <= during.cw, `overflow durante el arrastre ${JSON.stringify(during)}`);
    const ghost = await page.locator(".stop-ghost").boundingBox();
    ok(ghost.width <= w - 16 + 1, `fantasma cabe en ${w}: ${ghost.width}`);
    if (w === 320 || w === 390 || w === 768 || w === 1440) await shot(page, `arrastrando-${w}`);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector(".stop-ghost"));
    eq(await dayOrder(page), [D1, D2, []], "cancelado: nada cambia");
    if (w === 320 || w === 390 || w === 768 || w === 1440) await shot(page, `tras-cancelar-${w}`);
  });
  await context.close();
}

await ck("C01", "sin errores de consola/página ni respuestas 4xx/5xx propias", async () => {
  eq(pageErrors, [], "pageerror");
  eq(consoleErrors.filter((t) => !/Failed to load resource.*204|tile/i.test(t)), [], "console.error");
  eq(badResponses, [], "respuestas");
});

await browser.close();
await server.close();
console.log(`\nB28 Viaje › Reordenar: ${pass}/${pass + failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
