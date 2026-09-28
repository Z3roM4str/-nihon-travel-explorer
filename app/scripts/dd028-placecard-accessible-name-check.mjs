import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * DD-028 — el nombre accesible de PlaceCard iguala su identificación visible.
 *
 * Contra el build de producción, lee el nombre accesible del botón que abre la ficha desde el
 * árbol de accesibilidad real de Chromium (CDP `Accessibility.getPartialAXTree`), no desde el
 * atributo, y lo compara con lo que la tarjeta pinta: el nombre (`.place-card__heading`) y la
 * línea de ubicación (compacta: «{barrio}, {ciudad}» tras el `·`; normal: «{zona}»). Cubre las
 * tres superficies donde vive PlaceCard: búsqueda de todo Japón y «Cerca de aquí» (compacta) y la
 * lista de un hub (normal).
 *
 * Usage: node scripts/dd028-placecard-accessible-name-check.mjs [--viewport=mobile|desktop|all]
 */

const VIEWPORTS = { mobile: { width: 390, height: 844, dpr: 2 }, desktop: { width: 1440, height: 900, dpr: 1 } };
const arg = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
assert.ok(arg === "all" || arg in VIEWPORTS, `unknown viewport: ${arg}`);
const targets = arg === "all" ? Object.keys(VIEWPORTS) : [arg];

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const url = server.resolvedUrls.local[0];

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

/** Accessible name of every `.place-card__open` inside `scope`, read from the AX tree. */
async function axNames(page, cdp, scope) {
  const cards = page.locator(`${scope} .place-card`);
  const count = await cards.count();
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const handle = await card.locator(".place-card__open").elementHandle();
    const { node } = await cdp.send("DOM.describeNode", await nodeIdOf(cdp, handle));
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { backendNodeId: node.backendNodeId, fetchRelatives: false });
    const ax = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId) ?? nodes[0];
    const visible = await card.evaluate((el) => {
      const text = (sel) => el.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const line = text(".place-card__meta") || text(".place-card__where");
      return { name: text(".place-card__heading"), where: line.split(" · ").slice(1).join(" · ") };
    });
    rows.push({ role: ax?.role?.value, ax: ax?.name?.value ?? "", ignored: ax?.ignored, visible });
  }
  return rows;
}

async function nodeIdOf(cdp, handle) {
  // Resolve the Playwright handle to a CDP DOM node through a unique, removed-after marker.
  const marker = `dd028-${Math.random().toString(36).slice(2)}`;
  await handle.evaluate((el, m) => el.setAttribute("data-dd028", m), marker);
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-dd028="${marker}"]` });
  await handle.evaluate((el) => el.removeAttribute("data-dd028"));
  return { nodeId };
}

function assertRows(surface, rows, { compact }) {
  check(`${surface}: hay tarjetas que auditar`, rows.length > 0, `${rows.length}`);
  const bad = rows.filter((r) => {
    if (r.role !== "button" || r.ignored) return true;
    if (!r.ax.startsWith(`${r.visible.name}.`)) return true;
    if (!r.visible.where || !r.ax.endsWith(` en ${r.visible.where}.`)) return true;
    return false;
  });
  check(
    `${surface}: el nombre accesible (árbol AX) contiene nombre y ubicación visibles, en ese orden (${rows.length})`,
    bad.length === 0,
    bad.slice(0, 3).map((r) => `«${r.ax}» vs «${r.visible.name}» / «${r.visible.where}»`).join(" | ")
  );
  if (compact) {
    const withCity = rows.filter((r) => /, [^,]+$/.test(r.visible.where));
    check(`${surface}: la línea compacta visible incluye la ciudad y el nombre accesible también`, withCity.length === rows.length && withCity.every((r) => r.ax.includes(r.visible.where)), `${withCity.length}/${rows.length}`);
  }
}

const browser = await chromium.launch(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {});
try {
  for (const name of targets) {
    const { width, height, dpr } = VIEWPORTS[name];
    console.log(`\n── ${name} ${width}×${height} ──`);
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width <= 860 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("Accessibility.enable");
    await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 1. Búsqueda de todo Japón — PlaceCard compact.
    await page.locator(".explorer-home__search-button").click();
    await page.locator(".search-sheet__field input").fill("a");
    await page.locator(".search-sheet .place-card__open").first().waitFor();
    const searchRows = await axNames(page, cdp, ".search-sheet");
    assertRows("búsqueda global (compact)", searchRows, { compact: true });
    const sample = searchRows[0];
    console.log(`      ejemplo AX: «${sample.ax}»`);

    // 2. «Cerca de aquí» — PlaceCard compact dentro de la ficha.
    await page.locator(".search-sheet__field input").fill("Kiyomizu");
    await page.locator(".search-sheet .place-card__open").first().click();
    await page.locator("#place-detail-title").waitFor();
    await page.locator(".place-detail .place-card--compact").first().waitFor();
    const nearbyRows = await axNames(page, cdp, ".place-detail");
    assertRows("«Cerca de aquí» (compact)", nearbyRows, { compact: true });
    await context.close();

    // 3. Lista de hub — PlaceCard normal (control: su contrato no cambia).
    const context2 = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width <= 860 });
    const page2 = await context2.newPage();
    const cdp2 = await context2.newCDPSession(page2);
    await cdp2.send("DOM.enable");
    await cdp2.send("Accessibility.enable");
    await page2.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page2.goto(url, { waitUntil: "domcontentloaded" });
    await page2.getByRole("button", { name: /^Kioto/ }).first().click();
    await page2.locator(".place-list .place-card:not(.place-card--compact)").first().waitFor();
    const listRows = (await axNames(page2, cdp2, ".place-list")).filter((r) => r.visible.where);
    assertRows("lista de hub (normal)", listRows, { compact: false });
    await context2.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`\nDD-028 PlaceCard accessible name: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
