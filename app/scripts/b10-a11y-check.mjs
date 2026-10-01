import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate B10.2 — accesibilidad por pantalla (`docs/B10_POLISH_MISSION.md` §Accesibilidad; `03 §7`, `04`, `08` G5).
 *
 * Recorre cada pantalla del producto (no componentes aislados) en 390×844 y 1200×900 y mide en el navegador:
 *   · nombre accesible de todo control interactivo visible; ids duplicados; `aria-*` que apuntan a ids inexistentes;
 *     controles enfocables dentro de `aria-hidden="true"`; `img` sin `alt`; `lang` y `title` del documento;
 *   · áreas táctiles ≥ 44 px (la caja pintada o el `::after` de `.tap-target-min`, `03 §7`), con una lista de EXCEPCIONES
 *     fijada y justificada (trinquete: una excepción nueva falla);
 *   · foco visible en el recorrido por Tab de cada pantalla;
 *   · modalidad de `Sheet` y de la ficha: `role=dialog`, `aria-modal`, nombre, foco dentro, Escape cierra y el foco vuelve;
 *   · estructura: un único `main`, un único `h1` (primero), sin saltos de nivel y sin `h2` que repita el `h1` (B10-A1…A3, cerrados);
 *     zoom de Leaflet con área táctil de 44 px (B10-A4, cerrado).
 *
 * No afirma equivalencia con VoiceOver/TalkBack: es una medición programática de DOM/estilos computados en Chromium y WebKit.
 * Uso: `npm run build && node scripts/b10-a11y-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const APP = fileURLToPath(new URL("..", import.meta.url));

/**
 * Controles <44 px que NO se corrigen, con motivo. Clave: `selector` (clase CSS de la parte pintada).
 *  `A.` sin clase: enlaces de atribución del mapa (Leaflet / OSM), texto legal en línea (exento como enlace en línea de un párrafo).
 * Los botones de zoom de Leaflet YA NO son excepción (B10-A4 cerrado): `PlaceMap.css` amplía su área táctil a 44×44 hacia fuera,
 * sin solaparse, y este gate lo mide (el `::after` absoluto cuenta como área de impacto).
 */
const TARGET_EXCEPTIONS = [/^A\.$/ /* enlaces de atribución del mapa (Leaflet / OSM) */];

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
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : undefined;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()}`);

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

