import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const OUT_DIR = process.env.NIHON_OUT_DIR ?? "/tmp/screenshots-b18";
const LABEL = process.env.NIHON_LABEL ?? "after";

/**
 * Bloque 18 — evidencia visual (punto 15). Cinco superficies, a 390×844 y 1440×900, en el
 * mismo estilo que `b17-capture.mjs` (mismo binario, misma convención de nombres) para que
 * "antes" (un worktree en el SHA base) y "después" (esta rama) sean comparables imagen a
 * imagen.
 */
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1440x900", width: 1440, height: 900 },
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

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // 1. Explorar / ciudad
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-1-explorar-ciudad-${LABEL}.png` });

    // 2. Ficha de lugar abierta
    await page.locator(".place-card__open").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-2-ficha-${LABEL}.png` });
    await page.locator(".place-detail__back").click();
    await page.waitForTimeout(300);

    // 3. Quiero ir
    const tabSelector = viewport.width < 840 ? ".tab-bar__item" : ".nav-rail__item";
    await page.click(`${tabSelector}:has-text('Quiero ir')`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-3-quiero-ir-${LABEL}.png` });

    // 4. Viaje
    await page.click(`${tabSelector}:has-text('Viaje')`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-4-viaje-${LABEL}.png` });

    // 5. Nosotros
    await page.click(`${tabSelector}:has-text('Nosotros')`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-5-nosotros-${LABEL}.png` });

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots written to ${OUT_DIR} (label: ${LABEL}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
