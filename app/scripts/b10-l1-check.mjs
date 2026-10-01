import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

// B10 L1: real filters and backup conservation; baseline mode records the original copy.
// Run after build. NIHON_B10_BASELINE=1 uses the preserved baseline dist via NIHON_B10_DIST.
const baseline = process.env.NIHON_B10_BASELINE === "1";
const out = process.env.NIHON_B10_OUT ?? "logs/b10-l1/browser";
mkdirSync(out, { recursive: true });
const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url)));
const tokyo = places.filter(p => p.hub === "Tokio");
const photo = tokyo.filter(p => p.category.endsWith("Fotografía"));
assert.equal(photo.length, 1);
assert.equal(photo[0].grade, "A");
const boundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const draft = {
  version: 8, routeIds: ["JP-044", "JP-203"],
  days: [{ id: "b10-day-one", placeIds: ["JP-044"], accommodationBoundary: boundary },
    { id: "b10-day-two", placeIds: ["JP-203"], accommodationBoundary: boundary }],
  startDate: "2027-02-22", endDate: "2027-02-23", visitStartTimes: {},
  accommodations: [], accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [],
};
const server = await preview({ build: { outDir: process.env.NIHON_B10_DIST ?? "dist" }, preview: { host: "127.0.0.1", port: 0, open: false } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, height] of [[320, 568], [390, 844], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
    await context.addInitScript(seed => {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(seed));
      localStorage.setItem("nihon.travellers.v1", JSON.stringify({
        version: 1, travellers: [{ id: "b10-a", label: "Persona 1" }, { id: "b10-b", label: "Persona 2" }],
        activeTravellerId: "b10-a",
        interests: seed.routeIds.map(placeId => ({ placeId, stances: [{ travellerId: "b10-a", stance: "interested" }], carriedOver: false })),
      }));
    }, draft);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(url);
    await page.locator(".national-start__hub").filter({ hasText: "Tokio" }).click();
    await page.locator(".place-card").first().waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const chrome = await page.evaluate(() => {
      const h = s => document.querySelector(s)?.getBoundingClientRect().height ?? 0;
      const top = h(".app__header") + h(".explorer-bar");
      return { top, total: top + h(".tab-bar") };
    });
    if (width === 390) { assert.ok(chrome.top <= 112); assert.ok(chrome.total <= 168); }
    const storage = () => page.evaluate(() => [localStorage.getItem("nihon.manualPlanningDraft"), localStorage.getItem("nihon.travellers.v1")]);
    const before = await storage();
    const open = () => page.locator(".explorer-bar__filters").click();
    await open();
    const panel = page.locator(".filter-panel");
    const status = panel.getByRole("status");
    const auditKeyboard = async () => {
      const sheet = page.locator(".sheet").filter({ has: panel });
      const expected = await sheet.evaluate(root => {
        const nodes = [...root.querySelectorAll("button, summary, input, a[href], [tabindex='0']")]
          .filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && !el.disabled);
        nodes.forEach((el, i) => { el.dataset.b10Keyboard = String(i); });
        return nodes.length;
      });
      await sheet.locator("[data-b10-keyboard='0']").focus();
      // Enter keyboard modality before inspecting :focus-visible (pointer focus is different).
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const visited = new Set();
      const controls = [];
      for (let i = 0; i <= expected; i++) {
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const after = getComputedStyle(el, "::after");
          return { id: el.dataset.b10Keyboard, text: el.textContent.trim(),
            visibleFocus: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none",
            width: Math.max(r.width, after.content !== "none" && after.position === "absolute" ? parseFloat(after.width) || 0 : 0),
            height: Math.max(r.height, after.content !== "none" && after.position === "absolute" ? parseFloat(after.height) || 0 : 0) };
        });
        assert.notEqual(focus.id, undefined, "focus remains inside the sheet");
        if (visited.has(focus.id)) break;
        visited.add(focus.id);
        assert.ok(focus.visibleFocus, `visible keyboard focus: ${focus.text}`);
        // Record geometry even when the unchanged baseline has a target-size debt.
        // This lot certifies its copy and conservation, not global G5 compliance.
        focus.target44 = focus.width >= 43.5 && focus.height >= 43.5;
        controls.push(focus);
        await page.keyboard.press("Tab");
      }
      assert.equal(visited.size, expected, "all currently disclosed controls reachable in the focus cycle");
      return controls;
    };
    const checkCount = async (n, active, label) => {
      const expected = baseline ? `${n} de ${tokyo.length} lugares` : `${n} lugar${n === 1 ? "" : "es"}`;
      await page.waitForFunction(({ expected }) => document.querySelector(".filter-panel [role=status]")?.textContent.trim() === expected, { expected });
      assert.equal(await status.innerText(), expected);
      assert.equal(await panel.getByRole("button", { name: `Limpiar (${active})`, exact: true }).count(), active ? 1 : 0);
      const button = panel.getByRole("button", { name: `Ver ${n} lugar${n === 1 ? "" : "es"}`, exact: true });
      assert.ok(await button.isEnabled());
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      assert.equal(overflow, 0);
      await page.screenshot({ path: `${out}/${width}-${label}.png` });
      const controls = await auditKeyboard();
      results.push({ width, state: label, count: n, active, text: await status.innerText(), overflow, controls });
      // The actual apply action closes the sheet and reveals the same identities.
      await button.focus();
      await page.keyboard.press("Enter");
      await panel.waitFor({ state: "detached" });
      const names = await page.locator(".place-list .place-card__name-text").allTextContents();
      results[results.length - 1].visiblePlaceNames = names;
      if (n === 1) assert.deepEqual(names, [photo[0].name]);
      if (n === 0) assert.equal(await page.locator(".place-list .place-card").count(), 0);
      if (n === tokyo.length) assert.ok(names.length > 0 && names.every(name => tokyo.some(p => p.name === name)));
      assert.deepEqual(await storage(), before);
      await open();
    };
    await checkCount(tokyo.length, 0, "unfiltered");
    const categories = panel.getByRole("group", { name: "Categoría", exact: true });
    await panel.locator("summary").filter({ hasText: "Categoría" }).click();
    await categories.getByRole("button", { name: "Fotografía", exact: true }).click();
    await checkCount(1, 1, "one");
    await panel.getByRole("group", { name: "Nivel de interés", exact: true }).getByRole("button", { name: "Imprescindible", exact: true }).click();
    await checkCount(0, 2, "zero");
    await panel.getByRole("button", { name: "Limpiar", exact: true }).click();
    await checkCount(tokyo.length, 0, "reset");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    await page.locator(".tab-bar:visible, .nav-rail:visible").first().getByRole("button", { name: /Nosotros/ }).click();
    const backup = page.locator(".trip-backup");
    await backup.waitFor();
    const beforeBackup = await storage();
    const [download] = await Promise.all([page.waitForEvent("download"), backup.getByRole("button", { name: "Exportar respaldo", exact: true }).click()]);
    const buffer = readFileSync(await download.path());
    const file = JSON.parse(buffer);
    assert.equal(file.format, "nihon-portable-backup");
    assert.equal(file.version, 1);
    assert.deepEqual(file.data.planningDraft, JSON.parse(beforeBackup[0]));
    assert.equal(file.data.planningDraft.version, 8);
    const input = backup.locator("input[type=file]");
    await input.setInputFiles({ name: "b10-v8.json", mimeType: "application/json", buffer });
    const preview = backup.locator(".trip-backup__preview");
    await preview.waitFor();
    assert.ok(await preview.evaluate(el => el === document.activeElement));
    const rows = await preview.locator(".trip-backup__summary-row").evaluateAll(els => els.map(el => [el.querySelector("dt").textContent, el.querySelector("dd").textContent]));
    assert.ok(rows.some(([label, value]) => label === (baseline ? "Lugares en el recorrido" : "Lugares en el viaje") && value === "2"));
    assert.ok(rows.some(([label, value]) => label === "Días planificados" && value === "2"));
    assert.ok(rows.some(([label, value]) => label === "Fechas" && value === "2027-02-22 — 2027-02-23"));
    assert.ok(await preview.getByText("Esto sustituirá todo lo que hay en este navegador.", { exact: true }).isVisible());
    assert.ok(await preview.getByRole("button", { name: "Sustituir con este respaldo", exact: true }).isEnabled());
    assert.deepEqual(await storage(), beforeBackup);
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-backup.png` });
    await page.keyboard.press("Tab");
    assert.ok(await preview.getByRole("button", { name: "Cancelar", exact: true }).evaluate(el => el === document.activeElement));
    await page.keyboard.press("Enter");
    await preview.waitFor({ state: "detached" });
    assert.ok(await input.evaluate(el => el === document.activeElement));
    assert.deepEqual(await storage(), beforeBackup);
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    assert.equal(overflow, 0);
    assert.deepEqual(errors, []);
    results.push({ width, state: "backup", rows, version: file.data.planningDraft.version, chrome, overflow, errors, storageUnchanged: true, cancelFocus: "file" });
    await context.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ baseline, results }, null, 2) + "\n");
  console.log(`B10 L1 PASS: ${results.length} states, 3 viewports; filters, identities, V8 backup and keyboard cancellation preserved.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
