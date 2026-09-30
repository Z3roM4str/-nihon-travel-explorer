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
  check(await cancelCase.root.getByRole("heading", { name: "Viaje", exact: true }).count() === 1, "G: Escape leaves the Viaje surface open");
  check(JSON.stringify((await readDraft(cancelCase.page)).days[0].placeIds) === JSON.stringify(dayPlaceIds) && await writeCount(cancelCase.page) === 0, "G: Escape discards proposal without mutation");
  check(await cancelTool.trigger.evaluate((element) => document.activeElement === element), "J: Escape restores focus to the same day trigger");
  await cancelCase.context.close();

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
