import { createServer, request as httpRequest } from "node:http";
import { mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * H03 — ¿por qué «Recargar la página» parece atascarse en WebKit? Pregunta concreta, no una matriz general.
 *
 * Cada repetición usa un perfil persistente NUEVO, un proxy nuevo y el mismo flujo; solo cambia la variante:
 *   A  producto actual: clic en «Recargar la página» (refresco de módulos + location.reload()), servidor caído por RESET;
 *   B  recarga simple: location.reload() desde la página, sin refresco de módulos, mismo RESET;
 *   C  producto actual, pero el servidor responde HTTP 503 (sin destruir sockets).
 *   D  como B, tras una petición neutra con `cache: "reload"` (no es un módulo) justo antes de recargar;
 *   H  como A, pero la sonda retrasa 150 ms la resolución del refresco (no toca el producto): ¿importa que las conexiones se liberen?
 *   F  contrafactual SIN producto: página mínima con una importación dinámica rechazada por RESET + recarga simple;
 *   G  igual que F pero con HTTP 503.
 *
 * Por repetición se unen en una única línea de tiempo (relativa al clic) lo que ve la PÁGINA (clic, fetch de refresco con su
 * inicio/fin/error, temporizador de 3 s, beforeunload/pagehide/pageshow/DOMContentLoaded/load), el DRIVER (petición/respuesta del
 * documento, navegación, load) y el PROXY (cada petición recibida, sockets destruidos). Un timeout esperando una variable no se
 * toma como «no hubo recarga»: se clasifica con esa línea de tiempo.
 *
 *   NIHON_BROWSER=webkit|chromium  NIHON_PROBE_VARIANTS=A,B,C  NIHON_PROBE_REPS=30  NIHON_PROBE_OUT=dir  NIHON_PORT=4291
 */
const BROWSER = process.env.NIHON_BROWSER === "chromium" ? "chromium" : "webkit";
const VARIANTS = (process.env.NIHON_PROBE_VARIANTS ?? "A,B,C").split(",").map((v) => v.trim()).filter(Boolean);
const REPS = Number(process.env.NIHON_PROBE_REPS ?? 10);
const PORT = Number(process.env.NIHON_PORT ?? 4291);
const OUT = resolve(process.env.NIHON_PROBE_OUT ?? "/tmp/nihon-h03-reload-stall");
const STALL_MS = Number(process.env.NIHON_PROBE_STALL_MS ?? 8000);
const NOTICE_MS = Number(process.env.NIHON_PROBE_NOTICE_MS ?? 8000);
const LOAD = process.env.NIHON_PROBE_LOAD === "1";
const LATE_MS = Number(process.env.NIHON_PROBE_LATE_MS ?? 12000);
if (!Number.isInteger(REPS) || REPS < 1 || REPS > 200) throw new Error("NIHON_PROBE_REPS fuera de rango");
mkdirSync(OUT, { recursive: true });

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
const tinyTarget = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    // Imita lo esencial del patrón real: varias conexiones keep-alive en uso (recursos) y, al abrir, tres importaciones en
    // paralelo de las que dos son rechazadas por el servidor. Sin React, sin almacenamiento propio, sin código de Nihon.
    res.end('<!doctype html><meta charset="utf-8"><title>sonda</title><button id="open">Abrir</button><p id="out"></p><script>' +
      'for (let i = 0; i < 12; i++) fetch("/img/" + i + ".bin").catch(() => {});' +
      'document.getElementById("open").onclick=()=>Promise.all([import("/assets/OrderedSequenceBuilder-sonda.js"),import("/assets/ZoneComparison-sonda.js"),import("/assets/usePlanningDraft-sonda.js")]).then(()=>{out.textContent="ok"},()=>{out.setAttribute("data-lazy-failure","1");out.textContent="fallo"})' +
      '</script>');
  } else if (/^\/assets\/[A-Za-z]+-sonda\.js$/.test(path)) {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end("export default 1;");
  } else if (path.startsWith("/img/")) {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(Buffer.alloc(20000));
  } else { res.writeHead(404); res.end(); }
});
await new Promise((ok) => tinyTarget.listen(0, "127.0.0.1", ok));
const TINY_PORT = tinyTarget.address().port;
const engine = BROWSER === "webkit" ? webkit : chromium;
const LAZY = /\/assets\/(OrderedSequenceBuilder|ZoneComparison)-[^/]*\.js/;

