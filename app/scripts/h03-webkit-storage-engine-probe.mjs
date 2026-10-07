import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, availableParallelism } from "node:os";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { webkit } from "playwright";

// Counterfactual, not the product gate: no React, Nihon code, Store, or writer on
// reload. Same native Storage, real reset, cache:'reload', isolated profiles.
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-h03-engine");
mkdirSync(out, { recursive: true });
const count = Number(process.env.NIHON_H03_ENGINE_REPETITIONS ?? 12);
if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Invalid repetition bound");
const events = [], results = [];
const record = (kind, value) => events.push({ at: Date.now(), kind, ...value });
let failing = false, rejected = 0;
const html = `<!doctype html><div id="root"><button id="open">Viaje</button><button id="reload">Recargar</button></div>
<script>
document.querySelector('#open').onclick = async () => {
  const link = document.createElement('link'); link.rel = 'modulepreload'; link.href = '/module.js'; document.head.append(link);
  try { await import('/module.js'); window.loaded = true; } catch { window.failed = true; }
};
document.querySelector('#reload').onclick = async () => {
  const refresh = Promise.allSettled([...document.querySelectorAll('link[rel="modulepreload"]')].map(l => fetch(l.href, {cache:'reload'})));
  await Promise.race([refresh, new Promise(resolve => setTimeout(resolve, 3000))]); location.reload();
};
</script>`;
const server = createServer((req, res) => {
  if (req.url === "/module.js") {
    if (failing) { rejected++; req.socket.destroy(); return; }
    res.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" });
    res.end("export const ready = true;"); return;
  }
  res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); res.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const workers = process.env.NIHON_H03_LOAD === "1" ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker(
  "function load(){const end=performance.now()+20;while(performance.now()<end)Math.sqrt(Math.random());setTimeout(load,10);}load();", { eval: true })) : [];
const browser = await webkit.launch();
try {
  for (const config of [
    { profile: "ephemeral", reset: false, hold: false },
    { profile: "ephemeral", reset: true, hold: false },
    { profile: "ephemeral", reset: true, hold: true },
    { profile: "persistent", reset: true, hold: false },
  ]) for (let iteration = 1; iteration <= count; iteration++) {
    const profile = config.profile === "persistent" ? mkdtempSync(join(tmpdir(), "nihon-h03-engine-")) : null;
    const context = profile ? await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } }) : await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("crash", () => record("page-crash", { config, iteration }));
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) record("navigation", { config, iteration, url: frame.url() }); });
    failing = false; rejected = 0;
    try {
      await page.goto(base);
      const original = JSON.stringify({ version: 1, travellers: [{ id: "synthetic-p1", label: "Synthetic" }], activeTravellerId: "synthetic-p1", interests: [{ placeId: "JP-044", stances: [{ travellerId: "synthetic-p1", stance: "interested" }], carriedOver: false }] });
      await page.evaluate(raw => {
        localStorage.setItem("nihon.travellers.v1", raw);
        sessionStorage.setItem("synthetic.session.sentinel", raw);
      }, original);
      if (config.hold) {
        const anchor = await context.newPage(); await anchor.goto(base);
        record("anchor", { config, iteration, value: await anchor.evaluate(() => localStorage.getItem("nihon.travellers.v1")) });
      }
      failing = config.reset;
      if (config.reset) { await page.locator("#open").click(); await page.waitForFunction(() => window.failed === true); }
      await page.waitForTimeout(700);
      const before = await page.evaluate(() => ({ local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      failing = false;
      await page.evaluate(() => { window.__beforeReload = true; });
      await page.locator("#reload").click();
      await page.waitForFunction(() => window.__beforeReload === undefined);
      await page.waitForSelector("#root *");
      const after = await page.evaluate(() => ({ local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      const ok = before.local === original && after.local === original && before.session === original && after.session === original && (!config.reset || rejected > 0);
      const result = { config, iteration, before, after, rejected, ok };
      if (!ok) {
        await page.waitForTimeout(1000); // Only after the original verdict; never changes it.
        result.later = await page.evaluate(() => ({ local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      }
      results.push(result); record("result", result);
      console.log(JSON.stringify(result));
    } catch (error) { results.push({ config, iteration, ok: false, error: String(error) }); }
    finally { await context.close(); if (profile) rmSync(profile, { recursive: true, force: true }); }
  }
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await Promise.all(workers.map(worker => worker.terminate()));
  writeFileSync(`${out}/engine-results.json`, JSON.stringify({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    node: process.version, browser: "Playwright WebKit", loadWorkers: workers.length,
    productCodeLoaded: false, results, events,
  }, null, 2));
}
process.exitCode = results.every(r => r.ok) ? 0 : 1;
