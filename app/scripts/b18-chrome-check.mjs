import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

/**
 * Bloque 18 — gate 11 §1/§2: cromo en teléfono.
 *
 * 1. A 390×844: cromo superior (cabecera + barra única) ≤112px; cromo total (+ TabBar) ≤168px.
 * 2. Cabecera sin overflow horizontal en 320/360/390/430.
 */
async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(200);

    const header = await page.evaluate(
      () => document.querySelector(".app__header")?.getBoundingClientRect().height ?? 0
    );
    const bar = await page.evaluate(
      () => document.querySelector(".explorer-bar")?.getBoundingClientRect().height ?? 0
    );
    const tabBar = await page.evaluate(
      () => document.querySelector(".tab-bar")?.getBoundingClientRect().height ?? 0
    );
    const top = header + bar;
    const total = top + tabBar;
    console.log(`header=${header} explorer-bar=${bar} tab-bar=${tabBar} top=${top} total=${total}`);
    check("cromo superior (cabecera + barra única) ≤112px a 390×844", top <= 112);
    check("cromo total (superior + TabBar) ≤168px a 390×844", total <= 168);
    await context.close();
  }

  for (const width of [320, 360, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => {
      const header = document.querySelector(".app__header");
      return header.scrollWidth > header.clientWidth + 1;
    });
    check(`cabecera sin overflow a ${width}px`, !overflow);
    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
