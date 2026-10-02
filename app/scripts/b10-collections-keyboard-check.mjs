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
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('nihon.onboarding.seen.v1', '1'));
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' });
    await page.locator('.explorer-home__collection').first().waitFor();
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
      results.push({ width, index, title: await collection.locator('h3').first().textContent(), cards, controls, steps, visited });
    }
    await page.screenshot({ path: `${out}/${width}.png` });
    await page.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ visited, ...row }) => row)));
} finally { await browser.close(); await server.close(); }
