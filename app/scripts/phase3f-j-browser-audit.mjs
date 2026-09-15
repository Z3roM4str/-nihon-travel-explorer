import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3F-J — executable browser acceptance for the route-wide official reservation calendar.
 *
 * Run this script twice consecutively after the final code change.
 *
 * Determinism contract: every scenario fixes the BROWSER's local calendar date before the
 * application boots, using the same test-only `addInitScript` Date shim Phase 3F-H established. No
 * production test-date prop, query parameter, localStorage field or planning-draft field exists;
 * production `captureDeviceLocalCivilDate` is unchanged and still runs on the real path.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const emptyBoundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };

function makeDraft(dayGroups, startDate) {
  const routeIds = dayGroups.flat();
  return {
    version: 7,
    routeIds,
    days: dayGroups.map((placeIds, index) => ({
      id: `phase-3f-j-day-${index + 1}`,
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

/** Identical mechanism to the Phase 3F-H audit: only zero-argument `new Date()` and `Date.now()`
 * are intercepted; explicit arguments, `Date.UTC`, `Date.parse` and the prototype pass through. */
function fixBrowserCivilDate([year, month, day]) {
  const OriginalDate = Date;
  const fixed = new OriginalDate(year, month - 1, day, 12, 0, 0, 0).getTime();
  const shim = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [fixed] : args, newTarget);
    },
    apply() {
      return new OriginalDate(fixed).toString();
    },
    get(target, prop, receiver) {
      if (prop === "now") return () => fixed;
      return Reflect.get(target, prop, receiver);
    },
  });
  globalThis.Date = shim;
  window.Date = shim;
}

const FORBIDDEN_COPY = [
  /próxima reserva/i,
  /prioridad(?!,? urgencia)/i,
  /prioritario/i,
  /urgente/i,
  /pendiente/i,
  /por hacer/i,
  /completado/i,
  /te falta/i,
  /d[íi]as restantes/i,
  /horas restantes/i,
  /fecha l[íi]mite/i,
  /deadline/i,
  /[úu]ltima oportunidad/i,
  /[úu]ltimo d[íi]a/i,
  /venta abierta/i,
  /venta cerrada/i,
  /reservas abiertas/i,
  /reservas cerradas/i,
  /agotado/i,
  /quedan boletos/i,
  /reserva ahora/i,
  /compra ahora/i,
  /no olvides/i,
  /ya puedes/i,
  /todav[íi]a puedes/i,
  /est[áa]s a tiempo/i,
  /se te pas[óo]/i,
];

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3f-j-vite-"));
const server = await createServer({
  root: appRoot,
  cacheDir,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});

let browser;
const results = [];
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

  async function bootPlanner(planningDraft, referenceCivilDate) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.addInitScript(fixBrowserCivilDate, referenceCivilDate.split("-").map(Number));
    await page.addInitScript(({ saved, draft }) => {
      if (localStorage.getItem("nihon.savedPlaceIds") === null) {
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
      }
      if (localStorage.getItem("nihon.manualPlanningDraft") === null) {
        localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
      }
    }, { saved: planningDraft.routeIds, draft: planningDraft });

    await page.goto(url, { waitUntil: "networkidle" });

    const observed = await page.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
        .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
        .join("-");
    });
    assert.equal(observed, referenceCivilDate, "browser local civil date was not fixed before boot");

    await enterPlanner(page);
    return { context, page };
  }

  const calendar = (page) => page.locator(".official-reservation-calendar");
  const rows = (page) => page.locator(".official-reservation-calendar__item");
  const rowFor = (page, placeName) => rows(page).filter({ hasText: placeName });

  const anchorOrder = (page) =>
    page.locator(".official-reservation-calendar__anchor").allInnerTexts();
  const contextOrder = (page) =>
    page.locator(".official-reservation-calendar__context").allInnerTexts();

  function assertNoForbiddenCopy(text, label) {
    for (const forbidden of FORBIDDEN_COPY) {
      assert.doesNotMatch(text, forbidden, `${label}: forbidden copy ${forbidden}`);
    }
  }

  function record(name, detail) {
    results.push(`  ${name.padEnd(38)}: pass${detail ? ` (${detail})` : ""}`);
  }

  // The worked plan from the design gate: plan order Sumo, Katsura, Ghibli, Disneyland; the
  // official-date order is completely different.
  const workedPlan = () =>
    makeDraft([["JP-212"], ["JP-077"], ["JP-044"], ["JP-203"]], "2027-03-14");

  // ── A. chronological multi-place order, and N. the section-level reference-date disclosure ──
  {
    const { context, page } = await bootPlanner(workedPlan(), "2027-01-20");
    try {
      await calendar(page).waitFor();
      assert.equal(await calendar(page).count(), 1, "route-wide section must render exactly once");
      await page.getByRole("heading", { name: "Fechas oficiales de reserva del recorrido" }).waitFor();

      assert.deepEqual(await anchorOrder(page), [
        "mar, 1 dic 2026",
        "dom, 17 ene 2027",
        "sáb, 6 feb 2027",
        "mié, 10 feb 2027",
      ]);
      const contexts = await contextOrder(page);
      assert.match(contexts[0], /Katsura Imperial Villa · Día 2 · visita .*15 mar 2027/);
      assert.match(contexts[1], /Tokyo Disneyland · Día 4 · visita .*17 mar 2027/);
      assert.match(contexts[2], /Grand Sumo Tournament Osaka 2027 · Día 1 · visita .*14 mar 2027/);
      assert.match(contexts[3], /Ghibli Museum, Mitaka · Día 3 · visita .*16 mar 2027/);

      // Chronological order is NOT plan order and NOT visit order.
      const dayNumbers = contexts.map((text) => Number(/Día (\d+)/.exec(text)[1]));
      assert.deepEqual(dayNumbers, [2, 4, 1, 3]);

      // N. one section-level reference-date disclosure, rendered once, not collapsible.
      const disclosure = page.locator(".official-reservation-calendar__reference-date");
      assert.equal(await disclosure.count(), 1);
      const disclosureText = await disclosure.innerText();
      assert.match(disclosureText, /Fecha de referencia \(tu dispositivo\):.*20 ene 2027/);
      assert.match(disclosureText, /todas las relaciones de esta secci[óo]n/);
      assert.equal(await calendar(page).locator("details, summary").count(), 0);

      // Relations use Phase 3F-H's exact vocabulary and appear on every eligible row.
      const relations = await page.locator(".official-reservation-calendar__relation").allInnerTexts();
      assert.equal(relations.length, 4);
      assert.match(relations[0], /cae dentro del tramo de fechas registrado para la solicitud\./);
      assert.match(relations[1], /está después de la fecha oficial registrada\./);
      assert.match(relations[2], /está antes de la fecha oficial registrada\./);
      assert.match(relations[3], /está antes de la fecha oficial registrada\./);

      const sectionText = await calendar(page).innerText();
      assertNoForbiddenCopy(sectionText, "Scenario A");
      assert.match(sectionText, /no indica prioridad, urgencia ni en qué orden conviene reservar/);
      assert.match(sectionText, /No indica disponibilidad ni el estado actual de la venta/);
      assert.match(sectionText, /Nihon no combina ambas fuentes/);
      record("A. chronological multi-place order", "plan 1,2,3,4 → dates 2,4,1,3");
      record("N. reference-date disclosure", "once at section level, ref 2027-01-20");
    } finally {
      await context.close();
    }
  }

  // ── B. same-date tie, broken deterministically by position within the day ───────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft([["JP-204", "JP-203"]], "2027-02-20"),
      "2027-01-20"
    );
    try {
      await calendar(page).waitFor();
      assert.deepEqual(await anchorOrder(page), ["dom, 20 dic 2026", "dom, 20 dic 2026"]);
      let contexts = await contextOrder(page);
      assert.match(contexts[0], /Tokyo DisneySea · Día 1/);
      assert.match(contexts[1], /Tokyo Disneyland · Día 1/);
      // Two facts sharing a date stay two separate rows, with no group header and no count.
      assert.equal(await rows(page).count(), 2);
      const sectionText = await calendar(page).innerText();
      assert.doesNotMatch(sectionText, /2 reservas/);

      // K. intra-day reorder flips only the tie order, exactly as the contract says it should.
      await page.getByRole("button", { name: "Mover Tokyo DisneySea hacia abajo en Día 1" }).click();
      await page.waitForFunction(() => {
        const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
        return stored?.days?.[0]?.placeIds?.[0] === "JP-203";
      });
      assert.deepEqual(await anchorOrder(page), ["dom, 20 dic 2026", "dom, 20 dic 2026"]);
      contexts = await contextOrder(page);
      assert.match(contexts[0], /Tokyo Disneyland · Día 1/);
      assert.match(contexts[1], /Tokyo DisneySea · Día 1/);
      record("B. same-date tie", "position within day decides");
      record("K. intra-day reorder", "only tie order changes");
    } finally {
      await context.close();
    }
  }

  // ── C. Ghibli, and D. Disneyland unknown timezone ───────────────────────────────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft([["JP-044", "JP-203"]], "2027-02-20"),
      "2027-01-09"
    );
    try {
      await calendar(page).waitFor();
      const ghibli = rowFor(page, "Ghibli Museum, Mitaka");
      const ghibliText = await ghibli.innerText();
      assert.match(ghibliText, /dom, 10 ene 2027/);
      assert.match(ghibliText, /Entrada general/);
      assert.match(ghibliText, /Venta registrada para esta visita/);
      assert.match(ghibliText, /10:00 \(Asia\/Tokyo\)/);
      assert.match(ghibliText, /Fuente oficial: Ghibli Museum, Mitaka · consultada el .*12 sept 2026/);
      const href = await ghibli.getByRole("link", { name: "Ver fuente oficial" }).getAttribute("href");
      assert.equal(href, "https://www.ghibli-museum.jp/en/tickets/");
      assertNoForbiddenCopy(ghibliText, "Scenario C");

      const disney = rowFor(page, "Tokyo Disneyland");
      const disneyText = await disney.innerText();
      assert.match(disneyText, /dom, 20 dic 2026/);
      assert.match(disneyText, /14:00/);
      assert.match(disneyText, /zona horaria no registrada/i);
      assert.doesNotMatch(disneyText, /Asia\/Tokyo|JST|UTC\+9/i);
      assert.match(disneyText, /capacidad de venta limitada/i);
      assertNoForbiddenCopy(disneyText, "Scenario D");
      record("C. Ghibli", "10 ene 2027 · 10:00 (Asia/Tokyo)");
      record("D. Disneyland unknown timezone", "14:00, no JST inference");
    } finally {
      await context.close();
    }
  }

  // ── E. Katsura: exactly one range row ───────────────────────────────────────────────────────
  {
    const { context, page } = await bootPlanner(makeDraft([["JP-077", "JP-019"]], "2027-03-15"), "2027-03-12");
    try {
      await calendar(page).waitFor();
      assert.equal(await rows(page).count(), 1, "Katsura must contribute exactly one row");
      const text = await rows(page).first().innerText();
      assert.match(text, /mar, 1 dic 2026/);
      assert.match(text, /05:00/);
      assert.match(text, /→/);
      assert.match(text, /vie, 12 mar 2027/);
      assert.match(text, /23:59/);
      assert.match(text, /zona horaria no registrada/i);
      assert.match(text, /Situado en esta lista por la fecha de inicio registrada del tramo\./);
      assert.match(text, /sorteo si las solicitudes superan el cupo/i);
      // No standalone close-date row anywhere in the section.
      assert.deepEqual(await anchorOrder(page), ["mar, 1 dic 2026"]);
      // The reference date IS the recorded close edge, and still says only "within the span".
      assert.match(text, /cae dentro del tramo de fechas registrado para la solicitud\./);
      assertNoForbiddenCopy(text, "Scenario E");
      record("E. Katsura single range row", "both edges, anchor disclosed");
    } finally {
      await context.close();
    }
  }

  // ── F. Sumo applicable, and G. Sumo outside the recorded event period ───────────────────────
  {
    const { context, page } = await bootPlanner(makeDraft([["JP-212", "JP-019"]], "2027-03-20"), "2027-02-05");
    try {
      await calendar(page).waitFor();
      assert.equal(await rows(page).count(), 1);
      const text = await rows(page).first().innerText();
      assert.match(text, /sáb, 6 feb 2027/);
      assert.match(text, /Inicio de venta oficial registrado para este evento/);
      assert.doesNotMatch(text, /\b\d{2}:\d{2}\b/);
      assert.match(text, /está antes de la fecha oficial registrada\./);
      assertNoForbiddenCopy(text, "Scenario F");
      record("F. Sumo applicable", "6 feb 2027, no invented time");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page } = await bootPlanner(makeDraft([["JP-212", "JP-019"]], "2027-03-29"), "2027-02-05");
    try {
      const day = page.locator(".day-card").first();
      await day.locator(".official-reservation-date").waitFor();
      // No route-wide section at all: the only Phase 3F result in this plan has no applicable date.
      assert.equal(await calendar(page).count(), 0);
      // The existing per-day Phase 3F-F neutral presentation is untouched.
      const dayItem = day.locator(".official-reservation-date__item").filter({
        hasText: "Grand Sumo Tournament Osaka 2027",
      });
      const dayText = await dayItem.innerText();
      assert.match(dayText, /no aplica a la fecha de visita asignada/i);
      assert.match(dayText, /fuera del periodo del evento registrado/i);
      assert.match(dayText, /14 mar 2027/);
      assert.match(dayText, /28 mar 2027/);
      assert.doesNotMatch(dayText, /Fecha de referencia \(tu dispositivo\)/);
      record("G. Sumo outside period", "no route-wide row; day card intact");
    } finally {
      await context.close();
    }
  }

  // ── H. Phase 3D separation ──────────────────────────────────────────────────────────────────
  {
    const { context, page } = await bootPlanner(makeDraft([["JP-044", "JP-019"]], "2027-02-20"), "2027-01-09");
    try {
      await calendar(page).waitFor();
      // The Phase 3F calendar lives in the days view and nowhere else.
      assert.equal(await page.locator(".reservation-prep").count(), 0);
      assert.equal(
        await page.locator(".official-reservation-calendar .reservation-prep").count(),
        0
      );
      // Phase 3D-H's own per-day surface still renders, separately, with its own copy.
      const deadline = page.locator(".reservation-deadline");
      await deadline.first().waitFor();
      assert.match(await deadline.first().innerText(), /ventana de anticipación registrada/i);
      assert.equal(
        await page.locator(".official-reservation-calendar .reservation-deadline").count(),
        0
      );

      // Back in the builder view, Phase 3D's route-wide list is unchanged and the calendar is absent.
      await page.getByRole("button", { name: /Volver al recorrido/ }).first().click();
      await page.getByRole("button", { name: /Distribuir por días/ }).waitFor();
      const prep = page.locator(".reservation-prep");
      await prep.waitFor();
      const prepText = await prep.innerText();
      assert.match(prepText, /Reservas por preparar/);
      assert.match(prepText, /No calcula fechas límite de reserva ni las compara con tu calendario/);
      assert.equal(await calendar(page).count(), 0);
      record("H. Phase 3D separation", "prep in builder, calendar in days");
    } finally {
      await context.close();
    }
  }

  // ── I. move a place between days, J. change the start date, L. clear it, M. reload ──────────
  {
    const { context, page } = await bootPlanner(
      makeDraft([["JP-203"], ["JP-019"]], "2027-02-20"),
      "2027-01-09"
    );
    try {
      await calendar(page).waitFor();
      assert.deepEqual(await anchorOrder(page), ["dom, 20 dic 2026"]);
      assert.match((await contextOrder(page))[0], /Tokyo Disneyland · Día 1 · visita .*20 feb 2027/);

      // I. move it to Día 2 → day number, visit date and derived official date all recompute.
      await page.getByRole("button", { name: "Mover Tokyo Disneyland al día siguiente" }).click();
      await page.waitForFunction(() => {
        const stored = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null");
        return stored?.days?.[1]?.placeIds?.includes("JP-203") === true;
      });
      assert.deepEqual(await anchorOrder(page), ["lun, 21 dic 2026"]);
      assert.match((await contextOrder(page))[0], /Tokyo Disneyland · Día 2 · visita .*21 feb 2027/);
      record("I. move place between days", "Día, visit date and anchor recompute");

      // J. change the start date → every anchor recomputes.
      await page.getByLabel("Fecha de inicio (Día 1)").fill("2027-03-14");
      await page.waitForFunction(
        () =>
          document.querySelector(".official-reservation-calendar__anchor")?.textContent?.includes(
            "15 ene 2027"
          ) === true
      );
      assert.match((await contextOrder(page))[0], /Tokyo Disneyland · Día 2 · visita .*15 mar 2027/);
      record("J. start-date change", "all anchors recompute");

      // L. clear the start date → the whole route-wide section disappears.
      await page.getByLabel("Fecha de inicio (Día 1)").fill("");
      await page.waitForFunction(
        () => document.querySelectorAll(".official-reservation-calendar").length === 0
      );
      assert.equal(await rows(page).count(), 0);
      record("L. clear start date", "entire section absent");

      // M. nothing derived was ever persisted, and a reload brings none of it back.
      const persisted = await page.evaluate(
        () => localStorage.getItem("nihon.manualPlanningDraft") ?? ""
      );
      for (const forbidden of [
        "anchorDate",
        "chronological",
        "application-date-span",
        "spanText",
        "referenceDate",
        "relation",
        "2026-12-20",
        "2027-01-15",
      ]) {
        assert.ok(!persisted.includes(forbidden), `Phase 3F-J state persisted: ${forbidden}`);
      }
      await page.reload({ waitUntil: "networkidle" });
      await enterPlanner(page);
      assert.equal(await calendar(page).count(), 0);
      const reloaded = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null")
      );
      assert.equal(reloaded.startDate, null);
      assert.equal(reloaded.version, 7);
      record("M. reload", "no stale aggregate, order or relation");
    } finally {
      await context.close();
    }
  }

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3F-J browser audit PASS");
  for (const line of results) console.log(line);
  console.log("  console errors                        :", consoleErrors.length);
  console.log("  page errors                           :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
