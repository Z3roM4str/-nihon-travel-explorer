// P-06 v2 — `overflow-x: hidden` en el cuerpo de las vistas enfocadas no debe recortar controles, texto necesario ni indicadores de foco.
// Por cada vista (Herramientas del viaje, Detalles del Día 1, Cambiar orden) y viewport certificado:
//   1) todo elemento visible cae dentro del cuerpo (±1 px) en horizontal;
//   2) ningún texto «de lectura» (p, li, h1–h6, label, strong, span sin hijos) queda recortado por un ancestro con overflow oculto;
//   3) recorriendo con Tab, el anillo de foco (rect + outline-width + outline-offset) de CADA control cabe en el cuerpo.
// Uso: node scripts/p06-v2-clip-check.mjs   (NIHON_BROWSER=webkit para WebKit)
import { launch, newPage, tripFixture, makeChecker } from "./lib/modern-trip.mjs";

const { check, summary } = makeChecker("P-06 v2 recorte");
const VIEWPORTS = [[320, 568], [360, 740], [375, 667], [390, 844], [430, 932], [820, 1180], [1280, 800], [1440, 900]];
const env = await launch();
try {
  for (const [width, height] of VIEWPORTS) {
    const fixture = tripFixture();
    const { page, context, errors, pageErrors } = await newPage(env.browser, { width, height, dpr: 1 }, { fixture });
    await page.goto(env.url);
    await page.getByRole("button", { name: "Viaje", exact: true }).click();
    const root = page.locator(".destination-panel:not([hidden])");
    await root.locator(".day-card[data-day-id]").first().waitFor();
    const views = [
      ["Herramientas", () => root.getByRole("button", { name: "Herramientas del viaje" })],
      ["Detalles", () => root.locator(".day-card").first().getByRole("button", { name: "Detalles del Día 1" })],
      ["Orden", () => root.locator(".day-card").first().getByRole("button", { name: "Cambiar orden del Día 1" })],
    ];
    for (const [name, trigger] of views) {
      await trigger().click();
      await page.locator(".focused-view").waitFor();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      const tag = `${width}×${height} · ${name}`;
      // Autoprueba: P06_CLIP_NEGATIVE=1 inyecta un anillo de foco enorme; el gate DEBE fallar (demuestra que no es vacuo).
      if (process.env.P06_CLIP_NEGATIVE) await page.addStyleTag({ content: ".focused-view__body :focus-visible{outline:3px solid red!important;outline-offset:40px!important}" });
      // 1 + 2
      const geo = await page.evaluate(() => {
        const body = document.querySelector(".focused-view__body");
        const b = body.getBoundingClientRect();
        const left = b.left, right = b.left + body.clientWidth;
        const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
        const outside = [], clipped = [];
        for (const el of body.querySelectorAll("*")) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.left < left - 1 || r.right > right + 1) outside.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} [${Math.round(r.left)},${Math.round(r.right)}] body=[${Math.round(left)},${Math.round(right)}]`);
          // Texto de lectura recortado: el propio elemento (no un <select>/<input>, que truncan por diseño) con overflow oculto y contenido más ancho.
          if (!/^(SELECT|INPUT|OPTION|SVG|PATH)$/i.test(el.tagName) && el.childElementCount === 0 && el.textContent.trim().length > 0) {
            const s = getComputedStyle(el);
            if (["hidden", "clip"].includes(s.overflowX) && el.scrollWidth > el.clientWidth + 1) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} sw=${el.scrollWidth} cw=${el.clientWidth}`);
          }
        }
        return { outside: outside.slice(0, 5), clipped: clipped.slice(0, 5), overflowX: getComputedStyle(body).overflowX };
      });
      check(`${tag}: ningún elemento visible fuera del cuerpo`, geo.outside.length === 0, geo.outside.join(" | "));
      check(`${tag}: ningún texto de lectura recortado`, geo.clipped.length === 0, geo.clipped.join(" | "));
      // 3 — anillos de foco
      const ring = [];
      let steps = 0, seen = new Set(), withoutRing = [];
      await page.keyboard.press("Tab");
      for (; steps < 80; steps += 1) {
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          const body = document.querySelector(".focused-view__body");
          if (!el || !body || !body.contains(el)) return { done: true };
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const w = parseFloat(s.outlineWidth) || 0, off = parseFloat(s.outlineOffset) || 0;
          const grow = s.outlineStyle === "none" ? 0 : w + Math.max(off, 0);
          const b = body.getBoundingClientRect();
          return {
            key: `${el.tagName}|${el.id}|${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30)}|${Math.round(r.top)}`,
            label: `${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30)}`,
            hasRing: s.outlineStyle !== "none" && w > 0 || (s.boxShadow && s.boxShadow !== "none"),
            fits: r.left - grow >= b.left - 1 && r.right + grow <= b.left + body.clientWidth + 1,
          };
        });
        if (info.done) break;
        if (seen.has(info.key)) break;
        seen.add(info.key);
        if (!info.fits) ring.push(info.label);
        if (!info.hasRing) withoutRing.push(info.label);
        await page.keyboard.press("Tab");
      }
      check(`${tag}: el anillo de foco de los ${seen.size} controles cabe en el cuerpo`, ring.length === 0, ring.slice(0, 5).join(" | "));
      check(`${tag}: todos los controles muestran indicador de foco`, withoutRing.length === 0, withoutRing.slice(0, 5).join(" | "));
      await page.keyboard.press("Escape");
      await page.locator(".focused-view").waitFor({ state: "detached" });
    }
    check(`${width}×${height}: sin errores de consola`, errors.length === 0 && pageErrors.length === 0, [...errors, ...pageErrors].join(" | "));
    await context.close();
  }
} finally {
  await env.close();
}
process.exit(summary());
