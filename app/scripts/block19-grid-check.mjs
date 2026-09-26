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
          // B24 (P0-4, `03 §9`): con la agrupación, «no perder marcadores» se mide en LUGARES
          // representados — sueltos más la cifra de cada grupo —, porque el lugar seleccionado
          // sale de su grupo para quedar «encima de todos» y el número de iconos cambia.
          markers:
            document.querySelectorAll(".place-marker").length +
            [...document.querySelectorAll(".place-cluster__count")].reduce(
              (sum, el) => sum + Number(el.textContent),
              0
            ),
          selectedMarkers: document.querySelectorAll(".place-marker--selected").length,
          detailMounted: document.querySelectorAll(".app__detail").length,
        };
      });

    const before = await readMap();

    await page.click(".place-card:not(.place-card--compact) .place-card__open");
    await page.waitForSelector(".app__detail", { timeout: 10000 });
    await page.waitForTimeout(1500);
    const open = await readMap();

    await page.click(".app__detail .place-detail__back");
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

  // ---------- DDR-02: toda la tarjeta abre; acciones independientes quedan por encima ----------
  {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    // `04 §5.5`: el `PersonToken` sólo aparece cuando la OTRA persona ha marcado el lugar. Sin
    // sembrarlo no existe ninguna tarjeta con token, y la comprobación de que el token conserva
    // su superficie propia no llegaría a ejercitarse nunca.
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      try {
        localStorage.setItem(
          "nihon.travellers.v1",
          JSON.stringify({
            version: 1,
            travellers: [
              { id: "trav-a", label: "Ana" },
              { id: "trav-b", label: "Beto" },
            ],
            activeTravellerId: "trav-a",
            interests: [
              { placeId: "JP-001", stances: [{ travellerId: "trav-b", stance: "interested" }], carriedOver: false },
            ],
          })
        );
      } catch {
        /* ignore */
      }
    });
    await openTokio(page);
    for (let i = 0; i < 20; i += 1) {
      await page.locator(".app__sidebar").evaluate((el) => el.scrollBy(0, 1200));
      await page.waitForTimeout(90);
    }

    const cards = page.locator(".place-card:not(.place-card--compact)");
    const withPhoto = cards.filter({ has: page.locator(".place-card__image") }).first();
    const withoutPhoto = cards.filter({ has: page.locator(".photo-placeholder") }).first();

    const closeDetail = async () => {
      await page.locator(".app__detail .place-detail__back").click();
      await page.waitForSelector(".app__detail", { state: "detached" });
    };
    /*
     * Se pulsa por COORDENADAS, no por locator.
     *
     * `locator.click()` exige que el elemento no esté tapado, y aquí el botón principal tapa —a
     * propósito— toda la tarjeta: Playwright aborta con «intercepts pointer events» sobre
     * `.place-card__media`, `.place-card__reason` y cualquier otra zona. Eso no es un fallo del
     * producto, es el contrato de DDR-02 funcionando. Lo que hay que reproducir es lo que hace
     * un dedo: caer sobre ESAS coordenadas y que se abra el lugar. `page.mouse.click` sobre el
     * centro de la zona lo hace exactamente así, sin `force` (que saltaría la comprobación y
     * pulsaría el elemento equivocado).
     */
    const opensFrom = async (card, selector) => {
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const zone = card.locator(selector).first();
      if ((await zone.count()) === 0) return null;
      const box = await zone.boundingBox();
      if (!box) return null;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      const opened = await page.locator(".app__detail").count();
      if (opened) await closeDetail();
      return opened === 1;
    };

    for (const [kind, card] of [
      ["con foto", withPhoto],
      ["sin foto", withoutPhoto],
    ]) {
      const exists = (await card.count()) > 0;
      check(`DDR-02: existe tarjeta ${kind}`, exists);
      if (!exists) continue;
      for (const [zone, selector] of [
        ["fotografía/placeholder", ".place-card__media"],
        ["nombre", ".place-card__heading"],
        ["razón", ".place-card__reason"],
        ["chip", ".place-card__chip"],
      ]) {
        const result = await opensFrom(card, selector);
        check(
          `${kind}: ${zone} abre`,
          result === true,
          result === null ? "zona ausente en esta tarjeta" : undefined
        );
      }
    }

    const actionCard = cards.filter({ has: page.locator(".place-card__person-token") }).first();
    check("DDR-02: existe tarjeta con token de persona", (await actionCard.count()) === 1);
    if ((await actionCard.count()) === 1) {
      await actionCard.scrollIntoViewIfNeeded();
      const save = actionCard.locator(".place-card__save");
      const before = await save.getAttribute("aria-pressed");
      await save.click();
      const after = await save.getAttribute("aria-pressed");
      check(
        "corazón guarda/quita guardado y NO abre",
        before !== after && (await page.locator(".app__detail").count()) === 0,
        `${before}→${after}`
      );

      const token = actionCard.locator(".place-card__person-token");
      const tokenLabel = await token.getAttribute("aria-label");
      await token.click();
      check(
        "token de persona conserva su superficie propia y NO abre",
        Boolean(tokenLabel) && (await page.locator(".app__detail").count()) === 0,
        tokenLabel
      );
    }

    await withPhoto.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    /*
     * El target cubre la CAJA DE RELLENO de la tarjeta, no su caja de borde.
     *
     * `inset: 0` sobre un elemento posicionado se resuelve contra la caja de relleno del
     * contenedor, y `.place-card` lleva `border: 1px`. Así que el target queda encajado 1px por
     * cada lado: cubre toda la superficie útil y NO se monta sobre el borde ni puede invadir a la
     * tarjeta vecina. Eso es lo correcto, no una desviación — exigir coincidencia exacta con la
     * caja de borde haría fallar el contrato por cumplirlo.
     */
    const targetGeometry = await withPhoto.evaluate((card) => {
      const target = card.querySelector(".place-card__open");
      const c = card.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const cs = getComputedStyle(card);
      const border = {
        top: parseFloat(cs.borderTopWidth),
        right: parseFloat(cs.borderRightWidth),
        bottom: parseFloat(cs.borderBottomWidth),
        left: parseFloat(cs.borderLeftWidth),
      };
      const near = (a, b) => Math.abs(a - b) < 0.5;
      const outside = document.elementFromPoint(c.right + 2, c.top + c.height / 2);
      return {
        coversPaddingBox:
          near(t.left, c.left + border.left) &&
          near(t.top, c.top + border.top) &&
          near(t.right, c.right - border.right) &&
          near(t.bottom, c.bottom - border.bottom),
        containedInCard: t.left >= c.left - 0.5 && t.right <= c.right + 0.5 && t.top >= c.top - 0.5 && t.bottom <= c.bottom + 0.5,
        outsideIsTarget: Boolean(outside?.closest(".place-card__open")),
        border,
      };
    });
    check(
      "target principal cubre la tarjeta entera y no sale de ella",
      targetGeometry.coversPaddingBox && targetGeometry.containedInCard && !targetGeometry.outsideIsTarget,
      JSON.stringify(targetGeometry)
    );

    const open = withPhoto.locator(".place-card__open");
    // `:focus-visible` sólo se enciende cuando la modalidad de interacción es el teclado. Tras
    // los clics de las comprobaciones anteriores, un `focus()` programático a secas NO lo activa,
    // y el anillo se leería como inexistente — un falso negativo. Un `Tab` devuelve la modalidad
    // a teclado, que es además el caso que esta comprobación quiere describir.
    await page.keyboard.press("Tab");
    await open.focus();
    check("teclado: el target principal recibe foco", await open.evaluate((el) => el === document.activeElement));
    /*
     * `03 §7` / gate G5: el foco tiene que VERSE. Desde DDR-02 el target abarca fotografía y
     * papel a la vez, así que un anillo del color del papel queda invisible en la mitad inferior
     * de la tarjeta. Se comprueba lo que de verdad importa: que el anillo no sea del mismo color
     * que la superficie sobre la que se dibuja.
     */
    const ring = await open.evaluate((el) => {
      const cs = getComputedStyle(el);
      const card = el.closest(".place-card");
      return {
        color: cs.outlineColor,
        width: cs.outlineWidth,
        style: cs.outlineStyle,
        offset: cs.outlineOffset,
        cardBackground: getComputedStyle(card).backgroundColor,
        listBackground: getComputedStyle(card.closest(".app__sidebar") ?? document.body).backgroundColor,
      };
    });
    check(
      "el anillo de foco se distingue de la superficie sobre la que cae",
      ring.style !== "none" &&
        parseFloat(ring.width) > 0 &&
        ring.color !== ring.cardBackground &&
        ring.color !== ring.listBackground,
      `${ring.style} ${ring.width} ${ring.color} @ ${ring.offset} sobre ${ring.cardBackground}`
    );
    await page.keyboard.press("Enter");
    check("teclado: Enter abre el lugar", (await page.locator(".app__detail").count()) === 1);
    await closeDetail();

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
