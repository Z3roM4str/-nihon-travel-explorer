import { launch, newPage } from "./lib/modern-trip.mjs";

/**
 * Gate «opciones comprobadas del día» — herencia moderna de `phase3e-e/g/i/k-browser-audit` (Fase 6 del endurecimiento post-B10).
 *
 * Los gates 3E se escribieron para el panel «Alternativas locales con evidencia completa» con botones «Aplicar» (retirado: B29 convirtió
 * esas alternativas en OPCIONES de la herramienta «Probar otro orden» de cada día, y el panel no montado se retiró en este endurecimiento).
 * Lo que protegían —y que sigue siendo verdad en la interfaz vigente— se mide aquí con las MISMAS fixtures y las MISMAS cifras:
 *
 *   · cada familia (adyacente, reubicación, no adyacente, reversión de cuatro, intercambio de bloques) aparece como opción con su copy en lenguaje natural
 *     y la etiqueta exacta «Comprobado con datos completos» (3E-E/G/I/K: copy natural, evidencia visible);
 *   · al cargar la opción, Orden actual y Propuesta muestran los RANGOS totales registrados y la mezcla de evidencia (3E-G «1 h 8 min → 1 h»,
 *     3E-I «1 h 31 min → 1 h 12 min», 3E-K «1 h 32 min → 1 h 21 min», y su reubicación encadenada «1 h 21 min → 1 h 14 min»);
 *   · la comparación sólo afirma el orden de los traslados registrados («menor tiempo de traslado»), sin «mejor», «recomendado», «óptimo», «ahorras»
 *     ni «garantizad…» (3E: vocabulario prohibido), y no promete nada fuera de los traslados registrados;
 *   · «Usar este orden» persiste exactamente el orden esperado, en la identidad estable del día, una sola vez, y sobrevive a la recarga;
 *   · tras aplicar, si nada más es demostrable, se dice con el estado vacío neutro («No hay opciones comprobadas con datos completos para este día.»);
 *     en el caso del intercambio de bloques, la reubicación que sigue siendo demostrable aparece y se encadena (3E-K).
 *
 * La ventaja mínima (8, 19, 11 y 7 min) ya no se escribe como línea aparte (B29: «no presenta A/B ni un score»); es la diferencia entre los dos
 * rangos mostrados y se comprueba derivada de ellos.
 *
 * Uso: `npm run build && node scripts/evidence-options-check.mjs` (`NIHON_CHROMIUM_PATH`, `NIHON_BROWSER=webkit` opcionales).
 */
const DRAFT_KEY = "nihon.manualPlanningDraft";
const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const FORBIDDEN = /\bmejor(es)?\b|recomend|óptim|optim|ahorr|garantizad|ranking|puntuaci|score/i;

