import { chromium } from "playwright";

/**
 * Bloque 19 (B3) — corrección DD-016: gate permanente de la rejilla de descubrimiento.
 *
 * Mide, sobre un build real, el contrato que `02 §D5`/`04 §5`/`05 §4` fijan para la lista de
 * Explorar. No comprueba "hay un @media en tal sitio": comprueba el RESULTADO —
 *
 *   1. el número de columnas efectivo en los seis casos normativos;
 *   2. que ninguna `PlaceCard` baje nunca de 264px de ancho;
 *   3. que la proporción sea 4:3 con una columna y 16:9 con dos o más;
 *   4. que el raíl derecho (ficha o mapa) nunca pase de la mitad del ancho del cuerpo;
 *   5. que el mapa conserve centro, zoom y marcador al abrir y cerrar la ficha en `lg`/`xl`;
 *   6. que no quede ningún `text-shadow` en la superficie de descubrimiento.
 *
 * El caso «840 con la ficha abierta» es el que da sentido a todo esto: el viewport no cambia y
 * la lista tiene que bajar de 2 columnas a 1 porque su REGIÓN se estrecha. Ningún `@media`
 * puede verlo.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const MIN_CARD_WIDTH = 264;

/** Los seis casos del contrato: ancho, si la ficha está abierta, y columnas esperadas. */
const CASES = [
  { name: "360", width: 360, height: 780, detail: false, columns: 1 },
  { name: "600", width: 600, height: 900, detail: false, columns: 2 },
  { name: "840", width: 840, height: 900, detail: false, columns: 2 },
  { name: "840 + ficha", width: 840, height: 900, detail: true, columns: 1 },
  { name: "1200", width: 1200, height: 900, detail: false, columns: 2 },
  { name: "1600", width: 1600, height: 900, detail: false, columns: 3 },
];

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok, extra) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}${extra !== undefined ? ` (${extra})` : ""}`);
  };

  async function openTokio(page) {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(400);
  }

  /** Columnas reales: posiciones `x` distintas entre las tarjetas de la primera fila. */
  async function geometry(page) {
    return page.evaluate(() => {
      const list = document.querySelector(".place-list:not(.place-list--compact)");
      const cards = [...document.querySelectorAll(".place-card:not(.place-card--compact)")];
      const boxes = cards.map((card) => card.getBoundingClientRect());
      const tops = boxes.map((b) => Math.round(b.top));
      const firstRow = boxes.filter((b) => Math.round(b.top) === tops[0]);
      const media = document.querySelector(
        ".place-card:not(.place-card--compact) .place-card__media"
      );
      const mediaBox = media.getBoundingClientRect();
      const body = document.querySelector(".app__body");
      const sidebar = document.querySelector(".app__sidebar");
      const mapArea = document.querySelector(".app__map-area");
      const detail = document.querySelector(".app__detail");
      const visible = (el) =>
        el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden" &&
        getComputedStyle(el).display !== "none";
      const bodyBox = body.getBoundingClientRect();
      const railRight = Math.max(
        visible(detail) ? detail.getBoundingClientRect().width : 0,
        visible(mapArea) ? mapArea.getBoundingClientRect().width : 0
      );
      return {
        trackCount: getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/).length,
        rowCount: firstRow.length,
        minCardWidth: Math.min(...boxes.map((b) => b.width)),
        mediaRatio: mediaBox.width / mediaBox.height,
        regionWidth: sidebar.getBoundingClientRect().width,
        bodyWidth: bodyBox.width,
        railWidth: railRight,
      };
    });
  }

  for (const testCase of CASES) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
    });
    const page = await context.newPage();
    await openTokio(page);
    if (testCase.detail) {
      await page.click(".place-card:not(.place-card--compact) .place-card__open");
      await page.waitForSelector(".app__detail", { timeout: 10000 });
      await page.waitForTimeout(400);
    }
    const g = await geometry(page);

    // Dos medidas independientes del mismo hecho: las pistas que declara la rejilla y las
    // tarjetas que acaban compartiendo fila. Si discrepan, la rejilla miente.
    check(
      `${testCase.name}: ${testCase.columns} columna(s)`,
      g.trackCount === testCase.columns && g.rowCount === testCase.columns,
      `pistas=${g.trackCount} tarjetas en la 1ª fila=${g.rowCount} región=${Math.round(g.regionWidth)}px`
    );
    check(
      `${testCase.name}: PlaceCard ≥${MIN_CARD_WIDTH}px`,
      g.minCardWidth >= MIN_CARD_WIDTH,
      `mínima=${g.minCardWidth.toFixed(1)}px`
    );
    const expectedRatio = testCase.columns === 1 ? 4 / 3 : 16 / 9;
    check(
      `${testCase.name}: proporción ${testCase.columns === 1 ? "4:3" : "16:9"}`,
      Math.abs(g.mediaRatio - expectedRatio) < 0.02,
      `medida=${g.mediaRatio.toFixed(3)} esperada=${expectedRatio.toFixed(3)}`
    );
    check(
      `${testCase.name}: raíl ≤50% del cuerpo`,
      g.railWidth <= g.bodyWidth / 2 + 0.5,
      `raíl=${Math.round(g.railWidth)}px de ${Math.round(g.bodyWidth)}px (${((g.railWidth / g.bodyWidth) * 100).toFixed(1)}%)`
    );
    await context.close();
  }

  // ---------- El mapa conserva centro, zoom y pin al abrir/cerrar la ficha (lg/xl) ----------
  /*
   * `lg`/`xl` son los únicos anchos donde el mapa vive permanentemente en el raíl y la ficha se
   * apoya encima. DD-016 exige que abrir y cerrar la ficha no le cueste al mapa ni el centro ni
   * el zoom ni el marcador: el lector vuelve exactamente al mapa que dejó. Se mide el ciclo
   * COMPLETO — antes de abrir, con la ficha abierta y después de cerrar — porque lo que se está
   * comprobando es que la ficha no mueve el mapa, no sólo que el cierre no lo mueve.
   *
   * `leaflet-map-pane`'s `transform` es la posición del lienzo (centro) y `.leaflet-tile-pane`
   * lleva el nivel de zoom activo en el `data-` de sus capas; se leen los dos, más la caja real
   * del contenedor y los marcadores.
   */
  for (const width of [1200, 1600]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await openTokio(page);
    await page.waitForTimeout(1500);

    const readMap = () =>
      page.evaluate(() => {
        const pane = document.querySelector(".leaflet-map-pane");
        const box = document.querySelector(".place-map").getBoundingClientRect();
        const tileLayer = document.querySelector(".leaflet-tile-pane .leaflet-layer > div");
        return {
          transform: getComputedStyle(pane).transform,
          zoom: tileLayer ? getComputedStyle(tileLayer).transform : null,
          width: Math.round(box.width),
          height: Math.round(box.height),
          markers: document.querySelectorAll(".place-marker").length,
          selectedMarkers: document.querySelectorAll(".place-marker--selected").length,
          detailMounted: document.querySelectorAll(".app__detail").length,
        };
      });

    const before = await readMap();

    await page.click(".place-card:not(.place-card--compact) .place-card__open");
    await page.waitForSelector(".app__detail", { timeout: 10000 });
    await page.waitForTimeout(1500);
    const open = await readMap();

    await page.click(".app__detail .place-detail__bar .icon-button");
    await page.waitForTimeout(1500);
    const closed = await readMap();

    check(
      `${width}: la ficha se abre y se cierra de verdad`,
      before.detailMounted === 0 && open.detailMounted === 1 && closed.detailMounted === 0,
      `fichas montadas antes=${before.detailMounted} abierta=${open.detailMounted} cerrada=${closed.detailMounted}`
    );
    check(
      `${width}: el mapa no cambia de tamaño en todo el ciclo`,
      before.width === open.width &&
        open.width === closed.width &&
        before.height === open.height &&
        open.height === closed.height,
      `antes=${before.width}×${before.height} abierta=${open.width}×${open.height} cerrada=${closed.width}×${closed.height}`
    );
    check(
      `${width}: el mapa conserva el centro en todo el ciclo`,
      before.transform === open.transform && open.transform === closed.transform,
      before.transform === closed.transform
        ? `transform idéntica: ${closed.transform}`
        : `${before.transform} → ${open.transform} → ${closed.transform}`
    );
    check(
      `${width}: el mapa conserva el zoom en todo el ciclo`,
      before.zoom === open.zoom && open.zoom === closed.zoom,
      `capa de teselas ${before.zoom === closed.zoom ? "sin cambio" : `${before.zoom} → ${closed.zoom}`}`
    );
    check(
      `${width}: el pin del lugar se marca con la ficha y el mapa no pierde marcadores`,
      open.markers === before.markers &&
        closed.markers === before.markers &&
        before.markers > 0 &&
        open.selectedMarkers === 1,
      `marcadores=${before.markers}/${open.markers}/${closed.markers}, seleccionado con la ficha abierta=${open.selectedMarkers}`
    );
    await context.close();
  }

  // ---------- Ningún text-shadow en la superficie de descubrimiento ----------
  {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    await openTokio(page);
    const shadows = await page.evaluate(() =>
      [...document.querySelectorAll(".place-card, .place-card *")]
        .map((el) => getComputedStyle(el).textShadow)
        .filter((value) => value && value !== "none")
    );
    check("ningún text-shadow en PlaceCard", shadows.length === 0, `encontrados: ${shadows.length}`);
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK.`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  FAIL ${f.label}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
