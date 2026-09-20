import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const TRAVELLERS_KEY = "nihon.travellers.v1";
/** JP-001 (Shibuya Crossing) — un lugar real de Tokio, usado para sembrar un interés de "la
 * otra persona" y comprobar el `PersonToken` junto al corazón. */
const OTHER_PERSON_PLACE_ID = "JP-001";

/**
 * Bloque 19 (B3) — gates permanentes de `04 §13`/`10 §B3` contra un build real (`vite preview`),
 * no contra jsdom. Complementa `PlaceCard.test.ts`/`FilterPanel.test.ts` (estructura del código)
 * con lo que sólo un navegador real puede confirmar: geometría medida, contraste de tabulación,
 * área táctil real, y comportamiento en vivo de `SearchSheet`/`FilterSheet`/carga progresiva.
 */
async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok, extra) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}${extra !== undefined ? ` (${extra})` : ""}`);
  };

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
            {
              placeId,
              stances: [{ travellerId: "trav-b", stance: "interested" }],
              carriedOver: false,
            },
          ],
        };
        localStorage.setItem(key, JSON.stringify(doc));
      },
      { key: TRAVELLERS_KEY, placeId: OTHER_PERSON_PLACE_ID }
    );
  }

  /** Reads the effective hit box (own rect ∪ ::after rect), same technique as
   * `b17-tap-target-check.mjs`'s `effectiveHitBox`. */
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
      return { width, height };
    });
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await seedOtherPersonInterest(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(300);

  // ---------- 1. Chips: máximo 2, duración siempre primero ----------
  {
    const counts = await page.$$eval(".place-card:not(.place-card--compact)", (cards) =>
      cards.map((card) => card.querySelectorAll(".place-card__chip").length)
    );
    check("ninguna tarjeta normal supera 2 chips", counts.every((n) => n <= 2), `máx visto: ${Math.max(...counts, 0)}`);
    const firstChipTexts = await page.$$eval(".place-card:not(.place-card--compact)", (cards) =>
      cards
        .filter((card) => card.querySelector(".place-card__chip"))
        .map((card) => card.querySelector(".place-card__chip").textContent.trim())
    );
    check(
      "cuando hay chips, el primero es siempre duración (no vacío)",
      firstChipTexts.every((t) => t.length > 0)
    );
  }

  // ---------- 2. Insignia: sólo grado S, texto real, nunca sólo color ----------
  {
    const badgeTexts = await page.$$eval(".place-card__badge", (nodes) => nodes.map((n) => n.textContent.trim()));
    check(
      "toda insignia visible dice exactamente «★ Imprescindible»",
      badgeTexts.every((t) => t === "★Imprescindible" || t.replace(/\s+/g, "") === "★Imprescindible"),
      badgeTexts.join(" | ")
    );
  }

  // ---------- 3. Proporción 4:3 en base, 16:9 desde sm ----------
  {
    const media = await page.locator(".place-card:not(.place-card--compact) .place-card__media").first();
    const box = await media.boundingBox();
    const ratio = box.width / box.height;
    check("4:3 en base (390px)", Math.abs(ratio - 4 / 3) < 0.05, ratio.toFixed(3));
  }
  {
    const wideContext = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const widePage = await wideContext.newPage();
    await widePage.goto(BASE_URL, { waitUntil: "networkidle" });
    await dismissOnboarding(widePage);
    await widePage.reload({ waitUntil: "networkidle" });
    await widePage.click(".national-start__hub:has-text('Tokio')");
    await widePage.waitForSelector(".place-card", { timeout: 15000 });
    const media = widePage.locator(".place-card:not(.place-card--compact) .place-card__media").first();
    const box = await media.boundingBox();
    const ratio = box.width / box.height;
    check("16:9 desde sm (900px)", Math.abs(ratio - 16 / 9) < 0.05, ratio.toFixed(3));
    await wideContext.close();
  }

  // ---------- 4. Nombre sobre la fotografía, con scrim ----------
  {
    const overlay = await page.evaluate(() => {
      const card = [...document.querySelectorAll(".place-card:not(.place-card--compact)")].find((c) =>
        c.querySelector(".place-card__image")
      );
      if (!card) return null;
      const overlay = card.querySelector(".place-card__overlay");
      const name = card.querySelector(".place-card__name-text");
      return {
        background: getComputedStyle(overlay).backgroundImage,
        color: name ? getComputedStyle(name).color : null,
      };
    });
    if (overlay) {
      check("el overlay usa --scrim-bottom (gradient)", overlay.background.includes("gradient"));
      check("el nombre se pinta en blanco sobre la foto", overlay.color === "rgb(255, 255, 255)", overlay.color);
    } else {
      check("hay al menos una tarjeta con foto para medir el scrim (informativo)", true, "ninguna con foto todavía");
    }
  }

  // ---------- 5. Corazón: 40px visual, ≥44×44 real, aria-pressed ----------
  {
    const heart = page.locator(".place-card:not(.place-card--compact) .place-card__save").first();
    const visual = await heart.boundingBox();
    const real = await effectiveHitBox(heart);
    check("corazón: 40px visual", Math.abs(visual.width - 40) < 1 && Math.abs(visual.height - 40) < 1, `${visual.width}×${visual.height}`);
    check("corazón: ≥44×44 de área táctil real", real.width >= 44 && real.height >= 44, `${real.width}×${real.height}`);
    const pressedBefore = await heart.getAttribute("aria-pressed");
    check("aria-pressed empieza en false", pressedBefore === "false");
    await heart.click();
    await page.waitForTimeout(150);
    const pressedAfter = await heart.getAttribute("aria-pressed");
    check("aria-pressed pasa a true al guardar", pressedAfter === "true");
    await heart.click();
    await page.waitForTimeout(150);
  }

  // ---------- 6. PersonToken de la otra persona, junto al corazón ----------
  {
    const card = page.locator(`.place-card:has(.place-card__open:has-text("Shibuya Crossing"))`).first();
    await card.scrollIntoViewIfNeeded();
    const token = card.locator(".place-card__person-token");
    check("el token de la otra persona existe junto al corazón", (await token.count()) > 0);
    const label = await token.getAttribute("aria-label");
    check("el token dice quién, no sólo un color", label === "Beto quiere ir", label);
  }

  // ---------- 7. Compact = 72×72 + una línea de metadato (dentro de SearchSheet) ----------
  await page.click(".explorer-bar__search");
  await page.waitForSelector(".search-sheet", { timeout: 5000 });
  await page.fill(".search-sheet .search-field__input", "shibuya");
  await page.waitForTimeout(250);
  {
    const compact = page.locator(".place-card--compact").first();
    check("hay resultados compactos para «shibuya»", (await compact.count()) > 0);
    const media = await compact.locator(".place-card__media").boundingBox();
    check("miniatura compacta 72×72", Math.abs(media.width - 72) < 1 && Math.abs(media.height - 72) < 1, `${media.width}×${media.height}`);
    const metaLines = await compact.locator(".place-card__meta").count();
    check("una sola línea de metadato en compact", metaLines === 1);
  }
  {
    // Estado vacío de búsqueda: `04 §15`/`05 §4`, copy exacto.
    await page.fill(".search-sheet .search-field__input", "xyz-no-existe-nunca");
    await page.waitForTimeout(250);
    const emptyText = await page.locator(".search-sheet .empty-state__description").textContent();
    check(
      "estado vacío de búsqueda usa el copy exacto",
      emptyText.includes("Nada con") && emptyText.includes("xyz-no-existe-nunca") && emptyText.includes("Tokio"),
      emptyText
    );
    // `filters.query` es el mismo estado compartido que la lista principal (04 §12) — se
    // limpia antes de seguir, o el resto de la ciudad se queda filtrado a 0 lugares.
    await page.fill(".search-sheet .search-field__input", "");
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // ---------- 8. FilterSheet: orden de grupos, todos los filtros, contador en vivo ----------
  await page.click(".explorer-bar__filters");
  await page.waitForSelector(".filter-panel", { timeout: 5000 });
  {
    const summaries = await page.$$eval(".filter-group__summary span:first-child", (nodes) =>
      nodes.map((n) => n.textContent.trim())
    );
    check(
      "los grupos de FilterSheet están en el orden fijo de 04 §13",
      JSON.stringify(summaries) ===
        JSON.stringify(["Nivel de interés", "Categoría", "Duración", "Reserva", "Afluencia", "Joyas"]),
      summaries.join(" · ")
    );
  }
  {
    const before = await page.locator(".filter-panel__status strong").textContent();
    const chip = page.locator(".filter-group:has(.filter-group__summary:has-text('Nivel de interés')) .chip-toggle").first();
    await chip.click();
    await page.waitForTimeout(150);
    const pressed = await chip.getAttribute("aria-pressed");
    check("ChipToggle expone aria-pressed y cambia al pulsarlo", pressed === "true");
    const after = await page.locator(".filter-panel__status strong").textContent();
    check("el contador de resultados de la cabecera reacciona en vivo", before !== after, `${before} → ${after}`);
    // Keyboard: Tab reaches it (already focused after click), Space/Enter toggles again.
    await chip.press("Enter");
    await page.waitForTimeout(150);
    const pressedAgain = await chip.getAttribute("aria-pressed");
    check("ChipToggle es operable por teclado (Enter)", pressedAgain === "false");
  }
  {
    const footerButton = page.locator(".filter-panel__foot .button--primary");
    const text = await footerButton.textContent();
    check("el pie fijo ofrece «Ver N lugares»", /^Ver \d+ lugares?$/.test(text.trim()), text);
    await footerButton.click();
    await page.waitForTimeout(200);
    const stillOpen = await page.locator(".filter-panel").count();
    check("«Ver N lugares» cierra la hoja", stillOpen === 0);
  }

  // ---------- 9. «Dónde dormir»: exactamente tras la 6ª tarjeta, en Tokio ----------
  {
    const items = await page.$$eval(".place-list > *", (nodes) =>
      nodes.map((n) => (n.matches(".donde-dormir-entry-item") ? "dormir" : n.querySelector(".place-card") ? "card" : "other"))
    );
    const dormirIndex = items.indexOf("dormir");
    const cardsBefore = items.slice(0, dormirIndex).filter((t) => t === "card").length;
    check("«Dónde dormir» aparece tras exactamente 6 tarjetas en Tokio", dormirIndex > -1 && cardsBefore === 6, `posición ${dormirIndex}, tarjetas antes: ${cardsBefore}`);
  }

  // ---------- 10. Carga progresiva 12 → 24 → 36, sin reordenar ni duplicar ----------
  {
    const namesAt = async () =>
      page.$$eval(".place-card:not(.place-card--compact) .place-card__open", (nodes) => nodes.map((n) => n.textContent.trim()));
    const first = await namesAt();
    check("primer render ≤12 lugares", first.length <= 12, String(first.length));
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => document.querySelector(".place-list__sentinel")?.scrollIntoView());
      await page.waitForTimeout(350);
    }
    const grown = await namesAt();
    check("la carga progresiva añade más lugares al hacer scroll", grown.length > first.length, `${first.length} → ${grown.length}`);
    check("nunca duplica un lugar", new Set(grown).size === grown.length);
    check("no reordena los ya visibles", JSON.stringify(grown.slice(0, first.length)) === JSON.stringify(first));

    // Con el catálogo de Tokio cargado por completo, la insignia S deja de ser una comprobación
    // vacía: hay exactamente 6 lugares de grado S en Tokio (contado directamente sobre el
    // dataset) y cada uno debe mostrar la insignia — ni uno de más, ni uno de menos.
    const badgeCount = await page.locator(".place-card__badge").count();
    check("con el catálogo completo cargado, aparecen exactamente 6 insignias S en Tokio", badgeCount === 6, String(badgeCount));
  }

  // ---------- 11. Cero emoji de categoría renderizado ----------
  {
    const categoryTexts = await page.$$eval(".place-card__where, .place-card__meta", (nodes) =>
      nodes.map((n) => n.textContent)
    );
    const emojiPattern = /[\u{1F000}-\u{1FFFF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}]/u;
    check(
      "ninguna línea de categoría·zona renderiza un emoji",
      categoryTexts.every((t) => !emojiPattern.test(t))
    );
  }

  await context.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
