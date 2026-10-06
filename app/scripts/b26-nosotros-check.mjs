import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B26 — B8 «Nosotros» (`docs/BLOCK_26_MISSION.md`, `05 §11`, `05 §1`, `10 §B8`).
 * Comportamiento real sobre la build de producción (`npm run build` antes):
 *
 *   N  estructura y navegación: cinco secciones en orden, headings, viajeros, token de cabecera
 *      (lleva y enfoca Viajeros), sin «Eres» ni conmutador en la cabecera.
 *   I  identidad: cambiar persona activa desde Nosotros; el token cambia; los corazones nuevos son
 *      de la nueva persona; las preferencias no se tocan; renombrar; reiniciar/quitar con
 *      confirmación y foco; añadir respetando MAX_TRAVELLERS.
 *   B  copia del viaje: exportar (archivo real descargado), importar exige confirmación ANTES de
 *      escribir, cancelar/Escape no cambian nada, JSON inválido no cambia nada, confirmar
 *      REEMPLAZA (no fusiona), fallo de persistencia → nada engañoso, sin red.
 *   O  onboarding: primera ejecución (foto real, defaults, «Saltar» = no escribe), reapertura desde
 *      Nosotros (nombres y persona activa existentes, cerrar no destruye, «Entrar» escribe en el
 *      mismo almacén), Escape/×/Saltar marcan visto.
 *   F  fuentes y licencias: MLIT íntegro, licencias fotográficas con enlaces, fuentes con fecha de
 *      consulta, versión igual a package.json.
 *   L  responsive 320/360/390/430/768/1440: sin overflow horizontal (con nombres largos), scroll
 *      completo, nada tapado por TabBar, objetivos ≥44 px, NavRail desde md.
 *   K  teclado y nombres accesibles.
 *   C  sin errores de consola ni respuestas 4xx/5xx propias.
 *
 * Motor: Chromium por defecto. `NIHON_BROWSER=webkit` ejecuta el MISMO gate en WebKit (Playwright),
 * con `NIHON_WEBKIT_PATH` opcional. Esto NO es una prueba en un iPhone real.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome node scripts/b26-nosotros-check.mjs`
 * Capturas opcionales: `NIHON_B26_SHOTS=<dir>`.
 */

const APP = fileURLToPath(new URL("..", import.meta.url));
const ENGINE = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const executablePath =
  ENGINE === "webkit" ? process.env.NIHON_WEBKIT_PATH : process.env.NIHON_CHROMIUM_PATH;
const SHOTS = process.env.NIHON_B26_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const TAP_MIN = 44;
const KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";
const SEEN_KEY = "nihon.onboarding.seen.v1";
const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((place) => place.hub === hub).map((place) => place.id);
const [T1, T2, T3] = byHub("Tokio");
const [K1, K2] = byHub("Kioto");
const [O1] = byHub("Osaka");

const LONG = "Alejandro Sebastián de la Concepción Fernández-Villanueva y Ordóñez de Montalbán";
const A = { id: "trv-a", label: "Marta" };
const B = { id: "trv-b", label: "Kenji" };
const yes = (id) => ({ travellerId: id, stance: "interested" });
const no = (id) => ({ travellerId: id, stance: "not-interested" });
const rec = (placeId, ...stances) => ({ placeId, stances, carriedOver: false });

function doc({ a = A, b = B, active = a.id, interests } = {}) {
  return {
    version: 1,
    travellers: [a, b],
    activeTravellerId: active,
    interests: interests ?? [
      rec(T1, yes(a.id), yes(b.id)),
      rec(T2, yes(a.id)),
      rec(K1, yes(b.id)),
      rec(O1, no(a.id), yes(b.id)),
    ],
  };
}

const results = [];
function check(id, ok, message) {
  results.push({ id, ok: Boolean(ok) });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${message}`);
  return Boolean(ok);
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

async function newPage(browser, viewport, { seed = null, seen = true, reducedMotion = false, acceptDownloads = true } = {}) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width < 840,
    acceptDownloads,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await context.addInitScript(
    ([key, value, seenKey, seenValue]) => {
      if (sessionStorage.getItem("b26.seeded")) return;
      sessionStorage.setItem("b26.seeded", "1");
      if (seenValue) localStorage.setItem(seenKey, "1");
      if (value) localStorage.setItem(key, value);
    },
    [KEY, seed ? JSON.stringify(seed) : null, SEEN_KEY, seen]
  );
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const problems = [];
  const external = [];
  page.on("console", (msg) => {
    // «Failed to load resource» no trae la URL: los fallos propios los recogen `response` (4xx/5xx)
    // y `requestfailed` (más abajo); un fallo de red de un recurso EXTERNO (teselas del mapa en un
    // entorno sin salida) no es atribuible a Nosotros.
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) problems.push(`console: ${msg.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(baseUrl)) problems.push(`requestfailed ${request.url()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl)) {
      problems.push(`http ${response.status()} ${response.url()}`);
    }
  });
  page.on("request", (request) => {
    if (!request.url().startsWith(baseUrl) && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) {
      external.push(request.url());
    }
  });
  return { context, page, problems, external };
}

const stored = (page, key = KEY) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const raw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const nav = (page) => page.locator(".tab-bar:visible, .nav-rail:visible").first();
const screen = (page) => page.locator(".destination-panel:not([hidden]) .nosotros");

async function openNosotros(page) {
  await page.goto(baseUrl, { waitUntil: "load" });
  await nav(page).getByRole("button", { name: /Nosotros/ }).click();
  await screen(page).waitFor();
}

const section = (page, title) => screen(page).locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title }) });
const cards = (page) => screen(page).locator(".traveller-card");
const activeElementInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, cls: el?.className?.toString?.() ?? "", text: (el?.textContent ?? "").trim().slice(0, 80), id: el?.id ?? "", type: el?.getAttribute?.("type") ?? "" };
  });
const interestsOf = (d) => d?.interests ?? [];