async function boot(width, height, seeded = true) {
  const context = await browser.newContext({ viewport: { width, height } });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(({ plan, seed }) => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (!seed || sessionStorage.getItem("a11y-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("a11y-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, { plan: PLAN, seed: seeded });
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}
const nav = (page, name) => page.locator(`.tab-bar__item:has-text('${name}'):visible, .nav-rail__item:has-text('${name}'):visible`).first();

/** Medición en página. */
const probe = (page) =>
  page.evaluate(() => {
    const vis = (el) => el.checkVisibility?.({ checkVisibilityCSS: true, visibilityProperty: true }) ?? true;
    const nameOf = (el) => {
      const lb = el.getAttribute("aria-labelledby");
      if (lb) return lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
      const own = el.getAttribute("aria-label") || (el.labels ? [...el.labels].map((l) => l.textContent).join(" ") : "");
      if (own && own.trim()) return own.replace(/\s+/g, " ").trim();
      return (el.textContent || el.getAttribute("title") || el.getAttribute("alt") || el.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
    };
    const sel = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[tabindex]:not([tabindex='-1'])";
    const inter = [...document.querySelectorAll(sel)].filter(vis);
    const noName = inter.filter((e) => !nameOf(e)).map((e) => `${e.tagName}.${e.className}`.slice(0, 90));
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const broken = [...document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls]")].flatMap((e) =>
      ["aria-labelledby", "aria-describedby", "aria-controls"].flatMap((a) =>
        (e.getAttribute(a) || "").split(/\s+/).filter(Boolean).filter((id) => !document.getElementById(id)).map((id) => `${a}=${id}`)
      )
    );
    const hiddenFocus = [...document.querySelectorAll("[aria-hidden=true]")]
      .flatMap((h) => [...h.querySelectorAll(sel)])
      .filter((e) => vis(e) && !e.disabled)
      .map((e) => `${e.tagName}.${e.className}`.slice(0, 90));
    const small = inter
      .filter((e) => !(e.tagName === "A" && e.closest("p,li,span,small,dd")) && !["checkbox", "radio"].includes(e.type))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // `.tap-target-min` agranda el área real con un ::after de max(100%, 44px) (03 §7, App.css); también cualquier ::after absoluto que lo reproduzca (p. ej. `.gallery__credits`).
        const after = getComputedStyle(e, "::after");
        const grows = after.content !== "none" && after.position === "absolute";
        const hit = grows ? { w: Math.max(r.width, parseFloat(after.width) || 0), h: Math.max(r.height, parseFloat(after.height) || 0) } : { w: r.width, h: r.height };
        return hit.w < 43.5 || hit.h < 43.5;
      })
      .map((e) => `${e.tagName}.${e.className.toString().trim().split(/\s+/)[0] ?? ""}`);
    const landmarks = [...document.querySelectorAll("main,[role=main],nav,[role=navigation],aside,[role=complementary]")].filter(vis).map((e) => e.getAttribute("role") || e.tagName.toLowerCase());
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(vis);
    const levels = headings.map((e) => Number(e.tagName[1] ?? e.getAttribute("aria-level")));
    const clean = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").replace(/[·:]\s*$/, "").trim();
    const h1Text = headings.filter((e) => e.tagName === "H1").map(clean);
    const dupHeading = headings.filter((e) => e.tagName === "H2" && h1Text.includes(clean(e))).map(clean);
    const imgsNoAlt = [...document.querySelectorAll("img:not([alt])")].filter(vis).length;
    return { noName, dup, broken, hiddenFocus, small, landmarks, levels, dupHeading, imgsNoAlt, lang: document.documentElement.lang, title: document.title };
  });

/** Pantallas: cada una deja la página en ese estado. */
const SCREENS = [
  ["explorar-portada", async (p) => { await nav(p, "Explorar").click(); }],
  ["explorar-ciudad", async (p) => { await p.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click(); await p.waitForSelector(".place-card", { timeout: 15000 }); }],
  ["ciudad-filtros", async (p) => { await p.getByRole("button", { name: /Filtros/ }).first().click(); await p.locator(".sheet").first().waitFor(); }, async (p) => { await p.keyboard.press("Escape"); }],
  ["ciudad-mapa", async (p) => { const b = p.getByRole("button", { name: /^Mapa$/ }); if (await b.count()) await b.first().click(); await p.waitForTimeout(600); }, async (p) => { const b = p.getByRole("button", { name: /^Lista$/ }); if (await b.count()) await b.first().click(); }],
  ["ficha", async (p) => { await p.locator(".place-card").first().locator("button").first().click(); await p.waitForSelector(".place-detail", { timeout: 15000 }); }, async (p) => { const b = p.locator(".place-detail__back"); if (await b.count()) await b.first().click(); else await p.keyboard.press("Escape"); }],
  ["quiero-ir", async (p) => { await nav(p, "Quiero ir").click(); }],
  ["nosotros", async (p) => { await nav(p, "Nosotros").click(); }],
  ["viaje-dias", async (p) => { await nav(p, "Viaje").click(); await p.waitForSelector(".viaje-nav", { state: "visible" }); }],
  ["viaje-dias-mover", async (p) => { await p.getByRole("button", { name: "Mover a…" }).first().click(); }],
  ["viaje-dias-otro-orden", async (p) => { await p.getByRole("button", { name: /^Probar otro orden del Día \d+$/ }).and(p.locator(":enabled")).first().click(); await p.locator(".day-order-tool").first().waitFor(); }],
  ["viaje-dormir", async (p) => { await p.locator('.viaje-nav__item:has-text("Dónde dormir")').click(); }],
  ["viaje-reservas", async (p) => { await p.locator('.viaje-nav__item:has-text("Reservas")').click(); }],
  ["viaje-resumen", async (p) => { await p.locator('.viaje-nav__item:has-text("Resumen")').click(); }],
];

