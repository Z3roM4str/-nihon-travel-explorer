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

/** `App.css` seguido del CSS de componentes (el orden de importación real: globales primero). */
export async function readProductCss(): Promise<string> {
  const app = path.join(SRC, "App.css");
  const rest = cssFiles(SRC).filter((f) => f !== app).sort();
  return [app, ...rest].map((f) => readFileSync(f, "utf8")).join("\n");
}
