import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';

// B10 L4: computed styles, boxes and pixels of the tokenized alert primitive.
// Every state is an existing record. Snapshots are separate from historical certificates.
const out = process.env.NIHON_B10_OUT ?? 'logs/b10-alerts';
mkdirSync(out, { recursive: true });
const engine = process.env.NIHON_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ executablePath: engine === chromium ? process.env.NIHON_CHROMIUM_PATH : process.env.NIHON_WEBKIT_PATH });
const server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), build: { outDir: process.env.NIHON_B10_DIST ?? 'dist' }, preview: { host: '127.0.0.1', port: 0 } });
const places = JSON.parse(readFileSync(new URL('../src/data/places.json', import.meta.url)));
const rows = [];
try {
  for (const width of [320, 390, 839, 840, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 1440 ? 900 : 844 } });
    await context.addInitScript(() => localStorage.setItem('nihon.onboarding.seen.v1', '1'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const id of ['JP-051', 'JP-052']) {
      const place = places.find(p => p.id === id);
      await page.goto(server.resolvedUrls.local[0]);
      await page.locator('.explorer-home__search-button').click();
      await page.locator('.search-sheet__field input').fill(place.name);
      await page.locator('.search-sheet .place-card__open').first().click();
      const alert = page.locator('.place-detail .alert');
      await alert.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await alert.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const snapshot = await alert.evaluate(root => [root, ...root.querySelectorAll('*')].map(el => {
        const style = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { tag: el.tagName, class: el.className, text: el.textContent, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, style: Object.fromEntries([...style].map(key => [key, style.getPropertyValue(key)])) };
      }));
      const png = await alert.screenshot({ path: `${out}/${width}-${id}.png` });
      assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), 0);
      assert.deepEqual(errors, []);
      rows.push({ width, id, snapshot, png: createHash('sha256').update(png).digest('hex') });
    }
    await context.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(rows, null, 2));
  if (process.env.NIHON_B10_COMPARE) assert.deepEqual(rows, JSON.parse(readFileSync(process.env.NIHON_B10_COMPARE)), 'exact alert styles, boxes, content and pixels');
  console.log(`B10 alerts: ${rows.length} states, ${process.env.NIHON_B10_COMPARE ? 'exact parity PASS' : 'baseline recorded'}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