// ---------------------------------------------------------------------------------------------
async function auditStructureAndIdentity(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const seed = doc();
  const { context, page, problems } = await newPage(browser, viewport, { seed });
  try {
    await openNosotros(page);

    // N — estructura
    const h1 = (await page.locator(".app__header h1").innerText()).trim();
    check("N-H1", h1 === "Nosotros", `${tag}: cabecera «${h1}»`);
    const h2 = await screen(page).getByRole("heading", { level: 2 }).allInnerTexts();
    check("N-ORDER", same(h2, ["Viajeros", "Copia del viaje", "Cómo funciona Nihon", "Fuentes y licencias", "Acerca de"]), `${tag}: secciones en orden (${h2.join(" · ")})`);
    const levels = await screen(page).locator("h1,h2,h3,h4,h5,h6").evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
    const noSkip = levels.every((level, i) => i === 0 || level - levels[i - 1] <= 1) && levels[0] === 2;
    check("N-HEADINGS", noSkip, `${tag}: jerarquía de headings sin saltos (${levels.join("")})`);
    const modals = await page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible').count();
    check("N-NOMODAL", modals === 0, `${tag}: nada de Nosotros abierto dentro de un modal (${modals})`);
    const sectionLabels = await screen(page).locator(".nosotros-section").evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-labelledby")).map((id) => document.getElementById(id)?.textContent)
    );
    check("N-LANDMARKS", sectionLabels.length === 5 && sectionLabels.every(Boolean), `${tag}: cada sección se nombra por su heading`);

    // N — viajeros
    check("N-CARDS", (await cards(page).count()) === 2, `${tag}: dos tarjetas de persona`);
    const tokenSizes = await cards(page).locator(".person-token").evaluateAll((els) =>
      els.map((el) => ({ md: el.classList.contains("person-token--md"), w: el.getBoundingClientRect().width, text: el.textContent }))
    );
    check("N-TOKEN-MD", tokenSizes.length === 2 && tokenSizes.every((t) => t.md && t.w >= 40) && tokenSizes[0].text === "M" && tokenSizes[1].text === "K", `${tag}: PersonToken md con inicial (${tokenSizes.map((t) => t.text)})`);
    const names = await cards(page).locator("input[type=text]").evaluateAll((els) => els.map((el) => el.value));
    check("N-NAMES", same(names, [A.label, B.label]), `${tag}: nombres editables (${names})`);
    const labelled = await cards(page).locator("input[type=text]").evaluateAll((els) =>
      els.every((el) => el.labels?.length === 1 && el.labels[0].textContent.includes("Nombre"))
    );
    check("N-LABELS", labelled, `${tag}: cada campo de nombre tiene su <label>`);
    const marked = await cards(page).locator(".traveller-card__marked").allInnerTexts();
    const wantA = seed.interests.filter((i) => i.stances.some((s) => s.travellerId === A.id && s.stance === "interested")).length;
    const wantB = seed.interests.filter((i) => i.stances.some((s) => s.travellerId === B.id && s.stance === "interested")).length;
    check("N-MARKED", marked[0].includes(`${wantA} lugares`) && marked[1].includes(`${wantB} lugares`), `${tag}: «Marcados» = ${wantA}/${wantB} (${marked.map((m) => m.replace(/\s+/g, " "))})`);
    const statusTexts = await cards(page).locator(".traveller-card__status").allInnerTexts();
    check("N-ACTIVE-TEXT", statusTexts.length === 1 && statusTexts[0].includes(`Este dispositivo lo usa ${A.label}`), `${tag}: la persona activa lo dice en texto («${statusTexts[0]?.trim()}»), no sólo con color`);
    check("N-ACTIVE-ONE", (await screen(page).locator(".traveller-card--active").count()) === 1, `${tag}: exactamente una tarjeta activa`);
    check("N-SWITCH-BTN", (await cards(page).nth(1).getByRole("button", { name: `Usar este dispositivo como ${B.label}` }).count()) === 1, `${tag}: la otra persona ofrece «Usar este dispositivo como…»`);

    // N — sin «Eres» en cabecera
    const headerText = (await page.locator(".app__header").innerText()).replace(/\s+/g, " ");
    check("N-NOERES", !/\bEres\b/i.test(headerText), `${tag}: la cabecera no muestra «Eres» («${headerText.trim()}»)`);
    check("N-NOSEG", (await page.locator(".app__header [aria-pressed], .app__header [role=radio], .traveller-bar").count()) === 0, `${tag}: sin conmutador de personas en la cabecera`);
    const tokenBtn = page.locator(".app__person-token-button");
    check("N-HEADTOKEN", (await tokenBtn.getAttribute("aria-label")).includes(A.label), `${tag}: token de cabecera = persona activa`);

    // I — cambiar persona activa
    const before = await stored(page);
    await cards(page).nth(1).getByRole("button", { name: `Usar este dispositivo como ${B.label}` }).click();
    let after = await stored(page);
    check("I-ACTIVE", after.activeTravellerId === B.id, `${tag}: persona activa guardada = ${B.label}`);
    check("I-PREFS", same(after.interests, before.interests) && same(after.travellers, before.travellers), `${tag}: cambiar de persona NO toca preferencias ni personas`);
    check("I-HEADER", (await tokenBtn.getAttribute("aria-label")).includes(B.label) && (await tokenBtn.innerText()).trim() === "K", `${tag}: el token de cabecera cambia a ${B.label}`);
    const live = await screen(page).locator("[role=status].visually-hidden").innerText();
    check("I-LIVE", live.includes(`Nihon se usa como ${B.label}`), `${tag}: región viva anuncia el cambio («${live}»)`);
    const focus = await activeElementInfo(page);
    check("I-FOCUS", focus.cls.includes("traveller-card__status") && focus.text.includes(B.label), `${tag}: el foco pasa al estado activo, no se pierde (${focus.cls})`);
    check("I-ACTIVE-UI", (await cards(page).nth(1).locator(".traveller-card__status").count()) === 1 && (await cards(page).nth(0).locator(".traveller-card__status").count()) === 0, `${tag}: la marca de activa se mueve a la tarjeta de ${B.label}`);

    // I — los corazones posteriores son de la nueva persona
    await nav(page).getByRole("button", { name: /Explorar/ }).click();
    await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio/ }).click();
    await page.waitForSelector(".place-card", { timeout: 15000 });
    const heart = page.getByRole("button", { name: /^Quiero ir: / }).first();
    const heartCount = await page.getByRole("button", { name: /^Quiero ir: / }).count();
    if (heartCount > 0) {
      const priorIds = new Set(interestsOf(after).filter((i) => i.stances.some((s) => s.stance === "interested" && s.travellerId === B.id)).map((i) => i.placeId));
      await heart.click();
      await page.waitForTimeout(200);
      const now = await stored(page);
      const changed = interestsOf(now).filter((i) => {
        const wasB = priorIds.has(i.placeId);
        const isB = i.stances.some((s) => s.stance === "interested" && s.travellerId === B.id);
        return wasB !== isB;
      });
      const changedA = interestsOf(now).some((i) => {
        const prev = interestsOf(after).find((p) => p.placeId === i.placeId);
        const a1 = i.stances.find((s) => s.travellerId === A.id);
        const a0 = prev?.stances.find((s) => s.travellerId === A.id);
        return JSON.stringify(a1) !== JSON.stringify(a0);
      });
      check("I-HEART", changed.length === 1 && !changedA, `${tag}: el corazón nuevo es de ${B.label} y no toca a ${A.label}`);
    } else {
      check("I-HEART", false, `${tag}: no se encontró el corazón de la primera tarjeta`);
    }
    after = await stored(page);

    // I — renombrar
    await nav(page).getByRole("button", { name: /Nosotros/ }).click();
    const nameInput = cards(page).nth(0).locator("input[type=text]");
    const preRename = await stored(page);
    await nameInput.fill(LONG);
    let post = await stored(page);
    check("I-RENAME", post.travellers[0].label === LONG && post.travellers[0].id === A.id && same(post.interests, preRename.interests), `${tag}: renombrar conserva id y preferencias`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check("I-LONGNAME", overflow <= 0, `${tag}: nombre largo sin desbordar (overflow ${overflow}px)`);
    const tokenText = await cards(page).nth(0).locator(".person-token").innerText();
    check("I-TOKEN-LIVE", tokenText === "A", `${tag}: el token toma la inicial del nombre nuevo (${tokenText})`);
    await nameInput.fill("");
    post = await stored(page);
    check("I-BLANK", post.travellers[0].label === LONG, `${tag}: vaciar el campo no guarda un nombre en blanco`);
    await page.locator("body").click({ position: { x: 2, y: 2 } });
    await nameInput.blur();
    check("I-BLUR", (await nameInput.inputValue()) === LONG, `${tag}: al salir del campo vuelve el nombre guardado`);
    await nameInput.fill(A.label);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/viajeros-${ENGINE}-${tag}.png` });

    // I — confirmaciones destructivas
    const beforeReset = await stored(page);
    const resetBtn = cards(page).nth(1).getByRole("button", { name: new RegExp(`Reiniciar lo que ha guardado ${B.label}`) });
    await resetBtn.click();
    const alertText = await cards(page).nth(1).getByRole("alert").first().innerText();
    check("I-RESET-CONFIRM", /Se borrará todo lo que ha dicho/.test(alertText) && /no se toca/.test(alertText), `${tag}: reiniciar pide confirmación explícita («${alertText.replace(/\s+/g, " ").slice(0, 60)}…»)`);
    check("I-RESET-NOTHING", same(await stored(page), beforeReset), `${tag}: nada cambia hasta confirmar`);
    check("I-RESET-FOCUS-IN", (await activeElementInfo(page)).text === "Cancelar", `${tag}: el foco entra en «Cancelar»`);
    await page.keyboard.press("Enter");
    check("I-RESET-CANCEL", same(await stored(page), beforeReset) && /Reiniciar/.test((await activeElementInfo(page)).text), `${tag}: cancelar no cambia nada y el foco vuelve a «Reiniciar»`);
    await resetBtn.click();
    await cards(page).nth(1).getByRole("button", { name: "Sí, reiniciar" }).click();
    const afterReset = await stored(page);
    const bStances = afterReset.interests.flatMap((i) => i.stances).filter((s) => s.travellerId === B.id);
    const aBefore = beforeReset.interests.flatMap((i) => i.stances).filter((s) => s.travellerId === A.id);
    const aAfter = afterReset.interests.flatMap((i) => i.stances).filter((s) => s.travellerId === A.id);
    check("I-RESET", bStances.length === 0 && same(aBefore, aAfter) && afterReset.travellers.length === 2, `${tag}: reiniciar borra sólo lo de ${B.label} y conserva a las dos personas`);

    // I — quitar y añadir (MAX_TRAVELLERS)
    await cards(page).nth(1).getByRole("button", { name: `Quitar a ${B.label} del viaje` }).click();
    check("I-REMOVE-CONFIRM", /Nada pasa a la otra persona/.test(await cards(page).nth(1).getByRole("alert").first().innerText()), `${tag}: quitar pide confirmación y dice que nada pasa a la otra persona`);
    await cards(page).nth(1).getByRole("button", { name: "Sí, quitar" }).click();
    const afterRemove = await stored(page);
    check("I-REMOVE", afterRemove.travellers.length === 1 && afterRemove.travellers[0].id === A.id && afterRemove.activeTravellerId === A.id, `${tag}: quitar deja una persona y la activa pasa a quien queda`);
    check("I-REMOVE-DISABLED", await cards(page).nth(0).getByRole("button", { name: /^Quitar a/ }).isDisabled(), `${tag}: no se puede quitar a la última persona`);
    const add = screen(page).getByRole("button", { name: /Añadir a la segunda persona/ });
    check("I-ADD-VISIBLE", (await add.count()) === 1, `${tag}: se ofrece añadir a la segunda persona`);
    await add.click();
    const afterAdd = await stored(page);
    check("I-ADD", afterAdd.travellers.length === 2 && afterAdd.travellers[1].id !== B.id, `${tag}: añadir crea una persona nueva sin heredar nada`);
    check("I-MAX", (await screen(page).getByRole("button", { name: /Añadir a la segunda persona/ }).count()) === 0 && afterAdd.travellers.length <= 2, `${tag}: MAX_TRAVELLERS respetado (no hay tercer alta)`);

    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
async function auditHeaderToken(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page, problems } = await newPage(browser, viewport, { seed: doc() });
  try {
    await openNosotros(page);
    // Deja Nosotros scrolleado al final, cambia de pestaña y vuelve con el token.
    await screen(page).evaluate((el) => {
      el.closest(".destination-panel").scrollTop = 99999;
    });
    await nav(page).getByRole("button", { name: /Explorar/ }).click();
    await page.locator(".app__person-token-button").click();
    await screen(page).waitFor();
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const heading = document.getElementById("nosotros-viajeros-title");
      const panel = heading?.closest(".destination-panel");
      const h = heading?.getBoundingClientRect();
      const p = panel?.getBoundingClientRect();
      return { focused: document.activeElement === heading, inView: !!h && !!p && h.top >= p.top - 1 && h.top < p.top + 200 };
    });
    check("N-TOKEN-NAV", info.focused && info.inView, `${tag}: el token de cabecera lleva a Nosotros › Viajeros (foco ${info.focused}, a la vista ${info.inView})`);
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
function backupFile(travellersDoc, name = "respaldo.json") {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "nihon-portable-backup",
        version: 1,
        exportedAt: "2026-09-01T10:00:00.000Z",
        data: { travellers: travellersDoc, planningDraft: null },
      })
    ),
  };
}

async function auditBackup(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const current = doc();
  const incoming = doc({
    a: { id: "trv-x", label: "Ines" },
    b: { id: "trv-y", label: "Hugo" },
    interests: [rec(K2, yes("trv-x"), yes("trv-y")), rec(T3, yes("trv-y"))],
  });
  const { context, page, problems, external } = await newPage(browser, viewport, { seed: current });
  try {
    await openNosotros(page);
    const backup = section(page, "Copia del viaje");

    // B — exportar
    const [download] = await Promise.all([page.waitForEvent("download"), backup.getByRole("button", { name: "Exportar respaldo" }).click()]);
    const path = await download.path();
    const file = JSON.parse(readFileSync(path, "utf8"));
    const live = await stored(page);
    check("B-EXPORT", /^nihon-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), `${tag}: se descarga un .json (${download.suggestedFilename()})`);
    check("B-EXPORT-CONTENT", file.format === "nihon-portable-backup" && file.version === 1 && same(file.data.travellers, live), `${tag}: el archivo real contiene el documento de viajeros tal cual`);
    check("B-EXPORT-STATUS", /Archivo generado/.test(await backup.locator("[role=status]").first().innerText()), `${tag}: se anuncia el archivo generado`);

    // B — round trip: export → importar ese mismo archivo conserva los datos
    const fileInput = backup.locator("input[type=file]");
    await fileInput.setInputFiles({ name: "roundtrip.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(path)) });
    await backup.getByText("Esto sustituirá todo lo que hay en este navegador.").waitFor();
    check("B-ROUNDTRIP-PREVIEW", same(await stored(page), live), `${tag}: elegir el archivo NO escribe nada antes de confirmar`);
    await backup.getByRole("button", { name: "Cancelar" }).click();

    // B — confirmación real antes de reemplazar
    const before = await raw(page, KEY);
    const beforeDraft = await raw(page, DRAFT_KEY);
    await fileInput.setInputFiles(backupFile(incoming));
    const confirmLine = backup.getByText("Esto sustituirá todo lo que hay en este navegador.");
    await confirmLine.waitFor();
    check("B-CONFIRM-TEXT", await confirmLine.isVisible(), `${tag}: aparece «Esto sustituirá todo lo que hay en este navegador.»`);
    check("B-CONFIRM-NOWRITE", (await raw(page, KEY)) === before && (await raw(page, DRAFT_KEY)) === beforeDraft, `${tag}: con la confirmación abierta el almacenamiento sigue intacto`);
    const previewText = await backup.locator(".trip-backup__preview").innerText();
    check("B-PREVIEW-SUMMARY", previewText.includes("Ines") && previewText.includes("Hugo"), `${tag}: el resumen dice qué contiene el archivo (personas)`);
    check("B-CONFIRM-FOCUS", (await page.evaluate(() => document.activeElement?.classList.contains("trip-backup__preview"))) === true, `${tag}: el foco pasa a la confirmación`);
    check("B-CONFIRM-GROUP", (await backup.locator(".trip-backup__preview").getAttribute("role")) === "group", `${tag}: la confirmación es un grupo con nombre`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-confirm-${ENGINE}-${tag}.png` });

    // B — cancelar
    await backup.getByRole("button", { name: "Cancelar" }).click();
    check("B-CANCEL", (await raw(page, KEY)) === before && (await raw(page, DRAFT_KEY)) === beforeDraft && (await backup.locator(".trip-backup__preview").count()) === 0, `${tag}: cancelar no cambia nada`);
    const focusAfterCancel = await activeElementInfo(page);
    check("B-CANCEL-FOCUS", focusAfterCancel.type === "file", `${tag}: tras cancelar el foco vuelve al selector de archivo (${focusAfterCancel.tag}/${focusAfterCancel.type})`);

    // B — Escape retrocede, nunca confirma
    await fileInput.setInputFiles(backupFile(incoming));
    await confirmLine.waitFor();
    await page.keyboard.press("Escape");
    check("B-ESCAPE", (await raw(page, KEY)) === before && (await backup.locator(".trip-backup__preview").count()) === 0, `${tag}: Escape cancela la confirmación sin escribir`);

    // B — JSON inválido
    for (const [label, bad] of [
      ["texto que no es JSON", { name: "malo.json", mimeType: "application/json", buffer: Buffer.from("esto no es json {") }],
      ["JSON de otro formato", { name: "otro.json", mimeType: "application/json", buffer: Buffer.from('{"hola":"mundo"}') }],
      ["archivo vacío", { name: "vacio.json", mimeType: "application/json", buffer: Buffer.from("") }],
      ["respaldo con personas dañadas", { name: "dañado.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "nihon-portable-backup", version: 1, exportedAt: "2026-09-01T10:00:00.000Z", data: { travellers: { version: 1, travellers: [] }, planningDraft: null } })) }],
      ["respaldo de una versión futura", { name: "futuro.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "nihon-portable-backup", version: 99, exportedAt: "2026-09-01T10:00:00.000Z", data: {} })) }],
    ]) {
      await fileInput.setInputFiles(bad);
      const problem = backup.getByRole("alert");
      await problem.waitFor();
      const text = await problem.innerText();
      check("B-INVALID", /No se ha cambiado nada en este navegador/.test(text) && (await raw(page, KEY)) === before && (await raw(page, DRAFT_KEY)) === beforeDraft, `${tag}: ${label} → rechazado sin cambiar nada («${text.split("\n")[1]?.slice(0, 60) ?? ""}»)`);
      check("B-INVALID-NOCONFIRM", (await backup.getByRole("button", { name: "Sustituir con este respaldo" }).count()) === 0, `${tag}: ${label} → no ofrece sustituir`);
      check("B-INVALID-FOCUS", (await page.evaluate(() => document.activeElement?.getAttribute("role"))) === "alert", `${tag}: ${label} → el foco va al mensaje`);
      await backup.getByRole("button", { name: "Entendido" }).click();
      check("B-INVALID-FOCUS-BACK", (await activeElementInfo(page)).type === "file", `${tag}: «Entendido» devuelve el foco al selector`);
    }

    // B — fallo de persistencia: nada engañoso
    await fileInput.setInputFiles(backupFile(incoming));
    await confirmLine.waitFor();
    await page.evaluate((draftKey) => {
      const original = Storage.prototype.setItem;
      window.__restoreSetItem = () => (Storage.prototype.setItem = original);
      Storage.prototype.setItem = function (key, value) {
        if (key === draftKey || key === "nihon.travellers.v1") throw new DOMException("cuota simulada", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }, DRAFT_KEY);
    await backup.getByRole("button", { name: "Sustituir con este respaldo" }).click();
    const failedText = await backup.getByRole("alert").innerText();
    await page.evaluate(() => window.__restoreSetItem());
    check("B-FAIL", /No se ha podido guardar el respaldo/.test(failedText) && /Tus datos anteriores siguen como estaban/.test(failedText), `${tag}: un fallo de escritura lo dice y no promete lo que no pasó («${failedText.split("\n")[1] ?? ""}»)`);
    check("B-FAIL-STATE", (await raw(page, KEY)) === before && (await backup.getByText("Respaldo restaurado").count()) === 0, `${tag}: tras el fallo el estado es el anterior y no se anuncia «restaurado»`);
    await backup.getByRole("button", { name: "Entendido" }).click();

    // B — confirmar reemplaza, no fusiona
    await fileInput.setInputFiles(backupFile(incoming));
    await confirmLine.waitFor();
    await backup.getByRole("button", { name: "Sustituir con este respaldo" }).click();
    await backup.getByText("Respaldo restaurado en este navegador.").waitFor();
    const replaced = await stored(page);
    const oldPlaces = new Set(current.interests.map((i) => i.placeId));
    check("B-REPLACE", same(replaced.travellers, incoming.travellers) && replaced.interests.every((i) => !oldPlaces.has(i.placeId)) && same(replaced.interests.map((i) => i.placeId).sort(), incoming.interests.map((i) => i.placeId).sort()), `${tag}: confirmar REEMPLAZA (sin lugares ni personas anteriores)`);
    check("B-RESTORED-FOCUS", (await page.evaluate(() => document.activeElement?.classList.contains("trip-backup__restored"))) === true, `${tag}: el foco pasa al resumen de restauración`);
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), backup.getByRole("button", { name: "Continuar" }).click()]);
    const afterReload = await stored(page);
    check("B-PERSIST", same(afterReload.travellers, incoming.travellers) && same(afterReload.interests.map((i) => i.placeId).sort(), incoming.interests.map((i) => i.placeId).sort()), `${tag}: tras recargar el viaje restaurado persiste (no lo pisa el estado antiguo)`);
    check("B-NONET", external.length === 0, `${tag}: exportar/importar sin ninguna petición externa${external.length ? ` — ${external.join(", ")}` : ""}`);
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
async function auditOnboarding(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;

  // O — primera ejecución
  {
    const { context, page, problems } = await newPage(browser, viewport, { seen: false });
    try {
      await page.goto(baseUrl, { waitUntil: "load" });
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      check("O-FIRST-AUTO", await dialog.isVisible(), `${tag}: la primera ejecución abre el explicador`);
      check("O-HERO", (await dialog.getByRole("heading", { level: 2, name: "Nihon" }).count()) === 1 && (await dialog.getByText("El cuaderno de vuestro viaje a Japón").count()) === 1, `${tag}: «Hola» dice «Nihon» y «El cuaderno de vuestro viaje a Japón»`);
      const img = dialog.locator(".onboarding__hero-image");
      await img.waitFor();
      await page.waitForFunction(() => document.querySelector(".onboarding__hero-image")?.complete);
      const photo = await img.evaluate((el) => ({ w: el.naturalWidth, alt: el.alt }));
      check("O-PHOTO", photo.w > 0 && photo.alt.length > 10, `${tag}: fotografía real del catálogo (${photo.w}px, alt «${photo.alt.slice(0, 40)}…»)`);
      check("O-CTA", (await dialog.getByRole("button", { name: "Empezar" }).count()) === 1, `${tag}: botón «Empezar»`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/onboarding-hola-${ENGINE}-${tag}.png` });
      const titles = [];
      await dialog.getByRole("button", { name: "Empezar" }).click();
      for (let i = 0; i < 3; i += 1) {
        titles.push(await dialog.getByRole("heading", { level: 2 }).innerText());
        await dialog.getByRole("button", { name: "Siguiente" }).click();
      }
      titles.push(await dialog.getByRole("heading", { level: 2 }).innerText());
      check("O-SEQUENCE", same(titles, ["Explora Japón", "Marca lo que te gustaría ver", "Después comparáis", "¿Quiénes sois?"]), `${tag}: secuencia normativa (${titles.join(" › ")})`);
      const inputs = dialog.locator("input[type=text]");
      check("O-DEFAULTS", same(await inputs.evaluateAll((els) => els.map((e) => e.value)), ["Persona 1", "Persona 2"]), `${tag}: nombres por defecto Persona 1 / Persona 2`);
      check("O-WHO", (await dialog.getByRole("group", { name: "¿Quién tiene este teléfono?" }).getByRole("radio").count()) === 2 && (await dialog.getByRole("radio").first().isChecked()), `${tag}: «¿Quién tiene este teléfono?» con dos opciones, la primera marcada`);
      check("O-FOCUS-NAME", (await activeElementInfo(page)).cls.includes("onboarding__input"), `${tag}: el foco entra en el primer nombre`);
      await inputs.nth(0).fill("Lucía");
      const live = await dialog.locator(".onboarding__person .person-token").first().innerText();
      check("O-TOKEN-LIVE", live === "L", `${tag}: PersonToken en vivo con el nombre escrito (${live})`);
      await inputs.nth(1).fill("Bruno");
      await dialog.getByRole("radio").nth(1).check({ force: true });
      check("O-ENTER-NOWRITE", (await stored(page)).travellers.map((t) => t.label).join() === "Persona 1,Persona 2", `${tag}: nada se guarda hasta pulsar «Entrar»`);
      await dialog.getByRole("button", { name: "Entrar" }).click();
      await dialog.waitFor({ state: "detached" });
      const written = await stored(page);
      check("O-ENTER", same(written.travellers.map((t) => t.label), ["Lucía", "Bruno"]) && written.activeTravellerId === written.travellers[1].id, `${tag}: «Entrar» escribe nombres y persona activa en el mismo almacén de viajeros`);
      check("O-SEEN", (await raw(page, SEEN_KEY)) === "1", `${tag}: queda marcado como visto`);
      check("O-HEADER-TOKEN", (await page.locator(".app__person-token-button").getAttribute("aria-label")).includes("Bruno"), `${tag}: el token de cabecera ya es Bruno`);
      check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
    } finally {
      await context.close();
    }
  }

  // O — primera ejecución: «Saltar» acepta los valores por defecto
  {
    const { context, page } = await newPage(browser, viewport, { seen: false });
    try {
      await page.goto(baseUrl, { waitUntil: "load" });
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "Saltar" }).click();
      await page.waitForTimeout(200);
      const skipped = await stored(page);
      check("O-SKIP-FIRST", same(skipped.travellers.map((t) => t.label), ["Persona 1", "Persona 2"]) && skipped.activeTravellerId === skipped.travellers[0].id && (await raw(page, SEEN_KEY)) === "1", `${tag}: «Saltar» en la primera ejecución = nombres por defecto y persona A activa, visto`);
    } finally {
      await context.close();
    }
  }

  // O — cada forma de cerrar marca visto
  for (const [label, close] of [
    ["Escape", (page) => page.keyboard.press("Escape")],
    ["×", (page) => page.getByRole("button", { name: "Cerrar la introducción" }).click()],
  ]) {
    const { context, page } = await newPage(browser, viewport, { seen: false });
    try {
      await page.goto(baseUrl, { waitUntil: "load" });
      await page.getByRole("dialog").waitFor();
      await close(page);
      await page.waitForTimeout(200);
      check("O-CLOSE-SEEN", (await page.getByRole("dialog").count()) === 0 && (await raw(page, SEEN_KEY)) === "1", `${tag}: ${label} cierra y marca visto`);
    } finally {
      await context.close();
    }
  }

  // O — reapertura desde Nosotros: nombres existentes intactos
  {
    const seed = doc({ a: { id: "trv-a", label: "Marta" }, b: { id: "trv-b", label: "Kenji" }, active: "trv-b" });
    const { context, page, problems } = await newPage(browser, viewport, { seed });
    try {
      await openNosotros(page);
      const how = section(page, "Cómo funciona Nihon");
      const reopen = how.getByRole("button", { name: "Ver de nuevo" });
      const openToIdentity = async () => {
        await reopen.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "Empezar" }).click();
        for (let i = 0; i < 3; i += 1) await dialog.getByRole("button", { name: "Siguiente" }).click();
        return dialog;
      };
      const start = await stored(page);
      let dialog = await openToIdentity();
      const names = await dialog.locator("input[type=text]").evaluateAll((els) => els.map((e) => e.value));
      check("O-REOPEN-NAMES", same(names, ["Marta", "Kenji"]), `${tag}: al reabrir, los nombres existentes ya están (${names})`);
      check("O-REOPEN-ACTIVE", (await dialog.getByRole("radio").nth(1).isChecked()) && !(await dialog.getByRole("radio").nth(0).isChecked()), `${tag}: al reabrir, la persona activa actual está seleccionada`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/onboarding-quienes-${ENGINE}-${tag}.png` });
      await dialog.locator("input[type=text]").first().fill("Otro nombre sin confirmar");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      check("O-REOPEN-ESC", same(await stored(page), start), `${tag}: Escape al reabrir NO destruye nombres ni preferencias`);
      check("O-REOPEN-FOCUS", (await activeElementInfo(page)).text === "Ver de nuevo", `${tag}: tras cerrar con Escape el foco vuelve a «Ver de nuevo» (${JSON.stringify(await activeElementInfo(page))})`);
      dialog = await openToIdentity();
      await dialog.locator(".onboarding__skip-row").getByRole("button", { name: "Saltar" }).click();
      check("O-REOPEN-SKIP-FOCUS", (await activeElementInfo(page)).text === "Ver de nuevo", `${tag}: tras «Saltar» el foco vuelve a «Ver de nuevo»`);
      check("O-REOPEN-SKIP", same(await stored(page), start), `${tag}: «Saltar» al reabrir no escribe nada (sin semántica destructiva)`);
      dialog = await openToIdentity();
      await dialog.getByRole("button", { name: "Cerrar la introducción" }).click();
      check("O-REOPEN-X-FOCUS", (await activeElementInfo(page)).text === "Ver de nuevo", `${tag}: tras × el foco vuelve a «Ver de nuevo»`);
      check("O-REOPEN-X", same(await stored(page), start), `${tag}: × al reabrir no escribe nada`);
      dialog = await openToIdentity();
      await dialog.locator("input[type=text]").nth(0).fill("Marta Ruiz");
      await dialog.getByRole("radio").nth(0).check({ force: true });
      await dialog.getByRole("button", { name: "Entrar" }).click();
      await dialog.waitFor({ state: "detached" });
      const end = await stored(page);
      check("O-REOPEN-ENTER", end.travellers[0].label === "Marta Ruiz" && end.travellers[0].id === "trv-a" && end.travellers[1].label === "Kenji" && end.activeTravellerId === "trv-a" && same(end.interests, start.interests), `${tag}: «Entrar» al reabrir renombra y cambia la activa conservando ids y preferencias`);
      check("O-REOPEN-ENTER-FOCUS", (await activeElementInfo(page)).text === "Ver de nuevo", `${tag}: tras «Entrar» el foco vuelve a «Ver de nuevo»`);
      check("O-REOPEN-CARDS", (await cards(page).nth(0).locator("input[type=text]").inputValue()) === "Marta Ruiz", `${tag}: Nosotros refleja el cambio (mismo almacén)`);
      check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
    } finally {
      await context.close();
    }
  }
}

// ---------------------------------------------------------------------------------------------
async function auditSources(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page, problems } = await newPage(browser, viewport, { seed: doc() });
  try {
    await openNosotros(page);
    const src = section(page, "Fuentes y licencias");
    const text = await src.innerText();
    check("F-MLIT", text.includes("国土数値情報 行政区域データ") && text.includes("N03, 2026") && text.includes("国土交通省") && /Versión simplificada creada por Nihon; no es un producto oficial de MLIT\./.test(text.replace(/\s+/g, " ")), `${tag}: atribución MLIT completa`);
    const mlitHref = await src.locator("a[href*='nlftp.mlit.go.jp']").getAttribute("href");
    check("F-MLIT-LINK", mlitHref === "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html", `${tag}: enlace MLIT (${mlitHref})`);
    const licenses = await src.locator(".sources__license").evaluateAll((els) => els.map((el) => ({ text: el.textContent, href: el.querySelector("a")?.href ?? null })));
    check("F-LICENSES", licenses.length >= 5 && licenses.some((l) => /CC BY-SA 4\.0/.test(l.text)) && licenses.filter((l) => l.href).length >= 5, `${tag}: licencias fotográficas con enlaces (${licenses.length})`);
    check("F-PHOTOS", /\d+ fotografías de \d+ lugares/.test(text) && text.includes("Wikimedia Commons"), `${tag}: resumen de fotografía y su procedencia`);
    const sourcesItems = await src.locator(".sources__item").count();
    check("F-SOURCES", sourcesItems >= 10 && /Consultada el \d{4}-\d{2}-\d{2}/.test(text), `${tag}: fuentes de datos con fecha de consulta (${sourcesItems})`);
    check("F-NOUPDATED", !/updatedAt|actualizado/i.test(text), `${tag}: no presenta updatedAt como consulta`);
    check("F-DATA", /\d+ lugares · \d+ de \d+ prefecturas con lugares verificados/.test(text), `${tag}: cuenta de lugares y prefecturas`);
    const links = await src.locator("a[target=_blank]").evaluateAll((els) => els.every((el) => /noopener/.test(el.rel)));
    check("F-LINKS-SAFE", links, `${tag}: los enlaces externos llevan rel=noopener`);
    const about = await section(page, "Acerca de").innerText();
    check("F-VERSION", about.includes(`versión ${PKG.version}`), `${tag}: versión visible = package.json (${PKG.version})`);
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
async function auditLayout(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const seed = doc({ a: { id: "trv-a", label: LONG }, b: { id: "trv-b", label: "K" } });
  const { context, page, problems } = await newPage(browser, viewport, { seed });
  try {
    await openNosotros(page);
    const backup = section(page, "Copia del viaje");
    await backup.locator("input[type=file]").setInputFiles(backupFile(doc({ a: { id: "trv-x", label: LONG }, b: { id: "trv-y", label: "Hugo" } })));
    await backup.getByText("Esto sustituirá todo lo que hay en este navegador.").waitFor();
    await cards(page).nth(0).getByRole("button", { name: /^Reiniciar/ }).click();

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panel: (() => {
        const el = document.querySelector(".destination-panel:not([hidden])");
        return el.scrollWidth - el.clientWidth;
      })(),
    }));
    check("L-OVERFLOW", overflow.doc <= 0 && overflow.panel <= 0, `${tag}: sin overflow horizontal (doc ${overflow.doc}, panel ${overflow.panel})`);
    const wide = await screen(page).evaluate((root) => {
      const limit = root.getBoundingClientRect().right + 0.5;
      return [...root.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > limit).map((el) => el.className?.toString?.() || el.tagName).slice(0, 5);
    });
    check("L-CONTAINED", wide.length === 0, `${tag}: ningún elemento se sale de la columna${wide.length ? ` (${wide.join(", ")})` : ""}`);

    // scroll completo hasta el final y nada tapado
    const cover = await page.evaluate(async () => {
      const panel = document.querySelector(".destination-panel:not([hidden])");
      panel.scrollTop = panel.scrollHeight;
      await new Promise((r) => setTimeout(r, 150));
      // La barra VISIBLE: en el DOM conviven TabBar y NavRail y sólo una se pinta.
      const bar = [...document.querySelectorAll(".tab-bar, .nav-rail")].find((el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0);
      if (!bar) return { atEnd: false, visible: false, rail: false, covered: [], probeInBar: false, lastBottom: 0, barTop: 0 };
      const barRect = bar.getBoundingClientRect();
      const barStyle = getComputedStyle(bar);
      const visible = barStyle.display !== "none" && barRect.width > 0 && barRect.height > 0;
      const isRail = bar.classList.contains("nav-rail");
      const atEnd = Math.abs(panel.scrollTop + panel.clientHeight - panel.scrollHeight) <= 2;
      const intersects = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
      // Ningún elemento con caja del último bloque (Acerca de) se solapa con la barra…
      const last = panel.querySelector(".nosotros .nosotros-section:last-child");
      const covered = [...last.querySelectorAll("*"), last]
        .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && intersects(el.getBoundingClientRect(), barRect))
        .map((el) => el.className?.toString?.() || el.tagName);
      // …y lo que hay en el punto más bajo del bloque es el propio bloque, no la barra.
      const lastRect = last.getBoundingClientRect();
      const probe = document.elementFromPoint(lastRect.left + Math.min(20, lastRect.width / 2), Math.max(0, Math.min(lastRect.bottom, window.innerHeight) - 4));
      const probeInBar = !!probe && bar.contains(probe);
      return { atEnd, visible, rail: isRail, covered, probeInBar, lastBottom: Math.round(lastRect.bottom), barTop: Math.round(barRect.top) };
    });
    check("L-SCROLL-END", cover.atEnd, `${tag}: se puede hacer scroll hasta el final`);
    check("L-COVER", cover.visible && cover.covered.length === 0 && !cover.probeInBar, `${tag}: el último bloque (Acerca de) no se solapa con ${cover.rail ? "NavRail" : "TabBar"} (bloque termina en ${cover.lastBottom}, barra empieza en ${cover.barTop}${cover.covered.length ? `; solapa: ${cover.covered.join(", ")}` : ""})`);

    // objetivos táctiles
    const small = await screen(page).evaluate((root) => {
      const min = 44;
      return [...root.querySelectorAll("button, input[type=text], input[type=file], input[type=radio]")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        })
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.height < min - 0.5 || (r.width < min - 0.5))
        .map(({ el, r }) => `${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    check("L-TAP", small.length === 0, `${tag}: objetivos táctiles ≥${TAP_MIN}px${small.length ? ` — ${small.join(" | ")}` : ""}`);

    // shell
    const shell = await page.evaluate(() => {
      const tab = document.querySelector(".tab-bar");
      const rail = document.querySelector(".nav-rail");
      const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
      return { tab: vis(tab), rail: vis(rail) };
    });
    check("L-SHELL", viewport.width >= 840 ? shell.rail && !shell.tab : shell.tab && !shell.rail, `${tag}: ${viewport.width >= 840 ? "NavRail" : "TabBar"} visible y el otro no`);
    if (viewport.width >= 840) {
      const width = await screen(page).evaluate((el) => el.getBoundingClientRect().width);
      check("L-COLUMN", width <= 640.5, `${tag}: columna de lectura acotada (${Math.round(width)} px)`);
    }
    if (SHOTS) {
      await page.evaluate(() => (document.querySelector(".destination-panel:not([hidden])").scrollTop = 0));
      await page.screenshot({ path: `${SHOTS}/nosotros-top-${ENGINE}-${tag}.png` });
      await page.screenshot({ path: `${SHOTS}/nosotros-full-${ENGINE}-${tag}.png`, fullPage: true });
    }
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

// Onboarding en todos los viewports: sin overflow, botones visibles y alcanzables.
async function auditOnboardingLayout(browser, viewport, step) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page } = await newPage(browser, viewport, { seen: false, seed: doc({ a: { id: "trv-a", label: LONG }, b: { id: "trv-b", label: "Kenji" } }) });
  try {
    await page.goto(baseUrl, { waitUntil: "load" });
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    if (step === "identity") {
      await dialog.getByRole("button", { name: "Empezar" }).click();
      for (let i = 0; i < 3; i += 1) await dialog.getByRole("button", { name: "Siguiente" }).click();
    }
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const d = document.querySelector(".onboarding__dialog");
      const r = d.getBoundingClientRect();
      const primary = d.querySelector(".onboarding__actions .button--primary");
      d.scrollTop = d.scrollHeight;
      const pr = primary.getBoundingClientRect();
      return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, dialogOverflowX: d.scrollWidth - d.clientWidth, inside: r.top >= -1 && r.bottom <= window.innerHeight + 1, primaryVisible: pr.bottom <= window.innerHeight + 1 && pr.top >= 0, primaryHeight: pr.height };
    });
    check("L-ONB", info.overflowX <= 0 && info.dialogOverflowX <= 0 && info.inside && info.primaryVisible && info.primaryHeight >= 44 - 0.5, `${tag}: onboarding ${step} sin overflow, dentro de pantalla, CTA visible y ≥44px (${JSON.stringify(info)})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/onboarding-${step}-${ENGINE}-${tag}.png` });
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------------
async function auditKeyboard(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page, problems } = await newPage(browser, viewport, { seed: doc() });
  try {
    await openNosotros(page);
    // Todos los controles de Nosotros tienen nombre accesible.
    const unnamed = await screen(page).evaluate((root) => {
      const name = (el) => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(" ").trim();
        return (el.textContent ?? "").trim();
      };
      return [...root.querySelectorAll("button, input, a[href]")].filter((el) => !name(el)).map((el) => el.outerHTML.slice(0, 80));
    });
    check("K-NAMES", unnamed.length === 0, `${tag}: todos los controles tienen nombre accesible${unnamed.length ? ` — ${unnamed.join(" | ")}` : ""}`);

    // Recorrido por teclado: Tab llega a cada control de Nosotros en orden de lectura.
    await page.locator(".app__person-token-button").focus();
    const seen = [];
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const inNos = !!el?.closest(".nosotros");
        const all = [...document.querySelectorAll(".nosotros button, .nosotros input, .nosotros a[href]")];
        return { inNos, key: all.indexOf(el), tag: el?.tagName, label: el?.getAttribute("aria-label") || el?.textContent?.trim().slice(0, 40) || "" };
      });
      if (info.inNos) seen.push(info);
      if (info.tag === "BODY") break;
    }
    const expectedControls = await screen(page).locator("button:not([disabled]):visible, input:not([disabled]):visible, a[href]:visible").count();
    const distinct = new Set(seen.map((s) => s.key)).size;
    check("K-TAB", distinct === expectedControls && seen.length === distinct, `${tag}: Tab visita EXACTAMENTE cada control de Nosotros una vez (${distinct}/${expectedControls}, ${seen.length} pasos)`);
    check("K-TAB-ORDER", seen[0]?.tag === "INPUT" && /Usar este dispositivo|Reiniciar|Quitar/.test(seen.slice(1, 4).map((s) => s.label).join(" ")), `${tag}: el orden de tabulación empieza por Viajeros`);

    // Cambiar de persona con teclado
    const useB = cards(page).nth(1).getByRole("button", { name: `Usar este dispositivo como ${B.label}` });
    await useB.focus();
    await page.evaluate(() => {
      window.__b26FocusTrace = [];
      const log = (type) => (event) => {
        const el = event.target;
        window.__b26FocusTrace.push({ type, t: Math.round(performance.now() - window.__b26EnterAt), el: el?.tagName ? `${el.tagName}.${String(el.className).slice(0, 40)}` : String(el) });
      };
      window.__b26EnterAt = performance.now();
      document.addEventListener("focusin", log("focusin"), true);
      document.addEventListener("focusout", log("focusout"), true);
      document.addEventListener("keydown", () => { window.__b26EnterAt = performance.now(); }, { capture: true, once: true });
    });
    await page.keyboard.press("Enter");
    check("K-SWITCH", (await stored(page)).activeTravellerId === B.id, `${tag}: la persona activa se cambia con teclado (Enter)`);
    const focusState = () => page.evaluate(() => {
      const el = document.activeElement;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const conds = {
        status: el.classList.contains("traveller-card__status"),
        tabindex: el.tabIndex === -1,
        displayed: cs.display !== "none",
        visibility: cs.visibility !== "hidden",
        sized: r.width > 0 && r.height > 0,
        inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
      };
      return {
        ok: Object.values(conds).every(Boolean),
        conds,
        active: `${el.tagName}.${el.className}`.slice(0, 80),
        rect: [r.top, r.bottom].map(Math.round),
        innerHeight: window.innerHeight,
        t: Math.round(performance.now() - (window.__b26EnterAt ?? 0)),
      };
    });
    const first = await focusState();
    // Diagnóstico de #197: si la primera lectura falla, se distingue una carrera (el foco llega después
    // y se queda) de un defecto real (el foco nunca llega o llega a otro elemento). La aserción sigue
    // siendo la misma; sólo se registra el historial de focos y las muestras posteriores.
    let focusOk = first.ok;
    if (!first.ok) {
      const samples = [first];
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(25);
        const sample = await focusState();
        samples.push(sample);
        if (sample.ok) break;
      }
      const trace = await page.evaluate(() => window.__b26FocusTrace ?? []);
      const late = samples[samples.length - 1].ok;
      console.log(`DIAG K-FOCUS-VISIBLE ${tag}: primera lectura FALLA; ${late ? "CARRERA (el foco llegó tras " + samples[samples.length - 1].t + " ms)" : "DEFECTO (sin foco válido tras 3 s)"}`);
      console.log(`DIAG primera=${JSON.stringify(first)}`);
      console.log(`DIAG última=${JSON.stringify(samples[samples.length - 1])}`);
      console.log(`DIAG focos=${JSON.stringify(trace)}`);
      focusOk = false;
    }
    check("K-FOCUS-VISIBLE", focusOk, `${tag}: el foco queda en un elemento visible tras cambiar`);

    // #197 — causa raíz: con la CPU cargada, React vaciaba un passive effect pendiente DESPUÉS de que el
    // manejador fijara el destino de foco y ANTES del commit que crea el `<p>` de «Este dispositivo lo usa»;
    // el efecto consumía el destino sin encontrarlo y el foco caía a <body> para siempre (no era una carrera
    // del gate: la lectura a los 3 s seguía en <body>). Sin carga ocurría a veces; con ×8 casi siempre.
    // Sólo Chromium (CDP) y en el viewport de escritorio: página nueva con la CPU estrangulada desde la carga.
    if (ENGINE === "chromium" && tag.startsWith("1440")) {
      const lost = [];
      for (let run = 0; run < 2; run += 1) {
        const slow = await newPage(browser, { width: 1440, height: 900 }, { seed: doc() });
        const cdp = await slow.context.newCDPSession(slow.page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
        await openNosotros(slow.page);
        await slow.page.locator(".app__person-token-button").focus();
        for (let i = 0; i < 80; i += 1) {
          await slow.page.keyboard.press("Tab");
          if ((await slow.page.evaluate(() => document.activeElement?.tagName)) === "BODY") break;
        }
        const btn = cards(slow.page).nth(1).getByRole("button", { name: `Usar este dispositivo como ${B.label}` });
        await btn.focus();
        // Un usuario real pulsa Enter después de tabular, no en el mismo instante: el hueco deja pendiente
        // el passive effect del render que provocó el foco (sin él, el fallo no aparece).
        await slow.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
        await slow.page.keyboard.press("Enter");
        const st = await slow.page.evaluate(() => {
          const el = document.activeElement;
          return { ok: el.classList.contains("traveller-card__status") && el.tabIndex === -1, active: `${el.tagName}.${el.className}`.slice(0, 60) };
        });
        if (!st.ok) lost.push(`#${run}: ${st.active}`);
        await slow.context.close();
      }
      check("K-FOCUS-LOAD", lost.length === 0, `${tag}: con la CPU ×8 el foco llega al estado «Este dispositivo lo usa» (2 páginas nuevas; perdido: ${lost.join(", ") || "ninguno"})`);
    }

    // Onboarding: el foco queda atrapado y Escape cierra
    await section(page, "Cómo funciona Nihon").getByRole("button", { name: "Ver de nuevo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    let trapped = true;
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      if (!(await page.evaluate(() => !!document.activeElement?.closest(".onboarding__dialog")))) trapped = false;
    }
    check("K-TRAP", trapped, `${tag}: el foco no escapa del explicador`);
    check("K-DIALOG-NAME", (await dialog.getAttribute("aria-labelledby")) === "onboarding-title" && (await dialog.getAttribute("aria-modal")) === "true", `${tag}: el explicador es un diálogo con nombre`);
    await page.keyboard.press("Escape");
    check("K-ESC", (await page.getByRole("dialog").count()) === 0, `${tag}: Escape cierra el explicador`);
    check("C-CLEAN", problems.length === 0, `${tag}: sin errores${problems.length ? ` — ${problems.join(" | ")}` : ""}`);
  } finally {
    await context.close();
  }
}

