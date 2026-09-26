import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputRoot = process.env.ASTRA_AUDIT_OUTPUT ?? `${repoRoot}/docs/astra/evidence/astra-browser-audit`;
const expectedSha = process.env.ASTRA_EXPECTED_SHA;
const actualSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
assert.ok(expectedSha, "ASTRA_EXPECTED_SHA is required; pass the PR head SHA");
assert.equal(actualSha, expectedSha, "checked-out commit must equal the PR implementation head SHA");

const VIEWPORTS = [
  ["mobile-375", 375, 812], ["mobile-390", 390, 844], ["mobile-430", 430, 932],
  ["tablet-768", 768, 1024], ["tablet-landscape-1024", 1024, 768],
  ["desktop-1440", 1440, 900], ["reflow-320", 320, 800],
];
await mkdir(`${outputRoot}/screenshots`, { recursive: true });
await mkdir(`${outputRoot}/traces`, { recursive: true });

const server = await preview({ root: appRoot, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const baseURL = server.resolvedUrls?.local[0];
assert.ok(baseURL, "Vite preview did not expose a localhost URL");
const browser = await chromium.launch({ headless: true });
const results = [];

async function runJourney(id, name, viewport, test) {
  const context = await browser.newContext({ viewport });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push({ text:message.text(), url:message.location().url });
  });
  page.on("pageerror", error => pageErrors.push(String(error)));
  let status = "PASS";
  let error = "";
  try {
    const expectedConsoleErrors = await test(page, context) ?? [];
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, expectedConsoleErrors, `console errors: ${JSON.stringify(consoleErrors)}`);
  } catch (cause) {
    status = "FAIL";
    error = cause instanceof Error ? cause.stack ?? cause.message : String(cause);
  } finally {
    await page.screenshot({ path: `${outputRoot}/screenshots/${id}-final.png`, fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: `${outputRoot}/traces/${id}.zip` }).catch(() => {});
    await context.close();
  }
  results.push({ id, name, status, viewport, error });
  console.log(`${status} ${id} — ${name}${error ? `: ${error.split("\n")[0]}` : ""}`);
}

