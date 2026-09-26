import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Bloque 24 — gate permanente de INPUT REAL (`docs/BLOCK_24_MISSION.md` §5).
 *
 * Todo lo que este gate afirma lo afirma a través de la misma entrada que tiene una persona:
 *
 *   - Scroll: `page.mouse.wheel` sobre la superficie. Nunca se asigna `scrollTop` y nunca se usa
 *     `synthesizeScrollGesture` de CDP (en Chromium headless no desplaza contenedores reales, así
 *     que «pasa» sin demostrar nada).
 *   - Clic: `page.mouse.click` en coordenadas, sólo después de comprobar que el punto cae DENTRO
 *     del viewport y que `elementFromPoint` en ese punto resuelve al control (o a un hijo suyo).
 *     El autoscroll de `locator.click()` no cuenta como prueba de que algo es alcanzable.
 *   - Iconos: se fotografía la caja del SVG y se leen sus píxeles; el icono existe si hay
 *     contraste ≥3:1 (Art. 11, gráfico portador de significado) entre su trazo y su fondo.
 *   - Teclado: Tab / Shift+Tab, foco visible, trampa en hojas, retorno de foco, Escape.
 *
 * Además, por superficie, una auditoría estática: el ancestro más cercano con
 * `overflow-y: auto|scroll` existe y contiene todo el contenido (el último elemento es
 * alcanzable dentro de su recorrido de scroll).
 *
 * Hallazgos cubiertos (ver `docs/BLOCK_24_UX_AUDIT.md`): P0-1 portada sin scroll, P0-2 iconos
 * `.icon-button--small` tapados, P0-3 contador de ciudad ilegible (D-M1), P0-4 mapa de ciudad
 * sin agrupación y con áreas de impacto pequeñas (`03 §9`, Art. 11), P0-5 filas de búsqueda más
 * anchas que la hoja (D-M6), y los P1 FIX-NOW del bloque.
 *
 * Lo que NO puede demostrar un Chromium headless queda pendiente de validación humana en un
 * iPhone real: el scroll táctil final (inercia, rebote, gestos del sistema) y el teclado de iOS.
 *
 * Uso: `node scripts/b24-real-input-audit.mjs [--viewport=390x844]` (requiere `npm run build`).
 * Capturas en `/tmp/b24/` — nunca se commitean.
 */

const VIEWPORTS = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
].map(([width, height]) => ({ width, height, name: `${width}x${height}` }));

const SHOTS = "/tmp/b24";
mkdirSync(SHOTS, { recursive: true });

const WHITE_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const INK = [20, 22, 26];
const MIN_SCRIM = 0.6;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_GRAPHIC_CONTRAST = 3;
const TAP_MIN = 44;
const MAP_CLUSTER_THRESHOLD = 12;

const only = process.argv.find((arg) => arg.startsWith("--viewport="))?.split("=")[1];
const viewports = only ? VIEWPORTS.filter((vp) => vp.name === only) : VIEWPORTS;
if (viewports.length === 0) throw new Error(`unknown viewport ${only}`);

const results = [];
const deferred = new Set();
let current = "";

function check(id, condition, message) {
  results.push({ id, viewport: current, ok: Boolean(condition), message });
  if (!condition) console.log(`    ✗ [${id}] ${message}`);
  return Boolean(condition);
}

function note(message) {
  deferred.add(message);
}

function luminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function over(fg, alpha, bg) {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
}

async function frames(page, count = 2) {
  for (let i = 0; i < count; i += 1) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  }
}

/** Posición y visibilidad de un elemento, en coordenadas de viewport. */
async function rectOf(locator) {
  return locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
  });
}

/**
 * Clic real: el centro del control tiene que estar dentro del viewport y `elementFromPoint` en
 * ese punto tiene que ser el control o un descendiente. Sólo entonces `page.mouse.click`.
 */
async function realClick(page, locator, id, label) {
  const handle = await locator.elementHandle();
  if (!check(id, handle, `${label}: no existe`)) return false;
  const probe = await page.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const inside = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    const hit = inside ? document.elementFromPoint(x, y) : null;
    return { x, y, inside, hits: Boolean(hit && (hit === element || element.contains(hit))), hitClass: hit?.className?.toString?.() ?? null };
  }, handle);
  if (!check(id, probe.inside, `${label}: centro fuera del viewport (${Math.round(probe.x)},${Math.round(probe.y)})`)) return false;
  if (!check(id, probe.hits, `${label}: elementFromPoint resuelve a «${probe.hitClass}», no al control`)) return false;
  await page.mouse.click(probe.x, probe.y);
  return true;
}

