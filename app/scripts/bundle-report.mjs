import { gzipSync, brotliCompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Block 12 — what is actually in Nihon's JavaScript, and what each chunk costs on the wire.
 *
 * Written because RC-05 sat in the debt table for eleven blocks described only as "a single JS
 * chunk above Vite's advisory", which is a statement about a threshold rather than about Nihon.
 * The warning says one number is over 500 kB; it does not say what the bytes are, which of them a
 * first render needs, or what any of it weighs after compression — and those are the only
 * questions worth asking.
 *
 * Two deliberate choices:
 *
 *  * **No new dependency.** Sizes come from rolldown's own `renderedLength` through a throwaway
 *    plugin, and compression from `node:zlib`. Installing a bundle analyser to measure a bundle
 *    would have been its own small joke.
 *  * **Raw and compressed, always together.** Raw bytes alone are actively misleading here:
 *    `walking-scale-results.json` is 253 kB of highly repetitive records that gzip to 10 kB — 4% —
 *    so a report quoting only raw size would send the next reader after the wrong 253 kB.
 *
 * Usage: node scripts/bundle-report.mjs [--json]
 */

const asJson = process.argv.includes("--json");
const appRoot = fileURLToPath(new URL("..", import.meta.url));

/** Buckets a module id into the part of the system it belongs to. */
function bucketOf(id) {
  const s = id.replace(/^.*\/node_modules\//, "node_modules/");
  if (/^node_modules\/(react-dom|react|scheduler)\//.test(s)) return "React runtime";
  if (/^node_modules\/(leaflet|react-leaflet|@react-leaflet)/.test(s)) return "Leaflet + react-leaflet";
  if (/^node_modules\//.test(s)) return "other node_modules";
  if (/\.json$/.test(s)) return "data (JSON)";
  if (/\/src\/components\//.test(s)) return "src/components";
  if (/\/src\/lib\//.test(s)) return "src/lib";
  return "src (other)";
}

const report = { chunks: [] };

await build({
  root: appRoot,
  logLevel: "error",
  plugins: [
    react(),
    {
      name: "nihon-bundle-report",
      generateBundle(_options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type !== "chunk") continue;
          const modules = Object.entries(chunk.modules ?? {})
            .map(([id, m]) => ({ id, rendered: m.renderedLength ?? 0 }))
            .filter((m) => m.rendered > 0)
            .sort((a, b) => b.rendered - a.rendered);
          const code = Buffer.from(chunk.code, "utf8");
          const buckets = {};
          for (const m of modules) buckets[bucketOf(m.id)] = (buckets[bucketOf(m.id)] ?? 0) + m.rendered;
          report.chunks.push({
            fileName,
            isEntry: Boolean(chunk.isEntry),
            raw: code.length,
            gzip: gzipSync(code, { level: 9 }).length,
            brotli: brotliCompressSync(code).length,
            moduleCount: modules.length,
            buckets,
            top: modules.slice(0, 12).map((m) => ({
              id: m.id.replace(/^.*\/node_modules\//, "node_modules/").replace(/^.*\/app\/src\//, "src/"),
              rendered: m.rendered,
            })),
          });
        }
      },
    },
  ],
});

report.chunks.sort((a, b) => Number(b.isEntry) - Number(a.isEntry) || b.raw - a.raw);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pad = (n) => String(n).padStart(9);
  const entry = report.chunks.find((c) => c.isEntry);
  console.log("Nihon bundle report\n");
  for (const c of report.chunks) {
    console.log(`${c.isEntry ? "ENTRY" : "lazy "}  ${c.fileName}`);
    console.log(`       ${pad(c.raw)} B raw   ${pad(c.gzip)} B gzip   ${pad(c.brotli)} B brotli   ${c.moduleCount} modules`);
    const total = Object.values(c.buckets).reduce((s, v) => s + v, 0) || 1;
    for (const [k, v] of Object.entries(c.buckets).sort((a, b) => b[1] - a[1]))
      console.log(`         ${pad(v)} B  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
    console.log(`         top: ${c.top.slice(0, 5).map((m) => `${m.id} (${m.rendered})`).join(", ")}`);
    console.log();
  }
  const deferred = report.chunks.filter((c) => !c.isEntry);
  console.log(
    `initial JS: ${entry.raw} B raw / ${entry.gzip} B gzip / ${entry.brotli} B brotli` +
      `   ·   deferred: ${deferred.reduce((s, c) => s + c.gzip, 0)} B gzip across ${deferred.length} chunk(s)`
  );
}
