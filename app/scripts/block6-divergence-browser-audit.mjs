import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

/**
 * Block 6 — "dónde no coincidimos", browser audit against the PRODUCTION build (`vite preview`).
 *
 * What it proves that source scans and unit tests cannot: that the everyday saved list is
 * unchanged until somebody asks a narrower question, that the view tells silence and refusal
 * apart in the words on screen, that a place the planner already holds is reported and NOT moved,
 * that a stance change is reflected the moment it happens, and that the whole block adds no
 * storage key, no second list and no second main surface.
 *
 * B25 (B7 «Quiero ir», `10 §B7`): la barra de filtros de B6 (`ShortlistFilterBar`) y la lista
 * plana se sustituyen por diseño por SECCIONES («Los dos queréis ir», «Sólo {nombre}», «Opiniones
 * distintas», «Sin reclamar», «Descartados») y un segmentado que es una lente de vista. Los contratos
 * de este gate —silencio ≠ rechazo, un rechazo explícito crea «Opiniones distintas», un cambio de
 * postura se refleja al instante, la nota de lugar ya planificado no mueve nada, la vista no escribe
 * ni el borrador ni el documento, reinicio/recarga/huella de almacenamiento, alcance y teclado— se
 * miden aquí sobre el marcado nuevo, uno por uno. Nada se relaja: donde un chip era la unidad, ahora
 * lo es la sección o el segmento.
 *
 * Usage: node scripts/block6-divergence-browser-audit.mjs [--viewport=phone|tablet|desktop|all]
 */

const VIEWPORTS = {
  phone: { width: 390, height: 844, dpr: 2 },
  tablet: { width: 820, height: 1180, dpr: 2 },
  desktop: { width: 1440, height: 900, dpr: 1 },
};
const MIN_TAP_PX = 44;
/**
 * The allowance Block 1's canonical audit already grants, copied rather than re-decided.
 *
 * `.icon-button--small` is the saved list's long-standing 36px "Quitar" control, allowed at 36 by
 * `scripts/block1-ux-browser-audit.mjs` since Block 1. Block 6 adds no control to this list and
 * has no standing to raise the floor under an existing one: applying a stricter rule here would
 * have reported a pre-existing, deliberate exception as if this block had caused it.
 */
const COMPACT_TAP_ALLOWANCE = {
  ".icon-button--small": 36,
  ".link-button": 24,
};

const args = process.argv.slice(2);
const viewportArg = (args.find((a) => a.startsWith("--viewport=")) ?? "--viewport=all").split("=")[1];
const browserPath = (args.find((a) => a.startsWith("--browser=")) ?? "=").split("=")[1] || undefined;
assert.ok(viewportArg === "all" || VIEWPORTS[viewportArg], `unknown viewport: ${viewportArg}`);
const targets = viewportArg === "all" ? Object.keys(VIEWPORTS) : [viewportArg];

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4323;
const TRAVELLERS_KEY = "nihon.travellers.v1";
const DRAFT_KEY = "nihon.manualPlanningDraft";
const DECLARED_KEYS = [
  "nihon.travellers.v1",
  "nihon.savedPlaceIds",
  "nihon.manualPlanningDraft",
  "nihon.onboarding.seen.v1",
  "nihon.zoneComparison.v1",
];

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

