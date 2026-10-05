// P-06 v2 — medición cuantitativa de N1 (Viaje › Días). Funciona contra la UI de P-06 v1 (main) y de P-06 v2:
// detecta la versión por el DOM y mide lo mismo en ambas.
//   node scripts/p06-v2-measure.mjs [--label=antes|despues]
// Mide, a 390×844 y 1440×900, con el viaje de capture (Día 1: 3 paradas de Tokio; Día 2: 1 de Kioto; 1 sitio sin asignar):
//   · altura desplazable total de Días en el estado inicial;
//   · altura de la tarjeta típica (Día 1);
//   · controles interactivos visibles a la vez (en toda la lista) y por tarjeta;
//   · crecimiento de la página al accionar cada control secundario de N1 (la invariante).
import { launch, newPage, tripFixture, byHub } from "./lib/modern-trip.mjs";

const label = (process.argv.find((a) => a.startsWith("--label=")) ?? "--label=medida").split("=")[1];
const fixture = tripFixture();
const tokyo = byHub("Tokio");
fixture.draft.days[0].placeIds.push(tokyo[2].id);
fixture.draft.routeIds = [...fixture.draft.days[0].placeIds, ...fixture.draft.days[1].placeIds];
// El sitio sin asignar de Tokio pasa a la ruta: queda sólo uno (Kioto) sin asignar, como en el capture de P-06.

const env = await launch();
const out = {};
try {
  for (const [name, vp] of [["390x844", { width: 390, height: 844, dpr: 2 }], ["1440x900", { width: 1440, height: 900, dpr: 1 }]]) {
    const { page, context } = await newPage(env.browser, vp, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    await page.waitForTimeout(600);
    const scroll = root.locator(".destination-panel--scroll");
    const v2 = (await root.locator(".day-card__details").count()) === 0;

    const initial = await scroll.evaluate((el) => el.scrollHeight);
    const cardHeights = await root.locator(".day-card").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    const interactiveSel = "button, a[href], select, input, summary, textarea";
    const visibleControls = (scope) => scope.locator(interactiveSel).evaluateAll((els) => els.filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.disabled;
    }).length);
    const totalControls = await visibleControls(root.locator(".analysis-body"));
    const dayCardControls = await root.locator(".day-card").first().evaluate((el, sel) => [...el.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; }).length, interactiveSel);
    const textChars = await root.locator(".analysis-body").evaluate((el) => el.innerText.replace(/\s+/g, " ").length);

    // Crecimiento por interacción: se acciona, se mide la altura desplazable y se vuelve al estado inicial.
    const firstCard = root.locator(".day-card").first();
    const interactions = v2
      ? [
        ["⋯ de la parada", () => firstCard.getByRole("button", { name: /^Acciones de / }).first()],
        ["⋯ del día", () => firstCard.getByRole("button", { name: "Acciones del Día 1" })],
        ["+ Añadir lugar", () => firstCard.getByRole("button", { name: /Añadir lugar/ })],
        ["Cambiar orden", () => firstCard.getByRole("button", { name: "Cambiar orden del Día 1" })],
        ["Detalles del día", () => firstCard.getByRole("button", { name: "Detalles del Día 1" })],
        ["Editar fechas", () => root.getByRole("button", { name: "Editar fechas" })],
        ["Herramientas del viaje", () => root.getByRole("button", { name: "Herramientas del viaje" })],
        ["Sin asignar → Añadir a un día", () => root.locator(".unassigned__add").first()],
      ]
      : [
        ["⋯ de la parada (Mover a…)", () => firstCard.getByRole("button", { name: "Mover a…" }).first()],
        ["Detalles del día", () => firstCard.locator(".day-card__details > summary")],
        ["Probar otro orden", () => firstCard.getByRole("button", { name: "Probar otro orden del Día 1" })],
        ["Herramientas y datos del viaje", () => root.locator(".days-tools > summary")],
        ["Sin asignar (cajón)", () => root.locator(".unassigned-drawer > summary")],
      ];
    const growth = {};
    for (const [what, get] of interactions) {
      await scroll.evaluate((el) => { el.scrollTop = 0; });
      const trigger = get();
      await trigger.scrollIntoViewIfNeeded();
      const before = await scroll.evaluate((el) => el.scrollHeight);
      await trigger.click();
      await page.waitForTimeout(250);
      const after = await scroll.evaluate((el) => el.scrollHeight);
      growth[what] = after - before;
      // Volver al estado inicial.
      if (v2) {
        if (await page.locator(".sheet, .focused-view").count()) await page.keyboard.press("Escape");
      } else {
        await page.keyboard.press("Escape").catch(() => {});
        if (await trigger.getAttribute("aria-expanded") === "true") await trigger.click();
        if (await trigger.evaluate((el) => el.tagName === "SUMMARY" && el.parentElement.open)) await trigger.click();
        if (await root.locator(".day-order-tool").count()) await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(150);
    }
    out[name] = { v2, initialScrollHeight: initial, cardHeights, firstCard: cardHeights[0], totalControls, dayCardControls, textChars, growth };
    await context.close();
  }
} finally { await env.close(); }
console.log(JSON.stringify({ label, ...out }, null, 2));
