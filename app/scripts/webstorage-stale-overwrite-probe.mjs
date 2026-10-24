// Controlled reproduction, NOT a Nihon test: what does a context that overwrites on a STALE read observe afterwards?
//
// The settle margin (storage-lock.ts) makes a stale read rare but cannot make it impossible (1 handoff in
// 1.000 loaded WebKit handoffs outlasted 32 ms). To study the consequence deterministically, A here takes NO
// settle at all — the pre-fix behaviour, which WebKit makes stale in 3–44 % of handoffs — and writes whenever
// its read still shows the value from before B published. For every such stale overwrite it records:
//   - every `storage` event A received for the key (old/new value), and whether one carried B's document;
//   - the value A reads at the end, the value a brand-new page reads at the end (the backing store), and B's view.
// This tells us whether "the late invalidation reaches A as an event carrying the overwritten document" holds, which
// is what a detect-and-preserve protection can rely on. It says nothing about durability to disk.
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const BROWSER = process.env.NIHON_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const ITERATIONS = Number(process.env.NIHON_ITERATIONS ?? 300);
const LOADS = (process.env.NIHON_LOADS ?? '0,1').split(',').map(Number);
const OUT = process.env.NIHON_OUT ?? 'webstorage-stale-overwrite.json';
const OBSERVE_MS = 400;

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<html>probe</html>'); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await (BROWSER === 'webkit' ? webkit : chromium).launch(
  BROWSER === 'chromium' && process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {});
const open = async (context, path) => { const p = await context.newPage(); await p.goto(origin + path); return p; };

async function measure(load) {
  const context = await browser.newContext();
  const a = await open(context, '/a');
  const b = await open(context, '/b');
  if (load) {
    const loader = await open(context, '/load');
    await loader.evaluate(() => {
      const code = 'while(true){Math.sqrt(Math.random())}';
      window.__w = Array.from({ length: 4 }, () => new Worker(URL.createObjectURL(new Blob([code]))));
    });
  }
  await a.bringToFront();
  await a.evaluate(() => { window.__events = []; addEventListener('storage', (e) => window.__events.push({ key: e.key, old: e.oldValue, new: e.newValue, ownArea: e.storageArea === window.localStorage })); });
  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const key = `overwrite.${load}.${i}`;
    await a.evaluate((k) => { window.__events.length = 0; localStorage.setItem(k, 'BEFORE'); }, key);
    await b.evaluate((k) => { window.__held = false;
      void navigator.locks.request('probe:' + k, () => new Promise((resolve) => { window.__release = resolve; window.__held = true; })); }, key);
    await b.waitForFunction(() => window.__held, undefined, { polling: 10 });
    const pending = a.evaluate((k) => new Promise((resolve) => {
      navigator.locks.request('probe:' + k, async () => {
        const read = localStorage.getItem(k); // no settle, no yield: the pre-fix behaviour
        const stale = read !== 'B-DOCUMENT';
        if (stale) localStorage.setItem(k, 'A-OVERWRITE');
        resolve({ read, stale });
      });
    }), key);
    await b.evaluate((k) => { localStorage.setItem(k, 'B-DOCUMENT'); window.__release(); }, key);
    const grant = await pending;
    await a.waitForTimeout(OBSERVE_MS);
    const final = await a.evaluate((k) => ({ a: localStorage.getItem(k), events: window.__events.filter((e) => e.key === k) }), key);
    const c = await open(context, '/c');
    const backing = await c.evaluate((k) => localStorage.getItem(k), key);
    await c.close();
    const bView = await b.evaluate((k) => localStorage.getItem(k), key);
    samples.push({ ...grant, finalA: final.a, backing, bView, events: final.events });
  }
  await context.close();
  const stale = samples.filter((s) => s.stale);
  return {
    load, iterations: ITERATIONS, staleOverwrites: stale.length,
    // In a stale overwrite, did A receive an event that carries B's document?
    staleWithEventCarryingB: stale.filter((s) => s.events.some((e) => e.new === 'B-DOCUMENT')).length,
    staleWithAnyEvent: stale.filter((s) => s.events.length > 0).length,
    // Product guard needs `event.storageArea === localStorage`: does the real event satisfy it?
    staleEventsWithOwnArea: stale.filter((s) => s.events.some((e) => e.new === 'B-DOCUMENT' && e.ownArea)).length,
    staleBackingIsA: stale.filter((s) => s.backing === 'A-OVERWRITE').length,
    staleBackingIsB: stale.filter((s) => s.backing === 'B-DOCUMENT').length,
    staleAViewIsB: stale.filter((s) => s.finalA === 'B-DOCUMENT').length,
    staleBViewIsA: stale.filter((s) => s.bView === 'A-OVERWRITE').length,
    examples: stale.slice(0, 5),
  };
}

const report = { browser: BROWSER, version: browser.version(), results: [] };
for (const load of LOADS) { report.results.push(await measure(load)); console.log(JSON.stringify({ ...report.results.at(-1), examples: undefined })); }
await browser.close(); server.close();
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('RESULT ' + JSON.stringify(report.results.map(({ examples: _examples, ...rest }) => rest)));
