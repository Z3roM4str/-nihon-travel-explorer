import { VIEWPORTS, parseArgs, launch, tripFixture, newPage, openZones, makeChecker, overflow as noOverflow, containsText } from "./lib/modern-trip.mjs";

/**
 * Block 3 Phase B — accommodation-zone comparison browser audit, against the production build.
 *
 * REESCRITO en el endurecimiento post-B10 (Fase 6): las AFIRMACIONES son las del gate original; sólo cambia la entrada.
 * Antes: botón de la barra de ciudad `.hub-bar__zones` + panel de guardados (retirados en B18/B25). Ahora: Viaje › Dónde dormir
 * con un viaje sembrado (`lib/modern-trip.mjs`). Las afirmaciones cuya premisa desapareció con la interfaz quedan registradas
 * como «RETIRADA» abajo y en `docs/GATE_RETIREMENT_AUDIT.md`, con el gate/prueba vigente que cubre su invariante.
 *
 * What it proves that component tests cannot: the comparison is usable at real viewports, it never introduces horizontal
 * scrolling (neither on the page nor inside the panel), its controls are thumb-sized, keyboard and Escape behave, the
 * selection persists, and the three kinds of statement — sourced fact, derived geometry, editorial judgement — stay visibly
 * distinct where a reader can see them.
 *
 * Usage: node scripts/block3-zones-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */
const { targets, browserPath } = parseArgs();
const MIN_TAP_PX = 40;
const { check, summary } = makeChecker("Block 3 zone audit");

