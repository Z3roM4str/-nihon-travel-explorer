import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const OUT_DIR = process.env.NIHON_OUT_DIR ?? "/tmp/b19-screenshots";
const TRAVELLERS_KEY = "nihon.travellers.v1";
const OTHER_PERSON_PLACE_ID = "JP-001";

/**
 * Bloque 19 (B3) — evidencia visual (punto 18). Mismo estilo que `b17-capture.mjs`/
 * `b18-capture.mjs`: mismo binario, misma convención de nombres, en los tres anchos mínimos que
 * pide el bloque (390×844, 840×900, 1440×900).
 */
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "840x900", width: 840, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
];

async function dismissOnboarding(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function seedOtherPersonInterest(page) {
  await page.evaluate(
    ({ key, placeId }) => {
      const doc = {
        version: 1,
        travellers: [
          { id: "trav-a", label: "Ana" },
          { id: "trav-b", label: "Beto" },
        ],
        activeTravellerId: "trav-a",
        interests: [
          { placeId, stances: [{ travellerId: "trav-b", stance: "interested" }], carriedOver: false },
        ],
      };
      localStorage.setItem(key, JSON.stringify(doc));
    },
    { key: TRAVELLERS_KEY, placeId: OTHER_PERSON_PLACE_ID }
  );
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await seedOtherPersonInterest(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(400);

    // 1. Tokio con tarjetas v2 (foto+overlay+scrim, chips, insignia).
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-1-explorar-ciudad.png` });

    // 2. Mezcla de foto real y PhotoPlaceholder.
    const hasPlaceholder = await page.locator(".photo-placeholder").count();
    console.log(`${viewport.name}: PhotoPlaceholder visibles = ${hasPlaceholder}`);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-2-foto-y-placeholder.png` });

    // 3. Grado S y A juntos (scroll hasta encontrar ambos, si hace falta cargar más).
    for (let i = 0; i < 3; i++) {
      const hasBadge = await page.locator(".place-card__badge").count();
      if (hasBadge > 0) break;
      await page.evaluate(() => document.querySelector(".place-list__sentinel")?.scrollIntoView());
      await page.waitForTimeout(300);
    }
    const badgeBox = await page.locator(".place-card__badge").first().boundingBox().catch(() => null);
    if (badgeBox) {
      await page.locator(".place-card__badge").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-3-grados-s-y-a.png` });

    // 4. PersonToken junto al corazón (JP-001, Shibuya Crossing, sembrado arriba).
    const tokenCard = page.locator('.place-card:has(.place-card__open:has-text("Shibuya Crossing"))').first();
    if ((await tokenCard.count()) > 0) {
      await tokenCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-4-person-token.png` });

    // 5. Búsqueda abierta con resultados compactos.
    await page.click(".explorer-bar__search");
    await page.waitForSelector(".search-sheet", { timeout: 5000 });
    await page.fill(".search-sheet .search-field__input", "shibuya");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-5-busqueda-compacta.png` });
    // Estado vacío de búsqueda, en la misma hoja.
    await page.fill(".search-sheet .search-field__input", "xyz-no-existe-nunca");
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-7-estado-vacio-busqueda.png` });
    await page.fill(".search-sheet .search-field__input", "");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // 6. FilterSheet.
    await page.click(".explorer-bar__filters");
    await page.waitForSelector(".filter-panel", { timeout: 5000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-6-filter-sheet.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // 7b. EmptyState por filtro: selecciona TODAS las categorías salvo una improbable en Tokio
    // (playa/mar/islas) hasta llegar a 0 resultados, mismo mecanismo que un lector real usaría
    // sin querer al marcar demasiados filtros a la vez.
    await page.click(".explorer-bar__filters");
    await page.waitForSelector(".filter-panel", { timeout: 5000 });
    const categoryGroup = page.locator(
      ".filter-group:has(.filter-group__summary:has-text('Categoría'))"
    );
    if (!(await categoryGroup.getAttribute("open"))) {
      await categoryGroup.locator(".filter-group__summary").click();
      await page.waitForTimeout(150);
    }
    const targetChip = categoryGroup.locator(".chip-toggle", { hasText: "Extraño/peculiar/único" });
    if ((await targetChip.count()) > 0) {
      await targetChip.click();
      await page.waitForTimeout(200);
    }
    // Distintos grupos combinan en Y (categoría Y duración), a diferencia de los chips dentro de
    // un mismo grupo (que combinan en O) — «Extraño/peculiar/único» que además dura «Jornada
    // completa» agota el catálogo de Tokio con alta probabilidad, sin inventar un valor.
    const durationGroup = page.locator(
      ".filter-group:has(.filter-group__summary:has-text('Duración'))"
    );
    const fullDayChip = durationGroup.getByRole("button", { name: "Jornada completa", exact: true });
    if ((await fullDayChip.count()) > 0) {
      await fullDayChip.click();
      await page.waitForTimeout(200);
    }
    const remaining = await page.locator(".filter-panel__status strong").textContent();
    console.log(`${viewport.name}: lugares tras filtro exigente = ${remaining}`);
    await page.locator(".filter-panel__foot .button--primary").click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-7b-estado-vacio-filtro.png` });
    // Limpiar filtros para dejar el estado consistente para el resto de capturas.
    const clearAction = page.locator(".empty-state .button--secondary");
    if ((await clearAction.count()) > 0) {
      await clearAction.click();
      await page.waitForTimeout(300);
    }

    // 8. «Dónde dormir» tras la 6ª tarjeta.
    await page.evaluate(() => document.querySelector(".app__sidebar")?.scrollTo({ top: 0 }));
    await page.waitForTimeout(150);
    const dormir = page.locator(".donde-dormir-entry-item").first();
    if ((await dormir.count()) > 0) {
      await dormir.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: `${OUT_DIR}/${viewport.name}-8-donde-dormir.png` });

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots written to ${OUT_DIR}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
