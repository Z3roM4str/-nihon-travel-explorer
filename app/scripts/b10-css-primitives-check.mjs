import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';

// Exercise the actual compiled global rules with identical fixtures in two builds.
// Computed styles (including pseudo-elements), boxes and rendered pixels all participate.
const root = process.env.NIHON_APP_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const out = process.env.NIHON_B10_OUT ?? '/tmp/b10-css-primitives';
const engine = process.env.NIHON_BROWSER === 'webkit' ? webkit : chromium;
mkdirSync(out, { recursive: true });
const server = await preview({ root, preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
const browser = await engine.launch({ executablePath: engine === webkit ? process.env.NIHON_WEBKIT_PATH : process.env.NIHON_CHROMIUM_PATH });
const results = [];
try {
  for (const width of [320, 390, 1440]) for (const motion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: motion });
    await page.route('**/*', r => r.request().url().startsWith(server.resolvedUrls.local[0]) ? r.continue() : r.fulfill({ status: 204, body: '' }));
    await page.addInitScript(() => localStorage.setItem('nihon.onboarding.seen.v1', '1'));
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      document.getElementById('root').remove();
      const fixture = document.createElement('main'); fixture.id = 'fixture';
      fixture.innerHTML = '<h1>Primitivos existentes</h1><p>Texto <a href="#fixture">enlace</a></p>' +
        ['primary', 'secondary', 'quiet', 'danger'].map(v => `<button class="button button--${v}">${v}</button><button class="button button--${v}" disabled>${v} disabled</button>`).join('') +
        '<button class="icon-button">+</button><button class="link-button">Enlace</button><button class="link-button tap-target-min">Target</button><button class="button button--lg button--primary">Primaria</button><span class="person-token">A</span><span class="visually-hidden">Oculto accesible</span>';
      document.body.append(fixture);
    });
    for (const state of ['base', 'hover', 'focus', 'active']) {
      const control = page.locator('.button--primary:not(:disabled)').first();
      if (state === 'hover') await control.hover();
      if (state === 'focus') { await page.mouse.move(width - 1, 899); await page.keyboard.press('Tab'); await control.focus(); }
      if (state === 'active') { await control.hover(); await page.mouse.down(); }
      await page.waitForTimeout(250);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const snapshot = await page.locator('#fixture').evaluate(el => [el, ...el.querySelectorAll('*')].map(node => {
        const r = node.getBoundingClientRect();
        const styles = [null, '::before', '::after'].map(pseudo => {
          const c = getComputedStyle(node, pseudo);
          return Object.fromEntries([...c].sort().map(k => [k, c.getPropertyValue(k)]));
        });
        return { tag: node.tagName, class: node.className, rect: [r.x, r.y, r.width, r.height], styles };
      }));
      const name = `${width}-${motion}-${state}`;
      const png = await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
      results.push({ name, snapshot, png: png.toString('base64') });
      if (state === 'active') await page.mouse.up();
    }
    await page.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results));
  if (process.env.NIHON_B10_COMPARE) {
    const before = JSON.parse(readFileSync(process.env.NIHON_B10_COMPARE));
    assert.equal(results.length, before.length);
    for (const row of results) {
      const reference = before.find(r => r.name === row.name);
      assert.deepEqual(row.snapshot, reference.snapshot, `${row.name}: styles/boxes`);
      assert.equal(row.png, reference.png, `${row.name}: rendered pixels`);
    }
  }
  console.log(`Global CSS primitives ${engine === webkit ? 'webkit' : 'chromium'} PASS: ${results.length} states, styles/pseudos/boxes/PNG`);
} finally { await browser.close(); await server.close(); }
