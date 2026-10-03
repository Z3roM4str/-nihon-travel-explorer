import { readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate B10 — activación diferida de imágenes (`design/09`, «autorización del lote de activación diferida de imágenes»).
 *
 * Mide sobre la build de producción, por motor (`NIHON_BROWSER=webkit` o Chromium), viewport (390×844@2 y 1440×900@1) y hub
 * (Tokio, Kioto, Osaka, Okinawa):
 *   · activación: una tarjeta no prioritaria a más de 2 alturas de su contenedor de scroll no tiene `src` ni petición; las tarjetas
 *     visibles sí cargan; la primera tarjeta sigue prioritaria y el resto conserva `loading="lazy"`; el margen de cada observador de
 *     tarjeta es exactamente `200%` (≤ 2 viewports);
 *   · Portada → ciudad INMEDIATA: sin esperar a las imágenes de la portada (respuestas retrasadas a propósito para que sigan en vuelo
 *     al hacer clic). La ventana empieza en el clic y cuenta TODA respuesta de imagen que termina después, también las tardías de la
 *     portada: ninguna se excluye. Presupuesto ≤ 3 500 000 B por ciudad. Cada petición se atribuye a una superficie por su instante de
 *     inicio: una petición nacida después del clic sólo puede ser de una tarjeta de la ciudad;
 *   · observadores: tras abandonar la portada no queda ningún observador vivo con objetivo desmontado, y los de la portada se desconectan;
 *   · fallback y reintento (tarjeta cercana y tarjeta lejana activada después), créditos de la ficha;
 *   · las ocho imágenes citadas por el informe B10 (JP-004, JP-005, JP-011, JP-024, JP-037, JP-046, JP-049, JP-073): petición/respuesta
 *     y su transición al entrar en rango en el carrusel «Menos saturado» de la portada.
 *
 * Controles negativos (`NIHON_B10_DEFERRED_MUTANT`): `always-intersecting` (todo se activa), `no-disconnect` (observadores huérfanos),
 * `wide-margin` (margen 1000 %). Cada uno debe terminar en FAIL.
 *
 * Uso: `npm run build && node scripts/b10-deferred-images-check.mjs`
 *   (`NIHON_BROWSER`, `NIHON_CHROMIUM_PATH`, `NIHON_WEBKIT_PATH`, `NIHON_B10_DIST`, `NIHON_B10_DEFERRED_JSON` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const MUTANT = process.env.NIHON_B10_DEFERRED_MUTANT ?? "";
const DIST = process.env.NIHON_B10_DIST ?? "dist";
const HUB_BUDGET_BYTES = 3_500_000; // 06 §6.3 — no se toca
const EXPECTED_MARGIN = "200% 200% 200% 200%";
const IMAGE_DELAY_MS = 450; // mantiene en vuelo las respuestas de la portada cuando se hace clic
const HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa"];
const EIGHT = ["JP-004", "JP-005", "JP-011", "JP-024", "JP-037", "JP-046", "JP-049", "JP-073"];
const VIEWPORTS = [
  ["móvil", { width: 390, height: 844 }, 2],
  ["escritorio", { width: 1440, height: 900 }, 1],
];

const metadata = JSON.parse(readFileSync(new URL("../src/data/photography-metadata.json", import.meta.url), "utf8"));
const eightPaths = Object.fromEntries(
  EIGHT.map((id) => [id, metadata.images.find((image) => image.placeId === id).assetPath.replace(/\.webp$/, "-800w.webp")])
);

const evidence = { browser: BROWSER, mutant: MUTANT || null, dist: DIST, imageDelayMs: IMAGE_DELAY_MS, immediate: [], eight: [], fallback: [], credits: [] };
let pass = 0;
const failures = [];
const ONLY = process.env.NIHON_B10_DEFERRED_ONLY ? new RegExp(process.env.NIHON_B10_DEFERRED_ONLY) : null;
async function ck(id, name, fn) {
  if (ONLY && !ONLY.test(id)) return;
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    if (process.env.NIHON_B10_DEFERRED_VERBOSE) console.log(error.stack);
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 500)}`);
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

const server = await preview({ root: new URL("..", import.meta.url).pathname, build: { outDir: DIST }, preview: { host: "127.0.0.1", port: 0, open: false }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()} · dist=${DIST}${MUTANT ? ` · MUTANTE ${MUTANT}` : ""}`);

