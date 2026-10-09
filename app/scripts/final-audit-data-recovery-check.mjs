import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import * as procFs from "node:fs"; // espacio de nombres propio: h03-conservation-investigation.mjs antepone sus importaciones
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { pressOfferedReload } from "./lib/h03-reload.mjs";
import { preview } from "vite";

/**
 * Gate de la auditoría final independiente (6 oct 2026) — H01, H02, H03 y H04, y sus interacciones.
 *
 * Todas las comprobaciones corren contra la build de producción servida por `vite preview`, con
 * contextos nuevos y datos de prueba (nunca datos reales). Cada defecto se comprueba por
 * COMPORTAMIENTO observable —el contenido de `localStorage` y lo que la aplicación muestra—, no
 * por detalles de implementación, de modo que la misma batería falla sobre la base auditada
 * (`32787a1`) y pasa con la corrección. Los resultados se escriben en `NIHON_EVIDENCE_OUT`.
 *
 *   H01  importar un respaldo y navegar sin pulsar «Continuar» no sobrescribe lo restaurado;
 *   H02  dos pestañas con los mismos IDs no se pisan (intereses ni itinerario);
 *   H03  la descarga fallida de un módulo diferido muestra una recuperación comprensible;
 *   H04  documentos inválidos o de versión futura no se sustituyen: se conservan y hay salida explícita;
 *   X    interacciones: importar con otra pestaña abierta, conflicto tras recuperar, recarga protegida.
 *
 * Uso: `npm run build && node scripts/final-audit-data-recovery-check.mjs`
 * (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH`, `NIHON_EVIDENCE_OUT`, `NIHON_PORT` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const NATIVE_TRACE = process.env.NIHON_H03_NATIVE_TRACE === "1";
const PORT = Number(process.env.NIHON_PORT ?? 4290);
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
const backupFile = (travellers, draft) =>
  JSON.stringify({
    format: "nihon-portable-backup",
    version: 1,
    exportedAt: "2026-10-06T00:00:00.000Z",
    data: { travellers, planningDraft: draft },
  });

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────
async function newContext(storage = {}, viewport = { width: 390, height: 844 }, persistent = false) {
  // WPE keeps private-context localStorage in NetworkProcess memory. A real
  // socket reset can restart that process and erase the fixture, independently
  // of Nihon. H03 tests durable data in a fresh disk-backed profile instead.
  // No storageState replay, re-seeding, navigation retry, or added settling wait.
  const profile = persistent ? mkdtempSync(join(tmpdir(), "nihon-h03-profile-")) : null;
  let context;
  try {
    context = profile ? await webkit.launchPersistentContext(profile, { viewport }) : await browser.newContext({ viewport });
  } catch (error) {
    if (profile) rmSync(profile, { recursive: true, force: true });
    throw error;
  }
  if (profile) {
    context.h03Profile = profile;
    context.once("close", () => {
      // The directed audit owns cleanup only when it will inspect these synthetic files AFTER the verdict.
      if (process.env.NIHON_H03_PROFILE_DIAGNOSTICS !== "1") rmSync(profile, { recursive: true, force: true });
    });
  }
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
const json = async (page, key) => {
  const value = await raw(page, key);
  try {
    return value === null ? null : JSON.parse(value);
  } catch {
    return "<<no-json>>";
  }
};
const nav = (page, name) =>
  page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name }).click();
const interestIds = (doc) => (doc && doc.interests ? doc.interests.map((i) => i.placeId).sort() : []);
const waitStore = (page, key, predicate, arg) =>
  page.waitForFunction(
    ({ k, src, a }) => {
      const value = localStorage.getItem(k);
      if (value === null) return false;
      try {
        return new Function("doc", "arg", `return (${src})(doc, arg)`)(JSON.parse(value), a);
      } catch {
        return false;
      }
    },
    { k: key, src: predicate.toString(), a: arg }
  );
const saveHeart = (page, name) =>
  page.getByRole("button", { name: `Quiero ir: ${name}`, exact: true }).click();
async function gotoViaje(page) {
  await nav(page, "Viaje");
  await page.locator(".day-card").first().waitFor();
}

// Nombres tal como los anuncia la tarjeta.
const TNM = "Tokyo National Museum";
const GHIBLI = "Ghibli Museum, Mitaka";

// ═══ H01 — restauración sobrescrita por estado montado ═══════════════════════════════════════
async function h01() {
  const context = await newContext({
    [TK]: JSON.stringify(travellersDoc("Viaje anterior", ["JP-044"])),
    [DK]: JSON.stringify(draftDoc(["JP-044"])),
  });
  const page = await openPage(context);
  await gotoViaje(page); // monta el borrador, como en el informe
  await nav(page, "Nosotros");
  const file = {
    name: "respaldo.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      backupFile(travellersDoc("Viajera del respaldo", ["JP-203"]), draftDoc(["JP-203"], "Hotel del respaldo"))
    ),
  };
  await page.getByLabel("Elegir un archivo de respaldo").setInputFiles(file);
  await page.getByRole("button", { name: "Sustituir con este respaldo", exact: true }).click();
  await page.locator(".trip-backup__restored").waitFor();
  const imported = { travellers: await raw(page, TK), draft: await raw(page, DK) };
  evidence.h01 = { imported };

  // Sin pulsar «Continuar»: navegar y mutar.
  await nav(page, "Explorar");
  await page.waitForTimeout(300);
  await saveHeart(page, TNM);
  await page.waitForTimeout(400);
  const afterTravellers = await json(page, TK);
  const afterDraft = await json(page, DK);
  evidence.h01.after = { travellers: afterTravellers, draft: afterDraft };

  check("H01", "tras importar y navegar, los viajeros restaurados siguen en el almacenamiento",
    afterTravellers?.travellers?.[0]?.label === "Viajera del respaldo",
    afterTravellers?.travellers?.map((t) => t.label).join(","));
  check("H01", "los intereses restaurados (JP-203) se conservan y el nuevo (JP-021) se añade",
    JSON.stringify(interestIds(afterTravellers)) === JSON.stringify(["JP-021", "JP-203"]),
    interestIds(afterTravellers).join(","));
  check("H01", "el itinerario restaurado (JP-203, Hotel del respaldo) no se sobrescribe",
    afterDraft?.accommodations?.[0]?.label === "Hotel del respaldo" &&
      JSON.stringify(afterDraft?.days?.[0]?.placeIds) === JSON.stringify(["JP-203"]),
    JSON.stringify(afterDraft?.days?.[0]?.placeIds));
  await nav(page, "Viaje");
  await page.waitForTimeout(400);
  const finalDraft = await json(page, DK);
  check("H01", "volver a Viaje tampoco devuelve el itinerario anterior",
    finalDraft?.accommodations?.[0]?.label === "Hotel del respaldo" &&
      !JSON.stringify(finalDraft).includes("JP-044"),
    JSON.stringify(finalDraft?.routeIds));
  await page.reload();
  await page.waitForSelector("#root *");
  const reloaded = await json(page, TK);
  check("H01", "tras recargar sigue todo lo restaurado más el interés añadido",
    reloaded?.travellers?.[0]?.label === "Viajera del respaldo" && interestIds(reloaded).includes("JP-203") && interestIds(reloaded).includes("JP-021"));
  await context.close();
}

// ═══ H02 — escrituras obsoletas entre pestañas ═══════════════════════════════════════════════
async function h02Interests() {
  const context = await newContext();
  const a = await openPage(context);
  await waitStore(a, TK, (doc) => !!doc && doc.travellers.length === 2);
  const b = await openPage(context);
  const idsA = (await json(a, TK)).travellers.map((t) => t.id).join();
  const idsB = (await json(b, TK)).travellers.map((t) => t.id).join();
  check("H02", "fixture: ambas pestañas parten de los mismos IDs de viajeros", idsA === idsB);
  await saveHeart(a, TNM);
  await waitStore(a, TK, (doc) => doc.interests.length === 1);
  await saveHeart(b, GHIBLI); // sin recargar B
  await b.waitForTimeout(400);
  const stored = await json(a, TK);
  evidence.h02 = { stored };
  check("H02", "tras guardar un lugar en A y otro en B, el documento conserva ambos",
    JSON.stringify(interestIds(stored)) === JSON.stringify(["JP-021", "JP-044"]),
    interestIds(stored).join(","));
  await a.reload();
  await a.waitForSelector("#root *");
  await nav(a, "Quiero ir");
  await a.waitForTimeout(300);
  const text = await a.locator("body").innerText();
  check("H02", "A, recargada, muestra los dos lugares en Quiero ir", text.includes("Tokyo National Museum") && text.includes("Ghibli Museum"));
  await context.close();
}

async function h02Itinerary() {
  const seed = {
    [TK]: JSON.stringify(travellersDoc("Marta", ["JP-044"])),
    [DK]: JSON.stringify(draftDoc(["JP-044"])),
  };
  const context = await newContext(seed);
  const a = await openPage(context);
  await gotoViaje(a);
  const b = await openPage(context);
  await gotoViaje(b);
  const add = (page) => page.getByRole("button", { name: /Añadir día/ });
  await add(a).click();
  await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).days.length === 2, DK);
  await add(b).click(); // B sigue creyendo que hay 1 día
  await b.waitForTimeout(400);
  const stored = await json(a, DK);
  evidence.h02.itinerary = stored;
  check("H02", "itinerario: añadir un día en A y otro en B conserva ambos (3 días)", stored?.days?.length === 3, `días=${stored?.days?.length}`);
  check("H02", "itinerario: la parada y el hotel del documento se conservan",
    JSON.stringify(stored?.days?.[0]?.placeIds) === JSON.stringify(["JP-044"]) && stored?.accommodations?.[0]?.label === "Hotel conservado");
  await context.close();
}

// ═══ H04 — documentos inválidos o incompatibles ══════════════════════════════════════════════
async function h04Variants() {
  const variants = [];
  {
    const d = draftDoc(["JP-044"]);
    d.interHubSegments = "damaged";
    variants.push({ id: "borrador-invalido", travellers: travellersDoc("Marta", ["JP-044"]), draftRaw: JSON.stringify(d), key: DK, kind: "invalid" });
  }
  {
    const t = travellersDoc("Marta", ["JP-044"]);
    t.activeTravellerId = "missing-traveller";
    variants.push({ id: "viajeros-invalidos", travellersRaw: JSON.stringify(t), draft: draftDoc(["JP-044"]), key: TK, kind: "invalid" });
  }
  {
    const d = draftDoc(["JP-044"]);
    d.version = 9;
    variants.push({ id: "borrador-futuro", travellers: travellersDoc("Marta", ["JP-044"]), draftRaw: JSON.stringify(d), key: DK, kind: "incompatible" });
  }
  variants.push({ id: "borrador-no-json", travellers: travellersDoc("Marta", ["JP-044"]), draftRaw: "{not json", key: DK, kind: "invalid" });
  {
    const t = travellersDoc("Marta", ["JP-044"]);
    t.version = 2;
    variants.push({ id: "viajeros-futuros", travellersRaw: JSON.stringify(t), draft: draftDoc(["JP-044"]), key: TK, kind: "incompatible" });
  }

  for (const variant of variants) {
    const trRaw = variant.travellersRaw ?? JSON.stringify(variant.travellers);
    const drRaw = variant.draftRaw ?? JSON.stringify(variant.draft);
    const context = await newContext({ [TK]: trRaw, [DK]: drRaw });
    const page = await openPage(context);
    await gotoViaje(page).catch(() => {});
    // Dos «sesiones» más (recargas repetidas), tocando la app entre medias.
    for (let i = 0; i < 2; i += 1) {
      await page.reload();
      await page.waitForSelector("#root *");
      await nav(page, "Viaje");
      await page.waitForTimeout(300);
    }
    await nav(page, "Explorar");
    await page.waitForTimeout(200);
    const after = { travellers: await raw(page, TK), draft: await raw(page, DK) };
    check("H04", `${variant.id}: el documento original no se modifica tras montar y recargar`,
      after.travellers === trRaw && after.draft === drRaw,
      after.travellers === trRaw ? (after.draft === drRaw ? "iguales" : "borrador cambiado") : "viajeros cambiados");
    const notice = page.locator("[data-storage-protection]");
    check("H04", `${variant.id}: la interfaz informa del problema con una salida explícita`,
      (await notice.count()) > 0 && (await notice.first().innerText()).length > 0);
    evidence[`h04-${variant.id}`] = after;
    await context.close();
  }

  // Viajeros inválidos: el itinerario válido no se pierde ni tras interactuar con la aplicación.
  {
    const t = travellersDoc("Marta", ["JP-044"]);
    t.activeTravellerId = "missing-traveller";
    const trRaw = JSON.stringify(t);
    const drRaw = JSON.stringify(draftDoc(["JP-044"]));
    const context = await newContext({ [TK]: trRaw, [DK]: drRaw });
    const page = await openPage(context);
    await saveHeart(page, TNM).catch(() => {});
    await gotoViaje(page).catch(() => {});
    await page.waitForTimeout(500);
    check("H04", "viajeros inválidos: el itinerario válido sigue íntegro tras usar la app", (await raw(page, DK)) === drRaw);
    await context.close();
  }

  // Migración V1 válida: sigue funcionando y se persiste migrada.
  {
    const context = await newContext({
      [TK]: JSON.stringify(travellersDoc("Marta", ["JP-044"])),
      [DK]: JSON.stringify({ version: 1, routeIds: ["JP-044"], days: [["JP-044"]] }),
    });
    const page = await openPage(context);
    await gotoViaje(page);
    await page.waitForTimeout(300);
    const migrated = await json(page, DK);
    check("H04", "V1 válida: se migra y conserva la parada, sin aviso de protección",
      migrated?.version === 8 && JSON.stringify(migrated?.routeIds) === JSON.stringify(["JP-044"]) &&
        (await page.locator("[data-storage-protection]").count()) === 0,
      `v${migrated?.version}`);
    await context.close();
  }
}

async function h04Recovery() {
  // Salida explícita: descargar copia y empezar de nuevo CONSERVANDO una copia aparte.
  const d = draftDoc(["JP-044"]);
  d.interHubSegments = "damaged";
  const drRaw = JSON.stringify(d);
  const trRaw = JSON.stringify(travellersDoc("Marta", ["JP-044"]));
  const context = await newContext({ [TK]: trRaw, [DK]: drRaw }, { width: 390, height: 844 });
  const page = await openPage(context);
  const notice = page.locator("[data-storage-protection]").first();
  await notice.waitFor();
  const download = page.waitForEvent("download");
  await notice.getByRole("button", { name: /Descargar copia/ }).click();
  const dl = await download;
  const stream = await dl.createReadStream();
  let body = "";
  for await (const chunk of stream) body += chunk;
  check("H04", "«Descargar copia» entrega el contenido original sin modificar", body.includes(drRaw.slice(0, 40)) || body.includes("damaged"), dl.suggestedFilename());
  await notice.getByRole("button", { name: /Empezar de nuevo/ }).click();
  await notice.getByRole("button", { name: /Confirmar/ }).click();
  await page.waitForFunction((k) => {
    const value = localStorage.getItem(k);
    return value === null || !value.includes("damaged");
  }, DK);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("nihon.recovered.")));
  const copies = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("nihon.recovered.")).map(([, v]) => v));
  check("H04", "tras «Empezar de nuevo» el original queda guardado en una copia aparte", copies.some((c) => c.includes("damaged")), `claves=${keys.length}`);
  check("H04", "tras recuperar, el aviso desaparece y la app guarda con normalidad",
    (await page.locator("[data-storage-protection]").count()) === 0);
  await saveHeart(page, TNM);
  await page.waitForTimeout(300);
  check("H04", "tras recuperar, los cambios nuevos se persisten", interestIds(await json(page, TK)).includes("JP-021"));
  await context.close();
}

async function h04WriteFailure() {
  // La preservación y la recuperación también deben manejar fallos de escritura.
  const d = draftDoc(["JP-044"]);
  d.version = 9;
  const drRaw = JSON.stringify(d);
  const trRaw = JSON.stringify(travellersDoc("Marta", ["JP-044"]));
  const context = await newContext({ [TK]: trRaw, [DK]: drRaw });
  await context.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (typeof key === "string" && key.startsWith("nihon.") && !key.includes("onboarding") && window.__failWrites) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      return real.call(this, key, value);
    };
  });
  const page = await openPage(context);
  const notice = page.locator("[data-storage-protection]").first();
  await notice.waitFor();
  await page.evaluate(() => { window.__failWrites = true; });
  await notice.getByRole("button", { name: /Empezar de nuevo/ }).click();
  await notice.getByRole("button", { name: /Confirmar/ }).click();
  await page.waitForTimeout(400);
  check("H04", "con la escritura fallando, «Empezar de nuevo» no borra el original", (await raw(page, DK)) === drRaw && (await raw(page, TK)) === trRaw);
  check("H04", "con la escritura fallando, el aviso sigue y explica que no se cambió nada",
    (await page.locator("[data-storage-protection]").count()) > 0 && /no se (ha )?(cambiado|borrado|modificado)|sigue(n)? (intacto|conservad)/i.test(await notice.innerText()),
    (await notice.innerText()).replace(/\s+/g, " ").slice(0, 200));
  await page.evaluate(() => { window.__failWrites = false; });
  await notice.getByRole("button", { name: /Empezar de nuevo/ }).click().catch(() => {});
  await notice.getByRole("button", { name: /Confirmar/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  check("H04", "restablecida la escritura, la recuperación se completa y conserva copia",
    (await page.locator("[data-storage-protection]").count()) === 0 &&
      (await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("nihon.recovered.")))));
  await context.close();
}

// ═══ Interacciones H01 × H02 × H04 ═══════════════════════════════════════════════════════════
async function interactions() {
  // X1: importar con otra pestaña abierta; la otra pestaña no pisa lo importado.
  {
    const context = await newContext({
      [TK]: JSON.stringify(travellersDoc("Viaje anterior", ["JP-044"])),
      [DK]: JSON.stringify(draftDoc(["JP-044"])),
    });
    const a = await openPage(context);
    const b = await openPage(context);
    await gotoViaje(b);
    await nav(a, "Nosotros");
    await a.getByLabel("Elegir un archivo de respaldo").setInputFiles({
      name: "r.json", mimeType: "application/json",
      buffer: Buffer.from(backupFile(travellersDoc("Viajera del respaldo", ["JP-203"]), draftDoc(["JP-203"], "Hotel del respaldo"))),
    });
    await a.getByRole("button", { name: "Sustituir con este respaldo", exact: true }).click();
    await a.locator(".trip-backup__restored").waitFor();
    await b.waitForTimeout(300);
    await nav(b, "Explorar");
    await saveHeart(b, TNM); // B muta después de la importación hecha en A
    await b.waitForTimeout(500);
    const t = await json(a, TK);
    const dr = await json(a, DK);
    check("X1", "importar en A con B abierta: la mutación posterior de B conserva el respaldo",
      t?.travellers?.[0]?.label === "Viajera del respaldo" && interestIds(t).includes("JP-203") && interestIds(t).includes("JP-021"),
      interestIds(t).join(","));
    check("X1", "importar en A con B abierta: el itinerario restaurado sigue intacto",
      dr?.accommodations?.[0]?.label === "Hotel del respaldo" && !JSON.stringify(dr).includes("JP-044"));
    await context.close();
  }
  // X2: conflicto después de recuperar (empezar de nuevo) con otra pestaña abierta.
  {
    const d = draftDoc(["JP-044"]);
    d.version = 9;
    const context = await newContext({ [TK]: JSON.stringify(travellersDoc("Marta", [])), [DK]: JSON.stringify(d) });
    const a = await openPage(context);
    const b = await openPage(context);
    const notice = a.locator("[data-storage-protection]").first();
    await notice.waitFor();
    await notice.getByRole("button", { name: /Empezar de nuevo/ }).click();
    await notice.getByRole("button", { name: /Confirmar/ }).click();
    await a.waitForFunction((k) => { const v = localStorage.getItem(k); return v === null || JSON.parse(v).version === 8; }, DK);
    await saveHeart(a, TNM);
    await a.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).interests.some((i) => i.placeId === "JP-021"), TK);
    await saveHeart(b, GHIBLI); // B (obsoleta) guarda otro lugar
    await b.waitForTimeout(500);
    const t = await json(a, TK);
    check("X2", "conflicto tras recuperar: ambos intereses sobreviven", interestIds(t).includes("JP-021") && interestIds(t).includes("JP-044"), interestIds(t).join(","));
    check("X2", "la pestaña B también sale de la protección tras la recuperación", (await b.locator("[data-storage-protection]").count()) === 0);
    await context.close();
  }
  // X3: recarga con almacenamiento protegido: sigue protegido y no pierde nada.
  {
    const trRaw = JSON.stringify(travellersDoc("Marta", ["JP-044"]));
    const drRaw = "{\"version\": 9, \"routeIds\": []}";
    const context = await newContext({ [TK]: trRaw, [DK]: drRaw });
    const page = await openPage(context);
    await gotoViaje(page).catch(() => {});
    await saveHeart(page, TNM).catch(() => {});
    await page.reload();
    await page.waitForSelector("#root *");
    check("X3", "recarga con almacenamiento protegido: el aviso persiste y el original está intacto",
      (await page.locator("[data-storage-protection]").count()) > 0 && (await raw(page, DK)) === drRaw);
    await context.close();
  }
}

// ═══ H03 — fallo de descarga lazy ════════════════════════════════════════════════════════════
/**
 * Un servidor local que falla DE VERDAD: delante de `vite preview` hay un proxy que, mientras está «caído», no entrega los
 * módulos diferidos (corta la conexión, o responde 503) y que después vuelve a responder con normalidad. El producto no se
 * toca: sirve exactamente la build. Es el modelo fiel de «la red falló al pedir el módulo y luego volvió»; el bloqueo por
 * inspector de Playwright (`route.abort`) es sólo un diagnóstico más, porque WebKit lo retiene entre recargas de la sesión.
 */
