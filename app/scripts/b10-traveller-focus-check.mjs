import assert from 'node:assert/strict';
import playwright from 'playwright';
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';
const engine = process.env.NIHON_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const path = engine === 'webkit' ? process.env.NIHON_WEBKIT_PATH : process.env.NIHON_CHROMIUM_PATH;
const mutant = process.env.NIHON_B10_FOCUS_MUTANT === 'blocked-restoration';
const key = 'nihon.travellers.v1';
const seed = JSON.stringify({version:1, travellers:[{id:'trv-a',label:'Marta'},{id:'trv-b',label:'Kenji'}],activeTravellerId:'trv-a',interests:[]});
const server = await preview({root:fileURLToPath(new URL('..',import.meta.url)),preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const browser = await playwright[engine].launch(path ? {executablePath:path} : {});
try {
  for (let iteration = 1; iteration <= 20; iteration++) {
    const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    try {
      await context.addInitScript(({key,seed,mutant}) => {
        localStorage.setItem(key,seed); localStorage.setItem('nihon.onboarding.seen.v1','1');
        if (mutant) { const focus = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function(...args) { if(this.dataset.focusKey === 'reset-trv-b') return; return focus.apply(this,args); }; }
      },{key,seed,mutant});
      const page = await context.newPage();
      await page.goto(server.resolvedUrls.local[0]);
      await page.locator('.tab-bar:visible').getByRole('button',{name:/Nosotros/}).click();
      const reset = page.locator('[data-focus-key="reset-trv-b"]');
      await reset.click();
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-focus-key')),'cancel-trv-b');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-focus-key')),'reset-trv-b',`iteration ${iteration}: focus must return immediately`);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),seed,'cancel preserves stored preferences');
      console.log(`PASS ${engine} ${iteration}: cancel focus and unchanged storage`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); await server.close(); }
