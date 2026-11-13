// The casino: chips for goons, every game answers, house edges are inside their bands, live tables pay, nothing mints goons.
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
// (a person plays far slower than this test: when the server says "slow down", wait and ask again)
const cas = async (P, op, a) => { for (let i = 0; ; i++) { const r = await P.evaluate(([op, a]) => HGGrapevine.eco.casino(op, a).then(m => m, e => ({ err: e.message })), [op, a || {}]); if (i > 8 || !/Slow down/.test(r.err || '')) return r; await sleep(1500); } };
try {
  // the first account on a fresh rig is the owner (a developer: unlimited goons); the second is an ordinary player
  const D = await device(await browser.newContext());
  await createAccount(D, 'CasDev'); await until(async () => (await status(D)) === 'online', 60000);
  const A = await device(await browser.newContext());
  await createAccount(A, 'CasAnn'); await until(async () => (await status(A)) === 'online', 60000);
  await until(() => D.evaluate(() => !!HGGrapevine.eco.state()), 15000);
  console.log('\n=== 1. chips ===');
  let r = await cas(A, 'enter');
  check('the casino opens with what it offers', r.ok && r.limits.rate === 100 && Object.keys(r.edge).length >= 20 && !!r.live.lr && !!r.tables.slots, JSON.stringify(r.err || Object.keys(r.edge).length));
  check('a new player has no chips', r.bal.chips === 0, JSON.stringify(r.bal));
  r = await cas(A, 'coin', { bet: 10, pick: 'h' });
  check('...and cannot bet without them', /Not enough chips/.test(r.err || ''), JSON.stringify(r));
  r = await cas(A, 'buy', { goons: 5 });
  check('...or buy chips with goons they do not have', /You have \d+ goon/.test(r.err || ''), JSON.stringify(r));
  await D.evaluate(() => HGGrapevine.eco.admin('goons', 'CasAnn', null, 30)); await A.waitForTimeout(1500);
  const g0 = await A.evaluate(() => HGGrapevine.eco.state().goons);
  r = await cas(A, 'buy', { goons: 20 });
  check('20 goons buy 2000 chips', r.ok && r.bal.chips === 2000 && r.bal.goons === g0 - 20, JSON.stringify(r.bal || r.err));
  r = await cas(A, 'cash', { goons: 3 });
  check('300 chips cash back into 3 goons', r.ok && r.bal.chips === 1700 && r.bal.goons === g0 - 17, JSON.stringify(r.bal || r.err));
  r = await cas(A, 'cash', { goons: 500 });
  check('you cannot cash chips you do not have', !!r.err);
  console.log('\n=== 2. every game answers and the books balance ===');
  const one = { coin: { bet: 10, pick: 'h' }, dice: { bet: 10, target: 50, over: true }, roulette: { bets: [{ k: 'red', a: 5 }, { k: 'n17', a: 5 }] }, slots: { bet: 10 }, plinko: { bet: 10, rows: 12, risk: 'high' }, wheel: { bet: 10 },
    keno: { bet: 10, picks: [3, 7, 11, 19, 23] }, baccarat: { bets: { p: 5, b: 5 } }, craps: { bet: 10, side: 'pass' }, sicbo: { bets: [{ k: 'big', a: 5 }, { k: 't10', a: 5 }] }, scratch: { tier: 0 }, crashx: { bet: 10, target: 2 } };
  for (const [g, a] of Object.entries(one)) {
    const before = (await cas(A, 'live')).bal.chips; r = await cas(A, g, a);
    check(g + ' plays and the balance moves by exactly stake and win', r.ok && r.r.bet === 10 && r.bal.chips === before - 10 + r.r.win, JSON.stringify(r.err || { bet: r.r.bet, win: r.r.win, b: before, a: r.bal.chips }));
  }
  check('a bet over the limit is refused', !!(await cas(A, 'coin', { bet: 999999, pick: 'h' })).err);
  check('a fractional or negative bet is refused', !!(await cas(A, 'coin', { bet: 7.5, pick: 'h' })).err && !!(await cas(A, 'dice', { bet: -50, target: 50 })).err);
  check('a made-up roulette bet is refused', !!(await cas(A, 'roulette', { bets: [{ k: 'n99', a: 10 }] })).err);
  // blackjack to the end
  let b0 = (await cas(A, 'live')).bal.chips; r = await cas(A, 'bj', { act: 'deal', bet: 20 }); let staked = 20;
  for (let i = 0; i < 12 && r.ok && !r.r.over; i++) r = await cas(A, 'bj', { act: r.r.view.hands[r.r.view.active].v < 15 ? 'hit' : 'stand' });
  check('blackjack plays to the end and pays what it says', r.ok && r.r.over && r.bal.chips === b0 - r.r.bet + r.r.win, JSON.stringify(r.err || { bet: r.r.bet, win: r.r.win }));
  r = await cas(A, 'bj', { act: 'deal', bet: 20 });
  if (r.ok && !r.r.over) { const second = await cas(A, 'slots', { bet: 10 }); check('other games still work during a hand, but not a second turn game', second.ok && /Finish your Blackjack/.test((await cas(A, 'mines', { act: 'start', bet: 10, mines: 3 })).err || '')); while (r.ok && !r.r.over) r = await cas(A, 'bj', { act: 'stand' }); }
  b0 = (await cas(A, 'live')).bal.chips; r = await cas(A, 'vp', { act: 'deal', bet: 10 }); r = await cas(A, 'vp', { act: 'draw', hold: [0, 1] });
  check('video poker deals and draws', r.ok && r.r.over && r.r.view.hand.length === 5 && r.bal.chips === b0 - 10 + r.r.win, JSON.stringify(r.err || r.r.view.rank));
  b0 = (await cas(A, 'live')).bal.chips; r = await cas(A, 'mines', { act: 'start', bet: 10, mines: 1 }); r = await cas(A, 'mines', { act: 'pick', i: 4 }); if (r.ok && !r.r.over) r = await cas(A, 'mines', { act: 'cash' });
  check('mines: pick a tile, cash out', r.ok && r.r.over && r.bal.chips === b0 - 10 + r.r.win, JSON.stringify(r.err || r.r.view.mult));
  b0 = (await cas(A, 'live')).bal.chips; r = await cas(A, 'hilo', { act: 'start', bet: 10 }); for (let i = 0; i < 6 && r.ok && !r.r.over && !r.r.view.n; i++) r = await cas(A, 'hilo', { act: 'guess', g: r.r.view.card <= 7 ? 'hi' : 'lo' }); if (r.ok && !r.r.over) r = await cas(A, 'hilo', { act: 'cash' });
  check('hi-lo: guess, cash out', r.ok && r.r.over && r.bal.chips === b0 - 10 + r.r.win, JSON.stringify(r.err || r.r.view));
  r = await cas(A, 'daily'); const r2 = await cas(A, 'daily');
  check('one free spin a day', r.ok && r.win >= 20 && !!r2.err, JSON.stringify([r.win, r2.err]));
  console.log('\n=== 3. the house edge of every game (developer simulation, nothing paid) ===');
  check('only developers may simulate', /Developers only/.test((await cas(A, 'sim', { game: 'coin', n: 10 })).err || ''));
  const band = { coin: [0.95, 1.0], dice: [0.96, 1.01], roulette: [0.93, 1.01], slots: [0.90, 0.99], plinko: [0.90, 1.03], wheel: [0.90, 0.99], keno: [0.88, 0.99], baccarat: [0.96, 1.005], craps: [0.96, 1.005], sicbo: [0.94, 1.0], scratch: [0.80, 1.02], crashx: [0.93, 1.0],
    bj: [0.94, 1.01], vp: [0.80, 1.0], mines: [0.93, 1.0], hilo: [0.92, 1.0], lr: [0.93, 1.01], crash: [0.93, 1.0], race: [0.90, 1.02] };
  for (const [g, [lo, hi]] of Object.entries(band)) { r = await cas(D, 'sim', { game: g, n: g === 'slots' || g === 'scratch' || g === 'plinko' ? 200000 : 60000, args: g === 'crashx' ? { target: 2 } : undefined }); check(`${g} returns ${(r.rtp * 100).toFixed(1)}%`, r.ok && r.rtp >= lo && r.rtp <= hi, r.err || ''); }
  console.log('\n=== 4. live tables: two players, one round ===');
  await D.evaluate(() => { window.__ev = []; HGGrapevine.on('casino', m => window.__ev.push(m)); }); await cas(D, 'enter'); await cas(D, 'buy', { goons: 50 });
  await A.evaluate(() => { window.__ev = []; HGGrapevine.on('casino', m => window.__ev.push(m)); });
  // wait for a fresh roulette round with time to bet
  let live = (await cas(A, 'live')); while ((live.now % live.live.lr.cyc) > 12000) { await A.waitForTimeout(1000); live = await cas(A, 'live'); }
  b0 = live.bal.chips; r = await cas(A, 'lr', { bets: [{ k: 'red', a: 10 }, { k: 'black', a: 10 }] }); const rd = await cas(D, 'lr', { bets: [{ k: 'n0', a: 10 }] });
  check('both players bet on the same live roulette round', r.ok && rd.ok && r.r.round === rd.r.round, JSON.stringify([r.err, rd.err]));
  check('each sees the other\'s bet arrive', !!(await until(() => A.evaluate(() => window.__ev.some(e => e.ev === 'bet' && e.g === 'lr' && e.n === 'CasDev')), 5000)));
  const paid = await until(() => A.evaluate(rn => window.__ev.find(e => e.ev === 'paid' && e.g === 'lr' && e.r === rn), r.r.round), 40000);
  const num = await A.evaluate(rn => (window.__ev.find(e => e.ev === 'lr' && e.r === rn) || {}).n, r.r.round);
  const after = (await cas(A, 'live')).bal.chips;
  check('the round is drawn for everyone and paid by the clock', !!paid && Number.isInteger(num) && after === b0 - 20 + (num === 0 ? 0 : 20), JSON.stringify({ num, b0, after }));
  // the rocket: bet, cash out by hand in flight
  live = await cas(A, 'live'); while ((live.now % live.live.crash.cyc) > 4000) { await A.waitForTimeout(500); live = await cas(A, 'live'); }
  b0 = live.bal.chips; r = await cas(A, 'crash', { bet: 10 });
  const early = await cas(A, 'crash', { act: 'cash' });
  check('no cashing out before launch', r.ok && /not launched/.test(early.err || ''), JSON.stringify([r.err, early.err]));
  await until(() => A.evaluate(rn => window.__ev.some(e => (e.ev === 'crashGo' || e.ev === 'crash') && e.r === rn), r.r.round), 12000);
  const out = await cas(A, 'crash', { act: 'cash' }); const boom = await until(() => A.evaluate(rn => window.__ev.find(e => e.ev === 'crash' && e.r === rn), r.r.round), 30000);
  const aft2 = (await cas(A, 'live')).bal.chips;
  check('cashing out in flight pays the multiplier of that moment (or it had already blown up)', out.ok ? out.r.mult >= 1 && aft2 === b0 - 10 + out.r.win && out.r.mult < boom.c : /blew up/.test(out.err) && aft2 === b0 - 10, JSON.stringify({ out: out.r || out.err, boom: boom && boom.c }));
  // a duel
  const da = await cas(A, 'duel', { act: 'open', bet: 50 }); b0 = (await cas(A, 'live')).bal.chips; const d0 = (await cas(D, 'live')).bal.chips;
  check('your own duel cannot be taken by you', /yourself/.test((await cas(A, 'duel', { act: 'take', id: da.r.id })).err || ''));
  const dt = await cas(D, 'duel', { act: 'take', id: da.r.id }); await A.waitForTimeout(800);
  const a1 = (await cas(A, 'live')).bal.chips, d1 = (await cas(D, 'live')).bal.chips;
  check('a duel moves the stake from the loser to the winner, less 3%', dt.ok && (dt.r.won ? d1 === d0 - 50 + 97 && a1 === b0 : d1 === d0 - 50 && a1 === b0 + 97), JSON.stringify({ won: dt.r && dt.r.won, a: [b0, a1], d: [d0, d1] }));
  console.log('\n=== 5. boards ===');
  const lb = await A.evaluate(() => HGGrapevine.eco.lbGet('casino:won').then(m => ({ n: m.n, me: m.me && m.me.s, names: m.rows.map(r => r.n) }), e => ({ err: e.message })));
  check('chips won go on a board (developers stay off it)', lb.me > 0 && !lb.names.includes('CasDev'), JSON.stringify(lb));
  const fake = await A.evaluate(() => HGGrapevine.eco.lbBatch([{ b: 'casino:won', s: 9e9, d: null }]).then(m => m.best['casino:won'], e => 'ERR'));
  check('...and cannot be sent in by a client', fake !== 9e9, String(fake));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
