import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B29 — B9.3 «Herramientas del día» (`docs/BLOCK_29_MISSION.md`). Comportamiento
 * real en Chromium sobre la build de producción (`npm run build` antes). Línea Claude: continúa B28.
 *
 *   A acción     «Probar otro orden» en cada día elegible (≥2 paradas); ni rastro de la comparación global.
 *   B apertura   hoja local al día: «Orden actual» = borrador, «Otro orden» = copia; abrir no escribe.
 *   C propuesta  reordenar «Otro orden» (ratón y teclado) no escribe; comparación y anuncio accesible.
 *   D cerrar     Cancelar / Escape / fondo: nada escrito, foco al botón del mismo día, reabrir parte de lo persistido.
 *   E opciones   alternativas evidence-complete-* del día: «Comprobado con datos completos», sólo se CARGAN.
 *   F aplicar    «Usar este orden»: sólo ese día, ids/otros días/resto intactos, UNA escritura, foco, anuncio, recarga.
 *   G teclado    flujo completo sin ratón, foco atrapado en la hoja y restaurado.
 *   H layout     320/360/390/430/768/840/1200/1440: sin overflow, objetivos ≥44, CTA visible.
 *   I invariantes  B28 (arrastre / «Mover a…»), mover día, PlaceDetail/back tras cerrar la hoja.
 *   C0 consola   sin errores propios.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/b29-day-tools-check.mjs`
 * Capturas opcionales: `NIHON_B29_SHOTS=<dir>`.
 */

const executablePath = process.env.NIHON_CHROMIUM_PATH;
const SHOTS = process.env.NIHON_B29_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_KEY = "nihon.manualPlanningDraft";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((p) => p.hub === hub).map((p) => p.id);
const nameOf = (id) => places.find((p) => p.id === id).name;
const K = byHub("Kioto");
const O = byHub("Osaka");

// Día 1: la fixture de Phase 3E-E (Tokio) — el dominio ofrece una reubicación verificada.
const D1 = ["JP-010", "JP-012", "JP-011", "JP-013", "JP-014"];
const D1_RELOCATED = ["JP-010", "JP-013", "JP-012", "JP-011", "JP-014"];
const D2 = [K[0], K[1]]; // dos paradas, sin alternativas verificables propias
const D3 = [O[0]]; // una parada: sin herramienta
const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const ACC = { id: "acc-b29", label: "Hotel Prueba", location: { lat: 35.68, lng: 139.76 } };
const LEG = { direction: "place-to-accommodation", placeId: D1[4], accommodationId: ACC.id, minutes: 20, source: { kind: "user-entered" } };
const draft = () => ({
  version: 8,
  routeIds: [...D1, ...D2, ...D3],
  days: [
    { id: "d1", placeIds: [...D1], accommodationBoundary: { start: unsel.start, end: { kind: "accommodation", accommodationId: ACC.id } } },
    { id: "d2", placeIds: [...D2], accommodationBoundary: unsel },
    { id: "d3", placeIds: [...D3], accommodationBoundary: unsel },
    { id: "d4", placeIds: [], accommodationBoundary: unsel },
  ],
  startDate: "2027-02-22",
  endDate: null,
  visitStartTimes: { [D2[0]]: "09:30" },
  accommodations: [ACC],
  accommodationLegs: [LEG],
  interHubSegments: [],
  zoneAccommodationChoices: [],
});
const SAVED = () => [...draft().routeIds, O[1], O[2]];

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

async function boot(viewport, { seeded = draft() } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: false, isMobile: false });
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
    ({ saved, plan, key }) => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        // Cuenta las escrituras del borrador (todas pasan por Storage.prototype.setItem).
        const original = Storage.prototype.setItem;
        window.__draftWrites = 0;
        Storage.prototype.setItem = function (k, v) {
          if (k === key) window.__draftWrites += 1;
          return original.call(this, k, v);
        };
        if (sessionStorage.getItem("b29-seeded")) return; // un reload NO vuelve a sembrar: prueba la persistencia
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
        localStorage.setItem(key, JSON.stringify(plan));
        sessionStorage.setItem("b29-seeded", "1");
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    { saved: SAVED(), plan: seeded, key: DRAFT_KEY }
  );
  await page.goto(url, { waitUntil: "networkidle" });
  await enterDays(page);
  return { context, page };
}
async function enterDays(page) {
  await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForSelector(".day-timeline");
  await page.waitForTimeout(300);
}

const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), DRAFT_KEY);
const raw = (page) => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
const writes = (page) => page.evaluate(() => window.__draftWrites);
const domOrder = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".day-timeline")].map((d) => [...d.querySelectorAll(".trip-stop")].map((li) => li.dataset.placeId)));
const activeId = (page) => page.evaluate(() => document.activeElement?.id ?? null);
const activeLabel = (page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || null);
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.waitForTimeout(450); // deja terminar la animación de entrada de la hoja
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const opener = (page, dayId) => page.locator(`#day-order-open-${dayId}`);
const sheet = (page) => page.locator("[data-day-order-sheet]");
const proposal = (page) => page.locator(".day-order__block--proposal .sequence-item__name").allInnerTexts();
const current = (page) => page.locator(".day-order__block--current .sequence-item__name").allInnerTexts();
const status = (page) => page.locator("[data-day-order-status]").innerText();
const openSheet = async (page, dayId) => {
  await opener(page, dayId).click();
  await sheet(page).waitFor();
};
const closed = (page) => sheet(page).waitFor({ state: "detached" });
const NEVER = /(\bmejor(?!a)|\bmejores\b|recomend|ranking|ganador|\bgana\b|óptim|optimiz|puntuaci|ahorr|más rápid)/i;
const downBtn = (page, id) => page.locator(`#day-order-down-${id}`);
const upBtn = (page, id) => page.locator(`#day-order-up-${id}`);