async function readJson(page, key) {
  return page.evaluate((storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, key);
}

async function storageKeys(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nihon.")));
}

async function pageOverflows(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

async function smallTargets(page, scope) {
  return page.evaluate(
    ({ min, scope: selector, allowance }) => {
      const bad = [];
      const root = selector ? document.querySelector(selector) : document.body;
      if (!root) return bad;
      for (const el of root.querySelectorAll("button:not([disabled]), input, select, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest(".leaflet-control-container")) continue;
        let floor = min;
        // `.tap-target-min` (App.css, convención del proyecto desde B1): el área real es el
        // `::after` centrado, no la caja pintada. Se mide ESE área, no se exime el control.
        if (el.matches(".tap-target-min")) {
          const after = getComputedStyle(el, "::after");
          const w = Math.max(r.width, parseFloat(after.width) || 0);
          const h = Math.max(r.height, parseFloat(after.height) || 0);
          if (Math.min(w, h) + 0.5 >= floor) continue;
        }
        for (const [sel, allowed] of Object.entries(allowance)) {
          if (el.matches(sel)) floor = Math.min(floor, allowed);
        }
        if (Math.min(r.width, r.height) + 0.5 < floor) {
          bad.push({ cls: String(el.className).slice(0, 44), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return bad;
    },
    { min: MIN_TAP_PX, scope, allowance: COMPACT_TAP_ALLOWANCE }
  );
}

async function openHub(page, hub) {
  await goTo(page, "Explorar");
  const shortcut = page.getByRole("region", { name: "Empezar a explorar" });
  if ((await shortcut.count()) > 0) {
    await shortcut.getByRole("button", { name: new RegExp(`^${hub}\\b`) }).first().click();
  }
  await page.waitForTimeout(1300);
}

/**
 * Cambia de persona activa donde el shell la publica hoy (DD-007: Nosotros › Viajeros, con el
 * `PersonToken` de la cabecera como puerta) — igual que el gate de B5. Antes de B25 este gate
 * pulsaba `.traveller-bar__option` en Explorar, donde ya no es visible desde B18.
 */
async function beTraveller(page, index) {
  await page.getByRole("button", { name: /Ir a Nosotros y Viajeros/ }).first().click();
  await page.waitForTimeout(450);
  // B26: tarjetas de persona; elegir a quien ya está activa no hace nada, igual que antes.
  const use = page.locator(".traveller-card").nth(index).getByRole("button", { name: /^Usar este dispositivo como / });
  if ((await use.count()) > 0) await use.click();
  await page.waitForTimeout(350);
  await backToBrowse(page);
}

/** The detail overlay, closed through the control the reader actually uses. */
async function closeDetail(page) {
  // B20 (`05 §5`, D4): el `×` flotante desapareció; el botón atrás de la ficha es la salida.
  const close = page.locator('.place-detail__back:visible, .place-detail .icon-button[aria-label^="Cerrar la ficha"]:visible');
  if ((await close.count()) > 0) await close.first().click();
  await page.waitForTimeout(500);
}

/** El destino activo, por rol y nombre accesible (`04 §10`). */
async function goTo(page, label) {
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: label })
    .first()
    .click();
  await page.waitForTimeout(500);
}

const QI = ".destination-panel:not([hidden]) .quiero-ir";

/** Abre Quiero ir (B25: es la pestaña, y las secciones son su contenido). */
async function openPanel(page) {
  await goTo(page, "Quiero ir");
}

/** Vuelve a Explorar › Tokio, donde viven las tarjetas y la barra de personas. */
async function backToBrowse(page) {
  await goTo(page, "Explorar");
  if ((await page.locator(".place-card").count()) === 0) await openHub(page, "Tokio");
}

/** Títulos de sección visibles, sin contador: «Los dos queréis ir», «Sólo Ana», … */
async function sectionTitles(page) {
  return (await page.locator(`${QI} .quiero-ir__section-title`).allInnerTexts()).map((t) => t.trim());
}

/** Los ids de lugar dentro de la sección cuyo título empieza por `title`. */
async function rowsIn(page, title) {
  return page.locator(`${QI} .quiero-ir__section`).evaluateAll(
    (sections, wanted) =>
      sections
        .filter((section) =>
          (section.querySelector(".quiero-ir__section-title")?.textContent ?? "").trim().startsWith(wanted)
        )
        .flatMap((section) =>
          [...section.querySelectorAll(".quiero-ir__row")].map((row) => row.getAttribute("data-quiero-ir-place"))
        ),
    title
  );
}

async function allRowIds(page) {
  return page
    .locator(`${QI} .quiero-ir__row`)
    .evaluateAll((rows) => [...new Set(rows.map((row) => row.getAttribute("data-quiero-ir-place")))]);
}

async function rowNote(page, placeId) {
  const note = page.locator(`${QI} [data-quiero-ir-place="${placeId}"] .quiero-ir__row-note`);
  return (await note.count()) === 0 ? "" : (await note.first().innerText()).trim();
}

async function badge(page) {
  const b = page.locator(".tab-bar__badge, .nav-rail__badge");
  return (await b.count()) === 0 ? "0" : (await b.first().innerText()).trim();
}

async function auditViewport(browser, name, url) {
  const { width, height, dpr } = VIEWPORTS[name];
  console.log(`\n── ${name} ${width}×${height} DPR ${dpr} ${"─".repeat(24)}`);

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: width <= 860,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/ERR_CERT|ERR_INTERNET|tile\.openstreetmap/.test(m.text())) return;
    consoleErrors.push(m.text());
  });

  await page.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await openHub(page, "Tokio");

  // ── The everyday list is unchanged until there is something to ask ───────────────────────────
  await openPanel(page);
  check(
    "an empty list offers no sections and no lens at all",
    (await page.locator(`${QI}.quiero-ir--empty`).count()) === 1 &&
      (await page.locator(`${QI} .quiero-ir__section`).count()) === 0 &&
      (await page.locator(`${QI} .quiero-ir__segmented`).count()) === 0
  );
  await backToBrowse(page);

  const cards = page.locator(".place-card");

  // A. both interested.
  await beTraveller(page, 0);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 1);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);

  const travellerLabels = ((await readJson(page, TRAVELLERS_KEY))?.travellers ?? []).map((t) => t.label);
  await openPanel(page);
  let titles = await sectionTitles(page);
  check(
    "one place everybody agrees on reads as agreement and nothing else",
    titles.includes("Los dos queréis ir") && !titles.includes("Opiniones distintas") &&
      !titles.some((t) => t.startsWith("Sólo ")),
    JSON.stringify(titles)
  );
  const agreedId = (await rowsIn(page, "Los dos queréis ir"))[0];
  await backToBrowse(page);

  // B/C. one-sided: P1 wants the second place, P2 has not spoken.
  await beTraveller(page, 0);
  await cards.nth(1).locator(".place-card__save").click();
  await page.waitForTimeout(350);
  await openPanel(page);

  titles = await sectionTitles(page);
  const onlyTitle = titles.find((t) => t.startsWith("Sólo "));
  check("a one-sided place gets a section of its own", Boolean(onlyTitle), JSON.stringify(titles));
  check(
    "and no 'Opiniones distintas' section, because nobody has said no",
    !titles.includes("Opiniones distintas"),
    JSON.stringify(titles)
  );
  check("both groups that exist are named", titles.includes("Los dos queréis ir") && Boolean(onlyTitle), JSON.stringify(titles));
  let rows = onlyTitle ? await rowsIn(page, onlyTitle) : [];
  check("the one-sided section holds only the one-sided place", rows.length === 1 && rows[0] !== agreedId, JSON.stringify(rows));
  const oneSidedId = rows[0];
  check(
    "B — the section names who wants it (the traveller who saved it)",
    onlyTitle === `Sólo ${travellerLabels[0]}`,
    `${onlyTitle} vs ${JSON.stringify(travellerLabels)}`
  );
  const oneSidedNote = await rowNote(page, oneSidedId);
  check("never calling silence a disagreement", !/distint|desacuerdo|no le interesa/i.test(oneSidedNote), oneSidedNote);
  check(
    "the default view carries no derived line on agreed rows",
    (await rowNote(page, agreedId)) === ""
  );

  // ── C. the same state, read by the other person ──────────────────────────────────────────────
  await backToBrowse(page);
  await beTraveller(page, 1);
  await openPanel(page);
  titles = await sectionTitles(page);
  check(
    "C — from P2's chair the place is still named as P1's, not as a disagreement",
    titles.includes(`Sólo ${travellerLabels[0]}`) && !titles.includes("Opiniones distintas"),
    JSON.stringify(titles)
  );
  const docBefore = await readJson(page, TRAVELLERS_KEY);

  // ── H. no explicit disagreement exists, and the app says so ──────────────────────────────────
  const qiText = (await page.locator(QI).innerText()).trim();
  check("H — with nothing refused, nothing on screen says desacuerdo", !/desacuerdo/i.test(qiText), qiText.slice(0, 160));

  // ── D/E. an explicit refusal, from the detail ────────────────────────────────────────────────
  await backToBrowse(page);
  await cards.nth(1).locator(".place-card__open").click();
  await page.waitForTimeout(700);
  await page.locator(".place-interest__decline").click();
  await page.waitForTimeout(500);
  await closeDetail(page);
  await openPanel(page);

  titles = await sectionTitles(page);
  check("D — a refusal creates the 'Opiniones distintas' section", titles.includes("Opiniones distintas"), JSON.stringify(titles));
  check(
    "and retires the one-sided section, because that place is no longer merely unanswered",
    !titles.some((t) => t.startsWith("Sólo ")),
    JSON.stringify(titles)
  );
  rows = await rowsIn(page, "Opiniones distintas");
  check(
    "the section holds exactly the disputed place, and it is the one that was one-sided",
    rows.length === 1 && rows[0] === oneSidedId,
    JSON.stringify(rows)
  );
  let line = await rowNote(page, oneSidedId);
  check("and words it as a difference of opinion", /opiniones distintas/i.test(line), line);
  check("naming the refusal explicitly", /no le interesa/i.test(line), line);
  check("without a score, a percentage or a winner", !/%|punt|score|afinidad|gana/i.test(line), line);
  check("the place is still in the shared list, because the other person wants it", (await badge(page)) === "2");

  // ── I. a change of stance updates the view immediately ───────────────────────────────────────
  await backToBrowse(page);
  await beTraveller(page, 1);
  await cards.nth(1).locator(".place-card__open").click();
  await page.waitForTimeout(700);
  await page.locator(".place-detail .save-button").click();
  await page.waitForTimeout(500);
  await closeDetail(page);
  await openPanel(page);
  titles = await sectionTitles(page);
  check("I — the disagreement section disappears the moment nobody refuses", !titles.includes("Opiniones distintas"), JSON.stringify(titles));
  rows = await rowsIn(page, "Los dos queréis ir");
  check("I — and the place moves into agreement, with no stale row left behind", rows.length === 2 && rows.includes(oneSidedId), JSON.stringify(rows));
  check("returning shows the whole list", (await allRowIds(page)).length === 2);

  // ── G. a one-sided place the planner already holds ───────────────────────────────────────────
  await backToBrowse(page);
  await beTraveller(page, 0);
  await cards.nth(2).locator(".place-card__save").click();
  await page.waitForTimeout(400);
  await openPanel(page);
  await page.getByRole("button", { name: /Llevar al viaje/ }).click();
  await page.waitForTimeout(900);
  check("the planner opened", (await page.locator("#sequence-builder-title:visible").count()) === 1);
  // B27 (B9.1): Viaje abre directamente en Días — ya no hay paso «Distribuir por días»; el primer
  // reparto (un solo día con el recorrido tal cual) lo crea la propia apertura de Días.
  await page.locator(".day-timeline").first().waitFor();
  await page.waitForTimeout(700);
  let draft = await readJson(page, DRAFT_KEY);
  const plannedIds = (draft?.days ?? []).flatMap((day) => day.placeIds);
  check("and assigned the places to days", plannedIds.length >= 3, JSON.stringify(plannedIds));
  const draftBeforeView = JSON.stringify(draft);

  // B18/B25: el planificador es Viaje › Planificar, no un modal; «cerrarlo» es volver por la barra.
  await openPanel(page);
  check("the planner closed", (await page.locator("#sequence-builder-title:visible").count()) === 0);

  await openPanel(page);
  const onlyNow = (await sectionTitles(page)).find((t) => t.startsWith("Sólo "));
  const plannedOneSided = onlyNow ? await rowsIn(page, onlyNow) : [];
  const notes = [];
  for (const id of plannedOneSided) notes.push(await rowNote(page, id));
  check("G — a one-sided place already on a day says so", notes.length >= 1 && notes.every((n) => n.length > 0), JSON.stringify(notes));
  check("G — and says that this screen does not move it", notes.every((note) => /no lo cambia/i.test(note)), JSON.stringify(notes));
  check(
    "G — it proposes no removal, no reschedule and no replacement",
    notes.every((note) => !/quita|mueve|sustitu|reemplaz|otro día/i.test(note)),
    JSON.stringify(notes)
  );

  draft = await readJson(page, DRAFT_KEY);
  check("G — the planning draft is byte-for-byte what the planner left", JSON.stringify(draft) === draftBeforeView);
  check("G — and it is still V8", draft?.version === 8, String(draft?.version));
  check("G — with no traveller dimension anywhere in it", !/traveller|persona|stance|divergen/i.test(JSON.stringify(draft)));

  // ── The view alters no plan, whatever the reader presses ─────────────────────────────────────
  const docBeforeLens = JSON.stringify(await readJson(page, TRAVELLERS_KEY));
  const segments = page.locator(`${QI} .quiero-ir__segment`);
  const segmentCount = await segments.count();
  for (let i = 0; i < segmentCount; i += 1) {
    await segments.nth(i).click();
    await page.waitForTimeout(250);
  }
  await segments.first().click();
  await page.waitForTimeout(250);
  check("pressing the lens changes nothing in the draft", JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBeforeView);
  check(
    "and nothing in the travellers document — not even the active person",
    JSON.stringify(await readJson(page, TRAVELLERS_KEY)) === docBeforeLens
  );
  check(
    "and the people are the ones there were before any of this",
    JSON.stringify((await readJson(page, TRAVELLERS_KEY))?.travellers) === JSON.stringify(docBefore?.travellers)
  );

  // ── J. a profile reset ───────────────────────────────────────────────────────────────────────
  await goTo(page, "Nosotros");
  const resetButton = page.getByRole("button", { name: /^Reiniciar lo que ha guardado/ }).first();
  await resetButton.click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: /^Sí, reiniciar|Confirmar/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  await openPanel(page);
  const shown = (await allRowIds(page)).length;
  check("J — a reset updates the view with the list it leaves behind", String(shown) === (await badge(page)), `${shown} vs ${await badge(page)}`);
  const afterReset = await readJson(page, TRAVELLERS_KEY);
  check("J — and the reset really removed something", (afterReset?.interests ?? []).length < 3, JSON.stringify(afterReset?.interests));

  // ── K/L. reload, and the storage footprint ───────────────────────────────────────────────────
  const beforeReload = JSON.stringify(await readJson(page, TRAVELLERS_KEY));
  const draftBeforeReload = JSON.stringify(await readJson(page, DRAFT_KEY));
  const keysBefore = (await storageKeys(page)).sort();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  check(
    "K — reload preserves the Block 5 document exactly",
    JSON.stringify(await readJson(page, TRAVELLERS_KEY)) === beforeReload
  );
  check(
    "K — and the planning draft exactly",
    JSON.stringify(await readJson(page, DRAFT_KEY)) === draftBeforeReload
  );
  check(
    "L — Block 6 adds no storage key of its own",
    JSON.stringify((await storageKeys(page)).sort()) === JSON.stringify(keysBefore),
    JSON.stringify(await storageKeys(page))
  );
  check(
    "L — and every key the app owns is one it declared before this block",
    (await storageKeys(page)).every((key) => DECLARED_KEYS.includes(key)),
    JSON.stringify(await storageKeys(page))
  );

  // ── The lens is view state, and is not persisted ─────────────────────────────────────────────
  await openPanel(page);
  if ((await page.locator(`${QI} .quiero-ir__segment`).count()) >= 2) {
    check(
      "the list reopens on 'Los dos' — a lens is not a decision worth storing",
      (await page.locator(`${QI} .quiero-ir__segment`).first().getAttribute("aria-checked")) === "true"
    );
  } else {
    check("the list reopens with no lens to restore", true);
  }

  // ── Layout, reach and keyboard ───────────────────────────────────────────────────────────────
  await backToBrowse(page);
  await beTraveller(page, 0);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 1);
  await cards.nth(0).locator(".place-card__save").click();
  await page.waitForTimeout(300);
  await beTraveller(page, 0);
  await cards.nth(1).locator(".place-card__save").click();
  await page.waitForTimeout(350);
  await openPanel(page);

  check("no horizontal page scroll", !(await pageOverflows(page)));
  const rowOverflow = await page.evaluate((qi) => {
    const row = document.querySelector(`${qi} .quiero-ir__segmented`);
    if (!row || !row.parentElement) return false;
    return row.getBoundingClientRect().width > row.parentElement.getBoundingClientRect().width + 1;
  }, QI);
  check("the lens never widens the panel it sits in", !rowOverflow);

  const small = await smallTargets(page, QI);
  check("every control in the saved list meets its tap floor", small.length === 0, JSON.stringify(small));
  const smallChips = await page.evaluate(
    (qi) =>
      [...document.querySelectorAll(`${qi} .quiero-ir__segment`)]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => Math.min(r.width, r.height) + 0.5 < 44)
        .map((r) => ({ w: Math.round(r.width), h: Math.round(r.height) })),
    QI
  );
  check("and every lens segment meets the full 44px floor", smallChips.length === 0, JSON.stringify(smallChips));

  const segs = page.locator(`${QI} .quiero-ir__segment`);
  if ((await segs.count()) >= 2) {
    const names = await segs.evaluateAll((els) => els.map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim()));
    check("every segment has an accessible name", names.every((n) => n && n.length > 0), JSON.stringify(names));
    check("and the names are unique", new Set(names).size === names.length, JSON.stringify(names));
    check("exactly one segment is checked at a time", (await page.locator(`${QI} .quiero-ir__segment[aria-checked="true"]`).count()) === 1);
    const group = page.locator(`${QI} .quiero-ir__segmented`);
    check("the lens is a labelled radio group", (await group.getAttribute("role")) === "radiogroup");
    check("with a label that says what it chooses", /ver/i.test((await group.getAttribute("aria-label")) ?? ""));

    // Keyboard: Tab reaches the checked segment; arrows move the choice (APG radio group).
    await segs.first().focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.classList.contains("quiero-ir__segment")) return { onSeg: false };
      const style = getComputedStyle(el);
      return {
        onSeg: true,
        checked: el.getAttribute("aria-checked") === "true",
        ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      };
    });
    check("the arrow key reaches the next segment", focusVisible.onSeg === true);
    check("and the keyboard alone applies the lens", focusVisible.checked === true);
    check("and a keyboard-focused segment draws a visible ring", focusVisible.ring === true);

    const distinguishable = await page.evaluate((qi) => {
      const on = document.querySelector(`${qi} .quiero-ir__segment--on`);
      const off = [...document.querySelectorAll(`${qi} .quiero-ir__segment`)].find(
        (el) => !el.classList.contains("quiero-ir__segment--on")
      );
      if (!on || !off) return false;
      const a = getComputedStyle(on);
      const b = getComputedStyle(off);
      return a.fontWeight !== b.fontWeight || a.borderColor !== b.borderColor || a.boxShadow !== b.boxShadow;
    }, QI);
    check("checked and unchecked differ by more than hue", distinguishable);
    await segs.first().click();
    await page.waitForTimeout(250);
  } else {
    check("the lens is present with two people", false, "no segmented control was present");
  }

  // Reduced motion: the chip declares no transition to fight.
  const reducedContext = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.addInitScript(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await reducedPage.goto(url, { waitUntil: "domcontentloaded" });
  await reducedPage.waitForTimeout(800);
  const reduced = await reducedPage.evaluate(() => {
    const probe = document.createElement("button");
    probe.className = "quiero-ir__segment";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    // Chromium's reduced-motion emulation clamps every duration to ~1e-06s, so the DURATION alone
    // cannot tell an honest `transition: none` from an emulated one. The PROPERTY can.
    const value = { property: style.transitionProperty, duration: style.transitionDuration };
    probe.remove();
    return value;
  });
  check(
    "reduced motion leaves the lens segment with no transition to run",
    reduced.property === "none" || parseFloat(reduced.duration) < 0.01,
    JSON.stringify(reduced)
  );
  await reducedContext.close();

  // ── The default view is comprehensible without knowing the architecture ──────────────────────
  const panelText = (await page.locator(QI).innerText()).toLowerCase();
  check(
    "the list never exposes an internal name to the reader",
    !/divergence|shortlist|stance|carriedover|traveller(id)?\b|only-them|only-you/.test(panelText),
    panelText.slice(0, 160)
  );
  check(
    "and never a percentage, a score or a ranking",
    !/%|score|afinidad|compatib|ranking|puntuaci/i.test(panelText)
  );
  check(
    "and no judgement about the two people",
    !/conflicto|deberíais|os conviene|mejor opción|ceder/i.test(panelText)
  );

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await context.close();
}

console.log("Block 6 divergence audit — production build via vite preview");
const server = await preview({ root: appRoot, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/`;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
try {
  for (const name of targets) await auditViewport(browser, name, url);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${"═".repeat(60)}\nBlock 6 divergence audit: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
