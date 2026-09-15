import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4c-vite-"));
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(url);

  // The application opens on the national explorer. Enter the Tokio hub through the
  // keyboard-accessible prefecture path before exercising a place detail.
  await page.getByRole("button", { name: /^Tokio/ }).click();
  await page.getByRole("button", { name: /Explorar desde Tokio/ }).first().click();
  await page.locator(".place-list__item").filter({ hasText: "SHIBUYA SKY" }).click();

  const credit = page.locator(".gallery__credit");
  await credit.waitFor();

  const sourceLink = credit.getByRole("link", { name: "Wikimedia Commons" });
  assert.match(await sourceLink.getAttribute("href"), /^https:\/\/commons\.wikimedia\.org\//);

  const licenseLink = credit.getByRole("link", { name: "CC BY 2.0" });
  assert.equal(
    await licenseLink.getAttribute("href"),
    "https://creativecommons.org/licenses/by/2.0"
  );

  const creditText = await credit.innerText();
  assert.match(creditText, /Stephen Kelly/);
  assert.match(
    creditText,
    /File:Yoyogi Park and Shinjuku Skyline from Shibuya Sky Observation Deck \(53417085580\)\.jpg/
  );
  assert.match(
    creditText,
    /Título de atribución: Yoyogi Park and Shinjuku Skyline from Shibuya Sky Observation Deck/
  );
  assert.match(
    creditText,
    /Archivo optimizado por Nihon: redimensionado y convertido a WebP\./
  );

  const zoom = page.getByRole("button", { name: /Ampliar imagen/ });
  await zoom.click();
  const close = page.getByRole("button", { name: "Cerrar imagen ampliada" });
  await close.waitFor();
  assert.equal(await close.evaluate((element) => element === document.activeElement), true);

  await page.keyboard.press("Tab");
  assert.equal(await close.evaluate((element) => element === document.activeElement), true);

  await page.keyboard.press("Escape");
  await close.waitFor({ state: "detached" });
  assert.equal(await zoom.evaluate((element) => element === document.activeElement), true);

  await page.getByRole("button", { name: /Cerrar la ficha de SHIBUYA SKY/ }).click();
  await page.locator(".place-list__item").filter({ hasText: "Nezu Museum" }).click();
  await page.getByText("Sin fotografía disponible todavía").waitFor();
  assert.equal(await page.locator(".gallery__credit").count(), 0);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4C browser attribution audit");
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