// ───────────────────────────── A acción, B apertura, C propuesta, D cerrar, E opciones, F aplicar
{
  const { context, page } = await boot({ width: 1440, height: 1600 });
  const seed = await stored(page);
  const seedRaw = await raw(page);

  await ck("A01", "«Probar otro orden» existe en los días con ≥2 paradas y no en los de 0 o 1", async () => {
    eq(await opener(page, "d1").count(), 1, "Día 1");
    eq(await opener(page, "d2").count(), 1, "Día 2");
    eq(await opener(page, "d3").count(), 0, "Día 3 (1 parada)");
    eq(await opener(page, "d4").count(), 0, "Día 4 (vacío)");
    for (const id of ["d1", "d2"]) {
      const label = await opener(page, id).getAttribute("aria-label");
      ok(/^Probar otro orden en el Día \d$/.test(label), label);
      ok((await opener(page, id).innerText()).includes("Probar otro orden"), "texto visible");
    }
    await shot(page, "01-dia-con-accion");
  });
  await ck("A02", "no queda comparación global: ni botón de primer nivel, ni «Orden A/B», ni «Comparar órdenes»", async () => {
    eq(await page.locator(".sequence-compare-toggle").count(), 0, "botón global");
    const all = await page.getByRole("button", { name: /Probar otro orden/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    ok(all.length === 2 && all.every((l) => /en el Día/.test(l)), `botones: ${JSON.stringify(all)}`);
    for (const t of ["Orden A", "Orden B", "Comparar órdenes", "Volver a los días"]) {
      eq(await page.getByText(t, { exact: true }).count(), 0, t);
    }
  });

  await ck("B01", "abrir Día 2: sólo sus paradas; «Orden actual» = borrador; «Otro orden» empieza como copia; nada se escribe", async () => {
    const w = await writes(page);
    await openSheet(page, "d2");
    ok(await page.getByRole("dialog").isVisible(), "diálogo");
    eq(await page.getByRole("heading", { name: "Orden actual", exact: true }).count(), 1, "h3 Orden actual");
    eq(await page.getByRole("heading", { name: "Otro orden", exact: true }).count(), 1, "h3 Otro orden");
    eq(await current(page), D2.map(nameOf), "orden actual = Día 2 del borrador");
    eq(await proposal(page), D2.map(nameOf), "propuesta = copia del actual");
    const text = await sheet(page).innerText();
    for (const id of [...D1, ...D3]) ok(!text.includes(nameOf(id)), `aparece ${nameOf(id)} de otro día`);
    ok(await page.getByRole("button", { name: "Usar este orden" }).isDisabled(), "«Usar este orden» deshabilitado sin cambios");
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await writes(page), w, "ninguna escritura");
    await shot(page, "02-hoja-abierta");
  });
  await ck("B02", "la hoja es un diálogo con nombre; «Orden actual» y «Otro orden» son listas nombradas y hermanas", async () => {
    const dialogName = await page.getByRole("dialog").getAttribute("aria-labelledby");
    eq(await page.locator(`#${dialogName}`).innerText(), "Probar otro orden · Día 2", "nombre del diálogo");
    const lists = await sheet(page).locator("ol").evaluateAll((els) => els.map((e) => e.getAttribute("aria-labelledby")));
    eq(lists, ["day-order-current-heading", "day-order-proposal-heading"], "listas nombradas por sus h3");
    ok(await page.locator("[data-day-order-status]").getAttribute("aria-live") === "polite", "región de estado cortés");
    eq(await sheet(page).locator("[aria-grabbed]").count(), 0, "sin aria-grabbed");
  });

  await ck("C01", "reordenar «Otro orden» con un clic: cambia la propuesta, no el actual ni el almacenamiento; anuncia y mantiene el foco", async () => {
    const w = await writes(page);
    await downBtn(page, D2[0]).click();
    eq(await proposal(page), [nameOf(D2[1]), nameOf(D2[0])], "propuesta");
    eq(await current(page), D2.map(nameOf), "actual intacto");
    ok((await status(page)).includes("posición 2 de 2"), await status(page));
    eq(await activeId(page), `day-order-up-${D2[0]}`, "foco en el control del elemento movido (el ↓ quedó deshabilitado)");
    ok(await page.getByRole("button", { name: "Usar este orden" }).isEnabled(), "CTA habilitado");
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await writes(page), w, "ninguna escritura");
    await shot(page, "03-propuesta-reordenada");
  });
  await ck("C02", "la comparación describe ambos órdenes sin nombrar ganador ni recomendar", async () => {
    const block = await page.locator(".day-order__comparison").innerText();
    ok(/Comparación de traslados/.test(block), block);
    ok(!NEVER.test(await sheet(page).innerText()), `lenguaje prohibido: ${(await sheet(page).innerText()).match(NEVER)?.[0]}`);
    ok(!/igual al orden actual/.test(block), "ya no dice «igual»");
    await shot(page, "04-comparacion");
  });
  await ck("C03", "deshacer el cambio a mano vuelve a «igual»: CTA deshabilitado, sin escritura", async () => {
    await upBtn(page, D2[0]).click();
    eq(await proposal(page), D2.map(nameOf), "propuesta de vuelta");
    ok(await page.getByRole("button", { name: "Usar este orden" }).isDisabled(), "CTA deshabilitado (propuesta idéntica = no-op)");
    ok(/igual al orden actual/.test(await page.locator(".day-order__comparison").innerText()), "comparación «igual»");
  });

  await ck("D01", "Cancelar: nada escrito, la hoja se cierra y el foco vuelve a «Probar otro orden» del mismo día", async () => {
    await downBtn(page, D2[0]).click();
    const w = await writes(page);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await closed(page);
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await writes(page), w, "ninguna escritura");
    eq(await activeId(page), "day-order-open-d2", "foco");
    eq((await domOrder(page))[1], D2, "orden en pantalla intacto");
  });
  await ck("D02", "reabrir después de cancelar parte del orden persistido, no de la propuesta descartada", async () => {
    await openSheet(page, "d2");
    eq(await proposal(page), D2.map(nameOf), "propuesta = baseline");
    await page.keyboard.press("Escape");
    await closed(page);
  });
  await ck("D03", "Escape descarta la propuesta sin escribir y devuelve el foco al día correcto", async () => {
    await openSheet(page, "d2");
    await downBtn(page, D2[0]).click();
    const w = await writes(page);
    await page.keyboard.press("Escape");
    await closed(page);
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await writes(page), w, "ninguna escritura");
    eq(await activeId(page), "day-order-open-d2", "foco");
  });
  await ck("D04", "cerrar con la × o pulsando el fondo tampoco escribe", async () => {
    await openSheet(page, "d2");
    await downBtn(page, D2[0]).click();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await closed(page);
    await openSheet(page, "d2");
    await upBtn(page, D2[0]).count();
    await downBtn(page, D2[0]).click();
    await page.mouse.click(5, 5); // fondo (scrim)
    await closed(page);
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await activeId(page), "day-order-open-d2", "foco");
    await shot(page, "08-cancelacion");
  });

  await ck("E01", "Día 1: las alternativas verificadas son del Día 1, etiquetadas «Comprobado con datos completos»", async () => {
    await openSheet(page, "d1");
    eq(await current(page), D1.map(nameOf), "orden actual del Día 1");
    const items = sheet(page).locator(".local-swap__item");
    ok((await items.count()) >= 1, "hay alternativas");
    const texts = await items.allInnerTexts();
    ok(texts.every((t) => t.includes("Comprobado con datos completos")), "todas llevan la etiqueta");
    for (const id of [...D2, ...D3]) ok(!(await sheet(page).innerText()).includes(nameOf(id)), `nombre ajeno ${nameOf(id)}`);
    ok(!NEVER.test(await sheet(page).innerText()), `lenguaje prohibido: ${(await sheet(page).innerText()).match(NEVER)?.[0]}`);
  });
  await ck("E02", "las familias salen en el orden de emisión del dominio (C → E → G → I → K), sin reordenar por ahorro", async () => {
    const groups = await sheet(page).locator(".local-swap__group h5").allInnerTexts();
    const order = ["Intercambios adyacentes", "Reubicaciones de un lugar", "Intercambios no adyacentes", "Reversiones de cuatro lugares", "Intercambios de bloques de dos lugares"];
    const idx = groups.map((g) => order.indexOf(g));
    ok(idx.every((i) => i >= 0) && idx.every((v, i) => i === 0 || idx[i - 1] < v), `grupos: ${JSON.stringify(groups)}`);
    eq(await sheet(page).locator("[aria-pressed='true']").count(), 0, "ninguna opción elegida por defecto");
    eq(await proposal(page), D1.map(nameOf), "la propuesta no es ninguna alternativa al abrir");
    await shot(page, "05-alternativas");
  });
  await ck("E03", "elegir una alternativa sólo cambia «Otro orden»: sin escritura, marcada, anunciada, sin duplicados", async () => {
    const w = await writes(page);
    const before = await sheet(page).locator(".local-swap__item").count();
    await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().click();
    eq(await proposal(page), D1_RELOCATED.map(nameOf), "otro orden = candidata");
    eq(await current(page), D1.map(nameOf), "actual intacto");
    eq(await raw(page), seedRaw, "almacenamiento intacto");
    eq(await writes(page), w, "ninguna escritura");
    eq(await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().getAttribute("aria-pressed"), "true", "aria-pressed");
    ok((await status(page)).includes("Todavía no se ha aplicado"), await status(page));
    eq(await sheet(page).locator(".local-swap__item").count(), before, "las opciones no se recalculan ni duplican");
    ok(await page.getByRole("button", { name: "Usar este orden" }).isEnabled(), "CTA habilitado");
    await shot(page, "06-alternativa-seleccionada");
    await shot(page, "07-antes-de-usar");
  });
  await ck("E04", "tras elegir una alternativa la persona puede seguir editándola; el marcador se apaga", async () => {
    await downBtn(page, D1_RELOCATED[0]).click();
    eq(await sheet(page).locator("[aria-pressed='true']").count(), 0, "ya no coincide con la opción");
    await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().click();
    eq(await proposal(page), D1_RELOCATED.map(nameOf), "vuelve a la opción");
  });

  await ck("F01", "«Usar este orden»: cambia sólo el Día 1, conserva su id, los demás días y el resto del borrador; UNA escritura", async () => {
    const before = await stored(page);
    const w = await writes(page);
    await page.getByRole("button", { name: "Usar este orden" }).click();
    await closed(page);
    const after = await stored(page);
    eq(after.days[0].placeIds, D1_RELOCATED, "orden aplicado");
    eq(after.days[0].id, "d1", "id del día");
    eq(after.days[0].accommodationBoundary, before.days[0].accommodationBoundary, "alojamiento del día");
    eq(after.days.slice(1), before.days.slice(1), "demás días");
    const { days: _a, ...restAfter } = after;
    const { days: _b, ...restBefore } = before;
    eq(restAfter, restBefore, "resto del borrador (fechas, horas, legs, zonas, traslados, reservas)");
    eq(after.version, 8, "V8");
    eq((await writes(page)) - w, 1, "una sola escritura del borrador");
    eq(Object.keys(await page.evaluate(() => ({ ...localStorage }))).filter((k) => k.startsWith("nihon.manualPlanningDraft")), [DRAFT_KEY], "una sola clave");
  });
  await ck("F02", "tras aplicar: foco en «Probar otro orden» del Día 1, anuncio accesible y vista Días con el nuevo orden", async () => {
    eq(await activeId(page), "day-order-open-d1", "foco");
    ok((await page.locator("[data-day-announcer]").innerText()).includes("Nuevo orden del Día 1 aplicado. Los demás días no cambian."), await page.locator("[data-day-announcer]").innerText());
    eq((await domOrder(page))[0], D1_RELOCATED, "orden en pantalla");
    await shot(page, "09-despues-de-aplicar");
  });
  await ck("F03", "recargar conserva el orden aplicado y las alternativas se recalculan desde la nueva base", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await enterDays(page);
    eq((await stored(page)).days[0].placeIds, D1_RELOCATED, "persistido");
    eq((await domOrder(page))[0], D1_RELOCATED, "en pantalla");
    await openSheet(page, "d1");
    eq(await current(page), D1_RELOCATED.map(nameOf), "el actual es el aplicado");
    eq(await proposal(page), D1_RELOCATED.map(nameOf), "otro orden parte de él");
    ok((await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).count()) === 0, "la alternativa aplicada ya no se ofrece");
    await page.keyboard.press("Escape");
    await closed(page);
  });
  await ck("F04", "Día sin alternativas verificadas: la reordenación manual sigue siendo útil y se aplica", async () => {
    const before = await stored(page);
    await openSheet(page, "d2");
    eq(await sheet(page).locator(".local-swap__item").count(), 0, "sin alternativas");
    ok((await sheet(page).locator(".local-swap").count()) === 1, "estado vacío neutral, sin veredicto");
    await downBtn(page, D2[0]).click();
    await page.getByRole("button", { name: "Usar este orden" }).click();
    await closed(page);
    const after = await stored(page);
    eq(after.days[1].placeIds, [D2[1], D2[0]], "Día 2 reordenado");
    eq(after.days[1].id, "d2", "id");
    eq(after.days[0], before.days[0], "Día 1 intacto");
    eq(after.days.slice(2), before.days.slice(2), "Días 3 y 4 intactos");
    eq(await activeId(page), "day-order-open-d2", "foco");
  });
  await ck("F05", "un día movido de posición sigue funcionando por su id estable", async () => {
    await page.locator("#day-move-up-d2").click();
    eq((await stored(page)).days.map((d) => d.id), ["d2", "d1", "d3", "d4"], "B28 movió el día");
    const before = await stored(page);
    ok((await opener(page, "d2").getAttribute("aria-label")) === "Probar otro orden en el Día 1", "ahora es el Día 1");
    await openSheet(page, "d2");
    eq(await current(page), [D2[1], D2[0]].map(nameOf), "su propio orden");
    await downBtn(page, D2[1]).click();
    await page.getByRole("button", { name: "Usar este orden" }).click();
    await closed(page);
    const after = await stored(page);
    eq(after.days.map((d) => d.id), ["d2", "d1", "d3", "d4"], "ids y orden de días intactos");
    eq(after.days[0].placeIds, D2, "Día d2 reordenado");
    eq(after.days.slice(1), before.days.slice(1), "los demás días, byte a byte");
  });
  await ck("F06", "abrir/cancelar/aplicar en un día deja el resto del borrador (alojamiento, legs, horas) intacto", async () => {
    const after = await stored(page);
    eq(after.accommodations, seed.accommodations, "alojamientos");
    eq(after.accommodationLegs, seed.accommodationLegs, "legs");
    eq(after.visitStartTimes, seed.visitStartTimes, "horas");
    eq(after.startDate, seed.startDate, "fecha");
    eq(after.interHubSegments, seed.interHubSegments, "traslados entre ciudades");
    eq(after.zoneAccommodationChoices, seed.zoneAccommodationChoices, "zonas");
    const flat = after.days.flatMap((d) => d.placeIds);
    eq(new Set(flat).size, flat.length, "sin duplicados");
    eq([...flat].sort(), [...after.routeIds].sort(), "days particiona routeIds");
  });
  await context.close();
}

