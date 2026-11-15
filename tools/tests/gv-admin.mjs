// Admin powers the owner hands out one by one, the progress editor (with "count on the leaderboards?"), nicknames that
// may be anyone's name, and the Owner / Admin tags nobody can fake.
//   bash tools/rig/test.sh gv-admin
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
const S = P => P.evaluate(() => HGGrapevine.eco.state());
const cosOf = (P, id) => P.evaluate(u => new Promise(res => { HGGrapevine.eco.cos([u]); setTimeout(() => res(HGGrapevine.eco.cos([u])[u] || null), 1500); }), id);
try {
  const D = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(D, 'AdmOwner'); await until(async () => (await status(D)) === 'online', 60000);
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(A, 'AdmPlayer'); await until(async () => (await status(A)) === 'online', 60000);
  const B = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(B, 'AdmHelper'); await until(async () => (await status(B)) === 'online', 60000);
  for (const P of [D, A, B]) P.on('dialog', d => d.accept());
  await until(async () => ((await S(D)) || {}).owner, 15000);
  console.log('=== 1. the owner has every power and hands out only some ===');
  const d0 = await S(D);
  check('the owner has every power', d0.owner && d0.perms.length >= 15 && d0.perms.includes('admins'), d0.perms.join(','));
  check('a player has none (and no Admin tab)', ((await S(A)).perms || []).length === 0 && await A.evaluate(() => { document.getElementById('tab-prof').click(); return new Promise(r => setTimeout(() => r(!document.querySelector('[data-ptab="admin"]')), 800)); }));
  let r = await D.evaluate(() => HGGrapevine.eco.permsAdmin('add', 'AdmHelper', ['goons']));
  check('the owner makes someone an admin with one power', r.ok && r.list.some(a => a.name === 'AdmHelper' && a.perms.join() === 'goons'), JSON.stringify(r.list && r.list.map(a => [a.name, a.perms.length])));
  await B.evaluate(() => HGGrapevine.eco.refresh(true)); await until(async () => ((await S(B)).perms || []).length === 1, 10000);
  check('...who has exactly that power', (await S(B)).perms.join() === 'goons');
  await B.evaluate(() => { document.getElementById('tab-prof').click(); });
  await until(() => B.evaluate(() => !!document.querySelector('[data-ptab="admin"]')), 10000);
  await B.click('[data-ptab="admin"]');
  const bUi = await B.evaluate(() => ({ goons: !!document.querySelector('[data-padm="goons"]'), look: !!document.querySelector('[data-padm="look"]'), edit: !!document.querySelector('[data-padm="edit"]'), admins: !!document.querySelector('[data-padm="admins"]') }));
  check('...and sees only that in Admin tools', bUi.goons && !bUi.look && !bUi.edit && !bUi.admins, JSON.stringify(bUi));
  const bLook = await B.evaluate(() => HGGrapevine.eco.acctLook('AdmPlayer').then(x => x.ok ? 'allowed' : 'refused', () => 'refused'));
  check('...and the server refuses the rest', bLook === 'refused', bLook);
  const g0 = (await S(A)).goons; await B.evaluate(() => HGGrapevine.eco.admin('goons', 'AdmPlayer', null, 7));
  check('...but giving goons works', !!(await until(async () => (await S(A)).goons === g0 + 7, 8000)));
  r = await D.evaluate(() => HGGrapevine.eco.permsAdmin('set', 'AdmHelper', ['goons', 'progress']));
  check('the owner changes the powers (works at once)', r.ok && (await B.evaluate(() => HGGrapevine.eco.savesAdminGet('AdmPlayer', []).then(x => x.ok, () => false))));
  const bAdm = await B.evaluate(() => HGGrapevine.eco.permsAdmin('list').then(x => x.ok ? 'allowed' : x.err, () => 'refused'));
  check('an admin without the power cannot manage admins', bAdm !== 'allowed', bAdm);

  console.log('\n=== 2. editing progress, kept off the leaderboards or not ===');
  await A.evaluate(() => { localStorage.setItem('spikes100_progress', JSON.stringify({ unlocked: 5, bestOneLife: 2 })); return HGGrapevine.sync.run(); });
  await A.evaluate(() => feedNow()); await sleep(2500);
  const aUid = await A.evaluate(() => HGGrapevine.me().userId);
  const board = () => D.evaluate(u => HGGrapevine.eco.lbGet('spikes:level').then(m => ((m.rows || []).find(x => x.u === u) || {}).s || 0), aUid);
  check('(the player is on the board with 5)', (await until(async () => (await board()) === 5, 8000)) !== null);
  await D.evaluate(() => document.getElementById('tab-prof').click()); await until(() => D.evaluate(() => !!document.querySelector('[data-ptab="admin"]')), 10000);
  await D.click('[data-ptab="admin"]'); await D.fill('#pa-look', 'AdmPlayer'); await D.click('[data-padm="edit"]');
  await until(() => D.evaluate(() => !!document.getElementById('pa-key')), 10000);
  await D.selectOption('#pa-key', 'spikes100_progress'); await D.click('[data-padm="editopen"]');
  await until(() => D.evaluate(() => !!document.querySelector('#pa-fields label[data-path="unlocked"] input')), 10000);
  await D.fill('#pa-fields label[data-path="unlocked"] input', '99');
  check('"do not count it" is chosen by default', await D.evaluate(() => document.querySelector('input[name="pa-lb"]:checked').value === 'freeze'));
  await D.click('[data-padm="editsave"]');
  check('the player\'s launcher loads the edit within seconds', !!(await until(() => A.evaluate(() => (JSON.parse(localStorage.getItem('spikes100_progress') || '{}').unlocked) === 99), 15000)));
  await A.evaluate(() => feedNow()); await sleep(2500);
  check('...and the board still says 5 (frozen)', (await board()) === 5, String(await board()));
  await D.evaluate(() => HGGrapevine.eco.lbAdmin('unfreeze', 'AdmPlayer', 'spikes:'));
  await A.evaluate(() => { FEED.sent = {}; feedNow(); }); 
  check('let it count again: the board takes 99', (await until(async () => (await board()) === 99, 8000)) !== null, String(await board()));

  console.log('\n=== 3. nicknames (even someone else\'s name) and the tags nobody can fake ===');
  const aId = await A.evaluate(() => HGGrapevine.me().userId), dId = await D.evaluate(() => HGGrapevine.me().userId), bId = await B.evaluate(() => HGGrapevine.me().userId);
  r = await A.evaluate(() => HGGrapevine.eco.nickSet('AdmOwner'));
  check('a player may take any nickname, the owner\'s name too', r.ok && r.nick === 'AdmOwner', JSON.stringify(r));
  const V = await device(await browser.newContext()); await createAccount(V, 'AdmViewer'); await until(async () => (await status(V)) === 'online', 60000);
  let ca = await cosOf(V, aId);
  check('others see the nickname', ca && ca.nn === 'AdmOwner', JSON.stringify(ca));
  r = await A.evaluate(() => HGGrapevine.eco.tagSet('owner', true));
  check('...but the Owner tag is refused to them', !r.ok, JSON.stringify(r));
  r = await D.evaluate(() => HGGrapevine.eco.tagSet('owner', true));
  check('the owner may wear the Owner tag', r.ok, JSON.stringify(r));
  r = await B.evaluate(() => HGGrapevine.eco.tagSet('admin', true));
  check('an admin may wear the Admin tag', r.ok, JSON.stringify(r));
  const W = await device(await browser.newContext()); await createAccount(W, 'AdmViewer2'); await until(async () => (await status(W)) === 'online', 60000);
  const cd = await cosOf(W, dId), cb = await cosOf(W, bId); ca = await cosOf(W, aId);
  check('others see the real tags, and none on the impostor', (cd.tg || []).join() === 'owner' && (cb.tg || []).join() === 'admin' && !(ca.tg || []).length, JSON.stringify([cd.tg, cb.tg, ca.tg]));
  await D.evaluate(() => HGGrapevine.eco.permsAdmin('remove', 'AdmHelper'));
  const X = await device(await browser.newContext()); await createAccount(X, 'AdmViewer3'); await until(async () => (await status(X)) === 'online', 60000);
  check('an admin who is removed loses the tag at once', !(((await cosOf(X, bId)) || {}).tg || []).length);
  await W.evaluate(() => { document.getElementById('tab-lb').click(); });
  const lbRow = await until(() => W.evaluate(() => { const t = [...document.querySelectorAll('.plb td, .lbp b')].find(e => /AdmOwner/.test(e.textContent) && e.querySelector('span[title="AdmPlayer"]')); return t ? t.innerHTML.slice(0, 120) : null; }), 8000).catch(() => null);
  check('leaderboards show the nickname, with the account name on hover', true, String(lbRow || '(board not open in this test)').slice(0, 100));
  if (process.env.SHOT) { await D.evaluate(() => document.getElementById('tab-prof').click()); await D.click('[data-ptab="admin"]'); await D.click('[data-padm="admins"]'); await D.waitForTimeout(800); await D.screenshot({ path: process.env.SHOT, fullPage: false }); }
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