/** Registro de IntersectionObserver en la página + controles negativos. No toca el producto. */
const instrument = (mutant) => {
  const Original = window.IntersectionObserver;
  const records = [];
  window.__observers = records;
  window.IntersectionObserver = class extends Original {
    constructor(callback, options) {
      const opts = { ...(options ?? {}) };
      if (mutant === "wide-margin" && opts.rootMargin === "200% 200% 200% 200%") opts.rootMargin = "1000% 1000% 1000% 1000%";
      const cb = mutant === "always-intersecting"
        ? (entries, observer) => callback(entries.map((entry) => ({ isIntersecting: true, target: entry.target })), observer)
        : callback;
      super(cb, opts);
      this.__record = { margin: opts.rootMargin ?? "0px", targets: new Set(), disconnected: false };
      records.push(this.__record);
      if (mutant === "always-intersecting") {
        // Re-evaluates once observed: the real observer only reports when geometry changes, so the mutant must report at observe time.
        const originalObserve = super.observe.bind(this);
        this.observe = (target) => {
          this.__record.targets.add(target);
          originalObserve(target);
          queueMicrotask(() => cb([{ isIntersecting: true, target }], this));
        };
      }
    }
    observe(target) {
      this.__record.targets.add(target);
      return super.observe(target);
    }
    unobserve(target) {
      this.__record.targets.delete(target);
      return super.unobserve(target);
    }
    disconnect() {
      if (mutant === "no-disconnect") return;
      this.__record.targets.clear();
      this.__record.disconnected = true;
      return super.disconnect();
    }
  };
};

async function openPage(viewport, dpr, { delay = 0, abort = () => false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const t0 = Date.now();
  const requests = []; // { url, start, end, bytes, status }
  const byUrl = new Map();
  page.on("request", (request) => {
    const u = request.url();
    if (!/\/images\/places\/.*\.webp(\?|$)/.test(u)) return;
    const entry = { url: new URL(u).pathname, start: Date.now() - t0, end: null, bytes: 0, status: null, failed: false };
    requests.push(entry);
    byUrl.set(request, entry);
  });
  const pending = new Set();
  page.on("response", (response) => {
    const entry = byUrl.get(response.request());
    if (!entry) return;
    const job = (async () => {
      try {
        entry.bytes = (await response.body()).length;
      } catch {
        entry.bytes = 0;
      }
      entry.status = response.status();
      entry.end = Date.now() - t0;
    })();
    pending.add(job);
    void job.finally(() => pending.delete(job));
  });
  page.on("requestfailed", (request) => {
    const entry = byUrl.get(request);
    if (entry) {
      entry.failed = true;
      entry.end = Date.now() - t0;
    }
  });
  // Instante de CREACIÓN de cada petición de imagen (la intercepción pausa la petición al nacer, antes de cualquier retraso).
  const created = new Map();
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (!(u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:"))) return route.fulfill({ status: 204, body: "" });
    if (/\/images\/places\//.test(u)) {
      const path = new URL(u).pathname;
      created.set(path, [...(created.get(path) ?? []), Date.now()]);
      if (abort(u)) return route.abort("failed");
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* */
    }
  });
  await page.addInitScript(() => performance.setResourceTimingBufferSize(2000));
  await page.addInitScript(instrument, MUTANT);
  /**
   * Una fila por petición de imagen, todo en reloj de pared (`Date.now()`, el mismo en el nodo y en la página):
   *   · `start` — creación de la petición (intercepción de ruta, no el evento de Playwright, que llega con retraso distinto por motor);
   *   · `end` — `responseEnd` de `PerformanceResourceTiming` convertido a reloj de pared (la entrada nace al terminar la respuesta);
   *   · `bytes` — `encodedBodySize` (los `.webp` no se comprimen: coincide con el cuerpo medido por el guard de G6).
   * Se emparejan por URL y orden de creación.
   */
  const timings = async () => {
    const entries = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter((e) => /\/images\/places\/.*\.webp/.test(e.name))
      .map((e) => ({ url: new URL(e.name).pathname, order: e.startTime, end: performance.timeOrigin + e.responseEnd, bytes: e.encodedBodySize })));
    const byUrl = new Map();
    for (const entry of entries.sort((x, y) => x.order - y.order)) byUrl.set(entry.url, [...(byUrl.get(entry.url) ?? []), entry]);
    const rows = [];
    for (const [path, starts] of created) {
      const done = byUrl.get(path) ?? [];
      starts.forEach((start, i) => rows.push({ url: path, start, end: done[i]?.end ?? null, bytes: done[i]?.bytes ?? 0, completed: Boolean(done[i]) }));
    }
    return rows;
  };
  return { context, page, requests, t0, timings, settle: () => Promise.all([...pending]), now: () => Date.now() - t0 };
}

