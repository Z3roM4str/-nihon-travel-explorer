import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

/**
 * Migra (o borra) reglas de primer nivel de `App.css` cuyas clases pertenecen todas a una superficie (B10.4).
 *
 *   node scripts/css-migrate.mjs --classes '^(zone-card|zone-column)' --to src/components/ZoneComparison.css [--from src/App.css] [--dry]
 *   node scripts/css-migrate.mjs --classes '^(selection-panel|selection-list)' --delete [--dry]
 *   node scripts/css-migrate.mjs --classes-file clases.txt --to src/components/X.css   (nombres exactos, uno por línea)
 *
 * Una regla se mueve sólo si TODAS las clases de TODOS sus selectores casan con `--classes`, y tiene al menos una clase
 * (nunca mueve `:root`, elementos sueltos ni reglas mixtas). Los `@media`/`@container`/`@supports` se mueven si todas sus reglas
 * internas cumplen lo mismo. `--keyframes nombre1,nombre2` mueve esos `@keyframes`. Los comentarios que preceden a una regla
 * movida (sin regla no movida entre medias) viajan con ella: los comentarios de decisiones son un activo (08).
 * Avisa de cualquier regla que se queda en el origen y menciona una clase movida (combinadores mixtos): se resuelve a mano.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const from = path.join(ROOT, arg("--from") ?? "src/App.css");
const to = arg("--to") ? path.join(ROOT, arg("--to")) : null;
const del = args.includes("--delete");
const dry = args.includes("--dry");
const classesFile = arg("--classes-file");
const re = classesFile
  ? new RegExp(`^(${readFileSync(path.resolve(classesFile), "utf8").split("\n").map((c) => c.trim()).filter(Boolean).map((c) => c.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})$`)
  : new RegExp(arg("--classes") ?? "$^");
const keyframes = new Set((arg("--keyframes") ?? "").split(",").filter(Boolean));
if (!to && !del) throw new Error("falta --to o --delete");

const classesOf = (sel) => [...new Set([...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
const ruleOk = (selector) => {
  const cs = classesOf(selector);
  return cs.length > 0 && cs.every((c) => re.test(c));
};
const root = postcss.parse(readFileSync(from, "utf8"), { from });
const moved = [];
let pendingComments = [];
const toRemove = [];
root.each((node) => {
  if (node.type === "comment") {
    pendingComments.push(node);
    return;
  }
  let take = false;
  if (node.type === "rule") take = ruleOk(node.selector);
  else if (node.type === "atrule" && keyframes.has(node.params.trim()) && node.name.endsWith("keyframes")) take = true;
  else if (node.type === "atrule" && ["media", "container", "supports"].includes(node.name)) {
    // Bloque mixto: se mueve sólo el subconjunto de reglas del componente, dentro de un clon del at-rule (mismos parámetros),
    // conservando el orden relativo. Si el bloque queda vacío en el origen, se elimina.
    const inner = [];
    node.each((child) => {
      if (child.type === "rule" && ruleOk(child.selector)) inner.push(child);
    });
    const all = node.nodes.filter((n) => n.type !== "comment").length;
    if (inner.length === all && all > 0) take = true;
    else if (inner.length > 0) {
      const clone = node.clone({ nodes: [] });
      for (const r of inner) {
        // comentarios inmediatamente anteriores dentro del bloque
        let prev = r.prev();
        const lead = [];
        while (prev && prev.type === "comment") {
          lead.unshift(prev);
          prev = prev.prev();
        }
        for (const c of lead) clone.append(c.clone());
        clone.append(r.clone());
        inner.__remove ??= [];
        inner.__remove.push(...lead, r);
      }
      moved.push(...pendingComments.map((c) => c.toString()), clone.toString());
      for (const n of inner.__remove) toRemove.push(n);
      // si tras quitar sólo quedan comentarios, borra el bloque entero
      const remaining = node.nodes.filter((n) => n.type !== "comment" && !inner.includes(n));
      if (remaining.length === 0) toRemove.push(node);
      for (const c of pendingComments) toRemove.push(c);
      pendingComments = [];
      return;
    }
  }
  if (take) {
    for (const c of pendingComments) toRemove.push(c);
    moved.push(...pendingComments.map((c) => c.toString()), node.toString());
    toRemove.push(node);
  }
  pendingComments = [];
});

// Reglas restantes que mencionan una clase movida.
const movedClasses = new Set();
for (const n of toRemove) if (n.type !== "comment") (n.type === "rule" ? [n] : (() => { const l = []; n.walkRules((r) => l.push(r)); return l; })()).forEach((r) => classesOf(r.selector).forEach((c) => movedClasses.add(c)));
const warnings = [];
root.walkRules((r) => {
  if (toRemove.includes(r) || (r.parent && toRemove.includes(r.parent))) return;
  const hit = classesOf(r.selector).filter((c) => movedClasses.has(c));
  if (hit.length) warnings.push(`línea ${r.source.start.line}: ${r.selector.replace(/\s+/g, " ").slice(0, 80)} → ${hit.join(",")}`);
});

const nRules = toRemove.filter((n) => n.type !== "comment").length;
const nLines = toRemove.filter((n) => n.type !== "comment").reduce((a, n) => a + (n.source.end.line - n.source.start.line + 1), 0);
console.log(`${del ? "borra" : "mueve"} ${nRules} reglas (${nLines} líneas) · ${movedClasses.size} clases`);
for (const w of warnings) console.log(`AVISO ${w}`);
if (dry) process.exit(0);

for (const n of toRemove) n.remove();
writeFileSync(from, root.toString().replace(/\n{3,}/g, "\n\n"));
if (to) {
  const header = existsSync(to) ? "" : "";
  const prev = existsSync(to) ? readFileSync(to, "utf8").replace(/\s+$/, "") + "\n\n" : header;
  writeFileSync(to, prev + moved.join("\n\n") + "\n");
}
