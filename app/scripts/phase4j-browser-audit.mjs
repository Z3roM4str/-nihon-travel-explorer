import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  dismissOnboarding,
  enterHub as shellEnterHub,
  openPlace as shellOpenPlace,
} from "./lib/shell-navigation.mjs";


const appRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4j-vite-"));
const server = await createServer({
  root: appRoot,
  cacheDir,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});

const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64"
);

let browser;
const results = [];
try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  assert.ok(url, "Vite did not expose a local URL");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  const interceptedExternal = [];
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith("data:") || target.startsWith("blob:")) {
      return route.continue();
    }
    interceptedExternal.push(target);
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });

  const record = (name, detail) =>
    results.push(`  ${name.padEnd(46)}: pass${detail ? ` (${detail})` : ""}`);

  /*
   * Navegación al shell vigente (B18/B19/B20). El camino «prefectura → Explorar desde X» y la
   * lista `.place-list__item` que esta fase usaba dejaron de existir: `05 §2` puso los atajos de
   * ciudad en la portada y `04 §12` llevó la búsqueda a su propia hoja. Lo que esta auditoría
   * MIDE no cambia ni una coma; sólo cambia cómo se llega. Camino compartido por las seis
   * auditorías de fotografía en `scripts/lib/shell-navigation.mjs`, para que la próxima vez que
   * el shell se mueva haya un solo sitio que tocar.
   */
  let currentHub = null;

  async function enterHub(hub) {
    currentHub = hub;
    await shellEnterHub(page, hub);
  }

  async function openPlace(name) {
    await shellOpenPlace(page, name, currentHub);
  }

  async function assertAttribution({ label, credit, license, licenseHref, sourceHref, assetPath }) {
    // Bloque 20 (B4, `04 §7`): la atribución sale del flujo de lectura —defecto D2— y vive en
    // `CreditsSheet`, tras el botón `ⓘ` de la galería. El requisito de esta fase no cambia (los
    // mismos campos, los mismos enlaces, la misma ausencia de afirmaciones legales); sólo cambia
    // dónde se lee. La hoja se cierra al terminar para no dejarla sobre el resto del recorrido.
    await page.locator(".gallery__credits").click();
    const creditNode = page.locator(".credits-sheet__list");
    await creditNode.waitFor();

    const image = page.locator(".gallery__image");
    assert.equal(await image.getAttribute("src"), assetPath, `${label}: local asset path`);

    const sourceLink = creditNode.getByRole("link", { name: "Wikimedia Commons" });
    assert.equal(await sourceLink.getAttribute("href"), sourceHref, `${label}: source link`);

    const licenseLink = creditNode.getByRole("link", { name: license });
    assert.equal(await licenseLink.getAttribute("href"), licenseHref, `${label}: license link`);

    const visibleText = await creditNode.innerText();
    if (credit) assert.ok(visibleText.includes(credit), `${label}: missing credit ${credit}`);
    assert.match(visibleText, /Archivo de Commons\s*File:/);
    assert.match(visibleText, /Archivo optimizado por Nihon:/);
    assert.doesNotMatch(visibleText, /T\u00edtulo de atribuci\u00f3n:/);
    await page.keyboard.press("Escape");
    return visibleText;
  }

  async function assertFallback(hub, name) {
    await dismissOnboarding(page, url);
    await enterHub(hub);
    await openPlace(name);
    await page.getByText("Sin fotograf\u00eda disponible todav\u00eda").waitFor();
    assert.equal(await page.locator(".gallery__credits").count(), 0, `${name}: no credit`);
    assert.equal(await page.locator(".gallery__image").count(), 0, `${name}: no image`);
  }

  // A. Ordinary acquired A-grade subject.
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("Golden Gai");
  await assertAttribution({
    label: "JP-013",
    credit: "Dick Thomas Johnson from Tokyo, Japan",
    license: "CC BY 2.0",
    licenseHref: "https://creativecommons.org/licenses/by/2.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Shinjuku_Golden_Gai_(53147651689).jpg",
    assetPath: "/images/places/JP-013/golden-gai.webp",
  });
  record("A. ordinary A-grade target renders", "JP-013 Golden Gai");

  // B. Acquired B-grade subject: Phase 4J is the first batch to cover B grade at all.
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("Ameyoko");
  await assertAttribution({
    label: "JP-022",
    credit: "AugustGresh",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Ameya-Yokoch%C5%8D_Entrance.jpg",
    assetPath: "/images/places/JP-022/ameyoko.webp",
  });
  record("B. B-grade target renders", "JP-022 Ameyoko");

  // C. Fukuoka's first photograph in the whole registry.
  await dismissOnboarding(page, url);
  await enterHub("Fukuoka");
  await openPlace("Yanagawa canal cruise");
  await assertAttribution({
    label: "JP-214",
    credit: "Asturio Cantabrio",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Yanagawa_cruise_ac_(7).jpg",
    assetPath: "/images/places/JP-214/yanagawa-canal-cruise.webp",
  });
  record("C. Fukuoka target renders", "JP-214 Yanagawa canal cruise");

  // D. Branded/sensitive subject resolved through an exterior/signage frame.
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("SMALL WORLDS Miniature Museum");
  await assertAttribution({
    label: "JP-043",
    credit: "Mizushimasea",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Small_Worlds_Tokyo_Koto-ku_Tokyo.jpg",
    assetPath: "/images/places/JP-043/small-worlds-miniature-museum.webp",
  });
  record("D. branded target stays factual", "JP-043 SMALL WORLDS exterior");

  // E. Temporal subject uses prior-edition imagery without a 2027 claim.
  await dismissOnboarding(page, url);
  await enterHub("Osaka");
  await openPlace("Grand Sumo Tournament Osaka");
  const temporalText = await assertAttribution({
    label: "JP-212",
    credit: "Richard Giles from Perth, Australia",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Sumo_-Osaka_2010_03_23_a.jpg",
    assetPath: "/images/places/JP-212/grand-sumo-tournament-osaka.webp",
  });
  assert.doesNotMatch(temporalText, /2027/);
  const temporalAlt = await page.locator(".gallery__image").getAttribute("alt");
  assert.doesNotMatch(temporalAlt ?? "", /2027/, "JP-212: alt must not claim the 2027 edition");
  record("E. temporal target stays factual", "JP-212 prior-edition image");

  // F. Phase 4J failures retain the existing fallback.
  await assertFallback("Osaka", "teamLab Botanical Garden Osaka");
  record("F. failed target keeps fallback", "JP-120");

  // G. Photography providers are attribution links only, never runtime fetches.
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((target) => photographyHosts.test(target)),
    [],
    "photography must never be fetched at runtime"
  );
  record("G. no runtime photography fetch", `${interceptedExternal.length} external non-photo requests`);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4J photography batch audit");
  for (const line of results) console.log(line);
  console.log("  console errors                                :", consoleErrors.length);
  console.log("  page errors                                   :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
