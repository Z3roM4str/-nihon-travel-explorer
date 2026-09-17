import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 1 — UX, hierarchy and usability browser audit.
 *
 * Runs against the **production build** via `vite preview`, the convention Phase 5A's RC audit
 * established: a usability claim about the shipped artifact has to be measured on the shipped
 * artifact. Run `npm run build` first.
 *
 * It measures what the source-scanning tests cannot: real layout at real viewports. Horizontal
 * overflow, computed tap-target sizes, which pane is actually visible on a phone, whether the
 * save control really updates the saved counter, and whether the first-run explainer really
 * stops coming back.
 *
 * Determinism: the browser profile starts clean for each viewport, and the explainer is
 * dismissed through its own controls rather than by pre-seeding storage, so the dismissal path
 * itself is under test.
 *
 * Usage:
 *   node scripts/block1-ux-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 *   node scripts/block1-ux-browser-audit.mjs --browser=/path/to/chromium
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

/** The project's own token. Controls below this are not reliably hittable with a thumb. */
const MIN_TAP_PX = 44;
/**
 * Controls that sit inside a larger, already-generous target, or that are secondary to a
 * primary control right next to them. Each is listed deliberately rather than by loosening the
 * threshold for everything.
 */
const COMPACT_TAP_ALLOWANCE = {
  ".gallery__dot": 28,
  ".icon-button--small": 36,
  ".link-button": 24,
  ".filter-chip": 34,
  ".filter-group__summary": 34,
  ".interest-legend__summary": 38,
  ".app__help": 36,
  ".selection-panel__chevron": 20,
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(
  viewportArg === "all" || VIEWPORTS[viewportArg],
  `unknown viewport: ${viewportArg} (expected phone, tablet, desktop or all)`
);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4318;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Case- and accent-tolerant contains: several headings are uppercased by CSS, and `innerText`
 * reports what is rendered, not what the source wrote. */
function containsText(haystack, needle) {
  return haystack.toLocaleUpperCase("es").includes(needle.toLocaleUpperCase("es"));
}

/** Measures every rendered interactive control and reports the ones below their allowance. */
async function undersizedControls(page, allowance, floor) {
  return page.evaluate(
    ({ allowance, floor }) => {
      const selectors = Object.keys(allowance);
      const results = [];
      for (const element of document.querySelectorAll("button, a[href], input, summary")) {
        // A stretched link's own box is just its text; the element it declares is what a
        // finger actually lands on. Measure that, or the audit reports every card title as a
        // 21px target while the real target is the whole card.
        const stretched = element.getAttribute("data-stretch-target");
        const measured = stretched ? element.closest(stretched) ?? element : element;
        const rect = measured.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") continue;
        // Leaflet's own controls are third-party chrome and are not this audit's to police.
        if (element.closest(".leaflet-control-container")) continue;
        // A checkbox/radio inside a .filter-chip label is decorated by the label around it.
        if (element.matches("input[type=checkbox], input[type=radio]")) continue;
        const match = selectors.find((selector) => element.matches(selector));
        const min = match ? allowance[match] : floor;
        const smallest = Math.min(rect.width, rect.height);
        if (smallest + 0.5 < min) {
          results.push({
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 60),
            text: (element.textContent ?? "").trim().slice(0, 30),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            min,
          });
        }
      }
      return results;
    },
    { allowance, floor }
  );
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflowing: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
}

