import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), "nihon-phase4l-vite-"));
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

  async function enterHub(hub) {
    const prefectureEntry = { Sapporo: "Hokkaido", Nagoya: "Aichi" }[hub] ?? hub;
    await page.getByRole("button", { name: new RegExp(`^${prefectureEntry}`) }).first().click();
    await page.getByRole("button", { name: new RegExp(`Explorar desde ${hub}`) }).first().click();
  }

  async function openPlace(name) {
    await page.locator(".place-list__item").filter({ hasText: name }).first().click();
  }

  async function assertAttribution({ label, credit, license, licenseHref, sourceHref, assetPath }) {
    const creditNode = page.locator(".gallery__credit");
    await creditNode.waitFor();
    const image = page.locator(".gallery__image");
    assert.equal(await image.getAttribute("src"), assetPath, `${label}: local asset path`);
    const sourceLink = creditNode.getByRole("link", { name: "Wikimedia Commons" });
    assert.equal(await sourceLink.getAttribute("href"), sourceHref, `${label}: source link`);
    const licenseLink = creditNode.getByRole("link", { name: license });
    assert.equal(await licenseLink.getAttribute("href"), licenseHref, `${label}: license link`);
    const visibleText = await creditNode.innerText();
    if (credit) assert.ok(visibleText.includes(credit), `${label}: missing credit ${credit}`);
    assert.match(visibleText, /Archivo de Commons: File:/);
    assert.match(visibleText, /Archivo optimizado por Nihon:/);
    assert.doesNotMatch(visibleText, /T\u00edtulo de atribuci\u00f3n:/);
    const naturalOk = await image.evaluate((el) => el.complete && el.naturalWidth > 0);
    assert.equal(naturalOk, true, `${label}: local image must actually load`);
    return visibleText;
  }

  async function assertFallback(hub, name, label) {
    await page.goto(url);
    await enterHub(hub);
    await openPlace(name);
    await page.getByText("Sin fotograf\u00eda disponible todav\u00eda").waitFor();
    assert.equal(await page.locator(".gallery__credit").count(), 0, `${label}: no credit`);
    assert.equal(await page.locator(".gallery__image").count(), 0, `${label}: no image`);
  }

  // 1. Newly photographed A-grade place.
  await page.goto(url);
  await enterHub("Kioto");
  await openPlace("Shisen-d\u014d");
  await assertAttribution({
    label: "JP-084",
    credit: "\u304f\u308d\u3075\u306d",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref: "https://commons.wikimedia.org/wiki/File:%E8%A9%A9%E4%BB%99%E5%A0%82_02.jpg",
    assetPath: "/images/places/JP-084/shisen-do.webp",
  });
  record("1. new A-grade target renders", "JP-084 Shisen-do");

  // 2. Newly photographed B-grade place.
  await page.goto(url);
  await enterHub("Tokio");
  await openPlace("Kabukicho");
  await assertAttribution({
    label: "JP-012",
    credit: "Basile Morin",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceHref:
      "https://commons.wikimedia.org/wiki/File:Colorful_neon_street_signs_in_Kabukich%C5%8D,_Shinjuku,_Tokyo.jpg",
    assetPath: "/images/places/JP-012/kabukicho.webp",
  });
  record("2. new B-grade target renders", "JP-012 Kabukicho");

  // 3. Temporal-risk target: prior-edition imagery, never a 2027 claim.
  await page.goto(url);
  await enterHub("Tokio");
  await openPlace("Tokyo Marathon");
  const temporalText = await assertAttribution({
    label: "JP-213",
    credit: "nakashi from Chofu, Tokyo, JAPAN",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0",
    sourceHref:
      "https://commons.wikimedia.org/wiki/File:Tokyo_Marathon_2019_Runner_(46348789105).jpg",
    assetPath: "/images/places/JP-213/tokyo-marathon.webp",
  });
  assert.doesNotMatch(temporalText, /2027/);
  const temporalAlt = await page.locator(".gallery__image").getAttribute("alt");
  assert.doesNotMatch(temporalAlt ?? "", /2027/, "JP-213: alt must not claim the 2027 edition");
  record("3. temporal target stays factual", "JP-213 prior-edition image");

  // 4. The single Phase 4L failure keeps its fallback.
  await assertFallback("Osaka", "Mount Rokko night view", "JP-140");
  record("4. failed target keeps fallback", "JP-140");

  // 5. Historical photographed place still renders (Phase 4J regression).
  await page.goto(url);
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
  record("5. historical target still renders", "JP-013 Golden Gai");

  // 6. Historical no-photo fallback (carried fail-closed) is untouched.
  await assertFallback("Tokio", "Pok\u00e9Park KANTO", "JP-050");
  record("6. historical fallback intact", "JP-050 PokePark KANTO");

  // 7/8. Photography providers are attribution links only, never runtime fetches.
  const photographyHosts = /wikimedia\.org|wikipedia\.org|creativecommons\.org/i;
  assert.deepEqual(
    interceptedExternal.filter((target) => photographyHosts.test(target)),
    [],
    "photography must never be fetched at runtime"
  );
  record("7. no runtime photography fetch", `${interceptedExternal.length} external non-photo requests`);
  record("8. local images load", "verified via naturalWidth on every asserted image");

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log("PASS Phase 4L photography batch audit");
  for (const line of results) console.log(line);
  console.log("  console errors                                :", consoleErrors.length);
  console.log("  page errors                                   :", pageErrors.length);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
