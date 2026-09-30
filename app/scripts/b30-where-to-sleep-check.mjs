import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const zones = JSON.parse(readFileSync(new URL("../src/data/accommodation/zones.json", import.meta.url), "utf8")).zones;
const tokyo = places.filter((place) => place.hub === "Tokio");
const kyoto = places.filter((place) => place.hub === "Kioto");
assert.ok(tokyo.length >= 3 && kyoto.length >= 2, "B30 fixture places are missing");

const tokyoTripIds = [tokyo[0].id, tokyo[1].id];
const routeIds = [...tokyoTripIds, kyoto[0].id];
const savedIds = [...routeIds, tokyo[2].id, kyoto[1].id]; // Both extra wishes are outside the route.
const DRAFT_KEY = "nihon.manualPlanningDraft";
const ZONE_COMPARISON_KEY = "nihon.zoneComparison.v1";
const VIEWPORTS = [
  [320, 568],
  [360, 800],
  [390, 844],
  [430, 932],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];
const shotRoot = process.env.NIHON_B30_SHOTS;
if (shotRoot) mkdirSync(shotRoot, { recursive: true });

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { host: "127.0.0.1", port: 0 },
});
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const browserType = process.env.NIHON_BROWSER === "webkit" ? webkit : chromium;
const browserPath = browserType === webkit ? webkit.executablePath() : process.env.NIHON_CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : chromium.executablePath());
const browser = await browserType.launch({ executablePath: browserPath });
let checks = 0;

function check(condition, message) {
  checks += 1;
  assert.ok(condition, `B30 ${message}`);
}

function draftFor({ emptyRoute = false } = {}) {
  const route = emptyRoute ? [] : routeIds;
  const existingAccommodation = {
    id: "b30-existing-accommodation",
    label: "Alojamiento ya guardado",
    location: { lat: 35.68, lng: 139.76 },
  };
  return {
    version: 8,
    routeIds: [...route],
    days: emptyRoute
      ? null
      : [
          {
            id: "b30-day-stable",
            placeIds: [...tokyoTripIds],
            accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } },
          },
          {
            id: "b30-day-kyoto",
            placeIds: [kyoto[0].id],
            accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } },
          },
        ],
    startDate: "2027-02-22",
    endDate: "2027-03-05",
    visitStartTimes: emptyRoute ? {} : { [tokyoTripIds[0]]: "09:30" },
    accommodations: emptyRoute ? [] : [existingAccommodation],
    accommodationLegs: emptyRoute
      ? []
      : [{
          direction: "accommodation-to-place",
          accommodationId: existingAccommodation.id,
          placeId: tokyoTripIds[0],
          minutes: 25,
          source: { kind: "user-entered" },
        }],
    interHubSegments: emptyRoute
      ? []
      : [{
          id: "b30-existing-inter-hub-segment",
          fromPlaceId: tokyoTripIds[1],
          toPlaceId: kyoto[0].id,
          fromHub: "Tokio",
          toHub: "Kioto",
          mode: "shinkansen",
          minutes: 140,
          source: { kind: "user-entered" },
        }],
    zoneAccommodationChoices: [],
  };
}

