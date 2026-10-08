import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Control independiente: un PID nuevo no demuestra que el botón haya solicitado una navegación.
// NIHON_AUDIT_REF=WORKTREE comprueba la corrección; por defecto reproduce el HEAD auditado.
const root = fileURLToPath(new URL('../..', import.meta.url));
const ref = process.env.NIHON_AUDIT_REF ?? '6a87a7f5b35e8e73603288b5a716bdd8e4f706e6';
const source = ref === 'WORKTREE'
  ? readFileSync(new URL('../../app/scripts/lib/h03-reload.mjs', import.meta.url), 'utf8')
  : execFileSync('git', ['show', `${ref}:app/scripts/lib/h03-reload.mjs`], { cwd: root, encoding: 'utf8' });
const { pressOfferedReload } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { chromium } = createRequire(new URL('../../app/package.json', import.meta.url))('playwright');
const state = { documents: 0 };
const server = createServer((req, res) => {
  state.documents++;
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  res.end('<!doctype html><div data-lazy-failure><button>Recargar la página</button></div>' +
    '<script>let presses=0;document.querySelector("button").onclick=()=>{if(++presses>1)location.reload()}</script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.NIHON_CHROMIUM_PATH ?? '/usr/bin/chromium' });
let passed = false;
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => { window.__beforeReload = true; });
  const reports = [];
  let outcome;
  try {
    const result = await pressOfferedReload({ page, alert: page.locator('[data-lazy-failure]'), proxy: { state },
      networkReplaced: () => true, report: detail => reports.push(detail), timeoutMs: 1000 });
    outcome = `aceptó ${result.attempts} pulsaciones`;
  } catch {
    passed = reports.length === 0;
    outcome = 'fallo estricto';
  }
  console.log(JSON.stringify({ ref, expected: 'fallo estricto sin reintento: primera pulsación sin navegación', outcome, reports, passed }));
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
process.exitCode = passed ? 0 : 1;
