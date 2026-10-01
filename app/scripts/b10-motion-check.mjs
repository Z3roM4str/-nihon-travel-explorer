import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { preview } from "vite";
import { motionContractErrors } from "./lib/motion-contract.mjs";

/**
 * Gate B10.1 — auditoría de movimiento (`03 §6`, roadmap B10: «sólo los cinco movimientos nombrados;
 * `prefers-reduced-motion` verificado»).
 *
 * Los cinco movimientos nombrados (`03 §6`): `sheet-rise`, `push`, `cross-fade`, `press`, `mark`.
 * Prohibido: entradas escalonadas al scroll, transiciones de hover en todas las tarjetas, parallax, cualquier movimiento no
 * disparado por la persona salvo el skeleton de carga. Con `prefers-reduced-motion: reduce` todo ≤ 100 ms.
 *
 * Es un **gate de inventario con trinquete**: cada `@keyframes`, `transition` y `animation` de TODO el CSS de producto
 * (todos los `.css` bajo `src/`, no sólo los cuatro archivos de antes de B10.4) está clasificado abajo. Lo no clasificado falla.
 * Reconciliation: docs/design/03 §6 and 08 precedence retain only the named catalog.
 * Main's descriptive B10_MOTION_SPEC does not grant review approval; S08 now checks the
 * normative invariant, plus a mutation that reintroduces a forbidden transition.
 *
 * Uso: `npm run build && node scripts/b10-motion-check.mjs` (`NIHON_BROWSER=webkit`, `NIHON_CHROMIUM_PATH` opcionales).
 */

const BROWSER = process.env.NIHON_BROWSER === "webkit" ? "webkit" : "chromium";
const APP = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Movimientos nombrados presentes → selector. */
const NAMED = {
  "sheet-rise": ".sheet", // 1
  press: [".button", ".icon-button", ".place-card__save"], // 4 (transition transform en :active scale .98)
  mark: ".place-card__save--on .place-card__save-icon", // 5
};
/** Skeleton de carga: único movimiento no disparado por la persona permitido. */
const SKELETON = ["card-shimmer"];
// Reconciled against 03 §6: state changes outside the named catalog are instantaneous.
const DDR_KEYFRAMES = {};
const DDR_TRANSITIONS = {};

let pass = 0;
const failures = [];
async function ck(id, name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`OK   [${id}] ${name}`);
  } catch (error) {
    failures.push(`[${id}] ${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL [${id}] ${name}: ${error.message.split("\n")[0].slice(0, 300)}`);
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

// ───────────── Estático: inventario de CSS
/** Todo el CSS de producto, recursivo bajo `src/` (B10.4 movió reglas de App.css a hojas junto a sus componentes). */
function cssFiles(dir = new URL("../src/", import.meta.url), acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) cssFiles(child, acc);
    else if (e.name.endsWith(".css")) acc.push(child.href.replace(new URL("../", import.meta.url).href, "../"));
  }
  return acc;
}
const files = cssFiles();
const rules = [];
const keyframes = [];
for (const f of files) {
  const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.push(m[1]);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    for (const d of m[2].split(";")) {
      const t = d.trim().replace(/\s+/g, " ");
      if (/^(transition|animation)/.test(t)) rules.push({ file: f, selector, decl: t });
    }
  }
}
const appCss = read("../src/App.css");

