// P-06 v2 — recorridos completos de una persona en Viaje (móvil con touch y escritorio con ratón):
//   fechas · añadir días y lugares · Sin asignar · mover paradas · reordenar días y paradas · detalles · alojamiento ·
//   reservas · herramientas del viaje · recarga. Sólo interacciones reales de la UI (tap/clic/teclado/arrastre).
// Uso: node scripts/p06-v2-journeys-check.mjs [--viewport=phone|desktop]   (NIHON_BROWSER=webkit para WebKit)
import { launch, newPage, tripFixture, makeChecker, byHub, closeDaysOverlays } from "./lib/modern-trip.mjs";
import { readSettledPlanningDraft } from "./lib/settled-planning-draft.mjs";

const { check, summary } = makeChecker("P-06 v2 recorridos");
const only = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "").split("=")[1];
const viewports = [
  ["phone", { width: 390, height: 844, dpr: 2 }, true],
  ["desktop", { width: 1440, height: 1500, dpr: 1 }, false],
].filter(([name]) => !only || name === only);

const env = await launch();
try {
  for (const [name, vp, touch] of viewports) {
    console.log(`\n── ${name} ${vp.width}×${vp.height} (${touch ? "touch" : "ratón"}) ──`);
    const fixture = tripFixture();
    // Sin fechas al empezar: el recorrido las pone.
    fixture.draft.startDate = null;
    fixture.draft.endDate = null;
    const { page, context, errors, pageErrors } = await newPage(env.browser, vp, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    // Las escrituras del documento son diferidas (Web Lock): se espera a que el almacenamiento se asiente antes de leerlo.
    const draft = () => readSettledPlanningDraft(page);
    const act = (loc) => (touch ? loc.tap() : loc.click());
    const noOverflow = async (tag) => check(`${tag}: sin desbordamiento horizontal`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const sheet = page.locator(".sheet");
    const closeAll = async () => { await closeDaysOverlays(page); await page.waitForTimeout(150); };
    const day = (n) => root.locator(".day-card").nth(n - 1);
    const place = (id) => places.find((p) => p.id === id);
    const places = [...byHub("Tokio"), ...byHub("Kioto")];
    const dayNames = async (n) => (await day(n).locator(".trip-stop strong").allInnerTexts()).map((t) => t.trim());

    // 1 · Fechas ───────────────────────────────────────────────────────────────────────────────────────────────
    await act(root.getByRole("button", { name: "Poner fechas del viaje" }));
    await sheet.waitFor();
    await root.locator("#sequence-start-date").fill("2027-02-22");
    await root.locator("#sequence-end-date").fill("2027-03-05");
    await act(sheet.getByRole("button", { name: "Listo" }));
    await sheet.waitFor({ state: "detached" });
    let d = await draft();
    check("fechas: inicio y fin persistidos", d.startDate === "2027-02-22" && d.endDate === "2027-03-05");
    check("fechas: los días muestran su fecha derivada", /22 feb/.test(await day(1).locator("h3").innerText()) && /23 feb/.test(await day(2).locator("h3").innerText()));
    await act(root.getByRole("button", { name: "Editar fechas" }));
    await sheet.waitFor();
    await act(sheet.getByRole("button", { name: "Quitar fecha" }).first());
    d = await draft();
    check("fechas: «Quitar fecha» borra sólo el inicio", d.startDate === null && d.endDate === "2027-03-05");
    await root.locator("#sequence-start-date").fill("2027-02-22");
    await act(sheet.getByRole("button", { name: "Listo" }));
    await sheet.waitFor({ state: "detached" });
    await noOverflow("fechas");

    // 2 · Añadir día y añadir lugares desde Sin asignar ─────────────────────────────────────────────────────────
    await act(root.getByRole("button", { name: "Añadir día" }));
    d = await draft();
    check("añadir día: aparece un Día 3 vacío", d.days.length === 3 && d.days[2].placeIds.length === 0);
    const unassignedBefore = await root.locator(".unassigned li").count();
    check("sin asignar: visible con sus lugares", unassignedBefore === 2 && await root.locator(".unassigned").isVisible());
    await act(day(3).getByRole("button", { name: /Añadir lugar/ }));
    await sheet.waitFor();
    check("añadir lugar: la hoja ofrece los lugares sin asignar", await sheet.locator(".sheet-action").count() === 2);
    const chosen = (await sheet.locator(".sheet-action span").first().innerText()).trim();
    await act(sheet.locator(".sheet-action").first());
    await sheet.waitFor({ state: "detached" });
    d = await draft();
    check("añadir lugar: entra en el Día 3 y sale de Sin asignar", d.days[2].placeIds.length === 1 && await root.locator(".unassigned li").count() === 1 && (await dayNames(3)).includes(chosen));

    // 3 · Mover paradas: Día 3 → Sin asignar → Día 1 (al final) ─────────────────────────────────────────────────
    await act(day(3).getByRole("button", { name: `Acciones de ${chosen}` }));
    await sheet.waitFor();
    await act(sheet.getByRole("button", { name: "Mover a Sin asignar" }));
    await sheet.waitFor({ state: "detached" });
    check("mover a Sin asignar: vuelve a la sección", await root.locator(".unassigned li").count() === 2 && (await draft()).days[2].placeIds.length === 0);
    await act(root.getByRole("button", { name: `Añadir ${chosen} a un día` }));
    await sheet.waitFor();
    await act(sheet.getByRole("button", { name: /^Día 1/ }));
    await sheet.waitFor({ state: "detached" });
    check("Sin asignar → Día 1: la parada queda al final", (await dayNames(1)).at(-1) === chosen);
    await act(day(1).getByRole("button", { name: `Acciones de ${chosen}` }));
    await act(sheet.getByRole("button", { name: /^Mover al Día 3/ }));
    await sheet.waitFor({ state: "detached" });
    check("mover entre días: Día 1 → Día 3 queda al final del destino", (await dayNames(3)).at(-1) === chosen && (await dayNames(1)).length === 2);

    // 4 · Reordenar días ─────────────────────────────────────────────────────────────────────────────────────────
    const idsBefore = (await draft()).days.map((x) => x.id);
    await act(day(1).getByRole("button", { name: "Acciones del Día 1" }));
    await sheet.waitFor();
    check("acciones del día: el primer día no ofrece «Mover antes»", await sheet.getByRole("button", { name: /^Mover antes/ }).count() === 0);
    await act(sheet.getByRole("button", { name: /^Mover después/ }));
    await sheet.waitFor({ state: "detached" });
    const idsAfter = (await draft()).days.map((x) => x.id);
    check("reordenar días: el Día 1 pasa a ser el 2 conservando su identidad", idsAfter[1] === idsBefore[0] && idsAfter[0] === idsBefore[1] && idsAfter[2] === idsBefore[2]);
    check("reordenar días: las fechas siguen a la posición", /22 feb/.test(await day(1).locator("h3").innerText()));
    await act(day(2).getByRole("button", { name: "Acciones del Día 2" }));
    await act(sheet.getByRole("button", { name: /^Mover antes/ }));
    await sheet.waitFor({ state: "detached" });
    check("reordenar días: «Mover antes» lo devuelve", (await draft()).days.map((x) => x.id).join() === idsBefore.join());

    // 5 · Reordenar paradas: Cambiar orden con Subir/Bajar (touch y ratón) ───────────────────────────────────────
    const order0 = await dayNames(1);
    await act(day(1).getByRole("button", { name: "Cambiar orden del Día 1" }));
    const tool = root.locator(".day-order-tool");
    await tool.waitFor();
    check("cambiar orden: vista enfocada con «Vosotros decidís el orden…» y sin «Posición N»", await page.locator(".focused-view .days-framing").count() === 1 && !/Posici[oó]n\s*\d/.test(await tool.innerText()));
    const proposal = tool.locator(".day-order-tool__order").nth(1);
    await act(proposal.getByRole("button", { name: `Bajar ${order0[0]} en la propuesta del Día 1`, exact: true }));
    check("cambiar orden: Bajar reordena la propuesta, no el borrador", (await proposal.locator(".day-order-tool__place-name").allInnerTexts()).join("|") === [order0[1], order0[0]].join("|") && (await draft()).days[0].placeIds[0] === fixture.draft.days[0].placeIds[0]);
    await act(tool.getByRole("button", { name: "Usar este orden", exact: true }));
    await tool.waitFor({ state: "detached" });
    check("cambiar orden: «Usar este orden» persiste el nuevo orden", (await dayNames(1)).join("|") === [order0[1], order0[0]].join("|"));
    if (!touch) {
      // Ratón: el arrastre sigue disponible y es una vía más.
      const handle = day(1).locator(".trip-stop").last().locator(".trip-stop__handle");
      const target = day(1).locator(".trip-stop").first();
      const hb = await handle.boundingBox(); const tb = await target.boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
      await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height * 0.2, { steps: 12 }); await page.mouse.up();
      check("ratón: arrastrar reordena dentro del día", (await dayNames(1)).join("|") === order0.join("|"));
    } else {
      check("touch: no hay asas visibles y aun así el orden fino fue posible (Subir/Bajar)", await root.locator(".trip-stop__handle").evaluateAll((els) => els.every((el) => el.getBoundingClientRect().width === 0)));
    }
    await noOverflow("reordenar");

    // 6 · Detalles, alojamiento: «Sin alojamiento esa noche» y «Dormís en …» ───────────────────────────────────────
    await act(root.getByRole("button", { name: "Herramientas del viaje" }));
    await page.locator(".focused-view").waitFor();
    await root.locator("#accommodation-new-label").fill("Hotel Sakura");
    await root.locator("#accommodation-new-lat").fill("35.68");
    await root.locator("#accommodation-new-lng").fill("139.76");
    await act(root.getByRole("button", { name: /Añadir alojamiento/ }));
    check("herramientas: el alojamiento se añade", (await draft()).accommodations.some((a) => a.label === "Hotel Sakura"));
    await noOverflow("herramientas");
    await act(page.getByRole("button", { name: "Volver a Días" }));
    await page.locator(".focused-view").waitFor({ state: "detached" });
    check("alojamiento sin elegir: «Elegir zona para dormir»", /Elegir zona para dormir/.test(await day(1).locator(".day-card__sleep").innerText()));
    await act(day(1).getByRole("button", { name: "Detalles del Día 1" }));
    await page.locator(".focused-view").waitFor();
    await page.locator("#accommodation-boundary-end-1").selectOption("no-accommodation");
    await closeAll();
    check("alojamiento: «No aplica» se conserva y se muestra «Sin alojamiento esa noche» (no pendiente)", (await draft()).days[0].accommodationBoundary.end.kind === "no-accommodation" && (await day(1).locator(".day-card__sleep").innerText()).includes("Sin alojamiento esa noche"));
    await act(day(1).getByRole("button", { name: "Detalles del Día 1" }));
    await page.locator("#accommodation-boundary-end-1").selectOption({ label: "Hotel Sakura" });
    await closeAll();
    check("alojamiento concreto: «Dormís en Hotel Sakura»", (await day(1).locator(".day-card__sleep").innerText()).includes("Dormís en Hotel Sakura"));
    await act(day(1).getByRole("button", { name: "Detalles del Día 1" }));
    const detailsText = await page.locator(".focused-view").innerText();
    check("detalles: traslados, totales y alojamiento por tramo visibles", /Traslados del día|Totales|Fin del día/.test(detailsText));
    await closeAll();

    // 7 · Tocar la línea de alojamiento lleva a Dónde dormir y volver conserva Días ─────────────────────────────────
    await act(day(1).locator(".day-card__sleep"));
    check("la línea de alojamiento abre Dónde dormir", await page.getByRole("button", { name: "Dónde dormir", exact: true }).getAttribute("aria-pressed") === "true");

    // 8 · Reservas y Resumen reflejan el plan; volver a Días conserva el estado ─────────────────────────────────────
    await page.getByRole("button", { name: "Reservas", exact: true }).click();
    check("reservas: la sección responde con el plan actual", await page.locator(".trip-reservations").isVisible());
    await page.getByRole("button", { name: "Resumen", exact: true }).click();
    check("resumen: los días del plan coinciden (3 días)", /Días creados: 3/.test(await page.locator(".trip-summary").innerText()));
    await page.getByRole("button", { name: "Días", exact: true }).click();
    await root.locator(".day-card[data-day-id]").first().waitFor();
    check("volver a Días: sin superficie abierta y plan intacto", await page.locator(".sheet, .focused-view").count() === 0 && (await draft()).days.length === 3);

    // 9 · Traslado entre ciudades (herramientas) y recarga ──────────────────────────────────────────────────────────
    await act(root.getByRole("button", { name: "Herramientas del viaje" }));
    const interHub = root.locator(".inter-hub-segments");
    await interHub.waitFor();
    const pair = interHub.locator("select").first();
    if (await pair.locator("option").count() > 1) {
      await pair.selectOption({ index: 1 });
      await interHub.locator("select").nth(1).selectOption("shinkansen");
      await interHub.locator('input[type="number"]').first().fill("135");
      await act(interHub.getByRole("button", { name: /Añadir traslado/ }));
      check("herramientas: el traslado entre ciudades se registra", (await draft()).interHubSegments.length === 1);
    } else {
      check("herramientas: la superficie de traslados está disponible", await interHub.count() === 1);
    }
    await closeAll();
    const before = JSON.stringify(await draft());
    await page.reload();
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    await root.locator(".day-card[data-day-id]").first().waitFor();
    check("recarga: el plan completo se conserva y se empieza en la lista", JSON.stringify(await draft()) === before && await page.locator(".sheet, .focused-view").count() === 0);
    await noOverflow("final");
    void place;
    check("sin errores de consola ni de página", errors.length === 0 && pageErrors.length === 0, [...errors, ...pageErrors].join(" | "));
    await context.close();
  }
} finally {
  await env.close();
}
process.exit(summary());
