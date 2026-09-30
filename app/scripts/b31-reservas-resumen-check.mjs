import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B31 — B9.5 «Reservas y Resumen» (`docs/BLOCK_31_MISSION.md`). Comportamiento real
 * sobre la build de producción (`npm run build` antes). Línea Claude: continúa B30.
 *
 *   A «Dato:»     0 apariciones en Días, Reservas y Resumen; texto íntegro entre comillas + ◧ Registrado.
 *   B Reservas    dos listas (oficial ◼ / editorial ◧) con h3 propio, orden oficial ascendente y orden de
 *                 ruta editorial, una sola nota, «Horarios registrados» después, sin segundo calendario.
 *   C Resumen     cuatro tarjetas con ◇, una nota, banda con alternativa «Día N · ciudad» (multiciudad y día
 *                 vacío), estado «unavailable» sin banda ni enlaces, sin «tramo(s)».
 *   D enlaces     teclado (Intro/Espacio), nombre accesible, destino correcto, foco en el h2 de destino,
 *                 sin pila de historial, retorno a sub-pestañas previas intacto.
 *   E escrituras  contador de setItem = 0 al abrir, leer la banda, navegar y volver.
 *   F layout      320/360/390/430/768/840/1200/1440: sin scroll horizontal; objetivos táctiles ≥ 44 px.
 *   G consola     sin errores propios.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/b31-reservas-resumen-check.mjs`
 *      `NIHON_BROWSER=webkit` ejecuta el mismo gate en WebKit (si está instalado);
 *      `NIHON_REDUCED_MOTION=1` lo ejecuta con `prefers-reduced-motion: reduce`.
 * Capturas opcionales: `NIHON_B31_SHOTS=<dir>`.
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const REDUCED = process.env.NIHON_REDUCED_MOTION === "1";
const executablePath = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const SHOTS = process.env.NIHON_B31_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_KEY = "nihon.manualPlanningDraft";
const VIEWPORTS = [320, 360, 390, 430, 768, 840, 1200, 1440];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const nameOf = (id) => places.find((p) => p.id === id).name;
const hubOf = (id) => places.find((p) => p.id === id).hub;

const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const draft = (days, extra = {}) => ({
  version: 8,
  routeIds: days.flatMap((d) => d.placeIds),
  days: days.map((d) => ({ id: d.id, placeIds: d.placeIds, accommodationBoundary: unsel })),
  startDate: null,
  endDate: null,
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
  ...extra,
});

// Plan con fechas oficiales (ventana feb–mar 2027) y lugares con anticipación registrada (JP-212, JP-077,
// JP-044, JP-203); el día 2 mezcla
// dos ciudades y el día 4 está vacío.
const PLAN = draft(
  [
    { id: "d1", placeIds: ["JP-212"] },
    { id: "d2", placeIds: ["JP-077", "JP-044"] },
    { id: "d3", placeIds: ["JP-203"] },
    { id: "d4", placeIds: [] },
  ],
  { startDate: "2027-03-14", endDate: "2027-03-18" }
);

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 260)}`);
  }
}
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls?.local[0];
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
console.log(`# navegador: ${BROWSER}${executablePath ? ` (${executablePath})` : ""} ${browser.version()} · reduced-motion=${REDUCED}`);
const consoleErrors = [];
const pageErrors = [];