async function auditViewport(browser, name, url) {
  const viewport = VIEWPORTS[name];
  const isPhone = viewport.width < 620;
  const isMobileLayout = viewport.width <= 860;
  console.log(`\n── ${name} ${viewport.width}×${viewport.height} ${"─".repeat(30)}`);

  const context = await browser.newContext({ viewport, hasTouch: isMobileLayout });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Map tiles are fetched from a third party; a sandbox without egress fails them, and that
    // is an environment fact, not an application defect.
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(message.text())) return;
    consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // ---- First run: the explainer ----
  const dialog = page.locator(".onboarding__dialog");
  check("first visit shows the explainer", (await dialog.count()) === 1);
  check(
    "the explainer says it is step 1 of 3",
containsText(await page.locator(".onboarding__step-count").innerText(), "1 de 3")
  );
  check("the explainer offers an escape on step 1", (await page.getByRole("button", { name: "Saltar" }).count()) === 1);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("Escape closes the explainer", (await page.locator(".onboarding__dialog").count()) === 0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  check("a dismissed explainer does not come back", (await page.locator(".onboarding__dialog").count()) === 0);
  check(
    "the explainer stays reachable from the header",
    (await page.getByRole("button", { name: "Cómo se usa Nihon" }).count()) === 1
  );

  // ---- Entry screen orientation ----
  check("the entry screen says where to begin", (await page.locator(".national-start__lead").count()) === 1);
  const hubShortcuts = await page.locator(".national-start__hub").count();
  check("the entry screen offers every hub as a shortcut", hubShortcuts === 7, `found ${hubShortcuts}`);

  let overflow = await noOverflow(page);
  check("entry screen has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  // ---- Into a hub ----
  await page.getByRole("button", { name: /^Tokio/ }).first().click();
  await page.waitForTimeout(1200);

  const cardCount = await page.locator(".place-card").count();
  check("the hub opens on a list of cards", cardCount > 0, `cards=${cardCount}`);

  if (isMobileLayout) {
    check(
      "the phone opens on the list, not on a bare map",
      await page.locator(".app__body--pane-list").count().then((n) => n === 1)
    );
    check("a Lista/Mapa switch is visible", await page.locator(".view-switch").isVisible());
  } else {
    check("the desktop keeps list and map side by side", await page.locator(".app__sidebar").isVisible());
    check("the desktop map is visible at the same time", await page.locator(".place-map").isVisible());
  }

  // Every card answers the six questions.
  const firstCard = page.locator(".place-card").first();
  check("cards carry a plain-language interest level", (await firstCard.locator(".interest-badge__label").innerText()).length > 3);
  check("cards carry a shape glyph as well as colour", (await firstCard.locator(".interest-badge__glyph").count()) === 1);
  check("cards name the category and the zone", (await firstCard.locator(".place-card__where").innerText()).includes("·"));
  check("cards show a visit time", (await firstCard.locator(".place-card__fact").first().innerText()).length > 0);
  check("cards carry a save control", (await firstCard.locator(".place-card__save").count()) === 1);
  const reasonBox = await firstCard.locator(".place-card__reason").boundingBox();
  check("the reason line is clamped, not a wall of text", reasonBox === null || reasonBox.height < 60, JSON.stringify(reasonBox));

  overflow = await noOverflow(page);
  check("hub view has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  // ---- Saving from a card ----
  const savedBefore = (await page.locator(".selection-panel__count").innerText()).trim();
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(350);
  const savedAfter = (await page.locator(".selection-panel__count").innerText()).trim();
  check("saving from a card updates the Quiero ir counter", savedBefore === "0" && savedAfter === "1", `${savedBefore} → ${savedAfter}`);
  check("saving is confirmed on screen", (await page.locator(".save-toast").count()) === 1);
  check(
    "the confirmation is announced politely",
    (await page.locator(".save-toast-region").getAttribute("aria-live")) === "polite"
  );
  check(
    "the save control reports its pressed state",
    (await firstCard.locator(".place-card__save").getAttribute("aria-pressed")) === "true"
  );

  await page.waitForTimeout(2400);
  check("the confirmation clears itself", (await page.locator(".save-toast").count()) === 0);

  // Unsaving reverses it, from the same control.
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(300);
  check(
    "unsaving from the same control reverses it",
    (await page.locator(".selection-panel__count").innerText()).trim() === "0"
  );
  await firstCard.locator(".place-card__save").click();
  await page.waitForTimeout(2600);

  // ---- Filters ----
  if (isMobileLayout) {
    await page.locator(".view-bar__filters").click();
    await page.waitForTimeout(400);
    check("the filter sheet opens over the list", await page.locator(".app__filters--open").isVisible());
    check("the sheet keeps free-text search", await page.locator(".search-field__input").isVisible());
    check(
      "the interest filter reads in plain language",
      (await page.locator(".filter-chip--grade").first().innerText()).trim().length > 3
    );
    await page.getByRole("button", { name: "Cerrar búsqueda y filtros" }).click();
    await page.waitForTimeout(350);
    check("the sheet closes back to the list", (await page.locator(".app__filters--open").count()) === 0);
  } else {
    check("the desktop pins search above the results", await page.locator(".filter-panel__head").isVisible());
    check("the filter groups start collapsed on desktop", !(await page.locator(".filter-panel__groups").isVisible()));
    await page.locator(".filter-panel__toggle").click();
    await page.waitForTimeout(300);
    check("the filter groups open on request", await page.locator(".filter-panel__groups").isVisible());
    check(
      "the interest filter reads in plain language",
      (await page.locator(".filter-chip--grade").first().innerText()).trim().length > 3
    );
    await page.locator(".filter-panel__toggle").click();
    await page.waitForTimeout(250);
  }

  // ---- Empty state ----
  if (isMobileLayout) {
    await page.locator(".view-bar__filters").click();
    await page.waitForTimeout(350);
  }
  await page.locator(".search-field__input").fill("zzzzzzzz");
  await page.waitForTimeout(450);
  check("an impossible search produces a deliberate empty state", (await page.locator(".place-list__empty").count()) === 1);
  check(
    "the empty state names the term back to the reader",
containsText(await page.locator(".place-list__empty-title").innerText(), "zzzzzzzz")
  );
  check(
    "the empty state offers the way out",
    (await page.getByRole("button", { name: "Limpiar búsqueda y filtros" }).count()) >= 1
  );
  await page.locator(".search-field__clear").click();
  await page.waitForTimeout(400);
  if (isMobileLayout) {
    await page.getByRole("button", { name: "Cerrar búsqueda y filtros" }).click();
    await page.waitForTimeout(350);
  }

  // ---- Map pane / legend ----
  if (isMobileLayout) {
    await page.getByRole("button", { name: /Mapa/ }).click();
    await page.waitForTimeout(900);
    check("the map pane takes over on request", await page.locator(".place-map").isVisible());
    check("the marker colours are explained on the map", await page.locator(".interest-legend").isVisible());
    await page.getByRole("button", { name: /Lista/ }).click();
    await page.waitForTimeout(600);
    check("the list comes back", await page.locator(".place-card").first().isVisible());
  } else {
    check("the marker colours are explained on the map", await page.locator(".interest-legend").isVisible());
  }

  // ---- Place detail: nothing lost ----
  await page.locator(".place-card__open").first().click();
  await page.waitForTimeout(900);
  const detail = page.locator(".place-detail");
  check("the place detail opens", (await detail.count()) === 1);
  const detailText = await detail.innerText();
  for (const expected of ["Febrero–marzo 2027", "Información práctica", "Horario", "Cómo llegar", "Accesibilidad"]) {
    check(`the detail still carries "${expected}"`, containsText(detailText, expected));
  }
  check("the detail leads with the plain-language level", /Imprescindible|Muy recomendable|Recomendable|Opcional|Prescindible/.test(detailText));
  check("the detail still shows the dataset's grade letter", /Grado [SABCD]/.test(detailText));
  check("the detail's primary action is the heart", (await detail.locator(".save-button__icon").count()) === 1);

  overflow = await noOverflow(page);
  check("detail view has no horizontal overflow", !overflow.overflowing, JSON.stringify(overflow));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ---- Tap targets across the live hub view ----
  const small = await undersizedControls(page, COMPACT_TAP_ALLOWANCE, isPhone ? MIN_TAP_PX : 32);
  check("every interactive control meets its tap-target floor", small.length === 0, JSON.stringify(small));

  // ---- Runtime integrity ----
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 1 UX browser audit — production build via vite preview");

const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});

try {
  for (const name of targets) {
    await auditViewport(browser, name, url);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${"═".repeat(60)}\nBlock 1 UX audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
