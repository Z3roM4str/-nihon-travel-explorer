import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 9 — governance of zone editorial ratings, browser audit against the PRODUCTION build.
 *
 * Block 9 built no editor. It decided that an editorial rating is Nihon's own judgement, shared and
 * not editable by a traveller, and then fixed the real debt: the ratings were hard to *review*.
 *
 * What source scans and unit tests cannot show is whether a reader who does not know the schema can
 * now tell a judgement from a measurement, whether every axis says which way its marks run, whether
 * neutrality survives without colour, and — the boundary that matters most — that pressing the
 * heart on a place changes no rating, and that opening the ratings changes nobody's heart.
 *
 * Usage: node scripts/block9-editorial-governance-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const MIN_TAP_PX = 44;

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4326;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";
const DECLARED_KEYS = [
  "nihon.travellers.v1",
  "nihon.savedPlaceIds",
  "nihon.manualPlanningDraft",
  "nihon.onboarding.seen.v1",
  "nihon.zoneComparison.v1",
];
/** The ten axis labels the model ships. All must be reviewable. */
const AXIS_COUNT = 10;

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

async function readJson(page, key) {
  return page.evaluate((storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, key);
}

async function storageKeys(page) {
  return page.evaluate(() => {
    try {
      return Object.keys(localStorage).filter((key) => key.startsWith("nihon."));
    } catch {
      return [];
    }
  });
}

async function openComparisonFor(page, hub, zoneNames) {
  await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  await page.waitForTimeout(1300);
  for (let i = 0; i < 2; i += 1) {
    const save = page.locator(".place-card__save").nth(i);
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await page.waitForTimeout(220);
    }
  }
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(800);
  for (const name of zoneNames) {
    const card = page
      .locator(".zone-card")
      .filter({ has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) })
      .first();
    await card.locator(".zone-card__compare input").check();
    await page.waitForTimeout(220);
  }
  const chosen = await page.locator(".zone-card__compare input:checked").count();
  assert.equal(chosen, zoneNames.length, `expected ${zoneNames.length} zones selected, got ${chosen}`);
  await page.getByRole("button", { name: "Comparar" }).last().click();
  await page.waitForTimeout(1400);
}

/**
 * Closes the zone panel, which is a modal dialog: Escape steps compare → browse → closed. The
 * traveller bar lives in the header and is genuinely unreachable while it is open, so any test
 * involving both surfaces has to close one first.
 */
async function closeZonePanel(page) {
  for (let i = 0; i < 3 && (await page.locator(".zone-panel").count()) > 0; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
  }
}

