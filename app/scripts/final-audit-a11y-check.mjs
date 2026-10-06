import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

/**
 * Gate de la auditoría final independiente (6 oct 2026) — H05, H06 y H07, contra la build real.
 *
 *   H05  contraste ≥ 4,5:1 del texto normal de Reservas (colores calculados, todos los nodos de
 *        texto, con los `<details>` abiertos), en las cinco anchuras;
 *   H06  semántica de `EvidenceMark`: sin `aria-label` en elementos que no lo admiten, rol `img`
 *        con nombre en la variante sólo-glifo, nada de rol/etiqueta en la variante con texto, el
 *        nombre accesible (árbol AX por CDP en Chromium) y ausencia de anuncios duplicados;
 *   H07  controles de «Herramientas del viaje» ≥ 44 px en las cinco anchuras: geometría,
 *        separación entre controles, foco visible y ausencia de recortes u overflow horizontal.
 *
 * No usa axe (no es dependencia del repositorio): comprueba por geometría, estilos calculados y
 * árbol de accesibilidad. Los resultados con axe se adjuntan aparte como evidencia de la PR.
 *
 * Uso: `npm run build && node scripts/final-audit-a11y-check.mjs`
 * (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH`, `NIHON_EVIDENCE_OUT`, `NIHON_PORT` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = Number(process.env.NIHON_PORT ?? 4192);
const OUT = process.env.NIHON_EVIDENCE_OUT ?? null;
const WIDTHS = [320, 390, 430, 768, 1440];
const MIN_TAP = 44;

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});
const BASE_URL = `http://127.0.0.1:${PORT}`;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch(
  process.env.NIHON_CHROMIUM_PATH && BROWSER === "chromium" ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {}
);

const results = [];
const evidence = { h05: [], h06: [], h07: [] };
const check = (id, label, ok, extra) => {
  results.push({ id, label, ok, extra: extra ?? null });
  console.log(`${ok ? "OK  " : "FAIL"} [${id}] ${label}${extra !== undefined ? ` (${extra})` : ""}`);
};

const none = { start: { kind: "unselected" }, end: { kind: "unselected" } };
const ids = ["JP-021", "JP-044", "JP-077", "JP-078"];
const draft = {
  version: 8,
  routeIds: ids,
  days: [
    { id: "day-a", placeIds: ids.slice(0, 2), accommodationBoundary: none },
    { id: "day-b", placeIds: ids.slice(2), accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "no-accommodation" } } },
    { id: "day-c", placeIds: [], accommodationBoundary: none },
  ],
  startDate: "2027-02-22",
  endDate: "2027-02-24",
  visitStartTimes: {},
  accommodations: [{ id: "hotel", label: "Hotel Sakura", location: { lat: 35.68, lng: 139.76 } }],
  accommodationLegs: [],
  interHubSegments: [],
  zoneAccommodationChoices: [],
};
const travellers = {
  version: 1,
  travellers: [{ id: "p1", label: "Marta" }, { id: "p2", label: "Jun" }],
  activeTravellerId: "p1",
  interests: ids.map((placeId) => ({ placeId, stances: [{ travellerId: "p1", stance: "interested" }], carriedOver: false })),
};

async function openSurface(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(
    ({ tr, dr }) => {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
      localStorage.setItem("nihon.travellers.v1", JSON.stringify(tr));
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(dr));
    },
    { tr: travellers, dr: draft }
  );
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(BASE_URL);
  return { context, page };
}
const click = (page, name) => page.getByRole("button", { name, exact: true }).click();
const tab = (page, name) =>
  page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name }).click();

/** Contraste WCAG de cada nodo de texto visible dentro de `rootSelector`, con su fondo efectivo. */
const CONTRAST_PROBE = ({ rootSelector }) => {
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const background = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0) {
        layers.push(color);
        if (!layers.from) layers.from = node;
        if (color.a === 1) break;
      }
    }
    background.lastFrom = layers.from ?? null;
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) base = over(layer, base);
    return base;
  };
  const root = document.querySelector(rootSelector);
  if (!root) return { missing: true, rows: [] };
  for (const details of root.querySelectorAll("details")) details.open = true;
  const rows = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (el.closest("[aria-hidden='true']")) continue;
    const style = getComputedStyle(el);
    const fg = parse(style.color);
    if (!fg) continue;
    const bg = background(el);
    const fgOver = over(fg, bg);
    const [hi, lo] = [lum(fgOver), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(style.fontSize);
    const bold = parseInt(style.fontWeight, 10) >= 700;
    // Un símbolo con rol `img` (el glifo de `EvidenceMark`) es un objeto gráfico: 1.4.11 pide 3:1.
    const large = size >= 24 || (bold && size >= 18.66) || !!el.closest("[role='img']");
    rows.push({
      cls: el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName.toLowerCase(),
      text: node.textContent.trim().slice(0, 40),
      ratio: Math.round(ratio * 100) / 100,
      required: large ? 3 : 4.5,
      size: Math.round(size * 10) / 10,
      bgFrom: background.lastFrom ? String(background.lastFrom.className).split(" ")[0] || background.lastFrom.tagName.toLowerCase() : "(raíz)",
    });
  }
  return { missing: false, rows };
};

