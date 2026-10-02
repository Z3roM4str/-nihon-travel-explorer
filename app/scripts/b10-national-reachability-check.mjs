import { chromium, devices, webkit } from "playwright";
import { preview } from "vite";
import { APP_ROOT } from "./lib/modern-trip.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * B10 continuation: adopted coordinate guard from main P-04 (#191).
 * B10 already resets national scroll and restores the home position; its
 * reproducible defect was the uncontained hidden range, not a blank screen.
 * These browser contexts are emulation and cannot close F01-F12.
 *
 * Historical P-04 (release blocker, Safari/iPhone) — el mapa nacional tiene que quedar EN PANTALLA y con salida.
 *
 * El defecto: «Ver Japón en el mapa» vive al final de la portada, así que en teléfono se llega a él
 * desplazando `.app__body--home`. Ese mismo nodo pasaba a ser el cuerpo del mapa (`overflow: hidden`)
 * y conservaba el `scrollTop`; unos `.visually-hidden` absolutos que escapaban del scroll de la hoja
 * le daban ~2250px de rango oculto, de modo que el desplazamiento no se recortaba a 0. Resultado: mapa,
 * hoja y «‹ Volver a la portada» montados ~1700px por encima de la pantalla, sin gesto posible para
 * volver. Ningún error de JavaScript.
 *
 * Los gates anteriores no lo vieron porque `locator.click()` de Playwright desplaza el elemento a la
 * vista incluso dentro de un `overflow: hidden` — algo que un dedo no puede hacer. Aquí cada pulsación
 * es por COORDENADAS (`touchscreen.tap` / `mouse.click`) sobre un elemento que tiene que estar ya
 * visible y ser el que recibe el toque; sólo se desplazan contenedores que una persona puede desplazar
 * (`overflow-y: auto|scroll`).
 *
 * Uso: node scripts/b10-national-reachability-check.mjs        (Chromium)
 *      NIHON_BROWSER=webkit node scripts/b10-national-reachability-check.mjs
 */

const ENGINE = process.env.NIHON_BROWSER === "webkit" ? webkit : chromium;
const GEOJSON = "**/geography/japan-prefectures.geojson";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  — ${detail}`}`);
}

function contextOptions(kind) {
  if (kind === "desktop") return { viewport: { width: 1440, height: 900 } };
  const iphone = devices["iPhone 13"];
  // WebKit emula el iPhone completo (UA, isMobile, touch); Chromium no admite `isMobile` con UA de Safari
  // sin más, así que toma su viewport, densidad y pantalla táctil.
  return ENGINE === webkit
    ? iphone
    : { viewport: iphone.viewport, deviceScaleFactor: iphone.deviceScaleFactor, isMobile: true, hasTouch: true };
}

/** Desplaza SÓLO contenedores que un dedo puede desplazar hasta dejar `selector` en su vista. */
async function fingerReveal(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    for (let node = el.parentElement; node; node = node.parentElement) {
      const oy = getComputedStyle(node).overflowY;
      if (oy !== "auto" && oy !== "scroll") continue;
      const box = node.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) node.scrollTop += r.top - box.top - (box.height - r.height) / 2;
    }
  }, selector);
  await page.waitForTimeout(150);
}

/** ¿Está en el viewport y es lo que recibe un toque en su centro? */
async function reachable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, why: "no existe" };
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (r.width === 0 || r.height === 0) return { ok: false, why: "sin caja" };
    if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return { ok: false, why: `fuera de pantalla (${Math.round(x)},${Math.round(y)})` };
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === el || el.contains(hit)) ? { ok: true, x, y } : { ok: false, why: `tapado por ${hit?.className || hit?.tagName}` };
  }, selector);
}

/** Pulsa como una persona: por coordenadas, sin auto-desplazamiento. Devuelve si pudo. */
async function fingerTap(page, kind, selector, label) {
  const where = await reachable(page, selector);
  check(`${label}: alcanzable con el dedo`, where.ok, where.why);
  if (!where.ok) return false;
  if (kind === "desktop") await page.mouse.click(where.x, where.y);
  else await page.touchscreen.tap(where.x, where.y);
  return true;
}

