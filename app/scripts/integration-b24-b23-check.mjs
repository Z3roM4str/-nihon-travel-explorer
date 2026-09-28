import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de la integración B24 + B23 + B6.5-fix + B6.7 test-closure
 * (`docs/INTEGRATION_B24_B23_B65_B67.md`). Todo en la MISMA build (`npm run build` antes):
 *
 *   1. Una PlaceCard con fotografía sana abre la ficha con un clic real.
 *   2. Una fotografía que falla (HTTP 503 simulado) ofrece el retry de B23.
 *   3. Tras el retry, «Quiero ir» se sigue pudiendo guardar y quitar.
 *   4. El corazón pinta 40×40 pero su área real llega a 44×44 (hit-testing en bordes y esquinas).
 *   5. El chip de joya dice «Joya escondida» y en ningún sitio «Hidden gem».
 *   6. La búsqueda global muestra «{categoría} · {barrio}, {ciudad}», con varias ciudades.
 *   7. B24 sigue devolviendo foco y scroll al cerrar la ficha con Escape.
 *   8. El mapa de ciudad sigue cumpliendo DD-023…DD-026 (encuadre editorial, agrupación, sin
 *      solapes, ≥44 px, ningún objetivo bajo el cromo).
 *   9. Phase 5A sigue 50/50 en escritorio y móvil (se lanza el gate existente sobre esta build).
 *  10. No se perdió ninguna fotografía ni lugar respecto a B24 final (`f95e81e`).
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=<chromium> node scripts/integration-b24-b23-check.mjs`.
 */

const APP = fileURLToPath(new URL("..", import.meta.url));
const B24_FINAL = "f95e81e96d497c253c1de86dac1319ba34dde785";
const TAP_MIN = 44;
const executablePath = process.env.NIHON_CHROMIUM_PATH;

const results = [];
function check(id, ok, message) {
  results.push({ id, ok: Boolean(ok) });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${message}`);
  return Boolean(ok);
}

async function realClick(page, locator, id, label) {
  const handle = await locator.elementHandle();
  if (!check(id, handle, `${label}: existe`)) return false;
  const probe = await page.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const inside = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
    const hit = inside ? document.elementFromPoint(x, y) : null;
    return { x, y, ok: inside && Boolean(hit && (hit === el || el.contains(hit))) };
  }, handle);
  if (!check(id, probe.ok, `${label}: centro visible y elementFromPoint resuelve al control`)) return false;
  await page.mouse.click(probe.x, probe.y);
  return true;
}

async function newPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  return { context, page };
}

async function enterTokio(page, url) {
  if (url) await page.goto(url);
  await page.locator(".explorer-home__city-card").first().click();
  await page.locator(".app__sidebar .place-card").first().waitFor();
}

