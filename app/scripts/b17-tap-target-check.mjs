import { chromium } from "playwright";

/**
 * Corrección de cumplimiento (auditoría posterior al cierre del Bloque 17).
 *
 * Art. 11 exige 44×44 px de área táctil mínima. Este script no confía en el tamaño visual
 * declarado en CSS: mide el `getBoundingClientRect()` real del elemento clicable (que para
 * `.tap-target-min` es más grande que su caja pintada, por el `::after` absolutamente
 * posicionado) y, por separado, dispara un click sintético en un punto DENTRO del área ampliada
 * pero FUERA de la caja visual pequeña, para probar que ese click realmente activa el control —
 * no basta con que el rectángulo mida 44px, tiene que responder ahí.
 *
 * **Actualizado el 2026-09-21.** El requisito (Art. 11 / gate G5) no ha cambiado ni un píxel;
 * los controles concretos sí. El guion recorría el cromo anterior a B18 y fallaba en su primera
 * medición (`.app__help`), sin llegar a comprobar ninguna de las demás. Cambios, uno a uno:
 *
 * | Control de antes | Qué pasó | Qué se mide ahora |
 * |---|---|---|
 * | `.app__help` | B18 lo retiró: «Cómo funciona Nihon» es ahora una sección de Nosotros, no un icono del cromo | `.app__person-token-button`, el control pequeño que B18 sí dejó en la cabecera (`02 §D4`) |
 * | `.filter-chip` | B19 lo sustituyó por `ChipToggle` (`04 §3`/`§13`) | `.chip-toggle`, misma técnica `.tap-target-min` |
 * | `.view-bar__filters` | B18 lo sustituyó por la barra única (`05 §4`) | `.explorer-bar__filters` como camino, no como medición (ya lo mide `b18-a11y-check.mjs`) |
 * | `.search-field__clear` en la barra | B19 lo movió dentro de `SearchSheet` (`04 §12`) | el mismo control, dentro de la hoja |
 * | `.trip-backup__close` | **Desapareció**: en Nosotros, `TripBackup` se renderiza `embedded`, sin modal ni botón de cierre | nada que medir — no hay control (ver nota abajo) |
 * | `.selection-panel__toggle` desde Explorar | B18 lo llevó a la pestaña «Quiero ir» (`02 §D2`) | el mismo control, alcanzado por su pestaña |
 *
 * Se añade `.place-card__save` (el corazón de 40px de `04 §5.4`), que no existía cuando se
 * escribió este gate y es hoy el control pequeño más repetido de todo el producto.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const MIN = 44;

async function dismissOnboarding(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

/** Reads the *effective* hit box: the element's own rect, unioned with its ::after's rect if
 * that pseudo-element exists and is larger (mirrors what `.tap-target-min`/`.filter-chip`'s
 * `::after` actually paints as an absolutely-positioned box, which `getBoundingClientRect()`
 * on the real element does not include). */
async function effectiveHitBox(locator) {
  return locator.evaluate((el) => {
    const own = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    let width = own.width;
    let height = own.height;
    if (after.content && after.content !== "none" && after.position === "absolute") {
      const w = parseFloat(after.width);
      const h = parseFloat(after.height);
      if (!Number.isNaN(w)) width = Math.max(width, w);
      if (!Number.isNaN(h)) height = Math.max(height, h);
    }
    return { width, height, ownWidth: own.width, ownHeight: own.height };
  });
}

/**
 * Segunda corrección de cumplimiento: técnica 2 (caja real de 44×44) para filas densas de
 * controles del mismo tamaño (`.icon-button--small`, `.gallery__dot`). A diferencia de
 * `effectiveHitBox` (que une la caja propia con un `::after` invisible), aquí la caja real YA
 * mide --tap-min, así que lo que hay que demostrar es distinto: que ninguna caja real se solapa
 * con la de su vecina (geometría, no una zona pintada por encima de otra), y que un click justo
 * al lado del límite entre dos controles resuelve siempre al control más próximo — nunca al
 * vecino, nunca a ninguno.
 *
 * Cuando `containerSelector` matchea varias filas (p. ej. una `.sequence-item__controls` por
 * cada lugar de la lista, o una `.day-card__header-actions` por día), elige la fila con más
 * controles — la más apretada, y por tanto el peor caso real disponible en la página.
 */
