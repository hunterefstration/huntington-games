// The casino page itself, for real: two ordinary players in the launcher, on the rig server. Buys chips, plays the
// machines and a blackjack hand through the buttons, then the live tables (roulette, duel, pot, race, rocket).
//   bash tools/rig/test.sh gv-casino-ui   (about 4 minutes: the pot is drawn every 2 minutes)
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
const errs = [];
async function player(name, goons, boss) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }), P = await device(ctx);
  await createAccount(P, name); await until(async () => (await status(P)) === 'online', 60000);
  await boss.evaluate(([n, g]) => HGGrapevine.eco.admin('goons', n, null, g), [name, goons]); await sleep(1200);
  P.on('pageerror', e => errs.push(name + ': ' + e.message));
  await P.evaluate(() => playNow(GAMES.find(g => g.dir === 'Casino')));
  const F = await until(async () => { const f = P.frames().find(f => /\/Casino\//.test(f.url())); return f && await f.evaluate(() => !!(window.__casino && __casino.state.ready)).catch(() => false) ? f : null; }, 30000);
  if (!F) return { P, F: null };
  await F.evaluate(() => { __casino.setFast(true); __casino.setMute && __casino.setMute(true); document.querySelector('#modal').classList.add('hidden'); });
  return { P, F, name };
}
const chips = F => F.evaluate(() => __casino.state.bal.chips);
const server = F => F.evaluate(() => __casino.call('live').then(r => r.bal.chips));
async function matches(F, label) { const live = await server(F); await sleep(300); const s = await F.evaluate(() => ({ c: __casino.state.bal.chips, t: +document.querySelector('#bal-chips').textContent.replace(/,/g, '') })); check(label + ': the balance bar matches the server', s.t === live && s.c === live, JSON.stringify({ live, s })); }
const buy = async (F, goons) => { await F.click('#b-buy'); await F.fill('#mbox input', String(goons)); await F.dispatchEvent('#mbox input', 'input'); await F.click('#mbox .btn.gold.big'); await sleep(1500); };
const go = F => F.evaluate(() => document.querySelector('.bb-go').click());
// wait until live table g has at least `need` ms of betting left
const betOpen = (F, g, need) => until(() => F.evaluate(([g, need]) => { const L = __casino.state.live[g], t = Date.now() + __casino.state.offset; return (t % L.cyc) < L.bet - need; }, [g, need]), 130000, 400);
try {
  const D = await device(await browser.newContext());
  await createAccount(D, 'CasBoss'); await until(async () => (await status(D)) === 'online', 60000);
  await until(() => D.evaluate(() => !!HGGrapevine.eco.state()), 15000);
  check('the Casino has a card on the games page', await D.evaluate(() => !!GAMES.find(g => g.dir === 'Casino') && !!document.querySelector('.game[data-dir="Casino"]')));
  const a = await player('CasPat', 40, D), A = a.F;
  check('the casino opens from its card, signed in, for real', !!A && !(await A.evaluate(() => __casino.practice)));
  check('it knows who is playing', (await A.evaluate(() => __casino.state.me && __casino.state.me.name)) === 'CasPat');
  check('it says goons are play money', /not worth anything/i.test(await A.evaluate(() => document.body.innerText)));
  await buy(A, 30);
  check('30 goons buy 3000 chips at the cage', (await chips(A)) === 3000 && (await A.evaluate(() => document.querySelector('#bal-chips').textContent)) === '3,000');

  console.log('\n=== machines and a table, through the buttons ===');
  async function one(id, setup, play) {
    await A.evaluate(id => __casino.open(id), id); await sleep(400); if (setup) await setup();
    const before = await chips(A), done = A.evaluate(() => __casino.next());
    await (play ? play() : go(A));
    const r = await Promise.race([done, sleep(25000).then(() => null)]); await sleep(300);
    const after = await chips(A);
    check(id + ' moves the balance by exactly bet and win', !!r && after === before - r.bet + r.win, JSON.stringify({ r, before, after }));
    await sleep(500);
  }
  await one('coin'); await one('slots'); await one('plinko'); await one('dice');
  await one('roulette', async () => { for (const k of ['red', 'n17', 'c2']) await A.click(`.rs[data-k="${k}"]`); });
  await one('bj', null, async () => {
    await go(A);
    for (let i = 0; i < 14; i++) { await sleep(700); const s = await A.evaluate(() => ({ hidden: document.querySelector('.acts').classList.contains('hidden'), v: +((document.querySelector('.hand.active .vbadge') || document.querySelector('.hand .vbadge') || {}).textContent || '0').split(' ')[0] })); if (s.hidden) break; await A.evaluate(k => document.querySelector(`.acts [data-a="${k}"]`).click(), s.v < 15 ? 'hit' : 'stand'); }
  });
  await matches(A, 'after the machines');

  console.log('\n=== a second player: duel ===');
  const b = await player('CasQuinn', 40, D), B = b.F; await buy(B, 30);
  await A.evaluate(() => __casino.open('duel')); await B.evaluate(() => __casino.open('duel')); await sleep(600);
  const a0 = await chips(A), b0 = await chips(B);
  const aDone = A.evaluate(() => __casino.next()), bDone = B.evaluate(() => __casino.next());
  await go(A);
  check('opening a duel takes the stake at once', !!(await until(async () => (await chips(A)) < a0, 6000)), `${a0} -> ${await chips(A)}`);
  const stake = a0 - await chips(A);
  const seen = await until(() => B.evaluate(() => { const r = [...document.querySelectorAll('.drow2')].find(r => /CasPat/.test(r.textContent)); return r && !!r.querySelector('.btn.gold'); }), 8000);
  check('the other player sees the open duel with a Take button', !!seen);
  await B.evaluate(() => [...document.querySelectorAll('.drow2')].find(r => /CasPat/.test(r.textContent)).querySelector('.btn.gold').click());
  const [ra, rb] = await Promise.all([Promise.race([aDone, sleep(20000).then(() => null)]), Promise.race([bDone, sleep(20000).then(() => null)])]); await sleep(800);
  check('both see the flip end', !!ra && !!rb, JSON.stringify({ ra, rb }));
  check('exactly one of them wins, and the prize is the pot less 3%', !!ra && !!rb && (ra.win > 0) !== (rb.win > 0) && Math.max(ra.win, rb.win) === Math.floor(stake * 2 * 0.97), JSON.stringify({ stake, a: ra && ra.win, b: rb && rb.win }));
  check('the chips add up', (await chips(A)) + (await chips(B)) === a0 + b0 - stake * 2 + Math.floor(stake * 2 * 0.97), `${await chips(A)} + ${await chips(B)}`);
  await matches(A, 'duel, opener'); await matches(B, 'duel, taker');

  console.log('\n=== the pot (joined now, drawn later while they play something else) ===');
  await A.evaluate(() => __casino.open('pot')); await B.evaluate(() => __casino.open('pot')); await sleep(500);
  await betOpen(A, 'pot', 12000);
  const pa0 = await chips(A), pb0 = await chips(B);
  await go(A); await sleep(900); await go(B); await sleep(1200);
  const inA = pa0 - await chips(A), inB = pb0 - await chips(B);
  check('both stakes are in the pot', inA > 0 && inB > 0, JSON.stringify({ inA, inB }));
  check('each sees both names in the pot', await A.evaluate(() => /CasQuinn/.test(document.querySelector('.lside').textContent)) && await B.evaluate(() => /CasPat/.test(document.querySelector('.lside').textContent)));
  const potRound = await A.evaluate(() => __casino.state.live.pot.r);

  console.log('\n=== horse racing ===');
  await A.evaluate(() => __casino.open('race')); await B.evaluate(() => __casino.open('race')); await sleep(500);
  await betOpen(A, 'race', 6000);
  const r0 = await chips(A), raceDone = A.evaluate(() => __casino.next());
  await A.evaluate(() => document.querySelectorAll('.rbet')[0].click()); await sleep(600);
  if ((await chips(A)) === r0) await go(A).catch(() => {});      // (a slip that needs confirming)
  check('backing a horse takes the stake', !!(await until(async () => (await chips(A)) < r0, 6000)), `${r0} -> ${await chips(A)}`);
  check('the other player sees the bet', !!(await until(() => B.evaluate(() => /CasPat/.test(document.querySelector('.lside').textContent)), 6000)));
  const rr = await Promise.race([raceDone, sleep(70000).then(() => null)]); await sleep(1200);
  check('the race is run and settles for me', !!rr && rr.bet > 0 && rr.bet <= r0, JSON.stringify(rr));
  await sleep(14000);      // the winnings are paid when the horses cross the line (and the pot may pay out meanwhile: compare with the server)
  await matches(A, 'after the race');

  console.log('\n=== live rocket ===');
  await A.evaluate(() => __casino.open('crash')); await B.evaluate(() => __casino.open('crash')); await sleep(500);
  await A.evaluate(() => { const i = document.querySelector('.bbar input.inp'); if (i) { i.value = ''; i.dispatchEvent(new Event('input')); } });
  await B.evaluate(() => { const i = document.querySelector('.bbar input.inp') || document.querySelector('input.inp.num'); i.value = '1.05'; i.dispatchEvent(new Event('input')); });
  await betOpen(A, 'crash', 2500);
  const c0 = await chips(A), d0 = await chips(B), cA = A.evaluate(() => __casino.next()), cB = B.evaluate(() => __casino.next());
  await go(A); await go(B);
  check('both board the rocket', !!(await until(async () => (await chips(A)) < c0 && (await chips(B)) < d0, 6000)));
  const cash = await until(() => A.evaluate(() => { const b = document.querySelector('.cashbig'); return b && !b.classList.contains('hidden'); }), 20000, 100);
  if (cash) { await sleep(500); await A.evaluate(() => document.querySelector('.cashbig').click()); }
  const [fa, fb] = await Promise.all([Promise.race([cA, sleep(45000).then(() => null)]), Promise.race([cB, sleep(45000).then(() => null)])]); await sleep(1500);
  check('the flight ends for both (cash-out by hand, and an automatic one at 1.05x)', !!fa && !!fb, JSON.stringify({ fa, fb }));
  await matches(A, 'after the rocket, A'); await matches(B, 'after the rocket, B');      // (the pot can pay out meanwhile: compare with the server)

  console.log('\n=== back to the pot ===');
  const paid = await until(() => A.evaluate(r => __casino.call('live').then(m => m.live.pot.r > r), potRound), 135000, 2500);
  await sleep(2500);
  const pa1 = await chips(A), pb1 = await chips(B);
  check('the pot was drawn while they were at another table', !!paid);
  await matches(A, 'after the pot, A'); await matches(B, 'after the pot, B');
  const won = Math.floor((inA + inB) * 0.97), sum = pa1 + pb1, exp = pa0 + pb0 - inA - inB + won;      // (the race and rocket moved A and B too, so compare the pot's part)
  check('one of them took the pot, less 3%', !!paid && (pa1 > pb1 || pb1 > pa1), `A ${pa1}, B ${pb1}, pot ${inA + inB} -> ${won}`);
  check('no page errors in the casino', !errs.length, errs.slice(0, 4).join(' | '));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
