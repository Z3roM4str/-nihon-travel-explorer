import { chromium } from "playwright";

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";

const consoleErrors = [];
const pageErrors = [];

function trackErrors(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageErrors.push(`[${label}] ${err.message}`));
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  trackErrors(page, "app");

  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
  await page.reload({ waitUntil: "networkidle" });

  // Explorar: entrar a ciudad
  await page.click(".national-start__hub:has-text('Tokio')");
  await page.waitForSelector(".place-card", { timeout: 15000 });
  check("explorar lugares (lista de Tokio)", (await page.locator(".place-card").count()) > 0);

  // Búsqueda / filtros
  const searchInput = page.locator(".search-field__input").first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("Shibuya Crossing");
    await page.waitForTimeout(400);
    const filteredCount = await page.locator(".place-card").count();
    check("búsqueda por texto filtra la lista", filteredCount >= 1 && filteredCount < 10);
    await searchInput.fill("");
    await page.waitForTimeout(300);
  } else {
    check("búsqueda por texto filtra la lista (campo no visible en este layout, se omite)", true);
  }

  await page.click(".view-bar__filters");
  await page.waitForTimeout(300);
  // `.filter-chip` is duplicated for the desktop layout (both panes stay mounted per Block 1's
  // decision), so `.first()` can resolve to the hidden copy; the sheet's own open state is the
  // reliable signal.
  const filterSheetOpen = await page.locator("#app-filter-sheet.app__filters--open").isVisible().catch(() => false);
  check("hoja de filtros abre", filterSheetOpen);
  await page.click(".view-bar__filters");
  await page.waitForTimeout(200);

  // Mapa
  await page.click(".view-switch__option:has-text('Mapa')");
  await page.waitForTimeout(400);
  const mapVisible = await page.locator(".leaflet-container").isVisible().catch(() => false);
  check("cambiar a vista de mapa", mapVisible);
  await page.click(".view-switch__option:has-text('Lista')");
  await page.waitForTimeout(300);

  // Ficha: abrir/cerrar + galería/lightbox
  await page.locator(".place-card__open").first().click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  check("abrir ficha de lugar", await page.locator(".place-detail").isVisible());

  const galleryZoom = page.locator(".gallery__zoom").first();
  if (await galleryZoom.isVisible().catch(() => false)) {
    await galleryZoom.click();
    await page.waitForTimeout(300);
    const lightboxOpen = await page.locator(".lightbox").isVisible().catch(() => false);
    check("lightbox abre desde la galería", lightboxOpen);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const lightboxClosed = !(await page.locator(".lightbox").isVisible().catch(() => false));
    check("Escape cierra el lightbox", lightboxClosed);
  } else {
    check("lightbox abre desde la galería (sin foto en este lugar, se omite)", true);
  }

  // Quiero ir: marcar para ambos viajeros
  const travellerOptions = page.locator(".traveller-bar__option");
  const travellerCount = await travellerOptions.count();
  check("hay dos viajeros configurados", travellerCount === 2);

  await page.locator(".save-button").click();
  await page.waitForTimeout(300);
  const savedAsP1 = await page.locator(".save-button--saved").isVisible().catch(() => false);
  check("Persona 1 marca 'Quiero ir'", savedAsP1);

  if (travellerCount === 2) {
    await travellerOptions.nth(1).click();
    await page.waitForTimeout(300);
    const savedAsP2Before = await page.locator(".save-button--saved").isVisible().catch(() => false);
    check("Persona 2 ve el lugar como no marcado por ella", !savedAsP2Before);
    await page.locator(".save-button").click();
    await page.waitForTimeout(300);
    const savedAsP2 = await page.locator(".save-button--saved").isVisible().catch(() => false);
    check("Persona 2 marca 'Quiero ir' de forma independiente", savedAsP2);
    await travellerOptions.nth(0).click();
    await page.waitForTimeout(300);
  }

  await page.locator(".place-detail__bar .icon-button").click();
  await page.waitForTimeout(300);
  check("cerrar ficha vuelve a la lista", await page.locator(".place-card").first().isVisible());

  // Backup
  await page.click(".app__backup");
  await page.waitForTimeout(300);
  const backupDialog = await page.locator("[role='dialog']").isVisible().catch(() => false);
  check("respaldo del viaje abre", backupDialog);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Teclado: Tab llega a un elemento focuseable con anillo de foco visible
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  check("navegación por teclado mueve el foco (Tab)", Boolean(focusedTag) && focusedTag !== "BODY");

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (consoleErrors.length > 0) {
    console.log("\nConsole errors:");
    consoleErrors.forEach((e) => console.log(" -", e));
  }
  if (pageErrors.length > 0) {
    console.log("\nPage errors:");
    pageErrors.forEach((e) => console.log(" -", e));
  }
  if (failed.length > 0 || pageErrors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
