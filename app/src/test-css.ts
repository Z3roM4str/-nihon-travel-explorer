import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * B10.4: el CSS de cada superficie migrada vive junto a su componente (`src/components/*.css`), ya no en `App.css`.
 * Los tests que comprueban que una regla EXISTE (tokens, áreas táctiles, ausencia de transiciones…) leen `App.css` más
 * todo el CSS de componentes: la aserción no cambia, sólo dónde está la regla. Los tests que acotan el contenido de
 * `App.css` (conteos, hex, `max-width`) siguen leyendo `App.css` solo.
 */
const SRC = fileURLToPath(new URL(".", import.meta.url));

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css") && !/^(tokens|fonts)\.css$/.test(entry)) out.push(full);
  }
  return out;
}

/** Global sheets in the actual App import order; all legacy invariants survive extraction. */
export async function readGlobalCss(): Promise<string> {
  const app = readFileSync(path.join(SRC, "App.tsx"), "utf8");
  const globals = [...app.matchAll(/^import "\.\/(.*\.css)";/gm)].map(m => path.join(SRC, m[1]));
  if (!globals.length) throw new Error("No global CSS imports found; refusing a vacuous scan");
  return globals.map(f => readFileSync(f, "utf8")).join("\n");
}

/** Globales seguidos del CSS de componentes, sin duplicar los ficheros extraídos. */
export async function readProductCss(): Promise<string> {
  const app = readFileSync(path.join(SRC, "App.tsx"), "utf8");
  const globals = new Set([...app.matchAll(/^import "\.\/(.*\.css)";/gm)].map(m => path.join(SRC, m[1])));
  const rest = cssFiles(SRC).filter(f => !globals.has(f)).sort();
  return [await readGlobalCss(), ...rest.map(f => readFileSync(f, "utf8"))].join("\n");
}
