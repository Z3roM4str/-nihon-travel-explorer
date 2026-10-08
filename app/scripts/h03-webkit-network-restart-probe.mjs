import { createServer } from "node:http";
import { readdirSync, readFileSync, readlinkSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { tmpdir, availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { webkit } from "playwright";
import { snapshotProfile, storageValues, readProfileInNewProcess } from "./lib/h03-profile-evidence.mjs";

// Causal counterfactual for the spontaneous restart captured under a real reset.
// No Nihon code, React, Storage wrappers, or application writes after reload.
// SIGKILL is restricted to the new NetworkProcess of this synthetic context.
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-h03-restart");
mkdirSync(out, { recursive: true });
const repetitions = Number(process.env.NIHON_H03_RESTART_REPETITIONS ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 12) throw new Error("Invalid repetition bound");
// Diagnóstico independiente de los tres timeouts de Ronda 5: el contrato original sólo comprobaba datos
// asentados mediante un cierre previo. Este modo distingue ese checkpoint de una escritura más reciente.
// La espera pertenece al contrafactual nativo, nunca al gate H03 ni a la recuperación del producto.
const recentWrite = process.env.NIHON_H03_RESTART_RECENT === "1";
// Original failures read the rollback 25 s later, but the restart could occur earlier.
// Test bounded write ages separately; never change a product gate's settling/recovery time.
const writeAges = recentWrite ? (process.env.NIHON_H03_RESTART_WRITE_AGES ?? "25000").split(",").map(Number) : [null];
if (writeAges.length > 3 || writeAges.some(age => age !== null && (!Number.isInteger(age) || age < 0 || age > 25000))) throw new Error("Invalid bounded write-age matrix");
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
const results = [];
const loadWorkers = process.env.NIHON_H03_LOAD === "1" ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker(
  'function load() { const until = performance.now() + 20; while (performance.now() < until) Math.sqrt(Math.random()); setTimeout(load, 10); } load();', { eval: true })) : [];
try {
  for (const profileKind of ["ephemeral", "persistent", "persistent-fresh"]) for (const writeAge of profileKind !== "ephemeral" ? writeAges : [null]) for (let iteration = 1; iteration <= repetitions; iteration++) {
    const profileId = randomUUID();
    const original = JSON.stringify({ version: 1, travellers: [{ id: profileId, label: "Synthetic" }], activeTravellerId: profileId, interests: [{ placeId: "JP-044", stances: [{ travellerId: profileId, stance: "interested" }], carriedOver: false }], _w: [`${profileId}-A`, `${profileId}-B`] });
    const checkpoint = recentWrite ? JSON.stringify({ ...JSON.parse(original), interests: [], _w: [`${profileId}-A`] }) : original;
    const profile = profileKind !== "ephemeral" ? mkdtempSync(join(tmpdir(), "nihon-h03-native-restart-")) : null;
    const caseOut = resolve(out, `${profileKind}${writeAge === null ? "" : `-age${writeAge}`}-${iteration}`);
    const baseline = new Set(processes().map(p => p.pid));
    let context;
    try {
      if (profile && profileKind === "persistent") {
        // Establish an existing durable original, rather than assuming a recent
        // asynchronous database transaction survived a deliberate process kill.
        const seed = await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
        const seedPage = await seed.newPage(); await seedPage.goto(base);
        await seedPage.evaluate(value => localStorage.setItem("nihon.travellers.v1", value), checkpoint);
        await seed.close();
        baseline.clear(); for (const p of processes()) baseline.add(p.pid);
        context = await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } });
      } else context = profile ? await webkit.launchPersistentContext(profile, { viewport: { width: 390, height: 900 } }) : await browser.newContext({ viewport: { width: 390, height: 900 } });
      const page = await context.newPage(); page.setDefaultTimeout(8000); await page.goto(base);
      // Same fresh-profile A -> B write sequence as the historical application,
      // without an intermediate close. Still no Nihon code or Storage wrapper.
      if (profileKind === "persistent-fresh") await page.evaluate(value => localStorage.setItem("nihon.travellers.v1", value), checkpoint);
      if (!profile || recentWrite) await page.evaluate(value => localStorage.setItem("nihon.travellers.v1", value), original);
      const writeReturnedAt = !profile || recentWrite ? Date.now() : null;
      if (profile && recentWrite) await page.waitForTimeout(writeAge);
      await page.evaluate(value => sessionStorage.setItem("synthetic.session.sentinel", value), original);
      const before = await page.evaluate(() => ({ documentId: window.__nativeDocumentId ??= crypto.randomUUID(), origin: location.origin, local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      const candidates = processes().filter(p => !baseline.has(p.pid));
      if (candidates.length !== 1) throw new Error(`Refusing to kill ambiguous NetworkProcess: ${JSON.stringify(candidates)}`);
      const victim = candidates[0];
      const diskBefore = profile ? snapshotProfile(profile, `${caseOut}/before-kill`) : null;
      const killedAt = Date.now();
      process.kill(victim.pid, "SIGKILL");
      // A deliberate process death may fail the in-flight first navigation.
      // Record it, then obtain the storage through an independent page. This
      // counterfactual does not modify or retry the strict H03 scenario.
      let initialNavigationError = null;
      try { await page.reload(); } catch (error) { initialNavigationError = String(error); }
      const independent = await context.newPage(); independent.setDefaultTimeout(8000);
      await independent.goto(base); await independent.waitForSelector("#root");
      const after = await independent.evaluate(() => ({ documentId: window.__nativeDocumentId ??= crypto.randomUUID(), origin: location.origin, local: localStorage.getItem("nihon.travellers.v1"), session: sessionStorage.getItem("synthetic.session.sentinel") }));
      const current = processes().filter(p => p.ppid === victim.ppid);
      const restarted = current.some(p => p.pid !== victim.pid) && !current.some(p => p.pid === victim.pid);
      const expectedLocal = profile ? original : null;
      const diskAfterRestart = profile ? snapshotProfile(profile, `${caseOut}/after-restart-before-close`) : null;
      let reopened = null, diskAfterClose = null;
      if (profile) {
        await context.close(); context = null;
        diskAfterClose = snapshotProfile(profile, `${caseOut}/after-close`);
        reopened = await readProfileInNewProcess({ browserType: webkit, profile, url: base });
      }
      const diskQueryable = !profile || [diskBefore, diskAfterRestart, diskAfterClose].every(snapshot => snapshot.errors.length === 0 && storageValues(snapshot).length > 0);
      const diskExact = !profile || [diskBefore, diskAfterRestart, diskAfterClose].every(snapshot => storageValues(snapshot).every(row => row.value === original));
      const result = { profileKind, profileId, profile, iteration, recentWrite, checkpoint, minimumWriteAgeMs: profile && recentWrite ? writeAge : null,
        writeReturnedAt, killedAt, writeAgeAtKillMs: writeReturnedAt === null ? null : killedAt - writeReturnedAt,
        before, after, initialNavigationError, killed: victim, current, restarted, expectedLocal,
        diskBefore, diskAfterRestart, diskAfterClose, reopened,
        persistedBefore: diskBefore ? storageValues(diskBefore) : null,
        persistedAfterRestart: diskAfterRestart ? storageValues(diskAfterRestart) : null,
        persistedAfterClose: diskAfterClose ? storageValues(diskAfterClose) : null,
        diskQueryable, diskExact, ok: before.local === original && restarted && after.local === expectedLocal && (!profile || reopened.raw === original) && diskQueryable && diskExact };
      results.push(result); console.log(JSON.stringify(result));
    } catch (error) { const result = { profileKind, iteration, ok: false, error: String(error) }; results.push(result); console.log(JSON.stringify(result)); }
    finally {
      if (profile) {
        // Even launch failures and early restarts leave the complete profile.
        try { const snapshot = snapshotProfile(profile, `${caseOut}/finally-before-close`); writeFileSync(`${caseOut}/finally-before-close.json`, JSON.stringify(snapshot)); } catch (error) { console.log(JSON.stringify({ profileKind, iteration, preservationError: String(error) })); }
      }
      await context?.close();
      if (profile) {
        try { const snapshot = snapshotProfile(profile, `${caseOut}/original-preserved`); writeFileSync(`${caseOut}/original-preserved.json`, JSON.stringify(snapshot)); } catch (error) { console.log(JSON.stringify({ profileKind, iteration, preservationError: String(error) })); }
        // Originals are deliberately retained until runner/artifact cleanup.
      }
    }
  }
} finally {
  await Promise.all(loadWorkers.map(worker => worker.terminate()));
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  writeFileSync(`${out}/native-restart-results.json`, JSON.stringify({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    productCodeLoaded: false, nativeStorageMocked: false, loadWorkers: loadWorkers.length, purpose: "Explicit NetworkProcess restart: demonstrate ephemeral storage lifetime versus an existing disk-backed original", results,
  }, null, 2));
}
process.exitCode = results.every(r => r.ok) ? 0 : 1;