function startFlakyProxy(targetPort) {
  const state = { failing: false, kind: "reset", pattern: /a^/, hits: 0, served: 0, documents: 0 };
  const proxy = createServer((req, res) => {
    if (req.url === "/") state.documents += 1; // peticiones de documento que LLEGAN al servidor
    if (state.failing && state.pattern.test(req.url ?? "")) {
      state.hits += 1;
      if (state.kind === "reset") req.socket.destroy();
      else {
        res.writeHead(503, { "content-type": "text/plain", "cache-control": "no-store" });
        res.end("servicio no disponible");
      }
      return;
    }
    const upstream = httpRequest({ host: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: req.headers }, (up) => {
      state.served += 1;
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  return new Promise((resolve) => proxy.listen(0, "127.0.0.1", () => resolve({
    url: `http://127.0.0.1:${proxy.address().port}`,
    state,
    close: () => new Promise((done) => { proxy.closeAllConnections?.(); proxy.close(() => done()); }),
  })));
}

/**
 * PIDs de los procesos de red de WebKit (Linux). Se usan SOLO para clasificar un fallo del motor con una prueba objetiva: si el
 * proceso de red se reemplaza durante el escenario, WebKit ha perdido su sesión de red (libsoup avisa con «SOUP_IS_SESSION_FEATURE»
 * y «internallyFailedLoadTimerFired») y las peticiones en vuelo pueden quedar sin respuesta ni error. Ver docs/final-audit-evidence/round5-h03 (retirado del árbol; en el commit 2fd30db, ver docs/PR203_EVIDENCE_INDEX.md).
 */
const networkProcessIds = () => {
  if (BROWSER !== "webkit") return [];
  try {
    return procFs.readdirSync("/proc").filter((entry) => /^\d+$/.test(entry)).flatMap((entry) => {
      try { return /NetworkProcess$/.test(procFs.readlinkSync(`/proc/${entry}/exe`).split("/").at(-1)) ? [Number(entry)] : []; } catch { return []; }
    });
  } catch { return []; }
};

const H03_SURFACES = [
  { id: "OrderedSequenceBuilder", pattern: "**/assets/OrderedSequenceBuilder-*.js", regex: /\/assets\/OrderedSequenceBuilder-[^/]*\.js/, open: async (page) => nav(page, "Viaje"), ok: (page) => page.locator(".day-card, .ordered-sequence").first() },
  { id: "ZoneComparison", pattern: "**/assets/ZoneComparison-*.js", regex: /\/assets\/ZoneComparison-[^/]*\.js/, open: async (page) => { await nav(page, "Viaje"); await page.getByRole("button", { name: "Dónde dormir", exact: true }).click(); }, ok: (page) => page.locator(".zone-panel__scroll").first() },
];

/** `strict`: un fallo hace fallar el gate. No estricto: queda como DIAG (con su resultado) y como cobertura parcial. */
const diagnostics = [];
function verdict(strict, id, label, ok, extra) {
  if (strict) return check(id, label, ok, extra);
  console.log(`${ok ? "DIAG-OK  " : "DIAG-FAIL"} [${id}] ${label}${extra !== undefined ? ` (${extra})` : ""}`);
  diagnostics.push({ id, label, ok, extra: extra ?? null });
}

/** mode: `proxy-reset` | `proxy-503` (servidor que falla de verdad) | `inspector` (route.abort de Playwright). */
async function h03Scenario(surface, width, mode, strict) {
  const tag = `${surface.id} @${width} [${mode}]`;
  const proxy = mode.startsWith("proxy") ? await startFlakyProxy(PORT) : null;
  const base = proxy ? proxy.url : BASE_URL;
  const networkBaseline = new Set(networkProcessIds());
  const context = await newContext({}, { width, height: 900 }, BROWSER === "webkit");
  // Sólo la ejecución diagnóstica añade llamadas a sessionStorage para registrar la traza.
  // La matriz ordinaria conserva las llamadas nativas originales: instrumentar puede alterar
  // el tiempo de una carrera aunque devuelva exactamente los mismos valores.
  if (NATIVE_TRACE) await context.addInitScript(({ key }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    const record = (kind, value) => {
      try {
        const entries = JSON.parse(get.call(sessionStorage, "__h03_native_trace") || "[]");
        entries.push({ kind, at: Date.now(), value });
        set.call(sessionStorage, "__h03_native_trace", JSON.stringify(entries.slice(-100)));
      } catch { /* el diagnóstico no modifica la operación */ }
    };
    Storage.prototype.getItem = function(k) { const value = get.call(this, k); if (this === localStorage && k === key) record("get", value); return value; };
    Storage.prototype.setItem = function(k, value) { const result = set.call(this, k, value); if (this === localStorage && k === key) record("set", value); return result; };
  }, { key: TK });
  let blocked = true;
  if (proxy) {
    proxy.state.failing = true;
    proxy.state.kind = mode === "proxy-503" ? "503" : "reset";
    proxy.state.pattern = surface.regex;
  } else {
    await context.route(surface.pattern, (route) => (blocked ? route.abort("failed") : route.continue()));
  }
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.errors = [];
  page.failedRequests = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  page.on("requestfailed", (request) => page.failedRequests.push(`${request.url().split("/").pop()} ${request.failure()?.errorText ?? ""}`));
  await page.goto(base);
  await page.waitForSelector("#root *");
  const networkStart = networkProcessIds().filter((pid) => !networkBaseline.has(pid));
  const networkReplaced = () => networkStart.length > 0 && networkProcessIds().filter((pid) => !networkBaseline.has(pid)).some((pid) => !networkStart.includes(pid));
  await saveHeart(page, GHIBLI);
  await waitStore(page, TK, (doc) => doc.interests.length === 1);
  const before = await raw(page, TK);
  await surface.open(page);
  await page.waitForTimeout(700);
  const rootHtml = await page.evaluate(() => document.getElementById("root").innerHTML.length);
  const alert = page.locator("[data-lazy-failure]");
  const visible = (await alert.count()) > 0 && (await alert.first().isVisible());
  // Un reemplazo del proceso correlaciona con importaciones perdidas, pero no acredita causalidad ni recuperación.
  // Se conserva como evidencia; no exime del contrato del producto ni transforma una salida ausente en éxito.
  const engineLostImport = !visible && Boolean(proxy) && networkReplaced();
  if (engineLostImport) {
    evidence.h03EngineFaults ??= [];
    evidence.h03EngineFaults.push({ tag, kind: "importación en vuelo perdida", rejected: proxy.state.hits, networkProcessesAtStart: networkStart, networkProcessesNow: networkProcessIds().filter((pid) => !networkBaseline.has(pid)) });
  }
  if (proxy) verdict(strict, "H03", `${tag}: el servidor realmente falló al servir el módulo`, proxy.state.hits > 0, `peticiones rechazadas=${proxy.state.hits}`);
  verdict(strict, "H03", `${tag}: el fallo no deja la aplicación en blanco`, rootHtml > 500);
  verdict(strict, "H03", `${tag}: aparece un mensaje de recuperación visible`, visible, engineLostImport ? "proceso de red reemplazado; causa de la importación pendiente no certificada" : undefined);
  verdict(strict, "H03", `${tag}: la navegación sigue utilizable`, await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Explorar" }).isVisible());
  verdict(strict, "H03", `${tag}: los datos guardados no cambian`, (await raw(page, TK)) === before);
  if (!visible) {
    verdict(strict, "H03", `${tag}: recuperación tras restablecer la red`, false, "sin aviso no hay recuperación");
    await context.close();
    if (proxy) await proxy.close();
    return;
  }
  // El servidor vuelve a responder.
  blocked = false;
  if (proxy) proxy.state.failing = false;
  // La recarga es asíncrona (más en WebKit): se espera a que la página ANTERIOR desaparezca de verdad.
  await page.evaluate(() => { window.__beforeReload = true; });
  await pressOfferedReload({
    page, alert, proxy, tag, networkReplaced,
    report: (detail) => {
      (evidence.h03EngineFaults ??= []).push({ tag, kind: "recarga perdida", detail });
      verdict(false, "H03", `${tag}: WebKit no envió la recarga ofrecida (${detail}); se pulsa de nuevo`, false);
    },
  });
  await page.waitForSelector("#root *");
  await surface.open(page);
  let recovered = true;
  try { await surface.ok(page).waitFor({ timeout: 8000 }); } catch { recovered = false; }
  // Criterio ESTRICTO: la misma sesión, tras la salida que ofrece el aviso. Nada de «en otra sesión sí».
  verdict(strict, "H03", `${tag}: al volver el servidor, la salida ofrecida («Recargar») recupera la sección en la MISMA sesión`, recovered, proxy ? `sirvió ${proxy.state.served} peticiones tras el fallo` : undefined);
  const afterReload = await raw(page, TK);
  let afterDocument = null;
  try { afterDocument = afterReload === null ? null : JSON.parse(afterReload); } catch { /* fallo estricto */ }
  // Una sola lectura, igual que el gate original. Otra lectura previa podría refrescar la caché.
  const survives = interestIds(afterDocument).includes("JP-044");
  verdict(strict, "H03", `${tag}: el interés guardado sobrevive a la recarga`, survives);
  evidence.h03Snapshots ??= [];
  evidence.h03Snapshots.push({ tag, before, after: afterReload, survives, nativeTrace: NATIVE_TRACE });
  if (!survives) {
    // Diagnóstico (no cambia el veredicto): ¿lectura obsoleta del motor o pérdida real? Se relee tras una espera y se
    // describen todas las claves `nihon.*` y la traza de escrituras de esta pestaña.
    await page.waitForTimeout(1000);
    const later = await raw(page, TK);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("nihon.")).map((k) => `${k}:${localStorage.getItem(k)?.length}`));
    const pendingCopies = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith("nihon.pending.v1."))));
    const info = { tag, firstRead: afterReload, readAfter1s: later, survivesAfter1s: interestIds(await json(page, TK)).includes("JP-044"), keys, before, pendingCopies };
    console.log(`DIAG [H03] ${tag}: el interés NO está tras la recarga ${JSON.stringify(info)}`);
    evidence[`h03-interest-loss-${tag}`] = info;
  }
  if (NATIVE_TRACE) {
    evidence.h03Native ??= [];
    await page.waitForTimeout(250); // Sólo diagnóstico, DESPUÉS de todas las aserciones.
    evidence.h03Native.push({ tag, before, after: afterReload, after250ms: await raw(page, TK), trace: await page.evaluate(() => JSON.parse(sessionStorage.getItem("__h03_native_trace") || "[]")) });
  }
  if (!recovered) {
    // Sólo diagnóstico (no cambia el veredicto): ¿qué otras vías recuperan? Una sesión nueva que recupera NO convierte el fallo en éxito.
    const works = async (target) => {
      try { await surface.open(target); await surface.ok(target).waitFor({ timeout: 6000 }); return true; } catch { return false; }
    };
    const alternatives = {};
    await page.reload(); await page.waitForSelector("#root *");
    alternatives.secondReload = await works(page);
    // Más vías, sólo diagnóstico (¿qué haría falta para que la MISMA sesión recupere?):
    await page.goto(`${base}/?retry=${Date.now()}`); await page.waitForSelector("#root *");
    alternatives.newUrlNavigation = await works(page);
    await page.waitForTimeout(6000);
    await page.goto(base); await page.waitForSelector("#root *");
    alternatives.afterWait6sThenNavigate = await works(page);
    const chunkName = page.failedRequests.map((entry) => entry.split(" ")[0]).find((name) => name.endsWith(".js"));
    if (chunkName) {
      const probe = await page.evaluate((url) => fetch(url, { cache: "reload" }).then((r) => r.status).catch((e) => `fetch: ${e.message}`), `${base}/assets/${chunkName}`);
      alternatives.chunkFetchCacheReload = probe;
      await page.reload(); await page.waitForSelector("#root *");
      alternatives.reloadAfterChunkFetch = await works(page);
    }
    const fresh = await browser.newContext({ viewport: { width, height: 900 }, storageState: await context.storageState() });
    const freshPage = await fresh.newPage();
    await freshPage.goto(base); await freshPage.waitForSelector("#root *");
    alternatives.freshContext = await works(freshPage);
    await fresh.close();
    console.log(`DIAG [H03] ${tag}: no recupera en la misma sesión; alternativas=${JSON.stringify(alternatives)} errores=${JSON.stringify(page.errors.slice(-2))} fallos=${JSON.stringify(page.failedRequests.slice(-3))}`);
    evidence[`h03-${surface.id}-${width}-${mode}`] = { alternatives };
  }
  await context.close();
  if (proxy) await proxy.close();
}

