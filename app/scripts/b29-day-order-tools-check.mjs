import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const ids = ["JP-202", "JP-153", "JP-156", "JP-161", "JP-154", "JP-155"];
const extraId = places.find((place) => !ids.includes(place.id))?.id;
if (!extraId || ids.some((id) => !places.some((place) => place.id === id))) throw new Error("B29 fixture places are missing");
const dayPlaceIds = [...ids];
const routeIds = [...ids, extraId];
const byId = new Map(places.map((place) => [place.id, place]));
const storageKey = "nihon.manualPlanningDraft";
const wishlistKey = "nihon.travellers.v1";
const viewports = [[320,568],[375,667],[390,844],[430,932],[820,1180],[1024,768],[1280,800],[1440,900]];
const shots = process.env.NIHON_B29_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const server = await preview({ root: fileURLToPath(new URL("..", import.meta.url)), preview: { host: "127.0.0.1", port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const browserPath = process.env.NIHON_CHROMIUM_PATH || chromium.executablePath();
const browser = await chromium.launch({ executablePath: browserPath });
let checks = 0;
function check(value, message) {
  checks++;
  if (!value) throw new Error(`B29 ${message}`);
}
function boundary() {
  return { start: { kind: "unselected" }, end: { kind: "unselected" } };
}
function draftFor(days = [dayPlaceIds, [extraId], []]) {
  return {
    version: 8,
    routeIds: [...routeIds],
    days: days.map((placeIds, index) => ({ id: `day-${String.fromCharCode(97 + index)}`, placeIds: [...placeIds], accommodationBoundary: boundary() })),
    startDate: "2027-02-22",
    endDate: "2027-03-05",
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    interHubSegments: [],
    zoneAccommodationChoices: [],
  };
}
async function setup({ viewport = { width: 390, height: 844 }, days, emptyPlan = false } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ key, savedKey, savedPlan, wishlistIds }) => {
    window.__b29DraftWrites = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) window.__b29DraftWrites.push(value);
      return originalSetItem.call(this, name, value);
    };
    if (localStorage.getItem(key) !== null) {
      window.__b29DraftWrites = [];
      return;
    }
    localStorage.setItem("nihon.onboarding.seen.v1", "1");
    localStorage.setItem(savedKey, JSON.stringify({
      version: 1,
      travellers: [{ id: "b29", label: "Marta" }],
      activeTravellerId: "b29",
      interests: wishlistIds.map((placeId) => ({ placeId, stances: [{ travellerId: "b29", stance: "interested" }], carriedOver: false })),
    }));
    localStorage.setItem(key, JSON.stringify(savedPlan));
    window.__b29DraftWrites = [];
  }, {
    key: storageKey,
    savedKey: wishlistKey,
    savedPlan: emptyPlan
      ? { ...draftFor(days ?? [[], [ids[0]]]), routeIds: [ids[0]], days: (days ?? [[], [ids[0]]]).map((placeIds, index) => ({ id: `day-${String.fromCharCode(97 + index)}`, placeIds, accommodationBoundary: boundary() })) }
      : draftFor(days),
    wishlistIds: emptyPlan ? [ids[0]] : routeIds,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  const root = page.locator(".destination-panel:not([hidden])");
  await root.locator(".day-card[data-day-id]").first().waitFor();
  return { context, page, root, errors };
}
async function setupEvidenceFixture(fixtureIds, dayId) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, savedKey, placeIds, stableDayId }) => {
    window.__b29DraftWrites = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) window.__b29DraftWrites.push(value);
      return originalSetItem.call(this, name, value);
    };
    localStorage.setItem("nihon.onboarding.seen.v1", "1");
    localStorage.setItem(savedKey, JSON.stringify({
      version: 1,
      travellers: [{ id: "b29-evidence", label: "Marta" }],
      activeTravellerId: "b29-evidence",
      interests: placeIds.map((placeId) => ({ placeId, stances: [{ travellerId: "b29-evidence", stance: "interested" }], carriedOver: false })),
    }));
    localStorage.setItem(key, JSON.stringify({
      version: 8,
      routeIds: [...placeIds],
      days: [{ id: stableDayId, placeIds: [...placeIds], accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } } }],
      startDate: null,
      endDate: null,
      visitStartTimes: {},
      accommodations: [],
      accommodationLegs: [],
      interHubSegments: [],
      zoneAccommodationChoices: [],
    }));
    window.__b29DraftWrites = [];
  }, { key: storageKey, savedKey: wishlistKey, placeIds: fixtureIds, stableDayId: dayId });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  const root = page.locator(".destination-panel:not([hidden])");
  const dayCard = root.locator(`.day-card[data-day-id="${dayId}"]`);
  await dayCard.waitFor();
  return { context, page, root, dayCard, errors };
}
function card(root, dayId = "day-a") { return root.locator(`.day-card[data-day-id="${dayId}"]`); }
async function readDraft(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey); }
async function writeCount(page) { return page.evaluate(() => window.__b29DraftWrites.length); }
async function resetWrites(page) { return page.evaluate(() => { window.__b29DraftWrites.length = 0; }); }
async function openTool(page, root, dayId = "day-a") {
  const dayCard = card(root, dayId);
  const trigger = dayCard.getByRole("button", { name: `Probar otro orden del Día ${dayId === "day-a" ? "1" : dayId === "day-b" ? "2" : "3"}` });
  await trigger.click();
  const panel = dayCard.locator(".day-order-tool");
  await panel.waitFor();
  return { trigger, panel };
}
async function keyboardActivate(locator) {
  await locator.focus();
  await locator.press("Enter");
}
async function orderNames(locator) {
  return locator.locator(".day-order-tool__place-name").allTextContents();
}
function idsForNames(names) {
  return names.map((name) => {
    const place = [...byId.values()].find((candidate) => candidate.name === name);
    if (!place) throw new Error(`B29 unknown place label in panel: ${name}`);
    return place.id;
  });
}
async function capture(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

try {
  // A–F: real local proposal, conservative comparison, option loading, one atomic apply.
  const main = await setup();
  const { page, root, errors } = main;
  const original = await readDraft(page);
  const trigger = card(root).getByRole("button", { name: "Probar otro orden del Día 1" });
  const triggerCount = await trigger.count();
  const triggerDisabled = triggerCount === 1 ? await trigger.isDisabled() : null;
  check(triggerCount === 1 && !triggerDisabled, "A: local day trigger available");
  await resetWrites(page);
  const tool = await openTool(page, root);
  check(await tool.panel.getByRole("heading", { name: "Probar otro orden · Día 1" }).count() === 1, "A: panel names its day");
  check(await tool.panel.getByRole("heading", { name: "Orden actual" }).count() === 1 && await tool.panel.getByRole("heading", { name: "Propuesta" }).count() === 1, "A: current/proposal terminology");
  check(await tool.panel.locator("h3").evaluate((heading) => document.activeElement === heading), "A: focus moves to panel heading");
  check((await orderNames(tool.panel.locator(".day-order-tool__order").nth(0))).join("|") === dayPlaceIds.map((id) => byId.get(id).name).join("|"), "B: exact day baseline order displayed");
  check((await orderNames(tool.panel.locator(".day-order-tool__order").nth(1))).join("|") === dayPlaceIds.map((id) => byId.get(id).name).join("|"), "B: proposal clones baseline on open");
  check((await tool.panel.locator(".day-order-tool__comparison").innerText()).includes("Los traslados conocidos de ambos órdenes son iguales."), "D: initial equal order is described as equivalent");
  check(await writeCount(page) === 0 && JSON.stringify(await readDraft(page)) === JSON.stringify(original), "B: opening performs zero draft writes");
  const dayOther = root.locator(".day-card[data-day-id='day-b']");
  check((await dayOther.getByRole("button", { name: "Probar otro orden del Día 2" }).count()) === 1, "A: another day exposes its own trigger");
  check(!(await root.getByText("Comparar otro orden", { exact: true }).count()), "22: global A/B compare is absent from primary Días UX");
  await capture(page, "b29-390-open");

  const moveFirst = tool.panel.getByLabel(`Mover ${byId.get(ids[0]).name} a la posición en la propuesta del Día 1`);
  await moveFirst.selectOption("6");
  check((await orderNames(tool.panel.locator(".day-order-tool__order").nth(1))).join("|") !== dayPlaceIds.map((id) => byId.get(id).name).join("|"), "C: keyboard position control reorders proposal");
  check((await tool.panel.locator(".day-order-tool__comparison").innerText()).includes("Comparación incompleta: faltan traslados registrados."), "D: an unknown leg remains incomplete, never zero");
  check(JSON.stringify(await readDraft(page)) === JSON.stringify(original) && await writeCount(page) === 0, "C: manual edit changes only ephemeral proposal");
  const proposedManual = idsForNames(await orderNames(tool.panel.locator(".day-order-tool__order").nth(1)));
  check(JSON.stringify(proposedManual) !== JSON.stringify(original.days[0].placeIds), "C: proposal sequence differs from persisted baseline");

  const firstGroup = tool.panel.locator(".day-order-tool__group").first();
  check(await firstGroup.count() > 0, "E: evidence-complete options exist for known fixture");
  await firstGroup.locator("summary").click();
  check(await firstGroup.getByText("Comprobado con datos completos", { exact: true }).count() > 0, "E: exact evidence-complete label is present");
  check(await tool.panel.getByRole("button", { name: "Probar esta opción" }).count() > 0, "E: alternative uses a try action");
  await tool.panel.getByRole("button", { name: "Probar esta opción" }).first().click();
  const afterOptionNames = await orderNames(tool.panel.locator(".day-order-tool__order").nth(1));
  const afterOption = idsForNames(afterOptionNames);
  check(JSON.stringify(afterOption) !== JSON.stringify(original.days[0].placeIds), "E: selecting option loads a non-identical proposal");
  check(JSON.stringify(await readDraft(page)) === JSON.stringify(original) && await writeCount(page) === 0, "E: selecting option does not apply or persist it");
  const comparisonAfterOption = (await tool.panel.locator(".day-order-tool__comparison").innerText()).toLowerCase();
  check(!comparisonAfterOption.includes("incompleta") || comparisonAfterOption.includes("faltan traslados"), "D/E: option comparison remains conservative when data is incomplete");
  check(await tool.panel.getByRole("button", { name: "Usar este orden", exact: true }).count() === 1, "F: exactly one explicit apply CTA");
  check(await tool.panel.getByRole("button", { name: /Aplicar/ }).count() === 0, "E: alternatives have no immediate apply control");
  check(await tool.panel.getByRole("button", { name: "Cancelar", exact: true }).count() === 1, "G: cancel action is available");

  // Tab follows the inline DOM order, without a modal focus trap.
  await tool.panel.locator("h3").focus();
  await page.keyboard.press("Tab");
  check(await tool.panel.getByRole("button", { name: "Cerrar Probar otro orden" }).evaluate((element) => document.activeElement === element), "J: Tab follows the panel's DOM order from its heading");
  await tool.panel.getByRole("button", { name: "Usar este orden", exact: true }).scrollIntoViewIfNeeded();
  const ctaVisible = await tool.panel.getByRole("button", { name: "Usar este orden", exact: true }).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const tab = document.querySelector(".tab-bar:not([hidden])")?.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight && (!tab || box.bottom <= tab.top);
  });
  check(ctaVisible, "K: primary CTA is visible above mobile TabBar after scrolling to it");

  await page.evaluate(() => { window.__b29DraftWrites.length = 0; });
  const expected = structuredClone(original);
  expected.days[0].placeIds = [...afterOption];
  await tool.panel.getByRole("button", { name: "Usar este orden", exact: true }).click();
  await page.waitForFunction(() => window.__b29DraftWrites.length === 1);
  const applied = await readDraft(page);
  check(JSON.stringify(applied) === JSON.stringify(expected), "F: one atomic update changes only target day's placeIds");
  check(applied.days[0].id === original.days[0].id, "F: target stable day ID is preserved");
  check(applied.days.map((day) => day.id).join("|") === original.days.map((day) => day.id).join("|"), "F: day order and IDs are preserved");
  check(JSON.stringify(applied.routeIds) === JSON.stringify(original.routeIds), "F: route set/order is preserved");
  check(JSON.stringify(applied.days.slice(1)) === JSON.stringify(original.days.slice(1)), "F: other days and their boundaries are unchanged");
  check(applied.startDate === original.startDate && applied.endDate === original.endDate, "F: trip dates are unchanged");
  check(JSON.stringify(applied.visitStartTimes) === JSON.stringify(original.visitStartTimes), "F: visit start times are unchanged");
  check(JSON.stringify(applied.accommodations) === JSON.stringify(original.accommodations) && JSON.stringify(applied.accommodationLegs) === JSON.stringify(original.accommodationLegs), "F: accommodations and their legs are unchanged");
  check(JSON.stringify(applied.interHubSegments) === JSON.stringify(original.interHubSegments) && JSON.stringify(applied.zoneAccommodationChoices) === JSON.stringify(original.zoneAccommodationChoices), "F: inter-hub and zone choices are unchanged");
  check(await root.locator(".day-order-tool").count() === 0, "F: panel closes after a successful apply");
  check(await trigger.evaluate((element) => document.activeElement === element), "F: focus returns to the same day trigger after apply");
  check(await writeCount(page) === 1, "F: applying creates exactly one draft storage write");
  await page.reload();
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  await root.locator(".day-card[data-day-id='day-a'] .trip-stop").first().waitFor();
  const afterReload = await readDraft(page);
  check(JSON.stringify(afterReload.days[0].placeIds) === JSON.stringify(afterOption), `F: reload preserves applied proposal (wanted=${JSON.stringify(afterOption)}, got=${JSON.stringify(afterReload.days[0].placeIds)})`);
  check(afterReload.days[0].id === original.days[0].id, "F: stable day identity survives reload");
  check(errors.length === 0, `L: no browser console errors (${errors.join("; ")})`);
  await main.context.close();

  // Each evidence-complete family remains an option inside the day tool. Loading it changes only
  // the ephemeral proposal; the one day-local CTA performs the commit.
  const evidenceCases = [
    {
      family: "Intercambios adyacentes",
      baseline: ["JP-006", "JP-034", "JP-035", "JP-036", "JP-033"],
      expected: ["JP-006", "JP-035", "JP-034", "JP-036", "JP-033"],
    },
    {
      family: "Reubicaciones de un lugar",
      baseline: ["JP-010", "JP-012", "JP-011", "JP-013", "JP-014"],
      expected: ["JP-010", "JP-013", "JP-012", "JP-011", "JP-014"],
    },
    {
      family: "Intercambios no adyacentes",
      baseline: ["JP-028", "JP-026", "JP-022", "JP-027", "JP-025"],
      expected: ["JP-028", "JP-027", "JP-022", "JP-026", "JP-025"],
    },
    {
      family: "Reversiones de cuatro lugares",
      baseline: ["JP-202", "JP-153", "JP-155", "JP-156", "JP-161", "JP-154"],
      expected: ["JP-202", "JP-161", "JP-156", "JP-155", "JP-153", "JP-154"],
    },
    {
      family: "Intercambios de bloques de dos lugares",
      baseline: ["JP-202", "JP-153", "JP-156", "JP-161", "JP-154", "JP-155"],
      expected: ["JP-202", "JP-161", "JP-154", "JP-153", "JP-156", "JP-155"],
    },
  ];
  for (const [index, fixture] of evidenceCases.entries()) {
    const dayId = `b29-evidence-${index + 1}`;
    const fixtureCase = await setupEvidenceFixture(fixture.baseline, dayId);
    const fixtureTrigger = fixtureCase.dayCard.getByRole("button", { name: "Probar otro orden del Día 1" });
    await resetWrites(fixtureCase.page);
    await fixtureTrigger.click();
    const fixturePanel = fixtureCase.dayCard.locator(".day-order-tool");
    await fixturePanel.waitFor();
    const optionGroup = fixturePanel.locator(".day-order-tool__group").filter({ hasText: fixture.family });
    check(await optionGroup.count() === 1, `E-${index + 1}: ${fixture.family} is available in the day tool`);
    await optionGroup.locator("summary").click();
    check(await optionGroup.getByText("Comprobado con datos completos", { exact: true }).count() > 0, `E-${index + 1}: ${fixture.family} carries the exact evidence label`);
    await optionGroup.getByRole("button", { name: "Probar esta opción" }).first().click();
    const loadedProposal = idsForNames(await orderNames(fixturePanel.locator(".day-order-tool__order").nth(1)));
    check(JSON.stringify(loadedProposal) === JSON.stringify(fixture.expected), `E-${index + 1}: ${fixture.family} loads its deterministic candidate`);
    check(await writeCount(fixtureCase.page) === 0 && JSON.stringify((await readDraft(fixtureCase.page)).days[0].placeIds) === JSON.stringify(fixture.baseline), `E-${index + 1}: loading ${fixture.family} leaves the persisted day unchanged`);
    check(await fixturePanel.getByRole("button", { name: "Usar este orden", exact: true }).count() === 1, `E-${index + 1}: ${fixture.family} has the single explicit commit action`);
    await fixturePanel.getByRole("button", { name: "Usar este orden", exact: true }).click();
    await fixtureCase.page.waitForFunction(() => window.__b29DraftWrites.length === 1);
    const committed = await readDraft(fixtureCase.page);
    check(committed.days[0].id === dayId && JSON.stringify(committed.days[0].placeIds) === JSON.stringify(fixture.expected), `E-${index + 1}: ${fixture.family} applies to the same stable day`);
    check(await writeCount(fixtureCase.page) === 1 && JSON.stringify(committed.routeIds) === JSON.stringify(fixture.baseline), `E-${index + 1}: ${fixture.family} commits once and preserves routeIds`);
    check(fixtureCase.errors.length === 0, `L-${index + 1}: ${fixture.family} browser console is clean (${fixtureCase.errors.join("; ")})`);
    await fixtureCase.context.close();
  }

  // G: Cancel and Escape discard separate ephemeral proposals and restore focus to their opener.
  const cancelCase = await setup();
  await resetWrites(cancelCase.page);
  let cancelTool = await openTool(cancelCase.page, cancelCase.root);
  await cancelTool.panel.getByLabel(`Mover ${byId.get(ids[0]).name} a la posición en la propuesta del Día 1`).selectOption("6");
  await cancelTool.panel.getByRole("button", { name: "Cancelar", exact: true }).click();
  check(await cancelCase.root.locator(".day-order-tool").count() === 0 && await writeCount(cancelCase.page) === 0, "G: Cancel closes without a storage write");
  check(JSON.stringify((await readDraft(cancelCase.page)).days[0].placeIds) === JSON.stringify(dayPlaceIds), "G: Cancel leaves timeline order unchanged");
  check(await cancelTool.trigger.evaluate((element) => document.activeElement === element), "G: Cancel restores focus to same day trigger");
  cancelTool = await openTool(cancelCase.page, cancelCase.root);
  check((await orderNames(cancelTool.panel.locator(".day-order-tool__order").nth(1))).join("|") === dayPlaceIds.map((id) => byId.get(id).name).join("|"), "B/G: reopening starts from persisted order");
  await cancelTool.panel.getByLabel(`Mover ${byId.get(ids[1]).name} a la posición en la propuesta del Día 1`).selectOption("6");
  await cancelCase.page.keyboard.press("Escape");
  check(await cancelCase.root.locator(".day-order-tool").count() === 0, "G: Escape closes only the inline tool");
  check(await cancelCase.root.getByRole("heading", { name: "Viaje · Días", exact: true }).count() === 1, "G: Escape leaves the Viaje surface open");
  check(JSON.stringify((await readDraft(cancelCase.page)).days[0].placeIds) === JSON.stringify(dayPlaceIds) && await writeCount(cancelCase.page) === 0, "G: Escape discards proposal without mutation");
  check(await cancelTool.trigger.evaluate((element) => document.activeElement === element), "J: Escape restores focus to the same day trigger");
  await cancelCase.context.close();

  // A keyboard-only B9.3 pass: Enter opens, native position select changes by key, Tab reaches
  // the sole apply action, and Enter commits exactly one write.
  const keyboardCase = await setup();
  await resetWrites(keyboardCase.page);
  const keyboardTrigger = card(keyboardCase.root).getByRole("button", { name: "Probar otro orden del Día 1" });
  await keyboardTrigger.focus();
  await keyboardCase.page.keyboard.press("Enter");
  const keyboardPanel = card(keyboardCase.root).locator(".day-order-tool");
  await keyboardPanel.waitFor();
  check(await keyboardPanel.locator("h3").evaluate((element) => document.activeElement === element), "J: Enter opens the tool and moves focus to its heading");
  await keyboardCase.page.keyboard.press("Tab"); // Close button
  await keyboardCase.page.keyboard.press("Tab"); // First proposal position select
  const focusedPosition = await keyboardCase.page.evaluate(() => ({
    label: document.activeElement?.getAttribute("aria-label") ?? "",
    tag: document.activeElement?.tagName ?? "",
  }));
  check(focusedPosition.tag === "SELECT" && focusedPosition.label.includes("en la propuesta del Día 1"), "J: Tab reaches the proposal's native position control");
  await keyboardCase.page.keyboard.press("End");
  const keyboardExpected = [...dayPlaceIds.slice(1), dayPlaceIds[0]];
  check(JSON.stringify(idsForNames(await orderNames(keyboardPanel.locator(".day-order-tool__order").nth(1)))) === JSON.stringify(keyboardExpected), "J: keyboard End changes only the proposal order");
  check(await writeCount(keyboardCase.page) === 0, "J: keyboard proposal edit performs zero writes");
  const keyboardApply = keyboardPanel.getByRole("button", { name: "Usar este orden", exact: true });
  let tabCount = 0;
  while (!(await keyboardApply.evaluate((element) => document.activeElement === element)) && tabCount < 100) {
    await keyboardCase.page.keyboard.press("Tab");
    tabCount += 1;
  }
  check(await keyboardApply.evaluate((element) => document.activeElement === element), "J: Tab reaches «Usar este orden» from the proposal controls");
  await keyboardCase.page.keyboard.press("Enter");
  await keyboardCase.page.waitForFunction(() => window.__b29DraftWrites.length === 1);
  check(JSON.stringify((await readDraft(keyboardCase.page)).days[0].placeIds) === JSON.stringify(keyboardExpected), "J: Enter applies the keyboard proposal");
  check(await writeCount(keyboardCase.page) === 1, "J: keyboard apply creates exactly one storage write");
  check(await keyboardTrigger.evaluate((element) => document.activeElement === element), "J: keyboard apply restores focus to the same day trigger");
  await keyboardCase.context.close();

  // Stable day identity end to end: move the day first, then open and apply against its new ordinal.
  const movedDayCase = await setup();
  const movedDayPlanBefore = await readDraft(movedDayCase.page);
  await card(movedDayCase.root, "day-a").getByLabel("Mover Día 1 a la posición").selectOption("1");
  const afterDayMove = await readDraft(movedDayCase.page);
  check(JSON.stringify(afterDayMove.days.map((day) => day.id)) === JSON.stringify(["day-b", "day-a", "day-c"]), "F: fixture moves the target day while preserving its stable id");
  await resetWrites(movedDayCase.page);
  const movedDayCard = card(movedDayCase.root, "day-a");
  const movedDayTrigger = movedDayCard.getByRole("button", { name: "Probar otro orden del Día 2" });
  await movedDayTrigger.click();
  const movedDayPanel = movedDayCard.locator(".day-order-tool");
  await movedDayPanel.waitFor();
  check((await orderNames(movedDayPanel.locator(".day-order-tool__order").nth(0))).join("|") === dayPlaceIds.map((id) => byId.get(id).name).join("|"), "F: moved stable day opens with its own current order");
  check((await orderNames(movedDayPanel.locator(".day-order-tool__order").nth(1))).join("|") === dayPlaceIds.map((id) => byId.get(id).name).join("|"), "F: proposal starts from that moved day's exact order");
  check(await writeCount(movedDayCase.page) === 0, "F: opening the moved day's tool performs zero writes");
  await movedDayPanel.getByLabel(`Mover ${byId.get(dayPlaceIds[0]).name} a la posición en la propuesta del Día 2`).selectOption("6");
  const movedDayExpected = [...dayPlaceIds.slice(1), dayPlaceIds[0]];
  await movedDayPanel.getByRole("button", { name: "Usar este orden", exact: true }).click();
  await movedDayCase.page.waitForFunction(() => window.__b29DraftWrites.length === 1);
  const movedDayApplied = await readDraft(movedDayCase.page);
  check(movedDayApplied.days[1].id === "day-a" && JSON.stringify(movedDayApplied.days[1].placeIds) === JSON.stringify(movedDayExpected), "F: apply addresses the stable day id at its new ordinal");
  check(movedDayApplied.days[0].id === "day-b" && JSON.stringify(movedDayApplied.days[0]) === JSON.stringify(afterDayMove.days[0]), "F: preceding day and its boundary remain intact");
  check(movedDayApplied.days[2].id === "day-c" && JSON.stringify(movedDayApplied.days[2]) === JSON.stringify(afterDayMove.days[2]), "F: following day and its boundary remain intact");
  check(JSON.stringify(movedDayApplied.routeIds) === JSON.stringify(movedDayPlanBefore.routeIds), "F: route set/order survives applying after a day move");
  check(await writeCount(movedDayCase.page) === 1 && await movedDayTrigger.evaluate((element) => document.activeElement === element), "F: moved-day apply writes once and restores focus to its trigger");
  await movedDayCase.context.close();

  // H/L: an underlying persisted change makes the snapshot stale and disables commit.
  const staleCase = await setup();
  await resetWrites(staleCase.page);
  const staleTool = await openTool(staleCase.page, staleCase.root);
  await staleTool.panel.getByLabel(`Mover ${byId.get(ids[0]).name} a la posición en la propuesta del Día 1`).selectOption("6");
  const underlyingMove = card(staleCase.root).locator(".trip-stop").first();
  const underlyingUnassign = underlyingMove.getByRole("button", { name: "Mover a Sin asignar" });
  await underlyingUnassign.focus();
  await underlyingUnassign.press("Enter");
  await staleTool.panel.getByRole("alert").waitFor();
  check(await staleTool.panel.getByRole("button", { name: "Usar este orden", exact: true }).isDisabled(), "H: stale baseline disables apply");
  const stalePersisted = await readDraft(staleCase.page);
  check(JSON.stringify(stalePersisted.days[0].placeIds) !== JSON.stringify(dayPlaceIds), "H: external timeline change is present in real draft");
  const staleWrites = await writeCount(staleCase.page);
  check(staleWrites === 1, "H: only external timeline action wrote the draft");
  check(JSON.stringify(stalePersisted.days[0].placeIds) !== JSON.stringify(idsForNames(await orderNames(staleTool.panel.locator(".day-order-tool__order").nth(1)))), "H: stale proposal did not overwrite newer day order");
  await staleCase.context.close();

  // Same stale set, different persisted order: applying the old proposal must still fail closed.
  const staleOrderCase = await setup();
  await resetWrites(staleOrderCase.page);
  const staleOrderTool = await openTool(staleOrderCase.page, staleOrderCase.root);
  await staleOrderTool.panel.getByLabel(`Mover ${byId.get(ids[0]).name} a la posición en la propuesta del Día 1`).selectOption("6");
  const underlyingStop = card(staleOrderCase.root).locator(".trip-stop").first();
  const underlyingMoveButton = underlyingStop.getByRole("button", { name: "Mover a…" });
  await underlyingMoveButton.focus();
  await underlyingMoveButton.press("Enter");
  const underlyingMovePanel = underlyingStop.locator(".trip-stop__move-panel");
  await underlyingMovePanel.getByLabel("Posición").selectOption("2");
  const underlyingConfirmMove = underlyingMovePanel.getByRole("button", { name: "Mover parada" });
  await underlyingConfirmMove.focus();
  await underlyingConfirmMove.press("Enter");
  const staleSameSet = await readDraft(staleOrderCase.page);
  check(JSON.stringify(staleSameSet.days[0].placeIds) !== JSON.stringify(dayPlaceIds), "H: external same-day reorder changes the current order");
  check(JSON.stringify([...staleSameSet.days[0].placeIds].sort()) === JSON.stringify([...dayPlaceIds].sort()), "H: stale-order fixture preserves exactly the same set");
  await staleOrderTool.panel.getByRole("alert").waitFor();
  check(await staleOrderTool.panel.getByRole("button", { name: "Usar este orden", exact: true }).isDisabled(), "H: same-set stale baseline disables apply");
  check(await writeCount(staleOrderCase.page) === 1, "H: same-set stale flow records only the external B28 move");
  await staleOrderCase.page.waitForTimeout(100);
  check(JSON.stringify((await readDraft(staleOrderCase.page)).days[0].placeIds) === JSON.stringify(staleSameSet.days[0].placeIds), "H: stale proposal cannot overwrite the newer same-set order");
  await staleOrderCase.context.close();

  // I: zero/single-place days have no fictitious proposal.
  const small = await setup({ emptyPlan: true, days: [[], [ids[0]]] });
  const emptyTrigger = card(small.root, "day-a").getByRole("button", { name: "Probar otro orden del Día 1" });
  const singleTrigger = card(small.root, "day-b").getByRole("button", { name: "Probar otro orden del Día 2" });
  check(await emptyTrigger.isDisabled() && await singleTrigger.isDisabled(), "I: empty/single day tool is unavailable");
  check(await small.root.locator(".day-order-tool").count() === 0, "I: no synthetic proposal is opened");
  await small.context.close();

  // K/L: responsive, touch targets, no horizontal overflow, and screenshots across all sizes.
  for (const [width, height] of viewports) {
    const sample = await setup({ viewport: { width, height } });
    const opened = await openTool(sample.page, sample.root);
    check(await sample.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `K ${width}x${height}: no horizontal page overflow`);
    check(await opened.panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `K ${width}x${height}: panel has no horizontal overflow`);
    const undersized = await opened.panel.locator("button:visible, select:visible, summary:visible").evaluateAll((elements) => elements.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    }).map((element) => `${element.tagName}:${element.getAttribute("aria-label") || element.textContent?.trim()}:${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`));
    check(undersized.length === 0, `K ${width}x${height}: touch targets >=44px${undersized.length ? ` (${undersized.slice(0, 2).join(", ")})` : ""}`);
    const cta = opened.panel.getByRole("button", { name: "Usar este orden", exact: true });
    check(await cta.count() === 1, `K ${width}x${height}: apply CTA present`);
    await cta.scrollIntoViewIfNeeded();
    const ctaGeometry = await cta.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const tab = document.querySelector(".tab-bar");
      const tabBox = tab?.getBoundingClientRect();
      const tabVisible = Boolean(tab && tab.getClientRects().length && getComputedStyle(tab).display !== "none");
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 2);
      return {
        safe: !tabVisible || Boolean(tabBox && box.bottom <= tabBox.top && !tab?.contains(hit)),
        cta: { top: box.top, bottom: box.bottom },
        tab: tabBox ? { top: tabBox.top, bottom: tabBox.bottom, visible: tabVisible } : null,
        hit: hit ? `${hit.tagName}.${String(hit.className)}` : null,
      };
    });
    check(ctaGeometry.safe, `K ${width}x${height}: CTA remains above and outside the TabBar hit region (${JSON.stringify(ctaGeometry)})`);
    await capture(sample.page, `b29-${width}x${height}`);
    await opened.panel.locator("h3").scrollIntoViewIfNeeded();
    if (shots && [320, 390, 1440].includes(width)) await sample.page.screenshot({ path: `${shots}/b29-${width}x${height}-tool-top.png` });
    await cta.scrollIntoViewIfNeeded();
    if (shots && [320, 390, 1440].includes(width)) await sample.page.screenshot({ path: `${shots}/b29-${width}x${height}-tool-actions.png` });
    await sample.context.close();
  }

  // B28 keyboard move remains live after close; the full mouse/touch drag regression runs below.
  const regression = await setup();
  const regTool = await openTool(regression.page, regression.root);
  await regression.page.keyboard.press("Escape");
  const regressionCard = card(regression.root);
  check(await regTool.trigger.getAttribute("aria-expanded") === "false", "L: Escape closed proposal before the B28 drag regression");
  const storageKeysBeforeRegression = await regression.page.evaluate(() => Object.keys(localStorage).sort());
  const moveStop = regressionCard.locator(".trip-stop").first();
  check(await regressionCard.getByRole("button", { name: "Mover a…" }).count() === ids.length, "L: B28 Mover a… remains available after tool closes");
  const moveBefore = [...(await readDraft(regression.page)).days[0].placeIds];
  const moveToggle = moveStop.getByRole("button", { name: "Mover a…" });
  await keyboardActivate(moveToggle);
  const movePanel = moveStop.locator(".trip-stop__move-panel");
  await movePanel.getByLabel("Posición").selectOption({ value: "1" });
  await keyboardActivate(movePanel.getByRole("button", { name: "Mover parada" }));
  await regression.page.waitForFunction(({ key, before }) => JSON.stringify(JSON.parse(localStorage.getItem(key)).days[0].placeIds) !== JSON.stringify(before), { key: storageKey, before: moveBefore }, { timeout: 5000 });
  const afterKeyboardMove = [...(await readDraft(regression.page)).days[0].placeIds];
  check(JSON.stringify(afterKeyboardMove) === JSON.stringify([moveBefore[1], moveBefore[0], ...moveBefore.slice(2)]), "L: B28 Mover a… still performs an accessible keyboard reorder");
  check(await regTool.trigger.getAttribute("aria-expanded") === "false", "L: tool closed without leaving an overlay");
  check(JSON.stringify(await regression.page.evaluate(() => Object.keys(localStorage).sort())) === JSON.stringify(storageKeysBeforeRegression), "L: B9.3 adds no storage key");
  check(regression.errors.length === 0, `L: regression browser console is clean (${regression.errors.join("; ")})`);
  await regression.context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

const b28Output = execFileSync(process.execPath, [fileURLToPath(new URL("./b28-reorder-dnd-check.mjs", import.meta.url))], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: process.env,
  encoding: "utf8",
});
check(b28Output.includes("B28 PASS 64/64"), `L: B28 pointer/touch regression passed (${b28Output.trim()})`);
console.log(b28Output.trim());
console.log(`B29 Day Tools gate: PASS (${checks} checks; Chromium ${browserPath}; 8 viewports${shots ? `; screenshots ${shots}` : ""}).`);
