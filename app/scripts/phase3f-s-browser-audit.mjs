import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Phase 3F-S — executable browser acceptance for same-scope purchase-context composition.
 *
 * The existing Phase 3F-F/H/J audits never route through JP-050, so the visible behaviour this
 * phase actually changes — two active records sharing one `placeId + scope` rendering as two
 * independent rows — had no browser proof. This audit supplies exactly that and nothing else.
 *
 * Determinism contract is the one Phase 3F-H established: the BROWSER's local calendar date is
 * fixed before boot with a test-only `addInitScript` Date shim. No production test-date prop, query
 * parameter, localStorage field or planning-draft field exists.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const emptyBoundary = { start: { kind: "unselected" }, end: { kind: "unselected" } };

const POKEPARK = "JP-050";
const POKEPARK_NAME = "PokéPark KANTO";
const GHIBLI = "JP-044";

const OUTSIDE_JAPAN_COPY =
  "La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra.";
const IN_JAPAN_COPY =
  "La fuente oficial citada presenta esta ruta de compra para residentes en Japón.";

/** Copy that would turn route evidence into a personal applicability or preference claim. */
const FORBIDDEN_COPY = [
  /aplica para ti/i,
  /no aplica para ti/i,
  /eres residente/i,
  /no eres residente/i,
  /eres elegible/i,
  /no eres elegible/i,
  /puedes comprar/i,
  /no puedes comprar/i,
  /para ti/i,
  /recomendad/i,
  /recomendamos/i,
  /ruta principal/i,
  /ruta alternativa/i,
  /opci[óo]n preferida/i,
  /mejor opci[óo]n/i,
  /duplicad/i,
];
// `prioridad`/`urgencia` are deliberately NOT listed: the route-wide disclaimer legitimately says
// the chronological order indicates neither. The Phase 3F-J audit already gates that copy with the
// precise negative lookahead it needs.