/** Reopens the comparison for two named zones WITHOUT touching anybody's saved places. */
async function reopenComparison(page, zoneNames) {
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(900);
  for (const name of zoneNames) {
    await page
      .locator(".zone-card")
      .filter({ has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) })
      .first()
      .locator(".zone-card__compare input")
      .check();
    await page.waitForTimeout(200);
  }
  await page.getByRole("button", { name: "Comparar" }).last().click();
  await page.waitForTimeout(1300);
  await page.locator(".zone-axes > summary").click();
  await page.waitForTimeout(400);
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

  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage on this document */
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  await openComparisonFor(page, "Tokio", ["Shinjuku", "Asakusa"]);
  check("the comparison renders one column per zone", (await page.locator(".zone-column").count()) === 2);

  // ── Facts and editorial are told apart, in words ─────────────────────────────────────────────
  const tags = (await page.locator(".zone-column__tag").allInnerTexts()).map((t) => t.trim());
  check("the panel tags its kinds of statement", tags.length >= 3, JSON.stringify(tags));
  check("facts are tagged verificables", tags.some((t) => /verificable/i.test(t)), JSON.stringify(tags));
  check("editorial is tagged criterio", tags.some((t) => /^criterio/i.test(t)), JSON.stringify(tags));
  check(
    "derived geometry is tagged calculado",
    tags.some((t) => /calculado/i.test(t)),
    JSON.stringify(tags)
  );

  // ── The disclosure: closed by default, and it explains what a rating is ──────────────────────
  const axes = page.locator(".zone-axes");
  check("the full ten ratings stay behind a disclosure", (await axes.count()) === 1);
  check("which starts closed", !(await page.locator(".zone-axes__list").isVisible()));
  const summary = axes.locator("summary");
  check(
    "the disclosure summary is itself tagged criterio",
    /criterio/i.test(await summary.innerText()),
    (await summary.innerText()).trim()
  );
  const summaryBox = await summary.boundingBox();
  check(
    "and meets the tap-target floor",
    summaryBox !== null && summaryBox.height + 0.5 >= MIN_TAP_PX,
    JSON.stringify(summaryBox)
  );
  check(
    "a closed disclosure reports aria-expanded=false",
    (await axes.getAttribute("open")) === null
  );

  /*
   * Reached by tabbing, not by `focus()`. `:focus-visible` is what draws the ring and Chromium
   * matches it only for keyboard focus, so a programmatic focus reports no ring and would look
   * like a defect that is not there. Tabbing also proves the summary is genuinely reachable.
   */
  await page.locator(".zone-panel__bar").click({ position: { x: 2, y: 2 } }).catch(() => {});
  let reachedSummary = false;
  for (let i = 0; i < 90; i += 1) {
    await page.keyboard.press("Tab");
    reachedSummary = await page.evaluate(
      () => document.activeElement?.matches?.(".zone-axes > summary") === true
    );
    if (reachedSummary) break;
  }
  check("the summary is reachable by tabbing", reachedSummary);
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.matches(".zone-axes > summary")) return { ok: false, why: "not focused" };
    const style = getComputedStyle(el);
    return {
      ok: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none",
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
    };
  });
  check("a keyboard-focused summary draws a visible ring", ring.ok === true, JSON.stringify(ring));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  check("the keyboard alone opens it", await page.locator(".zone-axes__list").isVisible());
  check("and it now reports open", (await axes.getAttribute("open")) !== null);

  const disclosure = page.locator(".zone-axes__disclosure");
  check("it states what these ratings are", (await disclosure.count()) === 1);
  const disclosureText = (await disclosure.innerText()).trim();
  check("naming Nihon as the author", /nihon/i.test(disclosureText), disclosureText);
  check("saying they are not verifiable data", /no datos verificables/i.test(disclosureText), disclosureText);
  check(
    "saying they describe the zone rather than whether they want to go",
    /describen cómo es la zona/i.test(disclosureText) && /no si queréis ir/i.test(disclosureText),
    disclosureText
  );
  check("and saying outright that they cannot be edited", /no se pueden editar/i.test(disclosureText), disclosureText);

  // ── Every rating is reviewable: direction, neutrality, no bare number ────────────────────────
  const axesText = await page.locator(".zone-axes__list > li").allInnerTexts();
  check("the disclosure lists all ten axes", axesText.length === AXIS_COUNT, String(axesText.length));
  const hints = await page.locator(".zone-axes__list .zone-contrast__hint").allInnerTexts();
  check("every axis says which way its marks run", hints.length === AXIS_COUNT, String(hints.length));
  check(
    "and each hint actually names the direction",
    hints.every((t) => /^Más marcas = .{5,}/.test(t.trim())),
    JSON.stringify(hints.slice(0, 3))
  );
  const neutralNotes = await page.locator(".zone-axes__list .zone-contrast__neutral").allInnerTexts();
  check(
    "the axes with no good direction say so in words",
    neutralNotes.length === 2 && neutralNotes.every((t) => /ni bueno ni malo/.test(t)),
    JSON.stringify(neutralNotes)
  );

  // The accessible reading of an ordinal must not look like a measurement.
  const ordinalTexts = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-axes__list .zone-ordinal .visually-hidden")].map((el) =>
      el.textContent.trim()
    )
  );
  check("every ordinal has an accessible reading", ordinalTexts.length >= AXIS_COUNT, String(ordinalTexts.length));
  check(
    "which says it is criterio rather than a measurement",
    ordinalTexts.every((t) => /criterio de Nihon/.test(t)),
    JSON.stringify(ordinalTexts.slice(0, 3))
  );
  check(
    "and none is the bare string 'N de 5'",
    ordinalTexts.every((t) => !/^\d de 5$/.test(t)),
    JSON.stringify(ordinalTexts.slice(0, 3))
  );

  // ── No score, no ranking, no recommendation ──────────────────────────────────────────────────
  const panelText = (await page.locator(".zone-panel").innerText()).toLowerCase();
  check("no percentage or score-shaped figure anywhere", !/%|\bscore\b|puntuaci/.test(panelText));
  check("no zone is called the best", !/la mejor(?!")/.test(panelText), panelText.slice(0, 120));
  check("no rating is presented as a total out of ten", !/\b\d+\s*\/\s*10\b/.test(panelText));
  check(
    "no copy tells them which zone to choose",
    !/deberíais elegir|os recomendamos|elegid /.test(panelText)
  );
  const editControls = await page.evaluate(() => {
    const root = document.querySelector(".zone-axes");
    if (!root) return -1;
    return root.querySelectorAll("input, select, button, [contenteditable]").length;
  });
  check("the ratings surface offers no control to change one", editControls === 0, String(editControls));

  // ── Layout ───────────────────────────────────────────────────────────────────────────────────
  check(
    "no horizontal page scroll",
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1))
  );
  const widened = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-axes, .zone-axes__disclosure, .zone-axes__list")].some((el) => {
      const parent = el.parentElement;
      return parent ? el.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1 : false;
    })
  );
  check("nothing in the ratings surface widens its container", !widened);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-axes__disclosure, .zone-axes__list .zone-contrast__hint")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 40))
  );
  check("the disclosure and hints are not clipped", clipped.length === 0, JSON.stringify(clipped));
  const summaryOverflow = await page.evaluate(() => {
    const el = document.querySelector(".zone-axes > summary");
    return el ? el.scrollWidth > el.clientWidth + 1 : false;
  });
  check("the summary wraps rather than overflowing", !summaryOverflow);

  // Reduced motion: Block 9 introduces no animation, so there must be none to suppress.
  const noTransition = await page.evaluate(() => {
    const el = document.querySelector(".zone-axes__disclosure");
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.transitionProperty === "none" || parseFloat(style.transitionDuration) < 0.01;
  });
  check("the disclosure animates nothing, so reduced motion has nothing to undo", noTransition);

  // ── The boundary: preference and editorial never touch ───────────────────────────────────────
  const zoneTextBefore = await page.locator(".zone-axes__list").innerText();
  const travellersBefore = JSON.stringify(await readJson(page, TRAVELLERS_KEY));
  const draftBefore = JSON.stringify(await readJson(page, DRAFT_KEY));
  const keysBefore = (await storageKeys(page)).sort();

  check(
    "reading the ratings wrote no planning decision",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBefore
  );
  check(
    "and nothing in the personal document",
    JSON.stringify(await readJson(page, TRAVELLERS_KEY)) === travellersBefore
  );
  check(
    "and no storage key of its own",
    JSON.stringify((await storageKeys(page)).sort()) === JSON.stringify(keysBefore),
    JSON.stringify(await storageKeys(page))
  );
  check(
    "every key the app owns is one it declared before this block",
    (await storageKeys(page)).every((key) => DECLARED_KEYS.includes(key)),
    JSON.stringify(await storageKeys(page))
  );

  // The panel is a modal, so the two travellers and the ratings are never on screen together.
  // That is itself the separation working: switching reader cannot reach a rating.
  await closeZonePanel(page);
  check("the zone panel closes", (await page.locator(".zone-panel").count()) === 0);
  const bar = page.locator(".traveller-bar__option");
  check("the traveller bar is reachable once it is closed", (await bar.count()) === 2);

  await bar.nth(1).click();
  await page.waitForTimeout(450);
  check(
    "the second traveller is now the reader",
    (await bar.nth(1).getAttribute("aria-pressed")) === "true"
  );
  await reopenComparison(page, ["Shinjuku", "Asakusa"]);
  check(
    "the ratings are identical for the other traveller",
    (await page.locator(".zone-axes__list").innerText()) === zoneTextBefore
  );
  const disclosureForP2 = (await page.locator(".zone-axes__disclosure").innerText()).trim();
  check("and so is what they are told about them", /criterio de Nihon/i.test(disclosureForP2), disclosureForP2);

  // Now the other direction: a heart is personal and must not move a rating.
  await closeZonePanel(page);
  const third = page.locator(".place-card__save").nth(2);
  const wasPressed = (await third.getAttribute("aria-pressed")) === "true";
  await third.click();
  await page.waitForTimeout(500);
  check(
    "pressing the heart did change the personal document",
    JSON.stringify(await readJson(page, TRAVELLERS_KEY)) !== travellersBefore
  );
  check(
    "and it flipped the reader's own interest",
    ((await third.getAttribute("aria-pressed")) === "true") !== wasPressed
  );

  await reopenComparison(page, ["Shinjuku", "Asakusa"]);
  check(
    "but the ratings are exactly what they were before the heart",
    (await page.locator(".zone-axes__list").innerText()) === zoneTextBefore
  );
  check(
    "and the ratings surface still offers no way to change one",
    (await page.evaluate(() => {
      const root = document.querySelector(".zone-axes");
      return root ? root.querySelectorAll("input, select, button, [contenteditable]").length : -1;
    })) === 0
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 9 editorial-governance audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 9 editorial-governance audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
