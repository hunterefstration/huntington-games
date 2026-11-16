// Steel Storm 2.3 training: the three lessons step by step, Esc / Skip, the first-visit offer, old saves, no stats from practice.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/ss-training.mjs [base-url] [--shots]
// base-url defaults to http://127.0.0.1:8090 (the rig serves this repo there; any static server of the repo works).
import { chromium } from 'playwright';
import fs from 'node:fs';
const T = '/tmp/hg-tools', BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SHOTS = process.argv.includes('--shots');
const URL0 = BASE + '/Steel%20Storm/index.html?hgpeer=off';
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(120); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); };
const errors = [];
const OLD = { v: 1, seenHow: true, seenNew: '2.2', credits: 50000, lineup: ['g1a', 'a1a', 'n1a'], stats: { matches: 7, wins: 4, kills: 31, deaths: 9, caps: 2 } };
async function page(tag, save, ctx0) {
  const ctx = ctx0 || await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|WebSocket|Failed to load resource/.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => { const f = T + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, ''); fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await p.route(/fonts\.|unpkg|peerjs|mqtt/, r => r.abort());
  if (save) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('steelstorm_save', s); } }, JSON.stringify(save));
  await p.goto(URL0); await until(() => p.evaluate(() => !!window.__steelstorm), 60000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const tut = p => S(p, () => { const t = __steelstorm.tut; return { active: t.active, lesson: t.lesson, i: t.i, title: t.title, finale: t.finale, state: __steelstorm.state }; });
const stats = p => S(p, () => JSON.stringify(__steelstorm.save.stats));
// wait for the lesson to move past step i (the engine polls every 150 ms, then waits 0.8 s)
async function past(p, i, name, act, ms = 9000) {
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < ms) { if (act) await act(); r = await tut(p); if (!r.active || r.i > i || r.finale) break; await sleep(150); }
  ok(r && (r.i > i || r.finale), name, r && { i: r.i, title: r.title });
  return r;
}
const stepTo = (p, title) => until(async () => (await tut(p)).title === title, 4000);

// ---------- 1. a new player: the offer shows once; Basic training ----------
const ctxN = await b.newContext({ viewport: { width: 1280, height: 720 } });
const N = await page('new', null, ctxN);
ok(await S(N, () => __steelstorm.version) === '2.3', 'version 2.3');
ok(!!(await until(() => S(N, () => __steelstorm.tut.offerOpen), 4000)), 'first visit: Basic training is offered');
ok(await S(N, () => __steelstorm.save.tutOffer === 1 && document.getElementById('s-how').classList.contains('hidden')), 'the offer is remembered; How to play waits');
ok(await S(N, () => !document.getElementById('nv-train').classList.contains('hidden')), 'Training button says NEW');
await N.reload(); await until(() => N.evaluate(() => !!window.__steelstorm), 60000); await sleep(900);
ok(!(await S(N, () => __steelstorm.tut.offerOpen)), 'the offer does not come back on the next visit');
const st0 = await stats(N);
await N.evaluate(() => { window.__q = 0; });
await S(N, () => __steelstorm.tut.offer());     // (already offered: refused)
ok(!(await S(N, () => __steelstorm.tut.offerOpen)), 'offer() refuses a second time');

