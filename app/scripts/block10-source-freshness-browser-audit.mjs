import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 10 — source freshness, browser audit against the PRODUCTION build.
 *
 * Block 10 defined what `consultedAt` means and what it means for it to have aged. The visible
 * consequence is deliberately conditional: a discreet note appears beside a source that is past the
 * horizon its claims deserve, and **with today's dataset that is none of them** — every one of the
 * 35 provenance records was checked within a fortnight.
 *
 * So this audit's central job is to prove the *negative*: that a freshness policy exists without
 * putting a single alarm on screen, that the everyday source line is exactly what Block 7 left,
 * and that nothing about ageing leaked into the tier, the ratings or storage. The positive side —
 * that the note appears, and on exactly the right day — is proven at its boundaries in
 * `lib/source-freshness.test.ts`, where `today` can be injected. Shipping a deliberately stale
 * record to exercise a view would be corrupting the dataset to test a colour.
 *
 * Usage: node scripts/block10-source-freshness-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
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
const PORT = 4327;
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
    await page
      .locator(".zone-card")
      .filter({ has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) })
      .first()
      .locator(".zone-card__compare input")
      .check();
    await page.waitForTimeout(200);
  }
  const chosen = await page.locator(".zone-card__compare input:checked").count();
  assert.equal(chosen, zoneNames.length, `expected ${zoneNames.length} zones selected, got ${chosen}`);
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

  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage on this document */
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  // Namba is the zone whose station article backs infrastructure alone, so it exercises the
  // "no periodic re-check" branch; Shinjuku carries both an operator and an encyclopedia source.
  await openComparisonFor(page, "Osaka", ["Namba / Minami", "Umeda / Kita"]);
  check("the comparison renders one column per zone", (await page.locator(".zone-column").count()) === 2);

  // ── No alarm appears, because nothing is due ────────────────────────────────────────────────
  check(
    "no source carries a re-check note, because every check is recent",
    (await page.locator(".zone-source__recheck").count()) === 0
  );
  const provenanceText = (await page.locator(".zone-column__provenance").allInnerTexts())
    .map((t) => t.replace(/\s+/g, " ").trim())
    .join(" | ");
  check(
    "the source line is exactly what Block 7 left: name and tier, nothing more",
    /^Fuentes?: .+\((operador|fuente secundaria)\)/.test(provenanceText),
    provenanceText.slice(0, 140)
  );
  check("no raw date is pushed into the visible line", !/\d{4}-\d{2}-\d{2}/.test(provenanceText), provenanceText.slice(0, 140));
  check(
    "and no alarming word appears anywhere on the card",
    !/caducad|obsolet|inválid|invalid|error|no fiable|desactualizad/i.test(
      (await page.locator(".zone-column").first().innerText()).toLowerCase()
    )
  );

  // ── The date and its meaning reach assistive technology ─────────────────────────────────────
  const links = page.locator(".zone-source__link");
  const labels = await links.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  check("every source link still has an accessible name", labels.every((l) => l && l.length > 0), JSON.stringify(labels));
  check(
    "which still carries the consultation date",
    labels.every((l) => /consultada el \d{4}-\d{2}-\d{2}/.test(l ?? "")),
    JSON.stringify(labels.slice(0, 1))
  );
  check(
    "and now says what that date means",
    labels.every((l) => /(comprobada recientemente|no necesita comprobaciones periódicas|conviene volver a comprobarla)/.test(l ?? "")),
    JSON.stringify(labels.slice(0, 2))
  );
  check(
    "every accessible name is still unique",
    new Set(labels).size === labels.length,
    JSON.stringify(labels)
  );
  check(
    "a source backing infrastructure alone says it needs no periodic check",
    labels.some((l) => /no necesita comprobaciones periódicas/.test(l ?? "")),
    JSON.stringify(labels)
  );
  check(
    "and a source backing airport links says it was checked recently",
    labels.some((l) => /comprobada recientemente/.test(l ?? "")),
    JSON.stringify(labels)
  );

  // ── Freshness never touches authority, nor the ratings ──────────────────────────────────────
  check(
    "the tier is still stated in words on every source",
    (await page.locator(".zone-source__tier").count()) === labels.length
  );
  const tiers = (await page.locator(".zone-source__tier").allInnerTexts()).map((t) => t.trim());
  check(
    "an old encyclopedia is still secondary and a fresh airport still the operator",
    tiers.some((t) => /operador/.test(t)) && tiers.some((t) => /fuente secundaria/.test(t)),
    JSON.stringify(tiers)
  );
  check(
    "no freshness wording leaked into the tier",
    tiers.every((t) => !/comprob|recient|revisar/i.test(t)),
    JSON.stringify(tiers)
  );
  await page.locator(".zone-axes > summary").click();
  await page.waitForTimeout(400);
  const ratings = (await page.locator(".zone-axes").innerText()).toLowerCase();
  check(
    "the editorial ratings say nothing about freshness — they carry no source at all",
    !/comprobad|consultad|revisar|\d{4}-\d{2}-\d{2}/.test(ratings),
    ratings.slice(0, 140)
  );

  // ── Layout and interaction are unchanged ────────────────────────────────────────────────────
  check(
    "no horizontal page scroll",
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1))
  );
  const widened = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column__provenance")].some((el) => {
      const parent = el.parentElement;
      return parent ? el.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1 : false;
    })
  );
  check("the source line never widens its column", !widened);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column__provenance")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 40))
  );
  check("nothing in the source line is clipped", clipped.length === 0, JSON.stringify(clipped));

  await links.first().focus();
  check(
    "a source link still takes focus",
    await page.evaluate(() => String(document.activeElement?.className ?? "").includes("zone-source__link"))
  );
  check(
    "and still opens in a new tab with rel=noreferrer",
    await links.evaluateAll((els) =>
      els.every((el) => el.getAttribute("target") === "_blank" && (el.getAttribute("rel") ?? "").includes("noreferrer"))
    )
  );

  // ── Nothing about freshness is written anywhere ─────────────────────────────────────────────
  const draftBefore = JSON.stringify(await readJson(page, DRAFT_KEY));
  const keysBefore = (await storageKeys(page)).sort();
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
  await page.waitForTimeout(400);
  await page.locator(".zone-axes > summary").click();
  await page.waitForTimeout(300);
  await page.locator(".zone-axes > summary").click();
  await page.waitForTimeout(300);
  check(
    "opening a source and toggling the ratings writes no planning decision",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBefore
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

  // ── A Tokyo hub reads the same way ──────────────────────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openComparisonFor(page, "Tokio", ["Shinjuku", "Asakusa"]);
  check(
    "Tokio shows no re-check note either",
    (await page.locator(".zone-source__recheck").count()) === 0
  );
  const tokyoLabels = await page
    .locator(".zone-source__link")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  check(
    "and every Tokio source states its freshness",
    tokyoLabels.every((l) => /(comprobada recientemente|no necesita comprobaciones periódicas)/.test(l ?? "")),
    JSON.stringify(tokyoLabels.slice(0, 2))
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 10 source-freshness audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 10 source-freshness audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
