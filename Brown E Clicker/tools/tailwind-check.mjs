// Finds Tailwind classes that only exist at run time (built by string joins in the game code), which the CSS build
// (tools/tailwind.sh) cannot see in the sources. It plays the game with the browser-side Tailwind compiler, opens every
// panel, collects every class the page ever uses, and prints the ones that compiler made a rule for but
// src/css/05-tailwind.css lacks. Put those in tools/tailwind-safelist.txt and run tools/tailwind.sh again.
//   NODE_PATH=/opt/node22/lib/node_modules node "Brown E Clicker/tools/tailwind-check.mjs"        (prints nothing new = fine)
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const DIR = decodeURIComponent(new URL('../', import.meta.url).pathname), TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const css = fs.readFileSync(DIR + 'src/css/05-tailwind.css', 'utf8');
// the game as built, but with the browser-side compiler put back in so both can be compared
const html = fs.readFileSync(DIR + 'index.html', 'utf8').replace(/<head[^>]*>/i, m => m + '<script src="https://cdn.tailwindcss.com"></script>');
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); });
await new Promise(res => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch();
const seen = new Set(), jit = new Set();
for (const variant of ['', '?variant=rb']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  await page.addInitScript(() => {
    window.__cls = new Set();
    const grab = () => document.querySelectorAll('[class]').forEach(e => String(e.getAttribute('class')).split(/\s+/).forEach(c => c && window.__cls.add(c)));
    new MutationObserver(grab).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    addEventListener('DOMContentLoaded', grab);
  });
  await page.goto('http://127.0.0.1:' + server.address().port + '/' + variant); await page.waitForTimeout(1500);
  // a rich save state so every panel has content, then click through everything that opens something
  await page.evaluate(() => { try { document.getElementById('start-btn').click(); } catch (e) {} });
  await page.waitForTimeout(500);
  for (let round = 0; round < 3; round++) {
    await page.evaluate(r => {
      const C = window.__clicker; if (!C) return;
      try { C.state.brownEs = [1e6, 1e15, 1e30][r]; C.state.life.earned = C.state.brownEs; if (C.state.meta) { C.state.meta.chips = 1e7; C.state.meta.chipsTotal = 1e7; C.state.meta.ascensions = 3; } } catch (e) {}
      try { C.tick(30); } catch (e) {}
    }, round);
    const ids = await page.evaluate(() => [...document.querySelectorAll('button[id], [role=button][id]')].map(b => b.id).filter(id => !/reset|wipe|import|asc-confirm|chal-quit|variant|hard/i.test(id)));
    for (const id of ids) {
      await page.evaluate(id => { const b = document.getElementById(id); if (b && b.offsetParent) { try { b.click(); } catch (e) {} } }, id);
      await page.waitForTimeout(60);
      await page.evaluate(() => document.querySelectorAll('[id$="-close"]').forEach(b => { if (b.offsetParent) { try { b.click(); } catch (e) {} } }));
    }
    await page.evaluate(() => { document.querySelectorAll('.shop-item, [data-id], [data-node], [data-tab]').forEach((e, i) => { if (i < 400) { try { e.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); e.click(); } catch (x) {} } }); try { window.__clicker.tick(20); } catch (e) {} });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('style')].map(s => s.textContent).filter(t => /tailwindcss|--tw-/.test(t)).join('\n');
    return { cls: [...window.__cls], sheet };
  });
  r.cls.forEach(c => { seen.add(c); if (r.sheet.includes('.' + CSS_escape(c))) jit.add(c); });
  await page.close();
}
function CSS_escape(s) { return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1').replace(/^(\d)/, '\\3$1 '); }
const missing = [...jit].filter(c => !css.includes('.' + CSS_escape(c))).sort();
console.log(`classes seen at run time: ${seen.size}, with a Tailwind rule: ${jit.size}, missing from the built CSS: ${missing.length}`);
if (missing.length) console.log(missing.join('\n'));
await browser.close(); server.close();
process.exit(missing.length ? 1 : 0);