/**
 * Estructura (B10-A1…A3, CERRADOS en el endurecimiento post-B10; antes eran hallazgos registrados):
 *  A1 exactamente un landmark `main` visible en cada pantalla; A2 exactamente un `h1` y el primer encabezado es el `h1`;
 *  ningún encabezado salta un nivel hacia abajo; A3 ningún `h2` repite el texto accesible del `h1`.
 */
const seen = {};
for (const [width, height] of [[390, 844], [1200, 900]]) {
  const { context, page } = await boot(width, height);
  for (const [name, enter, leave] of SCREENS) {
    await ck(`A-${width}-${name}`, `${width}px · ${name}: nombres, ids, aria, foco oculto, imágenes, lang/title`, async () => {
      await enter(page);
      await page.waitForTimeout(450);
      const r = await probe(page);
      seen[`${width}/${name}`] = r;
      ok(r.noName.length === 0, `controles sin nombre accesible: ${r.noName.slice(0, 3).join(" | ")}`);
      ok(r.dup.length === 0, `ids duplicados: ${r.dup.join(", ")}`);
      ok(r.broken.length === 0, `referencias aria rotas: ${r.broken.join(", ")}`);
      ok(r.hiddenFocus.length === 0, `enfocables dentro de aria-hidden: ${r.hiddenFocus.slice(0, 3).join(" | ")}`);
      ok(r.imgsNoAlt === 0, `${r.imgsNoAlt} img sin alt`);
      ok(r.lang === "es" && r.title.length > 0, `lang=${r.lang} title=${r.title}`);
    });
    await ck(`T-${width}-${name}`, `${width}px · ${name}: áreas táctiles ≥ 44 px (salvo excepciones registradas)`, async () => {
      const r = seen[`${width}/${name}`] ?? (await probe(page));
      const bad = r.small.filter((s) => !TARGET_EXCEPTIONS.some((re) => re.test(s)));
      ok(bad.length === 0, `controles < 44 px: ${[...new Set(bad)].slice(0, 6).join(" | ")}`);
    });
    await ck(`S-${width}-${name}`, `${width}px · ${name}: un main, un h1, orden de encabezados, nav`, async () => {
      const r = seen[`${width}/${name}`] ?? (await probe(page));
      const { levels, landmarks } = r;
      ok(landmarks.filter((l) => l === "main" || l === "main[role]").length === 1, `landmarks main visibles: ${landmarks.filter((l) => l === "main").length} (${landmarks.join(",")})`);
      ok(landmarks.includes("nav"), "sin landmark nav");
      if (levels.length) {
        ok(levels.filter((l) => l === 1).length === 1, `h1 visibles: ${levels.filter((l) => l === 1).length} (${levels.slice(0, 8)})`);
        ok(levels[0] === 1, `el primer encabezado no es h1: ${levels.slice(0, 8)}`);
        const jump = levels.findIndex((l, i) => i > 0 && l - levels[i - 1] > 1);
        ok(jump < 0, `salto de nivel hacia abajo en la posición ${jump}: ${levels.slice(Math.max(0, jump - 2), jump + 2)}`);
      }
      ok(r.dupHeading.length === 0, `h2 con el mismo nombre accesible que el h1: ${r.dupHeading.join(" | ")}`);
    });
    if (leave) await leave(page);
  }
  await context.close();
}

