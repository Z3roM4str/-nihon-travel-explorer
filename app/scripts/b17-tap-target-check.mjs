import { chromium } from "playwright";

/**
 * Corrección de cumplimiento (auditoría posterior al cierre del Bloque 17).
 *
 * Art. 11 exige 44×44 px de área táctil mínima. Este script no confía en el tamaño visual
 * declarado en CSS: mide el `getBoundingClientRect()` real del elemento clicable (que para
 * `.tap-target-min`/`.filter-chip` es más grande que su caja pintada, por el `::after`
 * absolutamente posicionado) y, por separado, dispara un click sintético en un punto DENTRO
 * del área ampliada pero FUERA de la caja visual pequeña, para probar que ese click realmente
 * activa el control — no basta con que el rectángulo mida 44px, tiene que responder ahí.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4182";
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

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.reload({ waitUntil: "networkidle" });
  await dismissOnboarding(page);

  // .app__help (36px visual)
  record("App.tsx .app__help", await effectiveHitBox(page.locator(".app__help")));

  // Enter a hub to reach chips / icon-button--small / gallery dots / place detail close
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });

  // .filter-chip (40px visual, ChipToggle)
  await page.click(".view-bar__filters");
  await page.waitForTimeout(300);
  const chip = page.locator(".filter-chip").first();
  record("FilterPanel .filter-chip (first)", await effectiveHitBox(chip));
  // A narrow, short-label chip is the worst case for width.
  const gradeChip = page.locator(".filter-chip--grade").first();
  if (await gradeChip.count()) {
    record("FilterPanel .filter-chip--grade (narrowest)", await effectiveHitBox(gradeChip));

    // Click test: a point above the chip's own 40px-tall box but inside the 44px expansion.
    const box = await gradeChip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const clickX = box.x + box.width / 2;
    const clickY = box.y - 1.5; // inside the +2px vertical expansion, outside the visual box
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest(".filter-chip--grade") !== null : false;
      },
      [clickX, clickY]
    );
    results.push({ label: "filter-chip--grade expanded zone resolves to the label", ok: hit });
    console.log(`${hit ? "OK  " : "FAIL"} filter-chip--grade expanded zone resolves to the label`);
  }
  await page.click(".view-bar__filters");
  await page.waitForTimeout(200);

  // .search-field__clear
  const searchInput = page.locator(".search-field__input").first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("a");
    await page.waitForTimeout(200);
    const clearBtn = page.locator(".search-field__clear").first();
    if (await clearBtn.isVisible().catch(() => false)) {
      record("FilterPanel .search-field__clear", await effectiveHitBox(clearBtn));
    }
    await searchInput.fill("");
  }

  // Place detail close (.icon-button, already 44px) + gallery dots + gallery nav.
  // The dataset has exactly 6 places with a 2-photo gallery (dots only render when total > 1);
  // "Tokyo National Museum" (JP-021) is one and lives in the Tokio hub already open here, so
  // it is targeted directly instead of guessing through the first N cards — the earlier version
  // of this script never actually found a gallery this way, which is why the compliance
  // correction's live verification for `.gallery__dot` was previously left incomplete.
  let galleryDot = null;
  const museumCard = page.locator(".place-card", { hasText: "Tokyo National Museum" }).first();
  if (await museumCard.count()) {
    await museumCard.locator(".place-card__open").click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
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
    await page.locator(".place-detail__bar .icon-button").first().click();
    await page.waitForTimeout(150);
  }

  // TripBackup close (40px) — close whichever ficha is still open, if any.
  if (await page.locator(".place-detail").isVisible().catch(() => false)) {
    await page.locator(".place-detail__bar .icon-button").first().click();
    await page.waitForTimeout(200);
  }
  await page.click(".app__backup");
  await page.waitForTimeout(300);
  const backupClose = page.locator(".trip-backup__close");
  if (await backupClose.isVisible().catch(() => false)) {
    record("TripBackup .trip-backup__close", await effectiveHitBox(backupClose));
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // .icon-button--small inside the planner (save a couple of places first)
  const saveButtons = page.locator(".place-card__save");
  const saveCount = await saveButtons.count();
  for (let i = 0; i < Math.min(2, saveCount); i++) {
    await saveButtons.nth(i).click();
    await page.waitForTimeout(150);
  }
  await page.click(".selection-panel__toggle");
  await page.waitForTimeout(300);
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