async function auditReducedMotion(browser, viewport) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { context, page } = await newPage(browser, viewport, { seen: false, reducedMotion: true });
  try {
    await page.goto(baseUrl, { waitUntil: "load" });
    await page.getByRole("dialog").waitFor();
    const animation = await page.locator(".onboarding").evaluate((el) => getComputedStyle(el).animationName);
    check("A-REDUCED", animation === "none", `${tag}: con reduced-motion el explicador no anima (${animation})`);
  } finally {
    await context.close();
  }
}

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const baseUrl = server.resolvedUrls?.local[0];
console.log(`Motor: ${ENGINE}${executablePath ? ` (${executablePath})` : ""}`);
const browser = await playwright[ENGINE].launch(executablePath ? { executablePath } : {});
try {
  const VIEWPORTS = [
    { width: 320, height: 640 },
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await auditStructureAndIdentity(browser, viewport);
    await auditHeaderToken(browser, viewport);
    await auditBackup(browser, viewport);
    await auditOnboarding(browser, viewport);
    await auditSources(browser, viewport);
    await auditKeyboard(browser, viewport);
  }
  await auditReducedMotion(browser, { width: 390, height: 844 });
  for (const viewport of VIEWPORTS) {
    await auditLayout(browser, viewport);
    await auditOnboardingLayout(browser, viewport, "hero");
    await auditOnboardingLayout(browser, viewport, "identity");
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nB26 Nosotros (${ENGINE}): ${results.length - failed.length}/${results.length}`);
process.exit(failed.length === 0 ? 0 : 1);
