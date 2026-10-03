// P-06: capturas de la primera entrada a Viaje › Días (móvil 390×844 y escritorio 1440×900).
// Uso: NIHON_P06_SHOTS=<dir> NIHON_P06_LABEL=<antes|despues> node scripts/p06-days-capture.mjs
import { mkdirSync } from "node:fs";
import { launch, newPage, tripFixture, byHub } from "./lib/modern-trip.mjs";

const dir = process.env.NIHON_P06_SHOTS ?? "p06-shots";
const label = process.env.NIHON_P06_LABEL ?? "shot";
mkdirSync(dir, { recursive: true });
const fixture = tripFixture();
const tokyo = byHub("Tokio");
// Un día con tres paradas y un sitio sin día, como un viaje real a medio planificar.
fixture.draft.days[0].placeIds.push(tokyo[2].id);
fixture.draft.routeIds = [...fixture.draft.days[0].placeIds, ...fixture.draft.days[1].placeIds];
const env = await launch();
try {
  for (const [name, vp] of [["390x844", { width: 390, height: 844, dpr: 2 }], ["1440x900", { width: 1440, height: 900, dpr: 1 }]]) {
    const { page, context } = await newPage(env.browser, vp, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${label}-${name}-viewport.png` });
    await page.screenshot({ path: `${dir}/${label}-${name}-full.png`, fullPage: true });
    const scroll = root.locator(".destination-panel--scroll");
    const height = await scroll.evaluate((el) => el.scrollHeight);
    console.log(`${name}: scrollHeight=${height}`);
    // Panel scroll capture: stitch by scrolling the inner panel.
    for (let i = 0, y = 0; y < height && i < 8; i += 1, y += vp.height - 160) {
      await scroll.evaluate((el, top) => { el.scrollTop = top; }, y);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${dir}/${label}-${name}-scroll${i}.png` });
    }
    // Estados revelados a petición (sólo si la pantalla ya tiene revelación progresiva P-06).
    if (await root.locator(".day-card__details").count()) {
      const firstCard = root.locator(".day-card").first();
      await firstCard.locator(".trip-stop").first().getByRole("button", { name: "Mover a…" }).click();
      await firstCard.locator(".trip-stop__move-panel").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/${label}-${name}-acciones-parada.png` });
      await firstCard.locator(".trip-stop").first().getByRole("button", { name: "Mover a…" }).click();
      await firstCard.locator(".day-card__details > summary").click();
      await firstCard.locator(".day-card__details > summary").evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${dir}/${label}-${name}-detalles-dia.png` });
      await page.screenshot({ path: `${dir}/${label}-${name}-detalles-dia-full.png`, fullPage: true });
    }
    await context.close();
  }
} finally { await env.close(); }
