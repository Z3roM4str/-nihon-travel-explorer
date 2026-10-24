import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Auditoría final, ronda 2 — «Exportar respaldo» con datos protegidos o sin poder guardar.
 *
 *   E1  documento inválido + viajeros válidos: no hay respaldo normal (no se exporta el estado inicial vacío como si fuera el
 *       viaje); se explica y se ofrece la copia de lo conservado, cuyo contenido son las cadenas ORIGINALES;
 *   E2  tras recargar sigue igual y los originales (y las claves `nihon.recovered.*` previas) siguen intactos;
 *   E3  datos válidos: el respaldo normal sí se genera y contiene el viaje;
 *   E4  el navegador no puede entregar el archivo: se dice, no se afirma «Archivo generado»;
 *   E5  la escritura falla (cuota): lo último no está guardado → no se exporta como si lo estuviera; al volver a poder
 *       escribir y reintentar, se exporta y contiene lo último.
 *
 * Uso: `npm run build && node scripts/final-audit-export-protection-check.mjs`
 * (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH`, `NIHON_EVIDENCE_OUT`, `NIHON_PORT`, `NIHON_ONLY` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = Number(process.env.NIHON_PORT ?? 4292);
const OUT = process.env.NIHON_EVIDENCE_OUT ?? null;
const DK = "nihon.manualPlanningDraft";
const TK = "nihon.travellers.v1";

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
const BASE_URL = `http://127.0.0.1:${PORT}`;

const launchOptions =
  BROWSER === "webkit"
    ? {}
    : process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {};
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch(launchOptions);

const results = [];
const evidence = {};
const check = (id, label, ok, extra) => {
  results.push({ id, label, ok, extra: extra ?? null });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${label}${extra !== undefined ? ` (${extra})` : ""}`);
};
const guarded = async (id, label, fn) => {
  try {
    await fn();
  } catch (error) {
    check(id, `${label} — excepción`, false, String(error.stack).split("\n").slice(0, 4).join(" | ").slice(0, 400));
  }
};

// ── Fixtures de prueba ───────────────────────────────────────────────────────────────────────
const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const travellersDoc = (label, ids) => ({
  version: 1,
  travellers: [
    { id: "p1", label },
    { id: "p2", label: "Jun" },
  ],
  activeTravellerId: "p1",
  interests: ids.map((placeId) => ({
    placeId,
    stances: [{ travellerId: "p1", stance: "interested" }],
    carriedOver: false,
  })),
});
const draftDoc = (ids, hotel = "Hotel conservado") => ({
  version: 8,
  routeIds: ids,
  days: [{ id: "d1", placeIds: ids, accommodationBoundary: none }],
  startDate: "2027-02-22",
  endDate: "2027-02-25",
  visitStartTimes: {},
  accommodations: [{ id: "a1", label: hotel, location: { lat: 35.68, lng: 139.76 } }],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
});

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────
async function newContext(storage = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ storage: seed }) => {
      // Se siembra una sola vez por pestaña: una recarga NO debe volver a pisar el almacenamiento.
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      if (localStorage.getItem("__ctxSeeded")) return;
      localStorage.setItem("__ctxSeeded", "1");
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
    },
    { storage }
  );
  return context;
}
async function openPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.errors = [];
  page.failedRequests = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  page.on("requestfailed", (request) => page.failedRequests.push(`${request.url().split("/").pop()} ${request.failure()?.errorText ?? ""}`));
  await page.goto(BASE_URL);
  await page.waitForSelector("#root *");
  return page;
}
const raw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const nav = (page, name) =>
  page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name }).click();
const saveHeart = (page, name) =>
  page.getByRole("button", { name: `Quiero ir: ${name}`, exact: true }).click();


/** El documento VÁLIDO se reescribe al arrancar con su linaje `_w` (lo ignoran los parsers); se compara sin él. */
const sameDoc = (rawText, expectedText) => {
  try {
    const { _w, ...doc } = JSON.parse(rawText);
    return JSON.stringify(doc) === JSON.stringify(JSON.parse(expectedText));
  } catch {
    return false;
  }
};
const openBackup = async (page) => {
  await nav(page, "Nosotros");
  await page.getByRole("heading", { name: "Exportar respaldo" }).waitFor();
};
const readDownload = async (download) => {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};
async function trackDownloads(page) {
  page.downloads = 0;
  page.on("download", () => { page.downloads += 1; });
}

async function e1e2() {
  const badDraft = JSON.stringify({ version: 8, days: "roto", routeIds: 3 });
  const goodTravellers = JSON.stringify(travellersDoc("Marta", ["JP-044"]));
  const priorRecovered = "{\"conservado\":true}";
  const context = await newContext({ [TK]: goodTravellers, [DK]: badDraft, "nihon.recovered.19990101.nihon.x": priorRecovered });
  const page = await openPage(context);
  await trackDownloads(page);
  await openBackup(page);
  const section = page.locator(".trip-backup");
  check("E1", "con un documento inválido NO se ofrece «Exportar respaldo» (no se exporta el estado vacío como el viaje)",
    (await section.getByRole("button", { name: "Exportar respaldo", exact: true }).count()) === 0);
  const blocked = section.locator("[data-export-blocked=protected]");
  check("E1", "se explica por qué y que los originales siguen intactos", (await blocked.count()) === 1 && /No se puede exportar un respaldo normal/.test(await blocked.innerText()) && /siguen intactos/.test(await blocked.innerText()));
  const [download] = await Promise.all([page.waitForEvent("download"), blocked.getByRole("button", { name: /Descargar copia de lo conservado/ }).click()]);
  const copy = JSON.parse(await readDownload(download));
  evidence.e1 = { fileName: download.suggestedFilename(), keys: Object.keys(copy.originals ?? {}) };
  check("E1", "la copia ofrecida contiene lo ORIGINAL: el borrador dañado byte a byte y los viajeros íntegros", copy.format === "nihon-stored-data-copy" && copy.originals?.[DK] === badDraft && sameDoc(copy.originals?.[TK], goodTravellers), Object.keys(copy.originals ?? {}).join(","));
  await page.waitForTimeout(300);
  check("E1", "el original dañado y los viajeros no se tocaron", (await raw(page, DK)) === badDraft && sameDoc(await raw(page, TK), goodTravellers));
  check("E1", "sólo se produjo la descarga de la copia (ningún respaldo normal)", page.downloads === 1, String(page.downloads));
  await page.reload();
  await page.waitForSelector("#root *");
  await trackDownloads(page);
  await openBackup(page);
  check("E2", "tras recargar sigue bloqueado y sin botón de respaldo normal", (await page.locator(".trip-backup [data-export-blocked=protected]").count()) === 1 && (await page.locator(".trip-backup").getByRole("button", { name: "Exportar respaldo", exact: true }).count()) === 0);
  await nav(page, "Explorar");
  await page.waitForTimeout(300);
  await saveHeart(page, "Tokyo National Museum");
  await page.waitForTimeout(500);
  check("E2", "tras recargar y mutar, el original dañado sigue sin tocarse", (await raw(page, DK)) === badDraft);
  check("E2", "la clave de recuperación previa no se borró", (await raw(page, "nihon.recovered.19990101.nihon.x")) === priorRecovered);
  check("E2", "sigue sin descargarse ningún respaldo normal", page.downloads === 0, String(page.downloads));
  await context.close();
}

async function e3() {
  const context = await newContext({ [TK]: JSON.stringify(travellersDoc("Marta", ["JP-044"])), [DK]: JSON.stringify(draftDoc(["JP-044"], "Hotel del viaje")) });
  const page = await openPage(context);
  await openBackup(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".trip-backup").getByRole("button", { name: "Exportar respaldo", exact: true }).click()]);
  const file = JSON.parse(await readDownload(download));
  check("E3", "con datos válidos el respaldo normal se genera y contiene el viaje",
    file.data?.planningDraft?.accommodations?.[0]?.label === "Hotel del viaje" && file.data?.travellers?.interests?.[0]?.placeId === "JP-044", download.suggestedFilename());
  check("E3", "la interfaz confirma el archivo", (await page.locator(".trip-backup__result").first().innerText()).includes("Archivo generado"));
  await context.close();
}

async function e4() {
  const context = await newContext({ [TK]: JSON.stringify(travellersDoc("Marta", ["JP-044"])), [DK]: JSON.stringify(draftDoc(["JP-044"])) });
  await context.addInitScript(() => { URL.createObjectURL = () => { throw new Error("blocked"); }; });
  const page = await openPage(context);
  await trackDownloads(page);
  await openBackup(page);
  await page.locator(".trip-backup").getByRole("button", { name: "Exportar respaldo", exact: true }).click();
  await page.waitForTimeout(300);
  const result = page.locator(".trip-backup__result");
  check("E4", "si el navegador no entrega el archivo se dice (alerta) y no se afirma «Archivo generado»",
    (await result.count()) === 1 && /no ha podido entregar/.test(await result.innerText()) && !(await page.locator(".trip-backup").innerText()).includes("Archivo generado"));
  check("E4", "no hubo descarga", page.downloads === 0);
  await context.close();
}

async function e5() {
  const context = await newContext({ [TK]: JSON.stringify(travellersDoc("Marta", ["JP-044"])), [DK]: JSON.stringify(draftDoc(["JP-044"])) });
  await context.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (typeof key === "string" && key.startsWith("nihon.") && !key.includes("onboarding") && window.__failWrites) throw new DOMException("quota", "QuotaExceededError");
      return real.call(this, key, value);
    };
  });
  const page = await openPage(context);
  await trackDownloads(page);
  await nav(page, "Explorar");
  await page.evaluate(() => { window.__failWrites = true; });
  await saveHeart(page, "Tokyo National Museum"); // se aplica en memoria, no se puede escribir
  await page.waitForTimeout(600);
  await openBackup(page);
  const blocked = page.locator(".trip-backup [data-export-blocked=unsaved]");
  check("E5", "con la escritura fallando no se ofrece exportar: lo último no está guardado", (await blocked.count()) === 1 && (await page.locator(".trip-backup").getByRole("button", { name: "Exportar respaldo", exact: true }).count()) === 0);
  check("E5", "no se descargó nada", page.downloads === 0);
  await page.evaluate(() => { window.__failWrites = false; });
  await blocked.getByRole("button", { name: "Volver a intentarlo" }).click();
  await page.waitForTimeout(600);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".trip-backup").getByRole("button", { name: "Exportar respaldo", exact: true }).click()]);
  const file = JSON.parse(await readDownload(download));
  check("E5", "restablecida la escritura y reintentado, el respaldo incluye lo último (JP-021)", file.data?.travellers?.interests?.some((i) => i.placeId === "JP-021") === true, file.data?.travellers?.interests?.map((i) => i.placeId).join(","));
  await context.close();
}

const steps = [["E1", e1e2], ["E3", e3], ["E4", e4], ["E5", e5]];
const only = process.env.NIHON_ONLY?.split(",") ?? null;
for (const [id, fn] of steps) if (!only || only.includes(id)) await guarded(id, id, fn);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK (${BROWSER})`);
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/final-audit-export-protection-${BROWSER}.json`, JSON.stringify({ browser: BROWSER, results, evidence }, null, 2));
}
process.exit(failed.length === 0 ? 0 : 1);
