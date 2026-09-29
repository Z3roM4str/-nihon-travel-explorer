import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const ids = places.slice(0, 4).map((place) => place.id);
const server = await preview({ root: new URL("..", import.meta.url).pathname, preview: { host: "127.0.0.1", port: 0 } });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.NIHON_CHROMIUM_PATH });
const failures = [];
const viewports = [[320,568],[375,667],[390,844],[430,932],[820,1180],[1024,768],[1280,800],[1440,900]];
const shots = process.env.NIHON_B27_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript((placeIds) => {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("nihon.travellers.v1", JSON.stringify({ version: 1, travellers: [{ id: "b27", label: "Marta" }], activeTravellerId: "b27", interests: placeIds.map((placeId) => ({ placeId, stances: [{ travellerId: "b27", stance: "interested" }], carriedOver: false })) }));
    }, ids);
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`${width}: ${error.message}`));
    await page.goto(url);
    await page.getByRole("button", { name: /Viaje/ }).click();
    await page.getByRole("heading", { name: "Viaje" }).waitFor();
    const root = page.locator('.destination-panel:not([hidden])');
    if (await root.locator(".days-framing").count() !== 1) failures.push(`${width}: framing != 1`);
    if (await root.locator(".day-card[data-day-id]").count() < 1) failures.push(`${width}: no stable day`);
    if (await root.locator(".trip-stop img, .trip-stop .photo-placeholder").count() < ids.length) failures.push(`${width}: missing thumbnails`);
    if (await root.locator(".trip-stop__move").count() < ids.length) failures.push(`${width}: missing move actions`);
    if (await root.locator(".sequence-item__controls").count()) failures.push(`${width}: legacy arrow trio present`);
    if (await root.locator(".unassigned-drawer").count() !== 1) failures.push(`${width}: no unassigned drawer`);
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (overflow) failures.push(`${width}: horizontal overflow`);
    if (shots) await page.screenshot({ path: `${shots}/viaje-${width}x${height}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) throw new Error(`B27 gate failed:\n${failures.join("\n")}`);
console.log("B27 Viaje · Días gate: OK (8 viewports, stable days, TripStop, thumbnails, move, drawer, no legacy trio). ");
