// A real player on a new device (41 Last Light levels, many achievements) must never trip the flood limits.
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
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (process.env.OLD_GV) await ctx.route('**/gv/account.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.OLD_GV) }));   // a launcher from before the pacing
  const A = await device(ctx);
  const errs = []; A.on('console', m => { if (/flood|Slow down|Too much/i.test(m.text())) errs.push(m.text()); });
  await A.evaluate(() => {
    const lv = {}; for (const w of [1, 2, 3, 4]) for (let l = 1; l <= 10; l++) lv[w + '-' + l] = { best: 20 + l, moths: [true, true, true], sparks: 40, clears: 2, perfect: true }; lv['5-1'] = { best: 300, moths: [], sparks: 0, clears: 1 };
    localStorage.setItem('lumi_save', JSON.stringify({ v: 3, levels: lv, runs: { full: 3000, onelife: 12 }, talks: {}, secrets: {} }));
    const ach = {}; for (let i = 0; i < 45; i++) ach['fake' + i] = Date.now(); localStorage.setItem('hgach:v1', JSON.stringify(ach));
    for (let i = 0; i < 60; i++) localStorage.setItem('td2_slot' + i, JSON.stringify({ level: i, coins: i * 10 }));
  });
  await createAccount(A, 'FloodTest');
  await until(async () => (await status(A)) === 'online', 60000);
  await A.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) { await A.evaluate(() => { try { localStorage.removeItem('hgv:lbsent'); FEED.sent = {}; } catch (e) {} try { feedNow(); } catch (e) {} }); await A.evaluate(() => HGGrapevine.sync.run().catch(e => e.message)); await A.waitForTimeout(1500); }
  await A.waitForTimeout(3000);
  const st = await A.evaluate(() => ({ s: HGGrapevine.status().status, text: HGGrapevine.status().text, sync: HGGrapevine.sync.status().state, goons: (HGGrapevine.eco.state() || {}).goons }));
  const log = fs.readFileSync('/home/user/grapevine/.archive-a.log', 'utf8').split('\n').filter(l => /flood:|silenced|auto-banned|cold/i.test(l));
  check('still online after a full first sync and feed', st.s === 'online', JSON.stringify(st));
  check('saves synced', st.sync === 'ok', st.sync);
  check('no flood warnings on the server', log.length === 0, log.slice(0, 2).join(' | '));
  check('no rate refusals seen by the page', errs.length === 0, errs.slice(0, 2).join(' | '));
  const strikes = await A.evaluate(() => HGGrapevine.eco.state() && 0);
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