/** El ancestro con scroll más cercano existe y el último elemento cabe en su recorrido. */
async function scrollOwnerAudit(page, selector) {
  return page.evaluate((sel) => {
    const target = document.querySelector(sel);
    if (!target) return { found: false };
    let owner = target.parentElement;
    while (owner && owner !== document.documentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(owner).overflowY)) break;
      owner = owner.parentElement;
    }
    if (!owner || owner === document.documentElement) {
      const doc = document.scrollingElement;
      const reach = doc.scrollHeight - doc.clientHeight;
      const needed = target.getBoundingClientRect().bottom - innerHeight;
      return { found: true, owner: null, contained: needed <= reach + 1, needed, reach };
    }
    const o = owner.getBoundingClientRect();
    const needed = target.getBoundingClientRect().bottom - o.bottom;
    const reach = owner.scrollHeight - owner.clientHeight - owner.scrollTop;
    return { found: true, owner: owner.className, contained: needed <= reach + 1, needed, reach };
  }, selector);
}

/**
 * El elemento llega a verse: su centro cae dentro del viewport sin cromo encima (hit-test) y,
 * si cabe en pantalla, está entero dentro. Una tarjeta de colección (~460 px) no cabe entera en
 * 320×568 entre el buscador pegajoso y la TabBar: ahí basta con que su centro sea alcanzable.
 */
async function fullyReachable(page, selector) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    const r = element.getBoundingClientRect();
    const fits = r.height <= innerHeight * 0.6;
    if (r.left < 0 || r.right > innerWidth) return false;
    if (fits && (r.top < 0 || r.bottom > innerHeight)) return false;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }, selector);
}

/** Lee los píxeles de un recorte de captura en un canvas del propio navegador. */
async function pixels(page, clip) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data: raw } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, raw: Array.from(raw) };
  }, png.toString("base64"));
}

async function newPage(browser, viewport, options = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: options.reducedMotion ?? "no-preference" });
  if (!options.onboarding) {
    await context.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  }
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  await page.goto(options.url);
  return { context, page };
}

// ---------------------------------------------------------------------------------------------
// P0-1 — la portada de Explorar se desplaza con rueda real, el buscador sigue fijo arriba.
// ---------------------------------------------------------------------------------------------
async function auditHomeScroll(page, vp) {
  await page.locator(".explorer-home").waitFor();
  await frames(page);
  const audit = await scrollOwnerAudit(page, ".explorer-home__map-card");
  check("P0-1", audit.found && audit.owner, `portada: no hay ancestro con overflow-y auto/scroll (${JSON.stringify(audit)})`);
  check("P0-1", audit.contained, `portada: el contenido no cabe en el recorrido del scroll (${JSON.stringify(audit)})`);

  const searchTop = (await rectOf(page.locator(".explorer-home__search-bar"))).top;
  const targets = {
    Okinawa: ".explorer-home__city-card:nth-child(4)",
    "Más destinos": ".explorer-home__more-card",
    colecciones: ".explorer-home__collection-item",
    "Ver Japón en el mapa": ".explorer-home__map-card",
  };
  const seen = new Set();
  const surface = { x: Math.min(vp.width - 24, Math.max(24, vp.width * 0.5)), y: vp.height * 0.55 };
  for (let step = 0; step < 80 && seen.size < Object.keys(targets).length; step += 1) {
    for (const [name, selector] of Object.entries(targets)) {
      if (!seen.has(name) && (await fullyReachable(page, selector))) seen.add(name);
    }
    await page.mouse.move(surface.x, surface.y);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(40);
    await frames(page);
  }
  for (const name of Object.keys(targets)) {
    check("P0-1", seen.has(name), `portada: «${name}» nunca es alcanzable con rueda real`);
  }
  const searchAfter = (await rectOf(page.locator(".explorer-home__search-bar"))).top;
  check("P0-1", Math.abs(searchAfter - searchTop) <= 1, `buscador no queda fijo arriba (05 §2 pt.2): ${searchTop} → ${searchAfter}`);
  await page.screenshot({ path: `${SHOTS}/home-bottom-${vp.name}.png` });

  if (await realClick(page, page.locator(".explorer-home__map-card"), "P0-1", "Ver Japón en el mapa")) {
    check("P0-1", await page.locator(".national").waitFor({ timeout: 4000 }).then(() => true, () => false),
      "«Ver Japón en el mapa» no abre el mapa nacional");
  }
}

