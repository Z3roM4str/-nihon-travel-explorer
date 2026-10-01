import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Prueba de equivalencia de CSS (B10.4): captura, para cada superficie y ancho, el estilo COMPUTADO y la caja de CADA elemento
 * del DOM visible y compara dos builds (BASE vs RAMA). Si una migración de CSS cambia el cascade, la especificidad o el orden,
 * algún elemento cambia un valor computado o su caja; si no cambia ninguno, la migración es equivalente en esas superficies.
 *
 * Uso:
 *   NIHON_APP_ROOT=<app con dist/> NIHON_OUT=<fichero.json> node scripts/css-equivalence-check.mjs capture
 *   node scripts/css-equivalence-check.mjs compare base.json nuevo.json
 * (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales). Con `reducedMotion: reduce`; recursos externos bloqueados.
 */

const [mode, ...rest] = process.argv.slice(2);
const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";

if (mode === "compare") {
  const [a, b] = rest.map((f) => JSON.parse(readFileSync(f, "utf8")));
  let diffs = 0;
  let states = 0;
  for (const key of Object.keys(a)) {
    states += 1;
    const x = a[key];
    const y = b[key];
    if (!y) { console.log(`FALTA ${key}`); diffs += 1; continue; }
    if (x.length !== y.length) { console.log(`DOM distinto ${key}: ${x.length} vs ${y.length} elementos`); diffs += 1; continue; }
    const bad = [];
    for (let i = 0; i < x.length; i += 1) {
      if (x[i].sig !== y[i].sig) { bad.push(`#${i} ${x[i].sig.split("|")[0]} ≠ ${y[i].sig.split("|")[0]}`); continue; }
      if (x[i].v !== y[i].v) {
        const p = x[i].v.split(";");
        const q = y[i].v.split(";");
        bad.push(`${x[i].sig.split("|")[0]}: ${p.filter((v, j) => v !== q[j]).slice(0, 3).map((v) => `${v}→${q[p.indexOf(v)]}`).join(", ")}`);
      }
    }
    if (bad.length) { diffs += 1; console.log(`DIFF ${key}: ${bad.length} elementos · ${[...new Set(bad)].slice(0, 4).join(" || ")}`); }
  }
  console.log(`estados=${states} con diferencias=${diffs}`);
  process.exit(diffs ? 1 : 0);
}

const ROOT = process.env.NIHON_APP_ROOT ?? fileURLToPath(new URL("..", import.meta.url));
const OUT = process.env.NIHON_OUT ?? "css-equivalence.json";
const WIDTHS = (process.env.NIHON_WIDTHS ?? "320,390,430,840,1200").split(",").map(Number);
const heightFor = (w) => (w <= 430 ? 844 : w <= 840 ? 1180 : 900);

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
const PROPS = [
  "display", "position", "top", "right", "bottom", "left", "z-index", "float", "flex", "flex-direction", "flex-wrap", "align-items", "align-self", "justify-content", "gap", "grid-template-columns", "grid-template-rows", "grid-column", "order",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "box-sizing", "overflow-x", "overflow-y", "color", "background-color", "background-image", "opacity", "visibility", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "text-decoration-line", "text-overflow", "white-space", "word-break", "overflow-wrap",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-color", "border-bottom-color", "border-top-style", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "outline-style", "box-shadow", "transform", "cursor", "pointer-events", "object-fit", "aspect-ratio", "list-style-type", "animation-name", "transition-property", "content",
];

const server = await preview({ root: ROOT, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
const nav = (page, name) => page.locator(`.tab-bar__item:has-text('${name}'):visible, .nav-rail__item:has-text('${name}'):visible`).first();

const snapshot = (page) =>
  page.evaluate((props) => {
    const out = [];
    const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
    for (const el of document.body.querySelectorAll("*")) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "path", "circle", "line", "polyline", "rect"].includes(el.tagName)) continue;
      if (!vis(el)) { out.push({ sig: `${el.tagName}.${String(el.className?.baseVal ?? el.className).trim()}|hidden`, v: "" }); continue; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const box = [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 2) / 2).join(",");
      out.push({ sig: `${el.tagName}.${String(el.className?.baseVal ?? el.className).trim()}|`, v: `${box};${props.map((p) => cs.getPropertyValue(p)).join(";")}` });
    }
    return out;
  }, PROPS);