function startFlakyProxy(targetPort, kind) {
  const state = { failing: true, kind, hits: 0, served: 0, log: [] };
  const note = (k, d) => state.log.push({ at: Date.now(), k, ...d });
  const proxy = createServer((req, res) => {
    const info = { url: (req.url ?? "").split("/").pop(), cc: req.headers["cache-control"] ?? null, conn: req.headers.connection ?? null, port: req.socket.remotePort };
    if (state.failing && LAZY.test(req.url ?? "")) {
      state.hits += 1;
      note("proxy-reject", { ...info, how: state.kind });
      if (state.kind === "reset") req.socket.destroy();
      else {
        res.writeHead(503, { "content-type": "text/plain", "cache-control": "no-store" });
        res.end("servicio no disponible");
      }
      return;
    }
    note("proxy-req", info);
    const upstream = httpRequest({ host: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: req.headers }, (up) => {
      state.served += 1;
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
      res.on("finish", () => note("proxy-done", { ...info, status: up.statusCode }));
      res.on("close", () => { if (!res.writableFinished) note("proxy-aborted", info); });
    });
    upstream.on("error", () => { note("proxy-upstream-error", info); res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  return new Promise((done) => proxy.listen(0, "127.0.0.1", () => done({
    url: `http://127.0.0.1:${proxy.address().port}`,
    state,
    close: () => new Promise((ok) => { proxy.closeAllConnections?.(); proxy.close(() => ok()); }),
  })));
}

/** Solo registra: no cambia el flujo del producto. Se serializa por consola para sobrevivir a la recarga. */
const PAGE_PROBE = ({ settleMs }) => {
  const log = (k, d) => { try { console.debug("__h03 " + JSON.stringify({ at: Date.now(), k, ...d })); } catch { /* el registro no altera nada */ } };
  let fetchId = 0;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    const id = ++fetchId, started = Date.now();
    log("fetch-start", { id, url: String(url).split("/").pop(), cache: init?.cache ?? null });
    let promise = originalFetch.apply(this, arguments);
    // Variante H: simula (solo en la sonda) una espera para que el motor devuelva las conexiones antes de recargar.
    if (settleMs > 0 && init?.cache === "reload") { const settled = promise; promise = settled.then((r) => new Promise((done) => setTimeout(() => done(r), settleMs)), (e) => { throw e; }); }
    promise.then((r) => log("fetch-ok", { id, status: r.status, ms: Date.now() - started }), (e) => log("fetch-err", { id, err: String(e), ms: Date.now() - started }));
    return promise;
  };
  const originalTimeout = window.setTimeout;
  window.setTimeout = function (fn, ms, ...rest) {
    if (typeof ms === "number" && ms >= 2000 && ms <= 4000) {
      log("timer-set", { ms });
      return originalTimeout.call(this, (...args) => { log("timer-fire", { ms }); return typeof fn === "function" ? fn(...args) : undefined; }, ms, ...rest);
    }
    return originalTimeout.call(this, fn, ms, ...rest);
  };
  for (const ev of ["beforeunload", "pagehide", "unload", "pageshow", "freeze"]) window.addEventListener(ev, () => log("evt", { ev, vs: document.visibilityState }), true);
  document.addEventListener("DOMContentLoaded", () => log("evt", { ev: "DOMContentLoaded" }), true);
  window.addEventListener("load", () => log("evt", { ev: "load" }), true);
  document.addEventListener("click", (e) => log("click", { text: e.target?.closest?.("button")?.textContent ?? null }), true);
  // Instante en que aparece el aviso (en el reloj de la página), para medir clic → aviso sin la latencia del driver.
  const watchAlert = () => {
    const seen = () => document.querySelector("[data-lazy-failure]");
    if (seen()) return log("alert", {});
    const observer = new MutationObserver(() => { if (seen()) { observer.disconnect(); log("alert", {}); } });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  document.addEventListener("DOMContentLoaded", watchAlert, true);
  log("doc-start", { href: location.pathname });
};

async function freshContext(profile, settleMs = 0) {
  const context = await engine.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem("__ctxSeeded")) {
      localStorage.setItem("__ctxSeeded", "1");
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("probe.sentinel", "presente");
    }
  });
  await context.addInitScript(PAGE_PROBE, { settleMs });
  return context;
}

/** PIDs de procesos de red de WebKit (solo Linux): permite ver si el proceso de red se reemplaza durante la repetición. */
const networkProcesses = () => {
  if (BROWSER !== "webkit") return [];
  try {
    return readdirSync("/proc").filter((p) => /^\d+$/.test(p)).flatMap((p) => {
      try {
        const exe = readlinkSync(`/proc/${p}/exe`).split("/").at(-1);
        return /NetworkProcess$/.test(exe) ? [Number(p)] : [];
      } catch { return []; }
    });
  } catch { return []; }
};
const loadWorkers = LOAD ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker(
  "function load() { const until = performance.now() + 20; while (performance.now() < until) Math.sqrt(Math.random()); setTimeout(load, 10); } load();", { eval: true })) : [];

const summarize = (timeline, t0) => timeline.map((e) => ({ ...e, t: e.at - t0 })).sort((a, b) => a.at - b.at);

