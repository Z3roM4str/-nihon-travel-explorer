// Recorrido del guion de IPHONE_SYNTHETIC_CHECK.md contra cualquier URL servida de Nihon (build de la rama),
// con Playwright. Cubre lo automatizable: introducción → favorito → recarga → cierre/reapertura del contexto con el
// MISMO perfil → dos pestañas → exportar → importar. NO certifica iPhone: es la comprobación previa del guion.
//   NIHON_PREVIEW_URL=http://127.0.0.1:4400/-nihon-travel-explorer/ [NIHON_BROWSER=webkit|chromium] [NIHON_CHROMIUM_PATH]
import { chromium, webkit } from 'playwright';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ = process.env.NIHON_PREVIEW_URL;
if (!URL_) throw new Error('NIHON_PREVIEW_URL is required');
const type = process.env.NIHON_BROWSER === 'webkit' ? webkit : chromium;
const launch = process.env.NIHON_CHROMIUM_PATH && type === chromium ? { executablePath: process.env.NIHON_CHROMIUM_PATH } : {};
const profile = mkdtempSync(join(tmpdir(), 'nihon-preview-'));
const ctxOptions = { viewport: { width: 390, height: 844 }, acceptDownloads: true };
const results = [];
const step = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log('OK  ', name, detail ?? ''); }
  catch (error) { results.push({ name, ok: false, error: String(error.message).slice(0, 300) }); console.log('FAIL', name, String(error.message).split('\n')[0]); }
};
const SAVED = 'button[aria-label="Quitar Ghibli Museum, Mitaka de Quiero ir"][aria-pressed="true"]';
const ADD = 'button[aria-label="Quiero ir: Ghibli Museum, Mitaka"]';
const interests = (page) => page.evaluate(() => { const r = localStorage.getItem('nihon.travellers.v1'); return r ? JSON.parse(r).interests.map((i) => i.placeId).sort() : null; });
async function openApp(page) { await page.goto(URL_); await page.waitForSelector('.onboarding__dialog, button:has-text("Nosotros")', { state: 'attached', timeout: 15000 }); }

let context = await type.launchPersistentContext(profile, { ...launch, ...ctxOptions });
let page = await context.newPage();
await step('1 abre y muestra la introducción', async () => { await openApp(page); await page.waitForSelector('.onboarding__dialog'); });
await step('2 «Saltar» cierra la introducción', async () => { await page.getByRole('button', { name: 'Saltar' }).click(); await page.waitForSelector('.onboarding__dialog', { state: 'detached' }); });
await step('3 favorito: Ghibli Museum', async () => {
  const add = page.locator(ADD).first();
  if (!(await add.count())) { await page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/)).first().fill('Ghibli'); }
  await page.locator(ADD).first().click(); await page.waitForSelector(SAVED);
  return await interests(page);
});
await step('4 recarga: favorito conservado y sin introducción', async () => {
  await page.reload(); await page.waitForSelector(SAVED, { timeout: 15000 });
  if (await page.locator('.onboarding__dialog').count()) throw new Error('la introducción reapareció');
});
await page.waitForTimeout(3000); // supera el commit diferido del motor y la confirmación del diario
await context.close();
context = await type.launchPersistentContext(profile, { ...launch, ...ctxOptions });
page = await context.newPage();
await step('5 cierre y reapertura del perfil: favorito conservado', async () => {
  await openApp(page); await page.waitForSelector(SAVED, { timeout: 15000 }); return await interests(page);
});
await step('6 quitar, esperar, cerrar y reabrir: sigue quitado', async () => {
  await page.locator(SAVED).first().click(); await page.waitForSelector(ADD); await page.waitForTimeout(3000);
  await context.close(); context = await type.launchPersistentContext(profile, { ...launch, ...ctxOptions }); page = await context.newPage();
  await openApp(page); await page.waitForSelector(ADD, { timeout: 15000 });
  if ((await interests(page))?.includes('JP-044')) throw new Error('JP-044 reapareció');
});
await step('7 volver a guardar y recargar', async () => { await page.locator(ADD).first().click(); await page.waitForSelector(SAVED); await page.waitForTimeout(1500); await page.reload(); await page.waitForSelector(SAVED, { timeout: 15000 }); });
await step('8 dos pestañas: cada una ve lo que guarda la otra y no se pierde nada', async () => {
  const other = await context.newPage(); await openApp(other); await other.waitForSelector(SAVED, { timeout: 15000 });
  // la segunda pestaña guarda otro lugar por la ruta de la aplicación (la tarjeta de otro lugar)
  const another = other.locator('button[aria-label^="Quiero ir: "]').first();
  const label = await another.getAttribute('aria-label'); await another.click();
  await other.waitForSelector(`button[aria-label="${label.replace('Quiero ir: ', 'Quitar ')} de Quiero ir"][aria-pressed="true"]`);
  await page.bringToFront(); await page.waitForTimeout(1500);
  const both = await interests(page);
  if (both.length < 2 || !both.includes('JP-044')) throw new Error('perdido: ' + JSON.stringify(both));
  await other.close(); return both;
});
await step('9 exportar respaldo', async () => {
  await page.getByRole('button', { name: /Nosotros/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar respaldo' }).click()]);
  const path = join(profile, 'backup.json'); await download.saveAs(path);
  const parsed = JSON.parse(readFileSync(path, 'utf8')); writeFileSync(join(profile, 'backup-name.txt'), download.suggestedFilename());
  if (!JSON.stringify(parsed).includes('JP-044')) throw new Error('el respaldo no contiene JP-044');
  return download.suggestedFilename();
});
await step('10 importar el mismo respaldo (sustituir)', async () => {
  await page.setInputFiles('input[type="file"]', join(profile, 'backup.json'));
  await page.getByRole('button', { name: 'Sustituir con este respaldo' }).click();
  await page.getByText('Respaldo restaurado en este navegador.').waitFor();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForLoadState('load'); await page.waitForTimeout(1000);
  const after = await interests(page); if (!after?.includes('JP-044')) throw new Error('tras importar: ' + JSON.stringify(after)); return after;
});
await context.close();
const failed = results.filter((r) => !r.ok);
console.log(`RESULT ${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
