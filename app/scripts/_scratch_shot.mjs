import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";
const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const by = (h) => places.filter((p) => p.hub === h).map((p) => p.id);
const T = by("Tokio").slice(0, 6), K = by("Kioto").slice(0, 3);
const saved = [...T, ...K, ...by("Osaka").slice(0, 3)];
const route = [...T, ...K];
const emptyB = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const draft = { version: 8, routeIds: route, days: [
  { id: "d1", placeIds: T.slice(0, 3), accommodationBoundary: emptyB },
  { id: "d2", placeIds: T.slice(3, 6), accommodationBoundary: emptyB },
  { id: "d3", placeIds: K, accommodationBoundary: emptyB },
  { id: "d4", placeIds: [], accommodationBoundary: emptyB } ],
  startDate: "2027-02-22", endDate: null, visitStartTimes: {}, accommodations: [], accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [] };
const server = await preview({ root: ".", preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, executablePath: process.env.NIHON_CHROMIUM_PATH });
const [w, h, name] = process.argv.slice(2);
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.addInitScript(({ saved, draft }) => {
  localStorage.setItem("nihon.onboarding.seen.v1", "1");
  localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
  localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
}, { saved, draft });
await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Viaje/ }).first().click().catch(async () => { await page.getByRole("link", { name: /Viaje/ }).first().click(); });
await page.waitForSelector(".day-timeline");
await page.waitForTimeout(800);
await page.screenshot({ path: `/tmp/shots/${name}.png` });
console.log(await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })));
await browser.close(); await server.close();
