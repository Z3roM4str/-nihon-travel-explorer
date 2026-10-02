import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
const out = process.env.NIHON_B10_OUT ?? '/tmp/b10-collections';
mkdirSync(out, { recursive: true });
const server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const engine = process.env.NIHON_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ executablePath: engine === webkit ? process.env.NIHON_WEBKIT_PATH : process.env.NIHON_CHROMIUM_PATH });
const results = [];
try {
  for (const width of [320, 390, 1440]) {
   for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 }, reducedMotion });
    await page.addInitScript(() => localStorage.setItem('nihon.onboarding.seen.v1', '1'));
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' });
    await page.locator('.explorer-home__collection').first().waitFor();
    assert.equal(await page.locator('.explorer-home__collection button').count(), 312);
    const historyLength = await page.evaluate(() => history.length);
    const collections = page.locator('.explorer-home__collection');
    for (let index = 0; index < await collections.count(); index++) {
      const collection = collections.nth(index);
      const cards = await collection.locator('.place-card').count();
      const controls = await collection.locator('button').count();
      await collection.locator('button').first().focus();
      let steps = 0; const visited = [];
      while (await collection.evaluate(el => el.contains(document.activeElement))) {
        visited.push(await page.evaluate(() => ({ name: document.activeElement.getAttribute('aria-label'), class: document.activeElement.className })));
        await page.keyboard.press('Tab'); steps++;
        assert.ok(steps <= controls + 1, 'keyboard must leave the collection');
      }
      assert.equal(steps, controls, 'every control remains on the real Tab path');
      assert.equal(controls, cards * 2, 'opening and Quiero ir remain available per card');
      const skip = collection.getByRole('link');
      const target = index < 3 ? collections.nth(index + 1).locator('.explorer-home__collection-title') : page.locator('#japan-map-heading');
      await skip.focus();
      assert.equal(await skip.textContent().then(s => s.trim()), index < 3 ? 'Saltar a la siguiente colección' : 'Saltar al mapa de Japón');
      assert.ok((await skip.getAttribute('href')).startsWith('#'));
      await skip.press('Enter');
      assert.ok(await target.evaluate(el => el === document.activeElement && el.matches(':focus-visible')));
      const geometry = await target.evaluate(el => { const r=el.getBoundingClientRect(), search=document.querySelector('.explorer-home__search-bar').getBoundingClientRect();return {top:r.top,bottom:r.bottom,searchBottom:search.bottom,outline:getComputedStyle(el).outlineStyle}; });
      assert.ok(geometry.top >= geometry.searchBottom, 'heading clears sticky search');
      assert.ok(geometry.bottom <= (width === 320 ? 568 : width === 390 ? 844 : 900));
      assert.equal(geometry.outline,'solid');
      assert.equal(await page.evaluate(() => history.length),historyLength,'skip preserves detail history');
      await page.keyboard.press('Tab');
      const nextControl = index < 3 ? collections.nth(index + 1).getByRole('link') : page.locator('.explorer-home__map-card');
      assert.ok(await nextControl.evaluate(el => el === document.activeElement),'Tab resumes at destination');
      results.push({ reducedMotion, geometry, width, index, title: await collection.locator('h3').first().textContent(), cards, controls, steps, visited });
    }
    await page.screenshot({ path: `${out}/${width}-${reducedMotion}.png` });
    await page.close();
   }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ visited, ...row }) => row)));
} finally { await browser.close(); await server.close(); }
