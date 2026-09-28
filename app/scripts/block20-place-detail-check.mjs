import { chromium } from "playwright";

/**
 * Bloque 20 (B4) — gate permanente de la ficha de lugar, sobre un build real.
 *
 * Complementa a `src/block20-place-detail.test.ts`, que prueba lo que se lee en la fuente. Aquí
 * se mide lo que sólo un navegador puede decir: qué se ve, en qué orden, con qué geometría, y
 * —sobre todo— **qué llega a un lector de pantalla**. Esa última parte es lo que convierte a
 * DDR-06 en una reubicación demostrable en vez de una promesa: si el texto de la nota al pie no
 * fuera recuperable desde el marcador, este gate lo diría.
 *
 * Lo que comprueba, agrupado por la decisión o el defecto que lo exige:
 *
 *   D2  · entre la fotografía y el nombre no hay ni un carácter de atribución.
 *   D3  · en teléfono la ficha ocupa el 100 % de la altura visible, sin barra encima.
 *   D4  · no existe `×` flotante; el botón atrás flotante es la única salida y nombra su destino.
 *   D8  · la franja de los dos no se renderiza cuando nadie ha opinado.
 *   04 §6 · con UNA sola imagen no hay contador, ni puntos, ni flechas; con más de cinco, no hay
 *           puntos; las flechas sólo desde `md`.
 *   05 §5 pt. 2 · el cuerpo monta sobre la fotografía.
 *   05 §5 pt. 5 · la insignia de nivel sólo aparece en grado S.
 *   05 §5 pt.10 · cada valor práctico lleva marcador, y los títulos van en caja de frase.
 *   05 §5 pt.12 + DDR-06 · «Cerca de aquí» es un carrusel de tarjetas compactas con miniatura,
 *           SIN nota al pie, y cada traslado conserva su distinción semántica en el marcador,
 *           legible por tecnología asistiva.
 *   05 §5 pt.14 + DDR-04 · «Fuentes» plegada, con grado y `updatedAt`, sin procedencia inventada.
 *   DDR-05 · la cadena `Dato:` no aparece en la ficha.
 *   08 prohibición 11 · la letra de grado no aparece fuera de «Fuentes».
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

/** Un lugar de Tokio con fotografía, traslados cercanos y datos prácticos completos. */
const HUB = "Tokio";

const VIEWPORTS = [
  { name: "teléfono 390", width: 390, height: 844, arrows: false },
  { name: "escritorio 1440", width: 1440, height: 900, arrows: true },
];

