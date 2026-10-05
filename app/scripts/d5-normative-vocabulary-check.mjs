import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de D5 — vocabulario normativo (`docs/D5_NORMATIVE_VOCABULARY_MISSION.md`).
 * Comportamiento real sobre la build de producción (`npm run build` antes).
 *
 * Recorre Explorar, Quiero ir, Días (+ hoja de acciones de parada y «Probar otro orden»), Dónde dormir,
 * Reservas, Resumen, Nosotros y PlaceDetail, con todos los `<details>` abiertos, y comprueba el TEXTO
 * VISIBLE y los NOMBRES ACCESIBLES (`aria-label`, `aria-description`, `title`, `alt`, `aria-valuetext`)
 * contra los términos de `00 Art. 7` / `03 §10`.
 *
 * Excepción normativa (la única):
 *   E1  «Grado original» dentro de «Fuentes» plegado de PlaceDetail (`03` «Mostrar la letra de grado …
 *       Sólo en “Fuentes” plegado»; `PlaceDetail.tsx`, DDR-04).
 * Los cinco DESIGN DECISION REQUIRED están cerrados (excepción de copy en `lib/` autorizada y documentada):
 *   L1  «intervalo de fechas registrado» (no «traslado»)         · L2  «…registrada del intervalo.»
 *   L3  «Ya está en un día del viaje»                            · R1  «Restablecer lugares y días»
 *   latente  «Nivel sin clasificar (X)» en lugar de «Grado X»
 * Ya no hay deuda tolerada: cualquier término prohibido visible fuera de E1 falla.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/d5-normative-vocabulary-check.mjs`
 *      `NIHON_BROWSER=webkit` ejecuta el mismo gate en WebKit (si está instalado; `NIHON_WEBKIT_PATH` opcional);
 *      `NIHON_REDUCED_MOTION=1` lo ejecuta con `prefers-reduced-motion: reduce`.
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const REDUCED = process.env.NIHON_REDUCED_MOTION === "1";
const executablePath = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH;
const APP = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Art. 7 / 03 §10 (fuente de verdad). */
const FORBIDDEN =
  /\brecorridos?\b|\bsecuencias?\b|\bconstructor\b|\borden(?:es)? [AB]\b|\btramos?\b|\bcandidat[oa]s?\b|\bDato:|\bgrados?\b|\bprovenance\b|\bfreshness\b|analizar selecci[oó]n|\bcobertura\b/i;

const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const PLAN = {
  version: 8,
  routeIds: ["JP-212", "JP-077", "JP-044", "JP-203"],
  days: [
    { id: "d1", placeIds: ["JP-212"], accommodationBoundary: unsel },
    { id: "d2", placeIds: ["JP-077", "JP-044"], accommodationBoundary: unsel },
    { id: "d3", placeIds: ["JP-203"], accommodationBoundary: unsel },
  ],
  startDate: "2027-03-14",
  endDate: "2027-03-17",
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
};

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 400)}`);
  }
}
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls?.local[0];
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
console.log(`# navegador: ${BROWSER} ${browser.version()} · reduced-motion=${REDUCED}`);
const consoleErrors = [];
const pageErrors = [];

async function boot(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, ...(REDUCED ? { reducedMotion: "reduce" } : {}) });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript((plan) => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (sessionStorage.getItem("d5-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("d5-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, PLAN);
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}

const nav = (page, name) =>
  page.locator(`.tab-bar__item:has-text('${name}'):visible, .nav-rail__item:has-text('${name}'):visible`).first();
const openAllDetails = (page) =>
  page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));

/** Texto visible + nombres accesibles de lo que hay en pantalla ahora (excluye lo oculto). */
async function snapshot(page) {
  await openAllDetails(page);
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const visible = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : true);
    const lines = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || !visible(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      lines.push({ kind: "text", text, inSources: !!el.closest(".place-sources") });
    }
    for (const el of document.querySelectorAll("[aria-label],[aria-description],[title],[alt],[aria-valuetext]")) {
      if (!visible(el)) continue;
      for (const attr of ["aria-label", "aria-description", "title", "alt", "aria-valuetext"]) {
        const v = el.getAttribute(attr);
        if (v && v.trim()) lines.push({ kind: attr, text: v.trim(), inSources: !!el.closest(".place-sources") });
      }
    }
    return lines;
  });
}

const exceptionSeen = { E1: 0 };
const scanned = {};

