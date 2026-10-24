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
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4h-vite-"));
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
    assert.doesNotMatch(visibleText, /Título de atribución/);
    await page.keyboard.press("Escape");
    return visibleText;
  }

  async function assertFallback(hub, name) {
    await dismissOnboarding(page, url);
    await enterHub(hub);
    await openPlace(name);
    await page.getByText("Sin fotografía disponible todavía").waitFor();
    assert.equal(await page.locator(".gallery__credits").count(), 0, `${name}: no credit`);
    assert.equal(await page.locator(".gallery__image").count(), 0, `${name}: no image`);
  }

  // A. Ordinary subject.
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("Jimbocho Book Town");
  await assertAttribution({
    label: "JP-028",
    credit: "Nick-D",
    license: "CC BY-SA 3.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceHref:
      "https://commons.wikimedia.org/wiki/File:Books_along_a_walkway_in_the_Kanda-Jimbocho_area_of_Tokyo.JPG",
    assetPath: "/images/places/JP-028/jimbocho-book-town.webp",
  });
  record("A. ordinary target renders", "JP-028 Jimbocho");

  // B. Branded/sensitive subject.
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("Shibuya PARCO + Nintendo TOKYO");
  await assertAttribution({
    label: "JP-008",
    credit: "Dick Thomas Johnson from Tokyo, Japan",
    license: "CC BY 2.0",
    licenseHref: "https://creativecommons.org/licenses/by/2.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Nintendo_TOKYO_(52505969791).jpg",
    assetPath: "/images/places/JP-008/nintendo-tokyo-shibuya-parco.webp",
  });
  record("B. branded target stays factual", "JP-008 Nintendo TOKYO");

  // C. Temporal subject uses prior-edition imagery without a 2027 claim.
  await dismissOnboarding(page, url);
  await enterHub("Sapporo");
  await openPlace("Lake Shikotsu Ice Festival");
  const temporalText = await assertAttribution({
    label: "JP-207",
    credit: "t-konno",
    license: "CC BY-SA 3.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceHref:
      "https://commons.wikimedia.org/wiki/File:%E5%8D%83%E6%AD%B3%E3%83%BB%E6%94%AF%E7%AC%8F%E6%B9%96%E6%B0%B7%E6%BF%A4%E3%81%BE%E3%81%A4%E3%82%8A2015%EF%BC%88Lake_Shikotsu_Ice_Festival_2015%EF%BC%89_-_panoramio_(4).jpg",
    assetPath: "/images/places/JP-207/lake-shikotsu-ice-festival.webp",
  });
  assert.doesNotMatch(temporalText, /2027/);
  record("C. temporal target stays factual", "JP-207 prior-edition image");

  // D. One Phase 4H failure retains the fallback.
  await assertFallback("Osaka", "Expo ’70 Park + Tower of the Sun");
  record("D. failed target keeps fallback", "JP-121");

  // E. Photography providers are attribution links only, never runtime fetches.
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((target) => photographyHosts.test(target)),
    [],
    "photography must never be fetched at runtime"
  );
  record("E. no runtime photography fetch", `${interceptedExternal.length} external non-photo requests`);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4H photography batch audit");
  for (const line of results) console.log(line);
  console.log("  console errors                                :", consoleErrors.length);
  console.log("  page errors                                   :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
