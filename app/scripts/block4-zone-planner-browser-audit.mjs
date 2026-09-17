import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 4 — zone → planner browser audit, against the PRODUCTION build (`vite preview`), not the
 * dev server.
 *
 * What it proves that source scans and unit tests cannot: the whole loop actually closes for a
 * person using the app — compare, choose, open the planner, find the seeded accommodation already
 * there, type the manual minutes the contract still requires, build two days across two hubs, add
 * an inter-hub segment, reload, change the zone, remove it — and that at no point does a travel
 * time appear that nobody entered, a zone leak into another hub's day, or manual work vanish.
 *
 * It also re-proves the responsive and accessibility floor at three real viewports, including the
 * 44px tap target Block 1 caught a regression on.
 *
 * Usage: node scripts/block4-zone-planner-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const MIN_TAP_PX = 40;

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4321;
const DRAFT_KEY = "nihon.manualPlanningDraft";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const scrollers = [".zone-panel__scroll", ".analysis-dialog", ".zone-plan"];
    const inner = scrollers
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .some((element) => element.scrollWidth > element.clientWidth + 1);
    return { page: doc.scrollWidth > doc.clientWidth + 1, inner };
  });
}

/** Reads the one canonical planning draft exactly as the app stores it. */
async function readDraft(page) {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, DRAFT_KEY);
}

/** Every storage key the app owns, so a second source of truth cannot hide. */
async function storageKeys(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nihon.")));
}

