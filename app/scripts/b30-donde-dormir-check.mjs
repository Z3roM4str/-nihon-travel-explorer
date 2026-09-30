import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate permanente de B30 — B9.4 «Dónde dormir» (`docs/BLOCK_30_MISSION.md`). Comportamiento real
 * sobre la build de producción (`npm run build` antes). Línea Claude: continúa B29.
 *
 *   A numerales   ni índice de tarjeta, de columna, de pin ni de contrastes; pin con nombre de zona.
 *   B zonas       16 zonas (Tokio 6, Kioto 5, Osaka 5), cada una con espacio fotográfico role=img.
 *   C registros   ◼ Hechos (chips), ◇ Calculado (fondo sunken), ✎ Nihon dice (font-voice): marca + texto.
 *   D encuadre    una única línea de encuadre «◇ Ordenadas por cercanía a vuestros sitios guardados».
 *   E escrituras  abrir / comparar / cerrar = 0; elegir = 1 escritura del borrador; ninguna clave nueva.
 *   F acciones    «Dormir aquí» / «Zona elegida» + «Quitar»; aria-label nombra la zona; foco no se pierde.
 *   G comparar    máximo 4; apilado en teléfono.
 *   H layout      320/360/390/430/768/840/1200/1440: sin scroll horizontal, objetivos ≥44 px.
 *   I teclado     checkbox y «Dormir aquí» operables, foco visible.
 *   J ficha       desde una zona: apila PlaceDetail, chevron «‹ Dónde dormir», retorno exacto al modo.
 *   K consola     sin errores propios.
 *
 * Uso: `npm run build && NIHON_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/b30-donde-dormir-check.mjs`
 *      `NIHON_BROWSER=webkit` ejecuta el mismo gate en WebKit (si está instalado).
 * Capturas opcionales: `NIHON_B30_SHOTS=<dir>`.
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const executablePath = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const SHOTS = process.env.NIHON_B30_SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const APP = fileURLToPath(new URL("..", import.meta.url));
const DRAFT_KEY = "nihon.manualPlanningDraft";
const EXPECTED = { Tokio: 6, Kioto: 5, Osaka: 5 };
const VIEWPORTS = [320, 360, 390, 430, 768, 840, 1200, 1440];

const places = JSON.parse(readFileSync(new URL("../src/data/places.json", import.meta.url), "utf8"));
const byHub = (hub) => places.filter((p) => p.hub === hub).map((p) => p.id);
const SAVED = [...byHub("Tokio").slice(0, 4), ...byHub("Kioto").slice(0, 3), ...byHub("Osaka").slice(0, 3)];

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
const consoleErrors = [];
const pageErrors = [];

async function boot(viewport, { saved = SAVED } = {}) {
  const context = await browser.newContext({ viewport });
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
    ({ saved: ids }) => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
        window.__writes = [];
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          window.__writes.push(k);
          return original.call(this, k, v);
        };
        if (sessionStorage.getItem("b30-seeded")) return;
        localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(ids));
        sessionStorage.setItem("b30-seeded", "1");
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    { saved }
  );
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".national-start__hub, .place-card", { timeout: 15000 });
  return { context, page };
}

const writes = (page) => page.evaluate(() => window.__writes.slice());
/** Claves que la app ya escribe en la base 52fbc6b al entrar en Viaje; B30 no puede añadir ninguna. */
const KNOWN_KEYS = new Set(["nihon.zoneComparison.v1", "nihon.travellers.v1", "nihon.savedPlaceIds", DRAFT_KEY]);
const draftWrites = async (page) => (await writes(page)).filter((k) => k === DRAFT_KEY).length;
const resetWrites = (page) => page.evaluate(() => (window.__writes.length = 0));

