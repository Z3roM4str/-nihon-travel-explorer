import { createServer } from "node:http";
import { chromium, webkit } from "playwright";
import { pressOfferedReload } from "./lib/h03-reload.mjs";

/**
 * Regresión de H03 — clasificación de un timeout de «Recargar la página» (scripts/lib/h03-reload.mjs).
 *
 * Es determinista y no depende de que el motor falle: se FABRICAN las situaciones con `page.route` y un servidor local, en
 * Chromium y en WebKit, sin código de Nihon:
 *   T1  la recarga se emite pero nunca llega al servidor (lo que WebKit hace de forma espontánea)  → cobertura parcial + 2.ª pulsación estricta;
 *   T2  la recarga llega al servidor y éste no responde (un fallo REAL de recuperación)              → fallo estricto, sin segunda oportunidad;
 *   T3  el botón no recarga (no se emite ninguna navegación)                                        → fallo estricto;
 *   T4  recarga sana                                                                                → 1 intento y sin informe;
 *   T5  recarga perdida Y la 2.ª pulsación tampoco recarga                                          → fallo estricto (la salida ofrecida debe funcionar);
 *   T6  el proceso de red del motor se reemplazó y la petición llegó al servidor sin respuesta      → cobertura parcial + 2.ª pulsación estricta.
 *
 *   NIHON_BROWSER=webkit|chromium  NIHON_PROBE_TIMEOUT_MS=1500
 */
const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const TIMEOUT_MS = Number(process.env.NIHON_PROBE_TIMEOUT_MS ?? 1500);

const state = { documents: 0, holdDocuments: 0 };
const held = [];
const server = createServer((req, res) => {
  if (req.url !== "/") { res.writeHead(404); res.end(); return; }
  state.documents += 1;
  const respond = () => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end('<!doctype html><meta charset="utf-8"><div data-lazy-failure><button id="reload">Recargar la página</button></div>' +
      '<script>document.getElementById("reload").onclick=()=>{ if (window.__ignoreClick !== true) location.reload(); }</script>');
  };
  if (state.holdDocuments > 0) { state.holdDocuments -= 1; held.push(respond); return; } // llega al servidor y no se atiende
  respond();
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch();

const results = [];
const check = (id, label, ok, extra) => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${label}${extra !== undefined ? ` (${extra})` : ""}`);
};

async function scenario(id, label, { drop = 0, hold = 0, ignoreClick = false, replaced = false, keepDropping = false, expectReports, expect }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const dropped = [];
  let remainingDrops = 0;
  // WebKit deja la navegación perdida PENDIENTE (como en CI) y una 2.ª recarga la sustituye. Chromium no tiene ese fallo y no
  // sustituye una navegación interceptada y sin atender: ahí la navegación fabricada se aborta (ERR_ABORTED conserva la página).
  const releaseDropped = () => { for (const route of dropped.splice(0)) if (BROWSER === "chromium") route.abort("aborted").catch(() => {}); };
  await page.route(base, (route) => {
    if (route.request().isNavigationRequest() && remainingDrops > 0) { remainingDrops -= 1; dropped.push(route); return; } // nunca llega al servidor
    return route.continue();
  });
  await page.goto(base);
  await page.waitForSelector("#reload");
  await page.evaluate((ignore) => { window.__beforeReload = true; window.__ignoreClick = ignore; }, ignoreClick);
  remainingDrops = drop;
  state.holdDocuments = hold;
  const before = state.documents;
  const reports = [];
  let outcome, error = null;
  try {
    outcome = await pressOfferedReload({
      page, alert: page.locator("[data-lazy-failure]"), proxy: { state }, tag: id, networkReplaced: () => replaced,
      report: (detail) => { reports.push(detail); if (!keepDropping) remainingDrops = 0; held.splice(0).forEach((respond) => respond()); releaseDropped(); if (ignoreClick) page.evaluate(() => { window.__ignoreClick = false; }).catch(() => {}); },
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) { error = e; }
  held.splice(0);
  state.holdDocuments = 0;
  if (error && process.env.DEBUG_H03) console.log("   error:", String(error.message).split("\n")[0]);
  const got = error ? "lanza" : outcome.attempts === 1 ? "1 intento" : "2 intentos";
  const wantedReports = expectReports ?? (expect === "2 intentos" ? 1 : 0);
  const ok = expect === got && reports.length === wantedReports;
  check(id, label, ok, `esperado=${expect}; obtenido=${got}; informes=${reports.length}; documentos recibidos por el servidor=${state.documents - before}`);
  await context.close();
}

try {
  await scenario("T1", "recarga emitida pero perdida antes de llegar al servidor → cobertura parcial y 2.ª pulsación", { drop: 1, expect: "2 intentos" });
  await scenario("T2", "la recarga llega al servidor y no recibe respuesta → fallo estricto", { hold: 1, expect: "lanza" });
  await scenario("T3", "el botón no emite ninguna navegación → fallo estricto", { ignoreClick: true, expect: "lanza" });
  await scenario("T4", "recarga sana → un intento y sin informe", { expect: "1 intento" });
  await scenario("T5", "recarga perdida y la segunda también se pierde → fallo estricto", { drop: 2, keepDropping: true, expectReports: 1, expect: "lanza" });
  await scenario("T6", "proceso de red reemplazado + petición sin respuesta → cobertura parcial y 2.ª pulsación", { hold: 1, replaced: true, expect: "2 intentos" });
} finally {
  await browser.close();
  server.closeAllConnections?.();
  await new Promise((ok) => server.close(ok));
}
console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones OK (${BROWSER})`);
process.exit(results.every(Boolean) ? 0 : 1);