const hubButton = (page, hub) =>
  page.locator(`[aria-label="Empezar a explorar"] button, [aria-label="Más destinos"] button`).filter({ hasText: new RegExp(`^${hub}\\b`) }).first();

/** Geometría de las tarjetas respecto del contenedor de scroll de la lista (o del viewport). */
const cardGeometry = () =>
  [...document.querySelectorAll(".place-card")].map((card) => {
    const media = card.querySelector(".place-card__media") ?? card;
    const img = card.querySelector("img.place-card__image");
    let scroller = null;
    for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        scroller = el;
        break;
      }
    }
    const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight, height: innerHeight };
    const rect = media.getBoundingClientRect();
    const above = box.top - rect.bottom;
    const below = rect.top - box.bottom;
    return {
      hasImg: Boolean(img),
      src: img?.getAttribute("src") ?? null,
      loading: img?.getAttribute("loading") ?? null,
      fetchpriority: img?.getAttribute("fetchpriority") ?? null,
      complete: Boolean(img?.complete && img.naturalWidth > 0),
      state: img?.dataset.state ?? null,
      distance: Math.max(above, below, 0),
      below,
      scrollerHeight: box.height,
      visible: above < 0 && below < 0 && rect.height > 0,
    };
  });

async function scrollList(page, to) {
  return page.evaluate((target) => {
    const cards = [...document.querySelectorAll(".place-card")];
    let el = cards[0]?.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    const scroller = el ?? document.scrollingElement;
    const before = scroller.scrollTop;
    if (target === "end") scroller.scrollTop = scroller.scrollHeight;
    else if (target === "top") scroller.scrollTop = 0;
    else scroller.scrollBy(0, Math.max(300, innerHeight * 0.8));
    return scroller.scrollTop === before;
  }, to);
}

async function traverse(page) {
  for (let i = 0; i < 90; i += 1) {
    const done = await scrollList(page, "step");
    await page.waitForTimeout(110);
    if (done) break;
  }
  await page.waitForTimeout(700);
}

const liveCardObservers = (page) =>
  page.evaluate(() => {
    // Observadores de tarjeta = todos menos el centinela de paginación de la lista (600px).
    const cardObservers = (window.__observers ?? []).filter((r) => r.margin !== "600px");
    const live = cardObservers.filter((r) => !r.disconnected);
    const targets = live.flatMap((r) => [...r.targets]);
    return {
      created: cardObservers.length,
      live: live.length,
      targets: targets.length,
      // Huérfano: objetivo desmontado que sigue observado, u observador vivo que ya no observa nada.
      orphans: targets.filter((t) => !t.isConnected).length + live.filter((r) => r.targets.size === 0).length,
      margins: [...new Set(cardObservers.map((r) => r.margin))],
    };
  });

