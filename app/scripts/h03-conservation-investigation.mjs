import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Replay the actual historical/current gate, not a rewritten approximation. Only
// add observation and a bounded repetition loop. Its assertions/timeouts stay intact.
const root = fileURLToPath(new URL("../..", import.meta.url));
const dirtyBeforeEvidence = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
const ref = process.env.NIHON_GATE_REF ?? "5f3b3021a95ec39a11af5600954e96a0c3bdd790";
if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error("NIHON_GATE_REF must be an exact SHA");
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-h03-investigation");
mkdirSync(out, { recursive: true });
const original = execFileSync("git", ["show", `${ref}:app/scripts/final-audit-data-recovery-check.mjs`], { cwd: root, encoding: "utf8" });
const sourceTree = execFileSync("git", ["rev-parse", `${ref}:app/src`], { cwd: root, encoding: "utf8" }).trim();
const headTree = execFileSync("git", ["rev-parse", "HEAD:app/src"], { cwd: root, encoding: "utf8" }).trim();
if (sourceTree !== headTree) throw new Error("Historical gate requires the identical product tree; do not substitute another implementation");
const repetitions = Number(process.env.NIHON_H03_REPETITIONS ?? 12);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) throw new Error("Invalid bounded repetition count");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
function replaceOnce(source, from, to) {
  if (source.split(from).length !== 2) throw new Error(`Ambiguous/missing observation anchor: ${from}`);
  return source.replace(from, to);
}

