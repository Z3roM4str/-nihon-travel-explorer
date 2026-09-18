import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputRoot = process.env.ASTRA_AUDIT_OUTPUT ?? `${repoRoot}/artifacts/astra-sol-0-2`;
const expectedSha = process.env.ASTRA_EXPECTED_SHA;
const actualSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
assert.ok(expectedSha, "ASTRA_EXPECTED_SHA is required; pass the PR head SHA");
assert.equal(actualSha, expectedSha, "checked-out commit must equal the PR implementation head SHA");

const VIEWPORTS = [
  ["mobile-375", 375, 812], ["mobile-390", 390, 844], ["mobile-430", 430, 932],
  ["tablet-768", 768, 1024], ["tablet-landscape-1024", 1024, 768],
  ["desktop-1440", 1440, 900], ["reflow-320", 320, 800],
];
await mkdir(`${outputRoot}/screenshots`, { recursive: true });
await mkdir(`${outputRoot}/traces`, { recursive: true });

const server = await preview({ root: appRoot, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const baseURL = server.resolvedUrls?.local[0];
assert.ok(baseURL, "Vite preview did not expose a localhost URL");
const browser = await chromium.launch({ headless: true });
const results = [];

async function runJourney(id, name, viewport, test) {
  const context = await browser.newContext({ viewport });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push({ text:message.text(), url:message.location().url });
  });
  page.on("pageerror", error => pageErrors.push(String(error)));
  let status = "PASS";
  let error = "";
  try {
    const expectedConsoleErrors = await test(page, context) ?? [];
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, expectedConsoleErrors, `console errors: ${JSON.stringify(consoleErrors)}`);
  } catch (cause) {
    status = "FAIL";
    error = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
  } finally {
    await page.screenshot({ path: `${outputRoot}/screenshots/${id}-final.png`, fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: `${outputRoot}/traces/${id}.zip` }).catch(() => {});
    await context.close();
  }
  results.push({ id, name, status, viewport, error });
  console.log(`${status} ${id} — ${name}${error ? `: ${error.split("\n")[0]}` : ""}`);
}

