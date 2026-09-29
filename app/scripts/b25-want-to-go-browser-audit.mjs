import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const viewports = [[320,568],[375,667],[390,844],[430,932],[820,1180],[1024,768],[1280,800],[1440,900]];
const out = "/tmp/b25";
mkdirSync(out, { recursive: true });
let passed = 0;
let failed = 0;
const check = (condition, label, viewport) => {
  if (condition) { passed++; console.log(`OK   ${viewport} ${label}`); }
  else { failed++; console.log(`FAIL ${viewport} ${label}`); }
};

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  : {});
for (const [width, height] of viewports) {
  const viewport = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".national-start__hub").filter({ hasText: "Tokio" }).click();
  await page.locator(".place-card__save").nth(0).click();
  await page.locator(".place-card__save").nth(1).click();
  await page.getByRole("button", { name: "Quiero ir" }).last().click();
  await page.waitForTimeout(250);

  const panel = page.locator(".destination-panel:not([hidden]) .selection-panel");
  check(await panel.getByRole("heading", { name: /Quiero ir/ }).isVisible(), "cabecera y contador", viewport);
  check((await panel.locator(".selection-segmented button").count()) >= 2, "segmentado", viewport);
  check((await panel.locator(".selection-panel__metric").count()) === 3, "resumen de tres datos", viewport);
  check(await panel.getByRole("heading", { name: /Los dos queréis ir/ }).isVisible(), "coincidencias sin clic", viewport);
  check((await panel.locator('.place-card--compact').count()) > 0, "secciones usan PlaceCard compact", viewport);
  check((await panel.getByText("Opiniones distintas", { exact: false }).count()) === 1, "divergencias presentes", viewport);
  check((await panel.getByText("Descartados", { exact: false }).count()) === 1, "Descartados plegado presente", viewport);
  check((await panel.locator('.selection-insights').count()) === 1, "análisis integrado", viewport);
  const cta = panel.getByRole("button", { name: "Llevar al viaje" });
  check(await cta.isVisible(), "CTA accesible", viewport);
  check(await cta.evaluate((el) => el.classList.contains('button--primary') && el.classList.contains('button--lg')), "CTA primary lg", viewport);
  check(!(await panel.innerText()).match(/Analizar selección/i), "sin acción de análisis", viewport);

  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    targets: [...document.querySelectorAll(".selection-segmented button, .selection-panel__cta button")].every((el) => el.getBoundingClientRect().height >= 44),
  }));
  check(!geometry.overflow, "sin overflow horizontal", viewport);
  check(geometry.targets, "targets de 44px", viewport);
  await panel.locator(".selection-segmented button").nth(1).focus();
  check(await panel.locator(".selection-segmented button").nth(1).evaluate((el) => el.matches(":focus-visible")), "foco de teclado", viewport);

  const scroller = page.locator(".destination-panel:not([hidden]) .destination-panel--scroll");
  await scroller.evaluate((el) => el.scrollTo({ top: 80 }));
  const before = await scroller.evaluate((el) => el.scrollTop);
  await panel.locator(".place-card__open").first().click();
  check(await page.locator(".place-detail").isVisible(), "abre PlaceDetail compartido", viewport);
  await page.locator(".place-detail__back").first().click();
  await page.waitForTimeout(150);
  const after = await scroller.evaluate((el) => el.scrollTop);
  check(Math.abs(before - after) < 2, "restaura scroll al volver", viewport);
  check(errors.length === 0, "sin errores de página", viewport);
  await page.screenshot({ path: `${out}/quiero-ir-${viewport}.png`, fullPage: true });
  await context.close();
}
await browser.close();
console.log(`B25: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