// No extra Storage reads, writes, timers, RPC waits or session trace buffers.
// Return values/errors of the existing calls are forwarded unchanged. console
// messages are collected by Node and survive page reload/context destruction.
function observeNative({ buffered }) {
  const prefix = "__NIHON_H03_EXTERNAL__";
  const documentId = window.__auditDocumentId ??= crypto.randomUUID();
  let leaving = false;
  if (buffered) window.__h03OutsideBuffer = [];
  const emit = (event) => {
    try {
      const record = { at: Date.now(), documentId, origin: location.origin, ...event };
      if (buffered && !leaving) window.__h03OutsideBuffer.push(record);
      else console.debug(prefix + JSON.stringify(record));
    } catch { /* observation cannot change an operation */ }
  };
  if (buffered) window.addEventListener("pagehide", () => {
    leaving = true;
    console.debug(prefix + JSON.stringify({ kind: "buffer", events: window.__h03OutsideBuffer.splice(0) }));
  });
  for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
    const native = Storage.prototype[method];
    Storage.prototype[method] = function (...args) {
      const key = args[0];
      const watched = method === "clear" || key === "__seeded" || key === "__ctxSeeded" || key === "nihon.onboarding.seen.v1" || key === "nihon.travellers.v1" || key === "nihon.manualPlanningDraft" || String(key).startsWith("nihon.pending.v1.");
      try {
        const result = native.apply(this, args);
        if (watched) emit({ kind: "storage", area: this === localStorage ? "local" : "session", method, key, value: method === "getItem" ? result : method === "setItem" ? String(args[1]) : null });
        return result;
      } catch (error) {
        if (watched) emit({ kind: "storage-error", method, key, error: String(error) });
        throw error;
      }
    };
  }
  const ui = () => ({
    traveller: document.querySelector(".app__person-token-button")?.getAttribute("aria-label") ?? null,
    hearts: Array.from(document.querySelectorAll("button[aria-label]"))
      .filter((b) => /Ghibli Museum/.test(b.getAttribute("aria-label")))
      .map((b) => ({ label: b.getAttribute("aria-label"), pressed: b.getAttribute("aria-pressed") })),
    lazyFailure: document.querySelector("[data-lazy-failure]")?.textContent ?? null,
    protection: document.querySelector("[data-storage-protection]")?.textContent ?? null,
  });
  for (const type of ["pointerdown", "pointerup", "click"]) document.addEventListener(type, (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    emit({ kind: "input", type, label: button?.getAttribute("aria-label"), text: button?.textContent, ui: ui() });
  }, true);
  if (buffered) window.__h03OutsideUI = ui;
  let previous;
  if (!buffered) new MutationObserver(() => {
    const state = ui(), next = JSON.stringify(state);
    if (next !== previous) { previous = next; emit({ kind: "ui", state }); }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-label", "aria-pressed"] });
  emit({ kind: "document-start", url: location.href });
}

const helper = `
import { createWriteStream, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { randomUUID } from 'node:crypto';
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { snapshotProfile, storageValues, readProfileInNewProcess } from "./lib/h03-profile-evidence.mjs";
const traceStream = createWriteStream(process.env.NIHON_EXTERNAL_TRACE_FILE);
let caseNumber = 0, caseStart = 0, traced = false;
const observedState = new Map();
const caseContexts = new Set(), caseProxies = new Set();
const caseProfiles = new Map();
function profileBeforeClose(context) {
  const meta = caseProfiles.get(context);
  if (!meta || meta.beforeClose) return;
  const dir = process.env.NIHON_EVIDENCE_OUT + '/profile-case-' + caseNumber;
  meta.beforeClose = snapshotProfile(meta.profile, dir + '/before-close');
  observeHost('profile-before-close', { contextId: meta.contextId, profile: meta.profile, snapshot: meta.beforeClose });
}
function processSnapshot() {
  if (process.platform !== 'linux') return [];
  const entries = [];
  for (const pid of readdirSync('/proc').filter(name => /^\\d+$/.test(name))) {
    try {
      const name = readFileSync('/proc/' + pid + '/comm', 'utf8').trim();
      let executable = null;
      try { executable = readlinkSync('/proc/' + pid + '/exe').split('/').at(-1); } catch { /* process sandbox may restrict this metadata */ }
      const status = readFileSync('/proc/' + pid + '/status', 'utf8');
      const profileFiles = [];
      if (/NetworkProcess$/.test(executable ?? '')) for (const meta of caseProfiles.values()) {
        try { for (const fd of readdirSync('/proc/' + pid + '/fd')) {
          try { const path = readlinkSync('/proc/' + pid + '/fd/' + fd); if (path.startsWith(meta.profile + '/')) profileFiles.push({ contextId: meta.contextId, profile: meta.profile, path: path.slice(meta.profile.length + 1) }); } catch {}
        } } catch {}
      }
      entries.push({ pid: Number(pid), name, executable, ppid: Number(status.match(/^PPid:\\s+(\\d+)/m)?.[1] ?? 0), profileFiles });
    } catch { /* a process may terminate between the reads */ }
  }
  return entries;
}
function observeHost(kind, details = {}) {
  const processes = ['gate-read', 'navigation', 'before-reload', 'failed-case-probe'].includes(kind) ? processSnapshot() : undefined;
  traceStream.write(JSON.stringify({ case: caseNumber, traced, hostAt: Date.now(), kind, processes, ...details }) + "\\n");
}
function attachObserver(context, contextId) {
  context.on("page", (page) => {
    const pageId = randomUUID();
    observeHost('page-created', { contextId, pageId, profile: context.h03Profile });
    page.on("crash", () => observeHost("page-crash"));
    page.on("pageerror", error => observeHost("page-error", { message: error.message }));
    page.on("request", request => observeHost("request-start", { contextId, pageId, url: request.url(), resource: request.resourceType(), mainDocument: request.isNavigationRequest() && request.frame() === page.mainFrame() }));
    page.on("requestfinished", request => observeHost("request-finished", { url: request.url() }));
    page.on("requestfailed", request => observeHost("request-failed", { url: request.url(), error: request.failure()?.errorText }));
    page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) observeHost("navigation", { url: frame.url() }); });
    page.on("console", (message) => {
      const text = message.text(), prefix = "__NIHON_H03_EXTERNAL__";
      if (!text.startsWith(prefix)) return;
      const received = JSON.parse(text.slice(prefix.length));
      for (const event of received.kind === 'buffer' ? received.events : [received]) {
      if (event.kind === "storage" && event.method !== "getItem") {
        if (event.method === "removeItem") observedState.delete(event.key);
        else observedState.set(event.key, event.value);
      }
      observeHost("page", { contextId, pageId, profile: context.h03Profile, event });
      }
    });
  });
}
const loadWorkers = process.env.NIHON_H03_LOAD === "1" ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker(
  'function load() { const until = performance.now() + 20; while (performance.now() < until) Math.sqrt(Math.random()); setTimeout(load, 10); } load();', { eval: true })) : [];
observeHost("environment", { node: process.version, cpuCount: availableParallelism(), loadWorkers: loadWorkers.length });
`;
let source = helper + original.slice(0, original.indexOf("const steps = ["));
source = replaceOnce(source, 'mkdtempSync(join(tmpdir(), "nihon-h03-profile-"))', `mkdtempSync(join(process.env.NIHON_H03_PROFILE_DIAGNOSTICS === '1' ? ${JSON.stringify(out)} : tmpdir(), "nihon-h03-profile-"))`);
source = replaceOnce(source, '    if (profile) rmSync(profile, { recursive: true, force: true });\n    throw error;', `    if (profile && process.env.NIHON_H03_PROFILE_DIAGNOSTICS === '1') {
      const destination = process.env.NIHON_EVIDENCE_OUT + '/launch-failure-' + randomUUID();
      try { observeHost('profile-launch-failure', { profile, destination, error: String(error), snapshot: snapshotProfile(profile, destination) }); }
      catch (snapshotError) { observeHost('profile-preservation-error', { profile, error: String(snapshotError) }); }
    } else if (profile) rmSync(profile, { recursive: true, force: true });
    throw error;`);
source = replaceOnce(source, "  results.push({ id, label, ok, extra: extra ?? null });", "  results.push({ id, label, ok, extra: extra ?? null });\n  observeHost('assertion', { id, label, ok, extra, observed: Object.fromEntries(observedState) });");
source = replaceOnce(source, "const raw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);", `const raw = (page, key) => page.evaluate((k) => {
  const value = localStorage.getItem(k);
  return { value, documentId: window.__auditDocumentId, events: window.__h03OutsideBuffer?.splice(0), ui: window.__h03OutsideUI?.() };
}, key).then(({ value, documentId, events, ui }) => {
  for (const event of events ?? []) {
    if (event.kind === 'storage' && event.method !== 'getItem') {
      if (event.method === 'removeItem') observedState.delete(event.key); else observedState.set(event.key, event.value);
    }
    observeHost('page', { event });
  }
  observeHost('gate-read', { key, value, ui, documentId }); return value;
});`);
const contextCall = source.includes('  const context = await newContext({}, { width, height: 900 }, BROWSER === "webkit");')
  ? '  const context = await newContext({}, { width, height: 900 }, BROWSER === "webkit");'
  : '  const context = await newContext({}, { width, height: 900 });';
source = replaceOnce(source, contextCall, `${contextCall}
  caseContexts.add(context); context.once('close', () => caseContexts.delete(context));
  const contextId = randomUUID();
  if (process.env.NIHON_H03_PROFILE_DIAGNOSTICS === '1' && context.h03Profile) {
    caseProfiles.set(context, { contextId, profile: context.h03Profile, base, before: null });
    const originalClose = context.close.bind(context);
    context.close = async (...args) => { profileBeforeClose(context); return originalClose(...args); };
  }
  observeHost('context-created', { contextId, profile: context.h03Profile, base, processes: processSnapshot() });
  observedState.clear();
  attachObserver(context, contextId);
  await context.addInitScript(() => {
    window.__auditDocumentId ??= crypto.randomUUID();
    console.debug('__NIHON_H03_EXTERNAL__' + JSON.stringify({ kind: 'document-identity', documentId: window.__auditDocumentId, at: Date.now(), url: location.href, origin: location.origin }));
  });
  if (traced) await context.addInitScript(${observeNative.toString()}, { buffered: process.env.NIHON_H03_TRACE_MODE === 'buffered' });`);
source = replaceOnce(source, "  const base = proxy ? proxy.url : BASE_URL;", `  const base = proxy ? proxy.url : BASE_URL;
  if (proxy) {
    caseProxies.add(proxy);
    const close = proxy.close;
    proxy.auditClose = () => close().finally(() => caseProxies.delete(proxy));
    proxy.close = () => process.env.NIHON_H03_PROFILE_DIAGNOSTICS === '1' ? Promise.resolve() : proxy.auditClose();
  }`);
source = replaceOnce(source, "  const before = await raw(page, TK);", `  const before = await raw(page, TK);
  observeHost('before-failure', { before });
  if (caseProfiles.has(context)) {
    const meta = caseProfiles.get(context); meta.before = before;
    meta.beforeFailure = snapshotProfile(meta.profile, process.env.NIHON_EVIDENCE_OUT + '/profile-case-' + caseNumber + '/before-failure');
    observeHost('profile-before-failure', { contextId: meta.contextId, profile: meta.profile, snapshot: meta.beforeFailure });
  }`);
source = replaceOnce(source, "  await page.evaluate(() => { window.__beforeReload = true; });", "  observeHost('before-reload', { observed: Object.fromEntries(observedState) });\n  await page.evaluate(() => { window.__beforeReload = true; });");
source = replaceOnce(source, "    if (state.failing && state.pattern.test(req.url ?? \"\")) {", `    if (req.url === '/__h03_independent_storage_probe__') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end('<!doctype html><title>isolated backend probe</title>'); return; }
    observeHost('proxy-received', { url: req.url, origin: req.headers.host, method: req.method, failing: state.failing, kind: state.kind });
    if (state.failing && state.pattern.test(req.url ?? "")) {`);
// Diagnostic probe is only performed AFTER all original strict assertions have
// failed. It cannot turn their verdict green or refresh the first gate read.
source = replaceOnce(source, "  await context.close();\n  if (proxy) await proxy.close();\n}\n\nasync function h03()", `  if (results.slice(caseStart).some(r => !r.ok)) {
    if (caseProfiles.has(context)) profileBeforeClose(context);
    else {
      const probe = await context.newPage();
      await probe.goto(base + '/__h03_independent_storage_probe__');
      observeHost('independent-backend-after-verdict', { value: await raw(probe, TK) });
      await probe.close();
    }
  }
  await context.close();
  if (proxy) await proxy.close();
}

async function h03()`);
source = replaceOnce(source, "    await context.close();\n    if (proxy) await proxy.close();\n    return;", "    if (caseProfiles.has(context)) profileBeforeClose(context);\n    await context.close();\n    if (proxy) await proxy.close();\n    return;");
source += `
// Alternate untouched native controls and externally observed cases. No changes
// to h03Scenario's assertions, 700 ms settling time, or 8 s recovery timeout.
if (process.env.NIHON_H03_PRIMER === "1") {
  for (const [id, fn] of [["H01", h01], ["H02a", h02Interests], ["H02b", h02Itinerary], ["H04a", h04Variants], ["H04b", h04Recovery], ["H04c", h04WriteFailure], ["X", interactions]]) await guarded(id, id, fn);
}
for (caseNumber = 1; caseNumber <= ${repetitions}; caseNumber++) {
  caseProfiles.clear();
  traced = caseNumber % 3 !== 1;
  observeHost('case-start', { mode: 'proxy-reset', surface: 'OrderedSequenceBuilder', width: 390 });
  const start = results.length;
  caseStart = start;
  await guarded('H03', 'directed original scenario', () => h03Scenario(H03_SURFACES[0], 390, 'proxy-reset', true));
  observeHost('case-end', { results: results.slice(start) });
  if (results.slice(start).some(result => !result.ok)) {
    // Diagnostics only AFTER the strict verdict. A stalled evaluation is also
    // evidence, not permission to extend the original 8 s recovery deadline.
    for (const context of caseContexts) for (const page of context.pages()) {
      if (!page.url().startsWith('http')) continue;
      let timer;
      const probe = page.evaluate(() => ({
        marker: window.__beforeReload, readyState: document.readyState,
        raw: localStorage.getItem('nihon.travellers.v1'),
        pending: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('nihon.pending.v1.'))),
        traveller: document.querySelector('.app__person-token-button')?.getAttribute('aria-label'),
        alert: document.querySelector('[data-lazy-failure]')?.textContent,
      })).catch(error => ({ error: String(error) }));
      const state = await Promise.race([probe, new Promise(resolve => { timer = setTimeout(() => resolve({ error: 'post-verdict diagnostic evaluation exceeded 1500 ms' }), 1500); })]);
      clearTimeout(timer);
      observeHost('failed-case-probe', { url: page.url(), state });
    }
    for (const proxy of caseProxies) observeHost('failed-proxy-state', { state: proxy.state });
  }
    // Every profile, including healthy and early-return cases, is preserved
    // before cleanup. A new process reads the SAME profile without seeding.
    for (const [context, meta] of caseProfiles) {
      try {
        profileBeforeClose(context);
        await context.close();
        const dir = process.env.NIHON_EVIDENCE_OUT + '/profile-case-' + caseNumber;
        const afterClose = snapshotProfile(meta.profile, dir + '/after-close');
        const reopened = await readProfileInNewProcess({ browserType: webkit, profile: meta.profile, url: meta.base + '/__h03_independent_storage_probe__' });
        const entry = { case: caseNumber, contextId: meta.contextId, profile: meta.profile, origin: meta.base,
          expected: meta.before, beforeFailure: meta.beforeFailure, beforeClose: meta.beforeClose, afterClose,
          persistedBeforeClose: storageValues(meta.beforeClose), persistedAfterClose: storageValues(afterClose), reopened };
        (evidence.h03ProfilePostVerdict ??= []).push(entry);
        observeHost('profile-storage-after-verdict', entry);
      } catch (error) { observeHost('profile-storage-diagnostic-error', { error: String(error) }); check('FORENSICS', 'same-profile diagnostic completed', false, String(error)); }
    }
  // Only after the original verdict: a timeout must not leave its context/proxy
  // running and contaminate subsequent isolated repetitions.
  await Promise.all([...caseContexts].map(context => context.close()));
  await Promise.all([...caseProxies].map(proxy => proxy.auditClose()));
  // Do not delete originals: a failed diagnostic or an early process restart
  // must leave the actual profile available in the uploaded evidence.
  for (const meta of caseProfiles.values()) {
    try { snapshotProfile(meta.profile, process.env.NIHON_EVIDENCE_OUT + '/profile-case-' + caseNumber + '/original-preserved'); }
    catch (error) { observeHost('profile-preservation-error', { profile: meta.profile, error: String(error) }); check('FORENSICS', 'original profile preserved', false, String(error)); }
  }
}
await browser.close();
await server.close();
await Promise.all(loadWorkers.map(worker => worker.terminate()));
observeHost('complete');
await new Promise(resolve => traceStream.end(resolve));
writeFileSync(process.env.NIHON_EXTERNAL_RESULTS_FILE, JSON.stringify({ browser: BROWSER, gateRef: ${JSON.stringify(ref)}, productSourceTree: ${JSON.stringify(headTree)}, results, diagnostics, evidence }, null, 2));
process.exit(results.every(r => r.ok) ? 0 : 1);
`;
const generated = resolve(root, `app/scripts/.h03-investigation-${process.pid}.mjs`);
const assertionSignature = (text) => text.match(/verdict\(strict,[\s\S]*?\);/g) ?? [];
const timingSignature = (text) => text.match(/await page\.(?:waitForTimeout|waitForFunction|waitForSelector)\([^;]+;/g) ?? [];
if (JSON.stringify(assertionSignature(original)) !== JSON.stringify(assertionSignature(source)) ||
    JSON.stringify(timingSignature(original.slice(0, original.indexOf("const steps = [")))) !== JSON.stringify(timingSignature(source))) {
  throw new Error("Observation changed an assertion or page wait");
}
writeFileSync(generated, source);
writeFileSync(`${out}/gate-original.mjs`, original);
writeFileSync(`${out}/gate-observed.mjs`, source);
writeFileSync(`${out}/provenance.json`, JSON.stringify({
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  gateRef: ref, productSourceTree: headTree, originalHash: sha256(original), observedHash: sha256(source),
  repetitions, originalAssertionsAndWaitsPreserved: true, assertionSignatureHash: sha256(JSON.stringify(assertionSignature(original))), nativeTrace: false,
  dirtyBeforeEvidence,
  instrumentation: "Existing native call values via console -> Node NDJSON, UI attribute observer; no additional Storage reads/writes. Observer overhead remains; every third case is a native control.",
  traceMode: process.env.NIHON_H03_TRACE_MODE ?? "console",
  processObservation: "Linux /proc PID/PPid/comm/executable basename at existing gate reads and navigation phases, outside the page; no command lines, full executable paths, or credentials. Includes renamed children.",
  primer: process.env.NIHON_H03_PRIMER === "1", load: process.env.NIHON_H03_LOAD === "1",
}, null, 2));
const child = spawn(process.execPath, [generated], {
  cwd: resolve(root, "app"), stdio: "inherit",
  env: { ...process.env, NIHON_H03_NATIVE_TRACE: "0", NIHON_EXTERNAL_TRACE_FILE: `${out}/external-trace.ndjson`, NIHON_EXTERNAL_RESULTS_FILE: `${out}/results.json` },
});
child.once("exit", (code, signal) => { unlinkSync(generated); process.exitCode = code ?? (signal ? 1 : 0); });