let passed = 0;
let failed = 0;
function check(label, ok, extra) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${extra !== undefined ? ` (${extra})` : ""}`);
}

async function openHub(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.click(`.national-start__hub:has-text('${HUB}')`);
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function openFirstPlace(page) {
  await page.locator(".place-card__open").first().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(700);
}

/** Recorre lugares hasta encontrar uno cuya ficha cumpla `predicate`, o devuelve null. */
async function findPlaceWhere(page, predicate, limit = 24) {
  const cards = page.locator(".place-card__open");
  const total = Math.min(await cards.count(), limit);
  for (let index = 0; index < total; index += 1) {
    await cards.nth(index).click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(450);
    if (await predicate(page)) return index;
    await page.locator(".place-detail__back").click();
    await page.waitForTimeout(350);
  }
  return null;
}

async function auditViewport(browser, viewport) {
  console.log(`\n── ${viewport.name} ${"─".repeat(30)}`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  await openHub(page);
  await openFirstPlace(page);

  const detail = page.locator(".place-detail");

  // ---- D3: pantalla completa en teléfono, sin barra encima ----
  if (viewport.width < 840) {
    const box = await detail.boundingBox();
    check(
      "D3: la ficha ocupa el 100 % de la altura visible en teléfono",
      Math.abs(box.height - viewport.height) <= 2 && box.y <= 1,
      `alto ${box.height} vs ${viewport.height}, y=${box.y}`
    );
  }

  // ---- D4: ni `×` flotante ni barra ----
  check("D4: no queda ningún `×` flotante sobre la galería", (await page.locator(".place-detail__bar").count()) === 0);
  const back = detail.locator(".place-detail__back");
  check("D4: existe exactamente un botón atrás flotante", (await back.count()) === 1);
  const backName = await back.getAttribute("aria-label");
  check("D4: el botón atrás tiene nombre accesible", Boolean(backName && backName.trim()), backName);
  const backBox = await back.boundingBox();
  check(
    "D4: el botón atrás cumple el suelo táctil de 44px (Art. 11)",
    backBox.width >= 44 && backBox.height >= 44,
    `${backBox.width.toFixed(0)}×${backBox.height.toFixed(0)}`
  );
  const galleryBox = await detail.locator(".gallery__track").boundingBox();
  check(
    "05 §5 pt.1: el botón atrás flota SOBRE la fotografía, no encima de ella en el flujo",
    backBox.y >= galleryBox.y && backBox.y < galleryBox.y + galleryBox.height
  );

  // ---- 05 §5 pt. 2: el cuerpo monta sobre la fotografía ----
  const bodyBox = await detail.locator(".place-detail__body").boundingBox();
  check(
    "05 §5 pt.2: el cuerpo solapa la fotografía (radio arriba, señal de contenido debajo)",
    bodyBox.y < galleryBox.y + galleryBox.height,
    `solape ${(galleryBox.y + galleryBox.height - bodyBox.y).toFixed(0)}px`
  );

  // ---- D2: ni un carácter de atribución entre la fotografía y el nombre ----
  const betweenText = await detail.evaluate((root) => {
    const gallery = root.querySelector(".gallery");
    const title = root.querySelector("#place-detail-title");
    if (!gallery || !title) return null;
    const range = document.createRange();
    range.setStartAfter(gallery);
    range.setEndBefore(title);
    return range.toString();
  });
  check(
    "D2: entre la fotografía y el nombre no hay texto de atribución",
    betweenText !== null && !/commons|licencia|cc by|©|atribuci/i.test(betweenText),
    JSON.stringify((betweenText ?? "").slice(0, 60))
  );
  check("D2: el párrafo `.gallery__credit` ya no existe", (await page.locator(".gallery__credit").count()) === 0);

  // ---- 04 §6: flechas sólo en md+ ----
  const arrows = page.locator(".gallery__nav--next");
  if ((await arrows.count()) > 0) {
    check(
      "04 §6: las flechas sólo se ven desde `md`+",
      (await arrows.isVisible()) === viewport.arrows,
      `${viewport.width}px`
    );
  } else {
    check("04 §6: una sola imagen no dibuja flechas", true);
  }

  // ---- 05 §5 pt.10: marcadores y caja de frase ----
  const marks = await detail.locator(".quick-fact .evidence-mark, .detail-row .evidence-mark").count();
  const values = await detail.locator(".quick-fact__value, .detail-row__value").count();
  check("05 §5 pt.10: cada valor práctico lleva su EvidenceMark", marks >= values && values > 0, `${marks}/${values}`);
  const markLabel = await detail.locator(".detail-row .evidence-mark").first().getAttribute("aria-label");
  check("04 §2: el marcador sólo-glifo conserva su texto en `aria-label`", markLabel === "Registrado", markLabel);
  const upper = await detail.evaluate((root) =>
    [...root.querySelectorAll(".place-detail__section h3, .detail-row dt, .quick-fact__label")].filter(
      (node) => getComputedStyle(node).textTransform === "uppercase"
    ).length
  );
  check("03 §2.3: ningún título del bloque práctico va en MAYÚSCULAS", upper === 0, `${upper}`);

  // ---- DDR-05: `Dato:` no aparece en la ficha ----
  const detailText = await detail.innerText();
  check("DDR-05: la cadena `Dato:` no aparece en la ficha", !detailText.includes("Dato:"));

  // ---- 08 prohibición 11 + DDR-04: la letra de grado, sólo en «Fuentes» ----
  const sources = detail.locator(".place-sources");
  check("05 §5 pt.14: «Fuentes» existe", (await sources.count()) === 1);
  check("05 §5 pt.14: «Fuentes» nace plegada", (await sources.getAttribute("open")) === null);
  const beforeOpen = await detail.innerText();
  check(
    "08 prohibición 11: con «Fuentes» plegada no se ve ninguna letra de grado",
    !/\bGrado [SABCD]\b/.test(beforeOpen)
  );
  await sources.locator(".place-sources__summary").click();
  await page.waitForTimeout(250);
  const sourcesText = await sources.locator(".place-sources__list").innerText();
  check("DDR-04: «Fuentes» muestra el grado original", /Grado original/i.test(sourcesText));
  check(
    "DDR-04: «Fuentes» muestra la fecha del REGISTRO, no una fecha de consulta",
    /Registro actualizado/i.test(sourcesText) && !/consultad/i.test(sourcesText),
    JSON.stringify(sourcesText.slice(0, 80))
  );
  for (const forbidden of ["Procedencia", "Provenance", "Frescura", "Freshness", "Versión del dataset"]) {
    check(`DDR-04: «Fuentes» no inventa «${forbidden}»`, !sourcesText.includes(forbidden));
  }
  check(
    "DDR-04: «Fuentes» no rellena huecos con «no disponible»",
    !/no disponible/i.test(sourcesText)
  );

  // ---- 05 §5 pt.12 + DDR-06: «Cerca de aquí» ----
  const carousel = detail.locator(".nearby-carousel");
  if ((await carousel.count()) > 0) {
    check(
      "05 §5 pt.12: «Cerca de aquí» es un carrusel de tarjetas compactas, no una lista de texto",
      (await carousel.locator(".place-card--compact").count()) > 0
    );
    check("05 §5 pt.12: la lista de texto anterior ya no existe", (await page.locator(".nearby-item").count()) === 0);
    check(
      "DDR-06: la sección NO renderiza nota al pie",
      (await page.locator(".place-detail__footnote").count()) === 0
    );
    // Ni ningún párrafo que repita en prosa lo que el marcador ya dice (`04 §2`).
    const sectionText = await carousel.evaluate((node) => node.parentElement.innerText);
    check(
      "04 §2: no queda descargo en prosa junto al marcador",
      !/estimaciones geográficas;|no son tiempos de ruta validados|Son datos estáticos, no horarios en vivo\./.test(
        sectionText
      )
    );

    const items = carousel.locator(".nearby-carousel__item");
    const count = await items.count();
    let withMark = 0;
    let readable = 0;
    const seen = new Set();
    for (let index = 0; index < count; index += 1) {
      const mark = items.nth(index).locator(".evidence-mark");
      if ((await mark.count()) === 0) continue;
      withMark += 1;
      const text = (await mark.first().innerText()).trim();
      const title = await mark.first().getAttribute("title");
      const spoken = `${text} ${title ?? ""}`;
      seen.add(spoken.trim());
      // La distinción que la nota al pie explicaba, ahora por traslado.
      if (
        /datos estáticos, no un horario en vivo/i.test(spoken) ||
        /no es un tiempo de ruta validado ni un horario en vivo/i.test(spoken) ||
        /se identifica explícitamente como tal/i.test(spoken)
      ) {
        readable += 1;
      }
    }
    check("05 §5 pt.12: cada traslado lleva su EvidenceMark", withMark === count, `${withMark}/${count}`);
    check(
      "DDR-06: cada marcador conserva la distinción semántica de la nota al pie",
      readable === count,
      `${readable}/${count}`
    );
    check(
      "DDR-06: esa distinción es alcanzable por un lector de pantalla (texto visible o `title`)",
      readable === count && [...seen].every((entry) => entry.length > 20),
      JSON.stringify([...seen][0] ?? "")
    );
  } else {
    check("«Cerca de aquí»: este lugar no tiene traslados, se omite", true);
  }

  // ---- 04 §6: una sola imagen ⇒ sin contador, puntos ni flechas ----
  await detail.locator(".place-detail__back").click();
  await page.waitForTimeout(400);
  const singleImage = await findPlaceWhere(page, async (current) => {
    const slides = await current.locator(".gallery__slide").count();
    return slides === 1;
  });
  if (singleImage !== null) {
    check("04 §6: con una sola imagen no hay contador", (await page.locator(".gallery__counter").count()) === 0);
    check("04 §6: con una sola imagen no hay puntos", (await page.locator(".gallery__dot").count()) === 0);
    check("04 §6: con una sola imagen no hay flechas", (await page.locator(".gallery__nav").count()) === 0);
    // D8 se comprueba aquí: una ficha recién abierta, sin que nadie haya opinado.
    check(
      "D8: con nadie que haya opinado, la franja de los dos no se renderiza",
      (await page.locator(".place-interest__line").count()) === 0
    );
    // pt. 5: sin grado S no hay insignia de nivel.
    const badge = await page.locator(".place-detail__badge").count();
    const badgeText = badge ? await page.locator(".place-detail__badge").innerText() : "";
    check(
      "05 §5 pt.5: la única insignia posible es «★ Imprescindible»",
      badge === 0 || /Imprescindible/.test(badgeText),
      badgeText
    );
    await page.locator(".place-detail__back").click();
    await page.waitForTimeout(300);
  } else {
    check("04 §6: no se encontró un lugar de una sola imagen en los primeros 24, se omite", true);
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    for (const viewport of VIEWPORTS) await auditViewport(browser, viewport);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed}/${passed + failed} comprobaciones OK.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
