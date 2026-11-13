// How much the database sends while a class plays: five players with the launcher open, games saving, chat going,
// leaderboards looked at. Prints KB per player-minute (from the server's own meter, dbOut) and the biggest queries.
//   bash tools/rig/test.sh gv-egress   (about 4 minutes)    LIMIT=<KB per player-minute> fails the run above it
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
const N = 5, MINUTES = Number(process.env.MINUTES || 3), LIMIT = Number(process.env.LIMIT || 60);
const KEYS = ['blocky21_life', 'blocky21_settings', 'brownEClicker_save', 'brownEClicker_rb', 'td2_save', 'lumi_save1', 'lumi_save2', 'lumi_save3', 'sov.campaign', 'steelstorm_save', 'mayhem_save', 'marketLife_save', 'spikes100_progress', 'frontline_save', 'imposter_stats', 'elementlab_found', 'hgach', 'hgq:blocky', 'hgq:steel', 'hgmini_snake'];
for (let i = 0; i < 40; i++) KEYS.push('hgach_' + i);          // lots of small keys, like a real account
const fill = n => 'x'.repeat(n);
async function player(i) {
  const P = await device(await browser.newContext({ viewport: { width: 1100, height: 760 } }));
  await createAccount(P, 'Egress' + i + Math.random().toString(36).slice(2, 5)); await until(async () => (await status(P)) === 'online', 60000);
  await P.evaluate(([keys, fillN]) => { keys.forEach((k, j) => localStorage.setItem(k, JSON.stringify({ v: 1, n: j, pad: 'x'.repeat(j < 20 ? 2500 : 120) }))); }, [KEYS, 0]);
  await P.evaluate(() => HGGrapevine.sync.run()).catch(() => {});
  return P;
}
async function chat(P, text) {
  return P.evaluate(t => { const d = document.getElementById('gvapp') && document.getElementById('gvapp').contentDocument; const x = d && d.getElementById('text'); if (!x || !x.offsetParent) return false; x.value = t; x.dispatchEvent(new Event('input', { bubbles: true })); d.getElementById('send').click(); return true; }, text).catch(() => false);
}
try {
  const D = await device(await browser.newContext());
  await createAccount(D, 'EgressBoss'); await until(async () => (await status(D)) === 'online', 60000);
  const ps = []; for (let i = 0; i < N; i++) ps.push(await player(i));
  for (const P of ps) {
    await P.evaluate(() => document.getElementById('tab-chat').click());
    await until(() => P.evaluate(() => { const d = document.getElementById('gvapp').contentDocument, b = d && [...d.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('#main')); if (!b) return false; b.click(); return true; }), 30000);
  }
  const ids = await Promise.all(ps.map(P => P.evaluate(() => HGGrapevine.me().userId)));
  await sleep(3000);
  const a = await D.evaluate(() => HGGrapevine.eco.dbOut());
  console.log(`=== ${N} players for ${MINUTES} minutes: saves change every 5 s and sync every 15 s, a chat line every 10 s, profiles looked up every 30 s ===`);
  const t0 = Date.now(); let tick = 0;
  while (Date.now() - t0 < MINUTES * 60000) {
    tick++;
    await Promise.all(ps.map(async (P, i) => {
      await P.evaluate(([k1, k2, t]) => { localStorage.setItem(k1, JSON.stringify({ v: 1, t, pad: 'y'.repeat(2500) })); localStorage.setItem(k2, JSON.stringify({ v: 1, t, pad: 'z'.repeat(2500) })); }, [KEYS[tick % 5], KEYS[2 + (tick % 7)], tick]);
      if (tick % 3 === 0) await P.evaluate(() => HGGrapevine.sync.run()).catch(() => {});
      if (tick % 2 === i % 2) await chat(P, 'line ' + tick + ' from player ' + i);
      if (tick % 6 === 0) await P.evaluate(ids => HGGrapevine.eco.cos(ids), ids);
    }));
    await sleep(5000);
  }
  const mins = (Date.now() - t0) / 60000;
  const b = await D.evaluate(() => HGGrapevine.eco.dbOut());
  const kb = (b.total - a.total) / 1024, per = kb / N / mins;
  console.log(`    the database sent ${Math.round(kb)} KB: ${per.toFixed(1)} KB per player-minute (= ${(per * 60 / 1024).toFixed(2)} MB per player-hour)`);
  for (const t of b.top.slice(0, 8)) console.log(`    ${String(t.kb).padStart(7)} KB ${String(t.calls).padStart(6)}x  ${t.q}`);
  check(`under ${LIMIT} KB per player-minute`, per < LIMIT, per.toFixed(1));
  const saved = await ps[0].evaluate(() => HGGrapevine.sync.status());
  check('saves still sync', saved.state === 'ok', JSON.stringify(saved));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