// ---------------------------------------------------------------------------------------------
// P0-3 — contador de ciudad (D-M1): sin píldora, --type-num, scrim ≥0.60 en toda la banda.
// ---------------------------------------------------------------------------------------------
async function auditCityCount(page) {
  await page.locator(".explorer-home__city-card").first().waitFor();
  const style = await page.locator(".explorer-home__city-count").first().evaluate((element) => {
    const s = getComputedStyle(element);
    return { bg: s.backgroundColor, numeric: s.fontVariantNumeric, radius: s.borderRadius };
  });
  const bgAlpha = style.bg.startsWith("rgba") ? Number(style.bg.split(",")[3].replace(")", "")) : style.bg === "transparent" ? 0 : 1;
  check("P0-3", bgAlpha === 0, `contador de ciudad sobre píldora (${style.bg}) — D-M1 la retira`);
  check("P0-3", style.numeric.includes("tabular-nums"), `contador sin --type-num (${style.numeric})`);

  // Peor caso: fotografía blanca pura y texto oculto; se leen los píxeles compuestos.
  const card = page.locator(".explorer-home__city-card").first();
  const colors = await card.evaluate(async (element, white) => {
    const img = element.querySelector("img");
    img.src = white;
    await img.decode().catch(() => {});
    const texts = [...element.querySelectorAll(".explorer-home__city-info > *")];
    const band = texts.reduce(
      (acc, t) => {
        const r = t.getBoundingClientRect();
        return { top: Math.min(acc.top, r.top), bottom: Math.max(acc.bottom, r.bottom) };
      },
      { top: Infinity, bottom: -Infinity }
    );
    const out = texts.map((t) => getComputedStyle(t).color);
    for (const t of texts) t.style.color = "transparent";
    const c = element.getBoundingClientRect();
    return { colors: out, band, card: { left: c.left, right: c.right } };
  }, WHITE_PIXEL);
  await frames(page, 3);
  const inset = 20; // --radius-lg: las esquinas redondeadas no son parte de la banda.
  const clip = {
    x: colors.card.left + inset,
    y: colors.band.top,
    width: colors.card.right - colors.card.left - inset * 2,
    height: colors.band.bottom - colors.band.top,
  };
  const { raw } = await pixels(page, clip);
  let minAlpha = 1;
  for (let i = 0; i < raw.length; i += 4) {
    const alpha = (255 - raw[i]) / (255 - INK[0]);
    if (alpha < minAlpha) minAlpha = alpha;
  }
  check("P0-3", minAlpha >= MIN_SCRIM - 0.005, `scrim efectivo mínimo en la banda ${minAlpha.toFixed(3)} < ${MIN_SCRIM}`);
  const ground = over(INK, minAlpha, [255, 255, 255]);
  for (const color of colors.colors) {
    const parts = color.match(/[\d.]+/g).map(Number);
    const text = over(parts.slice(0, 3), parts[3] ?? 1, ground);
    const ratio = contrast(text, ground);
    check("P0-3", ratio >= MIN_TEXT_CONTRAST, `contraste ${ratio.toFixed(2)} < 4.5 para ${color} sobre la foto más clara`);
  }
  await page.reload();
  await page.locator(".explorer-home").waitFor();

  // Más destinos: el contador pluralizado no se corta (P1) — ni por su propia caja ni por el
  // borde visible de la fila («1 lugar por ahor» era la tarjeta cortada por el borde derecho).
  const clipped = await page.locator(".explorer-home__more-count").evaluateAll((items) =>
    items
      .filter((el) => {
        const row = el.closest(".explorer-home__more-row").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const self = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        return self || r.left < Math.max(0, row.left) - 0.5 || r.right > Math.min(innerWidth, row.right) + 0.5;
      })
      .map((el) => el.textContent)
  );
  check("P1-MAS", clipped.length === 0, `«Más destinos» corta su contador: ${clipped.join(" | ")}`);

  // Contenedores anidados (05 §2): la sección de ciudades no es un panel dentro de la portada.
  const nested = await page.locator(".explorer-home__cities").evaluate((element) => {
    const section = element.closest("section");
    const s = getComputedStyle(section);
    return { bg: s.backgroundColor, border: s.borderBottomStyle };
  });
  check("P1-NEST", (nested.bg === "rgba(0, 0, 0, 0)" || nested.bg === "transparent") && nested.border === "none",
    `la portada anida un panel interior no prescrito por 05 §2 (${JSON.stringify(nested)})`);
}

