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

  // Hermetic by construction. The pre-existing place map streams OpenStreetMap tiles, so leaving
  // the page open to the network made this audit's console-error assertion depend on the machine
  // having working internet — it passed in CI by luck and failed anywhere offline or behind a
  // TLS-inspecting proxy, for reasons that have nothing to do with photography attribution.
  //
  // Every non-localhost request is intercepted instead and answered locally with a 1x1 transparent
  // PNG. Aborting them would itself log `net::ERR_FAILED`, so fulfilling is what keeps the
  // zero-console-error assertion exactly as strict as before rather than quietly relaxing it.
  // Intercepted URLs are recorded so the assertions below can prove none of them was a photograph.
  const BLANK_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
    "base64"
  );
  const interceptedExternal = [];
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith("data:") || target.startsWith("blob:")) {
      return route.continue();
    }
    interceptedExternal.push(target);
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });

  await page.goto(url);

  // The application opens on the national explorer. Enter the Tokio hub through the
  // keyboard-accessible prefecture path before exercising a place detail.
  await page.getByRole("button", { name: /^Tokio/ }).click();
  await page.getByRole("button", { name: /Explorar desde Tokio/ }).first().click();
  await page.locator(".place-list__item").filter({ hasText: "SHIBUYA SKY" }).click();

  // Bloque 20 (B4, `04 §7`): la atribución sale del flujo de lectura —defecto D2— y vive en
  // `CreditsSheet`, tras el botón `ⓘ` de la galería. El requisito de esta fase no cambia (los
  // mismos campos, los mismos enlaces, la misma ausencia de afirmaciones legales); sólo cambia
  // dónde se lee. La hoja se cierra al terminar para no dejarla sobre el resto del recorrido.
  await page.locator(".gallery__credits").click();
  const credit = page.locator(".credits-sheet__list");
  await credit.waitFor();

  // Phase 4C serves every photograph from the local build and fetches nothing at runtime. Prove it
  // twice: no intercepted request was a photography host, and the rendered image is same-origin. The
  // Commons and license links are anchors, so they are never requested unless a user clicks them.
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((target) => photographyHosts.test(target)),
    [],
    "photography must never be fetched at runtime"
  );
  const renderedSources = await page
    .locator(".gallery__image")
    .evaluateAll((nodes) => nodes.map((node) => node.currentSrc || node.getAttribute("src")));
  assert.ok(renderedSources.length > 0, "expected a rendered gallery image");
  for (const source of renderedSources) {
    assert.ok(
      source.startsWith(url) || source.startsWith("/"),
      `gallery image must be served locally, got ${source}`
    );
  }

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
  // Uses a carried fail-closed place, which cannot gain a photograph without a separate
  // design gate, so this fallback assertion survives later acquisition batches. Nezu
  // Museum previously stood here and was acquired in Phase 4J.
  await page.locator(".place-list__item").filter({ hasText: "PokéPark KANTO" }).click();
  await page.getByText("Sin fotografía disponible todavía").waitFor();
  // Sin atribución que mostrar no hay botón `ⓘ`: un control que abre una hoja vacía sería
  // «UI de funciones que no existen» (`08` prohibición 8).
  assert.equal(await page.locator(".gallery__credits").count(), 0);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4C browser attribution audit");
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
