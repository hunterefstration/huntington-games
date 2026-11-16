// Mayhem Marathon 1.2 training: the three lessons step by step, Esc / Skip at any step, the one-time offer, old saves, and that
// training rounds never move stats (crowns, qualified: the leaderboards), kudos, fame or round records.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/mayhem-training.mjs [base-url] [--shots]
// base-url defaults to http://127.0.0.1:8090 (any static server of the repo works). three.js comes from $HG_TOOLS/cdn.
import { chromium } from 'playwright';
import fs from 'node:fs';
const T = process.env.HG_TOOLS || '/tmp/hg-tools', BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots');
const URL0 = BASE + '/Mayhem%20Marathon/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(100); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !c ? '  ' + JSON.stringify(extra) : '')); };
const errors = [];
async function page(tag, save) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|WebGL|GPU/i.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = T + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  if (save) await p.addInitScript(s => { if (!sessionStorage.getItem('planted')) { localStorage.setItem('mayhem_save', s); sessionStorage.setItem('planted', '1'); } }, JSON.stringify(save));
  await p.goto(URL0); await until(() => p.evaluate(() => !!(window.__mayhem && window.__mayhem.tut)), 40000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const tut = p => S(p, () => { const t = __mayhem.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, done: t.stepDone, screen: __mayhem.G.screen, rid: __mayhem.R && __mayhem.R.rid }; });
// what the leaderboards read (stats) and the rest of the progress, from the real save
const real = p => S(p, () => { const s = JSON.parse(localStorage.getItem('mayhem_save') || '{}'); return JSON.stringify({ stats: s.stats, rp: s.rp, kudos: s.kudos, fame: s.fame, owned: s.owned }); });
async function past(p, i, name, act, ms = 10000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { r = await tut(p); if (!r.active || r.i > i || r.finale) break; if (act && !r.done) await act(); await sleep(120); }
  ok(r && (r.i > i || r.finale), name, r);
  return r;
}
const tc = (p, sel) => p.click(sel, { timeout: 1500 }).catch(() => {});
const step = (p, sec) => S(p, s => { __mayhem.step(s); }, sec);
const hold = async (p, key, ms) => { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key); };

