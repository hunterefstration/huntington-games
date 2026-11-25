// The racing game: what the handling MEASURES (nobody can feel a car from a test, but these numbers say most of it).
// Driven with the keys, on open ground (the barriers are switched off for the measurement).
//   NODE_PATH="$(npm root -g)" node tools/tests/nl-feel.mjs [car ids...]        (default: kite vandal aria regent apex)
//   turn    hard left at 108 km/h: seconds until the car is turning at 90 % of what it settles to, the most sideways g,
//           and how far the body points away from where the car is going (degrees) once it has settled
//   let go  seconds from letting go of the wheel until the car runs straight again
//   swerve  left then right then let go: the widest angle the body got to, and seconds until it runs straight
//   hand    handbrake turn at 100 km/h (0.6 s), then the throttle: the widest angle, seconds until it is caught, km/h left
//   power   flat out, wheel hard over, from 54 km/h for 2.5 s: the widest angle (over 60 = it spun)
//   lift    lifting off in the middle of a hard bend: the widest angle
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';
const ids = process.argv.slice(2).filter(a => !a.startsWith('--')); if (!ids.length) ids.push('kite', 'vandal', 'aria', 'regent', 'apex');
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { }; });
await page.goto(base + '/Nightline/index.html?go=trial&standin=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__nightline && window.__nightline.started !== undefined, null, { timeout: 90000 });
const SET = Object.fromEntries(((process.argv.find(a => a.startsWith('--set=')) || '').slice(6)).split(',').filter(Boolean).map(kv => { const [k, v] = kv.split(':'); return [k, +v]; }));      // --set=in:4.5,lock:1.1 tries other numbers in FEEL (30-car.js)
const R = await page.evaluate(({ ids, SET }) => {
    const S = window.__nightline, R = S.Race, out = {}, DEG = 180 / Math.PI; R.state = 'race'; Object.assign(S.FEEL, SET); const keep = S.Car.onTrack; S.Car.onTrack = () => { };
    const hold = o => { S.keys.KeyW = !!o.w; S.keys.KeyS = !!o.s; S.keys.KeyA = !!o.a; S.keys.KeyD = !!o.d; S.keys.Space = !!o.h; };
    const c = R.me, beta = () => Math.abs(Math.atan2(c.v, Math.max(Math.abs(c.u), 1))) * DEG;
    const start = (u) => { S.Car.place(c, 20, 0); c.u = u; hold({}); for (let i = 0; i < 12; i++) S.step(1); };
    const run = (keys, secs, each) => { hold(keys); for (let i = 0; i < secs * 120; i++) { S.step(1); if (each) each(i / 120); } };
    const settle = () => { let t = 0; for (let i = 0; i < 600; i++) { S.step(1); if (Math.abs(c.w) > 0.04 || beta() > 1) t = (i + 1) / 120; } return t; };
    for (const id of ids) {
        if (!S.CARS[id]) continue; c.def = S.CARS[id]; const o = out[id] = {};
        // turn
        start(30); const ws = []; let g = 0; run({ a: 1, w: 1 }, 1.5, () => { ws.push(c.w); g = Math.max(g, Math.abs(c.ay) / 9.81); });
        const wEnd = ws[ws.length - 1]; o.t90 = (ws.findIndex(w => w >= wEnd * 0.9) + 1) / 120; o.over = Math.max(...ws) / wEnd; o.g = g; o.beta = beta();
        hold({ w: 1 }); o.letgo = settle();
        // swerve
        start(30); let b = 0; run({ a: 1, w: 1 }, 0.5, () => { b = Math.max(b, beta()); }); run({ d: 1, w: 1 }, 0.5, () => { b = Math.max(b, beta()); }); hold({ w: 1 }); let t = 0; for (let i = 0; i < 600; i++) { S.step(1); b = Math.max(b, beta()); if (Math.abs(c.w) > 0.04 || beta() > 1) t = (i + 1) / 120; } o.swB = b; o.swT = t;
        // handbrake turn
        start(28); b = 0; run({ a: 1, h: 1 }, 0.6, () => { b = Math.max(b, beta()); }); hold({ w: 1 }); t = 0; for (let i = 0; i < 720; i++) { S.step(1); b = Math.max(b, beta()); if (beta() > 3) t = (i + 1) / 120; } o.hB = b; o.hT = t; o.hU = c.u * 3.6;
        // power
        start(15); b = 0; const y0 = c.yaw; run({ a: 1, w: 1 }, 2.5, () => { b = Math.max(b, beta()); }); o.pB = b; o.pU = c.u * 3.6;
        // lift
        start(34); b = 0; run({ a: 1, w: 1 }, 1.2); run({ a: 1 }, 1.2, () => { b = Math.max(b, beta()); }); o.lB = b;
    }
    hold({}); S.Car.onTrack = keep; return out;
}, { ids, SET });
const f = (x, n = 2) => x.toFixed(n).padStart(6);
console.log('car        turn: t90   over      g   beta | let go | swerve: beta   secs | hand: beta   secs   km/h | power: beta  km/h | lift: beta');
for (const id in R) { const o = R[id]; console.log(id.padEnd(10) + '     ' + f(o.t90) + f(o.over) + ' ' + f(o.g) + ' ' + f(o.beta, 1) + ' | ' + f(o.letgo) + ' |        ' + f(o.swB, 1) + ' ' + f(o.swT) + ' |      ' + f(o.hB, 1) + ' ' + f(o.hT) + ' ' + f(o.hU, 0) + ' |       ' + f(o.pB, 1) + f(o.pU, 0) + ' |     ' + f(o.lB, 1)); }
await browser.close(); server.close();
