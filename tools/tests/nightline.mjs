// HIGHBEAM, the racing game (its folder, save key and debug hook still say Nightline): the circuit's numbers, how a car drives,
// the computer's drivers, a whole race, what a result opens, the save, the garage (seat time, the admin unlock), what a frame costs.
//   NODE_PATH="$(npm root -g)" node tools/tests/nightline.mjs [track car race save garage draw circuits]      (how it FEELS: nl-feel.mjs)
// "standin=1" in a query asks for the plain stand-in city (no file needed); the draw part uses the real city when its file is there.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const want = process.argv.slice(2).filter(a => !a.startsWith('--')), on = k => !want.length || want.includes(k);
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); } };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function open(query, save) {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage(); page.errs = [];
    await page.addInitScript(s => { Element.prototype.requestPointerLock = function () { }; try { if (s) localStorage.setItem('nightline_save', JSON.stringify(s)); } catch (e) { } }, save || null);
    page.on('pageerror', e => page.errs.push(e.message.slice(0, 200)));
    await page.goto(base + '/Nightline/index.html?' + (query || ''), { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__nightline && window.__nightline.started !== undefined, null, { timeout: 90000 });
    await page.waitForTimeout(300); return page;
}
const HAVE_CITY = fs.existsSync('Nightline/assets/quay.hgm');

if (on('track')) {
    ok(!/<!--HG-->/.test(fs.readFileSync('Nightline/index.html', 'utf8')), 'track: the built page carries no licence block (tools/build-release.py issues one at release)');
    const p = await open('standin=1');
    const r = await p.evaluate(() => {
        const S = window.__nightline, T = S.Track, o = {}, N = T.N; let gap = 0, lineOut = 0, kmax = 0;
        for (let i = 0; i < N; i++) { const a = T.S[i], b = T.S[(i + 1) % N]; gap = Math.max(gap, Math.abs(Math.hypot(b[0] - a[0], b[2] - a[2]) - T.step)); if (Math.abs(T.line[i]) > T.W / 2 - 1.5) lineOut++; kmax = Math.max(kmax, Math.abs(T.kap[i])); }
        // a place on the circuit and back again
        let worst = 0; for (let i = 0; i < 60; i++) { const u = Math.random() * N, d = (Math.random() - 0.5) * 12; T.spot(u, d, o); const x = o.x, z = o.z; T.locate(x, z, u, o); worst = Math.max(worst, Math.abs(T.ahead(u, o.u)) * T.step, Math.abs(o.d - d)); }
        const far = {}; T.spot(300, 2, far); T.locate(far.x, far.z, null, o);
        const v = T.speeds(13, 12, 7, 70); let vmin = 99, vmax = 0; for (const x of v) { vmin = Math.min(vmin, x); vmax = Math.max(vmax, x); }
        return { N, len: T.len, gap, lineOut, kmax, worst, whole: Math.abs(o.u - 300), vmin, vmax, menu: !document.getElementById('menu').classList.contains('hidden'), show: S.Race.mode, standin: S.World.standin };
    });
    ok(r.N > 300 && r.len > 1200 && r.len < 4000 && r.gap < 0.2, 'track: the centre line is a closed row of evenly spaced samples', JSON.stringify(r));
    ok(r.lineOut === 0 && r.kmax < 0.08, 'track: the fast line stays on the road and has no kink', 'outside ' + r.lineOut + ', tightest 1/' + (1 / r.kmax).toFixed(0) + ' m');
    ok(r.worst < 0.6 && r.whole < 1, 'track: a spot on the circuit is found again, with a hint and without', 'worst ' + r.worst.toFixed(2) + ' m');
    ok(r.vmin > 10 && r.vmin < 30 && r.vmax > 50, 'track: the speeds a car can carry run from hairpin to flat out', (r.vmin * 3.6).toFixed(0) + ' to ' + (r.vmax * 3.6).toFixed(0) + ' km/h');
    ok(r.menu && r.show === 'show', 'track: the game opens on its menu with a car driving the circuit behind it', JSON.stringify({ menu: r.menu, mode: r.show }));
    ok(!p.errs.length, 'track: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('car')) {
    const p = await open('go=trial&standin=1');
    const R = await p.evaluate(() => {
        const S = window.__nightline, R = S.Race, out = {}; R.state = 'race';
        const hold = o => { S.keys.KeyW = !!o.w; S.keys.KeyS = !!o.s; S.keys.KeyA = !!o.a; S.keys.KeyD = !!o.d; S.keys.Space = !!o.h; }, st = n => { for (let i = 0; i < n; i++) S.step(1); };
        for (const id of Object.keys(S.CARS)) {
            const c = R.me; c.def = S.CARS[id]; const o = out[id] = {};
            S.Car.place(c, 26, 0); const yw = c.yaw; hold({ w: 1 }); o.t100 = 0; for (let i = 0; i < 720; i++) { st(1); if (!o.t100 && c.u * 3.6 >= 100) o.t100 = i / 120; } o.v8 = c.u; o.top = c.def.top; o.straight = Math.abs(c.yaw - yw);      // with the wheel left alone it keeps its heading
            S.Car.place(c, 20, 0); c.u = 22; hold({}); st(10); const y0 = c.yaw; hold({ a: 1 }); st(90); o.left = c.yaw - y0; o.leftD = c.td; o.slipL = c.slip;
            S.Car.place(c, 20, 0); c.u = 22; hold({}); st(10); const y1 = c.yaw; hold({ d: 1 }); st(90); o.right = c.yaw - y1; o.rightD = c.td;
            S.Car.place(c, 60, 0); c.u = 30; hold({ w: 1, a: 1 }); st(150); o.power = Math.abs(c.slipR); o.powerU = c.u;
            S.Car.place(c, 20, -3); c.u = 24; hold({ a: 1, h: 1 }); st(70); o.hand = Math.abs(c.slipR);
            S.Car.place(c, 30, 0); c.u = 40; hold({ s: 1 }); o.stop = 0; for (let i = 0; i < 720; i++) { st(1); if (c.u < 0.5) { o.stop = i / 120; break; } }
            st(240); o.rev = c.u;
            S.Car.place(c, 40, 6); c.u = 30; c.yaw += 0.3; hold({ w: 1 }); let umin = 99, dmax = 0; for (let i = 0; i < 180; i++) { st(1); umin = Math.min(umin, c.u); dmax = Math.max(dmax, Math.abs(c.td)); } o.wallU = umin; o.wallD = dmax; o.fin = [c.x, c.y, c.z, c.u, c.v, c.w].every(isFinite);
            S.Car.place(c, 100, 0); c.u = 20; hold({}); st(30); const sp = {}; S.Track.spot(c.tu, c.td, sp); o.onRoad = Math.abs(c.y - sp.y);
        }
        hold({}); return out;
    });
    const tops = {};
    for (const id of Object.keys(R)) { const o = R[id], tag = 'car: ' + id + ': ';
        ok(o.t100 > 2 && o.t100 < 6.5 && o.v8 > o.top * 0.5 && o.straight < 0.02, tag + 'it pulls away straight and quickly', '0-100 in ' + o.t100.toFixed(2) + ' s, ' + (o.v8 * 3.6).toFixed(0) + ' km/h after 6 s, heading moved ' + o.straight.toFixed(3) + ' rad');
        ok(o.left > 0.25 && o.leftD > 0.5 && o.right < -0.25 && o.rightD < -0.5 && o.slipL < 0.3, tag + 'A turns it left and D right, and it holds the road', 'left ' + o.left.toFixed(2) + ', right ' + o.right.toFixed(2) + ' rad, slip ' + o.slipL.toFixed(2));
        ok(o.power < 0.6 && o.powerU > 14, tag + 'flat out with the wheel hard over it slides wide, it does not spin', 'rear slip ' + o.power.toFixed(2) + ', still ' + (o.powerU * 3.6).toFixed(0) + ' km/h');
        ok(o.hand > 0.3, tag + 'the handbrake lets the back go', 'rear slip ' + o.hand.toFixed(2));
        ok(o.stop > 1.5 && o.stop < 4.5 && o.rev < -1, tag + 'it brakes to a stop from 144 km/h, then backs up', o.stop.toFixed(2) + ' s, then ' + o.rev.toFixed(1) + ' m/s');
        ok(o.fin && o.wallD <= 8.5 && o.wallU > 8 && o.wallU < 30, tag + 'a barrier keeps it in and costs it speed', 'slowest ' + o.wallU.toFixed(1) + ' m/s, farthest out ' + o.wallD.toFixed(2) + ' m');
        ok(o.onRoad < 0.02, tag + 'it sits on the road', o.onRoad.toFixed(3) + ' m off');
        tops[id] = o.top;
    }
    {   // twenty cars in five classes: the cars of a class differ in character, each class is faster than the one before it
        const ci = await p.evaluate(() => Object.fromEntries(Object.entries(window.__nightline.CARS).map(([k, v]) => [k, v.ci]))), best = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
        for (const id in tops) { best[ci[id]] = Math.max(best[ci[id]], tops[id]); n[ci[id]]++; }
        ok(Object.keys(tops).length === 20 && n.every(x => x === 4), 'car: twenty cars, four in each of five classes', n.join(','));
        ok(best.every((b, i) => i === 0 || b > best[i - 1]), 'car: the fastest car of each class is faster than the fastest of the class before', best.map(b => (b * 3.6).toFixed(0)).join(' < '));
    }
    ok(!p.errs.length, 'car: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('race')) {
    const laps = [];
    for (const level of [0, 2]) {
        const p = await open('go=race&standin=1&car=aria&level=' + level);
        const r = await p.evaluate(async () => {
            const S = window.__nightline, R = S.Race, hits = {}; let lights = [];
            for (let i = 0; i < 1500 && R.cars.some(c => c.bot && c.lap < 2); i++) { S.step(12); if (lights[lights.length - 1] !== R.lights) lights.push(R.lights); for (const c of R.cars) if (c.hit) { hits[c.name] = (hits[c.name] || 0) + 1; c.hit = 0; } if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); }
            const bots = R.cars.filter(c => c.bot), flying = bots.map(c => c.laps[1]).filter(Boolean);
            return { n: R.cars.length, lights, done: bots.filter(c => c.lap >= 2).length, flying, hits: Object.values(hits).reduce((a, b) => a + b, 0), rev: bots.filter(c => c.u < -1).length, order: R.order.map(c => c.name).join(' '), place: R.place(R.me), t: R.t };
        });
        const tag = 'race: level ' + level + ': ', mean = r.flying.reduce((a, b) => a + b, 0) / (r.flying.length || 1); laps.push(mean);
        ok(r.n === 8 && r.lights.join('') === '01234', tag + 'eight cars wait on the grid for the lights', r.n + ' cars, lights ' + r.lights.join(''));
        ok(r.done === 7 && r.flying.length === 7, tag + 'every one of the computer\'s drivers gets round twice', r.done + ' of 7 in ' + r.t.toFixed(0) + ' s');
        ok(mean > 35 && mean < 90 && r.hits <= 30, tag + 'they lap in a sensible time without leaning on the barriers', 'mean flying lap ' + mean.toFixed(1) + ' s, ' + r.hits + ' touches between them');
        ok(r.place === 8, tag + 'a car that never left the grid is last', 'place ' + r.place);
        ok(!p.errs.length, tag + 'no script error', p.errs.join(' | ')); await p.context().close();
    }
    ok(laps[1] < laps[0] - 1.5, 'race: ELITE drivers are quicker than ROOKIE ones', laps.map(x => x.toFixed(1)).join(' against '));
}

if (on('save')) {
    // a win: the flag, what it opens, what is kept
    const p = await open('go=race&standin=1&level=1');
    const r = await p.evaluate(async () => {
        const S = window.__nightline, R = S.Race; S.step(480); const me = R.me, before = Object.keys(S.Save.data.cars).join(',');
        // drive the player's car with the computer's hands, far quicker than the field, for the whole race
        me.bot = { skill: 1, off: 0, v: S.Track.speeds(me.def.grip * 0.8, me.def.brake * 0.8, me.def.acc * 0.8, me.def.top), side: 0, sideT: 0 }; me.def = Object.assign({}, me.def, { pw: me.def.pw * 2.2, acc: me.def.acc * 1.6, grip: me.def.grip * 1.5, top: me.def.top * 1.3 }); me.bot.v = S.Track.speeds(me.def.grip * 0.8, me.def.brake * 0.8, me.def.acc * 0.8, me.def.top);
        for (let i = 0; i < 3000 && R.state !== 'over'; i++) { S.step(12); if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); }
        S.draw(4); S.step(480); S.draw(0.016);
        const sv = JSON.parse(localStorage.getItem('nightline_save'));
        return { state: R.state, res: R.result, before, cars: Object.keys(sv.cars).join(','), wins: sv.wins, races: sv.races, best: sv.best['quay|kite'], shown: !document.getElementById('results').classList.contains('hidden'), text: document.getElementById('results').textContent.slice(0, 60), seat: sv.seat.kite, seatText: (document.querySelector('#results .seatres') || {}).textContent || '' };
    });
    ok(r.state === 'over' && r.res && r.res.place === 1, 'save: the race ends when the player takes the flag', JSON.stringify(r.res));
    ok(r.before === 'kite,pixel,moth,rascal' && /vandal/.test(r.cars) && /howl/.test(r.cars) && /aria/.test(r.cars) && /regent/.test(r.cars) && !/halo/.test(r.cars) && !/apex/.test(r.cars), 'save: a win against PRO drivers opens the MUSCLE, SPORT and GT classes, not the SUPER one', r.before + ' -> ' + r.cars);
    ok(r.wins === 1 && r.races === 1 && r.best && r.best.lap > 10 && r.best.race > r.best.lap, 'save: the win, the best lap and the race time are kept', JSON.stringify(r.best));
    ok(r.shown && /1ST/.test(r.text), 'save: the result is shown', r.text);
    ok(r.res.seat && r.res.seat.gain > 100 && r.seat === r.res.seat.gain && r.res.seat.to > r.res.seat.from && /SEAT TIME \+\d+/.test(r.seatText) && /LEVEL \d/.test(r.seatText), 'save: the laps and the win earn seat time in the car, kept and shown', JSON.stringify(r.res.seat) + ' ' + r.seatText.slice(0, 70));
    ok(!p.errs.length, 'save: no script error', p.errs.join(' | ')); await p.context().close();
    // an older, thinner save is filled in, never wiped
    const q = await open('standin=1', { v: 1, car: 'vandal', cars: { kite: 1, vandal: 1 }, wins: 4, best: { 'quay|kite': { lap: 61.234 } }, settings: { laps: 5 } });
    const s = await q.evaluate(() => { const D = window.__nightline.Save.data; return { car: D.car, cars: Object.keys(D.cars).join(','), wins: D.wins, lap: D.best['quay|kite'].lap, laps: D.settings.laps, sfx: D.settings.sfx, paint: typeof D.paint, medals: typeof D.medals, head: document.getElementById('car-head').textContent.slice(0, 40) }; });
    ok(s.car === 'vandal' && s.cars === 'kite,vandal,pixel,moth,rascal,brute,anvil,howl' && s.wins === 4 && s.lap === 61.234 && s.laps === 5, 'save: an older save keeps its car, wins, records and settings, and a car it had now brings its whole class', JSON.stringify(s));
    ok(s.sfx === 0.8 && s.paint === 'object' && s.medals === 'object' && /VANDAL/.test(s.head), 'save: what it lacked is filled in, and the menu shows its car', JSON.stringify(s));
    ok(!q.errs.length, 'save: no script error (old save)', q.errs.join(' | ')); await q.context().close();
}

if (on('draw')) {
    const p = await open('go=race' + (HAVE_CITY ? '' : '&standin=1') + '&glow=1');
    const r = await p.evaluate(async () => {
        const S = window.__nightline, R = S.Race; S.step(900); let calls = 0, tris = 0;
        for (let i = 0; i < 6; i++) { S.step(120); S.draw(0.016); calls = Math.max(calls, S.App.calls); tris = Math.max(tris, S.App.tris); await new Promise(r => setTimeout(r, 0)); }
        return { standin: S.World.standin, why: S.World.why || '', calls, tris, glows: S.World.glows.length, near: S.World.glows.filter(g => g.near).length, wet: S.World.wet.mesh.count, pools: S.World.pools.mesh.count, glow: S.App.glow, hud: !document.getElementById('hud').classList.contains('hidden'), speed: document.getElementById('h-kmh').textContent, place: document.getElementById('h-place').textContent };
    });
    if (HAVE_CITY) ok(!r.standin, 'draw: the city file loads', r.why);
    ok(r.calls > 8 && r.calls < 120 && r.tris > 3000 && r.tris < 420000, 'draw: a frame of a race is within what a Chromebook draws', r.calls + ' calls, ' + r.tris + ' triangles');
    ok(r.glows > 20 && r.near > 10 && r.wet > 4 && r.pools >= 24, 'draw: lamps lie on the wet road and every car throws its light', r.glows + ' lamps (' + r.near + ' by the road), ' + r.wet + ' streaks, ' + r.pools + ' pools');
    ok(r.hud && r.place === '8' && r.speed === '0', 'draw: the dials show a car still on the grid in eighth place', r.speed + ' km/h, place ' + r.place);
    ok(!p.errs.length, 'draw: no script error', p.errs.join(' | ')); await p.context().close();
}

// A published test build, from an address that is NOT localhost (the way the paste-in loader runs it): the page starts, the
// city comes from its pack on the CDN, a race runs.   node tools/tests/nightline.mjs live --build=59 --repo=owner/name
// the garage: click a car to look at it, EQUIP it, what a locked one needs, paints that seat time opens, the admin unlock
if (on('garage')) {
    const p = await open('standin=1', { v: 1, car: 'kite', cars: { kite: 1 }, seat: { kite: 200 }, paint: {} });
    const S = f => p.evaluate(f), settle = async () => { await p.evaluate(() => window.__nightline.UI.q); await p.waitForTimeout(60); };
    const info = () => p.evaluate(() => { const N = window.__nightline, D = N.Save.data, t = id => document.getElementById(id).textContent; return { car: D.car, own: Object.keys(D.cars).join(','), admin: D.admin, mode: N.Race.mode, shown: N.Race.me && N.Race.me.id, paint: N.Race.me && N.Race.me.paint, u: N.Race.me ? Math.abs(N.Race.me.u) : -1, info: t('g-info'), equip: !!document.querySelector('#g-info [data-act=equip]'), tiles: document.querySelectorAll('#g-list [data-car]').length, locked: document.querySelectorAll('#g-list [data-car].lock').length, heads: document.querySelectorAll('#g-list .g-cls').length, garage: !document.getElementById('garage').classList.contains('hidden'), menu: !document.getElementById('menu').classList.contains('hidden'), tag: t('g-admin'), home: t('car-head') + ' ' + t('car-seat') }; });
    let r = await info();
    ok(r.menu && !r.garage && /KITE/.test(r.home) && /LEVEL 3/.test(r.home) && r.mode === 'show', 'garage: HOME shows the equipped car and its seat time, and drives it round behind the page', r.home + ' ' + r.mode);
    await p.click('[data-act=garage]'); await settle(); await S(() => { window.__nightline.step(240); window.__nightline.draw(0.016); }); r = await info();
    ok(r.garage && !r.menu && r.tiles === 20 && r.heads === 5 && r.locked === 16, 'garage: its own page, all twenty cars in their five classes, the sixteen locked ones marked', JSON.stringify({ tiles: r.tiles, heads: r.heads, locked: r.locked }));
    ok(r.mode === 'park' && r.shown === 'kite' && r.u < 0.01 && /EQUIPPED/.test(r.info) && !r.equip, 'garage: the equipped car stands still on the road to be looked at', r.mode + ' ' + r.shown + ' ' + r.u);
    const spin = await S(() => { const N = window.__nightline, a = N.Race.spin; N.draw(0.5); const b = N.Race.spin; N.Race.hold = true; N.draw(0.5); const c = N.Race.spin; N.Race.hold = false; return [b - a, c - b]; });
    ok(spin[0] > 0.05 && spin[1] === 0, 'garage: the camera walks round the car, and stops while it is being dragged', spin.join(' '));
    await p.click('[data-car=vandal]'); await settle(); r = await info();
    ok(r.shown === 'vandal' && r.car === 'kite' && !r.equip && /LOCKED/.test(r.info) && /top three/.test(r.info), 'garage: a locked car can be looked at, says what opens it, and cannot be equipped', r.info.slice(0, 40) + ' ... ' + r.info.slice(-60));
    await p.click('[data-car=kite]'); await settle(); await p.click('[data-paint="8"]'); await settle(); const p8 = (await info()).paint; await p.click('[data-paint="10"]', { force: true }); await settle(); r = await info();
    ok(p8 === 8 && r.paint === 8, 'garage: seat time level 3 opens the CARBON paint for that car; GOLD (level 10) stays shut', p8 + ' then ' + r.paint);
    await p.click('[data-car=pixel]'); await settle(); const before = await info(); await p.click('[data-act=equip]'); r = await info();
    ok(before.equip && before.car === 'kite' && r.car === 'pixel' && /EQUIPPED/.test(r.info), 'garage: clicking a car only looks at it; EQUIP makes it the car you race', before.car + ' -> ' + r.car);
    await p.keyboard.press('KeyP'); await settle(); await p.click('[data-car=apex]'); await settle(); r = await info(); const adminEquip = r.equip; if (adminEquip) await p.click('[data-act=equip]'); const a2 = await info();
    ok(r.admin === true && r.locked === 0 && adminEquip && a2.car === 'apex' && /ADMIN/.test(r.tag) && r.own === 'kite,pixel,moth,rascal', 'garage: P is the admin unlock: every car can be equipped, and the save still only OWNS what was earned', JSON.stringify({ locked: r.locked, car: a2.car, own: r.own }));
    await p.keyboard.press('KeyP'); await settle(); r = await info();
    ok(r.admin === false && r.locked === 16 && r.car === 'kite' && r.own === 'kite,pixel,moth,rascal', 'garage: P again turns it off and the earned garage is back (a car that is not yours is un-equipped)', JSON.stringify({ locked: r.locked, car: r.car }));
    await p.keyboard.press('Escape'); await settle(); r = await info();
    ok(r.menu && !r.garage && r.mode === 'show' && r.shown === 'kite', 'garage: Esc goes back to HOME, where the equipped car drives again', r.mode + ' ' + r.shown);
    ok(!p.errs.length, 'garage: no script error', p.errs.join(' | ')); await p.context().close();
}

// every circuit: the computer's drivers get round it (on the plain stand-in city, so a circuit can be tested before its city is made)
if (on('circuits')) {
    const p0 = await open('standin=1'), ids = await p0.evaluate(() => Object.keys(window.__nightline.TRACKDATA)); await p0.context().close();
    ok(ids.length >= 3 && ids[0] === 'quay', 'circuits: there are at least three, NEON QUAY first', ids.join(', '));
    for (const id of ids.filter(i => i !== 'quay')) {
        const p = await open('go=race&standin=1&car=aria&level=1&circuit=' + id);
        const r = await p.evaluate(async () => {
            const S = window.__nightline, R = S.Race, hits = {};
            for (let i = 0; i < 2200 && R.cars.some(c => c.bot && c.lap < 2); i++) { S.step(12); for (const c of R.cars) if (c.hit) { hits[c.name] = (hits[c.name] || 0) + 1; c.hit = 0; } if (i % 60 === 0) await new Promise(r => setTimeout(r, 0)); }
            const bots = R.cars.filter(c => c.bot), flying = bots.map(c => c.laps[1]).filter(Boolean); S.draw(0.016);
            return { name: S.Track.name, km: S.Track.length / 1000, done: bots.filter(c => c.lap >= 2).length, flying, hits: Object.values(hits).reduce((a, b) => a + b, 0), calls: S.App.calls, t: R.t };
        });
        const tag = 'circuits: ' + id + ': ', mean = r.flying.reduce((a, b) => a + b, 0) / (r.flying.length || 1);
        ok(r.done === 7, tag + 'every one of the computer\'s drivers gets round twice', r.done + ' of 7 in ' + r.t.toFixed(0) + ' s (' + r.name + ', ' + r.km.toFixed(2) + ' km)');
        ok(mean > 35 && mean < 120 && r.hits <= 40, tag + 'they lap in a sensible time without leaning on the barriers', 'mean flying lap ' + mean.toFixed(1) + ' s, ' + r.hits + ' touches between them');
        ok(r.calls > 5 && !p.errs.length, tag + 'it draws, with no script error', r.calls + ' draws ' + p.errs.join(' | ')); await p.context().close();
    }
}

if (want.includes('live')) {
    const arg = n => { const x = process.argv.find(x => x.startsWith('--' + n + '=')); return x ? x.slice(n.length + 3) : ''; }, to = 'https://cdn.jsdelivr.net/gh/' + arg('repo') + '@proof' + arg('build') + '/Nightline/';
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
    await page.route('http://lab.hg.test/**', r => new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }) : r.fulfill({ status: 404, body: '' }));
    await page.goto('http://lab.hg.test/', { waitUntil: 'load' });
    await page.evaluate(async to => { const html = await (await fetch(to + 'index.html')).text(), tag = '<script>window.HG_BASE = ' + JSON.stringify(to) + '; window.HG_LAB = 1;</script>'; document.open(); document.write(html.replace(/<head[^>]*>/i, m => m + tag)); document.close(); }, to);
    await page.waitForFunction(() => !!window.__nightline && window.__nightline.started !== undefined, null, { timeout: 120000 }).catch(() => { });
    const shut = await page.evaluate(() => /shut down|not licen|licence|unauthor/i.test(document.body ? document.body.innerText : ''));
    ok(!shut, 'live: the page is not refused by a licence gate', await page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 120)));
    const r = await page.evaluate(async () => { const S = window.__nightline; if (!S) return { started: false }; const o = { menu: !document.getElementById('menu').classList.contains('hidden'), standin: S.World.standin, why: S.World.why || '', glows: S.World.glows.length, packs: !!(S.App && document.querySelector('canvas')) }; await S.UI.play('race'); S.step(900); S.draw(0.016); o.state = S.Race.state; o.cars = S.Race.cars.length; o.calls = S.App.calls; o.moved = S.Race.cars.filter(c => c.bot && c.u > 5).length; return o; });
    ok(r.menu && r.standin === false && r.glows > 100, 'live: the menu comes up with the city from its pack behind it', JSON.stringify(r));
    ok(r.state === 'race' && r.cars === 8 && r.moved === 7 && r.calls > 20, 'live: a race starts and the field drives off', JSON.stringify(r));
    const m = await page.evaluate(async () => { const S = window.__nightline, o = { models: Object.keys(S.Cars.A).length, body: S.Race.cars.filter(c => c.mdl && c.mdl.body).length, city: {} }; for (const id of Object.keys(S.TRACKDATA)) { S.Race.clear(); await S.Race.start({ mode: 'show', car: 'apex', circuit: id }); S.step(60); S.draw(0.016); o.city[id] = S.World.standin === false && S.World.glows.length > 100 && S.App.calls > 20; } return o; });
    ok(m.models >= 8 && m.body === 8, 'live: the eight cars of the race are models from their pack', JSON.stringify(m));
    ok(Object.values(m.city).length >= 3 && Object.values(m.city).every(Boolean), 'live: the scenery of every circuit comes from its pack', JSON.stringify(m.city));
    ok(!errs.length, 'live: no script error', errs.join(' | ')); await page.context().close();
}

console.log((fail ? 'FAILED ' + fail + ', ' : '') + 'passed ' + pass);
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