/**
 * Contenido editorial de `data/` (descripciones, notas, fuentes): protegido y de fuente (Art. 4: «nada de la fuente se
 * reescribe»). Usa «recorrido», «secuencia» o «tramos» como español corriente sobre un museo o un jardín, no como
 * vocabulario de producto. Se identifica por contener la cadena exacta en `places.json` / `sources.json`, se cuenta
 * aparte y NO se toca en D5.
 */
const DATA_STRINGS = [];
for (const file of ["../src/data/places.json", "../../data/sources.json"]) {
  const walk = (v) => (typeof v === "string" ? DATA_STRINGS.push(v) : v && typeof v === "object" && Object.values(v).forEach(walk));
  try {
    walk(JSON.parse(read(file)));
  } catch {
    /* fichero no disponible: nada se clasifica como dato */
  }
}
const dataSeen = { count: 0 };
const isDataContent = (text) => text.length > 24 && DATA_STRINGS.some((d) => d.includes(text));

const allText = new Set();
function audit(label, lines) {
  scanned[label] = lines.length;
  for (const line of lines) allText.add(line.text);
  const bad = [];
  for (const line of lines) {
    if (!FORBIDDEN.test(line.text)) continue;
    if (line.inSources && /\bgrado\b/i.test(line.text) && !FORBIDDEN.test(line.text.replace(/\bGrado original\b/i, ""))) {
      exceptionSeen.E1 += 1;
      continue;
    }
    if (line.kind === "text" && isDataContent(line.text)) {
      dataSeen.count += 1;
      continue;
    }
    bad.push(`${line.kind}: «${line.text.slice(0, 140)}»`);
  }
  ok(bad.length === 0, `${label}: término prohibido visible → ${bad.slice(0, 4).join(" | ")}`);
}

// ─────────────────────────────── Viaje: cuatro sub-pestañas × cuatro anchos
for (const width of [320, 390, 840, 1200]) {
  const { context, page } = await boot(width);
  await nav(page, "Viaje").click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForTimeout(300);
  for (const tab of ["Días", "Dónde dormir", "Reservas", "Resumen"]) {
    await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
    await page.waitForTimeout(300);
    await ck(`V-${width}-${tab}`, `${width}px · Viaje › ${tab}: sin términos prohibidos (texto + nombres accesibles)`, async () => {
      audit(`Viaje/${tab}@${width}`, await snapshot(page));
    });
    if (tab === "Días" && width === 390) {
      // P-06 v2: cada superficie secundaria de Días (hojas N2 y vistas enfocadas N3) se audita con su texto real abierto.
      for (const [id, label, open, selector] of [
        ["V-move", "hoja de acciones de una parada («Mover al Día N» y «Mover a Sin asignar»)", () => page.getByRole("button", { name: /^Acciones de / }).first().click(), ".sheet"],
        ["V-dates", "hoja «Fechas del viaje»", () => page.getByRole("button", { name: /^(Editar fechas|Poner fechas del viaje)$/ }).click(), ".sheet"],
        ["V-add", "hoja «Añadir lugar»", () => page.getByRole("button", { name: /Añadir lugar/ }).first().click(), ".sheet"],
        ["V-day", "hoja «Acciones del Día N»", () => page.getByRole("button", { name: /^Acciones del Día \d+$/ }).first().click(), ".sheet"],
        ["V-details", "vista «Detalles del Día N»", () => page.getByRole("button", { name: /^Detalles del Día \d+$/ }).first().click(), ".focused-view"],
        ["V-tools", "vista «Herramientas del viaje»", () => page.getByRole("button", { name: "Herramientas del viaje" }).click(), ".focused-view"],
        ["V-order", "vista «Cambiar orden» (orden actual / otra propuesta)", () => page.getByRole("button", { name: /^Cambiar orden del Día \d+$/ }).and(page.locator(":enabled")).first().click(), ".day-order-tool"],
      ]) {
        await ck(id, `${label}`, async () => {
          await open();
          await page.locator(selector).first().waitFor();
          audit(`Días/${id}`, await snapshot(page));
          await page.keyboard.press("Escape");
          await page.locator(".sheet, .focused-view").first().waitFor({ state: "detached" });
        });
      }
    }
  }
  await context.close();
}

