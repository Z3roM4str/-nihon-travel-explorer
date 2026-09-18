import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 12 — bundle architecture, browser audit against the PRODUCTION build.
 *
 * Block 12 moved two surfaces out of the entry chunk: the planner and the zone comparison. A green
 * build proves nothing about that, which is exactly why this audit exists — `vite build` is happy
 * to emit a chunk that 404s at runtime, and a lazy route that fails does so silently behind a
 * `fallback={null}`. Everything here is about the one question a bundler cannot answer: **does the
 * app still work when the code arrives later, or over a second request that can fail?**
 *
 * So it proves, at each viewport: the cold load is clean; every JavaScript request the browser
 * makes returns 200, including the two deferred chunks; both deferred surfaces really open and
 * really render their content; closing and reopening them works, because a `React.lazy` that
 * resolved once must not be re-fetched or re-suspended; and nothing about splitting leaked into
 * the console.
 *
 * It also pins the two architectural facts the split depends on, measured from the network rather
 * than from the build output: **more than one JS file is served** (the boundary is real, not a
 * config that silently collapsed back into one chunk), and **the deferred chunks are not part of
 * the initial critical path** — they arrive after first paint, via the idle prefetch or the click,
 * never as a blocking `modulepreload` in the document head.
 *
 * Usage: node scripts/block12-bundle-architecture-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
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
const PORT = 4329;

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
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
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
  /** Every JS request the browser actually made, with its status. The heart of this audit. */
  const jsRequests = [];
  const failedRequests = [];

  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Tile servers are unreachable in this sandbox and are not Block 12's business; Block 10's
    // audit filters the same two families for the same reason.
    if (/ERR_CERT|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.startsWith(url) && /\.js(\?|$)/.test(u)) {
      jsRequests.push({ url: u.replace(url, ""), status: r.status() });
    }
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(url)) failedRequests.push(`${r.url().replace(url, "")}: ${r.failure()?.errorText}`);
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage on this document */
    }
  });

  // ── 1. Cold load ─────────────────────────────────────────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  check("the app mounted on a cold load", (await page.locator("#root > *").count()) > 0);
  check("cold load raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("cold load logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("no request to this origin failed", failedRequests.length === 0, failedRequests.join(" | "));

  // The first screen is the national view. If splitting had moved the map off the critical path,
  // this is what would have regressed — so it is asserted before anything is opened.
  check(
    "the first screen still renders the national map without waiting for a second chunk",
    (await page.locator(".leaflet-container").count()) >= 1
  );

  const modulePreloads = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((l) => l.getAttribute("href") ?? "")
  );
  check(
    "no deferred surface is pulled into the document's critical path",
    !modulePreloads.some((h) => /OrderedSequenceBuilder|ZoneComparison/.test(h)),
    modulePreloads.join(" | ")
  );

  // ── 2. The boundary is real ──────────────────────────────────────────────────────────────────
  // Measured from the network, not the build: a config that silently collapsed back to one chunk
  // would still build green, and this is what would catch it.
  await page.waitForTimeout(2200); // let the idle prefetch run
  const distinctJs = new Set(jsRequests.map((r) => r.url));
  check(
    "more than one JS file is served, so the split did not collapse",
    distinctJs.size >= 2,
    [...distinctJs].join(" | ")
  );
  check(
    "every JS request returned 200 — no chunk 404s",
    jsRequests.every((r) => r.status === 200),
    jsRequests.filter((r) => r.status !== 200).map((r) => `${r.url}:${r.status}`).join(" | ")
  );

  // ── 3. The planner, whose chunk is the whole point of the split ──────────────────────────────
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);
  check("a hub opened", (await page.locator(".place-card").count()) > 0);

  for (let i = 0; i < 2; i += 1) {
    const save = page.locator(".place-card__save").nth(i);
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await page.waitForTimeout(200);
    }
  }

  // The planner lives behind the saved-places panel: open that first, exactly as a person would.
  const selectionToggle = page.locator(".selection-panel__toggle");
  if ((await selectionToggle.count()) > 0 && (await selectionToggle.getAttribute("aria-expanded")) !== "true") {
    await selectionToggle.click();
    await page.waitForTimeout(500);
  }
  const plannerButton = page.locator(".selection-panel__analyze").first();
  const hasPlannerButton = (await plannerButton.count()) > 0;
  check("the planner can be reached from the saved-places panel", hasPlannerButton);
  if (hasPlannerButton) {
    await plannerButton.click();
    // Deliberately generous: this is the wait a real person would experience if the prefetch had
    // not already landed, and the point is that the surface arrives, not how fast.
    await page.waitForSelector("#sequence-builder-title", { timeout: 10000 }).catch(() => {});
    check("the deferred planner really opened", (await page.locator("#sequence-builder-title").count()) === 1);
    check("opening the planner raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
    check("opening the planner 404ed no chunk", jsRequests.every((r) => r.status === 200));
    let o = await noOverflow(page);
    check("the planner introduced no horizontal overflow", !o.page);

    // Close and reopen: a lazy component that resolved once must not suspend again.
    const close = page.getByRole("button", { name: /Cerrar|Volver/ }).first();
    if ((await close.count()) > 0) {
      await close.click();
      await page.waitForTimeout(600);
      check("the planner closed", (await page.locator("#sequence-builder-title").count()) === 0);
      await plannerButton.click();
      await page.waitForTimeout(700);
      check(
        "reopening the planner works, and does not re-suspend",
        (await page.locator("#sequence-builder-title").count()) === 1
      );
      const reclose = page.getByRole("button", { name: /Cerrar|Volver/ }).first();
      if ((await reclose.count()) > 0) {
        await reclose.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // ── 4. The zone comparison, the second deferred surface ──────────────────────────────────────
  const zonesButton = page.locator(".hub-bar__zones");
  const hasZones = (await zonesButton.count()) > 0;
  check("the zone comparison can be reached", hasZones);
  if (hasZones) {
    await zonesButton.click();
    await page.waitForSelector(".zone-card", { timeout: 10000 }).catch(() => {});
    check("the deferred zone comparison really opened", (await page.locator(".zone-card").count()) > 0);
    check("opening the comparison raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
    const o = await noOverflow(page);
    check("the comparison introduced no horizontal overflow", !o.page);
  }

  // ── 5. Nothing leaked ────────────────────────────────────────────────────────────────────────
  check("no JS request failed across the whole session", failedRequests.length === 0, failedRequests.join(" | "));
  check("every JS request across the session returned 200", jsRequests.every((r) => r.status === 200));
  check("the session logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("the session raised no page error", pageErrors.length === 0, pageErrors.join(" | "));

  // A reload with a warm cache must behave identically — the split must not depend on a cold cache.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  check("a repeat load still mounts", (await page.locator("#root > *").count()) > 0);
  check("a repeat load raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("a repeat load 404ed no chunk", jsRequests.every((r) => r.status === 200));

  await context.close();
}

console.log("Block 12 bundle-architecture audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 12 bundle-architecture audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