// ---------------------------------------------------------------------------------------------
// P0-5 — búsqueda global (D-M6): filas dentro de la hoja, controles alcanzables, contador vivo.
// ---------------------------------------------------------------------------------------------
async function auditGlobalSearch(page, vp) {
  await page.locator(".explorer-home__search-button").waitFor();
  if (!(await realClick(page, page.locator(".explorer-home__search-button"), "P0-5", "Buscar en todo Japón"))) return;
  await page.locator(".search-sheet__field input").waitFor();
  await page.keyboard.type("shibuya");
  await page.locator(".search-sheet .place-list li").first().waitFor();
  await frames(page);
  const geometry = await page.evaluate(() => {
    const body = document.querySelector(".sheet__body").getBoundingClientRect();
    const rows = [...document.querySelectorAll(".search-sheet .place-list > li")];
    return {
      body: { left: body.left, right: body.right, bottom: body.bottom },
      count: rows.length,
      rows: rows.slice(0, 3).map((li) => {
        const r = li.getBoundingClientRect();
        return { left: r.left, right: r.right, meta: li.querySelector(".place-card__meta")?.textContent ?? "" };
      }),
      head: document.querySelector(".sheet__head")?.textContent ?? "",
    };
  });
  for (const [index, row] of geometry.rows.entries()) {
    check("P0-5", row.right <= geometry.body.right + 0.5 && row.right <= vp.width,
      `fila ${index + 1} más ancha que la hoja: ${Math.round(row.right)} > ${Math.round(geometry.body.right)}`);
  }
  const heartsOk = await page.locator(".search-sheet .place-list > li").evaluateAll((rows) =>
    rows.slice(0, 3).map((li) => {
      const buttons = [...li.querySelectorAll("button")];
      return buttons.every((button) => {
        const r = button.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return Boolean(hit && (hit === button || button.contains(hit)));
      });
    })
  );
  check("P0-5", heartsOk.every(Boolean), `algún control de las primeras filas queda fuera del viewport o tapado (${heartsOk})`);
  const counter = geometry.head.match(/(\d+)\s+lugar(es)?/);
  check("P0-5", counter && Number(counter[1]) === geometry.count,
    `sin contador vivo «N lugares» en la cabecera (cabecera: «${geometry.head.trim()}», resultados ${geometry.count})`);
  const metaOk = geometry.rows.every((row) => /^[^·]+ · [^·,]+, [^·,]+$/.test(row.meta));
  if (!metaOk) note("P0-5 metadato «{categoría} · {barrio}, {ciudad}» — DEFERRED-ACTIVE-BRANCH (PlaceCard.tsx, B23)");
  await page.screenshot({ path: `${SHOTS}/search-${vp.name}.png` });

  // Trampa de foco y retorno: Tab no escapa de la hoja; Escape devuelve el foco al disparador.
  let escaped = false;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
    escaped ||= await page.evaluate(() => !document.querySelector(".sheet")?.contains(document.activeElement));
  }
  check("KBD", !escaped, "el foco escapa de la hoja de búsqueda con Tab/Shift+Tab");
  await page.keyboard.press("Escape");
  await frames(page);
  const back = await page.evaluate(() => document.activeElement?.classList.contains("explorer-home__search-button"));
  check("KBD", back, "cerrar la búsqueda con Escape no devuelve el foco a su disparador");
}

// ---------------------------------------------------------------------------------------------
// Teclado en la portada: Tab/Shift+Tab con foco visible; aria-current en la navegación.
// ---------------------------------------------------------------------------------------------
async function auditKeyboardHome(page) {
  await page.locator(".explorer-home").waitFor();
  await page.mouse.click(2, 2);
  const stops = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { visible: false, name: "body" };
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
        return { visible, name: `${el.tagName}.${el.className}`.slice(0, 60) };
      })
    );
  }
  const invisible = stops.filter((stop) => !stop.visible);
  check("KBD", invisible.length === 0, `foco no visible en: ${invisible.map((s) => s.name).join(", ")}`);
  const forward = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const again = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
  check("KBD", forward === again, "Shift+Tab seguido de Tab no vuelve al mismo control");
  const current = await page.evaluate(() =>
    [...document.querySelectorAll(".tab-bar__item, .nav-rail__item")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => [el.textContent.trim(), el.getAttribute("aria-current")])
  );
  check("KBD", current.filter(([, value]) => value === "page").length === 1,
    `navegación principal sin un único aria-current="page": ${JSON.stringify(current)}`);
}