async function boot(width, { seed = true, onboarding = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: heightFor(width) }, reducedMotion: "reduce" });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(({ plan, seedIn, onb }) => {
    try {
      if (!onb) localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (!seedIn || sessionStorage.getItem("eq-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("eq-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, { plan: PLAN, seedIn: seed, onb: onboarding });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  return { context, page };
}

const result = {};
for (const width of WIDTHS) {
  const { context, page } = await boot(width);
  const take = async (name) => {
    await page.waitForTimeout(450);
    result[`${width}/${name}`] = await snapshot(page);
  };
  const tryStep = async (name, fn) => {
    try { await fn(); } catch (e) { console.log(`# ${width}/${name}: paso omitido (${e.message.split("\n")[0].slice(0, 80)})`); }
  };
  await nav(page, "Explorar").click();
  await take("explorar");
  await tryStep("busqueda", async () => {
    await page.locator(".explorer-home__search-button").first().click();
    await page.locator(".sheet").first().waitFor();
    await take("explorar-busqueda");
    await page.keyboard.press("Escape");
    await page.locator(".sheet").first().waitFor({ state: "detached" });
  });
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await take("ciudad");
  await tryStep("filtros", async () => {
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await page.locator(".sheet").first().waitFor();
    await page.evaluate(() => document.querySelectorAll(".sheet details:not([open])").forEach((d) => d.setAttribute("open", "")));
    await take("ciudad-filtros");
    await page.keyboard.press("Escape");
    await page.locator(".sheet").first().waitFor({ state: "detached" });
  });
  await tryStep("mapa", async () => {
    const b = page.getByRole("button", { name: /^Mapa$/ });
    if (await b.count()) await b.first().click();
    await take("ciudad-mapa");
    const l = page.getByRole("button", { name: /^Lista$/ });
    if (await l.count()) await l.first().click();
  });
  await tryStep("ficha", async () => {
    await page.locator(".place-card:has(.place-card__photo-count)").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await take("ficha");
    await page.evaluate(() => document.querySelectorAll(".place-detail details:not([open])").forEach((d) => d.setAttribute("open", "")));
    await take("ficha-abierta");
    const credits = page.locator(".gallery__credits");
    if (await credits.count()) {
      await credits.first().click();
      await take("ficha-creditos");
      await page.keyboard.press("Escape");
    }
    const zoom = page.locator('[aria-label^="Ampliar imagen"]').first();
    if (await zoom.count()) {
      await zoom.click();
      await take("ficha-lightbox");
      await page.keyboard.press("Escape");
    }
    const back = page.locator(".place-detail__back");
    if (await back.count()) await back.first().click();
    else await page.keyboard.press("Escape");
  });
  await nav(page, "Quiero ir").click();
  await take("quiero-ir");
  await tryStep("quiero-ir-persona", async () => {
    await page.getByRole("tab", { name: /Persona 1/ }).or(page.getByRole("button", { name: /Persona 1/ })).first().click();
    await take("quiero-ir-persona");
  });
  await nav(page, "Nosotros").click();
  await page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));
  await take("nosotros");
  await nav(page, "Viaje").click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));
  await take("viaje-dias");
  await tryStep("mover", async () => {
    await page.getByRole("button", { name: "Mover a…" }).first().click();
    await take("viaje-dias-mover");
  });
  await tryStep("otro-orden", async () => {
    await page.getByRole("button", { name: /^Probar otro orden del Día \d+$/ }).and(page.locator(":enabled")).first().click();
    await page.locator(".day-order-tool").first().waitFor();
    await take("viaje-dias-otro-orden");
  });
  for (const [tab, slug] of [["Dónde dormir", "dormir"], ["Reservas", "reservas"], ["Resumen", "resumen"]]) {
    await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
    await page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));
    await take(`viaje-${slug}`);
  }
  await context.close();
  // estado vacío + onboarding
  const fresh = await boot(width, { seed: false, onboarding: true });
  result[`${width}/onboarding`] = await (async () => { await fresh.page.waitForTimeout(500); return snapshot(fresh.page); })();
  await fresh.page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await fresh.page.reload({ waitUntil: "networkidle" });
  await fresh.page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  for (const [n, slug] of [["Quiero ir", "vacio-quiero-ir"], ["Viaje", "vacio-viaje"], ["Nosotros", "vacio-nosotros"]]) {
    await nav(fresh.page, n).click();
    await fresh.page.waitForTimeout(450);
    result[`${width}/${slug}`] = await snapshot(fresh.page);
  }
  await fresh.context.close();
}
mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
writeFileSync(OUT, JSON.stringify(result));
console.log(`estados capturados: ${Object.keys(result).length} · elementos: ${Object.values(result).reduce((a, s) => a + s.length, 0)} → ${OUT}`);
await browser.close();
await server.close();