/** Explorar → ciudad → Viaje › Dónde dormir (la ciudad activa gobierna las zonas). */
async function openZones(page, hub) {
  const start = page.locator(`.national-start__hub:has-text('${hub}')`);
  if (await start.count()) await start.first().click();
  else {
    await page.click(".tab-bar__item:has-text('Explorar'):visible, .nav-rail__item:has-text('Explorar'):visible");
    const tab = page.getByRole("tab", { name: hub });
    if (await tab.count()) await tab.first().click();
    else await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  }
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await resetWrites(page);
  await page.click(".tab-bar__item:has-text('Viaje'):visible, .nav-rail__item:has-text('Viaje'):visible");
  await page.click(".viaje-nav__item:has-text('Dónde dormir')");
  await page.waitForSelector(".zone-panel--embedded .zone-card", { timeout: 15000 });
}

const overflow = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const panel = document.querySelector(".zone-panel__scroll");
    return {
      page: doc.scrollWidth > doc.clientWidth + 1,
      panel: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
    };
  });

async function openCompare(page, n = 2) {
  const boxes = page.locator(".zone-card__compare input[type='checkbox']");
  for (let i = 0; i < n; i += 1) await boxes.nth(i).check();
  await page.click(".zone-panel__foot .button--primary");
  await page.waitForSelector(".zone-compare");
}

