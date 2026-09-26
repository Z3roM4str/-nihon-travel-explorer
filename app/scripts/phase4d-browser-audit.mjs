import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  closeCredits,
  closePlace as shellClosePlace,
  creditsButtonCount,
  dismissOnboarding,
  enterHub as shellEnterHub,
  openCredits,
  openPlace as shellOpenPlace,
} from "./lib/shell-navigation.mjs";

/**
 * Phase 4D — browser acceptance for the S-grade photography acquisition batch.
 *
 * Covers the three cases Issue #97 requires: an ordinary heritage subject, the one
 * branded/copyright-sensitive subject that passed sourcing, and an unchanged no-photo
 * fallback for a target that failed closed.
 *
 * Hermetic by construction, as Phase 4C established: every non-localhost request is
 * answered locally with a 1x1 PNG so the pre-existing OpenStreetMap map tiles cannot make
 * the console-error assertion depend on the machine having internet. Aborting instead
 * would itself log `net::ERR_FAILED`, which would quietly weaken that assertion.
 */
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4d-vite-"));
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
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const interceptedExternal = [];
  await page.route("**/*", (route) => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith("data:") || target.startsWith("blob:")) {
      return route.continue();
    }
    interceptedExternal.push(target);
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });

  await dismissOnboarding(page, url);

  const record = (name, detail) => results.push(`  ${name.padEnd(42)}: pass${detail ? ` (${detail})` : ""}`);

  /*
   * Navegación al shell vigente (B18/B19/B20), compartida en `lib/shell-navigation.mjs`. El
   * camino «prefectura → Explorar desde X» y la lista `.place-list__item` desaparecieron con
   * `05 §2` y `04 §12`; el `×` de la ficha, con el defecto D4 de `05 §5`. Lo que esta auditoría
   * mide —asset local, atribución completa, cero afirmaciones de licencia— es idéntico.
   */
  let currentHub = null;

  async function enterHub(hub) {
    currentHub = hub;
    await shellEnterHub(page, hub);
  }

  async function openPlace(name) {
    await shellOpenPlace(page, name, currentHub);
  }

  async function closePlace() {
    await shellClosePlace(page);
  }

  /** Every acquired record must serve locally and credit its own Commons file and license. */
  async function assertAttribution({ label, credit, license, licenseHref, sourceHref }) {
    // Bloque 20 (B4, `04 §7`): la atribución sale del flujo de lectura —defecto D2— y vive en
    // `CreditsSheet`, tras el botón `ⓘ` de la galería. El requisito de esta fase no cambia (los
    // mismos campos, los mismos enlaces, la misma ausencia de afirmaciones legales); sólo cambia
    // dónde se lee. La hoja se cierra al terminar para no dejarla sobre el resto del recorrido.
    const credit_ = await openCredits(page);

    const image = page.locator(".gallery__image");
    const src = await image.getAttribute("src");
    assert.ok(src.startsWith("/images/places/"), `${label}: image must be local, got ${src}`);

    const sourceLink = credit_.getByRole("link", { name: "Wikimedia Commons" });
    assert.equal(await sourceLink.getAttribute("href"), sourceHref, `${label}: source link`);

    const licenseLink = credit_.getByRole("link", { name: license });
    assert.equal(await licenseLink.getAttribute("href"), licenseHref, `${label}: license link`);
    assert.notEqual(sourceHref, licenseHref, `${label}: source and license links must differ`);

    const text = await credit_.innerText();
    assert.match(text, new RegExp(credit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label}: credit`);
    assert.match(text, /Archivo de Commons\s*File:/, `${label}: Commons provenance`);
    assert.match(text, /Archivo optimizado por Nihon:/, `${label}: processing disclosure`);
    // Phase 4D invented no attribution titles, so none may appear for these records.
    assert.doesNotMatch(text, /Título de atribución/, `${label}: no invented attribution title`);
    await closeCredits(page);
    return src;
  }

  // ── A. ordinary heritage subject ──
  await enterHub("Kioto");
  await openPlace("Fushimi Inari Taisha");
  const inariSrc = await assertAttribution({
    label: "JP-066",
    credit: "Hyppolyte de Saint-Rambert",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Fushimi_Inari_Taisha_tunnel_droit.jpg",
  });
  assert.equal(inariSrc, "/images/places/JP-066/senbon-torii-path.webp");
  record("A. heritage subject renders", "JP-066 Fushimi Inari, local asset");
  await closePlace();

  // ── B. branded / copyright-sensitive subject that passed sourcing ──
  await dismissOnboarding(page, url);
  await enterHub("Tokio");
  await openPlace("Ghibli Museum, Mitaka");
  const ghibliSrc = await assertAttribution({
    label: "JP-044",
    credit: "Olivier Lejade",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Ghibli_Museum_06.jpg",
  });
  assert.equal(ghibliSrc, "/images/places/JP-044/ghibli-museum-exterior.webp");
  record("B. branded subject renders", "JP-044 Ghibli Museum exterior");

  // The gallery must claim no legal clearance anywhere on the branded record.
  const ghibliText = await (await openCredits(page)).innerText();
  await closeCredits(page);
  for (const forbidden of [/libre de derechos/i, /uso comercial/i, /sin restricciones/i, /autorizado por/i]) {
    assert.doesNotMatch(ghibliText, forbidden, "branded record must not claim clearance");
  }
  record("C. no legal-clearance claim", "branded record");
  await closePlace();

  // ── D. uncovered places still keep the no-photo fallback after B6.1 ──
  // The original two targets gained licensed photographs in B6.1.
  for (const deferred of ["Takeshita Street", "Nezu Shrine"]) {
    await openPlace(deferred);
    await page.getByText("Sin fotografía disponible todavía").waitFor();
    assert.equal(await creditsButtonCount(page), 0, `${deferred} must show no credit`);
    assert.equal(await page.locator(".gallery__image").count(), 0, `${deferred} must show no image`);
    await closePlace();
  }
  record("D. uncovered targets keep fallback", "Takeshita Street, Nezu Shrine");

  // ── E. nothing about photography is fetched at runtime ──
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((t) => photographyHosts.test(t)),
    [],
    "photography must never be fetched at runtime"
  );
  record("E. no runtime photography fetch", `${interceptedExternal.length} external requests, none photographic`);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4D photography batch audit");
  for (const line of results) console.log(line);
  console.log("  console errors                            :", consoleErrors.length);
  console.log("  page errors                               :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
