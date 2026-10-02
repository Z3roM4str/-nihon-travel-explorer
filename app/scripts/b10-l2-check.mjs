import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import playwright from "playwright";
import { preview } from "vite";

// B10 L2: exact contextual copy and conservation of manual principal-segment semantics.
// Baseline mode changes only expected UI strings, never assertions of domain behaviour.
const baseline = process.env.NIHON_L2_BASELINE === "1";
const engine = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const out = process.env.NIHON_L2_OUT ?? `logs/b10-l2/${engine}`;
mkdirSync(out, { recursive: true });
const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url)));
const ids = ["JP-044", places.find(p => p.hub === "Kioto").id, "JP-203"];
const names = ids.map(id => places.find(p => p.id === id).name);
const seed = {
  version: 8, routeIds: ids,
  days: [[ids[0], ids[1]], [ids[2]]].map((placeIds, i) => ({ id: `l2-day-${i}`, placeIds,
    accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } } })),
  startDate: "2027-02-22", endDate: "2027-02-23", visitStartTimes: {},
  accommodations: [], accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [],
};
const key = "nihon.manualPlanningDraft";
const travellerKey = "nihon.travellers.v1";
const server = await preview({ build: { outDir: process.env.NIHON_L2_DIST ?? "dist" }, preview: { host: "127.0.0.1", port: 0, open: false } });
const url = server.resolvedUrls.local[0];
const browser = await playwright[engine].launch(engine === "webkit" && process.env.NIHON_WEBKIT_PATH ? { executablePath: process.env.NIHON_WEBKIT_PATH } : {});
const results = [];
const noun = baseline ? "tramo" : "traslado";
const principalLabel = baseline ? "Tramo principal entre estos dos puntos de tu plan;" : "Traslado principal entre estos dos puntos de tu plan;";
const durationLabel = baseline ? "Duración manual del tramo principal" : "Duración manual del traslado principal";
try {
  for (const [width, height] of [[320, 568], [390, 844], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(({ seed, key, travellerKey }) => {
      if (!sessionStorage.getItem("l2-seeded")) {
        sessionStorage.setItem("l2-seeded", "1");
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        localStorage.setItem(key, JSON.stringify(seed));
        localStorage.setItem(travellerKey, JSON.stringify({ version: 1,
          travellers: [{ id: "l2-a", label: "Persona 1" }, { id: "l2-b", label: "Persona 2" }], activeTravellerId: "l2-a",
          interests: seed.routeIds.map(placeId => ({ placeId, stances: [{ travellerId: "l2-a", stance: "interested" }], carriedOver: false })) }));
      }
      const original = Storage.prototype.setItem;
      window.__l2Writes = [];
      Storage.prototype.setItem = function(k, value) {
        if (k === key || k === travellerKey) window.__l2Writes.push({ key: k, value });
        return original.call(this, k, value);
      };
    }, { seed, key, travellerKey });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(url);
    await page.locator(".tab-bar:visible, .nav-rail:visible").first().getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card").first().waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    const writes = () => page.evaluate(() => window.__l2Writes);
    const original = await stored();
    assert.deepEqual(original, seed);
    await page.evaluate(() => { window.__l2Writes = []; });
    const tools = root.locator(".days-tools > summary");
    await tools.focus();
    await tools.press("Enter");
    const section = root.locator(".inter-hub-segments");
    const form = section.locator(".inter-hub-segments__form");
    const totals = await root.locator(".analysis-totals").allTextContents();
    const capture = async state => {
      assert.equal(await section.getByText(principalLabel, { exact: false }).count(), 1);
      assert.ok(await section.getByText("no es un tiempo puerta a puerta", { exact: true }).isVisible());
      const current = await stored();
      const { interHubSegments, ...unchanged } = current;
      const { interHubSegments: _ignored, ...expected } = seed;
      assert.deepEqual(unchanged, expected);
      assert.deepEqual(await root.locator(".analysis-totals").allTextContents(), totals, "manual minutes excluded from existing subtotals");
      assert.deepEqual(errors, []);
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      assert.equal(overflow, 0);
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${width}-${state}.png` });
      results.push({ width, state, text: (await section.innerText()).replace(/\s+/g, " ").trim(),
        labels: await section.locator("button").evaluateAll(nodes => nodes.map(el => ({ text: el.textContent.trim(), ariaLabel: el.getAttribute("aria-label"), title: el.title, disabled: el.disabled }))),
        segmentValues: interHubSegments.map(({ id: _id, ...value }) => value), dayIds: current.days.map(day => day.id), totals, overflow, errors });
    };
    assert.ok(await section.getByText(`Todavía no has registrado ningún ${noun} entre ciudades.`, { exact: true }).isVisible());
    const add = form.getByRole("button", { name: `Añadir ${noun}`, exact: true });
    assert.ok(await add.isDisabled());
    assert.equal(await form.getByLabel(durationLabel, { exact: true }).count(), 1);
    await capture("empty");
    await form.getByLabel("Posición en el plan").selectOption(JSON.stringify(ids.slice(0, 2)));
    await form.getByLabel("Modo").selectOption("shinkansen");
    const duration = form.getByLabel(durationLabel, { exact: true });
    await duration.fill("0");
    assert.ok(await add.isDisabled());
    await duration.fill("135");
    assert.ok(await add.isEnabled());
    assert.deepEqual(await writes(), [], "opening and filling does not persist");
    await add.focus();
    await add.press("Enter");
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).interHubSegments.length === 1, key);
    const added = (await stored()).interHubSegments[0];
    assert.deepEqual({ ...added, id: "opaque" }, { id: "opaque", fromPlaceId: ids[0], toPlaceId: ids[1], fromHub: "Tokio", toHub: "Kioto", mode: "shinkansen", minutes: 135, source: { kind: "user-entered" } });
    const item = section.locator(".inter-hub-segments__item");
    assert.ok((await item.innerText()).includes("Activo · dentro del Día 1"));
    const remove = item.getByRole("button", { name: `Eliminar ${noun} ${names[0]} a ${names[1]}`, exact: true });
    assert.equal(await remove.getAttribute("title"), `Eliminar ${noun} ${names[0]} a ${names[1]}`);
    await capture("active");
    const editDuration = item.getByLabel(durationLabel, { exact: true });
    await editDuration.fill("150");
    await editDuration.press("Tab");
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).interHubSegments[0].minutes === 150, key);
    assert.equal((await stored()).interHubSegments[0].id, added.id);
    await editDuration.fill("0");
    await editDuration.press("Tab");
    assert.equal(await editDuration.inputValue(), "150");
    assert.equal((await stored()).interHubSegments[0].minutes, 150);
    await capture("edited");
    await remove.focus();
    await remove.press("Enter");
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).interHubSegments.length === 0, key);
    await capture("removed");
    assert.deepEqual(await stored(), original);
    assert.ok((await writes()).every(w => w.key === key), "manual actions never change personal preferences");
    // A second fixture deliberately keeps a stored hub snapshot different from today's place hub.
    // The inactive record must stay visible, neutral and outside the subtotal; no repair/rebinding.
    const inactive = { ...added, fromHub: "Osaka" };
    await page.evaluate(({ key, seed, inactive }) => localStorage.setItem(key, JSON.stringify({ ...seed, interHubSegments: [inactive] })), { key, seed, inactive });
    await page.reload();
    await page.locator(".tab-bar:visible, .nav-rail:visible").first().getByRole("button", { name: "Viaje", exact: true }).click();
    await root.locator(".day-card").first().waitFor();
    await tools.focus();
    await tools.press("Enter");
    await section.getByText("Inactivo · La ciudad o región actual de uno de los puntos ya no coincide con la registrada.", { exact: true }).waitFor();
    assert.deepEqual((await stored()).interHubSegments, [inactive]);
    await capture("inactive");
    await context.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ baseline, engine, results }, null, 2) + "\n");
  console.log(`B10 L2 ${engine} PASS: ${results.length} states; canonical actions, principal/manual copy, V8, opaque IDs, partial totals and keyboard create/edit/delete preserved.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
