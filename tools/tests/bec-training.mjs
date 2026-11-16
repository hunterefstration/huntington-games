// Brown E Clicker 2.1 training: the three lessons step by step with real clicks, Esc / Skip at any step, the first-visit offer,
// old saves (both variants), and that nothing done in a lesson reaches the real save, the leaderboard numbers or auto-click strikes.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/bec-training.mjs [base-url] [--shots]
// base-url defaults to http://127.0.0.1:8090 (any static server of the repo works).
import { chromium } from 'playwright';
const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots');
const URL0 = BASE + '/Brown%20E%20Clicker/index.html';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(100); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !c ? '  ' + JSON.stringify(extra) : '')); };
const errors = [];
async function page(tag, seed, q = '') {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/fonts\.|unpkg|cdn\./, r => r.abort());
  if (seed) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const k in s) localStorage.setItem(k, s[k]); } }, seed);
  await p.goto(URL0 + q); await until(() => p.evaluate(() => !!window.__clicker), 20000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const tut = p => S(p, () => { const t = __clicker.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, sandbox: t.sandbox, done: t.stepDone }; });
// what the leaderboards and the account read, from the real save in localStorage (plus the strike counter)
const real = p => S(p, () => {
  const s = JSON.parse(localStorage.getItem(__clicker.saveKey) || 'null'); if (!s) return null;
  return JSON.stringify({ allTime: s.state.allTime, es: Math.round(s.state.brownEs), cm: s.state.clickMultiLevel, wins: s.state.wins, life: s.life.earned, clicks: s.life.clicks, golden: s.life.golden,
    run: s.run.earned, chips: s.meta.chips, chipsTotal: s.meta.chipsTotal, asc: s.meta.ascensions, tree: s.meta.tree.slice().sort(), own: s.shopItems.map(i => i.owned).join(','),
    upg: s.upgrades.slice().sort(), ach: Object.keys(s.achievements).sort(), mkt: s.market && JSON.stringify(s.market.goods && s.market.goods.map(g => g.own)), ac: localStorage.getItem('brownEClicker_ac') });
});
const live = p => S(p, () => { const s = __clicker.state; return JSON.stringify({ es: Math.round(s.brownEs), life: s.life.earned, run: s.run.earned, chips: s.meta.chips, asc: s.meta.ascensions, own: __clicker.shopItems.map(i => i.owned).join(','), strikes: __clicker.ac.strikes }); });
async function past(p, i, name, act, ms = 8000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { r = await tut(p); if (!r.active || r.i > i || r.finale) break; if (act && !r.done) await act(); await sleep(120); }
  ok(r && (r.i > i || r.finale), name, r);
  return r;
}
const center = async (p, sel) => { const bb = await p.locator(sel).first().boundingBox(); return bb && [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
const tc = (p, sel) => p.click(sel, { timeout: 1500 }).catch(() => {});
const nextBtn = p => p.click('#hgt .hgt-btns .hgt-btn.pri');

// ---------- 1. a brand-new player (Classic): the offer shows once; Getting started with real clicks ----------
const N = await page('new');
ok(await S(N, () => document.getElementById('news-btn').textContent.includes('2.1')), 'version 2.1 on the menu');
ok(await S(N, () => !document.getElementById('tb-learn-badge').classList.contains('hidden')), '🎓 says NEW');
await N.click('#start-btn');
ok(!!(await until(() => S(N, () => __clicker.tut.offerOpen), 3000)), 'first START: the basics are offered');
ok(await S(N, () => JSON.parse(localStorage.getItem('brownEClickerSave')).tutOffer === 1), 'the offer is remembered in brownEClickerSave');
await N.click('#hgt-offer .hgt-btn:not(.pri)');   // No thanks
await N.reload(); await until(() => N.evaluate(() => !!window.__clicker), 20000);
await N.click('#start-btn'); await sleep(1000);
ok(!(await S(N, () => __clicker.tut.offerOpen)), 'the offer does not come back');
ok(!(await S(N, () => __clicker.tut.offer())), 'offer() refuses a second time');
// a little real progress first, so "unchanged" means something
await S(N, () => { __clicker.give(140); __clicker.check(); __clicker.buy(2); __clicker.check(); }); await sleep(1300); await S(N, () => __clicker.save(true));   // a Bigger Mouse: no E/s, so the real numbers stand still
const r0 = await real(N), ac0 = await S(N, () => [localStorage.getItem('brownEClicker_ac'), __clicker.ac.strikes, __clicker.ac.raw.length]);
await N.click('#tb-learn');
ok(await S(N, () => __clicker.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row').length === 3), 'the 🎓 Training list shows three lessons');
await N.click('#hgt-hub .hgt-row[data-l="start"] .hgt-btn');
let r = await tut(N);
ok(r.active && r.lesson === 'start' && r.sandbox, 'Getting started runs in the sandbox', r);
ok(await S(N, () => __clicker.state.brownEs === 0 && __clicker.shopItems[0].owned === 0), 'the practice game starts from zero');
ok(await S(N, () => !document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-hole')).boxShadow.includes('9999px')), 'menus: the screen dims around the target');
const [ex, ey] = await center(N, '#big-e-container');
r = await past(N, 0, 'Click the E (real clicks, faster than the guard allows)', async () => { for (let k = 0; k < 6; k++) await N.mouse.click(ex, ey); });
ok(await S(N, a => localStorage.getItem('brownEClicker_ac') === a[0] && __clicker.ac.strikes === a[1] && __clicker.ac.raw.length === a[2], ac0), 'lesson clicks never reach the auto-click guard');
if (SHOTS) await N.screenshot({ path: '/tmp/bec-train-1.png' });
r = await past(N, 1, 'Buy your first building', () => tc(N, '#buy-btn-0'));
await nextBtn(N); await nextBtn(N);
ok((await tut(N)).title === 'Buy an upgrade', 'Next goes through the info steps');
r = await past(N, 4, 'Buy an upgrade (click a tile)', () => tc(N, '#upgrade-grid [data-upg]'));
await nextBtn(N);
r = await past(N, 6, 'Open the stats', () => tc(N, '#stats-btn'));
r = await past(N, 7, 'Close the stats', () => tc(N, '#stats-close'));
await nextBtn(N); await nextBtn(N);
ok(await S(N, () => __clicker.tut.finale), 'Getting started reaches the finale');
await N.click('#hgt .hgt-skip');   // Close
ok(!(await S(N, () => __clicker.tut.active || __clicker.tut.sandbox)), 'closed: back to the real game');
ok(await real(N) === r0, 'the real save is unchanged (leaderboard numbers, strikes)', [r0, await real(N)]);
ok(await S(N, () => __clicker.state.brownEs > 0 && __clicker.shopItems[2].owned === 1 && __clicker.shopItems[0].owned === 0), 'the real run is back in memory');
ok(await S(N, () => JSON.parse(localStorage.getItem('brownEClickerSave')).tut.start === 1 && __clicker.tut.lessons[0].done), 'Getting started is remembered');
ok(await S(N, () => document.getElementById('tb-learn-badge').classList.contains('hidden')), 'NEW goes away');
await N.reload(); await until(() => N.evaluate(() => !!window.__clicker), 20000);
ok(await S(N, () => __clicker.tut.lessons[0].done && !__clicker.tut.lessons[1].done), 'still ticked after a reload');

// ---------- 2. an old save (Rebalanced beta, no training fields): loads, no offer; Growing and Ascending ----------
const OLD = { v: 3, t: Date.now(), variant: 'rb', state: { allTime: 9e9, brownEs: 123456, clickMultiLevel: 3, bpsMultiLevel: 0, wins: 1, pendingWin: false },
  shopItems: [{ id: 'mouse', owned: 12 }, { id: 'mech', owned: 4 }], upgrades: [], achievements: {}, buffs: [], run: { earned: 5e6, clicks: 900 },
  life: { earned: 9e9, clicks: 5000, golden: 7 }, buyAmount: 10, meta: { chips: 12, chipsTotal: 30, ascensions: 2, bestRunChips: 9, tree: ['root'], challengesDone: {}, heaven: false, seasons: {} } };
const CLASSIC = JSON.stringify({ v: 3, t: Date.now(), state: { allTime: 77, brownEs: 7 }, life: { earned: 77 }, meta: { chips: 0 } });
const O = await page('old-rb', { brownEClickerSave_rb: JSON.stringify(OLD), brownEClickerSave: CLASSIC, brownEClicker_ac: '1' }, '?variant=rb');
ok(await S(O, () => __clicker.variant === 'rb' && __clicker.saveKey === 'brownEClickerSave_rb'), 'Rebalanced beta: its own save key');
ok(await S(O, () => { const s = __clicker.state; return s.life.earned === 9e9 && s.meta.ascensions === 2 && s.meta.chips === 12 && __clicker.shopItems.find(i => i.id === 'mouse').owned === 12; }), 'an old save loads (no training fields)');
await O.click('#start-btn'); await sleep(1000);
ok(!(await S(O, () => __clicker.tut.offerOpen)), 'veterans are not offered the basics');
await S(O, () => __clicker.save(true));
const o0 = await real(O), l0 = await live(O);
ok(await S(O, () => __clicker.tut.start('grow')), 'Growing starts');
ok(await S(O, () => __clicker.tut.sandbox && __clicker.shopItems.find(i => i.id === 'bank').owned === 15 && __clicker.market.unlocked), 'a practice game further along (15 banks, market open)');
await nextBtn(O);
r = await past(O, 1, 'Click the Golden E', async () => { if (await S(O, () => !document.getElementById('golden-e').classList.contains('hidden'))) await O.click('#golden-e', { timeout: 1000, force: true }).catch(() => {}); });
if ((await tut(O)).title === 'Buffs') await nextBtn(O);
r = await past(O, 3, 'Buy 10 at once', () => tc(O, '#buy-amount [data-amt="10"]'));
r = await past(O, 4, 'Buy a synergy', () => tc(O, '#upgrade-grid [data-upg^="s_"]'));
r = await past(O, 5, 'Open the market', () => tc(O, '#tb-market'));
r = await past(O, 6, 'Buy a good', () => tc(O, '#market-rows [data-act="b1"]:not([disabled])'));
r = await past(O, 7, 'Sell it', () => tc(O, '#market-rows [data-act="sall"]:not([disabled])'));
ok(await S(O, () => document.getElementById('market-modal').classList.contains('hidden')), 'the market closes for the garden step');
await nextBtn(O); await nextBtn(O);
ok(await S(O, () => __clicker.tut.finale), 'Growing reaches the finale');
await O.click('#hgt .hgt-end .hgt-btn.pri');     // Next: Ascending
r = await tut(O);
ok(r.lesson === 'ascend' && r.sandbox, 'Next: Ascending starts from the finale', r);
ok(await S(O, () => __clicker.canAscend() && __clicker.pendingChips() >= 1), 'the practice run can ascend');
r = await past(O, 0, 'Open the Prestige Tree', () => tc(O, '#tb-tree'));
await nextBtn(O); await nextBtn(O);
r = await past(O, 3, 'Buy a tree upgrade', () => tc(O, '#tree-board [data-node="root"]'));
await nextBtn(O); await nextBtn(O);
r = await past(O, 6, 'Close the tree', () => tc(O, '#tree-close'));
ok(await S(O, () => __clicker.tut.finale), 'Ascending reaches the finale');
await O.keyboard.press('Escape');
ok(!(await S(O, () => __clicker.tut.active || __clicker.tut.sandbox)), 'Esc on the finale closes it');
ok(await real(O) === o0, 'the real Rebalanced save is unchanged (life.earned, chips, ascensions, strikes)', [o0, await real(O)]);
ok(await live(O) === l0, 'the real run is back in memory exactly', [l0, await live(O)]);
ok(await S(O, a => localStorage.getItem('brownEClickerSave') === a, CLASSIC), 'the Classic save is not touched');
ok(await S(O, () => { const t = JSON.parse(localStorage.getItem('brownEClickerSave_rb')).tut; return t.grow === 1 && t.ascend === 1 && !t.start; }), 'Growing and Ascending remembered in brownEClickerSave_rb');

// ---------- 3. Esc / Skip at any step leaves and restores ----------
for (const [id, n] of [['start', 10], ['grow', 10], ['ascend', 7]]) {
  let all = true;
  for (let i = 0; i < n; i += (id === 'grow' ? 2 : 3)) {
    await S(O, x => __clicker.tut.start(x), id);
    for (let k = 0; k < i; k++) await S(O, () => __clicker.tut.next());
    await sleep(60);
    if (i % 2) await O.keyboard.press('Escape'); else await O.click('#hgt .hgt-skip');
    const st = await S(O, () => ({ a: __clicker.tut.active, s: __clicker.tut.sandbox, gone: !document.getElementById('hgt') }));
    if (st.a || st.s || !st.gone) { all = false; console.log('  left badly', id, i, st); }
  }
  ok(all, 'Esc / Skip leaves ' + id + ' at any step');
}
ok(await real(O) === o0 && await live(O) === l0, 'after all that, the real save and run are still unchanged');
await O.click('#tb-learn');
ok(await S(O, () => document.querySelectorAll('#hgt-hub .hgt-row.done').length === 2), 'the Training list ticks the two done lessons');
await O.keyboard.press('Escape');
ok(!(await S(O, () => __clicker.tut.hubOpen)), 'Esc closes the Training list');
await O.click('#menu-learn', { force: true }).catch(() => {});

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(`\n${passes} passed, ${fails} failed`);
await b.close();
process.exit(fails ? 1 : 0);