// ---- 1–5, 7: tarjeta, retry, corazón, joya, foco/scroll --------------------------------------
async function auditCards(browser, url, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page } = await newPage(browser, viewport);
  try {
    // 2. La primera fotografía de la lista falla una vez (503) y después se sirve normalmente.
    // Merge-readiness 2026-09-26: la portada (colecciones B24) ya pide esta misma fotografía
    // antes de entrar en Tokio. Con un 503 de un solo uso lo consumía la portada y la tarjeta
    // del hub reutilizaba la imagen en memoria: nunca fallaba y «Reintentar» no aparecía
    // (50/52, idéntico en fac2e9e). Ahora el fallo se mantiene mientras se está en la portada y
    // se consume con la primera petición hecha ya dentro del hub — la de la tarjeta auditada.
    let failNext = null;
    let inHub = false;
    await page.route("**/images/places/**", async (route) => {
      if (failNext && route.request().url().includes(failNext)) {
        if (inHub) failNext = null;
        await route.fulfill({ status: 503, body: "" });
        return;
      }
      await route.continue();
    });
    const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
    const firstTokio = places.find((place) => place.hub === "Tokio");
    failNext = `/images/places/${firstTokio.id}/`;
    await page.goto(url, { waitUntil: "networkidle" });
    inHub = true;
    await enterTokio(page, null);
    const card = page.locator(".app__sidebar .place-card").first();
    const retry = card.locator(".place-card__photo-retry");
    const offered = await retry.waitFor({ timeout: 6000 }).then(() => true, () => false);
    check("2-RETRY", offered, `${tag}: una fotografía fallida ofrece «Reintentar» (B23)`);
    if (offered && (await realClick(page, retry, "2-RETRY", `${tag}: Reintentar`))) {
      check("2-RETRY", await card.locator(".place-card__image").waitFor({ timeout: 6000 }).then(() => true, () => false),
        `${tag}: tras reintentar la fotografía se recupera`);
    }

    // 4. Corazón: 40×40 pintado, 44×44 real.
    const heart = card.locator(".place-card__save").first();
    const geo = await heart.evaluate((button, half) => {
      const r = button.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const offsets = [[-half, 0], [half, 0], [0, -half], [0, half], [-half, -half], [half, half], [-half, half], [half, -half]];
      const misses = offsets.filter(([dx, dy]) => {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        return !(hit && (hit === button || button.contains(hit)));
      });
      return { w: r.width, h: r.height, misses: misses.length };
    }, TAP_MIN / 2 - 0.5);
    check("4-HEART", Math.round(geo.w) === 40 && Math.round(geo.h) === 40, `${tag}: el círculo visible del corazón mide 40×40 (${geo.w}×${geo.h})`);
    check("4-HEART", geo.misses === 0, `${tag}: el área real del corazón llega a 44×44 (${geo.misses} de 8 puntos fallan)`);

    // 3. Tras el retry, Quiero ir se guarda y se quita con clic real.
    const before = await heart.getAttribute("aria-pressed");
    if (await realClick(page, heart, "3-SAVE", `${tag}: corazón (guardar)`)) {
      await page.waitForTimeout(150);
      check("3-SAVE", (await heart.getAttribute("aria-pressed")) !== before, `${tag}: guardar cambia aria-pressed`);
      if (await realClick(page, heart, "3-SAVE", `${tag}: corazón (quitar)`)) {
        await page.waitForTimeout(150);
        check("3-SAVE", (await heart.getAttribute("aria-pressed")) === before, `${tag}: quitar devuelve aria-pressed`);
      }
    }

    // 5. «Joya escondida», nunca «Hidden gem».
    const labels = await page.evaluate(() => document.querySelector(".app__sidebar").textContent);
    check("5-JOYA", labels.includes("Joya escondida"), `${tag}: la lista de Tokio muestra «Joya escondida»`);
    check("5-JOYA", !labels.includes("Hidden gem"), `${tag}: ningún texto «Hidden gem»`);

    // 7. B24: foco y scroll vuelven al cerrar la ficha con Escape.
    const list = page.locator(".app__sidebar");
    const box = await list.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));
    for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    const scroller = await page.evaluate(() => {
      let el = document.querySelector(".app__sidebar .place-card");
      while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
      return el ? { top: el.scrollTop } : null;
    });
    // La primera tarjeta cuyo control de abrir quede de verdad a la vista tras desplazar (en una
    // rejilla de 3 columnas no vale un índice fijo).
    const visibleIndex = await page.$$eval(".app__sidebar .place-card__open", (openers) =>
      openers.findIndex((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (r.top < 0 || y >= innerHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return Boolean(hit && (hit === el || el.contains(hit)));
      })
    );
    check("7-FOCUS", visibleIndex >= 0, `${tag}: tras desplazar hay una tarjeta a la vista (índice ${visibleIndex})`);
    const opener = page.locator(".app__sidebar .place-card__open").nth(Math.max(visibleIndex, 0));
    if (scroller && (await realClick(page, opener, "7-FOCUS", `${tag}: abrir una tarjeta desplazada`))) {
      check("1-OPEN", await page.locator("#place-detail-title").waitFor({ timeout: 4000 }).then(() => true, () => false),
        `${tag}: una tarjeta con fotografía sana abre la ficha`);
      await page.keyboard.press("Escape");
      await page.locator("#place-detail-title").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        let el = document.querySelector(".app__sidebar .place-card");
        while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
        return { top: el?.scrollTop ?? -1 };
      });
      const focused = await opener.evaluate((el) => document.activeElement === el);
      check("7-FOCUS", focused, `${tag}: Escape devuelve el foco a la tarjeta que abrió la ficha`);
      check("7-FOCUS", Math.abs(after.top - scroller.top) <= 2, `${tag}: el scroll de la lista vuelve (${scroller.top} → ${after.top})`);
    }
  } finally {
    await context.close();
  }
}

// ---- 6: búsqueda global -----------------------------------------------------------------------
async function auditGlobalSearch(browser, url, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page } = await newPage(browser, viewport);
  try {
    await page.goto(url);
    await page.locator(".explorer-home__search-button").click();
    await page.locator(".search-sheet__field input").waitFor();
    await page.keyboard.type("templo");
    await page.locator(".search-sheet .place-list li").first().waitFor();
    await page.waitForTimeout(200);
    const metas = await page.$$eval(".search-sheet .place-list > li .place-card__meta", (items) => items.map((el) => el.textContent.trim()));
    const hubs = ["Tokio", "Kioto", "Osaka", "Okinawa", "Sapporo", "Nagoya", "Fukuoka"];
    const bad = metas.filter((meta) => !/^[^·]+ · [^·,]+, [^·,]+$/.test(meta) || !hubs.some((hub) => meta.endsWith(`, ${hub}`)));
    const cities = new Set(metas.map((meta) => meta.split(", ").pop()));
    check("6-SEARCH", metas.length > 0 && bad.length === 0, `${tag}: ${metas.length} filas con «{categoría} · {barrio}, {ciudad}» (${bad[0] ?? "todas"})`);
    check("6-SEARCH", cities.size >= 2, `${tag}: la búsqueda global mezcla ciudades distintas (${[...cities].join(", ")})`);
  } finally {
    await context.close();
  }
}