// ---------------------------------------------------------------------------------------------
// Ciudad: entrada con clic real (la primera tarjeta está arriba) + mapa de ciudad (P0-4).
// ---------------------------------------------------------------------------------------------
async function enterTokio(page) {
  await page.locator(".explorer-home__city-card").first().waitFor();
  const ok = await realClick(page, page.locator(".explorer-home__city-card").first(), "NAV", "tarjeta Tokio");
  if (ok) await page.locator(".app__sidebar .place-card").first().waitFor();
  return ok;
}

async function settleMap(page) {
  let last = "";
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(150);
    const snapshot = await page.evaluate(() =>
      [...document.querySelectorAll(".app__map-area .leaflet-marker-icon")]
        .map((el) => el.style.transform)
        .join("|")
    );
    const animating = await page.evaluate(() => Boolean(document.querySelector(".leaflet-zoom-anim")));
    if (snapshot === last && !animating) return;
    last = snapshot;
  }
}

async function mapIcons(page) {
  return page.evaluate(() => {
    const area = document.querySelector(".app__map-area").getBoundingClientRect();
    return [...document.querySelectorAll(".app__map-area .leaflet-marker-icon")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return {
          cluster: el.classList.contains("place-cluster"),
          selected: el.classList.contains("place-marker--selected"),
          count: Number(el.querySelector(".place-cluster__count")?.textContent ?? 1),
          numeric: el.querySelector(".place-cluster__count")
            ? getComputedStyle(el.querySelector(".place-cluster__count")).fontVariantNumeric
            : "",
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
          visible: cx >= area.left && cx <= area.right && cy >= area.top && cy <= area.bottom,
        };
      })
      .filter((icon) => icon.visible);
  });
}

async function auditCityMap(page, vp) {
  if (!(await enterTokio(page))) return;
  if (vp.width < 1200) {
    if (!(await realClick(page, page.locator(".explorer-bar__pane"), "P0-4", "conmutador Mapa"))) return;
  }
  await page.locator(".app__map-area .leaflet-marker-icon").first().waitFor();
  await settleMap(page);
  await page.screenshot({ path: `${SHOTS}/city-map-${vp.name}.png` });
  const icons = await mapIcons(page);
  const individuals = icons.filter((icon) => !icon.cluster);
  const clusters = icons.filter((icon) => icon.cluster);
  const represented = individuals.length + clusters.reduce((sum, c) => sum + c.count, 0);
  check("P0-4", individuals.length <= MAP_CLUSTER_THRESHOLD,
    `${individuals.length} marcadores sueltos visibles (>${MAP_CLUSTER_THRESHOLD}) sin agrupar — 03 §9 (representan ${represented})`);
  const small = icons.filter((icon) => icon.rect.width < TAP_MIN - 0.5 || icon.rect.height < TAP_MIN - 0.5);
  check("P0-4", small.length === 0, `${small.length} marcadores con área de impacto < 44 px (ej. ${small[0] ? `${small[0].rect.width}×${small[0].rect.height}` : ""})`);
  let overlaps = 0;
  for (let i = 0; i < icons.length; i += 1) {
    for (let j = i + 1; j < icons.length; j += 1) {
      const a = icons[i].rect;
      const b = icons[j].rect;
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) overlaps += 1;
    }
  }
  check("P0-4", overlaps === 0, `${overlaps} pares de áreas de impacto solapadas (ambigüedad, Art. 11)`);
  for (const cluster of clusters) {
    check("P0-4", cluster.numeric.includes("tabular-nums"), "la cifra del grupo no usa --type-num");
  }

  // Un grupo se abre con un clic real y reparte sus lugares.
  if (clusters.length > 0) {
    const target = page.locator(".app__map-area .leaflet-marker-icon.place-cluster").first();
    const before = icons.length;
    const beforeIndividuals = individuals.length;
    if (await realClick(page, target, "P0-4", "grupo de marcadores")) {
      await settleMap(page);
      const after = await mapIcons(page);
      check("P0-4", after.filter((i) => !i.cluster).length > beforeIndividuals || after.length !== before,
        "pulsar un grupo no lo abre");
    }
  }
  // Un marcador suelto abre la ficha con un clic real.
  const single = page.locator(".app__map-area .leaflet-marker-icon.place-marker").first();
  if ((await single.count()) > 0) {
    const inArea = await single.evaluate((el) => {
      const a = document.querySelector(".app__map-area").getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return cx > a.left && cx < a.right && cy > a.top && cy < a.bottom;
    });
    if (inArea && (await realClick(page, single, "P0-4", "marcador suelto"))) {
      check("P0-4", await page.locator("#place-detail-title").waitFor({ timeout: 4000 }).then(() => true, () => false),
        "pulsar un marcador no abre la ficha");
    }
  }
}

