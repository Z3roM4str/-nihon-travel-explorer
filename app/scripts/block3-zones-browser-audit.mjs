import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 3 Phase B — accommodation-zone comparison browser audit, against the production build.
 *
 * What it proves that component tests cannot: the comparison is usable at real viewports, it
 * never introduces horizontal scrolling (neither on the page nor inside the panel), its
 * controls are thumb-sized, keyboard and Escape behave, the selection persists, and the three
 * kinds of statement — sourced fact, derived geometry, editorial judgement — stay visibly
 * distinct where a reader can see them.
 *
 * Usage: node scripts/block3-zones-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
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
const PORT = 4320;

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

/** Case-tolerant contains: several headings are uppercased by CSS, and `innerText` reports
 * what is rendered rather than what the source wrote. */
function containsText(haystack, needle) {
  return haystack.toLocaleUpperCase("es").includes(needle.toLocaleUpperCase("es"));
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const panel = document.querySelector(".zone-panel__scroll");
    return {
      page: doc.scrollWidth > doc.clientWidth + 1,
      panel: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
    };
  });
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

  // ---- Reachable from the hub, and only where zones exist ----
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1300);
  check("the hub bar offers 'Dónde dormir'", (await page.locator(".hub-bar__zones").count()) === 1);

  // Save two Tokyo places so the fit has something real to measure.
  for (let i = 0; i < 2; i += 1) {
    await page.locator(".place-card__save").nth(i).click();
    await page.waitForTimeout(250);
  }

  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(800);

  check("the panel opens as a dialog", (await page.locator('.zone-panel[role="dialog"]').count()) === 1);
  const cards = await page.locator(".zone-card").count();
  check("Tokio offers 4–7 real alternatives", cards >= 4 && cards <= 7, `${cards}`);
  check(
    "the panel refuses to call any zone the best",
    !(await page.locator(".zone-panel__sub").innerText()).match(/la mejor(?!")/i)
  );
  check(
    "it says the ordering comes from the saved list",
    (await page.locator(".zone-panel__note").innerText()).includes("guardado")
  );
  check(
    "it states the distance is straight-line, not travel time",
    (await page.locator(".zone-panel__note").innerText()).includes("línea recta")
  );

  let overflow = await noOverflow(page);
  check("browse view has no horizontal overflow", !overflow.page && !overflow.panel, JSON.stringify(overflow));

  // ---- Selection ----
  check("comparing is disabled until two are chosen", await page.getByRole("button", { name: "Comparar" }).last().isDisabled());
  await page.locator(".zone-card__compare input").nth(0).check();
  await page.waitForTimeout(200);
  check("one selection is still not a comparison", await page.getByRole("button", { name: "Comparar" }).last().isDisabled());
  await page.locator(".zone-card__compare input").nth(2).check();
  await page.waitForTimeout(250);
  check("two selections enable the comparison", !(await page.getByRole("button", { name: "Comparar" }).last().isDisabled()));
  check(
    "the count is announced",
    (await page.locator(".zone-panel__count").innerText()).includes("2")
  );

  // A fourth selection is the cap; a fifth must be refused.
  await page.locator(".zone-card__compare input").nth(1).check();
  await page.locator(".zone-card__compare input").nth(3).check();
  await page.waitForTimeout(250);
  check("the fifth checkbox is disabled at the cap", await page.locator(".zone-card__compare input").nth(4).isDisabled());
  await page.locator(".zone-card__compare input").nth(1).uncheck();
  await page.locator(".zone-card__compare input").nth(3).uncheck();
  await page.waitForTimeout(250);
  check("unchecking releases the cap", !(await page.locator(".zone-card__compare input").nth(4).isDisabled()));

  // ---- Comparison ----
  await page.getByRole("button", { name: "Comparar" }).last().click();
  await page.waitForTimeout(1400);
  check("the comparison renders one block per zone", (await page.locator(".zone-column").count()) === 2);
  check("a map places the zones geographically", (await page.locator(".zone-map").count()) === 1);

  const columnText = await page.locator(".zone-column").first().innerText();
  check("facts are labelled as verifiable", containsText(columnText, "verificables"));
  check("derived geometry is labelled as calculated", containsText(columnText, "calculado"));
  check("editorial judgement is labelled as criterio", containsText(columnText, "criterio"));
  check("each zone links its source", (await page.locator(".zone-column__provenance a").count()) >= 2);
  check("each zone states what it costs", (await page.locator(".zone-tradeoffs li").count()) >= 4);
  check(
    "the contrast section names where they differ",
    (await page.locator(".zone-contrast").count()) > 0 ||
      (await page.locator(".zone-contrasts__empty").count()) === 1
  );
  check(
    "a neutral axis is marked as neither good nor bad",
    (await page.locator(".zone-contrasts").innerText()).includes("ni bueno ni malo") ||
      (await page.locator(".zone-contrast").count()) === 0
  );
  check("the full ten axes stay behind a disclosure", (await page.locator(".zone-axes").count()) === 1);
  check("the disclosure starts closed", !(await page.locator(".zone-axes__list").isVisible()));

  overflow = await noOverflow(page);
  check("comparison has no horizontal overflow", !overflow.page && !overflow.panel, JSON.stringify(overflow));

  // ---- Tap targets across the open panel ----
  const small = await page.evaluate((min) => {
    const bad = [];
    for (const el of document.querySelectorAll(".zone-panel button, .zone-panel label, .zone-panel summary")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest(".leaflet-control-container")) continue;
      if (Math.min(r.width, r.height) + 0.5 < min) {
        bad.push({ cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return bad;
  }, MIN_TAP_PX);
  check("every control in the panel meets the tap floor", small.length === 0, JSON.stringify(small));

  // ---- Keyboard ----
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Escape steps back to the zone list, not out of the panel", (await page.locator(".zone-card").count()) > 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("a second Escape closes the panel", (await page.locator(".zone-panel").count()) === 0);

  // ---- Persistence, and the saved-places system still intact ----
  check("saving places still works underneath", (await page.locator(".selection-panel__count").innerText()).trim() === "2");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(700);
  const restored = await page.locator(".zone-card__compare input:checked").count();
  check("the comparison selection survives a reload", restored === 2, `${restored}`);

  // ---- Degrades honestly with nothing saved ----
  // Block 5 moved the shortlist's owner: it is now DERIVED from `nihon.travellers.v1`, and
  // `nihon.savedPlaceIds` is only the legacy key read once during migration. Clearing the old key
  // alone would leave the list intact and this check would never reach the empty state it exists
  // to prove. Both are removed so the audit keeps working whichever owner a build has.
  await page.evaluate(() => {
    localStorage.removeItem("nihon.savedPlaceIds");
    localStorage.removeItem("nihon.travellers.v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);
  await page.locator(".hub-bar__zones").click();
  await page.waitForTimeout(700);
  check(
    "with nothing saved it invites saving instead of inventing a ranking",
    (await page.locator(".zone-panel__note--muted").count()) === 1
  );
  check("no zone claims a distance it cannot measure", (await page.locator(".zone-card__fit").count()) === 0);

  // ---- A hub without zones offers no entry point ----
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Sapporo" }).click();
  await page.waitForTimeout(900);
  check("a hub with no modelled zones hides the control", (await page.locator(".hub-bar__zones").count()) === 0);

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 3 accommodation-zone audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 3 zone audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