// ─────────────────────────────── Traslados entre ciudades (superficie con «Añadir traslado»)
{
  const { context, page } = await boot(390);
  await nav(page, "Viaje").click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await ck("T-01", "«Traslados entre ciudades»: «Añadir traslado» visible y formulario sin términos prohibidos", async () => {
    let found = false;
    for (const tab of ["Días", "Dónde dormir", "Reservas", "Resumen"]) {
      await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
      await page.waitForTimeout(250);
      // P-06 v2: el formulario de traslados vive en «Herramientas del viaje» (vista enfocada de Días).
      if (tab === "Días") await page.getByRole("button", { name: "Herramientas del viaje" }).click();
      const lines = await snapshot(page);
      if (lines.some((l) => /Añadir traslado/.test(l.text))) {
        found = true;
        audit(`Traslados@${tab}`, lines);
        await page.getByRole("button", { name: /Añadir traslado/ }).first().evaluate((el) => {
          el.scrollIntoView({ block: "center" });
          el.click();
        });
        await page.waitForTimeout(250);
        audit(`Traslados-formulario@${tab}`, await snapshot(page));
        break;
      }
      if (await page.locator(".focused-view").count()) await page.keyboard.press("Escape");
    }
    ok(found, "«Añadir traslado» no apareció en ninguna sub-pestaña");
  });
  await context.close();
}

// ─────────────────────────────── Explorar, PlaceDetail, Quiero ir, Nosotros
{
  const { context, page } = await boot(390);
  await ck("X-01", "Explorar (portada y ciudad)", async () => {
    await nav(page, "Explorar").click();
    await page.waitForTimeout(400);
    audit("Explorar/portada", await snapshot(page));
    await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(400);
    audit("Explorar/ciudad", await snapshot(page));
  });
  await ck("X-02", "PlaceDetail (con «Fuentes» abierto): sólo la excepción E1", async () => {
    await page.locator(".place-card").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(600);
    const lines = await snapshot(page);
    audit("PlaceDetail", lines);
    ok(lines.some((l) => l.inSources && /Grado original/.test(l.text)), "E1: «Grado original» ausente de «Fuentes»");
    ok(exceptionSeen.E1 >= 1, "E1 no registrada");
    const back = page.locator(".place-detail__back");
    if (await back.count()) await back.first().click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
  await ck("X-03", "Quiero ir", async () => {
    await nav(page, "Quiero ir").click();
    await page.waitForTimeout(500);
    audit("Quiero ir", await snapshot(page));
  });
  await ck("X-04", "Nosotros (viajeros, copia del viaje, fuentes y licencias) + frase de viajeros D5", async () => {
    await nav(page, "Nosotros").click();
    await page.waitForTimeout(500);
    const lines = await snapshot(page);
    audit("Nosotros", lines);
    ok(
      lines.some((l) => /Los lugares planificados, los días, las fechas y el alojamiento son del viaje/.test(l.text)),
      "falta la frase de TravellerManager con el copy D5"
    );
  });
  await context.close();
}

// ─────────────────────────────── Superficies adicionales (reconciliación sobre main): búsqueda, filtros, mapa,
// créditos, onboarding y estados vacíos
{
  const { context, page } = await boot(390);
  await ck("S-01", "Explorar › búsqueda global (hoja)", async () => {
    await nav(page, "Explorar").click();
    await page.waitForTimeout(300);
    await page.locator(".explorer-home__search-button").first().click();
    await page.locator(".sheet, [role=dialog]").first().waitFor();
    audit("Explorar/búsqueda", await snapshot(page));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });
  await ck("S-02", "Explorar › ciudad: filtros (hoja), lista y mapa", async () => {
    await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await page.locator(".sheet").first().waitFor();
    audit("Explorar/filtros", await snapshot(page));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const toggle = page.getByRole("button", { name: /^Mapa$/ });
    if (await toggle.count()) {
      await toggle.first().click();
      await page.waitForTimeout(600);
      audit("Explorar/mapa", await snapshot(page));
    }
  });
  await ck("S-03", "ficha › galería › créditos", async () => {
    await page.getByRole("button", { name: /^Lista$/ }).first().click().catch(() => {});
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.locator(".place-card").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(500);
    const info = page.getByRole("button", { name: /Créditos|crédito|Información de la foto/i });
    if (await info.count()) {
      await info.first().click();
      await page.waitForTimeout(400);
      audit("Ficha/créditos", await snapshot(page));
    }
  });
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(REDUCED ? { reducedMotion: "reduce" } : {}) });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await ck("S-04", "onboarding (primera visita) y estados vacíos de Quiero ir y Viaje", async () => {
    await page.waitForTimeout(500);
    audit("Onboarding", await snapshot(page));
    await page.keyboard.press("Escape");
    await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page.reload({ waitUntil: "networkidle" });
    await nav(page, "Quiero ir").click();
    await page.waitForTimeout(400);
    audit("Quiero ir/vacío", await snapshot(page));
    await nav(page, "Viaje").click();
    await page.waitForTimeout(500);
    audit("Viaje/vacío", await snapshot(page));
    await nav(page, "Nosotros").click();
    await page.waitForTimeout(400);
    audit("Nosotros/vacío", await snapshot(page));
  });
  await context.close();
}