// ───────────────────────────── A–D · estructura por ciudad (teléfono) ─────────────────────────────
let total = 0;
const perHub = {};
for (const hub of Object.keys(EXPECTED)) {
  // Una sesión limpia por ciudad: la ciudad activa gobierna las zonas (`App.tsx` zonesHub).
  const boot1 = await boot({ width: 390, height: 844 });
  const p1 = boot1.page;
  await openZones(p1, hub);
  const n = await p1.locator(".zone-card").count();
  perHub[hub] = n;
  total += n;
  await ck("B", `${hub}: ${EXPECTED[hub]} zonas, cada una con espacio fotográfico`, async () => {
    eq(n, EXPECTED[hub], "zonas");
    const photos = await p1.locator(".zone-card .zone-card__photo .photo-placeholder[role='img']").count();
    eq(photos, n, "espacios fotográficos");
    const info = await p1.$$eval(".zone-card", (cards) =>
      cards.map((card) => {
        const ph = card.querySelector(".photo-placeholder");
        const h3 = card.querySelector("h3")?.textContent?.trim() ?? "";
        const box = card.querySelector(".zone-card__photo").getBoundingClientRect();
        return { label: ph?.getAttribute("aria-label") ?? "", h3, h: box.height, w: box.width, img: !!card.querySelector("img") };
      })
    );
    for (const z of info) {
      ok(z.label.startsWith(z.h3), `nombre accesible no nombra la zona: ${z.label}`);
      ok(z.label.includes("Fotografía pendiente"), `placeholder sin etiqueta pendiente: ${z.label}`);
      ok(z.h >= 100 && z.w > 200, `espacio fotográfico sin tamaño: ${z.w}×${z.h}`);
      ok(!z.img, "una zona muestra <img>: no hay foto de zona en el dataset");
    }
  });
  await ck("A", `${hub}: sin numerales de posición en las tarjetas`, async () => {
    eq(await p1.locator(".zone-card__index, .zone-column__index").count(), 0, "índices");
    const heads = await p1.$$eval(".zone-card__head", (els) => els.map((el) => el.firstElementChild?.className ?? ""));
    for (const cls of heads) ok(cls.includes("zone-card__title"), `primer hijo de la cabecera: ${cls}`);
    const digitOnly = await p1.$$eval(".zone-card *", (els) =>
      els.filter((el) => el.children.length === 0 && /^\s*\d{1,2}\s*$/.test(el.textContent ?? "") && !el.closest(".zone-fact")).length
    );
    eq(digitOnly, 0, "elementos hoja que son sólo un número");
  });
  await ck("C", `${hub}: registros ◼ y ◇ visibles en la tarjeta`, async () => {
    const facts = await p1.locator(".zone-card .zone-register--fact").count();
    eq(facts, n, "bloques de hechos");
    const glyphs = await p1.$$eval(".zone-card .zone-register--fact > .evidence-mark", (els) => els.map((e) => e.textContent.trim()));
    for (const g of glyphs) ok(g.startsWith("◼") && /Verificado/.test(g), `hechos sin ◼ + texto: ${g}`);
    const calc = await p1.$$eval(".zone-card .zone-register--calc", (els) =>
      els.map((e) => ({ text: e.textContent, bg: getComputedStyle(e).backgroundColor }))
    );
    ok(calc.length > 0, "ninguna zona con cálculo con lugares guardados");
    const sunken = await p1.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.background = "var(--surface-sunken)";
      document.body.appendChild(probe);
      const bg = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return bg;
    });
    for (const c of calc) {
      ok(c.text.includes("◇") && /calculado/.test(c.text), `calculado sin ◇ + texto: ${c.text}`);
      eq(c.bg, sunken, "fondo de Calculado ≠ --surface-sunken");
    }
    const neutral = await p1.$$eval(".zone-card .zone-fact", (els) => els.map((e) => getComputedStyle(e).backgroundColor));
    eq(new Set(neutral).size, 1, "los chips de hechos no son neutros (varios fondos)");
  });
  await ck("D", `${hub}: una sola línea de encuadre con ◇ y aclaración de línea recta`, async () => {
    const notes = await p1.locator(".zone-panel__note").allInnerTexts();
    eq(notes.length, 1, "notas de encuadre");
    ok(/Ordenadas por cercanía a vuestros sitios guardados/.test(notes[0]), `texto: ${notes[0]}`);
    ok(/línea recta/.test(notes[0]), "falta aclaración de línea recta");
    eq(await p1.locator(".zone-panel__note .evidence-mark[aria-label='Estimado']").count(), 1, "marca ◇");
    eq(await p1.locator(".zone-panel__sub").count(), 0, "subtítulo de encuadre duplicado en navegación");
    const order = await p1.evaluate(() => {
      const note = document.querySelector(".zone-panel__note");
      const banner = document.querySelector(".zone-choice-banner");
      return !!(note && banner && note.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    ok(order, "el banner debe ir después de la nota de orden");
  });
  await ck("A", `${hub}: sin lenguaje de ranking`, async () => {
    const text = await p1.locator(".zone-panel").innerText();
    ok(!/recomendad|ranking|ganador|mejor zona|te conviene/i.test(text), "lenguaje prohibido");
    const mejor = text.match(/.{20}mejor.{20}/gi) ?? [];
    for (const m of mejor) ok(/ninguna es/i.test(m) || /"la mejor"/i.test(m), `«mejor» fuera de la negación: ${m}`);
  });
  await boot1.context.close();
}
await ck("B", "16 zonas en total (Tokio 6, Kioto 5, Osaka 5)", async () => eq(total, 16, `zonas ${JSON.stringify(perHub)}`));

// ───────────────────────────── E/F · escrituras, acciones, foco, anuncio ─────────────────────────────
const { context: c1, page: p1 } = await boot({ width: 390, height: 844 });
await openZones(p1, "Tokio");
await ck("E", "abrir «Dónde dormir» no escribe el borrador ni claves nuevas", async () => {
  const w = await writes(p1);
  ok(!w.includes(DRAFT_KEY), `el borrador se escribió al abrir: ${JSON.stringify(w)}`);
  for (const k of w) ok(KNOWN_KEYS.has(k), `clave nueva al abrir: ${k}`);
});
await ck("E", "marcar, comparar y volver no escribe", async () => {
  await openCompare(p1, 3);
  await p1.click(".zone-panel__foot .button--secondary");
  await p1.waitForSelector(".zone-card");
  await p1.locator(".zone-card__compare input").first().uncheck();
  eq((await writes(p1)).filter((k) => k === DRAFT_KEY), [], "escrituras del borrador");
});
await ck("E", "la selección para comparar no usa claves nuevas", async () => {
  const keys = new Set(await writes(p1));
  for (const k of keys) ok(KNOWN_KEYS.has(k), `clave ajena: ${k}`);
  ok(!keys.has(DRAFT_KEY), "el borrador se escribió sin elegir");
});
await resetWrites(p1);
const buttonFor = (page, name) => page.getByRole("button", { name: `Dormir aquí en ${name}` });
const firstName = (await p1.locator(".zone-card h3").first().innerText()).trim();
const secondName = (await p1.locator(".zone-card h3").nth(1).innerText()).trim();
await ck("F", "«Dormir aquí» nombra la zona y elegir escribe UNA vez el borrador", async () => {
  ok(await buttonFor(p1, firstName).count(), "botón «Dormir aquí en …» ausente");
  eq(await p1.getByRole("button", { name: /^Usar .* en el plan$/ }).count(), 0, "texto antiguo");
  await buttonFor(p1, firstName).click();
  await p1.waitForTimeout(300);
  eq(await draftWrites(p1), 1, "escrituras del borrador al elegir");
  const draft = await p1.evaluate((k) => JSON.parse(localStorage.getItem(k)), DRAFT_KEY);
  eq(draft.version, 8, "versión del borrador");
  eq(draft.zoneAccommodationChoices.length, 1, "elecciones");
  const keys = new Set(await writes(p1));
  for (const k of keys) ok(KNOWN_KEYS.has(k), `clave ajena: ${k}`);
});
await ck("F", "elegida: insignia «Zona elegida» + «Quitar»; las demás siguen en «Dormir aquí»", async () => {
  const card = p1.locator(".zone-card", { has: p1.locator("h3", { hasText: firstName }) }).first();
  ok(/Zona elegida/.test(await card.locator(".zone-choice-badge").innerText()), "sin insignia");
  eq((await card.locator(".zone-choice-action__button").innerText()).trim(), "Quitar", "texto del botón");
  eq(await card.locator(".zone-choice-action__button").getAttribute("aria-label"), `Quitar ${firstName} del plan`, "aria-label");
  const others = (await p1.locator(".zone-card").count()) - 1;
  eq(await p1.getByRole("button", { name: /^Dormir aquí en / }).count(), others, "«Dormir aquí» en las demás");
  eq(await p1.getByRole("button", { name: /^Cambiar/ }).count(), 0, "«Cambiar…» ya no existe");
});
await ck("F", "el foco no se pierde al elegir y el cambio se anuncia cortésmente", async () => {
  const active = await p1.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, label: el?.getAttribute("aria-label") };
  });
  eq(active.tag, "BUTTON", "elemento con foco");
  eq(active.label, `Quitar ${firstName} del plan`, "el foco sigue en el mismo botón de la zona");
  const live = await p1.locator(".zone-choice-banner[role='status']").innerText();
  ok(live.includes(firstName), "el anuncio no nombra la zona");
});
await ck("F", "elegir otra zona escribe UNA vez y reemplaza la elección", async () => {
  await resetWrites(p1);
  await buttonFor(p1, secondName).click();
  await p1.waitForTimeout(300);
  eq(await draftWrites(p1), 1, "escrituras");
  const draft = await p1.evaluate((k) => JSON.parse(localStorage.getItem(k)), DRAFT_KEY);
  eq(draft.zoneAccommodationChoices.length, 1, "una elección por ciudad");
});
await ck("F", "«Quitar» devuelve la zona a «Dormir aquí» conservando el foco", async () => {
  await p1.getByRole("button", { name: `Quitar ${secondName} del plan` }).click();
  await p1.waitForTimeout(300);
  eq(await p1.locator(".zone-choice-badge").count(), 0, "insignias");
  const label = await p1.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  eq(label, `Dormir aquí en ${secondName}`, "foco tras quitar");
  ok(/Aún no habéis elegido zona/.test(await p1.locator(".zone-choice-banner").innerText()), "anuncio de estado vacío");
});

