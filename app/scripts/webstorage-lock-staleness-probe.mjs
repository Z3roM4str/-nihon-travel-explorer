// Hypothesis probe — NOT a Nihon test, and NOT a durability claim.
//
// Question: after tab B writes localStorage and releases a Web Lock, can tab A, having just been
// granted that lock, still read the OLD value? Nihon classifies the stored document inside the lock
// after yielding exactly one task (storage-lock.ts). The unexplained `retry-queued-retained-events-invalid`
// failure (72636d3, WebKit) is only possible if such a stale read can outlast that one task.
//
// Method: no Nihon code, no seeds, no wrappers. Per iteration a fresh key; B holds the lock, A queues
// for it, B writes then releases, A reads (a) in the grant callback, (b) after one setTimeout(0)
// task — what Nihon does — and then polls every millisecond until it sees B's value. Reports counts
// and the staleness distribution. Optionally with CPU load (busy workers in a third page).
//
// Reading the result: any (b) stale sample is a platform fact that Nihon's single yield cannot cover.
// Zero stale samples bounds, but does not prove absence of, the effect.
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const BROWSER = process.env.NIHON_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const ITERATIONS = Number(process.env.NIHON_ITERATIONS ?? 400);
const LOADS = (process.env.NIHON_LOADS ?? '0,1').split(',').map(Number);
const OUT = process.env.NIHON_OUT ?? 'webstorage-lock-staleness.json';
// Must equal SETTLE_AFTER_CONTENTION_MS in src/lib/storage-lock.ts: the probe checks that the chosen window covers the lag.
const SETTLE_MS = Number(process.env.NIHON_SETTLE_MS ?? 32);

const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<html>probe</html>'); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await (BROWSER === 'webkit' ? webkit : chromium).launch(
  BROWSER === 'chromium' && process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {});

async function page(context, path) { const p = await context.newPage(); await p.goto(origin + path); return p; }

async function measure(load) {
  const context = await browser.newContext();
  const a = await page(context, '/a');
  const b = await page(context, '/b');
  let loader = null;
  if (load) {
    loader = await page(context, '/load');
    await loader.evaluate(() => {
      const code = 'while(true){Math.sqrt(Math.random())}';
      window.__w = Array.from({ length: 4 }, () => new Worker(URL.createObjectURL(new Blob([code]))));
    });
  }
  await a.bringToFront(); // A takes the timings: a hidden page's timers are throttled
  const samples = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const key = `probe.${load}.${i}`;
    await a.evaluate((k) => localStorage.setItem(k, 'A'), key);
    await b.evaluate((k) => { window.__release = null; window.__held = false;
      void navigator.locks.request('probe:' + k, () => new Promise((resolve) => { window.__release = resolve; window.__held = true; })); }, key);
    await b.waitForFunction(() => window.__held, undefined, { polling: 10 }); // not rAF: a background WebKit page never ticks it
    // A queues for the lock; it records what it reads at the grant, after one task, and until fresh.
    const pending = a.evaluate(({ k, settleMs }) => new Promise((resolve) => {
      navigator.locks.request('probe:' + k, async () => {
        const grantedAt = performance.now();
        const atGrant = localStorage.getItem(k);
        await new Promise((r) => setTimeout(r, 0));
        const afterOneTask = localStorage.getItem(k);
        // Poll every millisecond through the settle window to time the first fresh read, then take the
        // independent read the product would take at the end of the window.
        let firstFreshMs = null;
        while (performance.now() - grantedAt < settleMs) {
          if (firstFreshMs === null && localStorage.getItem(k) === 'B') firstFreshMs = Math.round(performance.now() - grantedAt);
          await new Promise((r) => setTimeout(r, 1));
        }
        const afterSettle = localStorage.getItem(k);
        let staleMs = null;
        if (afterOneTask !== 'B') staleMs = firstFreshMs ?? (afterSettle === 'B' ? settleMs : 'beyond-settle');
        resolve({ atGrant, afterOneTask, afterSettle, staleMs });
      });
    }), { k: key, settleMs: SETTLE_MS });
    await b.evaluate((k) => { localStorage.setItem(k, 'B'); window.__release(); }, key);
    samples.push(await pending);
  }
  await context.close();
  const stale = (field) => samples.filter((s) => s[field] !== 'B').length;
  const lags = samples.map((s) => s.staleMs).filter((v) => v !== null);
  return {
    load, iterations: ITERATIONS,
    staleAtGrant: stale('atGrant'), staleAfterOneTask: stale('afterOneTask'), staleAfterSettle: stale('afterSettle'), settleMs: SETTLE_MS,
    lagsMs: lags, maxLagMs: Math.max(0, ...lags.filter((v) => typeof v === 'number')),
    neverFresh: lags.filter((v) => v === 'beyond-settle').length,
  };
}

const report = { browser: BROWSER, version: browser.version(), results: [] };
for (const load of LOADS) { report.results.push(await measure(load)); console.log(JSON.stringify(report.results.at(-1))); }
await browser.close(); server.close();
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('RESULT ' + JSON.stringify(report.results.map(({ load, staleAtGrant, staleAfterOneTask, staleAfterSettle, maxLagMs, neverFresh }) => ({ load, staleAtGrant, staleAfterOneTask, staleAfterSettle, maxLagMs, neverFresh }))));
