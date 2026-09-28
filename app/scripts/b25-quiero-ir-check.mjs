import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B25 — B7 «Quiero ir» (`docs/BLOCK_25_MISSION.md`, `05 §6`, `10 §B7`).
 * Comportamiento real en Chromium sobre la build de producción (`npm run build` antes):
 *
 *   S  estructura: cabecera + contador, titular no es duración, ningún «analizar»/«selección»,
 *      resumen de tres datos del mismo tamaño con EvidenceMark ◇, coincidencias primero y sin clic.
 *   D  divergencias: cada sección contiene exactamente lo que el documento dice (cálculo
 *      independiente en este script), agrupación por ciudad, Descartados plegado.
 *   G  segmentado: filtra y NO cambia la persona activa ni el documento guardado; teclado.
 *   I  selecciones independientes: el corazón de la persona activa no toca la postura de la otra.
 *   R  quitar + Toast + «Deshacer» (puntero y teclado), restauración exacta del documento.
 *   E  estados vacíos: vacío completo (+ «Explorar Tokio») y «sólo una persona ha marcado».
 *   V  «Llevar al viaje» lleva a Viaje sin tocar las preferencias.
 *   P  ficha desde Quiero ir: no cambia de destino, una sola ficha, cierre y browser back
 *      conservan lente, secciones y scroll.
 *   L  responsive 320/360/390/430/768/1440: sin overflow horizontal, CTA visible y sin tapar el
 *      último elemento, objetivos ≥44 px.
 *   C  sin errores de consola ni respuestas 4xx/5xx propias.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/b25-quiero-ir-check.mjs`
 * Capturas opcionales: `NIHON_B25_SHOTS=<dir>`.
 */

const APP = fileURLToPath(new URL("..", import.meta.url));
const executablePath = process.env.NIHON_CHROMIUM_PATH;
const SHOTS = process.env.NIHON_B25_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const TAP_MIN = 44;
const KEY = "nihon.travellers.v1";

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((place) => place.hub === hub).map((place) => place.id);
const [T1, T2, T3, T4, T5] = byHub("Tokio");
const [K1, K2, K3] = byHub("Kioto");
const [O1, O2] = byHub("Osaka");
const LONGEST = places.reduce((a, b) => (b.name.length > a.name.length ? b : a)).id;

// Nombres reales configurables — nunca «Ana»/«Luis» en la app; aquí, datos de prueba.
const A = { id: "trv-a", label: "Marta" };
const B = { id: "trv-b", label: "Kenji Watanabe-Oyarzábal" };
const yes = (id) => ({ travellerId: id, stance: "interested" });
const no = (id) => ({ travellerId: id, stance: "not-interested" });
const rec = (placeId, ...stances) => ({ placeId, stances, carriedOver: false });

function richDocument() {
  return {
    version: 1,
    travellers: [A, B],
    activeTravellerId: A.id,
    interests: [
      rec(T1, yes(A.id), yes(B.id)),
      rec(K1, yes(A.id), yes(B.id)),
      rec(LONGEST, yes(A.id), yes(B.id)),
      rec(T2, yes(A.id)),
      rec(K2, yes(A.id)),
      rec(O1, yes(A.id)),
      rec(T3, yes(B.id)),
      rec(K3, yes(B.id)),
      rec(T4, yes(A.id), no(B.id)),
      rec(O2, no(A.id), no(B.id)),
      rec(T5, no(B.id)),
    ],
  };
}

/** Cálculo independiente de lo que cada sección debe contener (reglas de Bloques 5/6). */
function expected(doc) {
  const out = { agreed: [], only: { [A.id]: [], [B.id]: [] }, differing: [], declined: [], total: 0 };
  for (const entry of doc.interests) {
    const want = entry.stances.filter((s) => s.stance === "interested").map((s) => s.travellerId);
    const nope = entry.stances.filter((s) => s.stance === "not-interested").map((s) => s.travellerId);
    if (want.length === 0) {
      if (nope.length > 0) out.declined.push(entry.placeId);
      continue;
    }
    out.total += 1;
    if (nope.length > 0) out.differing.push(entry.placeId);
    else if (want.length === doc.travellers.length) out.agreed.push(entry.placeId);
    else out.only[want[0]].push(entry.placeId);
  }
  return out;
}

const results = [];
function check(id, ok, message) {
  results.push({ id, ok: Boolean(ok) });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${message}`);
  return Boolean(ok);
}

