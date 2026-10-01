import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Captura determinista de superficies para auditorías visuales comparativas (BASE vs rama).
 * Uso: `NIHON_APP_ROOT=<carpeta app con dist/> NIHON_OUT=<salida> [NIHON_BROWSER=webkit] node scripts/visual-capture.mjs`
 * (la comparación píxel a píxel la hace `scripts/visual-compare.py`). `reducedMotion: reduce` y recursos externos bloqueados.
 */
const ROOT = process.env.NIHON_APP_ROOT ?? fileURLToPath(new URL("..", import.meta.url));
const OUT = process.env.NIHON_OUT ?? "visual-out";
const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const VIEWPORTS = [[320, 568], [390, 844], [430, 932], [840, 1180], [1200, 900]];
mkdirSync(OUT, { recursive: true });

const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const PLAN = {
  version: 8,
  routeIds: ["JP-212", "JP-077", "JP-044", "JP-203"],
  days: [
    { id: "d1", placeIds: ["JP-212"], accommodationBoundary: unsel },
    { id: "d2", placeIds: ["JP-077", "JP-044"], accommodationBoundary: unsel },
    { id: "d3", placeIds: ["JP-203"], accommodationBoundary: unsel },
  ],
  startDate: "2027-03-14",
  endDate: "2027-03-17",
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
};

const server = await preview({ root: ROOT, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const engine = BROWSER === "webkit" ? webkit : chromium;
const browser = await engine.launch({
  headless: true,
  ...(BROWSER === "chromium" && process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}),
});

const nav = (page, name) =>
  page.locator(`.tab-bar__item:has-text('${name}'):visible, .nav-rail__item:has-text('${name}'):visible`).first();

async function boot(width, height, seeded = true) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(({ plan, seed }) => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (!seed || sessionStorage.getItem("vc-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("vc-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, { plan: PLAN, seed: seeded });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*{caret-color:transparent!important}" });
  return { context, page };
}

async function shot(page, name, width) {
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await page.screenshot({ path: path.join(OUT, `${BROWSER}-${width}-${name}.png`), fullPage: false });
  return overflow;
}

const report = [];
for (const [width, height] of VIEWPORTS) {
  const { context, page } = await boot(width, height);
  const take = async (name) => report.push({ width, name, overflow: await shot(page, name, width) });
  await nav(page, "Explorar").click();
  await take("explorar");
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await take("explorar-ciudad");
  await page.locator(".place-card").first().locator("button").first().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await take("ficha");
  const back = page.locator(".place-detail__back");
  if (await back.count()) await back.first().click();
  else await page.keyboard.press("Escape");
  await nav(page, "Quiero ir").click();
  await take("quiero-ir");
  await nav(page, "Nosotros").click();
  await take("nosotros");
  await nav(page, "Viaje").click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await take("viaje-dias");
  await page.getByRole("button", { name: "Mover a…" }).first().click();
  await take("viaje-dias-mover");
  await page.getByRole("button", { name: /^Probar otro orden del Día \d+$/ }).and(page.locator(":enabled")).first().click();
  await page.locator(".day-order-tool").first().waitFor();
  await take("viaje-dias-otro-orden");
  for (const [tab, slug] of [["Dónde dormir", "dormir"], ["Reservas", "reservas"], ["Resumen", "resumen"]]) {
    await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
    await take(`viaje-${slug}`);
  }
  await context.close();
}
console.log(JSON.stringify(report.filter((r) => r.overflow)));
console.log(`capturas: ${report.length} (${BROWSER}) → ${OUT}`);
await browser.close();
await server.close();