async function boot(viewport, { saved, plan } = {}) {
  const context = await browser.newContext({ viewport, ...(REDUCED ? { reducedMotion: "reduce" } : {}) });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(
    ({ saved, plan }) => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        window.__writes = [];
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          window.__writes.push({ k, v });
          return original.call(this, k, v);
        };
        if (sessionStorage.getItem("b31-seeded")) return;
        if (saved) localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(saved));
        if (plan) localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
        sessionStorage.setItem("b31-seeded", "1");
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    { saved: saved ?? null, plan: plan ?? null }
  );
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}
async function openViaje(page) {
  await page.locator(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible").first().click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await page.waitForTimeout(350);
}
const goTab = async (page, label) => {
  await page.locator(`.viaje-nav__item:has-text("${label}")`).click();
};
const surface = (page) => page.locator(".destination-panel:not([hidden]) .viaje-surface");
const writes = (page) => page.evaluate(() => window.__writes.slice());
const resetWrites = (page) => page.evaluate(() => (window.__writes.length = 0));
const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const M = { width: 390, height: 844 };
const parseEs = (text) => {
  const m = /(\d{1,2}) (\w{3}) (\d{4})/.exec(text);
  return m ? Date.UTC(Number(m[3]), MONTHS.indexOf(m[2]), Number(m[1])) : NaN;
};
const overflow = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const panel = document.querySelector(".destination-panel:not([hidden]) .destination-panel--scroll");
    const surface = document.querySelector(".destination-panel:not([hidden]) .viaje-surface");
    return {
      page: doc.scrollWidth > doc.clientWidth + 1,
      panel: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      surface: surface ? surface.scrollWidth > surface.clientWidth + 1 : false,
    };
  });

