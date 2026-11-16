// Blocky Shooter 5.6 training: Boot camp step by step on the practice range (real keys + the hook), the two menu lessons,
// Esc / Skip, the first-visit offer, an old save, and nothing reaching xp / kills / best waves (what the leaderboards read).
// Serve the repo (python3 -m http.server 8090, or HG_BASE=http://127.0.0.1:<port>/) and run:
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/blocky-training.mjs [--shots]
import { newPage, launch, check } from './blocky-classes-lib.mjs';
const SHOTS = process.argv.includes('--shots');
const b = await launch();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(120); } }
const T = p => p.evaluate(() => { const t = __blocky.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, state: __blocky.state.currentGameState }; });
async function past(p, i, name, act, ms = 9000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { if (act) await act(); r = await T(p); if (!r.active || r.i > i || r.finale) break; await sleep(150); }
  check(name, r && (r.i > i || r.finale), JSON.stringify(r && { i: r.i, title: r.title }));
  return r;
}
const lifeKey = p => p.evaluate(() => { const l = __blocky.life; return JSON.stringify({ xp: l.xp, kills: l.kills, runs: l.runs, waves: l.waves, best: l.best, shots: l.shots, cls: l.cls }); });
const stepTo = (p, title) => until(async () => (await T(p)).title === title, 4000);
const errs = [];

// ---------- 1. a new player: the offer (once), Boot camp ----------
const { page: P, ctx } = await newPage(b, { errors: errs });
check('version 5.6', await P.evaluate(() => document.title.includes('5.6') && !!document.getElementById('btn-training')));
check('first visit: Boot camp is offered', !!(await until(() => P.evaluate(() => __blocky.tut.offerOpen), 30000)));
check('offer remembered in blocky21_settings', await P.evaluate(() => JSON.parse(localStorage.getItem('blocky21_settings')).tutOffer === 1));
check('TRAINING button says NEW', await P.evaluate(() => document.getElementById('btn-training-sub').textContent === 'NEW'));
await P.click('#hgt-offer .hgt-btn:not(.pri)');
check('No thanks closes the offer', !(await P.evaluate(() => __blocky.tut.offerOpen)));
await P.reload(); await P.waitForFunction(() => !!(window.__blocky && window.__blocky.state), null, { timeout: 60000 }); await sleep(3000);
check('the offer does not come back', !(await P.evaluate(() => __blocky.tut.offerOpen)));
const run0 = await P.evaluate(() => localStorage.getItem('huntington.blockyshooter.run.v1'));
const life0 = await lifeKey(P);

