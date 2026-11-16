// Sovereign 1.5 training: the four lessons step by step with real clicks, Esc / Skip at any step, the one-time offer, old saves,
// and that a training game is thrown away: no saves, autosave, sov.hgach (leaderboard), lifetime achievements or Hall of Leaders.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/sov-training.mjs [base-url] [--shots]
// base-url defaults to http://127.0.0.1:8090 (any static server of the repo works). three.js comes from $HG_TOOLS/cdn.
import { chromium } from 'playwright';
import fs from 'node:fs';
const T = process.env.HG_TOOLS || '/tmp/hg-tools', BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots');
const URL0 = BASE + '/Sovereign/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(120); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !c ? '  ' + JSON.stringify(extra).slice(0, 600) : '')); };
const errors = [];
async function page(tag, ctx0) {
  const ctx = ctx0 || await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|WebGL|GPU/i.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = T + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await p.goto(URL0); await until(() => p.evaluate(() => !!(window.__sov && window.__sov.ready && window.__sov.UI.screen === 'title')), 90000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const tut = p => S(p, () => { const t = __sov.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, done: t.stepDone, screen: __sov.UI.screen, game: !!__sov.G, tg: !!(__sov.G && __sov.G.tut) }; });
// everything a training game must never touch: saves, their meta, the leaderboard key, lifetime achievements, the Hall of Leaders
const real = p => S(p, () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sov\.(save\.|meta\.|hgach$|ach$|hall$)/.test(k)) o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); });
async function past(p, i, name, act, ms = 10000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { r = await tut(p); if (!r.active || r.i > i || r.finale) break; if (act && !r.done) await act(); await sleep(150); }
  ok(r && (r.i > i || r.finale), name, r);
  return r;
}
const tc = (p, sel, o) => p.click(sel, Object.assign({ timeout: 1500 }, o || {})).catch(() => {});
const next = p => p.click('#hgt .hgt-btns .hgt-btn.pri');

// ---------- 1. a brand-new player: the offer, Your first year through the real New Game screens ----------
const ctxN = await b.newContext({ viewport: { width: 1366, height: 768 } });
const N = await page('new', ctxN);
ok(await S(N, () => /1\.5/.test(document.querySelector('#title .ver').textContent) && !!document.querySelector('#title [data-act="training"] .tut-new')), 'version 1.5; Training on the title says NEW');
ok(!!(await until(() => S(N, () => __sov.tut.offerOpen), 5000)), 'a new player (no saves) is offered a practice year');
ok(await S(N, () => localStorage.getItem('sov.tutOffer') === '1' && document.getElementById('modal').classList.contains('hidden')), 'the offer is remembered (sov.tutOffer); What\'s new waits');
const n0 = await real(N);
await N.click('#hgt-offer .hgt-btn.pri');
let r = await tut(N);
ok(r.active && r.lesson === 'first' && r.screen === 'select', 'Yes: the country list', r);
await N.fill('#sel-search', 'Brazil');
r = await past(N, 0, 'Pick a country (the list)', () => tc(N, '#sel-list [data-idx]'));
r = await past(N, 1, 'Lead it', () => tc(N, '#sel-card [data-act="lead"]'));
r = await past(N, 2, 'Pick 2 traits and take office', async () => { const tr = await N.$$('#setup [data-trait]'); if (tr.length > 1 && !(await N.$('#setup [data-trait].on'))) { await tr[0].click(); await (await N.$$('#setup [data-trait]'))[1].click(); } await tc(N, '#setup [data-act="take-office"]'); });
ok(await S(N, () => __sov.G && __sov.G.tut && __sov.World.countries[__sov.G.player.idx].id === 'BRA'), 'a practice game (G.tut) as the picked country');
ok(await S(N, () => !document.getElementById('tut')), 'the old adviser tips stay away in training');
if (SHOTS) await N.screenshot({ path: '/tmp/sov-train-1.png' });
r = await past(N, 3, 'Click a number: Why?', () => tc(N, '#stats .stat'));
r = await past(N, 4, 'Open Economy', () => tc(N, '#nav [data-panel="economy"]'));
r = await past(N, 5, 'Move a tax slider and pass the budget', async () => {
  if (await S(N, () => __sov.Game.panel !== 'budget')) return tc(N, '#nav [data-panel="budget"]');
  await S(N, () => { const i = document.querySelector('#panel input[type=range][data-k="tax"]'); i.value = String(+i.value + +i.step * 4); i.oninput(); }); await sleep(300); await tc(N, '#panel [data-bud="apply"]');
});
r = await past(N, 6, 'Propose a law', async () => {
  if (await S(N, () => __sov.Game.panel !== 'laws')) return tc(N, '#nav [data-panel="laws"]');
  if (!(await N.$('#panel [data-law-go]'))) await tc(N, '#panel [data-law]:not(.on)'); await tc(N, '#panel [data-law-go]');
});
r = await past(N, 7, 'Let time run (play)', async () => { if (await S(N, () => __sov.Clock.paused)) { await tc(N, '#btn-pause'); await tc(N, '#speeds [data-speed="5"]'); } }, 60000);
r = await past(N, 8, 'Choose in an event', () => tc(N, '#modal-box [data-ev]'));
await next(N);
ok(await S(N, () => __sov.tut.finale && !__sov.G && __sov.UI.screen === 'title'), 'Your first year finishes: the practice game is thrown away, back to the title');
await N.keyboard.press('Escape');
ok(await real(N) === n0, 'no save, autosave, sov.hgach, lifetime achievements or Hall entry was written', [n0, await real(N)]);
ok(await S(N, () => JSON.parse(localStorage.getItem('sov.tut')).first === 1 && !document.querySelector('#title [data-act="training"] .tut-new')), 'Your first year remembered; NEW goes away');
await N.reload(); await until(() => N.evaluate(() => !!(window.__sov && window.__sov.ready && window.__sov.UI.screen === 'title')), 90000); await sleep(1600);
ok(!(await S(N, () => __sov.tut.offerOpen)) && !(await S(N, () => __sov.tut.offer())), 'the offer never comes back');

