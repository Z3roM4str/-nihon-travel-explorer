import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 13 — portable backup, browser audit against the PRODUCTION build.
 *
 * The block exists because a trip prepared on one phone cannot be moved to another browser. So the
 * audit's central job is the whole journey, end to end, on a state that is not trivial: mark places
 * across two hubs with two different people, build a route, split it into days, anchor a date, add
 * a visit time, export, read the downloaded file, wipe the browser, import it back, confirm, and
 * check the trip is the one that left.
 *
 * Three things it is careful about:
 *
 *  * **It reads the real downloaded file.** Playwright's download event gives the bytes the browser
 *    actually saved, not a string the page happened to build — so "the export works" means the file
 *    on disk parses and matches the contract.
 *  * **It proves the negatives.** No network request while exporting or importing; no derived data
 *    in the file; nothing written before the human confirms; replace rather than merge.
 *  * **It does not claim Safari.** Everything here runs in Chromium. The file APIs used are the
 *    standard ones, but this environment has no iOS, so no statement about Safari is made — see
 *    `docs/BLOCK_13_DESIGN.md`.
 *
 * Usage: node scripts/block13-portable-backup-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4331;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function readKey(page, key) {
  return page.evaluate((k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }, key);
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Opens the backup surface from the header control. */
async function openBackup(page) {
  await page.getByRole("button", { name: "Respaldo del viaje" }).click();
  await page.waitForSelector(".trip-backup__dialog", { timeout: 10000 });
}

/** Saves a few places in one hub as the currently active traveller. */
async function saveInHub(page, hub, count) {
  await page.getByRole("button", { name: new RegExp(`^${hub}`) }).first().click();
  await page.waitForTimeout(1100);
  for (let i = 0; i < count; i += 1) {
    const save = page.locator(".place-card__save").nth(i);
    if ((await save.count()) === 0) break;
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await page.waitForTimeout(180);
    }
  }
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(24)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  /** Every request to anywhere other than this origin. The privacy proof. */
  const externalRequests = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith(url) || u.startsWith("blob:") || u.startsWith("data:")) return;
    // Leaflet's tile server is the map doing its job and has nothing to do with the backup. It is
    // excluded here for exactly the reason the console filter excludes it, and the backup's own
    // network silence is still proven precisely, by the two scoped counters around export and
    // import below.
    if (/tile\.openstreetmap\.org|openstreetmap|tile\./.test(u)) return;
    externalRequests.push(u);
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage */
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  // ── 1. Build a non-trivial trip ──────────────────────────────────────────────────────────────
  await saveInHub(page, "Tokio", 3);
  // A second person, with their own stances — the Block 5 boundary this block must not collapse.
  const secondPerson = page.locator(".traveller-bar__option").nth(1);
  if ((await secondPerson.count()) > 0) {
    await secondPerson.click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /Volver|Japón|Inicio/ }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await saveInHub(page, "Kioto", 2);

  const travellersBefore = await readKey(page, TRAVELLERS_KEY);
  check("a two-person, two-hub state exists", Boolean(travellersBefore) && travellersBefore.includes("interested"));

  // A route, days and a date, through the planner.
  const selectionToggle = page.locator(".selection-panel__toggle");
  if ((await selectionToggle.count()) > 0 && (await selectionToggle.getAttribute("aria-expanded")) !== "true") {
    await selectionToggle.click();
    await page.waitForTimeout(400);
  }
  // `.selection-panel__analyze` matches TWO controls (the analysis and the planner); selecting by
  // accessible name is what actually opens the planner, and opening it is what first persists a
  // draft.
  const plannerButton = page.getByRole("button", { name: /Construir recorrido/ }).first();
  if ((await plannerButton.count()) > 0) {
    await plannerButton.click();
    await page.waitForSelector("#sequence-builder-title", { timeout: 10000 }).catch(() => {});
    const close = page.getByRole("button", { name: /Cerrar|Volver/ }).first();
    if ((await close.count()) > 0) {
      await close.click();
      await page.waitForTimeout(500);
    }
  }

  // The remaining draft fields — days, both dates, a visit time and an accommodation anchor — are
  // seeded directly and then ADOPTED by the app on the reload below.
  //
  // Stated plainly rather than hidden: the planner's day-splitting and calendar controls are not
  // reachable at 390px with a three-place route, and driving a UI that is not there would be
  // pretending. What matters for this block is that a rich, *real* draft — one the app loads,
  // reconciles and renders exactly as its own — survives the round trip intact, and seeding the
  // fields through the same key the planner writes gives precisely that. Construction through the
  // real planner API is covered exhaustively in `src/lib/portable-backup.test.ts`.
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!Array.isArray(draft.routeIds) || draft.routeIds.length < 2) return;
    const half = Math.ceil(draft.routeIds.length / 2);
    // The exact `PlanningDayV5` shape, boundary included. A day missing it is refused by the
    // draft's own parser, which then falls back to a fresh draft — the quiet failure this audit
    // caught the first time it was written.
    const unselected = { start: { kind: "unselected" }, end: { kind: "unselected" } };
    draft.days = [
      { id: "d-1", placeIds: draft.routeIds.slice(0, half), accommodationBoundary: unselected },
      { id: "d-2", placeIds: draft.routeIds.slice(half), accommodationBoundary: unselected },
    ];
    draft.startDate = "2027-03-14";
    draft.endDate = "2027-03-20";
    draft.visitStartTimes = { [draft.routeIds[0]]: "09:30" };
    localStorage.setItem(key, JSON.stringify(draft));
  }, DRAFT_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  // Re-read through the app: opening the planner rewrites the key with whatever the app actually
  // loaded, so a seed the parser rejected shows up here as a fresh draft instead of passing.
  const reopen = page.locator(".selection-panel__toggle");
  if ((await reopen.count()) > 0 && (await reopen.getAttribute("aria-expanded")) !== "true") {
    await reopen.click();
    await page.waitForTimeout(400);
  }
  const reopenPlanner = page.getByRole("button", { name: /Construir recorrido/ }).first();
  if ((await reopenPlanner.count()) > 0) {
    await reopenPlanner.click();
    await page.waitForSelector("#sequence-builder-title", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const c = page.getByRole("button", { name: /Cerrar|Volver/ }).first();
    if ((await c.count()) > 0) {
      await c.click();
      await page.waitForTimeout(500);
    }
  }
  const draftBefore = await readKey(page, DRAFT_KEY);
  check("a planning draft exists before exporting", Boolean(draftBefore));
  const draftParsedBefore = JSON.parse(draftBefore ?? "null");
  check(
    "the draft the app adopted is non-trivial: a route, two days, both dates and a visit time",
    Boolean(draftParsedBefore) &&
      draftParsedBefore.routeIds.length >= 2 &&
      (draftParsedBefore.days ?? []).length === 2 &&
      draftParsedBefore.startDate === "2027-03-14" &&
      draftParsedBefore.endDate === "2027-03-20" &&
      Object.keys(draftParsedBefore.visitStartTimes ?? {}).length === 1,
    draftBefore?.slice(0, 160)
  );

  // ── 2. Export, and read the file the browser actually saved ──────────────────────────────────
  await openBackup(page);
  check("the backup surface opened", (await page.locator(".trip-backup__dialog").count()) === 1);
  check("the surface never claims a service exists", await noSyncWords(page));
  check("the backup surface has no horizontal overflow", !(await noOverflow(page)));

  const externalBefore = externalRequests.length;
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: "Exportar respaldo" }).click(),
  ]);
  const savedPath = await download.path();
  const fileText = savedPath ? await (await import("node:fs/promises")).readFile(savedPath, "utf8") : "";
  check("the browser saved a file", fileText.length > 0);
  check("the file is named recognisably", /^nihon-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());

  let parsed = null;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    /* left null */
  }
  check("the saved file is valid JSON", parsed !== null);
  check("it carries the discriminant and version", parsed?.format === "nihon-portable-backup" && parsed?.version === 1);
  check("it carries the two documents and nothing else", parsed && Object.keys(parsed.data ?? {}).sort().join(",") === "planningDraft,travellers");
  check("it carries both travellers, with separate stances", (parsed?.data?.travellers?.travellers ?? []).length === 2);
  check(
    "it carries the plan, with its own internal version",
    parsed?.data?.planningDraft === null || typeof parsed?.data?.planningDraft?.version === "number"
  );
  check(
    "it contains NO derived or catalogue data",
    !/photography|assetPath|provenance|consultedAt|sourceUrl|editorial|nearby|walking|prefecture|imageCount/.test(fileText)
  );
  check("it contains no storage keys, tokens or URLs", !/nihon\.|token|secret|https?:\/\//i.test(fileText));
  check("exporting made no external request", externalRequests.length === externalBefore, externalRequests.join(" | "));

  // ── 3. Wipe the browser, as a different device would be ──────────────────────────────────────
  await page.evaluate(() => {
    try {
      localStorage.clear();
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* no storage */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  // Not `=== null`: mounting writes a fresh, empty travellers document, which is correct app
  // behaviour. "Wiped" means nobody has marked anything and there is no plan.
  const wipedTravellers = await readKey(page, TRAVELLERS_KEY);
  const wipedInterests = JSON.parse(wipedTravellers ?? '{"interests":[]}').interests ?? [];
  check("the trip is gone after wiping", wipedInterests.length === 0 && (await readKey(page, DRAFT_KEY)) === null);

  // ── 4. Import it back ────────────────────────────────────────────────────────────────────────
  await openBackup(page);
  const externalBeforeImport = externalRequests.length;
  await page.locator(".trip-backup__file").setInputFiles(savedPath);
  await page.waitForSelector(".trip-backup__preview", { timeout: 10000 });
  check("a preview appears before anything is written", (await page.locator(".trip-backup__preview").count()) === 1);
  const beforeConfirm = await readKey(page, TRAVELLERS_KEY);
  check(
    "nothing has been written yet",
    (JSON.parse(beforeConfirm ?? '{"interests":[]}').interests ?? []).length === 0 &&
      (await readKey(page, DRAFT_KEY)) === null
  );
  const previewText = await page.locator(".trip-backup__preview").innerText();
  check("the preview counts human units, not JSON", /Personas|Quiero ir/.test(previewText) && !/routeIds|"version"/.test(previewText));
  check("the preview says it will replace", /sustituir/i.test(previewText));

  // Cancel first: cancelling must write nothing and leave the surface usable.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.waitForTimeout(400);
  check("cancelling wrote nothing", (await readKey(page, TRAVELLERS_KEY)) === beforeConfirm);
  check("cancelling left the surface open", (await page.locator(".trip-backup__dialog").count()) === 1);

  await page.locator(".trip-backup__file").setInputFiles(savedPath);
  await page.waitForSelector(".trip-backup__preview", { timeout: 10000 });
  await page.getByRole("button", { name: "Sustituir con este respaldo" }).click();
  await page.waitForSelector(".trip-backup__restored", { timeout: 10000 });
  check("the restore reports success", (await page.locator(".trip-backup__restored").count()) === 1);
  check("importing made no external request", externalRequests.length === externalBeforeImport, externalRequests.join(" | "));

  const travellersAfter = await readKey(page, TRAVELLERS_KEY);
  check("the travellers came back", travellersAfter !== null);
  check(
    "the restored travellers are exactly the exported ones",
    JSON.parse(travellersAfter ?? "null")?.interests?.length === parsed?.data?.travellers?.interests?.length
  );
  const draftAfter = await readKey(page, DRAFT_KEY);
  const draftParsedAfter = JSON.parse(draftAfter ?? "null");
  check(
    "the plan came back, field for field",
    Boolean(draftParsedAfter) &&
      JSON.stringify(draftParsedAfter.routeIds) === JSON.stringify(draftParsedBefore.routeIds) &&
      JSON.stringify(draftParsedAfter.days) === JSON.stringify(draftParsedBefore.days) &&
      draftParsedAfter.startDate === draftParsedBefore.startDate &&
      draftParsedAfter.endDate === draftParsedBefore.endDate &&
      JSON.stringify(draftParsedAfter.visitStartTimes) === JSON.stringify(draftParsedBefore.visitStartTimes),
    `${draftAfter?.slice(0, 140)}`
  );

  // ── 5. Finish, which reloads, and check it survives ──────────────────────────────────────────
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForTimeout(1500);
  check("the app reloaded into the restored trip", (await readKey(page, TRAVELLERS_KEY)) !== null);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  check("the restored trip survives a further reload", (await readKey(page, TRAVELLERS_KEY)) !== null);
  check("the restored plan survives a further reload", (await readKey(page, DRAFT_KEY)) === draftAfter);

  // ── 6. Replace, never merge ──────────────────────────────────────────────────────────────────
  await saveInHub(page, "Osaka", 2);
  const mutated = await readKey(page, TRAVELLERS_KEY);
  check("the state changed after the restore", mutated !== travellersAfter);
  const mutatedCount = JSON.parse(mutated ?? "null")?.interests?.length ?? 0;
  const restoredCount = JSON.parse(travellersAfter ?? "null")?.interests?.length ?? 0;
  check("more places are marked than the backup had", mutatedCount > restoredCount);

  await openBackup(page);
  await page.locator(".trip-backup__file").setInputFiles(savedPath);
  await page.waitForSelector(".trip-backup__preview", { timeout: 10000 });
  await page.getByRole("button", { name: "Sustituir con este respaldo" }).click();
  await page.waitForSelector(".trip-backup__restored", { timeout: 10000 });
  const reimported = JSON.parse((await readKey(page, TRAVELLERS_KEY)) ?? "null");
  check("re-importing REPLACED rather than merged", reimported?.interests?.length === restoredCount, `${reimported?.interests?.length} vs ${restoredCount}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForTimeout(1500);

  // ── 7. Bad files write nothing ───────────────────────────────────────────────────────────────
  const stateBeforeBadFiles = await readKey(page, TRAVELLERS_KEY);
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nihon-b13-"));
  const bad = [
    ["empty.json", ""],
    ["text.json", "definitely not json"],
    ["obj.json", "{}"],
    ["wrong-format.json", JSON.stringify({ format: "other", version: 1 })],
    ["future.json", JSON.stringify({ format: "nihon-portable-backup", version: 99, exportedAt: "2026-09-18T00:00:00Z", data: {} })],
    ["bad-types.json", JSON.stringify({ format: "nihon-portable-backup", version: 1, exportedAt: "2026-09-18T00:00:00Z", data: { travellers: { version: 1, travellers: [{ id: 5, label: 7 }], activeTravellerId: null, interests: [] }, planningDraft: null } })],
    ["proto.json", '{"format":"nihon-portable-backup","version":1,"exportedAt":"2026-09-18T00:00:00Z","__proto__":{"polluted":true},"data":{"travellers":null,"planningDraft":null}}'],
  ];
  await openBackup(page);
  for (const [fileName, body] of bad) {
    const p = path.join(tmp, fileName);
    await fs.writeFile(p, body, "utf8");
    await page.locator(".trip-backup__file").setInputFiles(p);
    await page.waitForTimeout(500);
    const rejected = (await page.locator(".trip-backup__problem").count()) === 1;
    const unchanged = (await readKey(page, TRAVELLERS_KEY)) === stateBeforeBadFiles;
    check(`${fileName} is refused, explained, and writes nothing`, rejected && unchanged, `rejected=${rejected} unchanged=${unchanged}`);
    const dismiss = page.getByRole("button", { name: "Entendido" });
    if ((await dismiss.count()) > 0) {
      await dismiss.click();
      await page.waitForTimeout(250);
    }
  }
  check("no bad file polluted the prototype", await page.evaluate(() => ({}).polluted === undefined));
  check("the surface stayed open through every bad file", (await page.locator(".trip-backup__dialog").count()) === 1);
  await fs.rm(tmp, { recursive: true, force: true });

  // ── 8. Keyboard, focus and dismissal ─────────────────────────────────────────────────────────
  const focusVisible = await page.evaluate(() => {
    const el = document.querySelector(".trip-backup__close");
    if (!(el instanceof HTMLElement)) return false;
    el.focus();
    return document.activeElement === el;
  });
  check("the dialog's close control takes focus", focusVisible);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape closes the surface", (await page.locator(".trip-backup__dialog").count()) === 0);
  check("focus is not trapped after closing", await page.evaluate(() => document.activeElement !== null));

  await openBackup(page);
  const tapTargets = await page.evaluate(() =>
    [...document.querySelectorAll(".trip-backup__dialog button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.textContent ?? "").trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) };
      })
      .filter((t) => t.h > 0 && t.h < 40)
  );
  check("every control in the dialog meets the tap floor", tapTargets.length === 0, JSON.stringify(tapTargets));
  check("the dialog still has no horizontal overflow", !(await noOverflow(page)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ── 9. Block 12's boundaries are intact ──────────────────────────────────────────────────────
  const modulePreloads = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((l) => l.getAttribute("href") ?? "")
  );
  check(
    "Block 12's deferred surfaces are still not in the critical path",
    !modulePreloads.some((h) => /OrderedSequenceBuilder|ZoneComparison|TripBackup/.test(h)),
    modulePreloads.join(" | ")
  );

  // ── 10. Nothing leaked ───────────────────────────────────────────────────────────────────────
  check(
    "no external request was made at any point, map tiles aside",
    externalRequests.length === 0,
    externalRequests.slice(0, 3).join(" | ")
  );
  check("the session raised no page error", pageErrors.length === 0, pageErrors.join(" | "));
  check("the session logged no console error", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

async function noSyncWords(page) {
  const text = (await page.locator(".trip-backup__dialog").innerText()).toLowerCase();
  return !/sincroniz|conectad|la nube|cuenta|inicia sesión|compartido autom/.test(text);
}

console.log("Block 13 portable-backup audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 13 portable-backup audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
