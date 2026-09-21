import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bloque 19 (B3) — gate de scrim y contraste de `PlaceCard` (corrección DD-016).
 *
 * `03 §5` prohíbe la sombra sobre fotografía («las superficies sobre fotografía no usan sombra:
 * usan `--scrim-*`»), así que la legibilidad del nombre ya no tiene red de seguridad: o la da el
 * scrim, o no la da nadie. Este gate comprueba las dos mitades de esa exigencia:
 *
 *   A. **Scrim efectivo ≥0.60 bajo TODA la banda de texto** — no sólo bajo el nombre. Se mide
 *      fila a fila, desde el techo del elemento de texto más alto (la insignia, cuando la hay)
 *      hasta el suelo del más bajo (la línea de categoría·zona).
 *   B. **Contraste AA (4.5:1) con la imagen más clara disponible** — las 10 fotografías más
 *      claras del catálogo, para el nombre en blanco y para la línea de categoría·zona al 82%.
 *
 * Y lo mide sobre PÍXELES REALES, no sobre aritmética de degradados: se sustituye la fotografía
 * de una tarjeta viva por la imagen de prueba, se oculta su texto, se fotografía la tarjeta y se
 * leen los píxeles resultantes. Así entra en la cuenta TODO lo que el navegador pinta entre la
 * fotografía y el texto (el degradado del overlay, el suelo de la banda, y cualquier capa que se
 * añada en el futuro sin acordarse de este fichero).
 *
 * Se ejecuta en los dos regímenes de la tarjeta, porque la geometría cambia entre ellos y con
 * ella la parte del degradado que cae bajo el texto:
 *   - 390px → 1 columna → 4:3;
 *   - 1200px → 2 columnas → 16:9 (el caso desfavorable: la banda ocupa ~60% de la fotografía).
 *
 * Si algo falla aquí, la corrección es sistémica (el scrim de la tarjeta), nunca retocar una
 * fotografía concreta.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const IMAGES_ROOT = path.join(APP_DIR, "public", "images", "places");
const MIN_CONTRAST = 4.5;
const MIN_SCRIM = 0.6;
const CANDIDATE_COUNT = 10;
/** `--ink-900` en rgb: el color sobre el que están construidos todos los `--scrim-*` (03 §1.2). */
const INK = [20, 22, 26];
const WHITE = [255, 255, 255];
/** 1×1 blanco puro: más claro que cualquier fotografía del catálogo, presente o futura. */
const WHITE_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const LAYOUTS = [
  { name: "390 · 1 columna · 4:3", width: 390, height: 844 },
  { name: "1200 · 2 columnas · 16:9", width: 1200, height: 900 },
];

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

/** `04 §5`: la línea de categoría·zona es «blanco 82%», así que el color que el ojo recibe
 * depende del fondo que tenga debajo — se compone aquí igual que lo compone el navegador. */