// Basic training, every step through the real controls (hook presses) and the sim
ok(await S(N, () => __steelstorm.tut.start('basic')), 'Basic training starts');
let r = await tut(N);
ok(r.state === 'match' && await S(N, () => __steelstorm.match.tut === 'basic' && __steelstorm.match.cfg.bots.every(b => b.team === 1) && __steelstorm.match.cfg.bots.length === 2 && __steelstorm.match.cfg.diff === 'easy'), 'a practice match: 2 easy enemy bots, conquest', r);
ok(await S(N, () => document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-shield')).display === 'none'), 'in battle: compact coach banner, no dimming or click shields');
ok(await S(N, () => { const r = document.querySelector('#hgt .hgt-bubble').getBoundingClientRect(); return r.width <= 300 && r.left < 30 && r.top < 30; }), 'the banner sits in the top-left corner, small');
await S(N, () => { __steelstorm.tut.cam; __steelstorm.ent(0).prot = 0; });
r = await past(N, 0, 'Drive: W moves the tank', async () => S(N, () => { __steelstorm.press('KeyW'); __steelstorm.step(20, .033); }));
await S(N, () => __steelstorm.press('KeyW', false));
r = await past(N, 1, 'Turn: A turns the tank', async () => S(N, () => { __steelstorm.press('KeyA'); __steelstorm.step(15, .033); }));
await S(N, () => __steelstorm.press('KeyA', false));
r = await past(N, 2, 'Aim: the mouse turns the camera', async () => S(N, () => __steelstorm.look(__steelstorm.cam.camYaw + 1)));
r = await past(N, 3, 'Fire: left click fires the main gun', async () => S(N, () => { __steelstorm.mouse(0); __steelstorm.step(3, .033); __steelstorm.mouse(0, false); }));
await N.mouse.move(640, 360);
r = await past(N, 4, 'Zoom: the mouse wheel zooms', async () => { await N.mouse.wheel(0, 400); });
if (SHOTS) await N.screenshot({ path: '/tmp/ss-train-coach.png' });
r = await past(N, 5, 'Destroy an enemy (kills count)', async () => S(N, () => { const e = __steelstorm.ents().find(x => x.team === 1 && x.alive); if (e) __steelstorm.kill(e.id); }));
r = await past(N, 6, 'Capture a point (drive into B and hold it)', async () => S(N, () => { const P = __steelstorm.PTS[1]; __steelstorm.teleport(P.x, null, P.z); for (const e of __steelstorm.ents()) if (e.team === 1) { const o = __steelstorm.ent(e.id); o.x = 400; o.z = 400; } __steelstorm.step(60, .05); }), 20000);
await N.keyboard.press('KeyK');
ok(!!(await until(() => S(N, () => !__steelstorm.me.alive && !document.getElementById('s-dead').classList.contains('hidden')), 3000)), 'K self-destructs: the death screen offers the lineup');
r = await past(N, 7, 'Respawn: pick another vehicle (2) and deploy (Space)', async () => { await S(N, () => { __steelstorm.me.respT = 0; }); await N.keyboard.press('Digit2'); await N.keyboard.press('Space'); });
ok(await S(N, () => __steelstorm.me.alive && __steelstorm.me.def.id === 'a1a'), 'deployed in the second lineup vehicle');
ok(await S(N, () => __steelstorm.tut.title) === 'The minimap', 'minimap step (no action: Enter goes on)');
await N.keyboard.press('Enter');
ok(!!(await stepTo(N, 'The scoreboard')), 'Enter moves on in battle');
await N.keyboard.down('Tab');
r = await until(async () => (await tut(N)).finale, 5000); await N.keyboard.up('Tab');
ok(!!r, 'Tab (scoreboard) finishes the lesson');
ok(await S(N, () => __steelstorm.save.tut.basic === 1 && JSON.parse(localStorage.getItem('steelstorm_save')).tut.basic === 1), 'Basic training is remembered in steelstorm_save');
ok(await S(N, () => !__steelstorm.match && __steelstorm.state === 'menu'), 'the finale takes you back to the menu');
ok(await stats(N) === st0, 'practice match added nothing to stats (wins / kills)', await stats(N));
ok(await S(N, () => document.getElementById('nv-train').classList.contains('hidden')), 'NEW badge gone after a lesson');
await N.click('#hgt .hgt-skip');
ok(!(await S(N, () => __steelstorm.tut.active)), 'Close ends the finale');

// ---------- 2. Esc and Skip leave at any step ----------
for (const at of [0, 3, 6]) {
  await S(N, () => __steelstorm.tut.start('basic'));
  for (let k = 0; k < at; k++) await S(N, () => __steelstorm.tut.next());
  await N.keyboard.press('Escape');
  ok(await S(N, () => !__steelstorm.tut.active && !__steelstorm.match && document.getElementById('s-pause').classList.contains('hidden')), 'Esc leaves Basic training at step ' + (at + 1) + ' (no pause screen)');
}
await S(N, () => __steelstorm.tut.start('air')); await S(N, () => __steelstorm.tut.next());
await N.click('#hgt .hgt-skip');
ok(await S(N, () => !__steelstorm.tut.active && !__steelstorm.match), 'Skip lesson leaves Wings and rotors');
await S(N, () => __steelstorm.tut.start('basic'));
await S(N, () => { document.getElementById('ps-leave').click(); });
ok(!!(await until(() => S(N, () => !__steelstorm.tut.active), 2000)), 'leaving the practice match from the pause menu ends the lesson');
ok(await S(N, () => document.getElementById('ps-leave').textContent) === 'Leave match', 'pause button back to "Leave match"');

// ---------- 3. Wings and rotors ----------
ok(await S(N, () => __steelstorm.tut.start('air')), 'Wings and rotors starts');
ok(await S(N, () => __steelstorm.me.def.id === 'a1b' && __steelstorm.me.def.flares && __steelstorm.match.tut === 'air'), 'in a Mule with every module (flares)');
r = await past(N, 0, 'Throttle: S closes it', async () => S(N, () => { __steelstorm.press('KeyS'); __steelstorm.step(15, .033); }));
await S(N, () => __steelstorm.press('KeyS', false));
r = await past(N, 1, 'Steer with the mouse', async () => S(N, () => __steelstorm.look(undefined, __steelstorm.cam.camPitch + .4)));
r = await past(N, 2, 'Guns: left click', async () => S(N, () => { __steelstorm.mouse(0); __steelstorm.step(3, .033); __steelstorm.mouse(0, false); }));
ok((await tut(N)).title === 'Bombs', 'a bomber gets the bombs step');
r = await past(N, 3, 'Bombs: B drops one', async () => S(N, () => { __steelstorm.press('KeyB'); __steelstorm.step(3, .033); __steelstorm.press('KeyB', false); }));
r = await past(N, 4, 'Flares: F', async () => { await N.keyboard.press('KeyF'); });
ok((await tut(N)).title === 'Helicopter time' && await S(N, () => __steelstorm.me.def.id === 'a3e' && __steelstorm.me.def.heli), 'helicopter: now in a Mantis');
await N.keyboard.press('Enter');
r = await past(N, 6, 'Hover: E climbs', async () => S(N, () => { __steelstorm.press('KeyE'); __steelstorm.step(20, .033); }));
await S(N, () => __steelstorm.press('KeyE', false));
await S(N, () => __steelstorm.press('KeyD'));
r = await past(N, 7, 'Strafe: hold D');
await S(N, () => __steelstorm.press('KeyD', false));
r = await past(N, 8, 'Rockets: right click', async () => S(N, () => { __steelstorm.mouse(2); __steelstorm.step(3, .033); __steelstorm.mouse(2, false); }));
// lock: put an enemy tank where the crosshair points and hold it there
r = await past(N, 9, 'Missile lock: hold the crosshair on a target', async () => S(N, () => {
  const s = __steelstorm, me = s.me; me.prot = 9; s.look(undefined, -0.25);
  let e = s.ents().find(x => x.team === 1 && x.alive); if (!e) return; const o = s.ent(e.id);
  if (o.def.ln !== 'g') s.T.setDef(o, s.vdef('g1a'));
  s.updateCamera(.016); const p = s.aim(); if (!p) return; o.x = p.x; o.z = p.z; o.y = s.GH(p.x, p.z); o.vx = o.vz = 0;
}), 12000);
r = await past(N, 10, 'Fire the missile: B', async () => S(N, () => { __steelstorm.press('KeyB'); __steelstorm.step(2, .033); __steelstorm.press('KeyB', false); }));
ok(!!(await until(async () => (await tut(N)).finale, 3000)) && await S(N, () => __steelstorm.save.tut.air === 1 && !__steelstorm.match), 'Wings and rotors done, remembered, back to the menu');
ok(await stats(N) === st0, 'still nothing added to stats', await stats(N));
// the finale's "Next" opens the garage lesson
await N.click('#hgt .hgt-end .hgt-btn.pri');
r = await tut(N);
ok(r.active && r.lesson === 'garage' && r.i === 0, '"Next: Your garage" starts lesson 3', r);

// ---------- 4. Your garage (spotlight in the menus) ----------
ok(await S(N, () => !document.getElementById('hgt').classList.contains('coach') && getComputedStyle(document.querySelector('#hgt .hgt-hole')).boxShadow !== 'none'), 'menus: full spotlight (dimmed around the target)');
const clickNext = () => N.click('#hgt .hgt-btns .hgt-btn.pri');
await clickNext();
ok(!!(await stepTo(N, 'Research')), 'card step: Next');
await N.click('#hgt .hgt-shield >> nth=0', { force: true }).catch(() => {});
ok(await S(N, () => __steelstorm.ui.view === 'menu'), 'a click outside the spotlight does nothing');
await N.click('#mnav [data-go="research"]');
r = await past(N, 1, 'open Research (the real nav button)');
await N.click('#rs-tabs [data-ln="g"]');
await N.click('#tree .vc.can:not(.sel)');
r = await past(N, 2, 'click a vehicle in the tree');
await N.click('#rs-info [data-act="target"]');
r = await past(N, 3, 'Research this sets the target');
await clickNext();
ok(!!(await stepTo(N, 'The garage')), 'Buy step: Next');
await N.click('#mnav [data-go="garage"]');
r = await past(N, 5, 'open the Garage');
await clickNext(); await stepTo(N, 'Modules'); await clickNext();
ok(!!(await stepTo(N, 'Pick what you spawn in')), 'lineup + modules steps: Next');
if (SHOTS) await N.screenshot({ path: '/tmp/ss-train-spot.png' });
const sel = await S(N, () => __steelstorm.save.sel);
await N.click('#lineup [data-slot="' + (sel ? 0 : 1) + '"]');
r = await past(N, 8, 'click another lineup vehicle (what you spawn in)');
await N.click('#mnav [data-go="mp"]');
r = await past(N, 9, 'open Multiplayer');
await clickNext(); await stepTo(N, 'Host a game'); await clickNext();
ok(!!(await until(async () => (await tut(N)).finale, 3000)) && await S(N, () => __steelstorm.save.tut.garage === 1), 'Your garage done and remembered');
await N.click('#hgt .hgt-end .hgt-btn:not(.pri)');      // All lessons
ok(!!(await until(() => S(N, () => document.querySelectorAll('#hgt-hub .hgt-row.done').length === 3), 2000)), 'Training list: three ticks');
await N.keyboard.press('Escape');
ok(!(await S(N, () => __steelstorm.tut.hubOpen)), 'Esc closes the Training list');
await N.click('#b-train');
ok(await S(N, () => __steelstorm.tut.hubOpen && document.querySelectorAll('#hgt-hub .hgt-row').length === 3), 'the Training button opens the list');
await N.click('#hgt-hub .hgt-btns .hgt-btn');
await ctxN.close();

// ---------- 5. an old (v1) save loads, keeps its stats, gets the training fields; no offer for an existing player ----------
const O = await page('old', OLD);
ok(await S(O, () => { const s = __steelstorm.save; return s.v === 2 && s.stats.wins === 4 && s.stats.kills === 31 && s.credits === 50000 && typeof s.tut === 'object' && !__steelstorm.tut.offerOpen; }), 'v1 save: migrated, stats kept, tut {} added, no offer');
await S(O, () => __steelstorm.tut.start('basic'));
await S(O, () => { __steelstorm.press('KeyW'); __steelstorm.step(30, .033); __steelstorm.press('KeyW', false); const e = __steelstorm.ents().find(x => x.team === 1); __steelstorm.kill(e.id); __steelstorm.tut.stop(); });
ok(await S(O, () => { const s = JSON.parse(localStorage.getItem('steelstorm_save') || '{}'); return __steelstorm.save.stats.kills === 31 && __steelstorm.save.stats.matches === 7 && (!s.stats || s.stats.kills === 31); }), 'a kill in practice does not reach save.stats');

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(`\n${passes} passed, ${fails} failed`);
await b.close();
process.exit(fails ? 1 : 0);