// ───────────── B10-A4: el toque en el área ampliada del zoom llega al botón correcto (sin solaparse)
for (const [width, height] of [[390, 844], [1200, 900]]) {
  const { context, page } = await boot(width, height);
  await ck(`Z-${width}`, `${width}px · zoom de Leaflet: 44×44 de impacto real, sin solape entre «+» y «−»`, async () => {
    await SCREENS.find((s) => s[0] === "explorar-ciudad")[1](page);
    const b = page.getByRole("button", { name: /^Mapa$/ });
    if (await b.count()) await b.first().click();
    await page.locator(".leaflet-control-zoom-in").waitFor({ state: "visible" });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const inn = document.querySelector(".leaflet-control-zoom-in");
      const out = document.querySelector(".leaflet-control-zoom-out");
      const a = inn.getBoundingClientRect();
      const c = out.getBoundingClientRect();
      const hit = (x, y) => document.elementFromPoint(x, y);
      const cx = a.left + a.width / 2;
      const pts = {
        inTop: hit(cx, a.top - 13) === inn, // 13 px por encima del «+»
        inLeft: hit(a.left - 6, a.top + a.height / 2) === inn,
        inBottom: hit(cx, a.bottom - 1) === inn,
        outTop: hit(cx, c.top + 1) === out,
        outBottom: hit(cx, c.bottom + 13) === out,
        outRight: hit(c.right + 6, c.top + c.height / 2) === out,
        gap: Math.round(c.top - a.bottom),
      };
      return pts;
    });
    ok(r.inTop && r.inLeft && r.inBottom, `«+»: ${JSON.stringify(r)}`);
    ok(r.outTop && r.outBottom && r.outRight, `«−»: ${JSON.stringify(r)}`);
  });
  await context.close();
}

// ───────────── Foco visible y orden de tabulación (390)
{
  const { context, page } = await boot(390, 844);
  for (const name of ["explorar-portada", "quiero-ir", "nosotros", "viaje-dias"]) {
    await ck(`F-${name}`, `${name}: el recorrido por Tab muestra foco visible en cada parada`, async () => {
      const screen = SCREENS.find((s) => s[0] === name);
      if (name === "viaje-dias") await nav(page, "Viaje").click();
      await screen[1](page);
      await page.waitForTimeout(400);
      await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
      const bad = [];
      for (let i = 0; i < 28; i += 1) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          // `input[type=date|time]`: la UA compone subcampos y el icono del selector dentro del control; el foco interno
          // (segmentos, ::-webkit-calendar-picker-indicator) lo pinta la propia UA y `:focus-visible` no se refleja en el anfitrión.
          if (el.tagName === "INPUT" && ["date", "time", "datetime-local"].includes(el.type)) return null;
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow && cs.boxShadow !== "none";
          const pseudo = el.matches(":focus-visible");
          return { desc: `${el.tagName}.${String(el.className).split(" ")[0]} fv=${pseudo} outline=${cs.outlineStyle}/${cs.outlineWidth}`, ok: pseudo && (outline || shadow || el.closest("label,.chip-toggle,.segmented") !== null) };
        });
        if (info && !info.ok) bad.push(info.desc);
      }
      ok(bad.length === 0, `sin indicador de foco visible: ${[...new Set(bad)].slice(0, 5).join(" | ")}`);
    });
  }
  await context.close();
}

