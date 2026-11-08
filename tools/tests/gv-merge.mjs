// Cloud save merging: more progress wins, a change made on top of the last sync wins (resets, deletes), conflicts by progress.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-saves.mjs   (reset the rig database first)
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
const K = 'td2_merge', KX = 'td2_mergex';
const save = (lv, coins) => JSON.stringify({ level: lv, coins, stars: Array.from({ length: lv }, () => true), ver: 3, savedAt: Date.now() });
const get = (P, k) => P.evaluate(k => localStorage.getItem(k), k);
const setv = (P, k, v) => P.evaluate(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v), [k, v]);
const sync = P => P.evaluate(async () => { const go = () => HGGrapevine.sync.run().then(r => r, e => ({ err: e.message })); await go(); return go(); });   // a second run: the first may have been one already under way
const lv = s => { try { return JSON.parse(s).level; } catch (e) { return s; } };
try {
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(A, 'MgAlice');
  await until(async () => (await status(A)) === 'online', 60000);
  await A.evaluate(() => HGGrapevine.sync.whenSynced(30000));
  await setv(A, K, save(10, 5000)); await sync(A);
  console.log('\n=== 1. a new device whose game already wrote a fresh save ===');
  const keyA = await A.evaluate(() => HGGrapevine.key());
  const B = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await setv(B, K, save(1, 0));
  await B.waitForSelector('#gate .gl .seg');
  await B.fill('#gate #gl-key', keyA); await B.click('#gate #gl-go');
  await B.waitForSelector('#gate[hidden]', { state: 'attached', timeout: 60000 });
  check('the account\'s real progress wins over the fresh save', !!(await until(async () => lv(await get(B, K)) === 10, 40000)), 'level ' + lv(await get(B, K)));
  console.log('\n=== 2. progress on one device reaches the other ===');
  await setv(B, K, save(12, 6000)); await sync(B); await sync(A);
  check('A gets B\'s newer progress', lv(await get(A, K)) === 12, 'level ' + lv(await get(A, K)));
  console.log('\n=== 3. a deliberate reset syncs ===');
  await setv(A, K, save(1, 0)); await sync(A); await sync(B);
  check('the reset on A reaches B (made on top of the synced copy)', lv(await get(B, K)) === 1, 'level ' + lv(await get(B, K)));
  console.log('\n=== 4. a deleted save stays deleted ===');
  await setv(A, KX, save(5, 100)); await sync(A); await sync(B);
  console.log('    B sync:', JSON.stringify(await sync(B)), JSON.stringify(await B.evaluate(() => HGGrapevine.sync.status())), await B.evaluate(() => HGGrapevine.status().status));
  check('B got the extra save', lv(await get(B, KX)) === 5);
  await setv(A, KX, null); await sync(A); await sync(A); await sync(B);
  check('deleting it on A deletes it on B too', (await get(B, KX)) === null, String(await get(B, KX)));
  check('...and it does not come back on A', (await get(A, KX)) === null, String(await get(A, KX)));
  console.log('\n=== 5. both devices changed it: more progress wins ===');
  await setv(A, K, save(20, 9000));                    // A plays offline (no sync yet)
  await setv(B, K, save(2, 10)); await sync(B);        // B saves a little and syncs first
  await sync(A); await sync(B);
  check('A\'s bigger progress wins on A', lv(await get(A, K)) === 20, 'level ' + lv(await get(A, K)));
  check('...and on B', lv(await get(B, K)) === 20, 'level ' + lv(await get(B, K)));
  console.log('\n=== 6. a stale tab that never saw the latest copy cannot push less progress ===');
  const C = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await setv(C, K, save(3, 30));
  await C.evaluate(([k]) => { localStorage.setItem('hgv:sync', JSON.stringify({ [k]: { h: 'stale', t: Date.now() + 5000, b: 'stale' } })); localStorage.setItem('hgv:syncat', '1'); }, [K]);
  await C.waitForSelector('#gate .gl .seg');
  await C.fill('#gate #gl-key', keyA); await C.click('#gate #gl-go');
  await C.waitForSelector('#gate[hidden]', { state: 'attached', timeout: 60000 });
  await until(async () => lv(await get(C, K)) === 20, 30000);
  await sync(A);
  check('the account keeps level 20', lv(await get(A, K)) === 20, 'level ' + lv(await get(A, K)));
  check('the stale device was brought up to date', lv(await get(C, K)) === 20, 'level ' + lv(await get(C, K)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
