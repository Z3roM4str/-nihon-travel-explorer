import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3E-I — executable browser acceptance for the normative UI/browser contracts 122-125.
 *
 * The fixture is the fully validated-static Okinawa block from the Phase 3E-H design audit: no
 * one-step adjacent swap, no one-place relocation and no non-adjacent transposition improves this
 * baseline, but the four-place interior reversal does — 91 min down to 72 min, minimum recorded
 * gap 19 min, five validated-static edges on each side.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const routeIds = ["JP-202", "JP-153", "JP-155", "JP-156", "JP-161", "JP-154"];
const expectedOrder = ["JP-202", "JP-161", "JP-156", "JP-155", "JP-153", "JP-154"];
const reversedNames = [
  "Kokusai Street",
  "Tsuboya Yachimun Street",
  "Sakaemachi Arcade nightlife",
  "Okinawa Prefectural Museum & Art Museum",
];
const dayId = "phase-3e-i-day";
const emptyBoundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const draft = {
  version: 7,
  routeIds,
  days: [{ id: dayId, placeIds: routeIds, accommodationBoundary: emptyBoundary }],
  startDate: null,
  endDate: null,
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
};

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3e-i-vite-"));

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
  const consoleErrors = [];
  const pageErrors = [];

  /** Seeds one isolated context. Idempotent: a reload must observe persisted state, never re-seed. */
  async function bootPlanner(seedRouteIds, seedDayId) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(({ saved, planningDraft }) => {
      if (localStorage.getItem("nihon.savedPlaceIds") === null) {
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
      }
      if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
        localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(planningDraft));
      }
    }, {
      saved: seedRouteIds,
      planningDraft: {
        ...draft,
        routeIds: seedRouteIds,
        days: [{ id: seedDayId, placeIds: seedRouteIds, accommodationBoundary: emptyBoundary }],
      },
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await enterPlanner(page);
    return { context, page };
  }

  /** The real navigation path from the landing page into the day builder. */
  async function enterPlanner(page) {
    await page.getByRole("button", { name: /Quiero ir/ }).click();
    await page.getByRole("button", { name: /Construir recorrido/ }).click();
    await page.getByRole("button", { name: /Distribuir por días/ }).click();
    await page
      .getByRole("heading", { name: "Alternativas locales con evidencia completa" })
      .first()
      .waitFor();
  }

  const readDraft = (page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));

  // 1-2. the app boots and the existing local-alternatives surface renders.
  const { context: mainContext, page } = await bootPlanner(routeIds, dayId);

  // 3. the fourth subgroup renders.
  await page.getByRole("heading", { name: "Reversiones de cuatro lugares" }).waitFor();
  const group = page.locator(".local-reversal__item").first();
  await group.waitFor();
  const groupText = await group.innerText();

  // 4-5. all four reversed places are named, in natural copy that does not lead with indices.
  const copy = await page.locator(".local-reversal__window").first().innerText();
  assert.match(copy, /^Revertir el orden de .+ dentro del bloque de Okinawa\.$/);
  for (const name of reversedNames) {
    assert.ok(copy.includes(name), `copy is missing "${name}": ${copy}`);
  }

  // 6-8. both recorded ranges and the 19-minute minimum gap are visible.
  assert.match(groupText, /Traslados registrados del bloque actual/);
  assert.match(groupText, /Traslados registrados de esta reversión/);
  const renderedRanges = await group.locator("dd").allInnerTexts();
  assert.equal(renderedRanges.length, 2, `expected two recorded ranges, got ${renderedRanges.length}`);
  // The surface humanises the recorded ranges: 91 min renders "1 h 31 min", 72 min "1 h 12 min".
  assert.match(renderedRanges[0], /^1 h 31 min\b/);
  assert.match(renderedRanges[1], /^1 h 12 min\b/);
  assert.match(groupText, /Ventaja mínima entre los rangos registrados: 19 min\./);

  // 9. confidence is disclosed for both orders.
  const evidenceMixes = await group.locator(".local-swap__evidence").allInnerTexts();
  assert.equal(evidenceMixes.length, 2, `expected two confidence disclosures, got ${evidenceMixes.length}`);
  for (const mix of evidenceMixes) assert.match(mix, /5 validados/);

  // 10. the required local-only qualification.
  assert.match(
    groupText,
    /No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo\./
  );
  assert.match(
    groupText,
    /Esta reversión de cuatro lugares reduce de forma demostrable el rango de traslado local registrado de este bloque\./
  );

  // 11. no forbidden optimisation claim anywhere on the surface.
  const surfaceText = await page.locator(".local-swap").first().innerText();
  for (const forbidden of [
    /mejor orden/i,
    /ruta óptima/i,
    /día optimizado/i,
    /recomendad/i,
    /te conviene/i,
    /ahorras/i,
    /mejor alternativa/i,
    /fastest/i,
    /best route/i,
  ]) {
    assert.doesNotMatch(surfaceText, forbidden);
  }

  // 12. nothing is applied until the user clicks.
  const beforeApply = await readDraft(page);
  assert.deepEqual(beforeApply.days[0].placeIds, routeIds);

  // 13. Apply is explicit.
  await page.getByRole("button", { name: "Aplicar esta reversión de cuatro lugares" }).first().click();

  // 14. Apply produces the exact expected Okinawa order.
  await page.waitForFunction((expected) => {
    const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
    return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(expected);
  }, expectedOrder);
  // 18. no automatic second Apply: the order is still the single applied one after settling.
  await page.waitForTimeout(400);
  const applied = await readDraft(page);
  assert.deepEqual(applied.days[0].placeIds, expectedOrder);

  // 15-17. still V7, one storage key, and no candidate metadata persisted.
  assert.equal(applied.version, 7);
  const draftKeyCount = await page.evaluate(
    () => Object.keys(localStorage).filter((key) => key.startsWith("nihon.manualPlanningDraft")).length
  );
  assert.equal(draftKeyCount, 1);
  const persisted = await page.evaluate(
    () => localStorage.getItem("nihon.manualPlanningDraft") ?? ""
  );
  for (const forbidden of [
    "candidate",
    "reversal",
    "windowstart",
    "affected",
    "advantage",
    "confidence",
    "rank",
    "score",
  ]) {
    assert.ok(
      !persisted.toLowerCase().includes(forbidden),
      `persisted draft leaked candidate state: ${forbidden}`
    );
  }

  // 19. reload preserves the exact applied order.
  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await readDraft(page);
  assert.deepEqual(reloaded.days[0].placeIds, expectedOrder);
  assert.equal(reloaded.version, 7);

  /**
   * 20-21. Navigate the real UI back into the planner and prove the alternatives are re-derived
   * from the reloaded baseline. Nothing is re-seeded on the way: the init script only writes a key
   * that is absent, and both keys already exist by now.
   */
  await enterPlanner(page);
  const afterNavigation = await readDraft(page);
  assert.deepEqual(afterNavigation.days[0].placeIds, expectedOrder);
  assert.equal(afterNavigation.days[0].id, dayId);

  /**
   * The applied Okinawa order admits no adjacent swap, no relocation, no transposition and no
   * further reversal under the recorded evidence, so the freshly derived surface must be the
   * existing neutral empty state. Had it been derived from the originally seeded fixture, the
   * Phase 3E-I candidate and its "Reversiones de cuatro lugares" group would be on screen again.
   */
  const postReloadReversals = await page.locator(".local-reversal__item").count();
  const postReloadItems = await page.locator(".local-swap__item").count();
  const postReloadGroups = await page.locator(".local-swap__group").count();
  const postReloadEmpty = await page.locator(".local-swap__empty").count();
  assert.equal(
    postReloadReversals,
    0,
    "the applied order is the new baseline, so its own candidate must not reappear after reload"
  );
  assert.equal(postReloadItems, 0, "no local alternative is provable from the applied order");
  assert.equal(postReloadGroups, 0, "no candidate group may render when nothing is provable");
  assert.equal(postReloadEmpty, 1);
  assert.equal(
    await page.getByRole("heading", { name: "Reversiones de cuatro lugares" }).count(),
    0
  );
  const postReloadSurface = await page.locator(".local-swap").first().innerText();
  assert.match(
    postReloadSurface,
    /No hay una alternativa local con mejora demostrable usando todos los traslados registrados\s+necesarios para esta comparación\./
  );
  for (const name of reversedNames) {
    assert.ok(
      !postReloadSurface.includes(name),
      `the stale pre-reload candidate is still rendered: ${postReloadSurface}`
    );
  }
  await mainContext.close();

  /**
   * 22-24. The three earlier neighbourhoods must still *work*, not merely still be referenced.
   *
   * The Phase 3E-I fixture deliberately admits none of them — that is what makes it incremental —
   * so each is proved on its own real fixture, in its own isolated context, from a clean baseline.
   */
  async function applyAndRead({ seedRouteIds, seedDayId, groupHeading, buttonName, expected }) {
    const { context, page: regressionPage } = await bootPlanner(seedRouteIds, seedDayId);
    try {
      await regressionPage.getByRole("heading", { name: groupHeading }).waitFor();
      await regressionPage.getByRole("button", { name: buttonName }).first().click();
      await regressionPage.waitForFunction((want) => {
        const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
        return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(want);
      }, expected);
      const stored = await readDraft(regressionPage);
      assert.deepEqual(stored.days[0].placeIds, expected);
      assert.equal(stored.version, 7);
      return stored.days[0].placeIds;
    } finally {
      await context.close();
    }
  }

  const swapFixture = ["JP-006", "JP-034", "JP-035", "JP-036", "JP-033"];
  const transpositionFixture = ["JP-028", "JP-026", "JP-022", "JP-027", "JP-025"];

  // 22. Phase 3E-C adjacent swap still applies.
  const adjacentApplied = await applyAndRead({
    seedRouteIds: swapFixture,
    seedDayId: "phase-3e-i-regression-c",
    groupHeading: "Intercambios adyacentes",
    buttonName: "Aplicar este intercambio",
    expected: ["JP-006", "JP-035", "JP-034", "JP-036", "JP-033"],
  });
  // 23. Phase 3E-E relocation still applies.
  const relocationApplied = await applyAndRead({
    seedRouteIds: swapFixture,
    seedDayId: "phase-3e-i-regression-e",
    groupHeading: "Reubicaciones de un lugar",
    buttonName: "Aplicar esta reubicación",
    expected: ["JP-006", "JP-035", "JP-036", "JP-034", "JP-033"],
  });
  // 24. Phase 3E-G non-adjacent transposition still applies.
  const transpositionApplied = await applyAndRead({
    seedRouteIds: transpositionFixture,
    seedDayId: "phase-3e-i-regression-g",
    groupHeading: "Intercambios no adyacentes",
    buttonName: "Aplicar este intercambio no adyacente",
    expected: ["JP-028", "JP-027", "JP-022", "JP-026", "JP-025"],
  });

  // 25-26. across every context opened above.
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3E-I browser audit PASS");
  console.log("  baseline order   :", routeIds.join(" "));
  console.log("  applied order    :", applied.days[0].placeIds.join(" "));
  console.log("  reloaded order   :", reloaded.days[0].placeIds.join(" "));
  console.log("  draft version    :", reloaded.version);
  console.log("  draft keys       :", draftKeyCount);
  console.log("  natural copy     :", copy);
  console.log("  recorded ranges  :", JSON.stringify(renderedRanges));
  console.log("  confidence mixes :", JSON.stringify(evidenceMixes));
  console.log("  post-reload day id                 :", afterNavigation.days[0].id);
  console.log("  post-reload reversal items         :", postReloadReversals);
  console.log("  post-reload alternative items (all):", postReloadItems);
  console.log("  post-reload candidate groups       :", postReloadGroups);
  console.log("  post-reload neutral empty states   :", postReloadEmpty);
  console.log("  3E-C adjacent swap still applies   :", adjacentApplied.join(" "));
  console.log("  3E-E relocation still applies      :", relocationApplied.join(" "));
  console.log("  3E-G transposition still applies   :", transpositionApplied.join(" "));
  console.log("  console errors (all contexts)      :", consoleErrors.length);
  console.log("  page errors (all contexts)         :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