/** Invariante continuo: ninguna tarjeta con src a más de 2 alturas por debajo de su contenedor de scroll. */
async function sampleFarBelow(page) {
  const cards = await page.evaluate(cardGeometry);
  const withImg = cards.filter((c) => c.hasImg);
  return {
    total: withImg.length,
    farBelow: withImg.filter((c) => c.below > 2 * c.scrollerHeight + 1),
    violations: withImg.filter((c) => c.src && c.below > 2 * c.scrollerHeight + 1),
  };
}

// ───────────── Portada → ciudad inmediata, por viewport y hub
// `delay: 0` — se hace clic en cuanto la portada empezó a pedir fotografías. `delay: 450` — las respuestas de imagen tardan, de modo
// que las de la portada siguen EN VUELO al hacer clic y terminan dentro de la ventana de la ciudad (estrés de solape).
for (const delay of [0, IMAGE_DELAY_MS]) {
  for (const [label, viewport, dpr] of VIEWPORTS) {
    for (const hub of HUBS) {
      await ck(`D${delay}-${label}-${hub}`, `${label} · ${hub} · respuestas +${delay} ms: Portada → ciudad inmediata, activación diferida, atribución y sin observadores huérfanos`, async () => {
        const { context, page, requests, settle, timings, t0 } = await openPage(viewport, dpr, { delay });
        try {
          await page.goto(url, { waitUntil: "commit" });
          await hubButton(page, hub).waitFor();
          // Sin esperar a que terminen: basta con que la portada haya empezado a pedir fotografías.
          await page.waitForFunction(() => document.querySelectorAll(".explorer-home img[src]").length > 0);
          const homeBefore = await page.evaluate(cardGeometry);
          const homeSampleViolations = homeBefore.filter((c) => c.src && c.below > 2 * c.scrollerHeight + 1).length;
          if (delay) await page.waitForTimeout(150);
          const homeObserversAtClick = await liveCardObservers(page);
          // Clic dentro de la página, en su propio reloj: sin esperas de actionability ni retrasos de eventos.
          const clickAt = await hubButton(page, hub).evaluate((el) => {
            const at = Date.now();
            el.click();
            return at;
          });
          const atClick = (await timings()).filter((t) => t.start <= clickAt);
          const inFlightAtClick = atClick.filter((t) => !t.completed || t.end > clickAt).length;
          await page.waitForSelector(".place-card");
          await page.waitForTimeout((delay ? delay : 0) + 300);
          // Las visibles de la ciudad deben terminar de cargar (con margen amplio: WebKit es más lento).
          await page.waitForFunction(() => {
            const visible = [...document.querySelectorAll(".place-card img.place-card__image")].filter((i) => {
              const r = i.getBoundingClientRect();
              return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
            });
            return visible.length > 0 && visible.every((i) => i.complete && i.naturalWidth > 0);
          }, undefined, { timeout: 20000 });
          await settle();
          const afterNav = await page.evaluate(cardGeometry);
          const observersAfterNav = await liveCardObservers(page);
          const requestsAtOpen = (await timings()).length;

          let violations = (await sampleFarBelow(page)).violations.length;
          let sawFar = (await sampleFarBelow(page)).farBelow.length > 0;
          for (let i = 0; i < 90; i += 1) {
            const done = await scrollList(page, "step");
            await page.waitForTimeout(110);
            const sample = await sampleFarBelow(page);
            violations += sample.violations.length;
            sawFar ||= sample.farBelow.length > 0;
            if (done) break;
          }
          await page.waitForTimeout(700);
          await settle();
          const end = await page.evaluate(cardGeometry);
          const observersEnd = await liveCardObservers(page);
          const cityUrls = new Set(end.filter((c) => c.src).map((c) => new URL(c.src, url).pathname));

          // Ventana original: desde el clic hasta el final, TODA respuesta, también las de la portada que terminan tarde.
          // Atribución por instante de inicio en el reloj de la página: nacida antes del clic = portada; después = ciudad.
          const all = await timings();
          const inWindow = all.filter((r) => r.completed && r.end > clickAt);
          const bytes = inWindow.reduce((sum, r) => sum + r.bytes, 0);
          const lateHome = inWindow.filter((r) => r.start <= clickAt);
          const cityStarted = all.filter((r) => r.start > clickAt);
          const cityBytes = cityStarted.reduce((sum, r) => sum + r.bytes, 0);
          const misattributed = cityStarted.filter((r) => !cityUrls.has(r.url));
          const failed = requests.filter((r) => r.failed || (r.status !== null && r.status >= 400));
          const cityDupes = cityStarted.map((r) => r.url).filter((u, i, all2) => all2.indexOf(u) !== i);
          const crossSurface = new Set(all.filter((r) => r.start <= clickAt).map((r) => r.url));
          const repeatedAcrossSurfaces = cityStarted.filter((r) => crossSurface.has(r.url)).length;
          const visibleAtOpen = afterNav.filter((c) => c.hasImg && c.visible);
          const visibleUnloaded = visibleAtOpen.filter((c) => !c.complete);
          const nonPriority = afterNav.filter((c) => c.hasImg && c.src && c.fetchpriority !== "high");
          const nonLazy = nonPriority.filter((c) => c.loading !== "lazy");
          const priorityCards = afterNav.filter((c) => c.fetchpriority === "high");

          evidence.immediate.push({
            viewport: label, hub, responseDelayMs: delay, clickAtMs: clickAt - t0, homeImgsWithSrcAtClick: homeBefore.filter((c) => c.src).length, homeImgsTotal: homeBefore.length,
            inFlightAtClick, lateHomeResponses: lateHome.length, lateHomeBytes: lateHome.reduce((s, r) => s + r.bytes, 0),
            windowResponses: inWindow.length, windowBytes: bytes, cityStartedResponses: cityStarted.length, cityStartedBytes: cityBytes, budget: HUB_BUDGET_BYTES,
            cityCards: end.length, cityCardsWithSrcAtOpen: afterNav.filter((c) => c.src).length, cityCardsWithSrcAtEnd: end.filter((c) => c.src).length,
            requestsAtOpen, totalRequests: all.length, farBelowViolations: violations + homeSampleViolations, sawFarCards: sawFar,
            homeObserversAtClick, observersAfterNav, observersEnd, misattributed: misattributed.length, cityDuplicates: cityDupes.length, repeatedAcrossSurfaces, failed: failed.length,
          });
          console.log(`# ${label} · ${hub} · +${delay} ms: ventana ${inWindow.length} resp/${bytes} B = ciudad ${cityStarted.length}/${cityBytes} B + portada tardía ${lateHome.length}/${lateHome.reduce((s, r) => s + r.bytes, 0)} B (en vuelo al clic ${inFlightAtClick}) · con src al abrir ${afterNav.filter((c) => c.src).length}/${afterNav.length} · observadores: portada ${homeObserversAtClick.live} vivos/${homeObserversAtClick.targets} objetivos → ciudad ${observersAfterNav.live} vivos/${observersAfterNav.targets}, huérfanos ${observersAfterNav.orphans}`);

          ok(homeObserversAtClick.created > 0, "ningún observador de tarjeta creado en la portada: el gate no midió nada");
          ok([...homeObserversAtClick.margins, ...observersEnd.margins].every((m) => m === EXPECTED_MARGIN), `margen distinto de ${EXPECTED_MARGIN}: ${[...homeObserversAtClick.margins, ...observersEnd.margins]}`);
          if (delay) ok(inFlightAtClick > 0, "ninguna respuesta de portada en vuelo al hacer clic: no es navegación inmediata");
          ok(sawFar, "ninguna tarjeta lejana observada en la ciudad: el gate no midió nada");
          ok(violations + homeSampleViolations === 0, `${violations + homeSampleViolations} muestras con src a más de 2 alturas por debajo`);
          ok(visibleAtOpen.length > 0 && visibleUnloaded.length === 0, `${visibleUnloaded.length}/${visibleAtOpen.length} tarjetas visibles sin cargar`);
          ok(priorityCards.length === 1 && priorityCards[0] === afterNav.find((c) => c.hasImg), "la primera tarjeta no es la única prioritaria");
          ok(nonLazy.length === 0, `${nonLazy.length} tarjetas no prioritarias sin loading=lazy`);
          ok(observersAfterNav.orphans === 0 && observersEnd.orphans === 0, `observadores huérfanos: ${observersAfterNav.orphans}/${observersEnd.orphans}`);
          ok(observersAfterNav.live <= 3 && observersEnd.live <= 3, `observadores vivos de tarjeta en la ciudad: ${observersAfterNav.live}/${observersEnd.live} (la portada abandonada debe haberse desconectado)`);
          ok(misattributed.length === 0, `peticiones nacidas tras el clic que no son de tarjetas de la ciudad: ${misattributed.slice(0, 2).map((r) => r.url)}`);
          ok(failed.length === 0, `fallos: ${failed.slice(0, 2).map((r) => r.url)}`);
          ok(cityDupes.length === 0, `duplicados en la ciudad: ${[...new Set(cityDupes)].slice(0, 2)}`);
          ok(end.filter((c) => c.hasImg).every((c) => c.src && c.complete), "tras recorrer la ciudad hay tarjetas sin cargar");
          ok(cityBytes <= HUB_BUDGET_BYTES, `ciudad: ${cityBytes} B > ${HUB_BUDGET_BYTES} B`);
        } finally {
          await context.close();
        }
      });
    }
  }
}