await P.evaluate(() => { __blocky.debug(true); });       // no pointer lock in a test browser
check('Boot camp starts', await P.evaluate(() => __blocky.tut.start('boot')));
let r = await T(P);
check('a sandbox practice range, no waves', r.state === 'playing' && await P.evaluate(() => { const m = __blocky.tut.move; return m.mode === 'sandbox' && m.enemies === 0 && __blocky.runInfo.map === 'blockyard'; }), JSON.stringify(await P.evaluate(() => __blocky.tut.move)));
check('in play: compact coach banner, no dimming', await P.evaluate(() => document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-shield')).display === 'none' && document.querySelector('#hgt .hgt-bubble').getBoundingClientRect().width <= 300));
const step = (n = 6) => P.evaluate(n => __blocky.modes.step(n, 33), n);
await P.keyboard.down('KeyW');
r = await past(P, 0, 'Move: W walks', () => step(8));
r = await past(P, 1, 'Jump: Space', async () => { await P.keyboard.press('Space'); await step(3); });
r = await past(P, 2, 'Sprint: hold Shift', async () => { await P.keyboard.down('ShiftLeft'); await step(4); });
r = await past(P, 3, 'Slide: C while sprinting', async () => { await step(6); await P.keyboard.press('KeyC'); await step(2); });
await P.keyboard.up('ShiftLeft'); await P.keyboard.up('KeyW');
r = await past(P, 4, 'Shoot: left click', async () => { await P.evaluate(() => { __blocky.mouse(0, true); }); await step(4); await P.evaluate(() => { __blocky.mouse(0, false); }); });
r = await past(P, 5, 'Aim down sights: right mouse', async () => { await P.evaluate(() => __blocky.mouse(2, true)); await step(10); });
await P.evaluate(() => __blocky.mouse(2, false));
r = await past(P, 6, 'Reload: R', async () => { await P.keyboard.press('KeyR'); await step(1); });
if (SHOTS) await P.screenshot({ path: '/tmp/bl-train-coach.png' });
r = await past(P, 7, 'Switch weapons: 2', async () => { await P.keyboard.press('Digit2'); await step(3); });
r = await past(P, 8, 'Grenade: Q', async () => { await P.keyboard.press('KeyQ'); await step(3); });
r = await past(P, 9, 'Class ability: X', async () => { await P.keyboard.press('KeyX'); await step(3); });
const t10 = Date.now();
r = await past(P, 10, 'Pick up the cash cube (walk onto it)', async () => { await P.keyboard.down('KeyW'); await step(6); if (Date.now() - t10 > 3000) await P.evaluate(() => { const d = __blocky.tut.drop; if (d) __blocky.tpy(d.x, d.y, d.z); }); }, 12000);
await P.keyboard.up('KeyW');
check('three zombies come for the last step', await P.evaluate(() => __blocky.tut.move.enemies) >= 3);
r = await past(P, 11, 'Beat 3 zombies', async () => { await P.evaluate(() => __blocky.killAll()); await step(2); });
check('Boot camp done and remembered', !!(await until(async () => (await T(P)).finale, 3000)) && await P.evaluate(() => __blocky.tut.lessons[0].done && JSON.parse(localStorage.getItem('blocky21_settings')).tut.boot === 1));
check('back on the main menu', await P.evaluate(() => __blocky.state.currentGameState === 'main' && !__blocky.tut.on));
check('nothing counted: xp, kills, runs, waves, best', await lifeKey(P) === life0, await lifeKey(P));
check('the saved run on disk is untouched', await P.evaluate(() => localStorage.getItem('huntington.blockyshooter.run.v1')) === run0);
check('TRAINING button shows 1 / 3', await P.evaluate(() => document.getElementById('btn-training-sub').textContent === '1 / 3'));

// ---------- 2. Esc / Skip / Quit leave at any step ----------
for (const at of [0, 4, 9]) {
  await P.evaluate(() => __blocky.tut.start('boot'));
  for (let k = 0; k < at; k++) await P.evaluate(() => __blocky.tut.next());
  await P.keyboard.press('Escape');
  check('Esc leaves Boot camp at step ' + (at + 1), await P.evaluate(() => !__blocky.tut.active && __blocky.state.currentGameState === 'main'));
}
await P.evaluate(() => __blocky.tut.start('boot')); await step(4);
await P.evaluate(() => __blocky.pause()); await sleep(100);
await P.click('#btn-quit');
check('Quit to menu (pause) ends the lesson', !!(await until(() => P.evaluate(() => !__blocky.tut.active && !__blocky.tut.on), 2000)));
check('still nothing counted', await lifeKey(P) === life0);

// ---------- 3. Classes and loadout (menus, spotlight) ----------
const next = () => P.click('#hgt .hgt-btns .hgt-btn.pri');
await P.evaluate(() => __blocky.tut.start('loadout'));
check('menus: spotlight dims around the target', await P.evaluate(() => !document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-hole')).boxShadow !== 'none'));
await P.click('#btn-classes');
r = await past(P, 0, 'open CLASSES');
await P.click('.cls-card:not(.on)');
r = await past(P, 1, 'click another class');
await next(); await stepTo(P, 'Specialisations');
if (SHOTS) await P.screenshot({ path: '/tmp/bl-train-spot.png' });
await next(); await stepTo(P, 'The skill tree'); await next();
check('levels, specialisations, tree: Next', !!(await stepTo(P, 'The Armory')));
await P.click('[data-cact="close"]');
await P.click('#btn-main-shop');
r = await past(P, 5, 'open the ARMORY');
await next();
await P.click('#btn-shop-back-top');
r = await past(P, 7, 'BACK from the Armory');
await P.click('#btn-home-play'); await P.click('#menu-tabs [data-tab="ranks"]');
r = await past(P, 8, 'PLAY, then the RANKS tab');
await next();
await P.click('#menu-tabs [data-tab="customize"]');
r = await past(P, 10, 'the CUSTOMIZE tab');
await sleep(500);
check('camo row in the spotlight', await P.evaluate(() => { const h = document.querySelector('#hgt .hgt-hole').getBoundingClientRect(), c = document.querySelector('#menu-panel [data-set="camo"]').getBoundingClientRect(); return h.width > 50 && c.top >= h.top - 2 && c.bottom <= h.bottom + 2; }));
await next();
check('Classes and loadout done', !!(await until(async () => (await T(P)).finale, 3000)) && await P.evaluate(() => __blocky.tut.lessons[1].done));
await P.click('#hgt .hgt-end .hgt-btn.pri');      // Next: Modes and multiplayer

// ---------- 4. Modes and multiplayer ----------
r = await T(P);
check('"Next" starts Modes and multiplayer', r.active && r.lesson === 'modes' && r.i === 0, JSON.stringify(r));
await P.click('#btn-home-play');
r = await past(P, 0, 'PLAY shows the modes');
await next(); await stepTo(P, 'Maps and difficulty'); await next();
await P.click('#btn-setup-back');
r = await past(P, 3, 'BACK to the home screen');
await P.click('#btn-mp');
r = await past(P, 4, 'open MULTIPLAYER');
check('host and join in the spotlight', await P.evaluate(() => { const h = document.querySelector('#hgt .hgt-hole').getBoundingClientRect(); return h.width > 100; }));
await next(); await stepTo(P, 'PvP modes');
check('PvP step names HUNTED', await P.evaluate(() => document.querySelector('#hgt .hgt-bubble p').textContent.includes('HUNTED')));
await next();
await P.click('#mp-join');
r = await past(P, 7, 'JOIN A PARTY opens the code box');
await next(); await stepTo(P, 'Chat'); await next();
check('Modes and multiplayer done, all three ticked', !!(await until(async () => (await T(P)).finale, 3000)) && await P.evaluate(() => __blocky.tut.lessons.every(l => l.done)));
await P.click('#hgt .hgt-skip');
check('multiplayer screen closed afterwards', await P.evaluate(() => document.getElementById('mp-overlay').classList.contains('hidden') && !__blocky.tut.active));
await P.click('#btn-training');
check('TRAINING lists three lessons with ticks', await P.evaluate(() => __blocky.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row.done').length === 3));
await P.keyboard.press('Escape');
check('Esc closes the list', !(await P.evaluate(() => __blocky.tut.hubOpen)));
await P.evaluate(() => __blocky.tut.start('loadout')); await P.click('#hgt .hgt-skip');
check('Skip lesson leaves a menu lesson', !(await P.evaluate(() => __blocky.tut.active)));
check('still nothing counted after all lessons', await lifeKey(P) === life0);
await ctx.close();

// ---------- 5. an existing player's old save: kept, no offer ----------
const old = `localStorage.setItem('blocky21_settings', JSON.stringify({ mode: 'classic', map: 'blockyard', light: 'night', diff: 'normal', cls: 'medic', quality: 'low' })); localStorage.setItem('blocky21_life', JSON.stringify({ xp: 4200, runs: 12, kills: 345, headshots: 40, waves: 50, best: { normal: 9 } }));`;
const { page: O, ctx: c2 } = await newPage(b, { init: `if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); ${old} }`, errors: errs });
await sleep(4000);
check('old save: no offer, stats kept', await O.evaluate(() => !__blocky.tut.offerOpen && __blocky.life.kills === 345 && __blocky.life.xp === 4200 && __blocky.life.best.normal === 9));
await O.evaluate(() => { __blocky.debug(true); __blocky.tut.start('boot'); });
await O.evaluate(() => { __blocky.spawn('grunt', 0, -8); __blocky.killAll(); __blocky.modes.step(5, 33); __blocky.tut.stop(); });
check('a kill on the range does not reach life', await O.evaluate(() => { const l = JSON.parse(localStorage.getItem('blocky21_life')); return __blocky.life.kills === 345 && __blocky.life.xp === 4200 && l.kills === 345; }));
check('class kept (medic)', await O.evaluate(() => JSON.parse(localStorage.getItem('blocky21_settings')).cls === 'medic'));
await c2.close();

check('no script errors', errs.length === 0, errs.slice(0, 4).join(' | '));
await b.close();