async function checkDenseRow(page, containerSelector, itemSelector, label, results) {
  const data = await page.evaluate(
    ({ containerSelector, itemSelector }) => {
      const containers = Array.from(document.querySelectorAll(containerSelector));
      let bestContainer = null;
      let items = [];
      for (const candidate of containers) {
        const found = Array.from(candidate.querySelectorAll(itemSelector));
        if (found.length > items.length) {
          items = found;
          bestContainer = candidate;
        }
      }
      if (items.length < 2) return { count: items.length };

      // `elementFromPoint` only resolves points inside the currently visible viewport — a
      // container scrolled far down a long dialog (e.g. the Nth `.day-card` in "Distribuir por
      // días") would otherwise report every point as null, not because of an overlap bug but
      // because the coordinates fall outside what is actually painted right now.
      bestContainer.scrollIntoView({ block: "center", inline: "center" });

      const rects = items.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      });
      const perItem = rects.map((r) => ({
        width: r.width,
        height: r.height,
        ok44: r.width >= 43.5 && r.height >= 43.5,
      }));

      // Adjacent pairs in visual (left-to-right) order — the only order that matters for a
      // single flex row, which is what every dense group this correction found actually is.
      const order = items.map((_, i) => i).sort((a, b) => rects[a].x - rects[b].x);
      const overlaps = [];
      const boundaries = [];
      for (let k = 0; k < order.length - 1; k++) {
        const ia = order[k];
        const ib = order[k + 1];
        const a = rects[ia];
        const b = rects[ib];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        const boxesOverlap = overlapX > 0.5 && overlapY > 0.5;
        overlaps.push({ ia, ib, overlaps: boxesOverlap, overlapX, overlapY });

        // The boundary that matters is each box's own edge facing its neighbour, not the
        // midpoint of whatever gap separates them (a real gap resolves to neither control,
        // by design, and testing it would prove nothing). 1px inside A's edge nearest B must
        // still resolve to A — never to B, and never to nothing — and the mirror point 1px
        // inside B's edge nearest A must resolve to B. This is exactly what would fail if the
        // old invisible-::after technique's expanded zones were still reaching into a
        // neighbour: the resolution right at the edge would go to the wrong control.
        const midY = (Math.max(a.y, b.y) + Math.min(a.bottom, b.bottom)) / 2;
        const edgeOfAEl = document.elementFromPoint(a.right - 1, midY);
        const edgeOfBEl = document.elementFromPoint(b.x + 1, midY);
        boundaries.push({
          ia,
          ib,
          edgeOfAResolvesToA: edgeOfAEl ? edgeOfAEl.closest(itemSelector) === items[ia] : false,
          edgeOfBResolvesToB: edgeOfBEl ? edgeOfBEl.closest(itemSelector) === items[ib] : false,
        });
      }
      return { count: items.length, perItem, overlaps, boundaries };
    },
    { containerSelector, itemSelector }
  );

  if (data.count < 2) {
    console.log(`SKIP ${label}: only ${data.count} matching control(s) found, nothing to compare`);
    return;
  }

  data.perItem.forEach((item, i) => {
    results.push({ label: `${label} [${i}] real box ≥44×44`, ok: item.ok44 });
    console.log(
      `${item.ok44 ? "OK  " : "FAIL"} ${label} [${i}] real box: ${item.width.toFixed(1)}x${item.height.toFixed(1)}`
    );
  });
  data.overlaps.forEach(({ ia, ib, overlaps, overlapX, overlapY }) => {
    const ok = !overlaps;
    results.push({ label: `${label} [${ia}]/[${ib}] no overlap between neighbours`, ok });
    console.log(
      `${ok ? "OK  " : "FAIL"} ${label} boxes ${ia}/${ib} no overlap (overlapX=${overlapX.toFixed(
        1
      )}, overlapY=${overlapY.toFixed(1)})`
    );
  });
  data.boundaries.forEach(({ ia, ib, edgeOfAResolvesToA, edgeOfBResolvesToB }) => {
    const ok = edgeOfAResolvesToA && edgeOfBResolvesToB;
    results.push({ label: `${label} [${ia}]/[${ib}] each box's own edge resolves to itself`, ok });
    console.log(
      `${ok ? "OK  " : "FAIL"} ${label} boundary ${ia}/${ib}: edge of ${ia}→${ia}? ${edgeOfAResolvesToA}, edge of ${ib}→${ib}? ${edgeOfBResolvesToB}`
    );
  });
}

