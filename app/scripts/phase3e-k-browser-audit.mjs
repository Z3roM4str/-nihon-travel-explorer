import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3E-K — executable browser acceptance for the normative UI/browser contracts 123-125.
 *
 * The fixture is the fully validated-static Okinawa block from the Phase 3E-J design audit: no
 * one-step adjacent swap, no one-place relocation, no non-adjacent transposition and no four-place
 * reversal improves this baseline, but the exact 2+2 pair-block swap does — 92 min down to 81 min,
 * minimum recorded gap 11 min, five validated-static edges on each side.
 *
 * The audit then proves the *continuation* without ever representing it as one action: after that
 * single explicit Apply, the already-shipped Phase 3E-E relocation is regenerated from the new
 * 81-minute baseline and offers 81 → 74 with a 7-minute gap. It is never auto-applied; the audit
 * reloads first, re-derives it from the persisted draft, and only then clicks it a second time.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const routeIds = ["JP-202", "JP-153", "JP-156", "JP-161", "JP-154", "JP-155"];
/** After the one explicit 3E-K Apply: 81 min. */
const pairSwappedOrder = ["JP-202", "JP-161", "JP-154", "JP-153", "JP-156", "JP-155"];
/** After a second, separate, explicit 3E-E Apply: 74 min. */
const relocatedOrder = ["JP-202", "JP-161", "JP-156", "JP-154", "JP-153", "JP-155"];
const firstBlockNames = ["Kokusai Street", "Sakaemachi Arcade nightlife"];
const secondBlockNames = [
  "Okinawa Prefectural Museum & Art Museum",
  "First Makishi Public Market",
];
const dayId = "phase-3e-k-day";
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

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3e-k-vite-"));

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

  const waitForOrder = (page, expected) =>
    page.waitForFunction((want) => {
      const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
      return JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(want);
    }, expected);

  // 1-2. the app boots and the existing local-alternatives surface renders.
  const { context: mainContext, page } = await bootPlanner(routeIds, dayId);

  // 3. the fifth subgroup renders.
  await page.getByRole("heading", { name: "Intercambios de bloques de dos lugares" }).waitFor();
  const group = page.locator(".local-pair-block-swap__item").first();
  await group.waitFor();
  const groupText = await group.innerText();

  // 4. the copy names both two-place blocks naturally and does not lead with indices.
  const copy = await page.locator(".local-pair-block-swap__blocks").first().innerText();
  assert.match(
    copy,
    /^Intercambiar los bloques de dos lugares .+ → .+ y .+ → .+ dentro del bloque de Okinawa\.$/
  );
  assert.ok(
    copy.includes(`${firstBlockNames[0]} → ${firstBlockNames[1]}`),
    `copy is missing the first two-place block: ${copy}`
  );
  assert.ok(
    copy.includes(`${secondBlockNames[0]} → ${secondBlockNames[1]}`),
    `copy is missing the second two-place block: ${copy}`
  );

  // 5-7. both recorded ranges and the 11-minute minimum gap are visible.
  assert.match(groupText, /Traslados registrados del bloque actual/);
  assert.match(groupText, /Traslados registrados de este intercambio de bloques/);
  const renderedRanges = await group.locator("dd").allInnerTexts();
  assert.equal(renderedRanges.length, 2, `expected two recorded ranges, got ${renderedRanges.length}`);
  // The surface humanises the recorded ranges: 92 min renders "1 h 32 min", 81 min "1 h 21 min".
  assert.match(renderedRanges[0], /^1 h 32 min\b/);
  assert.match(renderedRanges[1], /^1 h 21 min\b/);
  assert.match(groupText, /Ventaja mínima entre los rangos registrados: 11 min\./);

  // 8. confidence is disclosed for both orders, five validated edges each.
  const evidenceMixes = await group.locator(".local-swap__evidence").allInnerTexts();
  assert.equal(evidenceMixes.length, 2, `expected two confidence disclosures, got ${evidenceMixes.length}`);
  for (const mix of evidenceMixes) assert.match(mix, /5 validados/);

  // 9. the required local-only qualification and the approved claim.
  assert.match(
    groupText,
    /No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo\./
  );
  assert.match(
    groupText,
    /Este intercambio de bloques reduce de forma demostrable el rango de traslado local registrado de este bloque\./
  );

  // 10. no forbidden optimisation claim anywhere on the surface, and no combined 92 → 74 claim.
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
    /18 min/,
    /ahorro total/i,
    /1 h 14 min/,
  ]) {
    assert.doesNotMatch(surfaceText, forbidden);
  }

  // 11. nothing is applied until the user clicks.
  const beforeApply = await readDraft(page);
  assert.deepEqual(beforeApply.days[0].placeIds, routeIds);

  // 12. Apply is explicit.
  await page
    .getByRole("button", { name: "Aplicar este intercambio de bloques" })
    .first()
    .click();

  // 13. one click yields the exact 81-minute Okinawa order.
  await waitForOrder(page, pairSwappedOrder);
  // 17. no automatic second Apply: the order is still the single applied one after settling.
  await page.waitForTimeout(600);
  const applied = await readDraft(page);
  assert.deepEqual(applied.days[0].placeIds, pairSwappedOrder);
  assert.notDeepEqual(applied.days[0].placeIds, relocatedOrder);

  // 14-16. still V7, one storage key, and no candidate metadata persisted.
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
    "windowstart",
    "firstpair",
    "secondpair",
    "swappedwindow",
    "blockswap",
    "affected",
    "advantage",
    "evidence",
    "confidence",
    "rank",
    "score",
    "history",
  ]) {
    assert.ok(
      !persisted.toLowerCase().includes(forbidden),
      `persisted draft leaked candidate state: ${forbidden}`
    );
  }

  /**
   * 18-21. The pair-block candidate itself is gone, and the independently evidenced Phase 3E-E
   * relocation is now on screen — generated by the existing 3E-E runtime, not folded into this
   * phase's candidate and not applied on the user's behalf.
   */
  await page.getByRole("heading", { name: "Reubicaciones de un lugar" }).waitFor();
  const relocationItem = page.locator(".local-relocation__item").first();
  await relocationItem.waitFor();
  const relocationText = await relocationItem.innerText();
  assert.equal(
    await page.locator(".local-pair-block-swap__item").count(),
    0,
    "the applied order is the new baseline, so this phase's own candidate must be gone"
  );
  assert.equal(
    await page.getByRole("heading", { name: "Intercambios de bloques de dos lugares" }).count(),
    0
  );
  const relocationRanges = await relocationItem.locator("dd").allInnerTexts();
  assert.equal(relocationRanges.length, 2);
  // 81 min renders "1 h 21 min", 74 min renders "1 h 14 min".
  assert.match(relocationRanges[0], /^1 h 21 min\b/);
  assert.match(relocationRanges[1], /^1 h 14 min\b/);
  assert.match(relocationText, /Ventaja mínima entre los rangos registrados: 7 min\./);
  for (const mix of await relocationItem.locator(".local-swap__evidence").allInnerTexts()) {
    assert.match(mix, /5 validados/);
  }
  // It is offered, not already applied: the persisted order is still the 81-minute one.
  const beforeSecondClick = await readDraft(page);
  assert.deepEqual(beforeSecondClick.days[0].placeIds, pairSwappedOrder);

  // 22. reload preserves the 81-minute state, performed before the second click.
  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await readDraft(page);
  assert.deepEqual(reloaded.days[0].placeIds, pairSwappedOrder);
  assert.equal(reloaded.version, 7);

  /**
   * 23. After reload/re-entry the 3E-E candidate is freshly regenerated from the persisted
   * baseline. Nothing is re-seeded on the way: the init script only writes a key that is absent,
   * and both keys already exist by now.
   */
  await enterPlanner(page);
  const afterNavigation = await readDraft(page);
  assert.deepEqual(afterNavigation.days[0].placeIds, pairSwappedOrder);
  assert.equal(afterNavigation.days[0].id, dayId);
  await page.getByRole("heading", { name: "Reubicaciones de un lugar" }).waitFor();
  const regeneratedRelocationText = await page
    .locator(".local-relocation__item")
    .first()
    .innerText();
  assert.match(regeneratedRelocationText, /Ventaja mínima entre los rangos registrados: 7 min\./);
  assert.equal(await page.locator(".local-pair-block-swap__item").count(), 0);

  /**
   * 24-25. The optional, deliberately separate second explicit action. It is a second click on a
   * second candidate produced by a second generation pass from a persisted, reloaded baseline —
   * never one atomic 92 → 74 step.
   */
  await page.getByRole("button", { name: "Aplicar esta reubicación" }).first().click();
  await waitForOrder(page, relocatedOrder);
  await page.waitForTimeout(400);
  const finalDraft = await readDraft(page);
  assert.deepEqual(finalDraft.days[0].placeIds, relocatedOrder);
  assert.equal(finalDraft.version, 7);
  const finalSurface = await page.locator(".local-swap").first().innerText();
  for (const forbidden of [/18 min/, /ahorro total/i, /1 h 32 min/]) {
    assert.doesNotMatch(finalSurface, forbidden);
  }
  await mainContext.close();

  /**
   * 26. The earlier neighbourhoods must still *work*, not merely still be referenced.
   *
   * The Phase 3E-K fixture deliberately admits none of C/G/I — that is what makes it incremental —
   * so each is proved on its own real fixture, in its own isolated context, from a clean baseline.
   * (3E-E is already exercised end-to-end above, on the regenerated 81-minute baseline.)
   */
  async function applyAndRead({ seedRouteIds, seedDayId, groupHeading, buttonName, expected }) {
    const { context, page: regressionPage } = await bootPlanner(seedRouteIds, seedDayId);
    try {
      await regressionPage.getByRole("heading", { name: groupHeading }).waitFor();
      await regressionPage.getByRole("button", { name: buttonName }).first().click();
      await waitForOrder(regressionPage, expected);
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
  const reversalFixture = ["JP-202", "JP-153", "JP-155", "JP-156", "JP-161", "JP-154"];

  // Phase 3E-C adjacent swap still applies.
  const adjacentApplied = await applyAndRead({
    seedRouteIds: swapFixture,
    seedDayId: "phase-3e-k-regression-c",
    groupHeading: "Intercambios adyacentes",
    buttonName: "Aplicar este intercambio",
    expected: ["JP-006", "JP-035", "JP-034", "JP-036", "JP-033"],
  });
  // Phase 3E-G non-adjacent transposition still applies.
  const transpositionApplied = await applyAndRead({
    seedRouteIds: transpositionFixture,
    seedDayId: "phase-3e-k-regression-g",
    groupHeading: "Intercambios no adyacentes",
    buttonName: "Aplicar este intercambio no adyacente",
    expected: ["JP-028", "JP-027", "JP-022", "JP-026", "JP-025"],
  });
  // Phase 3E-I four-place reversal still applies.
  const reversalApplied = await applyAndRead({
    seedRouteIds: reversalFixture,
    seedDayId: "phase-3e-k-regression-i",
    groupHeading: "Reversiones de cuatro lugares",
    buttonName: "Aplicar esta reversión de cuatro lugares",
    expected: ["JP-202", "JP-161", "JP-156", "JP-155", "JP-153", "JP-154"],
  });

  // 27-28. across every context opened above.
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3E-K browser audit PASS");
  console.log("  baseline order              :", routeIds.join(" "));
  console.log("  applied order (3E-K, 81 min):", applied.days[0].placeIds.join(" "));
  console.log("  reloaded order              :", reloaded.days[0].placeIds.join(" "));
  console.log("  draft version               :", finalDraft.version);
  console.log("  draft keys                  :", draftKeyCount);
  console.log("  natural copy                :", copy);
  console.log("  recorded ranges (3E-K)      :", JSON.stringify(renderedRanges));
  console.log("  confidence mixes (3E-K)     :", JSON.stringify(evidenceMixes));
  console.log("  post-Apply 3E-K items       :", 0);
  console.log("  regenerated 3E-E ranges     :", JSON.stringify(relocationRanges));
  console.log("  post-reload 3E-E present    : yes (regenerated from the persisted 81-min order)");
  console.log("  second explicit Apply (3E-E):", finalDraft.days[0].placeIds.join(" "));
  console.log("  3E-C adjacent swap applies  :", adjacentApplied.join(" "));
  console.log("  3E-G transposition applies  :", transpositionApplied.join(" "));
  console.log("  3E-I reversal applies       :", reversalApplied.join(" "));
  console.log("  console errors (all contexts):", consoleErrors.length);
  console.log("  page errors (all contexts)   :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
