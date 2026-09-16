import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Phase 5A — Nihon v1 Release Candidate browser audit.
 *
 * Unlike every earlier phase audit, this one runs against the **production build** via
 * `vite preview`, not the dev server: an RC gate must exercise the artifact that would ship,
 * including the real bundling, minification and asset paths. Run `npm run build` first.
 *
 * It exercises the five golden journeys of Issue #118 §5 end to end on a clean profile, at a
 * desktop and a mobile viewport, and records console errors, page errors and every external
 * network request for the runtime-integrity proof (§8).
 *
 * Determinism: the browser's civil date is fixed before boot with a test-only `addInitScript`
 * Date shim — the mechanism Phase 3F-H established. No production test-date prop, query
 * parameter, localStorage field or planning-draft field exists.
 *
 * Usage: node scripts/phase5a-rc-browser-audit.mjs [--viewport=desktop|mobile]
 */

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const viewportArg = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "--viewport=desktop")
  .split("=")[1];
assert.ok(VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const viewport = VIEWPORTS[viewportArg];
const isMobile = viewportArg === "mobile";

console.log(`Phase 5A RC browser audit — ${viewportArg} ${viewport.width}x${viewport.height}`);

const appRoot = fileURLToPath(new URL("..", import.meta.url));

const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64"
);

/** Photography providers that must never be contacted at runtime (Issue #118 §5 Journey E). */
const PHOTO_PROVIDER = /wikimedia|wikipedia|creativecommons|commons\.wikimedia/i;
/** Transit providers that must stay dormant for v1 (Issue #118 §8). */
const TRANSIT_PROVIDER = /ekispert|navitime|openrouteservice|ors\.|googleapis|mapbox/i;

const TRIP_START = "2027-02-20";

/** Only zero-argument `new Date()` and `Date.now()` are intercepted; explicit arguments,
 * `Date.UTC`, `Date.parse` and the prototype pass through unchanged. */
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

const server = await preview({
  root: appRoot,
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});

let browser;
const results = [];
const failures = [];
const externalRequests = [];

const record = (name, detail) =>
  results.push(`  ${name.padEnd(56)}: pass${detail ? ` (${detail})` : ""}`);

async function step(name, fn) {
  let line;
  try {
    const detail = await fn();
    record(name, detail);
    line = results[results.length - 1];
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    line = `  ${name.padEnd(56)}: FAIL (${error.message.split("\n")[0].slice(0, 160)})`;
    results.push(line);
  }
  // Streamed as it happens: a hung or failing step must be visible before the run ends.
  console.log(line);
}

