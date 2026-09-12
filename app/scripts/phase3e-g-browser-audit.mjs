import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3E-G — executable browser acceptance for the normative UI/browser contracts 105-125.
 *
 * The fixture is the fully validated-static Tokio block from the Phase 3E-F design audit: no
 * one-step adjacent swap and no one-step single-place relocation improves this baseline, but the
 * non-adjacent interior transposition does — 68 min down to 60 min, minimum recorded gap 8 min.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const routeIds = ["JP-028", "JP-026", "JP-022", "JP-027", "JP-025"];
const expectedOrder = ["JP-028", "JP-027", "JP-022", "JP-026", "JP-025"];
const leftName = "Retro game hunt: Super Potato + Mandarake";
const rightName = "Kanda Myojin";
const draft = {
  version: 7,
  routeIds,
  days: [
    {
      id: "phase-3e-g-day",
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

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3e-g-vite-"));

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
  // Runs on every navigation, so seed only once: the reload must observe what the app
  // persisted, not a re-seeded fixture.
  await page.addInitScript(({ saved, planningDraft }) => {
    if (localStorage.getItem("nihon.savedPlaceIds") === null) {
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
    }
    if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(planningDraft));
    }
  }, { saved: routeIds, planningDraft: draft });

  // 1. the app boots.
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Quiero ir/ }).click();
  await page.getByRole("button", { name: /Construir recorrido/ }).click();
  await page.getByRole("button", { name: /Distribuir por días/ }).click();

  // 2-3. the existing surface renders and gains the distinct non-adjacent subgroup.
  await page.getByRole("heading", { name: "Alternativas locales con evidencia completa" }).waitFor();
  await page.getByRole("heading", { name: "Intercambios no adyacentes" }).waitFor();

  const group = page.locator(".local-transposition__item").first();
  await group.waitFor();
  const groupText = await group.innerText();

  // 4-5. both exchanged place names, in natural copy that does not lead with indices.
  const copy = await page.locator(".local-transposition__exchange").first().innerText();
  assert.match(copy, /^Intercambiar .+ y .+ dentro del bloque de Tokio\.$/);
  assert.ok(copy.includes(leftName), `copy is missing "${leftName}": ${copy}`);
  assert.ok(copy.includes(rightName), `copy is missing "${rightName}": ${copy}`);

  // 6. baseline and candidate recorded ranges, and the minimum gap, are visible.
  assert.match(groupText, /Traslados registrados del bloque actual/);
  assert.match(groupText, /Traslados registrados de este intercambio/);
  // The surface humanises the recorded ranges: 68 min renders "1 h 8 min", 60 min renders "1 h".
  const renderedRanges = await group.locator("dd").allInnerTexts();
  assert.equal(renderedRanges.length, 2, `expected two recorded ranges, got ${renderedRanges.length}`);
  assert.match(renderedRanges[0], /^1 h 8 min\b/);
  assert.match(renderedRanges[1], /^1 h\b(?! 8)/);
  assert.match(groupText, /Ventaja mínima entre los rangos registrados: 8 min\./);

  // 7. confidence is disclosed for both orders.
  const evidenceMixes = await group.locator(".local-swap__evidence").allInnerTexts();
  assert.equal(evidenceMixes.length, 2, `expected two confidence disclosures, got ${evidenceMixes.length}`);
  for (const mix of evidenceMixes) assert.match(mix, /validad/i);

  // No optimisation overclaim anywhere on the surface.
  const surfaceText = await page.locator(".local-swap").first().innerText();
  for (const forbidden of [
    /mejor orden/i,
    /ruta óptima/i,
    /día optimizado/i,
    /recomendad/i,
    /te conviene/i,
    /ahorras/i,
    /mejor alternativa/i,
  ]) {
    assert.doesNotMatch(surfaceText, forbidden);
  }
  assert.match(
    groupText,
    /No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo\./
  );

  // 8. nothing is applied until the user clicks: the stored order is still the baseline.
  const beforeApply = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null")
  );
  assert.deepEqual(beforeApply.days[0].placeIds, routeIds);

  await page.getByRole("button", { name: "Aplicar este intercambio no adyacente" }).first().click();

  // 9. Apply produces the exact expected order.
  await page.waitForFunction((expected) => {
    const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
    return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(expected);
  }, expectedOrder);
  // 14. no automatic second Apply: the order is still the single applied one after settling.
  await page.waitForTimeout(400);
  const applied = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null")
  );
  assert.deepEqual(applied.days[0].placeIds, expectedOrder);

  // 10-11. the draft is still V7 under the one existing storage key.
  assert.equal(applied.version, 7);
  const draftKeyCount = await page.evaluate(
    () => Object.keys(localStorage).filter((key) => key.startsWith("nihon.manualPlanningDraft")).length
  );
  assert.equal(draftKeyCount, 1);
  const persisted = await page.evaluate(
    () => localStorage.getItem("nihon.manualPlanningDraft") ?? ""
  );
  for (const forbidden of ["candidate", "transposition", "advantage", "confidence", "rank", "score"]) {
    assert.ok(
      !persisted.toLowerCase().includes(forbidden),
      `persisted draft leaked candidate state: ${forbidden}`
    );
  }

  // 13. alternatives regenerate from the new baseline: the applied candidate is gone.
  await page
    .getByRole("heading", { name: "Alternativas locales con evidencia completa" })
    .first()
    .waitFor();
  const regeneratedTranspositions = await page.locator(".local-transposition__item").count();
  assert.equal(
    regeneratedTranspositions,
    0,
    "the applied order is the new baseline, so it must not be re-proposed"
  );

  // 12. reload preserves the applied order, and still derives fresh alternatives.
  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null")
  );
  assert.deepEqual(reloaded.days[0].placeIds, expectedOrder);
  assert.equal(reloaded.version, 7);

  // 17-18.
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3E-G browser audit PASS");
  console.log("  baseline order  :", routeIds.join(" "));
  console.log("  applied order   :", applied.days[0].placeIds.join(" "));
  console.log("  reloaded order  :", reloaded.days[0].placeIds.join(" "));
  console.log("  draft version   :", reloaded.version);
  console.log("  draft keys      :", draftKeyCount);
  console.log("  natural copy    :", copy);
  console.log("  recorded ranges :", JSON.stringify(renderedRanges));
  console.log("  confidence mixes:", JSON.stringify(evidenceMixes));
  console.log("  transpositions after apply            :", regeneratedTranspositions);
  console.log("  console errors  :", consoleErrors.length);
  console.log("  page errors     :", pageErrors.length);

  /**
   * 15-16. Both earlier capabilities must still *work*, not merely still be referenced.
   *
   * The Phase 3E-G fixture above deliberately has no adjacent swap and no relocation — that is
   * exactly what makes it incremental — so proving those two groups needs its own fixture. This
   * one yields exactly one Phase 3E-C candidate and one Phase 3E-E candidate and no
   * transposition, and each is applied in its own isolated context from the same baseline.
   */
  const regressionIds = ["JP-006", "JP-034", "JP-035", "JP-036", "JP-033"];
  const regressionDraft = {
    ...draft,
    routeIds: regressionIds,
    days: [{ ...draft.days[0], id: "phase-3e-g-regression-day", placeIds: regressionIds }],
  };

  async function bootRegressionPage() {
    const context = await browser.newContext();
    const regressionPage = await context.newPage();
    regressionPage.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    regressionPage.on("pageerror", (error) => pageErrors.push(error.message));
    await regressionPage.addInitScript(({ saved, planningDraft }) => {
      if (localStorage.getItem("nihon.savedPlaceIds") === null) {
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
      }
      if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
        localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(planningDraft));
      }
    }, { saved: regressionIds, planningDraft: regressionDraft });
    await regressionPage.goto(url, { waitUntil: "networkidle" });
    await regressionPage.getByRole("button", { name: /Quiero ir/ }).click();
    await regressionPage.getByRole("button", { name: /Construir recorrido/ }).click();
    await regressionPage.getByRole("button", { name: /Distribuir por días/ }).click();
    await regressionPage
      .getByRole("heading", { name: "Alternativas locales con evidencia completa" })
      .waitFor();
    return { context, regressionPage };
  }

  async function applyAndRead(buttonName, expected) {
    const { context, regressionPage } = await bootRegressionPage();
    try {
      await regressionPage.getByRole("heading", { name: buttonName.group }).waitFor();
      await regressionPage.getByRole("button", { name: buttonName.button }).first().click();
      await regressionPage.waitForFunction((want) => {
        const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
        return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(want);
      }, expected);
      const stored = await regressionPage.evaluate(
        () => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null")
      );
      assert.deepEqual(stored.days[0].placeIds, expected);
      assert.equal(stored.version, 7);
      return stored.days[0].placeIds;
    } finally {
      await context.close();
    }
  }

  // 15. the Phase 3E-C adjacent-swap group still renders and still applies.
  const adjacentApplied = await applyAndRead(
    { group: "Intercambios adyacentes", button: "Aplicar este intercambio" },
    ["JP-006", "JP-035", "JP-034", "JP-036", "JP-033"]
  );
  // 16. the Phase 3E-E relocation group still renders and still applies.
  const relocationApplied = await applyAndRead(
    { group: "Reubicaciones de un lugar", button: "Aplicar esta reubicación" },
    ["JP-006", "JP-035", "JP-036", "JP-034", "JP-033"]
  );

  // 17-18 again, now covering the regression contexts too.
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("  3E-C adjacent swap still applies :", adjacentApplied.join(" "));
  console.log("  3E-E relocation still applies    :", relocationApplied.join(" "));
  console.log("  console errors (all contexts)    :", consoleErrors.length);
  console.log("  page errors (all contexts)       :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