async function runOne(variant, index) {
  const kind = variant === "C" || variant === "G" ? "503" : "reset";
  const tiny = variant === "F" || variant === "G";
  const profile = mkdtempSync(join(tmpdir(), "nihon-h03-stall-"));
  const proxy = await startFlakyProxy(tiny ? TINY_PORT : PORT, kind);
  const timeline = [];
  const push = (k, d) => timeline.push({ at: Date.now(), k, src: "driver", ...d });
  let context;
  const row = { variant, index, browser: BROWSER, np: {} };
  const baselineNp = new Set(networkProcesses());
  const mineNp = () => networkProcesses().filter((pid) => !baselineNp.has(pid));
  try {
    context = await freshContext(profile, variant === "H" ? Number(process.env.NIHON_PROBE_SETTLE_MS ?? 150) : 0);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("console", (m) => {
      const text = m.text();
      if (text.startsWith("__h03 ")) { try { const e = JSON.parse(text.slice(6)); timeline.push({ ...e, src: "page", seen: Date.now() }); } catch { /* ignorar */ } }
    });
    page.on("request", (r) => { if (r.isNavigationRequest() || LAZY.test(r.url())) push("request", { url: r.url().split("/").pop() || "/", nav: r.isNavigationRequest() }); });
    page.on("response", (r) => { const q = r.request(); if (q.isNavigationRequest() || LAZY.test(r.url())) push("response", { url: r.url().split("/").pop() || "/", status: r.status(), nav: q.isNavigationRequest() }); });
    page.on("requestfailed", (r) => { if (r.isNavigationRequest() || LAZY.test(r.url())) push("requestfailed", { url: r.url().split("/").pop() || "/", err: r.failure()?.errorText ?? null, nav: r.isNavigationRequest() }); });
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) push("framenavigated", {}); });
    page.on("load", () => push("load", {}));
    page.on("domcontentloaded", () => push("domcontentloaded", {}));

    await page.goto(proxy.url);
    if (tiny) await page.waitForSelector("#open"); else await page.waitForSelector("#root *");
    row.np.start = mineNp();
    // Ruta del fallo: abrir «Viaje» con el módulo rechazado por el servidor.
    const navStart = Date.now();
    if (tiny) await page.locator("#open").click();
    else await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Viaje" }).click();
    const alert = page.locator("[data-lazy-failure]");
    try { await alert.first().waitFor({ state: "visible", timeout: NOTICE_MS }); row.noticeMs = Date.now() - navStart; }
    catch { row.noticeMs = null; }
    {
      const clickAt = timeline.find((e) => e.src === "page" && e.k === "click" && (e.text === "Viaje" || e.text === "Abrir"))?.at;
      const alertAt = timeline.find((e) => e.src === "page" && e.k === "alert")?.at;
      row.clickToAlertMs = clickAt && alertAt ? alertAt - clickAt : null;
    }
    row.rejectedRequests = proxy.state.hits;
    row.np.afterNotice = mineNp();
    if (row.noticeMs === null) { row.outcome = "no-notice"; row.timeline = summarize([...timeline, ...proxy.state.log.map((e) => ({ ...e, src: "proxy" }))], navStart).filter((e) => e.t >= -200); return row; }

    // El servidor vuelve a responder. Sentinela de la página anterior para saber si el documento cambió.
    proxy.state.failing = false;
    await page.evaluate(() => { window.__beforeReload = true; });
    const t0 = Date.now();
    push("T0", {});
    if (variant === "D") {
      await page.evaluate(() => fetch("/favicon.svg", { cache: "reload" }).then((r) => r.status, () => 0));
      await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
    } else if (variant === "B" || tiny) await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
    else await alert.first().getByRole("button", { name: /Recargar/ }).click();

    const loaded = () => timeline.filter((e) => e.src === "driver" && e.k === "load" && e.at >= t0).length > 0;
    const deadline = Date.now() + STALL_MS;
    while (Date.now() < deadline && !loaded()) await new Promise((r) => setTimeout(r, 25));
    row.np.afterReload = mineNp();
    row.reloadedWithinLimit = loaded();
    row.loadMs = row.reloadedWithinLimit ? timeline.find((e) => e.src === "driver" && e.k === "load" && e.at >= t0).at - t0 : null;
    if (!row.reloadedWithinLimit) {
      // Diagnóstico tras el límite: ¿la página responde? ¿llega la recarga más tarde?
      try { row.pageResponsive = await Promise.race([page.evaluate(() => ({ stale: window.__beforeReload === true, ready: document.readyState })), new Promise((_, no) => setTimeout(() => no(new Error("sin respuesta en 1500 ms")), 1500))]); }
      catch (error) { row.pageResponsive = { error: String(error.message ?? error) }; }
      const lateDeadline = Date.now() + LATE_MS;
      while (Date.now() < lateDeadline && !loaded()) await new Promise((r) => setTimeout(r, 50));
      row.reloadedLate = loaded();
      row.loadMsLate = row.reloadedLate ? timeline.find((e) => e.src === "driver" && e.k === "load" && e.at >= t0).at - t0 : null;
      row.outcome = row.reloadedLate ? "reload-late" : "stalled";
      if (!row.reloadedLate) {
        // ¿Qué haría una persona? Pulsar otra vez / recargar otra vez: diagnóstico, no cambia el veredicto.
        const attempt = async (label, action) => {
          const from = Date.now();
          try { await Promise.race([action(), new Promise((_, no) => setTimeout(() => no(new Error("sin respuesta")), 1500))]); } catch { /* la página puede no contestar */ }
          const end = Date.now() + 5000;
          while (Date.now() < end && !timeline.some((e) => e.src === "driver" && e.k === "load" && e.at >= from)) await new Promise((r) => setTimeout(r, 50));
          const hit = timeline.find((e) => e.src === "driver" && e.k === "load" && e.at >= from);
          (row.retry ??= {})[label] = hit ? hit.at - from : null;
        };
        await attempt("secondReload", () => page.evaluate(() => { setTimeout(() => location.reload(), 0); }));
        if (row.retry.secondReload === null) await attempt("neutralFetchThenReload", () => page.evaluate(() => fetch("/favicon.svg", { cache: "reload" }).then(() => { setTimeout(() => location.reload(), 0); })));
      }
    } else {
      row.outcome = "reloaded";
      if (tiny) await page.waitForSelector("#open"); else await page.waitForSelector("#root *");
      if (tiny) { await page.locator("#open").click(); try { await page.getByText("ok", { exact: true }).waitFor({ timeout: 8000 }); row.recovered = true; } catch { row.recovered = false; } }
      else {
        await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Viaje" }).click();
        try { await page.locator(".day-card, .ordered-sequence").first().waitFor({ timeout: 8000 }); row.recovered = true; } catch { row.recovered = false; }
      }
      row.sentinelKept = (await page.evaluate(() => localStorage.getItem("probe.sentinel"))) === "presente";
    }
    row.np.end = mineNp();
    row.timeline = summarize([...timeline, ...proxy.state.log.map((e) => ({ ...e, src: "proxy" }))], t0).filter((e) => e.t >= -200);
  } catch (error) {
    row.outcome = "error";
    row.error = String(error.message ?? error).split("\n")[0];
    row.timeline = summarize([...timeline, ...proxy.state.log.map((e) => ({ ...e, src: "proxy" }))], timeline.find((e) => e.k === "T0")?.at ?? timeline[0]?.at ?? Date.now());
  } finally {
    await context?.close().catch(() => {});
    await proxy.close();
    rmSync(profile, { recursive: true, force: true });
  }
  return row;
}

