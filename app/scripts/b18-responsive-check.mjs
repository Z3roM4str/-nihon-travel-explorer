import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const OUT_DIR = process.env.NIHON_OUT_DIR ?? "/tmp/screenshots-b18-responsive";

/**
 * Bloque 18 — gate 12 (responsive) y gate 4 (transición TabBar/NavRail exacta en 840px).
 *
 * Además de los anchos que ya auditaba el Bloque 17, se añaden 839/840/841 para demostrar el
 * cambio exacto de `TabBar` a `NavRail` en el token `md` de `02 §D5`, y 1200/1600 (`lg`/`xl`)
 * porque B18 es el bloque que instala el raíl que vive en esos anchos.
 */
const WIDTHS = [
  { name: "320", width: 320, height: 720 },
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "md-839", width: 839, height: 900 },
  { name: "md-840", width: 840, height: 900 },
  { name: "md-841", width: 841, height: 900 },
  { name: "lg-1200", width: 1200, height: 900 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "xl-1600", width: 1600, height: 900 },
];

async function dismissOnboarding(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowing: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
  console.log(
    `${label}: clientWidth=${overflow.clientWidth} scrollWidth=${overflow.scrollWidth}` +
      (overflow.overflowing ? "  !! HORIZONTAL OVERFLOW" : "  ok")
  );
  return overflow.overflowing;
}

async function checkNav(page, label) {
  const navRailVisible = await page.locator(".nav-rail").isVisible().catch(() => false);
  const tabBarVisible = await page.locator(".tab-bar").isVisible().catch(() => false);
  const exactlyOne = navRailVisible !== tabBarVisible;
  console.log(
    `${label}: navRail=${navRailVisible} tabBar=${tabBarVisible}` +
      (exactlyOne ? "  ok" : "  !! BOTH OR NEITHER VISIBLE")
  );
  return exactlyOne;
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  let anyOverflow = false;
  let anyNavFailure = false;

  for (const viewport of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.reload({ waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — explorar nacional`)) anyOverflow = true;
    if (!(await checkNav(page, `${viewport.name} — explorar nacional`))) anyNavFailure = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-1-nacional.png`, fullPage: false });

    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — ciudad`)) anyOverflow = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-2-ciudad.png`, fullPage: false });

    await page.locator(".place-card__open").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — ficha`)) anyOverflow = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-3-ficha.png`, fullPage: false });

    await context.close();
  }

  await browser.close();
  if (anyOverflow || anyNavFailure) {
    if (anyOverflow) console.error("\nHorizontal overflow detected at one or more viewports.");
    if (anyNavFailure) console.error("\nTabBar/NavRail exclusivity failed at one or more viewports.");
    process.exit(1);
  }
  console.log("\nNo horizontal overflow, and TabBar/NavRail are always mutually exclusive.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