// ───────────────────────────── G teclado
{
  const { context, page } = await boot({ width: 1024, height: 900 });
  await ck("G01", "flujo completo sólo con teclado: abrir, recorrer, reordenar, aplicar; foco atrapado y restaurado", async () => {
    const before = await stored(page);
    await opener(page, "d2").focus();
    await page.keyboard.press("Enter");
    await sheet(page).waitFor();
    eq(await activeLabel(page), "Cerrar", "el foco entra en la hoja");
    // Mayús+Tab desde el primer control salta al último (atrapado)
    await page.keyboard.press("Shift+Tab");
    eq(await activeLabel(page), "Cancelar", "atrapado al retroceder");
    await page.keyboard.press("Tab");
    eq(await activeLabel(page), "Cerrar", "atrapado al avanzar");
    // Tab hasta el ↓ de la primera parada de «Otro orden»
    let guard = 0;
    while ((await activeId(page)) !== `day-order-down-${D2[0]}` && guard++ < 20) await page.keyboard.press("Tab");
    eq(await activeId(page), `day-order-down-${D2[0]}`, "alcanzable con Tab");
    await page.keyboard.press("Space");
    eq(await proposal(page), [nameOf(D2[1]), nameOf(D2[0])], "reordenado con Espacio");
    eq(await raw(page), JSON.stringify(before), "sin escritura todavía");
    guard = 0;
    while ((await activeLabel(page)) !== "Usar este orden" && guard++ < 20) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await closed(page);
    eq((await stored(page)).days[1].placeIds, [D2[1], D2[0]], "aplicado");
    eq(await activeId(page), "day-order-open-d2", "foco restaurado");
  });
  await ck("G02", "Escape con el foco dentro de la hoja cierra sin aplicar; el foco vuelve al día", async () => {
    const before = await raw(page);
    await opener(page, "d1").focus();
    await page.keyboard.press("Space");
    await sheet(page).waitFor();
    let guard = 0;
    while ((await activeId(page)) !== `day-order-down-${D1[0]}` && guard++ < 20) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await closed(page);
    eq(await raw(page), before, "sin escritura");
    eq(await activeId(page), "day-order-open-d1", "foco");
  });
  await context.close();
}