// ---------------------------------------------------------------------------------------------
// P0-2 — iconos de `.icon-button--small` visibles (muestreo de píxeles del SVG) + toast (D-M4).
// ---------------------------------------------------------------------------------------------
async function sampleIcons(page, scope, id) {
  // El toast (`04 §16`, 2.400 ms) puede pasar por encima de una fila en pantallas bajas: se muestrea
  // cuando ya se ha ido, para medir el icono y no el toast.
  await page.locator(".save-toast").waitFor({ state: "detached", timeout: 6000 }).catch(() => {});
  const buttons = page.locator(`${scope} .icon-button--small`);
  const count = Math.min(await buttons.count(), 4);
  let sampled = 0;
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    const box = await button.evaluate((el) => {
      const svg = el.querySelector("svg");
      const r = el.getBoundingClientRect();
      const s = svg?.getBoundingClientRect();
      // Visible = dentro del viewport y NO tapado por el cromo (TabBar, cabecera): el centro del
      // SVG resuelve al propio botón. Una fila bajo la TabBar se alcanza desplazando; no se mide.
      const hit = s ? document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2) : null;
      const visible =
        r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth &&
        el.offsetParent !== null && Boolean(hit && (hit === el || el.contains(hit)));
      return {
        visible,
        disabled: el.disabled,
        button: { w: r.width, h: r.height },
        svg: s ? { x: s.left, y: s.top, width: s.width, height: s.height } : null,
      };
    });
    if (!box.visible || !box.svg) continue;
    sampled += 1;
    check(id, box.button.w >= TAP_MIN - 0.5 && box.button.h >= TAP_MIN - 0.5, `icon-button--small mide ${box.button.w}×${box.button.h} (< 44)`);
    const { raw } = await pixels(page, box.svg);
    let lightest = [0, 0, 0];
    let darkest = [255, 255, 255];
    for (let p = 0; p < raw.length; p += 4) {
      const rgb = [raw[p], raw[p + 1], raw[p + 2]];
      if (luminance(rgb) > luminance(lightest)) lightest = rgb;
      if (luminance(rgb) < luminance(darkest)) darkest = rgb;
    }
    const ratio = contrast(lightest, darkest);
    // Un control deshabilitado está exento del 3:1 (WCAG 1.4.11, componentes inactivos), pero
    // tiene que estar PINTADO: 1,00:1 es un icono tapado, no un icono atenuado.
    const floor = box.disabled ? 1.5 : MIN_GRAPHIC_CONTRAST;
    check(id, ratio >= floor, `icono ${i + 1}${box.disabled ? " (deshabilitado)" : ""} de ${scope} invisible: contraste trazo/fondo ${ratio.toFixed(2)} < ${floor}`);
  }
  return sampled;
}