function makeDraft(dayGroups, startDate) {
  const routeIds = dayGroups.flat();
  return {
    version: 7,
    routeIds,
    days: dayGroups.map((placeIds, index) => ({
      id: `phase-3f-s-day-${index + 1}`,
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

/** Identical mechanism to the Phase 3F-H/J audits: only zero-argument `new Date()` and `Date.now()`
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

const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase3f-s-vite-"));
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

  function assertNoForbiddenCopy(text, label) {
    for (const forbidden of FORBIDDEN_COPY) {
      assert.doesNotMatch(text, forbidden, `${label}: forbidden copy ${forbidden}`);
    }
  }

  function record(name, detail) {
    results.push(`  ${name.padEnd(40)}: pass${detail ? ` (${detail})` : ""}`);
  }

  // PokéPark on day 1, Ghibli on day 2 so the route-wide section has a second place to order against.
  const plan = () => makeDraft([[POKEPARK], [GHIBLI]], "2027-03-15");

  // ── A. per-day surface renders one article per record, in source-record order ──
  {
    const { context, page } = await bootPlanner(plan(), "2026-12-05");
    try {
      const notice = page.locator(".official-reservation-date").first();
      await notice.waitFor();
      const items = notice.locator(".official-reservation-date__item");
      assert.equal(await items.count(), 2, "JP-050 must render one article per active record");

      const names = await notice.locator(".official-reservation-date__name").allInnerTexts();
      assert.deepEqual(names, [POKEPARK_NAME, POKEPARK_NAME]);
      const scopes = await notice.locator(".official-reservation-date__scope").allInnerTexts();
      assert.deepEqual(scopes, ["Entrada general", "Entrada general"]);
      record("A. per-day one article per record", "2 articles, same place and scope");

      // Each article carries its own residence-context line, in catalog order.
      const contexts = await notice
        .locator(".official-reservation-date__purchase-residence-context")
        .allInnerTexts();
      assert.deepEqual(contexts, [OUTSIDE_JAPAN_COPY, IN_JAPAN_COPY]);
      record("B. distinct residence-context lines", "outside-Japan then in-Japan");

      // Each article links to its own official source: nothing is shared or collapsed.
      const sources = await notice.locator(".official-reservation-date__source").evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("href"))
      );
      assert.deepEqual(sources, [
        "https://ticket-en.pokepark-kanto.co.jp/?viewLang=en",
        "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index",
      ]);
      record("C. record-local source links", "two distinct official URLs");

      // Identical official dates on both articles, rendered twice rather than deduplicated.
      const details = await notice.locator(".official-reservation-date__detail").allInnerTexts();
      const withOpen = details.filter((text) => text.includes("1 dic 2026"));
      assert.equal(withOpen.length, 2, "both records must show their own recorded open edge");
      assert.ok(details.every((text) => !text.includes("zona horaria no registrada")));
      record("D. identical dates rendered twice", "no per-day deduplication");

      // Phase 3F-H relations are composed per record, not shared.
      const relations = await notice
        .locator(".official-reservation-date__reference-relation")
        .allInnerTexts();
      assert.equal(relations.length, 2);
      for (const relation of relations) {
        assert.match(relation, /cae dentro del tramo de fechas registrado para la solicitud\./);
      }
      record("E. per-record temporal relation", "2 relations, both record-local");

      const noticeText = await notice.innerText();
      assertNoForbiddenCopy(noticeText, "per-day surface");
      record("F. no personalized or ranking copy", "per-day surface");
    } finally {
      await context.close();
    }
  }

  // ── G. route-wide calendar emits both rows on one identical anchor date ──
  {
    const { context, page } = await bootPlanner(plan(), "2026-12-05");
    try {
      const calendar = page.locator(".official-reservation-calendar");
      await calendar.waitFor();
      assert.equal(await calendar.count(), 1, "route-wide section must render exactly once");

      const pokeparkRows = calendar
        .locator(".official-reservation-calendar__item")
        .filter({ hasText: POKEPARK_NAME });
      assert.equal(await pokeparkRows.count(), 2, "both JP-050 records must emit a row");

      const anchors = await pokeparkRows
        .locator(".official-reservation-calendar__anchor")
        .allInnerTexts();
      assert.equal(anchors.length, 2);
      assert.equal(anchors[0], anchors[1], "the two rows must share one anchor date");
      assert.match(anchors[0], /1 dic 2026/);
      record("G. two route-wide rows", `identical anchor ${anchors[0]}`);

      // Same place, same day, same visit date on both rows — still two rows.
      const rowContexts = await pokeparkRows
        .locator(".official-reservation-calendar__context")
        .allInnerTexts();
      assert.equal(rowContexts.length, 2);
      assert.equal(rowContexts[0], rowContexts[1]);
      assert.match(rowContexts[0], /PokéPark KANTO · Día 1 · visita .*15 mar 2027/);
      record("H. identical anchors not deduplicated", "same place, day and visit date");

      const rowResidence = await pokeparkRows
        .locator(".official-reservation-calendar__purchase-residence-context")
        .allInnerTexts();
      assert.deepEqual(rowResidence, [OUTSIDE_JAPAN_COPY, IN_JAPAN_COPY]);
      record("I. route-wide residence context", "one line per row, catalog order");

      const rowSources = await pokeparkRows
        .locator(".official-reservation-calendar__source")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
      assert.deepEqual(rowSources, [
        "https://ticket-en.pokepark-kanto.co.jp/?viewLang=en",
        "https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index",
      ]);
      record("J. route-wide source links", "two distinct official URLs");

      // The whole section: Ghibli's single row plus PokéPark's pair, ordered by anchor date only.
      const allAnchors = await calendar
        .locator(".official-reservation-calendar__anchor")
        .allInnerTexts();
      assert.equal(allAnchors.length, 3);
      assert.deepEqual(allAnchors.slice(0, 2), [anchors[0], anchors[1]]);
      assert.match(allAnchors[2], /10 feb 2027/);
      record("K. comparator unchanged", "anchor date orders the pair ahead of Ghibli");

      // No badge, tag, grouping header or count was introduced for the same-scope pair.
      const sectionText = await calendar.innerText();
      assertNoForbiddenCopy(sectionText, "route-wide surface");
      for (const forbidden of [
        "__badge",
        "__group",
        "__route-kind",
        "__same-scope",
        "__duplicate",
        "__variant",
      ]) {
        assert.equal(
          await calendar.locator(`[class*="${forbidden}"]`).count(),
          0,
          `route-wide surface introduced ${forbidden}`
        );
      }
      record("L. no new UI taxonomy", "no badge, group or variant class");

      // Nothing about the pair is persisted.
      const persisted = await page.evaluate(() =>
        localStorage.getItem("nihon.manualPlanningDraft") ?? ""
      );
      for (const forbidden of [
        "RM-JP-050-001",
        "RM-JP-050-002",
        "purchaseResidenceContext",
        "resides-in-japan",
        "resides-outside-japan",
        "anchorDate",
      ]) {
        assert.ok(!persisted.includes(forbidden), `Phase 3F-S state persisted: ${forbidden}`);
      }
      record("M. no new persistence", "planning draft unchanged");
    } finally {
      await context.close();
    }
  }

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("Phase 3F-S browser audit PASS");
  for (const line of results) console.log(line);
  console.log("  console errors                          :", consoleErrors.length);
  console.log("  page errors                             :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
