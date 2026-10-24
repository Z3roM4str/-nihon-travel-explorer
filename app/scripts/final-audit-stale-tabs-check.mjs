import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Auditoría final, ronda 2 — operaciones desde pestañas con la vista obsoleta y escrituras próximas.
 *
 *   S1  A saca una parada del día; B (vista anterior) intenta moverla → se rechaza con explicación y no toca nada más;
 *   S2  A reordena (mueve una parada a otro día); B actúa sobre OTRA parada cuyo índice cambió → afecta a ESA parada;
 *   S3  A elimina un día; B intenta mover una parada a él → rechazo explicado;
 *   S4  A guarda un lugar; B (vista «sin guardar») pulsa el corazón → queda guardado (intención, no «alternar»);
 *   S5  estrés: varias pestañas escriben a la vez (días e intereses) → ni se pierde ni se duplica nada;
 *   S6  B (obsoleta) muta mientras el almacenamiento pasó a ser inválido → el original no se toca.
 *
 * La vista obsoleta de B se fabrica descartando en B los eventos `storage` (el navegador los entrega en
 * milisegundos, así que sin esto no habría ventana que probar). Todo corre contra la build servida por `vite preview`.
 *
 * Uso: `npm run build && node scripts/final-audit-stale-tabs-check.mjs`
 * (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH`, `NIHON_EVIDENCE_OUT`, `NIHON_PORT`, `NIHON_ONLY` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = Number(process.env.NIHON_PORT ?? 4291);
const OUT = process.env.NIHON_EVIDENCE_OUT ?? null;
const DK = "nihon.manualPlanningDraft";
const TK = "nihon.travellers.v1";
const NAMES = { "JP-044": "Ghibli Museum, Mitaka", "JP-021": "Tokyo National Museum", "JP-077": "Katsura Imperial Villa", "JP-078": "Saiho-ji (Koke-dera)" };

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
const BASE_URL = `http://127.0.0.1:${PORT}`;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch(
  process.env.NIHON_CHROMIUM_PATH && BROWSER === "chromium" ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}
);

