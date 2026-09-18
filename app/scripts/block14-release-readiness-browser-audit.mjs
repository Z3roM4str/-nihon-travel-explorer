import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 14 — release readiness: one journey, across every subsystem.
 *
 * The twelve audits before this one each prove their own block in isolation, and all twelve can be
 * green while the product is broken — because the failures that matter after thirteen blocks live
 * *between* subsystems, not inside them. Switching traveller and then opening the planner. Restoring
 * a backup and then touching the app. Comparing zones after crossing three hubs. Opening a lazy
 * surface after a restore has reloaded the page.
 *
 * So this is deliberately **not** a thirteenth feature audit. It is one continuous story, on one
 * browser context, in the order a person would actually do it — Japan → Tokio → Kioto → Osaka →
 * plan → zones → backup → restore → keep using it — and every assertion is about whether the pieces
 * still agree with each other after the step before.
 *
 * Three integration risks it exists to catch, none of which any isolated audit can see:
 *
 *  1. **The restore trap.** Block 13 forces a reload after restoring because the live React state
 *     is stale. If that ever regresses, the next interaction writes the PREVIOUS trip over the
 *     import — silently. Step 9 restores, reloads, then *interacts*, and checks the import survived.
 *  2. **Multi-hub contamination.** A trip across Tokio, Kioto and Osaka must not leak a filter, a
 *     zone list or a shortlist between hubs.
 *  3. **Lazy surfaces after state churn.** Block 12's chunks must still resolve after a reload that
 *     a restore triggered, not only on a cold load.
 *
 * Usage: node scripts/block14-release-readiness-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4333;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";
const ZONES_KEY = "nihon.zoneComparison.v1";

/**
 * The only external host Nihon is contracted to use: OpenStreetMap's tile servers, for the map.
 * Anything else is a finding, not something to add here. Kept as an exact host test rather than a
 * substring so a lookalike domain cannot pass.
 */
const ALLOWED_EXTERNAL_HOSTS = /^([abc]\.)?tile\.openstreetmap\.org$/;

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const read = (page, key) =>
  page.evaluate((k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }, key);