try {
  await runJourney("01-viewports", "responsive shell and discovery geometry", { width: 1440, height: 900 }, async page => {
    for (const [label, width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "¿Qué te gustaría vivir en Japón?" }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${label}: horizontal overflow ${overflow}px`);
      assert.equal(await page.getByRole("navigation", { name: "Principal" }).getByRole("link").count(), 2, `${label}: two destinations`);
      await page.screenshot({ path: `${outputRoot}/screenshots/01-${label}.png`, fullPage: true });
      await page.goto(`${baseURL}#/explorar?q=Shibuya%20Crossing`, { waitUntil: "networkidle" });
      const detailOpener = page.getByRole("link", { name: "Shibuya Crossing", exact:true });
      await detailOpener.click();
      const detail = page.getByRole("dialog", { name:"Detalles de Shibuya Crossing" });
      await detail.waitFor();
      await page.screenshot({ path: `${outputRoot}/screenshots/01-${label}-detail-one-image.png`, fullPage:true });
      if (width === 375 || width === 390) {
        const footer = detail.locator(".place-detail__footer");
        const save = footer.locator("button.save-button");
        const assertPersistentCta = async stage => {
          assert.equal(await footer.isVisible(), true, `${label} ${stage}: detail footer is not visible`);
          assert.equal(await save.isVisible(), true, `${label} ${stage}: save CTA is not visible`);
          const box = await save.boundingBox();
          assert.ok(box && box.height >= 48, `${label} ${stage}: save CTA is shorter than 48px`);
          assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${label} ${stage}: save CTA overflows horizontally`);
          assert.ok(box && box.y >= 0 && box.y + box.height <= height, `${label} ${stage}: save CTA is outside viewport`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${label} ${stage}: page has horizontal overflow`);
        };
        await assertPersistentCta("initial");
        await detail.locator(".place-detail__scroll").evaluate(element => { element.scrollTop = element.scrollHeight; });
        await assertPersistentCta("after internal scroll");
        await page.screenshot({ path:`${outputRoot}/screenshots/01-${label}-detail-sticky-cta.png`, fullPage:true });
      }
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width:320, height:800 });
    await page.goto(`${baseURL}#/explorar?q=Takeshita%20Street`, { waitUntil:"networkidle" });
    await page.getByRole("link", { name:"Takeshita Street", exact:true }).click();
    await page.getByRole("dialog", { name:"Detalles de Takeshita Street" }).waitFor();
    await page.screenshot({ path:`${outputRoot}/screenshots/01-reflow-320-detail-zero-images.png`, fullPage:true });
  });

  await runJourney("02-plan-safety", "blocked unsave preserves serialized V7", { width: 390, height: 844 }, async page => {
    const draft = { version:7, routeIds:["JP-021"], days:null, startDate:"2027-02-19", endDate:"2027-02-20", visitStartTimes:{"JP-021":"09:00"}, accommodations:[], accommodationLegs:[], interHubSegments:[] };
    const raw = JSON.stringify(draft);
    await page.addInitScript(({ raw }) => { localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(["JP-021"])); localStorage.setItem("nihon.manualPlanningDraft", raw); }, { raw });
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    const card = page.locator(".astra-card").filter({ has: page.locator('a[href*="JP-021"]') }).first();
    await card.getByRole("button", { name: /Quiero ir/ }).click();
    const identity = page.getByRole("dialog", { name:"¿De quién son estos gustos?" });
    await identity.getByRole("button", { name:"Fernando" }).click();
    await card.getByRole("button", { name:/Quiero ir/ }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("nihon.manualPlanningDraft")), raw);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.savedPlaceIds") ?? "[]")), ["JP-021"]);
  });

  await runJourney("03-history", "detail, nearby and exploration restoration", { width: 390, height: 844 }, async page => {
    await page.goto(`${baseURL}#/explorar?q=templo&page=2`, { waitUntil: "networkidle" });
    await page.evaluate(() => scrollTo(0, Math.min(700, document.body.scrollHeight)));
    const before = await page.evaluate(() => scrollY);
    await page.locator(".astra-card h2 a").first().click();
    await page.getByRole("dialog", { name: /Detalles de/ }).waitFor();
    await page.goBack();
    await page.locator(".astra-grid").waitFor();
    assert.match(page.url(), /q=templo/);
    assert.match(page.url(), /page=2/);
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) < 10, "scroll position was not restored");
    await page.goForward();
    await page.getByRole("dialog", { name: /Detalles de/ }).waitFor();
  });

  await runJourney("04-filters-map", "filter durability, OR algebra and map parity", { width: 1024, height: 768 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Filtros (0)" }).click();
    await page.locator("details").filter({ hasText:"Categoría" }).locator("summary").click();
    const categoryChecks = page.getByRole("group", { name: "Categoría" }).getByRole("checkbox");
    await categoryChecks.nth(0).check();
    await categoryChecks.nth(1).check();
    assert.equal(await categoryChecks.nth(0).isChecked(), true, "first OR category was cleared");
    assert.equal(await categoryChecks.nth(1).isChecked(), true, "second OR category was cleared");
    await page.getByRole("button", { name: /Ver \d+ resultados/ }).click();
    const listCount = Number((await page.locator(".astra-results > span").first().textContent())?.match(/\d+/)?.[0]);
    await page.getByRole("button", { name: "Mapa" }).click();
    await page.locator(".leaflet-container").waitFor();
    assert.equal(await page.locator(".leaflet-marker-icon").count(), listCount, "map/list IDs differ");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Filtros/ }).click();
    assert.equal(await page.getByRole("group", { name: "Categoría" }).getByRole("checkbox").nth(0).isChecked(), true, "filter did not survive reload");
  });

  await runJourney("05-modal-focus", "detail and lightbox focus stack", { width: 768, height: 1024 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    const opener = page.locator(".astra-card h2 a").first();
    await opener.focus(); await opener.click();
    const dialog = page.getByRole("dialog", { name: /Detalles de/ }); await dialog.waitFor();
    assert.equal(await page.locator("#astra-content").getAttribute("inert"), "");
    for (let i=0;i<20;i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true, "focus escaped detail"); }
    const fullscreenOpener = dialog.getByRole("button", { name:/a pantalla completa/ });
    await fullscreenOpener.click();
    const lightbox = page.locator('.lightbox[role="dialog"][aria-modal="true"]');
    await lightbox.waitFor();
    assert.equal(await dialog.getAttribute("inert"), "", "detail behind fullscreen must be inert");
    assert.equal(await lightbox.evaluate(element => element.contains(document.activeElement)), true, "initial fullscreen focus is outside top layer");
    for (let i=0;i<20;i++) { await page.keyboard.press("Tab"); assert.equal(await lightbox.evaluate(element => element.contains(document.activeElement)), true, "focus escaped fullscreen"); }
    await page.screenshot({ path:`${outputRoot}/screenshots/05-lightbox-tablet.png`, fullPage:true });
    await page.keyboard.press("Escape");
    await lightbox.waitFor({ state:"detached" });
    assert.equal(await dialog.count(), 1, "first Escape closed detail together with fullscreen");
    assert.equal(await dialog.getAttribute("inert"), null, "detail remained inert after fullscreen closed");
    assert.equal(await fullscreenOpener.evaluate(element => document.activeElement === element), true, "fullscreen focus did not return to its opener");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state:"detached" });
    assert.equal(await opener.evaluate(element => document.activeElement === element), true, "focus did not return to opener");
  });

  await runJourney("06-image-retry", "image failure and independent retry target", { width: 430, height: 932 }, async page => {
    const assetPath = "/images/places/JP-001/shibuya-scramble-crossing.webp";
    const assetUrl = new URL(assetPath, baseURL).href;
    const assetRequests = [];
    let abortedRequestUrl = "";
    let interceptedAttempts = 0;
    page.on("request", request => { if (request.url() === assetUrl) assetRequests.push(request.url()); });
    await page.route(assetUrl, async route => {
      interceptedAttempts += 1;
      if (interceptedAttempts === 1) {
        abortedRequestUrl = route.request().url();
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await page.goto(`${baseURL}#/explorar?q=Shibuya%20Crossing`, { waitUntil: "domcontentloaded" });
    const card = page.locator(".astra-card").filter({ has: page.locator('a[href*="JP-001"]') }).first();
    const visibleError = card.getByText("No se pudo cargar la fotografía", { exact:true });
    await visibleError.waitFor({ state:"visible" });
    const retry = card.getByRole("button", { name:"Reintentar", exact:true });
    assert.equal(await retry.evaluate(element => Boolean(element.closest("a"))), false, "retry button is nested inside a detail link");
    await retry.click();
    await visibleError.waitFor({ state:"detached" });
    const recoveredImage = card.locator("img");
    await page.waitForFunction(targetUrl => Array.from(document.images).some(image => image.src === targetUrl && image.complete && image.naturalWidth > 0), assetUrl);
    assert.equal(await recoveredImage.getAttribute("src"), assetPath, "retry did not recover the same asset");
    assert.ok(await recoveredImage.evaluate(image => image.naturalWidth) > 0, "retried image did not load");
    assert.equal(assetRequests.length, 2, `expected exactly two asset requests, received ${assetRequests.length}`);
    assert.equal(interceptedAttempts, 2, `expected exactly two intercepted attempts, received ${interceptedAttempts}`);
    assert.equal(abortedRequestUrl, assetUrl, "the aborted request did not match the targeted asset");
    assert.equal(await visibleError.count(), 0, "image error remained visible after retry");
    assert.equal(await page.getByRole("dialog", { name: /Detalles de/ }).count(), 0, "retry opened detail");
    return [{ text:"Failed to load resource: net::ERR_FAILED", url:abortedRequestUrl }];
  });

  await runJourney("07-lazy-network", "initial list avoids map/planner/provider requests", { width: 1440, height: 900 }, async page => {
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    assert.equal(requests.some(url => /PlaceMap|MapContainer|OrderedSequenceBuilder|tile\.openstreetmap/i.test(url)), false, `deferred request on initial load: ${requests.join("\n")}`);
    await page.getByRole("button", { name:"Mapa" }).click();
    await page.locator(".leaflet-container").waitFor();
    assert.equal(requests.some(url => /PlaceMap|MapContainer/i.test(url)), true, "map chunk did not load on demand");
  });

  await runJourney("08-a11y-reflow", "320px reflow, filter modal and single live output", { width: 320, height: 800 }, async page => {
    await page.goto(`${baseURL}#/explorar`, { waitUntil: "networkidle" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "320px horizontal overflow");
    const filterButton = page.getByRole("button", { name:/Filtros/ });
    await filterButton.click();
    const filterDialog = page.getByRole("dialog", { name:"Filtros avanzados" });
    await filterDialog.waitFor();
    assert.equal(await page.locator('[role="status"]:not([inert] [role="status"])').count(), 1, "active layer must expose one result live region");
    for (let i=0;i<30;i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-label="Filtros avanzados"]'))), true, "focus escaped filter dialog"); }
    await page.keyboard.press("Escape");
    await filterDialog.waitFor({ state:"detached" });
    assert.equal(await filterButton.evaluate(element => document.activeElement === element), true, "filter opener focus not restored");
  });

  await runJourney("09-sol4-review", "two-person onboarding, legacy, persistence and retry", { width: 390, height: 844 }, async page => {
    const rawLegacy='["JP-021"]';
    const rawDraft=JSON.stringify({version:7,routeIds:["JP-001"],days:null,startDate:"2027-02-19",endDate:"2027-02-20",visitStartTimes:{},accommodations:[],accommodationLegs:[],interHubSegments:[]});
    await page.addInitScript(({rawLegacy,rawDraft})=>{localStorage.setItem("nihon.savedPlaceIds",rawLegacy);localStorage.setItem("nihon.manualPlanningDraft",rawDraft);}, {rawLegacy,rawDraft});
    await page.addInitScript(()=>{const original=Storage.prototype.setItem;window.__failReview=false;Storage.prototype.setItem=function(k,v){if(window.__failReview&&k==="nihon.astra.review.v1")throw new DOMException("Audit storage failure","QuotaExceededError");return original.call(this,k,v);};});
    await page.goto(`${baseURL}#/explorar?q=Shibuya%20Crossing`,{waitUntil:"networkidle"});
    const want=page.getByRole("button",{name:/Quiero ir a Shibuya Crossing/});
    assert.equal(await page.getByLabel("Persona activa").count(),0,"reviewer switch must not bypass first-interest onboarding");
    await want.focus();
    await want.click();
    const identity=page.getByRole("dialog",{name:"¿De quién son estos gustos?"});
    await identity.waitFor();
    assert.equal(await identity.getByText("Dos perfiles en este dispositivo").count(),1);
    await identity.getByRole("button",{name:"Cancelar"}).click();
    assert.equal(await want.evaluate(element=>document.activeElement===element),true,"identity cancel must restore exact opener");
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.astra.review.v1")),null,"identity cancel must not write");
    assert.equal(await want.getAttribute("aria-pressed"),"false");
    await want.click();await identity.getByRole("button",{name:"Fernando"}).click();
    assert.equal(await want.getAttribute("aria-pressed"),"true");
    assert.equal(await page.getByLabel("Persona activa").inputValue(),"fernando");
    await page.getByLabel("Persona activa").selectOption("ella");
    assert.equal(await want.getAttribute("aria-pressed"),"false");
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-001"].votes.fernando),"yes","reviewer switch mutated Fernando");
    await want.click();await page.getByText("Ambos quieren ir").waitFor();
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.getByText("Ambos quieren ir").count(),1);
    await page.goto(`${baseURL}#/viaje`,{waitUntil:"networkidle"});
    await page.getByText("Guardado anterior · Sin asignar").waitFor();
    const claimOpener=page.getByRole("button",{name:/Estos guardados son míos/});
    await claimOpener.focus();await claimOpener.click();
    const claim=page.getByRole("alertdialog",{name:"¿Asignar estos guardados?"});
    await claim.getByRole("button",{name:"Cancelar"}).click();
    assert.equal(await claimOpener.evaluate(element=>document.activeElement===element),true,"claim cancel must restore exact opener");
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.savedPlaceIds")),rawLegacy);
    await page.getByRole("button",{name:/Estos guardados son míos/}).click();
    await claim.getByRole("button",{name:"Confirmar"}).click();
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.savedPlaceIds")),rawLegacy);
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.manualPlanningDraft")),rawDraft);
    const first=await page.evaluate(()=>localStorage.getItem("nihon.astra.review.v1"));
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.astra.review.v1")),first);
    await page.goto(`${baseURL}#/explorar?q=Takeshita%20Street`,{waitUntil:"networkidle"});
    await page.evaluate(()=>{window.__failReview=true;});
    const takeshita=page.getByRole("button",{name:/Quiero ir a Takeshita Street/});
    await takeshita.click();
    const failure=page.getByRole("alert");await failure.waitFor();
    assert.equal(await takeshita.getAttribute("aria-pressed"),"false","failed write exposed false success");
    assert.equal(await page.getByText("Interés retirado").count(),0,"failed write exposed false Undo");
    await page.evaluate(()=>{window.__failReview=false;});
    await failure.getByRole("button",{name:"Reintentar guardar"}).click();
    await failure.waitFor({state:"detached"});
    assert.equal(await page.getByRole("button",{name:/Quiero ir a Takeshita Street/}).getAttribute("aria-pressed"),"true");
    await page.evaluate(()=>{window.__failReview=true;});
    await takeshita.click();await failure.waitFor();
    assert.equal(await takeshita.getAttribute("aria-pressed"),"true","failed removal changed durable pressed state");
    assert.equal(await page.getByText("Interés retirado").count(),0,"failed removal exposed false Undo");
    await page.evaluate(()=>{window.__failReview=false;});
    await failure.getByRole("button",{name:"Reintentar guardar"}).click();
    await page.getByText("Interés retirado").waitFor();
    assert.equal(await takeshita.getAttribute("aria-pressed"),"false");
    await page.goto(`${baseURL}#/viaje`,{waitUntil:"networkidle"});
    const takeshitaItem=page.locator('[data-place-id="JP-004"]');
    await takeshitaItem.getByRole("button",{name:"Quitar de pendientes"}).click();
    await takeshitaItem.waitFor({state:"detached"});

    const shibuyaItem=page.locator('[data-place-id="JP-001"]');
    await shibuyaItem.getByRole("button",{name:"Descartar del viaje"}).click();
    await shibuyaItem.getByRole("button",{name:"Restablecer mi respuesta"}).click();
    await page.goto(`${baseURL}#/explorar?q=Shibuya%20Crossing`,{waitUntil:"networkidle"});
    await page.getByRole("button",{name:/Quiero ir a Shibuya Crossing/}).click();
    const reconsider=page.getByRole("alertdialog",{name:"¿Volver a considerar este lugar?"});
    await reconsider.getByRole("button",{name:"Cancelar"}).click();
    let shibuya=await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-001"]);
    assert.equal(shibuya.disposition,"discarded");assert.equal(shibuya.votes.ella,"unreviewed");
    await page.getByRole("button",{name:/Quiero ir a Shibuya Crossing/}).click();
    await reconsider.getByRole("button",{name:"Confirmar"}).click();
    shibuya=await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-001"]);
    assert.equal(shibuya.disposition,"candidate");assert.equal(shibuya.votes.ella,"yes");assert.equal(shibuya.votes.fernando,"yes");
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.savedPlaceIds")),rawLegacy);
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.manualPlanningDraft")),rawDraft);
  });

  await runJourney("10-sol5-our-trip", "Our Trip deliberate review and planning bridge", { width:390, height:844 }, async page => {
    const review={schema:"nihon.astra.review",version:1,activeReviewer:"fernando",places:{
      "JP-001":{placeId:"JP-001",votes:{fernando:"yes",ella:"yes"},inReviewQueue:true,legacy:false},
      "JP-002":{placeId:"JP-002",votes:{fernando:"yes",ella:"unreviewed"},inReviewQueue:true,legacy:false},
      "JP-003":{placeId:"JP-003",votes:{fernando:"no",ella:"yes"},inReviewQueue:true,legacy:false},
      "JP-004":{placeId:"JP-004",votes:{fernando:"no",ella:"no"},inReviewQueue:true,legacy:false},
      "JP-005":{placeId:"JP-005",votes:{fernando:"unreviewed",ella:"unreviewed"},inReviewQueue:true,legacy:false,disposition:"discarded"},
      "JP-006":{placeId:"JP-006",votes:{fernando:"unreviewed",ella:"unreviewed"},inReviewQueue:true,legacy:false}
    }};
    const rawLegacy='["JP-021"]';
    await page.addInitScript(({review,rawLegacy})=>{if(!sessionStorage.getItem("astra-sol5-fixture-seeded")){localStorage.setItem("nihon.astra.review.v1",JSON.stringify(review));localStorage.setItem("nihon.savedPlaceIds",rawLegacy);sessionStorage.setItem("astra-sol5-fixture-seeded","1");}const original=Storage.prototype.setItem;window.__failReview=false;Storage.prototype.setItem=function(k,v){if(window.__failReview&&k==="nihon.astra.review.v1")throw new DOMException("SOL-5 audit failure","QuotaExceededError");return original.call(this,k,v);};},{review,rawLegacy});
    await page.goto(`${baseURL}#/viaje`,{waitUntil:"networkidle"});
    assert.equal(await page.getByRole("button",{name:"Intereses"}).getAttribute("aria-pressed"),"true");
    assert.equal((await page.locator(".astra-trip__counts div").nth(0).textContent())?.replace(/\s/g,""),"1Ambos");
    assert.equal((await page.locator(".astra-trip__counts div").nth(1).textContent())?.replace(/\s/g,""),"3Porcomparar");
    const grouped=await page.locator(".astra-trip__group [data-place-id]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-place-id")));
    assert.equal(new Set(grouped).size,grouped.length,"grouped default duplicated an ID");
    for(const name of ["Todos","Ambos","Fernando","Ella","Pendientes","Descartados"]){await page.getByRole("button",{name,exact:true}).click();}
    await page.getByLabel("Más").selectOption({label:"Ninguno"});assert.equal(await page.locator('[data-place-id="JP-004"]').count(),1);
    await page.getByLabel("Más").selectOption({label:"Gustos diferentes"});assert.equal(await page.locator('[data-place-id="JP-003"]').count(),1);
    await page.getByRole("button",{name:"Todos",exact:true}).click();
    await page.getByLabel("Persona activa").selectOption("ella");
    const queueOpener=page.getByRole("button",{name:"Revisar pendientes"});await queueOpener.focus();await queueOpener.click();
    const queue=page.getByRole("dialog",{name:"Revisar pendientes"});await queue.getByText("1 de 3").waitFor();
    const beforeQueue=await page.evaluate(()=>localStorage.getItem("nihon.astra.review.v1"));await queue.getByRole("button",{name:"Siguiente"}).click();await queue.getByText("2 de 3").waitFor();await queue.getByRole("button",{name:"Anterior"}).click();assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.astra.review.v1")),beforeQueue,"queue navigation emitted a vote");await queue.getByRole("button",{name:"Quiero ir"}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-002"].votes.ella),"yes","explicit queue response did not vote");
    await page.keyboard.press("Escape");assert.equal(await queueOpener.evaluate(element=>document.activeElement===element),true,"queue focus was not restored");await page.getByLabel("Persona activa").selectOption("fernando");
    await page.getByRole("button",{name:"Seleccionar"}).click();const check=page.getByRole("checkbox",{name:/Seleccionar Shibuya Crossing/});await check.check();assert.equal(await page.getByText("1 seleccionados").count(),1);
    const preselect=page.getByRole("button",{name:"Preseleccionar"});await preselect.focus();await preselect.click();const batch=page.getByRole("dialog",{name:/Confirmar preselección/});assert.equal(await batch.getByText("1 lugares").count(),1);await batch.getByText("Revisar nombres").click();assert.equal(await batch.getByText("Shibuya Crossing").count(),1);
    await page.evaluate(()=>{window.__failReview=true;});await batch.getByRole("button",{name:"Confirmar"}).click();assert.equal(await batch.getByRole("alert").count(),1);assert.equal(await page.getByText("Cambios guardados").count(),0,"failed batch exposed Undo");
    await page.evaluate(()=>{window.__failReview=false;});await batch.getByRole("button",{name:"Reintentar guardar"}).click();await batch.waitFor({state:"detached"});await page.getByText("Cambios guardados").waitFor();await page.getByText("Cambios guardados").getByRole("button",{name:"Deshacer"}).click();
    const votes=await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-001"].votes);assert.deepEqual(votes,{fernando:"yes",ella:"yes"},"batch modified votes");
    await page.getByRole("button",{name:"Descartados",exact:true}).click();const discarded=page.locator('[data-place-id="JP-005"]');await discarded.getByRole("button",{name:/Quiero ir/}).click();const reconsider=page.getByRole("alertdialog",{name:"¿Volver a considerar este lugar?"});await reconsider.getByRole("button",{name:"Cancelar"}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("nihon.astra.review.v1")).places["JP-005"].disposition),"discarded");
    await page.getByRole("button",{name:"Planificar"}).click();assert.equal(await page.getByText("No incluye traslados").count(),1);assert.equal(await page.getByRole("button",{name:"Construir recorrido"}).count(),1);await page.getByRole("button",{name:"Ver distribución y tiempos"}).click();await page.getByRole("dialog").waitFor();await page.keyboard.press("Escape");
    const draft={version:7,routeIds:["JP-001"],days:null,startDate:"2027-02-19",endDate:"2027-02-20",visitStartTimes:{"JP-001":"09:30"},accommodations:[],accommodationLegs:[],interHubSegments:[]};const rawDraft=JSON.stringify(draft);await page.evaluate(raw=>localStorage.setItem("nihon.manualPlanningDraft",raw),rawDraft);
    await page.getByRole("button",{name:"Intereses"}).click();await page.getByRole("button",{name:"Planificar"}).click();assert.equal(await page.getByRole("button",{name:"Continuar recorrido"}).count(),1);assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.manualPlanningDraft")),rawDraft);
    await page.getByRole("button",{name:"Dónde alojarnos"}).click();assert.equal(await page.getByText(/comparación de zonas llegará/).count(),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem("nihon.savedPlaceIds")),rawLegacy);
    await page.evaluate(()=>{localStorage.setItem("nihon.astra.review.v1",JSON.stringify({schema:"nihon.astra.review",version:1,activeReviewer:"fernando",places:{}}));localStorage.removeItem("nihon.manualPlanningDraft");localStorage.removeItem("nihon.savedPlaceIds");});await page.reload({waitUntil:"networkidle"});assert.equal(await page.getByRole("heading",{name:"Su viaje empieza con un lugar"}).count(),1,"Todos empty heading missing");assert.equal(await page.getByRole("button",{name:"Explorar Japón"}).count(),1,"Todos empty state missing");await page.getByRole("button",{name:"Descartados",exact:true}).click();assert.equal(await page.getByText("No han descartado lugares.").count(),1);
    await page.evaluate(()=>localStorage.setItem("nihon.astra.review.v1",JSON.stringify({schema:"nihon.astra.review",version:1,activeReviewer:"fernando",places:{"JP-001":{placeId:"JP-001",votes:{fernando:"yes",ella:"unreviewed"},inReviewQueue:true,legacy:false}}})));await page.reload({waitUntil:"networkidle"});await page.getByRole("button",{name:"Ambos",exact:true}).click();assert.equal(await page.getByText("Todavía no hay coincidencias. Revisen lo que le gusta al otro.").count(),1);assert.equal(await page.getByRole("button",{name:"Ver pendientes"}).count(),1);await page.getByRole("button",{name:"Ella",exact:true}).click();assert.equal(await page.getByRole("button",{name:"Quitar filtros"}).count(),1);
    await page.evaluate(value=>localStorage.setItem("nihon.astra.review.v1",JSON.stringify(value)),review);await page.reload({waitUntil:"networkidle"});
    for(const [label,width,height] of [["320",320,800],["390",390,844],["tablet",768,1024],["desktop",1440,900]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${label}: Our Trip horizontal overflow`);await page.screenshot({path:`${outputRoot}/screenshots/10-sol5-${label}.png`,fullPage:true});}
  });
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

const summary = { schemaVersion:1, auditedSha:actualSha, generatedAt:new Date().toISOString(), baseURL, results };
await writeFile(`${outputRoot}/results.json`, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(`${outputRoot}/summary.md`, [
  "# Astra SOL-0–SOL-5 browser audit", "", `Audited SHA: \`${actualSha}\``, "",
  ...results.map(result => `- **${result.status}** ${result.id}: ${result.name}${result.error ? ` — ${result.error.split("\n")[0]}` : ""}`), "",
  "Automated evidence is not independent visual approval; Astra must inspect screenshots and traces.",
].join("\n"));
if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
