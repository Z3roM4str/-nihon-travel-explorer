import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const routeIds = ["JP-010", "JP-012", "JP-011", "JP-013", "JP-014"];
const expectedOrder = ["JP-010", "JP-013", "JP-012", "JP-011", "JP-014"];
const draft = {
  version: 7,
  routeIds,
  days: [
    {
      id: "phase-3e-e-day",
      placeIds: routeIds,
      accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } },
    },
  ],
  startDate: null,
  endDate: null,
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
};

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3e-e-vite-"));

const server = await createServer({
  root: appRoot,
  cacheDir,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});

let browser;
try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "Vite did not expose a local URL");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Runs on every navigation, so seed only once: a reload must observe what the app
  // persisted, not a re-seeded fixture.
  await page.addInitScript(({ saved, planningDraft }) => {
    if (localStorage.getItem("nihon.savedPlaceIds") === null) {
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
    }
    if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(planningDraft));
    }
  }, { saved: routeIds, planningDraft: draft });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Quiero ir/ }).click();
  await page.getByRole("button", { name: /Construir recorrido/ }).click();
  await page.getByRole("button", { name: /Distribuir por días/ }).click();

  await page.getByRole("heading", { name: "Alternativas locales con evidencia completa" }).waitFor();
  await page.getByRole("heading", { name: "Reubicaciones de un lugar" }).waitFor();
  const naturalCopy = await page.locator(".local-relocation__move").first().innerText();
  assert.match(naturalCopy, /^Mover .+ antes de .+ dentro del bloque de Tokio\.$/);
  await page.getByRole("button", { name: "Aplicar esta reubicación" }).first().click();

  await page.waitForFunction((expected) => {
    const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
    return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(expected);
  }, expectedOrder);
  await page.waitForTimeout(250);
  const applied = await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));
  assert.deepEqual(applied.days[0].placeIds, expectedOrder);
  assert.equal(applied.version, 7);
  const draftKeyCount = await page.evaluate(
    () => Object.keys(localStorage).filter((key) => key.startsWith("nihon.manualPlanningDraft")).length,
  );
  assert.equal(draftKeyCount, 1);

  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));
  assert.deepEqual(reloaded.days[0].placeIds, expectedOrder);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