async function h03() {
  for (const surface of H03_SURFACES) {
    for (const width of [390, 1440]) {
      // El servidor local que falla de verdad es el criterio, en los dos motores.
      await h03Scenario(surface, width, "proxy-reset", true);
    }
  }
  await h03Scenario(H03_SURFACES[0], 390, "proxy-503", true);
  // El bloqueo por inspector de Playwright: estricto en Chromium; en WebKit es sólo diagnóstico (el motor lo retiene entre
  // recargas de la sesión: no es un fallo de red real), y si falla ahí se declara cobertura parcial, no se da por bueno.
  for (const surface of H03_SURFACES) {
    for (const width of [390, 1440]) await h03Scenario(surface, width, "inspector", BROWSER !== "webkit");
  }
}

const steps = [
  ["H01", h01],
  ["H02a", h02Interests],
  ["H02b", h02Itinerary],
  ["H04a", h04Variants],
  ["H04b", h04Recovery],
  ["H04c", h04WriteFailure],
  ["X", interactions],
  ["H03", h03],
];
const only = process.env.NIHON_ONLY?.split(",") ?? null;
for (const [id, fn] of steps) if (!only || only.includes(id)) await guarded(id, id, fn);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
const diagFailed = diagnostics.filter((d) => !d.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK (${BROWSER})` + (diagFailed.length > 0 ? ` — COBERTURA PARCIAL: ${diagFailed.length} diagnóstico(s) no concluyente(s) (H03 por inspector en ${BROWSER}); la validación H03 descansa en el servidor local que falla de verdad` : ""));
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/final-audit-data-recovery-${BROWSER}.json`, JSON.stringify({ browser: BROWSER, results, diagnostics, evidence }, null, 2));
}
process.exit(failed.length === 0 ? 0 : 1);
