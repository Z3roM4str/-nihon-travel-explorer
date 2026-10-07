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
  let leaving = false;
  if (buffered) window.__h03OutsideBuffer = [];
  const emit = (event) => {
    try {
      const record = { at: Date.now(), ...event };
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
        if (watched) emit({ kind: "storage", method, key, value: method === "getItem" ? result : method === "setItem" ? String(args[1]) : null });
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
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
const traceStream = createWriteStream(process.env.NIHON_EXTERNAL_TRACE_FILE);
let caseNumber = 0, caseStart = 0, traced = false;
const observedState = new Map();
const caseContexts = new Set(), caseProxies = new Set();
function processSnapshot() {
  if (process.platform !== 'linux') return [];
  const entries = [];
  for (const pid of readdirSync('/proc').filter(name => /^\\d+$/.test(name))) {
    try {
      const name = readFileSync('/proc/' + pid + '/comm', 'utf8').trim();
      let executable = null;
      try { executable = readlinkSync('/proc/' + pid + '/exe').split('/').at(-1); } catch { /* process sandbox may restrict this metadata */ }
      const status = readFileSync('/proc/' + pid + '/status', 'utf8');
      entries.push({ pid: Number(pid), name, executable, ppid: Number(status.match(/^PPid:\\s+(\\d+)/m)?.[1] ?? 0) });
    } catch { /* a process may terminate between the reads */ }
  }
  return entries;
}
function observeHost(kind, details = {}) {
  const processes = ['gate-read', 'navigation', 'before-reload'].includes(kind) ? processSnapshot() : undefined;
  traceStream.write(JSON.stringify({ case: caseNumber, traced, hostAt: Date.now(), kind, processes, ...details }) + "\\n");
}
function attachObserver(context) {
  context.on("page", (page) => {
    page.on("crash", () => observeHost("page-crash"));
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
      observeHost("page", { event });
      }
    });
  });
}
const loadWorkers = process.env.NIHON_H03_LOAD === "1" ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker(
  'function load() { const until = performance.now() + 20; while (performance.now() < until) Math.sqrt(Math.random()); setTimeout(load, 10); } load();', { eval: true })) : [];
observeHost("environment", { node: process.version, cpuCount: availableParallelism(), loadWorkers: loadWorkers.length });
`;
let source = helper + original.slice(0, original.indexOf("const steps = ["));
source = replaceOnce(source, "  results.push({ id, label, ok, extra: extra ?? null });", "  results.push({ id, label, ok, extra: extra ?? null });\n  observeHost('assertion', { id, label, ok, extra, observed: Object.fromEntries(observedState) });");
source = replaceOnce(source, "const raw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);", `const raw = (page, key) => page.evaluate((k) => {
  const value = localStorage.getItem(k);
  return { value, events: window.__h03OutsideBuffer?.splice(0), ui: window.__h03OutsideUI?.() };
}, key).then(({ value, events, ui }) => {
  for (const event of events ?? []) {
    if (event.kind === 'storage' && event.method !== 'getItem') {
      if (event.method === 'removeItem') observedState.delete(event.key); else observedState.set(event.key, event.value);
    }
    observeHost('page', { event });
  }
  observeHost('gate-read', { key, value, ui }); return value;
});`);
const contextCall = source.includes('  const context = await newContext({}, { width, height: 900 }, BROWSER === "webkit");')
  ? '  const context = await newContext({}, { width, height: 900 }, BROWSER === "webkit");'
  : '  const context = await newContext({}, { width, height: 900 });';
source = replaceOnce(source, contextCall, `${contextCall}
  caseContexts.add(context); context.once('close', () => caseContexts.delete(context));
  observedState.clear();
  attachObserver(context);
  if (traced) await context.addInitScript(${observeNative.toString()}, { buffered: process.env.NIHON_H03_TRACE_MODE === 'buffered' });`);
source = replaceOnce(source, "  const base = proxy ? proxy.url : BASE_URL;", `  const base = proxy ? proxy.url : BASE_URL;
  if (proxy) {
    caseProxies.add(proxy);
    const close = proxy.close;
    proxy.close = () => close().finally(() => caseProxies.delete(proxy));
  }`);
source = replaceOnce(source, "  const before = await raw(page, TK);", "  const before = await raw(page, TK);\n  observeHost('before-failure', { before });");
source = replaceOnce(source, "  await page.evaluate(() => { window.__beforeReload = true; });", "  observeHost('before-reload', { observed: Object.fromEntries(observedState) });\n  await page.evaluate(() => { window.__beforeReload = true; });");
source = replaceOnce(source, "    if (state.failing && state.pattern.test(req.url ?? \"\")) {", `    if (req.url === '/__h03_independent_storage_probe__') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end('<!doctype html><title>isolated backend probe</title>'); return; }
    if (state.failing && state.pattern.test(req.url ?? "")) {`);
// Diagnostic probe is only performed AFTER all original strict assertions have
// failed. It cannot turn their verdict green or refresh the first gate read.
source = replaceOnce(source, "  await context.close();\n  if (proxy) await proxy.close();\n}\n\nasync function h03()", `  if (results.slice(caseStart).some(r => !r.ok)) {
    const probe = await context.newPage();
    await probe.goto(base + '/__h03_independent_storage_probe__');
    observeHost('independent-backend-after-verdict', { value: await raw(probe, TK) });
    await probe.close();
  }
  await context.close();
  if (proxy) await proxy.close();
}

async function h03()`);
source += `
// Alternate untouched native controls and externally observed cases. No changes
// to h03Scenario's assertions, 700 ms settling time, or 8 s recovery timeout.
if (process.env.NIHON_H03_PRIMER === "1") {
  for (const [id, fn] of [["H01", h01], ["H02a", h02Interests], ["H02b", h02Itinerary], ["H04a", h04Variants], ["H04b", h04Recovery], ["H04c", h04WriteFailure], ["X", interactions]]) await guarded(id, id, fn);
}
for (caseNumber = 1; caseNumber <= ${repetitions}; caseNumber++) {
  traced = caseNumber % 3 !== 1;
  observeHost('case-start', { mode: 'proxy-reset', surface: 'OrderedSequenceBuilder', width: 390 });
  const start = results.length;
  caseStart = start;
  await guarded('H03', 'directed original scenario', () => h03Scenario(H03_SURFACES[0], 390, 'proxy-reset', true));
  observeHost('case-end', { results: results.slice(start) });
  // Only after the original verdict: a timeout must not leave its context/proxy
  // running and contaminate subsequent isolated repetitions.
  await Promise.all([...caseContexts].map(context => context.close()));
  await Promise.all([...caseProxies].map(proxy => proxy.close()));
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