// ───────────────────────────── H layout
for (const width of [320, 360, 390, 430, 768, 840, 1200, 1440]) {
  const height = width < 700 ? 780 : 900;
  const { context, page } = await boot({ width, height });
  await ck(`H${width}`, `${width}px: acción ≥44, hoja sin overflow, objetivos ≥44, CTA visible, alternativas manejables`, async () => {
    const trigger = await opener(page, "d1").boundingBox();
    ok(trigger.height >= 43.5 && trigger.width >= 43.5, `acción ${trigger.width}×${trigger.height}`);
    const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(docOverflow <= 0, `overflow de página ${docOverflow}`);
    await openSheet(page, "d1");
    await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().scrollIntoViewIfNeeded();
    await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().click();
    const m = await page.evaluate(() => {
      const dialog = document.querySelector(".sheet");
      const body = document.querySelector(".sheet__body");
      const small = [];
      for (const el of dialog.querySelectorAll("button, a[href], input, select, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 43.5 || r.height < 43.5) small.push(`${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      const cta = [...dialog.querySelectorAll("button")].find((b) => b.textContent.trim() === "Usar este orden").getBoundingClientRect();
      // texto de nombres legible: ninguna fila de parada por debajo de 70 px de ancho útil
      const narrow = [...dialog.querySelectorAll(".day-order__block .sequence-item__name")].filter((n) => n.getBoundingClientRect().width < 70).length;
      // ningún hijo se sale horizontalmente de la hoja
      const dr = dialog.getBoundingClientRect();
      const out = [...dialog.querySelectorAll("*")].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && (r.right > dr.right + 1 || r.left < dr.left - 1);
      }).length;
      return {
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        bodyOverflow: body.scrollWidth - body.clientWidth,
        small,
        ctaBottom: cta.bottom,
        ctaTop: cta.top,
        vh: window.innerHeight,
        sheetTop: dr.top,
        sheetBottom: dr.bottom,
        narrow,
        out,
      };
    });
    ok(m.docOverflow <= 0, `overflow de página ${m.docOverflow}`);
    ok(m.bodyOverflow <= 0, `overflow de la hoja ${m.bodyOverflow}`);
    eq(m.small, [], "objetivos <44");
    ok(m.ctaTop >= m.sheetTop && m.ctaBottom <= m.vh + 1, `CTA fuera de pantalla (${m.ctaTop}–${m.ctaBottom} de ${m.vh})`);
    ok(m.sheetTop >= 0 && m.sheetBottom <= m.vh + 1, `hoja fuera del viewport ${m.sheetTop}–${m.sheetBottom}`);
    eq(m.narrow, 0, "nombres estrechos");
    eq(m.out, 0, "elementos fuera de la hoja");
    await page.keyboard.press("Escape");
    await closed(page);
  });
  if (SHOTS && [320, 390, 768, 1440].includes(width)) {
    await ck(`V${width}`, `${width}px: capturas (acción, hoja, alternativa, comparación, antes/después, cancelación)`, async () => {
      await shot(page, `v${width}-01-dia-accion`);
      await openSheet(page, "d1");
      await shot(page, `v${width}-02-hoja-recien-abierta`);
      await downBtn(page, D1[0]).click();
      await shot(page, `v${width}-03-propuesta-reordenada`);
      await sheet(page).locator(".day-order__comparison").scrollIntoViewIfNeeded();
      await shot(page, `v${width}-04-comparacion`);
      await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().scrollIntoViewIfNeeded();
      await sheet(page).getByRole("button", { name: "Probar esta reubicación" }).first().click();
      await shot(page, `v${width}-05-alternativa-seleccionada`);
      await page.getByRole("button", { name: "Usar este orden" }).scrollIntoViewIfNeeded();
      await shot(page, `v${width}-06-antes-de-usar`);
      await page.getByRole("button", { name: "Usar este orden" }).click();
      await closed(page);
      await page.waitForTimeout(150);
      await shot(page, `v${width}-07-despues-de-aplicar`);
      await openSheet(page, "d2");
      await downBtn(page, D2[0]).click();
      await page.getByRole("button", { name: "Cancelar" }).click();
      await closed(page);
      await shot(page, `v${width}-08-cancelacion`);
    });
  }
  await context.close();
}

