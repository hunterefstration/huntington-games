// Bans lock the whole launcher: live, at load, on every device of the account, and new accounts from it. NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-ban.mjs
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-profile.mjs   (same rig as gv.mjs)
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
  const O = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(O, 'Own' + (Date.now() % 100000)); await until(async () => (await status(O)) === 'online', 60000);
  for (let i = 0; i < 6; i++) await O.click('#tour .go', { timeout: 800 }).catch(() => {});
  await O.click('#tour .skip', { timeout: 300 }).catch(() => {});
  await O.evaluate(() => document.getElementById('tab-chat').click());
  const appO = await until(async () => { const f = O.frames().find(x => x !== O.mainFrame() && x.url().startsWith('about:srcdoc')); return f && (await f.evaluate(() => !!(window.S && S.joined && S.ready)).catch(() => false)) ? f : null; }, 90000);
  check('the owner is in Grapevine', !!appO);
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const A = await device(ctxA); const nm = 'Bad' + (Date.now() % 100000);
  await createAccount(A, nm); await until(async () => (await status(A)) === 'online', 60000);
  check('not banned: no lock', await A.evaluate(() => !document.getElementById('banwall')));
  await appO.evaluate(n => S.archive.send({ type: 'admin', op: 'ban', name: n, reason: 'test' }), nm);
  check('a ban locks the launcher that is open right now', !!(await until(() => A.evaluate(() => !!document.getElementById('banwall') && document.documentElement.classList.contains('banned')), 15000)));
  await A.reload();
  check('...and it is locked again the moment the launcher loads', await A.evaluate(() => !!document.getElementById('banwall')));
  await A.close();     // (two launcher tabs of one browser share a relay identity: one at a time)
  const A2 = await device(ctxA);      // (same browser: same storage and device id, with the test rig's settings)
  check('the same browser with its memory of the ban gone is still locked (the server checks the device)', !!(await (async () => { await A2.evaluate(() => localStorage.removeItem('hgv:ban')); await A2.reload(); return until(() => A2.evaluate(() => !!document.getElementById('banwall')), 30000); })()));
  check('no games start while banned', await A2.evaluate(() => { try { play(GAMES[0]); } catch (e) {} return !document.getElementById('player').classList.contains('open'); }));
  const C = await device(await browser.newContext()); await C.waitForTimeout(8000);
  check('other people are not affected', await C.evaluate(() => !document.getElementById('banwall')));
  await appO.evaluate(n => S.archive.send({ type: 'admin', op: 'unban', name: n }), nm); await A2.waitForTimeout(1500);
  await A2.reload();
  check('an unban unlocks it on the next load', !!(await until(() => A2.evaluate(() => !document.getElementById('banwall')), 30000)));
} catch (e) { console.log('ERROR', e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