const parse = (raw, fallback = null) => {
  try {
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const shortlistOf = (raw) =>
  (parse(raw, { interests: [] })?.interests ?? [])
    .filter((i) => (i.stances ?? []).some((s) => s.stance === "interested") || i.carriedOver)
    .map((i) => i.placeId);

/**
 * Clicks a locator only if it is actually visible, and reports whether it did.
 *
 * Nihon's controls move between viewports — filter chips live inside a collapsible group on a
 * phone, the list/map switch only exists there at all — so an unconditional click turns a layout
 * difference into a crashed audit. A guarded click makes the absence a fact this run records
 * instead of an exception that hides every check after it.
 */
async function clickIfVisible(locator, timeout = 2500) {
  try {
    const n = await locator.count();
    if (n === 0) return false;
    // Every match, not just the first. The national view carries more than one control whose
    // accessible name starts with a hub's name, and the first in DOM order is not necessarily the
    // visible one — which is how this audit briefly reported Osaka as unreachable.
    for (let i = 0; i < Math.min(n, 5); i += 1) {
      const candidate = locator.nth(i);
      if (!(await candidate.isVisible())) continue;
      await candidate.click({ timeout });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function overflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function goNational(page) {
  await clickIfVisible(page.getByRole("button", { name: /Japón/ }), 8000);
  await page.waitForTimeout(800);
}

/**
 * Opens a hub, and says whether it actually arrived.
 *
 * Two routes, in this order and for a reason. The hub-selector tabs stay clickable from inside any
 * hub, so switching directly is what a person does and is the fewer moving parts; the national view
 * is the fallback for when we are not in a hub at all. Going via the national view *first* is what
 * made this audit briefly report the zone comparison as unreachable — a navigation detour failing
 * quietly reads exactly like a missing feature.
 */
/**
 * Opens a hub and waits for it to actually render, rather than for a fixed number of milliseconds.
 *
 * Three routes are tried in turn because Nihon offers the hub by three different affordances
 * depending on where you are: the selector tabs inside a hub, the "elige una ciudad" cards on the
 * national start screen, and the region navigator's prefecture rows. A filter left applied from an
 * earlier step can also leave a hub with no visible cards, so that is cleared first — otherwise an
 * empty list reads as "this hub is broken".
 */
async function openHub(page, hub) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await ensureNoOverlay(page);
    await collapseSelectionPanel(page);
    await clearFilters(page);
    const candidates = [
      page.locator(".hub-selector__tab", { hasText: new RegExp(`^${hub}$`) }),
      page.locator(".national-start__hub", { hasText: new RegExp(`^${hub}`) }),
      page.getByRole("button", { name: new RegExp(`^${hub}`) }),
    ];
    for (const candidate of candidates) {
      if (!(await clickIfVisible(candidate, 8000))) continue;
      try {
        await page.waitForSelector(".place-card", { timeout: 6000 });
        return true;
      } catch {
        /* that affordance did not land us in the hub; try the next */
      }
    }
    await goNational(page);
    await page.waitForTimeout(700);
  }
  return false;
}

/**
 * Collapses the saved-places sheet if it is expanded.
 *
 * Recorded as an OBSERVATION in `docs/BLOCK_14_RELEASE_READINESS.md` rather than worked around
 * silently: on a phone, an expanded sheet sits over the national start screen and **intercepts
 * pointer events** on the hub cards beneath it (Playwright names
 * `.selection-panel__summary` as the interceptor). A person collapses it with one tap and carries
 * on, which is exactly what this does — but an audit that clicked blindly would have reported the
 * hub as unreachable, which is how this was found.
 */
async function collapseSelectionPanel(page) {
  const toggle = page.locator(".selection-panel__toggle");
  if ((await toggle.count()) === 0) return;
  if ((await toggle.first().getAttribute("aria-expanded")) === "true") {
    await clickIfVisible(toggle);
    await page.waitForTimeout(400);
  }
}

/** Clears any search text and any applied filter chip, so an empty list means an empty hub. */
async function clearFilters(page) {
  const search = page.locator('input[type="search"]');
  if ((await search.count()) > 0 && (await search.first().isVisible())) {
    const value = await search.first().inputValue();
    if (value) {
      await search.first().fill("");
      await page.waitForTimeout(400);
    }
  }
  const clear = page.getByRole("button", { name: /Limpiar|Quitar filtros|Restablecer/ });
  await clickIfVisible(clear);
}

/** Saves `count` places in `hub` as whoever is the active traveller. Returns the ids it saved. */
async function saveIn(page, hub, count) {
  const before = shortlistOf(await read(page, TRAVELLERS_KEY));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 0) await openHub(page, hub);
    else {
      // Second pass goes the long way round, so a hub that looked empty because something was
      // still on screen gets one honest retry before it is reported as a failure.
      await ensureNoOverlay(page);
      await goNational(page);
      await clickIfVisible(page.getByRole("button", { name: new RegExp(`^${hub}`) }), 10000);
      await page.waitForTimeout(1300);
    }
    for (let i = 0; i < count; i += 1) {
      const save = page.locator(".place-card__save").nth(i);
      if ((await save.count()) === 0) break;
      if ((await save.getAttribute("aria-pressed")) !== "true") {
        await clickIfVisible(save, 5000);
        await page.waitForTimeout(200);
      }
    }
    const now = shortlistOf(await read(page, TRAVELLERS_KEY));
    if (now.length > before.length) return now.filter((id) => !before.includes(id));
  }
  const after = shortlistOf(await read(page, TRAVELLERS_KEY));
  return after.filter((id) => !before.includes(id));
}

async function openPlanner(page) {
  const toggle = page.locator(".selection-panel__toggle");
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) !== "true") {
    await clickIfVisible(toggle);
    await page.waitForTimeout(400);
  }
  if (!(await clickIfVisible(page.getByRole("button", { name: /Construir recorrido/ }), 8000))) return false;
  await page.waitForSelector("#sequence-builder-title", { timeout: 10000 }).catch(() => {});
  return (await page.locator("#sequence-builder-title").count()) === 1;
}

async function closeOverlay(page) {
  await clickIfVisible(page.getByRole("button", { name: /Cerrar|Volver/ }));
  await page.waitForTimeout(500);
}