// ---------- 1. a brand-new player: the offer once, First steps ----------
const N = await page('new');
ok(await S(N, () => __mayhem.G.screen === 'title' && document.getElementById('t-stats').textContent.includes('v1.2')), 'version 1.2 on the title');
ok(!!(await until(() => S(N, () => __mayhem.tut.offerOpen), 4000)), 'a new player is offered First steps');
ok(await S(N, () => JSON.parse(localStorage.getItem('mayhem_save')).tutOffer === 1), 'the offer is remembered in mayhem_save');
ok(await S(N, () => document.getElementById('b-train').classList.contains('newb')), 'Training says NEW');
const n0 = await real(N);
await N.click('#hgt-offer .hgt-btn.pri');
let r = await tut(N);
ok(r.active && r.lesson === 'steps' && r.rid === 'spin' && await S(N, () => __mayhem.G.show.tut && __mayhem.R.cs.length === 1), 'Yes: a training round of Spin Cycle, just you', r);
ok(await S(N, () => /Training/.test(document.getElementById('i-goal').textContent) && !document.getElementById('s-intro').classList.contains('hidden')), 'the rule card shows and says it is training');
ok(await S(N, () => document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-shield')).display === 'none'), 'in play: compact banner, no dimming');
if (SHOTS) await N.screenshot({ path: '/tmp/mayhem-train-card.png' });
r = await past(N, 0, 'The rule card: GO! moves on', () => step(N, 2));
r = await past(N, 1, 'Look around: the arrow keys turn the camera (real keys)', () => hold(N, 'ArrowLeft', 500));
r = await past(N, 2, 'Run: W (real keys)', () => hold(N, 'KeyW', 700));
r = await past(N, 3, 'Jump: Space', () => N.keyboard.press('Space'));
r = await past(N, 4, 'Dive: C', () => N.keyboard.press('KeyC'));
r = await past(N, 5, 'Grab: hold F', () => hold(N, 'KeyF', 500));
await S(N, () => __mayhem.autopilot(true));
r = await past(N, 6, 'Checkpoints: reach one', () => step(N, 3), 30000);
r = await past(N, 7, 'The finish', () => step(N, 3), 60000);
ok(await S(N, () => __mayhem.tut.finale), 'First steps finishes');
ok(await S(N, () => __mayhem.G.screen === 'title' && !__mayhem.G.show), 'the finale goes back to the title');
await N.keyboard.press('Escape');
ok(!(await S(N, () => __mayhem.tut.active)), 'Esc closes the finale');
ok(await real(N) === n0, 'nothing counted: stats, round records, kudos, fame', [n0, await real(N)]);
ok(await S(N, () => JSON.parse(localStorage.getItem('mayhem_save')).tut.steps === 1 && !document.getElementById('b-train').classList.contains('newb')), 'First steps remembered; NEW goes away');
await N.reload(); await until(() => N.evaluate(() => !!(window.__mayhem && window.__mayhem.tut)), 40000); await sleep(1600);
ok(!(await S(N, () => __mayhem.tut.offerOpen)) && !(await S(N, () => __mayhem.tut.offer())), 'the offer never comes back');

// ---------- 2. an old save (1.1, no training fields): loads, no offer; Round types and Parties ----------
const OLD = { v: 2, name: 'Wobbler', kudos: 930, fame: 4100, owned: { h3: true }, look: { col: 'c2', col2: 'c5', pat: 'p0', hat: 'h0', visor: 'v0', trail: 't0', pose: 'e0', cel: 'k0' },
  stats: { crowns: 3, shows: 12, qualified: 21, rounds: 44, eliminations: 9, finals: 5, kudosEarned: 2000, bombsPassed: 4 }, settings: { quality: 'low', music: 0, sfx: 0, mute: true, sens: 1, invertY: false, names: true },
  opts: { bots: 15, skill: 1, length: 4, scoring: 'auto', pick: [] }, seenHow: true, rp: { spin: { p: 4, q: 3, w: 0 }, bomb: { p: 2, q: 1, w: 0 } }, seenVer: '1.1' };
const O = await page('old', OLD);
ok(await S(O, () => __mayhem.save.stats.crowns === 3 && __mayhem.save.stats.qualified === 21 && __mayhem.save.rp.spin.q === 3), 'an old save loads (no training fields)');
await sleep(1500);
ok(!(await S(O, () => __mayhem.tut.offerOpen)), 'players who have played are not offered it');
ok(await S(O, () => __mayhem.G.screen === 'new' && /Training/.test(document.getElementById('n-list').textContent)), 'What\'s new (1.2) opens for a 1.1 player and mentions Training');
await S(O, () => __mayhem.ui.goBack());
const o0 = await real(O);
await O.click('#b-train');
ok(await S(O, () => __mayhem.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row').length === 3), 'Training shows three lessons');
await O.click('#hgt-hub .hgt-row[data-l="rounds"] .hgt-btn');
r = await tut(O);
ok(r.lesson === 'rounds' && r.rid === 'teeter', 'Round types starts with a race', r);
await step(O, 9);
r = await past(O, 0, 'Race: run 12 m', () => hold(O, 'KeyW', 800));
r = await tut(O);
ok(r.rid === 'beam' && await S(O, () => __mayhem.R.cs.length === 4), 'Survival: Beam Jumper with 3 bots', r);
await step(O, 9);
await S(O, () => { const C = __mayhem.R.cs.find(c => c.id === 0); C.b.p.y = -50; });
await step(O, 0.5);
ok(await S(O, () => { const C = __mayhem.R.cs.find(c => c.id === 0); return !C.out && !C.done && C.b.p.y > -5 && !__mayhem.R.outs.includes(0); }), 'falling off in training puts you back (no knockout)');
r = await past(O, 1, 'Survive 10 seconds', () => step(O, 2));
ok((await tut(O)).rid === 'tail', 'Team round: Tail Chase');
r = await past(O, 2, 'Play the team round', () => step(O, 3), 20000);
ok((await tut(O)).rid === 'bomb', 'Hunt round: Bomb Tag');
r = await past(O, 3, 'Bomb Tag: pass a bomb or play 15 s', () => step(O, 3), 30000);
await O.keyboard.press('Enter');
ok(await S(O, () => __mayhem.tut.finale && __mayhem.G.screen === 'title'), 'Enter goes on in play; Round types finishes on the title');
await O.click('#hgt .hgt-end .hgt-btn.pri');      // Next: Parties and custom shows
r = await tut(O);
ok(r.lesson === 'party' && !(await S(O, () => document.getElementById('hgt').classList.contains('coach'))), 'Parties: menus are in spotlight mode', r);
r = await past(O, 0, 'Open Play', () => tc(O, '#b-play'));
await O.click('#hgt .hgt-btns .hgt-btn.pri');
r = await past(O, 2, 'Open the custom show', () => tc(O, '#b-pick'));
r = await past(O, 3, 'Pick a round', () => tc(O, '#pk-list button[data-r="spin"]'));
r = await past(O, 4, 'Done', () => tc(O, '#pk-done'));
await O.click('#hgt .hgt-btns .hgt-btn.pri'); await O.click('#hgt .hgt-btns .hgt-btn.pri');
r = await past(O, 7, 'Close Play', () => tc(O, '#s-play [data-back]'));
r = await past(O, 8, 'Open Customise', () => tc(O, '#b-ward'));
r = await past(O, 9, 'Click an item', () => tc(O, '#w-grid button.it:not(.on)'));
ok(await S(O, () => __mayhem.tut.finale), 'Parties finishes');
await O.click('#hgt .hgt-skip');
ok(await real(O) === o0, 'stats (crowns, qualified, bombs passed), round records, kudos and fame unchanged', [o0, await real(O)]);
ok(await S(O, () => { const t = JSON.parse(localStorage.getItem('mayhem_save')).tut; return t.rounds === 1 && t.party === 1 && !t.steps; }), 'both lessons remembered');
await S(O, () => __mayhem.ui.goBack());

// ---------- 3. Esc / Skip at any step ----------
for (const [id, n] of [['steps', 8], ['rounds', 5], ['party', 10]]) {
  let all = true;
  for (let i = 0; i < n; i += (id === 'party' ? 3 : 2)) {
    await S(O, () => { if (__mayhem.G.screen !== 'title') __mayhem.toTitle(); });
    if (!(await S(O, x => __mayhem.tut.start(x), id))) { all = false; console.log('  could not start', id, i); continue; }
    for (let k = 0; k < i; k++) await S(O, () => __mayhem.tut.next());
    await sleep(60);
    if (i % 2) await O.keyboard.press('Escape'); else await O.click('#hgt .hgt-skip');
    const st = await S(O, () => ({ a: __mayhem.tut.active, gone: !document.getElementById('hgt'), show: !!__mayhem.G.show, screen: __mayhem.G.screen }));
    if (st.a || !st.gone || st.show || st.screen === 'pause' || st.screen === 'game') { all = false; console.log('  left badly', id, i, st); }
  }
  ok(all, 'Esc / Skip leaves ' + id + ' at any step');
}
await S(O, () => __mayhem.toTitle());
await O.click('#b-train');
ok(await S(O, () => document.querySelectorAll('#hgt-hub .hgt-row.done').length === 2), 'the Training list ticks the two done lessons');
await O.keyboard.press('Escape');
ok(await real(O) === o0, 'after all that, the leaderboard numbers are still unchanged');

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(`\n${passes} passed, ${fails} failed`);
await b.close();
process.exit(fails ? 1 : 0);
