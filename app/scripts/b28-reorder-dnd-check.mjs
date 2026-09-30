import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8")).slice(0, 7);
const ids = places.map((place) => place.id);
const key = "nihon.manualPlanningDraft";
const wishlistKey = "nihon.travellers.v1";
const viewports = [[320,568],[375,667],[390,844],[430,932],[820,1180],[1024,768],[1280,800],[1440,900]];
const shots = process.env.NIHON_B28_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.NIHON_CHROMIUM_PATH || chromium.executablePath() });
const server = await preview({ root: fileURLToPath(new URL("..", import.meta.url)), preview: { host: "127.0.0.1", port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
let checks = 0;
function check(value, message) { checks++; if (!value) throw new Error(message); }
async function plan(page) { return page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key); }
async function shot(page, name) { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); }
async function setup(viewport = { width: 390, height: 844 }, hasTouch = false, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, hasTouch, isMobile: hasTouch, reducedMotion });
  await context.addInitScript(({ placeIds, storageKey, savedKey }) => {
    window.__b28DraftWrites = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(storageName, value) {
      if (storageName === storageKey) window.__b28DraftWrites.push(value);
      return originalSetItem.call(this, storageName, value);
    };
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem("nihon.onboarding.seen.v1", "1");
    localStorage.setItem(savedKey, JSON.stringify({ version: 1,
      travellers: [{ id: "b28", label: "Marta" }], activeTravellerId: "b28",
      interests: placeIds.map((placeId) => ({ placeId, stances: [{ travellerId: "b28", stance: "interested" }], carriedOver: false })),
    }));
    const boundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };
    localStorage.setItem(storageKey, JSON.stringify({ version: 8, routeIds: placeIds.slice(0, 6),
      days: [
        { id: "day-a", placeIds: placeIds.slice(0, 4), accommodationBoundary: boundary },
        { id: "day-b", placeIds: [placeIds[4], placeIds[5]], accommodationBoundary: boundary },
        { id: "day-c", placeIds: [], accommodationBoundary: boundary },
      ], startDate: "2027-02-22", endDate: "2027-03-05", visitStartTimes: {}, accommodations: [],
      accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [],
    }));
  }, { placeIds: ids, storageKey: key, savedKey: wishlistKey });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  const root = page.locator(".destination-panel:not([hidden])");
  await root.locator(".day-card").first().waitFor();
  return { context, page, root, errors };
}
function card(root, id) { return root.locator(`.day-card[data-day-id="${id}"]`); }
async function point(locator, fraction = .5) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height * fraction };
}
async function mouseDrag(page, handle, destination, release = true, fraction = .25) {
  const start = await point(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = await point(destination, fraction);
  await page.mouse.move(end.x, end.y, { steps: 12 });
  if (shots) await shot(page, `drag-${checks}`);
  if (release) await page.mouse.up();
  return end;
}
async function mouseDragTo(page, handle, destination) {
  const start = await point(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = typeof destination === "function" ? await destination() : destination;
  await page.mouse.move(end.x, end.y, { steps: 12 });
  return end;
}
async function touchDrag(page, handle, destination) {
  const start = await point(handle);
  const cdp = await page.context().newCDPSession(page);
  const pointAt = (x, y) => [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pointAt(start.x, start.y) });
  const end = await point(destination, .25);
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pointAt(start.x + (end.x - start.x) * i / 12, start.y + (end.y - start.y) * i / 12) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

try {
  const { context, page, root, errors } = await setup();
  const originalKeys = await page.evaluate(() => Object.keys(localStorage).sort());
  const wishlist = await page.evaluate((k) => localStorage.getItem(k), wishlistKey);
  const first = card(root, "day-a");
  check(await first.getByRole("button", { name: "Mover a…" }).count() === 4, "A: keyboard path missing");
  check(await first.getByRole("button", { name: `Arrastrar ${places[0].name}` }).count() === 1, "A: drag handle missing");
  check(await first.locator(".trip-stop__handle").first().evaluate((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)) >= 44, "J: handle target <44px");
  await shot(page, "390-baseline");

  const dragStatus = root.locator('.visually-hidden[role="status"][aria-live="polite"]');
  await mouseDragTo(page, first.locator('[data-drag-place-id="' + ids[0] + '"]'), async () => {
    await first.locator(".trip-stop").nth(3).scrollIntoViewIfNeeded();
    return page.evaluate(() => {
      const stops = [...document.querySelectorAll('.day-card[data-day-id="day-a"] .trip-stop')];
      const c = stops[2].getBoundingClientRect();
      const d = stops[3].getBoundingClientRect();
      return { x: d.left + d.width / 2, y: (c.top + c.height / 2 + d.top + d.height / 2) / 2 };
    });
  });
  const positionDuringDrag = (await dragStatus.textContent()).trim();
  check(positionDuringDrag === "Día 1, posición 3.", "B: live region reports effective A-between-C/D position 3 during drag; found: " + positionDuringDrag);
  await page.mouse.up();
  check(JSON.stringify((await plan(page)).days[0].placeIds) === JSON.stringify([ids[1], ids[2], ids[0], ids[3]]), "B: A between C and D becomes B C A D");
  check((await dragStatus.textContent()).trim() === "Parada movida al Día 1, posición 3.", "B: final announcement reports effective same-day position 3");

  await mouseDragTo(page, first.locator('[data-drag-place-id="' + ids[3] + '"]'), () => point(first.locator(".trip-stop").first(), .25));
  check((await dragStatus.textContent()).trim() === "Día 1, posición 1.", "B: D-to-start live region reports position 1 during drag");
  await page.mouse.up();
  check(JSON.stringify((await plan(page)).days[0].placeIds) === JSON.stringify([ids[3], ids[1], ids[2], ids[0]]), "B: D to start preserves the exact final order");
  check((await dragStatus.textContent()).trim() === "Parada movida al Día 1, posición 1.", "B: final D-to-start announcement reports position 1");
  await mouseDrag(page, first.locator('[data-drag-place-id="' + ids[3] + '"]'), first.locator(".trip-stop").last(), true, .8);
  await mouseDrag(page, first.locator('[data-drag-place-id="' + ids[0] + '"]'), first.locator(".trip-stop").first());
  check(JSON.stringify((await plan(page)).days[0].placeIds) === JSON.stringify(ids.slice(0, 4)), "B: live-region cases restore the original order for the remaining gate");

  await mouseDrag(page, first.locator(`[data-drag-place-id="${ids[0]}"]`), first.locator(".trip-stop").nth(2));
  check(JSON.stringify((await plan(page)).days[0].placeIds) === JSON.stringify([ids[1], ids[0], ids[2], ids[3]]), "B: same-day 0 to 1");
  await mouseDrag(page, first.locator(`[data-drag-place-id="${ids[0]}"]`), first.locator(".trip-stop").first());
  check((await plan(page)).days[0].placeIds[0] === ids[0], "B: same-day middle to start");
  const unchanged = JSON.stringify(await plan(page));
  await mouseDrag(page, first.locator(`[data-drag-place-id="${ids[3]}"]`), first.locator(".trip-stop").last());
  check(JSON.stringify(await plan(page)) === unchanged, "B: last to same slot changed draft");

  const writesBeforeCross = await page.evaluate(() => window.__b28DraftWrites.length);
  await mouseDrag(page, first.locator(`[data-drag-place-id="${ids[1]}"]`), card(root, "day-b").locator(".trip-stop").first());
  let current = await plan(page);
  check(await page.evaluate(() => window.__b28DraftWrites.length) === writesBeforeCross + 1, "C: cross-day drop persisted more than once");
  check(JSON.stringify(current.days.map((d) => d.id)) === JSON.stringify(["day-a", "day-b", "day-c"]), "C: day IDs changed");
  check(JSON.stringify(current.days[1].placeIds) === JSON.stringify([ids[1], ids[4], ids[5]]), "C: cross-day exact position");
  check(JSON.stringify(current.routeIds) === JSON.stringify(ids.slice(0, 6)), "C: route IDs changed");
  check(current.startDate === "2027-02-22" && current.endDate === "2027-03-05", "C: bounds changed");
  await page.waitForFunction((placeId) => document.activeElement?.getAttribute("data-drag-place-id") === placeId, ids[1]);
  check(true, "J: focus restored after drop");
  await shot(page, "390-cross-day");

  await mouseDrag(page, first.locator(`[data-drag-place-id="${ids[2]}"]`), card(root, "day-c").locator(".sequence-empty"));
  check((await plan(page)).days[2].placeIds[0] === ids[2], "D: empty day drop");
  await shot(page, "390-empty-day");

  const drawer = root.locator(".unassigned-drawer");
  await drawer.locator("summary").click();
  const beforeUnassigned = await plan(page);
  await mouseDrag(page, drawer.locator(`[data-drag-place-id="${ids[6]}"]`), card(root, "day-b").locator(".trip-stop").last());
  current = await plan(page);
  check(JSON.stringify(current.days[1].placeIds) === JSON.stringify([ids[1], ids[4], ids[6], ids[5]]), "E: unassigned exact middle position");
  check(await drawer.locator(`[data-drag-place-id="${ids[6]}"]`).count() === 0, "E: drawer item remained");
  check(await drawer.locator("summary").textContent() === "0 sitios sin día", "E: drawer count wrong");
  check(await page.evaluate((k) => localStorage.getItem(k), wishlistKey) === wishlist, "E: wishlist changed");
  check(JSON.stringify(current.visitStartTimes) === JSON.stringify(beforeUnassigned.visitStartTimes) &&
    JSON.stringify(current.accommodationLegs) === JSON.stringify(beforeUnassigned.accommodationLegs) &&
    JSON.stringify(current.interHubSegments) === JSON.stringify(beforeUnassigned.interHubSegments), "E: pruned route state reappeared");
  await page.reload();
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  check((await plan(page)).days[1].placeIds.includes(ids[6]), "E: reload lost decision");

  const afterReload = page.locator(".destination-panel:not([hidden])");
  const stop = card(afterReload, "day-a").locator(`[data-drag-place-id="${ids[0]}"]`);
  const beforeCancel = JSON.stringify(await plan(page));
  await mouseDrag(page, stop, card(afterReload, "day-b").locator(".trip-stop").first(), false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  check(JSON.stringify(await plan(page)) === beforeCancel, "F: Escape mutated draft");
  const start = await point(stop);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 20, start.y + 20);
  await page.mouse.move(1, 1); await page.mouse.up();
  check(JSON.stringify(await plan(page)) === beforeCancel, "F: invalid drop mutated draft");
  const cancelStart = await point(stop);
  await page.mouse.move(cancelStart.x, cancelStart.y); await page.mouse.down();
  await page.mouse.move(cancelStart.x + 18, cancelStart.y + 18);
  await stop.evaluate((element) => element.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 })));
  await page.mouse.up();
  check(JSON.stringify(await plan(page)) === beforeCancel, "F: pointercancel mutated draft");
  await mouseDrag(page, stop, card(afterReload, "day-b").locator(".trip-stop").first(), false);
  await stop.evaluate((element) => element.releasePointerCapture(1));
  await page.mouse.up();
  check(JSON.stringify(await plan(page)) === beforeCancel, "F: lost pointer capture mutated draft");
  await afterReload.locator(".trip-stop__drag-preview").waitFor({ state: "detached" });
  check(true, "F: lost capture cleared drag UI");

  const moved = card(afterReload, "day-a").locator(".trip-stop").first();
  await moved.getByRole("button", { name: "Mover a…" }).click();
  await moved.getByLabel("Día").selectOption("1");
  await moved.getByLabel("Posición").selectOption("0");
  await moved.getByRole("button", { name: "Mover parada" }).click();
  check((await plan(page)).days[1].placeIds[0] === ids[0], "G: keyboard move broken");
  check(await card(afterReload, "day-a").getByLabel("Mover Día 1 a la posición").count() === 1, "G: whole-day control missing");
  check(JSON.stringify(await page.evaluate(() => Object.keys(localStorage).sort())) === JSON.stringify(originalKeys), "K: new storage key");
  check(errors.length === 0, `K: console ${errors.join(" | ")}`);
  await context.close();

  const positions = await setup({ width: 820, height: 1180 });
  const positionDay = card(positions.root, "day-a");
  await mouseDrag(positions.page, positionDay.locator(`[data-drag-place-id="${ids[0]}"]`), positionDay.locator(".trip-stop").last(), true, .8);
  check(JSON.stringify((await plan(positions.page)).days[0].placeIds) === JSON.stringify([ids[1], ids[2], ids[3], ids[0]]), "B: first to last off by one");
  await mouseDrag(positions.page, positionDay.locator(`[data-drag-place-id="${ids[0]}"]`), positionDay.locator(".trip-stop").first());
  check((await plan(positions.page)).days[0].placeIds[0] === ids[0], "B: last to first failed");
  const sameSlot = JSON.stringify(await plan(positions.page));
  await mouseDrag(positions.page, positionDay.locator(`[data-drag-place-id="${ids[3]}"]`), positionDay.locator(".trip-stop").last(), true, .8);
  check(JSON.stringify(await plan(positions.page)) === sameSlot, "B: last to final slot was not a no-op");
  await positions.context.close();

  const touch = await setup({ width: 390, height: 844 }, true);
  await touchDrag(touch.page, card(touch.root, "day-a").locator(`[data-drag-place-id="${ids[0]}"]`), card(touch.root, "day-a").locator(".trip-stop").nth(2));
  check((await plan(touch.page)).days[0].placeIds[1] === ids[0], "H: touch pointer drag failed");
  await touch.context.close();

  const auto = await setup({ width: 390, height: 844 });
  const autoHandle = card(auto.root, "day-a").locator(`[data-drag-place-id="${ids[0]}"]`);
  const autoStart = await point(autoHandle);
  const scrollPanel = auto.root.locator(".destination-panel--scroll");
  const beforeScroll = await scrollPanel.evaluate((element) => element.scrollTop);
  const panelBox = await scrollPanel.boundingBox();
  await auto.page.mouse.move(autoStart.x, autoStart.y); await auto.page.mouse.down();
  await auto.page.mouse.move(autoStart.x, panelBox.y + panelBox.height - 18, { steps: 8 });
  await auto.page.waitForTimeout(180);
  const afterScroll = await scrollPanel.evaluate((element) => element.scrollTop);
  check(afterScroll > beforeScroll, "J: edge auto-scroll did not advance");
  await auto.page.keyboard.press("Escape"); await auto.page.mouse.up();
  await auto.page.waitForTimeout(80);
  check(await scrollPanel.evaluate((element) => element.scrollTop) === afterScroll, "J: auto-scroll continued after cancellation");
  await auto.context.close();

  const reduced = await setup({ width: 390, height: 844 }, false, "reduce");
  const reducedHandle = card(reduced.root, "day-a").locator('[data-drag-place-id="' + ids[0] + '"]');
  const reducedStart = await point(reducedHandle);
  const reducedPanel = reduced.root.locator(".destination-panel--scroll");
  const reducedBefore = await reducedPanel.evaluate((element) => element.scrollTop);
  const reducedDraft = JSON.stringify(await plan(reduced.page));
  check(await reduced.page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches), "J: reduced-motion browser context is active");
  await reduced.page.evaluate(() => {
    const element = document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll");
    window.__b28ReducedSamples = [];
    let owner = element;
    let descriptor;
    while (owner && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(owner, "scrollTop");
      owner = Object.getPrototypeOf(owner);
    }
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      get() { return descriptor.get.call(element); },
      set(value) {
        const before = descriptor.get.call(element);
        descriptor.set.call(element, value);
        const after = descriptor.get.call(element);
        if (after !== before) window.__b28ReducedSamples.push(after - before);
      },
    });
  });
  const reducedBox = await reducedPanel.boundingBox();
  await reduced.page.mouse.move(reducedStart.x, reducedStart.y);
  await reduced.page.mouse.down();
  await reduced.page.mouse.move(reducedStart.x, reducedBox.y + reducedBox.height - 18, { steps: 8 });
  await reduced.page.waitForFunction((start) => document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll").scrollTop >= start + 192, reducedBefore, { timeout: 2400 }).catch(async () => {
    const diagnostic = await reduced.page.evaluate(() => {
      const root = document.querySelector(".destination-panel:not([hidden])");
      const body = root?.querySelector(".analysis-body");
      const panel = root?.querySelector(".destination-panel--scroll");
      return { reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, body: body && { top: body.scrollTop, height: body.scrollHeight, client: body.clientHeight }, panel: panel && { top: panel.scrollTop, height: panel.scrollHeight, client: panel.clientHeight } };
    });
    throw new Error("J: reduced-motion scrolling timed out: " + JSON.stringify(diagnostic));
  });
  const reducedAfter = await reducedPanel.evaluate((element) => element.scrollTop);
  const reducedSteps = await reduced.page.evaluate(() => window.__b28ReducedSamples);
  check(reducedAfter - reducedBefore >= 192, "J: reduced-motion edge steps reveal content at least 192px beyond the initial viewport");
  check(reducedSteps.length >= 3 && reducedSteps.every((step) => Math.abs(step) >= 60), "J: reduced-motion policy uses discrete 64px steps instead of frame-by-frame scrolling; observed " + JSON.stringify(reducedSteps));
  await reduced.page.keyboard.press("Escape");
  const stoppedAtEscape = await reducedPanel.evaluate((element) => element.scrollTop);
  await reduced.page.mouse.up();
  await reduced.page.waitForTimeout(220);
  check(await reducedPanel.evaluate((element, top) => element.scrollTop === top, stoppedAtEscape), "J: Escape immediately cancels the pending reduced-motion step");
  check(JSON.stringify(await plan(reduced.page)) === reducedDraft, "J: reduced-motion Escape leaves the draft intact");
  await reduced.context.close();

  for (const [width, height] of viewports) {
    const sample = await setup({ width, height });
    check(await sample.root.locator(".day-card").count() === 3, `I: missing days ${width}`);
    check(await sample.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `I: horizontal overflow ${width}`);
    await shot(sample.page, `${width}x${height}`);
    await sample.root.locator(".trip-stop").first().scrollIntoViewIfNeeded();
    await shot(sample.page, `${width}x${height}-stop`);
    if (width === 320) {
      await sample.root.locator(".unassigned-drawer summary").click();
      await sample.root.locator(".unassigned-drawer [data-drag-place-id]").first().scrollIntoViewIfNeeded();
      check(await sample.root.locator(".unassigned-drawer [data-drag-place-id]").first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || element.contains(hit);
      }), "I: 320px drawer handle is obscured");
      await shot(sample.page, "320x568-drawer");
      const addSelect = sample.root.locator(".unassigned-drawer select").first();
      await addSelect.scrollIntoViewIfNeeded();
      check(await addSelect.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || element.contains(hit);
      }), "I: 320px drawer keyboard alternative is obscured");
      await shot(sample.page, "320x568-drawer-control");
    }
    await sample.context.close();
  }
  console.log(`B28 PASS ${checks}/${checks} checks; pointer mouse + Chromium touch; 8 viewports`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
