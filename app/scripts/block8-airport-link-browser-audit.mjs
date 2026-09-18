import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 8 — the meaning of `directFromZone`, browser audit against the PRODUCTION build.
 *
 * Block 8 did not change what the field means; it wrote the meaning down, split the records that
 * could not express it, and made the panel say it. What source scans and unit tests cannot show is
 * whether the reader can now tell a direct coach from a direct train without knowing the schema,
 * whether a zone offering both answers for one airport renders both, and whether the longer labels
 * still fit a phone.
 *
 * Usage: node scripts/block8-airport-link-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
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
const PORT = 4325;
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
  return page.evaluate(() => {
    try {
      return Object.keys(localStorage).filter((key) => key.startsWith("nihon."));
    } catch {
      return [];
    }
  });
}

/** Opens the zone comparison for a hub with the two named zones selected, by their visible name. */
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
    /*
     * Matched on the card's own <h3>, not on the card. `hasText` is a substring match over the
     * whole element, and several Kioto summaries mention "la estación de Kioto" — so selecting by
     * card text silently picked the wrong zone, or the same one twice.
     */
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

  // Shinjuku is the zone the block was opened by: a direct coach to Haneda AND a rail route with
  // a change. Ikebukuro is the same shape with no direct train at all.
  await openComparisonFor(page, "Tokio", ["Shinjuku", "Ikebukuro"]);
  check("the comparison renders one column per zone", (await page.locator(".zone-column").count()) === 2);

  const facts = page.locator(".zone-column .zone-fact");
  const factText = (await facts.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("the columns render airport facts", factText.length > 0, JSON.stringify(factText).slice(0, 160));

  // ── The label says direct BY WHAT ────────────────────────────────────────────────────────────
  const airportLabels = factText.filter((t) => /✈|NRT|HND|KIX|ITM/.test(t));
  check("every airport fact is labelled", airportLabels.length >= 4, JSON.stringify(airportLabels));
  check(
    "no airport fact says the bare word 'directo'",
    airportLabels.every((t) => !/·\s*directo\b/.test(t)),
    JSON.stringify(airportLabels)
  );
  check(
    "and none says the vague 'con enlace'",
    airportLabels.every((t) => !/con enlace/.test(t)),
    JSON.stringify(airportLabels)
  );
  check(
    "every airport fact names the mode and whether a change is needed",
    airportLabels.every((t) => /(tren|autobús) (directo|con transbordo)/.test(t)),
    JSON.stringify(airportLabels)
  );

  const joined = airportLabels.join(" | ");
  check("a direct train is described as such", /tren directo/.test(joined), joined);
  check("a direct coach is described as such", /autobús directo/.test(joined), joined);
  check("a route needing a change says transbordo", /con transbordo/.test(joined), joined);
  check(
    "train and coach are never rendered as the same thing",
    /tren directo/.test(joined) && /autobús directo/.test(joined),
    joined
  );

  // ── Two answers for one airport both appear ──────────────────────────────────────────────────
  const hanedaFacts = airportLabels.filter((t) => /HND/.test(t));
  check(
    "a zone reached by a direct coach and a rail change shows BOTH",
    hanedaFacts.length >= 3,
    JSON.stringify(hanedaFacts)
  );
  check(
    "one of them is direct and another is not",
    hanedaFacts.some((t) => /directo/.test(t)) && hanedaFacts.some((t) => /transbordo/.test(t)),
    JSON.stringify(hanedaFacts)
  );

  // ── The spelled-out sentence ─────────────────────────────────────────────────────────────────
  const spoken = await page.locator(".zone-column .zone-fact .visually-hidden").allInnerTexts();
  check("each fact carries a spelled-out sentence", spoken.length >= airportLabels.length, String(spoken.length));
  const spokenJoined = spoken.join(" | ");
  check("which says outright that direct means no change", /sin transbordos/.test(spokenJoined), spokenJoined.slice(0, 200));
  check(
    "and that the alternative needs at least one",
    /requiere al menos un transbordo/.test(spokenJoined),
    spokenJoined.slice(0, 200)
  );
  check(
    "and names the actual service rather than only the airport",
    /Autobús limusina a (Shinjuku|Ikebukuro) Station West Exit/.test(spokenJoined),
    spokenJoined.slice(0, 260)
  );

  // ── No mode hierarchy is implied ─────────────────────────────────────────────────────────────
  const columnText = (await page.locator(".zone-column").first().innerText()).toLowerCase();
  check(
    "no copy calls one mode better than another",
    !/(tren|autobús).{0,30}(mejor|peor|preferib|más cómodo|recomendad)/.test(columnText)
  );
  check("no travel time is invented beside a link", !/\b\d+\s*(min|minutos|h)\b/.test(columnText), columnText.slice(0, 140));

  const emphasised = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-fact--strong")].map((el) => el.innerText.replace(/\s+/g, " ").trim())
  );
  check(
    "the emphasis marks directness, not a mode",
    emphasised.every((t) => /directo/.test(t)),
    JSON.stringify(emphasised)
  );
  check(
    "so a direct coach is emphasised exactly like a direct train",
    emphasised.some((t) => /autobús directo/.test(t)) && emphasised.some((t) => /tren directo/.test(t)),
    JSON.stringify(emphasised)
  );

  // ── Layout: the longer labels must still fit ─────────────────────────────────────────────────
  check(
    "no horizontal page scroll",
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1))
  );
  const widened = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column .zone-facts")].some((el) => {
      const parent = el.parentElement;
      return parent ? el.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1 : false;
    })
  );
  check("the fact row never widens its column", !widened);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column .zone-fact")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.innerText.replace(/\s+/g, " ").trim().slice(0, 40))
  );
  check("no airport label is clipped", clipped.length === 0, JSON.stringify(clipped));
  const ellipsised = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column .zone-fact")].some(
      (el) => getComputedStyle(el).textOverflow === "ellipsis"
    )
  );
  check("no airport label is truncated with an ellipsis", !ellipsised);
  const overlap = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".zone-column .zone-fact")];
    for (let i = 0; i < els.length; i += 1) {
      const a = els[i].getBoundingClientRect();
      if (a.height === 0) continue;
      for (let j = i + 1; j < els.length; j += 1) {
        const b = els[j].getBoundingClientRect();
        if (b.height === 0) continue;
        const hit = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (hit) return true;
      }
    }
    return false;
  });
  check("the facts reflow without overlapping each other", !overlap);

  // ── The facts are not interactive, and nothing nests inside them ─────────────────────────────
  const nested = await page.evaluate(() =>
    [...document.querySelectorAll(".zone-column .zone-fact")].some(
      (el) => el.querySelector("a, button, input, [tabindex]") !== null
    )
  );
  check("no control is nested inside an airport fact", !nested);
  check(
    "the fact row itself is not a control",
    await page.evaluate(() =>
      [...document.querySelectorAll(".zone-column .zone-fact")].every(
        (el) => el.tagName === "SPAN" && !el.hasAttribute("tabindex") && !el.hasAttribute("role")
      )
    )
  );

  // ── Block 7's source links still behave ──────────────────────────────────────────────────────
  const links = page.locator(".zone-source__link");
  check("the source links are still there", (await links.count()) >= 2);
  const names = await links.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  check("each still has a unique accessible name", new Set(names).size === names.length, JSON.stringify(names));
  check(
    "each still opens in a new tab with rel=noreferrer",
    await links.evaluateAll((els) =>
      els.every((el) => el.getAttribute("target") === "_blank" && (el.getAttribute("rel") ?? "").includes("noreferrer"))
    )
  );

  await links.first().focus();
  check(
    "a source link still takes focus",
    await page.evaluate(() => String(document.activeElement?.className ?? "").includes("zone-source__link"))
  );
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  check(
    "and tab moves on rather than trapping",
    await page.evaluate(() => !document.activeElement?.hasAttribute?.("data-audit-origin"))
  );

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
  check("pressing a source still writes no planning decision", JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBefore);
  check(
    "and still writes no storage key",
    JSON.stringify((await storageKeys(page)).sort()) === JSON.stringify(keysBefore)
  );

  // ── Kioto: a rail-only hub still reads correctly ─────────────────────────────────────────────
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openComparisonFor(page, "Kioto", ["Estación de Kioto", "Gion–Higashiyama"]);
  const kyoto = (await page.locator(".zone-column .zone-fact").allInnerTexts()).map((t) =>
    t.replace(/\s+/g, " ").trim()
  );
  const kyotoAirports = kyoto.filter((t) => /KIX/.test(t));
  check("Kioto shows a direct train and a train with a change", 
    kyotoAirports.some((t) => /tren directo/.test(t)) && kyotoAirports.some((t) => /tren con transbordo/.test(t)),
    JSON.stringify(kyotoAirports)
  );
  check("and mentions no coach, because none is recorded there", !kyotoAirports.some((t) => /autobús/.test(t)), JSON.stringify(kyotoAirports));

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 8 airport-link audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 8 airport-link audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