try {
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "vite preview did not expose a local URL");

  browser = await chromium.launch({
    headless: true,
    ...(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}),
  });

  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // Every non-local request is recorded and stubbed. Stubbing also proves the core UI survives
  // an optional external resource (the OpenStreetMap tile layer) failing to render (§8).
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith("data:") || target.startsWith("blob:")) {
      return route.continue();
    }
    externalRequests.push(target);
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });

  await page.addInitScript(fixBrowserCivilDate, [2026, 9, 16]);

  // ---------------------------------------------------------------- helpers
  const detail = () => page.locator(".place-detail");
  /** The ordered-sequence builder renders inside the shared modal dialog. */
  const plannerDialog = () => page.locator(".analysis-dialog");

  async function openNational() {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
  }

  /**
   * Below the 861px desktop breakpoint the app is deliberately map-first: `.app__sidebar`
   * (search, filters and the place list) is `display: none` until the "Buscar y filtrar" toggle
   * opens it, and selecting a place closes it again. This opens the drawer when the viewport
   * needs it, so the same journey script drives both layouts.
   */
  async function ensurePlaceListVisible() {
    if (!isMobile) return;
    const sidebar = page.locator(".app__sidebar");
    if (await sidebar.first().isVisible().catch(() => false)) return;
    await page.getByRole("button", { name: /Buscar y filtrar/ }).first().click();
    await sidebar.first().waitFor({ state: "visible" });
  }

  async function enterHub(hub, prefecture) {
    await page.getByRole("button", { name: new RegExp(`^${prefecture}`) }).first().click();
    await page.getByRole("button", { name: new RegExp(`Explorar desde ${hub}`) }).first().click();
    // The "Buscar y filtrar" toggle only exists as a visible control below the desktop
    // breakpoint; on desktop the sidebar is always rendered.
    if (isMobile) await page.getByRole("button", { name: /Buscar y filtrar/ }).first().waitFor();
    await ensurePlaceListVisible();
    await page.locator(".place-list__item").first().waitFor();
  }

  /** Reaches a hub from a clean load, so a failing step cannot strand later steps in the
   * wrong hub. */
  async function gotoHub(hub, prefecture) {
    await page.goto(url, { waitUntil: "networkidle" });
    await enterHub(hub, prefecture);
  }

  /** On mobile the detail panel covers the drawer, so an open one is closed first. Escape is
   * the product's own documented dismissal (`PlaceDetail.tsx` binds it), which also exercises
   * that binding on every place this audit opens. */
  async function closeDetailIfOpen() {
    if ((await detail().count()) === 0) return;
    await page.keyboard.press("Escape");
    await detail().waitFor({ state: "detached" }).catch(() => {});
  }

  async function openPlace(name) {
    await closeDetailIfOpen();
    await ensurePlaceListVisible();
    const item = page.locator(".place-list__item").filter({ hasText: name }).first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await detail().waitFor();
  }

  async function savePlace(name) {
    await openPlace(name);
    const button = detail().getByRole("button", { name: /Quiero ir|Guardado/ }).first();
    await button.scrollIntoViewIfNeeded();
    if ((await button.textContent())?.includes("Guardado")) return;
    await button.click();
  }

  /** Opens the planner's day-assignment view from any state. Reloading first makes the step
   * independent of whether a previous journey left the modal open. */
  async function openPlanner({ fresh = true } = {}) {
    if (fresh) await page.goto(url, { waitUntil: "networkidle" });
    else await closeDetailIfOpen();
    if ((await plannerDialog().count()) === 0) {
      await page.locator(".selection-panel__toggle").click();
      await page.getByRole("button", { name: /Construir recorrido/ }).first().click();
    }
    const toDays = page.getByRole("button", { name: /Distribuir por días/ });
    if ((await toDays.count()) > 0) await toDays.first().click();
    await page.getByRole("heading", { name: "Día 1" }).waitFor();
  }

  /** Back from the day-assignment view to the ordered-route draft (where removal lives). */
  async function openRouteView() {
    await openPlanner();
    await page.getByRole("button", { name: /Volver al recorrido/ }).first().click();
    await page.locator(".sequence-list").first().waitFor();
  }

  /**
   * Puts the profile into a known planning state. Clearing the draft matters: `reconcileDraft`
   * correctly prunes a stored route to the places that are still saved and never auto-appends
   * newly saved ones, so reusing a previous journey's draft would leave a one-place route and no
   * day-assignment affordance (which needs two).
   */
  async function seedPlan(placeIds) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate((ids) => {
      localStorage.removeItem("nihon.manualPlanningDraft");
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(ids));
    }, placeIds);
  }

  const readSaved = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.savedPlaceIds") ?? "[]"));
  const readDraft = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "null"));

  // ======================================================= JOURNEY A
  await openNational();

  await step("A01 national explorer renders", async () => {
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    assert.match(heading, /Nihon/);
    const regions = await page.locator(".region-nav__item").count();
    assert.ok(regions >= 9, `expected >=9 regions, got ${regions}`);
    return `${regions} regions`;
  });

  await step("A02 national summary counts match catalogue", async () => {
    const body = await page.locator("body").textContent();
    assert.ok(body.includes("214"), "national summary should surface the 214-place catalogue");
    return "214 places surfaced";
  });

  await step("A03 region -> prefecture -> hub navigation", async () => {
    await enterHub("Tokio", "Tokio");
    const count = await page.locator(".place-list__item").count();
    assert.ok(count > 0, "hub list empty");
    return `${count} Tokio places`;
  });

  await step("A04 free-text search filters the list", async () => {
    await ensurePlaceListVisible();
    const before = await page.locator(".place-list__item").count();
    const search = page.getByRole("searchbox").or(page.locator("input[type=search]")).first();
    await search.fill("Shibuya");
    await page.waitForTimeout(150);
    const after = await page.locator(".place-list__item").count();
    assert.ok(after < before && after > 0, `search did not narrow: ${before} -> ${after}`);
    await search.fill("");
    await page.waitForTimeout(150);
    const restored = await page.locator(".place-list__item").count();
    assert.equal(restored, before, "clearing search did not restore the list");
    return `${before} -> ${after} -> ${restored}`;
  });

  /** Checked on every hub that holds a place of each grade, not just the first hub visited:
   * Tokio contains no grade-D place, so a Tokio-only check cannot see a missing-grade defect. */
  await step("A05 grade filter offers every grade present in the hub", async () => {
    const report = [];
    for (const [hub, prefecture] of [["Tokio", "Tokio"], ["Osaka", "Osaka"], ["Kioto", "Kioto"]]) {
      await gotoHub(hub, prefecture);
      await ensurePlaceListVisible();
      const offered = await page.locator(".filter-chip--grade span").allTextContents();
      const gradesInHub = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll(".place-list__grade")].map((n) => n.textContent.trim()))]
      );
      const missing = gradesInHub.filter((g) => !offered.includes(g));
      assert.deepEqual(missing, [],
        `${hub}: grades present in the place list but not offered as filters: ${missing}`);
      report.push(`${hub}:${offered.join("")}`);
    }
    return report.join(" ");
  });

  await step("A06 place detail shows photograph and attribution", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const img = detail().locator(".gallery__image");
    await img.waitFor();
    const src = await img.getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `expected local asset, got ${src}`);
    const loaded = await img.evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(loaded, "gallery image did not decode");
    const alt = await img.getAttribute("alt");
    assert.ok(alt && alt.trim().length > 0, "gallery image missing alt text");
    const credit = detail().locator(".gallery__credit");
    await credit.waitFor();
    assert.ok(await credit.getByRole("link", { name: "Wikimedia Commons" }).count(),
      "missing Commons source link");
    return "local asset + credit + alt";
  });

  await step("A07 no-photo place shows the documented fallback", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Takeshita Street"); // JP-004, grade C, uncovered
    const body = await detail().textContent();
    assert.match(body, /Sin fotograf[íi]a disponible todav[íi]a/i);
    assert.equal(await detail().locator(".gallery__image").count(), 0,
      "uncovered place must not render an image");
    return "fallback rendered";
  });

  await step("A08 save places across two hubs", async () => {
    await gotoHub("Tokio", "Tokio");
    for (const name of ["Shibuya Crossing", "SHIBUYA SKY", "Meiji Jingu"]) await savePlace(name);
    await gotoHub("Kioto", "Kioto");
    for (const name of ["Nanzen-ji", "Ginkaku-ji"]) await savePlace(name);
    const saved = await readSaved();
    assert.equal(saved.length, 5, `expected 5 saved, got ${saved.length}`);
    return saved.join(",");
  });

  await step("A09 saved selection lists every saved place", async () => {
    await closeDetailIfOpen();
    await page.locator(".selection-panel__toggle").click();
    const rows = await page.locator(".selection-panel__content li").count();
    assert.ok(rows >= 5, `expected >=5 rows, got ${rows}`);
    await page.locator(".selection-panel__toggle").click();
    return `${rows} rows`;
  });

  await step("A10 build ordered sequence and assign days", async () => {
    await openPlanner();
    const days = await page.getByRole("heading", { name: /^Día \d+$/ }).count();
    assert.ok(days >= 1, "no days rendered");
    const draft = await readDraft();
    assert.equal(draft.routeIds.length, 5, `draft should carry 5 places, got ${draft.routeIds.length}`);
    return `${days} day(s), ${draft.routeIds.length} places`;
  });

  await step("A11 anchor Day 1 to a civil date", async () => {
    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(200);
    const draft = await readDraft();
    assert.equal(draft.startDate, TRIP_START, `startDate not persisted: ${draft.startDate}`);
    const body = await plannerDialog().textContent();
    assert.ok(/2027/.test(body), "anchored year not surfaced");
    return TRIP_START;
  });

  /** Proves the Day 1 label is *derived* from the anchor rather than a fixed string: the
   * expectation is computed with the same Intl contract `formatCivilDateDisplay` uses, and the
   * anchor is then moved by one day and re-checked. */
  await step("A12 calendar weekday composes correctly from Day 1", async () => {
    const expected = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Intl.DateTimeFormat("es", {
        weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, d)));
    };
    const saturday = await plannerDialog().textContent();
    assert.ok(saturday.includes(expected(TRIP_START)),
      `Day 1 did not render "${expected(TRIP_START)}" for anchor ${TRIP_START}`);

    const nextDay = "2027-02-21";
    await page.locator("#sequence-start-date").fill(nextDay);
    await page.waitForTimeout(250);
    const sunday = await plannerDialog().textContent();
    assert.ok(sunday.includes(expected(nextDay)),
      `re-anchoring to ${nextDay} did not recompose the weekday to "${expected(nextDay)}"`);
    assert.ok(!sunday.includes(expected(TRIP_START)),
      "the previous anchor's Day 1 label survived a re-anchor");

    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(250);
    return `${expected(TRIP_START)} -> ${expected(nextDay)} -> ${expected(TRIP_START)}`;
  });

  await step("A13 set a supported manual visit start time", async () => {
    const input = page.locator("input[id^='visit-start-time-']").first();
    if ((await input.count()) === 0) return "no eligible recorded-interval place in this plan";
    const id = await input.getAttribute("id");
    await input.fill("10:00");
    await page.waitForTimeout(200);
    const draft = await readDraft();
    const values = Object.values(draft.visitStartTimes ?? {});
    assert.ok(values.includes("10:00"), `visit start time not persisted: ${JSON.stringify(draft.visitStartTimes)}`);
    return id;
  });

  /** Journey A step 12 and Issue #118 §11: the route spans Tokio then Kioto, so the boundary
   * between them is the one consecutive pair the manual inter-hub form should offer. */
  await step("A13b add a manual inter-hub segment across the hub boundary", async () => {
    const section = page.locator(".inter-hub-segments");
    await section.first().waitFor();
    const positionSelect = section.locator("select").first();
    const options = await positionSelect.locator("option").allTextContents();
    const pair = options.find((o) => !/Selecciona/.test(o));
    assert.ok(pair, `no inter-hub pair offered; options were ${JSON.stringify(options)}`);
    await positionSelect.selectOption({ label: pair });
    await section.locator("select").nth(1).selectOption({ label: "Shinkansen" });
    await section.locator("input[type=number]").first().fill("140");
    await section.getByRole("button", { name: /Añadir tramo/ }).click();
    await page.waitForTimeout(300);
    const draft = await readDraft();
    assert.equal(draft.interHubSegments.length, 1,
      `expected one inter-hub segment, got ${draft.interHubSegments.length}`);
    const segment = draft.interHubSegments[0];
    const route = new Set(draft.routeIds);
    assert.ok(route.has(segment.fromPlaceId) && route.has(segment.toPlaceId),
      "inter-hub segment references a place outside the route");
    assert.equal(segment.minutes, 140, `segment minutes not persisted: ${segment.minutes}`);
    const rendered = await section.first().textContent();
    assert.match(rendered, /140 min registrados manualmente/,
      "the manual segment duration is not labelled as manually recorded");
    return `${pair} · Shinkansen · 140 min`;
  });

  await step("A14 whole-trip composition renders and reconciles", async () => {
    const summary = page.locator(".whole-trip-composition");
    await summary.first().waitFor();
    const text = await summary.first().textContent();
    assert.ok(text.trim().length > 0, "composition summary empty");
    return "composition present";
  });

  await step("A15 reload reproduces persisted state", async () => {
    const before = await readDraft();
    const savedBefore = await readSaved();
    await page.reload({ waitUntil: "networkidle" });
    const after = await readDraft();
    const savedAfter = await readSaved();
    assert.deepEqual(savedAfter, savedBefore, "saved places changed across reload");
    assert.equal(after.startDate, before.startDate, "anchor lost across reload");
    assert.deepEqual(after.routeIds, before.routeIds, "route changed across reload");
    assert.deepEqual(after.visitStartTimes, before.visitStartTimes, "visit times changed across reload");
    assert.deepEqual(after.interHubSegments, before.interHubSegments,
      "inter-hub segments changed across reload");
    return `${savedAfter.length} saved, anchor ${after.startDate}, ${after.interHubSegments.length} segment(s)`;
  });

  // ======================================================= JOURNEY B
  await step("B01 reorder a place within its day", async () => {
    await openPlanner();
    const before = (await readDraft()).days.map((d) => d.placeIds.join("|")).join(" / ");
    const down = page
      .getByRole("button", { name: /Mover .+ hacia abajo en Día \d+/ })
      .and(page.locator("button:not([disabled])"))
      .first();
    assert.ok(await down.count(), "no enabled in-day reorder control");
    await down.click();
    await page.waitForTimeout(200);
    const after = (await readDraft()).days.map((d) => d.placeIds.join("|")).join(" / ");
    assert.notEqual(after, before, "reorder did not change the draft");
    return "order changed";
  });

  await step("B02 reorder preserves membership exactly", async () => {
    const draft = await readDraft();
    const inDays = draft.days.flatMap((d) => d.placeIds).sort();
    const route = [...draft.routeIds].sort();
    assert.deepEqual(inDays, route, "day membership diverged from routeIds after reorder");
    assert.equal(new Set(inDays).size, inDays.length, "a place is assigned to more than one day");
    return `${inDays.length} places, no duplicates`;
  });

  await step("B03 stable day identity survives add-day and cross-day move", async () => {
    const before = (await readDraft()).days.map((d) => d.id);
    await page.getByRole("button", { name: /Añadir día/ }).first().click();
    await page.waitForTimeout(200);
    const withNewDay = (await readDraft()).days.map((d) => d.id);
    assert.deepEqual(withNewDay.slice(0, before.length), before,
      "adding a day regenerated the existing day IDs");
    const mover = page.getByRole("button", { name: /Mover .* al día siguiente/ }).first();
    assert.ok(await mover.count(), "no cross-day move control after adding a second day");
    await mover.click();
    await page.waitForTimeout(250);
    const after = (await readDraft()).days.map((d) => d.id);
    assert.deepEqual(after, withNewDay, "a cross-day move regenerated day IDs");
    const moved = (await readDraft()).days[1].placeIds;
    assert.ok(moved.length > 0, "cross-day move did not land a place in Día 2");
    return `${after.length} stable day ids, Día 2 holds ${moved.length}`;
  });

  await step("B04 no orphaned visit time after moving a place", async () => {
    const draft = await readDraft();
    const assigned = new Set(draft.days.flatMap((d) => d.placeIds));
    const orphans = Object.keys(draft.visitStartTimes ?? {}).filter((id) => !assigned.has(id));
    assert.deepEqual(orphans, [], `visit times left attached to unassigned places: ${orphans}`);
    return "no orphans";
  });

  /**
   * `lib/planning-draft.ts::withRoute` documents the contract this asserts: a pure reorder keeps
   * the day assignment, but ANY change to the set of places invalidates it (`days: null`) rather
   * than inventing which day a new place belongs to or repairing a day missing a removed one.
   * What matters for release is that nothing stale survives that reset.
   */
  await step("B05 removing a place leaves no stale dependent state", async () => {
    await openRouteView();
    const before = await readDraft();
    const removedName = await page
      .getByRole("button", { name: /Quitar .+ del recorrido/ })
      .first()
      .getAttribute("aria-label");
    const remove = page.getByRole("button", { name: /Quitar .+ del recorrido/ }).first();
    assert.ok(await remove.count(), "no removal control in the route view");
    await remove.click();
    await page.waitForTimeout(300);
    const draft = await readDraft();
    assert.equal(draft.routeIds.length, before.routeIds.length - 1, "route length did not shrink by one");
    const route = new Set(draft.routeIds);
    const assigned = draft.days === null ? route : new Set(draft.days.flatMap((d) => d.placeIds));
    assert.deepEqual([...assigned].filter((id) => !route.has(id)), [],
      "a day still references a place no longer in the route");
    const orphanTimes = Object.keys(draft.visitStartTimes ?? {}).filter((id) => !route.has(id));
    assert.deepEqual(orphanTimes, [], `stale visit times after removal: ${orphanTimes}`);
    const orphanSegments = (draft.interHubSegments ?? []).filter(
      (seg) => !route.has(seg.fromPlaceId) || !route.has(seg.toPlaceId)
    );
    assert.deepEqual(orphanSegments, [], "stale inter-hub segment after removal");
    const orphanLegs = (draft.accommodationLegs ?? []).filter((leg) => !route.has(leg.placeId));
    assert.deepEqual(orphanLegs, [], "stale accommodation leg after removal");
    return `${removedName ?? "a place"} removed; days ${draft.days === null ? "invalidated per contract" : "retained"}, no stale refs`;
  });

  await step("B06 edits survive reload", async () => {
    const before = await readDraft();
    await page.reload({ waitUntil: "networkidle" });
    const after = await readDraft();
    assert.deepEqual(after.routeIds, before.routeIds, "route changed across reload");
    assert.deepEqual(
      after.days === null ? null : after.days.map((d) => d.id),
      before.days === null ? null : before.days.map((d) => d.id),
      "day ids changed across reload"
    );
    return `route ${after.routeIds.length}, days ${after.days === null ? "null" : after.days.length}`;
  });

  // ======================================================= JOURNEY C
  await step("C01 reservation mechanism surfaces for a catalogue entry", async () => {
    await seedPlan(["JP-044", "JP-050", "JP-001"]);
    await openPlanner();
    await page.locator("#sequence-start-date").fill(TRIP_START);
    await page.waitForTimeout(300);
    const body = await plannerDialog().textContent();
    assert.match(body, /Reservas por preparar|Fechas de reserva/,
      "no reservation surface for a plan containing JP-044");
    return "reservation surface present";
  });

  await step("C02 route-wide reservation calendar renders without duplicates", async () => {
    const calendar = page.locator("[aria-labelledby='official-reservation-calendar-heading']");
    if ((await calendar.count()) === 0) return "calendar not applicable to this plan";
    const rows = await calendar.locator("li").allTextContents();
    const normalised = rows.map((r) => r.replace(/\s+/g, " ").trim()).filter(Boolean);
    assert.equal(new Set(normalised).size, normalised.length,
      `duplicate reservation calendar rows: ${normalised.length - new Set(normalised).size}`);
    return `${normalised.length} unique rows`;
  });

  await step("C03 reservation dates derive from the anchored trip date", async () => {
    const body = await plannerDialog().textContent();
    assert.ok(/2027/.test(body), "reservation surface does not reference the trip year");
    assert.ok(!/1970|Invalid Date|NaN/.test(body), "reservation surface leaked an invalid date");
    return "derived from 2027 anchor";
  });

  await step("C04 purchase/residence context is not invented", async () => {
    const body = await plannerDialog().textContent();
    for (const forbidden of [/aplica para ti/i, /eres residente/i, /puedes comprar/i, /recomendamos/i]) {
      assert.ok(!forbidden.test(body), `reservation copy made a personal claim: ${forbidden}`);
    }
    return "no personal applicability claims";
  });

  /** Issue #118 §10: recorded hours and closure signals must never be upgraded into a claim
   * that a place is open or closed on a given date. The product's own vocabulary is hedged
   * ("Posibles coincidencias…", "…; revisar"); this asserts no unhedged claim has crept in. */
  await step("C05 hours and closure signals do not overclaim open/closed status", async () => {
    const body = await plannerDialog().textContent();
    const overclaims = [
      /\bestar[áa] abierto\b/i,
      /\bestar[áa] cerrado\b/i,
      /\babre a las\b/i,
      /\bcierra hoy\b/i,
      /\bconfirmado que abre\b/i,
      /\bgarantiza\b/i,
    ].filter((rx) => rx.test(body));
    assert.deepEqual(overclaims.map(String), [], `hours copy made an unhedged claim: ${overclaims}`);
    const weekday = page.locator(".weekday-signal");
    let weekdayState = "not rendered";
    if ((await weekday.count()) > 0) {
      // The hedge lives in the section's accessible name; the body then either reports
      // hedged matches or states that none were detected — never that a place is open.
      const label = await weekday.first().getAttribute("aria-label");
      assert.match(label ?? "", /Posibles coincidencias de cierre semanal/,
        `the weekday closure notice lost its hedged accessible name: ${label}`);
      const text = (await weekday.first().textContent()) ?? "";
      if (/coincidencia/i.test(text) && !/Sin coincidencias/i.test(text)) {
        assert.match(text, /posible/i, "a reported weekday match dropped its 'posible' hedge");
        assert.match(text, /confirma el horario\/cierre oficial/i,
          "a reported weekday match dropped its confirm-officially instruction");
        weekdayState = "hedged matches reported";
      } else {
        assert.match(text, /Sin coincidencias de cierre semanal detectadas/,
          `unexpected weekday copy: ${text.slice(0, 120)}`);
        weekdayState = "no matches detected";
      }
    }
    return `no unhedged open/closed claim; weekday notice: ${weekdayState}`;
  });

  /** Issue #118 §10: the manual visit-start control is only offered where a recorded interval
   * exists to compare against — every rendered input must sit beside its raw recorded datum. */
  await step("C06 visit-start fit is offered only beside a recorded interval", async () => {
    const items = page.locator(".recorded-interval-fit__item");
    const count = await items.count();
    if (count === 0) return "no eligible place in this plan";
    for (let i = 0; i < count; i += 1) {
      const text = await items.nth(i).textContent();
      assert.match(text, /Dato: «.+»/,
        `a visit-start control rendered without its raw recorded interval: ${text.slice(0, 80)}`);
      assert.equal(await items.nth(i).locator("input[type=time]").count(), 1,
        "recorded-interval item without exactly one time input");
    }
    const disclaimer = await page.locator(".recorded-interval-fit__disclaimer").first().textContent();
    assert.match(disclaimer, /No indica si el lugar abre/,
      "the visit-start disclaimer no longer disclaims opening status");
    return `${count} eligible place(s), all with recorded data`;
  });

  // ======================================================= JOURNEY D
  await step("D01 validated-static walking transfer is labelled as such", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const nearby = await detail().textContent();
    assert.match(nearby, /Ruta a pie validada/, "no validated walking transfer surfaced");
    return "validated-static labelled";
  });

  await step("D02 estimates are never promoted to validated", async () => {
    const text = await detail().textContent();
    const validated = (text.match(/Ruta a pie validada/g) ?? []).length;
    const estimated = (text.match(/estimaci[óo]n|estimado/gi) ?? []).length;
    assert.ok(validated > 0, "expected at least one validated label");
    // An estimate must never carry the validated wording on the same row.
    const rows = await detail().locator(".transfer, .place-detail__nearby li").allTextContents();
    const conflated = rows.filter((r) => /validada/.test(r) && /estimaci[óo]n/i.test(r));
    assert.deepEqual(conflated, [], `row claims both validated and estimated: ${conflated}`);
    return `${validated} validated, ${estimated} estimate mentions, 0 conflated`;
  });

  // ======================================================= JOURNEY E
  await step("E01 historical photograph renders from a local asset", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Golden Gai"); // JP-013, historical batch
    const src = await detail().locator(".gallery__image").getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `not a local asset: ${src}`);
    const ok = await detail().locator(".gallery__image").evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(ok, "historical photograph did not decode");
    return src;
  });

  await step("E02 Phase 4L photograph renders from a local asset", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Mount Takao"); // JP-051, Phase 4L batch
    const src = await detail().locator(".gallery__image").getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `not a local asset: ${src}`);
    const ok = await detail().locator(".gallery__image").evaluate((n) => n.complete && n.naturalWidth > 0);
    assert.ok(ok, "Phase 4L photograph did not decode");
    return src;
  });

  await step("E03 carried fail-closed target keeps its fallback", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("PokéPark KANTO"); // JP-050, fail-closed since Phase 4F
    assert.equal(await detail().locator(".gallery__image").count(), 0,
      "a fail-closed target must not render a photograph");
    const body = await detail().textContent();
    assert.match(body, /Sin fotograf[íi]a disponible todav[íi]a/i);
    return "fallback intact";
  });

  await step("E04 zero runtime photography-provider requests", async () => {
    const offenders = externalRequests.filter((u) => PHOTO_PROVIDER.test(u));
    assert.deepEqual(offenders, [], `photography provider contacted: ${offenders.slice(0, 3)}`);
    return `${externalRequests.length} external requests, 0 photographic`;
  });

  // ======================================================= ACCESSIBILITY
  await step("F01 every image carries alt text", async () => {
    await gotoHub("Tokio", "Tokio");
    await openPlace("Shibuya Crossing");
    const missing = await page.evaluate(() =>
      [...document.images]
        .filter((i) => !i.closest(".leaflet-container"))
        .filter((i) => !i.alt && i.getAttribute("aria-hidden") !== "true" && i.getAttribute("role") !== "presentation")
        .map((i) => i.currentSrc || i.src)
    );
    assert.deepEqual(missing, [], `product images without alt text: ${missing.slice(0, 3)}`);
    return "all product images labelled";
  });

  await step("F02 interactive controls use native semantics", async () => {
    const fake = await page.evaluate(() =>
      [...document.querySelectorAll("[onclick], div[role=button], span[role=button]")]
        .filter((n) => !n.closest(".leaflet-container"))
        .map((n) => n.tagName + "." + n.className).slice(0, 5)
    );
    assert.deepEqual(fake, [], `non-native click targets: ${fake}`);
    return "native buttons/links only";
  });

  await step("F03 form controls are labelled", async () => {
    await openPlanner();
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => {
          if (el.type === "hidden") return false;
          if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
          if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
          return !el.closest("label");
        })
        .map((el) => `${el.tagName}#${el.id || "(no id)"}`)
    );
    assert.deepEqual(unlabelled, [], `unlabelled form controls: ${unlabelled}`);
    return "all controls labelled";
  });

  await step("F04 keyboard reaches primary controls with visible focus", async () => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    assert.ok(first, "Tab did not move focus off <body>");
    const visible =
      (first.outline !== "none" && first.outlineWidth !== "0px") ||
      (first.boxShadow && first.boxShadow !== "none");
    assert.ok(visible, `focused ${first.tag} has no visible focus indicator`);
    return `${first.tag}, outline ${first.outline} ${first.outlineWidth}`;
  });

  await step("F05 no keyboard trap in the planner dialog", async () => {
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    await openPlanner();
    const seen = new Set();
    let repeats = 0;
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      const key = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}#${el.id}.${el.className}` : "none";
      });
      if (seen.has(key)) repeats += 1;
      seen.add(key);
    }
    assert.ok(seen.size > 5, `focus reached only ${seen.size} elements — the dialog is not navigable`);
    // A modal dialog SHOULD contain focus; what must never happen is being unable to leave it.
    // The product binds Escape (`OrderedSequenceBuilder.tsx`), so that is the escape hatch.
    await page.keyboard.press("Escape");
    await plannerDialog().waitFor({ state: "detached" });
    assert.equal(await plannerDialog().count(), 0, "Escape did not dismiss the planner dialog");
    const focusAfter = await page.evaluate(() => document.activeElement?.tagName ?? "none");
    return `${seen.size} distinct stops, ${repeats} revisits, Escape dismissed (focus on ${focusAfter})`;
  });

  // ======================================================= RESPONSIVE
  await step("G01 no horizontal overflow on primary screens", async () => {
    const screens = [];
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    screens.push(["national", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await enterHub("Tokio", "Tokio");
    screens.push(["hub", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await ensurePlaceListVisible();
    screens.push(["hub+drawer", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await openPlace("Shibuya Crossing");
    screens.push(["detail", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    await openPlanner();
    screens.push(["planner", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)]);
    const overflowing = screens.filter(([, delta]) => delta > 1);
    assert.deepEqual(overflowing, [], `horizontal overflow: ${JSON.stringify(overflowing)}`);
    return screens.map(([n, d]) => `${n}:${d}`).join(" ");
  });

  await step("G01b mobile search/filter drawer opens and closes", async () => {
    if (!isMobile) return "desktop layout — sidebar is always visible";
    await gotoHub("Tokio", "Tokio");
    const sidebar = page.locator(".app__sidebar").first();
    assert.ok(await sidebar.isVisible(), "drawer did not open from the hub entry");
    await page.getByRole("button", { name: /Cerrar búsqueda y filtros/ }).first().click();
    await sidebar.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: /Buscar y filtrar/ }).first().click();
    await sidebar.waitFor({ state: "visible" });
    const items = await page.locator(".place-list__item").count();
    assert.ok(items > 0, "place list empty after reopening the drawer");
    return `reopened with ${items} places`;
  });

  await step("G02 primary touch targets are usable", async () => {
    await gotoHub("Tokio", "Tokio");
    await ensurePlaceListVisible();
    const small = await page.evaluate(() => {
      const min = 32;
      return [...document.querySelectorAll(".place-list__item, .selection-panel__toggle, .filter-chip")]
        .map((n) => ({ cls: n.className, h: Math.round(n.getBoundingClientRect().height) }))
        .filter((x) => x.h > 0 && x.h < min)
        .slice(0, 5);
    });
    assert.deepEqual(small, [], `touch targets under 32px: ${JSON.stringify(small)}`);
    return "all >= 32px";
  });

  await step("G03 planner remains operable at this viewport", async () => {
    await seedPlan(["JP-001", "JP-002", "JP-003"]);
    await openPlanner();
    const startDate = page.locator("#sequence-start-date");
    await startDate.waitFor({ state: "visible" });
    const box = await startDate.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0, "trip anchor control not visible");
    const covered = await startDate.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top && !el.contains(top) && top !== el ? top.className : null;
    });
    assert.equal(covered, null, `a fixed element covers the trip anchor control: ${covered}`);
    return `anchor ${Math.round(box.width)}x${Math.round(box.height)}`;
  });

  // ======================================================= RUNTIME
  await step("H01 no transit provider activated", async () => {
    const offenders = externalRequests.filter((u) => TRANSIT_PROVIDER.test(u));
    assert.deepEqual(offenders, [], `transit provider contacted: ${offenders.slice(0, 3)}`);
    return "dormant";
  });

  await step("H02 no secret-bearing or localhost-service request", async () => {
    const offenders = externalRequests.filter(
      (u) => /[?&](key|token|api[_-]?key|secret)=/i.test(u) || /localhost:\d+/.test(u)
    );
    assert.deepEqual(offenders, [], `suspicious request: ${offenders.slice(0, 3)}`);
    return "none";
  });

  await step("H03 external runtime requests are only the documented map tiles", async () => {
    const hosts = [...new Set(externalRequests.map((u) => new URL(u).host))];
    const undocumented = hosts.filter((h) => !/tile\.openstreetmap\.org$/.test(h));
    assert.deepEqual(undocumented, [], `undocumented external hosts: ${undocumented}`);
    return hosts.join(",") || "none";
  });

  await step("H04 core UI survives failed external tiles", async () => {
    await gotoHub("Tokio", "Tokio");
    await ensurePlaceListVisible();
    const count = await page.locator(".place-list__item").count();
    assert.ok(count > 0, "place list did not render with stubbed tiles");
    return `${count} places rendered`;
  });

  await step("H05 no console errors and no page errors", async () => {
    const realConsole = consoleErrors.filter((t) => !/ERR_CERT_AUTHORITY_INVALID|net::ERR_/.test(t));
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.slice(0, 3)}`);
    assert.deepEqual(realConsole, [], `console errors: ${realConsole.slice(0, 3)}`);
    return `0 page errors, ${consoleErrors.length} network-stub console notices ignored`;
  });

  // ======================================================= PERSISTENCE
  await step("I01 clean first run starts empty", async () => {
    const fresh = await context.newPage();
    await fresh.route("**/*", (route) => {
      const t = route.request().url();
      if (t.startsWith(url) || t.startsWith("data:") || t.startsWith("blob:")) return route.continue();
      return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
    });
    await fresh.evaluate(() => {}).catch(() => {});
    await fresh.goto(url, { waitUntil: "networkidle" });
    await fresh.evaluate(() => localStorage.clear());
    await fresh.reload({ waitUntil: "networkidle" });
    const saved = await fresh.evaluate(() => localStorage.getItem("nihon.savedPlaceIds"));
    const body = await fresh.locator("body").textContent();
    assert.ok(!saved || saved === "[]", `clean profile carried saved state: ${saved}`);
    assert.ok(body.includes("Nihon"), "clean profile did not render");
    await fresh.close();
    return "empty and renders";
  });

  await step("I02 malformed persisted payloads fail safe", async () => {
    for (const payload of ['{"not":"an array"}', "[1,2,3]", "not json at all", '["JP-XXX"]']) {
      await page.evaluate((p) => {
        localStorage.setItem("nihon.savedPlaceIds", p);
        localStorage.setItem("nihon.manualPlanningDraft", p);
      }, payload);
      await page.reload({ waitUntil: "networkidle" });
      const body = await page.locator("body").textContent();
      assert.ok(body.includes("Nihon"), `app failed to render after payload ${payload}`);
      assert.deepEqual(pageErrors, [], `payload ${payload} raised a page error`);
    }
    return "4 malformed payloads survived";
  });

  await page.evaluate(() => localStorage.clear());
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}

console.log(
  `\n${results.length - failures.length}/${results.length} checks passed` +
    ` · ${externalRequests.length} external requests recorded`
);
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
}