function composite(fg, bg, alpha) {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const fail = (label, extra) => {
    results.push({ label, extra });
    console.log(`FAIL ${label}${extra ? ` (${extra})` : ""}`);
  };

  const urls = findCardDerivatives(IMAGES_ROOT);
  console.log(`Derivados de tarjeta (-800w.webp) encontrados: ${urls.length}`);

  const ranking = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const rankPage = await ranking.newPage();
  await rankPage.goto(BASE_URL, { waitUntil: "networkidle" });

  // ---------- 1. Rankear por claridad de la banda inferior (donde cae el texto) ----------
  const luminances = [];
  for (const url of urls) {
    const avg = await rankPage.evaluate(async (src) => {
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
      // Banda inferior del 40% — de sobra para cubrir la franja donde vive el texto en los dos
      // regímenes de proporción. Sólo sirve para elegir candidatas; la medida real es la de abajo.
      const bandHeight = Math.round(canvas.height * 0.4);
      const { data } = ctx.getImageData(0, canvas.height - bandHeight, canvas.width, bandHeight);
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
  await ranking.close();

  for (const layout of LAYOUTS) {
    const context = await browser.newContext({
      viewport: { width: layout.width, height: layout.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      try {
        localStorage.setItem("nihon.onboarding.seen.v1", "1");
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card__band", { timeout: 15000 });
    // La primera tarjeta con fotografía cargada de verdad: sobre ella se hacen todas las medidas.
    await page.waitForFunction(
      () => !!document.querySelector('.place-card__image[data-state="loaded"]'),
      undefined,
      { timeout: 15000 }
    );

    /** Oculta el texto (no la banda) para poder leer el fondo que el texto tiene debajo, y
     * devuelve la caja de la fotografía y la franja EXACTA que ocupan los elementos de texto. */
    // Peor caso de banda: la tarjeta MÁS ALTA de texto que haya cargado su fotografía — con
    // insignia «★ Imprescindible» y, a igualdad, con el nombre a dos líneas. Cuanto más alta la
    // banda, más arriba queda su techo dentro del degradado de la fotografía. Se marca y se
    // lleva a la vista antes de medir: la captura recorta sobre el viewport, no sobre el documento.
    await page.evaluate(() => {
      const loaded = [...document.querySelectorAll('.place-card__image[data-state="loaded"]')].map(
        (el) => el.closest(".place-card")
      );
      const bandHeight = (card) => card.querySelector(".place-card__band")?.getBoundingClientRect().height ?? 0;
      // Con insignia primero (es la fila de texto que más arriba llega), y a igualdad la banda
      // más alta. Si ninguna tarjeta cargada lleva insignia, gana simplemente la más alta.
      const hasBadge = (card) => (card.querySelector(".place-card__badge") ? 1 : 0);
      const card = loaded.sort(
        (a, b) => hasBadge(b) - hasBadge(a) || bandHeight(b) - bandHeight(a)
      )[0];
      card.setAttribute("data-scrim-probe", "1");
      card.scrollIntoView({ block: "center", behavior: "instant" });
    });
    await page.waitForTimeout(400);

    const boxes = await page.evaluate(() => {
      const card = document.querySelector('[data-scrim-probe="1"]');
      const media = card.querySelector(".place-card__media");
      const texts = [...card.querySelectorAll(".place-card__badge, .place-card__name-text, .place-card__where")];
      const mediaBox = media.getBoundingClientRect();
      const tops = texts.map((el) => el.getBoundingClientRect().top);
      const bottoms = texts.map((el) => el.getBoundingClientRect().bottom);
      for (const el of texts) el.style.visibility = "hidden";
      // El corazón y el token de persona se apoyan sobre la fotografía pero no sobre la banda;
      // se ocultan igualmente para que no contaminen ninguna fila muestreada.
      for (const el of card.querySelectorAll(".place-card__save, .place-card__person-token, .place-card__photo-count")) {
        el.style.visibility = "hidden";
      }
      return {
        media: { x: mediaBox.x, y: mediaBox.y, width: mediaBox.width, height: mediaBox.height },
        textTop: Math.min(...tops) - mediaBox.y,
        textBottom: Math.max(...bottoms) - mediaBox.y,
        hasBadge: texts.length === 3,
      };
    });

    /** Sustituye la fotografía por `src`, fotografía la caja de la tarjeta y devuelve el color
     * medio de cada fila de píxeles de la franja de texto. */
    async function rowsUnderText(src) {
      await page.evaluate(async (nextSrc) => {
        const img = document.querySelector('[data-scrim-probe="1"] .place-card__image');
        await new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          img.src = nextSrc;
        });
      }, src);
      await page.waitForTimeout(80);
      const shot = await page.screenshot({
        clip: {
          x: Math.round(boxes.media.x),
          y: Math.round(boxes.media.y),
          width: Math.round(boxes.media.width),
          height: Math.round(boxes.media.height),
        },
      });
      return page.evaluate(
        async ({ png, from, to }) => {
          const img = await new Promise((resolve) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.src = `data:image/png;base64,${png}`;
          });
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const y0 = Math.max(0, Math.floor(from));
          const y1 = Math.min(canvas.height, Math.ceil(to));
          const rows = [];
          for (let y = y0; y < y1; y++) {
            const { data } = ctx.getImageData(0, y, canvas.width, 1);
            let r = 0;
            let g = 0;
            let b = 0;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              n++;
            }
            rows.push([r / n, g / n, b / n]);
          }
          return rows;
        },
        { png: shot.toString("base64"), from: boxes.textTop, to: boxes.textBottom }
      );
    }

    console.log(
      `\n=== ${layout.name} — franja de texto: ${boxes.textBottom - boxes.textTop > 0 ? (boxes.textBottom - boxes.textTop).toFixed(1) : "?"}px de los ${boxes.media.height.toFixed(1)}px de fotografía (${(((boxes.textBottom - boxes.textTop) / boxes.media.height) * 100).toFixed(0)}%), insignia ${boxes.hasBadge ? "presente" : "ausente"} ===`
    );

    // ---------- A. Scrim efectivo ≥0.60 bajo toda la banda ----------
    {
      const rows = await rowsUnderText(WHITE_PIXEL);
      // Sobre blanco puro, el color resultante da directamente el alfa efectivo del scrim:
      //   C = (1−s)·255 + s·ink   ⇒   s = (255 − C) / (255 − ink)
      const alphas = rows.map((row) =>
        Math.min(...row.map((c, i) => (255 - c) / (255 - INK[i])))
      );
      const min = Math.min(...alphas);
      const max = Math.max(...alphas);
      const ok = min >= MIN_SCRIM;
      console.log(
        `${ok ? "OK  " : "FAIL"} scrim efectivo ≥${MIN_SCRIM} bajo toda la banda (mín=${min.toFixed(3)} máx=${max.toFixed(3)} sobre ${rows.length} filas)`
      );
      if (!ok) fail(`${layout.name}: scrim efectivo mínimo ${min.toFixed(3)} < ${MIN_SCRIM}`);
    }

    // ---------- B. Contraste AA con las 10 imágenes más claras ----------
    console.log(`Contraste sobre las ${CANDIDATE_COUNT} fotografías más claras (mínimo ${MIN_CONTRAST}:1):`);
    for (const { url } of lightest) {
      const rows = await rowsUnderText(url);
      let worstName = Infinity;
      let worstWhere = Infinity;
      for (const bg of rows) {
        worstName = Math.min(worstName, contrastRatio(WHITE, bg));
        // La línea de categoría·zona es blanco al 82% (04 §5): se compone sobre su propio fondo.
        worstWhere = Math.min(worstWhere, contrastRatio(composite(WHITE, bg, 0.82), bg));
      }
      const ok = worstName >= MIN_CONTRAST && worstWhere >= MIN_CONTRAST;
      console.log(
        `  ${ok ? "OK  " : "FAIL"} nombre ${worstName.toFixed(2)}:1 · categoría·zona ${worstWhere.toFixed(2)}:1  ${url}`
      );
      if (!ok) {
        fail(
          `${layout.name}: ${url}`,
          `nombre ${worstName.toFixed(2)}:1, categoría·zona ${worstWhere.toFixed(2)}:1`
        );
      }
    }

    await context.close();
  }

  await browser.close();

  if (results.length > 0) {
    console.log(
      `\n${results.length} medición(es) por debajo del mínimo. El fallo es del sistema de scrim de ` +
        "`PlaceCard` (`.place-card__band` en `styles/discovery.css`), no de una fotografía concreta — " +
        "no se ajusta ninguna imagen individual para pasar este gate."
    );
    process.exit(1);
  }
  console.log("\nTodas las mediciones dentro de contrato.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