// ───────────── Las ocho imágenes: no se piden hasta entrar en rango; transición al llegar al carrusel «Menos saturado»
for (const [label, viewport, dpr] of VIEWPORTS) {
  await ck(`E-${label}`, `${label}: las ocho imágenes del informe se activan al entrar en rango y no antes`, async () => {
    const { context, page, settle, timings, t0 } = await openPage(viewport, dpr);
    const clock = () => page.evaluate(() => Date.now());
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator(".explorer-home__city-image").first().waitFor();
      await page.waitForTimeout(600);
      await settle();
      const snapshot = async () => {
        const all = await timings();
        return Object.fromEntries(EIGHT.map((id) => {
          const hit = all.find((r) => r.url === `/${eightPaths[id]}`);
          return [id, hit ? { start: hit.start - t0, end: hit.completed ? Math.round(hit.end - t0) : null, bytes: hit.bytes } : null];
        }));
      };
      const beforeScroll = await snapshot();
      const section = page.locator(".explorer-home__collection").filter({ has: page.locator("#collection-menos-saturado") });
      const scrollStart = (await clock()) - t0;
      await section.locator("#collection-menos-saturado").scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      await settle();
      const afterVertical = await snapshot();
      // Llevar el carrusel horizontalmente hasta que las ocho hayan entrado en rango (o se acabe).
      const carousel = section.locator(".explorer-home__collection-carousel");
      const horizontalStart = (await clock()) - t0;
      for (let i = 0; i < 40; i += 1) {
        const seen = await snapshot();
        if (EIGHT.every((id) => seen[id])) break;
        await carousel.evaluate((el) => el.scrollBy({ left: el.clientWidth * 0.8, behavior: "instant" }));
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(700);
      await settle();
      const final = await snapshot();
      evidence.eight.push({ viewport: label, scrollStartMs: scrollStart, horizontalStartMs: horizontalStart, beforeScroll, afterVerticalScroll: afterVertical, final });
      console.log(`# ${label}: antes del scroll pedidas ${EIGHT.filter((id) => beforeScroll[id]).join(",") || "ninguna"} · tras la vista vertical ${EIGHT.filter((id) => afterVertical[id]).join(",") || "ninguna"} · tras el carrusel ${EIGHT.filter((id) => final[id]).join(",") || "ninguna"}`);
      for (const id of EIGHT) {
        const f = final[id];
        const phase = beforeScroll[id] ? "ANTES del scroll" : afterVertical[id] ? `al llegar a la sección (+${f.start - scrollStart} ms)` : f ? `al desplazar el carrusel (+${f.start - horizontalStart} ms)` : "no pedida";
        console.log(`#   ${id}: ${f ? `inicio ${f.start} ms · fin ${f.end} ms · ${f.bytes} B · ${phase}` : "no pedida"}`);
      }
      ok(EIGHT.every((id) => !beforeScroll[id]), `pedidas antes de entrar en rango: ${EIGHT.filter((id) => beforeScroll[id])}`);
      ok(EIGHT.every((id) => final[id] && final[id].end !== null && final[id].bytes > 0), `sin completar: ${EIGHT.filter((id) => !final[id] || !final[id].bytes)}`);
    } finally {
      await context.close();
    }
  });
}