// ─────────────────────────────── Términos no prohibidos conservados (12 §11) y copy con valores
await ck("K-01", "«reparto» se conserva; los valores y relaciones del copy sustituido no cambian", async () => {
  const builder = read("../src/components/OrderedSequenceBuilder.tsx");
  ok(/El reparto por días no es estructuralmente válido; el traslado no se aplica\./.test(builder), "«El reparto por días no es estructuralmente válido; …» alterado");
  ok(/El reparto actual no coincide exactamente con el\s+viaje\./.test(builder), "«El reparto actual no coincide …» alterado");
  ok(/\{knownLegCount\}\/\{legCount\} traslado/.test(builder), "conteo k/n de traslados perdido");
  ok(/\{unknownLegCount\}/.test(builder), "conteo de traslados sin registrar perdido");
  const order = read("../src/components/SequenceCandidateSummary.tsx");
  ok(/\$\{summary\.knownLegCount\}\/\$\{summary\.legCount\} traslado/.test(order), "conteo k/n de «Probar otro orden» perdido");
  ok(/reparto por días no coincide exactamente con el viaje/.test(builder), "reparto/Resumen alterado");
});
await ck("DDR-01", "los cinco DDR cerrados: copy nuevo presente en pantalla y copy antiguo ausente", async () => {
  const texts = [...allText];
  const has = (re) => texts.some((t) => re.test(t));
  // R1: el botón «Restablecer lugares y días» vivía en la vista «builder» de OrderedSequenceBuilder, no alcanzable desde B27; esa vista
  // se RETIRÓ en el endurecimiento post-B10 (D5-M1, docs/D5_M1_UNREACHABLE_VIEWS_RETIREMENT.md). Se fija que ni el botón ni el copy antiguo existen.
  const builderSrc = read("../src/components/OrderedSequenceBuilder.tsx");
  ok(!/Restablecer lugares y días|Restablecer recorrido/.test(builderSrc) && !has(/Restablecer (recorrido|lugares y días)/), "R1: el botón retirado (o su copy antiguo) reapareció");
  ok(has(/Ya está en un día del viaje\. Esto no lo cambia\./), "L3: falta «Ya está en un día del viaje»");
  ok(!has(/día del recorrido/), "L3: «día del recorrido» sigue visible");
  ok(has(/intervalo de fechas registrado para la solicitud\./), "L1: falta «intervalo de fechas registrado»");
  ok(!has(/tramo de fechas|traslado de fechas/), "L1: «tramo/traslado de fechas» visible");
  ok(has(/Situado en esta lista por la fecha de inicio registrada del intervalo\./), "L2: falta la nota «…del intervalo.»");
  ok(!has(/inicio registrada del tramo/), "L2: «del tramo» visible");
  const lib = read("../src/lib/interest-level.ts");
  ok(/Nivel sin clasificar \(\$\{grade\}\)/.test(lib) && !/`Grado \$\{grade\}`/.test(lib), "latente: fallback sin «Grado»");
});
await ck("C-01", "sin errores de consola ni de página propios", async () => {
  const own = consoleErrors.filter((t) => !/Failed to load resource|net::ERR|status of 204/i.test(t));
  ok(own.length === 0 && pageErrors.length === 0, `consola: ${own.slice(0, 3).join(" | ")} · página: ${pageErrors.slice(0, 2).join(" | ")}`);
});

console.log(`# excepciones: ${JSON.stringify(exceptionSeen)} · contenido editorial de data/ (no se toca): ${dataSeen.count}`);
console.log(`# superficies auditadas: ${Object.keys(scanned).length} · cadenas leídas: ${Object.values(scanned).reduce((a, b) => a + b, 0)}`);
await browser.close();
await server.close();
console.log(failures.length === 0 ? `\nD5 GATE: ${pass}/${pass} OK` : `\nD5 GATE: ${failures.length} FALLO(S) de ${pass + failures.length}\n${failures.join("\n")}`);
process.exit(failures.length === 0 ? 0 : 1);
