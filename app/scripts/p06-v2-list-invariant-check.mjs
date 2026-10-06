// P-06 v2 — invariante de la lista de Días (N1) y contrato de las hojas (N2).
//   «En la lista principal de Días ninguna acción secundaria puede expandir contenido inline de forma que aumente
//    sustancialmente la altura de la tarjeta o de la página. Acciones cortas → Sheet. Tareas complejas → FocusedView.»
// Uso: node scripts/p06-v2-list-invariant-check.mjs [--viewport=phone|desktop]   (NIHON_BROWSER=webkit para WebKit)
import { launch, newPage, tripFixture, zones, makeChecker } from "./lib/modern-trip.mjs";

const { check, summary } = makeChecker("P-06 v2 lista · hojas");
const only = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "").split("=")[1];
const viewports = [
  ["phone 390×844", { width: 390, height: 844, dpr: 2 }, "coarse"],
  ["desktop 1440×900", { width: 1440, height: 900, dpr: 1 }, "fine"],
].filter(([name]) => !only || name.startsWith(only));
const MAX_GROWTH = 8; // px: ruido de subpíxeles; una expansión inline real mide cientos.

const env = await launch();
const measurements = {};
try {
  for (const [name, vp, pointer] of viewports) {
    console.log(`\n── ${name} ──`);
    const fixture = tripFixture();
    const { page, context, errors, pageErrors } = await newPage(env.browser, vp, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    const scroll = root.locator(".destination-panel--scroll");
    // Las escrituras del documento son diferidas (Web Lock): se espera a que el almacenamiento se asiente antes de leerlo.
    const draft = () => page.evaluate(async () => { await new Promise((resolve) => { let last = localStorage.getItem("nihon.manualPlanningDraft"), calm = 0; const tick = () => { const now = localStorage.getItem("nihon.manualPlanningDraft"); if (now !== last) { last = now; calm = 0; } else calm += 1; if (calm >= 3) resolve(); else setTimeout(tick, 40); }; setTimeout(tick, 40); }); const doc = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft")); delete doc._w; return doc; });
    const metrics = () => scroll.evaluate((el) => ({ scrollHeight: el.scrollHeight, scrollTop: el.scrollTop }));
    const cardHeights = () => root.locator(".day-card").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    const geometry = () => page.evaluate(() => ({ href: location.href, own: Boolean(history.state && history.state.nihonDias) }));

    // ── 1 · estructura de N1 ────────────────────────────────────────────────────────────────────────────────────
    check(`${name}: puntero ${pointer} en este contexto`, await page.evaluate((p) => matchMedia(`(pointer: ${p})`).matches, pointer));
    check("N1 no contiene <details>", await root.locator("details").count() === 0);
    check("N1 no contiene el texto «Probar otro orden» ni «Detalles del día» inline", !(await root.innerText()).includes("Probar otro orden") && await root.locator(".day-card__details, .days-tools, .unassigned-drawer").count() === 0);
    check("N1 no muestra la frase pedagógica «Vosotros decidís…»", !/Vosotros decidís/.test(await root.innerText()));
    check("N1 no pide «Posición N» en ninguna interacción", !/Posici[oó]n\s*\d?/.test(await root.innerText()) && await root.locator("select").count() === 0);
    check("N1 no contiene formularios visibles (select/input/textarea)", await root.locator("select:visible, input:visible, textarea:visible").count() === 0);
    const days = fixture.draft.days.length;
    check("«+ Añadir lugar» visible en cada día", await root.getByRole("button", { name: /Añadir lugar/ }).evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 0).length) === days);
    check("«Cambiar orden» sustituye a «Probar otro orden»", await root.getByRole("button", { name: /^Cambiar orden del Día/ }).count() === days);

    // ── 2 · asas de arrastre ─────────────────────────────────────────────────────────────────────────────────────
    const handlesVisible = await root.locator(".trip-stop__handle").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0).length);
    if (pointer === "coarse") check("touch: ninguna asa de arrastre visible en N1", handlesVisible === 0);
    else check("puntero fino: las asas de arrastre se conservan", handlesVisible >= fixture.routeIds.length);

    // ── 3 · «Sin asignar» ───────────────────────────────────────────────────────────────────────────────────────
    const unassigned = root.locator(".unassigned");
    check("«Sin asignar» con lugares es una sección visible (no <details>)", await unassigned.isVisible() && await unassigned.evaluate((el) => !el.closest("details")));
    check("«Sin asignar» muestra su recuento y sus lugares sin abrir nada", /^Sin asignar · 2 sitios$/.test(await unassigned.locator("h3").innerText()) && await unassigned.locator("li").count() === 2);

    // ── 4 · la invariante: ninguna acción secundaria de N1 expande inline ─────────────────────────────────────────
    const firstCard = root.locator(".day-card").first();
    const firstStopName = await firstCard.locator(".trip-stop strong").first().innerText();
    const secondaries = [
      ["⋯ de la parada", () => firstCard.getByRole("button", { name: `Acciones de ${firstStopName}` }), ".sheet"],
      ["⋯ del día", () => firstCard.getByRole("button", { name: "Acciones del Día 1" }), ".sheet"],
      ["+ Añadir lugar", () => firstCard.getByRole("button", { name: /Añadir lugar/ }), ".sheet"],
      ["Editar fechas", () => root.getByRole("button", { name: "Editar fechas" }), ".sheet"],
      ["Añadir a un día (Sin asignar)", () => unassigned.getByRole("button", { name: /^Añadir .* a un día$/ }).first(), ".sheet"],
      ["Cambiar orden", () => firstCard.getByRole("button", { name: "Cambiar orden del Día 1" }), ".focused-view"],
      ["Detalles del día", () => firstCard.getByRole("button", { name: "Detalles del Día 1" }), ".focused-view"],
      ["Herramientas del viaje", () => root.getByRole("button", { name: "Herramientas del viaje" }), ".focused-view"],
    ];
    await scroll.evaluate((el) => { el.scrollTop = 0; });
    const baseline = { ...(await metrics()), cards: await cardHeights(), geo: await geometry(), draft: JSON.stringify(await draft()) };
    measurements[name] = { scrollHeight: baseline.scrollHeight, cardHeights: baseline.cards };
    for (const [label, trigger, surface] of secondaries) {
      const t = trigger();
      await t.scrollIntoViewIfNeeded();
      const before = { ...(await metrics()), cards: await cardHeights() };
      await t.focus();
      await t.press("Enter");
      const overlay = page.locator(`${surface}`).first();
      await overlay.waitFor();
      const during = { ...(await metrics()), cards: await cardHeights() };
      check(`«${label}»: abre ${surface === ".sheet" ? "una Sheet (N2)" : "una vista enfocada (N3)"} con rol de diálogo`, await overlay.getAttribute("role") === "dialog" || await overlay.locator("[role=dialog]").count() > 0 || await overlay.evaluate((el) => Boolean(el.closest("[role=dialog]"))));
      check(`«${label}»: la altura de la página no crece (Δ=${during.scrollHeight - before.scrollHeight}px)`, Math.abs(during.scrollHeight - before.scrollHeight) <= MAX_GROWTH);
      check(`«${label}»: ninguna tarjeta crece (máx Δ=${Math.max(...during.cards.map((h, i) => h - before.cards[i]))}px)`, during.cards.every((h, i) => Math.abs(h - before.cards[i]) <= MAX_GROWTH));
      check(`«${label}»: el foco entra en la superficie`, await page.evaluate(() => Boolean(document.activeElement?.closest(".sheet, .focused-view"))));
      for (let i = 0; i < 12; i += 1) await page.keyboard.press("Tab");
      check(`«${label}»: Tab queda atrapado en la superficie`, await page.evaluate(() => Boolean(document.activeElement?.closest(".sheet, .focused-view"))));
      await page.keyboard.press("Escape");
      await overlay.waitFor({ state: "detached" });
      const after = await metrics();
      check(`«${label}»: cerrar conserva el contexto (scroll ${before.scrollTop}→${after.scrollTop}) y no cambia el borrador`, Math.abs(after.scrollTop - before.scrollTop) <= 2 && JSON.stringify(await draft()) === baseline.draft);
      check(`«${label}»: Escape devuelve el foco al disparador`, await t.evaluate((el) => document.activeElement === el));
      check(`«${label}»: abrir/cerrar no navega (misma URL) y no deja entrada de historial propia`, JSON.stringify(await geometry()) === JSON.stringify(baseline.geo));
    }
    // El fondo también cierra una Sheet.
    await firstCard.getByRole("button", { name: "Acciones del Día 1" }).click();
    await page.locator(".sheet-scrim").click({ position: { x: 4, y: 4 } });
    check("clic en el fondo cierra la Sheet", await page.locator(".sheet").count() === 0);
    // Botón de cierre de la Sheet: 44 px.
    await firstCard.getByRole("button", { name: "Acciones del Día 1" }).click();
    const smallTargets = await page.locator(".sheet button:visible").evaluateAll((els) => els.filter((el) => { const b = el.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).map((el) => el.getAttribute("aria-label") || el.textContent.trim()));
    check(`objetivos de la Sheet ≥ 44 px${smallTargets.length ? ` (${smallTargets.join(", ")})` : ""}`, smallTargets.length === 0);
    await page.keyboard.press("Escape");

    // ── 5 · contexto visible dentro de la Sheet de parada ───────────────────────────────────────────────────────────
    await firstCard.getByRole("button", { name: `Acciones de ${firstStopName}` }).click();
    const stopSheet = page.locator(".sheet");
    check("Sheet de parada: título = nombre del lugar y contexto «Ahora en Día 1»", await stopSheet.getByRole("heading", { name: firstStopName, exact: true }).count() === 1 && /Ahora en Día 1/.test(await stopSheet.innerText()));
    check("Sheet de parada: no pregunta «Posición»", !/Posici[oó]n/.test(await stopSheet.innerText()));
    // 6 · mover entre días = al final del destino (el Día 2 ya tiene una parada).
    const day2Before = (await draft()).days[1].placeIds;
    await stopSheet.getByRole("button", { name: /^Mover al Día 2/ }).click();
    const afterMove = await draft();
    const movedId = fixture.draft.days[0].placeIds[0];
    check("mover entre días añade la parada AL FINAL del día destino", JSON.stringify(afterMove.days[1].placeIds) === JSON.stringify([...day2Before, movedId]));
    check("mover entre días no cambia el resto de decisiones del viaje", JSON.stringify(afterMove.routeIds.slice().sort()) === JSON.stringify(fixture.draft.routeIds.slice().sort()) && afterMove.startDate === fixture.draft.startDate && afterMove.endDate === fixture.draft.endDate);
    check("tras mover, el foco sigue a la parada movida", await page.waitForFunction((id) => document.activeElement?.getAttribute("data-stop-actions-id") === id, movedId, { timeout: 2000 }).then(() => true, () => false));
    check("tras mover, el aviso en vivo lo anuncia", /al final del Día 2/.test(await root.locator('[role="status"]').first().innerText()));

    // 7 · Sin asignar → día: también al final; y vacío no ocupa espacio.
    for (let i = 0; i < 2; i += 1) {
      const addBtn = unassigned.getByRole("button", { name: /^Añadir .* a un día$/ }).first();
      await addBtn.click();
      const target = (await draft()).days[0].placeIds;
      await page.locator(".sheet").getByRole("button", { name: /^Día 1/ }).click();
      const now = (await draft()).days[0].placeIds;
      check(`Sin asignar → Día 1 añade al final (${i + 1}/2)`, now.length === target.length + 1 && JSON.stringify(now.slice(0, -1)) === JSON.stringify(target));
    }
    check("«Sin asignar» vacío no se pinta", await root.locator(".unassigned").count() === 0);

    // 8 · alojamiento, tres estados y nunca «Dormís en la zona».
    const sleepOf = async (card) => (await card.locator(".day-card__sleep").innerText()).replace(/\s+/g, " ").replace(/\s*›$/, "").trim();
    check("alojamiento sin nada: «Elegir zona para dormir»", await sleepOf(root.locator(".day-card").first()) === "Elegir zona para dormir");
    await context.close();

    const zone = zones.find((z) => z.hub === "Tokio") ?? zones[0];
    for (const [label, mutate, expected] of [
      ["sólo zona", (d) => {
        d.accommodations.push({ id: "p06-zone", label: "Shinjuku", location: { lat: 35.69, lng: 139.7 } });
        d.zoneAccommodationChoices.push({ hub: "Tokio", zoneId: zone.id, accommodationId: "p06-zone" });
      }, "Zona para dormir: Shinjuku"],
      ["sin alojamiento esa noche", (d) => {
        d.accommodations.push({ id: "p06-zone2", label: "Shinjuku", location: { lat: 35.69, lng: 139.7 } });
        d.zoneAccommodationChoices.push({ hub: "Tokio", zoneId: zone.id, accommodationId: "p06-zone2" });
        d.days[0].accommodationBoundary = { start: { kind: "unselected" }, end: { kind: "no-accommodation" } };
      }, "Sin alojamiento esa noche"],
      ["alojamiento concreto", (d) => {
        d.accommodations.push({ id: "p06-hotel", label: "Hotel Sakura", location: { lat: 35.68, lng: 139.76 } });
        d.days[0].accommodationBoundary = { start: { kind: "unselected" }, end: { kind: "accommodation", accommodationId: "p06-hotel" } };
      }, "Dormís en Hotel Sakura"],
    ]) {
      const f = tripFixture();
      mutate(f.draft);
      const sub = await newPage(env.browser, vp, { fixture: f });
      await sub.page.goto(env.url);
      await sub.page.getByRole("button", { name: "Viaje", exact: true }).click();
      const r = sub.page.locator(".destination-panel:not([hidden])");
      await r.locator(".day-card[data-day-id]").first().waitFor();
      const text = (await r.locator(".day-card").first().locator(".day-card__sleep").innerText()).replace(/\s+/g, " ").replace(/\s*›$/, "").trim();
      check(`alojamiento ${label}: «${expected}»`, text === expected, text);
      check(`alojamiento ${label}: nunca «Dormís en la zona»`, !/Dormís en la zona/.test(await r.innerText()));
      if (label === "sin alojamiento esa noche") {
        check("sin alojamiento: no se presenta como elección pendiente ni gana la zona de la ciudad", !/Elegir zona/.test(await r.locator(".day-card").first().innerText()) && !/Zona para dormir/.test(await r.locator(".day-card").first().locator(".day-card__sleep").innerText()));
      }
      await sub.context.close();
    }

    check("sin errores de consola ni de página", errors.length === 0 && pageErrors.length === 0, [...errors, ...pageErrors].join(" | "));
  }

  // ── Mediciones (se imprimen para el informe) ─────────────────────────────────────────────────────────────────────
  console.log("\nMediciones N1 (estado inicial, viaje de 2 días, 3 paradas + 1):");
  for (const [name, m] of Object.entries(measurements)) console.log(`  ${name}: scrollHeight=${m.scrollHeight}px · tarjetas=${m.cardHeights.join("/")}px`);
} finally {
  await env.close();
}
process.exit(summary());