// ─────────────────────────────── A / B / C / D / E — móvil, plan con fechas oficiales
{
  const { context, page } = await boot(M, { saved: PLAN.routeIds, plan: PLAN });
  await openViaje(page);
  await resetWrites(page);
  const baselineDraft = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);

  // ── A «Dato:»
  await ck("A01", "«Dato:» = 0 en Días, Reservas y Resumen; texto íntegro + ◧ Registrado en Días", async () => {
    await page.waitForSelector(".day-timeline");
    for (const d of await page.locator("details.day-tools").all()) {
      const summary = d.locator("summary");
      if ((await d.getAttribute("open")) === null) await summary.click();
    }
    const panel = page.locator(".destination-panel:not([hidden])");
    const days = (await panel.textContent()) ?? "";
    ok(!/Dato:/.test(days), "«Dato:» en Días");
    const raws = await panel.locator(".recorded-interval-fit__raw, .reservation-deadline__raw").allInnerTexts();
    ok(raws.length >= 1, "ningún texto registrado en las tarjetas de día");
    for (const raw of raws) ok(/^«.+»\s*◧\s*Registrado$/s.test(raw.trim()), `forma de la sustitución: ${raw}`);
  });
  await ck("A02", "Reservas y Resumen: «Dato:» = 0; cada texto registrado entre comillas + ◧ Registrado", async () => {
    await goTab(page, "Reservas");
    await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
    const reservas = (await surface(page).textContent()) ?? "";
    ok(!/Dato:/.test(reservas), "«Dato:» en Reservas");
    for (const cls of [".reservation-prep__raw", ".hours-planning__raw"]) {
      const items = await surface(page).locator(cls).allInnerTexts();
      ok(items.length >= 1, `sin ${cls}`);
      for (const raw of items) ok(/^«.+»\s*◧\s*Registrado$/s.test(raw.trim()), `${cls}: ${raw}`);
    }
    await goTab(page, "Resumen");
    await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
    ok(!/Dato:/.test((await surface(page).textContent()) ?? ""), "«Dato:» en Resumen");
  });

  // ── B Reservas
  await goTab(page, "Reservas");
  await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
  await ck("B01", "dos listas visualmente separadas, cada una con su h3; oficial ◼ y editorial ◧", async () => {
    const official = page.locator(".official-reservation-calendar");
    const prep = page.locator(".reservation-prep");
    eq(await official.count(), 1, "lista oficial");
    eq(await prep.count(), 1, "lista editorial");
    eq(await official.getByRole("heading", { level: 3 }).innerText(), "Fechas oficiales", "h3 oficial");
    eq(await prep.getByRole("heading", { level: 3 }).innerText(), "Reservas por preparar", "h3 editorial");
    const offMarks = await official.locator(".official-reservation-calendar__item .evidence-mark").allInnerTexts();
    ok(offMarks.length >= 1 && offMarks.every((t) => t.includes("◼") && t.includes("Verificado")), `marcas oficiales: ${offMarks}`);
    const prepMarks = await prep.locator(".reservation-prep__item .evidence-mark").allInnerTexts();
    ok(prepMarks.length >= 1 && prepMarks.every((t) => t.includes("◧") && t.includes("Registrado")), `marcas editoriales: ${prepMarks}`);
    ok(!(await official.innerText()).includes("◧"), "◧ dentro de la lista oficial");
    ok(!(await prep.innerText()).includes("◼"), "◼ dentro de la lista editorial");
    // La separación no es sólo color: superficies distintas.
    const bg = await page.evaluate(() => {
      const css = (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor;
      return [css(".official-reservation-calendar"), css(".reservation-prep")];
    });
    ok(bg[0] !== bg[1], `superficies iguales: ${bg}`);
  });
  await ck("B02", "orden oficial cronológico ascendente (el de lib) y editorial en orden de ruta", async () => {
    const anchors = await page.locator(".official-reservation-calendar__anchor").allInnerTexts();
    ok(anchors.length >= 2, `filas oficiales: ${anchors.length}`);
    const times = anchors.map(parseEs);
    ok(times.every((t) => !Number.isNaN(t)), `fechas ilegibles: ${anchors}`);
    ok(times.every((t, i) => i === 0 || t >= times[i - 1]), `orden ascendente: ${anchors}`);
    const names = await page.locator(".reservation-prep__name").allInnerTexts();
    const routeOrder = PLAN.routeIds.map(nameOf);
    const idx = names.map((n) => routeOrder.indexOf(n));
    ok(idx.every((i) => i >= 0), `nombres fuera de la ruta: ${names}`);
    ok(idx.every((v, i) => i === 0 || v > idx[i - 1]), `orden de ruta: ${names}`);
    const hours = await page.locator(".hours-planning__name").allInnerTexts();
    const hidx = hours.map((n) => routeOrder.indexOf(n));
    ok(hidx.every((v, i) => i === 0 || v > hidx[i - 1]), `horarios en orden de ruta: ${hours}`);
  });
  await ck("B03", "una sola nota de encuadre; ningún descargo en prosa; sin léxico de urgencia/prioridad", async () => {
    eq(await surface(page).locator(".viaje-surface__note").count(), 1, "notas");
    for (const gone of [".official-reservation-calendar__disclaimer", ".reservation-prep__disclaimer", ".hours-planning__disclaimer"]) {
      eq(await page.locator(gone).count(), 0, gone);
    }
    const note = await surface(page).locator(".viaje-surface__note").innerText();
    ok(/Nihon no combina ambas fuentes/.test(note), "nota: separación de fuentes");
    // Léxico prohibido en lo visible de la superficie (la negación de orden vive en el detail del marcador).
    const visible = (await surface(page).innerText()).toLowerCase();
    for (const bad of ["urgente", "prioridad", "primero reserva", "más importante", "importante"]) {
      ok(!visible.includes(bad), `léxico prohibido visible: ${bad}`);
    }
    // El detalle de cada descargo sigue recuperable por lector de pantalla (aria-label del marcador).
    const details = await surface(page).locator(".evidence-mark--glyph-only").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    ok(details.length === 3, `marcadores de lista: ${details.length}`);
    ok(/no indica prioridad, urgencia ni en qué orden conviene reservar/.test(details[0]), "detalle oficial");
    ok(/anticipación registrada en el dato original/.test(details[1]), "detalle prep");
    ok(/No determina si el lugar abre o cierra en tu fecha/.test(details[2]), "detalle horarios");
  });
  await ck("B04", "«Horarios registrados» después de las dos listas; un solo calendario oficial", async () => {
    const order = await surface(page).evaluate((root) => {
      const pos = (sel) => {
        const el = root.querySelector(sel);
        return el ? [...root.querySelectorAll("*")].indexOf(el) : -1;
      };
      return [pos(".official-reservation-calendar"), pos(".reservation-prep"), pos(".hours-planning")];
    });
    ok(order[0] >= 0 && order[1] > order[0] && order[2] > order[1], `orden de listas: ${order}`);
    eq(await surface(page).locator("h3").allInnerTexts(), ["Fechas oficiales", "Reservas por preparar", "Horarios registrados"], "h3 de Reservas");
  });
  await ck("B05", "enlaces oficiales nombran el lugar, con rel=noreferrer y target _blank; lugares no son enlaces a ficha", async () => {
    const links = page.locator(".official-reservation-calendar__source");
    const n = await links.count();
    ok(n >= 1, "sin enlaces oficiales");
    for (let i = 0; i < n; i += 1) {
      const label = await links.nth(i).getAttribute("aria-label");
      ok(/^Ver fuente oficial de .+/.test(label), `nombre accesible: ${label}`);
      eq(await links.nth(i).getAttribute("rel"), "noreferrer", "rel");
      eq(await links.nth(i).getAttribute("target"), "_blank", "target");
    }
    eq(await surface(page).locator("button").count(), 0, "botones en Reservas (nombres de lugar no son enlaces)");
  });
  await shot(page, "reservas-390");

  // ── C Resumen
  await goTab(page, "Resumen");
  await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
  await ck("C01", "cuatro tarjetas h3, cada una con ◇ y un control; una sola nota; léxico «traslado»", async () => {
    eq(await surface(page).locator(".trip-summary-card").count(), 4, "tarjetas");
    eq(await surface(page).locator(".trip-summary-card h3").allInnerTexts(), ["Visitas", "Traslados registrados", "Alojamiento", "Rango del viaje"], "h3");
    const marks = await surface(page).locator(".trip-summary-card .evidence-mark").allInnerTexts();
    ok(marks.length === 4 && marks.every((t) => t.includes("◇")), `marcadores: ${marks}`);
    eq(await surface(page).locator(".viaje-surface__note").count(), 1, "notas");
    ok(/no puntúa ni recomienda/.test(await surface(page).locator(".viaje-surface__note").innerText()), "idea central de la nota");
    const text = await surface(page).innerText();
    ok(!/tramo/i.test(text), "«tramo(s)» en Resumen");
    ok(!/posiciones de movimiento/i.test(text), "«posiciones de movimiento»");
    eq(await page.locator(".whole-trip-composition").count(), 0, "estructura antigua");
  });
  await ck("C02", "banda: un segmento por día, anchos iguales, sin color por ciudad; alternativa «Día N · ciudad»", async () => {
    eq(await page.locator(".trip-timeline__segment").count(), 4, "segmentos");
    const widths = await page.locator(".trip-timeline__segment").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    ok(Math.max(...widths) - Math.min(...widths) < 1.5, `anchos iguales: ${widths}`);
    const colors = await page.locator(".trip-timeline__segment").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    ok(new Set(colors).size === 1, `color único (sin color por ciudad): ${colors}`);
    const alt = await page.locator("[data-timeline-text] li").allTextContents();
    eq(alt[0], `Día 1 · ${hubOf("JP-212")}`, "día 1");
    const d2 = [...new Set(["JP-077", "JP-044"].map(hubOf))];
    eq(alt[1], `Día 2 · ${d2.length > 1 ? `${d2.slice(0, -1).join(", ")} y ${d2[d2.length - 1]}` : d2[0]}`, "día 2 (multiciudad)");
    ok(d2.length === 2, "el plan debe tener un día multiciudad");
    eq(alt[3], "Día 4 · sin lugares", "día vacío");
    eq(await page.locator(".trip-timeline__band").getAttribute("role"), "img", "role");
    ok(/4 días/.test((await page.locator(".trip-timeline__band").getAttribute("aria-label")) ?? ""), "aria-label de la banda");
    eq(await page.locator(".trip-timeline__header .evidence-mark").count(), 1, "marcador ◇ de la banda");
    eq(await page.locator(".trip-timeline a, .trip-timeline button, .trip-timeline [tabindex]").count(), 0, "tabstops en la banda");
    const cityVisible = await page.locator(".trip-timeline__segment").nth(1).innerText();
    ok(cityVisible.length > 0, "segmento sin texto visible");
  });
  await shot(page, "resumen-390");

  // ── D enlaces
  const history0 = await page.evaluate(() => history.length);
  const URL0 = page.url();
  const CARDS = [
    ["visitas", "Ver Visitas en Días", "Días", "Viaje"],
    ["traslados", "Ver traslados registrados en Días", "Días", "Viaje"],
    ["alojamiento", "Ver Alojamiento en Dónde dormir", "Dónde dormir", null],
    ["rango", "Ver Rango del viaje en Días", "Días", "Viaje"],
  ];
  for (const [key, label, tab, h2] of CARDS) {
    await ck(`D-${key}`, `«${label}»: botón con nombre accesible, teclado, destino «${tab}», foco en su h2`, async () => {
      await goTab(page, "Resumen");
      await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
      const button = page.getByRole("button", { name: label });
      eq(await button.count(), 1, "botón único");
      eq(await button.evaluate((el) => el.tagName), "BUTTON", "tag");
      ok(!/→\s*$/.test(await button.innerText()), "flecha final");
      const box = await button.boundingBox();
      ok(box.height >= 44 - 0.5 && box.width >= 44 - 0.5, `objetivo táctil ${box.width}×${box.height}`);
      await button.focus();
      ok(await button.evaluate((el) => el === document.activeElement), "foco en el botón");
      await page.keyboard.press(key === "traslados" ? "Space" : "Enter");
      await page.waitForFunction(
        (t) => document.querySelector(".viaje-nav__item[aria-pressed='true']")?.textContent?.includes(t),
        tab
      );
      await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === "H2", null, { timeout: 8000 });
      const active = await page.evaluate(() => ({
        tag: document.activeElement.tagName,
        text: document.activeElement.textContent.trim(),
        id: document.activeElement.id,
      }));
      if (h2) eq(active.text, h2, "h2 enfocado de Días");
      else eq(active.id, "zone-panel-title", "h2 de Dónde dormir");
      eq(await page.evaluate(() => history.length), history0, "pila de historial");
      eq(page.url(), URL0, "URL");
    });
  }
  await ck("D05", "retorno a sub-pestañas previas intacto: Días · Reservas · Resumen siguen abriendo", async () => {
    await goTab(page, "Reservas");
    await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
    await goTab(page, "Resumen");
    await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
    await goTab(page, "Días");
    await page.waitForSelector(".day-timeline");
    eq(await page.evaluate(() => history.length), history0, "pila de historial");
  });
  await ck("E01", "escrituras NUEVAS = 0: sólo la clave de siempre, con el valor idéntico, y nada al leer la banda", async () => {
    // Medido también en la base 1444e67: cada montaje de una sub-pestaña del planificador vuelve a
    // persistir el borrador idéntico (2 × `setItem` de `nihon.manualPlanningDraft`, comportamiento de
    // `usePlanningDraft` desde B27). B31 no lo toca: aquí se exige que no aparezca NINGUNA clave ni valor
    // nuevo y que permanecer en Resumen/Reservas (leer la banda) no escriba nada.
    const all = await writes(page);
    const allowed = new Set([DRAFT_KEY, "nihon.zoneComparison.v1"]);
    ok(all.every((w) => allowed.has(w.k)), `claves nuevas: ${[...new Set(all.map((w) => w.k))]}`);
    ok(all.filter((w) => w.k === DRAFT_KEY).every((w) => w.v === baselineDraft), "el borrador cambió de valor");
    eq(await page.evaluate((k) => JSON.stringify(JSON.parse(localStorage.getItem(k)).days.map((d) => d.id)), DRAFT_KEY), JSON.stringify(["d1", "d2", "d3", "d4"]), "ids de día estables");
  });
  await ck("E02", "en reposo sobre Reservas y sobre Resumen (leer, recorrer la banda con el puntero) = 0 escrituras", async () => {
    for (const tab of ["Reservas", "Resumen"]) {
      await goTab(page, tab);
      await page.locator("h2#sequence-builder-title", { hasText: tab }).waitFor();
      await page.waitForTimeout(500);
      await resetWrites(page);
      if (tab === "Resumen") await page.locator(".trip-timeline__segment").nth(1).hover();
      await page.waitForTimeout(600);
      eq(await writes(page), [], `escrituras en reposo sobre ${tab}`);
    }
  });
  await context.close();
}