async function contextFor(viewport, { emptyRoute = false, reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    hasTouch: viewport[0] <= 860,
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  await context.addInitScript(({ draft, savedIds }) => {
    window.__b30StorageWrites = [];
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("nihon.")) window.__b30StorageWrites.push({ method: "set", key });
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key.startsWith("nihon.")) window.__b30StorageWrites.push({ method: "remove", key });
      return originalRemoveItem.call(this, key);
    };

    const draftKey = "nihon.manualPlanningDraft";
    if (localStorage.getItem(draftKey) === null) {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("nihon.travellers.v1", JSON.stringify({
        version: 1,
        travellers: [{ id: "b30", label: "Marta" }],
        activeTravellerId: "b30",
        interests: savedIds.map((placeId) => ({
          placeId,
          stances: [{ travellerId: "b30", stance: "interested" }],
          carriedOver: false,
        })),
      }));
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }
    window.__b30StorageWrites.length = 0;
  }, { draft: draftFor({ emptyRoute }), savedIds });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap\.org/i.test(message.text())) return;
    errors.push(message.text());
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function openTravelZones(page, keyboard = false) {
  await page.getByRole("button", { name: "Viaje", exact: true }).click();
  const sectionButton = page.locator(".viaje-nav__item").filter({ hasText: "Dónde dormir" });
  // The trip section may remember its own active subtab. Start observing immediately before
  // entering this local surface so any writes caused by opening it are visible to the gate.
  await page.evaluate(() => { window.__b30StorageWrites.length = 0; });
  if (keyboard) {
    await sectionButton.focus();
    await sectionButton.press("Enter");
  } else {
    await sectionButton.click();
  }
  const panel = page.locator(".zone-panel.zone-panel--embedded");
  await panel.waitFor();
  await page.waitForFunction(() => {
    const close = document.querySelector('[aria-label="Cerrar dónde dormir"]');
    return close && document.activeElement === close;
  });
  return { panel, sectionButton };
}

async function storageWrites(page) {
  return page.evaluate(() => [...window.__b30StorageWrites]);
}

async function draftSnapshot(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
}

async function overflowState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const panel = document.querySelector(".zone-panel__scroll");
    return {
      viewport: root.scrollWidth <= root.clientWidth + 1,
      panel: !panel || panel.scrollWidth <= panel.clientWidth + 1,
    };
  });
}

