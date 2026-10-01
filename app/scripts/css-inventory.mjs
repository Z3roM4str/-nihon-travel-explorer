import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

/**
 * Inventario de `App.css` (B10.4). Para cada regla de primer nivel: líneas, selectores, clases y qué ficheros fuente
 * (`src/**.ts(x)`, sin tests) mencionan cada clase. Clasifica:
 *   A  token/base/global legítimo      (:root, html, body, *, elementos, utilidades compartidas por ≥3 ficheros)
 *   B  shell global legítimo           (clases de `app__*`, `tab-bar`, `nav-rail`, `sheet`, `persistence-notice`… usadas por App/shell)
 *   C  pertenece a UNA superficie/componente → migrable (todas las clases de la regla se usan en un único fichero)
 *   D  sin uso en el código (ninguna clase aparece; puede construirse dinámicamente → revisar a mano)
 *   E  ambigua (varios ficheros, @keyframes compartidos, selectores mixtos)
 *
 * Uso: `node scripts/css-inventory.mjs [--json salida.json] [--css src/App.css]`
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const cssArg = args.includes("--css") ? args[args.indexOf("--css") + 1] : "src/App.css";
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.(ts|tsx)$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}
const sources = walk(path.join(ROOT, "src")).map((f) => ({ file: path.relative(path.join(ROOT, "src"), f), text: readFileSync(f, "utf8") }));
sources.push({ file: "index.html", text: readFileSync(path.join(ROOT, "index.html"), "utf8") });

const usage = new Map();
function usedBy(cls) {
  if (usage.has(cls)) return usage.get(cls);
  const files = sources.filter((s) => s.text.includes(cls)).map((s) => s.file);
  usage.set(cls, files);
  return files;
}
/** Un modificador dinámico (`save--${x}`) no aparece completo: se considera usado si aparece su prefijo hasta `--`/`__`. */
function usedByLoose(cls) {
  const direct = usedBy(cls);
  if (direct.length) return direct;
  const m = /^(.*?)(--|__)[^-_]+(?:[-_][^-_]+)*$/.exec(cls);
  if (!m) return direct;
  const files = sources.filter((s) => s.text.includes(`${m[1]}${m[2]}`) || s.text.includes(`${m[1]}--`)).map((s) => s.file);
  return files;
}

const css = readFileSync(path.join(ROOT, cssArg), "utf8");
const root = postcss.parse(css);
const rows = [];
const classesOf = (sel) => [...new Set([...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))];

root.each((node) => {
  const start = node.source.start.line;
  const end = node.source.end.line;
  if (node.type === "comment") return;
  if (node.type === "atrule") {
    const inner = [];
    node.walkRules((r) => inner.push(r.selector));
    const classes = [...new Set(inner.flatMap(classesOf))];
    rows.push({ start, end, kind: `@${node.name}`, head: node.params.slice(0, 60), selectors: inner, classes });
    return;
  }
  if (node.type === "rule") rows.push({ start, end, kind: "rule", head: node.selector.slice(0, 90), selectors: [node.selector], classes: classesOf(node.selector) });
});

const SHELL = /^(app__|tab-bar|nav-rail|sheet|persistence-notice|save-toast|app-nav|onboarding|skip-link|icon-button|button|link-button|visually-hidden|tap-target|leaflet|photo-placeholder|evidence-mark|empty-state|chip-toggle)/;
for (const row of rows) {
  const owners = new Map();
  for (const c of row.classes) for (const f of usedByLoose(c)) owners.set(f, (owners.get(f) ?? 0) + 1);
  row.files = [...owners.keys()];
  const allPlain = row.selectors.every((s) => classesOf(s).length === 0);
  const unusedAll = row.classes.length > 0 && row.classes.every((c) => usedByLoose(c).length === 0);
  if (row.kind === "@font-face" || allPlain || /:root|^html|^body|^\*/.test(row.head)) row.cls = "A";
  else if (row.kind === "@keyframes") row.cls = row.files.length ? "E" : "D";
  else if (unusedAll) row.cls = "D";
  else if (row.classes.some((c) => SHELL.test(c))) row.cls = "B";
  else if (row.files.length === 1) row.cls = "C";
  else row.cls = "E";
}

const summary = {};
for (const r of rows) {
  const lines = r.end - r.start + 1;
  summary[r.cls] ??= { rules: 0, lines: 0 };
  summary[r.cls].rules += 1;
  summary[r.cls].lines += lines;
}
console.log(`# ${cssArg}: ${root.source.end?.line ?? css.split("\n").length} líneas, ${rows.length} reglas de primer nivel`);
console.log(JSON.stringify(summary));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
else for (const r of rows) console.log(`${r.cls} ${String(r.start).padStart(5)}-${String(r.end).padEnd(5)} ${r.kind.padEnd(8)} ${r.head.padEnd(60)} ${r.files.slice(0, 3).join(",")}`);
