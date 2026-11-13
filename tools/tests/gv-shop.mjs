// New things to spend goons on: name colours, picture frames, your own title, crates, gifts to friends.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-saves.mjs   (reset the rig database first)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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
const rig = (...args) => execFileSync('bash', [ROOT + 'tools/rig/db.sh', ...args], { encoding: 'utf8' });      // stop/start the rig's server, read or plant a row
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
  console.log('\n=== 1. chat bubbles, sidekicks and frames (no name colours, no title of your own) ===');
  await A.evaluate(() => document.getElementById('tab-prof').click());
  await until(() => A.evaluate(() => !!document.querySelector('[data-ptab="shop"]')), 15000);
  await A.click('[data-ptab="shop"]');
  check('the shop sells no name colours', await A.evaluate(() => !document.querySelector('[data-pcat="color"]') && !HGGrapevine.eco.catalog().items.some(i => i.k === 'color' || i.id === 'perk:customtitle')));
  await A.click('[data-pcat="bubble"]');
  check('the shop has chat bubbles, shown on a sample message', await A.evaluate(() => document.querySelectorAll('[data-buy^="bubble:"]').length >= 15 && !!document.querySelector('.pncs .pbub')));
  await A.click('[data-buy="bubble:sunset"]'); await until(async () => (await eco(A)).owned.includes('bubble:sunset'), 8000);
  await A.click('[data-pcat="pet"]');
  check('...and sidekicks, shown on your picture', await A.evaluate(() => document.querySelectorAll('[data-buy^="pet:"]').length >= 20 && !!document.querySelector('.pcard .pface .pet')));
  await A.click('[data-buy="pet:fox"]'); await until(async () => (await eco(A)).owned.includes('pet:fox'), 8000);
  await A.click('[data-pcat="frame"]'); await A.click('[data-buy="frame:prism"]'); await until(async () => (await eco(A)).owned.includes('frame:prism'), 8000);
  await A.click('[data-ptab="locker"]');
  for (const [cat, id] of [['bubble', 'bubble:sunset'], ['pet', 'pet:fox'], ['frame', 'frame:prism']]) { await A.click(`[data-pcat="${cat}"]`); await A.click(`[data-equip="${id}"]`); await until(async () => (await eco(A)).equip[cat] === id, 8000); }
  check('your profile shows the frame and the sidekick, and your name is plain', !!(await until(() => A.evaluate(() => !!document.querySelector('.phead .pface .pfr.st-spin') && !!document.querySelector('.phead .pface .pet') && !document.querySelector('.phead .pnm *')), 8000)));
  const annId = await A.evaluate(() => HGGrapevine.me().userId);
  const cosOfAnn = () => B.evaluate(u => { const m = HGGrapevine.eco.cos([u]); return m[u] || null; }, annId);
  const cosB = await until(async () => { const c = await cosOfAnn(); return c && c.bb ? c : null; }, 10000);
  check('other people are told your bubble, sidekick and frame', !!cosB && cosB.bb === 'bubble:sunset' && cosB.pt === 'pet:fox' && cosB.fr === 'frame:prism' && !('nc' in cosB), JSON.stringify(cosB));
  await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="perk"]');
  check('Extras lists crates, gifts and the casino (no title of your own)', await A.evaluate(() => document.querySelectorAll('.pex').length === 3 && !/own title/i.test(document.querySelector('.pextras').textContent) && typeof HGGrapevine.eco.custom === 'undefined'));

  console.log('\n=== 2. titles won by playing: admins earn them too, and they shimmer ===');
  const ecoErr = (P, fn) => P.evaluate(fn => new Promise(res => { HGGrapevine.on('ecoError', m => res(m.text || m.code || 'error')); new Function('return ' + fn)()(); setTimeout(() => res('none'), 2500); }), fn.toString());
  check('the catalog marks them', await D.evaluate(() => { const by = {}; HGGrapevine.eco.catalog().items.forEach(i => by[i.id] = i); return by['title:flawless'].ra === 1 && by['title:lightbringer'].ra === 1 && by['title:rank1'].ra === 1 && !by['title:betatester'].ra && !by['title:dayone'].ra && !by['title:kimjonggoon'].ra; }));
  let err = await ecoErr(D, () => HGGrapevine.eco.equip('title', 'title:flawless'));
  check('an admin cannot wear Flawless without earning it', /not have that/.test(err) && (await eco(D)).equip.title !== 'title:flawless', err);
  err = await ecoErr(D, () => HGGrapevine.eco.buy('title:flawless'));
  check('...or take it from the shop', /earned/.test(err) && !(await eco(D)).owned.includes('title:flawless'), err);
  await D.evaluate(() => HGGrapevine.eco.equip('title', 'title:betatester'));
  await D.evaluate(() => HGGrapevine.eco.equip('title', 'title:kimjonggoon'));
  check('an admin still has the developers-only title', !!(await until(async () => (await eco(D)).equip.title === 'title:kimjonggoon', 6000)));
  await D.evaluate(() => HGGrapevine.eco.equip('title', 'title:betatester'));
  check('an admin still has the titles admins hand out', !!(await until(async () => (await eco(D)).equip.title === 'title:betatester', 6000)));
  await D.evaluate(() => document.getElementById('tab-prof').click()); await until(() => D.evaluate(() => !!document.querySelector('[data-ptab="locker"]')), 15000);
  await D.click('[data-ptab="locker"]'); await D.click('[data-pcat="title"]');
  check('the admin\'s own locker shows Flawless as locked', await D.evaluate(() => { const c = [...document.querySelectorAll('.pcard')].find(c => /Flawless/.test(c.textContent)); return !!c && c.classList.contains('locked') && !!c.querySelector('.plock') && !c.querySelector('[data-equip]'); }));
  await D.evaluate(() => HGGrapevine.eco.admin('give', 'ShopAnn', 'title:flawless'));
  await until(async () => (await eco(A)).earned.includes('title:flawless'), 8000);
  await A.click('[data-ptab="locker"]'); await A.click('[data-pcat="title"]'); await A.click('[data-equip="title:flawless"]');
  check('a player who has it wears it in the moving colour', !!(await until(() => A.evaluate(() => { const t = document.querySelector('.phead .ptag.ra i'); return !!t && t.textContent === 'Flawless' && /ramove/.test(getComputedStyle(t).animationName); }), 8000)));
  check('...an ordinary title is not written that way', await A.evaluate(() => !![...document.querySelectorAll('.pcard .ptag')].find(t => !t.classList.contains('ra'))));
  check('...and other people are told the title', !!(await until(async () => ((await D.evaluate(u => HGGrapevine.eco.cos([u])[u] || null, annId)) || {}).t === 'title:flawless', 8000)));      // (D has not asked about Ann before: answers are kept for 10 minutes)
  console.log('\n=== 2b. in chat: the bubble behind the message, the sidekick on the picture, the title in its colour ===');
  await A.evaluate(() => document.getElementById('tab-chat').click());
  await until(() => A.evaluate(() => { const d = document.getElementById('gvapp').contentDocument, b = d && [...d.querySelectorAll('button')].find(b => b.textContent.trim().replace(/\s+/g, ' ').startsWith('#main')); if (!b) return false; b.click(); return true; }), 30000);      // (the app opens on its Start page)
  await A.waitForTimeout(800);
  const said = await until(() => A.evaluate(() => { const d = document.getElementById('gvapp').contentDocument, t = d && d.getElementById('text'); if (!t || !d.getElementById('send') || t.disabled || !t.offsetParent) return false; t.value = 'hello from the shop test'; t.dispatchEvent(new Event('input', { bubbles: true })); d.getElementById('send').click(); return true; }), 30000);
  const chatRow = await until(() => A.evaluate(() => { const d = document.getElementById('gvapp').contentDocument, r = [...d.querySelectorAll('#log .msg')].find(r => /hello from the shop test/.test(r.textContent)); if (!r) return null; const b = r.querySelector(':scope > .body'), w = r.querySelector(':scope > .who'); return b.classList.contains('bub') && w.querySelector('.pface .pet') && w.querySelector('.gtag.ra i') ? { bub: getComputedStyle(b).backgroundImage.slice(0, 40), pet: w.querySelector('.pet').textContent, title: w.querySelector('.gtag.ra i').textContent, plain: !w.querySelector('.wn *') } : null; }), 20000);
  check('a message wears all three, and the name itself is plain', !!said && !!chatRow && /gradient/.test(chatRow.bub) && chatRow.title === 'Flawless' && chatRow.plain, JSON.stringify(chatRow));
  if (process.env.SHOT2) { await A.waitForTimeout(600); await A.screenshot({ path: process.env.SHOT2 }); }
  await A.evaluate(() => document.getElementById('tab-prof').click()); await until(() => A.evaluate(() => !!document.querySelector('[data-ptab="shop"]')), 15000);

  console.log('\n=== 3. crates ===');
  const o0 = (await eco(A)).owned.length, g2 = (await eco(A)).goons; await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="perk"]'); await A.click('[data-pex="crate"]');
  check('a crate costs 6 goons and holds one new thing', !!(await until(async () => { const e = await eco(A); return e.owned.length === o0 + 1 && e.goons === g2 - 6; }, 8000)), JSON.stringify([(await eco(A)).owned.length - o0, (await eco(A)).goons - g2]));
  check('...and you are shown what it was', !!(await until(() => A.evaluate(() => /The crate had/.test(document.body.innerText)), 5000)));
  console.log('\n=== 4. gifts ===');
  err = await A.evaluate(() => new Promise(res => { HGGrapevine.on('ecoError', m => res(m.text)); HGGrapevine.eco.gift('ShopBob', 3); setTimeout(() => res('none'), 3000); }));
  check('goons can only be given to a friend', /friend/.test(err), err);
  await A.evaluate(() => HGGrapevine.addFriend('ShopBob')); await until(() => B.evaluate(() => HGGrapevine.friends().incoming.length > 0), 10000);
  await B.evaluate(() => HGGrapevine.addFriend('ShopAnn')); await until(() => A.evaluate(() => HGGrapevine.friends().friends.some(f => f.name === 'ShopBob')), 10000);
  const a0 = (await eco(A)).goons, b0 = (await eco(B)).goons; await A.evaluate(() => HGGrapevine.eco.gift('ShopBob', 4));
  check('a gift moves the goons to the friend', !!(await until(async () => (await eco(A)).goons === a0 - 4 && (await eco(B)).goons === b0 + 4, 8000)), JSON.stringify([(await eco(A)).goons - a0, (await eco(B)).goons - b0]));
  err = await A.evaluate(() => new Promise(res => { HGGrapevine.on('ecoError', m => res(m.text)); HGGrapevine.eco.gift('ShopBob', 20); setTimeout(() => res('none'), 3000); }));
  check('...up to 20 a day', /20 goons a day|left today/.test(err), err);
  if (process.env.SHOT) { await A.click('[data-ptab="locker"]'); await A.click('[data-pcat="title"]'); await A.waitForTimeout(500); await A.screenshot({ path: process.env.SHOT }); }

  console.log('\n=== 5. things that left the shop (name colours, "Your Own Title") are refunded when the server next loads the wallet ===');
  const bobId = await B.evaluate(() => HGGrapevine.me().userId), bob0 = (await eco(B)).goons;
  rig('server-stop');
  const old = rig('eco-row', bobId).trim();
  const row = Object.assign({ v: 1, goons: bob0, owned: {}, equip: {}, earned: {}, ach: {}, log: [] }, old ? JSON.parse(old) : {});
  row.goons = bob0; Object.assign(row.owned, { 'color:crimson': 1, 'color:rainbow': 1, 'perk:customtitle': 1, 'bubble:mint': 1 });
  row.equip = Object.assign({}, row.equip, { color: 'color:rainbow', title: 'title:c-own' }); row.ctitles = { 'title:c-own': 'Pizza Lord' }; row.earned['title:c-own'] = 1;
  const v = JSON.stringify(row).replace(/'/g, "''");
  fs.writeFileSync('/tmp/gv-shop-plant.sql', `INSERT INTO grapevine.user_saves (user_id, k, v, h, bytes, at) VALUES ('~eco', '${bobId}', '${v}', '', ${v.length}, ${Date.now()}) ON CONFLICT (user_id, k) DO UPDATE SET v = EXCLUDED.v, bytes = EXCLUDED.bytes, at = EXCLUDED.at;\n`);
  rig('sql-file', '/tmp/gv-shop-plant.sql'); rig('server-start');
  const back = await until(async () => { if ((await status(B)) !== 'online') return null; await B.evaluate(() => HGGrapevine.eco.refresh(true)); const e = await eco(B); return e && e.goons === bob0 + 52 ? e : null; }, 60000, 1500);
  check('the goons come back (2 + 20 + 30)', !!back, JSON.stringify({ before: bob0, now: (await eco(B)).goons }));
  const e5 = await eco(B);
  check('...the things are gone, and what is still sold is kept', !e5.owned.some(i => /^color:|^perk:customtitle/.test(i)) && e5.owned.includes('bubble:mint') && !e5.equip.color && !e5.equip.title && !(e5.ctitles || {})['title:c-own'], JSON.stringify({ owned: e5.owned, equip: e5.equip, ct: e5.ctitles }));
  check('...and the wallet says why', e5.log.some(l => /Refund/.test(l.why) && l.n === 52), JSON.stringify(e5.log.slice(-2)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
