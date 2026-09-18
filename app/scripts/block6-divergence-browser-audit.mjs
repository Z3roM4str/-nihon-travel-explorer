import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 6 — "dónde no coincidimos", browser audit against the PRODUCTION build (`vite preview`).
 *
 * What it proves that source scans and unit tests cannot: that the everyday saved list is
 * unchanged until somebody asks a narrower question, that the view tells silence and refusal
 * apart in the words on screen, that a place the planner already holds is reported and NOT moved,
 * that a stance change is reflected the moment it happens, and that the whole block adds no
 * storage key, no second list and no second main surface.
 *
 * Usage: node scripts/block6-divergence-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const MIN_TAP_PX = 44;
/**
 * The allowance Block 1's canonical audit already grants, copied rather than re-decided.
 *
 * `.icon-button--small` is the saved list's long-standing 36px "Quitar" control, allowed at 36 by
 * `scripts/block1-ux-browser-audit.mjs` since Block 1. Block 6 adds no control to this list and
 * has no standing to raise the floor under an existing one: applying a stricter rule here would
 * have reported a pre-existing, deliberate exception as if this block had caused it.
 */
const COMPACT_TAP_ALLOWANCE = {
  ".icon-button--small": 36,
  ".link-button": 24,
  ".selection-panel__chevron": 20,
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4323;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";
const DECLARED_KEYS = [
  "nihon.travellers.v1",
  "nihon.savedPlaceIds",
  "nihon.manualPlanningDraft",
  "nihon.onboarding.seen.v1",
  "nihon.zoneComparison.v1",
];

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
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nihon.")));
}

