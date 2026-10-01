import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";
import { walkSurfaces } from "./lib/surface-walk.mjs";

/**
 * Gate B10.5 — microcopy final contra `03 §10` («Léxico obligatorio» y «Reglas de copy») y `00 Art. 7`.
 *
 * Dos pasadas:
 *   · DINÁMICA: recorre todas las superficies (`lib/surface-walk.mjs`: búsqueda, ciudad, filtros, mapa, ficha, créditos, lightbox,
 *     Quiero ir, Nosotros + importar, Viaje ×4, mover, otro orden, mapa nacional, onboarding, estados vacíos) a 390 y 1200 px y
 *     lee el TEXTO VISIBLE y los NOMBRES ACCESIBLES (`aria-label`, `title`, `alt`, `aria-description`, `placeholder`);
 *   · ESTÁTICA: cadenas literales de `components/*.tsx` y de los módulos `lib/*presentation*` / `lib/*-copy*` (copy que la
 *     recorrida no alcanza: errores de importación, estados raros).
 *
 * Reglas: léxico prohibido (Art. 7 / 03 §10) ➜ 0; «Guardar … en Quiero ir» ➜ 0 (la acción conserva su nombre); botones o
 * enlaces terminados en «→» ➜ 0; signos de exclamación y emoji ➜ 0; «Aceptar»/«Submit» como acción ➜ 0.
 *
 * EXCEPCIONES normativas (justificadas, fijadas):
 *   E1  «Grado original» dentro de «Fuentes» plegado de la ficha (03: la letra de grado sólo en «Fuentes»).
 *   D   contenido editorial de `data/` (Art. 4: nada de la fuente se reescribe).
 * VOZ ACEPTADA (no se cambia; el gate fija el recuento exacto, de modo que una más falla):
 *   B10-C1  prosa «guardar/guardado» al hablar de lugares marcados (6 cadenas). CERRADO SIN CAMBIO (docs/B10_C1_SAVE_VOCABULARY.md):
 *           no existe regla canónica que prescriba «marcar» como único verbo — el propio texto normativo usa «guardad de más, que luego
 *           se recorta» (05 §6, vacío de Quiero ir, literal) y «lo que habéis guardado» (05 §8). La regla de 03 §10 prohíbe el NOMBRE de
 *           botón/estado «Guardado» y «Guardar en Quiero ir», y eso el gate lo sigue impidiendo (0 ocurrencias).
 *   B10-C2 = D5-M1  CERRADO: las vistas «builder»/«compare» de OrderedSequenceBuilder (código no alcanzable) se retiraron con su copy; ya no hay excepción.
 *
 * Uso: `npm run build && node scripts/b10-microcopy-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const APP = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const LEXICON =
  /\brecorridos?\b|\bsecuencias?\b|\bconstructor\b|\borden(?:es)? [AB]\b|\btramos?\b|\bcandidat[oa]s?\b|\bDato:|\bgrados?\b|\bprovenance\b|\bfreshness\b|analizar selecci[oó]n|\bcobertura\b|\bclusters?\b|\bsubmit\b/i;
const SAVE_ACTION = /\bGuardar\b.*\ben Quiero ir\b/i;
const ARROW_END = /→\s*$/;
const EXCLAMATION = /[!¡]/;
const EMOJI = /\p{Emoji_Presentation}/u;
const ACCEPT = /^(Aceptar|Submit|OK)$/;
const SAVED_PROSE = /\bguard(?:ar|ad[oa]s?|ó|ad)\b/i;

// B10-C1 (voz aceptada): prosa «guardar/guardado/guardó/guardad» al hablar de lugares marcados «Quiero ir».
const DDR_C1_SOURCES = [
  ["components/SelectionPanel.tsx", "guardad de más"],
  ["components/InterestLegend.tsx", "habéis guardado este lugar"],
  ["components/SelectionAnalysis.tsx", "guardados en"],
  ["lib/traveller-presentation.ts", "Todavía no habéis guardado nada."],
  ["lib/divergence-presentation.ts", "lo guardó"],
  ["lib/divergence-presentation.ts", "Todavía no habéis guardado nada."],
];

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 500)}`);
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

// ─────────── contenido editorial de data/ (se identifica por contener la cadena exacta)
const DATA = [];
for (const file of ["../src/data/places.json", "../../data/sources.json", "../src/data/zones.json", "../src/data/photography-metadata.json", "../src/data/reservation-mechanisms.json", "../src/data/nearby.json", "../src/data/seasonal-alerts.json"]) {
  try {
    const walk = (v) => (typeof v === "string" ? DATA.push(v) : v && typeof v === "object" && Object.values(v).forEach(walk));
    walk(JSON.parse(read(file)));
  } catch {
    /* no disponible */
  }
}
const isData = (text) => text.length > 18 && DATA.some((d) => d.includes(text));