async function bodyState(page) {
  return page.evaluate(() => {
    const body = document.querySelector(".app__body--national");
    const centre = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      scrollTop: body?.scrollTop ?? -1,
      hiddenRange: body ? body.scrollHeight - body.clientHeight : -1,
      centreIsBareBody: centre === body,
    };
  });
}

async function scrollHomeToMapCard(page) {
  await page.locator(".explorer-home__map-card").waitFor({ state: "attached" });
  // `.app__body--home` es `overflow-y: auto`: el desplazamiento de una persona hasta el final.
  await page.evaluate(() => {
    const home = document.querySelector(".app__body--home");
    home.scrollTop = home.scrollHeight;
  });
  await page.waitForTimeout(200);
  return page.evaluate(() => document.querySelector(".app__body--home").scrollTop);
}

async function newPage(browser, kind, { failGeometry = false } = {}) {
  const context = await browser.newContext({ ...contextOptions(kind), reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  if (failGeometry) await context.route(GEOJSON, (route) => route.abort("failed"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}

async function journey(browser, url, kind) {
  console.log(`\n── ${ENGINE.name()} · ${kind} · carga correcta ──`);
  const { context, page, errors } = await newPage(browser, kind);
  await page.goto(url);
  if (process.env.NIHON_B10_REACH_MUTANT === "uncontained-labels") {
    await page.addStyleTag({ content: ".national__sheet-content { position: static !important; }" });
  }
  const scrolled = await scrollHomeToMapCard(page);
  if (kind === "phone") check("la portada se desplaza para llegar a «Ver Japón en el mapa» (condición del fallo)", scrolled > 500, `scrollTop=${scrolled}`);

  await fingerTap(page, kind, ".explorer-home__map-card", "«Ver Japón en el mapa»");
  await page.locator(".national").waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".national-map .leaflet-interactive").length === 47, null, { timeout: 15000 }).catch(() => {});
  const state = await bodyState(page);
  check("el cuerpo del mapa nacional no hereda el desplazamiento de la portada", state.scrollTop === 0, `scrollTop=${state.scrollTop}`);
  check("el cuerpo del mapa nacional no tiene rango de desplazamiento oculto", state.hiddenRange <= 1, `rango=${state.hiddenRange}`);
  check("el centro de la pantalla no es un cuerpo vacío (no hay pantalla en blanco)", !state.centreIsBareBody);
  check("las 47 prefecturas están pintadas", (await page.locator(".national-map .leaflet-interactive").count()) === 47);
  const map = await reachable(page, ".national-map");
  check("el mapa está en pantalla", map.ok, map.why);

  // Volver a la portada.
  await fingerTap(page, kind, ".national__back-button", "«‹ Volver a la portada»");
  await page.locator(".explorer-home").waitFor({ timeout: 5000 }).catch(() => {});
  check("«Volver» lleva a la portada", (await page.locator(".app__body--home .explorer-home").count()) === 1);
  check("la portada vuelve en pantalla", (await reachable(page, ".explorer-home")).ok || (await page.evaluate(() => document.querySelector(".explorer-home").getBoundingClientRect().bottom > 0)));

  // Regiones → prefectura → Tokio, desde el mapa abierto con la portada otra vez desplazada.
  await scrollHomeToMapCard(page);
  await fingerTap(page, kind, ".explorer-home__map-card", "«Ver Japón en el mapa» (segunda vez, geometría en caché)");
  await page.locator(".national").waitFor();
  check("segunda apertura: tampoco hereda desplazamiento", (await bodyState(page)).scrollTop === 0);
  await page.evaluate(() => {
    document.querySelectorAll(".region-nav__item").forEach((b) => b.setAttribute("data-p04", b.querySelector(".region-nav__name")?.textContent.trim() ?? ""));
  });
  await fingerReveal(page, '.region-nav__item[data-p04="Kanto"]');
  await fingerTap(page, kind, '.region-nav__item[data-p04="Kanto"]', "región Kanto");
  await page.waitForTimeout(400);
  check("la región Kanto queda activa", (await page.locator(".region-nav__item--active").filter({ hasText: "Kanto" }).count()) === 1);
  check("con región activa el mapa sigue sin desplazamiento heredado", (await bodyState(page)).scrollTop === 0);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll(".region-nav__item--prefecture")].find((b) => /Tokio/.test(b.textContent));
    t?.setAttribute("data-p04", "pref-tokio");
  });
  await fingerReveal(page, '[data-p04="pref-tokio"]');
  await fingerTap(page, kind, '[data-p04="pref-tokio"]', "prefectura Tokio");
  await page.locator(".prefecture-panel").waitFor({ timeout: 5000 }).catch(() => {});
  check("se abre la ficha de la prefectura de Tokio", (await page.locator(".prefecture-panel").count()) === 1);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".prefecture-panel__hub")].find((x) => /Tokio/.test(x.textContent));
    b?.setAttribute("data-p04", "hub-tokio");
  });
  await fingerReveal(page, '[data-p04="hub-tokio"]');
  await fingerTap(page, kind, '[data-p04="hub-tokio"]', "«Explorar desde Tokio»");
  await page.locator(".place-card").first().waitFor({ timeout: 8000 }).catch(() => {});
  check("se entra en Tokio desde el mapa", (await page.locator(".place-card").count()) > 0 && (await page.locator(".national").count()) === 0);

  check("sin errores de JavaScript en el recorrido", errors.length === 0, errors.join(" | "));
  await context.close();
}

