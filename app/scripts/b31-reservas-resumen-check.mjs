import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const ghibli = places.find((place) => place.id === "JP-044");
const disney = places.find((place) => place.id === "JP-203");
const kyoto = places.find((place) => place.hub === "Kioto");
assert.ok(ghibli && disney && kyoto);
const DRAFT_KEY = "nihon.manualPlanningDraft";
const engine = process.env.NIHON_BROWSER === "webkit" ? webkit : chromium;
const server = await preview({ root: fileURLToPath(new URL("..", import.meta.url)), preview: { host: "127.0.0.1", port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await engine.launch({ executablePath: engine === chromium ? process.env.NIHON_CHROMIUM_PATH || chromium.executablePath() : (process.env.NIHON_WEBKIT_PATH || webkit.executablePath()) });
let checks = 0;
function check(value, message) { checks++; assert.ok(value, `B31 ${message}`); }
const shots = process.env.NIHON_B31_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

function fixture({ empty = false, undated = false } = {}) {
  const boundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };
  return {
    version: 8, routeIds: empty ? [] : [ghibli.id, disney.id, kyoto.id],
    days: empty ? [] : [
      { id: "b31-tokyo", placeIds: [ghibli.id, disney.id], accommodationBoundary: boundary },
      { id: "b31-empty", placeIds: [], accommodationBoundary: boundary },
      { id: "b31-kyoto", placeIds: [kyoto.id], accommodationBoundary: boundary },
    ],
    startDate: undated ? null : "2027-02-22", endDate: undated ? null : "2027-03-05",
    visitStartTimes: empty ? {} : { [ghibli.id]: "09:30" },
    accommodations: empty ? [] : [{ id: "b31-existing-hotel", label: "Alojamiento ya elegido", location: { lat: 35.68, lng: 139.76 } }],
    accommodationLegs: empty ? [] : [{ direction: "accommodation-to-place", accommodationId: "b31-existing-hotel", placeId: ghibli.id, minutes: 25, source: { kind: "user-entered" } }],
    interHubSegments: [], zoneAccommodationChoices: [],
  };
}

async function setup(viewport, options = {}) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: options.reducedMotion ? "reduce" : "no-preference" });
  await context.addInitScript(({ draft, ids, key }) => {
    window.__b31Writes = [];
    const original = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) window.__b31Writes.push({ name, value }); return original.call(this, name, value); };
    Storage.prototype.removeItem = function (name) { if (name === key) window.__b31Writes.push({ name, remove: true }); return remove.call(this, name); };
    if (localStorage.getItem(key) === null) {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("nihon.travellers.v1", JSON.stringify({ version: 1, travellers: [{ id: "b31", label: "Marta" }], activeTravellerId: "b31", interests: ids.map((placeId) => ({ placeId, stances: [{ travellerId: "b31", stance: "interested" }], carriedOver: false })) }));
      localStorage.setItem(key, JSON.stringify(draft));
    }
    window.__b31Writes.length = 0;
  }, { draft: fixture(options), ids: options.empty ? [] : [ghibli.id, disney.id, kyoto.id], key: DRAFT_KEY });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  await page.locator(".analysis-dialog--embedded").waitFor();
  // Synchronize with the existing Días mount/reconciliation before observing read-only tabs.
  await page.waitForFunction(() => window.__b31Writes.length === 2);
  const baseline = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
  await page.evaluate(() => { window.__b31Writes.length = 0; });
  return { context, page, baseline, errors };
}
async function snapshot(page, baseline, label) {
  check(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY) === baseline, `${label}: complete V8 snapshot unchanged (route/day identities/accommodation/reservations)`);
  check(await page.evaluate(() => window.__b31Writes.length) === 0, `${label}: consulting and switching tabs writes no V8`);
}
async function activate(page, name, keyboard = false) {
  const button = page.getByRole("group", { name: "Secciones de Viaje" }).getByRole("button", { name, exact: true });
  if (keyboard) { await button.focus(); await button.press("Enter"); } else await button.click();
  check(await button.getAttribute("aria-pressed") === "true", `${name}: active semantic state`);
  check(keyboard ? await button.evaluate((element) => document.activeElement === element) : await page.evaluate(() => !document.activeElement?.closest("[hidden]")), `${name}: keyboard focus stays on the control / pointer focus does not remain in a hidden surface`);
  return button;
}
async function layout(page, selector, label) {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no page horizontal overflow`);
  const tooSmall = await page.locator(selector).locator("button:visible, a:visible, summary:visible").evaluateAll((elements) => elements.filter((element) => {
    const box = element.getBoundingClientRect(); return box.width < 43.5 || box.height < 43.5;
  }).map((element) => element.textContent));
  check(tooSmall.length === 0, `${label}: 44px targets ${JSON.stringify(tooSmall)}`);
  check(!(await page.locator("body").innerText()).includes("Dato:"), `${label}: no renderable Dato pattern`);
}
async function detailRoundTrip(page, root, label, useBack = false) {
  const opener = root.getByRole("button", { name: ghibli.name, exact: true }).first();
  await opener.focus();
  const scroller = page.locator(".destination-panel:not([hidden]) > .destination-panel--scroll");
  const originScroll = await scroller.evaluate((element) => element.scrollTop);
  await opener.press("Enter");
  const detail = page.locator(".place-detail"); await detail.waitFor();
  check(await page.getByRole("button", { name: "Viaje", exact: true }).getAttribute("aria-current") === "page", `${label}: PlaceDetail stays in Viaje`);
  check(await page.locator(".place-detail").count() === 1, `${label}: single shared PlaceDetail instance`);
  check(await detail.getByRole("button", { name: `Volver a ${label}`, exact: true }).count() === 1, `${label}: exact origin label`);
  if (useBack) await page.goBack(); else await detail.getByRole("button", { name: `Volver a ${label}`, exact: true }).click();
  await detail.waitFor({ state: "detached" });
  check(await root.isVisible(), `${label}: exact surface survives return`);
  check(await opener.evaluate((element) => document.activeElement === element), `${label}: focus returns to opener`);
  check(await scroller.evaluate((element, original) => Math.abs(element.scrollTop - original) < 2, originScroll), `${label}: exact origin scroll retained`);
}

async function audit(viewport, reducedMotion = false) {
  const { context, page, baseline, errors } = await setup(viewport, { reducedMotion });
  const tag = `${viewport.join("x")}${reducedMotion ? " reduced-motion" : ""}`;
  try {
    const nav = page.getByRole("group", { name: "Secciones de Viaje" });
    check(await nav.getByRole("button").allTextContents().then((names) => names.map((name) => name.trim()).join("|")) === "Días|Dónde dormir|Reservas|Resumen", `${tag}: four canonical sections`);
    await activate(page, "Reservas", true);
    const reservations = page.locator(".trip-reservations"); await reservations.waitFor();
    check(await page.getByRole("heading", { name: "Reservas", exact: true }).count() === 1, `${tag}: accessible Reservas heading`);
    const rows = reservations.locator(".trip-reservations__item");
    const ids = await rows.evaluateAll((elements) => elements.map((element) => element.dataset.placeId));
    check(ids.indexOf(disney.id) < ids.indexOf(ghibli.id), `${tag}: urgency dates override route position`);
    const dates = await rows.evaluateAll((elements) => elements.map((element) => element.dataset.urgencyDate).filter(Boolean));
    check(JSON.stringify(dates) === JSON.stringify([...dates].sort()), `${tag}: derived dates are ascending`);
    const exactRow = reservations.locator(`.trip-reservations__item[data-place-id="${ghibli.id}"]`);
    check((await exactRow.innerText()).includes(`«${ghibli.reservation.leadTime}»`), `${tag}: literal lead time retained with quotes`);
    check((await exactRow.innerText()).includes("Registrado"), `${tag}: source evidence marked`);
    check(await exactRow.getByRole("link", { name: "Ver fuente oficial" }).first().getAttribute("href") === "https://www.ghibli-museum.jp/en/tickets/", `${tag}: official source URL retained`);
    check((await exactRow.locator(".official-reservation-date").innerText()).includes("10:00"), `${tag}: official time and date retained`);
    check(await reservations.locator(".official-reservation-calendar").isVisible(), `${tag}: official calendar relocated`);
    check(await exactRow.locator(".trip-reservations__feb-mar").count() === 1, `${tag}: February/March information retained`);
    await layout(page, ".trip-reservations", `${tag} Reservas`);
    await detailRoundTrip(page, reservations, "Reservas");
    await snapshot(page, baseline, `${tag} Reservas`);
    if (shots) { await page.locator(".destination-panel:not([hidden]) > .destination-panel--scroll").evaluate((element) => { element.scrollTop = 0; }); await page.screenshot({ path: `${shots}/${engine.name()}-${tag.replaceAll(" ", "-")}-reservas.png` }); }

    await activate(page, "Resumen");
    const summary = page.locator(".trip-summary"); await summary.waitFor();
    const cards = summary.locator(".whole-trip-composition__group");
    check(await cards.count() === 4, `${tag}: four real composition cards`);
    check(JSON.stringify(await cards.locator("h4").allTextContents()) === JSON.stringify(["Visitas", "Traslados registrados", "Alojamiento", "Rango del viaje"]), `${tag}: canonical card subjects`);
    check((await summary.innerText()).includes("Días creados: 3"), `${tag}: actual day count`);
    check(await cards.locator(".evidence-mark").count() === 4, `${tag}: each derived card marked`);
    const bands = summary.locator(".trip-timeline__day");
    check(JSON.stringify(await bands.evaluateAll((elements) => elements.map((element) => element.dataset.dayId))) === JSON.stringify(["b31-tokyo", "b31-empty", "b31-kyoto"]), `${tag}: stable actual day identities`);
    check(JSON.stringify(await bands.locator(".trip-timeline__cities").allTextContents()) === JSON.stringify(["Tokio", "Sin ciudad asignada", "Kioto"]), `${tag}: actual cities and honest empty day`);
    check(await bands.locator("time").evaluateAll((elements) => elements.map((element) => element.dateTime).join("|")) === "2027-02-22|2027-02-23|2027-02-24", `${tag}: existing calendar anchoring`);
    const region = summary.getByRole("region", { name: "Línea de tiempo del viaje por días" });
    await region.focus(); await page.keyboard.press("ArrowRight");
    check(await region.evaluate((element) => document.activeElement === element), `${tag}: timeline keyboard access`);
    await summary.locator(".trip-timeline__day").first().locator("summary").click();
    await detailRoundTrip(page, summary, "Resumen", true);
    await layout(page, ".trip-summary", `${tag} Resumen`);
    await snapshot(page, baseline, `${tag} Resumen`);
    if (reducedMotion) check(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), `${tag}: reduced motion active`);
    if (shots) { await page.locator(".destination-panel:not([hidden]) > .destination-panel--scroll").evaluate((element) => { element.scrollTop = 0; }); await page.screenshot({ path: `${shots}/${engine.name()}-${tag.replaceAll(" ", "-")}-resumen.png` }); }
    await summary.getByRole("button", { name: "Ver fechas en Días", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Días");
    check(await nav.getByRole("button", { name: "Días", exact: true }).evaluate((element) => document.activeElement === element), `${tag}: summary detail link transfers focus to Días`);
    check(await page.locator("#sequence-start-date").inputValue() === "2027-02-22", `${tag}: summary date link reaches existing Días control`);
    check(await page.locator('.day-card[data-day-id="b31-tokyo"] .trip-stop').count() === 2, `${tag}: day content conserved`);
    await activate(page, "Resumen", true);
    await summary.getByRole("button", { name: "Ver Dónde dormir", exact: true }).click();
    check(await nav.getByRole("button", { name: "Dónde dormir", exact: true }).getAttribute("aria-pressed") === "true", `${tag}: summary lodging link reaches existing section`);
    const zonePanel = page.locator(".zone-panel--embedded");
    await zonePanel.waitFor();
    check(await page.evaluate(() => {
      const active = document.activeElement;
      return !active?.closest("[hidden]") && (active?.closest(".zone-panel--embedded") !== null || active?.textContent?.trim() === "Dónde dormir");
    }), `${tag}: summary lodging link leaves focus in the destination (existing B30 mount focus or navigation control)`);
    const boxes = zonePanel.locator('.zone-card input[type="checkbox"]');
    await boxes.nth(0).check(); await boxes.nth(1).check();
    await zonePanel.getByRole("button", { name: "Comparar", exact: true }).click();
    const selectedZones = await zonePanel.locator(".zone-column").count();
    await activate(page, "Reservas", true);
    await activate(page, "Dónde dormir", true);
    check(await zonePanel.locator(".zone-column").count() === selectedZones, `${tag}: comparison mode and selection survive consulting another sub-tab`);
    await activate(page, "Reservas", true);
    await snapshot(page, baseline, `${tag} all four sub-tabs`);
    // Explicit edits are allowed writes; the other mounted reader must refresh from canonical V8.
    if (!reducedMotion && viewport[0] === 390) {
      await activate(page, "Dónde dormir");
      await zonePanel.getByRole("button", { name: /^Dormir en / }).first().click();
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).zoneAccommodationChoices.length === 1, DRAFT_KEY);
      const afterChoice = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
      await activate(page, "Resumen");
      await page.waitForFunction((expected) => localStorage.getItem("nihon.manualPlanningDraft") === expected, afterChoice);
      check(await page.locator(".whole-trip-composition__group").count() === 4, `${tag}: composition remains available after explicit zone choice`);
      await activate(page, "Días");
      check(await page.locator(".zone-plan__card").count() === 1, `${tag}: explicit zone choice reaches existing planner reader`);
      await activate(page, "Días");
      await page.locator("#sequence-start-date").fill("2027-02-23");
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).startDate === "2027-02-23", DRAFT_KEY);
      await activate(page, "Dónde dormir");
      const changed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
      check(changed.startDate === "2027-02-23" && changed.zoneAccommodationChoices.length === 1, `${tag}: refresh conserves edits from both existing writers`);
      check(JSON.stringify(changed.routeIds) === JSON.stringify(fixture().routeIds), `${tag}: explicit edits do not alter route order`);
      check(JSON.stringify(changed.days.map((day) => day.id)) === JSON.stringify(fixture().days.map((day) => day.id)), `${tag}: explicit edits do not alter day identity`);
    }
    check(errors.length === 0, `${tag}: no runtime page errors ${errors.join("|")}`);
  } finally { await context.close(); }
}

try {
  for (const viewport of [[320, 568], [390, 844], [1280, 800]]) await audit(viewport);
  await audit([390, 844], true);
  for (const options of [{ empty: true }, { undated: true }]) {
    const { context, page, baseline } = await setup([320, 568], options);
    try {
      await activate(page, "Reservas");
      check((await page.locator(".trip-reservations").innerText()).includes(options.empty ? "No hay reservas por preparar" : "Sin fecha límite derivable"), "empty/undated reservations are honest");
      if (options.undated) check(await page.locator(".trip-reservations__source").count() > 0, "undated mechanism evidence retained");
      await activate(page, "Resumen");
      check(await page.locator(".whole-trip-composition__group").count() === 4, "empty/undated summary retains four cards");
      check(await page.locator(".trip-timeline time").count() === 0 || !options.undated, "undated timeline invents no dates");
      if (options.empty) {
        const actualDays = JSON.parse(baseline).days ?? [];
        check(await page.locator(".trip-timeline__day").count() === actualDays.length, "empty timeline shows only the actual days created by the existing Días runtime");
        check((await page.locator(".trip-timeline").innerText()).includes("Sin ciudad asignada"), "empty days invent no city");
      }
      await snapshot(page, baseline, "empty/undated consultation");
    } finally { await context.close(); }
  }
  console.log(`B31 Reservas / Resumen: ${checks}/${checks} PASS (${engine.name()})`);
} finally { await browser.close(); await new Promise((resolve) => server.httpServer.close(resolve)); }