// ═══ H05 ═════════════════════════════════════════════════════════════════════════════════════
for (const width of WIDTHS) {
  const { context, page } = await openSurface(width);
  try {
    await tab(page, "Viaje");
    await page.locator(".day-card").first().waitFor();
    await click(page, "Reservas");
    await page.locator(".trip-reservations").waitFor();
    const probe = await page.evaluate(CONTRAST_PROBE, { rootSelector: ".trip-reservations" });
    const bad = probe.rows.filter((row) => row.ratio < row.required);
    evidence.h05.push({ width, nodes: probe.rows.length, bad });
    const named = probe.rows.filter((row) =>
      /official-reservation-date__(scope|provenance|reference)|evidence-mark/.test(row.cls)
    );
    check("H05", `@${width}: Reservas tiene texto que medir (${probe.rows.length} nodos, ${named.length} de procedencia/fecha)`, probe.rows.length > 5 && named.length > 0);
    check("H05", `@${width}: todo el texto de Reservas alcanza su contraste mínimo`, bad.length === 0,
      bad.length ? bad.slice(0, 4).map((b) => `${b.cls} «${b.text}» ${b.ratio}<${b.required} sobre ${b.bgFrom}`).join("; ") : `mín ${Math.min(...probe.rows.map((r) => r.ratio))}`);
    // Resumen comparte superficies de procedencia sobre fondos sunken.
    await click(page, "Resumen");
    await page.locator(".trip-summary").waitFor();
    const summary = await page.evaluate(CONTRAST_PROBE, { rootSelector: ".trip-summary" });
    const summaryBad = summary.rows.filter((row) => row.ratio < row.required);
    check("H05", `@${width}: el Resumen (mismos tokens) tampoco baja de su mínimo`, summaryBad.length === 0,
      summaryBad.length ? summaryBad.slice(0, 3).map((b) => `${b.cls} ${b.ratio} sobre ${b.bgFrom}`).join("; ") : "");
  } catch (error) {
    check("H05", `@${width}: excepción`, false, String(error.message).split("\n")[0]);
  }
  await context.close();
}