// ───────────────────────────── G · comparar (máx. 4, bloques apilados, registros) ─────────────────────────────
await ck("G", "máximo 4: la quinta casilla queda desactivada", async () => {
  const boxes = p1.locator(".zone-card__compare input[type='checkbox']");
  for (let i = 0; i < 4; i += 1) await boxes.nth(i).check();
  ok(await boxes.nth(4).isDisabled(), "la quinta casilla debería estar desactivada");
  eq(await boxes.nth(4).getAttribute("aria-label"), `Comparar ${(await p1.locator(".zone-card h3").nth(4).innerText()).trim()}`, "aria-label de la casilla");
  ok(/4 de 4/.test(await p1.locator(".zone-panel__count").innerText()), "contador");
  await p1.click(".zone-panel__foot .button--primary");
  await p1.waitForSelector(".zone-compare");
  eq(await p1.locator(".zone-column").count(), 4, "columnas");
});
await ck("A", "comparar: sin índices en columnas, contrastes ni pin; el pin lleva el nombre de la zona", async () => {
  eq(await p1.locator(".zone-column__index").count(), 0, "índices de columna");
  const names = await p1.$$eval(".zone-column h3", (els) => els.map((e) => e.textContent.trim()));
  const rows = await p1.$$eval(".zone-contrast__zone", (els) => els.map((e) => e.textContent.trim()));
  for (const r of rows) ok(names.includes(r), `fila de contraste no es un nombre de zona: «${r}»`);
  const pins = await p1.$$eval(".zone-marker", (els) =>
    els.filter((e) => e.querySelector(".zone-marker__pin")).map((e) => ({ pin: e.querySelector(".zone-marker__pin").textContent.trim(), label: e.querySelector(".zone-marker__label")?.textContent.trim() }))
  );
  eq(pins.length, 4, "pines de zona");
  for (const pin of pins) {
    eq(pin.pin, "", "el pin no lleva numeral");
    ok(names.includes(pin.label), `etiqueta del pin: ${pin.label}`);
  }
});
await ck("C", "comparar: ◼ Hechos, ◇ Calculado y ✎ Nihon dice se distinguen por marca + texto + estilo", async () => {
  const col = p1.locator(".zone-column").first();
  ok(/◼/.test(await col.locator(".zone-register--fact").innerText()) && /verificado/i.test(await col.locator(".zone-register--fact").innerText()), "hechos");
  const calc = col.locator(".zone-register--calc");
  ok(/◇/.test(await calc.innerText()) && /calculado/i.test(await calc.innerText()), "calculado");
  const voice = col.locator(".zone-register--voice").last();
  ok(/✎/.test(await voice.innerText()) && /nihon dice/i.test(await voice.innerText()), "nihon dice");
  const fonts = await col.evaluate((el) => {
    const v = el.querySelector(".zone-register--voice li");
    const probe = document.createElement("span");
    probe.style.fontFamily = "var(--font-voice)";
    document.body.appendChild(probe);
    const voiceFamily = getComputedStyle(probe).fontFamily;
    probe.remove();
    return { li: getComputedStyle(v).fontFamily, voiceFamily, size: getComputedStyle(v).fontSize };
  });
  eq(fonts.li, fonts.voiceFamily, "A cambio no usa --font-voice");
  eq(fonts.size, "19px", "A cambio no usa --type-quote");
  const hexes = await col.evaluate((el) => {
    const bg = (s) => getComputedStyle(el.querySelector(s)).backgroundColor;
    return [bg(".zone-register--fact"), bg(".zone-register--calc"), bg(".zone-register--voice:last-of-type")];
  });
  ok(hexes[1] !== hexes[0], "Calculado debe diferenciarse del fondo de Hechos por --surface-sunken");
});
await ck("G", "comparar en teléfono: bloques apilados (una columna) sin scroll horizontal", async () => {
  const xs = await p1.$$eval(".zone-column", (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  eq(new Set(xs).size, 1, "columnas en una sola pila");
  const o = await overflow(p1);
  ok(!o.page && !o.panel, JSON.stringify(o));
});

// ───────────────────────────── J · ficha desde zona y retorno exacto ─────────────────────────────
await ck("J", "abrir un lugar desde una zona apila la ficha; el chevron dice «‹ Dónde dormir»; vuelve al modo comparar", async () => {
  const nearest = p1.locator(".zone-nearest button");
  ok((await nearest.count()) > 0, "ninguna zona lista lugares cercanos");
  await resetWrites(p1);
  await nearest.first().click();
  await p1.waitForSelector(".place-detail");
  const back = await p1.locator(".place-detail").getByRole("button", { name: /Dónde dormir/ }).first().getAttribute("aria-label");
  ok(/Dónde dormir/.test(back ?? ""), `chevron: ${back}`);
  await p1.locator(".place-detail").getByRole("button", { name: /Dónde dormir/ }).first().click();
  await p1.waitForSelector(".place-detail", { state: "detached" });
  ok(await p1.locator(".zone-compare").isVisible(), "no vuelve al modo comparar");
  eq(await p1.locator(".zone-column").count(), 4, "columnas tras volver");
  eq(await draftWrites(p1), 0, "abrir/cerrar la ficha escribió el borrador");
});
if (SHOTS) await p1.screenshot({ path: `${SHOTS}/compare-390.png`, fullPage: false });
await c1.close();

// ───────────────────────────── I · teclado y foco visible ─────────────────────────────
{
  const { context, page } = await boot({ width: 1200, height: 900 });
  await openZones(page, "Kioto");
  await ck("I", "la casilla «Comparar» y «Dormir aquí» se operan con teclado y muestran foco", async () => {
    const box = page.locator(".zone-card__compare input").first();
    await box.focus();
    await page.keyboard.press("Space");
    ok(await box.isChecked(), "Espacio no marca la casilla");
    await page.keyboard.press("Space");
    ok(!(await box.isChecked()), "Espacio no desmarca la casilla");
    const btn = page.getByRole("button", { name: /^Dormir aquí en / }).first();
    await page.keyboard.press("Tab"); // desde el chip/casilla hasta el siguiente foco
    await btn.focus();
    const ring = await btn.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, w: parseFloat(s.outlineWidth), shadow: s.boxShadow };
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    ok((ring.outline !== "none" && ring.w > 0) || ring.shadow !== "none", `sin indicador de foco: ${JSON.stringify(ring)}`);
    await resetWrites(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    eq(await draftWrites(page), 1, "Enter en «Dormir aquí» debe escribir una vez");
    const still = await page.evaluate(() => document.activeElement?.textContent?.trim());
    eq(still, "Quitar", "el foco queda en «Quitar» de la misma zona");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    eq(await page.locator(".zone-choice-badge").count(), 0, "Enter sobre «Quitar» no quita la zona");
  });
  await ck("I", "orden de foco lógico: título → casilla → acción dentro de cada tarjeta", async () => {
    const order = await page.evaluate(() => {
      const card = document.querySelector(".zone-card");
      const focusables = [...card.querySelectorAll("a[href], button, input, summary")];
      return focusables.map((e) => (e.matches("input") ? "casilla" : e.matches("button") ? "accion" : "otro"));
    });
    ok(order.indexOf("casilla") < order.lastIndexOf("accion"), JSON.stringify(order));
  });
  await context.close();
}

// ───────────────────────────── H · layout en 8 anchos ─────────────────────────────
for (const width of VIEWPORTS) {
  const { context, page } = await boot({ width, height: 900 });
  await openZones(page, "Tokio");
  await ck("H", `${width}px: lista sin scroll horizontal y objetivos ≥44 px`, async () => {
    const o = await overflow(page);
    ok(!o.page && !o.panel, JSON.stringify(o));
    const small = await page.$$eval(".zone-card__compare, .zone-choice-action__button, .zone-panel__foot .button--primary", (els) =>
      els
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && Math.min(r.width, r.height) + 0.5 < 44)
        .map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`)
    );
    eq(small, [], "objetivos pequeños");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}.png` });
  });
  await ck("H", `${width}px: comparar 4 zonas sin scroll horizontal`, async () => {
    await openCompare(page, 4);
    const o = await overflow(page);
    ok(!o.page && !o.panel, JSON.stringify(o));
    const tiny = await page.$$eval(".zone-compare button, .zone-compare summary", (els) =>
      els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.height + 0.5 < 44).length
    );
    eq(tiny, 0, "botones de la comparación < 44 px de alto");
    if (width <= 430) {
      const xs = await page.$$eval(".zone-column", (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      eq(new Set(xs).size, 1, "columnas apiladas en teléfono");
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/compare-${width}.png` });
  });
  await context.close();
}

await ck("K", "consola sin errores propios", async () => {
  const own = [...consoleErrors, ...pageErrors].filter((t) => !/ERR_|tile\.openstreetmap|Failed to load resource/.test(t));
  eq(own, [], "errores de consola");
});

await browser.close();
await server.close();
console.log(`\nB30 (${BROWSER}): ${pass} OK, ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
