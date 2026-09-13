import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3F-H — executable browser acceptance for the official reservation reference-date relation.
 *
 * Run this script twice consecutively after the final code change.
 *
 * Determinism contract (Phase 3F-G §8.1): every relation scenario fixes the BROWSER's local
 * calendar date before the application boots, so a result never depends on the real date of the
 * machine running Playwright. The mechanism is a test-only `addInitScript` `Date` shim installed in
 * the page context; production `captureDeviceLocalCivilDate` is unchanged and still runs for real,
 * reading `new Date()` through local calendar getters exactly as it does for a real user. No
 * production test-date prop, query parameter, localStorage field or planning-draft field exists.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const emptyBoundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };

function makeDraft(routeIds, dayGroups, startDate) {
  return {
    version: 7,
    routeIds,
    days: dayGroups.map((placeIds, index) => ({
      id: `phase-3f-h-day-${index + 1}`,
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

/**
 * Installed before ANY page script runs. `new Date()` with no arguments and `Date.now()` resolve to
 * local noon on the requested civil date; every other `Date` behaviour (explicit arguments,
 * `Date.UTC`, `Date.parse`, the prototype, calling `Date()` as a function) is forwarded untouched,
 * so `civil-date.ts`'s UTC arithmetic keeps working normally.
 */
function fixBrowserCivilDate([year, month, day]) {
  const OriginalDate = Date;
  // Local noon keeps the civil date unambiguous under any browser timezone or DST transition.
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
  /venta abierta/i,
  /venta cerrada/i,
  /reservas abiertas/i,
  /reservas cerradas/i,
  /ya abrió/i,
  /todav[íi]a no abre/i,
  /abre hoy/i,
  /cierra hoy/i,
  /[úu]ltimo d[íi]a/i,
  /ya puedes comprar/i,
  /todav[íi]a puedes reservar/i,
  /reserva ahora/i,
  /compra ahora/i,
  /[úu]ltima oportunidad/i,
  /fecha l[íi]mite/i,
  /deadline/i,
  /agotado/i,
  /quedan boletos/i,
  /d[íi]as restantes/i,
  /horas restantes/i,
  /urgente/i,
  /est[áa]s tarde/i,
  /aplicaciones abiertas/i,
  /solicitudes abiertas/i,
];

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3f-h-vite-"));
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

  /** `referenceCivilDate` is `YYYY-MM-DD` and is the ONLY source of the browser's calendar date. */
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

    // The shim must be in force before React captured anything, and it must not have been
    // implemented by weakening the production local-calendar contract.
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

  const readDraft = (page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));

  const officialItemFor = (page, placeName) =>
    page.locator(".official-reservation-date__item").filter({ hasText: placeName });

  function assertNoForbiddenCopy(text, label) {
    for (const forbidden of FORBIDDEN_COPY) {
      assert.doesNotMatch(text, forbidden, `${label}: forbidden copy ${forbidden}`);
    }
  }

  function record(name, detail) {
    results.push(`  ${name.padEnd(36)}: pass${detail ? ` (${detail})` : ""}`);
  }

  // ── Scenario A — Ghibli, reference day before the recorded release date ──────────────────────
  // Also covers Scenario I: the Phase 3D-H and Phase 3F relations coexist as separate surfaces.
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-044", "JP-019"], [["JP-044", "JP-019"]], "2027-02-20"),
      "2027-01-09"
    );
    try {
      const item = officialItemFor(page, "Ghibli Museum, Mitaka");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /10 ene 2027/);
      assert.match(
        text,
        /La fecha de referencia del dispositivo está antes de la fecha oficial registrada\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*9 ene 2027/);
      assertNoForbiddenCopy(text, "Scenario A");

      // Scenario I — both reference-date surfaces are visible, independent and never combined.
      const day = page.locator(".day-card").first();
      await day.locator(".reservation-deadline").waitFor();
      await day.locator(".official-reservation-date").waitFor();
      assert.equal(await day.locator(".reservation-deadline__reference-relation").count() > 0, true);
      assert.equal(
        await day.locator(".official-reservation-date__reference-relation").count() > 0,
        true
      );
      assert.equal(
        await day.locator(".official-reservation-date .reservation-deadline__reference-relation").count(),
        0
      );
      assert.equal(
        await day.locator(".reservation-deadline .official-reservation-date__reference-relation").count(),
        0
      );
      const editorial = await day.locator(".reservation-deadline__reference-relation").first().innerText();
      assert.match(editorial, /ventana de anticipación registrada/);
      assert.doesNotMatch(editorial, /fecha oficial registrada/);
      record("A. Ghibli before", "ref 2027-01-09");
      record("I. Phase 3D/3F coexistence", "separate surfaces");
    } finally {
      await context.close();
    }
  }

  // ── Scenario B — Ghibli, reference day IS the recorded release date ─────────────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-044", "JP-019"], [["JP-044", "JP-019"]], "2027-02-20"),
      "2027-01-10"
    );
    try {
      const item = officialItemFor(page, "Ghibli Museum, Mitaka");
      await item.waitFor();
      const text = await item.innerText();
      // The recorded clock time and timezone stay visible as evidence …
      assert.match(text, /10 ene 2027/);
      assert.match(text, /10:00 \(Asia\/Tokyo\)/);
      // … but the relation says only that the civil dates coincide.
      assert.match(
        text,
        /La fecha de referencia del dispositivo coincide con la fecha oficial registrada\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*10 ene 2027/);
      assert.doesNotMatch(text, /antes de la fecha oficial/);
      assert.doesNotMatch(text, /después de la fecha oficial/);
      assertNoForbiddenCopy(text, "Scenario B");
      record("B. Ghibli same recorded date", "ref 2027-01-10, 10:00 Asia/Tokyo intact");
    } finally {
      await context.close();
    }
  }

  // ── Scenario C — Ghibli, reference day after the recorded release date ──────────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-044", "JP-019"], [["JP-044", "JP-019"]], "2027-02-20"),
      "2027-01-11"
    );
    try {
      const item = officialItemFor(page, "Ghibli Museum, Mitaka");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(
        text,
        /La fecha de referencia del dispositivo está después de la fecha oficial registrada\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*11 ene 2027/);
      assertNoForbiddenCopy(text, "Scenario C");
      record("C. Ghibli after", "ref 2027-01-11");
    } finally {
      await context.close();
    }
  }

  // ── Scenario D — Disneyland same recorded date with an unknown source timezone ──────────────
  // Also covers Scenario J (day reassignment recomputes) and Scenario K (clear + reload).
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-203", "JP-019"], [["JP-203"], ["JP-019"]], "2027-02-20"),
      "2026-12-20"
    );
    try {
      let item = officialItemFor(page, "Tokyo Disneyland");
      await item.waitFor();
      let text = await item.innerText();
      assert.match(text, /20 dic 2026/);
      assert.match(text, /14:00/);
      assert.match(text, /zona horaria no registrada/i);
      assert.doesNotMatch(text, /Asia\/Tokyo|JST|UTC\+9/i);
      assert.match(
        text,
        /La fecha de referencia del dispositivo coincide con la fecha oficial registrada\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*20 dic 2026/);
      assertNoForbiddenCopy(text, "Scenario D");
      record("D. Disney null timezone same date", "ref 2026-12-20, no JST inference");

      // Scenario J — moving the place changes the visit date, so Phase 3F-D recomputes the official
      // release date and Phase 3F-H must re-relate the SAME explicit reference date to it.
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
      assert.doesNotMatch(text, /20 dic 2026 ·/);
      assert.match(
        text,
        /La fecha de referencia del dispositivo está antes de la fecha oficial registrada\./
      );
      // The reference date itself did not move — only the official fact did.
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*20 dic 2026/);
      assertNoForbiddenCopy(text, "Scenario J");
      record("J. reassignment recomputation", "same ref date, new official date");

      // Scenario K — clearing the trip start date removes every trip-specific official relation,
      // and a reload brings none back because nothing derived was ever persisted.
      await page.getByLabel("Fecha de inicio (Día 1)").fill("");
      await page.waitForFunction(
        () => document.querySelectorAll(".official-reservation-date").length === 0
      );
      assert.equal(await page.locator(".official-reservation-date__reference-relation").count(), 0);
      const persistedText = await page.evaluate(
        () => localStorage.getItem("nihon.manualPlanningDraft") ?? ""
      );
      for (const forbidden of [
        "referenceDate",
        "reservationReferenceDate",
        "recorded-release-date",
        "application-date-span",
        "releaseDate",
        "openDate",
        "closeDate",
        "not-assessed",
        "2026-12-20",
      ]) {
        assert.ok(
          !persistedText.includes(forbidden),
          `Phase 3F-H state persisted in the draft: ${forbidden}`
        );
      }
      await page.reload({ waitUntil: "networkidle" });
      await enterPlanner(page);
      assert.equal(await page.locator(".official-reservation-date").count(), 0);
      assert.equal(await page.locator(".official-reservation-date__reference-relation").count(), 0);
      const reloaded = await readDraft(page);
      assert.equal(reloaded.startDate, null);
      assert.equal(reloaded.version, 7);
      record("K. clear start date + reload", "no stale relation in UI or storage");
    } finally {
      await context.close();
    }
  }

  // ── Scenario E — Katsura, reference date exactly on the recorded open edge ──────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-077", "JP-019"], [["JP-077"], ["JP-019"]], "2027-03-15"),
      "2026-12-01"
    );
    try {
      const item = officialItemFor(page, "Katsura Imperial Villa");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Inicio: .*1 dic 2026.*05:00/s);
      assert.match(
        text,
        /La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*1 dic 2026/);
      assertNoForbiddenCopy(text, "Scenario E");
      record("E. Katsura open edge", "ref 2026-12-01, date-span only");
    } finally {
      await context.close();
    }
  }

  // ── Scenario F — Katsura, reference date exactly on the recorded close edge ─────────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-077", "JP-019"], [["JP-077"], ["JP-019"]], "2027-03-15"),
      "2027-03-12"
    );
    try {
      const item = officialItemFor(page, "Katsura Imperial Villa");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Fin registrado de la ventana: .*12 mar 2027.*23:59/s);
      assert.match(
        text,
        /La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud\./
      );
      assert.match(text, /Fecha de referencia \(tu dispositivo\):.*12 mar 2027/);
      assert.doesNotMatch(text, /después del tramo/);
      assertNoForbiddenCopy(text, "Scenario F");
      record("F. Katsura close edge", "ref 2027-03-12, no closing claim");
    } finally {
      await context.close();
    }
  }

  // ── Scenario G — Osaka Sumo inside the recorded event period ────────────────────────────────
  for (const [referenceDate, expected, label] of [
    ["2027-02-05", /está antes de la fecha oficial registrada\./, "before"],
    ["2027-02-06", /coincide con la fecha oficial registrada\./, "same date"],
  ]) {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-212", "JP-019"], [["JP-212"], ["JP-019"]], "2027-03-20"),
      referenceDate
    );
    try {
      const item = officialItemFor(page, "Grand Sumo Tournament Osaka 2027");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /Inicio de venta oficial registrado para este evento/);
      assert.match(text, /6 feb 2027/);
      assert.match(text, expected);
      assert.match(text, /Fecha de referencia \(tu dispositivo\):/);
      assert.doesNotMatch(text, /\b\d{2}:\d{2}\b/);
      assertNoForbiddenCopy(text, `Scenario G (${label})`);
      record(`G. Sumo applicable (${label})`, `ref ${referenceDate}`);
    } finally {
      await context.close();
    }
  }

  // ── Scenario H — Osaka Sumo outside the recorded event period stays unassessed ──────────────
  {
    const { context, page } = await bootPlanner(
      makeDraft(["JP-212", "JP-019"], [["JP-212"], ["JP-019"]], "2027-03-29"),
      "2027-02-06"
    );
    try {
      const item = officialItemFor(page, "Grand Sumo Tournament Osaka 2027");
      await item.waitFor();
      const text = await item.innerText();
      assert.match(text, /no aplica a la fecha de visita asignada/i);
      assert.match(text, /fuera del periodo del evento registrado/i);
      assert.doesNotMatch(text, /Fecha de referencia \(tu dispositivo\)/);
      assert.doesNotMatch(text, /fecha de referencia del dispositivo/i);
      assert.doesNotMatch(text, /6 feb 2027/);
      assert.equal(await item.locator(".official-reservation-date__reference-relation").count(), 0);
      assert.equal(await item.locator(".official-reservation-date__reference-date").count(), 0);
      assertNoForbiddenCopy(text, "Scenario H");
      record("H. Sumo not applicable", "no relation assessed");
    } finally {
      await context.close();
    }
  }

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3F-H browser audit PASS");
  for (const line of results) console.log(line);
  console.log("  console errors                      :", consoleErrors.length);
  console.log("  page errors                         :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