async function newPage(browser, viewport, doc) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 840 });
  await context.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("b25.seeded")) return;
      sessionStorage.setItem("b25.seeded", "1");
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (value) localStorage.setItem(key, value);
    },
    [KEY, doc ? JSON.stringify(doc) : null]
  );
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl)) {
      problems.push(`http ${response.status()} ${response.url()}`);
    }
  });
  return { context, page, problems };
}

const panel = (page) => page.locator('.destination-panel:not([hidden]) .quiero-ir');
const storedDoc = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), KEY);

async function openQuieroIr(page) {
  await page.goto(baseUrl, { waitUntil: "load" });
  const nav = page.locator(".tab-bar:visible, .nav-rail:visible").first();
  await nav.getByRole("button", { name: /Quiero ir/ }).click();
  await panel(page).waitFor();
}

async function sectionIds(page, title) {
  const section = panel(page).locator(".quiero-ir__section").filter({
    has: page.locator(".quiero-ir__section-title", { hasText: title }),
  });
  if ((await section.count()) === 0) return null;
  return section.first().locator("[data-quiero-ir-place]").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-quiero-ir-place"))
  );
}

const sameSet = (a, b) => a && b && a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ---- S, D, G, I, R, V, P en un viewport ---------------------------------------------------
async function auditBehaviour(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const doc = richDocument();
  const want = expected(doc);
  const { context, page, problems } = await newPage(browser, viewport, doc);
  try {
    await openQuieroIr(page);
    const root = panel(page);

    // S — estructura
    const title = (await page.locator(".app__header h1").innerText()).replace(/\s+/g, " ").trim();
    check("S-HEAD", title.startsWith("Quiero ir") && title.includes(String(want.total)), `${tag}: cabecera «${title}» con contador ${want.total}`);
    check("S-NODUR", !/\d\s*(h|min)\b|día/.test(title), `${tag}: el titular no es una duración`);
    const text = await root.innerText();
    check("S-COPY", !/analiz/i.test(text) && !/selecci[oó]n/i.test(text), `${tag}: ningún texto dice «analizar» ni «selección»`);
    const facts = await root.locator(".quiero-ir__fact-value").evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).fontSize))
    );
    check("S-FACTS", facts.length === 3 && new Set(facts).size === 1, `${tag}: resumen de tres datos del mismo tamaño (${facts.join("/")})`);
    const factText = (await root.locator(".quiero-ir__facts").innerText()).replace(/\s+/g, " ");
    check("S-FACTS", factText.includes(`${want.total} lugares`) && /ciudad/.test(factText), `${tag}: «${factText}»`);
    check("S-EVIDENCE", (await root.locator(".quiero-ir__facts .evidence-mark[aria-label*='Estimado']").count()) === 1 &&
      (await root.locator(".quiero-ir__note").innerText()).includes("Sólo tiempo dentro de cada lugar"), `${tag}: EvidenceMark ◇ y nota «Sólo tiempo dentro de cada lugar»`);
    const order = await root.evaluate((el) => {
      const summary = el.querySelector(".quiero-ir__summary");
      const agreed = el.querySelector(".quiero-ir__agreed");
      const next = summary?.nextElementSibling;
      return { direct: next === agreed, agreedFirstSection: el.querySelector(".quiero-ir__section") === agreed };
    });
    check("S-FIRST", order.direct && order.agreedFirstSection, `${tag}: «Los dos queréis ir» va justo después del resumen`);
    const agreed = await sectionIds(page, "Los dos queréis ir");
    check("S-FIRST", sameSet(agreed, want.agreed) && (await root.locator(".quiero-ir__agreed [data-quiero-ir-place]").first().isVisible()),
      `${tag}: coincidencias visibles sin clic (${agreed?.length})`);
    check("S-COMPACT", (await root.locator(".quiero-ir__agreed .place-card--compact").count()) === want.agreed.length, `${tag}: coincidencias en PlaceCard compact`);

    // D — divergencias y descartados
    const onlyA = await sectionIds(page, `Sólo ${A.label}`);
    const onlyB = await sectionIds(page, `Sólo ${B.label}`);
    const differing = await sectionIds(page, "Opiniones distintas");
    check("D-ONLY", sameSet(onlyA, want.only[A.id]), `${tag}: «Sólo ${A.label}» = ${want.only[A.id].length}`);
    check("D-ONLY", sameSet(onlyB, want.only[B.id]), `${tag}: «Sólo ${B.label}» = ${want.only[B.id].length}`);
    check("D-DIFF", sameSet(differing, want.differing), `${tag}: «Opiniones distintas» separada de «sólo una persona»`);
    const declinedToggle = root.locator(".quiero-ir__section-toggle", { hasText: "Descartados" });
    check("D-DECL", (await declinedToggle.getAttribute("aria-expanded")) === "false", `${tag}: Descartados plegado por defecto`);
    await declinedToggle.click();
    check("D-DECL", sameSet(await sectionIds(page, "Descartados"), want.declined), `${tag}: Descartados = lo marcado «no me interesa» por todos`);
    await declinedToggle.click();
    const cities = await root.locator(".quiero-ir__section--a .quiero-ir__city-name").allInnerTexts();
    check("D-CITY", cities.length >= 2, `${tag}: agrupación secundaria por ciudad (${cities.join(" · ")})`);
    const tokensHaveText = await root.locator(".quiero-ir__section .person-token").evaluateAll((els) =>
      els.every((el) => (el.getAttribute("aria-label") ?? "").length > 0)
    );
    check("D-COLOR", tokensHaveText, `${tag}: cada sección de persona lleva token con nombre accesible (no sólo color)`);

    // G — segmentado
    const radios = root.getByRole("radio");
    check("G-ROLE", (await radios.count()) === 3 && (await root.getByRole("radiogroup").count()) === 1, `${tag}: segmentado como radiogroup de 3`);
    const before = JSON.stringify(await storedDoc(page));
    const headerToken = await page.locator(".app__header .person-token, header .person-token").first().getAttribute("aria-label").catch(() => null);
    await radios.nth(2).click();
    check("G-FILTER", (await radios.nth(2).getAttribute("aria-checked")) === "true" &&
      (await sectionIds(page, `Sólo ${A.label}`)) === null && sameSet(await sectionIds(page, `Sólo ${B.label}`), want.only[B.id]),
      `${tag}: lente «${B.label}» muestra sólo lo suyo`);
    check("G-IDENTITY", JSON.stringify(await storedDoc(page)) === before, `${tag}: el segmentado no cambia el documento ni la persona activa`);
    const headerAfter = await page.locator(".app__header .person-token, header .person-token").first().getAttribute("aria-label").catch(() => null);
    check("G-IDENTITY", headerToken === headerAfter, `${tag}: el token de identidad de la cabecera no cambia (${headerAfter})`);
    await radios.nth(2).focus();
    await page.keyboard.press("ArrowRight");
    check("G-KEY", (await radios.nth(0).getAttribute("aria-checked")) === "true" &&
      (await page.evaluate(() => document.activeElement?.getAttribute("role"))) === "radio", `${tag}: flechas mueven la lente y el foco`);

    // I — independencia: la persona activa (A) marca algo que sólo quería B
    const bOnly = want.only[B.id][0];
    await root.locator(`[data-quiero-ir-place="${bOnly}"] .place-card__save`).click();
    const afterHeart = await storedDoc(page);
    const record = afterHeart.interests.find((entry) => entry.placeId === bOnly);
    check("I-INDEP", record.stances.some((s) => s.travellerId === B.id && s.stance === "interested") &&
      record.stances.some((s) => s.travellerId === A.id && s.stance === "interested"), `${tag}: el corazón añade la postura de ${A.label} sin tocar la de ${B.label}`);
    check("I-INDEP", (await sectionIds(page, "Los dos queréis ir")).includes(bOnly), `${tag}: el lugar pasa a «Los dos queréis ir»`);

    // R — quitar + Toast + Deshacer (puntero)
    const snapshotBefore = JSON.stringify(await storedDoc(page));
    const target = want.agreed[0];
    await root.locator(`[data-quiero-ir-place="${target}"] .place-card__save`).click();
    const toast = page.locator(".save-toast--action");
    await toast.waitFor();
    check("R-TOAST", (await toast.innerText()).includes("ya no está en Quiero ir") &&
      (await page.locator(".save-toast-region").getAttribute("aria-live")) === "polite", `${tag}: Toast en región viva`);
    check("R-MOVE", (await sectionIds(page, `Sólo ${B.label}`)).includes(target), `${tag}: quitar retira sólo la postura de ${A.label} (sigue en «Sólo ${B.label}»)`);
    check("R-FOCUS", (await page.evaluate(() => document.activeElement?.textContent)) === "Deshacer", `${tag}: el foco va a «Deshacer»`);
    await page.waitForTimeout(3000);
    check("R-HOLD", await toast.isVisible(), `${tag}: el toast con acción sigue mientras tiene el foco`);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await page.waitForTimeout(150);
    check("R-UNDO", JSON.stringify(await storedDoc(page)) === snapshotBefore, `${tag}: «Deshacer» restaura el documento exacto`);
    check("R-UNDO", (await sectionIds(page, "Los dos queréis ir")).includes(target), `${tag}: el lugar vuelve a coincidencias`);
    check("R-UNDO", (await page.evaluate(() => document.activeElement?.closest("[data-quiero-ir-place]")?.getAttribute("data-quiero-ir-place"))) === target,
      `${tag}: el foco vuelve al corazón del lugar restaurado`);

    // R — teclado
    await root.locator(`[data-quiero-ir-place="${want.only[A.id][0]}"] .place-card__save`).focus();
    await page.keyboard.press("Enter");
    await toast.waitFor();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    check("R-KEY", JSON.stringify(await storedDoc(page)) === snapshotBefore, `${tag}: quitar y deshacer sólo con teclado`);

    // P — ficha desde Quiero ir, cierre, back, scroll, lente, secciones
    await radios.nth(1).click();
    await radios.nth(0).click();
    const scroller = page.locator('.destination-panel:not([hidden]) > .destination-panel--scroll');
    const bToggle = root.locator(".quiero-ir__section-toggle", { hasText: `Sólo ${B.label}` });
    await bToggle.click();
    const opener = root.locator(`[data-quiero-ir-place="${want.only[A.id][0]}"] .place-card__open`);
    await opener.scrollIntoViewIfNeeded();
    // El scroll que cuenta es el que tenía la lista en el momento de tocar la tarjeta.
    const scrollBefore = await scroller.evaluate((el) => el.scrollTop);
    await opener.click();
    await page.locator(".app__detail .place-detail").waitFor();
    const activeTab = await page.locator(".tab-bar__item--active, .nav-rail__item--active").first().innerText();
    check("P-OWNER", /Quiero ir/.test(activeTab), `${tag}: la ficha se abre sin salir de Quiero ir`);
    check("P-SINGLE", (await page.locator(".app__detail").count()) === 1, `${tag}: una sola ficha montada`);
    await page.locator(".app__detail .place-detail__back").click();
    await page.locator(".app__detail").waitFor({ state: "detached" }).catch(() => {});
    check("P-CLOSE", (await page.locator(".app__detail").count()) === 0, `${tag}: la ficha se cierra`);
    check("P-KEEP", Math.abs((await scroller.evaluate((el) => el.scrollTop)) - scrollBefore) <= 2 &&
      (await bToggle.getAttribute("aria-expanded")) === "false", `${tag}: al cerrar, scroll (${scrollBefore}→${await scroller.evaluate((el) => el.scrollTop)}) y secciones plegadas (${await bToggle.getAttribute("aria-expanded")}) se conservan`);
    await radios.nth(1).click();
    await root.locator(`[data-quiero-ir-place="${want.only[A.id][0]}"] .place-card__open`).click();
    await page.locator(".app__detail .place-detail").waitFor();
    await page.goBack();
    await page.waitForTimeout(300);
    check("P-BACK", (await page.locator(".app__detail").count()) === 0 && (await panel(page).isVisible()) &&
      (await radios.nth(1).getAttribute("aria-checked")) === "true", `${tag}: browser back cierra la ficha y vuelve a Quiero ir con la misma lente`);
    await radios.nth(0).click();
    await bToggle.click();

    // V — Llevar al viaje
    const cta = root.locator(".quiero-ir__cta .button--primary.button--lg");
    check("V-CTA", (await cta.innerText()).trim() === "Llevar al viaje" && (await cta.locator("svg").count()) === 0, `${tag}: «Llevar al viaje» primary lg sin flecha`);
    const docBeforeTrip = JSON.stringify(await storedDoc(page));
    await cta.click();
    await page.waitForTimeout(300);
    const tabNow = await page.locator(".tab-bar__item--active, .nav-rail__item--active").first().innerText();
    check("V-TRIP", /Viaje/.test(tabNow), `${tag}: lleva a Viaje`);
    check("V-TRIP", JSON.stringify(await storedDoc(page)) === docBeforeTrip, `${tag}: no toca las preferencias`);

    check("C-CLEAN", problems.length === 0, `${tag}: sin errores de consola ni HTTP propios${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// ---- E — estados vacíos ---------------------------------------------------------------------
async function auditEmpty(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  {
    const { context, page, problems } = await newPage(browser, viewport, null);
    try {
      await openQuieroIr(page);
      const root = panel(page);
      const text = await root.innerText();
      check("E-EMPTY", text.includes("Todavía no habéis marcado nada.") && text.includes("guardad de más, que luego se recorta"), `${tag}: vacío completo con el texto de 05 §6`);
      check("E-EMPTY", (await root.locator(".quiero-ir__cta").count()) === 0 && (await root.getByRole("radiogroup").count()) === 0, `${tag}: sin segmentado ni CTA en vacío`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/empty-${tag}.png` });
      await root.getByRole("button", { name: "Explorar Tokio" }).click();
      await page.locator(".app__sidebar .place-card").first().waitFor();
      const tab = await page.locator(".tab-bar__item--active, .nav-rail__item--active").first().innerText();
      check("E-EMPTY", /Explorar/.test(tab), `${tag}: «Explorar Tokio» lleva a Explorar › Tokio`);
      check("C-CLEAN", problems.length === 0, `${tag}: vacío sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
    } finally {
      await context.close();
    }
  }
  {
    const doc = { version: 1, travellers: [A, B], activeTravellerId: A.id, interests: [rec(T1, yes(A.id)), rec(K1, yes(A.id))] };
    const { context, page } = await newPage(browser, viewport, doc);
    try {
      await openQuieroIr(page);
      const root = panel(page);
      check("E-ONE", (await root.locator(".quiero-ir__pending").innerText()).includes(`Cuando ${B.label} marque sus sitios, aquí veréis en qué coincidís.`),
        `${tag}: sólo una persona ha marcado → línea contextual con el nombre real`);
      check("E-ONE", (await root.locator(".quiero-ir__agreed").count()) === 0, `${tag}: «Los dos» no se muestra vacía`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/one-person-${tag}.png`, fullPage: true });
    } finally {
      await context.close();
    }
  }
}