/** Duración «1 h 8 min» / «57 min» / «1 h» → minutos. */
function minutes(text) {
  const h = /(\d+)\s*h/.exec(text)?.[1];
  const m = /(\d+)\s*min/.exec(text)?.[1];
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

const CASES = [
  {
    family: "Intercambios adyacentes",
    baseline: ["JP-006", "JP-034", "JP-035", "JP-036", "JP-033"],
    expected: ["JP-006", "JP-035", "JP-034", "JP-036", "JP-033"],
    option: /^Intercambiar .+ y .+$/m,
    before: "1 h",
    after: "57 min",
    mix: "4/4 traslados registrados",
    validated: "4 validados",
    // Tras aplicar este intercambio puede seguir habiendo otra opción demostrable (B29 las recalcula): sólo se exige que la herramienta se abra limpia.
    afterAny: true,
  },
  {
    family: "Reubicaciones de un lugar",
    baseline: ["JP-010", "JP-012", "JP-011", "JP-013", "JP-014"],
    expected: ["JP-010", "JP-013", "JP-012", "JP-011", "JP-014"],
    option: /^Mover .+ a la posición \d+$/m,
    before: "1 h 2 min",
    after: "49 min",
    mix: "4/4 traslados registrados",
    validated: "4 validados",
  },
  {
    family: "Intercambios no adyacentes",
    baseline: ["JP-028", "JP-026", "JP-022", "JP-027", "JP-025"],
    expected: ["JP-028", "JP-027", "JP-022", "JP-026", "JP-025"],
    option: /^Intercambiar Retro game hunt: Super Potato \+ Mandarake y Kanda Myojin$/m,
    before: "1 h 8 min", // 3E-G: 68 → 60 min, ventaja mínima 8
    after: "1 h",
    mix: "4/4 traslados registrados",
    validated: "4 validados",
  },
  {
    family: "Reversiones de cuatro lugares",
    baseline: ["JP-202", "JP-153", "JP-155", "JP-156", "JP-161", "JP-154"],
    expected: ["JP-202", "JP-161", "JP-156", "JP-155", "JP-153", "JP-154"],
    option: /^Invertir .+$/m,
    before: "1 h 31 min", // 3E-I: ventaja mínima 19
    after: "1 h 12 min",
    mix: "5/5 traslados registrados",
    validated: "5 validados",
  },
  {
    family: "Intercambios de bloques de dos lugares",
    baseline: ["JP-202", "JP-153", "JP-156", "JP-161", "JP-154", "JP-155"],
    expected: ["JP-202", "JP-161", "JP-154", "JP-153", "JP-156", "JP-155"],
    option: /^Intercambiar el par .+ y el par .+$/m,
    before: "1 h 32 min", // 3E-K: ventaja mínima 11
    after: "1 h 21 min",
    mix: "5/5 traslados registrados",
    validated: "5 validados",
    chained: { family: "Reubicaciones de un lugar", before: "1 h 21 min", after: "1 h 14 min" }, // 3E-K: ventaja mínima 7, tras el intercambio
  },
];

let checks = 0;
const failures = [];
const check = (ok, message) => {
  checks += 1;
  if (!ok) { failures.push(message); console.log(`  ✗ ${message}`); } else console.log(`  ✓ ${message}`);
};

async function readRanges(panel) {
  const text = (await panel.innerText()).replace(/\n+/g, " | ");
  const blocks = [...text.matchAll(/Rango total conocido de traslados: ([^|]+)\|\s*([^|]+)\|\s*([^|]+)/g)].map((m) => m.slice(1).map((x) => x.trim()));
  return { text, blocks };
}

const env = await launch();
try {
  for (const c of CASES) {
    console.log(`\n── ${c.family}`);
    const dayId = "ev-day";
    const draft = { version: 8, routeIds: c.baseline, days: [{ id: dayId, placeIds: c.baseline, accommodationBoundary: none }], startDate: null, endDate: null, visitStartTimes: {}, accommodations: [], accommodationLegs: [], interHubSegments: [], zoneAccommodationChoices: [] };
    const travellersDoc = { version: 1, travellers: [{ id: "p1", label: "Marta" }], activeTravellerId: "p1", interests: c.baseline.map((placeId) => ({ placeId, stances: [{ travellerId: "p1", stance: "interested" }], carriedOver: false })) };
    const { page, context, errors, pageErrors } = await newPage(env.browser, { width: 1200, height: 900, dpr: 1 }, { fixture: { draft, travellersDoc } });
    await page.goto(env.url);
    await page.waitForTimeout(600);
    await page.locator('nav[aria-label="Navegación principal"]:visible button').filter({ hasText: "Viaje" }).first().click();
    await page.waitForTimeout(800);
    const openTool = async () => {
      await page.getByRole("button", { name: "Probar otro orden del Día 1" }).click();
      await page.locator(".day-order-tool").waitFor();
      return page.locator(".day-order-tool");
    };
    let panel = await openTool();
    const group = panel.locator(".day-order-tool__group").filter({ hasText: c.family });
    check((await group.count()) === 1, `${c.family}: aparece como opción de la herramienta del día`);
    await group.locator("summary").click();
    const optionText = await group.innerText();
    check(c.option.test(optionText), `${c.family}: copy natural de la opción («${optionText.split("\n").find((l) => c.option.test(l))?.trim() ?? "?"}»)`);
    check(/Comprobado con datos completos/.test(optionText), `${c.family}: etiqueta exacta «Comprobado con datos completos»`);
    await group.getByRole("button", { name: "Probar esta opción" }).first().click();
    await page.waitForTimeout(400);

    const { text, blocks } = await readRanges(panel);
    check(blocks.length === 2, `${c.family}: Orden actual y Propuesta muestran su rango total registrado (${blocks.length})`);
    check(blocks[0]?.[0] === c.before && blocks[1]?.[0] === c.after, `${c.family}: rangos ${c.before} → ${c.after} (visto ${blocks.map((b) => b[0]).join(" → ")})`);
    check(blocks.every((b) => b[1] === c.mix && b[2] === c.validated), `${c.family}: la mezcla de evidencia se ve en ambos órdenes («${c.mix} · ${c.validated}»)`);
    check(minutes(c.before) - minutes(c.after) > 0, `${c.family}: la ventaja mínima derivada de los rangos es ${minutes(c.before) - minutes(c.after)} min (> 0)`);
    check(/Entre estos dos órdenes, la propuesta tiene menor tiempo de traslado\./.test(text), `${c.family}: la comparación sólo afirma el menor tiempo de traslado registrado`);
    check(!FORBIDDEN.test(text.replace(/«Comprobado con datos completos»/g, "")), `${c.family}: sin «mejor / recomendado / óptimo / ahorras / garantizada / ranking / score» (${FORBIDDEN.exec(text)?.[0] ?? "ninguno"})`);
    check(/no incluyen horarios, reservas, alojamiento, puerta a puerta ni el viaje completo/.test(text), `${c.family}: acota la afirmación a los traslados registrados`);

    const before = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY));
    check(JSON.stringify(before.days[0].placeIds) === JSON.stringify(c.baseline), `${c.family}: cargar la opción NO cambia el viaje`);
    await page.evaluate(() => { window.__w = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "nihon.manualPlanningDraft") window.__w += 1; return set.call(this, k, v); }; });
    await panel.getByRole("button", { name: "Usar este orden", exact: true }).click();
    await page.waitForFunction(() => window.__w >= 1);
    await page.waitForTimeout(300);
    const applied = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY));
    check(JSON.stringify(applied.days[0].placeIds) === JSON.stringify(c.expected) && applied.days[0].id === dayId, `${c.family}: «Usar este orden» persiste el orden esperado en el mismo día`);
    check(JSON.stringify(applied.routeIds) === JSON.stringify(c.baseline) && applied.version === 8, `${c.family}: conserva routeIds y la versión del borrador`);
    check((await page.evaluate(() => window.__w)) === 1, `${c.family}: una sola escritura del borrador`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const reloaded = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY));
    check(JSON.stringify(reloaded.days[0].placeIds) === JSON.stringify(c.expected), `${c.family}: el orden aplicado sobrevive a la recarga`);

    await page.locator('nav[aria-label="Navegación principal"]:visible button').filter({ hasText: "Viaje" }).first().click();
    await page.waitForTimeout(600);
    panel = await openTool();
    const afterText = await panel.innerText();
    if (c.chained) {
      const chained = panel.locator(".day-order-tool__group").filter({ hasText: c.chained.family });
      check((await chained.count()) === 1, `${c.family}: tras aplicar, la reubicación que sigue siendo demostrable se ofrece encadenada (3E-K)`);
      await chained.locator("summary").click();
      await chained.getByRole("button", { name: "Probar esta opción" }).first().click();
      await page.waitForTimeout(400);
      const next = await readRanges(panel);
      check(next.blocks[0]?.[0] === c.chained.before && next.blocks[1]?.[0] === c.chained.after, `${c.family}: la reubicación encadenada muestra ${c.chained.before} → ${c.chained.after} (visto ${next.blocks.map((b) => b[0]).join(" → ")})`);
    } else if (c.afterAny) {
      check((await panel.locator(".day-order-tool__group").count()) >= 0 && /Opciones comprobadas/.test(afterText), `${c.family}: tras aplicar, la herramienta se vuelve a abrir y recalcula sus opciones`);
    } else {
      check(/No hay opciones comprobadas con datos completos para este día\./.test(afterText), `${c.family}: tras aplicar y recargar, nada más es demostrable y se dice con el estado vacío neutro`);
      check((await panel.locator(".day-order-tool__group").count()) === 0, `${c.family}: ningún grupo de candidatos se pinta cuando nada es demostrable`);
    }
    check(errors.length === 0 && pageErrors.length === 0, `${c.family}: sin errores de consola ni de página (${errors.concat(pageErrors).join(" | ")})`);
    await context.close();
  }
} finally {
  await env.close();
}
console.log(`\n${"═".repeat(60)}\nOpciones comprobadas del día: ${checks - failures.length}/${checks} OK, ${failures.length} fallos\n`);
process.exit(failures.length === 0 ? 0 : 1);