const rows = [];
try {
  for (let i = 1; i <= REPS; i++) for (const variant of VARIANTS) {
    const row = await runOne(variant, i);
    rows.push(row);
    console.log(JSON.stringify({ variant, i, outcome: row.outcome, noticeMs: row.noticeMs, clickToAlertMs: row.clickToAlertMs ?? null, loadMs: row.loadMs ?? row.loadMsLate ?? null, recovered: row.recovered, sentinelKept: row.sentinelKept, retry: row.retry ?? null }));
  }
} finally {
  await Promise.all(loadWorkers.map((w) => w.terminate()));
  await server.close();
  tinyTarget.close();
  writeFileSync(join(OUT, "reload-stall-rows.json"), JSON.stringify({ browser: BROWSER, load: LOAD, stallMs: STALL_MS, rows }, null, 1));
}

const percentile = (values, p) => { const s = values.filter((v) => v != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
console.log("\nRESUMEN (" + BROWSER + ")");
for (const variant of VARIANTS) {
  const mine = rows.filter((r) => r.variant === variant);
  const count = (o) => mine.filter((r) => r.outcome === o).length;
  console.log(`${variant}: n=${mine.length} reloaded=${count("reloaded")} reload-late=${count("reload-late")} stalled=${count("stalled")} no-notice=${count("no-notice")} error=${count("error")} recovered=${mine.filter((r) => r.recovered).length} sentinelKept=${mine.filter((r) => r.sentinelKept).length}/${mine.filter((r) => r.outcome === "reloaded").length} click→aviso p50/p95/max=${percentile(mine.map((r) => r.clickToAlertMs), 0.5)}/${percentile(mine.map((r) => r.clickToAlertMs), 0.95)}/${percentile(mine.map((r) => r.clickToAlertMs), 1)} ms load p50/p95/max=${percentile(mine.map((r) => r.loadMs), 0.5)}/${percentile(mine.map((r) => r.loadMs), 0.95)}/${percentile(mine.map((r) => r.loadMs), 1)} ms`);
}
process.exitCode = 0;