async function targetFailures(page) {
  return page.evaluate(() => {
    const panel = document.querySelector(".zone-panel");
    if (!panel) return ["missing zone panel"];
    const failures = [];
    for (const element of panel.querySelectorAll("button, label")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (element.closest(".leaflet-control-container")) continue;
      if (Math.min(rect.width, rect.height) + 0.5 < 44) {
        failures.push({
          element: element.className || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return failures;
  });
}

async function runFullAudit(viewport, index, options = {}) {
  const { context, page, errors } = await contextFor(viewport, options);
  try {
    const { panel } = await openTravelZones(page, true);
    const cards = panel.locator(".zone-card");
    const count = await cards.count();
    check(count >= 4 && count <= 7, `${viewport[0]}x${viewport[1]} real zone alternatives`);
    const renderedZoneIds = await cards.evaluateAll((elements) => elements.map((element) => element.dataset.zoneId));
    const catalogueZoneIds = zones.filter((zone) => zone.hub === "Tokio").map((zone) => zone.id);
    check(JSON.stringify(renderedZoneIds) === JSON.stringify(catalogueZoneIds), `${viewport[0]}x${viewport[1]} alternatives keep catalogue order, not a proximity ranking`);
    check(await page.evaluate(() => {
      const expected = document.querySelector('[aria-label="Cerrar dónde dormir"]');
      return document.activeElement === expected;
    }), `${viewport[0]}x${viewport[1]} open focus reaches the local surface`);
    check((await storageWrites(page)).length === 0, `${viewport[0]}x${viewport[1]} opening makes zero storage writes`);
    check(JSON.stringify(await draftSnapshot(page)) === JSON.stringify(draftFor()), `${viewport[0]}x${viewport[1]} opening preserves the trip draft`);
    check(await panel.locator(".zone-photo-fallback").count() === count, `${viewport[0]}x${viewport[1]} each zone has the honest photo fallback`);
    check(await panel.locator(".zone-card__index, .zone-column__index").count() === 0, `${viewport[0]}x${viewport[1]} no zone position ordinals`);
    check((await panel.locator(".zone-card__evidence-heading").allTextContents()).some((text) => /Hechos/i.test(text)), `${viewport[0]}x${viewport[1]} facts are visibly grouped`);
    check((await panel.locator(".zone-card__evidence-heading").allTextContents()).some((text) => /Cálculo/i.test(text)), `${viewport[0]}x${viewport[1]} trip calculation is visibly grouped`);
    check((await panel.locator(".zone-card__evidence-heading").allTextContents()).some((text) => /Opinión/i.test(text)), `${viewport[0]}x${viewport[1]} editorial opinion is visibly grouped`);
    check((await panel.locator(".zone-panel__note").innerText()).includes(`${tokyoTripIds.length} lugares de este viaje`), `${viewport[0]}x${viewport[1]} calculation uses the 2 Tokyo route places, not wishlist places`);
    check((await panel.locator(".zone-panel__note").innerText()).includes("orden del catálogo, sin ranking"), `${viewport[0]}x${viewport[1]} copy explains that proximity does not rank the alternatives`);
    check(!(await panel.innerText()).match(/la mejor zona|segunda mejor|orden recomendado|recomendamos/i), `${viewport[0]}x${viewport[1]} no recommendation or ranking copy`);

    if (shotRoot) {
      await page.screenshot({ path: `${shotRoot}/b30-${index + 1}-browse-${viewport[0]}x${viewport[1]}.png`, fullPage: true });
    }

    const firstCard = cards.first();
    await firstCard.scrollIntoViewIfNeeded();
    if (shotRoot) {
      await page.screenshot({ path: `${shotRoot}/b30-${index + 1}-zone-card-${viewport[0]}x${viewport[1]}.png` });
    }
    const firstToggle = firstCard.locator("input[type=checkbox]");
    await firstToggle.focus();
    await firstToggle.press("Space");
    check(await firstToggle.getAttribute("aria-label") === `Comparar ${zones.find((zone) => zone.id === renderedZoneIds[0]).name}` && await panel.getByRole("button", { name: "Quitar las zonas marcadas para comparar", exact: true }).count() === 1, `${viewport[0]}x${viewport[1]} comparison controls name their zone and distinguish clearing comparison from removing the chosen zone`);
    check(await firstToggle.isChecked(), `${viewport[0]}x${viewport[1]} zone selection works by keyboard`);
    let writes = await storageWrites(page);
    check(writes.length === 1 && writes[0].key === ZONE_COMPARISON_KEY, `${viewport[0]}x${viewport[1]} explicit comparison selection writes only its existing preference key`);
    check((await storageWrites(page)).every((entry) => entry.key !== DRAFT_KEY), `${viewport[0]}x${viewport[1]} comparison selection leaves V8 unchanged`);
    check(await panel.getByRole("button", { name: "Comparar", exact: true }).isDisabled(), `${viewport[0]}x${viewport[1]} one selected zone cannot open a two-zone comparison`);

    const secondToggle = cards.nth(1).locator("input[type=checkbox]");
    await secondToggle.focus();
    await secondToggle.press("Space");
    check(await secondToggle.isChecked(), `${viewport[0]}x${viewport[1]} second zone also works by keyboard`);
    check((await storageWrites(page)).length === 2, `${viewport[0]}x${viewport[1]} two deliberate compare selections are the only writes so far`);
    const compareButton = panel.getByRole("button", { name: "Comparar", exact: true });
    await compareButton.focus();
    await compareButton.press("Enter");
    const columns = panel.locator(".zone-column");
    await columns.first().waitFor();
    check(await columns.count() === 2, `${viewport[0]}x${viewport[1]} comparison shows exactly the selected zones`);
    check(await panel.locator(".zone-column__index").count() === 0, `${viewport[0]}x${viewport[1]} comparison columns have no ordinal labels`);
    check((await panel.locator(".zone-marker__pin").allTextContents()).every((text) => !/\d/.test(text)), `${viewport[0]}x${viewport[1]} map pins do not imply a ranking`);
    check((await storageWrites(page)).length === 2, `${viewport[0]}x${viewport[1]} comparing makes no additional storage writes`);
    check((await draftSnapshot(page)).days[0].id === "b30-day-stable", `${viewport[0]}x${viewport[1]} stable day id survives comparison`);

    if (shotRoot) {
      await panel.locator(".zone-compare__map").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shotRoot}/b30-${index + 1}-compare-map-${viewport[0]}x${viewport[1]}.png` });
      await page.screenshot({ path: `${shotRoot}/b30-${index + 1}-compare-${viewport[0]}x${viewport[1]}.png`, fullPage: true });
    }

    const overflow = await overflowState(page);
    check(overflow.viewport && overflow.panel, `${viewport[0]}x${viewport[1]} no horizontal overflow (${JSON.stringify(overflow)})`);
    const badTargets = await targetFailures(page);
    check(badTargets.length === 0, `${viewport[0]}x${viewport[1]} controls meet 44px targets (${JSON.stringify(badTargets)})`);

    await panel.getByRole("button", { name: "Volver a las zonas" }).click();
    check(await cards.count() === count, `${viewport[0]}x${viewport[1]} return from compare restores the list`);
    await panel.getByRole("button", { name: "Cerrar dónde dormir" }).click();
    await page.locator(".viaje-nav__item").filter({ hasText: "Días" }).waitFor();
    writes = await storageWrites(page);
    check(writes.length >= 2 && writes.slice(0, 2).every((entry) => entry.key === ZONE_COMPARISON_KEY) && writes.slice(2).every((entry) => entry.key === DRAFT_KEY), `${viewport[0]}x${viewport[1]} leaving writes no new comparison or other data (${JSON.stringify(writes)})`);
    check(JSON.stringify(await draftSnapshot(page)) === JSON.stringify(draftFor()), `${viewport[0]}x${viewport[1]} planner remount serialization preserves the exact V8 model`);
    const beforeReopen = (await storageWrites(page)).length;
    await page.locator(".viaje-nav__item").filter({ hasText: "Dónde dormir" }).click();
    await panel.waitFor();
    check((await storageWrites(page)).length === beforeReopen, `${viewport[0]}x${viewport[1]} reopening reads selection without serializing it`);
    const firstZone = panel.locator(".zone-card").first();
    const action = firstZone.getByRole("button", { name: /^Dormir en / });
    await action.scrollIntoViewIfNeeded();
    const belowTabBar = await action.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const tabBar = document.querySelector(".tab-bar") || document.querySelector(".tabbar");
      const tabRect = tabBar?.getBoundingClientRect();
      const tabTop = tabRect && tabRect.height > 0 ? tabRect.top : window.innerHeight;
      return rect.bottom <= tabTop + 1;
    });
    check(belowTabBar, `${viewport[0]}x${viewport[1]} «Dormir aquí» remains above the mobile navigation after scrolling`);
    const choiceTargetFailures = await targetFailures(page);
    check(choiceTargetFailures.length === 0, `${viewport[0]}x${viewport[1]} choice action keeps its touch target (${JSON.stringify(choiceTargetFailures)})`);

    await action.focus();
    await action.press("Enter");
    const remove = firstZone.getByRole("button", { name: /^Quitar .* del plan$/ });
    check(await remove.evaluate((element) => document.activeElement === element), `${viewport[0]}x${viewport[1]} choosing by keyboard retains focus on this zone's remove action`);
    writes = await storageWrites(page);
    check(writes.length === beforeReopen + 1 && writes.at(-1).key === DRAFT_KEY, `${viewport[0]}x${viewport[1]} explicit zone choice is the only draft write`);
    const after = await draftSnapshot(page);
    check(after.routeIds.join(",") === routeIds.join(","), `${viewport[0]}x${viewport[1]} zone choice preserves route ids`);
    check(after.days[0].id === "b30-day-stable" && after.days[0].placeIds.join(",") === tokyoTripIds.join(","), `${viewport[0]}x${viewport[1]} zone choice preserves the Tokyo day identity and contents`);
    check(after.days[1].id === "b30-day-kyoto" && after.days[1].placeIds[0] === kyoto[0].id, `${viewport[0]}x${viewport[1]} zone choice preserves the Kyoto day`);
    check(after.startDate === "2027-02-22" && after.endDate === "2027-03-05", `${viewport[0]}x${viewport[1]} zone choice preserves the calendar`);
    check(after.visitStartTimes[tokyoTripIds[0]] === "09:30", `${viewport[0]}x${viewport[1]} zone choice preserves the existing visit time`);
    check(after.accommodationLegs.length === 1 && after.accommodationLegs[0].minutes === 25, `${viewport[0]}x${viewport[1]} zone choice preserves the manual accommodation leg`);
    check(after.interHubSegments.length === 1 && after.interHubSegments[0].id === "b30-existing-inter-hub-segment", `${viewport[0]}x${viewport[1]} zone choice preserves the inter-hub segment`);
    check(after.zoneAccommodationChoices.length === 1 && after.accommodations.length === 2 && after.accommodations[0].id === "b30-existing-accommodation", `${viewport[0]}x${viewport[1]} the user choice adds its zone anchor and preserves the existing accommodation`);
    await remove.press("Enter");
    check(await action.evaluate((element) => document.activeElement === element), `${viewport[0]}x${viewport[1]} removing by keyboard restores focus to this zone's sleep action`);
    check((await draftSnapshot(page)).zoneAccommodationChoices.length === 0, `${viewport[0]}x${viewport[1]} removing clears the explicit choice`);
    await action.press("Enter");
    const otherZone = cards.nth(1);
    const change = otherZone.getByRole("button", { name: /^Cambiar la zona del plan a / });
    await change.focus();
    await change.press("Enter");
    const otherRemove = otherZone.getByRole("button", { name: /^Quitar .* del plan$/ });
    check(await otherRemove.evaluate((element) => document.activeElement === element), `${viewport[0]}x${viewport[1]} changing zones retains focus on the newly chosen zone`);
    check(await firstZone.getByRole("button", { name: /^Cambiar la zona del plan a / }).count() === 1 && await panel.locator(".zone-choice-badge").count() === 1, `${viewport[0]}x${viewport[1]} changing zones exposes one chosen state and an unambiguous previous-zone action`);
    await otherRemove.press("Enter");
    check(await otherZone.getByRole("button", { name: /^Dormir en / }).evaluate((element) => document.activeElement === element), `${viewport[0]}x${viewport[1]} removing the replacement retains focus in that zone`);
    await action.focus();
    await action.press("Enter");
    await page.reload({ waitUntil: "domcontentloaded" });
    const { panel: reloadedPanel } = await openTravelZones(page);
    check((await reloadedPanel.locator(".zone-choice-badge").innerText()).includes("Zona elegida para el plan"), `${viewport[0]}x${viewport[1]} explicit zone choice survives reload`);
    check((await storageWrites(page)).length === 0, `${viewport[0]}x${viewport[1]} reload and revisit do not write storage`);
    check(errors.length === 0, `${viewport[0]}x${viewport[1]} browser console is clean (${errors.join(" | ")})`);
  } finally {
    await context.close();
  }
}

async function runComparisonNavigationAudit() {
  const { context, page } = await contextFor([390, 844]);
  try {
    const { panel } = await openTravelZones(page);
    const cards = panel.locator(".zone-card");
    for (let index = 0; index < 4; index += 1) {
      const toggle = cards.nth(index).locator("input[type=checkbox]");
      await toggle.focus();
      await toggle.press("Space");
    }
    check(await cards.nth(4).locator("input[type=checkbox]").isDisabled(), "comparison rejects a fifth zone");
    await panel.getByRole("button", { name: "Comparar", exact: true }).click();
    check(await panel.locator(".zone-column").count() === 4, "comparison renders the maximum four selected zones");
    const selectedIds = await panel.locator(".zone-column").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")));
    await panel.locator(".zone-nearest button").first().click();
    const detail = page.locator(".place-detail");
    await detail.waitFor();
    await detail.getByRole("button", { name: /Dónde dormir/ }).first().click();
    await detail.waitFor({ state: "detached" });
    check(await panel.locator(".zone-compare").isVisible() && JSON.stringify(await panel.locator(".zone-column").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))) === JSON.stringify(selectedIds), "PlaceDetail returns exactly to Where to Sleep comparison and its selected zones");
    check((await storageWrites(page)).every((entry) => entry.key !== DRAFT_KEY) && JSON.stringify(await draftSnapshot(page)) === JSON.stringify(draftFor()), "maximum comparison and PlaceDetail round trip make zero draft writes");
    const columns = panel.locator(".zone-column");
    const firstAction = columns.first().locator(".zone-choice-action__button");
    await firstAction.focus();
    await firstAction.press("Enter");
    check(await firstAction.evaluate((element) => document.activeElement === element) && /^Quitar /.test(await firstAction.getAttribute("aria-label")), "comparison choosing retains focus on the same zone's remove action");
    await firstAction.press("Enter");
    check(await firstAction.evaluate((element) => document.activeElement === element) && /^Dormir en /.test(await firstAction.getAttribute("aria-label")), "comparison removing retains focus on the same zone's sleep action");
    await firstAction.press("Enter");
    const secondAction = columns.nth(1).locator(".zone-choice-action__button");
    await secondAction.focus();
    await secondAction.press("Enter");
    check(await secondAction.evaluate((element) => document.activeElement === element) && /^Quitar /.test(await secondAction.getAttribute("aria-label")), "comparison changing zones retains focus on the new zone's remove action");
    await secondAction.press("Enter");
    check(await secondAction.evaluate((element) => document.activeElement === element) && /^Dormir en /.test(await secondAction.getAttribute("aria-label")), "comparison removing the replacement retains focus on that zone's sleep action");
  } finally {
    await context.close();
  }
}

async function runEmptyRouteAudit() {
  const viewport = [390, 844];
  const { context, page } = await contextFor(viewport, { emptyRoute: true });
  try {
    const { panel } = await openTravelZones(page);
    check((await panel.locator(".zone-card").count()) >= 4, "empty route keeps all zone alternatives available");
    check((await panel.locator(".zone-card__evidence--calculated").count()) === 0, "empty route creates no synthetic calculation");
    check((await panel.locator(".zone-panel__note").innerText()).includes("sin calcular proximidad"), "empty route has a neutral calculation state");
    check((await panel.locator(".zone-card__no-calculation").count()) === 0, "empty route avoids repeating empty-state disclaimers on each card");
    check((await storageWrites(page)).length === 0, "empty route view causes zero writes");
    check((await draftSnapshot(page)).routeIds.length === 0, "a wish outside the route is not counted as trip context");
  } finally {
    await context.close();
  }
}

async function runReducedMotionAudit() {
  const { context, page } = await contextFor([390, 844], { reducedMotion: "reduce" });
  try {
    await openTravelZones(page);
    check(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), `reduced-motion preference is active in ${browserType.name()}`);
    const motion = await page.locator(".zone-photo-fallback").first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { animation: style.animationDuration, transition: style.transitionDuration };
    });
    const activeMotion = [motion.animation, motion.transition]
      .flatMap((value) => value.split(","))
      .some((duration) => parseFloat(duration) > 0.001);
    check(!activeMotion, `fallback respects reduced motion (${JSON.stringify(motion)})`);
  } finally {
    await context.close();
  }
}

try {
  for (let index = 0; index < VIEWPORTS.length; index += 1) await runFullAudit(VIEWPORTS[index], index);
  await runComparisonNavigationAudit();
  await runFullAudit([390, 844], VIEWPORTS.length, { reducedMotion: "reduce" });
  await runEmptyRouteAudit();
  await runReducedMotionAudit();
  console.log(`B30 Where to Sleep: ${checks}/${checks} PASS (${browserPath})`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
