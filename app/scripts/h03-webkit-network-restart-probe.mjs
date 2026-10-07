import { createServer } from "node:http";
import { readdirSync, readFileSync, readlinkSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { webkit } from "playwright";

// Causal counterfactual for the spontaneous restart captured under a real reset.
// No Nihon code, React, Storage wrappers, or application writes after reload.
// SIGKILL is restricted to the new NetworkProcess of this synthetic context.
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-h03-restart");
mkdirSync(out, { recursive: true });
const repetitions = Number(process.env.NIHON_H03_RESTART_REPETITIONS ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 12) throw new Error("Invalid repetition bound");
const processes = () => readdirSync("/proc").filter(p => /^\d+$/.test(p)).flatMap(p => {
  try {
    const executable = readlinkSync(`/proc/${p}/exe`).split("/").at(-1);
    if (!/NetworkProcess$/.test(executable)) return [];
    const ppid = Number(readFileSync(`/proc/${p}/status`, "utf8").match(/^PPid:\s+(\d+)/m)?.[1]);
    return [{ pid: Number(p), ppid, executable }];
  } catch { return []; }
});
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); res.end("<!doctype html><div id='root'>Storage nativo aislado</div>"); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await webkit.launch();
const original = JSON.stringify({ version: 1, travellers: [{ id: "synthetic-p1", label: "Synthetic" }], activeTravellerId: "synthetic-p1", interests: [{ placeId: "JP-044", stances: [{ travellerId: "synthetic-p1", stance: "interested" }], carriedOver: false }] });
const results = [];
try {
  for (const profileKind of ["ephemeral", "persistent"]) for (let iteration = 1; iteration <= repetitions; iteration++) {
    const profile = profileKind === "persistent" ? mkdtempSync(join(tmpdir(), "nihon-h03-native-restart-")) : null;
    const baseline = new Set(processes().map(p => p.pid));
    let context;
    try {
      if (profile) {
        // Establish an existing durable original, rather than assuming a recent
        // asynchronous database transaction survived a deliberate process kill.
        const seed = await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
        const seedPage = await seed.newPage(); await seedPage.goto(base);
        await seedPage.evaluate(value => localStorage.setItem("nihon.travellers.v1", value), original);
        await seed.close();
        context = await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
      } else context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      const page = await context.newPage(); page.setDefaultTimeout(8000); await page.goto(base);
      if (!profile) await page.evaluate(value => localStorage.setItem("nihon.travellers.v1", value), original);
      await page.evaluate(value => sessionStorage.setItem("synthetic.session.sentinel", value), original);
      const before = await page.evaluate(() => ({ local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      const candidates = processes().filter(p => !baseline.has(p.pid));
      if (candidates.length !== 1) throw new Error(`Refusing to kill ambiguous NetworkProcess: ${JSON.stringify(candidates)}`);
      const victim = candidates[0];
      process.kill(victim.pid, "SIGKILL");
      await page.reload(); await page.waitForSelector("#root *");
      const after = await page.evaluate(() => ({ local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      const current = processes().filter(p => p.ppid === victim.ppid);
      const restarted = current.some(p => p.pid !== victim.pid) && !current.some(p => p.pid === victim.pid);
      const expectedLocal = profile ? original : null;
      const result = { profileKind, iteration, before, after, killed: victim, current, restarted, expectedLocal, ok: before.local === original && restarted && after.local === expectedLocal };
      results.push(result); console.log(JSON.stringify(result));
    } catch (error) { const result = { profileKind, iteration, ok: false, error: String(error) }; results.push(result); console.log(JSON.stringify(result)); }
    finally { await context?.close(); if (profile) rmSync(profile, { recursive: true, force: true }); }
  }
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  writeFileSync(`${out}/native-restart-results.json`, JSON.stringify({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    productCodeLoaded: false, nativeStorageMocked: false, purpose: "Explicit NetworkProcess restart: demonstrate ephemeral storage lifetime versus an existing disk-backed original", results,
  }, null, 2));
}
process.exitCode = results.every(r => r.ok) ? 0 : 1;