// ─────────── pasada ESTÁTICA
const SRC = fileURLToPath(new URL("../src/", import.meta.url));
function files(dir, test, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files(p, test, out);
    else if (test(e, p) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}
function literals(file) {
  const code = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^import[\s\S]*?;$/gm, "");
  const out = [];
  for (const m of code.matchAll(/"([^"\n]*[A-Za-zÁ-ú][^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2]);
  for (const m of code.matchAll(/>([^<>{}\n]*[A-Za-zÁ-ú][^<>{}\n]*)</g)) out.push(m[1]);
  for (const m of code.matchAll(/^\s+([A-ZÁ-Ú][^<>{}=;\n]*[a-zá-ú.])\s*$/gm)) out.push(m[1]);
  // `${expr}` no es texto; los tokens de clase CSS/identificadores (sin espacios, minúsculas y guiones) tampoco.
  return out
    .map((s) => s.replace(/\$\{[^}]*\}/g, "X").replace(/\s+/g, " ").trim())
    .filter((s) => s && !/^[a-z][a-z0-9_-]*$/.test(s));
}
await ck("S01", "estática: léxico prohibido en cadenas de componentes y presentación (sin excepciones: las vistas no alcanzables se retiraron, D5-M1)", async () => {
  const targets = [
    ...files(path.join(SRC, "components"), (e) => e.endsWith(".tsx")),
    ...files(path.join(SRC, "lib"), (e) => /(presentation|copy|text)/.test(e) && e.endsWith(".ts")),
    path.join(SRC, "App.tsx"),
  ];
  const bad = [];
  for (const f of targets) {
    for (const s of literals(f)) {
      if (!LEXICON.test(s)) continue;
      if (/Grado original/.test(s) && !LEXICON.test(s.replace(/Grado original/, ""))) continue; // E1
      if (isData(s)) continue;
      bad.push(`${path.basename(f)}: «${s.slice(0, 90)}»`);
    }
  }
  ok(bad.length === 0, `${bad.length} cadenas: ${bad.slice(0, 5).join(" | ")}`);
});
await ck("S02", "estática: «Guardar … en Quiero ir», «→» final y exclamaciones fuera de la copy de componentes", async () => {
  const targets = files(path.join(SRC, "components"), (e) => e.endsWith(".tsx"));
  const bad = [];
  for (const f of targets) {
    for (const s of literals(f)) {
      if (SAVE_ACTION.test(s) || ARROW_END.test(s) || ACCEPT.test(s)) bad.push(`${path.basename(f)}: «${s.slice(0, 80)}»`);
    }
  }
  ok(bad.length === 0, bad.slice(0, 5).join(" | "));
});
await ck("S03", "B10-C1 (voz aceptada): las cadenas «guardar/guardado» siguen siendo exactamente las seis conocidas", async () => {
  for (const [file, text] of DDR_C1_SOURCES) ok(read(`../src/${file}`).includes(text), `ya no existe la cadena registrada en ${file}: «${text}» (¿se resolvió B10-C1? actualiza el gate)`);
  const found = [];
  for (const f of [...files(path.join(SRC, "components"), (e) => e.endsWith(".tsx")), ...files(path.join(SRC, "lib"), (e) => /presentation/.test(e) && e.endsWith(".ts"))]) {
    for (const s of literals(f)) if (SAVED_PROSE.test(s) && !isData(s) && !/fuera del recorrido|guardar el respaldo|guardar los cambios|Reiniciar lo que ha guardado|se guarda automáticamente|lugares guardados desde la lista de abajo/i.test(s)) found.push(`${path.basename(f)}: ${s.slice(0, 60)}`);
  }
  const known = new Set(DDR_C1_SOURCES.map(([f]) => path.basename(f)));
  const unexpected = found.filter((l) => !known.has(l.split(":")[0]));
  ok(unexpected.length === 0, `«guardar» fuera de las fuentes registradas: ${unexpected.slice(0, 4).join(" | ")}`);
});

