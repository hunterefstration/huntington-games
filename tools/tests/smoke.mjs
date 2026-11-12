// Smoke test: every game that ships opens without a script error and draws something. Needs no rig: it serves the
// checkout itself (on localhost, so the licence gate lets the games run) and fakes the two CDNs from $HG_TOOLS.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/smoke.mjs                 every game + the hub
//   NODE_PATH=... node tools/tests/smoke.mjs "Tetris" "Minigames/Pong"                only these
//   HG_ROOT=/home/user/hg-release node tools/tests/smoke.mjs                          a release worktree instead
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = process.env.HG_ROOT || new URL('../../', import.meta.url).pathname, TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const rel = eval(/GAMES = (\[[\s\S]*?\])/.exec(fs.readFileSync(new URL('../build-release.py', import.meta.url), 'utf8'))[1]);
const only = process.argv.slice(2), games = only.length ? only : rel.concat(['.']);
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end('no'); } r.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); r.end(b); });
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const g of games) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = TOOLS + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await page.route(/cdn\.tailwindcss\.com/, r => { const f = TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js'; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());                       // nothing else leaves the machine
  let nav = '';
  await page.goto(base + (g === '.' ? '' : g.split('/').map(encodeURIComponent).join('/') + '/') + 'index.html', { timeout: 30000 }).catch(e => { nav = e.message.split('\n')[0]; });
  await page.waitForTimeout(g === '.' ? 2500 : 1800);
  const seen = await page.evaluate(() => ({ text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 80), els: document.querySelectorAll('canvas, button, .game').length, dead: /shut down|not authorized|not licensed/i.test(document.body ? document.body.innerText : '') })).catch(() => ({ text: '', els: 0 }));
  const real = errs.filter(e => !/ResizeObserver loop/.test(e));
  const why = nav ? 'did not load: ' + nav : real.length ? 'script error: ' + real[0] : seen.dead ? 'the licence screen showed' : !seen.els ? 'nothing on the page (no canvas or buttons)' : '';
  console.log((why ? 'FAIL  ' : 'PASS  ') + (g === '.' ? 'the hub' : g) + (why ? '  — ' + why.slice(0, 200) : ''));
  if (why) bad++;
  await page.close();
}
await browser.close(); server.close();
console.log(bad ? `\n${bad} FAILED` : `\nALL PASSED (${games.length})`);
process.exit(bad ? 1 : 0);
