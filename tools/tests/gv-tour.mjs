// The one tour: launcher -> profile -> shop -> leaderboards -> multiplayer -> Grapevine (inside its frame) -> account.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-tour.mjs   (same rig as gv.mjs)
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
const step = P => P.evaluate(() => document.getElementById('htour') && document.getElementById('htour').classList.contains('on') ? document.getElementById('htN').textContent + ' ' + document.getElementById('htT').textContent : '');
const waitStep = (P, re, ms = 20000) => until(async () => re.test(await step(P)), ms);
const press = (P, sel) => P.evaluate(s => document.querySelector(s).click(), sel);
try {
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(A, 'Tour' + (Date.now() % 100000));
  await until(async () => (await status(A)) === 'online', 60000);
  check('a new account gets the tour', !!(await waitStep(A, /^1 \/ \d+ Welcome/)));
  check('the old slideshow is gone', await A.evaluate(() => document.getElementById('tour').hidden));
  await press(A, '#htNext'); check('games', !!(await waitStep(A, /Games/)));
  await press(A, '#htNext'); check('your profile', !!(await waitStep(A, /Your profile/)));
  await press(A, '#chip'); check('...pressing it opens the profile and goes on to the shop', !!(await waitStep(A, /Goon Shop/)));
  await A.waitForSelector('[data-ptab="shop"]'); await press(A, '[data-ptab="shop"]'); check('leaderboards', !!(await waitStep(A, /Leaderboards/)));
  await press(A, '[data-ptab="lb"]'); check('multiplayer', !!(await waitStep(A, /Multiplayer/)));
  await press(A, '#tab-mp'); check('grapevine', !!(await waitStep(A, /Grapevine/)));
  await press(A, '#tab-chat'); check('into Grapevine itself: rooms', !!(await waitStep(A, /Rooms/, 60000)));
  const gv = await until(() => A.frames().find(f => f.name() !== 'player' && f.url().startsWith('about:srcdoc') && f !== A.mainFrame()), 20000);
  check('Grapevine does not offer its own separate tour', !(await gv.evaluate(() => document.getElementById('guideOffer') && document.getElementById('guideOffer').classList.contains('on'))));
  await gv.evaluate(() => document.querySelector('#convs [data-conv="main"]').click());
  check('say hi', !!(await waitStep(A, /Say hi/)));
  await gv.evaluate(() => { const x = document.getElementById('text'); x.value = 'hi from the tour'; x.dispatchEvent(new Event('input')); document.getElementById('send').click(); });
  check('sending in Grapevine moves the tour on (Grapevine reports it)', !!(await waitStep(A, /Actions/)));
  await gv.evaluate(() => document.getElementById('actBtn').click()); check('friends', !!(await waitStep(A, /Friends/)));
  await press(A, '#htNext'); check('your account', !!(await waitStep(A, /Your account/)));
  await press(A, '#tab-acct'); check('the end', !!(await waitStep(A, /That is everything/)));
  await press(A, '#htNext'); await sleep(300);
  check('done: remembered, and the ? brings it back', await A.evaluate(() => localStorage.getItem('hgv:tour') === '2' && !document.getElementById('htour').classList.contains('on')));
  await press(A, '#tourBtn'); check('the ? replays it', !!(await waitStep(A, /^1 \//)));
} catch (e) { console.log('ERROR', e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