/**
 * Espera a que un control esté REALMENTE asentado antes de medirlo.
 *
 * `.sheet` entra con animación (`--dur-sheet`) y su cuerpo scrollea, así que `boundingBox()`
 * puede devolver una caja que ya no es la pintada. Medir ahí produce falsos negativos que no
 * tienen nada que ver con el área táctil. Se considera asentado cuando el centro del propio
 * control se resuelve a sí mismo en dos lecturas consecutivas con la misma caja.
 */
async function settled(page, locator, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let previous = null;
  while (Date.now() < deadline) {
    // `block: "center"`, no `scrollIntoViewIfNeeded`: éste hace el desplazamiento MÍNIMO, que en
    // una hoja con pie fijo deja el control justo debajo del pie — tapado, no medible.
    await locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    const box = await locator.boundingBox();
    if (box) {
      // Asentado = el centro del propio control se resuelve a ÉL, no a cualquier botón que haya
      // encima. Comprobar identidad y no «algún button» es lo que distingue estar asentado de
      // estar tapado por el pie de la hoja.
      const hitsItself = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return Boolean(at && (at === el || el.contains(at)));
      });
      const stable =
        previous && Math.abs(previous.x - box.x) < 0.5 && Math.abs(previous.y - box.y) < 0.5;
      if (hitsItself && stable) return box;
      previous = box;
    }
    await page.waitForTimeout(120);
  }
  return locator.boundingBox();
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const results = [];
  const record = (label, box) => {
    const ok = box.width >= MIN - 0.5 && box.height >= MIN - 0.5;
    results.push({ label, ok, box });
    console.log(
      `${ok ? "OK  " : "FAIL"} ${label}: visual=${box.ownWidth.toFixed(1)}x${box.ownHeight.toFixed(
        1
      )} effective=${box.width.toFixed(1)}x${box.height.toFixed(1)}`
    );
  };

  /** Los cuatro destinos de `02 §D2`, por nombre accesible y no por clase interna. */
  const goTo = async (name) => {
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name })
      .click();
    await page.waitForTimeout(300);
  };

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.reload({ waitUntil: "networkidle" });
  await dismissOnboarding(page);

  // Cabecera: el token de persona (24px visual, `02 §D4`) — el control pequeño que B18 dejó en
  // el cromo permanente, en el sitio que antes ocupaba `.app__help`.
  record("App.tsx .app__person-token-button", await effectiveHitBox(page.locator(".app__person-token-button")));

  // Enter a hub to reach chips / icon-button--small / gallery dots / place detail close
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });

  // `.place-card__save` — el corazón de 40px de `04 §5.4`, el control pequeño más repetido.
  const saveHeart = page.locator(".place-card__save").first();
  record("PlaceCard .place-card__save (40px visual)", await effectiveHitBox(saveHeart));
  {
    const box = await saveHeart.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest(".place-card__save") !== null : false;
      },
      [box.x + box.width / 2, box.y - 1.5]
    );
    results.push({ label: "place-card__save expanded zone resolves to the button", ok: hit });
    console.log(`${hit ? "OK  " : "FAIL"} place-card__save expanded zone resolves to the button`);
  }

  // `.chip-toggle` (40px visual) — sustituye a `.filter-chip`, misma técnica `.tap-target-min`.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(400);
  const chip = page.locator(".sheet .chip-toggle").first();
  record("FilterSheet .chip-toggle (first)", await effectiveHitBox(chip));
  /*
   * El chip de etiqueta más corta es el peor caso de ancho, pero sólo cuenta si está PINTADO:
   * `FilterSheet` agrupa los chips en `<details>` y los grupos cerrados siguen devolviendo una
   * `getBoundingClientRect()` no nula para sus hijos, aunque no se pinte nada ahí. Medir uno de
   * esos produce un falso negativo perfecto —caja correcta, `elementFromPoint` ajeno— que no
   * dice nada sobre el área táctil. Se filtra por `checkVisibility()` y por grupo abierto.
   * Además la hoja scrollea, así que el candidato se lleva a la vista antes de medirlo.
   */
  const narrowChip = await page.locator(".sheet .chip-toggle").evaluateAll((els) => {
    let best = -1;
    let bestWidth = Infinity;
    els.forEach((el, i) => {
      const group = el.closest("details");
      const painted = el.checkVisibility?.() ?? el.offsetParent !== null;
      if (!painted || (group && !group.open)) return;
      // Sólo chips sin marcar: los grupos de opción única (Reserva) no se desmarcan al volver a
      // pulsar la opción activa, así que un chip ya marcado no puede demostrar nada con un
      // click — su `aria-pressed` no cambiaría ni pulsándolo en el centro.
      if (el.getAttribute("aria-pressed") !== "false") return;
      const w = el.getBoundingClientRect().width;
      if (w < bestWidth) {
        bestWidth = w;
        best = i;
      }
    });
    return best;
  });
  if (narrowChip >= 0) {
    const target = page.locator(".sheet .chip-toggle").nth(narrowChip);
    await settled(page, target);
    record("FilterSheet .chip-toggle (narrowest)", await effectiveHitBox(target));

    /*
     * Prueba de CONDUCTA, no de geometría: se pulsa de verdad en un punto por encima de la caja
     * propia de 40px pero dentro de la expansión de 44px, y se comprueba que el chip cambia de
     * estado (`aria-pressed`). Es lo que de verdad exige Art. 11 —que el área ampliada responda—
     * y no depende de aritmética de coordenadas hecha a mano, que en una hoja que scrollea y con
     * `<details>` que se expanden es una fuente de falsos negativos.
     */
    const before = await target.getAttribute("aria-pressed");
    const box = await settled(page, target);
    await page.mouse.click(box.x + box.width / 2, box.y - 1.5);
    await page.waitForTimeout(300);
    const after = await target.getAttribute("aria-pressed");
    const hit = before !== after;
    results.push({ label: "chip-toggle: la zona ampliada activa el chip de verdad", ok: hit });
    console.log(
      `${hit ? "OK  " : "FAIL"} chip-toggle: la zona ampliada activa el chip de verdad ` +
        `(aria-pressed ${before} → ${after})`
    );
    // Se deja el filtro como estaba, para no arrastrar estado a las comprobaciones siguientes.
    if (hit) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // `.search-field__clear`, ahora dentro de `SearchSheet` (`04 §12`).
  await page.getByRole("button", { name: /^Buscar en Tokio/ }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill("a");
  await page.waitForTimeout(300);
  const clearBtn = page.locator(".search-sheet .search-field__clear").first();
  if (await clearBtn.isVisible().catch(() => false)) {
    record("SearchSheet .search-field__clear", await effectiveHitBox(clearBtn));
  } else {
    results.push({ label: "SearchSheet .search-field__clear reachable", ok: false });
    console.log("FAIL SearchSheet .search-field__clear reachable: botón de borrado no encontrado");
  }
  await clearBtn.click().catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Place detail close (.icon-button, already 44px) + gallery dots + gallery nav.
  // The dataset has exactly 6 places with a 2-photo gallery (dots only render when total > 1);
  // "Tokyo National Museum" (JP-021) is one and lives in the Tokio hub already open here, so
  // it is targeted directly instead of guessing through the first N cards — the earlier version
  // of this script never actually found a gallery this way, which is why the compliance
  // correction's live verification for `.gallery__dot` was previously left incomplete.
  //
  // B19 añadió carga progresiva de 12 en 12 (`05 §4`), así que el museo ya no está en el DOM al
  // entrar a la ciudad: se llega por la hoja de búsqueda, que es además el camino que un lector
  // usaría de verdad para encontrar un lugar concreto.
  let galleryDot = null;
  await page.getByRole("button", { name: /^Buscar en Tokio/ }).click();
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill("Tokyo National Museum");
  await page.waitForTimeout(600);

  /*
   * Variante `compact` (`04 §5.10`): el corazón y el botón del nombre conviven en una fila, y el
   * corazón usa la técnica 1 (`::after` invisible). Aquí esa técnica SÓLO es válida mientras el
   * `::after` se mida contra el propio botón: si el botón pierde su `position: relative`, el
   * `100%` se resuelve contra `.place-card` y el área invisible se traga la tarjeta entera —
   * tocar el nombre guardaría el lugar en vez de abrirlo. Es exactamente el fallo que esta
   * comprobación encontró en B19 (corregido en `discovery.css`), así que se queda de guardia.
   */
  {
    const probe = await page.evaluate(() => {
      const card = document.querySelector(".search-sheet .place-card--compact");
      if (!card) return null;
      const open = card.querySelector(".place-card__open").getBoundingClientRect();
      const at = document.elementFromPoint(open.x + open.width / 2, open.y + open.height / 2);
      return { resolvesToOpen: Boolean(at && at.closest(".place-card__open")) };
    });
    const ok = Boolean(probe && probe.resolvesToOpen);
    results.push({ label: "compact card: el centro del nombre resuelve al botón que abre, no al corazón", ok });
    console.log(`${ok ? "OK  " : "FAIL"} compact card: el centro del nombre resuelve al botón que abre, no al corazón`);
  }
  {
    const heart = page.locator(".search-sheet .place-card__save--compact").first();
    record("PlaceCard compact .place-card__save (32px visual)", await effectiveHitBox(heart));
    const contained = await heart.evaluate((el) => {
      const own = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      return {
        w: parseFloat(after.width),
        h: parseFloat(after.height),
        cardW: el.closest(".place-card").getBoundingClientRect().width,
        ownW: own.width,
      };
    });
    // El área ampliada tiene que ser del tamaño del control (≥44px), no del de la tarjeta.
    const ok = contained.w >= 44 - 0.5 && contained.w < contained.cardW / 2;
    results.push({ label: "compact card: el área ampliada del corazón mide el control, no la tarjeta", ok });
    console.log(
      `${ok ? "OK  " : "FAIL"} compact card: el área ampliada del corazón mide el control, no la tarjeta ` +
        `(::after=${contained.w.toFixed(1)}x${contained.h.toFixed(1)}, tarjeta=${contained.cardW.toFixed(1)})`
    );
  }

  const museumResult = page.locator(".search-sheet .place-card").first();
  if (await museumResult.count()) {
    await museumResult.locator(".place-card__open").click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(500);
    const dot = page.locator(".gallery__dot").first();
    if (await dot.count()) galleryDot = dot;
  }
  if (galleryDot) {
    record("PlaceGallery .gallery__dot (first)", await effectiveHitBox(galleryDot));

    // The dot's real box now measures --tap-min (44px) directly — no ::after involved — with
    // the small visible circle drawn by an inner ::before. Click 2px inside the real box's top
    // edge (well outside the ~9px visual circle, but still inside the real 44px box) and confirm
    // the click still activates the button, proving the enlarged AREA is what is interactive,
    // not just what is painted.
    const box = await galleryDot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const clickX = box.x + box.width / 2;
    const clickY = box.y + 2;
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest(".gallery__dot") !== null : false;
      },
      [clickX, clickY]
    );
    results.push({ label: "gallery__dot's real 44px box (not just the visual dot) resolves to the button", ok: hit });
    console.log(
      `${hit ? "OK  " : "FAIL"} gallery__dot's real 44px box (not just the visual dot) resolves to the button`
    );

    await checkDenseRow(page, ".gallery__dots", ".gallery__dot", "PlaceGallery .gallery__dots (dense row)", results);
  } else {
    results.push({ label: "PlaceGallery .gallery__dot reachable (Tokyo National Museum)", ok: false });
    console.log("FAIL PlaceGallery .gallery__dot reachable (Tokyo National Museum): card or dots not found");
  }
  if (await page.locator(".place-detail").isVisible().catch(() => false)) {
    await page.locator(".place-detail__back").first().click();
    await page.waitForTimeout(150);
  }

  /*
   * `.trip-backup__close` ya no existe y no se sustituye por otra medición.
   *
   * En v1.1.0 el respaldo era un modal abierto desde un icono del cromo, y su `×` de 40px era
   * justo el tipo de control que Art. 11 vigila. B18 lo asentó en «Nosotros › Copia del viaje»
   * como una sección permanente: `TripBackup` se renderiza con `embedded`, y su propio JSX
   * envuelve el botón de cierre en `{!embedded && …}`. **No hay control que medir porque no hay
   * control.** Que el respaldo siga siendo alcanzable lo cubre `b17-regression-check.mjs`
   * («respaldo del viaje sigue alcanzable» + exportar/importar); que la sección sea navegable
   * por teclado lo cubre `b18-a11y-check.mjs`. No se ha retirado ninguna garantía: se ha
   * retirado la medición de un botón que el rediseño eliminó.
   */

  // `.icon-button--small` dentro del planificador. B18 llevó «Quiero ir» a su propia pestaña
  // (`02 §D2`), así que se llega por ahí en vez de por un toggle dentro de Explorar.
  if (await page.locator(".place-detail").isVisible().catch(() => false)) {
    await page.locator(".place-detail__back").first().click();
    await page.waitForTimeout(200);
  }
  const saveButtons = page.locator(".place-card__save");
  const saveCount = await saveButtons.count();
  for (let i = 0; i < Math.min(2, saveCount); i++) {
    await saveButtons.nth(i).click();
    await page.waitForTimeout(150);
  }
  await goTo("Quiero ir");
  await page.waitForTimeout(300);
  const selectionToggle = page.locator(".destination-panel:not([hidden]) .selection-panel__toggle");
  if (await selectionToggle.isVisible().catch(() => false)) {
    await selectionToggle.click();
    await page.waitForTimeout(300);
  }
  const buildButton = page.locator("button:has-text('Construir recorrido')");
  if (await buildButton.isVisible().catch(() => false)) {
    await buildButton.click();
    await page.waitForTimeout(400);
    const small = page.locator(".icon-button--small").first();
    if (await small.count()) {
      record("OrderedSequenceBuilder .icon-button--small (first)", await effectiveHitBox(small));
    }

    await checkDenseRow(
      page,
      ".sequence-item__controls",
      ".icon-button--small",
      "OrderedSequenceBuilder .sequence-item__controls (dense row)",
      results
    );
    // `.day-card__header-actions` only renders in the "Distribuir por días" view, a second
    // view of the same route reached from the builder toolbar.
    const daysButton = page.locator("button:has-text('Distribuir por días')");
    if (await daysButton.isVisible().catch(() => false)) {
      await daysButton.click();
      await page.waitForTimeout(300);
      await checkDenseRow(
        page,
        ".day-card__header-actions",
        ".icon-button--small",
        "OrderedSequenceBuilder .day-card__header-actions (dense row)",
        results
      );
    } else {
      results.push({ label: "OrderedSequenceBuilder .day-card__header-actions reachable", ok: false });
      console.log("FAIL OrderedSequenceBuilder .day-card__header-actions reachable: 'Distribuir por días' button not found");
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} tap-target checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