// ---------- 2. a player with a real game: it still loads; War and peace; the Council; Online ----------
// make a real save first (the normal way), plus leaderboard and Hall data
await S(N, () => { const c = __sov.World.byId.JPN, n0 = __sov.country('JPN'); __sov.newGame({ idx: c.idx, name: 'Real Leader', title: 'Prime Minister', party: 'P', econ: 0, social: 0, traits: ['charismatic', 'economist'], face: {}, real: false, scenario: 'standard' }); });
await S(N, () => __sov.saveTo('1'));
await S(N, () => { localStorage.setItem('sov.hgach', JSON.stringify({ conquered: 3, warsWon: 2, years: 9 })); localStorage.setItem('sov.hall', JSON.stringify([{ country: 'Japan', score: 77 }])); });
await N.reload(); await until(() => N.evaluate(() => !!(window.__sov && window.__sov.ready && window.__sov.UI.screen === 'title')), 90000); await sleep(1500);
await S(N, () => __sov.UI.closeModal());
const o0 = await real(N);
ok(await S(N, () => !!document.querySelector('#title [data-act="continue"]')), 'the real save shows Continue');
await N.click('#title [data-act="training"]');
ok(await S(N, () => __sov.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row').length === 4 && document.querySelectorAll('#hgt-hub .hgt-row.done').length === 1), 'Training lists four lessons, one ticked');
await N.click('#hgt-hub .hgt-row[data-l="war"] .hgt-btn');
r = await tut(N);
ok(r.lesson === 'war' && r.tg && r.screen === 'game', 'War and peace: a practice game as France', r);
r = await past(N, 0, 'Open Diplomacy', () => tc(N, '#nav [data-panel="diplomacy"]'));
r = await past(N, 1, 'Pick a country', () => tc(N, '#panel [data-dt]'));
r = await past(N, 2, 'A diplomatic action (and its talks)', async () => { if (await N.$('#modal:not(.hidden) [data-talk]')) return tc(N, '#modal [data-talk]'); await tc(N, '#panel [data-da]:not([disabled])'); });
await next(N);
r = await past(N, 4, 'Declare war (and confirm)', async () => { if (await N.$('#modal:not(.hidden) [data-talk]')) return tc(N, '#modal [data-talk]'); if (await N.$('#modal:not(.hidden) [data-act="confirm-ok"]')) return tc(N, '[data-act="confirm-ok"]'); await tc(N, '#panel [data-war="declare"]'); });
r = await past(N, 5, 'Open Military', () => tc(N, '#nav [data-panel="military"]'));
r = await past(N, 6, 'Change the stance', () => tc(N, '#panel [data-st]:not(.on)'));
r = await past(N, 7, 'Offer peace', async () => { if (await N.$('#panel [data-peace]')) return tc(N, '#panel [data-peace="white"]'); await tc(N, '#panel [data-wt]'); });
ok(await S(N, () => __sov.tut.finale && !__sov.G && __sov.UI.screen === 'title'), 'War and peace finishes; its game is thrown away');
await N.click('#hgt .hgt-end .hgt-btn.pri');     // Next: the Council
r = await tut(N);
ok(r.lesson === 'council' && r.tg, 'Next: the World Council in a fresh practice game', r);
r = await past(N, 0, 'Open the Council', () => tc(N, '#nav [data-panel="council"]'));
r = await past(N, 1, 'Propose a resolution', () => tc(N, '#panel #cn-prop'));
r = await past(N, 2, 'Lobby', () => tc(N, '#panel [data-clob]'));
r = await past(N, 3, 'Vote', () => tc(N, '#panel [data-cvote]:not(.gold)'));
r = await past(N, 4, 'Pledge to the crisis fund', async () => { if (await N.$('#modal:not(.hidden) [data-pl]')) return tc(N, '#modal [data-pl]:not([data-pl="0"])'); await tc(N, '#panel [data-cpl]'); });
await next(N);
ok(await S(N, () => __sov.tut.finale && !__sov.G), 'The Council lesson finishes; its game is thrown away');
await N.click('#hgt .hgt-end .hgt-btn.pri');     // Next: online
r = await tut(N);
ok(r.lesson === 'online' && r.screen === 'title' && !r.game, 'Next: Playing online, from the title', r);
r = await past(N, 0, 'Open Play online', () => tc(N, '#title [data-act="online"]'));
for (let k = 0; k < 4; k++) await next(N);
r = await past(N, 5, 'Close', () => tc(N, '#on-close'));
ok(await S(N, () => __sov.tut.finale), 'Playing online finishes');
await N.click('#hgt .hgt-skip');
ok(await real(N) === o0, 'the real save, sov.hgach (leaderboard), achievements and Hall are unchanged', [o0, await real(N)]);
ok(await S(N, () => { const t = JSON.parse(localStorage.getItem('sov.tut')); return t.first && t.war && t.council && t.online; }), 'all four lessons remembered');
await N.click('#title [data-act="continue"]');
ok(!!(await until(() => S(N, () => __sov.G && !__sov.G.tut && __sov.G.player.name === 'Real Leader' && __sov.UI.screen === 'game'), 15000)), 'the real save (made before training) still loads');
await N.reload(); await until(() => N.evaluate(() => !!(window.__sov && window.__sov.ready && window.__sov.UI.screen === 'title')), 90000); await sleep(1500); await S(N, () => __sov.UI.closeModal());

// ---------- 3. Esc / Skip at any step ----------
for (const [id, n] of [['first', 10], ['war', 8], ['council', 6], ['online', 6]]) {
  let all = true;
  for (let i = 0; i < n; i += 2) {
    if (!(await S(N, x => __sov.tut.start(x), id))) { all = false; console.log('  could not start', id, i); continue; }
    for (let k = 0; k < i; k++) await S(N, () => __sov.tut.next());
    await sleep(80);
    if ((i / 2) % 2) await N.keyboard.press('Escape'); else await N.click('#hgt .hgt-skip');
    await S(N, () => { if (__sov.UI.screen === 'select' || __sov.UI.screen === 'setup') __sov.UI.show('title'); __sov.UI.closeModal(); });
    const st = await S(N, () => ({ a: __sov.tut.active, gone: !document.getElementById('hgt'), g: !!__sov.G, screen: __sov.UI.screen }));
    if (st.a || !st.gone || st.g || st.screen !== 'title') { all = false; console.log('  left badly', id, i, st); }
  }
  ok(all, 'Esc / Skip leaves ' + id + ' at any step (practice game thrown away)');
}
ok(await real(N) === o0, 'after all that, saves and leaderboard data are still unchanged');

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(`\n${passes} passed, ${fails} failed`);
await b.close();
process.exit(fails ? 1 : 0);
