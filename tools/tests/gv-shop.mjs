// New things to spend goons on: name colours, picture frames, your own title, crates, gifts to friends.
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
const eco = P => P.evaluate(() => HGGrapevine.eco.state());
try {
  const D = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(D, 'ShopDev'); await until(async () => (await status(D)) === 'online', 60000);
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(A, 'ShopAnn'); await until(async () => (await status(A)) === 'online', 60000);
  const B = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(B, 'ShopBob'); await until(async () => (await status(B)) === 'online', 60000);
  for (const P of [D, A, B]) await P.click('#tour .skip', { timeout: 3000 }).catch(() => {});
  await until(() => D.evaluate(() => !!HGGrapevine.eco.state()), 15000);
  await D.evaluate(() => HGGrapevine.eco.admin('goons', 'ShopAnn', null, 100)); await A.waitForTimeout(1500);
  A.on('dialog', d => d.accept());
  console.log('\n=== 1. name colours and frames ===');
  await A.evaluate(() => document.getElementById('tab-prof').click());
  await until(() => A.evaluate(() => !!document.querySelector('[data-ptab="shop"]')), 15000);
  await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="color"]');
  check('the shop has name colours, shown on your own name', await A.evaluate(() => document.querySelectorAll('[data-buy^="color:"]').length >= 15 && /ShopAnn/.test(document.querySelector('.pncs').textContent)));
  await A.click('[data-buy="color:sunset"]');
  await until(async () => (await eco(A)).owned.includes('color:sunset'), 8000);
  await A.click('[data-ptab="locker"]'); await A.click('[data-pcat="color"]'); await A.click('[data-equip="color:sunset"]');
  check('wearing one colours your name on your profile', !!(await until(() => A.evaluate(() => { const n = document.querySelector('.phead .pnm .nc'); return n && /gradient/.test(n.getAttribute('style')); }), 8000)));
  await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="frame"]'); await A.click('[data-buy="frame:prism"]');
  await until(async () => (await eco(A)).owned.includes('frame:prism'), 8000);
  await A.click('[data-ptab="locker"]'); await A.click('[data-pcat="frame"]'); await A.click('[data-equip="frame:prism"]');
  check('wearing a frame puts a ring round your picture', !!(await until(() => A.evaluate(() => !!document.querySelector('.phead .pfr.st-spin')), 8000)));
  const cosB = await until(async () => { const uid = await A.evaluate(() => HGGrapevine.me().userId); const c = await B.evaluate(u => { const m = HGGrapevine.eco.cos([u]); return m[u] || null; }, uid); return c && c.nc ? c : null; }, 10000);
  check('other people are told your colour and frame', !!cosB && cosB.nc === 'color:sunset' && cosB.fr === 'frame:prism', JSON.stringify(cosB));
  console.log('\n=== 2. your own title ===');
  await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="perk"]');
  check('Extras lists the title, crates, gifts and the casino', await A.evaluate(() => document.querySelectorAll('.pex').length === 4));
  const refused = await A.evaluate(() => new Promise(res => { const off = HGGrapevine.on('ecoError', m => res(m.text)); HGGrapevine.eco.custom('Sneaky'); setTimeout(() => res('none'), 3000); }));
  check('a custom title needs the perk first', /Buy/.test(refused), refused);
  const g0 = (await eco(A)).goons; await A.click('[data-buy="perk:customtitle"]');
  await until(async () => (await eco(A)).owned.includes('perk:customtitle'), 8000);
  await until(() => A.evaluate(() => !!document.getElementById('px-title')), 5000);
  await A.fill('#px-title', 'Pizza Lord'); await A.click('[data-pex="custom"]');
  check('the title you wrote is worn at once', !!(await until(async () => { const e = await eco(A); return e.equip.title === 'title:c-own' && e.ctitles['title:c-own'] === 'Pizza Lord'; }, 8000)), JSON.stringify((await eco(A)).ctitles));
  check('...and shows on your profile', !!(await until(() => A.evaluate(() => /Pizza Lord/.test(document.querySelector('.phead').textContent)), 5000)));
  const g1 = (await eco(A)).goons; await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="perk"]'); await A.fill('#px-title', 'Taco Baron'); await A.click('[data-pex="custom"]');
  check('changing the words costs 5 goons', !!(await until(async () => { const e = await eco(A); return e.ctitles['title:c-own'] === 'Taco Baron' && e.goons === g1 - 5; }, 8000)), String((await eco(A)).goons - g1));
  console.log('\n=== 3. crates ===');
  const o0 = (await eco(A)).owned.length, g2 = (await eco(A)).goons; await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="perk"]'); await A.click('[data-pex="crate"]');
  check('a crate costs 6 goons and holds one new thing', !!(await until(async () => { const e = await eco(A); return e.owned.length === o0 + 1 && e.goons === g2 - 6; }, 8000)), JSON.stringify([(await eco(A)).owned.length - o0, (await eco(A)).goons - g2]));
  check('...and you are shown what it was', !!(await until(() => A.evaluate(() => /The crate had/.test(document.body.innerText)), 5000)));
  console.log('\n=== 4. gifts ===');
  let err = await A.evaluate(() => new Promise(res => { HGGrapevine.on('ecoError', m => res(m.text)); HGGrapevine.eco.gift('ShopBob', 3); setTimeout(() => res('none'), 3000); }));
  check('goons can only be given to a friend', /friend/.test(err), err);
  await A.evaluate(() => HGGrapevine.addFriend('ShopBob')); await until(() => B.evaluate(() => HGGrapevine.friends().incoming.length > 0), 10000);
  await B.evaluate(() => HGGrapevine.addFriend('ShopAnn')); await until(() => A.evaluate(() => HGGrapevine.friends().friends.some(f => f.name === 'ShopBob')), 10000);
  const a0 = (await eco(A)).goons, b0 = (await eco(B)).goons; await A.evaluate(() => HGGrapevine.eco.gift('ShopBob', 4));
  check('a gift moves the goons to the friend', !!(await until(async () => (await eco(A)).goons === a0 - 4 && (await eco(B)).goons === b0 + 4, 8000)), JSON.stringify([(await eco(A)).goons - a0, (await eco(B)).goons - b0]));
  err = await A.evaluate(() => new Promise(res => { HGGrapevine.on('ecoError', m => res(m.text)); HGGrapevine.eco.gift('ShopBob', 20); setTimeout(() => res('none'), 3000); }));
  check('...up to 20 a day', /20 goons a day|left today/.test(err), err);
  if (process.env.SHOT) { await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="color"]'); await A.waitForTimeout(500); await A.screenshot({ path: process.env.SHOT }); }
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