// ---- 8: invariantes del mapa (DD-023…DD-026) --------------------------------------------------
async function auditMap(browser, url, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page } = await newPage(browser, viewport);
  try {
    await enterTokio(page, url);
    if (viewport.width < 1200) await page.locator(".explorer-bar__pane").click();
    await page.locator(".app__map-area .leaflet-marker-icon").first().waitFor();
    await page.waitForTimeout(1800);
    const report = await page.evaluate(() => {
      const areaEl = document.querySelector(".app__map-area");
      const area = areaEl.getBoundingClientRect();
      const chrome = [...areaEl.querySelectorAll("[data-map-chrome], .leaflet-control")].map((el) => el.getBoundingClientRect());
      const icons = [...areaEl.querySelectorAll(".leaflet-marker-icon")].map((el) => ({ el, r: el.getBoundingClientRect() }));
      const visible = icons.filter(({ r }) => {
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return x > area.left && x < area.right && y > area.top && y < area.bottom && x < innerWidth && y < innerHeight;
      });
      const cross = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
      let overlaps = 0;
      for (let i = 0; i < visible.length; i += 1) for (let j = i + 1; j < visible.length; j += 1) if (cross(visible[i].r, visible[j].r)) overlaps += 1;
      const small = visible.filter(({ r }) => r.width < 43.5 || r.height < 43.5).length;
      const underChrome = visible.filter(({ r }) => chrome.some((c) => cross(r, c))).length;
      const unreachable = visible.filter(({ el, r }) => {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit && (hit === el || el.contains(hit)));
      }).length;
      const singles = visible.filter(({ el }) => !el.classList.contains("place-cluster")).length;
      const represented = icons.reduce((sum, { el }) => sum + Number(el.querySelector(".place-cluster__count")?.textContent ?? 1), 0);
      const zoom = [...document.querySelectorAll(".leaflet-tile")].map((t) => Number(t.src.split("/").at(-3))).filter(Number.isFinite)[0];
      return { visible: visible.length, overlaps, small, underChrome, unreachable, singles, represented, zoom };
    });
    const tokioCount = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8")).filter((p) => p.hub === "Tokio").length;
    check("8-MAP", report.visible > 0 && report.small === 0, `${tag}: ${report.visible} objetivos visibles, todos ≥44×44 (Art. 11)`);
    check("8-MAP", report.overlaps === 0 && report.singles <= 12, `${tag}: sin solapes y ≤12 sueltos (DD-024, 03 §9): ${report.overlaps} solapes, ${report.singles} sueltos`);
    check("8-MAP", report.underChrome === 0 && report.unreachable === 0, `${tag}: ningún objetivo bajo el cromo ni tapado (DD-026): ${report.underChrome}/${report.unreachable}`);
    check("8-MAP", report.represented === tokioCount, `${tag}: los iconos representan los ${tokioCount} lugares de Tokio (${report.represented})`);
    check("8-MAP", report.zoom === undefined || report.zoom >= 12, `${tag}: encuadre editorial de Tokio, no el de todo el hub (DD-023): zoom de teselas ${report.zoom ?? "sin red"}`);
  } finally {
    await context.close();
  }
}

// ---- 10: ninguna fotografía ni lugar perdido --------------------------------------------------
function auditAssets() {
  const guarded = ["public/images", "src/data/places.json", "src/data/photography-metadata.json", "src/data/place-images.ts"];
  const diff = execFileSync("git", ["diff", "--name-status", B24_FINAL, "--", ...guarded], { cwd: APP, encoding: "utf8" }).trim();
  check("10-ASSETS", diff === "", `fotografía y dataset idénticos a B24 final ${B24_FINAL.slice(0, 7)}${diff ? `: ${diff.split("\n").slice(0, 3).join("; ")}` : ""}`);
  const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
  const before = JSON.parse(execFileSync("git", ["show", `${B24_FINAL}:app/src/data/places.json`], { cwd: APP, encoding: "utf8", maxBuffer: 64 << 20 }));
  check("10-ASSETS", places.length === before.length, `mismos lugares que B24 final (${places.length}/${before.length})`);
}

// ---- 9: Phase 5A sobre esta misma build -------------------------------------------------------
function auditPhase5A() {
  for (const viewport of ["desktop", "mobile"]) {
    const run = spawnSync(process.execPath, ["scripts/phase5a-rc-browser-audit.mjs", `--viewport=${viewport}`], {
      cwd: APP,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 << 20,
    });
    const summary = `${run.stdout}${run.stderr}`.match(/(\d+)\/(\d+) checks passed/);
    check("9-PHASE5A", run.status === 0 && summary && summary[1] === summary[2] && summary[2] === "50",
      `Phase 5A ${viewport}: ${summary ? `${summary[1]}/${summary[2]}` : `exit ${run.status}`}`);
  }
}

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls?.local[0];
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  auditAssets();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await auditCards(browser, url, viewport);
    await auditGlobalSearch(browser, url, viewport);
    await auditMap(browser, url, viewport);
  }
} finally {
  await browser.close();
  await server.close();
}
auditPhase5A();

const failed = results.filter((r) => !r.ok).length;
console.log(`\nIntegración B24+B23+B6.5+B6.7: ${results.length - failed}/${results.length} comprobaciones, ${failed} fallos`);
process.exit(failed === 0 ? 0 : 1);
