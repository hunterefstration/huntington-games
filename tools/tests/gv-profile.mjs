// The Profile tab: goons from achievements, the Goon Shop, wearing a title, leaderboards fed from saves.
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
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  A.on('dialog', d => d.accept());
  const nm = 'Prof' + (Date.now() % 100000);
  await createAccount(A, nm);
  await until(async () => (await status(A)) === 'online', 60000);
  for (let i = 0; i < 6; i++) await A.click('#tour .go', { timeout: 800 }).catch(() => {});
  await A.click('#tour .skip', { timeout: 300 }).catch(() => {});
  check('the wallet and the shop catalog arrive', !!(await until(() => A.evaluate(() => { const L = HGGrapevine; return L.eco.state() && L.eco.catalog() && L.eco.catalog().items.length > 400; }), 20000)));
  await A.click('#chip');
  check('the name chip opens the Profile tab', await A.evaluate(() => !document.getElementById('view-prof').hidden && /goons/.test(document.querySelector('.pgoons').textContent)));
  // an achievement in the saves becomes a goon
  await A.evaluate(() => { localStorage.setItem('hgach:v1', JSON.stringify({ sp10: Date.now() })); localStorage.setItem('spikes100_progress', JSON.stringify({ unlocked: 12 })); feedNow(); });
  check('an unlocked achievement is worth a goon', !!(await until(() => A.evaluate(() => HGGrapevine.eco.state().goons === 1), 15000)));
  check('...and the chip shows it', !!(await until(() => A.evaluate(() => /1 goons/.test(document.getElementById('chip-goons').textContent)), 5000)));
  // buy a title in the shop and wear it
  await A.click('[data-ptab="shop"]'); await A.click('[data-pcat="title"]');
  await A.click('[data-buy="title:goat"]');
  check('buying a title spends the goon', !!(await until(() => A.evaluate(() => HGGrapevine.eco.state().goons === 0 && HGGrapevine.eco.state().owned.includes('title:goat')), 10000)));
  await A.click('[data-ptab="locker"]'); await A.click('[data-pcat="title"]');
  await A.click('[data-equip="title:goat"]');
  check('wearing it shows it on the profile card', !!(await until(() => A.evaluate(() => /GOAT/.test(document.querySelector('.phead').textContent)), 10000)));
  // leaderboards fed from the saves
  await A.click('[data-ptab="lb"]');
  await A.evaluate(() => { const g = [...document.querySelectorAll('[data-lbg]')].find(b => /Spikes/.test(b.textContent)); g && g.click(); });
  const row = await until(() => A.evaluate(n => { const t = document.querySelector('.plb'); return t && [...t.querySelectorAll('tr')].some(r => r.textContent.includes(n) && r.textContent.includes('12')); }, nm), 15000);
  if (!row) console.log('    debug:', await A.evaluate(() => HGGrapevine.eco.lbGet('spikes:level').then(m => JSON.stringify(m).slice(0, 300), e => 'ERR ' + e.message)), await A.evaluate(() => document.getElementById('view-prof').textContent.slice(-300)));
  check('the Spikes leaderboard shows your level from the save', !!row);
  check('every leaderboard game is listed', await A.evaluate(() => document.querySelectorAll('[data-lbg]').length >= 12));
} catch (e) { console.log('ERROR', e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