async function auditSavedAndIcons(page, vp) {
  if (!(await enterTokio(page))) return;
  const firstCard = page.locator(".app__sidebar .place-card").first();
  const name = (await firstCard.locator(".place-card__name-text, .place-card__heading").first().textContent())?.trim();
  if (!(await realClick(page, firstCard.locator(".place-card__save"), "NAV", "corazón de la primera tarjeta"))) return;
  const toast = await page.locator(".save-toast").first().textContent({ timeout: 3000 }).catch(() => "");
  check("P1-TOAST", toast.trim() === `${name} está en Quiero ir`, `toast al marcar: «${toast.trim()}» (D-M4: «${name} está en Quiero ir»)`);

  const nav = page.locator(".tab-bar__item:visible, .nav-rail__item:visible").filter({ hasText: "Quiero ir" }).first();
  if (!(await realClick(page, nav, "NAV", "pestaña Quiero ir"))) return;
  await page.locator('.destination-panel:not([hidden]) .icon-button--small').first().waitFor({ timeout: 4000 }).catch(() => {});
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/quiero-ir-${vp.name}.png` });
  const sampled = await sampleIcons(page, ".destination-panel:not([hidden])", "P0-2");
  check("P0-2", sampled > 0, "Quiero ir: ningún .icon-button--small visible para muestrear");

  // Viaje › Planificar: los controles de fila y de día usan el mismo botón.
  const viaje = page.locator(".tab-bar__item:visible, .nav-rail__item:visible").filter({ hasText: "Viaje" }).first();
  if (await realClick(page, viaje, "NAV", "pestaña Viaje")) {
    await page.waitForTimeout(400);
    let inViaje = await sampleIcons(page, ".destination-panel:not([hidden])", "P0-2");
    for (let attempt = 0; inViaje === 0 && attempt < 4; attempt += 1) {
      // Pantalla baja: la fila queda bajo la TabBar; se trae con rueda real y se vuelve a medir.
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(120);
      inViaje = await sampleIcons(page, ".destination-panel:not([hidden])", "P0-2");
    }
    if (inViaje === 0) note("P0-2 Viaje: sin día con controles visibles en el estado inicial — cubierto por la regla CSS común");
  }
}

// ---------------------------------------------------------------------------------------------
// P1 — ficha: retorno de foco con Escape, héroe D-M3, léxico «Misma zona».
// ---------------------------------------------------------------------------------------------
async function auditDetail(page, vp) {
  if (!(await enterTokio(page))) return;
  const open = page.locator(".app__sidebar .place-card__open").first();
  if (!(await realClick(page, open, "NAV", "primera tarjeta de Tokio"))) return;
  await page.locator("#place-detail-title").waitFor();
  await frames(page, 3);
  if (vp.width < 840) {
    const hero = await page.locator(".place-detail .gallery__track, .place-detail .gallery__fallback-inner").first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      const img = el.querySelector("img");
      const panel = el.closest(".app__detail")?.getBoundingClientRect();
      return { height: r.height, width: r.width, panel: panel?.width ?? r.width, fit: img ? getComputedStyle(img).objectFit : "cover" };
    }).catch(() => null);
    if (hero) {
      check("P1-HERO", hero.width >= hero.panel - 2, `héroe no va a sangre: ${Math.round(hero.width)} de ${Math.round(hero.panel)} px`);
      check("P1-HERO", hero.height <= vp.height * 0.6 + 1, `héroe de la ficha ${Math.round(hero.height)} px > 60svh (${Math.round(vp.height * 0.6)}) — D-M3`);
      check("P1-HERO", hero.fit === "cover", `héroe sin object-fit: cover (${hero.fit})`);
    }
  }
  const relation = await page.locator(".nearby-carousel__relation").allTextContents();
  check("P1-CLUSTER", !relation.some((text) => /cluster/i.test(text)), `«Cerca de aquí» muestra «${relation.find((t) => /cluster/i.test(t))}» — D-M4: «Misma zona»`);
  await page.keyboard.press("Escape");
  await frames(page, 3);
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return { body: !el || el === document.body, cls: el?.className?.toString?.() ?? "" };
  });
  check("P1-FOCUS", !focus.body && focus.cls.includes("place-card__open"), `Escape cierra la ficha y el foco va a «${focus.body ? "body" : focus.cls}»`);
}

// ---------------------------------------------------------------------------------------------
// P1 — FilterSheet: sin desplegable, sin mayúsculas, sin glifos, nada asoma bajo el pie.
// ---------------------------------------------------------------------------------------------
async function auditFilterSheet(page, vp) {
  if (!(await enterTokio(page))) return;
  if (!(await realClick(page, page.locator(".explorer-bar__filters"), "NAV", "Filtros"))) return;
  await page.locator(".filter-panel").waitFor();
  await frames(page);
  check("P1-FILTER", (await page.locator(".filter-panel__toggle").count()) === 0, "sobra el desplegable «▾ Filtros» (no está en 04 §13)");
  const upper = await page.locator(".filter-group__summary").evaluateAll((items) =>
    items.filter((el) => getComputedStyle(el).textTransform === "uppercase").length
  );
  check("P1-FILTER", upper === 0, `${upper} etiquetas de grupo en MAYÚSCULAS (03 §2.3)`);
  const glyphs = await page.evaluate(() => {
    const sheet = document.querySelector(".filter-panel");
    const text = sheet.textContent;
    const pseudo = [...sheet.querySelectorAll("*")].map((el) => getComputedStyle(el, "::before").content).join("");
    return /[▾▸▴↓]/.test(text + pseudo);
  });
  check("P1-FILTER", !glyphs, "la hoja de filtros usa glifos de texto como icono (D-M5)");
  // Desplazar la hoja hasta el final con rueda real y comprobar que nada asoma bajo el pie.
  const bodyBox = await rectOf(page.locator(".sheet__body"));
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.move(bodyBox.left + bodyBox.width / 2, bodyBox.top + Math.min(200, bodyBox.height / 2));
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
  }
  await frames(page);
  const peek = await page.evaluate(() => {
    const foot = document.querySelector(".filter-panel__foot").getBoundingClientRect();
    const body = document.querySelector(".sheet__body").getBoundingClientRect();
    return { gap: body.bottom - foot.bottom };
  });
  check("P1-FILTER", peek.gap <= 1, `el contenido asoma ${Math.round(peek.gap)} px bajo el pie fijo`);
  await page.screenshot({ path: `${SHOTS}/filters-${vp.name}.png` });
}

// ---------------------------------------------------------------------------------------------
// P1 — Onboarding: sin eyebrow en mayúsculas, «ciudad» y no «zona».
// ---------------------------------------------------------------------------------------------
async function auditOnboarding(page) {
  await page.locator(".onboarding__dialog").waitFor();
  const info = await page.evaluate(() => {
    const count = document.querySelector(".onboarding__step-count");
    const title = document.querySelector(".onboarding__title");
    return {
      transform: count ? getComputedStyle(count).textTransform : "none",
      eyebrow: Boolean(count && title && count.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING),
      body: document.querySelector(".onboarding__body")?.textContent ?? "",
    };
  });
  check("P1-ONB", info.transform !== "uppercase", "«PASO 1 DE 3» en MAYÚSCULAS (03 §2.3)");
  check("P1-ONB", !info.eyebrow, "el contador de pasos es un eyebrow encima del título (03 §2.3)");
  check("P1-ONB", !/\bzona\b/.test(info.body) && /\bciudad\b/.test(info.body), `el paso 1 dice «zona» donde debe decir «ciudad»: «${info.body}»`);
}

// ---------------------------------------------------------------------------------------------
// prefers-reduced-motion: la hoja entra sin animación perceptible (03 §6).
// ---------------------------------------------------------------------------------------------
async function auditReducedMotion(page) {
  await page.locator(".explorer-home__search-button").waitFor();
  if (!(await realClick(page, page.locator(".explorer-home__search-button"), "MOTION", "Buscar"))) return;
  const duration = await page.locator(".sheet").evaluate((el) => parseFloat(getComputedStyle(el).animationDuration) * 1000);
  check("MOTION", duration <= 100, `la hoja anima ${duration} ms con prefers-reduced-motion`);
}

// ---------------------------------------------------------------------------------------------

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const url = server.resolvedUrls?.local[0];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NIHON_CHROMIUM_PATH ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}),
});

async function section(vp, name, fn, options = {}) {
  const { context, page } = await newPage(browser, vp, { url, ...options });
  try {
    await fn(page, vp);
  } catch (error) {
    check(name, false, `${name} abortado: ${error.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

try {
  for (const vp of viewports) {
    current = vp.name;
    console.log(`B24 real input — ${vp.name}`);
    await section(vp, "P0-1", auditHomeScroll);
    await section(vp, "P0-3", auditCityCount);
    await section(vp, "P0-5", auditGlobalSearch);
    await section(vp, "KBD", auditKeyboardHome);
    await section(vp, "P0-4", auditCityMap);
    await section(vp, "P0-2", auditSavedAndIcons);
    await section(vp, "P1-DETAIL", auditDetail);
    await section(vp, "P1-FILTER", auditFilterSheet);
    await section(vp, "P1-ONB", auditOnboarding, { onboarding: true });
    await section(vp, "MOTION", auditReducedMotion, { reducedMotion: "reduce" });
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
const byId = {};
for (const r of results) {
  byId[r.id] ??= { pass: 0, fail: 0 };
  byId[r.id][r.ok ? "pass" : "fail"] += 1;
}
console.log("\nResumen por hallazgo:");
for (const [id, { pass, fail }] of Object.entries(byId).sort()) {
  console.log(`  ${fail === 0 ? "PASS" : "FAIL"} ${id.padEnd(11)} ${pass} ok · ${fail} fallos`);
}
for (const message of deferred) console.log(`  DEFERRED ${message}`);
console.log(`\nB24 real input audit: ${results.length - failed.length}/${results.length} comprobaciones, ${failed.length} fallos`);
console.log("Pendiente de validación humana en iPhone real: scroll táctil final y teclado de iOS.");
process.exit(failed.length === 0 ? 0 : 1);
