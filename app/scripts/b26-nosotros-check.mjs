import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const app = new URL("..", import.meta.url).pathname;
const out = process.env.NIHON_B26_SHOTS;
if (out) mkdirSync(out, { recursive: true });
const server = await preview({ root: app, preview: { host: "127.0.0.1", port: 0 } });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.NIHON_CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const errors = [];
const results = [];
const check = (name, ok) => { results.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${name}`); };
const doc = { version: 1, travellers: [{ id: "a", label: "Akari" }, { id: "b", label: "Benjamín de nombre muy largo" }], activeTravellerId: "a", interests: [{ placeId: "JP-001", carriedOver: false, stances: [{ travellerId: "a", stance: "interested" }] }, { placeId: "JP-002", carriedOver: false, stances: [{ travellerId: "a", stance: "interested" }, { travellerId: "b", stance: "interested" }] }] };
for (const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:820,height:1180},{width:1024,height:768},{width:1280,height:800},{width:1440,height:900}]) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((seed) => { localStorage.setItem("nihon.onboarding.seen.v1", "1"); localStorage.setItem("nihon.travellers.v1", JSON.stringify(seed)); }, doc);
  const page = await context.newPage(); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.getByRole("button", { name: /Nosotros/ }).click();
  check(`${viewport.width} sin overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check(`${viewport.width} cinco secciones`, await page.locator(".nosotros-section").count() === 5);
  if (viewport.width === 390) {
    check("dos tarjetas y PersonToken md", await page.locator(".traveller-manager__item .person-token--md").count() === 2);
    check("contadores reales", (await page.locator(".traveller-manager__item").nth(0).innerText()).includes("Marcados: 2 lugares") && (await page.locator(".traveller-manager__item").nth(1).innerText()).includes("Marcados: 1 lugares"));
    await page.getByRole("button", { name: "Usar en este teléfono" }).click();
    check("cambio activo persistente", (await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.travellers.v1")).activeTravellerId)) === "b");
    const input = page.getByLabel("Nombre").first(); await input.fill("Aiko"); check("edición de nombre", (await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.travellers.v1")).travellers[0].label)) === "Aiko");
    check("backup y reemplazo inequívoco", await page.getByRole("button", { name: "Exportar respaldo" }).isVisible() && (await page.locator(".trip-backup__note--warning").innerText()).includes("sustituirá"));
    check("MLIT, fotografía, dataset y versión app", (await page.locator(".destination-panel:not([hidden])").innerText()).includes("N03, 2026") && (await page.locator(".destination-panel:not([hidden])").innerText()).includes("244 fotografías") && (await page.locator(".destination-panel:not([hidden])").innerText()).includes("Nihon-Base-Maestra-v2.xlsx") && (await page.locator(".destination-panel:not([hidden])").innerText()).includes("versión 1.1.0"));
    await page.getByRole("button", { name: "Ver de nuevo" }).click();
    for (let i=0;i<4;i++) await page.getByRole("button", { name: "Siguiente" }).click();
    check("onboarding identidad", await page.getByText("¿Quién tiene este teléfono?").isVisible() && await page.locator(".onboarding__name input").count() === 2);
    await page.locator(".onboarding__name input").first().fill("Akiko"); await page.getByLabel(/Benjamín/).check(); await page.getByRole("button", { name: "Entrar" }).click();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("nihon.travellers.v1")));
    check("onboarding guarda mismo documento", after.travellers[0].label === "Akiko" && after.activeTravellerId === "b" && after.interests.length === 2);
    if (out) await page.screenshot({ path: `${out}/nosotros-390.png`, fullPage: true });
  }
  const tooSmall = await page.locator("button:visible, input:visible, summary:visible").evaluateAll(els => els.filter(e => { const r=e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
  check(`${viewport.width} targets`, tooSmall === 0);
  await context.close();
}
check("sin errores de consola", errors.length === 0);
await browser.close(); await server.close();
if (results.some(v => !v)) process.exitCode = 1;