/**
 * Guarantees no full-screen overlay is left open.
 *
 * Worth its own helper because the failure it prevents is deceptive: an overlay still on screen
 * makes every control behind it invisible, so the next step reports the *feature* as missing rather
 * than the overlay as stuck. This audit hit exactly that and briefly accused the zone comparison of
 * being unreachable after multi-hub navigation, when it was the planner still sitting on top.
 */
async function ensureNoOverlay(page) {
  for (let i = 0; i < 3; i += 1) {
    const overlays = await page.locator("#sequence-builder-title, .zone-panel, .trip-backup__dialog, .traveller-manager__dialog").count();
    const detail = await page.locator(".place-detail").count();
    if (overlays === 0 && detail === 0) return true;
    // A place detail replaces the list on a phone, so it hides the save controls exactly as an
    // overlay would. Its own back button is the way out.
    await clickIfVisible(page.locator(".place-detail__back"));
    await page.waitForTimeout(350);
    await collapseSelectionPanel(page);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(350);
    await clickIfVisible(page.getByRole("button", { name: /Cerrar|Volver/ }));
    await page.waitForTimeout(450);
  }
  return (await page.locator("#sequence-builder-title, .zone-panel, .trip-backup__dialog, .place-detail").count()) === 0;
}

async function auditViewport(browser, name, url, tmp) {
  const { width, height, dpr } = VIEWPORTS[name];
  const isPhone = width <= 500;
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(22)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const externalHosts = new Set();
  const disallowedExternal = [];
  const failedRequests = [];
  const jsStatuses = [];

  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // ONE exclusion, and it is exact: the sandbox has no route to the tile servers, so Leaflet's
    // own image loads fail. That is the environment, not the product, and nothing else is excluded.
    if (/tile\.openstreetmap\.org/.test(t)) return;
    if (/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CERT/.test(t)) return;
    consoleErrors.push(t);
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(url)) failedRequests.push(`${r.url().replace(url, "")}: ${r.failure()?.errorText}`);
  });
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith(url) || u.startsWith("blob:") || u.startsWith("data:")) return;
    let host = "";
    try {
      host = new URL(u).hostname;
    } catch {
      host = u;
    }
    externalHosts.add(host);
    if (!ALLOWED_EXTERNAL_HOSTS.test(host)) disallowedExternal.push(u);
  });
  page.on("response", (r) => {
    if (r.url().startsWith(url) && /\.js(\?|$)/.test(r.url())) {
      jsStatuses.push({ u: r.url().replace(url, ""), s: r.status() });
    }
  });

  // ── 1. Cold open, onboarding, national view ─────────────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("Nihon opens from a clean browser", (await page.locator("#root > *").count()) > 0);

  const onboarding = page.locator(".onboarding__dialog, .onboarding");
  if ((await onboarding.count()) > 0) {
    await clickIfVisible(page.getByRole("button", { name: /Empezar|Entendido|Cerrar|×/ }));
    await page.waitForTimeout(500);
  }
  check("the first-run explainer can be dismissed", (await page.locator(".onboarding__dialog").count()) === 0);
  check("the national map renders on first paint", (await page.locator(".leaflet-container").count()) >= 1);
  check("no horizontal overflow on the national view", !(await overflows(page)));

  // ── 2. Discovery: hub, list/map, search, filters, detail, photography ───────────────────────
  await openHub(page, "Tokio");
  check("Tokio opens with places", (await page.locator(".place-card").count()) > 0);

  const switchedToMap = await clickIfVisible(page.getByRole("button", { name: /Mapa/ }));
  await page.waitForTimeout(700);
  check("the hub map renders", (await page.locator(".leaflet-container").count()) >= 1);
  if (switchedToMap) {
    await clickIfVisible(page.getByRole("button", { name: /Lista/ }));
    await page.waitForTimeout(700);
  }
  check("the list comes back after the map", (await page.locator(".place-card").count()) > 0);

  const filtersToggle = page.getByRole("button", { name: /Filtros/ }).first();
  await clickIfVisible(filtersToggle);
  await page.waitForTimeout(400);
  const search = page.locator('input[type="search"]').first();
  const hasSearch = (await search.count()) > 0;
  check("free-text search exists", hasSearch);
  if (hasSearch) {
    await search.fill("Shibuya");
    await page.waitForTimeout(600);
    check("search narrows the list", (await page.locator(".place-card").count()) > 0);
    // Zero results must be an honest empty state, not a crash or a silent full list.
    await search.fill("zzzzzzzznotaplace");
    await page.waitForTimeout(600);
    const zero = await page.locator(".place-card").count();
    check("a zero-result search says so instead of showing everything", zero === 0);
    check("the zero-result state raised no error", pageErrors.length === 0, pageErrors.join(" | "));
    await search.fill("");
    await page.waitForTimeout(600);
  }
  // Chips sit inside collapsible groups; open the first one before reaching for them.
  await clickIfVisible(page.locator(".filter-group__summary"));
  await page.waitForTimeout(300);
  const chip = page.locator(".filter-chip");
  const chipClicked = await clickIfVisible(chip);
  await page.waitForTimeout(500);
  check("a filter can be applied without error", !chipClicked || pageErrors.length === 0, pageErrors.join(" | "));
  if (chipClicked) {
    await clickIfVisible(chip);
    await page.waitForTimeout(400);
  }
  await clickIfVisible(filtersToggle);
  await page.waitForTimeout(300);

  await clickIfVisible(page.locator(".place-card"), 8000);
  await page.waitForTimeout(800);
  const detailOpen = (await page.locator(".place-detail").count()) === 1;
  check("a place detail opens", detailOpen);
  if (detailOpen) {
    const hasImage = (await page.locator(".place-detail img").count()) > 0;
    const hasFallback = (await page.locator(".place-gallery__fallback, .gallery__fallback").count()) > 0;
    // Either a licensed photograph or the editorial brief — never an empty frame.
    check("the detail shows a photograph or its editorial fallback", hasImage || hasFallback);
    check("the detail has no horizontal overflow", !(await overflows(page)));
    await clickIfVisible(page.locator(".place-detail__back"));
    await page.waitForTimeout(600);
  }

  // ── 3. Two travellers, genuinely divergent ──────────────────────────────────────────────────
  const options = page.locator(".traveller-bar__option");
  check("two travellers exist as separate identities", (await options.count()) === 2);

  await options.nth(0).click();
  await page.waitForTimeout(400);
  const aTokyo = await saveIn(page, "Tokio", 3);
  await options.nth(1).click();
  await page.waitForTimeout(400);
  const bKyoto = await saveIn(page, "Kioto", 2);
  await options.nth(0).click();
  await page.waitForTimeout(400);
  const aOsaka = await saveIn(page, "Osaka", 2);

  const doc = parse(await read(page, TRAVELLERS_KEY));
  const [ta, tb] = doc?.travellers ?? [];
  check("the trip spans Tokio, Kioto and Osaka", aTokyo.length > 0 && bKyoto.length > 0 && aOsaka.length > 0,
    `${aTokyo.length}/${bKyoto.length}/${aOsaka.length}`);

  const stancesOf = (id) =>
    (doc?.interests ?? []).find((i) => i.placeId === id)?.stances ?? [];
  const onlyA = aTokyo.every((id) => stancesOf(id).every((s) => s.travellerId === ta?.id));
  const onlyB = bKyoto.every((id) => stancesOf(id).every((s) => s.travellerId === tb?.id));
  check("what A marked is attributed to A alone", onlyA);
  check("what B marked is attributed to B alone", onlyB);
  check("no stance was silently shared between the two", onlyA && onlyB);

  const shortlist = shortlistOf(await read(page, TRAVELLERS_KEY));
  check("the shared shortlist is the union of both people's wants",
    [...aTokyo, ...bKyoto, ...aOsaka].every((id) => shortlist.includes(id)));
  check("the shortlist is derived, not a second stored list",
    !JSON.stringify(doc).includes("savedPlaceIds") && !JSON.stringify(doc).includes("shortlist"));

  // ── 4. INTEGRATION: switch traveller, THEN open the planner ─────────────────────────────────
  // An isolated planner audit never crosses this boundary. The planner must see the SHARED
  // shortlist, not whatever the active person happens to want.
  await options.nth(1).click();
  await page.waitForTimeout(500);
  const plannerOpened = await openPlanner(page);
  check("the planner opens after switching traveller", plannerOpened);
  const draftAfterSwitch = parse(await read(page, DRAFT_KEY));
  check("the planner works from the SHARED shortlist, not the active person's",
    Boolean(draftAfterSwitch) && shortlist.every((id) => draftAfterSwitch.routeIds.includes(id)),
    `route ${draftAfterSwitch?.routeIds?.length} vs shortlist ${shortlist.length}`);
  check("the plan is one shared document, not one per traveller",
    Boolean(draftAfterSwitch) && !Array.isArray(draftAfterSwitch) && draftAfterSwitch.version === 8);
  check("opening the planner raised no error", pageErrors.length === 0, pageErrors.join(" | "));
  check("the planner has no horizontal overflow", !(await overflows(page)));
  await closeOverlay(page);

  // ── 5. A real plan: days, dates, a manual time, an inter-hub segment ────────────────────────
  // Seeded through the draft's own key and then ADOPTED by the app, because the day/calendar
  // controls are not reachable at 390px. The adoption is then verified through the app itself.
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!Array.isArray(d.routeIds) || d.routeIds.length < 3) return;
    const unselected = { start: { kind: "unselected" }, end: { kind: "unselected" } };
    const third = Math.ceil(d.routeIds.length / 3);
    d.days = [
      { id: "d-1", placeIds: d.routeIds.slice(0, third), accommodationBoundary: unselected },
      { id: "d-2", placeIds: d.routeIds.slice(third, third * 2), accommodationBoundary: unselected },
      { id: "d-3", placeIds: d.routeIds.slice(third * 2), accommodationBoundary: unselected },
    ].filter((day) => day.placeIds.length > 0);
    d.startDate = "2027-03-14";
    d.endDate = "2027-03-20";
    d.visitStartTimes = { [d.routeIds[0]]: "09:30" };
    // The exact `ManualInterHubSegment` shape — all nine keys, a real mode, a positive integer.
    // Its parser is strict on the full key set, and one wrong field rejects the entire draft.
    d.interHubSegments = [
      {
        id: "s-1",
        fromPlaceId: d.routeIds[0],
        toPlaceId: d.routeIds[d.routeIds.length - 1],
        fromHub: "Tokio",
        toHub: "Kioto",
        mode: "shinkansen",
        minutes: 140,
        source: { kind: "user-entered" },
      },
    ];
    localStorage.setItem(key, JSON.stringify(d));
  }, DRAFT_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await openPlanner(page);
  await page.waitForTimeout(600);
  await closeOverlay(page);

  const richDraft = parse(await read(page, DRAFT_KEY));
  check("the app adopted a three-day plan with dates and a manual visit time",
    Boolean(richDraft) && (richDraft.days ?? []).length >= 2 && richDraft.startDate === "2027-03-14" &&
      richDraft.endDate === "2027-03-20" && Object.keys(richDraft.visitStartTimes ?? {}).length === 1,
    JSON.stringify({ days: richDraft?.days?.length, s: richDraft?.startDate, t: Object.keys(richDraft?.visitStartTimes ?? {}).length }));
  check("the trip is anchored in the February–March 2027 window", richDraft?.startDate?.startsWith("2027-0"));
  const segs = richDraft?.interHubSegments ?? [];
  check("a manual inter-hub segment survived adoption, with valid endpoints",
    segs.length === 1 && segs[0].fromHub !== segs[0].toHub &&
      typeof segs[0].fromPlaceId === "string" && typeof segs[0].toPlaceId === "string" &&
      Number.isInteger(segs[0].minutes) && segs[0].minutes > 0,
    JSON.stringify(segs));

  // ── 6. INTEGRATION: zones after crossing three hubs ─────────────────────────────────────────
  const inOsaka = await openHub(page, "Osaka");
  check("Osaka reopens after crossing three hubs and a reload", inOsaka);
  const zonesButton = page.locator(".hub-bar__zones");
  check("the zone comparison is reachable after multi-hub navigation",
    (await zonesButton.count()) > 0 && (await zonesButton.first().isVisible()));
  if ((await zonesButton.count()) > 0) {
    await zonesButton.click();
    await page.waitForSelector(".zone-card", { timeout: 10000 }).catch(() => {});
    const osakaZones = await page.locator(".zone-card h3").allInnerTexts();
    check("Osaka's zones load", osakaZones.length > 0);
    const boxes = page.locator(".zone-card__compare input");
    if ((await boxes.count()) >= 2) {
      await boxes.nth(0).check();
      await page.waitForTimeout(200);
      await boxes.nth(1).check();
      await page.waitForTimeout(200);
      await clickIfVisible(page.getByRole("button", { name: "Comparar" }).last(), 8000);
      await page.waitForTimeout(1300);
      check("two Osaka zones compare side by side", (await page.locator(".zone-column").count()) >= 2);
      check("comparing raised no error", pageErrors.length === 0, pageErrors.join(" | "));
      check("the comparison has no horizontal overflow", !(await overflows(page)));
    }
    // The stored comparison must be scoped per hub — never a flat list that leaks across Japan.
    const zoneSel = parse(await read(page, ZONES_KEY), {});
    const keys = Object.keys(zoneSel ?? {});
    check("the zone selection is scoped per hub, not global",
      keys.length === 0 || keys.every((k) => typeof k === "string" && Array.isArray(zoneSel[k])), JSON.stringify(keys));
    check("no Tokio zone leaked into Osaka's comparison",
      !(zoneSel?.Osaka ?? []).some((id) => /TOK|TYO/i.test(id)), JSON.stringify(zoneSel?.Osaka ?? []));
    await clickIfVisible(page.getByRole("button", { name: /Cerrar|Volver/ }));
    await page.waitForTimeout(600);
  }

  // ── 7. Reload with rich state ───────────────────────────────────────────────────────────────
  const beforeReload = { t: await read(page, TRAVELLERS_KEY), d: await read(page, DRAFT_KEY) };
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("the whole trip survives a reload", (await read(page, TRAVELLERS_KEY)) === beforeReload.t &&
    (await read(page, DRAFT_KEY)) === beforeReload.d);
  check("the reload raised no error", pageErrors.length === 0, pageErrors.join(" | "));

  // ── 8. Export the trip ──────────────────────────────────────────────────────────────────────
  const externalBeforeBackup = disallowedExternal.length + [...externalHosts].length;
  await ensureNoOverlay(page);
  await page.getByRole("button", { name: "Respaldo del viaje" }).click();
  await page.waitForSelector(".trip-backup__dialog", { timeout: 10000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: "Exportar respaldo" }).click(),
  ]);
  const savedPath = await download.path();
  const fileText = savedPath ? await readFile(savedPath, "utf8") : "";
  const backup = parse(fileText);
  check("a backup file is produced", Boolean(backup) && backup.format === "nihon-portable-backup");
  check("the backup carries both travellers and the shared plan",
    (backup?.data?.travellers?.travellers ?? []).length === 2 && backup?.data?.planningDraft?.version === 8);
  check("the backup carries the three-day plan and its dates",
    (backup?.data?.planningDraft?.days ?? []).length >= 2 && backup?.data?.planningDraft?.startDate === "2027-03-14");
  check("the backup contains no derived or catalogue data",
    !/photography|assetPath|provenance|consultedAt|editorial|nearby|walking|prefecture/.test(fileText));
  check("exporting made no external request",
    disallowedExternal.length + [...externalHosts].length === externalBeforeBackup);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ── 9. THE RESTORE TRAP: change the trip, restore, reload, then INTERACT ────────────────────
  const restoredShortlist = shortlistOf(await read(page, TRAVELLERS_KEY));
  await options.nth(0).click();
  await page.waitForTimeout(400);
  const extra = await saveIn(page, "Kioto", 3);
  const mutatedShortlist = shortlistOf(await read(page, TRAVELLERS_KEY));
  check("the trip changed after the export", mutatedShortlist.length > restoredShortlist.length,
    `${mutatedShortlist.length} vs ${restoredShortlist.length}`);

  await ensureNoOverlay(page);
  await page.getByRole("button", { name: "Respaldo del viaje" }).click();
  await page.waitForSelector(".trip-backup__dialog", { timeout: 10000 });
  await page.locator(".trip-backup__file").setInputFiles(savedPath);
  await page.waitForSelector(".trip-backup__preview", { timeout: 10000 });
  check("a preview appears before anything is replaced", (await page.locator(".trip-backup__preview").count()) === 1);
  check("nothing was written while previewing",
    shortlistOf(await read(page, TRAVELLERS_KEY)).length === mutatedShortlist.length);
  await page.getByRole("button", { name: "Sustituir con este respaldo" }).click();
  await page.waitForSelector(".trip-backup__restored", { timeout: 10000 });
  const afterRestore = shortlistOf(await read(page, TRAVELLERS_KEY));
  check("the restore REPLACED rather than merged",
    afterRestore.length === restoredShortlist.length && !extra.some((id) => afterRestore.includes(id)),
    `${afterRestore.length} vs ${restoredShortlist.length}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForTimeout(1800);

  // THE trap. Block 13 forces this reload precisely so the stale in-memory documents cannot win.
  // If that regresses, the click below writes the pre-restore trip straight back.
  await openHub(page, "Tokio");
  await clickIfVisible(page.locator(".place-card__save"), 8000);
  await page.waitForTimeout(500);
  const afterInteraction = shortlistOf(await read(page, TRAVELLERS_KEY));
  check("interacting after a restore does NOT resurrect the replaced trip",
    !extra.some((id) => afterInteraction.includes(id)),
    `resurrected: ${extra.filter((id) => afterInteraction.includes(id)).join(",")}`);
  check("that interaction was itself persisted", afterInteraction.length >= afterRestore.length);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("the restored trip survives a further reload",
    shortlistOf(await read(page, TRAVELLERS_KEY)).length === afterInteraction.length);

  // ── 10. INTEGRATION: lazy surfaces still resolve after a restore-triggered reload ───────────
  const lazyOk = await openPlanner(page);
  check("Block 12's lazy planner still loads after a restore", lazyOk);
  await closeOverlay(page);
  await openHub(page, "Kioto");
  const zb = page.locator(".hub-bar__zones");
  if ((await zb.count()) > 0) {
    await zb.click();
    await page.waitForSelector(".zone-card", { timeout: 10000 }).catch(() => {});
    check("Block 12's lazy zone comparison still loads after a restore",
      (await page.locator(".zone-card").count()) > 0);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    await clickIfVisible(page.getByRole("button", { name: /Cerrar|Volver/ }));
    await page.waitForTimeout(400);
  }
  // 200 or 304: a Not Modified is a successful cached response, and this journey reloads often
  // enough that treating it as a failure would be measuring the HTTP cache, not the product.
  check("no JS chunk 404s or errors across the journey",
    jsStatuses.every((j) => j.s === 200 || j.s === 304),
    jsStatuses.filter((j) => j.s !== 200 && j.s !== 304).map((j) => `${j.u}:${j.s}`).join(" | "));

  // ── 11. Adversarial persistence ────────────────────────────────────────────────────────────
  // One key missing must not destroy the other.
  const keepTravellers = await read(page, TRAVELLERS_KEY);
  await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("losing the plan does not lose the travellers",
    shortlistOf(await read(page, TRAVELLERS_KEY)).length === shortlistOf(keepTravellers).length);
  check("a missing plan key raised no error", pageErrors.length === 0, pageErrors.join(" | "));

  // Corrupt travellers must fail safe, not crash.
  await page.evaluate((k) => localStorage.setItem(k, "{not json"), TRAVELLERS_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("corrupt traveller storage fails safe and the app still mounts",
    (await page.locator("#root > *").count()) > 0);
  check("corrupt storage raised no page error", pageErrors.length === 0, pageErrors.join(" | "));

  // Legacy storage must migrate through the existing authority, not be resurrected as truth.
  await page.evaluate((keys) => {
    localStorage.removeItem(keys.t);
    localStorage.removeItem(keys.d);
    localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(["JP-001", "JP-002"]));
  }, { t: TRAVELLERS_KEY, d: DRAFT_KEY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const migrated = shortlistOf(await read(page, TRAVELLERS_KEY));
  check("a legacy shortlist migrates into the traveller model",
    migrated.includes("JP-001") && migrated.includes("JP-002"), JSON.stringify(migrated));
  const migratedDoc = parse(await read(page, TRAVELLERS_KEY));
  check("migrated places are marked as carried over, not attributed to anyone",
    (migratedDoc?.interests ?? []).every((i) => i.carriedOver === true || i.stances.length > 0));
  check("migrating raised no error", pageErrors.length === 0, pageErrors.join(" | "));

  // A malformed backup must change nothing.
  const badPath = join(tmp, "bad.json");
  await writeFile(badPath, '{"format":"nihon-portable-backup","version":999,"exportedAt":"2026-09-18T00:00:00Z","data":{}}', "utf8");
  const beforeBad = await read(page, TRAVELLERS_KEY);
  await page.getByRole("button", { name: "Respaldo del viaje" }).click();
  await page.waitForSelector(".trip-backup__dialog", { timeout: 10000 });
  await page.locator(".trip-backup__file").setInputFiles(badPath);
  await page.waitForTimeout(700);
  check("a backup from a future Nihon is refused and explained",
    (await page.locator(".trip-backup__problem").count()) === 1);
  check("the refused backup wrote nothing", (await read(page, TRAVELLERS_KEY)) === beforeBad);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ── 12. Accessibility sanity, on the surfaces this block touched ───────────────────────────
  await page.getByRole("button", { name: "Respaldo del viaje" }).click();
  await page.waitForSelector(".trip-backup__dialog", { timeout: 10000 });
  const dialogA11y = await page.evaluate(() => {
    const d = document.querySelector(".trip-backup__dialog");
    return {
      role: d?.getAttribute("role"),
      modal: d?.getAttribute("aria-modal"),
      labelled: Boolean(d?.getAttribute("aria-labelledby")),
      focusInside: Boolean(d && document.activeElement && d.contains(document.activeElement)),
    };
  });
  check("the dialog is a labelled modal", dialogA11y.role === "dialog" && dialogA11y.modal === "true" && dialogA11y.labelled);
  check("focus moves into the dialog when it opens", dialogA11y.focusInside);
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null)
      .filter((b) => !(b.textContent ?? "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
      .map((b) => b.className).slice(0, 5));
  check("every visible button has an accessible name", unnamed.length === 0, JSON.stringify(unnamed));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape closes the dialog", (await page.locator(".trip-backup__dialog").count()) === 0);
  check("focus is not lost after the dialog closes",
    await page.evaluate(() => document.activeElement !== null && document.activeElement !== document.body || document.body === document.activeElement));

  if (isPhone) {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, input")]
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          c: e.className?.toString?.().slice(0, 28) ?? "",
          type: e.getAttribute("type") ?? "",
          label: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 20),
          h: Math.round(e.getBoundingClientRect().height),
        }))
        .filter((e) => e.h > 0 && e.h < 36).slice(0, 6));
    // Buttons and inputs only, and 36 rather than 44: Block 1 owns the exact floor and its named
    // allowances and is green, so this is a coarse net for anything grossly undersized that Block
    // 1's pass might not reach in this journey's state. Anchors are excluded deliberately — the
    // only one it caught is the map's MLIT attribution line, which is legal fine print rather than
    // a product control, and is recorded as an observation instead of widened into an allowance.
    check("no grossly undersized control on a phone", small.length === 0, JSON.stringify(small));
  }

  // ── 13. Network and runtime, over the whole journey ────────────────────────────────────────
  check("the only external host is OpenStreetMap's tiles",
    disallowedExternal.length === 0, [...new Set(disallowedExternal)].slice(0, 3).join(" | "));
  check("no photograph was fetched from a third party at runtime",
    ![...externalHosts].some((h) => /wikimedia|wikipedia|commons/i.test(h)), [...externalHosts].join(" | "));
  check("no request to this origin failed", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
  check("zero page errors across the whole journey", pageErrors.length === 0, pageErrors.join(" | "));
  check("zero relevant console errors across the whole journey", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check("no horizontal overflow at the end of the journey", !(await overflows(page)));

  console.log(`  · external hosts seen: ${[...externalHosts].join(", ") || "none"}`);
  await context.close();
}

console.log("Block 14 release-readiness audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
const tmp = await mkdtemp(join(tmpdir(), "nihon-b14-"));
try {
  for (const name of targets) await auditViewport(browser, name, url, tmp);
} finally {
  await browser.close();
  await server.close();
  await rm(tmp, { recursive: true, force: true });
}
console.log(`\n${"═".repeat(60)}\nBlock 14 release-readiness audit: ${passed} passed, ${failed} failed`);
if (failures.length) console.log(`failing: ${failures.join(" | ")}`);
console.log("");
process.exit(failed === 0 ? 0 : 1);