async function pageOverflows(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

async function smallTargets(page, scope) {
  return page.evaluate(
    ({ min, scope: selector, allowance }) => {
      const bad = [];
      const root = selector ? document.querySelector(selector) : document.body;
      if (!root) return bad;
      for (const el of root.querySelectorAll("button:not([disabled]), input, select, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest(".leaflet-control-container")) continue;
        let floor = min;
        for (const [sel, allowed] of Object.entries(allowance)) {
          if (el.matches(sel)) floor = Math.min(floor, allowed);
        }
        if (Math.min(r.width, r.height) + 0.5 < floor) {
          bad.push({ cls: String(el.className).slice(0, 44), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return bad;
    },
    { min: MIN_TAP_PX, scope, allowance: COMPACT_TAP_ALLOWANCE }
  );
}

async function openHub(page, hub) {
  const tab = page.getByRole("tab", { name: hub });
  if ((await tab.count()) > 0) await tab.first().click();
  else await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  await page.waitForTimeout(1300);
}

async function beTraveller(page, index) {
  await page.locator(".traveller-bar__option").nth(index).click();
  await page.waitForTimeout(350);
}

/** The detail overlay, closed through the control the reader actually uses. */
async function closeDetail(page) {
  const close = page.locator('.place-detail .icon-button[aria-label^="Cerrar la ficha"]');
  if ((await close.count()) > 0) await close.first().click();
  await page.waitForTimeout(500);
}

async function openPanel(page) {
  if ((await page.locator(".selection-panel__content").count()) === 0) {
    await page.locator(".selection-panel__toggle").click();
    await page.waitForTimeout(400);
  }
}

/** Presses one filter chip by its visible label. */
async function pressFilter(page, label) {
  await page.locator(".shortlist-filters__chip", { hasText: new RegExp(`^${label}`) }).first().click();
  await page.waitForTimeout(350);
}

async function chipLabels(page) {
  return (await page.locator(".shortlist-filters__label").allInnerTexts()).map((t) => t.trim());
}

async function visibleRowNames(page) {
  return (await page.locator(".selection-list__place").allInnerTexts()).map((t) => t.trim());
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
  await openHub(page, "Tokio");

  // ── The everyday list is unchanged until there is something to ask ───────────────────────────
  await openPanel(page);
  check(
    "an empty list offers no filter row at all",
    (await page.locator(".shortlist-filters").count()) === 0
  );

  const cards = page.locator(".place-card");

  // A. both interested.
  await beTraveller(page, 0);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 1);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);

  await openPanel(page);
  check(
    "one place everybody agrees on still offers no filter to press",
    (await page.locator(".shortlist-filters").count()) === 0,
    JSON.stringify(await chipLabels(page))
  );

  // B/C. one-sided: P1 wants the second place, P2 has not spoken.
  await beTraveller(page, 0);
  await cards.nth(1).locator(".place-card__save").click();
  await page.waitForTimeout(350);
  await openPanel(page);

  let labels = await chipLabels(page);
  check("a one-sided place brings the filter row in", labels.length >= 2, JSON.stringify(labels));
  check("with 'Todo' first and selected by default", labels[0] === "Todo", JSON.stringify(labels));
  check(
    "and no 'Opiniones distintas' chip, because nobody has said no",
    !labels.includes("Opiniones distintas"),
    JSON.stringify(labels)
  );
  check("the chips name both groups that exist", labels.includes("Los dos") && labels.includes("Sólo uno"), JSON.stringify(labels));

  const allChip = page.locator(".shortlist-filters__chip").first();
  check('"Todo" is the pressed chip', (await allChip.getAttribute("aria-pressed")) === "true");
  check(
    "the default view says nothing extra above the list",
    (await page.locator(".selection-panel__filter-status").count()) === 0
  );
  check(
    "and carries no derived line on any row",
    (await page.locator(".selection-list__divergence").count()) === 0
  );

  // ── B. "sólo tú" from P1's chair ─────────────────────────────────────────────────────────────
  await pressFilter(page, "Sólo uno");
  let rows = await visibleRowNames(page);
  check("filtering to 'Sólo uno' shows only the one-sided place", rows.length === 1, JSON.stringify(rows));
  // The saved list names the place; every later assertion is made against THAT name, so nothing
  // depends on how a browse card happens to render its own title.
  const oneSidedName = rows[0];
  let line = (await page.locator(".selection-list__divergence").first().innerText()).trim();
  check("and names it as yours", /sólo tú lo guardaste/i.test(line), line);
  check("saying the other person has not spoken, not that they refused", /aún no ha opinado/i.test(line), line);
  check("never calling silence a disagreement", !/distint|desacuerdo|no le interesa/i.test(line), line);
  check(
    "the short marker stands down so the row carries one indicator, not two",
    (await page.locator(".selection-list__interest-marker").count()) === 0
  );
  const status = (await page.locator(".selection-panel__filter-status").innerText()).trim();
  check("a status line states what is shown", status.length > 0, status);
  check("and says outright that nobody has refused", /nadie ha dicho que no/i.test(status), status);

  // ── C. the same state, read by the other person ──────────────────────────────────────────────
  await beTraveller(page, 1);
  await openPanel(page);
  await pressFilter(page, "Sólo uno");
  line = (await page.locator(".selection-list__divergence").first().innerText()).trim();
  check("the same place reads as the other person's from P2's chair", /sólo .* lo guardó/i.test(line), line);
  check("and says that YOU have not spoken", /tú aún no has opinado/i.test(line), line);
  const docBefore = await readJson(page, TRAVELLERS_KEY);

  // ── H. no explicit disagreement exists, and the app says so ──────────────────────────────────
  await pressFilter(page, "Todo");
  labels = await chipLabels(page);
  check(
    "H — with nothing refused there is still no disagreement filter",
    !labels.includes("Opiniones distintas"),
    JSON.stringify(labels)
  );
  const tally = (await page.locator(".selection-panel__tally").innerText()).trim();
  check("and the tally names no desacuerdo either", !/desacuerdo/i.test(tally), tally);

  // ── D/E. an explicit refusal, from the detail ────────────────────────────────────────────────
  await cards.nth(1).locator(".place-card__open").click();
  await page.waitForTimeout(700);
  await page.locator(".place-interest__decline").click();
  await page.waitForTimeout(500);
  await closeDetail(page);
  await openPanel(page);

  labels = await chipLabels(page);
  check("D — a refusal creates the 'Opiniones distintas' filter", labels.includes("Opiniones distintas"), JSON.stringify(labels));
  check("and retires 'Sólo uno', because that place is no longer merely unanswered", !labels.includes("Sólo uno"), JSON.stringify(labels));

  await pressFilter(page, "Opiniones distintas");
  rows = await visibleRowNames(page);
  check(
    "the filter shows exactly the disputed place, and it is the one that was one-sided",
    rows.length === 1 && rows[0] === oneSidedName,
    JSON.stringify(rows)
  );
  line = (await page.locator(".selection-list__divergence").first().innerText()).trim();
  check("and words it as a difference of opinion", /opiniones distintas/i.test(line), line);
  check("naming the refusal explicitly", /no le interesa/i.test(line), line);
  check("without a score, a percentage or a winner", !/%|punt|score|afinidad|gana/i.test(line), line);
  check(
    "the place is still in the shared list, because the other person wants it",
    (await page.locator(".selection-panel__count").innerText()).trim() === "2"
  );

  // ── I. a change of stance updates the view immediately ───────────────────────────────────────
  await beTraveller(page, 1);
  await cards.nth(1).locator(".place-card__open").click();
  await page.waitForTimeout(700);
  // The same reader who refused now says they want to go: one press of the detail's own heart.
  await page.locator(".place-detail .save-button").click();
  await page.waitForTimeout(500);
  await closeDetail(page);
  await openPanel(page);

  check(
    "I — the disagreement filter is still the selected one",
    (await page.locator(".shortlist-filters__chip--active .shortlist-filters__label").innerText()).trim() ===
      "Opiniones distintas"
  );
  check(
    "I — and it now shows the explicit empty state rather than a stale row",
    (await page.locator(".selection-panel__filter-empty").count()) === 1
  );
  const empty = (await page.locator(".selection-panel__filter-empty").innerText()).trim();
  check("H — the empty state states the fact, it is not a blank", /no hay opiniones distintas/i.test(empty), empty);
  check("and explains that silence is not the same thing", /nadie ha dicho que no/i.test(empty), empty);
  check(
    "the selected chip stays visible at zero rather than vanishing under the reader",
    (await page.locator(".shortlist-filters__chip--active").count()) === 1
  );

  await pressFilter(page, "Todo");
  rows = await visibleRowNames(page);
  check("returning to 'Todo' restores the whole list", rows.length === 2, JSON.stringify(rows));

  // ── G. a one-sided place the planner already holds ───────────────────────────────────────────
  await beTraveller(page, 0);
  await cards.nth(2).locator(".place-card__save").click();
  await page.waitForTimeout(400);
  await openPanel(page);
  await page.getByRole("button", { name: /Construir recorrido/ }).click();
  await page.waitForTimeout(900);
  check("the planner opened", (await page.locator("#sequence-builder-title").count()) === 1);
  await page.getByRole("button", { name: /Distribuir por días/ }).click();
  await page.waitForTimeout(700);
  let draft = await readJson(page, DRAFT_KEY);
  const plannedIds = (draft?.days ?? []).flatMap((day) => day.placeIds);
  check("and assigned the places to days", plannedIds.length >= 3, JSON.stringify(plannedIds));
  const draftBeforeView = JSON.stringify(draft);

  await page.locator("#sequence-builder-title").locator("xpath=ancestor::*[1]").locator("button").last().click().catch(() => {});
  await page.getByRole("button", { name: /^Cerrar|Volver/ }).first().click().catch(() => {});
  await page.waitForTimeout(700);
  if ((await page.locator("#sequence-builder-title").count()) > 0) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }
  check("the planner closed", (await page.locator("#sequence-builder-title").count()) === 0);

  await openPanel(page);
  await pressFilter(page, "Sólo uno");
  const notes = await page.locator(".selection-list__planned").allInnerTexts();
  check("G — a one-sided place already on a day says so", notes.length >= 1, JSON.stringify(notes));
  check(
    "G — and says that this screen does not move it",
    notes.every((note) => /no lo cambia/i.test(note)),
    JSON.stringify(notes)
  );
  check(
    "G — it proposes no removal, no reschedule and no replacement",
    notes.every((note) => !/quita|mueve|sustitu|reemplaz|otro día/i.test(note)),
    JSON.stringify(notes)
  );

  draft = await readJson(page, DRAFT_KEY);
  check(
    "G — the planning draft is byte-for-byte what the planner left",
    JSON.stringify(draft) === draftBeforeView
  );
  check("G — and it is still V8", draft?.version === 8, String(draft?.version));
  check(
    "G — with no traveller dimension anywhere in it",
    !/traveller|persona|stance|divergen/i.test(JSON.stringify(draft))
  );

  // ── The view alters no plan, whatever the reader presses ─────────────────────────────────────
  await pressFilter(page, "Todo");
  await pressFilter(page, "Los dos");
  await pressFilter(page, "Todo");
  check(
    "pressing filters changes nothing in the draft",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBeforeView
  );
  check(
    "and nothing in the travellers document",
    JSON.stringify((await readJson(page, TRAVELLERS_KEY))?.travellers) ===
      JSON.stringify(docBefore?.travellers)
  );

  // ── J. a profile reset ───────────────────────────────────────────────────────────────────────
  await page.locator(".traveller-bar__manage").click();
  await page.waitForTimeout(500);
  const resetButton = page.getByRole("button", { name: /^Reiniciar lo que ha guardado/ }).first();
  await resetButton.click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: /^Sí, reiniciar|Confirmar/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  await openPanel(page);
  const afterReset = await readJson(page, TRAVELLERS_KEY);
  const survivors = (afterReset?.interests ?? []).length;
  check("J — a reset updates the view with the list it leaves behind", survivors === (await visibleRowNames(page)).length, `${survivors}`);
  check(
    "J — and the chips describe that list, not the old one",
    (await chipLabels(page)).length === 0 ||
      (await page.locator(".shortlist-filters__chip").count()) >= 2
  );

  // ── K/L. reload, and the storage footprint ───────────────────────────────────────────────────
  const beforeReload = JSON.stringify(await readJson(page, TRAVELLERS_KEY));
  const draftBeforeReload = JSON.stringify(await readJson(page, DRAFT_KEY));
  const keysBefore = (await storageKeys(page)).sort();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  check(
    "K — reload preserves the Block 5 document exactly",
    JSON.stringify(await readJson(page, TRAVELLERS_KEY)) === beforeReload
  );
  check(
    "K — and the planning draft exactly",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBeforeReload
  );
  check(
    "L — Block 6 adds no storage key of its own",
    JSON.stringify((await storageKeys(page)).sort()) === JSON.stringify(keysBefore),
    JSON.stringify(await storageKeys(page))
  );
  check(
    "L — and every key the app owns is one it declared before this block",
    (await storageKeys(page)).every((key) => DECLARED_KEYS.includes(key)),
    JSON.stringify(await storageKeys(page))
  );

  // ── The filter is view state, and is not persisted ───────────────────────────────────────────
  await openHub(page, "Tokio");
  await openPanel(page);
  if ((await page.locator(".shortlist-filters__chip").count()) >= 2) {
    check(
      "the list reopens on 'Todo' — a filter is not a decision worth storing",
      (await page.locator(".shortlist-filters__chip--active .shortlist-filters__label").innerText()).trim() ===
        "Todo"
    );
  } else {
    check("the list reopens with no filter to restore", true);
  }

  // ── Layout, reach and keyboard ───────────────────────────────────────────────────────────────
  // Two populated buckets, which is what makes a filter row worth offering: one place both want,
  // one place only the first of them wants.
  await beTraveller(page, 0);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 1);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 0);
  await cards.nth(1).locator(".place-card__save").click();
  await page.waitForTimeout(350);
  await openPanel(page);

  check("no horizontal page scroll", !(await pageOverflows(page)));
  const rowOverflow = await page.evaluate(() => {
    const row = document.querySelector(".shortlist-filters");
    if (!row) return false;
    // The row itself may scroll; what must not happen is it widening its parent.
    const parent = row.parentElement;
    return parent ? row.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1 : false;
  });
  check("the filter row never widens the panel it sits in", !rowOverflow);

  const small = await smallTargets(page, ".selection-panel");
  check(
    "every control in the saved list meets its tap floor",
    small.length === 0,
    JSON.stringify(small)
  );
  // Block 6's OWN controls take the full 44px with no allowance at all.
  const smallChips = await page.evaluate(() =>
    [...document.querySelectorAll(".shortlist-filters__chip")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => Math.min(r.width, r.height) + 0.5 < 44)
      .map((r) => ({ w: Math.round(r.width), h: Math.round(r.height) }))
  );
  check("and every filter chip meets the full 44px floor", smallChips.length === 0, JSON.stringify(smallChips));

  const truncated = await page.evaluate(() =>
    [...document.querySelectorAll(".shortlist-filters__chip")].some(
      (el) => el.scrollWidth > el.clientWidth + 1
    )
  );
  check("no chip truncates its own label", !truncated);

  const chipCount = await page.locator(".shortlist-filters__chip").count();
  if (chipCount >= 2) {
    const names = await page.locator(".shortlist-filters__chip").evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label"))
    );
    check("every chip has an accessible name", names.every((n) => n && n.length > 0), JSON.stringify(names));
    check("and the names are unique", new Set(names).size === names.length, JSON.stringify(names));
    check(
      "the counts are inside the accessible name, not only in a bare badge",
      names.every((n) => /\d/.test(n)),
      JSON.stringify(names)
    );
    check(
      "exactly one chip is pressed at a time",
      (await page.locator('.shortlist-filters__chip[aria-pressed="true"]').count()) === 1
    );
    const group = page.locator(".shortlist-filters");
    check('the row is a labelled group', (await group.getAttribute("role")) === "group");
    check("with a label that says what it filters", /filtrar/i.test((await group.getAttribute("aria-label")) ?? ""));

    // Keyboard: reach a chip by tabbing and activate it with the keyboard alone.
    // `:focus-visible` is what draws the ring, and Chromium only matches it for KEYBOARD focus —
    // so the chip is reached by tabbing off the one before it, as a reader would.
    await page.locator(".shortlist-filters__chip").first().focus();
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.classList.contains("shortlist-filters__chip")) return { onChip: false };
      const style = getComputedStyle(el);
      return {
        onChip: true,
        ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      };
    });
    check("tabbing reaches the next chip", focusVisible.onChip === true);
    check("and a keyboard-focused chip draws a visible ring", focusVisible.ring === true);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    check(
      "and the keyboard alone can apply a filter",
      (await page.locator('.shortlist-filters__chip[aria-pressed="true"]').count()) === 1
    );

    // Colour is never the only difference between pressed and unpressed.
    const distinguishable = await page.evaluate(() => {
      const on = document.querySelector(".shortlist-filters__chip--active");
      const off = [...document.querySelectorAll(".shortlist-filters__chip")].find(
        (el) => !el.classList.contains("shortlist-filters__chip--active")
      );
      if (!on || !off) return true;
      const a = getComputedStyle(on);
      const b = getComputedStyle(off);
      return a.fontWeight !== b.fontWeight || a.borderColor !== b.borderColor || a.boxShadow !== b.boxShadow;
    });
    check("pressed and unpressed differ by more than hue", distinguishable);
    await pressFilter(page, "Todo");
  } else {
    for (const skipped of [
      "every chip has an accessible name",
      "and the names are unique",
      "the counts are inside the accessible name, not only in a bare badge",
      "exactly one chip is pressed at a time",
      "the row is a labelled group",
      "with a label that says what it filters",
      "tabbing reaches the next chip",
      "and a keyboard-focused chip draws a visible ring",
      "and the keyboard alone can apply a filter",
      "pressed and unpressed differ by more than hue",
    ]) {
      check(skipped, false, "no filter row was present");
    }
  }

  // Reduced motion: the chip declares no transition to fight.
  const reducedContext = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await reducedPage.goto(url, { waitUntil: "domcontentloaded" });
  await reducedPage.waitForTimeout(800);
  const reduced = await reducedPage.evaluate(() => {
    const probe = document.createElement("button");
    probe.className = "shortlist-filters__chip";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    // Chromium's reduced-motion emulation clamps every duration to ~1e-06s, so the DURATION alone
    // cannot tell an honest `transition: none` from an emulated one. The PROPERTY can.
    const value = { property: style.transitionProperty, duration: style.transitionDuration };
    probe.remove();
    return value;
  });
  check(
    "reduced motion leaves the chip with no transition to run",
    reduced.property === "none",
    JSON.stringify(reduced)
  );
  await reducedContext.close();

  // ── The default view is comprehensible without knowing the architecture ──────────────────────
  const panelText = (await page.locator(".selection-panel__content").innerText()).toLowerCase();
  check(
    "the list never exposes an internal name to the reader",
    !/divergence|shortlist|stance|carriedover|traveller(id)?\b|only-them|only-you/.test(panelText),
    panelText.slice(0, 160)
  );
  check(
    "and never a percentage, a score or a ranking",
    !/%|score|afinidad|compatib|ranking|puntuaci/i.test(panelText)
  );
  check(
    "and no judgement about the two people",
    !/conflicto|deberíais|os conviene|mejor opción|ceder/i.test(panelText)
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 6 divergence audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 6 divergence audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
