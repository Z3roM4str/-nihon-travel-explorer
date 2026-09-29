import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const tokyo = places.filter((place) => place.hub === "Tokio").slice(0, 3);
const kyoto = places.find((place) => place.hub === "Kioto");
if (!kyoto) throw new Error("B27 fixture requires one Kioto place");
const fixture = [...tokyo, kyoto];
const ids = fixture.map((place) => place.id);
const STORAGE_KEY = "nihon.manualPlanningDraft";
const WISHLIST_KEY = "nihon.travellers.v1";
const viewports = [[320,568],[375,667],[390,844],[430,932],[820,1180],[1024,768],[1280,800],[1440,900]];
const browserCandidates = [
  process.env.NIHON_CHROMIUM_PATH,
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = browserCandidates.find((path) => existsSync(path));
const shots = process.env.NIHON_B27_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const server = await preview({ root: new URL("..", import.meta.url).pathname, preview: { host: "127.0.0.1", port: 0 } });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const failures = [];

function fail(message) { failures.push(message); }
async function seed(context) {
  await context.addInitScript(({ placeIds }) => {
    localStorage.setItem("nihon.onboarding.seen.v1", "1");
    localStorage.setItem("nihon.travellers.v1", JSON.stringify({
      version: 1,
      travellers: [{ id: "b27", label: "Marta" }],
      activeTravellerId: "b27",
      interests: placeIds.map((placeId) => ({
        placeId,
        stances: [{ travellerId: "b27", stance: "interested" }],
        carriedOver: false,
      })),
    }));
  }, { placeIds: ids });
}
async function openDays(page) {
  await page.goto(url);
  await page.getByRole("button", { name: /Viaje/ }).click();
  await page.getByRole("heading", { name: "Viaje", exact: true }).waitFor();
  return page.locator('.destination-panel:not([hidden])');
}
async function keyboardActivate(locator) {
  await locator.focus();
  await locator.press("Enter");
}
async function draft(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

try {
  // A–H: one real, keyboard-driven end-to-end plan.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seed(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => fail(`console/pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") fail(`console: ${message.text()}`); });
  const root = await openDays(page);
  if (await root.locator(".days-framing").count() !== 1) fail("A: framing line must be exactly one");
  if (await root.locator(".day-card").count() !== 1) fail("A: Días must be the initial unit");
  if (await root.locator(".sequence-item__controls").count()) fail("A: legacy arrow trio is visible");
  const originalWishlist = await page.evaluate((key) => localStorage.getItem(key), WISHLIST_KEY);
  const originalKeys = await page.evaluate(() => Object.keys(localStorage).sort());

  // Dates and day creation.
  await root.locator("#sequence-start-date").fill("2027-02-22");
  await root.locator("#sequence-end-date").fill("2027-03-05");
  await page.getByRole("heading", { name: "Viaje", exact: true }).locator("+").waitFor();
  await keyboardActivate(root.getByRole("button", { name: "Añadir día" }));
  if (await root.locator(".day-card[data-day-id]").count() !== 2) fail("B: add day failed");
  const beforeMove = await draft(page);
  const stableIds = beforeMove.days.map((day) => day.id);

  // Real Mover a… flow: keyboard open, another day, explicit position, confirm.
  const kyotoStop = root.locator(".trip-stop", { hasText: kyoto.name });
  await keyboardActivate(kyotoStop.getByRole("button", { name: "Mover a…" }));
  await kyotoStop.getByLabel("Día").selectOption("1");
  await kyotoStop.getByLabel("Posición").selectOption("0");
  await keyboardActivate(kyotoStop.getByRole("button", { name: "Mover parada" }));
  if (!await root.locator(".day-card").nth(1).getByText(kyoto.name, { exact: true }).count()) fail("C/D: inter-day move missing in DOM");
  let persisted = await draft(page);
  if (persisted.days[1].placeIds[0] !== kyoto.id) fail("E: inter-day move not persisted");

  // Same-day explicit-position move.
  const firstDay = root.locator(".day-card").first();
  const movingStop = firstDay.locator(".trip-stop").first();
  const movingName = await movingStop.locator("strong").innerText();
  await keyboardActivate(movingStop.getByRole("button", { name: "Mover a…" }));
  await movingStop.getByLabel("Posición").selectOption("1");
  await keyboardActivate(movingStop.getByRole("button", { name: "Mover parada" }));
  if ((await firstDay.locator(".trip-stop").nth(1).locator("strong").innerText()) !== movingName) fail("C/D: same-day move failed");

  // Whole-day move through its explicit keyboard-labelled destination.
  const dayMove = firstDay.getByLabel("Mover Día 1 a la posición");
  await dayMove.focus();
  await dayMove.selectOption("1");
  persisted = await draft(page);
  if (persisted.days[1].id !== stableIds[0] || persisted.days[0].id !== stableIds[1]) fail("B/D: whole-day stable identity move failed");

  // Move to Sin asignar and back; wishlist must never change.
  const assignedStop = root.locator(".trip-stop").first();
  const assignedName = await assignedStop.locator("strong").innerText();
  await keyboardActivate(assignedStop.getByRole("button", { name: "Mover a Sin asignar" }));
  const drawer = root.locator(".unassigned-drawer");
  if (await drawer.getAttribute("open") !== null) fail("G: drawer must start closed");
  if (!/1 sitio sin día/.test(await drawer.locator("summary").innerText())) fail("G: real counter did not increase");
  await keyboardActivate(drawer.locator("summary"));
  if (!await drawer.getByText(assignedName, { exact: true }).count()) fail("G: removed stop not immediately in drawer");
  if (await page.evaluate((key) => localStorage.getItem(key), WISHLIST_KEY) !== originalWishlist) fail("H: Quiero ir changed on unassign");
  await drawer.getByLabel("Añadir al día…").selectOption({ index: 1 });
  if (!/0 sitios sin día/.test(await drawer.locator("summary").innerText())) fail("G: counter did not decrease after restore");

  // Inter-hub editor uses existing assessment data; the compact row must appear only when active.
  await keyboardActivate(root.locator(".days-tools > summary"));
  const interHub = root.locator(".inter-hub-segments");
  const pair = interHub.getByLabel("Posición en el plan");
  if (await pair.locator("option").count() > 1) {
    await pair.selectOption({ index: 1 });
    await interHub.getByLabel("Modo").last().selectOption("shinkansen");
    await interHub.getByLabel("Duración manual del tramo principal").last().fill("135");
    await keyboardActivate(interHub.getByRole("button", { name: "Añadir tramo" }));
    if (await root.locator(".inter-hub-row").count() !== 1) fail("F: active between-days row absent");
  }

  // PlaceDetail opens inside Viaje; browser back returns to Días without losing state/scroll/drawer.
  await root.evaluate((element) => { element.scrollTop = 240; });
  const scrollBefore = await root.evaluate((element) => element.scrollTop);
  const stopOpen = root.locator(".trip-stop__open").first();
  await keyboardActivate(stopOpen);
  await page.locator(".app__detail").waitFor();
  await page.goBack();
  await page.locator(".app__detail").waitFor({ state: "hidden" });
  if (!await page.getByRole("button", { name: "Días" }).getAttribute("aria-pressed")) fail("C: browser back changed Viaje section");
  if (await root.evaluate((element) => element.scrollTop) < Math.min(1, scrollBefore)) fail("C: browser back lost scroll");

  const beforeReload = await draft(page);
  await page.reload();
  await page.getByRole("heading", { name: "Viaje", exact: true }).waitFor();
  const afterReload = await draft(page);
  if (JSON.stringify(afterReload) !== JSON.stringify(beforeReload)) fail("E/G: draft changed across reload");
  if (afterReload.days.map((day) => day.id).join() !== beforeReload.days.map((day) => day.id).join()) fail("B/E: day IDs changed across reload");
  if (await page.evaluate((key) => localStorage.getItem(key), WISHLIST_KEY) !== originalWishlist) fail("H: Quiero ir changed after reload");
  const finalKeys = await page.evaluate(() => Object.keys(localStorage).sort());
  if (finalKeys.join() !== originalKeys.concat(STORAGE_KEY).filter((key, index, all) => all.indexOf(key) === index).sort().join()) fail("E: unexpected storage key");
  await context.close();

  // I–K: every normative viewport, geometry/a11y/console and optional evidence screenshots.
  for (const [width, height] of viewports) {
    const responsive = await browser.newContext({ viewport: { width, height } });
    await seed(responsive);
    const p = await responsive.newPage();
    p.on("pageerror", (error) => fail(`${width}x${height} pageerror: ${error.message}`));
    p.on("console", (message) => { if (message.type() === "error") fail(`${width}x${height} console: ${message.text()}`); });
    const active = await openDays(p);
    if (await active.evaluate((element) => element.scrollWidth > element.clientWidth + 1)) fail(`${width}x${height}: horizontal overflow`);
    if (await active.locator(".trip-stop img, .trip-stop .photo-placeholder").count() !== ids.length) fail(`${width}x${height}: incomplete thumbnails`);
    const undersized = await active.locator("button:visible, select:visible, input:visible, summary:visible").evaluateAll((elements) => elements.filter((element) => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map((element) => `${element.tagName}:${element.textContent?.trim()}`));
    if (undersized.length) fail(`${width}x${height}: targets under 44px: ${undersized.slice(0, 3).join(", ")}`);
    if (shots) await p.screenshot({ path: `${shots}/viaje-${width}x${height}.png`, fullPage: true });
    await responsive.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) throw new Error(`B27 gate failed:\n${failures.join("\n")}`);
console.log(`B27 Viaje · Días gate: PASS (A–K; ${viewports.length} viewports; Chromium ${executablePath ?? "Playwright-managed"}).`);
