// P-06·C — historial del navegador y superficies de Viaje › Días (hojas N2 y vistas enfocadas N3).
//   atrás cierra la superficie activa SIN salir de Días; adelante la reabre; abrir/cerrar repetido no hace crecer la pila;
//   cerrar por la UI deshace la entrada propia; recarga vuelve a la lista; el estado de la ficha (`nihonPlaceDepth`) se conserva.
// Uso: node scripts/p06-v2-history-check.mjs [--viewport=phone|desktop]   (NIHON_BROWSER=webkit para WebKit)
import { launch, newPage, tripFixture, makeChecker } from "./lib/modern-trip.mjs";

const { check, summary } = makeChecker("P-06·C historial");
const only = (process.argv.find((a) => a.startsWith("--viewport=")) ?? "").split("=")[1];
const viewports = [
  ["phone", { width: 390, height: 844, dpr: 2 }],
  ["desktop", { width: 1440, height: 900, dpr: 1 }],
].filter(([name]) => !only || name === only);

const env = await launch();
try {
  for (const [name, vp] of viewports) {
    console.log(`\n── ${name} ${vp.width}×${vp.height} ──`);
    const fixture = tripFixture();
    const { page, context, errors, pageErrors } = await newPage(env.browser, vp, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    const appUrl = page.url();
    const card = root.locator(".day-card").first();
    const firstStop = (await card.locator(".trip-stop strong").first().innerText()).trim();
    const hist = () => page.evaluate(() => ({ length: history.length, own: Boolean(history.state && history.state.nihonDias), kind: history.state?.nihonDias?.kind ?? null }));
    const surfaceOpen = () => page.locator(".sheet, .focused-view").count();
    const inDays = async () => page.url() === appUrl && await page.getByRole("button", { name: "Días", exact: true }).getAttribute("aria-pressed") === "true" && await root.locator(".day-card").first().isVisible();
    const wait = (ms = 250) => page.waitForTimeout(ms);
    const base = await hist();
    check("estado inicial: sin entrada propia", !base.own);

    const surfaces = [
      ["dates", "Fechas del viaje", () => root.getByRole("button", { name: "Editar fechas" })],
      ["stop", firstStop, () => card.getByRole("button", { name: `Acciones de ${firstStop}` })],
      ["add-place", null, () => card.getByRole("button", { name: /Añadir lugar/ })],
      ["day", "Acciones del Día 1", () => card.getByRole("button", { name: "Acciones del Día 1" })],
      ["unassigned", null, () => root.locator(".unassigned__add").first()],
      ["day-details", "Detalles del Día 1", () => card.getByRole("button", { name: "Detalles del Día 1" })],
      ["trip-tools", "Herramientas del viaje", () => root.getByRole("button", { name: "Herramientas del viaje" })],
      ["order", null, () => card.getByRole("button", { name: "Cambiar orden del Día 1" })],
    ];
    for (const [kind, , trigger] of surfaces) {
      const t = trigger();
      await t.scrollIntoViewIfNeeded();
      await t.click();
      await page.locator(".sheet, .focused-view").first().waitFor();
      const opened = await hist();
      check(`${kind}: abrir empuja exactamente una entrada propia`, opened.own && opened.kind === kind && opened.length === base.length + 1, JSON.stringify(opened));
      await page.goBack();
      await wait();
      check(`${kind}: «atrás» cierra la superficie`, await surfaceOpen() === 0);
      check(`${kind}: «atrás» no sale de Días (misma URL, pestaña Días, lista visible)`, await inDays());
      check(`${kind}: tras «atrás» no queda entrada propia activa`, !(await hist()).own);
      check(`${kind}: el foco vuelve al disparador tras «atrás»`, await t.evaluate((el) => document.activeElement === el));
      await page.goForward();
      await wait();
      check(`${kind}: «adelante» la reabre`, await surfaceOpen() === 1 && (await hist()).kind === kind);
      await page.goBack();
      await wait();
      check(`${kind}: segundo «atrás» vuelve a la lista`, await surfaceOpen() === 0 && await inDays());
    }

    // Cierre por la UI: Escape, «Volver»/×, fondo — deshacen la entrada y la pila no crece con aperturas repetidas.
    const stopTrigger = card.getByRole("button", { name: `Acciones de ${firstStop}` });
    for (let i = 0; i < 6; i += 1) {
      await stopTrigger.click();
      await page.locator(".sheet").waitFor();
      await page.keyboard.press("Escape");
      await page.locator(".sheet").waitFor({ state: "detached" });
    }
    await wait();
    const afterLoop = await hist();
    check("6 aperturas/cierres por Escape no hacen crecer el historial", afterLoop.length <= base.length + 1 && !afterLoop.own, JSON.stringify(afterLoop));
    check("tras ese bucle seguimos en Días", await inDays());
    await card.getByRole("button", { name: "Detalles del Día 1" }).click();
    await page.getByRole("button", { name: "Volver a Días" }).click();
    await page.locator(".focused-view").waitFor({ state: "detached" });
    await wait();
    check("«Volver a Días» cierra y deshace la entrada", !(await hist()).own && await inDays());
    await card.getByRole("button", { name: "Acciones del Día 1" }).click();
    await page.locator(".sheet-scrim").click({ position: { x: 4, y: 4 } });
    await page.locator(".sheet").waitFor({ state: "detached" });
    await wait();
    check("clic en el fondo cierra la Sheet y deshace la entrada", !(await hist()).own && await inDays());

    // Apertura inmediatamente tras cierre (el back propio aún no ha llegado): queda abierta y con una sola entrada.
    await stopTrigger.click();
    await page.locator(".sheet").waitFor();
    await page.keyboard.press("Escape");
    await stopTrigger.click({ force: true });
    await page.locator(".sheet").waitFor();
    await wait(400);
    const rapid = await hist();
    check("abrir justo después de cerrar deja la Sheet abierta con una sola entrada", await surfaceOpen() === 1 && rapid.own && rapid.length <= base.length + 1, JSON.stringify(rapid));
    await page.goBack();
    await wait();
    check("y un «atrás» la cierra sin salir de Días", await surfaceOpen() === 0 && await inDays());

    // Una acción que termina la superficie (mover parada) también deja la pila limpia y «adelante» no reabre algo obsoleto.
    await stopTrigger.click();
    await page.locator(".sheet").getByRole("button", { name: /^Mover al Día 2/ }).click();
    await wait(400);
    check("terminar una acción cierra la Sheet y deshace la entrada", await surfaceOpen() === 0 && !(await hist()).own);
    await page.goForward().catch(() => {});
    await wait();
    check("«adelante» no reabre la Sheet de una parada que ya se movió", await surfaceOpen() === 0 && await inDays());

    // Cambiar orden: adelante reabre con la misma línea base; tras aplicar, adelante no reabre una base obsoleta.
    // Tras mover una parada, el Día 1 quedó con un lugar: el orden se prueba en el Día 2 (dos lugares).
    const cardNow = root.locator(".day-card").nth(1);
    await cardNow.getByRole("button", { name: "Cambiar orden del Día 2" }).click();
    await root.locator(".day-order-tool").waitFor();
    await page.goBack();
    await wait();
    await page.goForward();
    await wait();
    check("Cambiar orden: «adelante» la reabre con su panel", await root.locator(".day-order-tool").count() === 1);
    const names = await root.locator(".day-order-tool__order").nth(1).locator(".day-order-tool__place-name").allInnerTexts();
    if (names.length >= 2) {
      await root.locator(".day-order-tool__order").nth(1).getByRole("button", { name: new RegExp(`^Bajar ${names[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
      await root.getByRole("button", { name: "Usar este orden", exact: true }).click();
      await root.locator(".day-order-tool").waitFor({ state: "detached" });
      await wait(400);
      check("aplicar un orden cierra la vista y deshace la entrada", !(await hist()).own && await inDays(), JSON.stringify([await hist(), page.url(), await inDays()]));
      await page.goForward().catch(() => {});
      await wait();
      check("«adelante» no reabre Cambiar orden con una línea base obsoleta", await root.locator(".day-order-tool").count() === 0 && await inDays());
    }

    // Recarga con una superficie abierta: vuelve a la lista y limpia la entrada.
    await root.getByRole("button", { name: "Herramientas del viaje" }).click();
    await page.locator(".focused-view").waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    await root.locator(".day-card").first().waitFor();
    await wait();
    check("recarga con una vista abierta: vuelve a la lista", await surfaceOpen() === 0 && !(await hist()).own);

    // La ficha de un lugar (pila de App) sigue funcionando junto a las superficies.
    await root.locator(".trip-stop__open").first().click();
    await page.locator(".app__detail").waitFor();
    const withFiche = await hist();
    await page.goBack();
    await page.locator(".app__detail").waitFor({ state: "detached" });
    check("la ficha de un lugar sigue cerrándose con «atrás» (pila de App intacta)", await inDays());
    await root.getByRole("button", { name: "Editar fechas" }).click();
    await page.locator(".sheet").waitFor();
    check("abrir una Sheet después de cerrar una ficha conserva el estado de la ficha (sin entradas colgando)", (await hist()).length <= withFiche.length + 1);
    await page.goBack();
    await wait();
    check("y «atrás» vuelve a Días", await inDays());

    check("sin errores de consola ni de página", errors.length === 0 && pageErrors.length === 0, [...errors, ...pageErrors].join(" | "));
    await context.close();
  }
} finally {
  await env.close();
}
process.exit(summary());
