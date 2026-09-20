import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bloque 19 (B3) — gate de contraste fotográfico (criterio de aceptación: el nombre debe leerse
 * a ≥4.5:1 sobre las 10 imágenes de catálogo MÁS CLARAS).
 *
 * No es una inspección visual: mide, sobre un navegador real,
 *
 *   1. qué 10 derivados `-800w.webp` del catálogo son más claros en la banda inferior donde vive
 *      el nombre (no el promedio de toda la imagen — una foto oscura arriba y muy clara abajo,
 *      justo donde se pinta el texto, es el caso real que importa);
 *   2. el degradado `--scrim-bottom` REALMENTE aplicado — leído del `background-image` calculado
 *      de una `.place-card__overlay` viva en la app en marcha, nunca reescrito a mano aquí, para
 *      que este gate seure automáticamente si el token cambia — y la posición vertical real del
 *      nombre dentro de esa superposición (medida en el DOM, no supuesta);
 *   3. el color resultante de componer esa imagen con ese degradado en la franja donde cae el
 *      nombre, y el contraste WCAG de blanco sobre ese color compuesto.
 *
 * Si algo falla aquí, la corrección es sistémica (la tarjeta o el sistema de scrim — p. ej. subir
 * la opacidad base o el segundo punto de parada de `--scrim-bottom` en tokens.css), nunca retocar
 * una fotografía concreta.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const IMAGES_ROOT = path.join(APP_DIR, "public", "images", "places");
const MIN_CONTRAST = 4.5;
const CANDIDATE_COUNT = 10;

/** Every card-sized derivative (`-800w.webp`, `CARD_IMAGE_WIDTH` in `data/place-images.ts`) under
 * `public/images/places/**`, as public URL paths. */
function findCardDerivatives(dir, root = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findCardDerivatives(full, root));
    } else if (entry.name.endsWith("-800w.webp")) {
      const rel = path.relative(root, full).split(path.sep).join("/");
      out.push(`/images/places/${rel}`);
    }
  }
  return out;
}

/** WCAG relative luminance and contrast ratio (sRGB), see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance. */
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgbA, rgbB) {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Parses `linear-gradient(to top, rgba(r,g,b,a) p0%, rgba(r,g,b,a) p1%, …)`, as the browser's
 * own CSSOM prints a resolved `var(--scrim-bottom)` — never a hand-typed copy of the token. */
function parseGradientStops(backgroundImage) {
  const stops = [];
  const stopPattern = /rgba?\(([^)]+)\)\s*(\d+(?:\.\d+)?)%/g;
  let match;
  while ((match = stopPattern.exec(backgroundImage))) {
    const parts = match[1].split(",").map((n) => parseFloat(n.trim()));
    const [r, g, b, a = 1] = parts;
    stops.push({ r, g, b, a, pos: parseFloat(match[2]) / 100 });
  }
  return stops;
}

/** Alpha (and, since every stop shares the same hue here, colour) of the gradient at a given
 * fractional position along its axis — linear interpolation between the two bracketing stops,
 * exactly as the CSS painting algorithm does. `fraction` is 0 at the gradient's start (`to top`
 * ⇒ the box's bottom edge) and 1 at its end (the box's top edge). */