async function geometryFailure(browser, url, kind) {
  console.log(`\n── ${ENGINE.name()} · ${kind} · fallo simulado de geometría ──`);
  const { context, page, errors } = await newPage(browser, kind, { failGeometry: true });
  await page.goto(url);
  if (process.env.NIHON_B10_REACH_MUTANT === "uncontained-labels") {
    await page.addStyleTag({ content: ".national__sheet-content { position: static !important; }" });
  }
  await scrollHomeToMapCard(page);
  await fingerTap(page, kind, ".explorer-home__map-card", "«Ver Japón en el mapa» (geometría caída)");
  await page.locator(".national__map-fallback").filter({ hasText: "No se pudo cargar" }).waitFor({ timeout: 8000 }).catch(() => {});
  const fallback = await reachable(page, ".national__map-fallback");
  check("el aviso de error del mapa se ve en pantalla", fallback.ok && /No se pudo cargar/.test(await page.locator(".national__map-fallback").innerText()), fallback.why);
  const state = await bodyState(page);
  check("con la geometría caída tampoco hay desplazamiento heredado ni pantalla vacía", state.scrollTop === 0 && !state.centreIsBareBody, JSON.stringify(state));
  check("el panel de navegación sigue en pantalla", (await reachable(page, ".national__sheet-handle-row")).ok);
  await fingerTap(page, kind, ".national__back-button", "«‹ Volver a la portada» con el mapa caído");
  await page.locator(".explorer-home").waitFor({ timeout: 5000 }).catch(() => {});
  check("con el mapa caído, «Volver» lleva a la portada", (await page.locator(".app__body--home .explorer-home").count()) === 1);
  check("sin errores de JavaScript no capturados", errors.length === 0, errors.join(" | "));
  await context.close();
}

const server = await preview({ root: APP_ROOT, preview: { host: "127.0.0.1", port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const exe = ENGINE === chromium ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH;
const browser = await ENGINE.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
try {
  for (const kind of ["phone", "desktop"]) {
    for (const scenario of [journey, geometryFailure]) {
      // Un recorrido atascado (p. ej. sin salida a la portada) es un FAIL del gate, no un cuelgue.
      await scenario(browser, url, kind).catch((error) => check(`${scenario.name} · ${kind}: recorrido completo`, false, error.message.split("\n")[0]));
    }
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${ENGINE.name()}: ${results.length - failed.length}/${results.length} PASS`);
const out = process.env.NIHON_B10_OUT ?? `/tmp/b10-national-reachability-${ENGINE.name()}`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/results.json`, JSON.stringify({
  codeHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: APP_ROOT, encoding: "utf8" }).trim(),
  adoptedGuardFromMain: "4fc32feae3173581c2f6a0aef0fd95d9e9c91d11",
  engine: ENGINE.name(), browser: browser.version(),
  scope: "coordinate reachability in emulation; F01-F12 remain unexecuted",
  mutant: process.env.NIHON_B10_REACH_MUTANT ?? null, results,
}, null, 2));
process.exit(failed.length ? 1 : 0);