await ck("S01", "@keyframes: sólo sheet-rise, mark, skeleton y los DDR registrados", async () => {
  const allowed = new Set(["sheet-rise", "place-card-save-mark", ...SKELETON, ...Object.keys(DDR_KEYFRAMES)]);
  const unknown = keyframes.filter((k) => !allowed.has(k));
  ok(unknown.length === 0, `@keyframes no clasificados: ${unknown.join(", ")}`);
  for (const k of allowed) ok(keyframes.includes(k), `@keyframes ${k} desapareció: actualiza el inventario del gate`);
});
await ck("S02", "animation: cada uso es un movimiento clasificado; sólo el skeleton es infinito", async () => {
  for (const r of rules.filter((x) => /^animation:/.test(x.decl) && !/none|0\.001ms/.test(x.decl))) {
    const name = r.decl.replace("animation:", "").trim().split(" ")[0];
    const known = ["sheet-rise", "place-card-save-mark", ...SKELETON, ...Object.keys(DDR_KEYFRAMES)];
    ok(known.includes(name), `animation no clasificada en ${r.selector}: ${r.decl}`);
    if (/infinite/.test(r.decl)) ok(SKELETON.includes(name), `animación infinita fuera del skeleton: ${r.selector}`);
  }
});
await ck("S03", "transition: sólo press, los DDR registrados y ninguna sobre :hover de tarjetas", async () => {
  const transitions = rules.filter((x) => /^transition:/.test(x.decl) && !/none/.test(x.decl));
  for (const r of transitions) {
    const sel = r.selector;
    const isPress = NAMED.press.includes(sel) && /^transition: transform var\(--dur-fast\)/.test(r.decl) || (sel === ".place-card__save" && /transform var\(--dur-fast\)/.test(r.decl));
    ok(isPress || sel in DDR_TRANSITIONS, `transition no clasificada: ${sel} → ${r.decl}`);
    ok(!/:hover/.test(sel), `transición de hover prohibida (03 §6): ${sel}`);
  }
  for (const sel of Object.keys(DDR_TRANSITIONS)) ok(transitions.some((t) => t.selector === sel), `la transición DDR ${sel} desapareció: actualiza el inventario`);
});
await ck("S04", "tarjetas de Explorar sin transición de hover (corregido en B10.1)", async () => {
  const dc = read("../src/styles/discovery.css");
  for (const cls of ["explorer-home__city-card", "explorer-home__more-card", "explorer-home__map-card"]) {
    const block = dc.slice(dc.indexOf(`\n.${cls} {`), dc.indexOf("}", dc.indexOf(`\n.${cls} {`)));
    ok(block.length > 10 && !/transition/.test(block), `.${cls} con transition`);
  }
});
await ck("S05", "valores de press y mark según 03 §6", async () => {
  const dc = read("../src/styles/discovery.css");
  ok(/\.place-card__save:active\s*\{\s*transform:\s*scale\(0\.98\)/.test(dc), "press del corazón ≠ scale(.98)");
  const k = dc.slice(dc.indexOf("@keyframes place-card-save-mark"));
  const body = k.slice(0, k.indexOf("\n}\n") + 3);
  ok(/0%\s*\{\s*transform:\s*scale\(1\)/.test(body) && /scale\(1\.18\)/.test(body) && /100%\s*\{\s*transform:\s*scale\(1\)/.test(body), "mark ≠ 1 → 1.18 → 1");
  ok(/\.button:active\s*\{\s*transform:\s*scale\(0\.98\)/.test(appCss) && /\.icon-button:active\s*\{\s*transform:\s*scale\(0\.98\)/.test(appCss), "press de .button/.icon-button ≠ scale(.98)");
  ok(/--dur-fast:\s*140ms/.test(read("../src/styles/tokens.css")) && /--dur-base:\s*220ms/.test(read("../src/styles/tokens.css")) && /--dur-sheet:\s*320ms/.test(read("../src/styles/tokens.css")), "duraciones de tokens ≠ 140/220/320");
});
await ck("S06", "regla global prefers-reduced-motion: animaciones y transiciones ≤ 100 ms, scroll-behavior auto", async () => {
  const m = /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{([^}]*)\}/.exec(appCss);
  ok(m, "falta la regla global");
  ok(/animation:\s*none !important/.test(m[1]) && /transition:\s*none !important/.test(m[1]) && /scroll-behavior:\s*auto !important/.test(m[1]), "regla global incompleta");
});
await ck("S07", "JS: todo movimiento programático respeta reduced-motion (mapa, galería)", async () => {
  const gal = read("../src/components/PlaceGallery.tsx");
  ok(/behavior:\s*reduced \? "auto" : "smooth"/.test(gal), "PlaceGallery: smooth sin guardia de reduced-motion");
  for (const f of ["PlaceMap", "NationalMap"]) {
    const src = read(`../src/components/${f}.tsx`);
    const calls = [...src.matchAll(/flyTo(?:Bounds)?\(/g)].length;
    ok(calls === 0 || /prefers-reduced-motion/.test(src), `${f}: flyTo sin guardia`);
  }
  const all = ["App.tsx", "components/OrderedSequenceBuilder.tsx", "components/PlaceDetail.tsx", "components/SearchSheet.tsx"].map((f) => read(`../src/${f}`)).join("\n");
  ok(!/behavior:\s*"smooth"/.test(all), "scroll smooth no guardado en superficies de Viaje/App/ficha");
});

await ck("S08", "03 §6: catalogue across all CSS; unknown motion mutation is rejected", async () => {
  const css = files.map(f => read(f)).join("\n");
  const errors = motionContractErrors(css);
  ok(errors.length === 0, errors.join("; "));
  ok(motionContractErrors(css + "\n.place-card { transition: opacity 1s; }").length > 0, "mutation escaped the inventory");
});

// ───────────── Navegador
const server = await preview({ root: APP, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const exe = BROWSER === "chromium" ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH;
const browser = await (BROWSER === "webkit" ? webkit : chromium).launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
console.log(`# navegador: ${BROWSER} ${browser.version()}`);

async function boot(reduced, { onboarding = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? "reduce" : "no-preference" });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    return u.startsWith(url) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  if (!onboarding) await page.addInitScript(() => { try { localStorage.setItem("nihon.onboarding.seen.v1", "1"); } catch { /* */ } });
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}
/** Animaciones CSS vivas ahora (excluye el skeleton de carga y cualquier transición de longitud 0). */
const live = (page) =>
  page.evaluate(() =>
    document.getAnimations().map((a) => {
      const t = a.effect?.getTiming?.();
      return { name: a.animationName ?? a.transitionProperty ?? "?", dur: Number(t?.duration ?? 0), iter: t?.iterations, type: a.constructor.name };
    })
  );
const city = async (page) => {
  await page.getByRole("region", { name: "Empezar a explorar" }).getByRole("button", { name: /^Tokio\b/ }).first().click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
};

for (const reduced of [false, true]) {
  const tag = reduced ? "reduced" : "normal";
  const { context, page } = await boot(reduced);
  await city(page);

  await ck(`B-${tag}-sheet`, `${tag}: la hoja de Filtros usa sheet-rise (${reduced ? "≤ 100 ms" : "320 ms"})`, async () => {
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await page.locator(".sheet").first().waitFor();
    const anims = (await live(page)).filter((a) => a.name === "sheet-rise");
    const cs = await page.locator(".sheet").first().evaluate((el) => ({ name: getComputedStyle(el).animationName, dur: parseFloat(getComputedStyle(el).animationDuration) * 1000 }));
    if (reduced) ok(cs.name === "none" && anims.length === 0, `reduced: ${cs.name}, ${anims.length} animated transforms`);
    else {
      ok(cs.name === "sheet-rise", `animationName ${cs.name}`);
      ok(anims.length >= 1, "sin animación sheet-rise viva");
      for (const a of anims) ok(Math.abs(a.dur - 320) < 1, `duración ${a.dur} ms`);
    }
    await page.keyboard.press("Escape");
    await page.locator(".sheet").first().waitFor({ state: "detached" });
  });

  await ck(`B-${tag}-mark`, `${tag}: marcar «Quiero ir» dispara sólo mark (${reduced ? "≤ 100 ms" : "220 ms"}) y un toast clasificado`, async () => {
    await page.locator(".place-card__save").first().click();
    await page.waitForTimeout(40);
    const all = await live(page);
    const mark = all.filter((a) => a.name === "place-card-save-mark");
    const cs = await page.locator(".place-card__save--on .place-card__save-icon").first().evaluate((el) => ({ name: getComputedStyle(el).animationName, dur: parseFloat(getComputedStyle(el).animationDuration) * 1000 }));
    if (reduced) ok(cs.name === "none" && mark.length === 0, `reduced: ${cs.name}, ${mark.length} animated transforms`);
    else {
      ok(cs.name === "place-card-save-mark", `animationName ${cs.name}`);
      ok(mark.length >= 1, "sin animación mark viva");
      for (const a of mark) ok(Math.abs(a.dur - 220) < 1, `mark ${a.dur} ms`);
    }
    for (const a of all) {
      if (a.name === "place-card-save-mark") continue;
      ok(["card-shimmer", "transform"].includes(a.name), `animación inesperada: ${a.name}`);
      if (reduced) ok(a.dur <= 100, `${a.name} dura ${a.dur} ms con reduced-motion`);
    }
  });

  await ck(`B-${tag}-loop`, `${tag}: ninguna animación infinita viva fuera del skeleton`, async () => {
    await page.waitForTimeout(1200);
    const loops = (await live(page)).filter((a) => a.iter === Infinity && a.name !== "card-shimmer");
    ok(loops.length === 0, `animaciones infinitas: ${JSON.stringify(loops)}`);
    if (reduced) ok((await live(page)).filter((a) => a.iter === Infinity).every((a) => a.dur <= 100), "skeleton infinito sin reducir");
  });

  await ck(`B-${tag}-gallery`, `${tag}: la galería ${reduced ? "salta sin animar (scroll instantáneo)" : "navega"}`, async () => {
    await page.setViewportSize({ width: 1200, height: 900 }); // las flechas de la galería existen en pantallas anchas
    await page.waitForTimeout(300);
    await page.locator(".place-card:has(.place-card__photo-count)").first().locator("button").first().click();
    await page.waitForSelector(".place-detail", { timeout: 15000 });
    await page.waitForTimeout(500);
    const next = page.getByRole("button", { name: "Imagen siguiente" });
    ok(await next.count(), "la ficha elegida no tiene segunda imagen: el gate no mide la galería");
    await page.evaluate(() => { window.__pos = []; });
    const track = page.locator(".gallery__track, [aria-roledescription=carousel], .place-gallery__track").first();
    const handle = (await track.count()) ? track : page.locator(`[aria-label^="Fotografías de"]`).first();
    const before = await handle.evaluate((el) => el.scrollLeft);
    await next.click();
    await page.waitForTimeout(30);
    const early = await handle.evaluate((el) => ({ left: el.scrollLeft, width: el.clientWidth }));
    if (reduced) ok(Math.abs(early.left - early.width) <= 2, `scroll no instantáneo: ${before} → ${early.left}/${early.width}`);
  });
  await context.close();
}

await ck("B-onboarding", "onboarding: state change is instantaneous in normal and reduced motion", async () => {
  for (const reduced of [false, true]) {
    const { context, page } = await boot(reduced, { onboarding: true });
    const cs = await page.locator(".onboarding").first().evaluate((el) => ({ name: getComputedStyle(el).animationName, dur: parseFloat(getComputedStyle(el).animationDuration) * 1000 }));
    ok(cs.name === "none", `onboarding: ${cs.name}`);
    await context.close();
  }
});

await browser.close();
await server.close();
console.log(`\n${pass} OK · ${failures.length} FAIL`);
if (failures.length) {
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