// ─────────────────────────────── C estado «unavailable»
{
  const { context, page } = await boot(M, { saved: [] });
  await openViaje(page);
  await ck("C03", "sin reparto por días: una sola tarjeta con el texto existente, sin banda ni enlaces ni nota", async () => {
    await goTab(page, "Resumen");
    await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
    eq(await page.locator(".trip-summary--unavailable").count(), 1, "estado unavailable");
    ok((await surface(page).innerText()).includes("Crea un reparto por días para describir el plan completo sin borrar sus límites."), "texto existente");
    eq(await page.locator(".trip-timeline").count(), 0, "banda");
    eq(await surface(page).locator("button").count(), 0, "enlaces");
    eq(await surface(page).locator(".trip-summary-card").count(), 0, "tarjetas");
  });
  await context.close();
}

// ─────────────────────────────── F layout en 8 anchos
for (const width of VIEWPORTS) {
  const { context, page } = await boot({ width, height: 900 }, { saved: PLAN.routeIds, plan: PLAN });
  await openViaje(page);
  await ck(`F-${width}`, `${width}px: Reservas y Resumen sin scroll horizontal; banda y tarjetas contenidas`, async () => {
    await goTab(page, "Reservas");
    await page.locator("h2#sequence-builder-title", { hasText: "Reservas" }).waitFor();
    const r = await overflow(page);
    ok(!r.page && !r.panel && !r.surface, `overflow Reservas: ${JSON.stringify(r)}`);
    await goTab(page, "Resumen");
    await page.locator("h2#sequence-builder-title", { hasText: "Resumen" }).waitFor();
    const s = await overflow(page);
    ok(!s.page && !s.panel && !s.surface, `overflow Resumen: ${JSON.stringify(s)}`);
    const box = await page.locator(".trip-timeline__band").boundingBox();
    const area = await surface(page).boundingBox();
    ok(box.x >= area.x - 1 && box.x + box.width <= area.x + area.width + 1, "banda dentro de la superficie");
    const cards = await page.locator(".trip-summary-card").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    ok(cards.every((w) => w >= Math.min(264, area.width) - 1), `tarjeta < 264 px: ${cards}`);
    for (const b of await page.locator(".trip-summary-card__link").all()) {
      const bb = await b.boundingBox();
      ok(bb.height >= 43.5, `objetivo táctil ${bb.height}`);
    }
    if (width <= 430) {
      const lefts = await page.locator(".trip-summary-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      ok(new Set(lefts).size === 1, `una columna en teléfono: ${lefts}`);
    }
    await shot(page, `resumen-${width}`);
  });
  await context.close();
}

await ck("G01", "consola limpia (sin errores ni excepciones propias)", async () => {
  const own = [...consoleErrors, ...pageErrors].filter((e) => !/Failed to load resource|net::ERR|204/.test(e));
  ok(own.length === 0, own.slice(0, 3).join(" | "));
});

await browser.close();
await server.close();
console.log(`\nB31 gate (${BROWSER}${REDUCED ? ", reduced-motion" : ""}): ${pass} OK, ${failures.length} FAIL`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