// ───────────────────────────── I invariantes
{
  const { context, page } = await boot({ width: 1440, height: 1500 });
  const handle = (id) => page.locator(`#stop-handle-${id}`);
  await ck("I01", "el arrastre B28 sigue funcionando después de cerrar la hoja", async () => {
    await openSheet(page, "d1");
    await downBtn(page, D1[0]).click();
    await page.keyboard.press("Escape");
    await closed(page);
    const a = await handle(D2[0]).boundingBox();
    const target = await page.locator(`.trip-stop[data-place-id="${D2[1]}"]`).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 6, a.y + a.height / 2 + 6, { steps: 2 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height - 3, { steps: 14 });
    await page.mouse.up();
    await page.waitForFunction((id) => !document.querySelector(".stop-ghost") && document.querySelector(`.trip-stop[data-place-id="${id}"]`), D2[0]);
    eq((await stored(page)).days[1].placeIds, [D2[1], D2[0]], "arrastre mismo día");
    eq((await stored(page)).days[0].placeIds, D1, "Día 1 sigue como estaba (la propuesta descartada no se aplicó)");
  });
  await ck("I02", "«Mover a…» y el teclado del asa (B28) siguen intactos", async () => {
    await handle(D1[0]).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    eq((await stored(page)).days[0].placeIds, [D1[1], D1[0], D1[2], D1[3], D1[4]], "teclado del asa");
    await page.getByRole("button", { name: new RegExp(`^Acciones de ${nameOf(D1[4]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`) }).click();
    await page.getByRole("button", { name: /Mover a…/ }).click();
    await page.locator(".sheet select").first().selectOption("1");
    await page.getByRole("button", { name: "Mover aquí" }).click();
    await page.locator(".sheet").waitFor({ state: "detached" });
    ok((await stored(page)).days[1].placeIds.includes(D1[4]), "Mover a… entre días");
  });
  await ck("I03", "PlaceDetail apilado y back siguen intactos; la hoja no queda abierta", async () => {
    await page.locator(`.trip-stop[data-place-id="${D2[1]}"] .trip-stop__open`).click();
    await page.waitForSelector(".place-detail__back");
    eq(await sheet(page).count(), 0, "sin hoja");
    await page.goBack();
    await page.waitForSelector(".day-timeline");
    await page.waitForFunction(() => !document.querySelector(".place-detail__back"));
    eq(await sheet(page).count(), 0, "sin hoja tras volver");
  });
  await ck("I04", "alojamiento, legs y horas del borrador tras todo el recorrido de la sesión", async () => {
    const d = await stored(page);
    eq(d.accommodationLegs.map((l) => l.minutes), [20], "legs");
    eq(d.visitStartTimes, { [D2[0]]: "09:30" }, "horas");
  });
  await context.close();
}

await browser.close();
await server.close();

await ck("C0", "consola y red sin errores propios", async () => {
  eq(consoleErrors, [], "errores de consola");
  eq(pageErrors, [], "errores de página");
  eq(badResponses, [], "respuestas ≥400");
});

console.log(`\nB29 Viaje › Herramientas del día: ${pass}/${pass + failures.length}`);
for (const failure of failures) console.log(failure);
process.exit(failures.length === 0 ? 0 : 1);