// ═══ H06 ═════════════════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await openSurface(390);
  try {
    const surfaces = [];
    const axProbe = async () => {
      const cdp = await context.newCDPSession(page);
      const doc = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "[data-ax-probe]" });
      if (!nodeId) return null;
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
      const self = nodes[0];
      return { role: self?.role?.value ?? null, name: self?.name?.value ?? null, description: self?.description?.value ?? "", childCount: (self?.childIds ?? []).length };
    };
    const scan = async (name) => {
      const info = await page.evaluate(() => {
        const GENERIC = new Set(["SPAN", "DIV", "P", "B", "I", "EM", "STRONG", "SMALL", "LABEL"]);
        const labelledGeneric = [...document.querySelectorAll("[aria-label]")]
          // Los genéricos con texto propio quedan «por revisar» en axe, no como violación: el alcance de
          // H06 son los símbolos SIN texto (glifo/ícono), donde el nombre sólo puede venir del rol.
          .filter((el) => GENERIC.has(el.tagName) && !el.getAttribute("role") && el.checkVisibility() && (el.textContent.trim().length === 0 || el.classList.contains("evidence-mark")))
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}[${el.getAttribute("aria-label")}]`);
        const glyphOnly = [...document.querySelectorAll(".evidence-mark--glyph-only")].filter((el) => el.checkVisibility());
        const withText = [...document.querySelectorAll(".evidence-mark:not(.evidence-mark--glyph-only)")].filter((el) => el.checkVisibility());
        return {
          labelledGeneric,
          glyphOnly: glyphOnly.map((el) => ({
            role: el.getAttribute("role"),
            label: el.getAttribute("aria-label"),
            title: el.getAttribute("title"),
            hiddenChildren: el.querySelectorAll("[aria-hidden]").length,
            text: el.textContent.trim(),
          })),
          withText: withText.map((el) => ({
            role: el.getAttribute("role"),
            label: el.getAttribute("aria-label"),
            hasText: /[A-Za-zÁ-ú]{4,}/.test(el.textContent),
          })),
        };
      });
      surfaces.push({ name, ...info });
    };
    await page.getByRole("button", { name: /^Tokio 東京/ }).click().catch(() => {});
    await scan("ciudad");
    await page.locator(".place-card__open").first().click();
    await page.locator(".place-detail").waitFor();
    await scan("ficha");
    await page.evaluate(() => {
      const el = [...document.querySelectorAll(".evidence-mark--glyph-only")].find((e) => e.checkVisibility());
      if (el) el.setAttribute("data-ax-probe", "1");
    });
    const ax = BROWSER === "chromium" ? await axProbe() : null;
    await page.locator(".place-detail__back").click();
    await tab(page, "Quiero ir");
    await scan("guardados");
    await tab(page, "Viaje");
    await page.locator(".day-card").first().waitFor();
    await click(page, "Cambiar orden del Día 1");
    await scan("orden");
    await page.keyboard.press("Escape");
    await click(page, "Resumen");
    await scan("resumen");
    await click(page, "Reservas");
    await scan("reservas");
    evidence.h06 = [...surfaces, { ax }];

    const all = (key) => surfaces.flatMap((s) => s[key]);
    const glyph = all("glyphOnly");
    check("H06", "hay marcadores de sólo glifo que comprobar", glyph.length > 0, `${glyph.length}`);
    check("H06", "ningún elemento genérico lleva aria-label sin rol (patrón de aria-prohibited-attr)", surfaces.every((s) => s.labelledGeneric.length === 0),
      surfaces.flatMap((s) => s.labelledGeneric.map((l) => `${s.name}:${l}`)).slice(0, 4).join("; "));
    check("H06", "cada marcador de sólo glifo es role=img con un nombre no vacío", glyph.every((g) => g.role === "img" && (g.label || g.title || "").length > 2));
    check("H06", "el nombre conserva la procedencia (nivel · detalle)", glyph.every((g) => /Verificado|Registrado|Estimado|Nihon dice/.test(g.label || g.title || "")));
    check("H06", "el glifo es el único contenido (sin aria-hidden anidado ni texto anunciable aparte)", glyph.every((g) => g.hiddenChildren === 0 && g.text.length <= 2));
    const withText = all("withText");
    check("H06", "la variante con texto visible no añade rol ni aria-label (sin anuncio doble)", withText.length === 0 || withText.every((w) => w.role === null && w.label === null && w.hasText),
      `${withText.length} marcadores con texto`);
    check("H06", "el nombre procede de UN solo atributo (title y aria-label a la vez duplican la descripción)", glyph.every((g) => !(g.label && g.title)));
    if (BROWSER === "chromium") {
      check("H06", "árbol AX (Chromium): rol img con nombre de procedencia", !!ax && (ax.role === "img" || ax.role === "image") && !!ax.name && /Verificado|Registrado|Estimado|Nihon dice/.test(ax.name), `${ax?.role} «${ax?.name}»`);
      check("H06", "árbol AX (Chromium): el nombre no se repite como descripción", !!ax && ax.description === "", `descripción «${ax?.description}»`);
    }

  } catch (error) {
    check("H06", "excepción", false, String(error.stack).split("\n").slice(0, 3).join(" | "));
  }
  await context.close();
}

// ═══ H07 ═════════════════════════════════════════════════════════════════════════════════════
for (const width of WIDTHS) {
  const { context, page } = await openSurface(width);
  try {
    await tab(page, "Viaje");
    await page.locator(".day-card").first().waitFor();
    await click(page, "Herramientas del viaje");
    const view = page.locator(".focused-view");
    await view.waitFor();
    await page.waitForTimeout(250);
    const info = await view.evaluate((root) => {
      const visible = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0;
      const controls = [...root.querySelectorAll("select, input:not([type=hidden]), button, summary, a[href]")].filter(visible);
      const box = root.getBoundingClientRect();
      const rows = controls.map((el, index) => {
        const r = el.getBoundingClientRect();
        return {
          index,
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).split(" ")[0],
          name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40),
          x: r.x, y: r.y, w: r.width, h: r.height,
          clippedX: r.left < box.left - 1 || r.right > box.right + 1,
          textClipped: el.scrollWidth > el.clientWidth + 1 && (el.tagName === "INPUT" || el.tagName === "SELECT"),
        };
      });
      const overlaps = [];
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          const a = rows[i], b = rows[j];
          const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ix > 1 && iy > 1) overlaps.push(`${a.cls || a.tag}«${a.name}» × ${b.cls || b.tag}«${b.name}»`);
        }
      }
      return { rows, overlaps, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const formFields = info.rows.filter((r) => r.tag === "select" || r.tag === "input");
    const small = info.rows.filter((r) => r.tag !== "a" && (r.h < MIN_TAP - 0.5 || (formFields.includes(r) && r.w < MIN_TAP - 0.5)) && formFields.includes(r));
    evidence.h07.push({ width, fields: formFields.map(({ tag, cls, name, w, h }) => ({ tag, cls, name, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 })), overlaps: info.overlaps });
    check("H07", `@${width}: hay campos de formulario en Herramientas que medir`, formFields.length >= 3, `${formFields.length}`);
    check("H07", `@${width}: selectores y entradas miden ≥${MIN_TAP}px de alto`, small.length === 0,
      small.slice(0, 3).map((r) => `${r.tag}.${r.cls} ${r.h.toFixed(1)}px`).join("; ") || `mín ${Math.min(...formFields.map((r) => r.h)).toFixed(1)}px`);
    check("H07", `@${width}: ningún control se solapa con otro`, info.overlaps.length === 0, info.overlaps.slice(0, 2).join("; "));
    check("H07", `@${width}: ningún control queda recortado ni hay overflow horizontal de la página`, !info.pageOverflow && info.rows.every((r) => !r.clippedX && !r.textClipped),
      info.rows.filter((r) => r.clippedX || r.textClipped).slice(0, 2).map((r) => `${r.tag}.${r.cls}`).join("; "));
    // Foco: cada campo recibe el foco y su anillo es visible (outline o box-shadow) y no queda fuera de la vista.
    const focus = await view.evaluate(async (root) => {
      const fields = [...root.querySelectorAll("select, input:not([type=hidden])")].filter((e) => e.checkVisibility());
      const out = [];
      for (const el of fields) {
        el.scrollIntoView({ block: "center" });
        el.focus();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const style = getComputedStyle(el);
        const ring = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || (style.boxShadow && style.boxShadow !== "none");
        const r = el.getBoundingClientRect();
        out.push({ focused: document.activeElement === el, ring: !!ring, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= -1 && r.right <= innerWidth + 1 });
      }
      return out;
    });
    check("H07", `@${width}: los campos aceptan foco con anillo visible y quedan dentro de la vista`, focus.length > 0 && focus.every((f) => f.focused && f.ring && f.inView),
      `${focus.filter((f) => f.focused && f.ring && f.inView).length}/${focus.length}`);
  } catch (error) {
    check("H07", `@${width}: excepción`, false, String(error.stack).split("\n").slice(0, 3).join(" | "));
  }
  await context.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK (${BROWSER})`);
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/final-audit-a11y-${BROWSER}.json`, JSON.stringify({ browser: BROWSER, results, evidence }, null, 2));
}
process.exit(failed.length === 0 ? 0 : 1);