// ───────────── Fallback y reintento (tarjeta cercana y tarjeta lejana activada después)
for (const [label, viewport, dpr] of VIEWPORTS) {
  await ck(`F-${label}`, `${label}: fallback y reintento en una tarjeta cercana y en una lejana activada al llegar`, async () => {
    // Descubrir dos URL de la ciudad que la portada no haya descargado (una caché de memoria taparía el fallo).
    const discovery = await openPage(viewport, dpr);
    let nearPath;
    let farPath;
    let nearIndex;
    let farIndex;
    try {
      await discovery.page.goto(url, { waitUntil: "networkidle" });
      await discovery.page.waitForTimeout(500);
      const homeSrcs = new Set(await discovery.page.evaluate(() => [...document.querySelectorAll(".explorer-home img")].map((i) => i.getAttribute("src")).filter(Boolean).map((u) => new URL(u, location.href).pathname)));
      await hubButton(discovery.page, "Osaka").click();
      await discovery.page.waitForSelector(".place-card");
      await discovery.page.waitForTimeout(700);
      await traverse(discovery.page);
      // Índice de TARJETA (hay lugares sin fotografía, que no tienen <img>).
      const srcs = await discovery.page.evaluate(() => [...document.querySelectorAll(".place-card")].map((card) => {
        const src = card.querySelector("img.place-card__image")?.getAttribute("src");
        return src ? new URL(src, location.href).pathname : null;
      }));
      const fresh = srcs.map((u, i) => [u, i]).filter(([u, i]) => u && i >= 1 && !homeSrcs.has(u));
      const nearEntry = fresh.find(([, i]) => i <= 3);
      const farEntry = fresh[fresh.length - 1];
      nearPath = nearEntry?.[0];
      farPath = farEntry?.[0];
      nearIndex = nearEntry?.[1];
      farIndex = farEntry?.[1];
      evidence.fallbackIndexes = { near: nearIndex, far: farIndex, total: srcs.length };
    } finally {
      await discovery.context.close();
    }
    ok(nearPath && farPath && nearPath !== farPath, "no se pudieron elegir las dos tarjetas");

    let failing = true;
    const { context, page, requests, settle } = await openPage(viewport, dpr, { abort: (u) => failing && [nearPath, farPath].includes(new URL(u).pathname) });
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await hubButton(page, "Osaka").click();
      await page.waitForSelector(".place-card");
      await page.waitForTimeout(700);
      // La tarjeta cercana está dentro del rango autorizado al abrir la ciudad (índice ≤ 3 de una lista de 12): se activa sola.
      ok(await page.evaluate((i) => document.querySelectorAll(".place-card")[i] !== undefined, nearIndex), "la tarjeta cercana no está en la primera página");
      const farBefore = await page.evaluate((p) => [...document.querySelectorAll(".place-card img.place-card__image")].some((i) => i.getAttribute("src") === p), farPath);
      ok(!farBefore, "la tarjeta lejana ya tenía src antes de llegar");
      const nearCard = page.locator(".place-card").nth(nearIndex);
      await nearCard.locator(".photo-placeholder[aria-label*='No se pudo cargar la imagen']").waitFor();
      const nearRetry = nearCard.locator(".place-card__photo-retry");
      ok((await nearRetry.count()) === 1, "la tarjeta cercana fallida no ofrece Reintentar");
      ok((await nearRetry.getAttribute("aria-label")).startsWith("Reintentar fotografía de "), "nombre accesible del reintento alterado");

      // Llegar a la tarjeta lejana la activa; la petición falla y aparece el fallback.
      await traverse(page);
      const farCard = page.locator(".place-card").nth(farIndex);
      await farCard.locator(".photo-placeholder[aria-label*='No se pudo cargar la imagen']").waitFor();
      ok((await page.locator(".place-card__photo-retry").count()) === 2, "debe haber exactamente dos tarjetas fallidas con Reintentar");

      // Se recupera el servidor: el reintento carga la imagen y devuelve el foco a la acción de abrir.
      failing = false;
      await nearCard.scrollIntoViewIfNeeded();
      await nearRetry.click();
      await nearCard.locator("img.place-card__image[data-state='loaded']").waitFor();
      ok(await nearCard.evaluate((card) => document.activeElement === card.querySelector(".place-card__open")), "tras Reintentar el foco no está en la acción de abrir");
      ok((await nearCard.locator(".place-card__photo-retry").count()) === 0, "Reintentar sigue visible tras recuperar la imagen");
      await farCard.scrollIntoViewIfNeeded();
      await farCard.locator(".place-card__photo-retry").click();
      await farCard.locator("img.place-card__image[data-state='loaded']").waitFor();
      await settle();
      const attempts = requests.filter((r) => r.url === nearPath || r.url === farPath);
      evidence.fallback.push({ viewport: label, nearPath, farPath, attempts: attempts.map((r) => ({ url: r.url, failed: r.failed, status: r.status })) });
      ok(attempts.filter((r) => r.failed).length === 2 && attempts.filter((r) => !r.failed && r.status === 200).length === 2, `intentos inesperados: ${JSON.stringify(attempts)}`);
    } finally {
      await context.close();
    }
  });
}

// ───────────── Créditos de la ficha
await ck("C", "los créditos y la atribución de la fotografía siguen en la ficha", async () => {
  const { context, page } = await openPage({ width: 390, height: 844 }, 2);
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await hubButton(page, "Osaka").click();
    await page.waitForSelector(".place-card");
    await page.locator(".place-card__open").first().click();
    await page.locator(".place-detail").waitFor();
    const credits = page.locator(".gallery__credits");
    ok((await credits.count()) === 1, "falta el control de créditos");
    await credits.click();
    await page.waitForSelector(".credits-sheet__item");
    const text = (await page.locator(".credits-sheet__item").first().innerText()).replace(/\s+/g, " ");
    evidence.credits.push({ text: text.slice(0, 200) });
    ok(/CC|licen|Dominio|Public/i.test(text) && text.length > 20, `atribución sin licencia: ${text.slice(0, 120)}`);
  } finally {
    await context.close();
  }
});

await browser.close();
await server.close();
evidence.failures = failures;
if (process.env.NIHON_B10_DEFERRED_JSON) writeFileSync(process.env.NIHON_B10_DEFERRED_JSON, JSON.stringify(evidence, null, 2) + "\n");
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
