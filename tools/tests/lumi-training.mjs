// Last Light 1.6 training: the three lessons step by step, Esc / Skip at any step, the one-time offer, old saves, and that the
// practice room never records best times, trials, runs, stats, deaths or play time.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/lumi-training.mjs [base-url] [--shots]
// base-url defaults to http://127.0.0.1:8090 (any static server of the repo works).
import { chromium } from 'playwright';
const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots');
const URL0 = BASE + '/Last%20Light/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(100); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !c ? '  ' + JSON.stringify(extra) : '')); };
const errors = [];
async function page(tag, seed) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|peerjs/i.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/fonts\.|unpkg|peerjs|cdn\./, r => r.abort());
  if (seed) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const k in s) localStorage.setItem(k, s[k]); } }, seed);
  await p.goto(URL0); await until(() => p.evaluate(() => !!(window.__lumi && window.__lumi.tut)), 20000);
  await until(() => p.evaluate(() => !document.getElementById('splash')), 5000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const tut = p => S(p, () => { const t = __lumi.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, done: t.stepDone, room: t.inRoom, state: __lumi.G.state }; });
// what the leaderboards read (and the rest of the record) from the real save
const real = p => S(p, () => { const s = JSON.parse(localStorage.getItem('lumi_save') || '{}'); return JSON.stringify({ levels: s.levels || {}, trials: s.trials || {}, runs: s.runs || {}, stats: s.stats || {}, deaths: s.deaths || 0, play: Math.round(s.playTime || 0), sparks: s.sparks || 0, ghost: localStorage.getItem('lumighost') }); });
async function past(p, i, name, act, ms = 8000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { r = await tut(p); if (!r.active || r.i > i || r.finale) break; if (act && !r.done) await act(); await sleep(120); }
  ok(r && (r.i > i || r.finale), name, r);
  return r;
}
const tc = (p, sel) => p.click(sel, { timeout: 1500 }).catch(() => {});
const step = (p, sec, keys) => S(p, a => __lumi.step(a[0], a[1]), [sec, keys || {}]);

