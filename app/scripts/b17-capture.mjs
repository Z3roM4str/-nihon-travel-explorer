import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4180";
const OUT_DIR = process.env.NIHON_OUT_DIR ?? "/tmp/screenshots";
const VIEWPORT = { width: 390, height: 844 };

async function dismissOnboarding(page) {
  const skip = page.locator(".onboarding__close, button:has-text('Saltar')").first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
  }
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` });
  console.log("captured", name);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // 1. Explorar — pantalla nacional (entrada)
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.reload({ waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await shot(page, "1-explorar-nacional");

  // 2. Ciudad — lista de lugares (Tokio)
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await shot(page, "2-ciudad-lista");

  // 3. Ficha de lugar
  await page.locator(".place-card__open").first().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await shot(page, "3-ficha-de-lugar");
  await page.locator(".place-detail__back").first().click().catch(() => {});
  await page.waitForTimeout(300);

  // Save a couple of places so "Quiero ir" and the planner have content.
  const saveButtons = page.locator(".place-card__save");
  const saveCount = await saveButtons.count();
  for (let i = 0; i < Math.min(3, saveCount); i++) {
    await saveButtons.nth(i).click();
    await page.waitForTimeout(150);
  }

  // 4. Quiero ir
  await page.click(".selection-panel__toggle");
  await page.waitForTimeout(400);
  await shot(page, "4-quiero-ir");

  // 5. Planner (Construir recorrido)
  const buildButton = page.locator("button:has-text('Construir recorrido')");
  if (await buildButton.isVisible().catch(() => false)) {
    await buildButton.click();
    await page.waitForSelector(".sequence-builder, [role='dialog']", { timeout: 15000 }).catch(() => {});
    await shot(page, "5-planner");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
  } else {
    console.log("build button not visible, skipping planner shot");
  }

  // 6. Dónde dormir (zonas de alojamiento)
  const zonesButton = page.locator(".hub-bar__zones");
  if (await zonesButton.isVisible().catch(() => false)) {
    await zonesButton.click();
    await page.waitForSelector("[role='dialog'], .zone-comparison", { timeout: 15000 }).catch(() => {});
    await shot(page, "6-donde-dormir");
  } else {
    console.log("zones button not visible, skipping");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
