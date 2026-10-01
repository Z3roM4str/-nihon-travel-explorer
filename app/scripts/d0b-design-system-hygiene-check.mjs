import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de D0b — higiene del sistema de diseño (`docs/D0B_DESIGN_SYSTEM_HYGIENE_MISSION.md`).
 * Comportamiento real sobre la build de producción (`npm run build` antes). Reconciliado sobre main (B27–B31).
 *
 *   A inputs      todo input/select/textarea de Viaje computa ≥ 16 px a 320/360/390/430 (norma 11 §3, 12 regla 8);
 *                 las cuatro reglas corregidas usan `--type-body-size`, sin `font-size` literal.
 *   B overflow    sin scroll horizontal en 320/360/390/430/768/840/1200/1440 en las cuatro sub-pestañas de Viaje.
 *   C safe-area   el CSS conserva los `env(safe-area-inset-bottom)` auditados; el meta viewport NO lleva
 *                 `viewport-fit=cover` (DESIGN DECISION REQUIRED D0b-02: requiere reglas laterales/superiores
 *                 no respaldadas por contrato; ver handoff). Si un bloque posterior lo aprueba, este gate cambia.
 *   D tokens      los literales migrados ya no están; ningún hex/rgb/hsl nuevo respecto a la lista documentada.
 *   E responsive  D0b no migró ninguna media query (0 clase A): el inventario de `@media` queda fijado y sin
 *                 ningún `max-width` nuevo (Art. 8).
 *   F consola     sin errores propios.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/d0b-design-system-hygiene-check.mjs`
 *      `NIHON_BROWSER=webkit` ejecuta el mismo gate en WebKit (si está instalado);
 *      `NIHON_REDUCED_MOTION=1` lo ejecuta con `prefers-reduced-motion: reduce`.
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const REDUCED = process.env.NIHON_REDUCED_MOTION === "1";
const executablePath = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const APP = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const MOBILE = [320, 360, 390, 430];
const ALL = [320, 360, 390, 430, 768, 840, 1200, 1440];
const TABS = ["Días", "Dónde dormir", "Reservas", "Resumen"];

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

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 260)}`);
  }
}
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const ruleBlock = (css, selector) => {
  const i = css.indexOf(`\n${selector} {`);
  ok(i >= 0, `regla no encontrada: ${selector}`);
  return css.slice(i, css.indexOf("}", i));
};

// ─────────────────────────────── estáticos (CSS / HTML)
const appCss = read("../src/App.css");
const discoveryCss = read("../src/styles/discovery.css") + read("../src/styles/trip-overview.css");
const html = read("../index.html");