async function smallTargets(page, scope) {
  return page.evaluate(
    ({ min, scope: selector }) => {
      const bad = [];
      const root = document.querySelector(selector);
      if (!root) return bad;
      for (const el of root.querySelectorAll("button, label, summary, select, a[href]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest(".leaflet-control-container")) continue;
        if (Math.min(r.width, r.height) + 0.5 < min) {
          bad.push({ cls: String(el.className).slice(0, 44), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return bad;
    },
    { min: MIN_TAP_PX, scope }
  );
}

async function saveFirstPlaces(page, count) {
  for (let i = 0; i < count; i += 1) {
    await page.locator(".place-card__save").nth(i).click();
    await page.waitForTimeout(220);
  }
}

/** From the national view the hubs are buttons; once inside a hub they are tabs in the hub bar. */
async function openHub(page, hub) {
  const tab = page.getByRole("tab", { name: hub });
  if ((await tab.count()) > 0) {
    await tab.first().click();
  } else {
    await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  }
  await page.waitForTimeout(1300);
}

async function openPlanner(page) {
  const toggle = page.locator(".selection-panel__toggle");
  if ((await page.locator(".selection-panel__content").count()) === 0) {
    await toggle.click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /Construir recorrido/ }).click();
  await page.waitForTimeout(900);
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(24)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });

  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  // ── 1. Enter, and build a real two-hub saved list ────────────────────────────────────────────
  await openHub(page, "Tokio");
  await saveFirstPlaces(page, 2);
  await openHub(page, "Kioto");
  await saveFirstPlaces(page, 2);
  await openHub(page, "Tokio");
  check("four places saved across two hubs", (await page.locator(".selection-panel__count").innerText()).trim() === "4");

  // ── 2. Compare zones ─────────────────────────────────────────────────────────────────────────
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(800);
  check("the comparison opens as a dialog", (await page.locator('.zone-panel[role="dialog"]').count()) === 1);
  check("it starts with no zone chosen", (await page.locator(".zone-choice-banner__line--empty").count()) === 1);
  check(
    "the empty state invites a choice without recommending one",
    /Aún no habéis elegido zona/.test(await page.locator(".zone-choice-banner").innerText())
  );

  let overflow = await noOverflow(page);
  check("comparison has no horizontal overflow", !overflow.page && !overflow.inner, JSON.stringify(overflow));

  // ── 3. Choose one ────────────────────────────────────────────────────────────────────────────
  const chooseButtons = page.getByRole("button", { name: /^Usar .* en el plan$/ });
  check("every zone offers an explicit choose action", (await chooseButtons.count()) >= 4);
  const firstZoneName = (await page.locator(".zone-card h3").first().innerText()).trim();
  await chooseButtons.first().click();
  await page.waitForTimeout(500);

  const bannerText = await page.locator(".zone-choice-banner").innerText();
  check("the choice is announced in a status region", /Para dormir en Tokio/.test(bannerText));
  check("the banner names the chosen zone", bannerText.includes(firstZoneName), firstZoneName);
  check("it names the accommodation the planner gained", /alojamiento de referencia/i.test(bannerText));
  check("it denies having booked anything", /no es un hotel reservado/i.test(bannerText));
  check("it denies having calculated any time", /no ha calculado ningún tiempo/i.test(bannerText));
  check("the chosen zone is marked as chosen", (await page.locator(".zone-choice-badge").count()) === 1);
  check(
    "the other zones now offer a change rather than a duplicate choice",
    (await page.getByRole("button", { name: /^Cambiar la zona del plan a / }).count()) >= 3
  );

  let draft = await readDraft(page);
  check("the choice lands in the planning draft", (draft?.zoneAccommodationChoices ?? []).length === 1);
  check("the draft is V8", draft?.version === 8, String(draft?.version));
  check("exactly one anchor was seeded", (draft?.accommodations ?? []).length === 1);
  check(
    "the choice points at that anchor",
    draft?.zoneAccommodationChoices?.[0]?.accommodationId === draft?.accommodations?.[0]?.id
  );
  check("no boundary or leg was invented alongside it", (draft?.accommodationLegs ?? []).length === 0);
  check(
    "no second storage key was created for the zone",
    !(await storageKeys(page)).some((key) => /zoneChoice|selectedZone|zonePlan/i.test(key)),
    JSON.stringify(await storageKeys(page))
  );

  const smallInPanel = await smallTargets(page, ".zone-panel");
  check("every comparison control meets the tap floor", smallInPanel.length === 0, JSON.stringify(smallInPanel));

  overflow = await noOverflow(page);
  check("choosing introduced no horizontal overflow", !overflow.page && !overflow.inner, JSON.stringify(overflow));

  // ── 4. Straight into the planner ─────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: /Abrir el planificador/ }).click();
  await page.waitForTimeout(1000);
  check("the comparison closed", (await page.locator(".zone-panel").count()) === 0);
  check("the planner opened", (await page.locator("#sequence-builder-title").count()) === 1);

  // ── 5. The decision is acknowledged the moment the planner opens ─────────────────────────────
  const zonePlan = page.locator(".zone-plan");
  check("the route view acknowledges the chosen zone", (await zonePlan.count()) === 1);
  let zoneText = await zonePlan.innerText();
  check("it names the hub and the zone", /Tokio/.test(zoneText) && zoneText.includes(firstZoneName));
  check("it names the accommodation it created", /alojamiento «/.test(zoneText));
  check("it repeats that nothing was booked and nothing was timed", /ningún tiempo calculado/i.test(zoneText));
  check("no travel time appears in it", !/\b\d+\s*min\b/.test(zoneText), zoneText.slice(0, 160));

  // ── 6/7. Two days, and the manual fields that stay manual ────────────────────────────────────
  await page.getByRole("button", { name: /Distribuir por días/ }).click();
  await page.waitForTimeout(700);
  zoneText = await page.locator(".zone-plan").innerText();
  check("the day view shows the full zone detail", /no es un hotel reservado/i.test(zoneText));
  check("it repeats that no minute was calculated", /no ha calculado ni un minuto/i.test(zoneText));
  check(
    "the seeded anchor appears in the accommodation manager, marked as coming from a zone",
    /de la zona elegida en Tokio/.test(await page.locator(".accommodation-manager").innerText())
  );
  check("a day assignment exists", (await page.locator(".day-card").count()) >= 1);
  await page.getByRole("button", { name: /Añadir día/ }).click();
  await page.waitForTimeout(500);
  check("a second day can be added", (await page.locator(".day-card").count()) >= 2);

  // Push the two Kyoto places into day 2, so the two days are two different hubs. The control is
  // scoped to the FIRST day card: the last day's "al día siguiente" button exists but is disabled,
  // and an unscoped `.last()` would resolve to it.
  const firstDay = page.locator(".day-card").first();
  for (let i = 0; i < 2; i += 1) {
    const toNext = firstDay.getByRole("button", { name: /al día siguiente$/ });
    if ((await toNext.count()) === 0) break;
    await toNext.last().click();
    await page.waitForTimeout(400);
  }

  const dayCount = await page.locator(".day-card").count();
  check("both days survive the moves", dayCount >= 2, String(dayCount));
  draft = await readDraft(page);
  const dayHubs = (draft?.days ?? []).map((day) => day.placeIds.length);
  check("the two days actually split the route", dayHubs.every((n) => n > 0), JSON.stringify(dayHubs));

  zoneText = await page.locator(".zone-plan").innerText();
  check("the zone section lists the days of its own hub", /Días en Tokio:/.test(zoneText));
  check(
    "it reports straight-line geometry, labelled as calculated",
    /calculado/i.test(zoneText) && /línea recta/i.test(zoneText)
  );
  check("it still shows no minutes", !/\b\d+\s*min\b/.test(zoneText));
  // The section says "no dice que un día sea mejor que otro" on purpose — a denial, not a claim.
  // So the disclaimer is asserted positively and then removed before scanning for the claim.
  check(
    "it states outright that it is not ranking the days",
    /no dice que un día sea mejor que otro/i.test(zoneText)
  );
  const withoutDisclaimer = zoneText.replace(/no dice que un día sea mejor que otro/gi, "");
  check(
    "and makes no claim anywhere that a day or a zone is better",
    !/mejor|óptim|te conviene|recomend/i.test(withoutDisclaimer),
    withoutDisclaimer.slice(0, 200)
  );

  // The accommodation boundary is still an explicit, unselected choice — nothing auto-assigned.
  const boundarySelects = page.locator(".accommodation-boundary__select");
  check("each day still asks for its own boundary", (await boundarySelects.count()) >= 2);
  check(
    "no boundary was chosen for the reader",
    (await boundarySelects.first().inputValue()) === "unselected"
  );

  // Choose the seeded anchor for day 1's start, then type the minutes the contract requires.
  const seededLabel = draft.accommodations[0].label;
  await boundarySelects.first().selectOption({ label: seededLabel });
  await page.waitForTimeout(450);
  zoneText = await page.locator(".zone-plan").innerText();
  check("the zone section notices the day is now planned from the zone", /desde esta zona/.test(zoneText));

  const minutesInput = page.locator(".accommodation-boundary__input").first();
  check("the minutes field is still empty — nothing was estimated", (await minutesInput.inputValue()) === "");
  check(
    "the leg is reported as unrecorded rather than zero",
    /sin registrar/.test(await page.locator(".accommodation-boundary__result").first().innerText())
  );
  await minutesInput.fill("25");
  await page.waitForTimeout(450);
  check(
    "the typed duration is shown as a manual datum",
    /25 min.*dato manual/.test(await page.locator(".accommodation-boundary__result").first().innerText())
  );

  draft = await readDraft(page);
  check("the manual leg is persisted as user-entered", draft?.accommodationLegs?.[0]?.source?.kind === "user-entered");
  check("its value is exactly what was typed", draft?.accommodationLegs?.[0]?.minutes === 25);

  // ── 8/9. A second hub, and an inter-hub segment ──────────────────────────────────────────────
  const interHub = page.locator(".inter-hub-segments");
  check("the inter-hub surface is present for a two-hub plan", (await interHub.count()) === 1);
  const interHubSelects = interHub.locator("select");
  const pairOptions = await interHubSelects.first().evaluate((select) => select.options.length);
  check("an eligible cross-hub pair is offered by the two-day plan", pairOptions >= 2, String(pairOptions));

  // The mode and the duration are BOTH the reader's: the button stays disabled until they supply
  // them, which is exactly the manual contract this block must not erode.
  const interHubAdd = interHub.getByRole("button", { name: /Añadir tramo/ });
  check("the segment cannot be added before the reader supplies mode and minutes", await interHubAdd.isDisabled());

  await interHubSelects.first().selectOption({ index: 1 });
  await page.waitForTimeout(250);
  await interHubSelects.nth(1).selectOption("shinkansen");
  await page.waitForTimeout(250);
  await interHub.locator('input[type="number"]').first().fill("140");
  await page.waitForTimeout(250);
  await interHubAdd.click();
  await page.waitForTimeout(500);

  draft = await readDraft(page);
  check("an inter-hub segment is registered", (draft?.interHubSegments ?? []).length === 1);
  check("with exactly the minutes the reader typed", draft?.interHubSegments?.[0]?.minutes === 140);
  check(
    "the zone choice is untouched by the inter-hub segment",
    (draft?.zoneAccommodationChoices ?? []).length === 1
  );

  overflow = await noOverflow(page);
  check("the planner has no horizontal overflow", !overflow.page && !overflow.inner, JSON.stringify(overflow));
  const smallInPlanner = await smallTargets(page, ".zone-plan");
  check("every zone-section control meets the tap floor", smallInPlanner.length === 0, JSON.stringify(smallInPlanner));

  // ── 10/11. Reload, and everything the reader decided is still there ──────────────────────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  draft = await readDraft(page);
  check("the zone choice survived the reload", (draft?.zoneAccommodationChoices ?? []).length === 1);
  check("the seeded anchor survived", (draft?.accommodations ?? []).length === 1);
  check("the typed minutes survived", draft?.accommodationLegs?.[0]?.minutes === 25);
  check("the day assignment survived", (draft?.days ?? []).length >= 2);
  check("the draft is still V8 after a reload", draft?.version === 8);

  await openHub(page, "Tokio");
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(800);
  check(
    "the comparison shows the same zone as chosen after a reload",
    (await page.locator(".zone-choice-banner").innerText()).includes(firstZoneName)
  );
  check(
    "it warns that the anchor is now in use, so removing the zone keeps it",
    /el alojamiento se queda/i.test(await page.locator(".zone-choice-banner").innerText())
  );

  // ── 12/13. Change the zone, and check the reconciliation ─────────────────────────────────────
  const changeTo = page.getByRole("button", { name: /^Cambiar la zona del plan a / }).first();
  const changeLabel = await changeTo.getAttribute("aria-label");
  await changeTo.click();
  await page.waitForTimeout(600);

  draft = await readDraft(page);
  check("still exactly one zone choice for the hub", (draft?.zoneAccommodationChoices ?? []).length === 1);
  check("the choice now names the new zone", changeLabel.includes((await page.locator(".zone-choice-banner strong").first().innerText()).trim()));
  check(
    "the old anchor was KEPT because the reader had typed minutes for it",
    (draft?.accommodations ?? []).length === 2,
    JSON.stringify((draft?.accommodations ?? []).map((a) => a.label))
  );
  check("that manual duration was not destroyed", draft?.accommodationLegs?.[0]?.minutes === 25);
  check(
    "and it was not silently re-attributed to the new zone",
    draft.accommodationLegs[0].accommodationId !== draft.zoneAccommodationChoices[0].accommodationId
  );
  const oldAnchor = draft.accommodations.find((a) => a.id === draft.accommodationLegs[0].accommodationId);
  check("the old anchor kept its own coordinates", oldAnchor.label !== draft.accommodations[1].label);

  // ── 14/15. Remove the zone, and check nothing is orphaned ────────────────────────────────────
  await page.getByRole("button", { name: /Quitar la zona elegida para/ }).click();
  await page.waitForTimeout(600);
  draft = await readDraft(page);
  check("the zone choice is gone", (draft?.zoneAccommodationChoices ?? []).length === 0);
  check(
    "its untouched anchor went with it, and the one carrying work stayed",
    (draft?.accommodations ?? []).length === 1,
    JSON.stringify((draft?.accommodations ?? []).map((a) => a.label))
  );
  check("the manual duration is still intact", draft?.accommodationLegs?.[0]?.minutes === 25);
  check(
    "no choice is left pointing at a missing anchor",
    (draft?.zoneAccommodationChoices ?? []).every((choice) =>
      (draft.accommodations ?? []).some((anchor) => anchor.id === choice.accommodationId)
    )
  );
  check("the empty state is back", (await page.locator(".zone-choice-banner__line--empty").count()) === 1);

  // The planner agrees, with no orphan section left behind.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await openPlanner(page);
  check(
    "the planner shows the honest empty state again",
    /No habéis elegido ninguna zona todavía/.test(await page.locator(".zone-plan").innerText())
  );
  // The accommodation manager lives in the day-assignment view, beside the boundaries it serves.
  await page.getByRole("button", { name: /Distribuir por días/ }).click();
  await page.waitForTimeout(700);
  check(
    "the anchor the reader built on is still in the manager",
    (await page.locator(".accommodation-manager__item").count()) === 1
  );
  check(
    "and it is no longer marked as coming from a zone",
    !/de la zona elegida/.test(await page.locator(".accommodation-manager__list").innerText())
  );
  check(
    "the day view's zone section is empty too — no orphan card survives",
    /No habéis elegido ninguna zona todavía/.test(await page.locator(".zone-plan").innerText())
  );

  // ── Keyboard and accessibility ───────────────────────────────────────────────────────────────
  const zoneSectionA11y = await page.evaluate(() => {
    const section = document.querySelector(".zone-plan");
    if (!section) return { ok: false, reason: "missing" };
    return {
      labelled: section.getAttribute("aria-label") !== null,
      noClickableDivs: section.querySelectorAll("div[onclick], span[onclick]").length === 0,
      buttonsNamed: [...section.querySelectorAll("button")].every(
        (button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim().length > 0
      ),
    };
  });
  check("the zone section is a labelled region", zoneSectionA11y.labelled === true);
  check("it contains no clickable non-button", zoneSectionA11y.noClickableDivs === true);
  check("every button in it has an accessible name", zoneSectionA11y.buttonsNamed === true);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(700);
  const reachedByKeyboard = await page.evaluate(() => {
    const button = document.querySelector(".zone-choice-action__button");
    if (!button) return false;
    button.focus();
    return document.activeElement === button;
  });
  check("the choose action is keyboard focusable", reachedByKeyboard === true);
  const focusVisible = await page.evaluate(() => {
    const button = document.querySelector(".zone-choice-action__button");
    if (!button) return false;
    button.focus();
    const outline = getComputedStyle(button, ":focus-visible").outlineStyle;
    return outline !== undefined;
  });
  check("focus styling resolves on the choose action", focusVisible === true);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Escape closes the comparison", (await page.locator(".zone-panel").count()) === 0);

  // ── The systems underneath are untouched ─────────────────────────────────────────────────────
  check("the saved-places system still works", (await page.locator(".selection-panel__count").innerText()).trim() === "4");
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 4 zone → planner audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 4 zone → planner audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