const results = [];
const evidence = {};
const check = (id, label, ok, extra) => {
  results.push({ id, label, ok, extra: extra ?? null });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${label}${extra !== undefined ? ` (${extra})` : ""}`);
};
const guarded = async (id, fn) => {
  try {
    await fn();
  } catch (error) {
    check(id, "excepción", false, String(error.stack).split("\n").slice(0, 3).join(" | ").slice(0, 400));
  }
};

const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const day = (id, placeIds) => ({ id, placeIds, accommodationBoundary: none });
const travellers = (ids) => ({
  version: 1,
  travellers: [{ id: "p1", label: "Marta" }, { id: "p2", label: "Jun" }],
  activeTravellerId: "p1",
  interests: ids.map((placeId) => ({ placeId, stances: [{ travellerId: "p1", stance: "interested" }], carriedOver: false })),
});
const draft = (days) => ({
  version: 8,
  routeIds: days.flatMap((d) => d.placeIds),
  days,
  startDate: null,
  endDate: null,
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
});

async function newContext(storage, viewport = { width: 1200, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ seed }) => {
      if (localStorage.getItem("__ctxSeeded")) return;
      localStorage.setItem("__ctxSeeded", "1");
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
    },
    { seed: storage }
  );
  return context;
}
/** Pestaña con la vista congelada: descarta los eventos `storage` antes de que la app los vea. */
async function openStale(context) {
  const page = await context.newPage();
  await page.addInitScript(() => window.addEventListener("storage", (event) => event.stopImmediatePropagation(), true));
  await page.goto(BASE_URL);
  await page.waitForSelector("#root *");
  return page;
}
/**
 * Tras cada escritura propia (también la de arranque y la de entrar en «Viaje») la pestaña comprueba durante ~2,5 s que
 * sobrevivió y adopta lo ajeno que vea (correcto, pero entonces deja de ser «obsoleta»). La vista congelada se
 * fabrica esperando a que esa comprobación termine antes de que A actúe.
 */
async function openStaleOnViaje(context) {
  const page = await openStale(context);
  await gotoViaje(page);
  await page.waitForTimeout(3000);
  return page;
}
async function openPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(BASE_URL);
  await page.waitForSelector("#root *");
  return page;
}
const json = async (page, key) => page.evaluate((k) => { const v = localStorage.getItem(k); try { return v === null ? null : JSON.parse(v); } catch { return "<<no-json>>"; } }, key);
const tab = (page, name) => page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name }).click();
async function gotoViaje(page) {
  await tab(page, "Viaje");
  await page.locator(".day-card").first().waitFor();
}
async function openStopSheet(page, placeId) {
  await page.getByRole("button", { name: `Acciones de ${NAMES[placeId]}`, exact: true }).click();
  const sheet = page.locator(".sheet").filter({ has: page.getByRole("heading", { name: NAMES[placeId], exact: true }) });
  await sheet.waitFor();
  return sheet;
}
const dayIds = (doc) => doc?.days?.map((d) => d.placeIds.join(",")).join(" | ");
const settle = (page) => page.waitForTimeout(500);

// ═══ S1 — la parada ya no está donde B la veía ═══════════════════════════════════════════════
async function s1() {
  const ids = ["JP-044", "JP-021", "JP-077", "JP-078"];
  const context = await newContext({ [TK]: JSON.stringify(travellers(ids)), [DK]: JSON.stringify(draft([day("d1", ["JP-044", "JP-021", "JP-077"]), day("d2", ["JP-078"])])) });
  const a = await openPage(context);
  await gotoViaje(a);
  const b = await openStaleOnViaje(context);
  const sheetB = await openStopSheet(b, "JP-044"); // B abre las acciones de Ghibli: para B sigue en el Día 1
  const sheetA = await openStopSheet(a, "JP-044");
  await sheetA.getByRole("button", { name: /Mover a Sin asignar/ }).click(); // A la saca del día
  await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).days[0].placeIds.length === 2, DK);
  await b.bringToFront();
  await sheetB.getByRole("button", { name: /Mover al Día 2/ }).click(); // B, con su vista anterior
  await settle(b);
  const stored = await json(a, DK);
  evidence.s1 = stored;
  check("S1", "la acción de B sobre la parada que A sacó del día se rechaza: el día 1 queda sin Ghibli y el día 2 intacto", dayIds(stored) === "JP-021,JP-077 | JP-078", dayIds(stored));
  check("S1", "B explica el rechazo (no se ha hecho nada, la vista se actualizó)", (await b.locator("[data-stale-rejection]").count()) === 1 && /No se ha hecho nada/.test(await b.locator("[data-stale-rejection]").innerText()));
  check("S1", "la vista de B se actualizó: ya muestra Ghibli fuera del día 1", (await b.locator(".day-card").first().innerText()).includes("Ghibli") === false);
  await context.close();
}

// ═══ S2 — el índice de otra parada cambió ════════════════════════════════════════════════════
async function s2() {
  const ids = ["JP-044", "JP-021", "JP-077", "JP-078"];
  const context = await newContext({ [TK]: JSON.stringify(travellers(ids)), [DK]: JSON.stringify(draft([day("d1", ["JP-044", "JP-021", "JP-077"]), day("d2", ["JP-078"])])) });
  const a = await openPage(context);
  await gotoViaje(a);
  const b = await openStaleOnViaje(context);
  const sheetA = await openStopSheet(a, "JP-044");
  await sheetA.getByRole("button", { name: /Mover al Día 2/ }).click(); // A: d1 = [021, 077], d2 = [078, 044]
  await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).days[0].placeIds.length === 2, DK);
  // B ve aún [044, 021, 077]: en su vista Tokyo National Museum es la 2.ª parada; en el estado vigente es la 1.ª.
  await b.bringToFront();
  const sheetB = await openStopSheet(b, "JP-021");
  await sheetB.getByRole("button", { name: /Mover a Sin asignar/ }).click();
  await settle(b);
  const stored = await json(a, DK);
  evidence.s2 = stored;
  check("S2", "B actuó sobre Tokyo National Museum (su id), no sobre la parada que ahora ocupa su antiguo índice", dayIds(stored) === "JP-077 | JP-078,JP-044", dayIds(stored));
  check("S2", "el itinerario sigue siendo una partición válida (4 paradas, ninguna repetida)", new Set(stored.days.flatMap((d) => d.placeIds)).size === stored.days.flatMap((d) => d.placeIds).length);
  await context.close();
}

// ═══ S3 — el día destino ya no existe ═══════════════════════════════════════════════════════
async function s3() {
  const ids = ["JP-044", "JP-021", "JP-077"];
  const context = await newContext({ [TK]: JSON.stringify(travellers(ids)), [DK]: JSON.stringify(draft([day("d1", ["JP-044", "JP-021"]), day("d2", ["JP-077"]), day("d3", [])])) });
  const a = await openPage(context);
  await gotoViaje(a);
  const b = await openStaleOnViaje(context);
  const sheetB = await openStopSheet(b, "JP-044"); // B ve «Mover al Día 3»
  await a.getByRole("button", { name: "Acciones del Día 3", exact: true }).click();
  const daySheet = a.locator(".sheet").filter({ has: a.getByRole("heading", { name: "Acciones del Día 3", exact: true }) });
  await daySheet.getByRole("button", { name: "Eliminar Día 3" }).click(); // A elimina el día vacío
  await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).days.length === 2, DK);
  await b.bringToFront();
  await sheetB.getByRole("button", { name: /Mover al Día 3/ }).click();
  await settle(b);
  const stored = await json(a, DK);
  evidence.s3 = stored;
  check("S3", "mover a un día que A eliminó se rechaza: nada cambia", dayIds(stored) === "JP-044,JP-021 | JP-077", dayIds(stored));
  check("S3", "B lo explica", (await b.locator("[data-stale-rejection]").count()) === 1);
  await context.close();
}

// ═══ S4 — corazón: intención, no «alternar» ═════════════════════════════════════════════════
async function s4() {
  const context = await newContext({});
  const a = await openPage(context);
  await a.waitForFunction((k) => localStorage.getItem(k) !== null, TK);
  const b = await openStale(context);
  await a.getByRole("button", { name: `Quiero ir: ${NAMES["JP-021"]}`, exact: true }).click();
  await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).interests.length === 1, TK);
  // B aún ve «sin guardar»: pulsa el corazón con la intención de GUARDAR.
  await b.getByRole("button", { name: `Quiero ir: ${NAMES["JP-021"]}`, exact: true }).click();
  await settle(b);
  const stored = await json(a, TK);
  check("S4", "A guardó y B (vista anterior) pidió guardar: el lugar queda guardado, no se quita", stored.interests.some((i) => i.placeId === "JP-021" && i.stances.some((s) => s.stance === "interested")), JSON.stringify(stored.interests.map((i) => i.placeId)));
  await context.close();
}

// ═══ S5 — escrituras próximas ═══════════════════════════════════════════════════════════════
async function s5() {
  const N = Number(process.env.NIHON_STRESS ?? 40);
  for (let round = 1; round <= 2; round += 1) {
    const context = await newContext({ [TK]: JSON.stringify(travellers(["JP-044"])), [DK]: JSON.stringify(draft([day("d1", ["JP-044"])])) });
    const pages = [await openPage(context), await openPage(context), await openPage(context)];
    for (const p of pages) await gotoViaje(p);
    await Promise.all(
      pages.map((p) =>
        p.evaluate(async (n) => {
          const button = () => [...document.querySelectorAll("button")].find((b) => /Añadir día/.test(b.textContent));
          for (let i = 0; i < n; i += 1) {
            button().click();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }, N)
      )
    );
    await pages[0].waitForTimeout(2800); // lo que haya que comprobar/reponer (linaje) se resuelve en ~250 ms; margen amplio
    const stored = await json(pages[0], DK);
    const expected = 1 + 3 * N;
    evidence[`s5-ronda${round}`] = { dias: stored.days.length, esperados: expected };
    check("S5", `ronda ${round}: 3 pestañas × ${N} «Añadir día» simultáneos → ni se pierde ni se duplica ninguno`, stored.days.length === expected, `días=${stored.days.length} esperados=${expected}`);
    const ids = stored.days.map((d) => d.id);
    check("S5", `ronda ${round}: los ids de día son únicos`, new Set(ids).size === ids.length);
    const views = await Promise.all(pages.map((p) => p.locator(".day-card").count()));
    check("S5", `ronda ${round}: las tres vistas coinciden con lo almacenado`, views.every((count) => count === expected), views.join("/"));
    await context.close();
  }
  // Intereses: dos pestañas guardan lugares distintos a la vez.
  const context = await newContext({});
  const a = await openPage(context);
  const b = await openPage(context);
  await a.waitForFunction((k) => localStorage.getItem(k) !== null, TK);
  const names = await a.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.getAttribute("aria-label") || "").filter((l) => l.startsWith("Quiero ir: ")));
  const unique = [...new Set(names)].slice(0, 14);
  await Promise.all(
    [a, b].map((p, index) =>
      p.evaluate(async ({ labels, index: parity }) => {
        for (let i = 0; i < labels.length; i += 1) {
          if (i % 2 !== parity) continue;
          [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === labels[i])?.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }, { labels: unique, index })
    )
  );
  await a.waitForTimeout(2800);
  const stored = await json(a, TK);
  check("S5", `intereses: dos pestañas guardan ${unique.length} lugares distintos a la vez → los ${unique.length} quedan`, stored.interests.length === unique.length, `${stored.interests.length}/${unique.length}`);
  await context.close();
}

// ═══ S6 — vista obsoleta + almacenamiento que pasó a ser inválido ═══════════════════════════
async function s6() {
  const context = await newContext({ [TK]: JSON.stringify(travellers(["JP-044", "JP-021"])), [DK]: JSON.stringify(draft([day("d1", ["JP-044", "JP-021"])])) });
  const a = await openPage(context);
  await gotoViaje(a);
  const b = await openStaleOnViaje(context);
  const damaged = JSON.stringify({ ...draft([day("d1", ["JP-044", "JP-021"])]), interHubSegments: "damaged" });
  await a.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: DK, value: damaged });
  await b.getByRole("button", { name: "Añadir día" }).click(); // B no sabe que el original pasó a ser inválido
  await settle(b);
  check("S6", "B, con la vista obsoleta, no escribe sobre un original que pasó a ser inválido", (await b.evaluate((k) => localStorage.getItem(k), DK)) === damaged);
  await context.close();
}

const steps = [["S1", s1], ["S2", s2], ["S3", s3], ["S4", s4], ["S5", s5], ["S6", s6]];
const only = process.env.NIHON_ONLY?.split(",") ?? null;
for (const [id, fn] of steps) if (!only || only.includes(id)) await guarded(id, fn);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK (${BROWSER})`);
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/final-audit-stale-tabs-${BROWSER}.json`, JSON.stringify({ browser: BROWSER, results, evidence }, null, 2));
}
process.exit(failed.length === 0 ? 0 : 1);