async function auditViewport(env, name) {
  const vp = VIEWPORTS[name];
  console.log(`\n── ${name} ${vp.width}×${vp.height} DPR ${vp.dpr} ${"─".repeat(24)}`);
  const fixture = tripFixture();
  const { context, page, errors, pageErrors } = await newPage(env.browser, vp, { fixture });
  const panel = await openZones(page, env.url);

  // ---- Reachable from the trip, and only where zones exist ----
  check("Viaje offers 'Dónde dormir'", (await page.locator(".viaje-nav__item").filter({ hasText: "Dónde dormir" }).count()) === 1);
  check("the panel is a labelled region of the trip (was: dialog opened from the hub bar)", (await panel.getAttribute("aria-label")) !== null || (await panel.getAttribute("aria-labelledby")) !== null || (await panel.getAttribute("role")) !== null);
  const cards = await page.locator(".zone-card").count();
  check("Tokio offers 4–7 real alternatives", cards >= 4 && cards <= 7, `${cards}`);
  check("the panel refuses to call any zone the best", !(await page.locator(".zone-panel__sub").innerText()).match(/la mejor(?!")/i));
  const note = await page.locator(".zone-panel__note").first().innerText();
  // RETIRADA (premisa): «it says the ordering comes from the saved list» — desde B30 el orden es el del catálogo, sin ranking
  // (la invariante vigente la fija b30: «alternatives keep catalogue order, not a proximity ranking»).
  check("it says the order is the catalogue's, with no ranking (replaces: 'ordering comes from the saved list')", note.includes("orden del catálogo, sin ranking"), note.slice(0, 120));
  check("it states the distance is straight-line, not travel time", note.includes("línea recta") || (await page.locator(".zone-panel").innerText()).includes("línea recta"));

  let overflow = await noOverflow(page);
  check("browse view has no horizontal overflow", !overflow.page && !overflow.panel, JSON.stringify(overflow));

  // ---- Selection ----
  const compareBtn = () => page.getByRole("button", { name: "Comparar", exact: true }).last();
  check("comparing is disabled until two are chosen", await compareBtn().isDisabled());
  await page.locator(".zone-card__compare input").nth(0).check();
  await page.waitForTimeout(200);
  check("one selection is still not a comparison", await compareBtn().isDisabled());
  await page.locator(".zone-card__compare input").nth(2).check();
  await page.waitForTimeout(250);
  check("two selections enable the comparison", !(await compareBtn().isDisabled()));
  check("the count is announced", (await page.locator(".zone-panel__count").innerText()).includes("2"));

  await page.locator(".zone-card__compare input").nth(1).check();
  await page.locator(".zone-card__compare input").nth(3).check();
  await page.waitForTimeout(250);
  check("the fifth checkbox is disabled at the cap", await page.locator(".zone-card__compare input").nth(4).isDisabled());
  await page.locator(".zone-card__compare input").nth(1).uncheck();
  await page.locator(".zone-card__compare input").nth(3).uncheck();
  await page.waitForTimeout(250);
  check("unchecking releases the cap", !(await page.locator(".zone-card__compare input").nth(4).isDisabled()));

  // ---- Comparison ----
  await compareBtn().click();
  await page.waitForTimeout(1400);
  check("the comparison renders one block per zone", (await page.locator(".zone-column").count()) === 2);
  check("a map places the zones geographically", (await page.locator(".zone-map").count()) === 1);

  const columnText = await page.locator(".zone-column").first().innerText();
  // Vocabulario vigente (EvidenceMark, B24/B26): «verificables» → «Hechos ◧ Registrado», «calculado» → «Cálculo … estimado», «criterio» → «Opinión de Nihon».
  check("facts are labelled as verifiable (now: «Hechos» + marca Registrado)", containsText(columnText, "Hechos"));
  check("derived geometry is labelled as calculated (now: «Cálculo» + marca Estimado)", containsText(columnText, "Cálculo"));
  check("editorial judgement is labelled as criterio (now: «Opinión de Nihon»)", containsText(columnText, "Opinión"));
  check("each zone links its source", (await page.locator(".zone-column__provenance a").count()) >= 2);
  check("each zone states what it costs", (await page.locator(".zone-tradeoffs li").count()) >= 4);
  check("the contrast section names where they differ", (await page.locator(".zone-contrast").count()) > 0 || (await page.locator(".zone-contrasts__empty").count()) === 1);
  check("a neutral axis is marked as neither good nor bad", (await page.locator(".zone-contrasts").innerText()).includes("ni bueno ni malo") || (await page.locator(".zone-contrast").count()) === 0);
  check("the full ten axes stay behind a disclosure", (await page.locator(".zone-axes").count()) === 1);
  check("the disclosure starts closed", !(await page.locator(".zone-axes__list").isVisible()));

  overflow = await noOverflow(page);
  check("comparison has no horizontal overflow", !overflow.page && !overflow.panel, JSON.stringify(overflow));

  // ---- Tap targets across the open panel ----
  const small = await page.evaluate((min) => {
    const bad = [];
    for (const el of document.querySelectorAll(".zone-panel button, .zone-panel label, .zone-panel summary")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest(".leaflet-control-container")) continue;
      if (Math.min(r.width, r.height) + 0.5 < min) bad.push({ cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return bad;
  }, MIN_TAP_PX);
  check("every control in the panel meets the tap floor", small.length === 0, JSON.stringify(small));

  // ---- Keyboard ----
  // RETIRADA (premisa): Escape no cierra nada — el panel es una pestaña embebida de Viaje (B31) sin diálogo modal. El paso atrás de la
  // comparación a la lista es el botón «Volver a las zonas» y la salida es «Cerrar dónde dormir» (ambos medidos también en b30).
  await page.getByRole("button", { name: "Volver a las zonas" }).click();
  await page.waitForTimeout(400);
  check("«Volver a las zonas» steps back to the zone list, not out of the panel (replaces: Escape step-back)", (await page.locator(".zone-card").count()) > 0);
  await page.getByRole("button", { name: "Cerrar dónde dormir" }).click();
  await page.waitForTimeout(400);
  // La pestaña queda montada pero oculta (B31 conserva el estado): «sale» = el panel deja de ser visible.
  check("the close control leaves the zones tab (replaces: second Escape closes the panel)", !(await page.locator(".zone-panel").first().isVisible()));

  // ---- Persistence ----
  await page.reload({ waitUntil: "domcontentloaded" });
  await openZones(page);
  const restored = await page.locator(".zone-card__compare input:checked").count();
  check("the comparison selection survives a reload", restored === 2, `${restored}`);

  // ---- Degrades honestly with an empty route ----
  await context.close();
  const empty = await newPage(env.browser, vp, { fixture: tripFixture({ emptyRoute: true }) });
  await openZones(empty.page, env.url);
  check("with nothing in the route it invites planning instead of inventing a ranking", (await empty.page.locator(".zone-panel__note--muted, .zone-panel__note").count()) >= 1 && (await empty.page.locator(".zone-panel__note").first().innerText()).includes("sin calcular proximidad"));
  check("no zone claims a distance it cannot measure", (await empty.page.locator(".zone-card__fit").count()) === 0);
  check("no page errors", pageErrors.length === 0 && empty.pageErrors.length === 0, pageErrors.concat(empty.pageErrors).join(" | "));
  check("no console errors", errors.length === 0 && empty.errors.length === 0, errors.concat(empty.errors).join(" | "));
  await empty.context.close();
}

console.log("Block 3 accommodation-zone audit — production build via vite preview");
const env = await launch({ browserPath });
try {
  for (const name of targets) await auditViewport(env, name);
} finally {
  await env.close();
}
process.exit(summary());
