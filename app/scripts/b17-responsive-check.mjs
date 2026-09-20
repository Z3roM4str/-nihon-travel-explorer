import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const OUT_DIR = process.env.NIHON_OUT_DIR ?? "/tmp/screenshots-responsive";

const WIDTHS = [
  { name: "320", width: 320, height: 720 },
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "desktop-1440", width: 1440, height: 900 },
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

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  let anyOverflow = false;

  for (const viewport of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    // National / entry screen
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.reload({ waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — explorar nacional`)) anyOverflow = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-1-nacional.png`, fullPage: false });

    // City list
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — ciudad lista`)) anyOverflow = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-2-ciudad.png`, fullPage: false });

    // Place detail
    await page.locator(".place-card__open").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(200);
    if (await checkOverflow(page, `${viewport.name} — ficha`)) anyOverflow = true;
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-3-ficha.png`, fullPage: false });

    await context.close();
  }

  await browser.close();
  if (anyOverflow) {
    console.error("\nHorizontal overflow detected at one or more viewports.");
    process.exit(1);
  }
  console.log("\nNo horizontal overflow at any checked viewport.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
