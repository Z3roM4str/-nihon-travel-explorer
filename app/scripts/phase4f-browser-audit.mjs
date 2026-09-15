import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4f-vite-"));
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

  const record = (name, detail) =>
    results.push(`  ${name.padEnd(44)}: pass${detail ? ` (${detail})` : ""}`);

  async function enterHub(hub) {
    await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
    await page.getByRole("button", { name: new RegExp(`Explorar desde ${hub}`) }).first().click();
  }

  async function openPlace(name) {
    await page.locator(".place-list__item").filter({ hasText: name }).first().click();
  }

  async function closePlace(name) {
    await page.getByRole("button", { name: new RegExp(`Cerrar la ficha de ${name}`) }).click();
  }

  async function assertAttribution({ label, credit, license, licenseHref, sourceHref, assetPath }) {
    const creditNode = page.locator(".gallery__credit");
    await creditNode.waitFor();

    const image = page.locator(".gallery__image");
    const src = await image.getAttribute("src");
    assert.equal(src, assetPath, `${label}: local asset path`);

    const sourceLink = creditNode.getByRole("link", { name: "Wikimedia Commons" });
    assert.equal(await sourceLink.getAttribute("href"), sourceHref, `${label}: source link`);

    const licenseLink = creditNode.getByRole("link", { name: license });
    assert.equal(await licenseLink.getAttribute("href"), licenseHref, `${label}: license link`);

    const visibleText = await creditNode.innerText();
    if (credit) assert.ok(visibleText.includes(credit), `${label}: missing credit ${credit}`);
    assert.match(visibleText, /Archivo de Commons: File:/);
    assert.match(visibleText, /Archivo optimizado por Nihon:/);
    assert.doesNotMatch(visibleText, /Título de atribución:/);
    return visibleText;
  }

  async function assertFallback(hub, name) {
    await page.goto(url);
    await enterHub(hub);
    await openPlace(name);
    await page.getByText("Sin fotografía disponible todavía").waitFor();
    assert.equal(await page.locator(".gallery__credit").count(), 0, `${name}: no credit`);
    assert.equal(await page.locator(".gallery__image").count(), 0, `${name}: no image`);
    await closePlace(name);
  }

  // A. Ordinary Phase 4F subject.
  await page.goto(url);
  await enterHub("Osaka");
  await openPlace("Dotonbori");
  await assertAttribution({
    label: "JP-103",
    credit: "Sakai Yayoi",
    license: "CC0",
    licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceHref: "https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_yoru.jpg",
    assetPath: "/images/places/JP-103/dotonbori-night.webp",
  });
  record("A. ordinary target renders", "JP-103 Dotonbori");
  await closePlace("Dotonbori");

  // B. Temporal-risk subject: prior-edition image must not masquerade as 2027.
  await page.goto(url);
  await enterHub("Sapporo");
  await openPlace("Otaru Snow Light Path");
  const otaruText = await assertAttribution({
    label: "JP-206",
    credit: "t-konno",
    license: "CC BY-SA 3.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceHref:
      "https://commons.wikimedia.org/wiki/File:%E5%B0%8F%E6%A8%BD%E9%9B%AA%E3%81%82%E3%81%8B%E3%82%8A%E3%81%AE%E8%B7%AF%EF%BC%88Otaru_Snow_Light_Path_Festival%EF%BC%89_-_panoramio_(2).jpg",
    assetPath: "/images/places/JP-206/otaru-snow-light-path.webp",
  });
  assert.doesNotMatch(otaruText, /2027/);
  record("B. temporal target stays factual", "JP-206 prior-edition image");
  await closePlace("Otaru Snow Light Path");

  // C. Both failed targets retain the existing fallback; no substitute image.
  await assertFallback("Tokio", "PokéPark KANTO");
  await assertFallback("Okinawa", "Yaeyama stargazing experience");
  record("C. failed targets keep fallback", "JP-050, JP-195");

  // D. No photographic provider is contacted at runtime.
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((target) => photographyHosts.test(target)),
    [],
    "photography must never be fetched at runtime"
  );
  record("D. no runtime photography fetch", `${interceptedExternal.length} external non-photo requests`);

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4F photography batch audit");
  for (const line of results) console.log(line);
  console.log("  console errors                              :", consoleErrors.length);
  console.log("  page errors                                 :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