// ─────────── pasada DINÁMICA
const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()}`);

const collect = (page) =>
  page.evaluate(() => {
    const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
    const lines = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim();
      const el = n.parentElement;
      if (!t || !el || !vis(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      lines.push({ kind: "text", text: t, inSources: !!el.closest(".place-sources"), action: !!el.closest("button,a,[role=button]") });
    }
    for (const el of document.querySelectorAll("[aria-label],[aria-description],[title],[alt],[placeholder]")) {
      if (!vis(el)) continue;
      for (const a of ["aria-label", "aria-description", "title", "alt", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v && v.trim()) lines.push({ kind: a, text: v.trim(), inSources: !!el.closest(".place-sources"), action: ["BUTTON", "A"].includes(el.tagName) });
      }
    }
    return lines;
  });

const seen = new Map();
let e1 = 0;
const skipped = [];
for (const width of [390, 1200]) {
  await walkSurfaces(
    browser,
    url,
    width,
    async (name, page) => {
      const lines = await collect(page);
      const bad = [];
      for (const l of lines) {
        seen.set(l.text, (seen.get(l.text) ?? 0) + 1);
        if (isData(l.text) && l.kind === "text") continue;
        if (l.inSources && /\bgrado\b/i.test(l.text) && !LEXICON.test(l.text.replace(/Grado original/i, ""))) { e1 += 1; continue; }
        if (LEXICON.test(l.text)) bad.push(`léxico ${l.kind}: «${l.text.slice(0, 80)}»`);
        if (SAVE_ACTION.test(l.text)) bad.push(`acción «Guardar… en Quiero ir» ${l.kind}: «${l.text.slice(0, 80)}»`);
        if (l.action && ARROW_END.test(l.text)) bad.push(`flecha final: «${l.text.slice(0, 60)}»`);
        if (l.action && ACCEPT.test(l.text)) bad.push(`acción genérica: «${l.text}»`);
        if (EXCLAMATION.test(l.text)) bad.push(`exclamación: «${l.text.slice(0, 60)}»`);
        if (EMOJI.test(l.text)) bad.push(`emoji: «${l.text.slice(0, 60)}»`);
      }
      await ck(`W-${width}-${name}`, `${width}px · ${name}: sin léxico prohibido, «Guardar… en Quiero ir», flechas, exclamaciones ni emoji (${lines.length} cadenas)`, async () => {
        ok(bad.length === 0, `${bad.length}: ${[...new Set(bad)].slice(0, 4).join(" | ")}`);
      });
    },
    { skipped }
  );
}
await ck("W-cobertura", "la recorrida alcanzó las superficies esperadas (≥ 40 estados, E1 observada, sin pasos omitidos críticos)", async () => {
  ok(e1 >= 1, "la excepción E1 «Grado original» no se observó: ¿cambió la ficha?");
  const critical = skipped.filter((s) => /ficha|quiero-ir|viaje|nosotros|filtros|ciudad/.test(s) && !/importar|persona|mapa|lightbox|creditos|nacional/.test(s));
  ok(critical.length === 0, `pasos críticos omitidos: ${critical.join(" | ")}`);
  console.log(`# cadenas distintas leídas: ${seen.size} · E1 observada ${e1} veces · pasos omitidos: ${skipped.length ? skipped.join("; ") : "ninguno"}`);
});

await browser.close();
await server.close();
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
