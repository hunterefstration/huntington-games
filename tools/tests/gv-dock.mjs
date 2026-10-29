// The chat dock beside a running game: 💬 / T opens it, the game narrows and keeps running, messages go to Grapevine.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-dock.mjs   (same rig as gv.mjs)
import { chromium } from 'playwright';
import fs from 'node:fs';

const HUB = process.env.HUB_URL || 'http://127.0.0.1:8090/index.html';
const ARCHIVE = process.env.RIG_ARCHIVE || 'rig-archive-a';
const MQTT = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';
const PEERJS = process.env.PEERJS_JS || '/home/user/grapevine/node_modules/peerjs/dist/peerjs.min.js';
const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const ROOT = new URL('../../', import.meta.url).pathname;
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000, every = 250) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(every); }
}

const browser = await chromium.launch({ executablePath: process.env.RIG_CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// one "device": its own storage
async function device(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('    [pageerror]', e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/mqtt|unpkg\.com\/mqtt/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/peerjs/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(PEERJS) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => {
    const f = TOOLS + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, '');
    fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort();
  });
  await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  // the embedded Grapevine app talks to the test rig instead of the real server
  await page.route('**/gv/app.html', async r => {
    let html = fs.readFileSync(ROOT + 'gv/app.html', 'utf8');
    html = html.replace(/archiveIds: \[[\s\S]*?\],/, `archiveIds: ['${ARCHIVE}'],`)
      .replace(/relay: \{ shards: 2 \}/, "relay: { shards: 2, relays: ['ws://127.0.0.1:9001'] }")
      .replace("connect-src 'self' ", "connect-src 'self' ws://127.0.0.1:9001 ws://127.0.0.1:9999 ws://127.0.0.1:8787 ")
      .replace(/peerOptions: \{\s*debug: [0-9],?/, "peerOptions: { debug: 0, host: '127.0.0.1', port: 9999, path: '/gv', secure: false,")
      .replace(/serverPubs: \{[^}]*\}/, 'serverPubs: {}');
    await r.fulfill({ contentType: 'text/html', body: html });
  });
  await page.addInitScript(a => { window.HG_GV_CONFIG = a; },
    { archives: [ARCHIVE], pinned: {}, shards: 2, relays: ['ws://127.0.0.1:9001'] });
  await page.goto(HUB);
  await page.evaluate(() => { try { localStorage.setItem('hgv:tour', '2'); } catch (e) {} });   // these tests are not about the tour (gv-tour.mjs is)
  return page;
}
const status = p => p.evaluate(() => HGGrapevine.status().status).catch(() => '');
async function createAccount(page, name) {
  await page.waitForSelector('#gate .gl .seg', { timeout: 20000 });
  await page.click('#gate .gl .seg button:nth-child(2)');
  await page.fill('#gate #gl-name', name);
  await page.click('#gate #gl-go');
  await page.waitForSelector('#gate #gl-newkey', { timeout: 5000 });
  const key = await page.$eval('#gate #gl-newkey', e => e.textContent);
  await page.check('#gate #gl-saved');
  await page.click('#gate #gl-fin');
  return key;
}
try {
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await A.addInitScript(() => { try { localStorage.setItem('hgv:tour', '2'); } catch (e) {} });
  await createAccount(A, 'Dock' + (Date.now() % 100000));
  await until(async () => (await status(A)) === 'online', 60000);
  await sleep(1500);
  await A.evaluate(() => { [...document.querySelectorAll('.game')].find(g => /Tetris/.test(g.textContent)).click(); });
  await A.waitForSelector('#player.open', { timeout: 20000 }); await sleep(2500);
  check('the 💬 Chat button is in the bar above the game', await A.evaluate(() => !!document.getElementById('dk-btn') && document.getElementById('dk-btn').offsetWidth > 0));
  const w0 = await A.evaluate(() => document.getElementById('frame').getBoundingClientRect().width);
  await A.click('#dk-btn');
  check('it opens the dock beside the game, which narrows but stays', !!(await until(() => A.evaluate(w => document.getElementById('chatdock').classList.contains('on') && document.getElementById('frame').getBoundingClientRect().width < w - 200, w0), 5000)));
  check('the dock has conversation tabs once Grapevine is up (#main)', !!(await until(() => A.evaluate(() => [...document.querySelectorAll('#dk-tabs button')].some(b => /main/.test(b.textContent))), 60000)));
  await A.evaluate(() => { const b = [...document.querySelectorAll('#dk-tabs button')].find(b => /main/.test(b.textContent)); b.click(); });
  await A.fill('#dk-in', 'hello from the dock'); await A.press('#dk-in', 'Enter');
  const gv = A.frames().find(f => f.name() !== 'player' && f.url().startsWith('about:srcdoc') && f !== A.mainFrame() && f !== A.frames().find(x => x.url().includes('Tetris')));
  check('a message sent from the dock is in Grapevine', !!(await until(() => A.evaluate(() => document.getElementById('dk-ls').textContent.includes('hello from the dock')), 10000)));
  await A.click('[data-dkq="gg"]');
  check('quick phrases send in one press', !!(await until(() => A.evaluate(() => [...document.querySelectorAll('#dk-ls .dk-m')].some(m => / gg$/.test(m.textContent))), 10000)));
  await A.press('#dk-in', 'Escape');
  check('Esc closes it and the game gets its full width back', !!(await until(() => A.evaluate(w => !document.getElementById('chatdock').classList.contains('on') && document.getElementById('frame').getBoundingClientRect().width >= w - 2, w0), 5000)));
  await A.evaluate(() => frame.contentDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })));
  check('T in the game opens the dock (not a box inside the game)', !!(await until(() => A.evaluate(() => document.getElementById('chatdock').classList.contains('on')), 5000)) && !(await A.evaluate(() => !!frame.contentDocument.getElementById('hgc-box'))));
} catch (e) { console.log('ERROR', e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