// ───────────── Modalidad, foco y Escape
{
  const { context, page } = await boot(390, 844);
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await ck("M-sheet", "Sheet (Filtros): role=dialog + aria-modal + nombre; foco dentro; Tab atrapado; Escape cierra y devuelve el foco", async () => {
    const trigger = page.getByRole("button", { name: /Filtros/ }).first();
    await trigger.focus();
    await trigger.click();
    const dlg = page.locator(".sheet").first();
    await dlg.waitFor();
    const attrs = await dlg.evaluate((el) => ({ role: el.getAttribute("role") ?? el.closest("[role=dialog]")?.getAttribute("role"), modal: (el.closest("[aria-modal]") ?? el).getAttribute("aria-modal"), name: (el.closest("[role=dialog]") ?? el).getAttribute("aria-label") ?? document.getElementById((el.closest("[role=dialog]") ?? el).getAttribute("aria-labelledby") ?? "")?.textContent }));
    ok(attrs.role === "dialog" && attrs.modal === "true" && attrs.name, `dialog mal formado: ${JSON.stringify(attrs)}`);
    ok(await page.evaluate(() => !!document.activeElement?.closest(".sheet")), "el foco no entró en la hoja");
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      ok(await page.evaluate(() => !!document.activeElement?.closest(".sheet")), `Tab escapó de la hoja en la pulsación ${i + 1}`);
    }
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached" });
    ok(await trigger.evaluate((el) => el === document.activeElement), "el foco no volvió al disparador");
  });
  await ck("M-detail", "Ficha: Escape/volver cierra y el foco vuelve a la tarjeta de origen", async () => {
    const card = page.locator(".place-card").first().locator("button").first();
    await card.focus();
    await card.click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    const back = page.locator(".place-detail__back").first();
    ok(await back.count(), "sin botón volver");
    ok(await page.evaluate(() => !!document.activeElement?.closest(".place-detail")), "el foco no entró en la ficha");
    await back.click();
    await page.waitForSelector(".place-detail", { state: "detached" }).catch(() => {});
    ok(await page.evaluate(() => document.activeElement !== document.body), "foco perdido en body tras volver");
  });
  await ck("L-toast", "Toast: región con aria-live; el aviso se anuncia sin robar el foco", async () => {
    const heart = page.locator(".place-card__save").first();
    await heart.focus();
    await heart.click();
    await page.waitForTimeout(250);
    const live = await page.evaluate(() => {
      const r = document.querySelector(".save-toast-region");
      return r ? { live: r.getAttribute("aria-live") ?? r.querySelector("[aria-live],[role=status],[role=alert]")?.getAttribute("role"), focusKept: document.activeElement?.classList.contains("place-card__save") } : null;
    });
    ok(live && live.live, `toast sin aria-live/status: ${JSON.stringify(live)}`);
    ok(live.focusKept, "el toast robó el foco");
  });
  await context.close();
}

// ───────────── Diálogos modales restantes: lightbox de la galería y onboarding
{
  const { context, page } = await boot(1200, 900);
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await ck("M-lightbox", "Lightbox: dialog modal con nombre, foco dentro, Tab atrapado, Escape cierra y devuelve el foco", async () => {
    await page.locator(".place-card:has(.place-card__photo-count)").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(500);
    const open = page.locator('[aria-label^="Ampliar imagen"]').first();
    ok(await open.count(), "sin control para ampliar la imagen");
    await open.focus();
    await open.click();
    const dlg = page.locator(".lightbox");
    await dlg.waitFor();
    const attrs = await dlg.evaluate((el) => ({ role: el.getAttribute("role"), modal: el.getAttribute("aria-modal"), name: el.getAttribute("aria-label") }));
    ok(attrs.role === "dialog" && attrs.modal === "true" && attrs.name, `dialog mal formado: ${JSON.stringify(attrs)}`);
    ok(await page.evaluate(() => !!document.activeElement?.closest(".lightbox")), "el foco no entró en el lightbox");
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      ok(await page.evaluate(() => !!document.activeElement?.closest(".lightbox")), `Tab escapó del lightbox (${i + 1})`);
    }
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached", timeout: 3000 });
    ok(await open.evaluate((el) => el === document.activeElement), "el foco no volvió al control que abrió el lightbox");
  });
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await ck("M-onboarding", "Onboarding: dialog modal con nombre, foco dentro, Tab atrapado y Escape lo cierra", async () => {
    const dlg = page.locator(".onboarding [role=dialog], [role=dialog].onboarding__card, .onboarding").first();
    await dlg.waitFor();
    const attrs = await page.evaluate(() => { const d = document.querySelector("[role=dialog]"); return d ? { modal: d.getAttribute("aria-modal"), name: d.getAttribute("aria-label") ?? document.getElementById(d.getAttribute("aria-labelledby") ?? "")?.textContent } : null; });
    ok(attrs && attrs.modal === "true" && attrs.name, `dialog mal formado: ${JSON.stringify(attrs)}`);
    ok(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), "el foco no entró en el onboarding");
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      ok(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), `Tab escapó del onboarding (${i + 1})`);
    }
    await page.keyboard.press("Escape");
    await page.locator("[role=dialog]").waitFor({ state: "detached", timeout: 3000 });
  });
  await context.close();
}

await browser.close();
await server.close();
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
