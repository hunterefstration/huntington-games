// Saves that must never be lost: two tabs on one browser signing in as different accounts, many saves vanishing from a
// device at once, and the copies the server keeps of a save that loses progress (admins put them back).
//   bash tools/rig/test.sh gv-recover
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
const KEYS = ['lumi_save1', 'lumi_save2', 'blocky21_life', 'td2_save', 'sov.campaign', 'brownEClicker_save'];
const big = (n, k) => JSON.stringify({ v: 1, k, stars: Array.from({ length: n }, (_, i) => i + 1), done: true, coins: 5000 + n });
const look = (D, name) => D.evaluate(n => HGGrapevine.eco.acctLook(n), name);
try {
  const D = await device(await browser.newContext());
  await createAccount(D, 'RecBoss'); await until(async () => (await status(D)) === 'online', 60000);
  const ctx = await browser.newContext(), A = await device(ctx);
  const mainKey = await createAccount(A, 'RecMain'); await until(async () => (await status(A)) === 'online', 60000);
  await A.evaluate(([keys, vals]) => keys.forEach((k, i) => localStorage.setItem(k, vals[i])), [KEYS, KEYS.map((k, i) => big(40 + i, k))]);
  await A.evaluate(() => HGGrapevine.sync.run());
  let r = await look(D, 'RecMain');
  const before = Object.fromEntries(r.saves.map(x => [x.k, x.bytes]));
  check('the main account\'s saves are in the cloud', KEYS.every(k => before[k] > 100), JSON.stringify(before));

  console.log('\n=== 1. a second tab on the same browser signs out and in as another account ===');
  const B = await device(ctx);
  await until(async () => (await status(B)) === 'online', 60000);
  check('the second tab opens as the same account', (await B.evaluate(() => HGGrapevine.me().name)) === 'RecMain');
  await B.evaluate(() => HGGrapevine.signOut());
  await B.reload(); await createAccount(B, 'RecAlt'); await until(async () => (await status(B)) === 'online', 60000);
  await B.evaluate(() => { localStorage.setItem('lumi_save1', '{"v":1,"stars":[]}'); return HGGrapevine.sync.run(); });
  const refused = await A.evaluate(() => HGGrapevine.sync.run().then(() => 'synced', e => e.message)).catch(e => 'page reloaded');
  check('the first tab refuses to sync (or has reloaded)', refused !== 'synced', refused);
  await sleep(4000);
  const aNow = await A.evaluate(() => HGGrapevine.me() && HGGrapevine.me().name).catch(() => null);
  check('...and is no longer the main account', aNow !== 'RecMain', String(aNow));
  r = await look(D, 'RecMain');
  const after = Object.fromEntries(r.saves.map(x => [x.k, x.bytes]));
  check('the main account\'s saves are untouched', KEYS.every(k => after[k] === before[k]), JSON.stringify(after));

  console.log('\n=== 2. many saves vanish from a device at once ===');
  const E = await device(await browser.newContext());
  await E.waitForSelector('#gate #gl-key', { timeout: 20000 });
  await E.fill('#gate #gl-key', mainKey); await E.click('#gate #gl-go');
  await until(async () => (await status(E)) === 'online', 60000);
  await until(() => E.evaluate(keys => keys.every(k => !!localStorage.getItem(k)), KEYS), 30000);
  check('a fresh device gets the main account\'s saves', await E.evaluate(keys => keys.every(k => !!localStorage.getItem(k)), KEYS));
  await E.evaluate(keys => { keys.slice(0, 5).forEach(k => localStorage.removeItem(k)); return HGGrapevine.sync.run(); }, KEYS);
  r = await look(D, 'RecMain');
  check('five saves gone at once are not deleted from the account', KEYS.every(k => (r.saves.find(x => x.k === k) || {}).bytes === before[k]), JSON.stringify(r.saves.map(x => [x.k, x.bytes])));
  await E.evaluate(() => HGGrapevine.sync.run());
  check('...and come back to the device', await E.evaluate(keys => keys.every(k => !!localStorage.getItem(k)), KEYS));
  await E.evaluate(() => { localStorage.removeItem('td2_save'); return HGGrapevine.sync.run(); });
  r = await look(D, 'RecMain');
  check('one save deleted on purpose (a game\'s reset) still syncs as a delete', !((r.saves.find(x => x.k === 'td2_save') || {}).bytes > 2), JSON.stringify(r.saves.find(x => x.k === 'td2_save')));

  console.log('\n=== 3. the server keeps a copy of a save that loses progress, and an admin puts it back ===');
  check('the reset above was kept', r.backups.some(b => b.k === 'td2_save'), JSON.stringify(r.backups));
  await E.evaluate(() => { localStorage.setItem('lumi_save1', JSON.stringify({ v: 1, stars: [1], coins: 3 })); return HGGrapevine.sync.run(); });
  r = await look(D, 'RecMain');
  check('a save replaced by a much smaller one is kept', r.backups.some(b => b.k === 'lumi_save1'), JSON.stringify(r.backups));
  const put = await D.evaluate(() => HGGrapevine.eco.savesRestore('RecMain'));
  check('putting back the kept copies', put.ok && put.restored >= 2, JSON.stringify(put));
  await E.evaluate(() => HGGrapevine.sync.run());
  const got = await E.evaluate(() => [localStorage.getItem('lumi_save1'), localStorage.getItem('td2_save')]);
  check('...the device gets them back', !!got[0] && got[0].length === before['lumi_save1'] && !!got[1] && got[1].length === before['td2_save'], JSON.stringify(got.map(x => x && x.length)));
  r = await look(D, 'RecMain');
  check('the admin lookup shows goons, saves and boards', typeof r.goons === 'number' && r.saves.length >= 6 && Array.isArray(r.boards));
  const notAdmin = await A.evaluate(() => HGGrapevine.eco.acctLook('RecMain').then(x => JSON.stringify(x), e => 'refused: ' + e.message)).catch(() => 'refused');
  check('only admins can look an account up', !/"saves"/.test(notAdmin), notAdmin.slice(0, 80));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
