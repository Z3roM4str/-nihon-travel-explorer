/**
 * Recorrido común de superficies para los gates de B10 (microcopy, etc.): arranca la app con un plan sembrado y visita
 * cada pantalla/estado del producto, llamando a `onState(nombre, page, width)` en cada uno. Mismos estados que
 * `css-equivalence-check.mjs` (búsqueda, ciudad, filtros, mapa, ficha, créditos, lightbox, Quiero ir, Nosotros, Viaje ×4,
 * mover, otro orden, mapa nacional, onboarding, estados vacíos) más export/import abiertos.
 */
const unsel = { start: { kind: "unselected" }, end: { kind: "unselected" } };
export const PLAN = {
  version: 8,
  routeIds: ["JP-212", "JP-077", "JP-044", "JP-203"],
  days: [
    { id: "d1", placeIds: ["JP-212"], accommodationBoundary: unsel },
    { id: "d2", placeIds: ["JP-077", "JP-044"], accommodationBoundary: unsel },
    { id: "d3", placeIds: ["JP-203"], accommodationBoundary: unsel },
  ],
  startDate: "2027-03-14",
  endDate: "2027-03-17",
  visitStartTimes: {},
  accommodations: [],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
};

export const navTo = (page, name) =>
  page.locator(`.tab-bar__item:has-text('${name}'):visible, .nav-rail__item:has-text('${name}'):visible`).first();

export async function bootApp(browser, url, width, { seed = true, onboarding = false, reduced = false } = {}) {
  const height = width <= 430 ? 844 : width <= 840 ? 1180 : 900;
  const context = await browser.newContext({ viewport: { width, height }, ...(reduced ? { reducedMotion: "reduce" } : {}) });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(({ plan, seedIn, onb }) => {
    try {
      if (!onb) localStorage.setItem("nihon.onboarding.seen.v1", "1");
      if (!seedIn || sessionStorage.getItem("walk-seeded")) return;
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(plan.routeIds));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(plan));
      sessionStorage.setItem("walk-seeded", "1");
    } catch {
      /* almacenamiento bloqueado */
    }
  }, { plan: PLAN, seedIn: seed, onb: onboarding });
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}

const openAllDetails = (page) => page.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", "")));

/** Visita todas las superficies a un ancho. `onState` recibe el nombre del estado y la página lista para medir. */
export async function walkSurfaces(browser, url, width, onState, { skipped = [] } = {}) {
  const { context, page } = await bootApp(browser, url, width);
  const take = async (name, { details = false } = {}) => {
    await page.waitForTimeout(450);
    if (details) await openAllDetails(page);
    await onState(name, page, width);
  };
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      skipped.push(`${width}/${name}: ${error.message.split("\n")[0].slice(0, 90)}`);
    }
  };
  await navTo(page, "Explorar").click();
  await take("explorar");
  await step("busqueda", async () => {
    await page.locator(".explorer-home__search-button").first().click();
    await page.locator(".sheet").first().waitFor();
    await take("busqueda");
    await page.keyboard.press("Escape");
    await page.locator(".sheet").first().waitFor({ state: "detached" });
  });
  await step("nacional", async () => {
    await page.locator(".explorer-home__map-card").first().click();
    await page.waitForTimeout(800);
    await take("nacional");
    const region = page.locator(".region-nav__item").nth(1);
    if (await region.count()) {
      await region.click();
      await take("nacional-region");
    }
    const pref = page.locator(".region-hubs button, .prefecture-panel button, .national__sheet button").first();
    if (await pref.count()) {
      await pref.click();
      await take("nacional-panel");
    }
    await navTo(page, "Explorar").click();
    await page.waitForTimeout(400);
  });
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await take("ciudad");
  await step("filtros", async () => {
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await page.locator(".sheet").first().waitFor();
    await take("filtros", { details: true });
    await page.keyboard.press("Escape");
    await page.locator(".sheet").first().waitFor({ state: "detached" });
  });
  await step("mapa", async () => {
    const b = page.getByRole("button", { name: /^Mapa$/ });
    if (await b.count()) await b.first().click();
    await take("mapa");
    const l = page.getByRole("button", { name: /^Lista$/ });
    if (await l.count()) await l.first().click();
  });
  await step("ficha", async () => {
    await page.locator(".place-card:has(.place-card__photo-count)").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await take("ficha", { details: true });
    const credits = page.locator(".gallery__credits");
    if (await credits.count()) {
      await credits.first().click();
      await take("ficha-creditos", { details: true });
      await page.keyboard.press("Escape");
    }
    const zoom = page.locator('[aria-label^="Ampliar imagen"]').first();
    if (await zoom.count()) {
      await zoom.click();
      await take("ficha-lightbox");
      await page.keyboard.press("Escape");
    }
    const back = page.locator(".place-detail__back");
    if (await back.count()) await back.first().click();
    else await page.keyboard.press("Escape");
  });
  await navTo(page, "Quiero ir").click();
  await take("quiero-ir", { details: true });
  await step("quiero-ir-persona", async () => {
    await page.getByRole("tab", { name: /Persona 1/ }).or(page.getByRole("button", { name: /Persona 1/ })).first().click();
    await take("quiero-ir-persona", { details: true });
  });
  await navTo(page, "Nosotros").click();
  await take("nosotros", { details: true });
  await step("nosotros-import", async () => {
    const imp = page.getByRole("button", { name: /Importar/ }).first();
    if (await imp.count()) {
      await imp.click();
      await take("nosotros-importar", { details: true });
    }
  });
  await navTo(page, "Viaje").click();
  await page.waitForSelector(".viaje-nav", { state: "visible" });
  await take("viaje-dias", { details: true });
  await step("mover", async () => {
    await page.getByRole("button", { name: "Mover a…" }).first().click();
    await take("viaje-dias-mover", { details: true });
  });
  await step("otro-orden", async () => {
    await page.getByRole("button", { name: /^Probar otro orden del Día \d+$/ }).and(page.locator(":enabled")).first().click();
    await page.locator(".day-order-tool").first().waitFor();
    await take("viaje-dias-otro-orden", { details: true });
  });
  for (const [tab, slug] of [["Dónde dormir", "dormir"], ["Reservas", "reservas"], ["Resumen", "resumen"]]) {
    await page.locator(`.viaje-nav__item:has-text("${tab}")`).click();
    await take(`viaje-${slug}`, { details: true });
  }
  await context.close();

  const fresh = await bootApp(browser, url, width, { seed: false, onboarding: true });
  await fresh.page.waitForTimeout(500);
  await onState("onboarding", fresh.page, width);
  await fresh.page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await fresh.page.reload({ waitUntil: "networkidle" });
  for (const [n, slug] of [["Quiero ir", "vacio-quiero-ir"], ["Viaje", "vacio-viaje"], ["Nosotros", "vacio-nosotros"]]) {
    await navTo(fresh.page, n).click();
    await fresh.page.waitForTimeout(450);
    await onState(slug, fresh.page, width);
  }
  await fresh.context.close();
}
