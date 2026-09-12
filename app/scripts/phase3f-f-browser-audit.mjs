import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3F-F — executable browser acceptance for the official reservation-date presentation gate.
 *
 * Run this script twice consecutively after the final code change. Each run covers the required
 * real pilot fixtures plus recomputation/persistence boundaries.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const emptyBoundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };

function makeDraft(routeIds, dayGroups, startDate) {
  return {
    version: 7,
    routeIds,
    days: dayGroups.map((placeIds, index) => ({
      id: `phase-3f-f-day-${index + 1}`,
      placeIds,
      accommodationBoundary: emptyBoundary,
    })),
    startDate,
    endDate: null,
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
    interHubSegments: [],
  };
}

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3f-f-vite-"));
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

  async function enterPlanner(page) {
    await page.getByRole("button", { name: /Quiero ir/ }).click();
    await page.getByRole("button", { name: /Construir recorrido/ }).click();
    await page.getByRole("button", { name: /Distribuir por días/ }).click();
    await page.getByRole("heading", { name: "Día 1" }).waitFor();
  }

  async function bootPlanner(planningDraft) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.addInitScript(({ saved, draft }) => {
      if (localStorage.getItem("nihon.savedPlaceIds") === null) {
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
      }
      if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
        localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
      }
    }, { saved: planningDraft.routeIds, draft: planningDraft });

    await page.goto(url, { waitUntil: "networkidle" });
    await enterPlanner(page);
    return { context, page };
  }

  const readDraft = (page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));

  const officialItemFor = (page, placeName) =>
    page.locator(".official-reservation-date__item").filter({ hasText: placeName });

  // 1. Ghibli real fixture + Phase 3D-H coexistence in the SAME day card.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-044", "JP-019"], [["JP-044", "JP-019"]], "2027-02-20")
    );
    try {
      const day = page.locator(".day-card").first();
      await day.locator(".official-reservation-date").waitFor();
      await day.locator(".reservation-deadline").waitFor();

      const item = officialItemFor(page, "Ghibli Museum, Mitaka");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Entrada general/);
      assert.match(text, /Venta registrada para esta visita/);
      assert.match(text, /10 ene 2027/);
      assert.match(text, /10:00 \(Asia\/Tokyo\)/);
      assert.match(text, /Ghibli Museum, Mitaka/);
      assert.match(text, /consultada el .*12 sept 2026/);

      const href = await item.getByRole("link", { name: "Ver fuente oficial" }).getAttribute("href");
      assert.equal(href, "https://www.ghibli-museum.jp/en/tickets/");

      const officialText = await day.locator(".official-reservation-date").innerText();
      assert.match(officialText, /Nihon no combina ambas fuentes/);
      assert.doesNotMatch(officialText, /Fecha de referencia/i);
      for (const forbidden of [
        /ya puedes comprar/i,
        /reserva ahora/i,
        /compra ahora/i,
        /última oportunidad/i,
        /fecha límite/i,
        /reservas abiertas/i,
        /reservas cerradas/i,
        /venta abierta/i,
        /venta cerrada/i,
        /disponible/i,
        /urgente/i,
      ]) {
        assert.doesNotMatch(officialText, forbidden);
      }
    } finally {
      await context.close();
    }
  }

  // 2. Disneyland null-timezone disclosure and day-move recomputation.
  {
    const draft = makeDraft(
      ["JP-203", "JP-019"],
      [["JP-203"], ["JP-019"]],
      "2027-02-20"
    );
    const { context, page } = await bootPlanner(draft);
    try {
      let item = officialItemFor(page, "Tokyo Disneyland");
      await item.waitFor();
      let text = await item.innerText();
      assert.match(text, /20 dic 2026/);
      assert.match(text, /14:00/);
      assert.match(text, /zona horaria no registrada/i);
      assert.doesNotMatch(text, /Asia\/Tokyo|JST|UTC\+9/i);
      assert.match(text, /capacidad de venta limitada/i);

      // Move the real place from Día 1 to Día 2 through the existing UI. The visit date becomes
      // 2027-02-21, so the exact two-calendar-month release fact must recompute to 2026-12-21.
      await page.getByRole("button", { name: "Mover Tokyo Disneyland al día siguiente" }).click();
      await page.waitForFunction(() => {
        const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
        return stored?.days?.[0]?.placeIds?.includes("JP-203") === false &&
          stored?.days?.[1]?.placeIds?.includes("JP-203") === true;
      });

      item = officialItemFor(page, "Tokyo Disneyland");
      await item.waitFor();
      text = await item.innerText();
      assert.match(text, /21 dic 2026/);
      assert.doesNotMatch(text, /20 dic 2026/);

      // Clearing the real start-date input removes every trip-specific Phase 3F item; no stale
      // derived state survives because none is persisted.
      await page.getByLabel("Fecha de inicio (Día 1)").fill("");
      await page.waitForFunction(
        () => document.querySelectorAll(".official-reservation-date").length === 0
      );
      const cleared = await readDraft(page);
      assert.equal(cleared.startDate, null);
      assert.equal(cleared.version, 7);

      const persistedText = await page.evaluate(
        () => localStorage.getItem("nihon.manualPlanningDraft") ?? ""
      );
      for (const forbidden of [
        "releaseDate",
        "application-window",
        "reservationMechanism",
        "consultedAt",
        "sourceUrl",
        "allocation",
      ]) {
        assert.ok(!persistedText.includes(forbidden), `derived Phase 3F state persisted: ${forbidden}`);
      }

      await page.reload({ waitUntil: "networkidle" });
      await enterPlanner(page);
      assert.equal(await page.locator(".official-reservation-date").count(), 0);
      const reloaded = await readDraft(page);
      assert.equal(reloaded.startDate, null);
      assert.equal(reloaded.version, 7);
    } finally {
      await context.close();
    }
  }

  // 3. DisneySea real missing-day fallback remains presentation-only and keeps timezone unknown.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-204", "JP-019"], [["JP-204"], ["JP-019"]], "2027-04-30")
    );
    try {
      const item = officialItemFor(page, "Tokyo DisneySea");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /1 mar 2027/);
      assert.match(text, /14:00/);
      assert.match(text, /zona horaria no registrada/i);
      assert.doesNotMatch(text, /2027-02-30|Asia\/Tokyo|JST|UTC\+9/i);
    } finally {
      await context.close();
    }
  }

  // 4. Katsura shows independent application-window edges plus lottery disclosure.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-077", "JP-019"], [["JP-077"], ["JP-019"]], "2027-03-15")
    );
    try {
      const item = officialItemFor(page, "Katsura Imperial Villa");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Ventana oficial registrada para esta visita/);
      assert.match(text, /Inicio: .*1 dic 2026.*05:00/s);
      assert.match(text, /Fin registrado de la ventana: .*12 mar 2027.*23:59/s);
      assert.match(text, /zona horaria no registrada/i);
      assert.match(text, /sorteo si las solicitudes superan el cupo/i);
    } finally {
      await context.close();
    }
  }

  // 5. Sumo inside the recorded event period gets the fixed sale date and no invented time.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-212", "JP-019"], [["JP-212"], ["JP-019"]], "2027-03-20")
    );
    try {
      const item = officialItemFor(page, "Grand Sumo Tournament Osaka 2027");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Inicio de venta oficial registrado para este evento/);
      assert.match(text, /6 feb 2027/);
      assert.doesNotMatch(text, /\b\d{2}:\d{2}\b/);
    } finally {
      await context.close();
    }
  }

  // 6. Sumo immediately outside the event period becomes neutral not-applicable evidence.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-212", "JP-019"], [["JP-212"], ["JP-019"]], "2027-03-29")
    );
    try {
      const item = officialItemFor(page, "Grand Sumo Tournament Osaka 2027");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /no aplica a la fecha de visita asignada/i);
      assert.match(text, /fuera del periodo del evento registrado/i);
      assert.match(text, /14 mar 2027/);
      assert.match(text, /28 mar 2027/);
      assert.doesNotMatch(text, /6 feb 2027/);
    } finally {
      await context.close();
    }
  }

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3F-F browser audit PASS");
  console.log("  Ghibli release + provenance      : pass");
  console.log("  Phase 3D-H coexistence           : pass");
  console.log("  Disneyland null timezone         : pass");
  console.log("  move-to-next-day recomputation   : pass");
  console.log("  clear/reload no stale derivation : pass");
  console.log("  DisneySea fallback               : pass");
  console.log("  Katsura independent window edges : pass");
  console.log("  Sumo applicable                  : pass");
  console.log("  Sumo not-applicable              : pass");
  console.log("  console errors                   :", consoleErrors.length);
  console.log("  page errors                      :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