// ---- L — responsive -------------------------------------------------------------------------
async function auditLayout(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page, problems } = await newPage(browser, viewport, richDocument());
  try {
    await openQuieroIr(page);
    const root = panel(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/first-${tag}.png` });
    await root.locator(".quiero-ir__section-toggle", { hasText: "Descartados" }).click();
    await root.locator(".quiero-ir__section-toggle", { hasText: "Por ciudad y zona" }).click();
    const overflow = await page.evaluate(() => {
      const doc = document.scrollingElement;
      const offenders = [...document.querySelectorAll(".quiero-ir *")]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && el.getClientRects().length > 0)
        .slice(0, 3)
        .map((el) => el.className?.baseVal ?? el.className);
      return { page: doc.scrollWidth - innerWidth, offenders };
    });
    check("L-OVERFLOW", overflow.page <= 0 && overflow.offenders.length === 0, `${tag}: sin overflow horizontal ${overflow.offenders.join(", ")}`);
    const small = await root.evaluate((el, min) =>
      [...el.querySelectorAll(".quiero-ir__segment, .quiero-ir__section-toggle, .quiero-ir__cta button, .analysis-hub__toggle")]
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => node.getBoundingClientRect())
        .filter((r) => r.height < min - 0.5).length, TAP_MIN);
    check("L-TAP", small === 0, `${tag}: segmentado, plegables y CTA ≥${TAP_MIN} px (${small} por debajo)`);
    const scroller = page.locator('.destination-panel:not([hidden]) > .destination-panel--scroll');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/open-${tag}.png` });
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(100);
    const cover = await page.evaluate(() => {
      const cta = document.querySelector(".destination-panel:not([hidden]) .quiero-ir__cta");
      const rows = [...document.querySelectorAll(".destination-panel:not([hidden]) .quiero-ir [data-quiero-ir-place]")].filter((r) => r.getClientRects().length);
      const last = rows[rows.length - 1];
      const c = cta.getBoundingClientRect();
      const l = last.getBoundingClientRect();
      return { ctaInView: c.bottom <= innerHeight + 0.5 && c.top >= 0, lastClear: l.bottom <= c.top + 0.5 };
    });
    check("L-CTA", cover.ctaInView, `${tag}: CTA anclado dentro de la pantalla`);
    check("L-CTA", cover.lastClear, `${tag}: el último lugar no queda debajo del CTA al final del scroll`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bottom-${tag}.png` });
    if (viewport.width >= 840) {
      const width = await root.evaluate((el) => el.getBoundingClientRect().width);
      check("L-COLUMN", width <= 640.5, `${tag}: columna de lectura acotada (${Math.round(width)} px)`);
    }
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const baseUrl = server.resolvedUrls?.local[0];
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await auditBehaviour(browser, viewport);
    await auditEmpty(browser, viewport);
  }
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await auditLayout(browser, viewport);
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nB25 Quiero ir: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length === 0 ? 0 : 1);
