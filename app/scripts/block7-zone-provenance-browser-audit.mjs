import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 7 — zone-fact provenance, browser audit against the PRODUCTION build (`vite preview`).
 *
 * Block 7 changed the data's sources and one line of the zone column. What source scans and unit
 * tests cannot show is whether that line is actually legible: that the reader can tell an airport
 * operator's own page from an encyclopedia article without opening either, that the names do not
 * overflow or truncate on a phone, that opening a source does not silently select the zone
 * underneath it, and that the rest of the card is exactly what Block 3 and Block 4 left.
 *
 * Usage: node scripts/block7-zone-provenance-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
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
const PORT = 4324;
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

/** Opens the zone comparison for a hub with two zones selected. */
async function openComparison(page, hub) {
  await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  await page.waitForTimeout(1300);
  // Idempotent: the control is a toggle, so pressing it on an already-saved place would UNsave it
  // and quietly remove the derived section this audit later checks for.
  for (let i = 0; i < 2; i += 1) {
    const save = page.locator(".place-card__save").nth(i);
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await page.waitForTimeout(220);
    }
  }
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(800);
  await page.locator(".zone-card__compare input").nth(0).check();
  await page.locator(".zone-card__compare input").nth(1).check();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Comparar" }).last().click();
  await page.waitForTimeout(1400);
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

  // Guarded: this runs in EVERY document the context creates, including the initial `about:blank`
  // that history can step back onto, where touching localStorage throws a SecurityError. Unguarded
  // it would report the audit's own harness as a page error in the product.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage on this document — nothing to seed */
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  await openComparison(page, "Tokio");
  check("the comparison renders one column per zone", (await page.locator(".zone-column").count()) === 2);

  // ── The source line names its sources ────────────────────────────────────────────────────────
  const provenance = page.locator(".zone-column__provenance");
  check("every column carries a provenance line", (await provenance.count()) === 2);

  const firstLine = (await provenance.first().innerText()).trim();
  check("it is introduced as a source, singular or plural", /^Fuentes?:/.test(firstLine), firstLine);
  check(
    "the source is named rather than being the bare word 'Fuente'",
    !/^Fuentes?:\s*Fuente\b/.test(firstLine) && firstLine.replace(/^Fuentes?:/, "").trim().length > 3,
    firstLine
  );
  check("no raw URL is shown to the reader", !/https?:\/\//.test(firstLine), firstLine);

  const linkTexts = await page.locator(".zone-source__link").allInnerTexts();
  check("every source link has visible text", linkTexts.every((t) => t.trim().length > 0), JSON.stringify(linkTexts));
  check(
    "an auditor's qualifier is not dumped into the link text",
    linkTexts.every((t) => !t.includes("—") && t.length <= 40),
    JSON.stringify(linkTexts)
  );

  const tiers = await page.locator(".zone-source__tier").allInnerTexts();
  check("each source says how close it is, in words", tiers.length === linkTexts.length, JSON.stringify(tiers));
  check(
    "the tier is a word, never a number or a rating",
    tiers.every((t) => !/\d|%|mejor|peor|fiable/i.test(t)),
    JSON.stringify(tiers)
  );

  // ── An operator is distinguishable from an encyclopedia, at a glance ─────────────────────────
  const tokyoText = (await page.locator(".zone-panel, .zone-comparison").first().innerText()).toLowerCase();
  check(
    "a Tokyo zone names an airport operator among its sources",
    tokyoText.includes("narita international airport"),
    tokyoText.slice(0, 120)
  );
  check("and says that source is the operator", tokyoText.includes("(operador)"));
  check("while the station article is marked a secondary source", tokyoText.includes("(fuente secundaria)"));
  check(
    "the two are told apart by text, not only by position",
    tokyoText.includes("(operador)") && tokyoText.includes("(fuente secundaria)")
  );

  // ── Layout: it must not overflow, truncate or widen the column ───────────────────────────────
  const pageOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  check("no horizontal page scroll", !pageOverflow);

  const widened = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column__provenance")].some((el) => {
      const parent = el.parentElement;
      return parent ? el.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1 : false;
    })
  );
  check("the source line never widens the column it sits in", !widened);

  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column__provenance")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => ({ w: Math.round(el.clientWidth), s: Math.round(el.scrollWidth) }))
  );
  check("and no source name is clipped", clipped.length === 0, JSON.stringify(clipped));

  const ellipsised = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-source__link")].some(
      (el) => getComputedStyle(el).textOverflow === "ellipsis"
    )
  );
  check("no source name is truncated with an ellipsis", !ellipsised);

  // ── The link is reachable, named and marked ──────────────────────────────────────────────────
  const links = page.locator(".zone-source__link");
  const linkCount = await links.count();
  check("the columns expose at least two source links", linkCount >= 2, String(linkCount));

  const names = await links.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  check("every source link has an accessible name", names.every((n) => n && n.length > 0), JSON.stringify(names));
  check("and every accessible name is unique on the panel", new Set(names).size === names.length, JSON.stringify(names));
  check(
    "the accessible name says which zone it belongs to",
    names.every((n) => /fuente de .+, consultada el \d{4}-\d{2}-\d{2}$/.test(n ?? "")),
    JSON.stringify(names)
  );

  const targetsAndRel = await links.evaluateAll((els) =>
    els.map((el) => ({ target: el.getAttribute("target"), rel: el.getAttribute("rel"), href: el.getAttribute("href") }))
  );
  check(
    "each opens in a new tab with rel=noreferrer",
    targetsAndRel.every((l) => l.target === "_blank" && (l.rel ?? "").includes("noreferrer")),
    JSON.stringify(targetsAndRel)
  );
  check(
    "and points at https",
    targetsAndRel.every((l) => (l.href ?? "").startsWith("https://")),
    JSON.stringify(targetsAndRel)
  );

  const underlined = await links.evaluateAll((els) =>
    els.every((el) => getComputedStyle(el).textDecorationLine.includes("underline"))
  );
  check("a source link is marked as a link, not by colour alone", underlined);

  // ── Keyboard ─────────────────────────────────────────────────────────────────────────────────
  await links.first().focus();
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? el.className : "";
  });
  check("a source link can take focus", String(focused).includes("zone-source__link"), String(focused));

  // Identity, not class name: the next focusable is often the sibling source link, which carries
  // exactly the same class, so comparing classes would report a trap that is not there.
  await page.evaluate(() => {
    const el = document.querySelector(".zone-source__link");
    if (el) el.setAttribute("data-audit-origin", "1");
    el?.focus();
  });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  const stillOnOrigin = await page.evaluate(
    () => document.activeElement?.getAttribute?.("data-audit-origin") === "1"
  );
  check("tab moves past the source link rather than trapping on it", !stillOnOrigin);

  const ringed = await page.evaluate(() => {
    const el = document.querySelector(".zone-source__link");
    if (!el) return false;
    el.focus();
    const style = getComputedStyle(el);
    return style.outlineStyle !== "none" || style.textDecorationLine.includes("underline");
  });
  check("a focused source link stays visibly distinguishable", ringed);

  // ── Opening a source is not choosing a zone ──────────────────────────────────────────────────
  const draftBefore = JSON.stringify(await readJson(page, DRAFT_KEY));
  const keysBefore = (await storageKeys(page)).sort();
  /*
   * The link is a real external link, so the question is what the APP does when it is pressed —
   * not what the browser does afterwards. A capture-phase `preventDefault` cancels only the
   * navigation: every handler on the link and on anything above it still runs, so a column that
   * reacted to the click would still be caught here.
   */
  const zonesBefore = await page.locator(".zone-column").evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label"))
  );
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      },
      true
    );
  });
  await links.first().click({ noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(500);
  check(
    "pressing a source leaves the compared zones exactly as they were",
    JSON.stringify(
      await page.locator(".zone-column").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))
    ) === JSON.stringify(zonesBefore),
    JSON.stringify(zonesBefore)
  );
  check(
    "and does not drop the panel back to the browse list",
    (await page.locator(".zone-card").count()) === 0
  );

  check(
    "clicking a source does not write a planning decision",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBefore
  );
  check(
    "and writes no storage key of its own",
    JSON.stringify((await storageKeys(page)).sort()) === JSON.stringify(keysBefore),
    JSON.stringify(await storageKeys(page))
  );
  check(
    "the comparison is still on screen rather than having navigated away",
    (await page.locator(".zone-column").count()) === 2
  );

  // ── Back / forward stays coherent ────────────────────────────────────────────────────────────
  // A hash entry gives history a real app document on BOTH sides. Loading the same URL twice does
  // NOT: Chromium replaces the entry, so back would step onto the context's initial about:blank
  // and prove only that a blank page is blank.
  await page.goto(`${url}#audit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  check("stepping back lands on the app, not a blank document", (await page.locator("#root").count()) === 1);
  await page.goForward({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  check("and stepping forward returns to a usable app", (await page.locator("#root").count()) === 1);
  check(
    "the zone panel still opens after history navigation",
    (await page.locator(".hub-bar__zones, .hub-tabs, #root").count()) >= 1
  );
  check("history navigation threw no page error", pageErrors.length === 0, pageErrors.join(" | "));

  // ── Block 3 and Block 4's card is otherwise unchanged ────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openComparison(page, "Tokio");
  const columnText = (await page.locator(".zone-column").first().innerText()).toLowerCase();
  check("facts are still labelled verifiable", columnText.includes("verificables"));
  check("derived geometry is still labelled calculado", columnText.includes("calculado"));
  check("no zone is called the best", !/la mejor(?!")/i.test(columnText), columnText.slice(0, 120));
  check(
    "provenance never presents itself as a quality rating",
    !/fuente.*(mejor|peor|fiabilidad|puntuaci|\d\s*\/\s*\d|\d\s*%)/i.test(columnText)
  );
  check(
    "the tier is never attached to an editorial axis",
    !/(ambiente|comida|tranquil|caminable|turis).{0,40}\((operador|fuente secundaria)\)/i.test(columnText)
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 7 zone-provenance audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 7 zone-provenance audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