try {
  await runJourney("01-viewports", "responsive shell and discovery geometry", { width: 1440, height: 900 }, async page => {
    for (const [label, width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "¿Qué les gustaría descubrir?" }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
      assert.equal(await page.getByRole("navigation", { name: "Principal" }).getByRole("link").count(), 2, `${label}: two destinations`);
      await page.screenshot({ path: `${outputRoot}/screenshots/01-${label}.png`, fullPage: true });
    }
  });

  await runJourney("02-plan-safety", "blocked unsave preserves serialized V7", { width: 390, height: 844 }, async page => {
    const draft = { version:7, routeIds:["JP-021"], days:null, startDate:"2027-02-19", endDate:"2027-02-20", visitStartTimes:{"JP-021":"09:00"}, accommodations:[], accommodationLegs:[], interHubSegments:[] };
    const raw = JSON.stringify(draft);
    await page.addInitScript(({ raw }) => { localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(["JP-021"])); localStorage.setItem("nihon.manualPlanningDraft", raw); }, { raw });
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    const card = page.locator(".astra-card").filter({ has: page.locator('a[href*="JP-021"]') }).first();
    await card.getByRole("button", { name: /En Mis guardados/ }).click();
    await page.getByRole("alertdialog").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("nihon.manualPlanningDraft")), raw);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.savedPlaceIds") ?? "[]")), ["JP-021"]);
    await page.getByRole("button", { name: "Mantener guardado" }).click();
  });

  await runJourney("03-history", "detail, nearby and exploration restoration", { width: 390, height: 844 }, async page => {
    await page.goto(`${baseURL}#/explorar?q=templo&page=2`, { waitUntil: "networkidle" });
    await page.evaluate(() => scrollTo(0, Math.min(700, document.body.scrollHeight)));
    const before = await page.evaluate(() => scrollY);
    await page.locator(".astra-card h2 a").first().click();
    await page.getByRole("dialog", { name: /Detalles de/ }).waitFor();
    await page.goBack();
    await page.locator(".astra-grid").waitFor();
    assert.match(page.url(), /q=templo/);
    assert.match(page.url(), /page=2/);
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) < 10, "scroll position was not restored");
    await page.goForward();
    await page.getByRole("dialog", { name: /Detalles de/ }).waitFor();
  });

  await runJourney("04-filters-map", "filter durability, OR algebra and map parity", { width: 1024, height: 768 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Filtros (0)" }).click();
    await page.locator("details").filter({ hasText:"Categoría" }).locator("summary").click();
    const categoryChecks = page.getByRole("group", { name: "Categoría" }).getByRole("checkbox");
    await categoryChecks.nth(0).check();
    await categoryChecks.nth(1).check();
    assert.equal(await categoryChecks.nth(0).isChecked(), true, "first OR category was cleared");
    assert.equal(await categoryChecks.nth(1).isChecked(), true, "second OR category was cleared");
    await page.getByRole("button", { name: /Ver \d+ resultados/ }).click();
    const listCount = Number((await page.locator(".astra-results > span").first().textContent())?.match(/\d+/)?.[0]);
    await page.getByRole("button", { name: "Mapa" }).click();
    await page.locator(".leaflet-container").waitFor();
    assert.equal(await page.locator(".leaflet-marker-icon").count(), listCount, "map/list IDs differ");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Filtros/ }).click();
    assert.equal(await page.getByRole("group", { name: "Categoría" }).getByRole("checkbox").nth(0).isChecked(), true, "filter did not survive reload");
  });

  await runJourney("05-modal-focus", "detail and lightbox focus stack", { width: 768, height: 1024 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    const opener = page.locator(".astra-card h2 a").first();
    await opener.focus(); await opener.click();
    const dialog = page.getByRole("dialog", { name: /Detalles de/ });
    await dialog.waitFor();
    assert.equal(await page.locator("#astra-content").getAttribute("inert"), "");
    for (let i=0;i<20;i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true, "focus escaped detail"); }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state:"detached" });
    assert.equal(await opener.evaluate(element => document.activeElement === element), true, "focus did not return to opener");
  });

  await runJourney("06-image-retry", "image failure and independent retry target", { width: 430, height: 932 }, async page => {
    const assetPath = "/images/places/JP-001/shibuya-scramble-crossing.webp";
    const assetUrl = new URL(assetPath, baseURL).href;
    const assetRequests = [];
    let abortedRequestUrl = "";
    let interceptedAttempts = 0;
    page.on("request", request => { if (request.url() === assetUrl) assetRequests.push(request.url()); });
    await page.route(assetUrl, async route => {
      interceptedAttempts += 1;
      if (interceptedAttempts === 1) {
        abortedRequestUrl = route.request().url();
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await page.goto(`${baseURL}#/explorar?q=Shibuya%20Crossing`, { waitUntil: "domcontentloaded" });
    const card = page.locator(".astra-card").filter({ has: page.locator('a[href*="JP-001"]') }).first();
    const visibleError = card.getByText("No se pudo cargar la fotografía", { exact:true });
    await visibleError.waitFor({ state:"visible" });
    const retry = card.getByRole("button", { name:"Reintentar", exact:true });
    assert.equal(await retry.evaluate(element => Boolean(element.closest("a"))), false, "retry button is nested inside a detail link");
    await retry.click();
    await visibleError.waitFor({ state:"detached" });
    const recoveredImage = card.locator("img");
    await page.waitForFunction(targetUrl => Array.from(document.images).some(image => image.src === targetUrl && image.complete && image.naturalWidth > 0), assetUrl);
    assert.equal(await recoveredImage.getAttribute("src"), assetPath, "retry did not recover the same asset");
    assert.ok(await recoveredImage.evaluate(image => image.naturalWidth) > 0, "retried image did not load");
    assert.equal(assetRequests.length, 2, `expected exactly two asset requests, received ${assetRequests.length}`);
    assert.equal(interceptedAttempts, 2, `expected exactly two intercepted attempts, received ${interceptedAttempts}`);
    assert.equal(abortedRequestUrl, assetUrl, "the aborted request did not match the targeted asset");
    assert.equal(await visibleError.count(), 0, "image error remained visible after retry");
    assert.equal(await page.getByRole("dialog", { name: /Detalles de/ }).count(), 0, "retry opened detail");
    return [{ text:"Failed to load resource: net::ERR_FAILED", url:abortedRequestUrl }];
  });

  await runJourney("07-lazy-network", "initial list avoids map/planner/provider requests", { width: 1440, height: 900 }, async page => {
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    assert.equal(requests.some(url => /PlaceMap|MapContainer|OrderedSequenceBuilder|tile\.openstreetmap/i.test(url)), false, `deferred request on initial load: ${requests.join("\n")}`);
    await page.getByRole("button", { name:"Mapa" }).click();
    await page.locator(".leaflet-container").waitFor();
    assert.equal(requests.some(url => /PlaceMap|MapContainer/i.test(url)), true, "map chunk did not load on demand");
  });

  await runJourney("08-a11y-reflow", "320px reflow, filter modal and single live output", { width: 320, height: 800 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "320px horizontal overflow");
    const filterButton = page.getByRole("button", { name:/Filtros/ });
    await filterButton.click();
    const filterDialog = page.getByRole("dialog", { name:"Filtros avanzados" });
    await filterDialog.waitFor();
    assert.equal(await page.locator('[role="status"]').count(), 1, "duplicate result live regions");
    for (let i=0;i<30;i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-label="Filtros avanzados"]'))), true, "focus escaped filter dialog"); }
    await page.keyboard.press("Escape");
    await filterDialog.waitFor({ state:"detached" });
    assert.equal(await filterButton.evaluate(element => document.activeElement === element), true, "filter opener focus not restored");
  });
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

const summary = { schemaVersion:1, auditedSha:actualSha, generatedAt:new Date().toISOString(), baseURL, results };
await writeFile(`${outputRoot}/results.json`, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(`${outputRoot}/summary.md`, [
  "# Astra SOL-0–SOL-2 browser audit", "", `Audited SHA: \`${actualSha}\``, "",
  ...results.map(result => `- **${result.status}** ${result.id}: ${result.name}${result.error ? ` — ${result.error.split("\n")[0]}` : ""}`), "",
  "Automated evidence is not independent visual approval; Astra must inspect screenshots and traces.",
].join("\n"));
if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