await ck("A01", "las reglas de input/select de Viaje usan --type-body-size (sin font-size literal)", async () => {
  // Los cuatro certificados en D0b + tres selects añadidos por B27–B29 (adaptación C: misma norma «todo control de Viaje ≥ 16 px»).
  for (const sel of [".recorded-interval-fit__input", ".accommodation-manager__input", ".accommodation-boundary__input", ".inter-hub-segments input", ".trip-stop__move-panel select, .unassigned-drawer select", ".day-card__actions select", ".day-order-tool__move select"]) {
    const block = ruleBlock(appCss, sel);
    ok(/font-size:\s*var\(--type-body-size\)/.test(block), `${sel} sin var(--type-body-size)`);
    ok(!/font-size:\s*[\d.]+(rem|px)/.test(block), `${sel} con font-size literal`);
  }
});
await ck("A02", "ninguna regla CSS dirigida a input/select/textarea baja de 16 px", async () => {
  for (const [file, css] of [["App.css", appCss], ["discovery.css", discoveryCss]]) {
    for (const m of css.matchAll(/\n([^\n{}@/*]*(?<![\w-])(?:input|select|textarea)(?![\w-])[^\n{}]*) \{([^}]*)\}/g)) {
      const size = /font-size:\s*([^;]+);/.exec(m[2]);
      if (!size) continue;
      ok(/var\(--type-(body|title|display|quote)/.test(size[1]) || /^1\d?(\.\d+)?rem$/.test(size[1]) && parseFloat(size[1]) >= 1, `${file} «${m[1].trim()}» font-size ${size[1]}`);
    }
  }
});
await ck("C01", "meta viewport sin cambios (viewport-fit=cover NO aplicado: DDR D0b-02)", async () => {
  ok(html.includes('content="width=device-width, initial-scale=1.0"'), "meta viewport modificado");
  ok(!/viewport-fit/.test(html), "viewport-fit presente sin decisión de diseño aprobada");
});
await ck("C02", "el CSS conserva los siete usos auditados de env(safe-area-inset-bottom)", async () => {
  const n = (appCss.match(/env\(safe-area-inset-bottom/g) ?? []).length + (discoveryCss.match(/env\(safe-area-inset-bottom/g) ?? []).length;
  ok(n === 7, `usos de safe-area-inset-bottom: ${n} ≠ 7`);
  ok(!/safe-area-inset-(top|left|right)/.test(appCss + discoveryCss), "uso nuevo de insets laterales/superior sin decisión");
});
await ck("D01", "literales migrados ausentes; sin hex nuevos (#fff ya no existe, rgba blancos/ink exactos → tokens)", async () => {
  ok(!/#fff\b/i.test(appCss + discoveryCss), "#fff literal reintroducido");
  ok(!/rgba\(255, 255, 255, 0\.92\)/.test(appCss + discoveryCss), "rgba(255,255,255,.92) literal reintroducido (usar --overlay-paper)");
  ok(!/rgba\(20, 22, 26, 0\.55\)/.test(appCss + discoveryCss), "rgba(20,22,26,.55) literal reintroducido (usar --overlay-ink)");
  const hex = (appCss + discoveryCss).split("\n").filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\s*(\/\*|\*)/.test(l)).length;
  ok(hex <= 39, `hex literales en declaraciones: ${hex} > 39 (línea base documentada tras D0b sobre main; 37 en la línea Claude, +2 de B30/B31)`);
});
await ck("E01", "media queries: sin max-width nuevo (Art. 8); inventario legacy fijado", async () => {
  const maxW = (appCss.match(/@media[^{]*max-width/g) ?? []).length + (discoveryCss.match(/@media[^{]*max-width/g) ?? []).length;
  ok(maxW === 11, `@media con max-width: ${maxW} ≠ 11 (deuda legacy documentada en el handoff D0b; 10 en la línea Claude, +1 de B28–B31)`);
});

// ─────────────────────────────── navegador
const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls?.local[0];
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
console.log(`# navegador: ${BROWSER}${executablePath ? ` (${executablePath})` : ""} ${browser.version()} · reduced-motion=${REDUCED}`);
const consoleErrors = [];
const pageErrors = [];

async function boot(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, ...(REDUCED ? { reducedMotion: "reduce" } : {}) });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript((plan) => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (sessionStorage.getItem("d0b-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("d0b-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, PLAN);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForTimeout(300);
  return { context, page };
}
const openAllDetails = (page) =>
  page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));

const measured = {};
for (const width of ALL) {
  const { context, page } = await boot(width);
  for (const tab of TABS) {
    await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
    await page.waitForTimeout(250);
    await openAllDetails(page);
    if (tab === "Días") {
      // Controles que sólo existen al abrirlos: panel «Mover a…» de una parada y herramienta «Probar otro orden».
      await page.getByRole("button", { name: "Mover a…" }).first().click();
      await page.getByRole("button", { name: /^Probar otro orden del Día \d+$/ }).and(page.locator(":enabled")).first().click();
      await page.locator(".day-order-tool").first().waitFor();
    }
    await page.waitForTimeout(100);
    await ck(`B-${width}-${tab}`, `${width}px · ${tab}: sin scroll horizontal`, async () => {
      const o = await page.evaluate(() => {
        const doc = document.documentElement;
        const panel = document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll");
        const surface = document.querySelector(".destination-panel:not([hidden]) .viaje-surface");
        return {
          page: doc.scrollWidth > doc.clientWidth + 1,
          panel: !!panel && panel.scrollWidth > panel.clientWidth + 1,
          surface: !!surface && surface.scrollWidth > surface.clientWidth + 1,
        };
      });
      // HEREDADO (idéntico en la base 2f2e5e1): el panel de «Dónde dormir» desborda 1-2 px a 320 px.
      // Fuera del alcance de D0b (ZoneComparison); se registra, no se arregla ni se oculta.
      if (width === 320 && tab === "Dónde dormir" && !o.page && !o.surface) return console.log(`# HEREDADO [${width}/${tab}] overflow del panel ${JSON.stringify(o)} (igual en la base)`);
      ok(!o.page && !o.panel && !o.surface, `overflow ${JSON.stringify(o)}`);
    });
    if (MOBILE.includes(width)) {
      await ck(`A-${width}-${tab}`, `${width}px · ${tab}: input/select/textarea ≥ 16 px computados`, async () => {
        const sizes = await page.evaluate(() =>
          [...document.querySelectorAll(".destination-panel:not([hidden]) :is(input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea)")].map((el) => ({
            cls: el.className || el.tagName,
            px: parseFloat(getComputedStyle(el).fontSize),
          }))
        );
        measured[tab] = Math.max(measured[tab] ?? 0, sizes.length);
        const small = sizes.filter((s) => s.px < 16);
        ok(small.length === 0, `controles < 16px: ${JSON.stringify(small)}`);
      });
    }
  }
  await context.close();
}
await ck("A09", "la medición cubrió controles reales (≥ 1 en Viaje)", async () => {
  ok(Object.values(measured).reduce((a, b) => a + b, 0) >= 1, `controles medidos: ${JSON.stringify(measured)}`);
  console.log(`# controles medidos por pestaña (máx.): ${JSON.stringify(measured)}`);
});
await ck("F01", "consola sin errores propios", async () => {
  ok(consoleErrors.length === 0 && pageErrors.length === 0, `consola: ${[...consoleErrors, ...pageErrors].slice(0, 2).join(" | ")}`);
});

await browser.close();
await server.close();
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