// ---------- 1. a brand-new player: the offer, the practice room with only run + jump ----------
const N = await page('new');
ok(await S(N, () => document.getElementById('t-ver').textContent.includes('1.6')), 'version 1.6 on the title');
ok(!!(await until(() => S(N, () => __lumi.tut.offerOpen), 4000)), 'a new player is offered the practice room');
ok(await S(N, () => JSON.parse(localStorage.getItem('lumi_save')).tutOffer === 1), 'the offer is remembered in lumi_save');
const n0 = await real(N);
await N.click('#hgt-offer .hgt-btn.pri');
let r = await tut(N);
ok(r.active && r.lesson === 'moves' && r.room && r.state === 'play', 'Yes: the practice room opens', r);
ok(await S(N, () => document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-shield')).display === 'none'), 'in play: compact banner, no dimming');
ok(await S(N, () => __lumi.tut.lessons[0].steps === 8), 'lesson 1 has 8 steps (only the earned ones are shown)');
await N.keyboard.down('ArrowRight'); r = await past(N, 0, 'Run: hold the arrow key (real keys)'); await N.keyboard.up('ArrowRight');
r = await past(N, 1, 'Jump: Space', async () => { await N.keyboard.press('Space'); await sleep(250); });
r = await past(N, 2, 'Light a lantern', () => S(N, () => { const L = __lumi.G.L.ents.find(e => e.kind === 'lantern'); __lumi.G.p.x = L.x; __lumi.G.p.y = L.y; }));
r = await tut(N);
ok(r.title === 'Still to find' && await S(N, () => /Double jump/.test(document.querySelector('#hgt .hgt-bubble p').textContent)), 'no moves earned yet: the room skips them and says where to find them', r);
if (SHOTS) await N.screenshot({ path: '/tmp/lumi-train-room.png' });
await N.keyboard.press('Enter');
ok(!!(await until(() => S(N, () => __lumi.tut.finale), 2000)), 'Enter is Next in play; the lesson finishes');
ok(await S(N, () => __lumi.G.state === 'title' && document.getElementById('hud').classList.contains('hidden')), 'the finale leaves the room for the title screen');
await N.keyboard.press('Escape');
ok(!(await S(N, () => __lumi.tut.active)), 'Esc closes the finale');
ok(await real(N) === n0, 'the practice room recorded nothing (times, stats, deaths, play time)', [n0, await real(N)]);
ok(await S(N, () => JSON.parse(localStorage.getItem('lumi_save')).tut.moves === 1 && document.getElementById('t-train-new').classList.contains('hidden')), 'Controls refresher is remembered; "new" goes away');
await N.reload(); await until(() => N.evaluate(() => !!(window.__lumi && window.__lumi.tut)), 20000); await sleep(2600);
ok(!(await S(N, () => __lumi.tut.offerOpen)) && !(await S(N, () => __lumi.tut.offer())), 'the offer never comes back');

// ---------- 2. an old save with every move: no offer; all six moves, then the menus ----------
const OLD = { v: 3, levels: { '1-1': { best: 31.5, moths: [true, false, true], sparks: 40, clears: 3, deaths: 2, flawless: true }, '1-2': { best: 44.25, moths: [true, true, true], sparks: 12, clears: 1 } },
  abilities: { double: true, wall: true, dash: true, glide: true }, deaths: 17, sparks: 52, playTime: 912.5, stats: { jumps: 400, dashes: 20, clears: 4 }, runs: { onelife: 2 },
  trials: { '1-1': { t: 22.4, m: 3, n: 5 } }, look: { pal: 0, shape: 0 }, talks: {}, secrets: {}, lore: {}, guards: {} };
const O = await page('old', { lumi_save: JSON.stringify(OLD), lumighost: JSON.stringify({ '1-1': { d: '1,2,3,4', t: 22.4, at: 1 } }) });
await sleep(2600);
ok(!(await S(O, () => __lumi.tut.offerOpen)), 'players with levels done are not offered it');
ok(await S(O, () => __lumi.SAVE.d.levels['1-1'].best === 31.5 && __lumi.SAVE.d.trials['1-1'].m === 3 && __lumi.SAVE.d.abilities.glide), 'an old save loads (no training fields)');
const o0 = await real(O);
await O.click('#t-train');
ok(await S(O, () => __lumi.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row').length === 3), 'Training shows three lessons');
await O.click('#hgt-hub .hgt-row[data-l="moves"] .hgt-btn');
r = await past(O, 0, 'Run', () => step(O, 0.6, { right: true }));
r = await past(O, 1, 'Jump', async () => { await step(O, 0.05, { jump: true }); await step(O, 0.6); });
r = await past(O, 2, 'Lantern', () => S(O, () => { const L = __lumi.G.L.ents.find(e => e.kind === 'lantern'); __lumi.G.p.x = L.x; __lumi.G.p.y = L.y; }));
r = await past(O, 3, 'Double jump', async () => { await step(O, 0.08, { jump: true }); await step(O, 0.06); await step(O, 0.05, { jump: true }); await step(O, 0.8); });
r = await past(O, 4, 'Wall jump off the pillar', async () => { await S(O, () => __lumi.tp(36.5, 10)); await step(O, 0.25, { right: true }); await step(O, 0.05, { right: true, jump: true }); await step(O, 0.8); });
r = await past(O, 5, 'Dash', async () => { await step(O, 0.05, { dash: true }); await step(O, 0.4); });
r = await past(O, 6, 'Glide', async () => { await S(O, () => __lumi.tp(10, 6)); await step(O, 0.04); await step(O, 0.06, { jump: true }); await step(O, 0.05); await step(O, 0.05, { jump: true }); await step(O, 0.05); await step(O, 1.2, { jump: true }); });
ok(await S(O, () => __lumi.tut.finale), 'every move practised: no "still to find" step');
await O.click('#hgt .hgt-end .hgt-btn.pri');     // Next: Trials, medals and ghosts
r = await tut(O);
ok(r.lesson === 'trials' && r.state === 'title' && await S(O, () => !document.getElementById('hgt').classList.contains('coach')), 'Next lesson from the finale: back on the title, spotlight mode', r);
r = await past(O, 0, 'Open Trials', () => tc(O, '#t-trials'));
await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri');
r = await past(O, 6, 'Back to the story', () => tc(O, '#m-mode'));
ok(await S(O, () => __lumi.tut.finale), 'Trials lesson finishes');
await O.click('#hgt .hgt-end .hgt-btn.pri');     // Next: Your light
r = await tut(O);
ok(r.lesson === 'light' && r.state === 'title', 'Your light starts from the title', r);
r = await past(O, 0, 'Open Your light', () => tc(O, '#t-look'));
r = await past(O, 1, 'Pick a flame shape', () => tc(O, '#lk-shapes button:not(.on)'));
await O.click('#hgt .hgt-btns .hgt-btn.pri');
r = await past(O, 3, 'Done', () => tc(O, '#lk-done'));
r = await past(O, 4, 'Open People', () => tc(O, '#t-lore-btn'));
r = await past(O, 5, 'Back from People', () => tc(O, '#lo-done'));
r = await past(O, 6, 'Open Play together', () => tc(O, '#t-mp'));
await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri');
r = await past(O, 9, 'Back from Play together', () => tc(O, '#mp-back'));
ok(await S(O, () => __lumi.tut.finale), 'Your light finishes');
await O.click('#hgt .hgt-skip');
ok(await real(O) === o0, 'best times, trials, runs, stats, deaths, play time and ghosts unchanged', [o0, await real(O)]);
ok(await S(O, () => { const t = JSON.parse(localStorage.getItem('lumi_save')).tut; return t.moves === 1 && t.trials === 1 && t.light === 1; }), 'all three lessons remembered');
await O.click('#t-train');
ok(await S(O, () => document.querySelectorAll('#hgt-hub .hgt-row.done').length === 3), 'the Training list ticks all three');
await O.keyboard.press('Escape');

// ---------- 3. Esc / Skip at any step ----------
for (const [id, n] of [['moves', 7], ['trials', 7], ['light', 10]]) {
  let all = true;
  for (let i = 0; i < n; i++) {
    await S(O, () => { if (__lumi.G.state === 'map') { __lumi.G.state = 'title'; __lumi.UI.show('title'); } });
    if (!(await S(O, x => __lumi.tut.start(x), id))) { all = false; console.log('  could not start', id, i); continue; }
    for (let k = 0; k < i; k++) await S(O, () => __lumi.tut.next());
    await sleep(40);
    if (i % 2) await O.keyboard.press('Escape'); else await O.click('#hgt .hgt-skip');
    const st = await S(O, () => ({ a: __lumi.tut.active, gone: !document.getElementById('hgt'), room: __lumi.tut.inRoom, prac: !!__lumi.tut.prac, state: __lumi.G.state }));
    if (st.a || !st.gone || st.room || st.prac || st.state === 'paused') { all = false; console.log('  left badly', id, i, st); }
  }
  ok(all, 'Esc / Skip leaves ' + id + ' at any step');
}
ok(await real(O) === o0, 'after all that, the real record is still unchanged');

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(`\n${passes} passed, ${fails} failed`);
await b.close();
process.exit(fails ? 1 : 0);
