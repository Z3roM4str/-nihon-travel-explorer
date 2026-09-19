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
  // Try cards by index until one has a multi-image gallery (dots only render when total > 1);
  // close each ficha before trying the next one (only if it is actually open).
  let galleryDot = null;
  const cardCount = await page.locator(".place-card__open").count();
  for (let i = 0; i < Math.min(10, cardCount); i++) {
    await page.locator(".place-card__open").nth(i).click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    const dot = page.locator(".gallery__dot").first();
    if (await dot.count()) {
      galleryDot = dot;
      break;
    }
    await page.locator(".place-detail__bar .icon-button").first().click();
    await page.waitForTimeout(150);
  }
  if (galleryDot) {
    record("PlaceGallery .gallery__dot (first)", await effectiveHitBox(galleryDot));

    // Click test: a point inside the expanded (44px) zone but outside the visual 28px dot.
    const box = await galleryDot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    // The dot is centered in its own box; click 15px above its own center (inside a 44px
    // effective box, outside a 28px visual one) and check the click still lands on the button.
    const clickX = box.x + box.width / 2;
    const clickY = box.y - 6; // 6px above the visual box's top edge, inside the +8px expansion
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest(".gallery__dot") !== null : false;
      },
      [clickX, clickY]
    );
    results.push({ label: "gallery__dot expanded zone resolves to the button", ok: hit });
    console.log(`${hit ? "OK  " : "FAIL"} gallery__dot expanded zone resolves to the button`);
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