function sampleGradient(stops, fraction) {
  if (fraction <= stops[0].pos) return stops[0];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (fraction >= a.pos && fraction <= b.pos) {
      const t = (fraction - a.pos) / (b.pos - a.pos || 1);
      return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
        a: a.a + (b.a - a.a) * t,
      };
    }
  }
  return stops[stops.length - 1];
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const urls = findCardDerivatives(IMAGES_ROOT);
  console.log(`Derivados de tarjeta (-800w.webp) encontrados: ${urls.length}`);

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle" });

  // ---------- 1. Rankear por claridad de la banda inferior (donde cae el nombre) ----------
  const luminances = [];
  for (const url of urls) {
    const avg = await page.evaluate(async (src) => {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`no se pudo cargar ${src}`));
        el.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      // Banda inferior del 40% — cubre de sobra la franja donde `--scrim-bottom` mantiene
      // opacidad apreciable (0%–68% del eje del degradado) y donde vive el overlay.
      const bandHeight = Math.round(canvas.height * 0.4);
      const y0 = canvas.height - bandHeight;
      const { data } = ctx.getImageData(0, y0, canvas.width, bandHeight);
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        count++;
      }
      return sum / count;
    }, url);
    luminances.push({ url, avg });
  }
  luminances.sort((a, b) => b.avg - a.avg);
  const lightest = luminances.slice(0, CANDIDATE_COUNT);
  console.log(`\nLas ${CANDIDATE_COUNT} imágenes más claras (banda inferior):`);
  for (const { url, avg } of lightest) console.log(`  ${avg.toFixed(1)}  ${url}`);

  // ---------- 2. Leer el degradado y la posición del nombre REALMENTE aplicados ----------
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card__overlay", { timeout: 15000 });
  const geometry = await page.evaluate(() => {
    const overlay = document.querySelector(".place-card:not(.place-card--compact) .place-card__overlay");
    const name = overlay.querySelector(".place-card__name-text");
    const overlayBox = overlay.getBoundingClientRect();
    const nameBox = name.getBoundingClientRect();
    return {
      backgroundImage: getComputedStyle(overlay).backgroundImage,
      overlayHeight: overlayBox.height,
      overlayBottom: overlayBox.bottom,
      nameTop: nameBox.top,
      nameBottom: nameBox.bottom,
    };
  });
  const stops = parseGradientStops(geometry.backgroundImage);
  if (stops.length < 2) {
    console.error("No se pudo leer el degradado --scrim-bottom desde el DOM vivo:", geometry.backgroundImage);
    process.exit(1);
  }
  // Fracción a lo largo del eje del degradado (0 = borde inferior de la caja, `to top`) para el
  // techo y el suelo de la caja del nombre — el peor caso (menor opacidad de scrim) es el techo,
  // más cerca del final del degradado.
  const fractionAt = (y) => (geometry.overlayBottom - y) / geometry.overlayHeight;
  const nameFractionTop = fractionAt(geometry.nameTop);
  const nameFractionBottom = fractionAt(geometry.nameBottom);
  console.log(
    `\nDegradado leído del DOM: ${stops.length} paradas. Nombre entre fracción ${nameFractionBottom.toFixed(3)} (suelo) y ${nameFractionTop.toFixed(3)} (techo) del eje.`
  );

  // ---------- 3. Componer cada candidata con el scrim real, en la franja del nombre ----------
  const WHITE = [255, 255, 255];
  const failures = [];
  console.log(`\nContraste blanco-sobre-compuesto en la franja del nombre (mínimo exigido ${MIN_CONTRAST}:1):`);
  for (const { url } of lightest) {
    const bandColor = await page.evaluate(
      async ({ src, yFrom, yTo }) => {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error(`no se pudo cargar ${src}`));
          el.src = src;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const rowFrom = Math.max(0, Math.min(canvas.height - 1, Math.round(canvas.height * (1 - yTo))));
        const rowTo = Math.max(rowFrom + 1, Math.min(canvas.height, Math.round(canvas.height * (1 - yFrom))));
        const { data } = ctx.getImageData(0, rowFrom, canvas.width, rowTo - rowFrom);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        return { r: r / count, g: g / count, b: b / count };
      },
      // `yFrom`/`yTo` are fractions of image height from the BOTTOM (image-space), matching the
      // gradient's own `to top` axis — image row 0 is the image's top, so this inverts.
      { src: url, yFrom: nameFractionBottom, yTo: nameFractionTop }
    );

    // El degradado comparte matiz en las tres paradas (sólo cambia el alfa); se muestrea el
    // punto medio de la franja del nombre como representante — el punto donde el alfa es más
    // bajo (el peor caso) ya lo acota `nameFractionTop`, comprobado también abajo.
    const midFraction = (nameFractionBottom + nameFractionTop) / 2;
    for (const [label, fraction] of [
      ["techo (peor caso, menos scrim)", nameFractionTop],
      ["punto medio", midFraction],
    ]) {
      const scrim = sampleGradient(stops, fraction);
      const composed = [
        bandColor.r * (1 - scrim.a) + scrim.r * scrim.a,
        bandColor.g * (1 - scrim.a) + scrim.g * scrim.a,
        bandColor.b * (1 - scrim.a) + scrim.b * scrim.a,
      ];
      const ratio = contrastRatio(WHITE, composed);
      const ok = ratio >= MIN_CONTRAST;
      console.log(
        `  ${ok ? "OK  " : "FAIL"} ${ratio.toFixed(2)}:1  [${label}]  ${url}`
      );
      if (!ok) failures.push({ url, label, ratio });
    }
  }

  await browser.close();

  console.log(`\n${lightest.length * 2 - failures.length}/${lightest.length * 2} mediciones ≥${MIN_CONTRAST}:1.`);
  if (failures.length > 0) {
    console.log(
      "\nEl fallo es del sistema de tarjeta/scrim (`--scrim-bottom` en tokens.css), no de una fotografía " +
        "concreta — no se ajusta ninguna imagen individual para pasar este gate."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
