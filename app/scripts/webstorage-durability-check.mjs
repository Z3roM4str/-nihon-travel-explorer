import { createServer, request } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, join, basename } from 'node:path';
import { platform, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { snapshotProfile, storageValues } from './lib/h03-profile-evidence.mjs';

// New hypothesis only: API acknowledgement versus normal reload/shutdown and
// explicit abrupt death. No fault proxy, Storage wrapper, reseed, or retry.
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? '/tmp/webstorage-durability');
mkdirSync(out, { recursive: true });
const type = process.env.NIHON_BROWSER === 'chromium' ? chromium : webkit;
const options = type === chromium && process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {};
const repetitions = Number(process.env.NIHON_DURABILITY_REPETITIONS ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 6) throw Error('Invalid bounded repetitions');
const html = readFileSync(new URL('./webstorage-durability-repro.html', import.meta.url));
const product = process.env.NIHON_DURABILITY_PRODUCT !== '0';
const server = product ? await preview({ root: fileURLToPath(new URL('..', import.meta.url)), preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }) : null;
const targetPort = server?.httpServer.address().port;
const received = [];
const proxy = createServer((req, res) => {
  received.push({ at: Date.now(), method: req.method, url: req.url });
  if (req.url === '/native') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(html); return; }
  if (!server) { res.writeHead(404); res.end(); return; }
  const upstream = request({ host: '127.0.0.1', port: targetPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${targetPort}` } }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on('error', error => { res.writeHead(502); res.end(String(error)); }); req.pipe(upstream);
});
await new Promise(r => proxy.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${proxy.address().port}`;
function processes() {
  if (platform() === 'linux') return readdirSync('/proc').filter(p => /^\d+$/.test(p)).flatMap(p => {
    try { return [{ pid: Number(p), ppid: Number(readFileSync(`/proc/${p}/status`, 'utf8').match(/^PPid:\s+(\d+)/m)?.[1]), executable: basename(readlinkSync(`/proc/${p}/exe`)) }]; } catch { return []; }
  });
  if (platform() === 'darwin') return execFileSync('ps', ['-ww', '-axo', 'pid=,ppid=,comm='], { encoding: 'utf8' }).trim().split('\n').flatMap(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/); return m ? [{ pid: Number(m[1]), ppid: Number(m[2]), executable: basename(m[3]) }] : [];
  });
  throw Error('No safe process identification on this platform');
}
const network = () => processes().filter(p => /(?:NetworkProcess|WebKit\.Networking|WebKitNetworkProcess)(?:\.Development)?$/.test(p.executable));
function profileFiles(pid, profile) {
  try {
    const files = platform() === 'linux' ? readdirSync(`/proc/${pid}/fd`).flatMap(fd => { try { return [readlinkSync(`/proc/${pid}/fd/${fd}`)]; } catch { return []; } })
      : execFileSync('lsof', ['-p', String(pid), '-Fn'], { encoding: 'utf8' }).split('\n').filter(l => l.startsWith('n')).map(l => l.slice(1));
    return files.filter(p => p.startsWith(profile + '/')).map(p => p.slice(profile.length + 1));
  } catch { return []; }
}
const key = 'nihon.travellers.v1', pendingKey = 'nihon.pending.v1.' + key;
const results = [];
const plan = [];
for (const operation of ['reload', 'normal-close']) for (const age of [0, 100, 700]) plan.push({ subject: 'native', operation, age });
if (type === webkit && process.env.NIHON_DURABILITY_KILL !== '0') for (const age of [0, 100]) plan.push({ subject: 'native', operation: 'forced-SIGKILL', age });
if (product) for (const operation of ['reload', 'normal-close']) for (const confirmation of ['UI-and-API', 'journal-confirmed']) plan.push({ subject: 'Nihon', operation, age: 0, confirmation });
let browserVersion = null, userAgent = null;
try {
  for (const spec of plan) for (let iteration = 1; iteration <= repetitions; iteration++) {
    const caseId = randomUUID(), dir = join(out, `${spec.subject}-${spec.operation}-${spec.confirmation ?? spec.age}-${iteration}`);
    mkdirSync(dir, { recursive: true });
    const profile = mkdtempSync(join(dir, 'original-profile-'));
    const profileBaseline = new Set(network().map(p => p.pid));
    const result = { ...spec, iteration, caseId, profile, origin, events: [], ok: false };
    const event = (kind, details = {}) => result.events.push({ kind, at: Date.now(), ...details });
    let context;
    try {
      context = await type.launchPersistentContext(profile, { ...options, viewport: { width: 390, height: 844 }, hasTouch: true });
      browserVersion ??= context.browser()?.version() ?? null;
      const page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(8000);
      page.on('request', r => { if (r.isNavigationRequest()) event('navigation-requested', { url: r.url() }); });
      page.on('crash', () => event('page-crash'));
      await page.goto(origin + (spec.subject === 'native' ? '/native' : '/'));
      userAgent ??= await page.evaluate(() => navigator.userAgent);
      if (spec.subject === 'native') {
        result.checkpoint = await page.evaluate(() => write(false)); event('checkpoint-A-returned', result.checkpoint);
        await page.waitForTimeout(1700); // Observed A-to-B separation, not a fix or a gate delay.
        result.write = await page.evaluate(() => write(true)); event('write-B-returned', result.write);
        result.expected = result.write.raw;
      } else {
        // Ordinary UI initialization and save; no fixture or init script.
        await page.getByRole('button', { name: 'Saltar', exact: true }).click();
        await page.getByRole('button', { name: 'Quiero ir: Ghibli Museum, Mitaka', exact: true }).click();
        await page.getByRole('button', { name: 'Quitar Ghibli Museum, Mitaka de Quiero ir', exact: true }).waitFor();
        event('UI-interest-confirmed', { pressed: await page.getByRole('button', { name: 'Quitar Ghibli Museum, Mitaka de Quiero ir', exact: true }).getAttribute('aria-pressed') });
        await page.waitForFunction(k => { const raw = localStorage.getItem(k); return raw && JSON.parse(raw).interests.some(i => i.placeId === 'JP-044'); }, key);
        result.expected = await page.evaluate(k => localStorage.getItem(k), key); event('API-interest-confirmed', { raw: result.expected });
        if (spec.confirmation === 'journal-confirmed') {
          // Observe the existing product's 2.5 s confirmation, never introduce one.
          await page.waitForFunction(k => sessionStorage.getItem(k) === null, pendingKey);
          event('existing-journal-confirmed');
        }
        result.ui = await page.locator('#root').innerText();
      }
      const acknowledgedAt = Date.now();
      if (spec.age) await page.waitForTimeout(spec.age);
      result.before = await page.evaluate(({ key, pendingKey }) => ({ documentId: window.__durabilityDoc ??= crypto.randomUUID(), origin: location.origin, raw: localStorage.getItem(key), pending: sessionStorage.getItem(pendingKey) }), { key, pendingKey });
      result.networkBefore = network().filter(p => !profileBaseline.has(p.pid)).map(p => ({ ...p, profileFiles: profileFiles(p.pid, profile) }));
      result.webKitProcessNames = processes().filter(p => /webkit|MiniBrowser|NetworkProcess/i.test(p.executable));
      result.diskBefore = snapshotProfile(profile, join(dir, 'before-operation'));
      event('operation-start', { ageSinceAcknowledgedMs: Date.now() - acknowledgedAt,
        ageSinceNativeSetItemReturnedMs: result.write ? Date.now() - result.write.returnedAt : null, requestedOperation: spec.operation });
      if (spec.operation === 'normal-close') {
        event('harness-normal-close-requested'); await context.close(); context = null; event('harness-normal-close-completed');
      } else {
        if (spec.operation === 'forced-SIGKILL') {
          const candidates = result.networkBefore.filter(p => p.profileFiles.length > 0);
          if (candidates.length !== 1) throw Error('Refusing ambiguous/unverified synthetic NetworkProcess: ' + JSON.stringify(result.networkBefore));
          result.victim = candidates[0]; event('harness-SIGKILL-requested', { pid: result.victim.pid });
          process.kill(result.victim.pid, 'SIGKILL');
        }
        try { await page.reload(); event('navigation-received', { url: page.url() }); } catch (error) { result.navigationError = String(error); event('navigation-failed', { error: String(error) }); }
        // Read from a different document, without application code for native cases.
        const reader = await context.newPage(); reader.setDefaultTimeout(8000); reader.setDefaultNavigationTimeout(8000);
        await reader.goto(origin + '/native');
        result.afterOperation = await reader.evaluate(() => read());
        if (spec.subject === 'Nihon' && !result.navigationError) {
          result.uiAfterReload = await page.getByRole('button', { name: 'Quitar Ghibli Museum, Mitaka de Quiero ir', exact: true }).getAttribute('aria-pressed');
        }
        result.diskAfterOperation = snapshotProfile(profile, join(dir, 'after-operation-before-close'));
        event('harness-normal-close-requested'); await context.close(); context = null; event('harness-normal-close-completed');
      }
      result.diskAfterClose = snapshotProfile(profile, join(dir, 'after-close'));
      const beforeReader = network();
      context = await type.launchPersistentContext(profile, { ...options, viewport: { width: 390, height: 844 } });
      const reader = await context.newPage(); reader.setDefaultTimeout(8000); reader.setDefaultNavigationTimeout(8000);
      await reader.goto(origin + '/native'); result.reopened = await reader.evaluate(() => read());
      result.newProcess = { before: beforeReader, after: network(), sameProfile: true, reseeded: false, initScripts: false };
      const diskRows = storageValues(result.diskAfterClose);
      result.diskReaderApplicable = type === webkit;
      result.ok = result.before.raw === result.expected && (!result.afterOperation || result.afterOperation.raw === result.expected)
        && result.reopened.raw === result.expected && (!result.uiAfterReload || result.uiAfterReload === 'true')
        && !result.navigationError && result.diskAfterClose.errors.length === 0
        && (!result.diskReaderApplicable || (diskRows.length > 0 && diskRows.every(r => r.value === result.expected)));
    } catch (error) { result.error = String(error.stack); }
    finally {
      // Keep originals and snapshots even on early launch/navigation failures.
      try { result.finallyBeforeClose = snapshotProfile(profile, join(dir, 'finally-before-close')); } catch (error) { result.preservationError = String(error); result.ok = false; }
      try { await context?.close(); } catch (error) { result.closeError = String(error); result.ok = false; }
      try { result.originalPreserved = snapshotProfile(profile, join(dir, 'original-preserved')); } catch (error) { result.preservationError = String(error); result.ok = false; }
      results.push(result); writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
      console.log(`${result.ok ? 'OK' : 'FAIL'} ${spec.subject} ${spec.operation} ${spec.confirmation ?? spec.age} #${iteration}${result.error ? ': ' + result.error.split('\n')[0] : ''}`);
    }
  }
} finally {
  proxy.closeAllConnections(); await new Promise(r => proxy.close(r)); await server?.close();
  writeFileSync(join(out, 'results.json'), JSON.stringify({ sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), platform: platform(), release: release(), node: process.version, browser: type.name(), browserVersion, userAgent,
    playwright: JSON.parse(readFileSync(new URL('../node_modules/playwright/package.json', import.meta.url))).version,
    browserDefinitions: JSON.parse(readFileSync(new URL('../node_modules/playwright-core/browsers.json', import.meta.url))),
    faultProxy: false, nativeStorageMocked: false, strictExpectedConservationAfterAPI: true, received, results }, null, 2));
}
process.exitCode = results.every(r => r.ok) ? 0 : 1;
