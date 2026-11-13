// Leaderboards: every board gets the right number from each game's own save (also numbers past a quadrillion), per account.
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
const plant = P => P.evaluate(() => {
  const S = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  S('brownEClickerSave', { v: 3, state: { brownEs: 5 }, life: { earned: 3.5e21 }, run: { earned: 1e9 }, meta: { ascensions: 4 } });
  S('brownEClickerSave_rb', { v: 3, state: { brownEs: 1 }, life: { earned: 7e7 }, run: {}, meta: {} });
  S('huntingtonTetrisSurge1', { v: 2, best: { marathon: [{ s: 91234, l: 80, t: 300000 }, { s: 500, l: 3, t: 100 }], ultra: [{ s: 40000, l: 30, t: 120000 }], sprint: [{ s: 1000, l: 40, t: 65432 }, { s: 900, l: 40, t: 80000 }] }, stats: { lines: 420, tetrises: 9, games: 12, bestFloor: 7, bosses: 2 } });
  S('netWorthPB', '250000'); S('lifeScorePB', '9999999');
  S('td2_records', { best: 33, bestEndless: 61, games: 5, kills: 900 });
  S('steelstorm_save', { v: 1, stats: { matches: 9, wins: 6, kills: 77, deaths: 30, caps: 2 } });
  S('mayhem_save', { v: 1, stats: { crowns: 3, shows: 11, qualified: 29 } });
  S('spikes100_progress', { unlocked: 42, bestOneLife: 9, bestEndless: 17 });
  S('blocky21_life', { xp: 1234.5, prestige: 1, kills: 800, headshots: 90, best: { classic: 22 }, waves: 30 });
  S('neonScores', [{ name: 'x', val: 4321 }]);
});
const board = (P, k) => P.evaluate(k => HGGrapevine.eco.lbGet(k).then(m => ({ n: m.n, me: m.me && m.me.s, top: m.rows[0] && m.rows[0].s, d: (m.rows.find(r => r.me) || {}).d }), e => ({ err: e.message })), k);
const want = async (P, k, v, label) => { const b = await until(async () => { const x = await board(P, k); return x.me === v ? x : null; }, 15000) || await board(P, k); check(label || k + ' = ' + v, b.me === v, JSON.stringify(b)); return b; };
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const A = await device(ctxA);
  await plant(A);
  const tag = String(Date.now() % 100000); await createAccount(A, 'LbA' + tag);
  await until(async () => (await status(A)) === 'online', 60000);
  console.log('\n=== 1. each board takes the right number from the save ===');
  await want(A, 'clicker:total', 3.5e21, 'Brown E Clicker: the all-time total (3.5 sextillion), not the balance');
  await want(A, 'clicker:asc', 4);
  await want(A, 'clicker:rb', 7e7, 'Rebalanced beta has its own board');
  const ts = await want(A, 'tetris:score', 91234, 'Tetris: the best score over the modes');
  check('...with the mode it came from', ts.d && ts.d.mode === 'marathon', JSON.stringify(ts.d));
  await want(A, 'tetris:lines', 420); await want(A, 'tetris:floor', 7); await want(A, 'tetris:sprint', 65.43, 'Tetris sprint: the fastest time, in seconds');
  await want(A, 'market:worth', 250000, 'Market & Life: net worth is net worth (not the life score)');
  await want(A, 'market:score', 9999999);
  await want(A, 'td:endless', 61); await want(A, 'td:best', 33);
  await want(A, 'steel:wins', 6); await want(A, 'steel:kills', 77);
  await want(A, 'mayhem:crowns', 3); await want(A, 'mayhem:qualified', 29);
  await want(A, 'spikes:level', 42); await want(A, 'blocky:wave', 22); await want(A, 'neon:best', 4321);
  check('a fractional XP total is taken (rounded down)', (await board(A, 'blocky:xp')).me > 1000, JSON.stringify(await board(A, 'blocky:xp')));
  console.log('\n=== 2. the tab shows it, and updates by itself ===');
  await A.click('#tour .skip', { timeout: 3000 }).catch(() => {});
  await A.evaluate(() => { document.getElementById('tab-lb').click(); });
  await until(() => A.evaluate(() => /Brown E Clicker/.test(document.getElementById('view-lb').textContent)), 15000);
  await A.evaluate(() => { [...document.querySelectorAll('#view-lb [data-lbg]')].find(b => /Brown E Clicker/.test(b.textContent)).click(); });
  const txt = await until(() => A.evaluate(() => { const t = document.getElementById('view-lb').innerText; return /LbA\d+/.test(t) ? t : null; }), 15000);
  check('3.5e21 reads as "3.50 Sx"', /3\.50 Sx/.test(txt || ''), (txt || '').replace(/\s+/g, ' ').slice(0, 200));
  await A.evaluate(() => { const s = JSON.parse(localStorage.getItem('brownEClickerSave')); s.life.earned = 9e24; localStorage.setItem('brownEClickerSave', JSON.stringify(s)); feedNow(); });
  check('a new best shows on the open board without touching anything', !!(await until(() => A.evaluate(() => /9\.00 Sp/.test(document.getElementById('view-lb').innerText)), 15000)));
  console.log('\n=== 3. the auto-clicker guard takes you off the board ===');
  await A.evaluate(() => { localStorage.setItem('brownEClicker_ac', '3'); feedNow(); });
  check('three strikes: gone from the Brown E Clicker board', !!(await until(async () => (await board(A, 'clicker:total')).me == null, 15000)), JSON.stringify(await board(A, 'clicker:total')));
  console.log('\n=== 4. a second account on the same device ===');
  await A.evaluate(() => HGGrapevine.signOut({ force: true }));
  await A.reload();
  await plant(A);
  await A.evaluate(() => { const s = JSON.parse(localStorage.getItem('td2_records')); s.bestEndless = 12; localStorage.setItem('td2_records', JSON.stringify(s)); });
  await createAccount(A, 'LbB' + tag);
  await until(async () => (await status(A)) === 'online', 60000);
  const tb = await want(A, 'td:endless', 12, 'the second account gets its own (lower) score on the board');
  check('...and the first account is still there', tb.n >= 2 && tb.top === 61, JSON.stringify(tb));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
