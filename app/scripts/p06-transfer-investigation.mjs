import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";

// Paired replay of the COMPLETE original phone journey. No retry of a failed
// assertion, no new settling wait, and no product changes. Failures stay red.
const root = fileURLToPath(new URL("../..", import.meta.url));
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-p06-transfer");
mkdirSync(out, { recursive: true });
const baseline = "6a87a7f5b35e8e73603288b5a716bdd8e4f706e6";
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const count = Number(process.env.NIHON_TRANSFER_PAIRS ?? 8);
if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error("Invalid paired replay bound");
const git = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8" });
const hash = value => createHash("sha256").update(value).digest("hex");
function once(source, from, to) {
  if (source.split(from).length !== 2) throw new Error(`Ambiguous observation anchor: ${from}`);
  return source.replace(from, to);
}
function observe() {
  const prefix = "__NIHON_TRANSFER__";
  const documentId = crypto.randomUUID();
  const emit = event => { try { console.debug(prefix + JSON.stringify({ at: Date.now(), documentId, url: location.href, ...event })); } catch {} };
  for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (...args) {
      try {
        const value = original.apply(this, args);
        if (method === "clear" || String(args[0]).includes("manualPlanningDraft")) emit({ kind: "storage", area: this === localStorage ? "local" : "session", method, key: args[0], value: method === "getItem" ? value : args[1] });
        return value;
      } catch (error) { emit({ kind: "storage-error", error: String(error) }); throw error; }
    };
  }
  const state = () => {
    const section = document.querySelector(".inter-hub-segments");
    return { form: section?.querySelector(".inter-hub-segments__form")?.textContent,
      values: Array.from(section?.querySelectorAll("select,input") ?? []).map(el => ({ tag: el.tagName, value: el.value, disabled: el.disabled })),
      segments: Array.from(section?.querySelectorAll(".inter-hub-segments__item") ?? []).map(el => el.textContent),
      addDisabled: Array.from(section?.querySelectorAll("button") ?? []).find(el => /Añadir traslado/.test(el.textContent))?.disabled };
  };
  for (const type of ["pointerdown", "pointerup", "touchstart", "touchend", "click", "input", "change", "blur"]) document.addEventListener(type, event => {
    if (event.target instanceof Element && event.target.closest(".inter-hub-segments")) emit({ kind: "input", type, trusted: event.isTrusted, target: event.target.outerHTML.slice(0, 800), state: state() });
  }, true);
  let previous;
  new MutationObserver(() => { const current = state(), next = JSON.stringify(current); if (previous !== next) { previous = next; emit({ kind: "ui", state: current }); } }).observe(document, { subtree: true, childList: true, attributes: true });
  emit({ kind: "document-start" });
}
const helperPath = "app/scripts/lib/modern-trip.mjs";
if (git(baseline, helperPath) !== readFileSync(resolve(root, helperPath), "utf8")) throw new Error("Paired helper differs; use separately built checkouts");
const productTrees = [baseline, head].map(ref => execFileSync("git", ["rev-parse", `${ref}:app/src`], { cwd: root, encoding: "utf8" }).trim());
if (productTrees[0] !== productTrees[1]) throw new Error("Paired replay requires separately built products after a product change");
const results = [];
const workers = process.env.NIHON_H03_LOAD === "1" ? Array.from({ length: Math.min(2, availableParallelism()) }, () => new Worker('function load(){const until=performance.now()+20;while(performance.now()<until)Math.sqrt(Math.random());setTimeout(load,10)}load()', { eval: true })) : [];
try {
  for (let pair = 1; pair <= count; pair++) for (const variant of pair % 2 ? ["base", "candidate"] : ["candidate", "base"]) {
    const ref = variant === "base" ? baseline : head;
    const original = git(ref, "app/scripts/p06-v2-journeys-check.mjs");
    const dir = resolve(out, `pair-${pair}-${variant}`); mkdirSync(dir, { recursive: true });
    let source = `import { createWriteStream, writeFileSync } from 'node:fs';\nconst auditStream = createWriteStream(${JSON.stringify(dir + "/trace.ndjson")});\nconst auditContexts = [];\n` + original;
    source = once(source, 'const { check, summary } = makeChecker("P-06 v2 recorridos");', `const { check: originalCheck, summary } = makeChecker("P-06 v2 recorridos");
const check = (label, ok, detail) => { auditStream.write(JSON.stringify({ kind: 'assertion', hostAt: Date.now(), label, ok, detail }) + '\\n'); originalCheck(label, ok, detail); };`);
    source = once(source, 'await newPage(env.browser, vp, { fixture });', `await newPage(env.browser, vp, { fixture, extraInit: ${observe.toString()} });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    auditContexts.push(context);
    page.on('console', message => { if (message.text().startsWith('__NIHON_TRANSFER__')) auditStream.write(message.text().slice('__NIHON_TRANSFER__'.length) + '\\n'); });`);
    source = once(source, '    await context.close();', `    writeFileSync(${JSON.stringify(dir + "/post-verdict.json")}, JSON.stringify(await page.evaluate(() => ({ raw: localStorage.getItem('nihon.manualPlanningDraft'), pending: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('nihon.pending.v1.'))), html: document.getElementById('root')?.innerHTML })), null, 2));
    await context.tracing.stop({ path: ${JSON.stringify(dir + "/trace.zip")} });
    await context.close();`);
    source = once(source, 'process.exit(summary());', 'await new Promise(resolve => auditStream.end(resolve));\nprocess.exit(summary());');
    source = once(source, '  await env.close();', `  for (const context of auditContexts) { try { await context.tracing.stop({ path: ${JSON.stringify(dir + "/early-exit-trace.zip")} }); } catch {} }
  await env.close();`);
    const file = resolve(root, `app/scripts/.p06-transfer-${process.pid}.mjs`);
    writeFileSync(file, source);
    writeFileSync(dir + "/provenance.json", JSON.stringify({ ref, head, productTrees, helperHash: hash(git(baseline, helperPath)), originalHash: hash(original), observedHash: hash(source), assertionsAndTimeoutsUnchanged: source.includes('check("herramientas: el traslado entre ciudades se registra", (await draft()).interHubSegments.length === 1);'), pair, variant, load: workers.length }, null, 2));
    const child = spawn(process.execPath, [file, "--viewport=phone"], { cwd: resolve(root, "app"), env: process.env });
    let log = ""; child.stdout.on("data", data => { log += data; }); child.stderr.on("data", data => { log += data; });
    const status = await new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
    unlinkSync(file); writeFileSync(dir + "/journey.log", log);
    const result = { pair, variant, ref, ...status }; results.push(result); console.log(JSON.stringify(result));
    writeFileSync(out + "/results.json", JSON.stringify({ head, baseline, productTrees, workers: workers.length, results }, null, 2));
  }
} finally { await Promise.all(workers.map(worker => worker.terminate())); }
process.exitCode = results.every(result => result.code === 0) ? 0 : 1;
